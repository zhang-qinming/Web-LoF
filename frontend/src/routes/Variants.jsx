import React, { startTransition, useEffect, useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box, Typography, TextField, IconButton, Checkbox,
    Chip, Pagination, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, InputAdornment, Tooltip, Button,
    Alert, LinearProgress,
} from '@mui/material';
import {
    Download, Folder, InsertDriveFile, Search, FolderOpen, ChevronRight, Close,
    FileDownload, CheckBoxOutlineBlank, CheckBox,
} from '@mui/icons-material';
import axios from 'axios';
import { buildApiUrl, submitDownloadForm, triggerNativeDownload } from '../utils/download';

const API = axios.create({ baseURL: '/api/data' });
const PER = 40, COL_W = 440, ANIM = 170;
const GLOBAL_SEARCH_LIMIT = 200;
const GLOBAL_PAGE_SIZE = 50;

function fmtSize(b) {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
}

const thSx = {
    bgcolor: '#f8f9fb', fontWeight: 600, fontSize: '0.7rem',
    color: '#888', borderBottom: '2px solid #e8eaed',
    py: 0.8, px: 1.5, position: 'sticky', top: 0, zIndex: 1,
};

const SelectionCtx = createContext({
    checked: new Set(), toggleFile: () => {}, toggleDirAll: () => {}, clearAll: () => {},
});

const LIST_CACHE = new Map();
const FILE_PATHS_CACHE = new Map();

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
        animation: 'dataShimmer 1.25s ease-in-out infinite',
    },
    '@keyframes dataShimmer': {
        '100%': { transform: 'translateX(100%)' },
    },
};

function getListCacheKey(dir, page, filter) {
    return `${dir}::${page}::${filter || ''}`;
}

function getFilePathsCacheKey(dir, filter) {
    return `${dir}::${filter || ''}`;
}

function getRequestErrorMessage(err, fallback) {
    return err.response?.data?.error || err.message || fallback;
}

function getZipName(path, fallback = 'data') {
    return `${path.split('/').filter(Boolean).pop() || fallback}.zip`;
}

async function triggerDownload(path) {
    const response = await API.get('/download-info', { params: { path } });
    if (response.data?.type === 'dir') {
        await triggerBatchDownload([path], getZipName(path));
        return;
    }
    triggerNativeDownload(buildApiUrl('/data/download', { path }));
}

async function triggerBatchDownload(paths, filename) {
    submitDownloadForm(buildApiUrl('/data/download-batch'), { paths, filename });
}

async function downloadPaths(paths, options = {}) {
    const { filename = 'data-selection.zip' } = options;
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (uniquePaths.length === 0) return;
    await triggerBatchDownload(uniquePaths, filename);
}

async function fetchAllFilePaths(dir, filter) {
    const cacheKey = getFilePathsCacheKey(dir, filter);
    const cached = FILE_PATHS_CACHE.get(cacheKey);
    if (cached) return cached;

    const response = await API.get('/file-paths', { params: { dir, search: filter || undefined } });
    const paths = response.data?.paths || [];
    FILE_PATHS_CACHE.set(cacheKey, paths);
    return paths;
}

/* ═══════════════ Column ═══════════════ */
const DirColumn = React.memo(function DirColumn({ dir, filter, onEnter, onFiles, animState }) {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotal] = useState(1);
    const [totalCount, setCnt] = useState(0);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [hovered, setHov] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const enterSettledRef = useRef(animState === 'exit');
    const { checked, toggleFile, toggleDirAll } = useContext(SelectionCtx);

    useEffect(() => {
        let cancelled = false;
        const syncVisibleFilePaths = async (fallbackPaths) => {
            if (!filter) {
                onFiles(dir, fallbackPaths);
                return;
            }

            try {
                const allPaths = await fetchAllFilePaths(dir, filter);
                if (!cancelled) onFiles(dir, allPaths);
            } catch {
                if (!cancelled) onFiles(dir, fallbackPaths);
            }
        };

        const cacheKey = getListCacheKey(dir, page, filter);
        const cached = LIST_CACHE.get(cacheKey);

        if (cached) {
            setItems(cached.items);
            setTotal(cached.totalPages);
            setCnt(cached.totalCount);
            void syncVisibleFilePaths(cached.filePaths);
            setLoading(false);
        } else {
            setItems([]);
            setTotal(1);
            setCnt(0);
            setLoading(true);
        }

        API.get('/list', { params: { dir, page, limit: PER, search: filter || undefined } })
            .then(r => {
                if (cancelled) return;
                const d = r.data.data || [];
                const nextCache = {
                    items: d,
                    totalPages: r.data.totalPages || 1,
                    totalCount: r.data.totalCount || 0,
                    filePaths: d.filter(f => f.type === 'file').map(f => f.path),
                };
                LIST_CACHE.set(cacheKey, nextCache);
                setItems(d);
                setTotal(nextCache.totalPages);
                setCnt(nextCache.totalCount);
                void syncVisibleFilePaths(nextCache.filePaths);
            })
            .catch((err) => {
                if (!cancelled) setError(getRequestErrorMessage(err, 'Failed to load directory'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [dir, onFiles, page, filter]);

    useEffect(() => { setPage(1); }, [filter]);
    useEffect(() => {
        if (animState === 'exit') return undefined;
        const t = setTimeout(() => { enterSettledRef.current = true; }, ANIM + 20);
        return () => clearTimeout(t);
    }, [animState]);

    const filtered = useMemo(() => {
        const list = [...items];
        list.sort((a, b) => {
            const d = sortDir === 'asc' ? 1 : -1;
            if (sortBy === 'size') return ((a.size || 0) - (b.size || 0)) * d;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * d;
        });
        return list;
    }, [items, sortBy, sortDir]);

    const files = filtered.filter(f => f.type === 'file');
    const cked = files.filter(f => checked.has(f.path));
    const allCk = files.length > 0 && cked.length === files.length;
    const someCk = cked.length > 0 && !allCk;

    const visibleFilePaths = files.map(f => f.path);
    const searchDownload = Boolean(filter && visibleFilePaths.length > 0);
    const headerDownloadTitle = searchDownload ? 'Download visible files' : 'Download folder as ZIP';
    const hoveredItem = useMemo(
        () => filtered.find((item) => item.path === hovered) || null,
        [filtered, hovered],
    );
    const handleHeaderDownload = async () => {
        setDownloading(true);
        setError('');
        try {
            if (searchDownload) {
                const allMatchingFilePaths = await fetchAllFilePaths(dir, filter);
                await downloadPaths(allMatchingFilePaths, {
                    filename: `${dir.split('/').pop() || 'data'}-filtered.zip`,
                });
                return;
            }
            await triggerBatchDownload([dir || ''], getZipName(dir, 'data'));
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    const anim = animState === 'exit'
        ? `colExit ${ANIM}ms ease forwards`
        : enterSettledRef.current ? 'none' : `colEnter ${ANIM}ms cubic-bezier(0.22,1,0.36,1) both`;

    return (
        <Box sx={{
            width: COL_W, minWidth: COL_W, maxWidth: COL_W, flexShrink: 0,
            borderRight: '1px solid #eef0f2',
            display: 'flex', flexDirection: 'column', bgcolor: '#fff',
            animation: anim,
            pointerEvents: animState === 'exit' ? 'none' : 'auto',
            willChange: 'opacity, transform',
            '@keyframes colEnter': {
                from: { opacity: 0, transform: 'translateX(12px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
            },
            '@keyframes colExit': {
                from: { opacity: 1, transform: 'translateX(0)' },
                to: { opacity: 0, transform: 'translateX(-10px)' },
            },
        }}>
            {/* header */}
            <Box sx={{ px: 1.5, py: 0.9, bgcolor: '#fafbfc', borderBottom: '2px solid #e8eaed', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FolderOpen sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                <Typography noWrap variant="caption" sx={{ fontWeight: 700, color: '#444', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>
                    {dir.split('/').pop() || 'data'}
                </Typography>
                <Chip label={totalCount} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#eef0f2', color: '#888', fontWeight: 600 }} />
                <Tooltip title={downloading ? 'Preparing download...' : headerDownloadTitle}>
                    <span>
                    <IconButton size="small" disabled={downloading} onClick={() => { void handleHeaderDownload(); }} sx={{ color: searchDownload ? '#2563eb' : '#888', '&:hover': { color: searchDownload ? '#1d4ed8' : '#e67e22', bgcolor: searchDownload ? '#eef2ff' : '#fef7ed' } }}>
                        <FileDownload sx={{ fontSize: 16 }} />
                    </IconButton>
                    </span>
                </Tooltip>
            </Box>
            {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
            {error && (
                <Alert severity="error" sx={{ m: 1, py: 0.2, fontSize: '0.72rem' }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* table */}
            <TableContainer sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} onMouseLeave={() => setHov(null)}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...thSx, width: 38, textAlign: 'center', px: 0.3 }}>
                                <Checkbox size="small" sx={{ p: 0.3 }} checked={allCk} indeterminate={someCk}
                                    onChange={() => toggleDirAll(dir, files.map(f => f.path))} />
                            </TableCell>
                            <TableCell sx={{ ...thSx, cursor: 'pointer' }}
                                onClick={() => { if (sortBy === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('name'); setSortDir('asc'); } }}>
                                Name {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                            </TableCell>
                            <TableCell sx={{ ...thSx, width: 64, textAlign: 'right', cursor: 'pointer' }}
                                onClick={() => { if (sortBy === 'size') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('size'); setSortDir('desc'); } }}>
                                Size {sortBy === 'size' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                            </TableCell>
                            <TableCell sx={{ ...thSx, width: 42, textAlign: 'center' }}><Download sx={{ fontSize: 15 }} /></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 6 }, (_, i) => (
                                <TableRow key={i}><TableCell colSpan={4} sx={{ py: 1.2, px: 2 }}>
                                    <Box sx={{
                                        height: 16, bgcolor: '#f3f4f6', borderRadius: 1,
                                        width: `${55 + i * 8}%`,
                                        opacity: 0.85,
                                        ...shimmerSx,
                                    }} />
                                </TableCell></TableRow>
                            ))
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: '#bbb', fontSize: '0.8rem' }}>
                                {filter ? 'No match' : '—'}
                            </TableCell></TableRow>
                        ) : (
                            filtered.map((f) => {
                                const isFile = f.type === 'file', isCk = checked.has(f.path);
                                return (
                                    <TableRow key={f.path}
                                        onMouseEnter={() => setHov(f.path)}
                                        sx={{
                                            '& td': { py: 0.3, px: 1.5 },
                                            bgcolor: isCk ? '#f0f4ff' : 'transparent',
                                            '&:hover': { bgcolor: isCk ? '#e8edf8' : '#f8faff' },
                                            transition: 'background-color .15s ease',
                                        }}>
                                        <TableCell sx={{ borderBottom: '1px solid #f3f4f6', textAlign: 'center', px: 0.3 }}>
                                            {isFile && <Checkbox size="small" sx={{ p: 0.3 }} checked={isCk}
                                                icon={<CheckBoxOutlineBlank sx={{ fontSize: 17 }} />}
                                                checkedIcon={<CheckBox sx={{ fontSize: 17 }} />}
                                                onChange={() => toggleFile(f.path)} />}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {f.type === 'dir' ? (
                                                <Box component="button" onClick={() => onEnter(f.path)}
                                                    sx={{
                                                        display: 'flex', alignItems: 'center', gap: 0.7, width: '100%',
                                                        border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                                                        fontFamily: 'monospace', fontSize: '0.79rem', fontWeight: 500,
                                                        color: '#2563eb', textAlign: 'left', px: 0, py: 0.1,
                                                        transition: 'color .15s, transform .12s',
                                                        '&:hover': { color: '#1d4ed8', transform: 'translateX(2px)' },
                                                        '&:active': { transform: 'translateX(4px) scale(0.98)' },
                                                    }}>
                                                    <Folder sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                                                    <Box component="span" title={f.name} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Box>
                                                    <ChevronRight sx={{
                                                        fontSize: 16, opacity: 0.3, flexShrink: 0, ml: 'auto',
                                                        transition: 'opacity .15s, transform .15s',
                                                        '.MuiTableRow-root:hover &': { opacity: 0.7, transform: 'translateX(2px)' },
                                                    }} />
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                    <InsertDriveFile sx={{ fontSize: 15, color: '#ccc', flexShrink: 0 }} />
                                                    <Box component="span" title={f.name}
                                                        sx={{ fontFamily: 'monospace', fontSize: '0.79rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {f.name}
                                                    </Box>
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ borderBottom: '1px solid #f3f4f6', fontSize: '0.72rem', color: '#999' }}>
                                            {isFile ? fmtSize(f.size) : ''}
                                        </TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {isFile ? (
                                                <Tooltip title="Download">
                                                    <IconButton size="small" onClick={() => {
                                                        setDownloading(true);
                                                        setError('');
                                                        triggerDownload(f.path)
                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                            .finally(() => setDownloading(false));
                                                    }}
                                                        sx={{ opacity: (hovered === f.path || isCk) ? 0.95 : 0.24, transition: 'opacity .08s linear', '&:hover': { opacity: 1, bgcolor: '#eef2ff' } }}>
                                                        <Download sx={{ fontSize: 16, color: '#2563eb' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : !filter ? (
                                                <Tooltip title="Download as ZIP">
                                                    <IconButton size="small" component="span" onClick={() => {
                                                        setDownloading(true);
                                                        setError('');
                                                        triggerBatchDownload([f.path], getZipName(f.path))
                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                            .finally(() => setDownloading(false));
                                                    }} sx={{ opacity: hovered === f.path ? 0.92 : 0.34, transition: 'opacity .08s linear', '&:hover': { opacity: 1, bgcolor: '#fef7ed' } }}>
                                                        <FileDownload sx={{ fontSize: 16, color: '#e67e22' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{
                px: 1.5,
                py: 1,
                borderTop: '1px solid #eef0f2',
                bgcolor: hoveredItem ? '#fbfdff' : '#fafbfc',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 54,
                transition: 'background-color .08s linear',
            }}>
                {hoveredItem ? (
                    <>
                        {hoveredItem.type === 'dir'
                            ? <Folder sx={{ fontSize: 16, color: '#6b9fd4', flexShrink: 0 }} />
                            : <InsertDriveFile sx={{ fontSize: 15, color: '#9ca3af', flexShrink: 0 }} />}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap variant="caption" sx={{ display: 'block', color: '#111827', fontWeight: 700 }}>
                                {hoveredItem.name}
                            </Typography>
                            <Typography noWrap variant="caption" sx={{ display: 'block', color: '#6b7280', fontFamily: 'monospace' }}>
                                {hoveredItem.path}
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={hoveredItem.type === 'dir' ? 'Folder' : fmtSize(hoveredItem.size)}
                            sx={{ height: 22, bgcolor: hoveredItem.type === 'dir' ? '#eff6ff' : '#f3f4f6', color: hoveredItem.type === 'dir' ? '#2563eb' : '#4b5563', fontWeight: 600 }}
                        />
                    </>
                ) : (
                    <>
                        <FolderOpen sx={{ fontSize: 16, color: '#9ca3af', flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ display: 'block', color: '#4b5563', fontWeight: 700 }}>
                                Hover files or folders for details
                            </Typography>
                            <Typography noWrap variant="caption" sx={{ display: 'block', color: '#9ca3af' }}>
                                {filter ? 'Filtered items update here instantly as you move across the list.' : 'Full path and size metadata appear here while browsing.'}
                            </Typography>
                        </Box>
                        <Chip size="small" label={`${totalCount} items`} sx={{ height: 22, bgcolor: '#f3f4f6', color: '#6b7280', fontWeight: 600 }} />
                    </>
                )}
            </Box>

            {totalPages > 1 && (
                <Box sx={{ py: 0.8, bgcolor: '#fafbfc', borderTop: '1px solid #eef0f2', display: 'flex', justifyContent: 'center' }}>
                    <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} size="small" siblingCount={0} boundaryCount={1} />
                </Box>
            )}
        </Box>
    );
});

const ExitingColumnGhost = React.memo(function ExitingColumnGhost({ dir }) {
    return (
        <Box sx={{
            width: COL_W, minWidth: COL_W, maxWidth: COL_W, flexShrink: 0,
            borderRight: '1px solid #eef0f2',
            display: 'flex', flexDirection: 'column',
            bgcolor: '#fff',
            pointerEvents: 'none',
            animation: `colExit ${ANIM}ms ease forwards`,
            willChange: 'opacity, transform',
            '@keyframes colExit': {
                from: { opacity: 1, transform: 'translateX(0)' },
                to: { opacity: 0, transform: 'translateX(-10px)' },
            },
        }}>
            <Box sx={{
                px: 1.5, py: 0.9,
                bgcolor: '#fafbfc',
                borderBottom: '2px solid #e8eaed',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            }}>
                <FolderOpen sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                <Typography noWrap variant="caption" sx={{ fontWeight: 700, color: '#444', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>
                    {dir.split('/').pop() || 'data'}
                </Typography>
            </Box>
            <Box sx={{ flex: 1, px: 2, py: 1.2 }}>
                {Array.from({ length: 8 }, (_, index) => (
                    <Box
                        key={`${dir}-ghost-${index}`}
                        sx={{
                            height: 12,
                            borderRadius: 999,
                            bgcolor: index % 2 === 0 ? 'rgba(226,232,240,0.9)' : 'rgba(241,245,249,0.95)',
                            mb: 1.2,
                            width: `${72 + ((index * 7) % 20)}%`,
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
});

/* ═══════════════ DataBrowser ═══════════════ */
let _colId = 0;
const mkCol = (dir) => ({ dir, id: _colId++ });

function buildColumnsFromDir(dir) {
    if (!dir) return [mkCol('')];

    const parts = dir.split('/').filter(Boolean);
    const cols = [mkCol('')];
    let acc = '';
    for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        cols.push(mkCol(acc));
    }
    return cols;
}

function GlobalSearchResults({ query, checked, toggleFile, togglePaths, clearAll, onOpenDirectory }) {
    const trimmedQuery = query.trim();
    const canSearch = trimmedQuery.length >= 2;
    const [results, setResults] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [truncated, setTruncated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [hovered, setHovered] = useState(null);

    useEffect(() => {
        setPage(1);
    }, [trimmedQuery]);

    useEffect(() => {
        let cancelled = false;

        if (!canSearch) {
            setResults([]);
            setTotalCount(0);
            setTruncated(false);
            setLoading(false);
            return () => { cancelled = true; };
        }

        setLoading(true);
        setError('');
        API.get('/search', { params: { q: trimmedQuery, limit: GLOBAL_SEARCH_LIMIT } })
            .then(({ data }) => {
                if (cancelled) return;
                const nextResults = data.results || [];
                setResults(nextResults);
                setTotalCount(data.totalCount ?? nextResults.length);
                setTruncated(Boolean(data.truncated));
            })
            .catch((err) => {
                if (cancelled) return;
                setResults([]);
                setTotalCount(0);
                setTruncated(false);
                setError(getRequestErrorMessage(err, 'Search failed'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [canSearch, trimmedQuery]);

    const totalPages = Math.max(1, Math.ceil(results.length / GLOBAL_PAGE_SIZE));

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const visibleResults = useMemo(() => {
        const start = (page - 1) * GLOBAL_PAGE_SIZE;
        return results.slice(start, start + GLOBAL_PAGE_SIZE);
    }, [page, results]);
    const fileResults = useMemo(
        () => results.filter((item) => item.type === 'file'),
        [results],
    );
    const allFilePaths = useMemo(
        () => fileResults.map((item) => item.path),
        [fileResults],
    );
    const hoveredItem = useMemo(
        () => results.find((item) => item.path === hovered) || null,
        [hovered, results],
    );

    const visibleFilePaths = useMemo(
        () => visibleResults.filter((item) => item.type === 'file').map((item) => item.path),
        [visibleResults],
    );
    const checkedCount = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)).length,
        [checked, fileResults],
    );
    const visibleCheckedCount = visibleFilePaths.filter((path) => checked.has(path)).length;
    const allVisibleChecked = visibleFilePaths.length > 0 && visibleCheckedCount === visibleFilePaths.length;
    const someVisibleChecked = visibleCheckedCount > 0 && !allVisibleChecked;
    const allFilesChecked = allFilePaths.length > 0 && allFilePaths.every((path) => checked.has(path));
    const someFilesChecked = checkedCount > 0 && !allFilesChecked;

    const handleToggleAllVisible = () => {
        if (!visibleFilePaths.length) return;
        togglePaths(visibleFilePaths);
    };
    const handleToggleAllFiles = () => {
        if (!allFilePaths.length) return;
        togglePaths(allFilePaths);
    };

    const handleDownloadChecked = async () => {
        const selectedPaths = fileResults.filter((item) => checked.has(item.path)).map((item) => item.path);

        setDownloading(true);
        setError('');
        try {
            await downloadPaths(selectedPaths, {
                filename: `${trimmedQuery || 'data-global-search'}-matches.zip`,
            });
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };
    const handleDownloadAllFiles = async () => {
        setDownloading(true);
        setError('');
        try {
            await downloadPaths(allFilePaths, {
                filename: `${trimmedQuery || 'data-global-search'}-files.zip`,
            });
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#111827', mb: 0.3 }}>
                        Global Search Results
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Search across all indexed files and folders without the column browser layout.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mt: 1 }}>
                        <Chip size="small" label={`${results.length} loaded`} sx={{ bgcolor: '#f3f4f6', color: '#4b5563', fontWeight: 600 }} />
                        <Chip size="small" label={`${fileResults.length} files`} sx={{ bgcolor: '#eef6ff', color: '#2563eb', fontWeight: 600 }} />
                        <Chip size="small" label={`${results.length - fileResults.length} folders`} sx={{ bgcolor: '#f8fafc', color: '#64748b', fontWeight: 600 }} />
                    </Box>
                </Box>

                {fileResults.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.7, py: 0.35, borderRadius: 999, bgcolor: allFilesChecked ? '#eff6ff' : '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Checkbox size="small" sx={{ p: 0.25 }} checked={allFilesChecked} indeterminate={someFilesChecked} onChange={handleToggleAllFiles} />
                            <Typography variant="caption" sx={{ color: '#4b5563', fontWeight: 700 }}>
                                All loaded files
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={downloading}
                            sx={{ minWidth: 0, px: 1.4, py: 0.4, fontSize: '0.74rem', textTransform: 'none', borderColor: '#cbd5e1', color: '#334155' }}
                            onClick={() => { void handleDownloadAllFiles(); }}
                        >
                            <FileDownload sx={{ fontSize: 14, mr: 0.4 }} /> {downloading ? 'Preparing...' : (truncated ? 'Download loaded' : 'Download all')}
                        </Button>
                        {checkedCount > 0 && (
                            <Chip label={`${checkedCount} selected`} size="small" color="primary" onDelete={clearAll} />
                        )}
                        {checkedCount > 0 && (
                            <Button
                                size="small"
                                variant="contained"
                                disabled={downloading}
                                sx={{ minWidth: 0, px: 1.5, py: 0.4, fontSize: '0.74rem', textTransform: 'none', boxShadow: 'none' }}
                                onClick={() => { void handleDownloadChecked(); }}
                            >
                                <FileDownload sx={{ fontSize: 14, mr: 0.4 }} /> {downloading ? 'Preparing...' : 'Download selected'}
                            </Button>
                        )}
                    </Box>
                )}
            </Box>

            {truncated && !loading && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Showing the top {results.length} ranked matches out of {totalCount}. "Download loaded" applies to the currently loaded matches.
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <Paper elevation={0} sx={{ border: '1px solid rgba(0,0,0,.06)', borderRadius: 3, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
                {!canSearch ? (
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                            Enter at least 2 characters to search all files and folders.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {loading && (
                            <Box sx={{ px: 2, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #eef2f7' }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>
                                    Searching server files. The first global search may build the index and take longer.
                                </Typography>
                            </Box>
                        )}
                        <TableContainer sx={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} onMouseLeave={() => setHovered(null)}>
                            <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', minWidth: { xs: 720, sm: 780 } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ ...thSx, width: 38, textAlign: 'center', px: 0.3 }}>
                                            <Checkbox
                                                size="small"
                                                sx={{ p: 0.3 }}
                                                checked={allVisibleChecked}
                                                indeterminate={someVisibleChecked}
                                                onChange={handleToggleAllVisible}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ ...thSx, width: 240 }}>Name</TableCell>
                                        <TableCell sx={{ ...thSx, width: { xs: 320, sm: 'auto' } }}>Path</TableCell>
                                        <TableCell sx={{ ...thSx, width: 96, textAlign: 'right' }}>Size</TableCell>
                                        <TableCell sx={{ ...thSx, width: 92, textAlign: 'center' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 8 }, (_, index) => (
                                            <TableRow key={`global-loading-${index}`}>
                                                <TableCell colSpan={5} sx={{ py: 1.2, px: 2 }}>
                                                    <Box sx={{ height: 16, bgcolor: '#f3f4f6', borderRadius: 1, width: `${52 + index * 5}%`, opacity: 0.85, ...shimmerSx }} />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : visibleResults.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#9ca3af', fontSize: '0.82rem' }}>
                                                No global matches for "{trimmedQuery}"
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        visibleResults.map((item) => {
                                            const isFile = item.type === 'file';
                                            const isChecked = isFile && checked.has(item.path);
                                            const openDir = isFile ? item.path.split('/').slice(0, -1).join('/') : item.path;

                                            return (
                                                <TableRow
                                                    key={`${item.type}-${item.path}`}
                                                    onMouseEnter={() => setHovered(item.path)}
                                                    sx={{
                                                        '& td': { py: 0.4, px: 1.5 },
                                                        bgcolor: isChecked ? '#f0f4ff' : 'transparent',
                                                        '&:hover': { bgcolor: isChecked ? '#e8edf8' : '#f8faff' },
                                                        transition: 'background-color .08s linear',
                                                    }}
                                                >
                                                    <TableCell sx={{ borderBottom: '1px solid #f3f4f6', textAlign: 'center', px: 0.3 }}>
                                                        {isFile && (
                                                            <Checkbox
                                                                size="small"
                                                                sx={{ p: 0.3 }}
                                                                checked={isChecked}
                                                                icon={<CheckBoxOutlineBlank sx={{ fontSize: 17 }} />}
                                                                checkedIcon={<CheckBox sx={{ fontSize: 17 }} />}
                                                                onChange={() => toggleFile(item.path)}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ borderBottom: '1px solid #f3f4f6', width: 240 }}>
                                                        {item.type === 'dir' ? (
                                                            <Box
                                                                component="button"
                                                                onClick={() => onOpenDirectory(item.path)}
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 0.7,
                                                                    width: '100%',
                                                                    border: 'none',
                                                                    bgcolor: 'transparent',
                                                                    cursor: 'pointer',
                                                                    fontFamily: 'monospace',
                                                                    fontSize: '0.79rem',
                                                                    fontWeight: 500,
                                                                    color: '#2563eb',
                                                                    textAlign: 'left',
                                                                    px: 0,
                                                                    py: 0.1,
                                                                    transition: 'color .08s linear, transform .08s linear',
                                                                    '&:hover': { color: '#1d4ed8', transform: 'translateX(2px)' },
                                                                    '&:active': { transform: 'translateX(4px) scale(0.98)' },
                                                                }}
                                                            >
                                                                <Folder sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                                                                <Box component="span" title={item.name} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {item.name}
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                                <InsertDriveFile sx={{ fontSize: 15, color: '#ccc', flexShrink: 0 }} />
                                                                <Box component="span" title={item.name} sx={{ fontFamily: 'monospace', fontSize: '0.79rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {item.name}
                                                                </Box>
                                                            </Box>
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ borderBottom: '1px solid #f3f4f6', width: { xs: 320, sm: 'auto' } }}>
                                                        <Box title={item.path} sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.path}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ borderBottom: '1px solid #f3f4f6', fontSize: '0.72rem', color: '#999' }}>
                                                        {isFile ? fmtSize(item.size) : ''}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.3 }}>
                                                            {isFile && (
                                                                <Tooltip title="Download">
                                                                    <IconButton size="small" onClick={() => {
                                                                        setDownloading(true);
                                                                        setError('');
                                                                        triggerDownload(item.path)
                                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                                            .finally(() => setDownloading(false));
                                                                    }} sx={{ '&:hover': { bgcolor: '#eef2ff' } }}>
                                                                        <Download sx={{ fontSize: 16, color: '#2563eb' }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            {!isFile && (
                                                                <Tooltip title="Download folder as ZIP">
                                                                    <IconButton size="small" onClick={() => {
                                                                        setDownloading(true);
                                                                        setError('');
                                                                        triggerBatchDownload([item.path], getZipName(item.path))
                                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                                            .finally(() => setDownloading(false));
                                                                    }} sx={{ '&:hover': { bgcolor: '#fef7ed' } }}>
                                                                        <FileDownload sx={{ fontSize: 16, color: '#e67e22' }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            <Tooltip title={item.type === 'dir' ? 'Open folder' : 'Open containing folder'}>
                                                                <IconButton size="small" onClick={() => onOpenDirectory(openDir)} sx={{ '&:hover': { bgcolor: '#eff6ff' } }}>
                                                                    <FolderOpen sx={{ fontSize: 16, color: '#2563eb' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{
                            px: 1.5,
                            py: 1,
                            borderTop: '1px solid #eef0f2',
                            bgcolor: hoveredItem ? '#fbfdff' : '#fafbfc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            minHeight: 54,
                            transition: 'background-color .08s linear',
                        }}>
                            {hoveredItem ? (
                                <>
                                    {hoveredItem.type === 'dir'
                                        ? <Folder sx={{ fontSize: 16, color: '#6b9fd4', flexShrink: 0 }} />
                                        : <InsertDriveFile sx={{ fontSize: 15, color: '#9ca3af', flexShrink: 0 }} />}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography noWrap variant="caption" sx={{ display: 'block', color: '#111827', fontWeight: 700 }}>
                                            {hoveredItem.name}
                                        </Typography>
                                        <Typography noWrap variant="caption" sx={{ display: 'block', color: '#6b7280', fontFamily: 'monospace' }}>
                                            {hoveredItem.path}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        size="small"
                                        label={hoveredItem.type === 'dir' ? 'Folder' : fmtSize(hoveredItem.size)}
                                        sx={{ height: 22, bgcolor: hoveredItem.type === 'dir' ? '#eff6ff' : '#f3f4f6', color: hoveredItem.type === 'dir' ? '#2563eb' : '#4b5563', fontWeight: 600 }}
                                    />
                                </>
                            ) : (
                                <>
                                    <Search sx={{ fontSize: 16, color: '#9ca3af', flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" sx={{ display: 'block', color: '#4b5563', fontWeight: 700 }}>
                                            Hover matches for details
                                        </Typography>
                                        <Typography noWrap variant="caption" sx={{ display: 'block', color: '#9ca3af' }}>
                                            Full path, file size, and quick folder context appear here while reviewing matches.
                                        </Typography>
                                    </Box>
                                    <Chip size="small" label={`${totalCount} matches`} sx={{ height: 22, bgcolor: '#f3f4f6', color: '#6b7280', fontWeight: 600 }} />
                                </>
                            )}
                        </Box>

                        {totalPages > 1 && (
                            <Box sx={{ py: 0.8, bgcolor: '#fafbfc', borderTop: '1px solid #eef0f2', display: 'flex', justifyContent: 'center' }}>
                                <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} size="small" siblingCount={0} boundaryCount={1} />
                            </Box>
                        )}
                    </>
                )}
            </Paper>
        </Box>
    );
}

export default function DataBrowser() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initDir = searchParams.get('dir') || '';
    const initFilter = searchParams.get('q') || '';
    const initMode = searchParams.get('mode') === 'global' || (initFilter && !initDir) ? 'global' : 'browse';

    const [columns, setColumns] = useState(() => buildColumnsFromDir(initDir));
    const [exitingCols, setExiting] = useState([]);
    const [filter, setFilter] = useState(() => initFilter);
    const [searchMode, setSearchMode] = useState(() => initMode);
    const [checked, setChecked] = useState(new Set());
    const [dirFileMap, setDirFileMap] = useState({});
    const [downloadState, setDownloadState] = useState({ loading: false, error: '' });
    const scrollRef = useRef(null);
    const exitTimer = useRef(null);
    const columnsRef = useRef(columns);
    const prevColumnCountRef = useRef(columns.length);
    columnsRef.current = columns;
    const isGlobalSearch = searchMode === 'global';

    // Schedule exit animation (dedup by id to handle Strict Mode)
    const scheduleExit = useCallback((removed) => {
        if (!removed.length) return;
        setExiting(old => {
            const ids = new Set(old.map(c => c.id));
            const fresh = removed.filter(c => !ids.has(c.id));
            return fresh.length ? [...old, ...fresh] : old;
        });
        clearTimeout(exitTimer.current);
        exitTimer.current = setTimeout(() => setExiting([]), ANIM + 30);
    }, []);

    const clearExitColumns = useCallback(() => {
        clearTimeout(exitTimer.current);
        setExiting([]);
    }, []);

    // ── navigation (side effects OUTSIDE state updaters) ──
    const syncUrl = useCallback((cols) => {
        const dirs = cols.slice(1).map(c => c.dir);
        const params = new URLSearchParams();
        if (!isGlobalSearch && dirs.length) params.set('dir', dirs.join('/'));
        if (filter) params.set('q', filter);
        if (isGlobalSearch) params.set('mode', 'global');
        startTransition(() => {
            setSearchParams(params, { replace: true });
        });
    }, [filter, isGlobalSearch, setSearchParams]);

    const enterDir = useCallback((colIndex, subPath) => {
        const prev = columnsRef.current;
        clearExitColumns();
        const next = [...prev.slice(0, colIndex + 1), mkCol(subPath)];
        setColumns(next);
        syncUrl(next);
    }, [clearExitColumns, syncUrl]);

    const backTo = useCallback((colIndex) => {
        const prev = columnsRef.current;
        if (colIndex >= prev.length - 1) return;
        const removed = prev.slice(colIndex + 1);
        scheduleExit(removed);
        const next = prev.slice(0, colIndex + 1);
        setColumns(next);
        syncUrl(next);
    }, [scheduleExit, syncUrl]);

    useEffect(() => () => clearTimeout(exitTimer.current), []);
    useEffect(() => { syncUrl(columnsRef.current); }, [filter, syncUrl]);

    // auto-scroll right when columns change
    useEffect(() => {
        const el = scrollRef.current;
        const prevCount = prevColumnCountRef.current;
        prevColumnCountRef.current = columns.length;

        if (!el || columns.length <= prevCount) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollTo({ left: el.scrollWidth, behavior: 'auto' });
            });
        });
    }, [columns.length]);

    // ── selection ──
    const onFiles = useCallback((dir, files) => {
        setDirFileMap(prev => ({ ...prev, [dir]: files }));
    }, []);

    const toggleFile = useCallback((path) => {
        setChecked(p => { const n = new Set(p); n.has(path) ? n.delete(path) : n.add(path); return n; });
    }, []);
    const togglePaths = useCallback((paths) => {
        setChecked(p => {
            const n = new Set(p);
            const all = paths.every(path => n.has(path));
            if (all) paths.forEach(path => n.delete(path)); else paths.forEach(path => n.add(path));
            return n;
        });
    }, []);
    const toggleDirAll = useCallback((_dir, files) => {
        togglePaths(files);
    }, [togglePaths]);
    const clearAll = useCallback(() => setChecked(new Set()), []);

    const handleGlobalSearchToggle = useCallback((event) => {
        clearExitColumns();
        setSearchMode(event.target.checked ? 'global' : 'browse');
    }, [clearExitColumns]);

    const openDirectoryFromGlobalSearch = useCallback((dir) => {
        clearExitColumns();
        setColumns(buildColumnsFromDir(dir));
        setSearchMode('browse');
    }, [clearExitColumns]);

    const allVisibleFiles = useMemo(() => {
        const all = [];
        for (const c of columns) {
            const fs = dirFileMap[c.dir] || [];
            const fl = filter ? fs.filter(f => f.split('/').pop().toLowerCase().includes(filter.toLowerCase())) : fs;
            all.push(...fl);
        }
        return all;
    }, [columns, dirFileMap, filter]);

    const visCk = allVisibleFiles.filter(f => checked.has(f));
    const allVisCk = allVisibleFiles.length > 0 && visCk.length === allVisibleFiles.length;
    const someVisCk = visCk.length > 0 && !allVisCk;

    const toggleAllVis = () => {
        if (allVisCk) setChecked(p => { const n = new Set(p); allVisibleFiles.forEach(f => n.delete(f)); return n; });
        else setChecked(p => { const n = new Set(p); allVisibleFiles.forEach(f => n.add(f)); return n; });
    };
    const handleDownloadSelection = async () => {
        setDownloadState({ loading: true, error: '' });
        try {
            await downloadPaths([...visCk], { filename: 'data-selection.zip' });
        } catch (err) {
            setDownloadState({ loading: false, error: getRequestErrorMessage(err, 'Download failed') });
            return;
        }
        setDownloadState({ loading: false, error: '' });
    };

    const ctxVal = useMemo(() => ({ checked, toggleFile, toggleDirAll, clearAll }), [checked, toggleFile, toggleDirAll, clearAll]);

    const showIntro = isGlobalSearch || (columns.length === 1 && exitingCols.length === 0);
    const compactBrowseLayout = !isGlobalSearch && columns.length === 1 && exitingCols.length === 0;

    return (
        <SelectionCtx.Provider value={ctxVal}>
            <Box sx={{
                width: isGlobalSearch ? '100%' : 'fit-content',
                maxWidth: '100%',
                minWidth: 0,
                mx: isGlobalSearch ? 0 : 'auto',
                p: '20px',
                height: 'calc(100vh - 80px)',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* intro */}
                <Box sx={{
                    overflow: 'hidden',
                    maxHeight: showIntro ? 80 : 0, opacity: showIntro ? 1 : 0,
                    transform: showIntro ? 'none' : 'translateY(-8px)',
                    transition: 'max-height .25s ease, opacity .2s ease, transform .22s ease',
                    mb: showIntro ? 0 : 0,
                }}>
                    <Box sx={{ pb: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: 0.5 }}>
                            {isGlobalSearch ? 'Global Search' : 'Data Browser'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isGlobalSearch
                                ? 'Search across all indexed files and folders with a flat results view.'
                                : 'Browse and download pipeline output files'}
                        </Typography>
                    </Box>
                </Box>

                {/* toolbar */}
                <Box sx={{
                    display: 'flex',
                    flexDirection: compactBrowseLayout ? 'column' : { xs: 'column', sm: 'row' },
                    alignItems: compactBrowseLayout ? 'stretch' : { xs: 'stretch', sm: 'center' },
                    gap: 1.5,
                    mb: 2,
                    flexShrink: 0,
                    flexWrap: compactBrowseLayout ? 'nowrap' : 'wrap',
                }}>
                    <TextField placeholder={isGlobalSearch ? 'Search all files and folders...' : 'Filter by name...'} size="small"
                        value={filter} onChange={e => setFilter(e.target.value)}
                        sx={{ width: { xs: '100%', sm: isGlobalSearch ? 440 : 320 } }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: '#aaa' }} /></InputAdornment>,
                            endAdornment: (
                                <InputAdornment position="end" sx={{ ml: 0.4 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                                        {filter && (
                                            <IconButton size="small" onClick={() => setFilter('')} sx={{ p: 0.3 }}>
                                                <Close sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        )}
                                        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: '#e5e7eb', mx: 0.25 }} />
                                        <Checkbox
                                            size="small"
                                            checked={isGlobalSearch}
                                            onChange={handleGlobalSearchToggle}
                                            sx={{ p: 0.35, color: '#94a3b8', '&.Mui-checked': { color: '#2563eb' } }}
                                        />
                                        <Typography variant="caption" sx={{ color: isGlobalSearch ? '#2563eb' : '#64748b', fontWeight: 700, pr: 0.2 }}>
                                            Global
                                        </Typography>
                                    </Box>
                                </InputAdornment>
                            ),
                        }}
                    />

                    {!isGlobalSearch && (
                        <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap',
                        }}>
                            {/* breadcrumb */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', gap: 0.3, overflowX: 'auto', flex: 1, py: 0.5,
                                '&::-webkit-scrollbar': { height: 3 }, '&::-webkit-scrollbar-thumb': { background: '#eee', borderRadius: 2 },
                            }}>
                                {columns.map((c, i) => (
                                    <React.Fragment key={c.id}>
                                        {i > 0 && <ChevronRight sx={{ fontSize: 13, color: '#ccc', flexShrink: 0, transition: 'transform .15s' }} />}
                                        <Chip label={c.dir.split('/').pop() || 'data'} size="small"
                                            variant={i === columns.length - 1 ? 'filled' : 'outlined'}
                                            color={i === columns.length - 1 ? 'primary' : 'default'}
                                            onClick={() => backTo(i)}
                                            sx={{
                                                cursor: 'pointer', fontWeight: i === columns.length - 1 ? 600 : 400, flexShrink: 0,
                                                transition: 'all .18s ease',
                                                '&:hover': { transform: 'translateY(-1px)' },
                                                '&:active': { transform: 'scale(0.96)' },
                                            }} />
                                    </React.Fragment>
                                ))}
                            </Box>

                            {/* batch actions */}
                            {visCk.length > 0 && (
                                <Box sx={{
                                    display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0,
                                    animation: 'fadeIn .2s ease both',
                                    '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateX(6px)' }, to: { opacity: 1, transform: 'none' } },
                                }}>
                                    <Checkbox size="small" sx={{ p: 0.3 }} checked={allVisCk} indeterminate={someVisCk} onChange={toggleAllVis} title="Select all visible" />
                                    <Chip label={visCk.length} size="small" color="primary" onDelete={clearAll} sx={{ fontSize: '0.72rem' }} />
                                    <Button size="small" variant="contained"
                                        disabled={downloadState.loading}
                                        sx={{ minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.7rem', textTransform: 'none', boxShadow: 'none' }}
                                        onClick={() => { void handleDownloadSelection(); }}>
                                        <FileDownload sx={{ fontSize: 14, mr: 0.3 }} /> {downloadState.loading ? 'Preparing...' : 'Download'}
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
                {downloadState.loading && <LinearProgress sx={{ ...loadingBarSx, mb: 1 }} />}
                {downloadState.error && (
                    <Alert severity="error" sx={{ mb: 1, borderRadius: 2 }} onClose={() => setDownloadState({ loading: false, error: '' })}>
                        {downloadState.error}
                    </Alert>
                )}

                {isGlobalSearch ? (
                    <GlobalSearchResults
                        query={filter}
                        checked={checked}
                        toggleFile={toggleFile}
                        togglePaths={togglePaths}
                        clearAll={clearAll}
                        onOpenDirectory={openDirectoryFromGlobalSearch}
                    />
                ) : (
                    <Paper elevation={0} sx={{ border: '1px solid rgba(0,0,0,.06)', borderRadius: 3, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box ref={scrollRef} sx={{
                            display: 'flex', flex: 1, minHeight: 0,
                            overflowX: 'auto', overflowY: 'hidden',
                            '&::-webkit-scrollbar': { height: 6 },
                            '&::-webkit-scrollbar-thumb': { background: '#ddd', borderRadius: 3 },
                        }}>
                            {/* active columns */}
                            {columns.map((c, i) => (
                                <DirColumn key={c.id} dir={c.dir} filter={filter} onFiles={onFiles}
                                    animState="enter"
                                    onEnter={(subPath) => enterDir(i, subPath)} />
                            ))}
                            {/* pure back navigation keeps trailing columns exiting on the right */}
                            {exitingCols.map(c => (
                                <ExitingColumnGhost key={`x-${c.id}`} dir={c.dir} />
                            ))}
                        </Box>
                    </Paper>
                )}
            </Box>
        </SelectionCtx.Provider>
    );
}
