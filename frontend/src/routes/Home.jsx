import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Box, Typography, Card, CardActionArea, CardContent, Button, TextField,
    Checkbox, InputAdornment, Paper, List, ListItemButton, ListItemIcon,
    ListItemText, ClickAwayListener, Chip, CircularProgress, IconButton,
    Divider, LinearProgress, Skeleton, Stack,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Search, Folder, InsertDriveFile, ArrowForward,
    Close, FileDownload, Dns, Science, Storage, InfoOutlined, ContactSupportOutlined,
} from '@mui/icons-material';
import axios from 'axios';
import { downloadDataPaths } from '../utils/download';
import { captionSx, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';

const SEARCH_API = axios.create({ baseURL: '/api/data' });
const HOME_API = axios.create({ baseURL: '/api' });
const SEARCH_CACHE = new Map();
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;
const ZIP_THRESHOLD = 10;

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

const statsConfig = [
    { key: 'traits', label: 'Trait Browser', icon: <Dns sx={{ fontSize: 28 }} />, to: '/trait', color: '#2563eb' },
    { key: 'programs', label: 'Programs', icon: <Science sx={{ fontSize: 28 }} />, to: '/programs', color: '#34A853' },
    { key: 'dataOutputs', label: 'Data Outputs', icon: <Storage sx={{ fontSize: 28 }} />, to: '/data', color: '#FEA601' },
];

const guideCards = [
    {
        title: 'Need context first?',
        body: 'Open About for a concise project overview and Guide for page-by-page usage notes.',
        actions: [
            { label: 'About', to: '/about', icon: <InfoOutlined sx={{ fontSize: 16 }} /> },
            { label: 'Guide', to: '/help', icon: <ArrowForward sx={{ fontSize: 16 }} /> },
        ],
    },
    {
        title: 'Need help reporting an issue?',
        body: 'Use Contact to see what details to collect before sending a data or interface report.',
        actions: [
            { label: 'Contact', to: '/contact', icon: <ContactSupportOutlined sx={{ fontSize: 16 }} /> },
            { label: 'Data Browser', to: '/data', icon: <Storage sx={{ fontSize: 16 }} /> },
        ],
    },
];

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
    const allFilesChecked = fileResults.length > 0 && checkedFiles.length === fileResults.length;
    const someFilesChecked = checkedFiles.length > 0 && !allFilesChecked;
    const panelOpen = open && canSearch;
    const resultsSummary = meta.truncated
        ? `Showing ${results.length} of ${meta.totalCount} matches`
        : `${meta.totalCount} matches`;

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
                .catch((error) => {
                    if (!axios.isCancel(error) && error.code !== 'ERR_CANCELED') {
                        console.error(error);
                        setError(getRequestErrorMessage(error, 'Search failed'));
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
            await downloadDataPaths(
                checkedFiles.map((item) => item.path),
                { filename: `${trimmedQ || 'data-search'}-files.zip`, zipThreshold: 10 },
            );
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
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
        <Box sx={{ maxWidth: 1180, mx: 'auto', py: { xs: 3, md: 4 }, px: { xs: 1.5, md: 2 } }}>
            <Box sx={{ mb: 2.5 }}>
                <Typography variant="h4" sx={sectionTitleSx(theme, { mb: 0.6 })}>
                    GWAS Data Browser
                </Typography>
                <Typography variant="body1" sx={captionSx(theme, { maxWidth: 900, lineHeight: 1.7 })}>
                    Search study-associated files and directories by filename, GCST accession, or program label.
                    Use Home for quick lookup, Trait for figure-driven review, and Data Browser for direct file navigation and download.
                </Typography>
            </Box>

            <Box sx={{
                ...panelSx(theme, {
                    borderRadius: 3,
                    p: 0,
                    overflow: 'visible',
                }),
            }}>
                <Box sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 1.8 }, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                    <Typography variant="subtitle1" sx={sectionTitleSx(theme, { fontSize: '1rem', mb: 0.4 })}>
                        File Search
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme, { mb: 1.3 })}>
                        Search returns both files and folders. File selections download directly; folder hits can be opened or downloaded as ZIP.
                    </Typography>

                    <ClickAwayListener onClickAway={() => setOpen(false)}>
                        <Box sx={{ position: 'relative' }}>
                            <TextField
                                fullWidth
                                placeholder="Search by filename, GCST ID, program, or folder"
                                aria-label="Search files and folders"
                                value={q}
                                onChange={(event) => setQ(event.target.value)}
                                onFocus={() => { if (canSearch) setOpen(true); }}
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

                            <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                                <Chip label="Files and folders" size="small" variant="outlined" sx={summaryChipSx(theme)} />
                                <Chip label="ZIP for >10 files" size="small" variant="outlined" sx={summaryChipSx(theme)} />
                                <Chip label="Enter to open full results" size="small" variant="outlined" sx={summaryChipSx(theme)} />
                            </Stack>

                            {panelOpen && (
                                <Paper elevation={0} sx={{
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
                                }}>
                                    {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
                                    <Box sx={{
                                        px: 2,
                                        py: 1.1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        flexWrap: 'wrap',
                                        bgcolor: theme.custom.surface.subtle,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                    }}>
                                        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                                            <Chip label={resultsSummary} size="small" sx={summaryChipSx(theme)} />
                                            <Chip label={`${fileResults.length} files`} size="small" sx={summaryChipSx(theme, { color: theme.palette.primary.dark, backgroundColor: theme.custom.surface.accent })} />
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
                                                        onClick={() => { void handleDownloadSelection(); }}
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
                                                <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, py: 1 }}>
                                                    <Skeleton variant="rounded" width={18} height={18} sx={shimmerSx} />
                                                    <Skeleton variant="circular" width={18} height={18} sx={shimmerSx} />
                                                    <Box sx={{ flex: 1 }}>
                                                        <Skeleton variant="text" width="42%" height={24} sx={shimmerSx} />
                                                        <Skeleton variant="text" width="72%" height={18} sx={shimmerSx} />
                                                    </Box>
                                                    <Skeleton variant="rounded" width={72} height={22} sx={shimmerSx} />
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : results.length > 0 ? (
                                        <Box sx={{ maxHeight: 460, overflowY: 'auto' }}>
                                            <List disablePadding>
                                                {fileResults.length > 0 && (
                                                    <>
                                                        <Box sx={{
                                                            px: 2,
                                                            py: 0.8,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1,
                                                            bgcolor: theme.custom.surface.subtle,
                                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                                        }}>
                                                            <Checkbox
                                                                size="small"
                                                                sx={{ p: 0.3 }}
                                                                checked={allFilesChecked}
                                                                indeterminate={someFilesChecked}
                                                                onChange={toggleAllFiles}
                                                            />
                                                            <Typography variant="overline" sx={{ fontWeight: 700, color: theme.palette.text.secondary, letterSpacing: '0.08em' }}>
                                                                Files
                                                            </Typography>
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
                                                                    <Chip
                                                                        label={fmtSize(item.size)}
                                                                        size="small"
                                                                        sx={summaryChipSx(theme)}
                                                                    />
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
                                                        <Box sx={{
                                                            px: 2,
                                                            py: 0.8,
                                                            bgcolor: theme.custom.surface.subtle,
                                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                                        }}>
                                                            <Typography variant="overline" sx={{ fontWeight: 700, color: theme.palette.text.secondary, letterSpacing: '0.08em' }}>
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
                                                                    <Chip
                                                                        label="Open folder"
                                                                        size="small"
                                                                        sx={summaryChipSx(theme)}
                                                                    />
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            setDownloading(true);
                                                                            setError('');
                                                                            downloadDataPaths([item.path], { filename: `${item.name || 'folder'}.zip`, zipThreshold: 0 })
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
                                        <Box sx={{
                                            px: 2.5,
                                            py: 4.5,
                                            textAlign: 'center',
                                        }}>
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
                            )}
                        </Box>
                    </ClickAwayListener>
                </Box>

                <Box sx={{
                    px: { xs: 1.5, md: 2 },
                    py: { xs: 1.5, md: 1.8 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.5,
                }}>
                    {statsConfig.map((item) => (
                        <Box
                            key={item.key}
                            sx={{
                                border: `1px solid ${theme.custom.border.soft}`,
                                borderRadius: 2.5,
                                backgroundColor: theme.palette.background.paper,
                                minWidth: 0,
                            }}
                        >
                            <CardActionArea
                                onClick={() => navigate(item.to)}
                                sx={{
                                    transition: `background-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                    '&:hover .home-stat-icon': {
                                        transform: 'translateY(-1px) scale(1.04)',
                                    },
                                }}
                            >
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1.8 }}>
                                    <Box sx={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 2,
                                        display: 'grid',
                                        placeItems: 'center',
                                        bgcolor: alpha(item.color, 0.10),
                                        color: item.color,
                                        flexShrink: 0,
                                        transition: `transform ${theme.custom.motion.swift}`,
                                    }} className="home-stat-icon">
                                        {item.icon}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.05 }}>
                                            {(homeStats[item.key] || 0).toLocaleString()}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.2 }}>
                                            {item.label}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </CardActionArea>
                        </Box>
                    ))}
                </Box>

                <Box sx={{
                    px: { xs: 1.5, md: 2 },
                    pb: { xs: 1.5, md: 1.9 },
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                }}>
                    {guideCards.map((card) => (
                        <Box
                            key={card.title}
                            sx={{
                                border: `1px solid ${theme.custom.border.soft}`,
                                borderRadius: 2.5,
                                backgroundColor: theme.custom.surface.raised,
                                p: { xs: 1.5, md: 1.8 },
                                minWidth: 0,
                            }}
                        >
                            <Typography variant="subtitle1" sx={sectionTitleSx(theme, { fontSize: '0.98rem', mb: 0.45 })}>
                                {card.title}
                            </Typography>
                            <Typography variant="body2" sx={captionSx(theme, { mb: 1.2 })}>
                                {card.body}
                            </Typography>
                            <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                                {card.actions.map((action) => (
                                    <Button
                                        key={action.to}
                                        onClick={() => navigate(action.to)}
                                        size="small"
                                        variant="outlined"
                                        startIcon={action.icon}
                                    >
                                        {action.label}
                                    </Button>
                                ))}
                            </Stack>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
