import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';
import {
    Box, Typography, Alert, CircularProgress, Button, Select, MenuItem,
    FormControl, Chip, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TableSortLabel, Paper, Collapse, Pagination,
    TextField,
} from '@mui/material';
import { Download, ExpandLess, ExpandMore } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';

// ============================================================
export default function GeneRegulation({ programId, onProgramChange, programs }) {
    const { data, error, isLoading } = useSWR(
        programId ? `/api/regulation/${programId}` : null, fetcher,
    );

    const plotElRef = useRef(null);

    const onInitialized = useCallback((_figure, graphDiv) => {
        plotElRef.current = graphDiv;
    }, []);

    useEffect(() => { setPage(1); }, [programId]);

    // ---- 数据 ----
    const rows = useMemo(() => {
        if (!Array.isArray(data?.data)) return [];
        return data.data.map((r) => {
            const es = parseFloat(r.lm_es);
            const p  = parseFloat(r.lm_p);
            return {
                gene:  r.GENE || '',
                es:    Number.isFinite(es) ? es : null,
                p:     Number.isFinite(p) ? p : null,
                negLogP: p > 0 ? -Math.log10(p) : null,
            };
        });
    }, [data]);

    // ---- 显著性分类 ----
    const top100Cutoff = useMemo(() => {
        const sorted = [...rows].filter(r => r.p != null).sort((a, b) => a.p - b.p);
        return sorted.length > 100 ? sorted[99].p : (sorted.length > 0 ? sorted[sorted.length - 1].p : 1);
    }, [rows]);

    const classify = useCallback((es, p) => {
        if (es == null || p == null) return 'nodata';
        if (p <= top100Cutoff) {
            return es > 0 ? 'top100_up' : 'top100_down';
        }
        if (p < 0.05 && Math.abs(es) > 0.1) {
            return es > 0 ? 'sig_up' : 'sig_down';
        }
        return 'ns';
    }, [top100Cutoff]);

    const CLASS_STYLE = {
        nodata:      { color: '#ddd',   size: 5,  name: 'No data' },
        ns:          { color: '#b0b0b0', size: 6,  name: 'Not significant' },
        sig_up:      { color: '#FF7043', size: 8,  name: 'Up (p<0.05, |ES|>0.1)' },
        sig_down:    { color: '#42A5F5', size: 8,  name: 'Down (p<0.05, |ES|>0.1)' },
        top100_up:   { color: '#D84315', size: 10, name: `Top 100 up` },
        top100_down: { color: '#1565C0', size: 10, name: `Top 100 down` },
    };

    // ---- Plotly 数据 ----
    const plotData = useMemo(() => {
        if (rows.length === 0) return [];
        const grouped = {};
        rows.forEach((r) => {
            const cat = classify(r.es, r.p);
            if (!grouped[cat]) grouped[cat] = { x: [], y: [], text: [], customdata: [] };
            grouped[cat].x.push(r.es);
            grouped[cat].y.push(r.negLogP);
            grouped[cat].text.push(`${r.gene}<br>ES: ${r.es?.toFixed(4)}<br>P: ${r.p?.toExponential(2)}`);
            grouped[cat].customdata.push([r.gene]);
        });

        // 按指定顺序渲染，ns 在最底层
        const order = ['ns', 'sig_down', 'sig_up', 'top100_down', 'top100_up', 'nodata'];
        return order.map((cat) => {
            const g = grouped[cat];
            if (!g || g.x.length === 0) return { type: 'scatter', x: [], y: [], visible: false };
            const s = CLASS_STYLE[cat];
            return {
                x: g.x, y: g.y,
                mode: 'markers',
                type: 'scatter',
                marker: { size: s.size, color: s.color, opacity: 0.75, line: { width: 0 } },
                text: g.text,
                customdata: g.customdata,
                hovertemplate: '%{text}<extra></extra>',
                name: s.name,
                showlegend: true,
            };
        });
    }, [rows, classify]);

    const layout = useMemo(() => {
        const maxY = Math.max(...rows.map(r => r.negLogP || 0), 5);
        const absX = Math.max(...rows.map(r => Math.abs(r.es || 0)), 1);
        return {
            title: {
                text: `Gene Perturbation Effects — Program ${programId || ''}`,
                font: { size: 16, color: '#333' },
                x: 0.01,
            },
            xaxis: {
                title: { text: 'Effect size (lm_es)', font: { size: 13 } },
                range: [-absX * 1.1, absX * 1.1],
                zeroline: true, zerolinewidth: 1, zerolinecolor: '#999',
                showgrid: true, gridwidth: 0.5, gridcolor: '#eee',
                tickfont: { size: 11, color: '#666' },
            },
            yaxis: {
                title: { text: '−log₁₀(P-value)', font: { size: 13 } },
                range: [-0.5, maxY * 1.08],
                zeroline: false,
                showgrid: true, gridwidth: 0.5, gridcolor: '#eee',
                tickfont: { size: 11, color: '#666' },
            },
            hovermode: 'closest',
            hoverlabel: { bgcolor: 'white', bordercolor: '#ccc', font: { size: 12 } },
            margin: { l: 70, r: 30, t: 50, b: 50 },
            plot_bgcolor: '#fafafa',
            paper_bgcolor: 'white',
            showlegend: true,
            legend: { x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top',
                      bgcolor: 'rgba(255,255,255,0.85)', font: { size: 11 } },
            shapes: [
                { type: 'line', xref: 'x', x0: 0.1, x1: 0.1, yref: 'paper', y0: 0, y1: 1,
                  line: { color: '#aaa', width: 1, dash: '4px,2px' }, layer: 'below' },
                { type: 'line', xref: 'x', x0: -0.1, x1: -0.1, yref: 'paper', y0: 0, y1: 1,
                  line: { color: '#aaa', width: 1, dash: '4px,2px' }, layer: 'below' },
                { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y', y0: -Math.log10(0.05), y1: -Math.log10(0.05),
                  line: { color: '#aaa', width: 1, dash: '4px,2px' }, layer: 'below' },
            ],
        };
    }, [programId, rows]);

    const plotConfig = useMemo(() => ({
        responsive: true, displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);

    // ---- 表格 ----
    const [tableOpen, setTableOpen] = useState(false);
    const [sortBy, setSortBy] = useState('p');
    const [sortDir, setSortDir] = useState('asc');
    const [highlightGene, setHighlightGene] = useState({ gene: null, key: 0 });
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [jumpInput, setJumpInput] = useState('');
    const tablePaperRef = useRef(null);
    const tableRowRefs = useRef({});

    const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);

    const sortedRows = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            if (sortBy === 'gene') {
                return collator.compare(a.gene || '', b.gene || '') * dir;
            }
            const va = a[sortBy] ?? -Infinity;
            const vb = b[sortBy] ?? -Infinity;
            if (va === vb) return 0;
            return va > vb ? dir : -dir;
        });
    }, [rows, sortBy, sortDir, collator]);

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

    const pagedRows = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return sortedRows.slice(start, start + rowsPerPage);
    }, [sortedRows, page, rowsPerPage]);

    // 高亮基因 → 跳到对应页 + 滚动到表格
    useEffect(() => {
        if (!highlightGene.gene || !tableOpen) return;
        const idx = sortedRows.findIndex(r => r.gene === highlightGene.gene);
        if (idx >= 0) {
            setPage(Math.floor(idx / rowsPerPage) + 1);
            setTimeout(() => {
                tablePaperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [highlightGene, tableOpen, sortedRows, rowsPerPage]);

    const handleJumpToPage = useCallback(() => {
        const n = parseInt(jumpInput, 10);
        if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
            setPage(n);
            setJumpInput('');
        }
    }, [jumpInput, totalPages]);

    const handleSort = useCallback((col) => {
        setPage(1);
        if (col === sortBy) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
        else { setSortBy(col); setSortDir(col === 'gene' ? 'asc' : 'desc'); }
    }, [sortBy]);

    const downloadCSV = useCallback(() => {
        const hdr = 'Gene,Effect Size (lm_es),P-value (lm_p),-log10(P)';
        const body = rows.map(r => [r.gene, r.es, r.p, r.negLogP].join(',')).join('\n');
        const blob = new Blob([hdr + '\n' + body], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = (data?.fileName || `program${programId}.txt`).replace(/\.txt$/, '');
        a.download = `${baseName}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [rows, data?.fileName, programId]);

    // ---- 统计 ----
    const stats = useMemo(() => {
        let top100 = 0, sig = 0;
        rows.forEach(r => { const c = classify(r.es, r.p); if (c.startsWith('top100')) top100++; if (c.startsWith('sig') || c.startsWith('top100')) sig++; });
        return { total: rows.length, sig, top100 };
    }, [rows, classify]);

    // ----
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error.message}</Alert>;

    return (
        <Box sx={{ position: 'relative' }}>
            {/* ---- 头部：选择器 + 统计 ---- */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <Select value={programId || ''} onChange={e => onProgramChange?.(e.target.value)}
                        displayEmpty sx={{ fontSize: '0.85rem' }}>
                        <MenuItem value="" disabled>Select program</MenuItem>
                        {programs.map(p => (
                            <MenuItem key={p.id} value={p.id}>Program {p.id}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                {rows.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={`${stats.total} genes`} size="small" sx={{ bgcolor: '#f5f5f5' }} />
                        <Chip label={`${stats.sig} significant`} size="small" sx={{ bgcolor: '#FFF3E0', color: '#E65100' }} />
                    </Box>
                )}
            </Box>

            {/* ---- 火山图 ---- */}
            {(plotData.length > 0 || isLoading) && (
                <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden', position: 'relative', minHeight: isLoading ? 300 : 'auto' }}>
                    {isLoading && (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.75)', zIndex: 10 }}>
                            <CircularProgress size={40} />
                        </Box>
                    )}
                    {plotData.length > 0 && (
                        <Plot
                        onInitialized={onInitialized}
                        onClick={(evt) => {
                            if (!evt?.points?.length) return;
                            const gene = evt.points[0].customdata?.[0];
                            if (gene) {
                                setHighlightGene(prev => ({ gene, key: prev.key + 1 }));
                                setTableOpen(true);
                            }
                        }}
                        data={plotData}
                        layout={layout}
                        config={plotConfig}
                        useResizeHandler
                        style={{ width: '100%', height: 620 }}
                    />
                    )}
                </Paper>
            )}

            {/* ---- 数据表格 ---- */}
            {rows.length > 0 && (
                <Paper ref={tablePaperRef} variant="outlined" sx={{ border: '1px solid #e8e8ec', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, bgcolor: '#fafbfc', borderBottom: tableOpen ? '1px solid #eee' : 'none' }}>
                        <Button onClick={() => { setTableOpen(v => !v); setHighlightGene({ gene: null, key: 0 }); }}
                            endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                            sx={{ textTransform: 'none', color: '#444', fontWeight: 500, fontSize: '0.82rem' }}>
                            Gene Data <Chip label={rows.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#e0e0e0', color: '#555' }} />
                        </Button>
                        <Box sx={{ flex: 1 }} />
                        {tableOpen && (
                            <Button size="small" startIcon={<Download />} onClick={downloadCSV}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#777' }}>CSV</Button>
                        )}
                    </Box>
                    <Collapse in={tableOpen}>
                        <TableContainer sx={{ maxHeight: 540 }}>
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        {[
                                            ['gene', 'Gene'],
                                            ['es', 'Effect Size (lm_es)'],
                                            ['p', 'P-value (lm_p)'],
                                            ['negLogP', '−log₁₀(P)'],
                                        ].map(([key, label]) => (
                                            <TableCell key={key} sx={{ fontWeight: 600, fontSize: '0.72rem', py: 1, px: 2, bgcolor: '#f7f7f7', borderBottom: '2px solid #d0d0d0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <TableSortLabel active={sortBy === key} direction={sortBy === key ? sortDir : 'asc'}
                                                    onClick={() => handleSort(key)} sx={{ fontSize: '0.72rem' }}>{label}</TableSortLabel>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pagedRows.map((row, idx) => {
                                        const isHL = highlightGene.gene === row.gene;
                                        const even = ((page - 1) * rowsPerPage + idx) % 2 === 0;
                                        return (
                                            <TableRow key={row.gene}
                                                ref={el => { if (el) tableRowRefs.current[row.gene] = el; }}
                                                sx={{ bgcolor: isHL ? '#FFF9C4' : (even ? '#fff' : '#f8f8f9'),
                                                      '&:hover': { bgcolor: isHL ? '#FFEB3B' : '#f0f0f2 !important' } }}>
                                                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 500, py: 0.5, px: 2, textAlign: 'center' }}>{row.gene}</TableCell>
                                                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace', py: 0.5, px: 2, textAlign: 'center' }}>{row.es?.toFixed(6) ?? '—'}</TableCell>
                                                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace', py: 0.5, px: 2, textAlign: 'center' }}>{row.p?.toExponential(3) ?? '—'}</TableCell>
                                                <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace', py: 0.5, px: 2, textAlign: 'center' }}>{row.negLogP?.toFixed(4) ?? '—'}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, bgcolor: '#fafbfc', borderTop: '1px solid #e0e0e0' }}>
                            {/* 左侧：每页行数 */}
                            <FormControl size="small" sx={{ minWidth: 80 }}>
                                <Select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                                    sx={{ fontSize: '0.75rem', height: 32, '.MuiOutlinedInput-notchedOutline': { borderColor: '#ddd' } }}>
                                    {[10, 25, 50, 100].map(n => (
                                        <MenuItem key={n} value={n} sx={{ fontSize: '0.75rem' }}>{n} / page</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* 中间：页码 */}
                            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <Pagination
                                    count={totalPages} page={page}
                                    onChange={(_, v) => setPage(v)}
                                    size="small" siblingCount={1} boundaryCount={1}
                                    showFirstButton showLastButton
                                    sx={{
                                        '& .MuiPaginationItem-root': { fontSize: '0.75rem', borderRadius: 1 },
                                        '& .Mui-selected': { bgcolor: '#e0e0e0', color: '#333', fontWeight: 600 },
                                    }}
                                />
                            </Box>

                            {/* 右侧：跳转 */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Typography variant="caption" sx={{ color: '#888', fontSize: '0.72rem' }}>Go to</Typography>
                                <TextField
                                    size="small" value={jumpInput}
                                    placeholder={String(page)}
                                    onChange={e => setJumpInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleJumpToPage(); }}
                                    sx={{ width: 60, '& .MuiOutlinedInput-input': { fontSize: '0.75rem', py: 0.55, textAlign: 'center' } }}
                                />
                                <Button size="small" variant="outlined" onClick={handleJumpToPage}
                                    sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.2, px: 1.2, borderColor: '#ccc', color: '#555', minWidth: 36 }}>
                                    Go
                                </Button>
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>
            )}
        </Box>
    );
}
