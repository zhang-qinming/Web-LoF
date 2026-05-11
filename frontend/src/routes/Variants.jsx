import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    Box, Typography, TextField, IconButton, Checkbox,
    Chip, Pagination, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, InputAdornment, Tooltip, Button,
} from '@mui/material';
import {
    Download, Folder, InsertDriveFile, Search, FolderOpen, ChevronRight, Close,
    FileDownload,
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

// ============================================================
function DirColumn({ dir, filter, onEnter }) {
    const [items, setItems]       = useState([]);
    const [page, setPage]         = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading]   = useState(true);
    const [hovered, setHovered]   = useState(null);
    const [checked, setChecked]   = useState(new Set());
    const [visible, setVisible]   = useState(false);   // 入场动画

    const loadPage = useCallback((p) => {
        setLoading(true);
        API.get('/list', { params: { dir, page: p, limit: PER_PAGE } })
            .then(r => {
                setItems(r.data.data || []);
                setTotalPages(r.data.totalPages || 1);
                setTotalCount(r.data.totalCount || 0);
            }).catch(() => {}).finally(() => setLoading(false));
    }, [dir]);

    useEffect(() => { setPage(1); loadPage(1); setChecked(new Set()); }, [dir]);
    useEffect(() => { if (page > 1) loadPage(page); }, [page]);
    useEffect(() => { setPage(1); }, [filter]);
    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        return () => setVisible(false);
    }, []);

    const filtered = useMemo(() =>
        filter ? items.filter(f => f.name.toLowerCase().includes(filter.toLowerCase())) : items,
    [items, filter]);

    const dirName = dir.split('/').pop() || 'data';
    const checkedCount = checked.size;

    const toggle = (path) => {
        setChecked(prev => {
            const next = new Set(prev);
            next.has(path) ? next.delete(path) : next.add(path);
            return next;
        });
    };
    const toggleAll = () => {
        if (checkedCount === filtered.filter(f => f.type === 'file').length) {
            setChecked(new Set());
        } else {
            setChecked(new Set(filtered.filter(f => f.type === 'file').map(f => f.path)));
        }
    };

    return (
        <Box sx={{
            width: visible ? COL_WIDTH : 0,
            minWidth: visible ? COL_WIDTH : 0,
            maxWidth: COL_WIDTH,
            flexShrink: 0,
            borderRight: visible ? '1px solid #eef0f2' : 'none',
            display: 'flex', flexDirection: 'column', bgcolor: '#fff',
            opacity: visible ? 1 : 0,
            transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease, min-width 0.28s cubic-bezier(0.4, 0, 0.2, 1), border 0s 0.28s',
            overflow: 'hidden',
        }}>
            {/* 列头 */}
            <Box sx={{
                px: 1.5, py: 0.9, bgcolor: '#fafbfc',
                borderBottom: '2px solid #e8eaed',
                display: 'flex', alignItems: 'center', gap: 1,
            }}>
                <FolderOpen sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                <Typography noWrap variant="caption"
                    sx={{ fontWeight: 700, color: '#444', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 }}>
                    {dirName}
                </Typography>
                <Chip label={totalCount} size="small"
                    sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#eef0f2', color: '#888', fontWeight: 600 }} />
            </Box>

            {/* 批量操作栏 */}
            {checkedCount > 0 && (
                <Box sx={{
                    px: 1.5, py: 0.6, bgcolor: '#eef2ff',
                    borderBottom: '1px solid #dde3f0',
                    display: 'flex', alignItems: 'center', gap: 1,
                    animation: 'fadeIn 0.15s ease',
                    '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                }}>
                    <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600, flex: 1 }}>
                        {checkedCount} selected
                    </Typography>
                    <Button size="small" variant="contained" sx={{ minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.7rem', textTransform: 'none' }}
                        onClick={() => {
                            checked.forEach(p => {
                                window.open(`/api/data/download?path=${encodeURIComponent(p)}`, '_blank');
                            });
                        }}>
                        <FileDownload sx={{ fontSize: 14, mr: 0.5 }} />
                        Download
                    </Button>
                    <IconButton size="small" onClick={() => setChecked(new Set())} sx={{ color: '#888' }}>
                        <Close sx={{ fontSize: 15 }} />
                    </IconButton>
                </Box>
            )}

            <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...thSx, width: 36, textAlign: 'center', px: 0.5 }}>
                                <Checkbox size="small" sx={{ p: 0.3 }}
                                    checked={checkedCount > 0 && checkedCount === filtered.filter(f => f.type === 'file').length}
                                    indeterminate={checkedCount > 0 && checkedCount < filtered.filter(f => f.type === 'file').length}
                                    onChange={toggleAll} />
                            </TableCell>
                            <TableCell sx={thSx}>Name</TableCell>
                            <TableCell sx={{ ...thSx, width: 64, textAlign: 'right' }}>Size</TableCell>
                            <TableCell sx={{ ...thSx, width: 40, textAlign: 'center' }}>
                                <Download sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                <CircularProgress size={22} sx={{ color: '#ccc' }} />
                            </TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: '#bbb', fontSize: '0.8rem' }}>
                                {filter ? 'No match' : '—'}
                            </TableCell></TableRow>
                        ) : (
                            filtered.map(f => {
                                const isFile = f.type === 'file';
                                const isChecked = checked.has(f.path);
                                return (
                                    <TableRow key={f.path}
                                        onMouseEnter={() => setHovered(f.path)}
                                        onMouseLeave={() => setHovered(null)}
                                        sx={{
                                            '& td': { py: 0.3, px: 1.5 },
                                            bgcolor: isChecked ? '#f0f4ff' : 'transparent',
                                            '&:hover': { bgcolor: isChecked ? '#e8edf8' : '#f8faff' },
                                            transition: 'background-color 0.1s ease',
                                        }}>
                                        {/* 勾选 */}
                                        <TableCell sx={{ borderBottom: '1px solid #f3f4f6', textAlign: 'center', px: 0.5 }}>
                                            {isFile && (
                                                <Checkbox size="small" sx={{ p: 0.3 }}
                                                    checked={isChecked}
                                                    onChange={() => toggle(f.path)} />
                                            )}
                                        </TableCell>

                                        {/* 名称 */}
                                        <TableCell sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {f.type === 'dir' ? (
                                                <Box component="button"
                                                    onClick={() => onEnter(f.path)}
                                                    sx={{
                                                        display: 'flex', alignItems: 'center', gap: 0.7, width: '100%',
                                                        border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                                                        fontFamily: 'monospace', fontSize: '0.79rem', fontWeight: 500,
                                                        color: '#2563eb', textAlign: 'left', px: 0, py: 0.1,
                                                        '&:hover': { color: '#1d4ed8' },
                                                    }}>
                                                    <Folder sx={{ fontSize: 17, color: '#6b9fd4', flexShrink: 0 }} />
                                                    <Box component="span" sx={{
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {f.name}
                                                    </Box>
                                                    <ChevronRight sx={{ fontSize: 16, opacity: 0.3, flexShrink: 0, ml: 'auto' }} />
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                    <InsertDriveFile sx={{ fontSize: 15, color: '#ccc', flexShrink: 0 }} />
                                                    <Box component="span" sx={{
                                                        fontFamily: 'monospace', fontSize: '0.79rem',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {f.name}
                                                    </Box>
                                                </Box>
                                            )}
                                        </TableCell>

                                        {/* 大小 */}
                                        <TableCell align="right"
                                            sx={{ borderBottom: '1px solid #f3f4f6', fontSize: '0.72rem', color: '#999' }}>
                                            {f.type === 'dir' ? '' : fmtSize(f.size)}
                                        </TableCell>

                                        {/* 下载 */}
                                        <TableCell align="center"
                                            sx={{ borderBottom: '1px solid #f3f4f6' }}>
                                            {isFile && (
                                                <Tooltip title="Download">
                                                    <IconButton size="small"
                                                        href={`/api/data/download?path=${encodeURIComponent(f.path)}`}
                                                        sx={{
                                                            opacity: hovered === f.path || isChecked ? 0.9 : 0.2,
                                                            transition: 'opacity 0.12s ease',
                                                            '&:hover': { opacity: 1, bgcolor: '#eef2ff' },
                                                        }}>
                                                        <Download sx={{ fontSize: 16, color: '#2563eb' }} />
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
                <Box sx={{
                    py: 0.8, bgcolor: '#fafbfc', borderTop: '1px solid #eef0f2',
                    display: 'flex', justifyContent: 'center',
                }}>
                    <Pagination count={totalPages} page={page}
                        onChange={(e, v) => setPage(v)}
                        size="small" siblingCount={0} boundaryCount={1} />
                </Box>
            )}
        </Box>
    );
}

// ============================================================
export default function DataBrowser() {
    const [pathStack, setPathStack] = useState(['']);
    const [filter, setFilter]       = useState('');
    const scrollRef = useRef(null);
    const prevLen    = useRef(1);

    const enter = useCallback((subPath) => {
        setPathStack(prev => [...prev, subPath]);
    }, []);

    const backTo = useCallback((idx) => {
        setPathStack(prev => prev.slice(0, idx + 1));
    }, []);

    React.useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (pathStack.length > prevLen.current) {
            requestAnimationFrame(() => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }));
        }
        prevLen.current = pathStack.length;
    }, [pathStack.length]);

    const pathLabels = pathStack.map(p => p.split('/').pop() || 'data');

    return (
        <Box style={{ maxWidth: '100%', margin: '0 auto', padding: '20px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 2, flexShrink: 0 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: 0.5 }}>Data Browser</Typography>
                <Typography variant="body2" color="text.secondary">
                    Browse and download pipeline outputs
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexShrink: 0 }}>
                <TextField placeholder="Filter by name..." size="small"
                    value={filter} onChange={e => setFilter(e.target.value)}
                    sx={{ width: 280 }}
                    slotProps={{
                        input: {
                            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: '#aaa' }} /></InputAdornment>,
                            endAdornment: filter ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setFilter('')} sx={{ p: 0.3 }}>
                                        <Close sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    }}
                />

                <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.3,
                    overflowX: 'auto', flex: 1, py: 0.5,
                    '&::-webkit-scrollbar': { height: 3 },
                    '&::-webkit-scrollbar-thumb': { background: '#eee', borderRadius: 2 },
                }}>
                    {pathLabels.map((label, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <ChevronRight sx={{ fontSize: 13, color: '#ccc', flexShrink: 0 }} />}
                            <Chip label={label} size="small"
                                variant={i === pathLabels.length - 1 ? 'filled' : 'outlined'}
                                color={i === pathLabels.length - 1 ? 'primary' : 'default'}
                                onClick={() => backTo(i)}
                                sx={{ cursor: 'pointer', fontWeight: i === pathLabels.length - 1 ? 600 : 400, flexShrink: 0, transition: 'all 0.15s ease' }}
                            />
                        </React.Fragment>
                    ))}
                </Box>
            </Box>

            <Paper elevation={0} sx={{
                border: '1px solid rgba(0,0,0,.06)', borderRadius: 3,
                overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
            }}>
                <Box ref={scrollRef} sx={{
                    display: 'flex', flex: 1, minHeight: 0,
                    overflowX: 'auto', overflowY: 'hidden',
                    '&::-webkit-scrollbar': { height: 6 },
                    '&::-webkit-scrollbar-thumb': { background: '#ddd', borderRadius: 3 },
                }}>
                    {pathStack.map((dir, i) => (
                        <DirColumn key={dir || '__root__'} dir={dir} filter={filter}
                            onEnter={(p) => {
                                setPathStack(prev => [...prev.slice(0, i + 1), p]);
                            }} />
                    ))}
                </Box>
            </Paper>
        </Box>
    );
}
