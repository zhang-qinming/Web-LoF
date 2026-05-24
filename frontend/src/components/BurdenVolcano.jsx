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
import {
    Insights,
    RestartAlt,
    Science,
    Timeline,
} from '@mui/icons-material';
import { getBurdenVolcano, getPosteriorVolcano } from '../api/gwas';
import BurdenVolcanoTable from './BurdenVolcanoTable';
import { downloadBlob, downloadDataUrl } from '../utils/download';

const COLORS = {
    positive: '#cc6f3c',
    negative: '#4f7da8',
};

const EFFECT_MODES = {
    ALL: 'all',
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
};

const SIGNIFICANCE_LOGP = -Math.log10(0.05);
const DEFAULT_EXPORT_WIDTH = 1280;
const DEFAULT_EXPORT_HEIGHT = 800;
const DEFAULT_POINT_SIZE = 9;

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

const TOOLBAR_SX = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1.25,
    px: 2,
    py: 1.45,
    bgcolor: '#f9f9fb',
    borderRadius: 2,
    border: '1px solid #e8e8ec',
};

const COMPACT_TOGGLE_SX = {
    '& .MuiToggleButton-root': {
        px: 1.75,
        py: 0.42,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.8rem',
        letterSpacing: 0.2,
        color: '#6b7280',
        borderColor: '#d9dde3',
        '&.Mui-selected': {
            color: '#1f2937',
            bgcolor: '#e9edf3',
            fontWeight: 600,
        },
        '&:hover': {
            bgcolor: '#f1f4f8',
        },
    },
};

const SUMMARY_CHIP_SX = {
    height: 24,
    fontSize: '0.72rem',
    fontWeight: 600,
    '& .MuiChip-icon': {
        fontSize: 15,
    },
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function sanitizeFileNamePart(value) {
    return String(value || 'plot').replace(/[\\/:*?"<>|]+/g, '_');
}

function compactFileName(value, maxLength = 42) {
    const text = String(value || 'not found');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, 18)}...${text.slice(-18)}`;
}

function normalizeExportSize(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return clamp(Math.round(num), 200, 4000);
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

    const [payload, setPayload] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [variant, setVariant] = useState('hits');
    const [effectMode, setEffectMode] = useState(EFFECT_MODES.ALL);
    const [significantOnly, setSignificantOnly] = useState(false);
    const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE);
    const [tableOpen, setTableOpen] = useState(false);
    const [sortBy, setSortBy] = useState('logp');
    const [sortDir, setSortDir] = useState('desc');
    const [highlight, setHighlight] = useState({ rowKey: '', key: 0 });
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(50);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');

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
        fetchVolcano(gwasId || fileId, { variant, aliasId: fileId })
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
    }, [fetchVolcano, fileId, gwasId, variant]);

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

    const plotData = useMemo(() => {
        const grouped = {
            negative: { x: [], y: [], text: [], customdata: [] },
            positive: { x: [], y: [], text: [], customdata: [] },
            neutral: { x: [], y: [], text: [], customdata: [] },
        };

        filteredRows.forEach((row) => {
            const key = row.effectClass;
            grouped[key].x.push(row.effect);
            grouped[key].y.push(row.logp);
            grouped[key].text.push(row.gene || row.ensg || row.rowKey);
            grouped[key].customdata.push([
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
        });

        const posteriorHover = includePosteriorColumns ? [
            'Posterior SD %{customdata[8]:.4f}',
            '95% CI [%{customdata[9]:.4f}, %{customdata[10]:.4f}]',
        ] : [];

        return ['negative', 'positive'].map((key) => ({
            x: grouped[key].x,
            y: grouped[key].y,
            text: grouped[key].text,
            customdata: grouped[key].customdata,
            mode: 'markers',
            type: 'scattergl',
            name: key === 'positive' ? 'Positive effect' : 'Negative effect',
            marker: {
                size: pointSize,
                color: COLORS[key],
                opacity: 0.84,
                line: { width: 0.6, color: 'rgba(255,255,255,0.72)' },
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
            showlegend: true,
        })).filter((trace) => trace.x.length > 0);
    }, [effectLabel, filteredRows, includePosteriorColumns, pointSize]);

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

    const layout = useMemo(() => ({
        title: {
            text: `${traitLabel || fileId} - ${title}`,
            x: 0.01,
            font: { size: 18, family: 'system-ui, -apple-system, sans-serif', color: '#333' },
        },
        xaxis: {
            title: { text: effectAxisLabel, font: { size: 14, color: '#374151', family: 'system-ui, -apple-system, sans-serif' } },
            zeroline: true,
            zerolinewidth: 1.2,
            zerolinecolor: '#bbb',
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: '#eaeaea',
            showline: true,
            linewidth: 1,
            linecolor: '#ccc',
            ticks: 'inside',
            tickfont: { size: 13, color: '#666' },
        },
        yaxis: {
            title: { text: '-log<sub>10</sub>(P)', font: { size: 14, color: '#374151', family: 'system-ui, -apple-system, sans-serif' } },
            zeroline: false,
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: '#eaeaea',
            showline: true,
            linewidth: 1,
            linecolor: '#ccc',
            ticks: 'inside',
            tickfont: { size: 13, color: '#666' },
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'rgba(255,255,255,0.98)',
            bordercolor: '#cbd5e1',
            font: { size: 12, color: '#1f2937' },
            align: 'left',
        },
        margin: { l: 80, r: 40, t: 60, b: 60 },
        plot_bgcolor: '#fcfcfd',
        paper_bgcolor: 'white',
        showlegend: true,
        legend: {
            x: 0.02,
            y: 0.98,
            xanchor: 'left',
            yanchor: 'top',
            bgcolor: 'rgba(255,255,255,0.86)',
            bordercolor: '#e0e0e0',
            borderwidth: 1,
            font: { size: 12, color: '#555' },
        },
        shapes: [
            {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: SIGNIFICANCE_LOGP,
                y1: SIGNIFICANCE_LOGP,
                line: { color: '#b45309', width: 1.2, dash: '6px,3px' },
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
                font: { size: 11, color: '#b45309', family: 'system-ui, -apple-system, sans-serif' },
            },
        ],
    }), [effectAxisLabel, fileId, title, traitLabel]);

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
            const tableSection = tableSectionRef.current;
            if (tableSection) {
                const top = tableSection.getBoundingClientRect().top + window.scrollY - 84;
                window.scrollTo({ top, behavior: 'smooth' });
            }
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
            downloadDataUrl(dataUrl, `${sanitizeFileNamePart(gwasId || fileId)}-${variantLabel}-${plotSuffix}.${exportFmt}`);
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
        downloadBlob(blob, `${exportPrefix}_${variantLabel}_${sanitizeFileNamePart(gwasId || fileId)}.csv`);
    }, [effectLabel, exportPrefix, fileId, gwasId, includePosteriorColumns, rows, variantLabel]);

    if (error) {
        return <Alert severity="error" sx={{ m: 2 }}>{error.message}</Alert>;
    }

    const hasVisiblePoints = plotData.some((trace) => Array.isArray(trace.x) && trace.x.length > 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={TOOLBAR_SX}>
                <Box sx={{ minWidth: 220, mr: 0.5 }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b', mb: 0.35 }}>
                        {title}
                    </Typography>
                    <Typography sx={{ fontSize: '1.02rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.25 }}>
                        {variantLabel === 'full' ? fullTitle : hitsTitle}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        {variantLabel === 'full' ? fullDescription : hitsDescription}
                    </Typography>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={variantControlValue}
                    onChange={handleVariantChange}
                    sx={COMPACT_TOGGLE_SX}
                >
                    <ToggleButton value="hits">Hits TSV</ToggleButton>
                    <ToggleButton value="full" disabled={Boolean(payload) && !availableVariants.full}>Full TSV</ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={effectMode}
                    onChange={(_, value) => { if (value) setEffectMode(value); }}
                    sx={COMPACT_TOGGLE_SX}
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
                    sx={COMPACT_TOGGLE_SX}
                >
                    <ToggleButton value="all">All genes</ToggleButton>
                    <ToggleButton value="significant">Sig only</ToggleButton>
                </ToggleButtonGroup>

                <Chip icon={<Timeline />} label={`${filteredRows.length.toLocaleString()} genes`} size="small" sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }} />
                <Chip icon={<Insights />} label={`${counts.significant.toLocaleString()} highlighted`} size="small" sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#fff7ed', color: '#b45309', border: '1px solid #fed7aa' }} />
                <Chip icon={<Science />} label={`${counts.positive.toLocaleString()} positive`} size="small" sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#fff7f2', color: COLORS.positive, border: '1px solid rgba(204,111,60,0.22)' }} />
                <Chip icon={<Science />} label={`${counts.negative.toLocaleString()} negative`} size="small" sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#f4f8fd', color: COLORS.negative, border: '1px solid rgba(79,125,168,0.2)' }} />
                <Chip label={variantLabel === 'full' ? 'Full TSV' : 'Hits TSV'} size="small" sx={{ ...SUMMARY_CHIP_SX, bgcolor: variantLabel === 'full' ? '#ecfeff' : '#ffffff', color: '#0f766e', border: '1px solid #99f6e4', fontFamily: 'monospace' }} />
                <Chip label={`GWAS ${gwasId || 'NA'}`} size="small" sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#ffffff', color: '#64748b', border: '1px solid #d9dde3', fontFamily: 'monospace' }} />
                <Chip
                    label={`TSV ${compactFileName(payload?.fileName)}`}
                    title={payload?.fileName || 'No TSV matched on the backend'}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, maxWidth: 280, bgcolor: '#ffffff', color: '#64748b', border: '1px solid #d9dde3', fontFamily: 'monospace' }}
                />
            </Box>

            <Box sx={TOOLBAR_SX}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 220 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: '#888',
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
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
                            color: '#999',
                            '& .MuiSlider-thumb': { width: 14, height: 14 },
                            '& .MuiSlider-rail': { opacity: 0.25 },
                        }}
                    />
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '0.72rem', minWidth: 26 }}>
                        {pointSize}
                    </Typography>
                </Box>

                <Button variant="text" startIcon={<RestartAlt />} onClick={resetControls} sx={{ textTransform: 'none', color: '#475569', fontWeight: 600, minHeight: 38 }}>
                    Reset
                </Button>

                <Typography sx={{ width: '100%', fontSize: '0.74rem', color: '#6b7280', lineHeight: 1.4 }}>
                    {guideText}
                </Typography>
            </Box>

            <Card elevation={0} sx={{
                border: '1px solid #e8e8ec',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: '#ffffff',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
            }}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {isLoading && (
                        <Box sx={{ minHeight: 620, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: '#6b7280' }}>
                                    Loading {title.toLowerCase()} data...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!isLoading && rows.length === 0 && (
                        <Box sx={{ minHeight: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="warning" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">{emptyMessage}</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && rows.length > 0 && !hasVisiblePoints && (
                        <Box sx={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No genes match the current volcano filters.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && hasVisiblePoints && (
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
                            style={{ width: '100%', height: '620px' }}
                        />
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
                <DialogTitle sx={{ fontWeight: 700, color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>Export Plot</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        <TextField label="Width" type="number" size="small" value={exportWidth} onChange={(event) => setExportWidth(event.target.value)} />
                        <TextField label="Height" type="number" size="small" value={exportHeight} onChange={(event) => setExportHeight(event.target.value)} />
                    </Stack>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={exportFmt}
                        onChange={(_, value) => { if (value) setExportFmt(value); }}
                        sx={{
                            '& .MuiToggleButton-root': { textTransform: 'none', px: 2.5 },
                            '& .Mui-selected': { bgcolor: '#111827 !important', color: '#fff !important' },
                        }}
                    >
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setExportOpen(false)} sx={{ textTransform: 'none', color: '#6b7280' }}>Cancel</Button>
                    <Button variant="contained" onClick={() => { handleExport(); setExportOpen(false); }} sx={{ textTransform: 'none', bgcolor: '#111827', '&:hover': { bgcolor: '#1f2937' } }}>Export</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
