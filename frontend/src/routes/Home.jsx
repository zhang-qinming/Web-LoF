import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Card, CardContent, Button, TextField, Checkbox,
    InputAdornment, Paper, List, ListItemButton, ListItemIcon,
    ListItemText, ClickAwayListener, Chip, CircularProgress, IconButton,
} from '@mui/material';
import {
    Search, Folder, InsertDriveFile, ArrowForward,
    Close, FileDownload, Dns, Science, Storage,
} from '@mui/icons-material';
import axios from 'axios';

function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
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
    const [checked, setChecked] = useState(new Set());
    const timerRef = useRef(null);
    const abortRef = useRef(null);

    const search = useCallback((query) => {
        if (!query || query.length < 2) { setResults([]); setOpen(false); return; }
        setLoading(true); setChecked(new Set());
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController(); abortRef.current = ctrl;
        axios.get('/api/data/search', { params: { q: query }, signal: ctrl.signal })
            .then(r => { setResults(r.data.results || []); setOpen(true); })
            .catch((e) => { if (!axios.isCancel(e)) console.error(e); })
            .finally(() => { if (abortRef.current === ctrl) setLoading(false); });
    }, []);

    useEffect(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => search(q), 150);
        return () => clearTimeout(timerRef.current);
    }, [q, search]);

    useEffect(() => () => { if (abortRef.current) abortRef.current.abort(); }, []);

    const toggle = (path) => {
        setChecked(prev => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
    };
    const toggleAll = () => {
        if (checked.size === results.length) setChecked(new Set());
        else setChecked(new Set(results.map(r => r.path)));
    };

    const downloadChecked = () => {
        [...checked].forEach((p, i) => {
            setTimeout(() => {
                const a = document.createElement('a');
                a.href = `/api/data/download?path=${encodeURIComponent(p)}`;
                a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }, i * 200);
        });
    };

    const handleSelect = (item) => {
        setOpen(false);
        const dir = item.type === 'dir' ? item.path : item.path.split('/').slice(0, -1).join('/');
        const params = new URLSearchParams({ dir });
        if (q) params.set('q', q);
        navigate(`/data?${params.toString()}`);
    };

    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', py: 5, px: 2 }}>
            {/* 标题 */}
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 1, textAlign: 'center' }}>
                GWAS Data Browser
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
                全基因组关联分析数据浏览与可视化平台
            </Typography>

            {/* 数据总览卡片 */}
            <Box sx={{ display: 'flex', gap: 2, mb: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {stats.map(s => (
                    <Card key={s.label}
                        component="a" href={s.to}
                        sx={{
                            flex: '1 1 180px', maxWidth: 220, borderRadius: 3, cursor: 'pointer',
                            textDecoration: 'none', border: '1px solid rgba(0,0,0,.04)',
                            boxShadow: '0 1px 3px rgba(0,0,0,.04)',
                            transition: 'transform .15s, box-shadow .15s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,.08)' },
                        }}>
                        <CardContent sx={{ textAlign: 'center', py: 3 }}>
                            <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: 0.5 }}>
                                {s.value}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            {/* 搜索框 */}
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
                Search Data Files
            </Typography>
            <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{ position: 'relative', mb: 5 }}>
                    <TextField
                        fullWidth placeholder="Search by filename, GCST ID, program..."
                        value={q} onChange={e => setQ(e.target.value)}
                        onFocus={() => { if (results.length > 0) setOpen(true); }}
                        size="medium"
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search sx={{ color: '#aaa', fontSize: 22 }} /></InputAdornment>,
                            endAdornment: loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : (q && <IconButton size="small" onClick={() => setQ('')}><Close fontSize="small" /></IconButton>),
                            sx: { fontSize: '1rem', py: 0.5, borderRadius: 3 },
                        }}
                    />

                    {open && results.length > 0 && (
                        <Paper elevation={4} sx={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                            mt: 0.5, maxHeight: 460, overflow: 'auto', borderRadius: 3,
                        }}>
                            {/* 结果头部 */}
                            <Box sx={{ px: 2, py: 1, bgcolor: '#fafbfc', borderBottom: '1px solid #eee',
                                display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Checkbox size="small" sx={{ p: 0.3 }}
                                    checked={results.length > 0 && checked.size === results.length}
                                    indeterminate={checked.size > 0 && checked.size < results.length}
                                    onChange={toggleAll} />
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                    {results.length} results
                                </Typography>
                                {checked.size > 0 && (
                                    <>
                                        <Chip label={checked.size} size="small" color="primary"
                                            onDelete={() => setChecked(new Set())} />
                                        <Button size="small" variant="contained"
                                            sx={{ minWidth: 0, px: 1.5, py: 0.2, fontSize: '0.7rem', textTransform: 'none' }}
                                            onClick={downloadChecked}>
                                            <FileDownload sx={{ fontSize: 14, mr: 0.3 }} /> Download
                                        </Button>
                                    </>
                                )}
                            </Box>
                            {/* 结果列表 */}
                            <List dense disablePadding>
                                {results.map(item => (
                                    <ListItemButton key={item.path}
                                        onClick={() => handleSelect(item)}
                                        sx={{ py: 0.7, px: 1.5 }}>
                                        <Checkbox size="small" sx={{ p: 0.3, mr: 0.5 }}
                                            checked={checked.has(item.path)}
                                            onChange={(e) => { e.stopPropagation(); toggle(item.path); }}
                                            onClick={(e) => e.stopPropagation()} />
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            {item.type === 'dir'
                                                ? <Folder sx={{ fontSize: 18, color: '#6b9fd4' }} />
                                                : <InsertDriveFile sx={{ fontSize: 16, color: '#ccc' }} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                            secondary={item.path}
                                            primaryTypographyProps={{ fontSize: '0.83rem', fontFamily: 'monospace' }}
                                            secondaryTypographyProps={{ fontSize: '0.7rem' }}
                                        />
                                        {item.type === 'file' && (
                                            <Chip label={fmtSize(item.size)} size="small"
                                                sx={{ fontSize: '0.62rem', mr: 0.5, height: 20 }} />
                                        )}
                                    </ListItemButton>
                                ))}
                            </List>
                        </Paper>
                    )}
                </Box>
            </ClickAwayListener>
        </Box>
    );
}
