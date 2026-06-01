import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CardActionArea,
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
    Dns,
    FileDownload,
    Folder,
    Hub,
    InsertDriveFile,
    Polyline,
    QueryStats,
    Search,
    Storage,
} from '@mui/icons-material';
import axios from 'axios';
import { downloadDataPaths } from '../utils/download';
import { captionSx, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';
import homeThumbCrossHeatmap from '../assets/home-thumb-cross-heatmap.png';
import homeThumbDataBrowser from '../assets/home-thumb-data-browser.png';
import homeThumbGeneEvidence from '../assets/home-thumb-gene-evidence.png';
import homeThumbProgramScatter from '../assets/home-thumb-program-scatter.png';
import homeThumbTraitGraph from '../assets/home-thumb-trait-graph.png';

const SEARCH_API = axios.create({ baseURL: '/api/data' });
const HOME_API = axios.create({ baseURL: '/api' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;

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

const heroStatsConfig = [
    {
        key: 'traits',
        label: 'Traits indexed',
        hint: 'phenotypes',
        tone: '#2563eb',
    },
    {
        key: 'programs',
        label: 'Programs linked',
        hint: 'modules',
        tone: '#0f766e',
    },
    {
        key: 'dataOutputs',
        label: 'Outputs archived',
        hint: 'files',
        tone: '#b45309',
    },
];

const moduleCards = [
    {
        key: 'genes',
        step: '01',
        title: 'Gene evidence',
        description: 'Start from LoF-supported genes and inspect the primary evidence layer.',
        image: homeThumbGeneEvidence,
        to: '/genes',
        icon: Biotech,
        color: '#7c3aed',
        metricFallback: 'gene-level views',
    },
    {
        key: 'programs',
        step: '02',
        title: 'Program browser',
        description: 'Track regulator hits into aggregated gene programs and network views.',
        image: homeThumbTraitGraph,
        to: '/programs',
        icon: Hub,
        color: '#0f766e',
        statKey: 'programs',
        metricLabel: 'programs linked',
    },
    {
        key: 'traits',
        step: '03',
        title: 'Trait browser',
        description: 'Move from program structure into trait-level association patterns.',
        image: homeThumbCrossHeatmap,
        to: '/trait',
        icon: QueryStats,
        color: '#2563eb',
        statKey: 'traits',
        metricLabel: 'traits indexed',
    },
    {
        key: 'data',
        step: '04',
        title: 'Data browser',
        description: 'Retrieve result files after deciding which biological layer to export.',
        image: homeThumbDataBrowser,
        to: '/data',
        icon: Storage,
        color: '#b45309',
        statKey: 'dataOutputs',
        metricLabel: 'outputs indexed',
    },
];

const researchFlowPanels = [
    {
        key: 'lof',
        step: '01',
        eyebrow: 'LoF genes',
        title: 'LoF gene evidence',
        description: 'Loss-of-function genes define the entry set before any program-level aggregation.',
        accent: '#7c3aed',
        to: '/genes',
    },
    {
        key: 'regulator',
        step: '02',
        eyebrow: 'Regulators',
        title: 'Perturb-seq regulator screen',
        description: 'Regulator hits connect causal genes to shared expression responses.',
        accent: '#d97706',
        to: '/programs',
    },
    {
        key: 'program',
        step: '03',
        eyebrow: 'Programs',
        title: 'Program aggregation',
        description: 'Program-level structure consolidates regulator effects into interpretable modules.',
        accent: '#0f766e',
        to: '/programs',
    },
    {
        key: 'trait',
        step: '04',
        eyebrow: 'Traits',
        title: 'Trait association',
        description: 'Trait views expose which programs align with phenotype-level association signals.',
        accent: '#2563eb',
        to: '/trait',
    },
];

const outputPreviewTiles = [
    {
        key: 'trait-view',
        label: 'Trait association',
        image: homeThumbCrossHeatmap,
        ratio: '1 / 0.48',
        accent: '#2563eb',
        wide: true,
    },
    {
        key: 'gene-view',
        label: 'Gene evidence',
        image: homeThumbGeneEvidence,
        ratio: '1 / 0.7',
        accent: '#7c3aed',
    },
    {
        key: 'program-view',
        label: 'Program network',
        image: homeThumbTraitGraph,
        ratio: '1 / 0.7',
        accent: '#0f766e',
    },
    {
        key: 'file-view',
        label: 'Data archive',
        image: homeThumbDataBrowser,
        ratio: '1 / 0.44',
        accent: '#b45309',
        wide: true,
    },
];

const workflowHighlights = [
    {
        icon: <Dns sx={{ fontSize: 18 }} />,
        title: 'Trait record',
        description: 'Anchor the query in phenotype metadata and GWAS context.',
    },
    {
        icon: <Polyline sx={{ fontSize: 18 }} />,
        title: 'Signal filter',
        description: 'Constrain loci before expanding into gene and program evidence.',
    },
    {
        icon: <Hub sx={{ fontSize: 18 }} />,
        title: 'Program context',
        description: 'Follow regulator-to-program structure instead of isolated hits.',
    },
    {
        icon: <Storage sx={{ fontSize: 18 }} />,
        title: 'Export package',
        description: 'Keep derived figures and tables aligned with the same route.',
    },
];

const FIGURE_PREVIEW_MAP = {
    'program-scatter': {
        image: homeThumbProgramScatter,
        label: 'Program scatter',
    },
    'trait-program-graph': {
        image: homeThumbTraitGraph,
        label: 'Trait-program graph',
    },
    'cross-trait-heatmap': {
        image: homeThumbCrossHeatmap,
        label: 'Cross-trait heatmap',
    },
};

const featuredTrait = {
    fileId: 'GCST90083707',
    gwasId: 'MR08330',
    traitName: 'Diagnoses - secondary ICD10: E03.9 Hypothyroidism, unspecified',
    summary: 'A representative entry with linked signal and cross-trait views.',
    nSig: 8931,
    qqDeviation: '2.552',
    evidence: [
        { label: 'Program scatter', tab: 'program-scatter' },
        { label: 'Trait-program graph', tab: 'trait-program-graph' },
        { label: 'Cross-trait heatmap', tab: 'cross-trait-heatmap' },
    ],
    tone: {
        glow: 'rgba(37, 99, 235, 0.16)',
        line: '#2563eb',
    },
};

function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
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

function cleanTraitName(value) {
    return String(value || '').replace(/^"|"$/g, '');
}

function getFeaturedTraitRoute(trait, tabKey = '') {
    const target = cleanTraitName(trait?.fileId || trait?.gwasId || trait?.traitName);
    if (!target) return '/trait';
    const params = new URLSearchParams();
    if (tabKey) params.set('tab', tabKey);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return `/trait/${encodeURIComponent(target)}${suffix}`;
}

function getTraitPreview(tabKey) {
    return FIGURE_PREVIEW_MAP[tabKey] || null;
}

function getFeaturedTraitCoverImage(trait) {
    const preferredTabs = ['cross-trait-heatmap', 'trait-program-graph', 'program-scatter'];
    const match = preferredTabs
        .map((tabKey) => trait?.evidence?.find((item) => item.tab === tabKey))
        .find(Boolean);
    return getTraitPreview(match?.tab || trait?.evidence?.[0]?.tab)?.image || homeThumbCrossHeatmap;
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
    handleSelect,
    loading,
    meta,
    openResultsInBrowser,
    panelOpen,
    results,
    setChecked,
    setDownloading,
    setError,
    theme,
    toggleAllFiles,
    toggleFile,
    trimmedQ,
}) {
    const allFilesChecked = fileResults.length > 0 && checkedFiles.length === fileResults.length;
    const someFilesChecked = checkedFiles.length > 0 && !allFilesChecked;
    const resultsSummary = meta.truncated
        ? `Showing ${results.length} of ${meta.totalCount} matches`
        : `${meta.totalCount} matches`;

    if (!panelOpen || !canSearch) return null;

    return (
        <Paper
            elevation={0}
            sx={{
                ...panelSx(theme, {
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255,255,255,0.98)',
                    backdropFilter: 'blur(18px)',
                }),
            }}
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
            >
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                    <Chip label={resultsSummary} size="small" sx={summaryChipSx(theme)} />
                    <Chip
                        label={`${fileResults.length} files`}
                        size="small"
                        sx={summaryChipSx(theme, {
                            color: theme.palette.primary.dark,
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        })}
                    />
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
                            <Button
                                size="small"
                                variant="contained"
                                disabled={downloading}
                                onClick={() => {
                                    void handleDownloadSelection();
                                }}
                            >
                                <FileDownload sx={{ fontSize: 16, mr: 0.5 }} />
                                {downloading ? 'Preparing...' : 'Download'}
                            </Button>
                        </>
                    )}
                    <Button
                        size="small"
                        variant="text"
                        endIcon={<ArrowForward sx={{ fontSize: 15 }} />}
                        onClick={openResultsInBrowser}
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
                        <Box
                            key={item}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.2,
                                px: 0.5,
                                py: 1,
                            }}
                        >
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
                <Box sx={{ maxHeight: 520, overflow: 'auto' }}>
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
                                            sx={{ p: 0.2 }}
                                        />
                                        <Typography
                                            variant="overline"
                                            sx={{
                                                fontWeight: 700,
                                                color: theme.palette.text.secondary,
                                                letterSpacing: '0.08em',
                                            }}
                                        >
                                            Files
                                        </Typography>
                                    </Box>
                                </Box>
                                {fileResults.map((item) => (
                                    <ListItemButton
                                        key={item.path}
                                        onClick={() => handleSelect(item)}
                                        sx={{
                                            px: 1.75,
                                            py: 1,
                                            alignItems: 'center',
                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                            transition: `background-color ${theme.custom.motion.swift}`,
                                            '&:hover': { bgcolor: theme.custom.surface.subtle },
                                        }}
                                    >
                                        <Checkbox
                                            size="small"
                                            sx={{ p: 0.3, mr: 0.8 }}
                                            checked={checked.has(item.path)}
                                            onChange={(event) => {
                                                event.stopPropagation();
                                                toggleFile(item.path);
                                            }}
                                            onClick={(event) => event.stopPropagation()}
                                        />
                                        <ListItemIcon sx={{ minWidth: 30 }}>
                                            <InsertDriveFile sx={{ fontSize: 17, color: '#94a3b8' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                            secondary={item.path}
                                            primaryTypographyProps={{
                                                fontSize: '0.84rem',
                                                fontWeight: 600,
                                                color: theme.palette.text.primary,
                                                title: item.name,
                                            }}
                                            secondaryTypographyProps={{
                                                fontSize: '0.73rem',
                                                color: theme.palette.text.secondary,
                                                noWrap: true,
                                                title: item.path,
                                            }}
                                        />
                                        <Stack direction="row" spacing={0.7} alignItems="center">
                                            <Chip label={fmtSize(item.size)} size="small" sx={summaryChipSx(theme)} />
                                            <IconButton
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setDownloading(true);
                                                    setError('');
                                                    downloadDataPaths([item.path], { zipThreshold: 1 })
                                                        .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                        .finally(() => setDownloading(false));
                                                }}
                                                sx={{
                                                    color: theme.palette.primary.dark,
                                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                                                }}
                                            >
                                                <FileDownload sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Stack>
                                    </ListItemButton>
                                ))}
                            </>
                        )}

                        {folderResults.length > 0 && (
                            <>
                                <Box
                                    sx={{
                                        px: 2,
                                        py: 0.8,
                                        bgcolor: theme.custom.surface.subtle,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                    }}
                                >
                                    <Typography
                                        variant="overline"
                                        sx={{
                                            fontWeight: 700,
                                            color: theme.palette.text.secondary,
                                            letterSpacing: '0.08em',
                                        }}
                                    >
                                        Folders
                                    </Typography>
                                </Box>
                                {folderResults.map((item) => (
                                    <ListItemButton
                                        key={item.path}
                                        onClick={() => handleSelect(item)}
                                        sx={{
                                            px: 1.75,
                                            py: 1,
                                            alignItems: 'center',
                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                            transition: `background-color ${theme.custom.motion.swift}`,
                                            '&:hover': { bgcolor: theme.custom.surface.subtle },
                                        }}
                                    >
                                        <Box sx={{ width: 30, mr: 0.8 }} />
                                        <ListItemIcon sx={{ minWidth: 30 }}>
                                            <Folder sx={{ fontSize: 18, color: '#6b9fd4' }} />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                            secondary={item.path}
                                            primaryTypographyProps={{
                                                fontSize: '0.84rem',
                                                fontWeight: 600,
                                                color: theme.palette.text.primary,
                                                title: item.name,
                                            }}
                                            secondaryTypographyProps={{
                                                fontSize: '0.73rem',
                                                color: theme.palette.text.secondary,
                                                noWrap: true,
                                                title: item.path,
                                            }}
                                        />
                                        <Stack direction="row" spacing={0.7} alignItems="center">
                                            <Chip label="Open folder" size="small" sx={summaryChipSx(theme)} />
                                            <IconButton
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setDownloading(true);
                                                    setError('');
                                                    downloadDataPaths([item.path], {
                                                        filename: `${item.name || 'folder'}.zip`,
                                                        zipThreshold: 0,
                                                    })
                                                        .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                        .finally(() => setDownloading(false));
                                                }}
                                                sx={{
                                                    color: theme.palette.warning.main,
                                                    '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.08) },
                                                }}
                                            >
                                                <FileDownload sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Stack>
                                    </ListItemButton>
                                ))}
                            </>
                        )}
                    </List>
                </Box>
            ) : (
                <Box
                    sx={{
                        px: 2.5,
                        py: 4.5,
                        textAlign: 'center',
                    }}
                >
                    <Search sx={{ fontSize: 30, color: '#cbd5e1', mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary, mb: 0.5 }}>
                        No matches for "{trimmedQ}"
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        Try a shorter filename fragment, a GCST accession, or continue in the full Data Browser.
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

function SectionHeading({ eyebrow, title, description, align = 'left' }) {
    const theme = useTheme();
    const centered = align === 'center';

    return (
        <Stack
            spacing={0.6}
            alignItems={centered ? 'center' : 'flex-start'}
            sx={{
                textAlign: centered ? 'center' : 'left',
                maxWidth: centered ? 760 : 680,
                mx: centered ? 'auto' : 0,
            }}
        >
            <Typography
                sx={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: theme.palette.primary.dark,
                }}
            >
                {eyebrow}
            </Typography>
            <Typography
                sx={sectionTitleSx(theme, {
                    fontSize: { xs: '1.6rem', md: '2.1rem' },
                    lineHeight: 1.04,
                    maxWidth: centered ? 740 : 620,
                })}
            >
                {title}
            </Typography>
            {description && (
                <Typography
                    sx={captionSx(theme, {
                        maxWidth: centered ? 700 : 620,
                        fontSize: { xs: '0.92rem', md: '0.95rem' },
                    })}
                >
                    {description}
                </Typography>
            )}
        </Stack>
    );
}

function HeroMetricCard({ hint, label, loading, tone, value }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                ...panelSx(theme, {
                    p: 1.15,
                    backgroundColor: 'rgba(255,255,255,0.88)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: `0 18px 32px ${alpha(tone, 0.1)}`,
                    borderColor: alpha(tone, 0.14),
                }),
            }}
        >
            <Stack spacing={0.45}>
                <Typography
                    sx={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: alpha(tone, 0.92),
                    }}
                >
                    {label}
                </Typography>
                <Typography
                    sx={{
                        fontSize: { xs: '1.34rem', md: '1.55rem' },
                        fontWeight: 760,
                        color: theme.palette.text.primary,
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {loading ? (
                        <Skeleton variant="text" width={72} height={28} sx={{ transform: 'none', bgcolor: alpha(tone, 0.12) }} />
                    ) : (
                        value.toLocaleString()
                    )}
                </Typography>
                <Typography sx={{ fontSize: '0.76rem', color: theme.palette.text.secondary }}>
                    {hint}
                </Typography>
            </Stack>
        </Box>
    );
}

function SignalLandscapeFigure({ compact = false }) {
    const theme = useTheme();
    const width = 560;
    const height = compact ? 210 : 238;
    const baseY = compact ? 168 : 188;
    const barHeights = Array.from({ length: 44 }, (_, index) => (
        24 + Math.abs(Math.sin(index * 0.39)) * 74 + (index % 9 === 0 ? 20 : 0)
    ));
    const colors = [
        theme.palette.primary.main,
        theme.custom.chart.regulator,
        theme.palette.warning.main,
    ];
    const linePoints = Array.from({ length: 33 }, (_, index) => {
        const x = 48 + index * 14.6;
        const y = baseY - (Math.sin(index * 0.38) * 34 + Math.cos(index * 0.17) * 18);
        return `${x},${y.toFixed(2)}`;
    }).join(' ');

    return (
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: '100%', display: 'block' }}>
            <rect x="0" y="0" width={width} height={height} fill="transparent" />
            <line x1="32" y1="20" x2="32" y2={baseY + 14} stroke={alpha(theme.palette.text.secondary, 0.24)} strokeWidth="2" />
            <line x1="32" y1={baseY + 14} x2={width - 18} y2={baseY + 14} stroke={alpha(theme.palette.text.secondary, 0.24)} strokeWidth="2" />
            <line
                x1="32"
                y1={compact ? 96 : 108}
                x2={width - 18}
                y2={compact ? 96 : 108}
                stroke={alpha(theme.palette.warning.main, 0.18)}
                strokeDasharray="6 6"
            />
            {barHeights.map((barHeight, index) => {
                const x = 48 + index * 10.8;
                const color = colors[index % colors.length];
                return (
                    <rect
                        key={x}
                        x={x}
                        y={baseY - barHeight}
                        width="4.8"
                        height={barHeight}
                        rx="1.5"
                        fill={alpha(color, 0.82)}
                    />
                );
            })}
            <polyline
                points={linePoints}
                fill="none"
                stroke={alpha(theme.palette.warning.main, 0.36)}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {['chr1', 'chr6', 'chr12', 'chr18', 'chrX'].map((label, index) => (
                <text
                    key={label}
                    x={64 + index * 110}
                    y={height - 10}
                    fill={theme.palette.text.secondary}
                    fontSize="11"
                    fontWeight="700"
                >
                    {label}
                </text>
            ))}
        </Box>
    );
}

function ImageFigure({ alt, image, ratio = '1 / 0.58' }) {
    const theme = useTheme();

    return (
        <Box
            component="img"
            src={image}
            alt={alt}
            sx={{
                display: 'block',
                width: '100%',
                aspectRatio: ratio,
                objectFit: 'cover',
                borderRadius: 1.6,
                border: `1px solid ${theme.custom.border.soft}`,
                backgroundColor: theme.palette.background.paper,
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.05)',
            }}
        />
    );
}

function StageFigureFrame({ children }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                borderRadius: 1.5,
                overflow: 'hidden',
                border: `1px solid ${theme.custom.border.soft}`,
                background: 'linear-gradient(180deg, rgba(248,250,252,0.96), rgba(255,255,255,0.98))',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.05)',
                p: 0.9,
            }}
        >
            {children}
        </Box>
    );
}

function GeneSignalBoardFigure() {
    return (
        <StageFigureFrame>
            <Box component="svg" viewBox="0 0 340 182" sx={{ width: '100%', display: 'block' }}>
                {Array.from({ length: 6 }).map((_, index) => {
                    const y = 18 + (index * 20);
                    const width = 78 + (index * 30);
                    const dotX = 208 + ((index % 2) * 34);
                    return (
                        <g key={y}>
                            <rect x="18" y={y} width="250" height="12" rx="6" fill="#e7edf6" />
                            <rect x="18" y={y} width={width} height="12" rx="6" fill="#7c3aed" />
                            <circle cx={dotX} cy={y + 6} r="4.5" fill={index % 2 === 0 ? '#ef4e2f' : '#347dcc'} />
                        </g>
                    );
                })}
                <text x="18" y="160" fill="#7c3aed" fontSize="11" fontWeight="800">LoF overlap</text>
                <text x="110" y="160" fill="#475569" fontSize="11" fontWeight="700">post_mean sign</text>
                <circle cx="214" cy="156" r="4.5" fill="#ef4e2f" />
                <circle cx="248" cy="156" r="4.5" fill="#347dcc" />
            </Box>
        </StageFigureFrame>
    );
}

function RegulatorScreenFigure() {
    const theme = useTheme();
    const points = [
        [44, 132], [62, 102], [80, 84], [98, 70], [116, 62], [134, 76], [152, 92], [170, 120],
        [198, 136], [216, 104], [234, 82], [252, 72], [270, 86], [288, 114],
    ];

    return (
        <StageFigureFrame>
            <Box component="svg" viewBox="0 0 340 170" sx={{ width: '100%', display: 'block' }}>
                <line x1="28" y1="18" x2="28" y2="148" stroke="#cbd5e1" strokeWidth="2" />
                <line x1="28" y1="148" x2="312" y2="148" stroke="#cbd5e1" strokeWidth="2" />
                {points.map(([x, y], index) => (
                    <circle
                        key={`${x}-${y}`}
                        cx={x}
                        cy={y}
                        r={index % 5 === 0 ? 5.5 : 4}
                        fill={index % 5 === 0 ? theme.palette.warning.main : theme.palette.primary.main}
                        opacity={index % 5 === 0 ? 0.96 : 0.78}
                    />
                ))}
                <path d="M44 132 C 92 46, 144 48, 188 132" fill="none" stroke="#0f766e" strokeWidth="3" strokeDasharray="4 4" />
                <path d="M198 136 C 230 56, 270 58, 300 130" fill="none" stroke="#d97706" strokeWidth="3" strokeDasharray="4 4" />
                <text x="208" y="36" fill="#d97706" fontSize="11" fontWeight="800">regulator hit</text>
            </Box>
        </StageFigureFrame>
    );
}

function ProgramAssemblyFigure() {
    return (
        <StageFigureFrame>
            <Box component="svg" viewBox="0 0 340 170" sx={{ width: '100%', display: 'block' }}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <rect key={`left-${index}`} x="18" y={26 + (index * 28)} width="56" height="16" rx="8" fill="#f4d2aa" />
                ))}
                {Array.from({ length: 4 }).map((_, index) => (
                    <rect key={`right-${index}`} x="266" y={26 + (index * 28)} width="56" height="16" rx="8" fill="#c9e1f4" />
                ))}
                <rect x="132" y="50" width="76" height="70" rx="14" fill="#7b8798" />
                {Array.from({ length: 4 }).map((_, index) => (
                    <path
                        key={`link-l-${index}`}
                        d={`M 74 ${34 + (index * 28)} C 98 ${34 + (index * 28)}, 114 ${58 + (index * 10)}, 132 ${76 + (index * 3)}`}
                        fill="none"
                        stroke="#d28b35"
                        strokeWidth="3"
                    />
                ))}
                {Array.from({ length: 4 }).map((_, index) => (
                    <path
                        key={`link-r-${index}`}
                        d={`M 208 ${76 + (index * 3)} C 228 ${62 + (index * 10)}, 244 ${34 + (index * 28)}, 266 ${34 + (index * 28)}`}
                        fill="none"
                        stroke="#3f7fc0"
                        strokeWidth="3"
                    />
                ))}
            </Box>
        </StageFigureFrame>
    );
}

function TraitAssociationFigure() {
    const rows = 7;
    const cols = 10;
    const cell = 18;
    const gap = 5;

    return (
        <StageFigureFrame>
            <Box component="svg" viewBox="0 0 340 170" sx={{ width: '100%', display: 'block' }}>
                {Array.from({ length: rows }).map((_, row) => (
                    Array.from({ length: cols }).map((__, col) => {
                        const x = 20 + col * (cell + gap);
                        const y = 22 + row * (cell + gap);
                        const fill = row === 2 || (row + col) % 6 === 0
                            ? '#347dcc'
                            : (row === 4 && col % 3 === 0) || (row + col) % 7 === 0
                                ? '#ef4e2f'
                                : '#dbe4f0';
                        return <rect key={`${row}-${col}`} x={x} y={y} width={cell} height={cell} rx="4" fill={fill} />;
                    })
                ))}
                {['thyroid', 'immune', 'lipid'].map((label, index) => (
                    <text key={label} x="262" y={44 + (index * 36)} fill="#475569" fontSize="11" fontWeight="700">{label}</text>
                ))}
            </Box>
        </StageFigureFrame>
    );
}

function WorkflowFigure() {
    const theme = useTheme();
    const steps = [
        { x: 62, y: 96, color: theme.palette.primary.main, title: 'Trait registry', subtitle: 'metadata intake' },
        { x: 220, y: 56, color: theme.palette.warning.main, title: 'Signal screen', subtitle: 'CHR / BP / P / rsID' },
        { x: 378, y: 118, color: theme.palette.secondary.main, title: 'Gene and program', subtitle: 'contextual evidence' },
        { x: 536, y: 70, color: '#334155', title: 'Data reuse', subtitle: 'browse and download' },
    ];

    return (
        <Box component="svg" viewBox="0 0 640 240" sx={{ width: '100%', display: 'block' }}>
            <defs>
                <marker id="home-flow-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill={alpha(theme.palette.primary.main, 0.55)} />
                </marker>
            </defs>
            <path
                d="M110 106 C 150 84, 178 76, 220 68 S 324 84, 378 128 S 484 92, 536 82"
                fill="none"
                stroke={alpha(theme.palette.primary.main, 0.22)}
                strokeWidth="10"
                strokeLinecap="round"
            />
            <path
                d="M110 106 C 150 84, 178 76, 220 68 S 324 84, 378 128 S 484 92, 536 82"
                fill="none"
                stroke={alpha(theme.palette.primary.main, 0.58)}
                strokeWidth="2.6"
                strokeLinecap="round"
                markerEnd="url(#home-flow-arrow)"
            />
            {steps.map((step, index) => (
                <g key={step.title}>
                    <circle cx={step.x} cy={step.y} r="30" fill={alpha(step.color, 0.12)} stroke={alpha(step.color, 0.28)} strokeWidth="2" />
                    <circle cx={step.x} cy={step.y} r="10" fill={step.color} />
                    <rect
                        x={step.x - 56}
                        y={step.y + 38}
                        width="112"
                        height="56"
                        rx="12"
                        fill="#ffffff"
                        stroke={alpha(step.color, 0.22)}
                    />
                    <text x={step.x} y={step.y + 60} textAnchor="middle" fill={theme.palette.text.primary} fontSize="12" fontWeight="800">
                        {step.title}
                    </text>
                    <text x={step.x} y={step.y + 78} textAnchor="middle" fill={theme.palette.text.secondary} fontSize="11" fontWeight="600">
                        {step.subtitle}
                    </text>
                    <text x={step.x - 4} y={step.y + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="800">
                        {index + 1}
                    </text>
                </g>
            ))}
        </Box>
    );
}

function AnalysisFlowFigure() {
    const theme = useTheme();
    const columns = [
        {
            title: 'LoF genes',
            color: '#7c3aed',
            nodes: [
                { label: 'LoF-01', x: 88, y: 74 },
                { label: 'LoF-07', x: 88, y: 128 },
                { label: 'LoF-12', x: 88, y: 182 },
            ],
        },
        {
            title: 'Regulators',
            color: '#d97706',
            nodes: [
                { label: 'TF-03', x: 264, y: 64 },
                { label: 'TF-08', x: 264, y: 118 },
                { label: 'TF-17', x: 264, y: 172 },
            ],
        },
        {
            title: 'Programs',
            color: '#0f766e',
            nodes: [
                { label: 'cNMF-04', x: 456, y: 82 },
                { label: 'cNMF-11', x: 456, y: 154 },
            ],
        },
        {
            title: 'Traits',
            color: '#2563eb',
            nodes: [
                { label: 'thyroid', x: 650, y: 62 },
                { label: 'immune', x: 650, y: 110 },
                { label: 'cardio', x: 650, y: 158 },
                { label: 'metabolic', x: 650, y: 206 },
            ],
        },
    ];
    const links = [
        { from: [88, 74], to: [264, 64], color: '#7c3aed' },
        { from: [88, 74], to: [264, 118], color: '#7c3aed' },
        { from: [88, 128], to: [264, 118], color: '#7c3aed' },
        { from: [88, 182], to: [264, 172], color: '#7c3aed' },
        { from: [264, 64], to: [456, 82], color: '#d97706' },
        { from: [264, 118], to: [456, 82], color: '#d97706' },
        { from: [264, 118], to: [456, 154], color: '#d97706' },
        { from: [264, 172], to: [456, 154], color: '#d97706' },
        { from: [456, 82], to: [650, 62], color: '#0f766e' },
        { from: [456, 82], to: [650, 110], color: '#0f766e' },
        { from: [456, 154], to: [650, 158], color: '#0f766e' },
        { from: [456, 154], to: [650, 206], color: '#0f766e' },
    ];

    return (
        <Box component="svg" viewBox="0 0 740 250" sx={{ width: '100%', display: 'block' }}>
            <rect x="0" y="0" width="740" height="250" rx="24" fill="rgba(248,250,252,0.96)" />
            {links.map((link, index) => {
                const [x1, y1] = link.from;
                const [x2, y2] = link.to;
                return (
                    <path
                        key={`${x1}-${y1}-${x2}-${y2}-${index}`}
                        d={`M ${x1 + 32} ${y1} C ${x1 + 110} ${y1}, ${x2 - 104} ${y2}, ${x2 - 34} ${y2}`}
                        fill="none"
                        stroke={alpha(link.color, 0.24)}
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                );
            })}
            {columns.map((column) => (
                <g key={column.title}>
                    <text x={column.nodes[0].x - 34} y="28" fill={column.color} fontSize="13" fontWeight="800" letterSpacing="1.2">
                        {column.title}
                    </text>
                    {column.nodes.map((node) => (
                        <g key={node.label}>
                            <rect
                                x={node.x - 34}
                                y={node.y - 18}
                                width="108"
                                height="36"
                                rx="12"
                                fill="#ffffff"
                                stroke={alpha(column.color, 0.24)}
                                strokeWidth="1.5"
                            />
                            <circle cx={node.x - 14} cy={node.y} r="5" fill={column.color} />
                            <text x={node.x + 2} y={node.y + 4} fill={theme.palette.text.primary} fontSize="12" fontWeight="700">
                                {node.label}
                            </text>
                        </g>
                    ))}
                </g>
            ))}
        </Box>
    );
}

function SummaryBoardFigure() {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 1,
            }}
        >
            {outputPreviewTiles.map((item) => (
                <Box
                    key={item.key}
                    sx={{
                        gridColumn: item.wide ? '1 / -1' : 'auto',
                        position: 'relative',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        border: `1px solid ${theme.custom.border.soft}`,
                        backgroundColor: theme.palette.background.paper,
                        boxShadow: '0 10px 20px rgba(15, 23, 42, 0.05)',
                    }}
                >
                    <ImageFigure alt={item.label} image={item.image} ratio={item.ratio} />
                    <Chip
                        label={item.label}
                        size="small"
                        sx={summaryChipSx(theme, {
                            position: 'absolute',
                            left: 10,
                            top: 10,
                            color: '#fff',
                            backgroundColor: alpha(item.accent, 0.92),
                            border: `1px solid ${alpha(item.accent, 0.24)}`,
                        })}
                    />
                </Box>
            ))}
        </Box>
    );
}

function researchFigureFor(key) {
    if (key === 'lof') return <GeneSignalBoardFigure />;
    if (key === 'regulator') return <RegulatorScreenFigure />;
    if (key === 'program') return <ProgramAssemblyFigure />;
    return <TraitAssociationFigure />;
}

function FlowStageCard({ figure, item, navigate }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                ...panelSx(theme, {
                    p: 0,
                    overflow: 'hidden',
                    height: '100%',
                    backgroundColor: 'rgba(255,255,255,0.94)',
                    borderColor: alpha(item.accent, 0.16),
                }),
            }}
        >
            <CardActionArea
                onClick={() => navigate(item.to)}
                sx={{
                    height: '100%',
                    display: 'block',
                    transition: `background-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                    '&:hover': {
                        backgroundColor: alpha(item.accent, 0.03),
                    },
                }}
            >
                <Stack spacing={1} sx={{ height: '100%', p: 1.05 }}>
                    <Stack spacing={0.7}>
                        <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                            <Chip
                                label={item.step}
                                size="small"
                                sx={summaryChipSx(theme, {
                                    color: '#fff',
                                    backgroundColor: item.accent,
                                    border: `1px solid ${alpha(item.accent, 0.22)}`,
                                })}
                            />
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: item.accent }}>
                                {item.eyebrow}
                            </Typography>
                        </Stack>
                        <Typography sx={{ fontSize: '0.96rem', fontWeight: 760, lineHeight: 1.24, color: theme.palette.text.primary }}>
                            {item.title}
                        </Typography>
                        <Typography sx={captionSx(theme, { fontSize: '0.8rem' })}>
                            {item.description}
                        </Typography>
                    </Stack>
                    <Box sx={{ mt: 'auto' }}>
                        {figure}
                    </Box>
                    <Stack direction="row" spacing={0.55} alignItems="center" sx={{ color: item.accent }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 750, color: item.accent }}>
                            Open stage
                        </Typography>
                        <ArrowForward sx={{ fontSize: 15, color: item.accent }} />
                    </Stack>
                </Stack>
            </CardActionArea>
        </Box>
    );
}

function FigureCard({ chips = [], description, figure, title }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                ...panelSx(theme, {
                    p: 1.25,
                    height: '100%',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                }),
            }}
        >
            <Stack spacing={1.05} sx={{ height: '100%' }}>
                <Box>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 760, color: theme.palette.text.primary, mb: 0.45 }}>
                        {title}
                    </Typography>
                    {description ? (
                        <Typography sx={captionSx(theme, { fontSize: '0.84rem' })}>
                            {description}
                        </Typography>
                    ) : null}
                </Box>
                <Box sx={{ minHeight: 0, flex: 1 }}>
                    {figure}
                </Box>
                {chips.length > 0 ? (
                    <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                        {chips.map((chip) => (
                            <Chip key={chip} label={chip} size="small" sx={summaryChipSx(theme)} />
                        ))}
                    </Stack>
                ) : null}
            </Stack>
        </Box>
    );
}

function TraitFigurePreviewGrid({ toneColor, trait, onOpenFeaturedTrait }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 0.65,
            }}
        >
            {trait.evidence.map((item) => {
                const preview = FIGURE_PREVIEW_MAP[item.tab];
                return (
                    <Box
                        key={`${trait.fileId}-${item.tab}`}
                        onClick={() => onOpenFeaturedTrait(trait, item.tab)}
                        sx={{
                            position: 'relative',
                            borderRadius: 1.3,
                            overflow: 'hidden',
                            border: `1px solid ${alpha(toneColor, 0.16)}`,
                            cursor: 'pointer',
                            backgroundColor: '#fff',
                            transition: `transform ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                            '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: `0 10px 18px ${alpha(toneColor, 0.12)}`,
                            },
                        }}
                    >
                        <Box
                            component="img"
                            src={preview.image}
                            alt={item.label}
                            sx={{
                                display: 'block',
                                width: '100%',
                                aspectRatio: '1 / 0.78',
                                objectFit: 'cover',
                            }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                px: 0.5,
                                py: 0.4,
                                background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(15,23,42,0.76) 100%)',
                            }}
                        >
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                {preview.label}
                            </Typography>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

function FeaturedTraitCard({ compact = false, onOpenFeaturedTrait, trait }) {
    const theme = useTheme();
    const coverImage = getFeaturedTraitCoverImage(trait);

    return (
        <Box
            sx={{
                ...panelSx(theme, {
                    overflow: 'hidden',
                    backgroundColor: '#0f172a',
                    borderColor: alpha(trait.tone.line, 0.22),
                    boxShadow: `0 22px 44px ${alpha(trait.tone.line, 0.14)}`,
                }),
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    aspectRatio: compact ? '1 / 0.6' : '1 / 0.72',
                    overflow: 'hidden',
                }}
            >
                <Box
                    component="img"
                    src={coverImage}
                    alt={trait.traitName}
                    sx={{
                        width: '100%',
                        height: '100%',
                        display: 'block',
                        objectFit: 'cover',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(180deg, ${alpha(trait.tone.line, 0.08)} 0%, rgba(15,23,42,0.84) 82%)`,
                    }}
                />
                <Stack spacing={0.8} sx={{ position: 'absolute', inset: 0, p: compact ? 1.1 : 1.25, justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                        <Chip
                            label={trait.gwasId}
                            size="small"
                            sx={summaryChipSx(theme, {
                                color: '#fff',
                                backgroundColor: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                backdropFilter: 'blur(10px)',
                            })}
                        />
                        <Chip
                            label={`${trait.nSig.toLocaleString()} loci`}
                            size="small"
                            sx={summaryChipSx(theme, {
                                color: '#fff',
                                backgroundColor: 'rgba(15,23,42,0.28)',
                                border: '1px solid rgba(255,255,255,0.14)',
                            })}
                        />
                    </Stack>
                    <Box>
                        <Typography
                            sx={{
                                fontSize: compact ? '1.04rem' : '1.2rem',
                                fontWeight: 760,
                                color: '#fff',
                                lineHeight: 1.12,
                                mb: 0.4,
                                textShadow: '0 4px 18px rgba(15,23,42,0.3)',
                            }}
                        >
                            {trait.traitName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: 'rgba(255,255,255,0.84)' }}>
                            QQ {trait.qqDeviation} · {trait.fileId}
                        </Typography>
                    </Box>
                </Stack>
            </Box>
            <Stack spacing={0.95} sx={{ p: compact ? 1 : 1.15, backgroundColor: 'rgba(255,255,255,0.96)' }}>
                <TraitFigurePreviewGrid
                    toneColor={trait.tone.line}
                    trait={trait}
                    onOpenFeaturedTrait={onOpenFeaturedTrait}
                />
                <Stack direction="row" justifyContent="flex-end">
                    <Button size="small" endIcon={<ArrowForward />} onClick={() => onOpenFeaturedTrait(trait)}>
                        Open trait
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}

function ModuleCard({ item, metricText, navigate }) {
    const theme = useTheme();
    const Icon = item.icon;

    return (
        <Box
            sx={{
                ...panelSx(theme, {
                    overflow: 'hidden',
                    height: '100%',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderColor: alpha(item.color, 0.16),
                }),
            }}
        >
            <CardActionArea
                onClick={() => navigate(item.to)}
                sx={{
                    height: '100%',
                    display: 'block',
                    p: 1.05,
                    transition: `background-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                    '&:hover': {
                        backgroundColor: alpha(item.color, 0.04),
                    },
                }}
            >
                <Stack spacing={0.95} sx={{ height: '100%', alignItems: 'flex-start' }}>
                    <ImageFigure alt={item.title} image={item.image} ratio="1 / 0.56" />
                    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                        <Chip
                            label={item.step}
                            size="small"
                            sx={summaryChipSx(theme, {
                                color: '#fff',
                                backgroundColor: item.color,
                                border: `1px solid ${alpha(item.color, 0.22)}`,
                            })}
                        />
                        <Chip label={metricText} size="small" sx={summaryChipSx(theme)} />
                    </Stack>
                    <Stack direction="row" spacing={0.9} alignItems="flex-start" sx={{ width: '100%' }}>
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                display: 'grid',
                                flexShrink: 0,
                                placeItems: 'center',
                                borderRadius: 1.5,
                                backgroundColor: alpha(item.color, 0.1),
                                color: item.color,
                            }}
                        >
                            <Icon sx={{ fontSize: 22 }} />
                        </Box>
                        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.96rem', fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.15 }}>
                                {item.title}
                            </Typography>
                            <Typography sx={captionSx(theme, { fontSize: '0.79rem' })}>
                                {item.description}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 'auto' }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: item.color }}>
                            Open browser
                        </Typography>
                        <ArrowForward sx={{ fontSize: 16, color: item.color }} />
                    </Stack>
                </Stack>
            </CardActionArea>
        </Box>
    );
}

export default function Home() {
    const theme = useTheme();
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [checked, setChecked] = useState(new Set());
    const [meta, setMeta] = useState({ totalCount: 0, truncated: false });
    const [homeStats, setHomeStats] = useState({ traits: 0, programs: 0, dataOutputs: 0 });
    const [statsLoading, setStatsLoading] = useState(true);
    const timerRef = useRef(null);
    const abortRef = useRef(null);

    const trimmedQ = q.trim();
    const canSearch = trimmedQ.length >= 2;

    const fileResults = useMemo(
        () => results.filter((item) => item.type === 'file'),
        [results],
    );
    const folderResults = useMemo(
        () => results.filter((item) => item.type === 'dir'),
        [results],
    );
    const checkedFiles = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)),
        [checked, fileResults],
    );
    const panelOpen = open && canSearch;
    const quickSearchSeeds = useMemo(
        () => [featuredTrait.gwasId, featuredTrait.fileId].filter(Boolean),
        [],
    );

    useEffect(() => {
        window.clearTimeout(timerRef.current);

        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }

        if (!canSearch) {
            setLoading(false);
            setOpen(false);
            setResults([]);
            setMeta({ totalCount: 0, truncated: false });
            setChecked(new Set());
            return;
        }

        timerRef.current = window.setTimeout(() => {
            const cacheKey = trimmedQ.toLowerCase();
            const cached = getCachedSearchResult(cacheKey);

            setChecked(new Set());
            setOpen(true);

            if (cached) {
                setResults(cached.results);
                setMeta({ totalCount: cached.totalCount, truncated: cached.truncated });
                setLoading(false);
                return;
            }

            const ctrl = new AbortController();
            abortRef.current = ctrl;
            setLoading(true);
            setError('');

            SEARCH_API.get('/search', {
                params: { q: trimmedQ, limit: 60 },
                signal: ctrl.signal,
            })
                .then(({ data }) => {
                    const nextResults = data.results || [];
                    const nextMeta = {
                        totalCount: data.totalCount ?? nextResults.length,
                        truncated: Boolean(data.truncated),
                    };

                    SEARCH_CACHE.set(cacheKey, { results: nextResults, cachedAt: Date.now(), ...nextMeta });
                    setResults(nextResults);
                    setMeta(nextMeta);
                    setOpen(true);
                })
                .catch((requestError) => {
                    if (!axios.isCancel(requestError) && requestError.code !== 'ERR_CANCELED') {
                        console.error(requestError);
                        setError(getRequestErrorMessage(requestError, 'Search failed'));
                    }
                })
                .finally(() => {
                    if (abortRef.current === ctrl) {
                        abortRef.current = null;
                        setLoading(false);
                    }
                });
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timerRef.current);
    }, [canSearch, trimmedQ]);

    useEffect(() => () => {
        window.clearTimeout(timerRef.current);
        if (abortRef.current) abortRef.current.abort();
    }, []);

    useEffect(() => {
        let cancelled = false;

        setStatsLoading(true);
        HOME_API.get('/home/stats')
            .then(({ data }) => {
                if (cancelled) return;
                setHomeStats({
                    traits: Number(data?.traits) || 0,
                    programs: Number(data?.programs) || 0,
                    dataOutputs: Number(data?.dataOutputs) || 0,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setHomeStats({ traits: 0, programs: 0, dataOutputs: 0 });
            })
            .finally(() => {
                if (!cancelled) setStatsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const toggleFile = (path) => {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const toggleAllFiles = () => {
        const allFilesChecked = fileResults.length > 0 && checkedFiles.length === fileResults.length;
        if (allFilesChecked) {
            setChecked(new Set());
            return;
        }
        setChecked(new Set(fileResults.map((item) => item.path)));
    };

    const clearSearch = () => {
        setQ('');
        setOpen(false);
        setResults([]);
        setMeta({ totalCount: 0, truncated: false });
        setChecked(new Set());
    };

    const handleSelect = (item) => {
        setOpen(false);
        const dir = item.type === 'dir' ? item.path : item.path.split('/').slice(0, -1).join('/');
        const params = new URLSearchParams();
        if (dir) params.set('dir', dir);
        if (trimmedQ) params.set('q', trimmedQ);
        navigate(`/data?${params.toString()}`);
    };

    const openResultsInBrowser = () => {
        if (!trimmedQ) return;
        const params = new URLSearchParams({ q: trimmedQ, mode: 'global' });
        navigate(`/data?${params.toString()}`);
        setOpen(false);
    };

    const openFeaturedTrait = (trait, tabKey = '') => {
        navigate(getFeaturedTraitRoute(trait, tabKey));
    };

    const handleDownloadSelection = async () => {
        setDownloading(true);
        setError('');
        try {
            await downloadDataPaths(checkedFiles.map((item) => item.path), {
                filename: `${trimmedQ || 'data-search'}-files.zip`,
                zipThreshold: 10,
            });
        } catch (downloadError) {
            setError(getRequestErrorMessage(downloadError, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1480, mx: 'auto', py: { xs: 2.2, md: 4.4 }, px: { xs: 1.25, md: 2.2 } }}>
            <Stack spacing={{ xs: 3.4, md: 5.1 }}>
                <Box
                    component="section"
                    sx={{
                        ...panelSx(theme, {
                            position: 'relative',
                            overflow: 'visible',
                            px: { xs: 1.35, md: 2.2 },
                            py: { xs: 1.35, md: 2.2 },
                            background: 'linear-gradient(135deg, rgba(240,246,255,0.96) 0%, rgba(255,255,255,0.96) 52%, rgba(240,249,246,0.96) 100%)',
                            boxShadow: '0 24px 52px rgba(15, 23, 42, 0.09)',
                            '&::before': {
                                content: '""',
                                position: 'absolute',
                                inset: 0,
                                backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
                                backgroundSize: '26px 26px',
                                maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.46), transparent)',
                                pointerEvents: 'none',
                            },
                            '&::after': {
                                content: '""',
                                position: 'absolute',
                                width: 340,
                                height: 340,
                                right: -120,
                                top: -130,
                                borderRadius: '50%',
                                background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, rgba(37,99,235,0) 72%)',
                                pointerEvents: 'none',
                            },
                        }),
                    }}
                >
                    <Box
                        sx={{
                            position: 'relative',
                            zIndex: 1,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) 430px' },
                            gap: { xs: 1.35, lg: 1.5 },
                            alignItems: 'start',
                        }}
                    >
                        <Stack spacing={{ xs: 1.2, md: 1.45 }} sx={{ minWidth: 0 }}>
                            <Stack spacing={0.8} sx={{ maxWidth: 760 }}>
                                <Typography
                                    sx={{
                                        fontSize: '0.76rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        color: theme.palette.primary.dark,
                                    }}
                                >
                                    LoF Gene-Program-Trait Browser
                                </Typography>
                                <Typography
                                    component="h1"
                                    sx={sectionTitleSx(theme, {
                                        fontSize: { xs: '2rem', md: '3rem' },
                                        lineHeight: 0.96,
                                        maxWidth: 760,
                                    })}
                                >
                                    Browse LoF gene-program-trait results.
                                </Typography>
                                <Typography
                                    sx={captionSx(theme, {
                                        maxWidth: 700,
                                        fontSize: { xs: '0.95rem', md: '1rem' },
                                    })}
                                >
                                    {'LoF -> regulator -> program -> GWAS trait association.'}
                                </Typography>
                            </Stack>

                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                                    gap: 0.85,
                                    maxWidth: 760,
                                }}
                            >
                                {heroStatsConfig.map((item) => (
                                    <HeroMetricCard
                                        key={item.key}
                                        hint={item.hint}
                                        label={item.label}
                                        loading={statsLoading}
                                        tone={item.tone}
                                        value={homeStats[item.key] || 0}
                                    />
                                ))}
                            </Box>

                            <Stack direction="row" spacing={0.9} useFlexGap flexWrap="wrap">
                                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/genes')}>
                                    Gene browser
                                </Button>
                                <Button variant="outlined" onClick={() => navigate('/programs')}>
                                    Program browser
                                </Button>
                                <Button variant="outlined" onClick={() => navigate('/trait')}>
                                    Trait browser
                                </Button>
                            </Stack>

                            <Box
                                sx={{
                                    ...panelSx(theme, {
                                        p: 1.2,
                                        maxWidth: 760,
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                        backdropFilter: 'blur(14px)',
                                    }),
                                }}
                            >
                                <Stack spacing={0.95}>
                                    <Box>
                                        <Typography
                                            sx={{
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.18em',
                                                textTransform: 'uppercase',
                                                color: theme.palette.secondary.dark,
                                                mb: 0.35,
                                            }}
                                        >
                                            Quick file access
                                        </Typography>
                                    </Box>

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
                                                    '&:hover': {
                                                        backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                                    },
                                                })}
                                            />
                                        ))}
                                    </Stack>

                                    <ClickAwayListener onClickAway={() => setOpen(false)}>
                                        <Box sx={{ position: 'relative' }}>
                                            <TextField
                                                fullWidth
                                                placeholder="Search files or folders"
                                                aria-label="Search files and folders"
                                                value={q}
                                                onChange={(event) => setQ(event.target.value)}
                                                onFocus={() => {
                                                    if (canSearch) setOpen(true);
                                                }}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Escape') {
                                                        setOpen(false);
                                                    }
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
                                                            <IconButton size="small" onClick={clearSearch}>
                                                                <Close fontSize="small" />
                                                            </IconButton>
                                                        )),
                                                    sx: {
                                                        bgcolor: 'rgba(255,255,255,0.96)',
                                                        '& fieldset': { borderColor: 'rgba(148,163,184,0.24)' },
                                                        '&:hover fieldset': { borderColor: 'rgba(37,99,235,0.28)' },
                                                    },
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
                                                handleSelect={handleSelect}
                                                loading={loading}
                                                meta={meta}
                                                openResultsInBrowser={openResultsInBrowser}
                                                panelOpen={panelOpen}
                                                results={results}
                                                setChecked={setChecked}
                                                setDownloading={setDownloading}
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
                        </Stack>

                        <Stack spacing={1.05}>
                            <Box
                                sx={{
                                    ...panelSx(theme, {
                                        p: 1.15,
                                        backgroundColor: 'rgba(255,255,255,0.92)',
                                    }),
                                }}
                            >
                                <Stack spacing={0.95}>
                                    <Box>
                                        <Typography
                                            sx={{
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.18em',
                                                textTransform: 'uppercase',
                                                color: theme.palette.primary.dark,
                                                mb: 0.35,
                                            }}
                                        >
                                            Signal snapshot
                                        </Typography>
                                    </Box>
                                    <SignalLandscapeFigure compact />
                                </Stack>
                            </Box>

                            <FeaturedTraitCard trait={featuredTrait} onOpenFeaturedTrait={openFeaturedTrait} />
                        </Stack>
                    </Box>
                </Box>

                <Box component="section">
                    <SectionHeading
                        eyebrow="Scientific route"
                        title="LoF -> regulator -> program -> trait"
                    />
                    <Typography
                        sx={captionSx(theme, {
                            mt: 0.55,
                            maxWidth: 780,
                            fontSize: '0.87rem',
                        })}
                    >
                        The homepage now follows the biological analysis order instead of separating unrelated screenshots.
                    </Typography>
                    <Box
                        sx={{
                            mt: 1.65,
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, minmax(0, 1fr))',
                                xl: 'repeat(4, minmax(0, 1fr))',
                            },
                            gap: 1.15,
                        }}
                    >
                        {researchFlowPanels.map((item) => (
                            <FlowStageCard
                                key={item.key}
                                item={item}
                                figure={researchFigureFor(item.key)}
                                navigate={navigate}
                            />
                        ))}
                    </Box>
                </Box>

                <Box component="section">
                    <SectionHeading
                        eyebrow="Linked outputs"
                        title="One route, two coupled result layers"
                    />
                    <Box
                        sx={{
                            mt: 1.65,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.15fr) minmax(360px, 0.85fr)' },
                            gap: 1.3,
                        }}
                    >
                        <FigureCard
                            title="Dependency structure"
                            description="LoF genes, regulators, programs, and traits stay in one dependency graph rather than being shown as isolated picture tiles."
                            figure={<AnalysisFlowFigure />}
                            chips={['LoF genes', 'regulators', 'programs', 'traits']}
                        />
                        <FigureCard
                            title="Resolved browser outputs"
                            description="The same path opens concrete outputs: gene evidence, program networks, trait views, and archived result files."
                            figure={<SummaryBoardFigure />}
                            chips={['gene evidence', 'program graph', 'trait heatmap', 'data archive']}
                        />
                    </Box>
                </Box>

                <Box
                    component="section"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) 430px' },
                        gap: 1.2,
                        alignItems: 'start',
                    }}
                >
                    <Box
                        sx={{
                            ...panelSx(theme, {
                                p: { xs: 1.2, md: 1.45 },
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(245,249,255,0.94))',
                            }),
                        }}
                    >
                        <Stack spacing={1.2}>
                            <SectionHeading
                                eyebrow="Browser workflow"
                                title="Inspect the route, then open the correct layer"
                            />
                            <Box
                                sx={{
                                    ...panelSx(theme, {
                                        p: 1.05,
                                        backgroundColor: 'rgba(255,255,255,0.9)',
                                    }),
                                }}
                            >
                                <WorkflowFigure />
                            </Box>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                    gap: 0.85,
                                }}
                            >
                                {workflowHighlights.map((item) => (
                                    <Box
                                        key={item.title}
                                        sx={{
                                            borderRadius: 2,
                                            border: `1px solid ${theme.custom.border.soft}`,
                                            backgroundColor: 'rgba(255,255,255,0.84)',
                                            px: 1,
                                            py: 0.9,
                                        }}
                                    >
                                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.45 }}>
                                            <Box sx={{ color: theme.palette.text.secondary, display: 'grid', placeItems: 'center' }}>
                                                {item.icon}
                                            </Box>
                                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 760, color: theme.palette.text.primary }}>
                                                {item.title}
                                            </Typography>
                                        </Stack>
                                        <Typography sx={captionSx(theme, { fontSize: '0.78rem' })}>
                                            {item.description}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Stack>
                    </Box>

                    <Box>
                        <SectionHeading
                            eyebrow="Entry points"
                            title="Open the browser at the right biological layer"
                        />
                        <Box
                            sx={{
                                mt: 1.2,
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '1fr' },
                                gap: 1,
                            }}
                        >
                            {moduleCards.map((item) => (
                                <ModuleCard
                                    key={item.key}
                                    item={item}
                                    metricText={item.statKey
                                        ? `${statsLoading ? '...' : (homeStats[item.statKey] || 0).toLocaleString()} ${item.metricLabel}`
                                        : item.metricFallback}
                                    navigate={navigate}
                                />
                            ))}
                        </Box>
                    </Box>
                </Box>

            </Stack>
        </Box>
    );
}
