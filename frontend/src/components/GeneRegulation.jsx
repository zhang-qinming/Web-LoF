import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Box, Typography, Alert, CircularProgress, Button, IconButton, Select, MenuItem,
    FormControl, Chip, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TableSortLabel, Paper, Collapse, Pagination,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions,
    ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { Download, ExpandLess, ExpandMore, Fullscreen, FullscreenExit } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { downloadBlob, downloadDataUrl } from '../utils/download';

// ============================================================
export default function GeneRegulation({ programId, onProgramChange, programs }) {
    const { data, error, isLoading } = useSWR(
        programId ? `/api/regulation/${programId}` : null, fetcher,
    );
    const { data: infoData } = useSWR('/api/programs/info', fetcher);
    const pinfo = (infoData && programId) ? (infoData[`P${programId}`] || infoData[programId]) : null;

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
        nodata:      { color: '#ddd',     hoverBg: 'rgba(220,220,220,0.35)', size: 4,  name: 'No data' },
        ns:          { color: '#b0b0b0',  hoverBg: 'rgba(176,176,176,0.25)', size: 6,  name: 'Not significant' },
        sig_up:      { color: '#FF7043',  hoverBg: 'rgba(255,112,67,0.2)',   size: 8,  name: 'Up (p<0.05, |ES|>0.1)' },
        sig_down:    { color: '#42A5F5',  hoverBg: 'rgba(66,165,245,0.2)',   size: 8,  name: 'Down (p<0.05, |ES|>0.1)' },
        top100_up:   { color: '#D84315',  hoverBg: 'rgba(216,67,21,0.3)',    size: 10, name: 'Top 100 up' },
        top100_down: { color: '#1565C0',  hoverBg: 'rgba(21,101,192,0.3)',   size: 10, name: 'Top 100 down' },
    };

    // ---- 自动检测断轴 ----
    const breakInfo = useMemo(() => {
        if (rows.length === 0) return null;
        const ys = rows.map(r => r.negLogP).filter(y => y != null && y > 0).sort((a, b) => b - a);
        if (ys.length < 10) return null;

        // 寻找最大的相邻间隔（排序后）
        let maxGap = 0, gapIdx = 0;
        for (let i = 0; i < ys.length - 1; i++) {
            const gap = ys[i] - ys[i + 1];
            if (gap > maxGap) { maxGap = gap; gapIdx = i; }
        }

        const aboveGap = gapIdx + 1;           // gap 上方的点数
        const p95 = ys[Math.floor(ys.length * 0.05)];

        // 条件：上方点 ≤ 5 个 且 间隔 > 总范围的 25% 且 高于 p95 的 1.5 倍
        if (aboveGap <= 5 && maxGap > (ys[0] - ys[ys.length - 1]) * 0.25 && ys[0] > p95 * 1.5) {
            return {
                threshold: (ys[gapIdx] + ys[gapIdx + 1]) / 2,
                above: aboveGap,
            };
        }
        return null;
    }, [rows]);

    const titleText = `Program ${programId || ''}${pinfo?.curated_annotation ? ` — ${pinfo.curated_annotation}` : ''}`;

    // ---- Plotly 数据 ----
    const { plotData, layout } = useMemo(() => {
        if (rows.length === 0) return { plotData: [], layout: {} };
        const absX = Math.max(...rows.map(r => Math.abs(r.es || 0)), 1);

        const legendShown = new Set();
        function buildTraces(dataRows, yaxisKey, isPrimary) {
            const grouped = {};
            dataRows.forEach((r) => {
                const cat = classify(r.es, r.p);
                if (!grouped[cat]) grouped[cat] = { x: [], y: [], text: [], customdata: [] };
                grouped[cat].x.push(r.es);
                grouped[cat].y.push(r.negLogP);
                grouped[cat].text.push(`<b>${r.gene}</b><br>Effect size: ${r.es?.toFixed(4)}<br>P value: ${r.p?.toExponential(2)}`);
                grouped[cat].customdata.push([r.gene]);
            });
            const order = ['ns', 'sig_down', 'sig_up', 'top100_down', 'top100_up', 'nodata'];
            return order.map((cat) => {
                const g = grouped[cat];
                if (!g || g.x.length === 0) return { type: 'scatter', x: [], y: [], visible: false, yaxis: yaxisKey };
                const s = CLASS_STYLE[cat];
                const show = isPrimary && !legendShown.has(cat);
                if (show) legendShown.add(cat);
                return {
                    x: g.x, y: g.y, mode: 'markers', type: 'scatter',
                    marker: { size: s.size, color: s.color, opacity: 0.82, line: { width: 0 } },
                    text: g.text, customdata: g.customdata,
                    hovertemplate: '%{text}<extra></extra>',
                    hoverlabel: { bgcolor: s.hoverBg, font: { color: '#333', size: 12 } },
                    name: s.name, showlegend: show,
                    legendgroup: cat,
                    yaxis: yaxisKey,
                };
            });
        }

        if (breakInfo) {
            const { threshold, above } = breakInfo;
            const lowRows  = rows.filter(r => (r.negLogP || 0) <= threshold);
            const highRows = rows.filter(r => (r.negLogP || 0) > threshold);
            const maxLow  = Math.max(...lowRows.map(r => r.negLogP || 0), 5);
            const maxHigh = Math.max(...highRows.map(r => r.negLogP || 0), threshold + 1);

            // 上子图高度按孤立点数动态：5个点最多占30%，1个点只占12%
            const hiRatio = Math.min(0.3, 0.06 + above * 0.05);
            const botDom = 1 - hiRatio;

            const plotData = [
                ...buildTraces(lowRows, 'y', true),
                ...buildTraces(highRows, 'y2', false),
            ];

            const layout = {
                title: { text: titleText, font: { size: 16, color: '#333' }, x: 0.01 },
                xaxis: { domain: [0, 1],
                    range: [-absX * 1.1, absX * 1.1],
                    zeroline: true, zerolinewidth: 1, zerolinecolor: '#999',
                    showgrid: true, gridwidth: 0.5, gridcolor: '#eee', tickfont: { size: 11, color: '#666' } },
                xaxis2: { domain: [0, 1], anchor: 'y2', matches: 'x', showticklabels: false,
                    showgrid: true, gridwidth: 0.5, gridcolor: '#eee' },
                yaxis: { domain: [0, botDom], anchor: 'x',
                    title: { text: '−log₁₀(P-value)', font: { size: 13 } },
                    range: [-0.5, maxLow * 1.05],
                    showgrid: true, gridwidth: 0.5, gridcolor: '#eee', tickfont: { size: 11, color: '#666' } },
                yaxis2: { domain: [botDom, 1], anchor: 'x2',
                    range: [threshold - 1, maxHigh * 1.08],
                    showgrid: true, gridwidth: 0.5, gridcolor: '#eee', tickfont: { size: 11, color: '#666' } },
                hovermode: 'closest',
                hoverlabel: { bgcolor: 'white', bordercolor: '#ccc', font: { size: 12 } },
                margin: { l: 70, r: 30, t: 50, b: 50 },
                plot_bgcolor: '#fafafa', paper_bgcolor: 'white',
                showlegend: true,
                legend: { x: 0.02, y: 0.95, xanchor: 'left', yanchor: 'top',
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
            return { plotData, layout };
        }

        // 普通模式
        const maxY = Math.max(...rows.map(r => r.negLogP || 0), 5);
        return {
            plotData: buildTraces(rows, 'y', true),
            layout: {
                title: { text: titleText, font: { size: 16, color: '#333' }, x: 0.01 },
                xaxis: { title: { text: 'Effect size (lm_es)', font: { size: 13 } },
                    range: [-absX * 1.1, absX * 1.1],
                    zeroline: true, zerolinewidth: 1, zerolinecolor: '#999',
                    showgrid: true, gridwidth: 0.5, gridcolor: '#eee', tickfont: { size: 11, color: '#666' } },
                yaxis: { title: { text: '−log₁₀(P-value)', font: { size: 13 } },
                    range: [-0.5, maxY * 1.08],
                    showgrid: true, gridwidth: 0.5, gridcolor: '#eee', tickfont: { size: 11, color: '#666' } },
                hovermode: 'closest',
                hoverlabel: { bgcolor: 'white', bordercolor: '#ccc', font: { size: 12 } },
                margin: { l: 70, r: 30, t: 50, b: 50 },
                plot_bgcolor: '#fafafa', paper_bgcolor: 'white',
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
            },
        };
    }, [rows, classify, breakInfo, titleText]);

    const [exportOpen, setExportOpen] = useState(false);
    const [expW, setExpW] = useState(1200);
    const [expH, setExpH] = useState(800);
    const [expFmt, setExpFmt] = useState('svg');
    const plotGdRef = useRef(null);

    const doExport = useCallback(() => {
        const gd = plotGdRef.current;
        if (!gd) return;
        Plotly.toImage(gd, { format: expFmt, width: expW, height: expH }).then((dataUrl) => {
            downloadDataUrl(dataUrl, `program_${programId || 'plot'}.${expFmt}`);
        });
    }, [expFmt, expW, expH, programId]);

    const plotConfig = useMemo(() => ({
        responsive: true, displaylogo: false,
        edits: { legendPosition: true },
        modeBarButtonsToAdd: [{
            name: 'fullscreen', title: 'Fullscreen',
            icon: {
                width: 857.1, height: 1000, path: 'M32 32h288v96H128v192H32V32z m672 0v288h-96V128h-192V32h288z M32 736v-288h96v192h192v96H32z m672 0v-96H512v-192h192v288H704z',
                ascent: 850, descent: -150,
            },
            click: function () { setFullscreen(f => !f); },
        }, {
            name: 'download', title: 'Download plot',
            icon: Plotly.Icons.disk,
            click: function (gd) { plotGdRef.current = gd; setExportOpen(true); },
        }],
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);

    // ---- 表格 ----
    const [tableOpen, setTableOpen] = useState(false);
    const [sortBy, setSortBy] = useState('p');
    const [sortDir, setSortDir] = useState('asc');
    const [highlightGene, setHighlightGene] = useState({ gene: null, key: 0 });
    const [fullscreen, setFullscreen] = useState(false);

    useEffect(() => {
        if (!fullscreen) return;
        const onEsc = (e) => { if (e.key === 'Escape') setFullscreen(false); };
        window.addEventListener('keydown', onEsc);
        return () => window.removeEventListener('keydown', onEsc);
    }, [fullscreen]);
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
        const baseName = (data?.fileName || `program${programId}.txt`).replace(/\.txt$/, '');
        downloadBlob(blob, `${baseName}.csv`);
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
                <FormControl size="small" sx={{ minWidth: 300 }}>
                    <Select value={programs.length > 0 ? (programId || '') : ''}
                        onChange={e => onProgramChange?.(e.target.value)}
                        displayEmpty sx={{ fontSize: '0.85rem' }}>
                        <MenuItem value="" disabled>
                            {programs.length > 0 ? 'Select program' : 'Loading...'}
                        </MenuItem>
                        {programs.map(p => {
                            const pi = infoData?.[`P${p.id}`];
                            return (
                                <MenuItem key={p.id} value={p.id}>
                                    P{p.id}{pi?.curated_annotation ? ` — ${pi.curated_annotation}` : ''}
                                </MenuItem>
                            );
                        })}
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

            {/* 导出对话框 */}
            <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
                <DialogTitle>Export Plot</DialogTitle>
                <DialogContent>
                    <ToggleButtonGroup value={expFmt} exclusive size="small"
                        onChange={(e, v) => v && setExpFmt(v)} sx={{ mb: 2 }}>
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField label="Width" type="number" value={expW}
                            onChange={e => setExpW(Number(e.target.value))} size="small" />
                        <TextField label="Height" type="number" value={expH}
                            onChange={e => setExpH(Number(e.target.value))} size="small" />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExportOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={() => { doExport(); setExportOpen(false); }}>Export</Button>
                </DialogActions>
            </Dialog>

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

            {/* 全屏覆盖 */}
            {fullscreen && (
                <Box sx={{
                    position: 'fixed', inset: 0, zIndex: 9999, bgcolor: '#fff',
                }}>
                    <Plot
                        data={plotData}
                        layout={{ ...layout, title: titleText, margin: { l: 80, r: 30, t: 50, b: 50 } }}
                        config={plotConfig}
                        onClick={(evt) => {
                            if (!evt?.points?.length) return;
                            const gene = evt.points[0].customdata?.[0];
                            if (gene) {
                                setHighlightGene(prev => ({ gene, key: prev.key + 1 }));
                                setTableOpen(true);
                            }
                        }}
                        useResizeHandler
                        style={{ width: '100%', height: '100%' }}
                    />
                </Box>
            )}
        </Box>
    );
}
