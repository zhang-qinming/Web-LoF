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
    InsertDriveFile,
    Science,
    Search,
    Storage,
} from '@mui/icons-material';
import axios from 'axios';
import { downloadDataPaths } from '../utils/download';
import { captionSx, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';

const SEARCH_API = axios.create({ baseURL: '/api/data' });
const HOME_API = axios.create({ baseURL: '/api' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;

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

const statsConfig = [
    {
        key: 'traits',
        label: 'Trait Browser',
        icon: <Dns sx={{ fontSize: 28 }} />,
        to: '/trait',
        color: '#2563eb',
        description: 'Browse study-level traits and linked figures.',
    },
    {
        key: 'programs',
        label: 'Programs',
        icon: <Science sx={{ fontSize: 28 }} />,
        to: '/programs',
        color: '#1f9d62',
        description: 'Inspect regulator and pathway-level program outputs.',
    },
    {
        key: 'dataOutputs',
        label: 'Data Outputs',
        icon: <Storage sx={{ fontSize: 28 }} />,
        to: '/data',
        color: '#b7791f',
        description: 'Open indexed folders and download result files directly.',
    },
];

const featuredTraits = [
    {
        fileId: 'GCST90083707',
        gwasId: 'MR08330',
        traitName: 'Diagnoses - secondary ICD10: E03.9 Hypothyroidism, unspecified',
        meshTerm: 'Diagnosis',
        nSig: 8931,
        qqDeviation: '2.552',
        volcanoHits: '3 burden / 155 posterior',
        evidence: ['Program scatter', 'Trait-program graph', 'Cross-trait heatmap'],
        note: 'Most balanced showcase across Manhattan, QQ, volcano, scatter, and cross-trait views.',
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
        meshTerm: 'Colorectal Neoplasms',
        nSig: 1617,
        qqDeviation: '1.586',
        volcanoHits: '4 burden / 82 posterior',
        evidence: ['Program scatter', 'Trait-program graph', 'Cross-trait heatmap'],
        note: 'Good visual balance and cleaner patterning for demos when the primary trait feels too dense.',
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
        meshTerm: 'Hypertension',
        nSig: 8374,
        qqDeviation: '3.746',
        volcanoHits: '4 burden / 111 posterior',
        evidence: ['Program scatter', 'Trait-program graph', 'Cross-trait heatmap'],
        note: 'Very strong QQ separation and broad cross-panel signal, useful as a second high-signal disease trait.',
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

function MetricTile({ description, icon, label, theme, to, value, navigate, color, loading }) {
    return (
        <Box
            sx={{
                border: `1px solid ${theme.custom.border.soft}`,
                borderRadius: 2,
                backgroundColor: theme.palette.background.paper,
                minWidth: 0,
                height: '100%',
            }}
        >
            <CardActionArea
                onClick={() => navigate(to)}
                sx={{
                    height: '100%',
                    transition: `background-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                    '&:hover .home-stat-icon': {
                        transform: 'translateY(-1px) scale(1.04)',
                    },
                }}
            >
                <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 1.8 }}>
                    <Box
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(color, 0.10),
                            color,
                            flexShrink: 0,
                            transition: `transform ${theme.custom.motion.swift}`,
                        }}
                        className="home-stat-icon"
                    >
                        {icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.05 }}>
                            {loading ? <Skeleton variant="text" width={52} height={34} sx={{ transform: 'none' }} /> : value.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600, mt: 0.35 }}>
                            {label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.45, lineHeight: 1.55 }}>
                            {description}
                        </Typography>
                    </Box>
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

    const helperText = !trimmedQ
        ? 'Search file names, folder names, GCST accessions, and program outputs.'
        : canSearch
            ? 'Press Enter to open all matches in Data Browser.'
            : 'Type at least 2 characters.';

    return (
        <Box sx={{ maxWidth: 1220, mx: 'auto', py: { xs: 2, md: 3 }, px: { xs: 1.25, md: 2 } }}>
            <Box
                sx={{
                    ...panelSx(theme, {
                        p: { xs: 1.2, md: 1.6 },
                        borderRadius: 2,
                        overflow: 'hidden',
                    }),
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,255,0.94))',
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                        p: { xs: 0.85, md: 1.15 },
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(238,245,255,0.92), rgba(248,250,255,0.76))',
                        border: `1px solid ${theme.custom.border.soft}`,
                    }}
                >
                    <Typography variant="h4" sx={sectionTitleSx(theme, { fontSize: { xs: '1.85rem', md: '2.35rem' }, lineHeight: 1.08, mb: 0.8, maxWidth: 860 })}>
                        GWAS browser for trait review, program context, and direct data access
                    </Typography>
                    <Typography variant="body1" sx={captionSx(theme, { maxWidth: 760, lineHeight: 1.68, mb: 1.2 })}>
                        Start from a high-signal trait, open the full figure stack, or jump straight to indexed outputs.
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.25 }}>
                        <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate('/trait')} sx={{ textTransform: 'none', boxShadow: 'none' }}>
                            Open Trait Browser
                        </Button>
                        <Button variant="outlined" startIcon={<Storage />} onClick={() => navigate('/data')} sx={{ textTransform: 'none' }}>
                            Data Browser
                        </Button>
                        <Button variant="outlined" startIcon={<Science />} onClick={() => navigate('/programs')} sx={{ textTransform: 'none' }}>
                            Programs
                        </Button>
                    </Stack>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1,
                        }}
                    >
                        {statsConfig.map((item) => (
                            <MetricTile
                                key={item.key}
                                description={item.description}
                                icon={item.icon}
                                label={item.label}
                                theme={theme}
                                to={item.to}
                                value={homeStats[item.key] || 0}
                                navigate={navigate}
                                color={item.color}
                                loading={statsLoading}
                            />
                        ))}
                    </Box>
                </Box>

                <Box sx={{ mt: 1.45 }}>
                    <Box sx={{ mb: 0.9 }}>
                        <Typography variant="h5" sx={sectionTitleSx(theme, { fontSize: '1.08rem', mb: 0.25 })}>
                            Featured significant traits
                        </Typography>
                        <Typography variant="body2" sx={captionSx(theme)}>
                            Three practical entry traits with strong current figure coverage.
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1,
                        }}
                    >
                        {featuredTraits.map((trait, index) => (
                            <Box
                                key={trait.fileId}
                                sx={{
                                    position: 'relative',
                                    minWidth: 0,
                                    borderRadius: 2,
                                    border: `1px solid ${theme.custom.border.soft}`,
                                    background: trait.tone.bg,
                                    boxShadow: `0 14px 28px ${trait.tone.glow}`,
                                    overflow: 'hidden',
                                }}
                            >
                                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: trait.tone.line }} />
                                <Box sx={{ p: 1.15 }}>
                                    <Stack direction="row" spacing={0.55} useFlexGap flexWrap="wrap" sx={{ mb: 0.75 }}>
                                        <Chip label={index === 0 ? 'Primary' : 'Featured'} size="small" sx={summaryChipSx(theme, { color: trait.tone.line, backgroundColor: alpha(trait.tone.line, 0.08), border: `1px solid ${alpha(trait.tone.line, 0.18)}` })} />
                                        <Chip label={trait.gwasId} size="small" sx={summaryChipSx(theme)} />
                                    </Stack>
                                    <Typography variant="h6" sx={sectionTitleSx(theme, { fontSize: '0.98rem', lineHeight: 1.3, mb: 0.45 })}>
                                        {trait.traitName}
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                                            gap: 0.7,
                                            mb: 0.9,
                                        }}
                                    >
                                        <Box sx={{ borderRadius: 1.25, border: `1px solid ${theme.custom.border.soft}`, p: 0.75, backgroundColor: 'rgba(255,255,255,0.76)' }}>
                                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#5b6b82', textTransform: 'uppercase' }}>Sig loci</Typography>
                                            <Typography sx={{ fontSize: '0.98rem', fontWeight: 700, color: theme.palette.text.primary, mt: 0.15 }}>{trait.nSig.toLocaleString()}</Typography>
                                        </Box>
                                        <Box sx={{ borderRadius: 1.25, border: `1px solid ${theme.custom.border.soft}`, p: 0.75, backgroundColor: 'rgba(255,255,255,0.76)' }}>
                                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#5b6b82', textTransform: 'uppercase' }}>QQ dev</Typography>
                                            <Typography sx={{ fontSize: '0.98rem', fontWeight: 700, color: theme.palette.text.primary, mt: 0.15 }}>{trait.qqDeviation}</Typography>
                                        </Box>
                                        <Box sx={{ borderRadius: 1.25, border: `1px solid ${theme.custom.border.soft}`, p: 0.75, backgroundColor: 'rgba(255,255,255,0.76)' }}>
                                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#5b6b82', textTransform: 'uppercase' }}>Volcano</Typography>
                                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: theme.palette.text.primary, mt: 0.15, lineHeight: 1.3 }}>{trait.volcanoHits}</Typography>
                                        </Box>
                                    </Box>
                                    <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                                        <Button variant="contained" endIcon={<ArrowForward />} onClick={() => navigate(`/trait/${trait.fileId}`)} sx={{ textTransform: 'none', boxShadow: 'none' }}>
                                            Open trait
                                        </Button>
                                        <Button variant="outlined" onClick={() => setQ(cleanTraitName(trait.fileId))} sx={{ textTransform: 'none' }}>
                                            Search files
                                        </Button>
                                    </Stack>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box
                    sx={{
                        mt: 1.35,
                        ...panelSx(theme, {
                            borderRadius: 2,
                            p: 0,
                            overflow: 'visible',
                        }),
                    }}
                >
                        <Box sx={{ px: { xs: 1.3, md: 1.55 }, py: { xs: 1.2, md: 1.4 }, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                            <Typography variant="subtitle1" sx={sectionTitleSx(theme, { fontSize: '1rem', mb: 0.35 })}>
                                File search
                            </Typography>
                            <Typography variant="body2" sx={captionSx(theme, { mb: 0.9 })}>
                                Search file names, GCST accessions, program labels, and folders.
                            </Typography>

                            <ClickAwayListener onClickAway={() => setOpen(false)}>
                                <Box sx={{ position: 'relative' }}>
                                    <TextField
                                        fullWidth
                                        placeholder="Search by filename, GCST ID, program, or folder"
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
                                                bgcolor: theme.palette.background.paper,
                                                '& fieldset': { borderColor: theme.custom.border.strong },
                                                '&:hover fieldset': { borderColor: 'rgba(100, 116, 139, 0.34)' },
                                            },
                                        }}
                                        helperText={helperText}
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
                        </Box>
                    </Box>
            </Box>
        </Box>
    );
}
