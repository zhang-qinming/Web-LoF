import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plot, { Plotly } from '../lib/plotly';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import Biotech from '@mui/icons-material/Biotech';
import Download from '@mui/icons-material/Download';
import FilterAlt from '@mui/icons-material/FilterAlt';
import Insights from '@mui/icons-material/Insights';
import Refresh from '@mui/icons-material/Refresh';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Science from '@mui/icons-material/Science';
import useSWR from 'swr';
import { getDataFileText } from '../api/gwas';
import { UpdatingStatus } from './PageScaffold';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { formatScientificNumber, parseNullableNumber } from '../utils/numbers';
import { scrollElementIntoNearestView, scrollElementNearViewportCenter } from '../utils/scroll';
import { figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useDebouncedControlValue, useIdleRenderGate } from '../utils/renderScheduling';
import { compareValues } from '../utils/sort';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    metricChipTone,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_TALL_PLOT_HEIGHT,
    statusToggleSx,
    summaryChipSx,
} from '../themeUtils';
import ExportPlotDialog from './ExportPlotDialog';
import FigureLoadingPanel from './FigureLoadingPanel';
import FloatingLegend from './FloatingLegend';
import GeneLevelScatterTable from './GeneLevelScatterTable';

const DATA_DIR = 'gene_level_scatter/tables';
const DEFAULT_EXPORT_WIDTH = 1280;
const DEFAULT_EXPORT_HEIGHT = 820;
const DEFAULT_POINT_SIZE = 7;
const DEFAULT_LABEL_LIMIT = 10;
const GENE_EVIDENCE_PLOT_HEIGHT = RESPONSIVE_TALL_PLOT_HEIGHT;

const EVIDENCE_CLASSES = {
    background: {
        label: 'Neutral / low support',
        color: '#b0b9c4',
        symbol: 'circle',
        rank: 0,
    },
    posterior_high: {
        label: 'Posterior-high signal',
        color: '#9b6fb0',
        symbol: 'circle',
        rank: 1,
    },
    regulation_supported: {
        label: 'Concordant signal',
        color: '#d4523e',
        symbol: 'circle',
        rank: 3,
    },
    direction_discordant: {
        label: 'Discordant signal',
        color: '#3b7fc4',
        symbol: 'diamond',
        rank: 2,
    },
};

const EVIDENCE_ORDER = ['background', 'posterior_high', 'regulation_supported', 'direction_discordant'];

const MARKER_STYLE_BY_CLASS = {
    background: {
        opacity: 0.2,
        sizeBoost: 0,
        lineColor: 'rgba(255,255,255,0)',
        lineWidth: 0,
    },
    posterior_high: {
        opacity: 0.88,
        sizeBoost: 1.25,
        lineColor: 'rgba(100, 55, 120, 0.3)',
        lineWidth: 0.4,
    },
    regulation_supported: {
        opacity: 0.94,
        sizeBoost: 2.2,
        lineColor: 'rgba(170, 48, 28, 0.34)',
        lineWidth: 0.55,
    },
    direction_discordant: {
        opacity: 0.94,
        sizeBoost: 2.1,
        lineColor: 'rgba(32, 82, 140, 0.32)',
        lineWidth: 0.55,
    },
};

const DIRECTION_MODES = {
    ALL: 'all',
    CONCORDANT: 'concordant',
    DISCORDANT: 'discordant',
};

function toFiniteNumber(value) {
    return parseNullableNumber(value);
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
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatPValue(value) {
    return formatScientificNumber(value, 2, '-');
}

function buildHoverText(row) {
    const lines = [
        `<b>${row.gene || row.ensg}</b>`,
        row.ensg ? `<span style="color:#64748b">${row.ensg}</span>` : '',
        `<span style="color:${EVIDENCE_CLASSES[row.evidenceClass].color};font-weight:600">${row.evidenceClassLabel}</span>`,
    ];
    if (Number.isFinite(row.postMean)) {
        lines.push('', '<b>GeneBayes</b>', `LoF effect (post_mean): ${formatNumber(row.postMean, 4)}${row.postMeanSign ? ` (${row.postMeanSign})` : ''}`);
    }
    if ([row.signedLogP, row.beta, row.p, row.fdr].some(Number.isFinite)) {
        lines.push('', '<b>Perturb-seq regulation</b>');
        if (Number.isFinite(row.signedLogP)) lines.push(`signed -log10(p-value): ${formatNumber(row.signedLogP, 2)}`);
        if (Number.isFinite(row.beta)) lines.push(`beta_withShet: ${formatNumber(row.beta, 4)}${row.regulationSign ? ` (${row.regulationSign})` : ''}`);
        if (Number.isFinite(row.p)) lines.push(`p-value: ${formatPValue(row.p)}`);
        if (Number.isFinite(row.fdr)) lines.push(`FDR: ${formatPValue(row.fdr)}`);
    }
    if (Number.isFinite(row.combinedScore)) lines.push('', `Combined score: ${formatNumber(row.combinedScore, 2)}`);
    return lines.filter(Boolean).join('<br>');
}

function getBackgroundPointColor(row) {
    const x = Number.isFinite(row.postMean) ? row.postMean : 0;
    const y = Number.isFinite(row.signedLogP) ? row.signedLogP : 0;
    const sameDirection = (x >= 0 && y >= 0) || (x <= 0 && y <= 0);

    if (sameDirection) {
        return x >= 0 ? 'rgba(212, 82, 62, 0.24)' : 'rgba(59, 127, 196, 0.24)';
    }

    return x >= 0 ? 'rgba(212, 82, 62, 0.12)' : 'rgba(59, 127, 196, 0.12)';
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

function isMissingDataError(error) {
    return Number(error?.response?.status) === 404;
}

function getRequestErrorMessage(error, fallback) {
    return error?.response?.data?.error || error?.message || fallback;
}

async function loadGeneLevelScatterPayload(candidateIds) {
    let missingError = null;
    let requestError = null;

    for (const candidate of candidateIds) {
        const path = getDataPath(candidate);
        try {
            const text = await getDataFileText(path);
            return { rows: parseTsv(text), fileId: candidate, path };
        } catch (err) {
            if (isMissingDataError(err)) missingError = err;
            else if (!requestError) requestError = err;
        }
    }

    throw requestError || missingError || new Error('Gene-level scatter TSV not found');
}

export default function GeneLevelScatter({ fileId, gwasId, traitLabel, lookupIds = [] }) {
    const theme = useTheme();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const plotRef = useRef(null);
    const plotElRef = useRef(null);
    const tableRowRefs = useRef({});
    const tableSectionRef = useRef(null);

    const [directionMode, setDirectionMode] = useState(DIRECTION_MODES.ALL);
    const [geneQuery, setGeneQuery] = useState('');
    const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE);
    const [labelLimit, setLabelLimit] = useState(DEFAULT_LABEL_LIMIT);
    const [tableOpen, setTableOpen] = useState(true);
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

    const scatterKey = candidateIds.length ? ['gene-level-scatter', ...candidateIds] : null;
    const scatterResource = useCachedResourceState(
        useSWR(scatterKey, ([, ...ids]) => loadGeneLevelScatterPayload(ids), figureResourceSWRConfig),
        { cacheKey: scatterKey, retainPreviousData: false },
    );
    const {
        displayData: cachedPayload,
        error,
        isInitialLoading: isLoading,
        isRefreshing,
        mutate: retryScatter,
    } = scatterResource;
    const payload = cachedPayload || { rows: [], fileId: candidateIds[0] || '', path: candidateIds[0] ? getDataPath(candidateIds[0]) : '' };
    const afterFirstPaint = useAfterFirstPaint(scatterKey || 'gene-level-scatter-empty');
    const [pointSizeDraft, setPointSizeDraft, commitPointSize] = useDebouncedControlValue(
        pointSize,
        (value) => setPointSize(clamp(Number(value) || DEFAULT_POINT_SIZE, 3, 14)),
        { delay: 250 },
    );
    const [labelLimitDraft, setLabelLimitDraft, commitLabelLimit] = useDebouncedControlValue(
        labelLimit,
        (value) => setLabelLimit(clamp(Number(value) || 0, 0, 30)),
        { delay: 250 },
    );

    useEffect(() => {
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    }, [payload.fileId]);

    const rows = payload.rows;

    const filteredRows = useMemo(() => {
        const query = geneQuery.trim().toLowerCase();
        return rows.filter((row) => {
            if (directionMode === DIRECTION_MODES.CONCORDANT && !row.isConcordant) return false;
            if (directionMode === DIRECTION_MODES.DISCORDANT && !row.isDiscordant) return false;
            if (query && !`${row.gene} ${row.ensg}`.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [directionMode, geneQuery, rows]);

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
        if (explicit.length >= labelLimit) return explicit.slice(0, labelLimit);
        const used = new Set(explicit.map((row) => row.rowKey));
        const top = [...filteredRows]
            .filter((row) => !used.has(row.rowKey))
            .sort((a, b) => (b.combinedScore || -Infinity) - (a.combinedScore || -Infinity))
            .slice(0, Math.max(0, labelLimit - explicit.length));
        return [...explicit, ...top];
    }, [filteredRows, labelLimit]);

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
                    colors: key === 'background' ? ['rgba(212, 82, 62, 0.24)', 'rgba(59, 127, 196, 0.24)'] : undefined,
                    symbol: EVIDENCE_CLASSES[key].symbol,
                    note: key === 'background'
                        ? 'Muted background genes; tint follows quadrant direction.'
                        : key === 'posterior_high'
                            ? 'High GeneBayes LoF effect without matched regulation support.'
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
                title: { text: 'GeneBayes LoF effect (post_mean)', font: { size: 14, color: theme.palette.text.primary } },
                range: xRange,
                fixedrange: false,
            },
            yaxis: {
                ...axisStyle,
                title: { text: 'Perturb-seq signed -log10(p-value), sign(beta_withShet)', font: { size: 14, color: theme.palette.text.primary } },
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
        return [...filteredRows].sort((a, b) => {
            if (['gene', 'ensg', 'evidenceClassLabel', 'labelReason'].includes(sortBy)) {
                return compareValues(a[sortBy], b[sortBy], 'text', sortDir);
            }
            return compareValues(a[sortBy], b[sortBy], 'number', sortDir);
        });
    }, [filteredRows, sortBy, sortDir]);

    const pagedRows = useMemo(() => {
        const start = tablePage * tableRowsPerPage;
        return sortedRows.slice(start, start + tableRowsPerPage);
    }, [sortedRows, tablePage, tableRowsPerPage]);
    const shouldRenderTable = useIdleRenderGate(
        !isLoading && afterFirstPaint,
        `${scatterKey || 'gene-level-scatter-empty'}:${rows.length}:${sortedRows.length}`,
        { delay: sortedRows.length > 1000 ? 450 : 180, timeout: 1600 },
    );

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
            if (el) scrollElementIntoNearestView(el);
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
        directionMode,
        query: geneQuery,
        pointSize,
        labelLimit,
        highlight: highlight.key,
    }), [directionMode, filteredRows.length, geneQuery, highlight.key, labelLimit, pointSize]);

    const hasVisiblePoints = plotData.some((trace) => Array.isArray(trace.x) && trace.x.length > 0);

    if (error && !isLoading && rows.length === 0) {
        const missing = isMissingDataError(error);
        return (
            <Alert
                severity={missing ? 'info' : 'error'}
                sx={{ m: 2 }}
                action={(
                    <Button
                        color="inherit"
                        size="small"
                        startIcon={<Refresh />}
                        onClick={() => { void retryScatter(); }}
                    >
                        Retry
                    </Button>
                )}
            >
                {missing
                    ? 'Gene-level scatter TSV is not available for this trait yet.'
                    : getRequestErrorMessage(error, 'Failed to load gene-level scatter data.')}
            </Alert>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* CARD 1: Filters & Options */}
            <Card variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'divider', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: theme.custom?.surface?.subtle || 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontWeight: 680, fontSize: '0.9rem', color: 'text.primary', letterSpacing: '0.02em' }}>
                        Gene-level Scatter Controls
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button 
                            variant="text" 
                            size="small"
                            startIcon={<RestartAlt />} 
                            onClick={resetControls} 
                            sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, fontSize: '0.78rem' }}
                        >
                            Reset
                        </Button>
                        <Button 
                            variant="text" 
                            size="small"
                            startIcon={<Download />} 
                            onClick={downloadCSV} 
                            disabled={!rows.length} 
                            sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, fontSize: '0.78rem' }}
                        >
                            CSV
                        </Button>
                    </Stack>
                </Box>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3.5, alignItems: 'center' }}>
                        {/* Locus direction mode */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary', fontSize: '0.76rem', textTransform: 'none', letterSpacing: 0 }}>
                                Effect Direction:
                            </Typography>
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
                        </Stack>

                        {/* Point size slider */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary', fontSize: '0.76rem', textTransform: 'none', letterSpacing: 0 }}>
                                Point Size:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                                <Slider
                                    value={Number(pointSizeDraft) || DEFAULT_POINT_SIZE}
                                    min={3}
                                    max={14}
                                    step={1}
                                    onChange={(_, value) => setPointSizeDraft(Number(value))}
                                    onChangeCommitted={(_, value) => commitPointSize(Number(value))}
                                    sx={{
                                        width: 100,
                                        color: theme.palette.text.secondary,
                                        '& .MuiSlider-thumb': { width: 14, height: 14 },
                                        '& .MuiSlider-rail': { opacity: 0.25 },
                                    }}
                                />
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem', minWidth: 20 }}>
                                    {Number(pointSizeDraft) || DEFAULT_POINT_SIZE}
                                </Typography>
                            </Box>
                        </Stack>

                        {/* Labels slider */}
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary', fontSize: '0.76rem', textTransform: 'none', letterSpacing: 0 }}>
                                Labels Limit:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                                <Slider
                                    value={Number(labelLimitDraft) || 0}
                                    min={0}
                                    max={30}
                                    step={1}
                                    onChange={(_, value) => setLabelLimitDraft(Number(value))}
                                    onChangeCommitted={(_, value) => commitLabelLimit(Number(value))}
                                    sx={{
                                        width: 100,
                                        color: theme.palette.text.secondary,
                                        '& .MuiSlider-thumb': { width: 14, height: 14 },
                                        '& .MuiSlider-rail': { opacity: 0.25 },
                                    }}
                                />
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem', minWidth: 20 }}>
                                    {Number(labelLimitDraft) || 0}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                </CardContent>
            </Card>

            {/* CARD 2: Interactive Plot */}
            <Card variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'divider', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <Box sx={{ px: 2.5, py: 1.2, bgcolor: theme.custom?.surface?.subtle || 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" alignItems="center">
                        <Typography sx={{ fontWeight: 680, fontSize: '0.9rem', color: 'text.primary', letterSpacing: '0.02em' }}>
                            Gene-level Scatter Plot
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mr: 0.5, fontSize: '0.74rem' }}>
                                Summary Stats:
                            </Typography>
                            <Chip icon={<Biotech sx={{ fontSize: '14px !important' }} />} label={`${counts.filtered.toLocaleString()} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                            <Chip icon={<Insights sx={{ fontSize: '14px !important' }} />} label={`${counts.supported.toLocaleString()} supported`} size="small" sx={summaryChipSx(theme, evidenceChipTone(theme, 'regulation_supported'))} />
                            <Chip icon={<FilterAlt sx={{ fontSize: '14px !important' }} />} label={`${counts.discordant.toLocaleString()} discordant`} size="small" sx={summaryChipSx(theme, evidenceChipTone(theme, 'direction_discordant'))} />
                            <Chip icon={<Science sx={{ fontSize: '14px !important' }} />} label={`${counts.posteriorHigh.toLocaleString()} high posterior`} size="small" sx={summaryChipSx(theme, evidenceChipTone(theme, 'posterior_high', 0.1, 0.24))} />
                        </Stack>
                    </Stack>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <UpdatingStatus active={isRefreshing} />
                        {!isLoading && hasVisiblePoints && (
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Download />}
                                onClick={() => setExportOpen(true)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
                            >
                                Export image
                            </Button>
                        )}
                    </Box>
                </Box>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {isLoading && (
                        <FigureLoadingPanel
                            minHeight={GENE_EVIDENCE_PLOT_HEIGHT}
                            message="Loading gene-level scatter TSV..."
                        />
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

                    {!isLoading && hasVisiblePoints && !afterFirstPaint && (
                        <FigureLoadingPanel
                            minHeight={GENE_EVIDENCE_PLOT_HEIGHT}
                            message="Rendering gene evidence plot..."
                        />
                    )}

                    {!isLoading && hasVisiblePoints && afterFirstPaint && (
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
                                style={{ width: '100%', height: GENE_EVIDENCE_PLOT_HEIGHT }}
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

            {shouldRenderTable && (
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
                    geneQuery={geneQuery}
                    setGeneQuery={setGeneQuery}
                />
            )}

            <ExportPlotDialog
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                width={exportWidth}
                onWidthChange={setExportWidth}
                height={exportHeight}
                onHeightChange={setExportHeight}
                format={exportFmt}
                onFormatChange={setExportFmt}
                onExport={handleExport}
            />
        </Box>
    );
}
