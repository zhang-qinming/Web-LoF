import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Box, Typography, Alert, CircularProgress, Button, ButtonBase, Select, MenuItem,
    Chip, Paper,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions, Popover,
    ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ExpandMore, Input, Search } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import FloatingLegend from './FloatingLegend';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementNearViewportCenter } from '../utils/scroll';
import GeneRegulationTable from './GeneRegulationTable';
import {
    chartLayoutTokens,
    compactToggleGroupSx,
    metricChipTone,
    plotFrameSx,
    sectionPanelHeaderSx,
    summaryChipSx,
} from '../themeUtils';

const TOP_HIT_COUNT = 100;
const P_VALUE_THRESHOLD = 0.05;
const EFFECT_SIZE_THRESHOLD = 0.1;
const MIN_EFFECT_SPAN = 0.65;
const PLOT_HEIGHT = 520;

const CLASS_STYLE = {
    nodata:      { color: '#d8dde6', hoverBg: 'rgba(216,221,230,0.32)', size: 4, opacity: 0.26, name: 'No data' },
    ns:          { color: '#c3ccd8', hoverBg: 'rgba(195,204,216,0.22)', size: 6, opacity: 0.44, name: 'Background' },
    sig_up:      { color: '#fb986d', hoverBg: 'rgba(251,152,109,0.18)', size: 7, opacity: 0.62, name: 'Positive hit' },
    sig_down:    { color: '#79b9f2', hoverBg: 'rgba(121,185,242,0.18)', size: 7, opacity: 0.62, name: 'Negative hit' },
    top100_up:   { color: '#dc7141', hoverBg: 'rgba(220,113,65,0.24)',  size: 8, opacity: 0.88, name: 'Top positive' },
    top100_down: { color: '#4b92df', hoverBg: 'rgba(75,146,223,0.24)',  size: 8, opacity: 0.88, name: 'Top negative' },
};

function quantile(sortedValues, ratio) {
    if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
    const clampedRatio = Math.min(Math.max(ratio, 0), 1);
    const index = (sortedValues.length - 1) * clampedRatio;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sortedValues[lower];
    const weight = index - lower;
    return (sortedValues[lower] * (1 - weight)) + (sortedValues[upper] * weight);
}

function getEffectRange(rows) {
    const effects = rows
        .map((row) => row.es)
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

    if (effects.length === 0) return [-0.35, 0.35];

    const minEffect = Math.min(effects[0], -EFFECT_SIZE_THRESHOLD);
    const maxEffect = Math.max(effects[effects.length - 1], EFFECT_SIZE_THRESHOLD);
    const q02 = quantile(effects, 0.02) ?? minEffect;
    const q98 = quantile(effects, 0.98) ?? maxEffect;
    const focusMin = Math.min(minEffect, q02, -EFFECT_SIZE_THRESHOLD);
    const focusMax = Math.max(maxEffect, q98, EFFECT_SIZE_THRESHOLD);
    const span = Math.max(focusMax - focusMin, MIN_EFFECT_SPAN);
    const padding = Math.max(span * 0.07, 0.08);
    return [focusMin - padding, focusMax + padding];
}

// ============================================================
export default function GeneRegulation({ programId, onProgramChange, programs }) {
    const theme = useTheme();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const compactToggleStyles = useMemo(() => compactToggleGroupSx(theme), [theme]);
    const { data, error, isLoading } = useSWR(
        programId ? `/api/regulation/${programId}` : null, fetcher,
    );
    const { data: infoData } = useSWR('/api/programs/info', fetcher);
    const pinfo = (infoData && programId) ? (infoData[`P${programId}`] || infoData[programId]) : null;
    const programOptions = useMemo(() => {
        const seen = new Set();
        return (programs || [])
            .map((item) => {
                const id = String(item?.id || '').trim();
                if (!id || seen.has(id)) return null;
                seen.add(id);
                const info = infoData?.[`P${id}`] || infoData?.[id];
                return {
                    id,
                    label: `P${id}`,
                    annotation: info?.curated_annotation || 'Unannotated',
                };
            })
            .filter(Boolean)
            .sort((a, b) => Number(a.id) - Number(b.id));
    }, [infoData, programs]);
    const selectedProgram = useMemo(
        () => programOptions.find((item) => item.id === String(programId || '')) || null,
        [programId, programOptions],
    );
    const [programSearch, setProgramSearch] = useState('');
    const [programPickerAnchor, setProgramPickerAnchor] = useState(null);
    const programPickerOpen = Boolean(programPickerAnchor);
    const filteredProgramOptions = useMemo(() => {
        const query = programSearch.trim().toLowerCase();
        if (!query) return programOptions;
        const normalizedId = query.replace(/^p/, '');
        return programOptions.filter((option) => (
            option.label.toLowerCase().includes(query)
            || option.annotation.toLowerCase().includes(query)
            || option.id.includes(normalizedId)
        ));
    }, [programOptions, programSearch]);

    const plotElRef = useRef(null);

    const onInitialized = useCallback((_figure, graphDiv) => {
        plotElRef.current = graphDiv;
    }, []);

    useEffect(() => { setPage(1); }, [programId]);
    useEffect(() => { setProgramSearch(''); }, [programId]);

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
        return sorted.length > TOP_HIT_COUNT ? sorted[TOP_HIT_COUNT - 1].p : (sorted.length > 0 ? sorted[sorted.length - 1].p : 1);
    }, [rows]);

    const classify = useCallback((es, p) => {
        if (es == null || p == null) return 'nodata';
        if (p <= top100Cutoff) {
            return es > 0 ? 'top100_up' : 'top100_down';
        }
        if (p < P_VALUE_THRESHOLD && Math.abs(es) > EFFECT_SIZE_THRESHOLD) {
            return es > 0 ? 'sig_up' : 'sig_down';
        }
        return 'ns';
    }, [top100Cutoff]);


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
    const legendItems = useMemo(() => ['ns', 'sig_down', 'sig_up', 'top100_down', 'top100_up', 'nodata']
        .map((key) => ({
            key,
            label: CLASS_STYLE[key].name,
            color: CLASS_STYLE[key].color,
            count: rows.filter((row) => classify(row.es, row.p) === key).length,
        }))
        .filter((item) => item.count > 0), [classify, rows]);

    // ---- Plotly 数据 ----
    const { plotData, layout } = useMemo(() => {
        if (rows.length === 0) return { plotData: [], layout: {} };

        const xRange = getEffectRange(rows);
        const significanceLineY = -Math.log10(P_VALUE_THRESHOLD);
        const baseXaxis = {
            title: { text: 'Effect size (lm_es)', font: { size: 13, color: chartTokens.axisColor, family: theme.typography.fontFamily } },
            range: xRange,
            zeroline: true,
            zerolinewidth: 1,
            zerolinecolor: chartTokens.axisSoft,
            showline: true,
            linecolor: chartTokens.axisSoft,
            ticks: 'outside',
            ticklen: 4,
            tickcolor: chartTokens.axisSoft,
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: chartTokens.gridColor,
            tickfont: { size: 11, color: chartTokens.axisColor, family: theme.typography.fontFamily },
            automargin: true,
        };
        const baseYaxis = {
            title: { text: '-log10(P-value)', font: { size: 13, color: chartTokens.axisColor, family: theme.typography.fontFamily } },
            showline: true,
            linecolor: chartTokens.axisSoft,
            ticks: 'outside',
            ticklen: 4,
            tickcolor: chartTokens.axisSoft,
            showgrid: true,
            gridwidth: 0.5,
            gridcolor: chartTokens.gridColor,
            tickfont: { size: 11, color: chartTokens.axisColor, family: theme.typography.fontFamily },
            automargin: true,
        };
        const baseLayout = {
            hovermode: 'closest',
            hoverlabel: {
                bgcolor: chartTokens.hoverBg,
                bordercolor: chartTokens.hoverBorder,
                font: { size: 12, color: theme.palette.text.primary, family: theme.typography.fontFamily },
            },
            margin: { l: 74, r: 18, t: 58, b: 56 },
            plot_bgcolor: chartTokens.plotBg,
            paper_bgcolor: chartTokens.paperBg,
            showlegend: false,
            shapes: [
                {
                    type: 'line',
                    xref: 'x',
                    x0: EFFECT_SIZE_THRESHOLD,
                    x1: EFFECT_SIZE_THRESHOLD,
                    yref: 'paper',
                    y0: 0,
                    y1: 1,
                    line: { color: chartTokens.threshold, width: 1, dash: 'dot' },
                    layer: 'below',
                },
                {
                    type: 'line',
                    xref: 'x',
                    x0: -EFFECT_SIZE_THRESHOLD,
                    x1: -EFFECT_SIZE_THRESHOLD,
                    yref: 'paper',
                    y0: 0,
                    y1: 1,
                    line: { color: chartTokens.threshold, width: 1, dash: 'dot' },
                    layer: 'below',
                },
                {
                    type: 'line',
                    xref: 'paper',
                    x0: 0,
                    x1: 1,
                    yref: 'y',
                    y0: significanceLineY,
                    y1: significanceLineY,
                    line: { color: chartTokens.threshold, width: 1, dash: 'dot' },
                    layer: 'below',
                },
            ],
        };

        const legendShown = new Set();
        function buildTraces(dataRows, yaxisKey, isPrimary) {
            const grouped = {};
            dataRows.forEach((row) => {
                const category = classify(row.es, row.p);
                if (!grouped[category]) grouped[category] = { x: [], y: [], text: [], customdata: [] };
                grouped[category].x.push(row.es);
                grouped[category].y.push(row.negLogP);
                grouped[category].text.push(`<b>${row.gene}</b><br>Effect size: ${row.es?.toFixed(4)}<br>P value: ${row.p?.toExponential(2)}`);
                grouped[category].customdata.push([row.gene]);
            });

            return ['ns', 'sig_down', 'sig_up', 'top100_down', 'top100_up', 'nodata'].map((category) => {
                const group = grouped[category];
                if (!group || group.x.length === 0) return { type: 'scatter', x: [], y: [], visible: false, yaxis: yaxisKey };

                const style = CLASS_STYLE[category];
                const show = isPrimary && !legendShown.has(category);
                if (show) legendShown.add(category);

                return {
                    x: group.x,
                    y: group.y,
                    mode: 'markers',
                    type: 'scatter',
                    marker: {
                        size: style.size,
                        color: style.color,
                        opacity: style.opacity,
                        line: {
                            width: category.startsWith('top100') ? 0.75 : 0,
                            color: 'rgba(255,255,255,0.65)',
                        },
                    },
                    text: group.text,
                    customdata: group.customdata,
                    hovertemplate: '%{text}<extra></extra>',
                    hoverlabel: { bgcolor: style.hoverBg, font: { color: theme.palette.text.primary, size: 12, family: theme.typography.fontFamily } },
                    name: style.name,
                    showlegend: show,
                    legendgroup: category,
                    yaxis: yaxisKey,
                };
            });
        }

        if (breakInfo) {
            const { threshold, above } = breakInfo;
            const lowRows = rows.filter((row) => (row.negLogP || 0) <= threshold);
            const highRows = rows.filter((row) => (row.negLogP || 0) > threshold);
            const maxLow = Math.max(...lowRows.map((row) => row.negLogP || 0), 5);
            const maxHigh = Math.max(...highRows.map((row) => row.negLogP || 0), threshold + 1);
            const hiRatio = Math.min(0.3, 0.06 + above * 0.05);
            const botDom = 1 - hiRatio;

            return {
                plotData: [
                    ...buildTraces(lowRows, 'y', true),
                    ...buildTraces(highRows, 'y2', false),
                ],
                layout: {
                    ...baseLayout,
                    xaxis: { ...baseXaxis, domain: [0, 1] },
                    xaxis2: { ...baseXaxis, domain: [0, 1], anchor: 'y2', matches: 'x', title: undefined, showticklabels: false },
                    yaxis: { ...baseYaxis, domain: [0, botDom], anchor: 'x', range: [-0.5, maxLow * 1.05] },
                    yaxis2: { ...baseYaxis, domain: [botDom, 1], anchor: 'x2', title: undefined, range: [threshold - 1, maxHigh * 1.08] },
                },
            };
        }

        const maxY = Math.max(...rows.map((row) => row.negLogP || 0), 5);
        return {
            plotData: buildTraces(rows, 'y', true),
            layout: {
                ...baseLayout,
                xaxis: { ...baseXaxis },
                yaxis: { ...baseYaxis, range: [-0.5, maxY * 1.08] },
            },
        };
    }, [breakInfo, chartTokens, classify, rows, theme.palette.text.primary, theme.typography.fontFamily]);

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

    useEffect(() => {
        if (!highlightGene.gene || !tableOpen) return undefined;
        const idx = sortedRows.findIndex((r) => r.gene === highlightGene.gene);
        if (idx >= 0) {
            const nextPage = Math.floor(idx / rowsPerPage) + 1;
            if (nextPage !== page) {
                setPage(nextPage);
                return undefined;
            }

            const timeoutId = window.setTimeout(() => {
                scrollElementNearViewportCenter(tablePaperRef.current, { viewportOffset: 0.08 });
                const rowEl = tableRowRefs.current[highlightGene.gene];
                if (rowEl) rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 140);

            return () => window.clearTimeout(timeoutId);
        }
        return undefined;
    }, [highlightGene, page, rowsPerPage, sortedRows, tableOpen]);

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

    const openProgramPicker = useCallback((event) => {
        setProgramPickerAnchor(event.currentTarget);
    }, []);

    const closeProgramPicker = useCallback(() => {
        setProgramPickerAnchor(null);
        setProgramSearch('');
    }, []);

    const selectProgram = useCallback((id) => {
        if (id && id !== String(programId || '')) {
            onProgramChange?.(id);
        }
        setProgramPickerAnchor(null);
        setProgramSearch('');
    }, [onProgramChange, programId]);

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
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 440px)' }, gap: 2, mb: 2, alignItems: 'start' }}>
                <Paper
                    variant="outlined"
                    sx={plotFrameSx(theme, { p: 1 })}
                >
                    <Typography sx={{ px: 1, pb: 0.75, fontSize: '0.76rem', fontWeight: 700, color: theme.palette.text.secondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Program
                    </Typography>
                    <ButtonBase
                        data-program-picker-trigger="true"
                        onClick={openProgramPicker}
                        sx={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1.25,
                            px: 1.25,
                            py: 1.1,
                            borderRadius: 1,
                            textAlign: 'left',
                            border: `1px solid ${theme.custom.border.soft}`,
                            backgroundColor: theme.palette.background.paper,
                            transition: `transform ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}`,
                            '&:hover': {
                                borderColor: alpha(theme.palette.primary.main, 0.28),
                                backgroundColor: theme.custom.surface.raised,
                                boxShadow: theme.custom.shadow.focus,
                                transform: 'translateY(-1px)',
                            },
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.98rem', fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.2 }}>
                                {selectedProgram?.label || 'Select program'}
                            </Typography>
                            <Typography sx={{ mt: 0.35, fontSize: '0.8rem', color: theme.palette.text.secondary, lineHeight: 1.45 }}>
                                {selectedProgram?.annotation || 'Open the program list to switch views'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                            <ExpandMore sx={{ color: theme.palette.text.secondary }} />
                        </Box>
                    </ButtonBase>
                </Paper>
            </Box>

            <Popover
                open={programPickerOpen}
                anchorEl={programPickerAnchor}
                onClose={closeProgramPicker}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: plotFrameSx(theme, {
                        mt: 0.75,
                        width: { xs: 'min(92vw, 520px)', sm: 500 },
                        overflow: 'hidden',
                        boxShadow: theme.custom.shadow.float,
                    }),
                }}
            >
                <Box sx={sectionPanelHeaderSx(theme, { display: 'block', p: 1.25 })}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: theme.palette.text.primary }}>
                                Program list
                            </Typography>
                            <Typography sx={{ mt: 0.2, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                Browse by program id or annotation
                            </Typography>
                        </Box>
                        <Chip
                            label={`${filteredProgramOptions.length}/${programOptions.length}`}
                            size="small"
                            sx={summaryChipSx(theme, { ...metricChipTone(theme, 'primary'), flexShrink: 0 })}
                        />
                    </Box>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        value={programSearch}
                        onChange={(event) => setProgramSearch(event.target.value)}
                        placeholder="Search P54 or ER lumen"
                        InputProps={{
                            startAdornment: <Search fontSize="small" sx={{ color: theme.custom.chart.axisSoft, mr: 0.75 }} />,
                        }}
                    />
                </Box>

                <Box data-program-picker-list="true" sx={{ maxHeight: 440, overflowY: 'auto', p: 1 }}>
                    {filteredProgramOptions.length > 0 ? filteredProgramOptions.map((option) => {
                        const selected = option.id === String(programId || '');
                        return (
                            <ButtonBase
                                key={option.id}
                                data-program-option={option.id}
                                onClick={() => selectProgram(option.id)}
                                sx={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    px: 1.25,
                                    py: 1,
                                    mb: 0.75,
                                    borderRadius: 1,
                                    textAlign: 'left',
                                    border: selected ? `1px solid ${alpha(theme.palette.primary.main, 0.28)}` : `1px solid ${theme.custom.border.soft}`,
                                    backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
                                    transition: `transform ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        borderColor: alpha(theme.palette.primary.main, 0.24),
                                        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.1) : theme.custom.surface.raised,
                                        boxShadow: theme.custom.shadow.panel,
                                    },
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                                        {option.label}
                                    </Typography>
                                    <Typography sx={{ mt: 0.3, fontSize: '0.8rem', color: theme.palette.text.secondary, lineHeight: 1.45 }}>
                                        {option.annotation}
                                    </Typography>
                                </Box>
                            </ButtonBase>
                        );
                    }) : (
                        <Box sx={{ px: 1, py: 3, textAlign: 'center' }}>
                            <Input sx={{ fontSize: 28, color: theme.custom.chart.axisSoft }} />
                            <Typography sx={{ mt: 1, fontSize: '0.88rem', fontWeight: 600, color: theme.palette.text.primary }}>
                                No matching programs
                            </Typography>
                            <Typography sx={{ mt: 0.35, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                Try program id, annotation keywords, or a shorter search.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Popover>

            {/* ---- 火山图 ---- */}
            {(plotData.length > 0 || isLoading) && (
                <Paper
                    variant="outlined"
                    sx={plotFrameSx(theme, {
                        mb: 2,
                        position: 'relative',
                        minHeight: isLoading ? 320 : 'auto',
                        width: '100%',
                    })}
                >
                    {isLoading && (
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: chartTokens.overlay, zIndex: 10 }}>
                            <CircularProgress size={40} />
                        </Box>
                    )}
                    {plotData.length > 0 && (
                        <>
                            <Box
                                sx={sectionPanelHeaderSx(theme, {
                                    px: { xs: 2, md: 2.5 },
                                    pt: 2,
                                    pb: 1.25,
                                    alignItems: { xs: 'flex-start', md: 'center' },
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                })}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: theme.palette.text.primary }}>
                                        Volcano plot
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.82rem', color: theme.palette.text.secondary, mt: 0.25 }}>
                                        {titleText}
                                    </Typography>
                                </Box>
                            </Box>
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
                                style={{ width: '100%', height: PLOT_HEIGHT }}
                            />
                            <FloatingLegend
                                items={legendItems}
                                title="Signals"
                                width={{ expanded: 188, collapsed: 120 }}
                                defaultPlacement="right"
                                defaultTop={84}
                                defaultSideOffset={10}
                            />
                            <GeneRegulationTable
                                rows={rows}
                                pagedRows={pagedRows}
                                tableOpen={tableOpen}
                                setTableOpen={setTableOpen}
                                sortBy={sortBy}
                                sortDir={sortDir}
                                handleSort={handleSort}
                                highlightGene={highlightGene}
                                setHighlightGene={setHighlightGene}
                                page={page}
                                setPage={setPage}
                                rowsPerPage={rowsPerPage}
                                setRowsPerPage={setRowsPerPage}
                                totalPages={totalPages}
                                jumpInput={jumpInput}
                                setJumpInput={setJumpInput}
                                handleJumpToPage={handleJumpToPage}
                                tablePaperRef={tablePaperRef}
                                tableRowRefs={tableRowRefs}
                                downloadCSV={downloadCSV}
                                stats={stats}
                                annotation={pinfo?.curated_annotation}
                                embedded
                            />
                        </>
                    )}
                </Paper>
            )}

            {/* 导出对话框 */}
            <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
                <DialogTitle sx={{ fontWeight: 700, color: theme.palette.text.primary }}>Export Plot</DialogTitle>
                <DialogContent>
                    <ToggleButtonGroup value={expFmt} exclusive size="small"
                        onChange={(e, v) => v && setExpFmt(v)} sx={{ ...compactToggleStyles, mb: 2 }}>
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

            {/* 全屏覆盖 */}
            {fullscreen && (
                <Box sx={{
                    position: 'fixed', inset: 0, zIndex: 9999, bgcolor: theme.palette.background.paper,
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
                    <FloatingLegend
                        items={legendItems}
                        title="Signals"
                        width={{ expanded: 188, collapsed: 120 }}
                        defaultPlacement="right"
                        defaultTop={58}
                        defaultSideOffset={18}
                    />
                </Box>
            )}
        </Box>
    );
}
