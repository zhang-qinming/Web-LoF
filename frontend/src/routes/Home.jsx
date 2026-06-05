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
import homeFigureQqPlot from '../assets/home/home-figure-qq-plot.svg';
import homeFigureTraitProgramNetwork from '../assets/home/home-figure-trait-program-network.svg';
import homeFigureBrowserWorkflow from '../assets/home/home-figure-browser-workflow.svg';
import homeFigureDataBrowser from '../assets/home/home-figure-data-browser.svg';
import homeFigureVariantDetail from '../assets/home/home-figure-variant-detail.svg';

const accent = '#ff6b4a';
const siteName = 'TraitVista';
const SEARCH_API = axios.create({ baseURL: '/api/data' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;
const HOME_STATS_CACHE_KEY = 'traitvista.homeStats.v1';
const HOME_STATS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
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
let homeStatsMemoryCache = null;

const quickSearchSeeds = [
    { label: 'Manhattan', query: 'gwas_manhattan' },
    { label: 'Burden', query: 'burden_volcano' },
    { label: 'Programs', query: 'program_regulator' },
    { label: 'Heatmap', query: 'cross_trait_heatmap' },
];

const loadingBarSx = {
    height: 3,
    bgcolor: 'rgba(226,232,240,0.72)',
    '& .MuiLinearProgress-bar': {
        background: 'linear-gradient(90deg, #2563eb, #0f766e)',
    },
};

const workflowSteps = [
    {
        label: 'Locate a trait',
        detail: 'Trait, LoF ID, or GWAS ID.',
        action: 'Open table',
        to: '/trait',
        icon: Search,
        color: '#2563eb',
    },
    {
        label: 'GWAS peaks',
        detail: 'Manhattan signal view.',
        action: 'View plot',
        to: traitTabPath('manhattan'),
        icon: QueryStats,
        color: '#0284c7',
    },
    {
        label: 'Gene evidence',
        detail: 'Burden, posterior, QQ.',
        action: 'Review genes',
        to: traitTabPath('gene-evidence'),
        icon: Biotech,
        color: '#7c3aed',
    },
    {
        label: 'Programs',
        detail: 'Scatter and graph context.',
        action: 'Open programs',
        to: traitTabPath('program-scatter'),
        icon: Hub,
        color: '#0f766e',
    },
    {
        label: 'Result files',
        detail: 'Browse and download TSVs.',
        action: 'Open files',
        to: '/data',
        icon: FileDownload,
        color: '#b45309',
    },
];

const heroPreviewItems = [
    {
        title: 'Program context',
        description: 'Program x regulator',
        image: homeFigureProgramScatter,
        color: '#0f766e',
    },
    {
        title: 'Variant detail',
        description: 'Locus evidence',
        image: homeFigureVariantDetail,
        color: '#2563eb',
    },
];

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
        description: 'Program x regulator',
        image: homeFigureProgramScatter,
        to: traitTabPath('program-scatter'),
        icon: Hub,
        color: '#0284c7',
    },
    {
        title: 'Trait Program Graph',
        description: 'Trait-program graph',
        image: homeFigureTraitProgramNetwork,
        to: traitTabPath('trait-program-graph'),
        icon: Hub,
        color: '#0f766e',
    },
    {
        title: 'Manhattan',
        description: 'GWAS signal view',
        image: homeFigureGwasManhattan,
        to: traitTabPath('manhattan'),
        icon: QueryStats,
        color: '#2563eb',
    },
    {
        title: 'Burden Volcano',
        description: 'LoF burden genes',
        image: homeFigureBurdenVolcano,
        to: traitTabPath('burden-volcano'),
        icon: QueryStats,
        color: '#ea580c',
    },
    {
        title: 'Posterior Volcano',
        description: 'GeneBayes effects',
        image: homeFigurePosteriorVolcano,
        to: traitTabPath('posterior-volcano'),
        icon: QueryStats,
        color: '#a21caf',
    },
    {
        title: 'Gene Evidence',
        description: 'Gene-level evidence',
        image: homeFigureLofGene,
        to: traitTabPath('gene-evidence'),
        icon: Biotech,
        color: '#7c3aed',
    },
    {
        title: 'Gene QQ',
        description: 'Gene-level QQ',
        image: homeFigureQqPlot,
        to: traitTabPath('gene-qq'),
        icon: Biotech,
        color: '#1d4ed8',
    },
    {
        title: 'Cross-trait Heatmap',
        description: 'Cross-trait comparison',
        image: homeFigureCrossTraitHeatmap,
        to: traitTabPath('cross-trait-heatmap'),
        icon: QueryStats,
        color: '#c2410c',
    },
    {
        title: 'Result Files',
        description: 'Data browser',
        image: homeFigureDataBrowser,
        to: '/data',
        icon: InsertDriveFile,
        color: '#b45309',
    },
];

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

function readHomeStatsCache({ allowStale = false } = {}) {
    const readCachedEntry = (cached) => {
        if (!cached?.stats || !cached.cachedAt) return null;
        const fresh = Date.now() - cached.cachedAt < HOME_STATS_CACHE_TTL_MS;
        if (!fresh && !allowStale) return null;
        return { stats: cached.stats, fresh };
    };

    const memoryEntry = readCachedEntry(homeStatsMemoryCache);
    if (memoryEntry) return memoryEntry;
    if (typeof window === 'undefined') return null;

    try {
        const storage = window.localStorage;
        if (!storage) return null;
        const raw = storage.getItem(HOME_STATS_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        const storageEntry = readCachedEntry(cached);
        if (storageEntry) homeStatsMemoryCache = cached;
        return storageEntry;
    } catch {
        return null;
    }
}

function writeHomeStatsCache(stats) {
    if (!stats) return;

    homeStatsMemoryCache = {
        stats,
        cachedAt: Date.now(),
    };
    if (typeof window === 'undefined') return;

    try {
        const storage = window.localStorage;
        if (!storage) return;
        storage.setItem(HOME_STATS_CACHE_KEY, JSON.stringify(homeStatsMemoryCache));
    } catch {
        // Cache failure should not affect the home page.
    }
}

function SectionHeading({ eyebrow, title, description, theme, align = 'center' }) {
    return (
        <Stack spacing={0.65} alignItems={align === 'center' ? 'center' : 'flex-start'} sx={{ mb: { xs: 2.5, md: 3.4 } }}>
            {eyebrow && (
                <Typography sx={{ color: accent, fontSize: '0.76rem', fontWeight: 850, letterSpacing: '0.16em', textTransform: 'none' }}>
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

function HomeSearch({ stats, statsError, statsLoading, theme }) {
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

    const runQuickSearch = (query) => {
        const nextQ = query.trim();
        const nextKey = nextQ.toLowerCase();
        setQ(nextQ);
        setOpen(true);
        setChecked(new Set());
        setError('');

        if (nextQ.length < 2) return;

        const cached = getCachedSearchResult(nextKey);
        if (cached) {
            setResults(cached.results);
            setMeta(cached.meta);
            setLoading(false);
            return;
        }

        setResults([]);
        setMeta({ totalCount: 0, truncated: false });
        setLoading(true);
    };

    return (
        <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 5, md: 6.8 }, position: 'relative', zIndex: 20 }}>
            <Box sx={panelSx(theme, { p: { xs: 1.5, sm: 1.8, md: 2.1 }, width: '100%', overflow: 'visible', backgroundColor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)' })}>
                <Stack spacing={{ xs: 1.5, md: 1.8 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'none', color: theme.palette.secondary.dark }}>
                                Search files
                            </Typography>
                            <Typography sx={{ mt: 0.45, color: '#4b5563', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                Find output files and folders.
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
                    <ClickAwayListener onClickAway={() => setOpen(false)}>
                        <Stack spacing={1.1}>
                            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                                {quickSearchSeeds.map((item) => (
                                    <Chip
                                        key={item.query}
                                        label={item.label}
                                        onClick={() => runQuickSearch(item.query)}
                                        sx={summaryChipSx(theme, {
                                            cursor: 'pointer',
                                            backgroundColor: alpha(theme.palette.primary.main, 0.07),
                                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                                        })}
                                    />
                                ))}
                            </Stack>
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
                        </Stack>
                    </ClickAwayListener>
                    <DataCoveragePanel
                        embedded
                        error={statsError}
                        loading={statsLoading}
                        stats={stats}
                        theme={theme}
                    />
                </Stack>
            </Box>
        </Box>
    );
}

function DataCoveragePanel({ embedded = false, error, loading, stats, theme }) {
    const metrics = [
        {
            label: 'Traits',
            value: stats?.traits,
            icon: QueryStats,
            color: '#2563eb',
        },
        {
            label: 'Variants',
            value: stats?.variants,
            icon: Storage,
            color: '#0f766e',
            compact: true,
        },
        {
            label: 'Programs',
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
            component={embedded ? 'div' : 'section'}
            aria-label="Data coverage"
            sx={{
                width: '100%',
                maxWidth: embedded ? '100%' : 980,
                mx: 'auto',
                mt: embedded ? { xs: 0.4, md: 0.6 } : { xs: 3.2, md: 4.2 },
                pt: embedded ? { xs: 1.6, md: 1.8 } : { xs: 2, md: 2.2 },
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
                                boxShadow: '0 10px 24px rgba(15,23,42,0.045)',
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
                            </Box>
                        </Box>
                    );
                })}
            </Box>
            {error && (
                <Typography sx={{ mt: 1, color: theme.palette.warning.dark, fontSize: '0.76rem', textAlign: 'center' }}>
                    Live coverage stats are unavailable.
                </Typography>
            )}
        </Box>
    );
}

function HeroVisual({ theme }) {
    return (
        <Box
            sx={{
                position: 'relative',
                minWidth: 0,
                px: { xs: 1, sm: 1.4 },
                pt: { xs: 1, sm: 1.4 },
                pb: { xs: 1.2, sm: 1.5 },
                borderRadius: 1,
                background: [
                    'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(240,249,255,0.7))',
                    'radial-gradient(circle at 14% 10%, rgba(37,99,235,0.14), transparent 32%)',
                    'radial-gradient(circle at 92% 92%, rgba(255,107,74,0.13), transparent 35%)',
                ].join(', '),
                border: `1px solid ${alpha('#2563eb', 0.12)}`,
                boxShadow: '0 28px 70px rgba(15,23,42,0.12)',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)',
                    backgroundSize: '34px 34px',
                    maskImage: 'linear-gradient(135deg, rgba(0,0,0,0.9), transparent 78%)',
                    pointerEvents: 'none',
                },
            }}
        >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                    sx={{
                        display: 'block',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: `1px solid ${theme.custom.border.soft}`,
                        bgcolor: '#fff',
                        boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
                    }}
                >
                    <Box
                        component="img"
                        src={homeFigureGwasManhattan}
                        alt="Trait Manhattan plot preview"
                        sx={{
                            width: '100%',
                            aspectRatio: '720 / 420',
                            objectFit: 'cover',
                            display: 'block',
                            bgcolor: '#f8fafc',
                        }}
                    />
                    <Box
                        sx={{
                            px: { xs: 1.3, sm: 1.6 },
                            py: { xs: 1.1, sm: 1.25 },
                            display: 'flex',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1,
                            flexDirection: { xs: 'column', sm: 'row' },
                            borderTop: `1px solid ${theme.custom.border.soft}`,
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: '#111827', fontSize: { xs: '0.94rem', md: '1rem' }, fontWeight: 850, lineHeight: 1.2 }}>
                                Featured result preview
                            </Typography>
                            <Typography sx={captionSx(theme, { mt: 0.35, fontSize: '0.76rem', lineHeight: 1.35 })}>
                                {FEATURED_TRAIT.name}
                            </Typography>
                        </Box>
                        <Chip
                            label={FEATURED_TRAIT.fileId}
                            size="small"
                            sx={summaryChipSx(theme, {
                                flexShrink: 0,
                                color: '#1d4ed8',
                                bgcolor: alpha('#2563eb', 0.08),
                                border: `1px solid ${alpha('#2563eb', 0.18)}`,
                            })}
                        />
                    </Box>
                </Box>

                <Box
                    sx={{
                        mt: 1,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1,
                    }}
                >
                    {heroPreviewItems.map((item) => (
                        <Box
                            key={item.title}
                            sx={{
                                minWidth: 0,
                                display: 'grid',
                                gridTemplateColumns: '96px minmax(0, 1fr)',
                                gap: 0.9,
                                alignItems: 'center',
                                p: 0.8,
                                borderRadius: 1,
                                bgcolor: 'rgba(255,255,255,0.86)',
                                border: `1px solid ${alpha(item.color, 0.14)}`,
                            }}
                        >
                            <Box
                                component="img"
                                src={item.image}
                                alt=""
                                aria-hidden="true"
                                sx={{
                                    width: '100%',
                                    aspectRatio: '720 / 420',
                                    objectFit: 'cover',
                                    display: 'block',
                                    borderRadius: 1,
                                    bgcolor: alpha(item.color, 0.04),
                                }}
                            />
                            <Box sx={{ minWidth: 0 }}>
                                <Typography component="h3" sx={{ color: '#111827', fontSize: '0.84rem', fontWeight: 850, lineHeight: 1.2 }}>
                                    {item.title}
                                </Typography>
                                <Typography sx={captionSx(theme, { mt: 0.25, fontSize: '0.72rem', lineHeight: 1.35 })}>
                                    {item.description}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

function WorkflowSection() {
    const theme = useTheme();

    return (
        <Box
            component="section"
            sx={{
                maxWidth: 1180,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4 },
                pb: { xs: 5.6, md: 7.2 },
            }}
        >
            <SectionHeading
                eyebrow="Research shortcuts"
                title="Choose the task you need next"
                theme={theme}
                align="left"
            />
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, 0.88fr) minmax(0, 1.12fr)' },
                    gap: { xs: 2.2, md: 3.4 },
                    alignItems: 'center',
                    minWidth: 0,
                }}
            >
                <Box
                    sx={panelSx(theme, {
                        p: { xs: 1.2, md: 1.5 },
                        bgcolor: 'rgba(255,255,255,0.9)',
                        overflow: 'hidden',
                    })}
                >
                    <Box
                        component="img"
                        src={homeFigureBrowserWorkflow}
                        alt="TraitVista research workflow overview"
                        loading="lazy"
                        sx={{
                            width: '100%',
                            display: 'block',
                            aspectRatio: '720 / 420',
                            objectFit: 'cover',
                            borderRadius: 1,
                            bgcolor: '#f8fafc',
                        }}
                    />
                </Box>

                <Box
                    sx={{
                        minWidth: 0,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                        gap: { xs: 1.3, md: 1.5 },
                    }}
                >
                    {workflowSteps.map((step, index) => {
                        const Icon = step.icon;

                        return (
                            <Box
                                key={step.label}
                                component={RouterLink}
                                to={step.to}
                                aria-label={step.action}
                                sx={{
                                    minHeight: { xs: 126, md: 134 },
                                    gridColumn: { sm: index === workflowSteps.length - 1 ? 'span 2' : 'auto', md: 'auto' },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    p: { xs: 1.45, md: 1.6 },
                                    borderRadius: 1,
                                    border: `1px solid ${alpha(step.color, 0.14)}`,
                                    bgcolor: '#fff',
                                    boxShadow: '0 12px 30px rgba(15,23,42,0.045)',
                                    color: 'inherit',
                                    textDecoration: 'none',
                                    transition: 'transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease',
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        borderColor: alpha(step.color, 0.3),
                                        boxShadow: `0 18px 42px ${alpha(step.color, 0.13)}`,
                                    },
                                    '&:focus-visible': {
                                        outline: `3px solid ${alpha(step.color, 0.22)}`,
                                        outlineOffset: 3,
                                    },
                                }}
                            >
                                <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 1,
                                            display: 'grid',
                                            placeItems: 'center',
                                            color: step.color,
                                            bgcolor: alpha(step.color, 0.08),
                                            border: `1px solid ${alpha(step.color, 0.14)}`,
                                            flex: '0 0 auto',
                                        }}
                                        aria-hidden="true"
                                    >
                                        <Icon sx={{ fontSize: 19 }} />
                                    </Box>
                                    <Typography component="h3" sx={{ color: '#111827', fontSize: '0.98rem', fontWeight: 850, lineHeight: 1.2 }}>
                                        {step.label}
                                    </Typography>
                                </Stack>
                                <Typography sx={captionSx(theme, { fontSize: '0.8rem', lineHeight: 1.42 })}>
                                    {step.detail}
                                </Typography>
                                <Stack direction="row" spacing={0.55} alignItems="center" sx={{ mt: 'auto', color: step.color }}>
                                    <Typography component="span" sx={{ color: 'inherit', fontSize: '0.76rem', fontWeight: 850 }}>
                                        {step.action}
                                    </Typography>
                                    <ArrowForward sx={{ fontSize: 14 }} />
                                </Stack>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}

function FigureCard({ item }) {
    const Icon = item.icon;

    return (
        <Box
            component={RouterLink}
            to={item.to}
            aria-label={`Open ${item.title}`}
            sx={{
                minHeight: { xs: 292, md: 304 },
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
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.5, pt: 1.25, minWidth: 0 }}>
                <Icon sx={{ color: item.color, fontSize: 18, flex: '0 0 auto' }} />
                <Typography component="h3" sx={{ color: '#111827', fontSize: '1rem', fontWeight: 850, lineHeight: 1.22 }}>
                    {item.title}
                </Typography>
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
                title="Result views"
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
    const [homeStats, setHomeStats] = useState(() => readHomeStatsCache({ allowStale: true })?.stats || null);
    const [homeStatsError, setHomeStatsError] = useState('');
    const homeStatsLoading = !homeStats && !homeStatsError;

    useEffect(() => {
        const cached = readHomeStatsCache();
        if (cached?.fresh) return undefined;

        let cancelled = false;

        axios.get('/api/home/stats')
            .then((response) => {
                if (cancelled) return;
                const stats = response.data || {};
                setHomeStats(stats);
                setHomeStatsError('');
                writeHomeStatsCache(stats);
            })
            .catch((err) => {
                if (cancelled) return;
                const stale = readHomeStatsCache({ allowStale: true });
                if (stale?.stats) setHomeStats(stale.stats);
                else setHomeStats(null);
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
                    maxWidth: 1180,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4 },
                    pt: { xs: 3.4, md: 4.6, lg: 5.4 },
                    pb: { xs: 4.4, md: 5.4 },
                }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 0.82fr) minmax(420px, 1fr)' },
                        gap: { xs: 3, md: 4.2, lg: 5 },
                        alignItems: 'center',
                    }}
                >
                    <Box sx={{ minWidth: 0, textAlign: { xs: 'center', md: 'left' } }}>
                        <Typography sx={{ color: accent, fontFamily: 'Georgia, Cambria, serif', fontSize: 'clamp(1rem, 1.15vw, 1.22rem)', fontWeight: 850, lineHeight: 1.1, mb: 0.8 }}>
                            Welcome to
                        </Typography>
                        <Typography
                            component="h1"
                            sx={{
                                color: '#2a2d33',
                                fontFamily: 'Georgia, Cambria, serif',
                                fontSize: 'clamp(2.85rem, 5.7vw, 5.15rem)',
                                fontWeight: 850,
                                lineHeight: 0.94,
                                letterSpacing: 0,
                            }}
                        >
                            {siteName}
                        </Typography>
                        <Typography
                            sx={{
                                maxWidth: 620,
                                mx: { xs: 'auto', md: 0 },
                                mt: { xs: 2, md: 2.4 },
                                color: '#4b5563',
                                fontFamily: 'Georgia, Cambria, serif',
                                fontSize: 'clamp(1rem, 1.05vw, 1.1rem)',
                                lineHeight: 1.72,
                            }}
                        >
                            A GWAS trait browser for moving from trait metadata to Manhattan peaks, gene evidence, program context, and downloadable result files.
                        </Typography>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.1}
                            justifyContent={{ xs: 'center', md: 'flex-start' }}
                            sx={{ mt: { xs: 2.4, md: 3 } }}
                        >
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
                                Browse Traits
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
                                Result Files
                            </Button>
                        </Stack>
                    </Box>

                    <HeroVisual theme={theme} />
                </Box>
            </Box>

            <HomeSearch
                stats={homeStats}
                statsError={homeStatsError}
                statsLoading={homeStatsLoading}
                theme={theme}
            />

            <WorkflowSection />

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
