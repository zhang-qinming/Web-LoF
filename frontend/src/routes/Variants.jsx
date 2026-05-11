import React, { useEffect, useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import {
    Box, Typography, TextField, IconButton, Checkbox, Collapse,
    Chip, Pagination, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, InputAdornment, Tooltip, Button,
} from '@mui/material';
import {
    Download, Folder, InsertDriveFile, Search, FolderOpen, ChevronRight, Close,
    FileDownload, CheckBoxOutlineBlank, CheckBox, IndeterminateCheckBox,
} from '@mui/icons-material';
import axios from 'axios';

const API = axios.create({ baseURL: '/api/data' });
const PER_PAGE = 40;
const COL_WIDTH = 350;

function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const thSx = {
    bgcolor: '#f8f9fb', fontWeight: 600, fontSize: '0.7rem',
    color: '#888', borderBottom: '2px solid #e8eaed',
    py: 0.8, px: 1.5, position: 'sticky', top: 0, zIndex: 1,
};

// ---- 全局选中上下文 ----
const SelectionCtx = createContext({ checked: new Set(), toggleFile: () => {}, toggleDirAll: () => {}, clearAll: () => {} });

// ============================================================
const DirColumn = React.memo(function DirColumn({ dir, filter, onEnter, dirFiles, exiting, onExited }) {
    const [items, setItems]       = useState([]);
    const [page, setPage]         = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading]   = useState(true);
    const [hovered, setHovered]   = useState(null);
    const [sortBy, setSortBy]     = useState('name');
    const [sortDir, setSortDir]   = useState('asc');
    const { checked, toggleFile, toggleDirAll } = useContext(SelectionCtx);

    const loadPage = useCallback((p) => {
        setLoading(true);
        API.get('/list', { params: { dir, page: p, limit: PER_PAGE } })
            .then(r => {
                const data = r.data.data || [];
                setItems(data);
                setTotalPages(r.data.totalPages || 1);
                setTotalCount(r.data.totalCount || 0);
                // 通知父组件该目录下的文件列表
                const files = data.filter(f => f.type === 'file').map(f => f.path);
                dirFiles(dir, files);
            }).catch(() => {}).finally(() => setLoading(false));
    }, [dir]);

    useEffect(() => { setPage(1); loadPage(1); }, [dir]);
    useEffect(() => { if (page > 1) loadPage(page); }, [page]);
    useEffect(() => { setPage(1); }, [filter]);

    const filtered = useMemo(() => {
        let list = filter ? items.filter(f => f.name.toLowerCase().includes(filter.toLowerCase())) : [...items];
        list.sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            if (sortBy === 'size') return ((a.size || 0) - (b.size || 0)) * dir;
            if (sortBy === 'type') return a.type.localeCompare(b.type) * dir || a.name.localeCompare(b.name) * dir;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * dir;
        });
        return list;
    }, [items, filter, sortBy, sortDir]);

    const fileItems  = filtered.filter(f => f.type === 'file');
    const checkedInDir = fileItems.filter(f => checked.has(f.path));
    const allChecked   = fileItems.length > 0 && checkedInDir.length === fileItems.length;
    const someChecked  = checkedInDir.length > 0 && !allChecked;

    return (
        <Box sx={{
            width: COL_WIDTH, minWidth: COL_WIDTH, flexShrink: 0,
            borderRight: '1px solid #eef0f2',
            display: 'flex', flexDirection: 'column', bgcolor: '#fff',
            animation: exiting ? 'columnOut 0.15s ease-in forwards' : 'columnIn 0.18s ease-out',
            '@keyframes columnIn': { from: { opacity: 0, transform: 'translateX(12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
            '@keyframes columnOut': { to: { opacity: 0, transform: 'translateX(-8px)' } },
        }}
            onAnimationEnd={exiting ? onExited : undefined}
        >
            <Box sx={{
                px: 1.5, py: 0.9, bgcolor: '#fafbfc',
                borderBottom: '2px solid #e8eaed', display: 'flex', alignItems: 'center', gap: 1,
            }}>
                <FolderOpen sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                <Typography noWrap variant="caption"
                    sx={{ fontWeight: 700, color: '#444', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>
                    {dir.split('/').pop() || 'data'}
                </Typography>
                <Chip label={totalCount} size="small"
                    sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#eef0f2', color: '#888', fontWeight: 600 }} />
                <Tooltip title="Download folder as ZIP">
                    <IconButton size="small"
                        component="span"
                        onClick={() => {
                            const a = document.createElement('a');
                            a.href = `/api/data/download?path=${encodeURIComponent(dir || '')}`;
                            a.download = '';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        }}
                        sx={{ color: '#888', '&:hover': { color: '#e67e22', bgcolor: '#fef7ed' } }}>
                        <FileDownload sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...thSx, width: 38, textAlign: 'center', px: 0.3 }}>
                                <Checkbox size="small" sx={{ p: 0.3 }} checked={allChecked}
                                    indeterminate={someChecked}
                                    onChange={() => toggleDirAll(dir, fileItems.map(f => f.path))} />
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
                                    <Box sx={{ height: 16, bgcolor: '#f3f4f6', borderRadius: 1, width: `${55 + Math.random() * 45}%` }} />
                                </TableCell></TableRow>
                            ))
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: '#bbb', fontSize: '0.8rem' }}>
                                {filter ? 'No match' : '—'}
                            </TableCell></TableRow>
                        ) : (
                            filtered.map(f => {
                                const isFile = f.type === 'file', isChecked = checked.has(f.path);
                                return (
                                    <TableRow key={f.path}
                                        onMouseEnter={() => setHovered(f.path)}
                                        onMouseLeave={() => setHovered(null)}
                                        sx={{ '& td': { py: 0.3, px: 1.5 }, bgcolor: isChecked ? '#f0f4ff' : 'transparent',
                                            '&:hover': { bgcolor: isChecked ? '#e8edf8' : '#f8faff' },
                                            transition: 'background-color 0.1s ease' }}>
                                        <TableCell sx={{ borderBottom: '1px solid #f3f4f6', textAlign: 'center', px: 0.3 }}>
                                            {isFile ? <Checkbox size="small" sx={{ p: 0.3 }} checked={isChecked}
                                                icon={<CheckBoxOutlineBlank sx={{ fontSize: 17 }} />}
                                                checkedIcon={<CheckBox sx={{ fontSize: 17 }} />}
                                                onChange={() => toggleFile(f.path)} /> : null}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {f.type === 'dir' ? (
                                                <Box component="button" onClick={() => onEnter(f.path)}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.7, width: '100%',
                                                        border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                                                        fontFamily: 'monospace', fontSize: '0.79rem', fontWeight: 500,
                                                        color: '#2563eb', textAlign: 'left', px: 0, py: 0.1,
                                                        '&:hover': { color: '#1d4ed8' } }}>
                                                    <Folder sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                                                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Box>
                                                    <ChevronRight sx={{ fontSize: 16, opacity: 0.3, flexShrink: 0, ml: 'auto' }} />
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                    <InsertDriveFile sx={{ fontSize: 15, color: '#ccc', flexShrink: 0 }} />
                                                    <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.79rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Box>
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ borderBottom: '1px solid #f3f4f6', fontSize: '0.72rem', color: '#999' }}>
                                            {f.type === 'dir' ? '' : fmtSize(f.size)}</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {isFile ? (
                                                <Tooltip title="Download">
                                                    <IconButton size="small"
                                                        href={`/api/data/download?path=${encodeURIComponent(f.path)}`}
                                                        sx={{ opacity: (hovered === f.path || isChecked) ? 0.9 : 0.15,
                                                            transition: 'opacity 0.12s ease',
                                                            '&:hover': { opacity: 1, bgcolor: '#eef2ff' } }}>
                                                        <Download sx={{ fontSize: 16, color: '#2563eb' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title="Download as ZIP">
                                                    <IconButton size="small" component="span"
                                                        onClick={() => {
                                                            const a = document.createElement('a');
                                                            a.href = `/api/data/download?path=${encodeURIComponent(f.path)}`;
                                                            a.download = '';
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                        }}
                                                        sx={{ opacity: hovered === f.path ? 0.8 : 0.3,
                                                            transition: 'opacity 0.12s ease',
                                                            '&:hover': { opacity: 1, bgcolor: '#fef7ed' } }}>
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
                    <Pagination count={totalPages} page={page} onChange={(e, v) => setPage(v)}
                        size="small" siblingCount={0} boundaryCount={1} />
                </Box>
            )}
        </Box>
    );
});

// ============================================================
export default function DataBrowser() {
    const [pathStack, setPathStack]   = useState(['']);
    const [filter, setFilter]         = useState('');
    const [checked, setChecked]       = useState(new Set());
    const [exitDirs, setExitDirs]     = useState(new Set());
    const [dirFileMap, setDirFileMap] = useState({});  // dir → file paths in that dir
    const scrollRef = useRef(null);

    const enter  = useCallback((subPath) => setPathStack(prev => [...prev, subPath]), []);
    const backTo = useCallback((idx) => {
        setPathStack(prev => {
            const removed = prev.slice(idx + 1);
            if (removed.length) {
                setExitDirs(cur => { const s = new Set(cur); removed.forEach(d => s.add(d)); return s; });
            }
            return prev.slice(0, idx + 1);
        });
    }, []);

    const dirFiles = useCallback((dir, files) => {
        setDirFileMap(prev => ({ ...prev, [dir]: files }));
    }, []);

    // 全局选中操作
    const toggleFile = useCallback((path) => {
        setChecked(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
    }, []);
    const toggleDirAll = useCallback((dir, files) => {
        setChecked(prev => {
            const n = new Set(prev);
            const allInDir = files.every(f => n.has(f));
            if (allInDir) files.forEach(f => n.delete(f));
            else files.forEach(f => n.add(f));
            return n;
        });
    }, []);
    const clearAll = useCallback(() => setChecked(new Set()), []);

    // 筛选条件下所有可见文件
    const allVisibleFiles = useMemo(() => {
        const all = [];
        for (const dir of pathStack) {
            const files = dirFileMap[dir] || [];
            const filtered = filter
                ? files.filter(f => f.split('/').pop().toLowerCase().includes(filter.toLowerCase()))
                : files;
            all.push(...filtered);
        }
        return all;
    }, [pathStack, dirFileMap, filter]);

    const visibleChecked = allVisibleFiles.filter(f => checked.has(f));
    const allVisibleChecked = allVisibleFiles.length > 0 && visibleChecked.length === allVisibleFiles.length;
    const someVisibleChecked = visibleChecked.length > 0 && !allVisibleChecked;

    const toggleAllVisible = () => {
        if (allVisibleChecked) {
            setChecked(prev => { const n = new Set(prev); allVisibleFiles.forEach(f => n.delete(f)); return n; });
        } else {
            setChecked(prev => { const n = new Set(prev); allVisibleFiles.forEach(f => n.add(f)); return n; });
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, [pathStack.length]);

    const browsing = pathStack.length > 1;
    const allDirs  = [...pathStack, ...[...exitDirs].filter(d => !pathStack.includes(d))];  // pathStack 优先

    return (
        <SelectionCtx.Provider value={{ checked, toggleFile, toggleDirAll, clearAll }}>
            <Box style={{ maxWidth: '100%', margin: '0 auto', padding: '20px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{
                    overflow: 'hidden',
                    maxHeight: browsing ? 0 : 80,
                    opacity: browsing ? 0 : 1,
                    mb: browsing ? 0 : 2,
                    transition: 'max-height 0.2s ease, opacity 0.2s ease, margin 0.2s ease',
                }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: 0.5 }}>Data Browser</Typography>
                    <Typography variant="body2" color="text.secondary">Browse and download pipeline output files</Typography>
                </Box>

                {/* 工具栏 */}
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

                    {/* 面包屑 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, overflowX: 'auto', flex: 1, py: 0.5,
                        '&::-webkit-scrollbar': { height: 3 }, '&::-webkit-scrollbar-thumb': { background: '#eee', borderRadius: 2 } }}>
                        {pathStack.map((p, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <ChevronRight sx={{ fontSize: 13, color: '#ccc', flexShrink: 0 }} />}
                                <Chip label={p.split('/').pop() || 'data'} size="small"
                                    variant={i === pathStack.length - 1 ? 'filled' : 'outlined'}
                                    color={i === pathStack.length - 1 ? 'primary' : 'default'}
                                    onClick={() => backTo(i)}
                                    sx={{ cursor: 'pointer', fontWeight: i === pathStack.length - 1 ? 600 : 400, flexShrink: 0 }} />
                            </React.Fragment>
                        ))}
                    </Box>

                    {filter && allVisibleFiles.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Checkbox size="small" sx={{ p: 0.3 }} checked={allVisibleChecked}
                                indeterminate={someVisibleChecked}
                                onChange={toggleAllVisible}
                                title="Select all visible" />
                            {visibleChecked.length > 0 && (
                                <>
                                    <Chip label={visibleChecked.length} size="small" color="primary"
                                        onDelete={clearAll} sx={{ fontSize: '0.72rem' }} />
                                    <Button size="small" variant="contained"
                                        sx={{ minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.7rem', textTransform: 'none', boxShadow: 'none' }}
                                        onClick={() => {
                                            [...visibleChecked].forEach((p, i) => {
                                                setTimeout(() => {
                                                    const a = document.createElement('a');
                                                    a.href = `/api/data/download?path=${encodeURIComponent(p)}`;
                                                    a.download = '';
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                }, i * 200);
                                            });
                                        }}>
                                        <FileDownload sx={{ fontSize: 14, mr: 0.3 }} /> Download
                                    </Button>
                                </>
                            )}
                        </Box>
                    )}
                </Box>

                <Paper elevation={0} sx={{ border: '1px solid rgba(0,0,0,.06)', borderRadius: 3, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box ref={scrollRef} sx={{ display: 'flex', flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden',
                        '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { background: '#ddd', borderRadius: 3 } }}>
                        {allDirs.map((dir, i) => {
                            const e = exitDirs.has(dir);
                            return (
                                <DirColumn key={dir || '__root__'} dir={dir} filter={filter}
                                    dirFiles={dirFiles} exiting={e}
                                    onExited={() => setExitDirs(prev => { const s = new Set(prev); s.delete(dir); return s; })}
                                    onEnter={(p) => setPathStack(prev => [...prev.slice(0, i + 1), p])} />
                            );
                        })}
                    </Box>
                </Paper>
            </Box>
        </SelectionCtx.Provider>
    );
}
