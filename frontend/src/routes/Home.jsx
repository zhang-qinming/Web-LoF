import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import homeFigureBrowserWorkflow from '../assets/home-figure-browser-workflow.svg';
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
        title: 'Browse Traits',
        description: 'Explore trait metadata, association summaries, significant loci, and linked evidence layers.',
        image: homeFigureDataBrowser,
        to: '/trait',
        icon: QueryStats,
        color: '#2563eb',
    },
    {
        title: 'Gene Evidence',
        description: 'Move from locus signals to LoF-supported genes and regulator-level evidence panels.',
        image: homeFigureLofGene,
        to: '/genes',
        icon: Biotech,
        color: '#7c3aed',
    },
    {
        title: 'Program Context',
        description: 'Review gene programs, trait-program networks, and interpretable biological modules.',
        image: homeFigureTraitProgramNetwork,
        to: '/programs',
        icon: Hub,
        color: '#0f766e',
    },
    {
        title: 'Data Archive',
        description: 'Search files or folders, select result files, and download curated analysis outputs.',
        image: homeFigureBrowserWorkflow,
        to: '/data',
        icon: Storage,
        color: '#b45309',
    },
];

const featureRows = [
    {
        title: 'Trait-level visualization',
        description: 'Manhattan and cross-trait views make association patterns scannable before opening a detailed trait page.',
        image: homeFigureGwasManhattan,
        to: '/trait',
        chips: ['Manhattan plot', 'Trait metadata', 'Signal review'],
    },
    {
        title: 'Program-aware interpretation',
        description: 'Program scatter and network summaries help move from isolated variants to broader biological signals.',
        image: homeFigureProgramScatter,
        to: '/programs',
        chips: ['cNMF programs', 'Regulators', 'Trait links'],
    },
    {
        title: 'Cross-trait context',
        description: 'Heatmap-style summaries support fast comparison across phenotypes and shared association layers.',
        image: homeFigureCrossTraitHeatmap,
        to: '/trait',
        chips: ['Trait clusters', 'Correlation', 'Evidence layers'],
    },
];

const quickSearchSeeds = ['trait', 'program', 'posterior', 'burden'];

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

function HeroIllustration() {
    return (
        <Box
            sx={{
                position: 'relative',
                minHeight: { xs: 280, md: 430 },
                display: 'grid',
                placeItems: 'center',
                overflow: 'visible',
            }}
            aria-hidden="true"
        >
            <Box
                sx={{
                    position: 'absolute',
                    width: '74%',
                    height: '74%',
                    borderRadius: '45% 55% 52% 48%',
                    background: 'linear-gradient(135deg, rgba(239,244,255,0.92), rgba(255,235,229,0.55))',
                    transform: 'translate(10px, -12px)',
                }}
            />
            <Box
                component="img"
                src={homeFigureGwasManhattan}
                alt=""
                sx={{
                    position: 'relative',
                    width: { xs: '88%', md: '82%' },
                    maxHeight: 330,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 18px 28px rgba(31,41,51,0.12))',
                }}
            />
            <Box
                component="img"
                src={homeFigureTraitProgramNetwork}
                alt=""
                sx={{
                    position: 'absolute',
                    right: { xs: 8, md: 18 },
                    bottom: { xs: 14, md: 28 },
                    width: { xs: 125, sm: 180, md: 220 },
                    borderRadius: 1,
                    border: '1px solid rgba(148,163,184,0.22)',
                    bgcolor: 'rgba(255,255,255,0.88)',
                    p: 1,
                    boxShadow: '0 18px 38px rgba(15,23,42,0.12)',
                }}
            />
            <Box
                component="img"
                src={homeFigureLofGene}
                alt=""
                sx={{
                    position: 'absolute',
                    left: { xs: 6, md: 16 },
                    top: { xs: 12, md: 34 },
                    width: { xs: 112, sm: 156, md: 188 },
                    borderRadius: 1,
                    border: '1px solid rgba(148,163,184,0.18)',
                    bgcolor: 'rgba(255,255,255,0.9)',
                    p: 1,
                    boxShadow: '0 14px 32px rgba(15,23,42,0.1)',
                }}
            />
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
    handleSelect,
    loading,
    meta,
    openResultsInBrowser,
    panelOpen,
    results,
    setChecked,
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
            >
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                    <Chip label={resultsSummary} size="small" sx={summaryChipSx(theme)} />
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
                    <Button size="small" variant="text" endIcon={<ArrowForward sx={{ fontSize: 15 }} />} onClick={openResultsInBrowser}>
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
                                        <Typography variant="overline" sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
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
                                        <Chip label={fmtSize(item.size) || 'file'} size="small" sx={summaryChipSx(theme)} />
                                    </ListItemButton>
                                ))}
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
                                    <ListItemButton key={item.path} onClick={() => handleSelect(item)} sx={{ px: 1.75, py: 1 }}>
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

function ModuleCard({ item }) {
    const navigate = useNavigate();
    const Icon = item.icon;

    return (
        <Box
            component="article"
            onClick={() => navigate(item.to)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(item.to);
                }
            }}
            sx={{
                minHeight: 350,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                px: 2.4,
                py: 3,
                borderRadius: 1,
                bgcolor: '#fff',
                border: '1px solid rgba(226,232,240,0.72)',
                boxShadow: '0 12px 34px rgba(15,23,42,0.08)',
                cursor: 'pointer',
                transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: alpha(item.color, 0.28),
                    boxShadow: `0 20px 44px ${alpha(item.color, 0.16)}`,
                },
            }}
        >
            <Box sx={{ width: '100%', height: 170, display: 'grid', placeItems: 'center', mb: 2.3 }}>
                <Box component="img" src={item.image} alt="" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </Box>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 1.1 }}>
                <Icon sx={{ color: item.color, fontSize: 19 }} />
                <Typography component="h3" sx={{ color: '#111827', fontFamily: 'Georgia, Cambria, serif', fontSize: '1.1rem', fontWeight: 800 }}>
                    {item.title}
                </Typography>
            </Stack>
            <Typography sx={{ color: '#5b6472', fontSize: '0.9rem', lineHeight: 1.65, textAlign: 'center', mb: 1.8 }}>
                {item.description}
            </Typography>
            <Button size="small" variant="text" endIcon={<ArrowForward sx={{ fontSize: 16 }} />} sx={{ mt: 'auto', color: item.color }}>
                Open module
            </Button>
        </Box>
    );
}

function FeaturePanel({ item, reverse }) {
    const navigate = useNavigate();

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
                    onClick={() => navigate(item.to)}
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

    const trimmedQ = q.trim();
    const canSearch = trimmedQ.length >= 2;
    const fileResults = useMemo(() => results.filter((item) => item.type === 'file'), [results]);
    const folderResults = useMemo(() => results.filter((item) => item.type === 'dir'), [results]);
    const checkedFiles = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)).map((item) => item.path),
        [checked, fileResults],
    );
    const panelOpen = open && canSearch;

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
        const params = new URLSearchParams();
        if (path) params.set('path', path);
        else if (trimmedQ) params.set('search', trimmedQ);
        navigate(`/data${params.toString() ? `?${params.toString()}` : ''}`);
    };

    const handleSelect = (item) => {
        if (item.type === 'file') {
            toggleFile(item.path);
            return;
        }
        openResultsInBrowser(item.path);
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
        <Box sx={{ width: '100%', color: '#1f2933', bgcolor: '#fff', mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, pb: { xs: 6, md: 8 } }}>
            <Box
                component="section"
                sx={{
                    maxWidth: 1240,
                    mx: 'auto',
                    pt: { xs: 7, md: 8 },
                    pb: { xs: 6, md: 7 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '0.92fr 1.08fr' },
                    gap: { xs: 5, lg: 7 },
                    alignItems: 'center',
                }}
            >
                <Stack spacing={2.7} alignItems="flex-start">
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
                        <Button variant="outlined" size="large" onClick={() => navigate('/trait')} sx={{ px: 3, py: 1.15, borderRadius: 999, color: accent, borderColor: accent }}>
                            Learn More
                        </Button>
                        <Button variant="contained" size="large" endIcon={<ArrowForward />} onClick={() => navigate('/data')} sx={{ px: 3, py: 1.15, borderRadius: 999, bgcolor: '#1f2933', '&:hover': { bgcolor: '#111827' } }}>
                            Browse Data
                        </Button>
                    </Stack>

                    <Box sx={panelSx(theme, { p: 1.2, width: '100%', maxWidth: 760, backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(14px)' })}>
                        <Stack spacing={0.95}>
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.palette.secondary.dark }}>
                                Quick file access
                            </Typography>
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
                                        placeholder="Search files or folders"
                                        aria-label="Search files and folders"
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
                                                    <IconButton size="small" onClick={clearSearch}>
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
                                        handleSelect={handleSelect}
                                        loading={loading}
                                        meta={meta}
                                        openResultsInBrowser={openResultsInBrowser}
                                        panelOpen={panelOpen}
                                        results={results}
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
                </Stack>
                <HeroIllustration />
            </Box>

            <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', pb: { xs: 5, md: 8 } }}>
                <Stack spacing={1.1} alignItems="center">
                    <Typography component="h2" sx={{ color: '#111827', fontFamily: 'Georgia, Cambria, serif', fontSize: { xs: '2rem', md: '2.55rem' }, fontWeight: 800, lineHeight: 1.08, textAlign: 'center' }}>
                        See Our <Box component="span" sx={{ color: accent }}>Modules</Box>
                    </Typography>
                    <Box sx={{ width: 108, height: 2, bgcolor: accent, mt: 0.45 }} />
                </Stack>
                <Box
                    sx={{
                        mt: { xs: 4, md: 5.5 },
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                        gap: { xs: 2.2, md: 3 },
                    }}
                >
                    {moduleCards.map((item) => (
                        <ModuleCard key={item.title} item={item} />
                    ))}
                </Box>
            </Box>

            <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', py: { xs: 4, md: 7 } }}>
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
