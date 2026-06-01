import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    CardActionArea,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    ClickAwayListener,
    Divider,
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
    Close,
    Dns,
    FileDownload,
    Folder,
    Hub,
    InsertDriveFile,
    Science,
    Search,
    Storage,
} from '@mui/icons-material';
import axios from 'axios';
import { downloadDataPaths } from '../utils/download';
import { captionSx, sectionTitleSx, summaryChipSx } from '../themeUtils';
import homeThumbProgramScatter from '../assets/home-thumb-program-scatter.png';
import homeThumbTraitGraph from '../assets/home-thumb-trait-graph.png';
import homeThumbCrossHeatmap from '../assets/home-thumb-cross-heatmap.png';
import homeThumbGeneEvidence from '../assets/home-thumb-gene-evidence.png';
import homeThumbDataBrowser from '../assets/home-thumb-data-browser.png';

const SEARCH_API = axios.create({ baseURL: '/api/data' });
const HOME_API = axios.create({ baseURL: '/api' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;
const HOME_ACCENT = '#d57d5a';
const HOME_DEEP = '#1f2b3d';
const HOME_DISPLAY_FONT = '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';

const loadingBarSx = {
    height: 3,
    bgcolor: 'rgba(226,232,240,0.72)',
    '& .MuiLinearProgress-bar': {
        background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
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
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), transparent)',
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
        color: '#2563eb',
    },
    {
        key: 'programs',
        label: 'Programs linked',
        color: '#1f9d62',
    },
    {
        key: 'dataOutputs',
        label: 'Indexed outputs',
        color: '#b7791f',
    },
];

const entryCards = [
    {
        key: 'traits',
        label: 'Trait browser',
        eyebrow: 'Trait-first navigation',
        description: 'Open phenotype pages with linked summary statistics and rendered evidence views.',
        statKey: 'traits',
        metricLabel: 'traits indexed',
        icon: <Dns sx={{ fontSize: 26 }} />,
        to: '/trait',
        color: '#2563eb',
        image: homeThumbProgramScatter,
    },
    {
        key: 'genes',
        label: 'Gene evidence',
        eyebrow: 'Gene-level readouts',
        description: 'Trace QQ, regulation, scatter, and burden signals around candidate genes.',
        metricFallback: 'gene-centric views',
        icon: <Hub sx={{ fontSize: 26 }} />,
        to: '/genes',
        color: '#7c3aed',
        image: homeThumbGeneEvidence,
    },
    {
        key: 'programs',
        label: 'Program networks',
        eyebrow: 'Program context',
        description: 'Inspect regulator-program structure and the traits enriched in each module.',
        statKey: 'programs',
        metricLabel: 'programs linked',
        icon: <Science sx={{ fontSize: 26 }} />,
        to: '/programs',
        color: '#0f766e',
        image: homeThumbTraitGraph,
    },
    {
        key: 'dataOutputs',
        label: 'Data browser',
        eyebrow: 'Download and reuse',
        description: 'Search files, folders, and downloadable outputs without leaving the atlas.',
        statKey: 'dataOutputs',
        metricLabel: 'outputs indexed',
        icon: <Storage sx={{ fontSize: 26 }} />,
        to: '/data',
        color: '#b7791f',
        image: homeThumbDataBrowser,
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

const featuredTraits = [
    {
        fileId: 'GCST90083707',
        gwasId: 'MR08330',
        traitName: 'Diagnoses - secondary ICD10: E03.9 Hypothyroidism, unspecified',
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
            bg: 'linear-gradient(180deg, rgba(234,242,255,0.96), rgba(255,255,255,0.92))',
        },
    },
    {
        fileId: 'GCST90083648',
        gwasId: 'PE04609',
        traitName: 'D12 Benign neoplasm of colon, rectum, anus and anal canal',
        nSig: 1617,
        qqDeviation: '1.586',
        evidence: [
            { label: 'Program scatter', tab: 'program-scatter' },
            { label: 'Trait-program graph', tab: 'trait-program-graph' },
            { label: 'Cross-trait heatmap', tab: 'cross-trait-heatmap' },
        ],
        tone: {
            glow: 'rgba(217, 119, 6, 0.18)',
            line: '#d97706',
            bg: 'linear-gradient(180deg, rgba(255,246,229,0.96), rgba(255,255,255,0.92))',
        },
    },
    {
        fileId: 'GCST90083948',
        gwasId: 'AT599',
        traitName: 'I10 Essential (primary) hypertension',
        nSig: 8374,
        qqDeviation: '3.746',
        evidence: [
            { label: 'Program scatter', tab: 'program-scatter' },
            { label: 'Trait-program graph', tab: 'trait-program-graph' },
            { label: 'Cross-trait heatmap', tab: 'cross-trait-heatmap' },
        ],
        tone: {
            glow: 'rgba(14, 116, 144, 0.16)',
            line: '#0f766e',
            bg: 'linear-gradient(180deg, rgba(234,251,249,0.96), rgba(255,255,255,0.92))',
        },
    },
];


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
    theme,
    toggleAllFiles,
    toggleFile,
    setChecked,
    setDownloading,
    setError,
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
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                right: 0,
                zIndex: 20,
                overflow: 'hidden',
                borderRadius: 2,
                border: `1px solid ${theme.custom.border.strong}`,
                boxShadow: theme.custom.shadow.float,
                bgcolor: theme.palette.background.paper,
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
                            backgroundColor: theme.custom.surface.accent,
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
                                sx={{ textTransform: 'none', boxShadow: 'none' }}
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
                        sx={{ textTransform: 'none' }}
                        onClick={openResultsInBrowser}
                    >
                        Open Data Browser
                    </Button>
                </Stack>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mx: 2, mt: 1, borderRadius: 2 }} onClose={() => setError('')}>
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
                                                    '&:hover': { bgcolor: theme.custom.surface.accent },
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
                                {fileResults.length > 0 && <Divider />}
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
                                                    '&:hover': { bgcolor: 'rgba(180, 83, 9, 0.08)' },
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

function SectionIntro({ eyebrow, title, description, align = 'left' }) {
    const centered = align === 'center';

    return (
        <Stack
            spacing={0.45}
            alignItems={centered ? 'center' : 'flex-start'}
            sx={{
                textAlign: centered ? 'center' : 'left',
                maxWidth: centered ? 680 : 520,
                mx: centered ? 'auto' : 0,
            }}
        >
            <Typography
                sx={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: HOME_ACCENT,
                }}
            >
                {eyebrow}
            </Typography>
            <Typography
                sx={{
                    fontFamily: HOME_DISPLAY_FONT,
                    fontSize: { xs: '2rem', md: '2.5rem' },
                    lineHeight: 0.98,
                    color: HOME_DEEP,
                }}
            >
                {title}
            </Typography>
            {centered && (
                <Box
                    sx={{
                        width: 76,
                        height: 3,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${alpha(HOME_ACCENT, 0.16)} 0%, ${HOME_ACCENT} 52%, ${alpha(HOME_ACCENT, 0.16)} 100%)`,
                        mt: 0.2,
                        mb: 0.3,
                    }}
                />
            )}
            {description && (
                <Typography
                    sx={{
                        maxWidth: centered ? 620 : 480,
                        fontSize: '0.9rem',
                        lineHeight: 1.7,
                        color: '#5b6472',
                    }}
                >
                    {description}
                </Typography>
            )}
        </Stack>
    );
}

function HeroStat({ label, loading, value }) {
    return (
        <Box
            sx={{
                minWidth: 0,
                px: 1.25,
                py: 1,
                borderRadius: 2.2,
                bgcolor: 'rgba(255,255,255,0.74)',
                border: '1px solid rgba(213,125,90,0.12)',
                boxShadow: '0 10px 22px rgba(31,43,61,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0.45,
            }}
        >
            <Typography
                sx={{
                    fontSize: '0.67rem',
                    fontWeight: 800,
                    color: '#8a624e',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    lineHeight: 1,
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    fontFamily: HOME_DISPLAY_FONT,
                    fontSize: { xs: '1.25rem', md: '1.5rem' },
                    fontWeight: 700,
                    color: HOME_DEEP,
                    lineHeight: 1,
                }}
            >
                {loading ? (
                    <Skeleton
                        variant="text"
                        width={56}
                        height={28}
                        sx={{ transform: 'none', bgcolor: 'rgba(31,43,61,0.08)' }}
                    />
                ) : (
                    value.toLocaleString()
                )}
            </Typography>
        </Box>
    );
}

function TraitFigurePreviewGrid({ toneColor, trait, onOpenFeaturedTrait, dense = false }) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: dense ? 0.55 : 0.7,
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
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            border: `1px solid ${alpha(toneColor, 0.14)}`,
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
                                aspectRatio: dense ? '1 / 0.66' : '1 / 0.8',
                                objectFit: 'cover',
                            }}
                        />
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                px: 0.55,
                                py: 0.45,
                                background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(15,23,42,0.72) 100%)',
                            }}
                        >
                            <Typography sx={{ fontSize: dense ? '0.62rem' : '0.66rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                {preview.label}
                            </Typography>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}

function FeaturedTraitTile({ trait, onOpenFeaturedTrait, onOpenTrait, compact = false }) {
    const theme = useTheme();
    const coverImage = getFeaturedTraitCoverImage(trait);

    return (
        <Box
            sx={{
                minWidth: 0,
                height: '100%',
                borderRadius: 2.8,
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.86)',
                border: `1px solid ${alpha(trait.tone.line, 0.12)}`,
                boxShadow: `0 18px 32px ${alpha(trait.tone.line, 0.1)}`,
            }}
        >
            <Box
                onClick={() => onOpenTrait(trait)}
                sx={{
                    position: 'relative',
                    aspectRatio: compact ? '1 / 0.58' : '1 / 0.64',
                    overflow: 'hidden',
                    cursor: 'pointer',
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
                        transition: `transform ${theme.custom.motion.smooth}`,
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(180deg, ${alpha(trait.tone.line, 0.1)} 0%, rgba(15,23,42,0.78) 82%)`,
                    }}
                />
                <Stack
                    direction="row"
                    spacing={0.7}
                    alignItems="flex-start"
                    justifyContent="space-between"
                    sx={{ position: 'absolute', top: 12, left: 12, right: 12 }}
                >
                    <Chip
                        label={trait.gwasId}
                        size="small"
                        sx={summaryChipSx(theme, {
                            color: '#fff',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.16)',
                            backdropFilter: 'blur(10px)',
                        })}
                    />
                    <Typography
                        sx={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.88)',
                            textAlign: 'right',
                            lineHeight: 1.3,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {trait.nSig.toLocaleString()} loci
                    </Typography>
                </Stack>
                <Box sx={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
                    <Typography
                        sx={{
                            fontFamily: HOME_DISPLAY_FONT,
                            fontSize: compact ? '1.12rem' : '1.24rem',
                            fontWeight: 700,
                            color: '#fff',
                            lineHeight: 1.08,
                            textShadow: '0 4px 18px rgba(15,23,42,0.28)',
                            mb: 0.35,
                        }}
                    >
                        {trait.traitName}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.84)',
                            letterSpacing: '0.04em',
                        }}
                    >
                        QQ {trait.qqDeviation}
                    </Typography>
                </Box>
            </Box>
            <Stack
                direction="row"
                spacing={0.7}
                useFlexGap
                flexWrap="wrap"
                sx={{
                    p: compact ? 0.9 : 1.05,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(250,244,239,0.94))',
                }}
            >
                {trait.evidence.map((item) => (
                    <Chip
                        key={`${trait.fileId}-${item.tab}`}
                        label={item.label}
                        onClick={() => onOpenFeaturedTrait(trait, item.tab)}
                        sx={summaryChipSx(theme, {
                            cursor: 'pointer',
                            color: alpha(trait.tone.line, 0.92),
                            backgroundColor: alpha(trait.tone.line, 0.08),
                            border: `1px solid ${alpha(trait.tone.line, 0.12)}`,
                            '&:hover': {
                                backgroundColor: alpha(trait.tone.line, 0.14),
                            },
                        })}
                    />
                ))}
            </Stack>
        </Box>
    );
}

function ExploreCard({
    color,
    figureRatio = '1 / 0.63',
    eyebrow,
    image,
    icon,
    label,
    description,
    metricText,
    navigate,
    to,
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.84)',
                minWidth: 0,
                height: '100%',
                border: `1px solid ${alpha(color, 0.12)}`,
                boxShadow: `0 16px 34px ${alpha(color, 0.1)}`,
                overflow: 'hidden',
            }}
        >
            <CardActionArea
                onClick={() => navigate(to)}
                sx={{
                    height: '100%',
                    borderRadius: 3,
                    p: 1.05,
                    transition: `background-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                    '&:hover': {
                        bgcolor: alpha(color, 0.04),
                        transform: 'translateY(-2px)',
                    },
                    '&:hover .home-entry-figure': {
                        transform: 'scale(1.04)',
                    },
                }}
            >
                <CardContent sx={{ p: 0, height: '100%' }}>
                    <Stack spacing={1.05} sx={{ height: '100%' }}>
                        <Box
                            sx={{
                                position: 'relative',
                                aspectRatio: figureRatio,
                                overflow: 'hidden',
                                borderRadius: 2.3,
                                bgcolor: alpha(color, 0.08),
                            }}
                        >
                            <Box
                                component="img"
                                src={image}
                                alt={label}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'block',
                                    objectFit: 'cover',
                                    transition: `transform ${theme.custom.motion.smooth}`,
                                }}
                                className="home-entry-figure"
                            />
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(15,23,42,0.24) 100%)',
                                }}
                            />
                            <Stack
                                direction="row"
                                alignItems="flex-start"
                                justifyContent="space-between"
                                spacing={1}
                                sx={{ position: 'absolute', top: 12, left: 12, right: 12 }}
                            >
                                <Box
                                    sx={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 1.8,
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: 'rgba(255,255,255,0.92)',
                                        color,
                                        boxShadow: `0 10px 18px ${alpha(color, 0.16)}`,
                                    }}
                                >
                                    {icon}
                                </Box>
                                <Chip
                                    label={metricText}
                                    size="small"
                                    sx={summaryChipSx(theme, {
                                        color: '#fff',
                                        backgroundColor: 'rgba(15,23,42,0.3)',
                                        border: '1px solid rgba(255,255,255,0.18)',
                                        backdropFilter: 'blur(10px)',
                                    })}
                                />
                            </Stack>
                        </Box>
                        <Stack spacing={0.7} sx={{ px: 0.3, pb: 0.35, minHeight: 0, flex: 1 }}>
                        <Typography
                            sx={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                letterSpacing: '0.16em',
                                textTransform: 'uppercase',
                                color,
                            }}
                        >
                            {eyebrow}
                        </Typography>
                        <Typography
                            sx={{
                                fontFamily: HOME_DISPLAY_FONT,
                                fontSize: { xs: '1.38rem', md: '1.56rem' },
                                lineHeight: 1,
                                color: HOME_DEEP,
                            }}
                        >
                            {label}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '0.84rem',
                                lineHeight: 1.68,
                                color: '#5b6472',
                                flex: 1,
                            }}
                        >
                            {description}
                        </Typography>
                        <Stack direction="row" spacing={0.55} alignItems="center" sx={{ pt: 0.15 }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: HOME_DEEP }}>
                                Open module
                            </Typography>
                            <ArrowForward sx={{ fontSize: 16, color: HOME_DEEP }} />
                        </Stack>
                        </Stack>
                    </Stack>
                </CardContent>
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
    const primaryFeaturedTrait = featuredTraits[0];
    const secondaryFeaturedTraits = featuredTraits.slice(1);
    const checkedFiles = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)),
        [checked, fileResults],
    );
    const panelOpen = open && canSearch;

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
        <Box sx={{ maxWidth: 1240, mx: 'auto', py: { xs: 2.2, md: 4 }, px: { xs: 1.25, md: 2 } }}>
            <Stack spacing={{ xs: 3.5, md: 5 }}>
                <Box
                    component="section"
                    sx={{
                        position: 'relative',
                        overflow: 'hidden',
                        borderRadius: 4,
                        border: '1px solid rgba(213,125,90,0.12)',
                        background: 'linear-gradient(135deg, rgba(249,239,230,0.96) 0%, rgba(250,246,240,0.94) 46%, rgba(234,241,251,0.94) 100%)',
                        boxShadow: '0 32px 68px rgba(31,43,61,0.12)',
                        px: { xs: 1.4, md: 2.4 },
                        py: { xs: 1.5, md: 2.4 },
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            width: 360,
                            height: 360,
                            right: -140,
                            top: -150,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(213,125,90,0.18) 0%, rgba(213,125,90,0) 72%)',
                        },
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)',
                            backgroundSize: '28px 28px',
                            opacity: 0.3,
                            pointerEvents: 'none',
                        },
                    }}
                >
                    <Box
                        sx={{
                            position: 'relative',
                            zIndex: 1,
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.08fr) 410px' },
                            gap: { xs: 2.2, lg: 2.1 },
                            alignItems: 'stretch',
                        }}
                    >
                        <Stack spacing={{ xs: 1.5, md: 2.1 }} sx={{ justifyContent: 'space-between', minWidth: 0 }}>
                            <Stack spacing={1.15} sx={{ maxWidth: 640 }}>
                                <Typography
                                    sx={{
                                        fontSize: '0.76rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.2em',
                                        textTransform: 'uppercase',
                                        color: HOME_ACCENT,
                                    }}
                                >
                                    GWAS browser
                                </Typography>
                                <Typography
                                    variant="h1"
                                    sx={sectionTitleSx(theme, {
                                        fontFamily: HOME_DISPLAY_FONT,
                                        fontSize: { xs: '2.45rem', md: '4.1rem' },
                                        lineHeight: 0.92,
                                        maxWidth: 720,
                                        color: HOME_DEEP,
                                    })}
                                >
                                    Map traits to genes, programs, and downloadable evidence.
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={captionSx(theme, {
                                        maxWidth: 520,
                                        fontSize: { xs: '0.94rem', md: '1rem' },
                                        lineHeight: 1.72,
                                        color: '#556171',
                                    })}
                                >
                                    A cleaner entry point into trait pages, gene-level signals, program structure,
                                    and reusable result files.
                                </Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/trait')}>
                                    Browse traits
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate('/data')}
                                    sx={{
                                        borderColor: 'rgba(31,43,61,0.14)',
                                        color: HOME_DEEP,
                                        backgroundColor: 'rgba(255,255,255,0.64)',
                                    }}
                                >
                                    Open data browser
                                </Button>
                            </Stack>

                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                                    gap: 0.85,
                                    maxWidth: 620,
                                }}
                            >
                                {heroStatsConfig.map((item) => (
                                    <HeroStat
                                        key={item.key}
                                        label={item.label}
                                        loading={statsLoading}
                                        value={homeStats[item.key] || 0}
                                    />
                                ))}
                            </Box>
                        </Stack>

                        <Box
                            sx={{
                                position: 'relative',
                                minWidth: 0,
                                overflow: 'hidden',
                                borderRadius: 3.1,
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: '0 24px 44px rgba(15,23,42,0.18)',
                                p: 1.05,
                                backgroundColor: '#182232',
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `linear-gradient(180deg, rgba(24,34,50,0.1) 0%, rgba(24,34,50,0.84) 100%), url(${getFeaturedTraitCoverImage(primaryFeaturedTrait)})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                            <Stack spacing={0.75} sx={{ position: 'relative', zIndex: 1 }}>
                                <Stack direction="row" spacing={0.7} alignItems="center" justifyContent="space-between">
                                    <Typography
                                        sx={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.18em',
                                            textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.72)',
                                        }}
                                    >
                                        Featured view
                                    </Typography>
                                    <Chip
                                        label={primaryFeaturedTrait.gwasId}
                                        size="small"
                                        sx={summaryChipSx(theme, {
                                            color: '#fff',
                                            backgroundColor: 'rgba(15,23,42,0.28)',
                                            border: '1px solid rgba(255,255,255,0.16)',
                                        })}
                                    />
                                </Stack>
                                <Button
                                    variant="text"
                                    onClick={() => openFeaturedTrait(primaryFeaturedTrait)}
                                    sx={{
                                        justifyContent: 'flex-start',
                                        p: 0,
                                        minWidth: 0,
                                        textAlign: 'left',
                                        textTransform: 'none',
                                        color: '#fff',
                                        fontFamily: HOME_DISPLAY_FONT,
                                        fontSize: { xs: '1.42rem', md: '1.62rem' },
                                        lineHeight: 1.02,
                                        '&:hover': {
                                            backgroundColor: 'transparent',
                                        },
                                    }}
                                >
                                    {primaryFeaturedTrait.traitName}
                                </Button>
                                <Typography
                                    sx={{
                                        fontSize: '0.77rem',
                                        fontWeight: 700,
                                        color: 'rgba(255,255,255,0.8)',
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {primaryFeaturedTrait.nSig.toLocaleString()} loci · QQ {primaryFeaturedTrait.qqDeviation}
                                </Typography>
                                <TraitFigurePreviewGrid
                                    toneColor={primaryFeaturedTrait.tone.line}
                                    trait={primaryFeaturedTrait}
                                    onOpenFeaturedTrait={openFeaturedTrait}
                                    dense
                                />
                            </Stack>
                        </Box>
                    </Box>
                </Box>

                <Box component="section">
                    <SectionIntro
                        align="center"
                        eyebrow="Modules"
                        title="Explore the atlas"
                        description="Four direct entry points keep the homepage visual-first: browse, inspect evidence, follow programs, or pull files."
                    />
                    <Box
                        sx={{
                            mt: { xs: 1.7, md: 2.2 },
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1.2,
                        }}
                    >
                        {entryCards.map((item) => (
                            <ExploreCard
                                key={item.key}
                                color={item.color}
                                eyebrow={item.eyebrow}
                                figureRatio={item.key === 'traits' ? '1 / 0.62' : '1 / 0.54'}
                                image={item.image}
                                icon={item.icon}
                                label={item.label}
                                description={item.description}
                                metricText={item.statKey
                                    ? `${statsLoading ? '...' : (homeStats[item.statKey] || 0).toLocaleString()} ${item.metricLabel}`
                                    : item.metricFallback}
                                navigate={navigate}
                                to={item.to}
                            />
                        ))}
                    </Box>
                </Box>

                <Box
                    component="section"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.12fr) 360px' },
                        gap: { xs: 1.4, lg: 1.35 },
                        alignItems: 'start',
                    }}
                >
                    <Box>
                        <SectionIntro
                            eyebrow="Curated traits"
                            title="Representative signals"
                            description="A small set of examples keeps the homepage visual without turning it into a wall of panels."
                        />
                        <Box
                            sx={{
                                mt: 1.45,
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                gap: 1.1,
                            }}
                        >
                            {secondaryFeaturedTraits.map((trait) => (
                                <FeaturedTraitTile
                                    key={trait.fileId}
                                    trait={trait}
                                    onOpenFeaturedTrait={openFeaturedTrait}
                                    onOpenTrait={openFeaturedTrait}
                                    compact
                                />
                            ))}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            position: 'relative',
                            borderRadius: 3,
                            overflow: 'visible',
                            p: 1.2,
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(249,240,231,0.86))',
                            border: '1px solid rgba(213,125,90,0.14)',
                            boxShadow: '0 18px 38px rgba(31,43,61,0.08)',
                        }}
                    >
                        <Stack spacing={1.1}>
                            <Box>
                                <Typography
                                    sx={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.18em',
                                        textTransform: 'uppercase',
                                        color: HOME_ACCENT,
                                        mb: 0.35,
                                    }}
                                >
                                    Quick search
                                </Typography>
                                <Typography
                                    sx={{
                                        fontFamily: HOME_DISPLAY_FONT,
                                        fontSize: { xs: '1.5rem', md: '1.7rem' },
                                        lineHeight: 1,
                                        color: HOME_DEEP,
                                        mb: 0.45,
                                    }}
                                >
                                    Jump straight into files
                                </Typography>
                                <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.65, color: '#5b6472' }}>
                                    Search file fragments, folders, or accessions and continue in the full data browser.
                                </Typography>
                            </Box>

                            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                                {[primaryFeaturedTrait.gwasId, ...secondaryFeaturedTraits.map((trait) => trait.gwasId)].map((label) => (
                                    <Chip
                                        key={label}
                                        label={label}
                                        onClick={() => {
                                            setQ(label);
                                            setOpen(true);
                                        }}
                                        sx={summaryChipSx(theme, {
                                            cursor: 'pointer',
                                            backgroundColor: 'rgba(255,255,255,0.72)',
                                            border: '1px solid rgba(213,125,90,0.14)',
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
                                                    <Search sx={{ color: '#7b8794', fontSize: 20 }} />
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
                                                bgcolor: 'rgba(255,255,255,0.9)',
                                                '& fieldset': { borderColor: 'rgba(148,163,184,0.22)' },
                                                '&:hover fieldset': { borderColor: 'rgba(100, 116, 139, 0.34)' },
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

                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                <Button variant="text" endIcon={<ArrowForward />} onClick={() => navigate('/data')}>
                                    All data
                                </Button>
                                <Button variant="text" onClick={() => navigate('/programs')}>
                                    Programs
                                </Button>
                                <Button variant="text" onClick={() => navigate('/genes')}>
                                    Genes
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Box>
            </Stack>
        </Box>
    );
}
