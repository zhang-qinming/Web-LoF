import React, { useEffect, useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box, Typography, TextField, IconButton, Checkbox,
    Chip, Pagination, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, InputAdornment, Tooltip, Button,
} from '@mui/material';
import {
    Download, Folder, InsertDriveFile, Search, FolderOpen, ChevronRight, Close,
    FileDownload, CheckBoxOutlineBlank, CheckBox,
} from '@mui/icons-material';
import axios from 'axios';

const API = axios.create({ baseURL: '/api/data' });
const PER = 40, COL_W = 440, ANIM = 170;

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

function getListCacheKey(dir, page, filter) {
    return `${dir}::${page}::${filter || ''}`;
}

/* ═══════════════ Column ═══════════════ */
const DirColumn = React.memo(function DirColumn({ dir, filter, onEnter, onFiles, animState }) {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotal] = useState(1);
    const [totalCount, setCnt] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hovered, setHov] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const enterSettledRef = useRef(animState === 'exit');
    const { checked, toggleFile, toggleDirAll } = useContext(SelectionCtx);

    useEffect(() => {
        let cancelled = false;
        const cacheKey = getListCacheKey(dir, page, filter);
        const cached = LIST_CACHE.get(cacheKey);

        if (cached) {
            setItems(cached.items);
            setTotal(cached.totalPages);
            setCnt(cached.totalCount);
            onFiles(dir, cached.filePaths);
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
                onFiles(dir, nextCache.filePaths);
            })
            .catch(() => {})
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

    const dlFolder = () => {
        const a = document.createElement('a');
        a.href = `/api/data/download?path=${encodeURIComponent(dir || '')}`;
        a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
                <Tooltip title="Download folder as ZIP">
                    <IconButton size="small" onClick={dlFolder} sx={{ color: '#888', '&:hover': { color: '#e67e22', bgcolor: '#fef7ed' } }}>
                        <FileDownload sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* table */}
            <TableContainer sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
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
                                        animation: 'shimmer 1.2s ease-in-out infinite alternate',
                                        '@keyframes shimmer': { from: { opacity: 0.5 }, to: { opacity: 1 } },
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
                                        onMouseEnter={() => setHov(f.path)} onMouseLeave={() => setHov(null)}
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
                                                    <IconButton size="small" href={`/api/data/download?path=${encodeURIComponent(f.path)}`}
                                                        sx={{ opacity: (hovered === f.path || isCk) ? 0.9 : 0.15, transition: 'opacity .12s', '&:hover': { opacity: 1, bgcolor: '#eef2ff' } }}>
                                                        <Download sx={{ fontSize: 16, color: '#2563eb' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title="Download as ZIP">
                                                    <IconButton size="small" component="span" onClick={() => {
                                                        const a = document.createElement('a');
                                                        a.href = `/api/data/download?path=${encodeURIComponent(f.path)}`;
                                                        a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                                    }} sx={{ opacity: hovered === f.path ? 0.8 : 0.3, transition: 'opacity .12s', '&:hover': { opacity: 1, bgcolor: '#fef7ed' } }}>
                                                        <FileDownload sx={{ fontSize: 16, color: '#e67e22' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

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

export default function DataBrowser() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [columns, setColumns] = useState(() => {
        const initDir = searchParams.get('dir') || '';
        if (!initDir) return [mkCol('')];

        const parts = initDir.split('/').filter(Boolean);
        const cols = [mkCol('')];
        let acc = '';
        for (const p of parts) {
            acc = acc ? `${acc}/${p}` : p;
            cols.push(mkCol(acc));
        }
        return cols;
    });
    const [exitingCols, setExiting] = useState([]);
    const [filter, setFilter] = useState(() => searchParams.get('q') || '');
    const [checked, setChecked] = useState(new Set());
    const [dirFileMap, setDirFileMap] = useState({});
    const scrollRef = useRef(null);
    const exitTimer = useRef(null);
    const columnsRef = useRef(columns);
    const prevColumnCountRef = useRef(columns.length);
    columnsRef.current = columns;

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
        if (dirs.length) params.set('dir', dirs.join('/'));
        if (filter) params.set('q', filter);
        setSearchParams(params, { replace: true });
    }, [filter, setSearchParams]);

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

        const behavior = prevCount <= 1 ? 'auto' : 'smooth';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollTo({ left: el.scrollWidth, behavior });
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
    const toggleDirAll = useCallback((dir, files) => {
        setChecked(p => {
            const n = new Set(p);
            const all = files.every(f => n.has(f));
            if (all) files.forEach(f => n.delete(f)); else files.forEach(f => n.add(f));
            return n;
        });
    }, []);
    const clearAll = useCallback(() => setChecked(new Set()), []);

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

    const ctxVal = useMemo(() => ({ checked, toggleFile, toggleDirAll, clearAll }), [checked, toggleFile, toggleDirAll, clearAll]);

    const showIntro = columns.length === 1 && exitingCols.length === 0;

    return (
        <SelectionCtx.Provider value={ctxVal}>
            <Box sx={{ maxWidth: '100%', mx: 'auto', p: '20px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
                {/* intro */}
                <Box sx={{
                    overflow: 'hidden',
                    maxHeight: showIntro ? 80 : 0, opacity: showIntro ? 1 : 0,
                    transform: showIntro ? 'none' : 'translateY(-8px)',
                    transition: 'max-height .25s ease, opacity .2s ease, transform .22s ease',
                    mb: showIntro ? 0 : 0,
                }}>
                    <Box sx={{ pb: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: 0.5 }}>Data Browser</Typography>
                        <Typography variant="body2" color="text.secondary">Browse and download pipeline output files</Typography>
                    </Box>
                </Box>

                {/* toolbar */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexShrink: 0, flexWrap: 'wrap' }}>
                    <TextField placeholder="Filter by name..." size="small"
                        value={filter} onChange={e => setFilter(e.target.value)}
                        sx={{ width: 260 }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: '#aaa' }} /></InputAdornment>,
                            endAdornment: filter && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setFilter('')} sx={{ p: 0.3 }}><Close sx={{ fontSize: 16 }} /></IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />

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
                                sx={{ minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.7rem', textTransform: 'none', boxShadow: 'none' }}
                                onClick={() => {
                                    [...visCk].forEach((p, i) => {
                                        setTimeout(() => {
                                            const a = document.createElement('a');
                                            a.href = `/api/data/download?path=${encodeURIComponent(p)}`;
                                            a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                                        }, i * 200);
                                    });
                                }}>
                                <FileDownload sx={{ fontSize: 14, mr: 0.3 }} /> Download
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* columns container */}
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
            </Box>
        </SelectionCtx.Provider>
    );
}
