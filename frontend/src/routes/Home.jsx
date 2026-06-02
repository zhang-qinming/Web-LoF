import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    ClickAwayListener,
    IconButton,
    InputAdornment,
    LinearProgress,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Paper,
    Skeleton,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    ArrowForward,
    Biotech,
    Close,
    FileDownload,
    Folder,
    Hub,
    InsertDriveFile,
    QueryStats,
    Search,
    Storage,
} from '@mui/icons-material';
import axios from 'axios';
import { downloadDataPaths } from '../utils/download';
import { captionSx, panelSx, summaryChipSx } from '../themeUtils';
import homeFigureCrossTraitHeatmap from '../assets/home-figure-cross-trait-heatmap.svg';
import homeFigureDataBrowser from '../assets/home-figure-data-browser.svg';
import homeFigureGwasManhattan from '../assets/home-figure-gwas-manhattan.svg';
import homeFigureLofGene from '../assets/home-figure-lof-gene.svg';
import homeFigureProgramScatter from '../assets/home-figure-program-scatter.svg';
import homeFigureTraitProgramNetwork from '../assets/home-figure-trait-program-network.svg';

const SEARCH_API = axios.create({ baseURL: '/api/data' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;
const accent = '#ff6b4a';
const siteName = 'TraitVista';
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
});

const loadingBarSx = {
    height: 3,
    bgcolor: 'rgba(226,232,240,0.72)',
    '& .MuiLinearProgress-bar': {
        background: 'linear-gradient(90deg, #2563eb, #0f766e)',
    },
};

const shimmerSx = {
    position: 'relative',
    overflow: 'hidden',
    '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        transform: 'translateX(-100%)',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
        animation: 'homeDataShimmer 1.25s ease-in-out infinite',
    },
    '@keyframes homeDataShimmer': {
        '100%': { transform: 'translateX(100%)' },
    },
};

const moduleCards = [
    {
        title: 'Trait Explorer',
        label: 'Manhattan',
        description: 'Open trait metadata and SNP-level GWAS Manhattan views.',
        image: homeFigureGwasManhattan,
        to: '/trait',
        icon: QueryStats,
        color: '#2563eb',
    },
    {
        title: 'Cross-trait Heatmap',
        label: 'Trait comparison',
        description: 'Compare shared association structure across traits.',
        image: homeFigureCrossTraitHeatmap,
        to: '/trait?tab=cross-trait-heatmap',
        icon: QueryStats,
        color: '#c2410c',
    },
    {
        title: 'Gene Evidence',
        label: 'LoF genes',
        description: 'Move from locus signals to LoF-supported gene evidence.',
        image: homeFigureLofGene,
        to: '/genes',
        icon: Biotech,
        color: '#7c3aed',
    },
    {
        title: 'Trait-Program Network',
        label: 'Network',
        description: 'Review trait-program links and interpretable biological modules.',
        image: homeFigureTraitProgramNetwork,
        to: '/programs',
        icon: Hub,
        color: '#0f766e',
    },
    {
        title: 'Program Scatter',
        label: 'Program map',
        description: 'Inspect program-level enrichment and regulator context.',
        image: homeFigureProgramScatter,
        to: '/programs',
        icon: Hub,
        color: '#0284c7',
    },
    {
        title: 'Data Browser',
        label: 'Files',
        description: 'Inspect result directories and download curated outputs.',
        image: homeFigureDataBrowser,
        to: '/data',
        icon: Storage,
        color: '#b45309',
    },
];

const featureRows = [
    {
        title: 'Trait-level visualization',
        description: 'Manhattan plots provide the primary entry into trait-specific GWAS signals, metadata, and downstream evidence tabs.',
        image: homeFigureGwasManhattan,
        to: '/trait',
        chips: ['Manhattan plot', 'Trait metadata', 'Signal review'],
    },
    {
        title: 'Program-aware interpretation',
        description: 'Program scatter and trait-program networks connect association signals to broader biological modules and regulators.',
        image: homeFigureProgramScatter,
        to: '/programs',
        chips: ['cNMF programs', 'Regulators', 'Trait links'],
    },
    {
        title: 'Cross-trait context',
        description: 'Cross-trait heatmaps support fast comparison across phenotypes and help surface shared association structure.',
        image: homeFigureCrossTraitHeatmap,
        to: '/trait?tab=cross-trait-heatmap',
        chips: ['Trait clusters', 'Correlation', 'Evidence layers'],
    },
];

const quickSearchSeeds = ['manhattan', 'summary', 'network', 'metadata'];
const explorationScope = [
    'Trait metadata',
    'SNP association signals',
    'Gene-level LoF evidence',
    'Program interpretation',
    'Cross-trait context',
];

function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtCount(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return '-';
    return numberFormatter.format(numericValue);
}

function fmtMetricCount(value, compact = false) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return '-';
    return compact ? compactNumberFormatter.format(numericValue) : numberFormatter.format(numericValue);
}

function fmtYearRange(stats) {
    if (!stats?.minYear && !stats?.maxYear) return '-';
    if (stats.minYear && stats.maxYear && stats.minYear !== stats.maxYear) {
        return `${stats.minYear}-${stats.maxYear}`;
    }
    return String(stats.maxYear || stats.minYear);
}

function getCachedSearchResult(query) {
    const cached = SEARCH_CACHE.get(query);
    if (!cached) return null;
    if (Date.now() - cached.cachedAt > SEARCH_CACHE_TTL_MS) {
        SEARCH_CACHE.delete(query);
        return null;
    }
    return cached;
}

function getRequestErrorMessage(err, fallback) {
    return err.response?.data?.error || err.message || fallback;
}

function buildDataBrowserHref({ path = '', search = '' } = {}) {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    else if (search) params.set('search', search);
    const queryString = params.toString();
    return `/data${queryString ? `?${queryString}` : ''}`;
}

function SectionHeading({ kicker, title, align = 'center' }) {
    return (
        <Stack spacing={1.1} alignItems={align === 'center' ? 'center' : 'flex-start'}>
            <Typography
                sx={{
                    color: accent,
                    fontFamily: 'Georgia, Cambria, serif',
                    fontSize: { xs: '1.05rem', md: '1.22rem' },
                    fontWeight: 800,
                    lineHeight: 1.1,
                }}
            >
                {kicker}
            </Typography>
            <Typography
                component="h2"
                sx={{
                    color: '#1f2933',
                    fontFamily: 'Georgia, Cambria, serif',
                    fontSize: { xs: '2rem', md: '2.5rem' },
                    fontWeight: 800,
                    lineHeight: 1.08,
                    textAlign: align,
                }}
            >
                {title}
            </Typography>
            <Box sx={{ width: 108, height: 2, bgcolor: accent, mt: 0.45 }} />
        </Stack>
    );
}

function ModuleLauncher({ items, theme }) {
    return (
        <Box
            component="nav"
            aria-label="Analysis module launcher"
            sx={{
                ...panelSx(theme, {
                    p: { xs: 1.35, sm: 1.6, md: 1.8 },
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255,255,255,0.94)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 24px 60px rgba(15,23,42,0.1)',
                }),
            }}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                sx={{
                    px: { xs: 0.25, sm: 0.4 },
                    pb: 1.25,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
            >
                <Box>
                    <Typography sx={{ color: accent, fontSize: '0.72rem', fontWeight: 850, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                        Analysis modules
                    </Typography>
                    <Typography component="h2" sx={{ mt: 0.3, color: '#111827', fontFamily: 'Georgia, Cambria, serif', fontSize: { xs: '1.38rem', md: '1.62rem' }, fontWeight: 850, lineHeight: 1.12 }}>
                        Start from the view you need
                    </Typography>
                </Box>
                <Chip
                    label={`${items.length} analysis views`}
                    size="small"
                    sx={summaryChipSx(theme, {
                        bgcolor: alpha(theme.palette.primary.main, 0.07),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    })}
                />
            </Stack>
            <Box
                sx={{
                    pt: { xs: 1.5, sm: 1.65 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: { xs: 1.15, sm: 1.25 },
                }}
            >
                {items.map((item) => (
                    <ModuleCard key={item.title} item={item} compact />
                ))}
            </Box>
        </Box>
    );
}

function DataCoveragePanel({ error, loading, stats, theme }) {
    const metrics = [
        {
            label: 'GWAS traits',
            value: stats?.traits,
            icon: QueryStats,
            color: '#2563eb',
        },
        {
            label: 'Reported variants',
            value: stats?.variants,
            icon: Storage,
            color: '#0f766e',
            compact: true,
        },
        {
            label: 'Gene programs',
            value: stats?.programs,
            icon: Hub,
            color: '#7c3aed',
        },
        {
            label: 'Result files',
            value: stats?.dataOutputs,
            icon: InsertDriveFile,
            color: '#b45309',
        },
    ];

    return (
        <Box
            component="section"
            aria-label="Data coverage and exploration scope"
            sx={panelSx(theme, {
                width: '100%',
                maxWidth: 760,
                overflow: 'hidden',
                backgroundColor: '#fbfdff',
            })}
        >
            <Box
                sx={{
                    px: { xs: 1.4, sm: 1.65 },
                    py: 1.15,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.05fr) minmax(180px, 0.95fr)' },
                    gap: 1.25,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    background: 'linear-gradient(90deg, rgba(37,99,235,0.055), rgba(15,118,110,0.045))',
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        component="h2"
                        sx={{
                            color: '#111827',
                            fontFamily: 'Georgia, Cambria, serif',
                            fontSize: { xs: '1.16rem', sm: '1.28rem' },
                            fontWeight: 800,
                            lineHeight: 1.18,
                            mb: 0.35,
                        }}
                    >
                        Data Coverage
                    </Typography>
                    <Typography sx={{ color: '#4b5563', fontSize: '0.8rem', lineHeight: 1.42 }}>
                        GWAS metadata, SNP associations, LoF evidence, and program interpretation in one browser.
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: 'grid',
                        gap: 0.45,
                        alignContent: 'center',
                        color: '#475569',
                        fontSize: '0.74rem',
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: 'inherit', fontWeight: 750 }}>Year Range</Typography>
                        <Typography sx={{ fontSize: 'inherit', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                            {loading ? '-' : fmtYearRange(stats)}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: 'inherit', fontWeight: 750 }}>Source Batches</Typography>
                        <Typography sx={{ fontSize: 'inherit', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                            {loading ? '-' : fmtCount(stats?.sourceBatches)}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: 'inherit', fontWeight: 750 }}>Last Collected</Typography>
                        <Typography sx={{ fontSize: 'inherit', fontWeight: 800, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                            {loading ? '-' : (stats?.latestCollectDate || '-')}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
            >
                {metrics.map((metric, index) => {
                    const Icon = metric.icon;
                    return (
                        <Box
                            key={metric.label}
                            sx={{
                                minWidth: 0,
                                px: { xs: 1.4, sm: 1.5 },
                                py: 1.05,
                                borderRight: {
                                    xs: index % 2 === 0 ? `1px solid ${theme.custom.border.soft}` : 0,
                                    md: index < metrics.length - 1 ? `1px solid ${theme.custom.border.soft}` : 0,
                                },
                                borderBottom: {
                                    xs: index < 2 ? `1px solid ${theme.custom.border.soft}` : 0,
                                    md: 0,
                                },
                            }}
                        >
                            <Stack direction="row" spacing={0.9} alignItems="center">
                                <Box
                                    sx={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 1,
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: metric.color,
                                        bgcolor: alpha(metric.color, 0.08),
                                        flex: '0 0 auto',
                                    }}
                                    aria-hidden="true"
                                >
                                    <Icon sx={{ fontSize: 16 }} />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography
                                        sx={{
                                            color: '#111827',
                                            fontSize: { xs: '1.04rem', md: '0.98rem' },
                                            fontWeight: 850,
                                            lineHeight: 1.05,
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {loading ? <Skeleton variant="text" width={64} height={22} /> : fmtMetricCount(metric.value, metric.compact)}
                                    </Typography>
                                    <Typography sx={{ color: '#64748b', fontSize: '0.7rem', lineHeight: 1.2 }}>
                                        {metric.label}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                    );
                })}
            </Box>

            <Box sx={{ px: { xs: 1.4, sm: 1.65 }, py: 1.05 }}>
                <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                    {explorationScope.map((item) => (
                        <Chip
                            key={item}
                            label={item}
                            size="small"
                            sx={summaryChipSx(theme, {
                                bgcolor: '#fff',
                                color: '#334155',
                            })}
                        />
                    ))}
                </Stack>
                {error && (
                    <Typography sx={{ mt: 0.9, color: theme.palette.warning.dark, fontSize: '0.75rem', lineHeight: 1.45 }}>
                        Live coverage stats are unavailable; exploration modules remain accessible.
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

function SearchResultsPanel({
    canSearch,
    checked,
    checkedFiles,
    downloading,
    error,
    fileResults,
    folderResults,
    handleDownloadSelection,
    loading,
    meta,
    getResultsBrowserHref,
    panelOpen,
    results,
    resultsBrowserHref,
    setChecked,
    setError,
    theme,
    toggleAllFiles,
    toggleFile,
    trimmedQ,
}) {
    const allFilesChecked = fileResults.length > 0 && checkedFiles.length === fileResults.length;
    const someFilesChecked = checkedFiles.length > 0 && !allFilesChecked;
    const quickMatchSummary = meta.truncated ? `Top ${results.length} quick matches` : `${results.length} quick matches`;
    const indexedPathSummary = meta.totalCount === 0
        ? 'No indexed matches'
        : meta.totalCount === 1
        ? '1 indexed path matches'
        : `${fmtCount(meta.totalCount)} indexed paths match`;

    if (!panelOpen || !canSearch) return null;

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                right: 0,
                zIndex: 40,
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.98)',
                backdropFilter: 'blur(18px)',
            })}
        >
            {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
            <Box
                sx={{
                    px: 2,
                    py: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexWrap: 'wrap',
                    bgcolor: theme.custom.surface.subtle,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
                aria-live="polite"
            >
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                    <Chip label="File search only" size="small" sx={summaryChipSx(theme)} />
                    <Chip label={quickMatchSummary} size="small" sx={summaryChipSx(theme)} />
                    <Chip label={indexedPathSummary} size="small" sx={summaryChipSx(theme)} />
                    <Chip label={`${fileResults.length} files`} size="small" sx={summaryChipSx(theme)} />
                    {folderResults.length > 0 && (
                        <Chip label={`${folderResults.length} folders`} size="small" sx={summaryChipSx(theme)} />
                    )}
                </Stack>
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                    {checkedFiles.length > 0 && (
                        <>
                            <Chip
                                label={`${checkedFiles.length} selected`}
                                size="small"
                                color="primary"
                                onDelete={() => setChecked(new Set())}
                            />
                            <Button size="small" variant="contained" disabled={downloading} onClick={handleDownloadSelection}>
                                <FileDownload sx={{ fontSize: 16, mr: 0.5 }} />
                                {downloading ? 'Preparing...' : 'Download'}
                            </Button>
                        </>
                    )}
                    <Button
                        size="small"
                        variant="text"
                        endIcon={<ArrowForward sx={{ fontSize: 15 }} />}
                        component={RouterLink}
                        to={resultsBrowserHref}
                    >
                        Open full browser
                    </Button>
                </Stack>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mx: 2, mt: 1, borderRadius: 1 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ px: 2, py: 1.6 }}>
                    {[0, 1, 2, 3].map((item) => (
                        <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 0.5, py: 1 }}>
                            <Skeleton variant="rounded" width={16} height={16} sx={shimmerSx} />
                            <Skeleton variant="rounded" width={18} height={18} sx={shimmerSx} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Skeleton variant="text" width="50%" height={24} sx={shimmerSx} />
                                <Skeleton variant="text" width="82%" height={18} sx={shimmerSx} />
                            </Box>
                            <Skeleton variant="rounded" width={58} height={22} sx={shimmerSx} />
                        </Box>
                    ))}
                </Box>
            ) : results.length > 0 ? (
                <Box sx={{ maxHeight: { xs: 'min(46vh, 320px)', sm: 'min(50vh, 360px)' }, overflow: 'auto' }}>
                    <List disablePadding>
                        {fileResults.length > 0 && (
                            <>
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 0.8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        bgcolor: theme.custom.surface.subtle,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Checkbox
                                            size="small"
                                            checked={allFilesChecked}
                                            indeterminate={someFilesChecked}
                                            onChange={toggleAllFiles}
                                            inputProps={{ 'aria-label': allFilesChecked ? 'Deselect all listed files' : 'Select all listed files' }}
                                            sx={{ p: 0.2 }}
                                        />
                                        <Typography variant="overline" sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                                            Files
                                        </Typography>
                                    </Box>
                                </Box>
                                {fileResults.map((item, index) => {
                                    const checkboxId = `home-file-result-${index}`;

                                    return (
                                    <Box
                                        key={item.path}
                                        component="li"
                                        sx={{
                                            listStyle: 'none',
                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        }}
                                    >
                                        <Box
                                            component="label"
                                            htmlFor={checkboxId}
                                            sx={{
                                                px: 1.75,
                                                py: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.8,
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: theme.custom.surface.subtle },
                                            }}
                                        >
                                            <Checkbox
                                                id={checkboxId}
                                                size="small"
                                                sx={{ p: 0.3 }}
                                                checked={checked.has(item.path)}
                                                onChange={() => toggleFile(item.path)}
                                                inputProps={{ 'aria-label': `Select file ${item.name}` }}
                                            />
                                            <ListItemIcon sx={{ minWidth: 30 }}>
                                                <InsertDriveFile sx={{ fontSize: 17, color: '#94a3b8' }} />
                                            </ListItemIcon>
                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.84rem',
                                                        fontWeight: 600,
                                                        color: theme.palette.text.primary,
                                                    }}
                                                    title={item.name}
                                                >
                                                    {item.name}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.73rem',
                                                        color: theme.palette.text.secondary,
                                                        lineHeight: 1.35,
                                                    }}
                                                    noWrap
                                                    title={item.path}
                                                >
                                                    {item.path}
                                                </Typography>
                                            </Box>
                                            <Chip label={fmtSize(item.size) || 'file'} size="small" sx={summaryChipSx(theme)} />
                                        </Box>
                                    </Box>
                                    );
                                })}
                            </>
                        )}
                        {folderResults.length > 0 && (
                            <>
                                <Box sx={{ px: 2, py: 0.8, bgcolor: theme.custom.surface.subtle, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                                    <Typography variant="overline" sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                                        Folders
                                    </Typography>
                                </Box>
                                {folderResults.map((item) => (
                                    <ListItemButton
                                        key={item.path}
                                        component={RouterLink}
                                        to={getResultsBrowserHref({ path: item.path })}
                                        sx={{ px: 1.75, py: 1, textDecoration: 'none', color: 'inherit' }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 30 }}>
                                            <Folder sx={{ fontSize: 18, color: '#d97706' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                            secondary={item.path}
                                            primaryTypographyProps={{ fontSize: '0.84rem', fontWeight: 600 }}
                                            secondaryTypographyProps={{ fontSize: '0.73rem', noWrap: true }}
                                        />
                                        <Chip label="folder" size="small" sx={summaryChipSx(theme, { bgcolor: alpha(theme.palette.warning.main, 0.09) })} />
                                    </ListItemButton>
                                ))}
                            </>
                        )}
                    </List>
                </Box>
            ) : (
                <Box sx={{ px: 2, py: 2.2 }}>
                    <Typography sx={captionSx(theme, { fontSize: '0.86rem' })}>
                        No files or folders matched "{trimmedQ}".
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

function ModuleCard({ item, compact = false }) {
    const Icon = item.icon;
    const titleId = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-card-title`;

    return (
        <Box
            component={RouterLink}
            to={item.to}
            aria-labelledby={titleId}
            sx={{
                minHeight: compact ? { xs: 188, sm: 202, md: 210 } : 320,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                px: compact ? { xs: 1.25, sm: 1.35 } : 2.2,
                py: compact ? { xs: 1.25, sm: 1.45 } : 2.5,
                borderRadius: 1,
                bgcolor: '#fff',
                border: '1px solid rgba(226,232,240,0.72)',
                boxShadow: compact ? '0 8px 22px rgba(15,23,42,0.06)' : '0 12px 34px rgba(15,23,42,0.08)',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                '&:hover': {
                    transform: compact ? 'translateY(-3px)' : 'translateY(-6px)',
                    borderColor: alpha(item.color, 0.28),
                    boxShadow: compact ? `0 14px 30px ${alpha(item.color, 0.14)}` : `0 20px 44px ${alpha(item.color, 0.16)}`,
                },
                '&:focus-visible': {
                    outline: `3px solid ${alpha(item.color, 0.24)}`,
                    outlineOffset: 3,
                },
            }}
        >
            <Box
                sx={{
                    width: '100%',
                    height: compact ? { xs: 88, sm: 98, md: 106 } : 150,
                    display: 'grid',
                    placeItems: 'center',
                    mb: compact ? 1.2 : 2,
                    bgcolor: compact ? alpha(item.color, 0.035) : 'transparent',
                    borderRadius: compact ? 1 : 0,
                    overflow: 'hidden',
                    p: compact ? 0.8 : 0,
                }}
            >
                <Box
                    component="img"
                    src={item.image}
                    alt=""
                    sx={{
                        width: '100%',
                        height: '100%',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: 'block',
                    }}
                />
            </Box>
            <Stack direction="row" spacing={0.65} alignItems="center" sx={{ mb: compact ? 0.45 : 1, minWidth: 0 }}>
                <Icon sx={{ color: item.color, fontSize: compact ? 17 : 19, flex: '0 0 auto' }} />
                <Typography id={titleId} component="h3" sx={{ color: '#111827', fontSize: compact ? '0.9rem' : '1.02rem', fontWeight: 800, lineHeight: 1.2 }}>
                    {item.title}
                </Typography>
            </Stack>
            {compact && (
                <Typography sx={{ color: item.color, fontSize: '0.68rem', fontWeight: 850, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.35 }}>
                    {item.label}
                </Typography>
            )}
            <Typography
                sx={{
                    color: '#5b6472',
                    fontSize: compact ? '0.78rem' : '0.88rem',
                    lineHeight: compact ? 1.42 : 1.6,
                    mb: compact ? 1 : 1.6,
                    ...(compact && {
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                    }),
                }}
            >
                {item.description}
            </Typography>
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 'auto', color: item.color }}>
                <Typography component="span" sx={{ fontSize: compact ? '0.76rem' : '0.84rem', fontWeight: 800, color: 'inherit' }}>
                    {compact ? 'Open' : 'Open module'}
                </Typography>
                <ArrowForward sx={{ fontSize: compact ? 14 : 16 }} />
            </Stack>
        </Box>
    );
}

function FeaturePanel({ item, reverse }) {
    return (
        <Box
            component="article"
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: reverse ? '0.95fr 1.05fr' : '1.05fr 0.95fr' },
                gap: { xs: 3, md: 5 },
                alignItems: 'center',
                py: { xs: 4, md: 5 },
            }}
        >
            <Box sx={{ order: { xs: 1, md: reverse ? 2 : 1 } }}>
                <SectionHeading kicker="Analysis View" title={item.title} align="left" />
                <Typography sx={{ mt: 2.2, color: '#4b5563', fontSize: { xs: '1rem', md: '1.05rem' }, lineHeight: 1.85, maxWidth: 650 }}>
                    {item.description}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2.2 }}>
                    {item.chips.map((chip) => (
                        <Chip
                            key={chip}
                            label={chip}
                            size="small"
                            sx={{ bgcolor: '#fff7f4', color: '#9b341f', border: '1px solid #ffd3c7', fontWeight: 700 }}
                        />
                    ))}
                </Stack>
                <Button
                    variant="outlined"
                    endIcon={<ArrowForward />}
                    component={RouterLink}
                    to={item.to}
                    sx={{ mt: 2.5, color: accent, borderColor: alpha(accent, 0.5) }}
                >
                    Explore view
                </Button>
            </Box>
            <Box
                sx={{
                    order: { xs: 2, md: reverse ? 1 : 2 },
                    borderRadius: 1,
                    bgcolor: '#fff',
                    border: '1px solid rgba(226,232,240,0.8)',
                    boxShadow: '0 16px 40px rgba(15,23,42,0.08)',
                    p: { xs: 1.5, md: 2 },
                }}
            >
                <Box component="img" src={item.image} alt={`${item.title} preview`} sx={{ width: '100%', aspectRatio: '1.55 / 1', objectFit: 'contain', display: 'block' }} />
            </Box>
        </Box>
    );
}

function Home() {
    const navigate = useNavigate();
    const theme = useTheme();
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [meta, setMeta] = useState({ totalCount: 0, truncated: false });
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [checked, setChecked] = useState(new Set());
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [homeStats, setHomeStats] = useState(null);
    const [homeStatsError, setHomeStatsError] = useState('');

    const trimmedQ = q.trim();
    const canSearch = trimmedQ.length >= 2;
    const homeStatsLoading = !homeStats && !homeStatsError;
    const fileResults = useMemo(() => results.filter((item) => item.type === 'file'), [results]);
    const folderResults = useMemo(() => results.filter((item) => item.type === 'dir'), [results]);
    const checkedFiles = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)).map((item) => item.path),
        [checked, fileResults],
    );
    const panelOpen = open && canSearch;
    const resultsBrowserHref = buildDataBrowserHref({ search: trimmedQ });

    useEffect(() => {
        let cancelled = false;

        axios.get('/api/home/stats')
            .then((response) => {
                if (cancelled) return;
                setHomeStats(response.data || {});
                setHomeStatsError('');
            })
            .catch((err) => {
                if (cancelled) return;
                setHomeStats(null);
                setHomeStatsError(getRequestErrorMessage(err, 'Stats failed'));
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!canSearch) {
            setResults([]);
            setMeta({ totalCount: 0, truncated: false });
            setLoading(false);
            return undefined;
        }

        const cached = getCachedSearchResult(trimmedQ);
        if (cached) {
            setResults(cached.results);
            setMeta(cached.meta);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const response = await SEARCH_API.get('/search', { params: { q: trimmedQ, limit: 12 } });
                if (cancelled) return;
                const payload = {
                    results: response.data?.results || [],
                    meta: {
                        totalCount: response.data?.totalCount || 0,
                        truncated: Boolean(response.data?.truncated),
                    },
                };
                SEARCH_CACHE.set(trimmedQ, { ...payload, cachedAt: Date.now() });
                setResults(payload.results);
                setMeta(payload.meta);
            } catch (err) {
                if (!cancelled) {
                    setResults([]);
                    setMeta({ totalCount: 0, truncated: false });
                    setError(getRequestErrorMessage(err, 'Search failed'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [canSearch, trimmedQ]);

    const toggleFile = (path) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const toggleAllFiles = () => {
        setChecked((prev) => {
            const next = new Set(prev);
            const allChecked = fileResults.length > 0 && fileResults.every((item) => next.has(item.path));
            fileResults.forEach((item) => {
                if (allChecked) next.delete(item.path);
                else next.add(item.path);
            });
            return next;
        });
    };

    const openResultsInBrowser = (path = '') => {
        navigate(buildDataBrowserHref({ path, search: trimmedQ }));
    };

    const getResultsBrowserHref = ({ path = '' } = {}) => {
        return buildDataBrowserHref({ path, search: trimmedQ });
    };

    const handleDownloadSelection = async () => {
        if (checkedFiles.length === 0) return;
        setDownloading(true);
        setError('');
        try {
            await downloadDataPaths(checkedFiles);
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    const clearSearch = () => {
        setQ('');
        setOpen(false);
        setResults([]);
        setMeta({ totalCount: 0, truncated: false });
        setChecked(new Set());
        setError('');
    };

    return (
        <Box sx={{ width: '100%', color: '#1f2933', bgcolor: '#f7fafc', mx: 'auto', pb: { xs: 6, md: 8 } }}>
            <Box
                component="section"
                sx={{
                    maxWidth: 1240,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4 },
                    pt: { xs: 5.5, md: 6.5 },
                    pb: { xs: 4.5, md: 5.5 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '0.82fr 1.18fr' },
                    gap: { xs: 3.5, lg: 4.5 },
                    alignItems: 'start',
                }}
            >
                <Stack spacing={2.35} alignItems="flex-start">
                    <Box>
                        <Typography sx={{ color: accent, fontFamily: 'Georgia, Cambria, serif', fontSize: { xs: '1.35rem', md: '1.6rem' }, fontWeight: 800, lineHeight: 1.12, mb: 1.2 }}>
                            Welcome to
                        </Typography>
                        <Typography
                            component="h1"
                            sx={{
                                color: '#2a2d33',
                                fontFamily: 'Georgia, Cambria, serif',
                                fontSize: { xs: '3rem', sm: '4rem', md: '4.8rem' },
                                fontWeight: 800,
                                lineHeight: 0.98,
                                letterSpacing: 0,
                            }}
                        >
                            {siteName}
                        </Typography>
                    </Box>
                    <Typography
                        sx={{
                            maxWidth: 690,
                            color: '#3f4752',
                            fontFamily: 'Georgia, Cambria, serif',
                            fontSize: { xs: '1.05rem', md: '1.17rem' },
                            lineHeight: 1.8,
                            wordSpacing: '0.1em',
                        }}
                    >
                        {siteName} is a comprehensive atlas for browsing, searching, visualizing, and downloading
                        genome-wide association results. It connects trait metadata, SNP-level association data,
                        gene evidence, and program-level interpretation for fast cross-layer exploration.
                    </Typography>
                    <Stack direction="row" spacing={1.4} useFlexGap flexWrap="wrap">
                        <Button
                            variant="outlined"
                            size="large"
                            component={RouterLink}
                            to="/trait"
                            sx={{ px: 3, py: 1.15, borderRadius: 999, color: accent, borderColor: accent }}
                        >
                            Explore Traits
                        </Button>
                        <Button
                            variant="contained"
                            size="large"
                            endIcon={<ArrowForward />}
                            component={RouterLink}
                            to="/data"
                            sx={{ px: 3, py: 1.15, borderRadius: 999, bgcolor: '#1f2933', '&:hover': { bgcolor: '#111827' } }}
                        >
                            Open Data Browser
                        </Button>
                    </Stack>

                    <DataCoveragePanel
                        error={homeStatsError}
                        loading={homeStatsLoading}
                        stats={homeStats}
                        theme={theme}
                    />
                </Stack>
                <ModuleLauncher items={moduleCards} theme={theme} />
            </Box>

            <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 4.5, md: 6.5 } }}>
                <Box sx={panelSx(theme, { p: { xs: 1.25, sm: 1.45 }, width: '100%', backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)' })}>
                    <Stack spacing={1.1}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Box>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.palette.secondary.dark }}>
                                    Result file search
                                </Typography>
                                <Typography sx={{ mt: 0.45, color: '#4b5563', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                    Search indexed result files and folders only. Use Trait Explorer for trait-level GWAS lookup.
                                </Typography>
                            </Box>
                            <Button
                                size="small"
                                variant="text"
                                endIcon={<ArrowForward sx={{ fontSize: 15 }} />}
                                component={RouterLink}
                                to="/trait"
                                sx={{ whiteSpace: 'nowrap', px: 0 }}
                            >
                                Trait lookup
                            </Button>
                        </Stack>
                        <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                            {quickSearchSeeds.map((label) => (
                                <Chip
                                    key={label}
                                    label={label}
                                    onClick={() => {
                                        setQ(label);
                                        setOpen(true);
                                    }}
                                    sx={summaryChipSx(theme, {
                                        cursor: 'pointer',
                                        backgroundColor: alpha(theme.palette.primary.main, 0.07),
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                                    })}
                                />
                            ))}
                        </Stack>
                        <ClickAwayListener onClickAway={() => setOpen(false)}>
                            <Box sx={{ position: 'relative' }}>
                                <TextField
                                    fullWidth
                                    placeholder="Search result files or folders"
                                    aria-label="Search result files and folders"
                                    value={q}
                                    onChange={(event) => {
                                        setQ(event.target.value);
                                        setOpen(true);
                                    }}
                                    onFocus={() => {
                                        if (canSearch) setOpen(true);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') setOpen(false);
                                        if (event.key === 'Enter' && canSearch) {
                                            event.preventDefault();
                                            openResultsInBrowser();
                                        }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search sx={{ color: '#64748b', fontSize: 20 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: loading
                                            ? <CircularProgress size={18} sx={{ mr: 1 }} />
                                            : (q && (
                                                <IconButton size="small" aria-label="Clear file search" onClick={clearSearch}>
                                                    <Close fontSize="small" />
                                                </IconButton>
                                            )),
                                    }}
                                />
                                <SearchResultsPanel
                                    canSearch={canSearch}
                                    checked={checked}
                                    checkedFiles={checkedFiles}
                                    downloading={downloading}
                                    error={error}
                                    fileResults={fileResults}
                                    folderResults={folderResults}
                                    handleDownloadSelection={handleDownloadSelection}
                                    getResultsBrowserHref={getResultsBrowserHref}
                                    loading={loading}
                                    meta={meta}
                                    panelOpen={panelOpen}
                                    results={results}
                                    resultsBrowserHref={resultsBrowserHref}
                                    setChecked={setChecked}
                                    setError={setError}
                                    theme={theme}
                                    toggleAllFiles={toggleAllFiles}
                                    toggleFile={toggleFile}
                                    trimmedQ={trimmedQ}
                                />
                            </Box>
                        </ClickAwayListener>
                    </Stack>
                </Box>
            </Box>

            <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 4, md: 7 } }}>
                <SectionHeading kicker="Explore" title="Integrated Association Workflows" />
                <Stack spacing={{ xs: 1, md: 2.5 }} sx={{ mt: { xs: 3, md: 5 } }}>
                    {featureRows.map((item, index) => (
                        <FeaturePanel key={item.title} item={item} reverse={index % 2 === 1} />
                    ))}
                </Stack>
            </Box>
        </Box>
    );
}

export default Home;
