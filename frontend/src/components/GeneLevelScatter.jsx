import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Slider,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Biotech,
    Download,
    FilterAlt,
    Insights,
    RestartAlt,
    Science,
} from '@mui/icons-material';
import { getDataFileText } from '../api/gwas';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementNearViewportCenter } from '../utils/scroll';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    controlFieldSx,
    metricChipTone,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_TALL_PLOT_HEIGHT,
    sectionTitleSx,
    statusToggleSx,
    summaryChipSx,
    toolbarSx,
} from '../themeUtils';
import FloatingLegend from './FloatingLegend';
import GeneLevelScatterTable from './GeneLevelScatterTable';

const DATA_DIR = 'gene_level_scatter/tables';
const DEFAULT_EXPORT_WIDTH = 1280;
const DEFAULT_EXPORT_HEIGHT = 820;
const DEFAULT_POINT_SIZE = 7;
const DEFAULT_LABEL_LIMIT = 10;

const EVIDENCE_CLASSES = {
    background: {
        label: 'Neutral / low support',
        color: '#b8c2d0',
        symbol: 'circle',
        rank: 0,
    },
    posterior_high: {
        label: 'Posterior-high signal',
        color: '#b45a78',
        symbol: 'circle',
        rank: 1,
    },
    regulation_supported: {
        label: 'Concordant signal',
        color: '#c45a32',
        symbol: 'circle',
        rank: 3,
    },
    direction_discordant: {
        label: 'Discordant signal',
        color: '#3f78a8',
        symbol: 'diamond',
        rank: 2,
    },
};

const EVIDENCE_ORDER = ['background', 'posterior_high', 'regulation_supported', 'direction_discordant'];

const MARKER_STYLE_BY_CLASS = {
    background: {
        opacity: 0.34,
        sizeBoost: 0,
        lineColor: 'rgba(255,255,255,0)',
        lineWidth: 0,
    },
    posterior_high: {
        opacity: 0.88,
        sizeBoost: 1.25,
        lineColor: 'rgba(112, 36, 68, 0.3)',
        lineWidth: 0.4,
    },
    regulation_supported: {
        opacity: 0.94,
        sizeBoost: 2.2,
        lineColor: 'rgba(127, 29, 29, 0.34)',
        lineWidth: 0.55,
    },
    direction_discordant: {
        opacity: 0.94,
        sizeBoost: 2.1,
        lineColor: 'rgba(30, 64, 175, 0.32)',
        lineWidth: 0.55,
    },
};

const VIEW_MODES = {
    ALL: 'all',
    SUPPORTED: 'supported',
    DISCORDANT: 'discordant',
    LABELED: 'labeled',
};

const DIRECTION_MODES = {
    ALL: 'all',
    CONCORDANT: 'concordant',
    DISCORDANT: 'discordant',
};

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function sanitizeFileNamePart(value) {
    return String(value || 'plot').replace(/[\\/:*?"<>|]+/g, '_');
}

function normalizeExportSize(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return clamp(Math.round(num), 200, 4000);
}

function parseBoolean(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function resolveEvidenceClass(raw, flags) {
    const rawClass = String(raw.evidence_class || '').trim();
    if (rawClass && rawClass !== 'background' && EVIDENCE_CLASSES[rawClass]) return rawClass;
    if (flags.isRegSig && flags.isDiscordant) return 'direction_discordant';
    if (flags.isRegSig && flags.isConcordant) return 'regulation_supported';
    if (flags.isHighEffect) return 'posterior_high';
    return EVIDENCE_CLASSES[rawClass] ? rawClass : 'background';
}

function evidenceChipTone(theme, key, bgAlpha = 0.09, borderAlpha = 0.22) {
    const color = EVIDENCE_CLASSES[key].color;
    return {
        backgroundColor: alpha(color, bgAlpha),
        color,
        border: `1px solid ${alpha(color, borderAlpha)}`,
    };
}

function parseTsv(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t');
    return lines.slice(1).map((line, index) => {
        const cells = line.split('\t');
        const raw = {};
        headers.forEach((header, i) => {
            raw[header] = cells[i] ?? '';
        });

        const gene = String(raw.gene || '').trim();
        const ensg = String(raw.ensg || '').trim();
        const label = String(raw.label || '').trim();
        const rowKey = `${ensg || gene || 'gene'}-${index}`;
        const isConcordant = parseBoolean(raw.is_concordant);
        const isDiscordant = parseBoolean(raw.is_discordant);
        const isRegSig = parseBoolean(raw.is_reg_sig);
        const isHighEffect = parseBoolean(raw.is_high_effect);
        const evidenceClass = resolveEvidenceClass(raw, {
            isConcordant,
            isDiscordant,
            isRegSig,
            isHighEffect,
        });

        return {
            rowKey,
            raw,
            index,
            ensg,
            gene,
            label,
            labelReason: String(raw.label_reason || '').trim(),
            traitLabel: String(raw.trait_label || '').trim(),
            postMean: toFiniteNumber(raw.post_mean),
            beta: toFiniteNumber(raw.beta_withShet),
            betaSe: toFiniteNumber(raw.betaSE_withShet),
            p: toFiniteNumber(raw.P_withShet),
            fdr: toFiniteNumber(raw.fdr),
            signedLogP: toFiniteNumber(raw.signed_log10_p),
            absPostMean: toFiniteNumber(raw.abs_post_mean),
            absSignedLogP: toFiniteNumber(raw.abs_signed_log10_p),
            combinedScore: toFiniteNumber(raw.combined_score),
            postMeanSign: String(raw.post_mean_sign || '').trim(),
            regulationSign: String(raw.regulation_sign || '').trim(),
            isConcordant,
            isDiscordant,
            isRegSig,
            isHighEffect,
            evidenceClass,
            evidenceClassLabel: EVIDENCE_CLASSES[evidenceClass].label,
        };
    }).filter((row) => (
        row.gene
        && Number.isFinite(row.postMean)
        && Number.isFinite(row.signedLogP)
    ));
}

function computeAxisRange(values, paddingRatio = 0.08) {
    const finiteValues = values.filter(Number.isFinite);
    if (!finiteValues.length) return [-1, 1];
    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);
    if (min === max) {
        const delta = Math.max(Math.abs(min) * paddingRatio, 1);
        return [min - delta, max + delta];
    }
    const padding = (max - min) * paddingRatio;
    return [min - padding, max + padding];
}

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : 'NA';
}

function formatPValue(value) {
    return Number.isFinite(value) ? value.toExponential(2) : 'NA';
}

function buildHoverText(row) {
    return [
        `<b>${row.gene || row.ensg}</b>`,
        row.ensg ? `<span style="color:#64748b">${row.ensg}</span>` : '',
        `<span style="color:${EVIDENCE_CLASSES[row.evidenceClass].color};font-weight:600">${row.evidenceClassLabel}</span>`,
        '',
        '<b>GeneBayes</b>',
        `post_mean: ${formatNumber(row.postMean, 4)} (${row.postMeanSign || 'unknown'})`,
        '',
        '<b>Perturb-seq regulation</b>',
        `signed -log10(P): ${formatNumber(row.signedLogP, 2)}`,
        `beta_withShet: ${formatNumber(row.beta, 4)} (${row.regulationSign || 'unknown'})`,
        `P_withShet: ${formatPValue(row.p)}`,
        `FDR: ${formatPValue(row.fdr)}`,
        '',
        `Combined score: ${formatNumber(row.combinedScore, 2)}`,
    ].filter(Boolean).join('<br>');
}

function getBackgroundPointColor(row) {
    const x = Number.isFinite(row.postMean) ? row.postMean : 0;
    const y = Number.isFinite(row.signedLogP) ? row.signedLogP : 0;
    const sameDirection = (x >= 0 && y >= 0) || (x <= 0 && y <= 0);

    if (sameDirection) {
        return x >= 0 ? 'rgba(196, 90, 50, 0.42)' : 'rgba(63, 120, 168, 0.42)';
    }

    return x >= 0 ? 'rgba(196, 90, 50, 0.26)' : 'rgba(63, 120, 168, 0.26)';
}

function getBackgroundGroupKey(row) {
    const x = Number.isFinite(row.postMean) ? row.postMean : 0;
    const y = Number.isFinite(row.signedLogP) ? row.signedLogP : 0;
    const sameDirection = (x >= 0 && y >= 0) || (x <= 0 && y <= 0);
    if (x >= 0 && sameDirection) return 'background_pos_same';
    if (x < 0 && sameDirection) return 'background_neg_same';
    if (x >= 0) return 'background_pos_cross';
    return 'background_neg_cross';
}

function getBackgroundHoverColor(groupKey) {
    switch (groupKey) {
        case 'background_pos_same':
            return EVIDENCE_CLASSES.regulation_supported.color;
        case 'background_neg_same':
            return EVIDENCE_CLASSES.direction_discordant.color;
        case 'background_pos_cross':
            return EVIDENCE_CLASSES.regulation_supported.color;
        case 'background_neg_cross':
            return EVIDENCE_CLASSES.direction_discordant.color;
        default:
            return EVIDENCE_CLASSES.background.color;
    }
}

function getDataPath(fileId) {
    return `${DATA_DIR}/${encodeURIComponent(fileId)}.tsv`;
}

export default function GeneLevelScatter({ fileId, gwasId, traitLabel, lookupIds = [] }) {
    const theme = useTheme();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const plotRef = useRef(null);
    const plotElRef = useRef(null);
    const tableRowRefs = useRef({});
    const tableSectionRef = useRef(null);

    const [payload, setPayload] = useState({ rows: [], fileId: '', path: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState(VIEW_MODES.ALL);
    const [directionMode, setDirectionMode] = useState(DIRECTION_MODES.ALL);
    const [geneQuery, setGeneQuery] = useState('');
    const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE);
    const [labelLimit, setLabelLimit] = useState(DEFAULT_LABEL_LIMIT);
    const [tableOpen, setTableOpen] = useState(false);
    const [sortBy, setSortBy] = useState('combinedScore');
    const [sortDir, setSortDir] = useState('desc');
    const [highlight, setHighlight] = useState({ rowKey: '', key: 0 });
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(25);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');
    const [legendCollapsed, setLegendCollapsed] = useState(false);

    const candidateIds = useMemo(() => (
        [...new Set([...(Array.isArray(lookupIds) ? lookupIds : []), fileId, gwasId].filter(Boolean))]
    ), [fileId, gwasId, lookupIds]);

    useEffect(() => {
        if (!candidateIds.length) {
            setPayload({ rows: [], fileId: '', path: '' });
            return undefined;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        (async () => {
            let lastError = null;
            for (const candidate of candidateIds) {
                const path = getDataPath(candidate);
                try {
                    const text = await getDataFileText(path);
                    const rows = parseTsv(text);
                    if (!cancelled) {
                        setPayload({ rows, fileId: candidate, path });
                        setHighlight({ rowKey: '', key: 0 });
                        setTablePage(0);
                    }
                    return;
                } catch (err) {
                    lastError = err;
                }
            }
            if (!cancelled) {
                setPayload({ rows: [], fileId: candidateIds[0], path: getDataPath(candidateIds[0]) });
                setError(lastError || new Error('Gene-level scatter TSV not found'));
            }
        })().finally(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [candidateIds]);

    const rows = payload.rows;

    const filteredRows = useMemo(() => {
        const query = geneQuery.trim().toLowerCase();
        return rows.filter((row) => {
            if (viewMode === VIEW_MODES.SUPPORTED && row.evidenceClass !== 'regulation_supported') return false;
            if (viewMode === VIEW_MODES.DISCORDANT && row.evidenceClass !== 'direction_discordant') return false;
            if (viewMode === VIEW_MODES.LABELED && !row.label) return false;
            if (directionMode === DIRECTION_MODES.CONCORDANT && !row.isConcordant) return false;
            if (directionMode === DIRECTION_MODES.DISCORDANT && !row.isDiscordant) return false;
            if (query && !`${row.gene} ${row.ensg}`.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [directionMode, geneQuery, rows, viewMode]);

    const counts = useMemo(() => {
        const base = {
            total: rows.length,
            filtered: filteredRows.length,
            background: 0,
            supported: 0,
            discordant: 0,
            posteriorHigh: 0,
            labeled: 0,
        };
        rows.forEach((row) => {
            if (row.evidenceClass === 'background') base.background += 1;
            if (row.evidenceClass === 'regulation_supported') base.supported += 1;
            if (row.evidenceClass === 'direction_discordant') base.discordant += 1;
            if (row.evidenceClass === 'posterior_high') base.posteriorHigh += 1;
            if (row.label) base.labeled += 1;
        });
        return base;
    }, [filteredRows.length, rows]);

    const thresholdY = useMemo(() => {
        const sigP = rows
            .filter((row) => row.isRegSig && Number.isFinite(row.p) && row.p > 0)
            .map((row) => row.p);
        if (!sigP.length) return null;
        return -Math.log10(Math.max(...sigP));
    }, [rows]);

    const labelRows = useMemo(() => {
        const explicit = filteredRows.filter((row) => row.label);
        if (viewMode === VIEW_MODES.LABELED) return explicit.slice(0, labelLimit);
        if (explicit.length >= labelLimit) return explicit.slice(0, labelLimit);
        const used = new Set(explicit.map((row) => row.rowKey));
        const top = [...filteredRows]
            .filter((row) => !used.has(row.rowKey))
            .sort((a, b) => (b.combinedScore || -Infinity) - (a.combinedScore || -Infinity))
            .slice(0, Math.max(0, labelLimit - explicit.length));
        return [...explicit, ...top];
    }, [filteredRows, labelLimit, viewMode]);

    const axisStyle = useMemo(() => ({
        zeroline: false,
        showgrid: true,
        gridwidth: 0.5,
        gridcolor: chartTokens.gridColor,
        showline: true,
        linewidth: 1,
        linecolor: chartTokens.axisSoft,
        ticks: 'inside',
        tickfont: { size: 13, color: chartTokens.axisColor, family: theme.typography.fontFamily },
    }), [chartTokens, theme.typography.fontFamily]);

    const plotData = useMemo(() => {
        const grouped = Object.fromEntries([
            ...EVIDENCE_ORDER.map((key) => [key, {
                x: [],
                y: [],
                text: [],
                customdata: [],
                sizes: [],
                opacity: [],
                colors: [],
            }]),
            ['background_pos_same', { x: [], y: [], text: [], customdata: [], sizes: [], opacity: [], colors: [] }],
            ['background_neg_same', { x: [], y: [], text: [], customdata: [], sizes: [], opacity: [], colors: [] }],
            ['background_pos_cross', { x: [], y: [], text: [], customdata: [], sizes: [], opacity: [], colors: [] }],
            ['background_neg_cross', { x: [], y: [], text: [], customdata: [], sizes: [], opacity: [], colors: [] }],
        ]);

        filteredRows.forEach((row) => {
            const groupKey = row.evidenceClass === 'background'
                ? getBackgroundGroupKey(row)
                : row.evidenceClass;
            const group = grouped[groupKey] || grouped.background;
            const markerStyle = MARKER_STYLE_BY_CLASS[row.evidenceClass] || MARKER_STYLE_BY_CLASS.background;
            const scoreScale = clamp(Math.sqrt(Math.max(row.combinedScore || 0, 0)) / 4, 0, 1.6);
            group.x.push(row.postMean);
            group.y.push(row.signedLogP);
            group.text.push(buildHoverText(row));
            group.customdata.push([row.rowKey]);
            group.sizes.push(pointSize + markerStyle.sizeBoost + scoreScale);
            group.opacity.push(markerStyle.opacity);
            group.colors.push(row.evidenceClass === 'background' ? getBackgroundPointColor(row) : EVIDENCE_CLASSES[row.evidenceClass].color);
        });

        const renderOrder = [
            'background_pos_same',
            'background_neg_same',
            'background_pos_cross',
            'background_neg_cross',
            'posterior_high',
            'direction_discordant',
            'regulation_supported',
        ];

        return renderOrder
            .filter((key) => grouped[key]?.x.length > 0)
            .map((key) => {
                const isBackground = key.startsWith('background');
                const classKey = isBackground ? 'background' : key;
                const markerStyle = MARKER_STYLE_BY_CLASS[classKey] || MARKER_STYLE_BY_CLASS.background;

                return {
                    type: 'scattergl',
                    mode: 'markers',
                    name: isBackground ? EVIDENCE_CLASSES.background.label : EVIDENCE_CLASSES[key].label,
                    x: grouped[key].x,
                    y: grouped[key].y,
                    text: grouped[key].text,
                    customdata: grouped[key].customdata,
                    hovertemplate: '%{text}<extra></extra>',
                    hoverlabel: buildPlotHoverTone(theme, isBackground ? getBackgroundHoverColor(key) : EVIDENCE_CLASSES[key].color, {
                        bgAlpha: isBackground ? 0.14 : 0.18,
                        borderAlpha: isBackground ? 0.26 : 0.4,
                    }),
                    marker: {
                        color: grouped[key].colors,
                        symbol: EVIDENCE_CLASSES[classKey].symbol,
                        size: grouped[key].sizes,
                        opacity: grouped[key].opacity,
                        line: {
                            color: markerStyle.lineColor,
                            width: markerStyle.lineWidth,
                        },
                    },
                    legendgroup: isBackground ? 'background' : key,
                    showlegend: !isBackground || key === 'background_pos_same',
                };
            });
    }, [filteredRows, pointSize, theme]);

    const labelTrace = useMemo(() => {
        if (!labelRows.length) return [];
        return [{
            type: 'scatter',
            mode: 'text',
            name: 'Labels',
            showlegend: false,
            x: labelRows.map((row) => row.postMean),
            y: labelRows.map((row) => row.signedLogP),
            text: labelRows.map((row) => row.label || row.gene),
            textposition: labelRows.map((row) => (row.signedLogP >= 0 ? 'top center' : 'bottom center')),
            textfont: {
                size: 11,
                color: labelRows.map((row) => EVIDENCE_CLASSES[row.evidenceClass].color),
                family: theme.typography.fontFamily,
            },
            hoverinfo: 'skip',
        }];
    }, [labelRows, theme.typography.fontFamily]);

    const highlightedPoint = useMemo(() => {
        if (!highlight.rowKey) return [];
        const row = rows.find((item) => item.rowKey === highlight.rowKey);
        if (!row) return [];
        return [{
            type: 'scatter',
            mode: 'markers',
            name: 'Selected gene',
            showlegend: false,
            x: [row.postMean],
            y: [row.signedLogP],
            hoverinfo: 'skip',
            marker: {
                size: pointSize + 12,
                color: 'rgba(255,255,255,0)',
                line: { color: '#111827', width: 2.4 },
                symbol: EVIDENCE_CLASSES[row.evidenceClass].symbol,
            },
        }];
    }, [highlight.rowKey, pointSize, rows]);

    const legendItems = useMemo(() => (
        EVIDENCE_ORDER
            .map((key) => {
                const count = key === 'background'
                    ? counts.background
                    : key === 'posterior_high'
                        ? counts.posteriorHigh
                        : key === 'regulation_supported'
                            ? counts.supported
                            : counts.discordant;
                return count > 0 ? {
                    key,
                    label: EVIDENCE_CLASSES[key].label,
                    color: EVIDENCE_CLASSES[key].color,
                    colors: key === 'background' ? ['rgba(196, 90, 50, 0.34)', 'rgba(63, 120, 168, 0.34)'] : undefined,
                    symbol: EVIDENCE_CLASSES[key].symbol,
                    note: key === 'background'
                        ? 'Muted background genes; tint follows quadrant direction.'
                        : key === 'posterior_high'
                            ? 'High GeneBayes posterior effect without matched regulation support.'
                            : key === 'regulation_supported'
                                ? 'Posterior and perturb-seq regulation agree.'
                                : 'Posterior and perturb-seq regulation disagree.',
                    count,
                } : null;
            })
            .filter(Boolean)
    ), [counts]);

    const layout = useMemo(() => {
        const xRange = computeAxisRange(filteredRows.map((row) => row.postMean), 0.08);
        const yRange = computeAxisRange(filteredRows.map((row) => row.signedLogP), 0.12);
        const shapes = [
            {
                type: 'line',
                x0: 0,
                x1: 0,
                y0: yRange[0],
                y1: yRange[1],
                line: { color: chartTokens.axisSoft, width: 1, dash: 'dash' },
            },
            {
                type: 'line',
                x0: xRange[0],
                x1: xRange[1],
                y0: 0,
                y1: 0,
                line: { color: chartTokens.axisSoft, width: 1, dash: 'dash' },
            },
        ];
        const annotations = [];

        if (Number.isFinite(thresholdY)) {
            shapes.push(
                {
                    type: 'line',
                    x0: xRange[0],
                    x1: xRange[1],
                    y0: thresholdY,
                    y1: thresholdY,
                    line: { color: chartTokens.threshold, width: 1.1, dash: 'dot' },
                },
                {
                    type: 'line',
                    x0: xRange[0],
                    x1: xRange[1],
                    y0: -thresholdY,
                    y1: -thresholdY,
                    line: { color: chartTokens.threshold, width: 1.1, dash: 'dot' },
                },
            );
            annotations.push({
                xref: 'paper',
                yref: 'y',
                x: 1,
                y: thresholdY,
                xanchor: 'right',
                yanchor: 'bottom',
                showarrow: false,
                text: '<b>FDR 0.05</b>',
                font: { size: 11, color: chartTokens.threshold, family: theme.typography.fontFamily },
            });
        }

        return {
            autosize: true,
            title: {
                text: `${traitLabel || payload.fileId || fileId} gene-level posterior vs perturb-seq regulation`,
                font: { size: 18, color: theme.palette.text.primary, family: theme.typography.fontFamily },
                x: 0.02,
                xanchor: 'left',
            },
            paper_bgcolor: chartTokens.paperBg,
            plot_bgcolor: chartTokens.plotBg,
            margin: { l: 76, r: 28, t: 92, b: 70 },
            hovermode: 'closest',
            dragmode: 'pan',
            showlegend: false,
            xaxis: {
                ...axisStyle,
                title: { text: 'GeneBayes posterior effect (post_mean)', font: { size: 14, color: theme.palette.text.primary } },
                range: xRange,
                fixedrange: false,
            },
            yaxis: {
                ...axisStyle,
                title: { text: 'Perturb-seq signed -log10(P), sign(beta_withShet)', font: { size: 14, color: theme.palette.text.primary } },
                range: yRange,
                fixedrange: false,
            },
            shapes,
            annotations,
        };
    }, [axisStyle, chartTokens, fileId, filteredRows, payload.fileId, theme, thresholdY, traitLabel]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        scrollZoom: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        modeBarButtonsToAdd: [{
            name: 'download',
            title: 'Download plot',
            icon: Plotly.Icons.disk,
            click: () => setExportOpen(true),
        }],
    }), []);

    const sortedRows = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        return [...filteredRows].sort((a, b) => {
            if (['gene', 'ensg', 'evidenceClassLabel', 'labelReason'].includes(sortBy)) {
                return collator.compare(String(a[sortBy] || ''), String(b[sortBy] || '')) * dir;
            }
            const av = a[sortBy] ?? -Infinity;
            const bv = b[sortBy] ?? -Infinity;
            if (av === bv) return 0;
            return av > bv ? dir : -dir;
        });
    }, [filteredRows, sortBy, sortDir]);

    const pagedRows = useMemo(() => {
        const start = tablePage * tableRowsPerPage;
        return sortedRows.slice(start, start + tableRowsPerPage);
    }, [sortedRows, tablePage, tableRowsPerPage]);

    useEffect(() => {
        const maxPage = Math.max(0, Math.ceil(sortedRows.length / tableRowsPerPage) - 1);
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [sortedRows.length, tablePage, tableRowsPerPage]);

    useEffect(() => {
        if (!highlight.rowKey || !tableOpen) return undefined;
        const rowIndex = sortedRows.findIndex((item) => item.rowKey === highlight.rowKey);
        if (rowIndex < 0) return undefined;
        const nextPage = Math.floor(rowIndex / tableRowsPerPage);
        if (nextPage !== tablePage) {
            setTablePage(nextPage);
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            scrollElementNearViewportCenter(tableSectionRef.current, { viewportOffset: 0.08 });
            const el = tableRowRefs.current[highlight.rowKey];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);
        return () => window.clearTimeout(timeoutId);
    }, [highlight, sortedRows, tableOpen, tablePage, tableRowsPerPage]);

    const handleSort = useCallback((column) => {
        if (column === sortBy) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(column);
        setSortDir(['gene', 'ensg', 'evidenceClassLabel', 'labelReason'].includes(column) ? 'asc' : 'desc');
    }, [sortBy]);

    const resetControls = useCallback(() => {
        setViewMode(VIEW_MODES.ALL);
        setDirectionMode(DIRECTION_MODES.ALL);
        setGeneQuery('');
        setPointSize(DEFAULT_POINT_SIZE);
        setLabelLimit(DEFAULT_LABEL_LIMIT);
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    }, []);

    const handleExport = useCallback(() => {
        const gd = plotRef.current;
        if (!gd) return;
        const width = normalizeExportSize(exportWidth, DEFAULT_EXPORT_WIDTH);
        const height = normalizeExportSize(exportHeight, DEFAULT_EXPORT_HEIGHT);
        Plotly.toImage(gd, { format: exportFmt, width, height }).then((dataUrl) => {
            downloadDataUrl(dataUrl, `${sanitizeFileNamePart(payload.fileId || fileId)}-gene-level-scatter.${exportFmt}`);
        });
    }, [exportFmt, exportHeight, exportWidth, fileId, payload.fileId]);

    const downloadCSV = useCallback(() => {
        const cols = ['gene', 'ensg', 'post_mean', 'signed_log10_p', 'beta_withShet', 'P_withShet', 'fdr', 'evidence_class', 'combined_score', 'label', 'label_reason'];
        const header = cols.join(',');
        const body = rows.map((row) => [
            row.gene,
            row.ensg,
            row.postMean ?? '',
            row.signedLogP ?? '',
            row.beta ?? '',
            row.p ?? '',
            row.fdr ?? '',
            row.evidenceClass,
            row.combinedScore ?? '',
            row.label,
            row.labelReason,
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `${sanitizeFileNamePart(payload.fileId || fileId)}-gene-level-scatter.csv`);
    }, [fileId, payload.fileId, rows]);

    const plotRevision = useMemo(() => JSON.stringify({
        rows: filteredRows.length,
        viewMode,
        directionMode,
        query: geneQuery,
        pointSize,
        labelLimit,
        highlight: highlight.key,
    }), [directionMode, filteredRows.length, geneQuery, highlight.key, labelLimit, pointSize, viewMode]);

    const hasVisiblePoints = plotData.some((trace) => Array.isArray(trace.x) && trace.x.length > 0);

    if (error && !isLoading && rows.length === 0) {
        return (
            <Alert severity="info" sx={{ m: 2 }}>
                Gene-level scatter TSV is not available for this trait yet.
            </Alert>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={toolbarSx(theme)}>
                <Box sx={{ minWidth: 270, mr: 0.5 }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.35 }}>
                        Gene-level scatter
                    </Typography>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                        Posterior effect vs regulation evidence
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        Each point is a gene. X is GeneBayes post_mean; Y is signed -log10(P_withShet), with sign from beta_withShet.
                    </Typography>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={viewMode}
                    onChange={(_, value) => { if (value) setViewMode(value); }}
                    sx={statusToggleSx(theme)}
                >
                    <ToggleButton value={VIEW_MODES.ALL}>All</ToggleButton>
                    <ToggleButton value={VIEW_MODES.SUPPORTED}>Supported</ToggleButton>
                    <ToggleButton value={VIEW_MODES.DISCORDANT}>Discordant</ToggleButton>
                    <ToggleButton value={VIEW_MODES.LABELED}>Labeled</ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={directionMode}
                    onChange={(_, value) => { if (value) setDirectionMode(value); }}
                    sx={statusToggleSx(theme)}
                >
                    <ToggleButton value={DIRECTION_MODES.ALL}>Any sign</ToggleButton>
                    <ToggleButton value={DIRECTION_MODES.CONCORDANT}>Concordant</ToggleButton>
                    <ToggleButton value={DIRECTION_MODES.DISCORDANT}>Opposite</ToggleButton>
                </ToggleButtonGroup>

                <TextField
                    size="small"
                    label="Gene"
                    value={geneQuery}
                    onChange={(event) => {
                        setGeneQuery(event.target.value);
                        setTablePage(0);
                    }}
                    sx={controlFieldSx(theme, { width: 180 })}
                />

                <Chip icon={<Biotech />} label={`${counts.filtered.toLocaleString()} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                <Chip icon={<Insights />} label={`${counts.supported.toLocaleString()} supported`} size="small" sx={summaryChipSx(theme, evidenceChipTone(theme, 'regulation_supported'))} />
                <Chip icon={<FilterAlt />} label={`${counts.discordant.toLocaleString()} discordant`} size="small" sx={summaryChipSx(theme, evidenceChipTone(theme, 'direction_discordant'))} />
                <Chip icon={<Science />} label={`${counts.posteriorHigh.toLocaleString()} high posterior`} size="small" sx={summaryChipSx(theme, evidenceChipTone(theme, 'posterior_high', 0.1, 0.24))} />
            </Box>

            <Box sx={toolbarSx(theme)}>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 260 }}>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'none' }}>
                        Point
                    </Typography>
                    <Slider
                        value={pointSize}
                        min={3}
                        max={14}
                        step={1}
                        onChange={(_, value) => setPointSize(Number(value))}
                        sx={{ width: 120, color: theme.palette.primary.main, '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.25 } }}
                    />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, minWidth: 20 }}>{pointSize}</Typography>
                </Stack>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 250 }}>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'none' }}>
                        Labels
                    </Typography>
                    <Slider
                        value={labelLimit}
                        min={0}
                        max={30}
                        step={1}
                        onChange={(_, value) => setLabelLimit(Number(value))}
                        sx={{ width: 120, color: theme.palette.text.secondary, '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.25 } }}
                    />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, minWidth: 24 }}>{labelLimit}</Typography>
                </Stack>
                <Button variant="text" startIcon={<RestartAlt />} onClick={resetControls} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38 }}>
                    Reset
                </Button>
                <Button variant="text" startIcon={<Download />} onClick={downloadCSV} disabled={!rows.length} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38 }}>
                    CSV
                </Button>
                <Typography sx={{ width: '100%', fontSize: '0.74rem', color: theme.palette.text.secondary, lineHeight: 1.4 }}>
                    Rose markers highlight posterior-high genes; warm and cool markers distinguish concordant and discordant regulation support, while pale points remain low-support background.
                </Typography>
            </Box>

            <Card elevation={0} sx={plotFrameSx(theme)}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {isLoading && (
                        <Box sx={{ minHeight: RESPONSIVE_TALL_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Loading gene-level scatter TSV...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!isLoading && rows.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No gene-level scatter rows are available for this trait.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && rows.length > 0 && !hasVisiblePoints && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No genes match the current scatter filters.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && hasVisiblePoints && (
                        <>
                            <Plot
                                data={[...plotData, ...labelTrace, ...highlightedPoint]}
                                layout={layout}
                                config={plotConfig}
                                revision={plotRevision}
                                onInitialized={(_figure, graphDiv) => {
                                    plotRef.current = graphDiv;
                                    plotElRef.current = graphDiv;
                                }}
                                onUpdate={(_figure, graphDiv) => {
                                    plotRef.current = graphDiv;
                                    plotElRef.current = graphDiv;
                                }}
                                onClick={(evt) => {
                                    const rowKey = evt?.points?.[0]?.customdata?.[0];
                                    if (!rowKey) return;
                                    setHighlight((prev) => ({ rowKey, key: prev.key + 1 }));
                                    setTableOpen(true);
                                }}
                                useResizeHandler
                                style={{ width: '100%', height: RESPONSIVE_TALL_PLOT_HEIGHT }}
                            />
                            <FloatingLegend
                                items={legendItems}
                                collapsed={legendCollapsed}
                                onToggleCollapsed={() => setLegendCollapsed((prev) => !prev)}
                                title="Categories"
                                width={{ expanded: 206, collapsed: 118 }}
                                defaultPlacement="right"
                                defaultTop={68}
                                defaultSideOffset={10}
                                anchorPlotRef={plotElRef}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <GeneLevelScatterTable
                tableSectionRef={tableSectionRef}
                rows={rows}
                sortedRows={sortedRows}
                pagedRows={pagedRows}
                tableOpen={tableOpen}
                setTableOpen={setTableOpen}
                tablePage={tablePage}
                setTablePage={setTablePage}
                tableRowsPerPage={tableRowsPerPage}
                setTableRowsPerPage={setTableRowsPerPage}
                sortBy={sortBy}
                sortDir={sortDir}
                handleSort={handleSort}
                downloadCSV={downloadCSV}
                highlight={highlight}
                tableRowRefs={tableRowRefs}
            />

            <Dialog open={exportOpen} onClose={() => setExportOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700, color: theme.palette.text.primary }}>Export Plot</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        <TextField label="Width" type="number" size="small" value={exportWidth} onChange={(event) => setExportWidth(event.target.value)} sx={controlFieldSx(theme)} />
                        <TextField label="Height" type="number" size="small" value={exportHeight} onChange={(event) => setExportHeight(event.target.value)} sx={controlFieldSx(theme)} />
                    </Stack>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={exportFmt}
                        onChange={(_, value) => { if (value) setExportFmt(value); }}
                        sx={statusToggleSx(theme, { '& .MuiToggleButton-root': { textTransform: 'none', px: 2.5 } })}
                    >
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setExportOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
                    <Button variant="contained" onClick={() => { handleExport(); setExportOpen(false); }} sx={{ textTransform: 'none' }}>Export</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
