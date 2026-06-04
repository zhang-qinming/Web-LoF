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
import ReleaseLogSection from '../components/ReleaseLogSection';
import { RELEASE_LOG_ANCHOR } from '../components/releaseLogData';
import { downloadDataPaths } from '../utils/download';
import { captionSx, panelSx, summaryChipSx } from '../themeUtils';
import homeFigureBurdenVolcano from '../assets/home/home-figure-burden-volcano.svg';
import homeFigureCrossTraitHeatmap from '../assets/home/home-figure-cross-trait-heatmap.svg';
import homeFigureGwasManhattan from '../assets/home/home-figure-gwas-manhattan.svg';
import homeFigureLofGene from '../assets/home/home-figure-lof-gene.svg';
import homeFigurePosteriorVolcano from '../assets/home/home-figure-posterior-volcano.svg';
import homeFigureProgramScatter from '../assets/home/home-figure-program-scatter.svg';
import homeFigureTraitProgramNetwork from '../assets/home/home-figure-trait-program-network.svg';
import homeFigureQqPlot from '../assets/home/home-figure-qq-plot.svg';
import homeFigureBrowserWorkflow from '../assets/temp/home-figure-browser-workflow.svg';
import homeFigureDataBrowser from '../assets/temp/home-figure-data-browser.svg';

const accent = '#ff6b4a';
const siteName = 'TraitVista';
const SEARCH_API = axios.create({ baseURL: '/api/data' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;
const FEATURED_TRAIT = {
    fileId: 'GCST90081631',
    gwasId: 'PA00638',
    name: 'Non-cancer illness code, self-reported',
    nSig: 32357,
};
const FIGURE_FOCUS_HASH = 'trait-figure-panel';
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
});

const quickSearchSeeds = ['manhattan', 'summary', 'network', 'metadata'];

const questionEntrances = [
    {
        eyebrow: 'Trait-first',
        title: 'I Have a Trait',
        description: 'Search a trait or file ID, then inspect GWAS signals, gene evidence, and linked programs.',
        to: '/trait',
        icon: QueryStats,
        color: '#2563eb',
    },
    {
        eyebrow: 'Gene-first',
        title: 'I Have a Gene',
        description: 'Start from a gene and review associated programs and trait-level evidence.',
        to: '/genes',
        icon: Biotech,
        color: '#0f766e',
    },
    {
        eyebrow: 'Program-first',
        title: 'I Have a Program',
        description: 'Open a program to compare associated traits and gene regulation context.',
        to: '/programs',
        icon: Hub,
        color: '#7c3aed',
    },
    {
        eyebrow: 'Files-first',
        title: 'I Need Result Files',
        description: 'Browse indexed outputs, open folders, and download result files for downstream analysis.',
        to: '/data',
        icon: InsertDriveFile,
        color: '#b45309',
    },
];

const workflowSteps = [
    {
        label: 'Search Trait',
        detail: 'Find a trait by file ID, GWAS ID, or trait name.',
        to: '/trait',
        icon: Search,
        color: '#2563eb',
    },
    {
        label: 'Inspect GWAS Signal',
        detail: 'Open Manhattan peaks and variant tables for the selected trait.',
        to: traitTabPath('manhattan'),
        icon: QueryStats,
        color: '#0284c7',
    },
    {
        label: 'Check Gene Evidence',
        detail: 'Review LoF burden, posterior effects, and gene-level QQ evidence.',
        to: traitTabPath('gene-evidence'),
        icon: Biotech,
        color: '#0f766e',
    },
    {
        label: 'Compare Programs',
        detail: 'Move from the trait to program scatter and graph views.',
        to: traitTabPath('program-scatter'),
        icon: Hub,
        color: '#7c3aed',
    },
    {
        label: 'Download Results',
        detail: 'Collect TSV and figure outputs from the result file browser.',
        to: '/data',
        icon: FileDownload,
        color: '#b45309',
    },
];

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

function traitTabPath(tab) {
    return `/trait/${encodeURIComponent(FEATURED_TRAIT.fileId)}?tab=${encodeURIComponent(tab)}#${FIGURE_FOCUS_HASH}`;
}

const traitFigureCards = [
    {
        title: 'Program Scatter',
        description: 'Program burden versus regulator correlation for the featured trait.',
        image: homeFigureProgramScatter,
        to: traitTabPath('program-scatter'),
        icon: Hub,
        color: '#0284c7',
    },
    {
        title: 'Trait Program Graph',
        description: 'Graph-linked programs and regulator groups connected to the trait.',
        image: homeFigureTraitProgramNetwork,
        to: traitTabPath('trait-program-graph'),
        icon: Hub,
        color: '#0f766e',
    },
    {
        title: 'Manhattan',
        description: 'Genome-wide association peaks arranged by chromosome.',
        image: homeFigureGwasManhattan,
        to: traitTabPath('manhattan'),
        icon: QueryStats,
        color: '#2563eb',
    },
    {
        title: 'Burden Volcano',
        description: 'Significant LoF burden effects for genes in the featured trait.',
        image: homeFigureBurdenVolcano,
        to: traitTabPath('burden-volcano'),
        icon: QueryStats,
        color: '#ea580c',
    },
    {
        title: 'Posterior Volcano',
        description: 'Posterior gene effects with direction and significance.',
        image: homeFigurePosteriorVolcano,
        to: traitTabPath('posterior-volcano'),
        icon: QueryStats,
        color: '#a21caf',
    },
    {
        title: 'Gene Evidence',
        description: 'Gene-level posterior evidence and perturb-seq regulation support.',
        image: homeFigureLofGene,
        to: traitTabPath('gene-evidence'),
        icon: Biotech,
        color: '#7c3aed',
    },
    {
        title: 'Gene QQ',
        description: 'Observed versus expected gene-level P-value quantiles.',
        image: homeFigureQqPlot,
        to: traitTabPath('gene-qq'),
        icon: Biotech,
        color: '#1d4ed8',
    },
    {
        title: 'Cross-trait Heatmap',
        description: 'Gene effect patterns compared across related traits.',
        image: homeFigureCrossTraitHeatmap,
        to: traitTabPath('cross-trait-heatmap'),
        icon: QueryStats,
        color: '#c2410c',
    },
    {
        title: 'Result File Browser',
        description: 'Indexed result files and folders for review or download.',
        image: homeFigureDataBrowser,
        to: '/data',
        icon: InsertDriveFile,
        color: '#b45309',
    },
];

const featuredTraitPreviewCards = traitFigureCards.filter((item) => (
    item.title === 'Manhattan'
    || item.title === 'Trait Program Graph'
    || item.title === 'Gene Evidence'
));

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

function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getRequestErrorMessage(err, fallback) {
    return err.response?.data?.error || err.message || fallback;
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

function buildDataBrowserHref({ path = '', search = '' } = {}) {
    const params = new URLSearchParams();
    if (path) params.set('dir', path);
    else if (search) params.set('q', search);
    const queryString = params.toString();
    return `/data${queryString ? `?${queryString}` : ''}`;
}

function SectionHeading({ eyebrow, title, description, theme, align = 'center' }) {
    return (
        <Stack spacing={0.65} alignItems={align === 'center' ? 'center' : 'flex-start'} sx={{ mb: { xs: 2.5, md: 3.4 } }}>
            {eyebrow && (
                <Typography sx={{ color: accent, fontSize: '0.76rem', fontWeight: 850, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                    {eyebrow}
                </Typography>
            )}
            <Typography
                component="h2"
                sx={{
                    color: '#111827',
                    fontFamily: 'Georgia, Cambria, serif',
                    fontSize: { xs: '1.85rem', md: '2.35rem' },
                    fontWeight: 850,
                    lineHeight: 1.08,
                    letterSpacing: 0,
                    textAlign: align,
                    textWrap: 'balance',
                }}
            >
                {title}
            </Typography>
            {description && (
                <Typography sx={captionSx(theme, { maxWidth: 720, textAlign: align, fontSize: { xs: '0.9rem', md: '0.96rem' } })}>
                    {description}
                </Typography>
            )}
        </Stack>
    );
}

function ExploreByQuestion({ theme }) {
    return (
        <Box
            component="section"
            sx={{
                maxWidth: 1180,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4 },
                pb: { xs: 5.5, md: 7 },
            }}
        >
            <SectionHeading
                eyebrow="Explore by question"
                title="Start from the evidence you already have"
                description="TraitVista is organized around research starting points: a trait, a gene, a program, or the result files behind the figures."
                theme={theme}
            />
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                    gap: { xs: 1.5, md: 1.8 },
                }}
            >
                {questionEntrances.map((item) => {
                    const Icon = item.icon;

                    return (
                        <Box
                            key={item.title}
                            component={RouterLink}
                            to={item.to}
                            sx={panelSx(theme, {
                                minHeight: 188,
                                p: 1.8,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.1,
                                color: 'inherit',
                                textDecoration: 'none',
                                borderColor: alpha(item.color, 0.16),
                                backgroundColor: 'rgba(255,255,255,0.96)',
                                transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                                '&:hover': {
                                    transform: 'translateY(-4px)',
                                    borderColor: alpha(item.color, 0.34),
                                    boxShadow: `0 20px 42px ${alpha(item.color, 0.13)}`,
                                },
                                '&:focus-visible': {
                                    outline: `3px solid ${alpha(item.color, 0.24)}`,
                                    outlineOffset: 3,
                                },
                            })}
                        >
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                                <Box
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 1,
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: alpha(item.color, 0.09),
                                        color: item.color,
                                        flex: '0 0 auto',
                                    }}
                                    aria-hidden="true"
                                >
                                    <Icon sx={{ fontSize: 18 }} />
                                </Box>
                                <Typography sx={{ color: item.color, fontSize: '0.7rem', fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    {item.eyebrow}
                                </Typography>
                            </Stack>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography component="h3" sx={{ color: '#111827', fontSize: '1.08rem', fontWeight: 850, lineHeight: 1.2 }}>
                                    {item.title}
                                </Typography>
                                <Typography sx={captionSx(theme, { mt: 0.75, fontSize: '0.84rem', lineHeight: 1.55 })}>
                                    {item.description}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.55} alignItems="center" sx={{ mt: 'auto', color: item.color }}>
                                <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 850, color: 'inherit' }}>
                                    Open Path
                                </Typography>
                                <ArrowForward sx={{ fontSize: 14 }} />
                            </Stack>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function WorkflowSection({ theme }) {
    return (
        <Box
            component="section"
            sx={{
                maxWidth: 1180,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4 },
                pb: { xs: 5.5, md: 7.5 },
            }}
        >
            <Box
                sx={panelSx(theme, {
                    p: { xs: 1.6, md: 2.2 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '0.92fr 1.08fr' },
                    gap: { xs: 2.2, md: 3 },
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    overflow: 'hidden',
                })}
            >
                <Box>
                    <SectionHeading
                        eyebrow="Workflow"
                        title="Move from association to evidence"
                        description="A typical session moves from trait lookup into signal inspection, gene support, program context, and result downloads."
                        theme={theme}
                        align="left"
                    />
                    <Box
                        sx={{
                            border: `1px solid ${theme.custom.border.soft}`,
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: '#f8fbff',
                        }}
                    >
                        <Box
                            component="img"
                            src={homeFigureBrowserWorkflow}
                            alt="TraitVista research workflow"
                            loading="lazy"
                            sx={{
                                width: '100%',
                                display: 'block',
                                objectFit: 'cover',
                            }}
                        />
                    </Box>
                </Box>
                <Stack spacing={1.1}>
                    {workflowSteps.map((step, index) => {
                        const Icon = step.icon;

                        return (
                            <Box
                                key={step.label}
                                component={RouterLink}
                                to={step.to}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '42px minmax(0, 1fr) auto',
                                    alignItems: 'center',
                                    gap: 1.25,
                                    px: { xs: 1.2, md: 1.4 },
                                    py: 1.15,
                                    borderRadius: 1,
                                    border: `1px solid ${alpha(step.color, 0.15)}`,
                                    bgcolor: alpha(step.color, 0.035),
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    transition: 'background-color 160ms ease, border-color 160ms ease, transform 160ms ease',
                                    '&:hover': {
                                        bgcolor: alpha(step.color, 0.065),
                                        borderColor: alpha(step.color, 0.3),
                                        transform: 'translateX(3px)',
                                    },
                                    '&:focus-visible': {
                                        outline: `3px solid ${alpha(step.color, 0.22)}`,
                                        outlineOffset: 2,
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 1,
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: '#fff',
                                        color: step.color,
                                        boxShadow: '0 8px 18px rgba(15,23,42,0.06)',
                                    }}
                                    aria-hidden="true"
                                >
                                    <Icon sx={{ fontSize: 17 }} />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ color: '#111827', fontSize: '0.93rem', fontWeight: 850, lineHeight: 1.25 }}>
                                        {index + 1}. {step.label}
                                    </Typography>
                                    <Typography sx={captionSx(theme, { mt: 0.25, fontSize: '0.78rem', lineHeight: 1.45 })}>
                                        {step.detail}
                                    </Typography>
                                </Box>
                                <ArrowForward sx={{ color: step.color, fontSize: 16 }} />
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
        </Box>
    );
}

function FeaturedTraitCaseStudy({ theme }) {
    const traitHref = `/trait/${encodeURIComponent(FEATURED_TRAIT.fileId)}`;
    const traitFigureCount = traitFigureCards.filter((item) => item.to.startsWith('/trait/')).length;

    return (
        <Box
            component="section"
            sx={{
                maxWidth: 1180,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4 },
                pb: { xs: 5.5, md: 7.5 },
            }}
        >
            <Box
                sx={panelSx(theme, {
                    p: { xs: 1.6, md: 2.2 },
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    overflow: 'hidden',
                })}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' },
                        gap: { xs: 2.2, lg: 3 },
                        alignItems: 'start',
                    }}
                >
                    <Box>
                        <SectionHeading
                            eyebrow="Featured trait case study"
                            title={FEATURED_TRAIT.name}
                            description="Open a complete example analysis before choosing a query. This trait links GWAS signal views with program and gene-level evidence."
                            theme={theme}
                            align="left"
                        />
                        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                            <Chip label={FEATURED_TRAIT.fileId} size="small" sx={summaryChipSx(theme)} />
                            <Chip label={FEATURED_TRAIT.gwasId} size="small" sx={summaryChipSx(theme)} />
                            <Chip label={`${fmtMetricCount(FEATURED_TRAIT.nSig)} significant signals`} size="small" sx={summaryChipSx(theme)} />
                            <Chip label={`${traitFigureCount} figure views`} size="small" sx={summaryChipSx(theme)} />
                        </Stack>
                        <Button
                            component={RouterLink}
                            to={traitHref}
                            variant="contained"
                            endIcon={<ArrowForward />}
                            sx={{
                                mt: 2,
                                bgcolor: '#1f2933',
                                borderRadius: 999,
                                px: 2.4,
                                '&:hover': { bgcolor: '#111827' },
                            }}
                        >
                            Open This Trait
                        </Button>
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1.35,
                        }}
                    >
                        {featuredTraitPreviewCards.map((item) => {
                            const Icon = item.icon;

                            return (
                                <Box
                                    key={item.title}
                                    component={RouterLink}
                                    to={item.to}
                                    sx={{
                                        minWidth: 0,
                                        borderRadius: 1,
                                        border: `1px solid ${alpha(item.color, 0.16)}`,
                                        bgcolor: alpha(item.color, 0.035),
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        overflow: 'hidden',
                                        transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            borderColor: alpha(item.color, 0.32),
                                            boxShadow: `0 18px 34px ${alpha(item.color, 0.12)}`,
                                        },
                                        '&:focus-visible': {
                                            outline: `3px solid ${alpha(item.color, 0.22)}`,
                                            outlineOffset: 3,
                                        },
                                    }}
                                >
                                    <Box sx={{ aspectRatio: '720 / 420', bgcolor: '#fff', overflow: 'hidden' }}>
                                        <Box
                                            component="img"
                                            src={item.image}
                                            alt=""
                                            loading="lazy"
                                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                        />
                                    </Box>
                                    <Stack direction="row" spacing={0.7} alignItems="center" sx={{ px: 1.2, py: 1.1 }}>
                                        <Icon sx={{ color: item.color, fontSize: 17, flex: '0 0 auto' }} />
                                        <Typography component="h3" sx={{ color: '#111827', fontSize: '0.9rem', fontWeight: 850, lineHeight: 1.2 }}>
                                            {item.title}
                                        </Typography>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
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
    const hasMoreMatches = meta.truncated || meta.totalCount > results.length;

    if (!panelOpen || !canSearch) return null;

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                right: 0,
                zIndex: 70,
                overflow: 'hidden',
                backgroundColor: '#fff',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 22px 48px rgba(15,23,42,0.16)',
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
                                            sx={{ listStyle: 'none', borderBottom: `1px solid ${theme.custom.border.soft}` }}
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
                                                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: theme.palette.text.primary }} title={item.name}>
                                                        {item.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '0.73rem', color: theme.palette.text.secondary, lineHeight: 1.35 }} noWrap title={item.path}>
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
            {hasMoreMatches && !loading && results.length > 0 && (
                <Box
                    sx={{
                        px: 2,
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        flexWrap: 'wrap',
                        bgcolor: theme.custom.surface.subtle,
                        borderTop: `1px solid ${theme.custom.border.soft}`,
                    }}
                >
                    <Typography sx={captionSx(theme, { fontSize: '0.78rem', lineHeight: 1.4 })}>
                        Showing the first {results.length} matches. Open Data Browser to review all {fmtCount(meta.totalCount)} indexed paths.
                    </Typography>
                    <Button
                        size="small"
                        variant="text"
                        endIcon={<ArrowForward sx={{ fontSize: 15 }} />}
                        component={RouterLink}
                        to={resultsBrowserHref}
                        sx={{ flexShrink: 0 }}
                    >
                        Review all
                    </Button>
                </Box>
            )}
        </Paper>
    );
}

function HomeSearch({ theme }) {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [meta, setMeta] = useState({ totalCount: 0, truncated: false });
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [checked, setChecked] = useState(new Set());
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');

    const trimmedQ = q.trim();
    const searchKey = trimmedQ.toLowerCase();
    const canSearch = trimmedQ.length >= 2;
    const fileResults = useMemo(() => results.filter((item) => item.type === 'file'), [results]);
    const folderResults = useMemo(() => results.filter((item) => item.type === 'dir'), [results]);
    const checkedFiles = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)).map((item) => item.path),
        [checked, fileResults],
    );
    const panelOpen = open && canSearch;
    const resultsBrowserHref = buildDataBrowserHref({ search: trimmedQ });

    useEffect(() => {
        setChecked(new Set());
    }, [searchKey]);

    useEffect(() => {
        if (!canSearch) {
            setResults([]);
            setMeta({ totalCount: 0, truncated: false });
            setLoading(false);
            setError('');
            return undefined;
        }

        const cached = getCachedSearchResult(searchKey);
        if (cached) {
            setResults(cached.results);
            setMeta(cached.meta);
            setLoading(false);
            setError('');
            return undefined;
        }

        let cancelled = false;
        const controller = new AbortController();
        setResults([]);
        setMeta({ totalCount: 0, truncated: false });
        setError('');
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const response = await SEARCH_API.get('/search', {
                    params: { q: trimmedQ, limit: 12 },
                    signal: controller.signal,
                });
                if (cancelled) return;
                const payload = {
                    results: response.data?.results || [],
                    meta: {
                        totalCount: response.data?.totalCount || 0,
                        truncated: Boolean(response.data?.truncated),
                        page: response.data?.page || 1,
                        totalPages: response.data?.totalPages || 1,
                    },
                };
                SEARCH_CACHE.set(searchKey, { ...payload, cachedAt: Date.now() });
                setResults(payload.results);
                setMeta(payload.meta);
            } catch (err) {
                if (cancelled || axios.isCancel?.(err) || err.code === 'ERR_CANCELED') return;
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
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [canSearch, searchKey, trimmedQ]);

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
        <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 4.5, md: 6.5 }, position: 'relative', zIndex: 20 }}>
            <Box sx={panelSx(theme, { p: { xs: 1.25, sm: 1.45 }, width: '100%', overflow: 'visible', backgroundColor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)' })}>
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
                                inputProps={{ 'aria-label': 'Search result files and folders' }}
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
    );
}

function DataCoveragePanel({ error, loading, stats, theme }) {
    const metrics = [
        {
            label: 'Traits',
            value: stats?.traits,
            icon: QueryStats,
            color: '#2563eb',
            to: '/trait',
            detail: 'Browse trait metadata and GWAS figures.',
        },
        {
            label: 'Variants',
            value: stats?.variants,
            icon: Storage,
            color: '#0f766e',
            compact: true,
            to: '/trait',
            detail: 'Inspect variant-level GWAS tables by trait.',
        },
        {
            label: 'Programs',
            value: stats?.programs,
            icon: Hub,
            color: '#7c3aed',
            to: '/programs',
            detail: 'Compare trait-linked programs.',
        },
        {
            label: 'Result files',
            value: stats?.dataOutputs,
            icon: InsertDriveFile,
            color: '#b45309',
            to: '/data',
            detail: 'Open and download indexed outputs.',
        },
    ];

    return (
        <Box
            component="section"
            aria-label="Data coverage"
            sx={{
                width: '100%',
                maxWidth: 980,
                mx: 'auto',
                mt: { xs: 3.2, md: 4.2 },
                pt: { xs: 2, md: 2.2 },
                borderTop: `1px solid ${theme.custom.border.soft}`,
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                    gap: { xs: 1.1, md: 1.4 },
                }}
            >
                {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <Box
                            key={metric.label}
                            component={RouterLink}
                            to={metric.to}
                            sx={{
                                minHeight: 78,
                                px: 1.4,
                                py: 1.2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                borderRadius: 1,
                                border: `1px solid ${alpha(metric.color, 0.13)}`,
                                bgcolor: '#fff',
                                color: 'inherit',
                                textDecoration: 'none',
                                boxShadow: '0 10px 24px rgba(15,23,42,0.045)',
                                transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    borderColor: alpha(metric.color, 0.28),
                                    boxShadow: `0 16px 34px ${alpha(metric.color, 0.12)}`,
                                },
                                '&:focus-visible': {
                                    outline: `3px solid ${alpha(metric.color, 0.22)}`,
                                    outlineOffset: 3,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 1,
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: metric.color,
                                    bgcolor: alpha(metric.color, 0.08),
                                    flex: '0 0 auto',
                                }}
                                aria-hidden="true"
                            >
                                <Icon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    sx={{
                                        color: '#111827',
                                        fontSize: { xs: '1.04rem', md: '1.12rem' },
                                        fontWeight: 850,
                                        lineHeight: 1,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {loading ? <Skeleton variant="text" width={68} height={26} /> : fmtMetricCount(metric.value, metric.compact)}
                                </Typography>
                                <Typography sx={{ mt: 0.35, color: '#64748b', fontSize: '0.72rem', lineHeight: 1.2 }}>
                                    {metric.label}
                                </Typography>
                                <Typography sx={{ mt: 0.35, color: '#64748b', fontSize: '0.67rem', lineHeight: 1.25, display: { xs: 'none', lg: 'block' } }}>
                                    {metric.detail}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            <Stack direction="row" spacing={0.8} justifyContent="center" useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Chip label={`Years ${loading ? '-' : fmtYearRange(stats)}`} size="small" sx={summaryChipSx(theme)} />
                <Chip label={`Sources ${loading ? '-' : fmtCount(stats?.sourceBatches)}`} size="small" sx={summaryChipSx(theme)} />
                <Chip label={`Updated ${loading ? '-' : (stats?.latestCollectDate || '-')}`} size="small" sx={summaryChipSx(theme)} />
            </Stack>
            {error && (
                <Typography sx={{ mt: 1, color: theme.palette.warning.dark, fontSize: '0.76rem', textAlign: 'center' }}>
                    Live coverage stats are unavailable.
                </Typography>
            )}
        </Box>
    );
}

function FigureCard({ item }) {
    const theme = useTheme();
    const Icon = item.icon;

    return (
        <Box
            component={RouterLink}
            to={item.to}
            aria-label={`Open ${item.title}`}
            sx={{
                minHeight: { xs: 318, md: 334 },
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                border: '1px solid rgba(226,232,240,0.78)',
                bgcolor: 'rgba(255,255,255,0.96)',
                color: 'inherit',
                overflow: 'hidden',
                position: 'relative',
                textDecoration: 'none',
                boxShadow: '0 14px 34px rgba(15,23,42,0.06)',
                transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                '&:hover': {
                    transform: 'translateY(-5px)',
                    borderColor: alpha(item.color, 0.28),
                    boxShadow: `0 22px 48px ${alpha(item.color, 0.15)}`,
                },
                '&:hover .figure-card-description, &:focus-visible .figure-card-description': {
                    opacity: 1,
                    transform: 'translateY(0)',
                },
                '&:focus-visible': {
                    outline: `3px solid ${alpha(item.color, 0.24)}`,
                    outlineOffset: 3,
                },
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '720 / 420',
                    overflow: 'hidden',
                    bgcolor: alpha(item.color, 0.035),
                }}
            >
                <Box
                    component="img"
                    src={item.image}
                    alt=""
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transform: 'scale(1.06)',
                        transformOrigin: 'center',
                    }}
                />
                <Box
                    className="figure-card-description"
                    aria-hidden="true"
                    sx={{
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        bottom: 12,
                        px: 1.2,
                        py: 0.85,
                        borderRadius: 1,
                        bgcolor: 'rgba(15,23,42,0.82)',
                        color: '#fff',
                        fontSize: '0.78rem',
                        lineHeight: 1.45,
                        opacity: 0,
                        transform: 'translateY(8px)',
                        transition: 'opacity 160ms ease, transform 160ms ease',
                    }}
                >
                    {item.description}
                </Box>
            </Box>
            <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ px: 1.5, pt: 1.25, minWidth: 0 }}>
                <Icon sx={{ color: item.color, fontSize: 18, flex: '0 0 auto' }} />
                <Box sx={{ minWidth: 0 }}>
                    <Typography component="h3" sx={{ color: '#111827', fontSize: '1rem', fontWeight: 850, lineHeight: 1.22 }}>
                        {item.title}
                    </Typography>
                    <Typography sx={captionSx(theme, { mt: 0.55, fontSize: '0.78rem', lineHeight: 1.42 })}>
                        {item.description}
                    </Typography>
                </Box>
            </Stack>
            <Stack direction="row" spacing={0.55} alignItems="center" sx={{ mt: 'auto', px: 1.5, pt: 1, pb: 1.25, color: item.color }}>
                <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 800, color: 'inherit' }}>
                    Open
                </Typography>
                <ArrowForward sx={{ fontSize: 14 }} />
            </Stack>
        </Box>
    );
}

function FigureGateway({ items }) {
    const theme = useTheme();

    return (
        <Box
            component="section"
            sx={{
                maxWidth: 1180,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4 },
                pb: { xs: 6, md: 8 },
            }}
        >
            <SectionHeading
                eyebrow="Evidence modules"
                title="Open the data layer you need"
                description="Each module links to a real browser view for GWAS variants, Manhattan hits, gene evidence, program context, cross-trait comparison, or result files."
                theme={theme}
            />
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: { xs: 2.2, md: 2.8 },
                }}
            >
                {items.map((item) => (
                    <FigureCard key={item.title} item={item} />
                ))}
            </Box>
        </Box>
    );
}

function Home() {
    const theme = useTheme();
    const [homeStats, setHomeStats] = useState(null);
    const [homeStatsError, setHomeStatsError] = useState('');
    const homeStatsLoading = !homeStats && !homeStatsError;

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

    return (
        <Box sx={{ width: '100%', minHeight: '100%', color: '#1f2933', bgcolor: '#f7fafc', mx: 'auto' }}>
            <Box
                component="section"
                sx={{
                    maxWidth: 1120,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4 },
                    pt: { xs: 4.6, md: 6.2 },
                    pb: { xs: 4.2, md: 5.4 },
                    textAlign: 'center',
                }}
            >
                <Typography sx={{ color: accent, fontFamily: 'Georgia, Cambria, serif', fontSize: { xs: '1.1rem', md: '1.28rem' }, fontWeight: 850, lineHeight: 1.1, mb: 0.8 }}>
                    Welcome to
                </Typography>
                <Typography
                    component="h1"
                    sx={{
                        color: '#2a2d33',
                        fontFamily: 'Georgia, Cambria, serif',
                        fontSize: { xs: '3rem', sm: '4.6rem', md: '5.8rem' },
                        fontWeight: 850,
                        lineHeight: 0.94,
                        letterSpacing: 0,
                    }}
                >
                    {siteName}
                </Typography>
                <Typography
                    sx={{
                        maxWidth: 720,
                        mx: 'auto',
                        mt: { xs: 2, md: 2.4 },
                        color: '#4b5563',
                        fontFamily: 'Georgia, Cambria, serif',
                        fontSize: { xs: '1.02rem', md: '1.14rem' },
                        lineHeight: 1.72,
                    }}
                >
                    A GWAS trait browser for moving from association signals to gene and program evidence.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} justifyContent="center" sx={{ mt: { xs: 2.4, md: 3 } }}>
                    <Button
                        variant="contained"
                        size="large"
                        endIcon={<ArrowForward />}
                        component={RouterLink}
                        to="/trait"
                        sx={{
                            px: 3.2,
                            py: 1.15,
                            borderRadius: 999,
                            bgcolor: '#1f2933',
                            '&:hover': { bgcolor: '#111827' },
                        }}
                    >
                        Start With a Trait
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        endIcon={<InsertDriveFile />}
                        component={RouterLink}
                        to="/data"
                        sx={{
                            px: 2.8,
                            py: 1.05,
                            borderRadius: 999,
                            color: '#1f2933',
                            borderColor: 'rgba(31,41,51,0.22)',
                            bgcolor: 'rgba(255,255,255,0.72)',
                            '&:hover': {
                                borderColor: 'rgba(31,41,51,0.36)',
                                bgcolor: '#fff',
                            },
                        }}
                    >
                        Browse Result Files
                    </Button>
                </Stack>

                <DataCoveragePanel
                    error={homeStatsError}
                    loading={homeStatsLoading}
                    stats={homeStats}
                    theme={theme}
                />
            </Box>

            <ExploreByQuestion theme={theme} />

            <WorkflowSection theme={theme} />

            <FeaturedTraitCaseStudy theme={theme} />

            <HomeSearch theme={theme} />

            <FigureGateway items={traitFigureCards} />

            <ReleaseLogSection
                heading="Recent releases"
                subtitle="The latest milestones stay on Home; the complete release log lives in About."
                limit={3}
                newestFirst
                outerSx={{
                    maxWidth: 1180,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4 },
                    pb: { xs: 7, md: 9 },
                }}
                showNotes={false}
                action={(
                    <Button
                        component={RouterLink}
                        to={`/about#${RELEASE_LOG_ANCHOR}`}
                        size="small"
                        variant="outlined"
                        endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                    >
                        Full release log
                    </Button>
                )}
            />
        </Box>
    );
}

export default Home;
