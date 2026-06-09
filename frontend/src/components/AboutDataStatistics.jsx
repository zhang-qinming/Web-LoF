import React from 'react';
import Plot from 'react-plotly.js';
import {
    Alert,
    Box,
    Chip,
    Paper,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    CalendarMonthOutlined,
    DatasetOutlined,
    DifferenceOutlined,
    FolderOutlined,
    GroupsOutlined,
    HubOutlined,
    InsightsOutlined,
    PercentOutlined,
    ScienceOutlined,
    StorageOutlined,
} from '@mui/icons-material';
import { getHomeStats } from '../api/gwas';
import { StatePanel } from './PageScaffold';
import {
    captionSx,
    chartLayoutTokens,
    metricChipTone,
    panelSx,
    sectionTitleSx,
    summaryChipSx,
} from '../themeUtils';

const METRIC_KEYS = ['traits', 'variants', 'significantLoci', 'dataOutputs'];
const SUPPLEMENTAL_KEYS = ['programs', 'populations', 'sourceBatches', 'studyYears'];
const CATALOG_KEYS = ['traits', 'variants', 'significantLoci', 'dataOutputs'];
const ANNOTATION_KEYS = ['programs', 'populations', 'sourceBatches'];
const DERIVED_KEYS = [
    'variantsPerTrait',
    'lociPerTrait',
    'lociPerMillionVariants',
    'filesPerTrait',
    'filesPerProgram',
    'traitsPerYear',
    'traitsPerBatch',
    'variantsPerPopulation',
];

const METRIC_META = {
    traits: { tone: 'primary', icon: InsightsOutlined },
    variants: { tone: 'success', icon: StorageOutlined },
    significantLoci: { tone: 'warning', icon: HubOutlined },
    dataOutputs: { tone: 'accent', icon: DatasetOutlined },
    programs: { tone: 'primary', icon: ScienceOutlined },
    populations: { tone: 'success', icon: GroupsOutlined },
    sourceBatches: { tone: 'neutral', icon: FolderOutlined },
    studyYears: { tone: 'warning', icon: CalendarMonthOutlined },
};

function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
    return asNumber(value).toLocaleString();
}

function formatCompactNumber(value) {
    const number = asNumber(value);
    if (!number) return '0';
    if (Math.abs(number) >= 1000000) {
        return number.toLocaleString(undefined, { maximumFractionDigits: 1, notation: 'compact' });
    }
    if (Math.abs(number) >= 1000) {
        return number.toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    if (Math.abs(number) >= 100) {
        return number.toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
    return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function progressPercent(value, maxValue, { log = false } = {}) {
    const current = Math.max(asNumber(value), 0);
    const max = Math.max(asNumber(maxValue), 0);
    if (!current || !max) return 0;
    if (log) {
        const numerator = Math.log10(current + 1);
        const denominator = Math.log10(max + 1);
        return Math.max(4, Math.min(100, (numerator / denominator) * 100));
    }
    return Math.max(4, Math.min(100, (current / max) * 100));
}

function divide(numerator, denominator, multiplier = 1) {
    const den = asNumber(denominator);
    if (!den) return 0;
    return (asNumber(numerator) * multiplier) / den;
}

function getStudyYearCount(stats) {
    const minYear = asNumber(stats?.minYear);
    const maxYear = asNumber(stats?.maxYear);
    if (!minYear || !maxYear) return 0;
    return Math.max(1, maxYear - minYear + 1);
}

function hasStats(stats) {
    if (!stats) return false;
    return [
        'traits',
        'variants',
        'significantLoci',
        'programs',
        'dataOutputs',
        'populations',
        'sourceBatches',
    ].some((key) => asNumber(stats[key]) > 0);
}

function buildRange(stats, emptyLabel) {
    if (stats?.minYear && stats?.maxYear) {
        return stats.minYear === stats.maxYear ? String(stats.minYear) : `${stats.minYear}-${stats.maxYear}`;
    }
    if (stats?.minYear) return String(stats.minYear);
    if (stats?.maxYear) return String(stats.maxYear);
    return emptyLabel;
}

function formatDate(value, emptyLabel) {
    if (!value) return emptyLabel;
    return String(value);
}

function getErrorMessage(error, fallback) {
    return error?.response?.data?.error || error?.message || fallback;
}

function getRawValue(stats, key) {
    if (key === 'studyYears') return getStudyYearCount(stats);
    return asNumber(stats?.[key]);
}

function getDerivedStats(stats) {
    const traits = asNumber(stats?.traits);
    const variants = asNumber(stats?.variants);
    const loci = asNumber(stats?.significantLoci);
    const files = asNumber(stats?.dataOutputs);
    const programs = asNumber(stats?.programs);
    const batches = asNumber(stats?.sourceBatches);
    const populations = asNumber(stats?.populations);
    const studyYears = getStudyYearCount(stats);

    return {
        variantsPerTrait: divide(variants, traits),
        lociPerTrait: divide(loci, traits),
        lociPerMillionVariants: divide(loci, variants, 1000000),
        filesPerTrait: divide(files, traits),
        filesPerProgram: divide(files, programs),
        traitsPerYear: divide(traits, studyYears),
        traitsPerBatch: divide(traits, batches),
        variantsPerPopulation: divide(variants, populations),
    };
}

function MetricCard({ item, stats, maxValue }) {
    const theme = useTheme();
    const tone = metricChipTone(theme, item.tone);
    const Icon = item.icon;
    const value = getRawValue(stats, item.key);
    const percent = progressPercent(value, maxValue, { log: true });

    return (
        <Box
            role="group"
            aria-label={`${item.label}: ${formatNumber(value)}`}
            sx={{
                minWidth: 0,
                p: 1.25,
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                bgcolor: theme.palette.background.paper,
                boxShadow: '0 8px 18px rgba(15, 23, 42, 0.035)',
            }}
        >
            <Stack direction="row" spacing={0.9} alignItems="center" sx={{ mb: 0.8, minWidth: 0 }}>
                <Box
                    sx={{
                        width: 30,
                        height: 30,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        color: tone.color,
                        bgcolor: tone.backgroundColor,
                        border: tone.border,
                        flexShrink: 0,
                    }}
                >
                    <Icon sx={{ fontSize: 17 }} />
                </Box>
                <Typography
                    variant="caption"
                    sx={{
                        color: theme.palette.text.secondary,
                        fontWeight: 720,
                        lineHeight: 1.2,
                        minWidth: 0,
                    }}
                >
                    {item.label}
                </Typography>
            </Stack>
            <Typography
                variant="h5"
                component="p"
                sx={{
                    color: theme.palette.text.primary,
                    fontWeight: 760,
                    lineHeight: 1,
                    overflowWrap: 'anywhere',
                }}
            >
                {formatNumber(value)}
            </Typography>
            <Box
                sx={{
                    mt: 1,
                    height: 4,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.text.primary, 0.08),
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        width: `${percent}%`,
                        height: '100%',
                        borderRadius: 1,
                        bgcolor: tone.color,
                    }}
                />
            </Box>
        </Box>
    );
}

function SupplementalCard({ item, stats, maxValue }) {
    const theme = useTheme();
    const tone = metricChipTone(theme, item.tone);
    const Icon = item.icon;
    const value = getRawValue(stats, item.key);
    const percent = progressPercent(value, maxValue);

    return (
        <Box
            role="group"
            aria-label={`${item.label}: ${formatNumber(value)}`}
            sx={{
                minWidth: 0,
                display: 'flex',
                gap: 0.9,
                alignItems: 'center',
                p: 0,
                borderRadius: 1,
                bgcolor: 'transparent',
            }}
        >
            <Box
                sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    display: 'grid',
                    placeItems: 'center',
                    color: tone.color,
                    bgcolor: tone.backgroundColor,
                    border: tone.border,
                    flexShrink: 0,
                }}
            >
                <Icon sx={{ fontSize: 16 }} />
            </Box>
            <Box sx={{ minWidth: 0, width: '100%' }}>
                <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 720, lineHeight: 1.12 }}>
                    {item.label}
                </Typography>
                <Stack direction="row" spacing={0.8} alignItems="center">
                    <Typography variant="subtitle1" sx={{ color: theme.palette.text.primary, fontWeight: 760, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                        {formatNumber(value)}
                    </Typography>
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 28,
                            height: 3,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.text.primary, 0.08),
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                width: `${percent}%`,
                                height: '100%',
                                borderRadius: 1,
                                bgcolor: tone.color,
                            }}
                        />
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}

function MetricSkeleton() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                p: 1.25,
                borderRadius: 1,
                border: `1px solid ${theme.custom.border.soft}`,
                bgcolor: theme.palette.background.paper,
            }}
        >
            <Stack direction="row" spacing={0.9} alignItems="center" sx={{ mb: 0.8 }}>
                <Skeleton variant="rectangular" width={30} height={30} sx={{ borderRadius: 1 }} />
                <Skeleton width="58%" height={18} />
            </Stack>
            <Skeleton width="74%" height={32} />
        </Box>
    );
}

function SupplementalSkeleton() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'flex',
                gap: 0.9,
                alignItems: 'center',
                p: 1,
                borderRadius: 1,
                border: `1px solid ${theme.custom.border.soft}`,
                bgcolor: theme.palette.background.paper,
            }}
        >
            <Skeleton variant="rectangular" width={28} height={28} sx={{ borderRadius: 1, flexShrink: 0 }} />
            <Box sx={{ width: '100%' }}>
                <Skeleton width="68%" height={16} />
                <Skeleton width="42%" height={24} />
            </Box>
        </Box>
    );
}

function SummaryRow({ item, stats }) {
    const theme = useTheme();
    const value = asNumber(stats?.[item.key]);
    const percent = progressPercent(value, stats?.variants || value, { log: true });

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.35,
                py: 0.55,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.54)}`,
                '&:last-of-type': { borderBottom: 0 },
            }}
        >
            <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between">
                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                    {item.label}
                </Typography>
                <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 760, whiteSpace: 'nowrap' }}>
                    {formatNumber(value)}
                </Typography>
            </Stack>
            <Box sx={{ height: 3, borderRadius: 1, bgcolor: alpha(theme.palette.text.primary, 0.07), overflow: 'hidden' }}>
                <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: theme.palette.primary.main, borderRadius: 1 }} />
            </Box>
        </Box>
    );
}

function DerivedMetricCard({ item, maxValue }) {
    const theme = useTheme();
    const percent = progressPercent(item.value, maxValue, { log: true });

    return (
        <Box
            role="group"
            aria-label={`${item.label}: ${formatCompactNumber(item.value)} ${item.unit}`}
            sx={{
                minWidth: 0,
                p: 0,
                borderRadius: 1,
                bgcolor: 'transparent',
            }}
        >
            <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.55, minWidth: 0 }}>
                <PercentOutlined sx={{ fontSize: 15, color: theme.palette.primary.main, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 720, lineHeight: 1.15 }}>
                    {item.label}
                </Typography>
            </Stack>
            <Typography variant="subtitle1" sx={{ color: theme.palette.text.primary, fontWeight: 760, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                {formatCompactNumber(item.value)}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.2, color: theme.palette.text.secondary, lineHeight: 1.2 }}>
                {item.unit}
            </Typography>
            <Box sx={{ mt: 0.55, height: 3, borderRadius: 1, bgcolor: alpha(theme.palette.text.primary, 0.08), overflow: 'hidden' }}>
                <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: theme.palette.primary.main, borderRadius: 1 }} />
            </Box>
        </Box>
    );
}

function CompactPlotCard({ title, ariaLabel, children, summary, summaryColumns = { xs: 'repeat(2, minmax(0, 1fr))', md: '1fr' } }) {
    const theme = useTheme();

    return (
        <Box
            aria-label={ariaLabel}
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
                gap: 1.2,
                alignItems: 'stretch',
            }}
        >
            <Box
                sx={{
                    minWidth: 0,
                    height: { xs: 340, md: 320 },
                    borderRadius: 1,
                    bgcolor: theme.palette.background.paper,
                    overflow: 'hidden',
                    boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.26)',
                }}
            >
                {children}
            </Box>
            <Box
                sx={{
                    minWidth: 0,
                    p: 1.1,
                    borderRadius: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.76),
                }}
            >
                <Typography variant="subtitle2" sx={sectionTitleSx(theme, { mb: 0.75 })}>
                    {title}
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: summaryColumns,
                        gap: 0.9,
                    }}
                >
                    {summary}
                </Box>
            </Box>
        </Box>
    );
}

function SupplementalCoveragePanel({ copy, stats, items }) {
    const theme = useTheme();
    const chartTokens = chartLayoutTokens(theme);
    const plotItems = items.map((item) => ({ ...item, value: getRawValue(stats, item.key) }));
    const maxValue = Math.max(...plotItems.map((item) => item.value), 0);
    const config = React.useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);

    return (
        <Box sx={{ mb: 1.4 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                <DatasetOutlined sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography variant="subtitle2" sx={sectionTitleSx(theme)}>
                    {copy.title}
                </Typography>
            </Stack>
            <CompactPlotCard
                title={copy.summaryTitle}
                ariaLabel={copy.chartAria}
                summary={plotItems.map((item) => (
                    <SupplementalCard key={item.key} item={item} stats={stats} maxValue={maxValue} />
                ))}
            >
                <Plot
                    data={[{
                        type: 'bar',
                        orientation: 'h',
                        x: plotItems.map((item) => item.value),
                        y: plotItems.map((item) => item.label),
                        text: plotItems.map((item) => formatNumber(item.value)),
                        textposition: 'auto',
                        marker: {
                            color: ['#3f7eb8', '#36a269', '#6b7a90', '#b7791f'],
                            line: { color: 'rgba(15,23,42,0.14)', width: 1 },
                        },
                        hovertemplate: '%{y}<br>%{x:,}<extra></extra>',
                    }]}
                    layout={{
                        autosize: true,
                        margin: { l: 118, r: 16, t: 20, b: 36 },
                        paper_bgcolor: 'rgba(255,255,255,0)',
                        plot_bgcolor: chartTokens.plotBg,
                        font: {
                            family: theme.typography.fontFamily,
                            color: theme.palette.text.primary,
                        },
                        showlegend: false,
                        bargap: 0.38,
                        xaxis: {
                            rangemode: 'tozero',
                            title: { text: copy.countAxisLabel, font: { size: 11, color: theme.palette.text.secondary } },
                            tickfont: { size: 10, color: theme.palette.text.secondary },
                            gridcolor: chartTokens.gridColor,
                            zeroline: false,
                            fixedrange: true,
                        },
                        yaxis: {
                            automargin: true,
                            tickfont: { size: 11, color: theme.palette.text.secondary },
                            fixedrange: true,
                        },
                    }}
                    config={config}
                    useResizeHandler
                    style={{
                        width: '100%',
                        height: '100%',
                        '& .js-plotly-plot': { width: '100%', height: '100%' },
                    }}
                />
            </CompactPlotCard>
        </Box>
    );
}

function DerivedStatsPanel({ copy, stats }) {
    const theme = useTheme();
    const chartTokens = chartLayoutTokens(theme);
    const derivedStats = getDerivedStats(stats);
    const items = DERIVED_KEYS.map((key) => ({
        ...copy.items[key],
        key,
        value: derivedStats[key],
    }));
    const maxValue = Math.max(...items.map((item) => item.value), 0);
    const config = React.useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);

    return (
        <Box
            sx={{
                p: 1.25,
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.58),
            }}
        >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.45 }}>
                <DifferenceOutlined sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography variant="subtitle2" sx={sectionTitleSx(theme)}>
                    {copy.title}
                </Typography>
            </Stack>
            <Typography variant="body2" sx={captionSx(theme, { mb: 1.1 })}>
                {copy.body}
            </Typography>
            <CompactPlotCard
                title={copy.summaryTitle}
                ariaLabel={copy.chartAria}
                summary={items.map((item) => (
                    <DerivedMetricCard key={item.key} item={item} maxValue={maxValue} />
                ))}
                summaryColumns={{ xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(2, minmax(0, 1fr))' }}
            >
                <Plot
                    data={[{
                        type: 'bar',
                        orientation: 'h',
                        x: items.map((item) => Math.max(item.value, 0.001)),
                        y: items.map((item) => item.label),
                        text: items.map((item) => formatCompactNumber(item.value)),
                        customdata: items.map((item) => [item.value, item.unit]),
                        textposition: 'auto',
                        marker: {
                            color: ['#2f80c3', '#2ca58d', '#b7791f', '#6d5aa8', '#3f7eb8', '#36a269', '#6b7a90', '#b35b7d'],
                            line: { color: 'rgba(15,23,42,0.14)', width: 1 },
                        },
                        hovertemplate: '%{y}<br>%{customdata[0]:,.3f} %{customdata[1]}<extra></extra>',
                    }]}
                    layout={{
                        autosize: true,
                        margin: { l: 150, r: 16, t: 20, b: 38 },
                        paper_bgcolor: 'rgba(255,255,255,0)',
                        plot_bgcolor: chartTokens.plotBg,
                        font: {
                            family: theme.typography.fontFamily,
                            color: theme.palette.text.primary,
                        },
                        showlegend: false,
                        bargap: 0.32,
                        xaxis: {
                            type: 'log',
                            title: { text: copy.logAxisLabel, font: { size: 11, color: theme.palette.text.secondary } },
                            tickfont: { size: 10, color: theme.palette.text.secondary },
                            gridcolor: chartTokens.gridColor,
                            zeroline: false,
                            fixedrange: true,
                        },
                        yaxis: {
                            automargin: true,
                            tickfont: { size: 10, color: theme.palette.text.secondary },
                            fixedrange: true,
                        },
                    }}
                    config={config}
                    useResizeHandler
                    style={{
                        width: '100%',
                        height: '100%',
                        '& .js-plotly-plot': { width: '100%', height: '100%' },
                    }}
                />
            </CompactPlotCard>
        </Box>
    );
}

function SpanItem({ icon, label, value }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                minWidth: 0,
                display: 'flex',
                gap: 0.8,
                alignItems: 'center',
                px: 1,
                py: 0.75,
                borderRadius: 1,
                border: `1px solid ${theme.custom.border.soft}`,
                bgcolor: theme.palette.background.paper,
            }}
        >
            {React.createElement(icon, { sx: { fontSize: 16, color: theme.palette.primary.main, flexShrink: 0 } })}
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    variant="caption"
                    sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 700, lineHeight: 1.15 }}
                >
                    {label}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{ color: theme.palette.text.primary, fontWeight: 730, lineHeight: 1.3, overflowWrap: 'anywhere' }}
                >
                    {value}
                </Typography>
            </Box>
        </Box>
    );
}

function CoverageChart({ copy, stats }) {
    const theme = useTheme();
    const chartTokens = chartLayoutTokens(theme);
    const catalogItems = CATALOG_KEYS.map((key) => ({ ...copy.dimensions[key], key, value: asNumber(stats?.[key]) }));
    const annotationItems = ANNOTATION_KEYS.map((key) => ({ ...copy.dimensions[key], key, value: asNumber(stats?.[key]) }));
    const config = React.useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);
    const commonLayout = {
        autosize: true,
        margin: { l: 96, r: 16, t: 22, b: 42 },
        paper_bgcolor: 'rgba(255,255,255,0)',
        plot_bgcolor: chartTokens.plotBg,
        font: {
            family: theme.typography.fontFamily,
            color: theme.palette.text.primary,
        },
        hovermode: 'closest',
        showlegend: false,
        bargap: 0.34,
        yaxis: {
            automargin: true,
            tickfont: { size: 11, color: theme.palette.text.secondary },
            fixedrange: true,
        },
    };

    const plotSx = {
        width: '100%',
        height: '100%',
        '& .js-plotly-plot': { width: '100%', height: '100%' },
    };

    return (
        <Box
            aria-label={copy.chartAria}
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
                gap: 1.4,
                alignItems: 'stretch',
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1,
                    minWidth: 0,
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                        height: { xs: 340, sm: 360, md: 360 },
                        borderRadius: 1,
                        border: `1px solid ${theme.custom.border.soft}`,
                        bgcolor: theme.palette.background.paper,
                        overflow: 'hidden',
                    }}
                >
                    <Plot
                        data={[{
                            type: 'bar',
                            orientation: 'h',
                            x: catalogItems.map((item) => Math.max(item.value, 1)),
                            y: catalogItems.map((item) => item.label),
                            text: catalogItems.map((item) => formatNumber(item.value)),
                            customdata: catalogItems.map((item) => item.value),
                            textposition: 'auto',
                            marker: {
                                color: ['#2f80c3', '#2ca58d', '#b7791f', '#6d5aa8'],
                                line: { color: 'rgba(15,23,42,0.14)', width: 1 },
                            },
                            hovertemplate: '%{y}<br>%{customdata:,}<extra></extra>',
                        }]}
                        layout={{
                            ...commonLayout,
                            title: {
                                text: copy.catalogScale,
                                x: 0.02,
                                font: { size: 13, color: theme.palette.text.primary },
                            },
                            xaxis: {
                                type: 'log',
                                title: { text: copy.logAxisLabel, font: { size: 11, color: theme.palette.text.secondary } },
                                tickfont: { size: 10, color: theme.palette.text.secondary },
                                gridcolor: chartTokens.gridColor,
                                zeroline: false,
                                fixedrange: true,
                            },
                        }}
                        config={config}
                        useResizeHandler
                        style={plotSx}
                    />
                </Box>

                <Box
                    sx={{
                        minWidth: 0,
                        height: { xs: 340, sm: 340, md: 360 },
                        borderRadius: 1,
                        border: `1px solid ${theme.custom.border.soft}`,
                        bgcolor: theme.palette.background.paper,
                        overflow: 'hidden',
                    }}
                >
                    <Plot
                        data={[{
                            type: 'bar',
                            orientation: 'h',
                            x: annotationItems.map((item) => item.value),
                            y: annotationItems.map((item) => item.label),
                            text: annotationItems.map((item) => formatNumber(item.value)),
                            textposition: 'auto',
                            marker: {
                                color: ['#3f7eb8', '#36a269', '#6b7a90'],
                                line: { color: 'rgba(15,23,42,0.14)', width: 1 },
                            },
                            hovertemplate: '%{y}<br>%{x:,}<extra></extra>',
                        }]}
                        layout={{
                            ...commonLayout,
                            title: {
                                text: copy.annotationScale,
                                x: 0.02,
                                font: { size: 13, color: theme.palette.text.primary },
                            },
                            xaxis: {
                                rangemode: 'tozero',
                                title: { text: copy.countAxisLabel, font: { size: 11, color: theme.palette.text.secondary } },
                                tickfont: { size: 10, color: theme.palette.text.secondary },
                                gridcolor: chartTokens.gridColor,
                                zeroline: false,
                                fixedrange: true,
                            },
                        }}
                        config={config}
                        useResizeHandler
                        style={plotSx}
                    />
                </Box>
            </Box>

            <Box
                sx={{
                    minWidth: 0,
                    p: 1.25,
                    borderRadius: 1,
                    border: `1px solid ${theme.custom.border.soft}`,
                    bgcolor: theme.custom.surface.subtle,
                }}
            >
                <Typography variant="subtitle2" sx={sectionTitleSx(theme, { mb: 0.45 })}>
                    {copy.summaryTitle}
                </Typography>
                <Typography variant="body2" sx={captionSx(theme, { mb: 1 })}>
                    {copy.summaryBody}
                </Typography>
                {[...catalogItems, ...annotationItems].map((item) => (
                    <SummaryRow key={item.key} item={item} stats={stats} />
                ))}
            </Box>
        </Box>
    );
}

export default function AboutDataStatistics({ copy }) {
    const theme = useTheme();
    const [stats, setStats] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        getHomeStats()
            .then((payload) => {
                if (cancelled) return;
                setStats(payload || {});
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err);
                setStats(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const metricItems = METRIC_KEYS.map((key) => ({
        ...copy.metrics[key],
        ...METRIC_META[key],
        key,
    }));
    const metricMaxValue = Math.max(...metricItems.map((metric) => getRawValue(stats, metric.key)), 0);
    const supplementalItems = SUPPLEMENTAL_KEYS.map((key) => ({
        ...copy.supplemental.items[key],
        ...METRIC_META[key],
        key,
    }));
    const spanItems = [
        {
            icon: CalendarMonthOutlined,
            label: copy.studySpan.yearRange,
            value: buildRange(stats, copy.emptyValue),
        },
        {
            icon: CalendarMonthOutlined,
            label: copy.studySpan.latestCollectDate,
            value: formatDate(stats?.latestCollectDate, copy.emptyValue),
        },
        {
            icon: GroupsOutlined,
            label: copy.studySpan.populations,
            value: formatNumber(stats?.populations),
        },
        {
            icon: FolderOutlined,
            label: copy.studySpan.sourceBatches,
            value: formatNumber(stats?.sourceBatches),
        },
    ];

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.4, md: 1.8 },
                mb: 2,
                overflow: 'hidden',
                backgroundColor: theme.custom.surface.raised,
                boxShadow: '0 14px 36px rgba(15, 23, 42, 0.07)',
            })}
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 1.4 }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.35 })}>
                        {copy.title}
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme, { mb: 0, maxWidth: 760 })}>
                        {copy.body}
                    </Typography>
                </Box>
                <Chip
                    icon={<DatasetOutlined sx={{ fontSize: 16 }} />}
                    label={copy.chip}
                    size="small"
                    sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))}
                />
            </Stack>

            {error && (
                <Alert severity="error" sx={{ borderRadius: 1, mb: 1.4 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{copy.errorTitle}</Typography>
                    <Typography variant="body2">{getErrorMessage(error, copy.errorBody)}</Typography>
                </Alert>
            )}

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                    gap: 0.9,
                    mb: 1.2,
                }}
            >
                {loading
                    ? METRIC_KEYS.map((key) => <MetricSkeleton key={key} />)
                    : metricItems.map((item) => (
                        <MetricCard
                            key={item.key}
                            item={item}
                            stats={stats}
                            maxValue={metricMaxValue}
                        />
                    ))}
            </Box>

            {loading && (
                <Box sx={{ mb: 1.4 }}>
                    <Typography variant="subtitle2" sx={sectionTitleSx(theme, { mb: 0.75 })}>
                        {copy.supplemental.title}
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                            gap: 1,
                        }}
                    >
                        {SUPPLEMENTAL_KEYS.map((key) => <SupplementalSkeleton key={key} />)}
                    </Box>
                </Box>
            )}

            {loading && (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' },
                        gap: 1.4,
                    }}
                >
                    <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
                    <Skeleton variant="rectangular" height={360} sx={{ borderRadius: 1 }} />
                </Box>
            )}

            {!loading && !error && !hasStats(stats) && (
                <StatePanel
                    title={copy.emptyTitle}
                    message={copy.emptyBody}
                    minHeight={260}
                    framed={false}
                />
            )}

            {!loading && !error && hasStats(stats) && (
                <Stack spacing={1.4}>
                    <SupplementalCoveragePanel copy={copy.supplemental} stats={stats} items={supplementalItems} />
                    <CoverageChart copy={copy.chart} stats={stats} />
                    <DerivedStatsPanel copy={copy.derived} stats={stats} />
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                            gap: 1,
                        }}
                    >
                        {spanItems.map((item) => (
                            <SpanItem key={item.label} {...item} />
                        ))}
                    </Box>
                </Stack>
            )}
        </Paper>
    );
}
