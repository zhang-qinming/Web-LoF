import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Insights,
    Refresh,
    RestartAlt,
    Science,
    Timeline,
} from '@mui/icons-material';
import { getBurdenVolcano, getPosteriorVolcano } from '../api/gwas';
import BurdenVolcanoTable from './BurdenVolcanoTable';
import FloatingLegend from './FloatingLegend';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementNearViewportCenter } from '../utils/scroll';
import {
    buildPlotHoverTone,
    buildPlotHoverToneNeutral,
    chartLayoutTokens,
    controlFieldSx,
    metricChipTone,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_PLOT_HEIGHT,
    sectionTitleSx,
    statusToggleSx,
    summaryChipSx,
    toolbarSx,
} from '../themeUtils';

const VOLCANO_STYLE = {
    background: { color: '#94a3b8', opacity: 0.24, label: 'Background genes', lineColor: 'rgba(255,255,255,0.22)' },
    positive: { color: '#f3a17a', strong: '#c95b3e', opacity: 0.64, strongOpacity: 0.95, label: 'Positive effect', lineColor: 'rgba(106,43,24,0.2)' },
    negative: { color: '#79c4cb', strong: '#2e7e8f', opacity: 0.64, strongOpacity: 0.95, label: 'Negative effect', lineColor: 'rgba(20,68,79,0.2)' },
};

const EFFECT_MODES = {
    ALL: 'all',
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
};

const SIGNIFICANCE_LOGP = -Math.log10(0.05);
const DEFAULT_EXPORT_WIDTH = 1280;
const DEFAULT_EXPORT_HEIGHT = 800;
const DEFAULT_POINT_SIZE = 8;
const MIN_DEFAULT_HIT_ROWS = 20;

const VOLCANO_CONFIGS = {
    burden: {
        api: getBurdenVolcano,
        effectField: 'beta',
        effectLabel: 'Beta',
        effectAxisLabel: 'Effect size (beta)',
        title: 'Burden Volcano',
        fullTitle: 'All Gene Burden Effects',
        hitsTitle: 'Gene Burden Hit Overview',
        fullDescription: 'Full gene-level LoF burden effects for this trait. Click a point to focus its table row.',
        hitsDescription: 'Significant LoF burden hits for this trait. Switch to Full TSV for all genes when available.',
        emptyMessage: 'No burden volcano rows are currently available for this trait.',
        guideText: 'Y-axis uses -log10(P). Horizontal guide marks nominal significance. Positive beta shifts right; negative beta shifts left.',
        exportPrefix: 'burden_volcano',
        plotSuffix: 'burden-volcano',
        includePosteriorColumns: false,
    },
    posterior: {
        api: getPosteriorVolcano,
        effectField: 'post_mean',
        effectLabel: 'Post mean',
        effectAxisLabel: 'Posterior mean',
        title: 'Posterior Volcano',
        fullTitle: 'All Gene Posterior Effects',
        hitsTitle: 'Gene Posterior Hit Overview',
        fullDescription: 'Full gene-level posterior effects for this trait. Click a point to focus its table row.',
        hitsDescription: 'Significant posterior hits for this trait. Switch to Full TSV for all genes when available.',
        emptyMessage: 'No posterior volcano rows are currently available for this trait.',
        guideText: 'Y-axis uses -log10(P). Horizontal guide marks nominal significance. Positive posterior mean shifts right; negative posterior mean shifts left.',
        exportPrefix: 'posterior_volcano',
        plotSuffix: 'posterior-volcano',
        includePosteriorColumns: true,
    },
};

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

function computeVolcanoXAxisRange(values, paddingRatio = 0.1) {
    const finiteValues = values.filter(Number.isFinite);
    if (!finiteValues.length) return [-1, 1];

    const min = Math.min(Math.min(...finiteValues), 0);
    const max = Math.max(Math.max(...finiteValues), 0);

    if (min === max) {
        const delta = Math.max(Math.abs(min) * paddingRatio, 0.5);
        return [min - delta, max + delta];
    }

    const span = max - min;
    const padding = Math.max(span * paddingRatio, 0.12);
    return [min - padding, max + padding];
}

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function getProgramRoute(program) {
    const firstProgram = String(program || '').split(';').map((item) => item.trim()).find(Boolean);
    const match = firstProgram?.match(/\d+/);
    return match ? `/programs/${match[0]}` : null;
}

export default function BurdenVolcano({ fileId, gwasId, traitLabel, volcanoType = 'burden' }) {
    const theme = useTheme();
    const chartTokens = chartLayoutTokens(theme);
    const volcanoConfig = VOLCANO_CONFIGS[volcanoType] || VOLCANO_CONFIGS.burden;
    const {
        api: fetchVolcano,
        effectField,
        effectLabel,
        effectAxisLabel,
        title,
        fullTitle,
        hitsTitle,
        fullDescription,
        hitsDescription,
        emptyMessage,
        guideText,
        exportPrefix,
        plotSuffix,
        includePosteriorColumns,
    } = volcanoConfig;
    const navigate = useNavigate();
    const plotRef = useRef(null);
    const tableRowRefs = useRef({});
    const tableSectionRef = useRef(null);
    const hasAutoSelectedDefaultVariant = useRef(false);

    const [payload, setPayload] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [variant, setVariant] = useState('hits');
    const [effectMode, setEffectMode] = useState(EFFECT_MODES.ALL);
    const [significantOnly, setSignificantOnly] = useState(false);
    const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE);
    const [tableOpen, setTableOpen] = useState(true);
    const [sortBy, setSortBy] = useState('logp');
    const [sortDir, setSortDir] = useState('desc');
    const [highlight, setHighlight] = useState({ rowKey: '', key: 0 });
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(25);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');
    const [legendCollapsed, setLegendCollapsed] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const onInitialized = useCallback((_figure, graphDiv) => {
        plotRef.current = graphDiv;
    }, []);

    const onUpdate = useCallback((_figure, graphDiv) => {
        plotRef.current = graphDiv;
    }, []);

    useEffect(() => {
        if (!gwasId && !fileId) {
            setPayload(null);
            return undefined;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);
        fetchVolcano(fileId || gwasId, { variant, aliasId: gwasId })
            .then((res) => {
                if (!cancelled) setPayload(res);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err);
                    setPayload(null);
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [fetchVolcano, fileId, gwasId, retryKey, variant]);

    const rows = useMemo(() => {
        if (!Array.isArray(payload?.data)) return [];
        return payload.data.map((item, index) => {
            const effect = toFiniteNumber(item[effectField]);
            const p = toFiniteNumber(item.p);
            const logp = toFiniteNumber(item.logp);
            const fdr = toFiniteNumber(item.fdr);
            const posteriorSd = toFiniteNumber(item.posterior_sd);
            const lower95 = toFiniteNumber(item.lower_95);
            const upper95 = toFiniteNumber(item.upper_95);
            const gene = String(item.gene || '').trim();
            const ensg = String(item.ensg || '').trim();
            const primaryProgram = String(item.program || '').trim();
            const primaryGeneset = String(item.geneset || '').trim();
            const rowKey = `${ensg || gene || 'gene'}-${index}`;
            return {
                rowKey,
                beta: effect,
                effect,
                p,
                logp,
                fdr,
                posteriorSd,
                lower95,
                upper95,
                gene,
                ensg,
                primaryProgram,
                primaryGeneset,
                effectClass: effect == null ? 'neutral' : (effect >= 0 ? 'positive' : 'negative'),
                isSignificant: logp != null && logp >= SIGNIFICANCE_LOGP,
            };
        }).filter((item) => item.effect != null && item.logp != null);
    }, [effectField, payload]);

    const availableVariants = payload?.availableVariants || { hits: false, full: false };
    const resolvedVariant = payload?.resolvedVariant || variant;
    const variantLabel = resolvedVariant === 'full' ? 'full' : 'hits';
    const variantControlValue = resolvedVariant === 'full' && variant === 'hits' ? 'full' : variant;
    const shouldAutoSwitchToFull = (
        !isLoading
        && variant === 'hits'
        && Boolean(availableVariants.full)
        && !hasAutoSelectedDefaultVariant.current
        && rows.length < MIN_DEFAULT_HIT_ROWS
    );

    useEffect(() => {
        if (!shouldAutoSwitchToFull) return;

        hasAutoSelectedDefaultVariant.current = true;
        setVariant('full');
        setEffectMode(EFFECT_MODES.ALL);
        setSignificantOnly(false);
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    }, [shouldAutoSwitchToFull]);

    useEffect(() => {
        hasAutoSelectedDefaultVariant.current = false;
    }, [fileId, gwasId, volcanoType]);

    const filteredRows = useMemo(() => rows.filter((row) => {
        if (effectMode === EFFECT_MODES.POSITIVE && row.effect < 0) return false;
        if (effectMode === EFFECT_MODES.NEGATIVE && row.effect > 0) return false;
        if (significantOnly && !row.isSignificant) return false;
        return true;
    }), [effectMode, rows, significantOnly]);

    const counts = useMemo(() => {
        const stats = {
            positive: 0,
            negative: 0,
            neutral: 0,
            significant: 0,
        };
        filteredRows.forEach((row) => {
            stats[row.effectClass] += 1;
            if (row.isSignificant) stats.significant += 1;
        });
        return stats;
    }, [filteredRows]);
    const legendItems = useMemo(() => {
        const items = [];
        if (counts.positive > 0) {
            items.push({
                key: 'positive',
                label: VOLCANO_STYLE.positive.label,
                note: 'Right of zero; darker ember marks stronger signal.',
                color: VOLCANO_STYLE.positive.strong,
                count: counts.positive,
            });
        }
        if (counts.negative > 0) {
            items.push({
                key: 'negative',
                label: VOLCANO_STYLE.negative.label,
                note: 'Left of zero; deeper teal marks stronger signal.',
                color: VOLCANO_STYLE.negative.strong,
                count: counts.negative,
            });
        }
        return items;
    }, [counts]);

    const plotData = useMemo(() => {
        const grouped = {
            background: { x: [], y: [], text: [], customdata: [], colors: [], sizes: [], opacities: [] },
            negative_soft: { x: [], y: [], text: [], customdata: [], colors: [], sizes: [], opacities: [] },
            negative_strong: { x: [], y: [], text: [], customdata: [], colors: [], sizes: [], opacities: [] },
            positive_soft: { x: [], y: [], text: [], customdata: [], colors: [], sizes: [], opacities: [] },
            positive_strong: { x: [], y: [], text: [], customdata: [], colors: [], sizes: [], opacities: [] },
        };
        let maxLogp = 1;
        let maxEffect = 0.1;

        filteredRows.forEach((row) => {
            if (Number.isFinite(row.logp)) maxLogp = Math.max(maxLogp, row.logp);
            if (Number.isFinite(row.effect)) maxEffect = Math.max(maxEffect, Math.abs(row.effect));
        });

        const logpSpan = Math.max(maxLogp - SIGNIFICANCE_LOGP, 0.75);

        filteredRows.forEach((row) => {
            const directionKey = row.effectClass === 'negative' ? 'negative' : 'positive';
            const effectIntensity = clamp(Math.abs(row.effect || 0) / maxEffect, 0, 1);
            const significanceIntensity = clamp(((row.logp || 0) - SIGNIFICANCE_LOGP) / logpSpan, 0, 1);
            const emphasis = ((effectIntensity * 0.34) + (significanceIntensity * 0.66)) ** 0.92;

            if (row.isSignificant) {
                const bucketKey = `${directionKey}_${emphasis > 0.55 ? 'strong' : 'soft'}`;
                const bucket = grouped[bucketKey];
                bucket.x.push(row.effect);
                bucket.y.push(row.logp);
                bucket.text.push(row.gene || row.ensg || row.rowKey);
                bucket.customdata.push([
                    row.rowKey,
                    row.gene || 'NA',
                    row.ensg || 'NA',
                    row.effect,
                    row.p,
                    row.fdr,
                    row.primaryProgram || 'others',
                    row.primaryGeneset || 'others',
                    row.posteriorSd,
                    row.lower95,
                    row.upper95,
                ]);
                bucket.colors.push(emphasis > 0.55 ? VOLCANO_STYLE[directionKey].strong : VOLCANO_STYLE[directionKey].color);
                bucket.opacities.push(emphasis > 0.55 ? VOLCANO_STYLE[directionKey].strongOpacity : VOLCANO_STYLE[directionKey].opacity);
                bucket.sizes.push((pointSize * 0.84) + (emphasis * 1.8));
                return;
            }

            const bucket = grouped.background;
            bucket.x.push(row.effect);
            bucket.y.push(row.logp);
            bucket.text.push(row.gene || row.ensg || row.rowKey);
            bucket.customdata.push([
                row.rowKey,
                row.gene || 'NA',
                row.ensg || 'NA',
                row.effect,
                row.p,
                row.fdr,
                row.primaryProgram || 'others',
                row.primaryGeneset || 'others',
                row.posteriorSd,
                row.lower95,
                row.upper95,
            ]);
            bucket.colors.push(VOLCANO_STYLE.background.color);
            bucket.opacities.push(VOLCANO_STYLE.background.opacity + (significanceIntensity * 0.08));
            bucket.sizes.push(Math.max(4.6, (pointSize * 0.62) + (effectIntensity * 0.9)));
        });

        const posteriorHover = includePosteriorColumns ? [
            'Posterior SD %{customdata[8]:.4f}',
            '95% CI [%{customdata[9]:.4f}, %{customdata[10]:.4f}]',
        ] : [];

        const makeTrace = (key, bucket, showLegend) => ({
            x: bucket.x,
            y: bucket.y,
            text: bucket.text,
            customdata: bucket.customdata,
            mode: 'markers',
            type: 'scattergl',
            name: key === 'background'
                ? VOLCANO_STYLE.background.label
                : key.startsWith('positive')
                    ? VOLCANO_STYLE.positive.label
                    : VOLCANO_STYLE.negative.label,
            marker: {
                size: bucket.sizes,
                color: bucket.colors,
                opacity: bucket.opacities,
                line: {
                    width: key === 'background' ? 0.45 : 0.9,
                    color: key === 'background'
                        ? VOLCANO_STYLE.background.lineColor
                        : key.startsWith('positive')
                            ? VOLCANO_STYLE.positive.lineColor
                            : VOLCANO_STYLE.negative.lineColor,
                },
            },
            hovertemplate: [
                '<b>%{customdata[1]}</b>',
                '%{customdata[2]}',
                `${effectLabel} %{customdata[3]:.4f}`,
                ...posteriorHover,
                'P %{customdata[4]:.2e}',
                'FDR %{customdata[5]:.2e}',
                'Program: %{customdata[6]}',
                'Geneset: %{customdata[7]}',
                '<extra></extra>',
            ].join('<br>'),
            hoverlabel: key === 'background'
                ? buildPlotHoverToneNeutral(theme, '#7a8798', {
                    fontSize: 12,
                    align: 'left',
                })
                : buildPlotHoverTone(theme, key.startsWith('positive')
                    ? (key.endsWith('strong') ? VOLCANO_STYLE.positive.strong : VOLCANO_STYLE.positive.color)
                    : (key.endsWith('strong') ? VOLCANO_STYLE.negative.strong : VOLCANO_STYLE.negative.color), {
                    bgAlpha: 0.16,
                    borderAlpha: 0.34,
                }),
            legendgroup: key.startsWith('positive') ? 'positive' : key.startsWith('negative') ? 'negative' : 'background',
            showlegend: showLegend,
        });

        return [
            makeTrace('background', grouped.background, grouped.background.x.length > 0),
            makeTrace('negative_soft', grouped.negative_soft, grouped.negative_soft.x.length > 0),
            makeTrace('negative_strong', grouped.negative_strong, false),
            makeTrace('positive_soft', grouped.positive_soft, grouped.positive_soft.x.length > 0),
            makeTrace('positive_strong', grouped.positive_strong, false),
        ].filter((trace) => trace.x.length > 0);
    }, [effectLabel, filteredRows, includePosteriorColumns, pointSize, theme]);

    const highlightedPoint = useMemo(() => {
        if (!highlight.rowKey) return [];
        const row = filteredRows.find((item) => item.rowKey === highlight.rowKey) || rows.find((item) => item.rowKey === highlight.rowKey);
        if (!row) return [];
        return [{
            x: [row.effect],
            y: [row.logp],
            mode: 'markers',
            type: 'scatter',
            showlegend: false,
            hoverinfo: 'skip',
            marker: {
                size: pointSize + 7,
                color: 'rgba(255,255,255,0)',
                line: { width: 2.2, color: '#111827' },
                symbol: 'circle-open',
            },
        }];
    }, [filteredRows, highlight.rowKey, pointSize, rows]);

    const xAxisRange = useMemo(
        () => computeVolcanoXAxisRange(rows.map((row) => row.effect)),
        [rows],
    );

    const layout = useMemo(() => ({
        autosize: true,
        title: {
            text: `${traitLabel || fileId} - ${title}`,
            x: 0.01,
            font: { size: 18, family: theme.typography.fontFamily, color: theme.palette.text.primary },
        },
        xaxis: {
            title: { text: effectAxisLabel, font: { size: 14, color: chartTokens.axisColor, family: theme.typography.fontFamily } },
            zeroline: true,
            zerolinewidth: 1.2,
            zerolinecolor: chartTokens.axisSoft,
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: chartTokens.gridColor,
            showline: true,
            linewidth: 1,
            linecolor: chartTokens.axisSoft,
            ticks: 'inside',
            tickfont: { size: 13, color: theme.palette.text.secondary },
            range: xAxisRange,
        },
        yaxis: {
            title: { text: '-log<sub>10</sub>(P)', font: { size: 14, color: chartTokens.axisColor, family: theme.typography.fontFamily } },
            zeroline: false,
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: chartTokens.gridColor,
            showline: true,
            linewidth: 1,
            linecolor: chartTokens.axisSoft,
            ticks: 'inside',
            tickfont: { size: 13, color: theme.palette.text.secondary },
        },
        hovermode: 'closest',
        hoverlabel: buildPlotHoverToneNeutral(theme, volcanoType === 'posterior' ? '#6b7280' : VOLCANO_STYLE.positive.strong, {
            fontSize: 12,
            align: 'left',
        }),
        margin: { l: 80, r: 40, t: 60, b: 60 },
        plot_bgcolor: chartTokens.plotBg,
        paper_bgcolor: chartTokens.paperBg,
        showlegend: false,
        shapes: [
            {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: SIGNIFICANCE_LOGP,
                y1: SIGNIFICANCE_LOGP,
                line: { color: chartTokens.threshold, width: 1.2, dash: '6px,3px' },
                layer: 'below',
            },
        ],
        annotations: [
            {
                xref: 'paper',
                yref: 'y',
                x: 1,
                y: SIGNIFICANCE_LOGP,
                xanchor: 'right',
                yanchor: 'bottom',
                showarrow: false,
                text: '<b>FDR/P guide</b>',
                font: { size: 11, color: chartTokens.threshold, family: theme.typography.fontFamily },
            },
        ],
    }), [chartTokens, effectAxisLabel, fileId, theme, title, traitLabel, volcanoType, xAxisRange]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        modeBarButtonsToAdd: [{
            name: 'download',
            title: 'Download plot',
            icon: Plotly.Icons.disk,
            click: () => setExportOpen(true),
        }],
    }), []);

    const plotRevision = useMemo(() => JSON.stringify({
        rowCount: filteredRows.length,
        pointSize,
        effectMode,
        significantOnly,
        highlightKey: highlight.key,
        variant: variantLabel,
        volcanoType,
    }), [effectMode, filteredRows.length, highlight.key, pointSize, significantOnly, variantLabel, volcanoType]);

    const handleSort = useCallback((column) => {
        if (column === sortBy) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(column);
        setSortDir(['gene', 'ensg', 'primaryProgram', 'primaryGeneset'].includes(column) ? 'asc' : 'desc');
    }, [sortBy]);

    const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);

    const sortedRows = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...filteredRows].sort((a, b) => {
            if (['gene', 'ensg', 'primaryProgram', 'primaryGeneset'].includes(sortBy)) {
                return collator.compare(String(a[sortBy] || ''), String(b[sortBy] || '')) * dir;
            }
            const av = a[sortBy] ?? -Infinity;
            const bv = b[sortBy] ?? -Infinity;
            if (av === bv) return 0;
            return av > bv ? dir : -dir;
        });
    }, [collator, filteredRows, sortBy, sortDir]);

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

    const resetControls = useCallback(() => {
        setEffectMode(EFFECT_MODES.ALL);
        setSignificantOnly(false);
        setPointSize(DEFAULT_POINT_SIZE);
        setHighlight({ rowKey: '', key: 0 });
    }, []);

    const handleVariantChange = (_, value) => {
        if (!value || value === variant) return;
        setVariant(value);
        setEffectMode(EFFECT_MODES.ALL);
        setSignificantOnly(false);
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    };

    const handleExport = useCallback(() => {
        const gd = plotRef.current;
        if (!gd) return;
        const width = normalizeExportSize(exportWidth, DEFAULT_EXPORT_WIDTH);
        const height = normalizeExportSize(exportHeight, DEFAULT_EXPORT_HEIGHT);
        Plotly.toImage(gd, { format: exportFmt, width, height }).then((dataUrl) => {
            downloadDataUrl(dataUrl, `${sanitizeFileNamePart(fileId || gwasId)}-${variantLabel}-${plotSuffix}.${exportFmt}`);
        });
    }, [exportFmt, exportHeight, exportWidth, fileId, gwasId, plotSuffix, variantLabel]);

    const downloadCSV = useCallback(() => {
        const cols = ['Gene', 'ENSG', effectLabel];
        if (includePosteriorColumns) cols.push('Posterior SD', 'Lower 95', 'Upper 95');
        cols.push('P', '-log10(P)', 'FDR', 'Program', 'Geneset');
        const header = cols.join(',');
        const body = rows.map((row) => [
            row.gene || '',
            row.ensg || '',
            row.effect ?? '',
            ...(includePosteriorColumns ? [
                row.posteriorSd ?? '',
                row.lower95 ?? '',
                row.upper95 ?? '',
            ] : []),
            row.p ?? '',
            row.logp ?? '',
            row.fdr ?? '',
            row.primaryProgram || '',
            row.primaryGeneset || '',
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `${exportPrefix}_${variantLabel}_${sanitizeFileNamePart(fileId || gwasId)}.csv`);
    }, [effectLabel, exportPrefix, fileId, gwasId, includePosteriorColumns, rows, variantLabel]);

    if (error) {
        return (
            <Alert
                severity="error"
                sx={{ m: 2 }}
                action={(
                    <Button
                        color="inherit"
                        size="small"
                        startIcon={<Refresh />}
                        onClick={() => setRetryKey((key) => key + 1)}
                    >
                        Retry
                    </Button>
                )}
            >
                {error?.response?.data?.error || error?.message || `Failed to load ${title.toLowerCase()} data.`}
            </Alert>
        );
    }

    const hasVisiblePoints = plotData.some((trace) => Array.isArray(trace.x) && trace.x.length > 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <Box
                sx={toolbarSx(theme, {
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) auto' },
                    alignItems: 'start',
                    gap: 1.5,
                })}
            >
                <Box sx={{ minWidth: 0, maxWidth: { lg: '62ch' } }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.35 }}>
                        {title}
                    </Typography>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                        {variantLabel === 'full' ? fullTitle : hitsTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        {variantLabel === 'full' ? fullDescription : hitsDescription}
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        minWidth: 0,
                        justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                    }}
                >
                    <Chip icon={<Timeline />} label={`${filteredRows.length.toLocaleString()} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                    <Chip icon={<Insights />} label={`${counts.significant.toLocaleString()} highlighted`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                    <Chip icon={<Science />} label={`${counts.positive.toLocaleString()} positive`} size="small" sx={summaryChipSx(theme, { backgroundColor: alpha(VOLCANO_STYLE.positive.color, 0.1), color: VOLCANO_STYLE.positive.strong, border: `1px solid ${alpha(VOLCANO_STYLE.positive.strong, 0.2)}` })} />
                    <Chip icon={<Science />} label={`${counts.negative.toLocaleString()} negative`} size="small" sx={summaryChipSx(theme, { backgroundColor: alpha(VOLCANO_STYLE.negative.color, 0.1), color: VOLCANO_STYLE.negative.strong, border: `1px solid ${alpha(VOLCANO_STYLE.negative.strong, 0.2)}` })} />
                </Box>

                <Box
                    sx={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        minWidth: 0,
                    }}
                >
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={variantControlValue}
                        onChange={handleVariantChange}
                        sx={statusToggleSx(theme)}
                    >
                        <ToggleButton value="hits">Hits TSV</ToggleButton>
                        <ToggleButton value="full" disabled={Boolean(payload) && !availableVariants.full}>Full TSV</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={effectMode}
                        onChange={(_, value) => { if (value) setEffectMode(value); }}
                        sx={statusToggleSx(theme)}
                    >
                        <ToggleButton value={EFFECT_MODES.ALL}>All</ToggleButton>
                        <ToggleButton value={EFFECT_MODES.POSITIVE}>Positive</ToggleButton>
                        <ToggleButton value={EFFECT_MODES.NEGATIVE}>Negative</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={significantOnly ? 'significant' : 'all'}
                        onChange={(_, value) => {
                            if (!value) return;
                            setSignificantOnly(value === 'significant');
                        }}
                        sx={statusToggleSx(theme)}
                    >
                        <ToggleButton value="all">All genes</ToggleButton>
                        <ToggleButton value="significant">Sig only</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            <Box sx={toolbarSx(theme)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 220 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: theme.palette.text.secondary,
                            fontSize: '0.72rem',
                            textTransform: 'none',
                            letterSpacing: 0.8,
                            fontWeight: 500,
                        }}
                    >
                        Size
                    </Typography>
                    <Slider
                        value={pointSize}
                        min={4}
                        max={18}
                        step={1}
                        onChange={(_, value) => setPointSize(Number(value))}
                        sx={{
                            width: 120,
                            color: theme.palette.text.secondary,
                            '& .MuiSlider-thumb': { width: 14, height: 14 },
                            '& .MuiSlider-rail': { opacity: 0.25 },
                        }}
                    />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem', minWidth: 26 }}>
                        {pointSize}
                    </Typography>
                </Box>

                <Button variant="text" startIcon={<RestartAlt />} onClick={resetControls} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38 }}>
                    Reset
                </Button>

                <Typography sx={{ width: '100%', fontSize: '0.74rem', color: theme.palette.text.secondary, lineHeight: 1.4 }}>
                    {guideText}
                </Typography>
            </Box>

            <Card elevation={0} sx={plotFrameSx(theme)}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {(isLoading || shouldAutoSwitchToFull) && (
                        <Box sx={{ minHeight: RESPONSIVE_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    {shouldAutoSwitchToFull ? `Hits TSV has fewer than ${MIN_DEFAULT_HIT_ROWS} rows; loading Full TSV...` : `Loading ${title.toLowerCase()} data...`}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!isLoading && !shouldAutoSwitchToFull && rows.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="warning" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">{emptyMessage}</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && !shouldAutoSwitchToFull && rows.length > 0 && !hasVisiblePoints && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No genes match the current volcano filters.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && !shouldAutoSwitchToFull && hasVisiblePoints && (
                        <>
                            <Plot
                                data={[...plotData, ...highlightedPoint]}
                                layout={layout}
                                config={plotConfig}
                                revision={plotRevision}
                                onInitialized={onInitialized}
                                onUpdate={onUpdate}
                                onClick={(evt) => {
                                    const rowKey = evt?.points?.[0]?.customdata?.[0];
                                    if (!rowKey) return;
                                    setHighlight((prev) => ({ rowKey, key: prev.key + 1 }));
                                    setTableOpen(true);
                                }}
                                useResizeHandler
                                style={{ width: '100%', height: RESPONSIVE_PLOT_HEIGHT }}
                            />
                            <FloatingLegend
                                items={legendItems}
                                collapsed={legendCollapsed}
                                onToggleCollapsed={() => setLegendCollapsed((prev) => !prev)}
                                title="Effects"
                                width={{ expanded: 222, collapsed: 116 }}
                                defaultPlacement="right"
                                defaultTop={108}
                                defaultSideOffset={10}
                                anchorPlotRef={plotRef}
                                showScale={false}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <BurdenVolcanoTable
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
                navigate={navigate}
                getProgramRoute={getProgramRoute}
                effectLabel={effectLabel}
                includePosteriorColumns={includePosteriorColumns}
            />

            <Dialog open={exportOpen} onClose={() => setExportOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700, color: theme.palette.text.primary, fontFamily: theme.typography.fontFamily }}>Export Plot</DialogTitle>
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
