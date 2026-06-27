import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import Plot, { Plotly } from '../lib/plotly';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { useTheme } from '@mui/material/styles';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { UpdatingStatus } from './PageScaffold';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementIntoNearestView, scrollElementNearViewportCenter } from '../utils/scroll';
import { detailSummarySWRConfig, figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useIdleRenderGate } from '../utils/renderScheduling';
import { compareValues } from '../utils/sort';
import { formatScientificNumber } from '../utils/numbers';
import ExportPlotDialog from './ExportPlotDialog';
import FigureLoadingPanel from './FigureLoadingPanel';
import GeneRegulationTable from './GeneRegulationTable';
import {
    buildPlotHoverTone,
    buildPlotHoverToneNeutral,
    chartLayoutTokens,
    plotFrameSx,
    RESPONSIVE_COMPACT_PLOT_HEIGHT,
    sectionPanelHeaderSx,
} from '../themeUtils';

const TOP_HIT_COUNT = 100;
const P_VALUE_THRESHOLD = 0.05;
const EFFECT_SIZE_THRESHOLD = 0.1;
const MIN_EFFECT_SPAN = 0.65;
const PLOT_HEIGHT = RESPONSIVE_COMPACT_PLOT_HEIGHT;

const CLASS_STYLE = {
    nodata: { color: '#d8dde6', size: 4, opacity: 0.26, name: 'No data' },
    ns: { color: '#c3ccd8', size: 6, opacity: 0.44, name: 'Background' },
    sig_up: { color: '#fb986d', size: 7, opacity: 0.62, name: 'Positive hit' },
    sig_down: { color: '#79b9f2', size: 7, opacity: 0.62, name: 'Negative hit' },
    top100_up: { color: '#dc7141', size: 8, opacity: 0.88, name: 'Top positive' },
    top100_down: { color: '#4b92df', size: 8, opacity: 0.88, name: 'Top negative' },
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
export default function GeneRegulation({ programId }) {
    const theme = useTheme();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const regulationKey = programId ? `/api/regulation/${programId}` : null;
    const regulationResource = useCachedResourceState(
        useSWR(regulationKey, fetcher, figureResourceSWRConfig),
        { cacheKey: regulationKey, retainPreviousData: false },
    );
    const { displayData: data, error, isInitialLoading: isLoading, isRefreshing } = regulationResource;
    const infoResource = useCachedResourceState(
        useSWR('/api/programs/info', fetcher, detailSummarySWRConfig),
        { cacheKey: '/api/programs/info' },
    );
    const infoData = infoResource.displayData;
    const pinfo = (infoData && programId) ? (infoData[`P${programId}`] || infoData[programId]) : null;
    const afterFirstPaint = useAfterFirstPaint(regulationKey || 'gene-regulation-empty');

    useEffect(() => { setPage(1); }, [programId]);

    // ---- 数据 ----
    const rows = useMemo(() => {
        if (!Array.isArray(data?.data)) return [];
        return data.data.map((r) => {
            const es = parseFloat(r.lm_es);
            const p = parseFloat(r.lm_p);
            return {
                gene: r.GENE || '',
                es: Number.isFinite(es) ? es : null,
                p: Number.isFinite(p) ? p : null,
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
            title: { text: '-log10(p-value)', font: { size: 13, color: chartTokens.axisColor, family: theme.typography.fontFamily } },
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
            autosize: true,
            hovermode: 'closest',
            hoverlabel: buildPlotHoverToneNeutral(theme, '#7a8798', {
                fontSize: 12,
                family: theme.typography.fontFamily,
            }),
            margin: { l: 74, r: 18, t: 58, b: 56 },
            plot_bgcolor: chartTokens.plotBg,
            paper_bgcolor: chartTokens.paperBg,
            showlegend: true,
            legend: {
                x: 0.985,
                y: 0.985,
                xanchor: 'right',
                yanchor: 'top',
                orientation: 'v',
                bgcolor: 'rgba(255,255,255,0.82)',
                bordercolor: chartTokens.axisSoft,
                borderwidth: 1,
                font: {
                    size: 11,
                    color: chartTokens.axisColor,
                    family: theme.typography.fontFamily,
                },
                traceorder: 'normal',
            },
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
        const traceType = rows.length > 1500 ? 'scattergl' : 'scatter';
        function buildTraces(dataRows, yaxisKey, isPrimary) {
            const grouped = {};
            dataRows.forEach((row) => {
                const category = classify(row.es, row.p);
                if (!grouped[category]) grouped[category] = { x: [], y: [], text: [], customdata: [] };
                grouped[category].x.push(row.es);
                grouped[category].y.push(row.negLogP);
                grouped[category].text.push(`<b>${row.gene}</b><br>Effect size: ${row.es?.toFixed(4)}<br>p-value: ${formatScientificNumber(row.p, 2)}`);
                grouped[category].customdata.push([row.gene]);
            });

            return ['ns', 'sig_down', 'sig_up', 'top100_down', 'top100_up', 'nodata'].map((category) => {
                const group = grouped[category];
                if (!group || group.x.length === 0) return { type: traceType, x: [], y: [], visible: false, yaxis: yaxisKey };

                const style = CLASS_STYLE[category];
                const show = isPrimary && !legendShown.has(category);
                if (show) legendShown.add(category);

                return {
                    x: group.x,
                    y: group.y,
                    mode: 'markers',
                    type: traceType,
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
                    hoverlabel: buildPlotHoverTone(theme, style.color, {
                        bgAlpha: category === 'nodata' ? 0.2 : 0.18,
                        borderAlpha: category.startsWith('top100') ? 0.46 : 0.38,
                    }),
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
    }, [breakInfo, chartTokens, classify, rows, theme]);

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
    const [sortBy, setSortBy] = useState('gene');
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
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [jumpInput, setJumpInput] = useState('');
    const tablePaperRef = useRef(null);
    const tableRowRefs = useRef({});

    const sortedRows = useMemo(() => {
        return [...rows].sort((a, b) => {
            if (sortBy === 'gene') {
                return compareValues(a.gene, b.gene, 'text', sortDir);
            }
            return compareValues(a[sortBy], b[sortBy], 'number', sortDir);
        });
    }, [rows, sortBy, sortDir]);

    const shouldPaginateTable = sortedRows.length > 10;
    const totalPages = shouldPaginateTable ? Math.max(1, Math.ceil(sortedRows.length / rowsPerPage)) : 1;
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

    const pagedRows = useMemo(() => {
        if (!shouldPaginateTable) return sortedRows;
        const start = (page - 1) * rowsPerPage;
        return sortedRows.slice(start, start + rowsPerPage);
    }, [page, rowsPerPage, shouldPaginateTable, sortedRows]);
    const shouldRenderTable = useIdleRenderGate(
        plotData.length > 0 && afterFirstPaint,
        `${regulationKey || 'gene-regulation-empty'}:${rows.length}:${sortedRows.length}`,
        { delay: sortedRows.length > 1000 ? 450 : 180, timeout: 1600 },
    );

    useEffect(() => {
        if (!highlightGene.gene) return undefined;
        const idx = sortedRows.findIndex((r) => r.gene === highlightGene.gene);
        if (idx >= 0) {
            const nextPage = shouldPaginateTable ? Math.floor(idx / rowsPerPage) + 1 : 1;
            if (shouldPaginateTable && nextPage !== page) {
                setPage(nextPage);
                return undefined;
            }

            const timeoutId = window.setTimeout(() => {
                scrollElementNearViewportCenter(tablePaperRef.current, { viewportOffset: 0.08 });
                const rowEl = tableRowRefs.current[highlightGene.gene];
                if (rowEl) scrollElementIntoNearestView(rowEl);
            }, 140);

            return () => window.clearTimeout(timeoutId);
        }
        return undefined;
    }, [highlightGene, page, rowsPerPage, shouldPaginateTable, sortedRows]);

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
        const hdr = 'Gene,Effect Size (lm_es),p-value (lm_p),-log10(p-value)';
        const body = rows.map(r => [r.gene, r.es, r.p, r.negLogP].join(',')).join('\n');
        const blob = new Blob([hdr + '\n' + body], { type: 'text/csv;charset=utf-8' });
        const baseName = (data?.fileName || `program${programId}.txt`).replace(/\.txt$/, '');
        downloadBlob(blob, `${baseName}.csv`);
    }, [rows, data?.fileName, programId]);

    // ---- 统计 ----
    // ----
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error.message}</Alert>;

    return (
        <Box sx={{ position: 'relative' }}>
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
                        <FigureLoadingPanel
                            minHeight={PLOT_HEIGHT}
                            message="Loading gene regulation data..."
                        />
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
                                    <Typography sx={{ mt: 0.35, fontSize: '0.73rem', lineHeight: 1.45, color: theme.palette.text.secondary }}>
                                        Colors encode signal class: gray points are background, light orange and light blue are significant positive or negative hits, and darker orange and darker blue mark the top 100 strongest signals by p-value.
                                    </Typography>
                                </Box>
                                <UpdatingStatus active={isRefreshing} />
                            </Box>
                            {afterFirstPaint ? (
                                <>
                                    <Plot
                                        onClick={(evt) => {
                                            if (!evt?.points?.length) return;
                                            const gene = evt.points[0].customdata?.[0];
                                            if (gene) {
                                                setHighlightGene(prev => ({ gene, key: prev.key + 1 }));
                                            }
                                        }}
                                        data={plotData}
                                        layout={layout}
                                        config={plotConfig}
                                        useResizeHandler
                                        style={{ width: '100%', height: PLOT_HEIGHT }}
                                    />
                                    {shouldRenderTable && (
                                        <GeneRegulationTable
                                            rows={rows}
                                            pagedRows={pagedRows}
                                            sortBy={sortBy}
                                            sortDir={sortDir}
                                            handleSort={handleSort}
                                            highlightGene={highlightGene}
                                            page={page}
                                            setPage={setPage}
                                            rowsPerPage={rowsPerPage}
                                            setRowsPerPage={setRowsPerPage}
                                            totalPages={totalPages}
                                            shouldPaginate={shouldPaginateTable}
                                            jumpInput={jumpInput}
                                            setJumpInput={setJumpInput}
                                            handleJumpToPage={handleJumpToPage}
                                            tablePaperRef={tablePaperRef}
                                            tableRowRefs={tableRowRefs}
                                            downloadCSV={downloadCSV}
                                            embedded
                                        />
                                    )}
                                </>
                            ) : (
                                <FigureLoadingPanel
                                    minHeight={PLOT_HEIGHT}
                                    message="Rendering gene regulation plot..."
                                />
                            )}
                        </>
                    )}
                </Paper>
            )}

            <ExportPlotDialog
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                width={expW}
                onWidthChange={(value) => setExpW(Number(value))}
                height={expH}
                onHeightChange={(value) => setExpH(Number(value))}
                format={expFmt}
                onFormatChange={setExpFmt}
                onExport={doExport}
            />

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
