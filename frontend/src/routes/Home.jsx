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
    Close,
    FileDownload,
    Folder,
    InsertDriveFile,
    Search,
} from '@mui/icons-material';
import axios from 'axios';
import ReleaseLogSection from '../components/ReleaseLogSection';
import { RELEASE_LOG_ANCHOR } from '../components/releaseLogData';
import { downloadDataPaths } from '../utils/download';
import { APP_SHELL_MAX_WIDTH, captionSx, panelSx, summaryChipSx } from '../themeUtils';
import homeFigureBurdenVolcano from '../assets/home/home-figure-burden-volcano.svg';
import homeFigureCrossTraitHeatmap from '../assets/home/home-figure-cross-trait-heatmap.svg';
import homeFigureGwasManhattan from '../assets/home/home-figure-gwas-manhattan.svg';
import homeFigureLofGene from '../assets/home/home-figure-lof-gene.svg';
import homeFigurePosteriorVolcano from '../assets/home/home-figure-posterior-volcano.svg';
import homeFigureProgramScatter from '../assets/home/home-figure-program-scatter.svg';
import homeFigureQqPlot from '../assets/home/home-figure-qq-plot.svg';
import homeFigureTraitProgramNetwork from '../assets/home/home-figure-trait-program-network.svg';
import homeFigureDataBrowser from '../assets/home/home-figure-data-browser.svg';
import homeFigureProgramVolcano from '../assets/home/home-figure-program-volcano.svg';
import homeFigureTraitCorrelation from '../assets/home/home-figure-trait-correlation.svg';
import homeFigureVariantDetail from '../assets/home/home-figure-variant-detail.svg';

const accent = '#ff6b4a';
const siteName = 'Gene-Program-Trait Atlas';
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
        description: 'Review program and regulator burden scores with highlighted outlier programs.',
        image: homeFigureProgramScatter,
        to: traitTabPath('program-scatter'),
        color: '#0284c7',
    },
    {
        title: 'Trait Program Graph',
        description: 'Open the network view linking traits, programs, and gene-level evidence.',
        image: homeFigureTraitProgramNetwork,
        to: traitTabPath('trait-program-graph'),
        color: '#0f766e',
    },
    {
        title: 'Manhattan',
        description: 'Inspect genome-wide variant signals by chromosome for the selected trait.',
        image: homeFigureGwasManhattan,
        to: traitTabPath('manhattan'),
        color: '#2563eb',
    },
    {
        title: 'Burden Volcano',
        description: 'Compare LoF burden effects and significance across candidate genes.',
        image: homeFigureBurdenVolcano,
        to: traitTabPath('burden-volcano'),
        color: '#ea580c',
    },
    {
        title: 'Posterior Volcano',
        description: 'Explore GeneBayes posterior effects and gene-level association strength.',
        image: homeFigurePosteriorVolcano,
        to: traitTabPath('posterior-volcano'),
        color: '#a21caf',
    },
    {
        title: 'Gene Evidence',
        description: 'Move from trait associations into gene-centered supporting evidence.',
        image: homeFigureLofGene,
        to: traitTabPath('gene-evidence'),
        color: '#7c3aed',
    },
    {
        title: 'Gene QQ',
        description: 'Check gene-level test calibration and tail behavior in the QQ view.',
        image: homeFigureQqPlot,
        to: traitTabPath('gene-qq'),
        color: '#1d4ed8',
    },
    {
        title: 'Cross-trait Heatmap',
        description: 'Compare related traits across shared genes and posterior evidence.',
        image: homeFigureCrossTraitHeatmap,
        to: traitTabPath('cross-trait-heatmap'),
        color: '#c2410c',
    },
    {
        title: 'Program Volcano',
        description: 'Review program-trait effects and highlighted cellular program signals.',
        image: homeFigureProgramVolcano,
        to: traitTabPath('program-scatter'),
        color: '#7c3aed',
    },
    {
        title: 'Trait Correlation',
        description: 'Compare GeneBayes effect profiles across shared genes with Spearman or Pearson correlation.',
        image: homeFigureTraitCorrelation,
        to: traitTabPath('trait-correlation'),
        color: '#2563eb',
    },
    {
        title: 'Trait Detail',
        description: 'Open the trait metadata page with available modules and result links.',
        image: homeFigureVariantDetail,
        to: '/trait',
        color: '#d97706',
    },
    {
        title: 'Data Browser',
        description: 'Search indexed project outputs and download the underlying result files.',
        image: homeFigureDataBrowser,
        to: '/data',
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

function CoverageGlyph({ color, kind }) {
    const common = {
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: 2,
    };

    return (
        <Box
            component="svg"
            viewBox="0 0 40 40"
            sx={{
                width: { xs: 25, md: 28 },
                height: { xs: 25, md: 28 },
                color,
                overflow: 'visible',
            }}
            aria-hidden="true"
        >
            {kind === 'traits' && (
                <>
                    <path {...common} d="M9 30V11M9 30h23" opacity="0.48" />
                    <path {...common} d="m11 25 6-7 5 4 8-11" />
                    <circle cx="11" cy="25" r="2.2" fill="currentColor" />
                    <circle cx="17" cy="18" r="2.2" fill="currentColor" opacity="0.72" />
                    <circle cx="22" cy="22" r="2.2" fill="currentColor" opacity="0.72" />
                    <circle cx="30" cy="11" r="2.8" fill="currentColor" />
                </>
            )}
            {kind === 'variants' && (
                <>
                    <path {...common} d="M13 8c0 8 14 16 14 24M27 8c0 8-14 16-14 24" />
                    <path {...common} d="M15 12h10M16 17h8M16 23h8M15 28h10" opacity="0.5" />
                    <circle cx="27" cy="8" r="2.5" fill="currentColor" />
                    <circle cx="13" cy="32" r="2.5" fill="currentColor" opacity="0.72" />
                </>
            )}
            {kind === 'programs' && (
                <>
                    <path {...common} d="M20 19 12 12M20 19l8-7M20 19v10" opacity="0.58" />
                    <rect x="8" y="8" width="8" height="8" rx="2.2" {...common} />
                    <rect x="24" y="8" width="8" height="8" rx="2.2" {...common} />
                    <rect x="16" y="25" width="8" height="8" rx="2.2" {...common} />
                    <circle cx="20" cy="19" r="3.4" fill="currentColor" />
                </>
            )}
            {kind === 'outputs' && (
                <>
                    <path {...common} d="M14 9h10l5 5v17H14V9Z" />
                    <path {...common} d="M24 9v6h5M18 21h7M18 26h7" opacity="0.62" />
                    <path {...common} d="M10 13v21h15" opacity="0.48" />
                    <circle cx="29" cy="31" r="2.6" fill="currentColor" />
                </>
            )}
        </Box>
    );
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

function HomeSearch({
    embedded = false,
    showCoverage = true,
    stats,
    statsError,
    statsLoading,
    theme,
}) {
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
        <Box
            component={embedded ? 'div' : 'section'}
            sx={{
                maxWidth: embedded ? '100%' : 1040,
                mx: 'auto',
                px: embedded ? 0 : { xs: 2, sm: 3, lg: 4 },
                pb: embedded ? 0 : { xs: 5, md: 6.2 },
                position: 'relative',
                zIndex: 20,
            }}
        >
            <Box sx={panelSx(theme, { p: { xs: 1.5, sm: 1.8, md: 2.1 }, width: '100%', overflow: 'visible', backgroundColor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)' })}>
                <Stack spacing={{ xs: 1.5, md: 1.8 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', color: '#111827' }}>
                                Search files
                            </Typography>
                            <Typography sx={{ mt: 0.45, color: '#4b5563', fontSize: '0.82rem', lineHeight: 1.5 }}>
                                Find output files and folders.
                            </Typography>
                        </Box>
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
                                placeholder="e.g. GCST90081631"
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
                    {showCoverage && (
                        <DataCoveragePanel
                            embedded
                            error={statsError}
                            loading={statsLoading}
                            stats={stats}
                            theme={theme}
                        />
                    )}
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
            kind: 'traits',
            color: '#2563eb',
        },
        {
            label: 'Variants',
            value: stats?.variants,
            kind: 'variants',
            color: '#0f766e',
            compact: true,
        },
        {
            label: 'Programs',
            value: stats?.programs,
            kind: 'programs',
            color: '#7c3aed',
        },
        {
            label: 'Data outputs',
            value: stats?.dataOutputs,
            kind: 'outputs',
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
                {metrics.map((metric) => (
                        <Box
                            key={metric.label}
                            sx={{
                                minHeight: { xs: 92, md: 96 },
                                px: { xs: 1.5, md: 1.7 },
                                py: { xs: 1.35, md: 1.45 },
                                display: 'flex',
                                alignItems: 'center',
                                gap: { xs: 1, md: 1.15 },
                                borderRadius: 1,
                                border: `1px solid ${alpha(metric.color, 0.13)}`,
                                bgcolor: '#fff',
                                boxShadow: '0 10px 24px rgba(15,23,42,0.045)',
                            }}
                        >
                            <Box
                                sx={{
                                    width: { xs: 38, md: 42 },
                                    height: { xs: 38, md: 42 },
                                    borderRadius: 1,
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: metric.color,
                                    bgcolor: alpha(metric.color, 0.08),
                                    flex: '0 0 auto',
                                }}
                                aria-hidden="true"
                            >
                                <CoverageGlyph color={metric.color} kind={metric.kind} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    sx={{
                                        color: '#111827',
                                        fontSize: { xs: '1.35rem', md: '1.55rem' },
                                        fontWeight: 780,
                                        lineHeight: 1,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {loading ? <Skeleton variant="text" width={82} height={34} /> : fmtMetricCount(metric.value, metric.compact)}
                                </Typography>
                                <Typography sx={{ mt: 0.55, color: '#64748b', fontSize: { xs: '0.76rem', md: '0.8rem' }, lineHeight: 1.2 }}>
                                    {metric.label}
                                </Typography>
                            </Box>
                        </Box>
                ))}
            </Box>
            {error && (
                <Typography sx={{ mt: 1, color: theme.palette.warning.dark, fontSize: '0.76rem', textAlign: 'center' }}>
                    Live coverage stats are unavailable.
                </Typography>
            )}
        </Box>
    );
}

function FigureCard({ item }) {
    return (
        <Box
            component={RouterLink}
            to={item.to}
            aria-label={`Open ${item.title}`}
            sx={{
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
                transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: alpha(item.color, 0.28),
                    boxShadow: `0 22px 48px ${alpha(item.color, 0.15)}`,
                },
                '&:hover .figure-card-image, &:focus-visible .figure-card-image': {
                    transform: 'scale(1.04)',
                },
                '&:hover .figure-card-frame, &:focus-visible .figure-card-frame': {
                    opacity: 1,
                },
                '&:hover .figure-card-details, &:focus-visible .figure-card-details': {
                    opacity: 1,
                    transform: 'translateY(0)',
                },
                '&:hover .figure-card-title, &:focus-visible .figure-card-title': {
                    color: item.color,
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
                    className="figure-card-image"
                    src={item.image}
                    alt=""
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transform: 'scale(1.03)',
                        transformOrigin: 'center',
                        transition: 'transform 360ms ease',
                    }}
                />
                <Box
                    className="figure-card-frame"
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        border: `1px solid ${alpha(item.color, 0.22)}`,
                        boxShadow: `inset 0 0 0 1px ${alpha(item.color, 0.08)}`,
                        opacity: 0,
                        transition: 'opacity 180ms ease',
                        pointerEvents: 'none',
                    }}
                />
                <Box
                    className="figure-card-details"
                    sx={{
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        bottom: 12,
                        zIndex: 2,
                        px: 1.25,
                        py: 0.85,
                        borderRadius: 1,
                        bgcolor: 'rgba(255,255,255,0.98)',
                        border: `1px solid ${alpha(item.color, 0.16)}`,
                        boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
                        opacity: 0,
                        transform: 'translateY(8px)',
                        transition: 'opacity 160ms ease, transform 180ms ease',
                        pointerEvents: 'none',
                    }}
                >
                    <Typography
                        sx={{
                            maxWidth: 320,
                            color: '#475569',
                            fontSize: '0.76rem',
                            fontWeight: 560,
                            lineHeight: 1.45,
                            textAlign: 'left',
                        }}
                    >
                        {item.description}
                    </Typography>
                </Box>
            </Box>
            <Stack alignItems="center" justifyContent="center" sx={{ px: 1.5, pt: 1, pb: 1.15, minWidth: 0 }}>
                <Typography
                    component="h3"
                    className="figure-card-title"
                    sx={{
                        color: '#111827',
                        fontSize: '1rem',
                        fontWeight: 740,
                        lineHeight: 1.22,
                        textAlign: 'center',
                        transition: 'color 180ms ease',
                    }}
                >
                    {item.title}
                </Typography>
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
                maxWidth: APP_SHELL_MAX_WIDTH,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4, xl: 5 },
                pb: { xs: 6, md: 8 },
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        md: 'repeat(3, minmax(0, 1fr))',
                        xl: 'repeat(4, minmax(0, 1fr))',
                    },
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

/* ─── Light-theme hero section ─── */
function HeroSection({ stats, statsLoading, theme }) {
    return (
        <Box
            component="section"
            sx={{
                maxWidth: APP_SHELL_MAX_WIDTH,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4, xl: 5 },
                pt: { xs: 3.4, md: 4.6, lg: 5.4 },
                pb: { xs: 3.2, md: 4.2 },
            }}
        >
            <Box sx={{ maxWidth: 820, mx: 'auto', textAlign: 'center' }}>
                <Typography
                    component="h1"
                    aria-label={siteName}
                    sx={{
                        maxWidth: 920,
                        mx: 'auto',
                        color: '#111827',
                        fontFamily: theme.typography.fontFamily,
                        fontSize: { xs: '1.9rem', sm: '3.2rem', md: '4.6rem' },
                        fontWeight: 780,
                        lineHeight: { xs: 1.08, md: 0.98 },
                        letterSpacing: 0,
                        textWrap: 'balance',
                    }}
                >
                    <Box component="span" sx={{ display: { xs: 'block', sm: 'inline' }, whiteSpace: 'nowrap' }}>
                        Gene-Program-Trait
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'block', sm: 'inline' }, ml: { xs: 0, sm: 1 }, whiteSpace: 'nowrap' }}>
                        Atlas
                    </Box>
                </Typography>
                <Typography
                    sx={{
                        maxWidth: 680,
                        mx: 'auto',
                        mt: { xs: 2, md: 2.4 },
                        color: '#4b5563',
                        fontFamily: theme.typography.fontFamily,
                        fontSize: 'clamp(1rem, 1.05vw, 1.1rem)',
                        lineHeight: 1.72,
                    }}
                >
                    Gene-Program-Trait Atlas is a browser for following genetic associations from traits to candidate genes and cellular programs. It brings together GWAS summary statistics, loss-of-function burden tests, GeneBayes posterior estimates, perturb-seq program annotations, and cross-trait comparisons across 2,415 traits, 10.25B variant records, 60 programs, and 67,524 indexed outputs. Users can start from a trait, gene, program, or result file, review the supporting plots and metadata, compare related traits, and download the underlying data.
                </Typography>

                <DataCoveragePanel
                    error={false}
                    loading={statsLoading}
                    stats={stats}
                    theme={theme}
                />

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
                            bgcolor: accent,
                            '&:hover': { bgcolor: '#e8593a' },
                            boxShadow: '0 8px 24px rgba(255,107,74,0.25)',
                        }}
                    >
                        Browse Traits
                    </Button>
                </Stack>
            </Box>

            <Box sx={{ mt: { xs: 2.5, md: 3.1 }, maxWidth: 1120, mx: 'auto' }}>
                <HomeSearch
                    embedded
                    showCoverage={false}
                    stats={stats}
                    statsLoading={statsLoading}
                    theme={theme}
                />
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
            <HeroSection stats={homeStats} statsLoading={homeStatsLoading} theme={theme} />

            <FigureGateway items={traitFigureCards} />

            <ReleaseLogSection
                eyebrow={null}
                heading="Recent releases"
                subtitle={null}
                limit={3}
                newestFirst
                outerSx={{
                    maxWidth: APP_SHELL_MAX_WIDTH,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4, xl: 5 },
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
