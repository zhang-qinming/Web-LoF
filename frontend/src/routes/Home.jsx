import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert, Box, Typography, Card, CardActionArea, CardContent, Button, TextField,
    Checkbox, InputAdornment, Paper, List, ListItemButton, ListItemIcon,
    ListItemText, ClickAwayListener, Chip, CircularProgress, IconButton,
    Divider, LinearProgress, Skeleton, Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    Search, Folder, InsertDriveFile, ArrowForward,
    Close, FileDownload, Dns, Science, Storage,
} from '@mui/icons-material';
import axios from 'axios';
import { downloadDataPaths } from '../utils/download';

const SEARCH_API = axios.create({ baseURL: '/api/data' });
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

const stats = [
    { label: 'GWAS Traits', value: '2,415', icon: <Dns sx={{ fontSize: 28 }} />, to: '/trait', color: '#2563eb' },
    { label: 'Programs', value: '60', icon: <Science sx={{ fontSize: 28 }} />, to: '/programs', color: '#34A853' },
    { label: 'Data Files', value: '100+', icon: <Storage sx={{ fontSize: 28 }} />, to: '/data', color: '#FEA601' },
];

export default function Home() {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [checked, setChecked] = useState(new Set());
    const [meta, setMeta] = useState({ totalCount: 0, truncated: false });
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
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#1f2937', mb: 0.6 }}>
                    GWAS Data Browser
                </Typography>
                <Typography variant="body1" sx={{ color: '#5b6472', maxWidth: 900, lineHeight: 1.7 }}>
                    Search study-associated files and directories by filename, GCST accession, or program label.
                    Use the home search for quick lookup, then continue in the full Data Browser for browsing and download.
                </Typography>
            </Box>

            <Paper elevation={0} sx={{
                border: '1px solid rgba(15,23,36,0.08)',
                borderRadius: 2.5,
                overflow: 'visible',
                bgcolor: '#fff',
            }}>
                <Box sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 1.8 }, borderBottom: '1px solid #eef2f7' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#1f2937', mb: 0.4 }}>
                        File Search
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', mb: 1.3 }}>
                        Search returns both files and folders. File selections download directly; folder hits can be opened or downloaded as ZIP.
                    </Typography>

                    <ClickAwayListener onClickAway={() => setOpen(false)}>
                        <Box sx={{ position: 'relative' }}>
                            <TextField
                                fullWidth
                                placeholder="Search by filename, GCST ID, program, or folder"
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
                                        bgcolor: '#fff',
                                        '& fieldset': { borderColor: '#d7dde6' },
                                        '&:hover fieldset': { borderColor: '#b8c2cf' },
                                    },
                                }}
                                helperText={helperText}
                            />

                            <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                                <Chip label="Files and folders" size="small" variant="outlined" sx={{ borderColor: '#d8e2ee', color: '#4b5563' }} />
                                <Chip label="ZIP for >10 files" size="small" variant="outlined" sx={{ borderColor: '#d8e2ee', color: '#4b5563' }} />
                                <Chip label="Enter to open full results" size="small" variant="outlined" sx={{ borderColor: '#d8e2ee', color: '#4b5563' }} />
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
                                    border: '1px solid #dbe3ec',
                                    boxShadow: '0 10px 28px rgba(15,23,36,0.10)',
                                    bgcolor: '#fff',
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
                                        bgcolor: '#f8fafc',
                                        borderBottom: '1px solid #edf2f7',
                                    }}>
                                        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                                            <Chip label={resultsSummary} size="small" sx={{ bgcolor: '#eef2f7', color: '#475569' }} />
                                            <Chip label={`${fileResults.length} files`} size="small" sx={{ bgcolor: '#eef4ff', color: '#315ea8' }} />
                                            {folderResults.length > 0 && (
                                                <Chip label={`${folderResults.length} folders`} size="small" sx={{ bgcolor: '#eef2f7', color: '#475569' }} />
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
                                                            bgcolor: '#fbfcfd',
                                                            borderBottom: '1px solid #eef2f7',
                                                        }}>
                                                            <Checkbox
                                                                size="small"
                                                                sx={{ p: 0.3 }}
                                                                checked={allFilesChecked}
                                                                indeterminate={someFilesChecked}
                                                                onChange={toggleAllFiles}
                                                            />
                                                            <Typography variant="overline" sx={{ fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em' }}>
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
                                                                    borderBottom: '1px solid #f4f6f8',
                                                                    '&:hover': { bgcolor: '#fafbfd' },
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
                                                                        color: '#1f2937',
                                                                        title: item.name,
                                                                    }}
                                                                    secondaryTypographyProps={{
                                                                        fontSize: '0.73rem',
                                                                        color: '#6b7280',
                                                                        noWrap: true,
                                                                        title: item.path,
                                                                    }}
                                                                />
                                                                <Stack direction="row" spacing={0.7} alignItems="center">
                                                                    <Chip
                                                                        label={fmtSize(item.size)}
                                                                        size="small"
                                                                        sx={{ fontSize: '0.66rem', height: 22, bgcolor: '#f8fafc', color: '#4b5563' }}
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
                                                                            color: '#315ea8',
                                                                            '&:hover': { bgcolor: '#eff4fb' },
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
                                                            bgcolor: '#fbfcfd',
                                                            borderBottom: '1px solid #eef2f7',
                                                        }}>
                                                            <Typography variant="overline" sx={{ fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em' }}>
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
                                                                    borderBottom: '1px solid #f4f6f8',
                                                                    '&:hover': { bgcolor: '#fafbfd' },
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
                                                                        color: '#1f2937',
                                                                        title: item.name,
                                                                    }}
                                                                    secondaryTypographyProps={{
                                                                        fontSize: '0.73rem',
                                                                        color: '#6b7280',
                                                                        noWrap: true,
                                                                        title: item.path,
                                                                    }}
                                                                />
                                                                <Stack direction="row" spacing={0.7} alignItems="center">
                                                                    <Chip
                                                                        label="Open folder"
                                                                        size="small"
                                                                        sx={{ fontSize: '0.66rem', height: 22, bgcolor: '#f3f6f9', color: '#4b5563' }}
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
                                                                            color: '#e67e22',
                                                                            '&:hover': { bgcolor: '#fef7ed' },
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
                                            <Typography sx={{ fontWeight: 600, color: '#374151', mb: 0.5 }}>
                                                No matches for "{trimmedQ}"
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
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
                    {stats.map((item) => (
                        <Card
                            key={item.label}
                            elevation={0}
                            sx={{
                                borderRadius: 2,
                                border: '1px solid rgba(15,23,36,0.08)',
                                boxShadow: 'none',
                            }}
                        >
                            <CardActionArea onClick={() => navigate(item.to)}>
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
                                    }}>
                                        {item.icon}
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2937', lineHeight: 1.05 }}>
                                            {item.value}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#6b7280', mt: 0.2 }}>
                                            {item.label}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    ))}
                </Box>
            </Paper>
        </Box>
    );
}
