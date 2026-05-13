import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Card, CardContent, Button, TextField,
    InputAdornment, Paper, List, ListItemButton, ListItemIcon,
    ListItemText, ClickAwayListener, Chip,
} from '@mui/material';
import {
    Search, Folder, InsertDriveFile, ChevronRight, ArrowForward,
} from '@mui/icons-material';
import axios from 'axios';

function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function Home() {
    const navigate = useNavigate();
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef(null);
    const inputRef = useRef(null);
    const abortControllerRef = useRef(null);

    const search = useCallback((query) => {
        if (!query || query.length < 2) { setResults([]); setOpen(false); return; }
        setLoading(true);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
        
        axios.get('/api/data/search', { 
            params: { q: query },
            signal: controller.signal 
        })
            .then(r => {
                setResults(r.data.results || []);
                setOpen(true);
            })
            .catch((err) => {
                if (axios.isCancel(err)) return;
            })
            .finally(() => {
                if (abortControllerRef.current === controller) {
                    setLoading(false);
                }
            });
    }, []);

    useEffect(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => search(q), 200);
        return () => clearTimeout(timerRef.current);
    }, [q, search]);

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    const handleSelect = (item) => {
        setOpen(false);
        const dir = item.type === 'dir' ? item.path : item.path.split('/').slice(0, -1).join('/');
        const params = new URLSearchParams({ dir });
        if (q) params.set('q', q);
        navigate(`/data?${params.toString()}`);
    };

    return (
        <Box sx={{ maxWidth: 700, mx: 'auto', py: 6, px: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 1, textAlign: 'center' }}>
                GWAS Data Browser
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 5, textAlign: 'center', maxWidth: 500, mx: 'auto' }}>
                全基因组关联分析数据浏览与可视化平台
            </Typography>

            {/* 搜索框 */}
            <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box sx={{ position: 'relative', mb: 5 }}>
                    <TextField
                        ref={inputRef}
                        fullWidth
                        placeholder="Search data files... (e.g. GCST, program, chr)"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        onFocus={() => { if (results.length > 0) setOpen(true); }}
                        size="medium"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search sx={{ color: '#aaa', fontSize: 22 }} />
                                </InputAdornment>
                            ),
                            sx: { fontSize: '1rem', py: 0.5, borderRadius: 3 },
                        }}
                    />

                    {open && results.length > 0 && (
                        <Paper elevation={4} sx={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                            mt: 0.5, maxHeight: 420, overflow: 'auto', borderRadius: 3,
                        }}>
                            <Box sx={{ px: 2, py: 1, bgcolor: '#fafbfc', borderBottom: '1px solid #eee' }}>
                                <Typography variant="caption" color="text.secondary">
                                    {results.length} results
                                </Typography>
                            </Box>
                            <List dense disablePadding>
                                {results.map(item => (
                                    <ListItemButton key={item.path} onClick={() => handleSelect(item)}
                                        sx={{ py: 0.8, px: 2 }}>
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            {item.type === 'dir'
                                                ? <Folder sx={{ fontSize: 20, color: '#6b9fd4' }} />
                                                : <InsertDriveFile sx={{ fontSize: 18, color: '#ccc' }} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={item.name}
                                            secondary={item.path}
                                            primaryTypographyProps={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                                            secondaryTypographyProps={{ fontSize: '0.72rem' }}
                                        />
                                        {item.type === 'file' && (
                                            <Chip label={fmtSize(item.size)} size="small"
                                                sx={{ fontSize: '0.65rem', mr: 1 }} />
                                        )}
                                        <ChevronRight sx={{ fontSize: 16, color: '#ccc' }} />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Paper>
                    )}
                </Box>
            </ClickAwayListener>

            {/* 快捷入口 */}
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Card sx={{ flex: '1 1 280px', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.04)' }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                            Trait Browser
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Browse all GWAS traits with metadata and analysis results
                        </Typography>
                        <Button component="a" href="/trait" variant="contained" size="small"
                            endIcon={<ArrowForward />} sx={{ textTransform: 'none' }}>
                            Browse Traits
                        </Button>
                    </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 280px', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid rgba(0,0,0,.04)' }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                            Data Browser
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                            Explore and download pipeline output files
                        </Typography>
                        <Button component="a" href="/data" variant="outlined" size="small"
                            endIcon={<ArrowForward />} sx={{ textTransform: 'none' }}>
                            Browse Files
                        </Button>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
