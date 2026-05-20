import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Box, Typography, Alert, CircularProgress, ToggleButtonGroup, ToggleButton,
    Slider, FormControlLabel, Switch, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Chip, Paper,
} from '@mui/material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import ProgramScatterTable from './ProgramScatterTable';

const COLORS = {
    other: '#b8c0cc',
    program_enriched: '#E69F00',
    regulator_enriched: '#0072B2',
    both_enriched: '#009E73',
};

const LEGEND_LABELS = {
    other: 'Other',
    program_enriched: 'Program enriched',
    regulator_enriched: 'Regulator enriched',
    both_enriched: 'Both enriched',
};

const TRACE_ORDER = ['other', 'program_enriched', 'regulator_enriched', 'both_enriched'];
const CATEGORY_SIZE_SCALE = {
    other: 1,
    program_enriched: 1.32,
    regulator_enriched: 1.32,
    both_enriched: 1.55,
};
const TABLE_TONES = {
    program: {
        headerBg: '#fbf1d8',
        headerBorder: '#e5c57b',
        headerColor: '#9A5A00',
        cellStrong: '#fcf6e8',
        cellSoft: '#fdf9ef',
        rankCell: '#f8ebc9',
    },
    regulator: {
        headerBg: '#e4f1f8',
        headerBorder: '#93bfd6',
        headerColor: '#0B5C89',
        cellStrong: '#eff7fb',
        cellSoft: '#f7fbfd',
        rankCell: '#dceef7',
    },
};

const MODES = {
    SCATTER: 'scatter',
    RANK_PROG: 'rankProg',
    RANK_REG: 'rankReg',
};

const AXIS_STYLE = {
    zeroline: true, zerolinewidth: 1.2, zerolinecolor: '#bbb',
    showgrid: true, gridwidth: 0.5, gridcolor: '#eaeaea',
    showline: true, linewidth: 1, linecolor: '#ccc',
    ticks: 'inside', tickfont: { size: 13, color: '#666' },
};

const DEFAULT_TOP_N = 10;
const DEFAULT_EXPORT_WIDTH = 1200;
const DEFAULT_EXPORT_HEIGHT = 800;
const PLOT_TRANSITION_DURATION = 450;

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function sanitizeFileNamePart(value) {
    return String(value || 'plot').replace(/[\\/:*?"<>|]+/g, '_');
}

function normalizeExportSize(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return clamp(Math.round(num), 200, 4000);
}

function computeAxisRange(values, paddingRatio = 0.08) {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    if (finiteValues.length === 0) return [-1, 1];

    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);

    if (min === max) {
        const delta = Math.max(Math.abs(min) * paddingRatio, 1);
        return [min - delta, max + delta];
    }

    const span = max - min;
    const padding = span * paddingRatio;
    return [min - padding, max + padding];
}

function formatFixed(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits) : 'NA';
}

function formatPValue(value) {
    return Number.isFinite(value) ? value.toExponential(2) : 'NA';
}

function formatRank(value) {
    return Number.isFinite(value) ? `#${value}` : 'NA';
}

function readInfoText(...values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text && text.toLowerCase() !== 'none') return text;
    }
    return '';
}

function buildHoverText(item, key, info) {
    const annotation = readInfoText(info?.curated_annotation, info?.Curated_annotation) || 'No curated annotation';
    const representativeGo = readInfoText(info?.representative_go);
    const representativeTf = readInfoText(info?.representative_tf);
    const representativeTfClass = readInfoText(info?.representative_tf_class);
    const markerCoexpression = readInfoText(info?.marker_coexpression);

    const lines = [
        `<b>P${item.program}</b>`,
        `<span style="color:${COLORS[key]};font-weight:600">${LEGEND_LABELS[key]}</span>`,
        annotation,
        '',
        `<b>Program</b>  score ${formatFixed(item.progScore, 3)}  ·  rank ${formatRank(item.rankProg)}  ·  P ${formatPValue(item.progP)}  ·  γ ${formatFixed(item.progGamma, 4)}`,
        `<b>Regulator</b>  score ${formatFixed(item.regScore, 3)}  ·  rank ${formatRank(item.rankReg)}  ·  P ${formatPValue(item.regP)}  ·  β ${formatFixed(item.regBeta, 4)}`,
    ];

    if (representativeGo) {
        lines.push(`GO: ${representativeGo}${info?.go_enrichment_p ? ` (P ${info.go_enrichment_p})` : ''}`);
    }
    if (representativeTf) {
        lines.push(`TF: ${representativeTf}${representativeTfClass ? ` · ${representativeTfClass}` : ''}${info?.representative_tf_p ? ` (P ${info.representative_tf_p})` : ''}`);
    }
    if (markerCoexpression) {
        lines.push(`Marker: ${markerCoexpression}`);
    }

    return lines.join('<br>');
}

const thSx = (align) => ({
    fontWeight: 600, fontSize: '0.7rem', py: 0.7, px: 1.3,
    bgcolor: '#f7f7f7', borderBottom: '2px solid #d0d0d0', color: '#555',
    textAlign: align, whiteSpace: 'nowrap',
});

const tdSx = (align, fontFamily, fontWeight, bgcolor) => ({
    fontSize: '0.73rem', py: 0.55, px: 1.3,
    textAlign: align, whiteSpace: 'nowrap',
    fontFamily: fontFamily || 'inherit',
    fontWeight: fontWeight || 400,
    bgcolor: bgcolor || 'transparent',
    color: '#444',
});

// ============================================================
export default function ProgramScatter({ fileId }) {
    const navigate = useNavigate();
    const { data, error, isLoading } = useSWR(
        fileId ? `/api/programs/${fileId}` : null,
        fetcher,
    );
    const { data: infoData } = useSWR('/api/programs/info', fetcher);
    const programInfo = useMemo(() => infoData || {}, [infoData]);

    const [mode, setMode] = useState(MODES.SCATTER);
    const [topN, setTopN] = useState(DEFAULT_TOP_N);
    const [markerSize, setMarkerSize] = useState(10);
    const [bubbleScale, setBubbleScale] = useState(1.5);
    const [showLabels, setShowLabels] = useState(true);
    const [exportOpen, setExportOpen] = useState(false);
    const [expW, setExpW] = useState(1200);
    const [expH, setExpH] = useState(800);
    const [expFmt, setExpFmt] = useState('svg');
    const exportGdRef = useRef(null);
    const [tableOpen, setTableOpen] = useState(false);
    const [sortBy, setSortBy] = useState('progScore');
    const [sortDir, setSortDir] = useState('desc');
    const [highlight, setHighlight] = useState({ program: null, key: 0 });
    const tableRowRefs = useRef({});
    const plotElRef = useRef(null);

    const onInitialized = useCallback((_figure, graphDiv) => {
        plotElRef.current = graphDiv;
    }, []);

    const onUpdate = useCallback((_figure, graphDiv) => {
        plotElRef.current = graphDiv;
    }, []);

    // ---- 数据预处理：保留无效值为 null，避免悄悄落到 (0, 0) ----
    const rows = useMemo(() => {
        if (!Array.isArray(data?.data)) return [];

        const arr = data.data.map((item) => ({
            program: item.Program || '',
            label: item.label || '',
            color: TRACE_ORDER.includes(item.color) ? item.color : 'other',
            progScore: toFiniteNumber(item.program_score),
            regScore: toFiniteNumber(item.regulator_score),
            progP: toFiniteNumber(item.MEANgamma_top100_shet_adjusted_P),
            regP: toFiniteNumber(item.P_withShet),
            progGamma: toFiniteNumber(item.MEANgamma_top100),
            regBeta: toFiniteNumber(item.beta_withShet),
            rankProg: null,
            rankReg: null,
        }));

        const byAbsProg = arr
            .filter((item) => item.progScore !== null)
            .sort((a, b) => Math.abs(b.progScore) - Math.abs(a.progScore));
        const byAbsReg = arr
            .filter((item) => item.regScore !== null)
            .sort((a, b) => Math.abs(b.regScore) - Math.abs(a.regScore));

        byAbsProg.forEach((item, index) => {
            item.rankProg = index + 1;
        });

        byAbsReg.forEach((item, index) => {
            item.rankReg = index + 1;
        });

        return arr;
    }, [data]);

    const maxRankCount = useMemo(() => {
        if (mode === MODES.RANK_PROG) {
            return rows.filter((item) => item.rankProg !== null).length;
        }
        if (mode === MODES.RANK_REG) {
            return rows.filter((item) => item.rankReg !== null).length;
        }
        return Math.max(
            rows.filter((item) => item.rankProg !== null).length,
            rows.filter((item) => item.rankReg !== null).length,
        );
    }, [mode, rows]);

    const maxTopN = Math.max(1, maxRankCount || 1);
    const effectiveTopN = clamp(topN, 1, maxTopN);

    useEffect(() => {
        setTopN((prev) => {
            const safe = clamp(prev, 1, maxTopN);
            return safe < DEFAULT_TOP_N && maxTopN >= DEFAULT_TOP_N
                ? Math.min(DEFAULT_TOP_N, maxTopN)
                : safe;
        });
    }, [maxTopN]);

    useEffect(() => {
        if (!highlight.program || !tableOpen) return;
        const el = tableRowRefs.current[highlight.program];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [highlight, tableOpen]);

    // ---- 当前模式下真正参与显示的点 ----
    const visibleRows = useMemo(() => rows.filter((item) => {
        if (mode === MODES.SCATTER) {
            return item.progScore !== null && item.regScore !== null;
        }
        if (mode === MODES.RANK_PROG) {
            return item.rankProg !== null
                && item.rankProg <= effectiveTopN
                && item.progScore !== null;
        }
        return item.rankReg !== null
            && item.rankReg <= effectiveTopN
            && item.regScore !== null;
    }), [effectiveTopN, mode, rows]);

    const visibleRowsByColor = useMemo(() => {
        const grouped = {
            other: [],
            program_enriched: [],
            regulator_enriched: [],
            both_enriched: [],
        };

        visibleRows.forEach((item) => {
            grouped[item.color].push(item);
        });

        return grouped;
    }, [visibleRows]);

    const handleSort = useCallback((column) => {
        if (column === sortBy) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(column);
            setSortDir('desc');
        }
    }, [sortBy]);

    const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);

    const sortedRows = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            const va = a[sortBy];
            const vb = b[sortBy];
            // program / color — 自然排序（字符串含数字按数值排）
            if (sortBy === 'program' || sortBy === 'color') {
                const sa = va ?? '';
                const sb = vb ?? '';
                return collator.compare(sa, sb) * dir;
            }
            // 数值列
            const na = va ?? -Infinity;
            const nb = vb ?? -Infinity;
            if (na === nb) return 0;
            return na > nb ? dir : -dir;
        });
    }, [rows, sortBy, sortDir, collator]);

    const downloadCSV = useCallback(() => {
        const cols = ['Program', 'Category', 'Prog Score', 'Rank (Prog)', 'Prog P', 'Gamma', 'Reg Score', 'Rank (Reg)', 'Reg P', 'Beta'];
        const keys = ['program', 'color', 'progScore', 'rankProg', 'progP', 'progGamma', 'regScore', 'rankReg', 'regP', 'regBeta'];
        const header = cols.join(',');
        const body = rows.map((row) => keys.map((k) => {
            const v = row[k];
            if (v == null) return '';
            if (k === 'color') return LEGEND_LABELS[v] || v;
            return v;
        }).join(',')).join('\n');
        const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `program_data_${sanitizeFileNamePart(fileId || 'export')}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [rows, fileId]);

    const counts = useMemo(() => {
        const ct = { other: 0, program_enriched: 0, regulator_enriched: 0, both_enriched: 0 };
        rows.forEach((item) => {
            if (ct[item.color] !== undefined) ct[item.color] += 1;
        });
        return ct;
    }, [rows]);

    const bubbleSizeConfig = useMemo(() => {
        if (mode === MODES.SCATTER) return null;

        const sizeValues = visibleRows
            .map((item) => {
                if (mode === MODES.RANK_PROG) return item.regScore;
                return item.progScore;
            })
            .filter((value) => value !== null)
            .map((value) => Math.abs(value));

        if (sizeValues.length === 0) {
            return { min: 0, max: 1, autoScale: 1 };
        }

        return {
            min: Math.min(...sizeValues),
            max: Math.max(...sizeValues),
            autoScale: Math.min(1, Math.sqrt(10 / Math.max(effectiveTopN, 1))),
        };
    }, [effectiveTopN, mode, visibleRows]);

    const getBubbleSize = useCallback((row) => {
        const categoryScale = CATEGORY_SIZE_SCALE[row.color] || 1;
        if (mode === MODES.SCATTER || !bubbleSizeConfig) return markerSize * categoryScale;

        const sourceValue = mode === MODES.RANK_PROG ? row.regScore : row.progScore;
        const absValue = Math.abs(sourceValue || 0);
        const normalized = (absValue - bubbleSizeConfig.min) / ((bubbleSizeConfig.max - bubbleSizeConfig.min) || 1);

        return (5 + normalized * 25) * bubbleScale * bubbleSizeConfig.autoScale * categoryScale;
    }, [bubbleScale, bubbleSizeConfig, markerSize, mode]);

    const plotData = useMemo(() => TRACE_ORDER.map((key) => {
        const pts = visibleRowsByColor[key];

        if (pts.length === 0) {
            return {
                x: [],
                y: [],
                type: 'scatter',
                mode: 'markers',
                visible: false,
                name: LEGEND_LABELS[key],
                legendgroup: key,
                showlegend: true,
            };
        }

        const x = pts.map((item) => {
            if (mode === MODES.RANK_REG) return item.regScore;
            return item.progScore;
        });

        const y = pts.map((item) => {
            if (mode === MODES.SCATTER) return item.regScore;
            if (mode === MODES.RANK_PROG) return item.rankProg;
            return item.rankReg;
        });

        return {
            x,
            y,
            mode: showLabels ? 'markers+text' : 'markers',
            type: 'scatter',
            marker: {
                size: pts.map((item) => {
                    const sz = getBubbleSize(item);
                    return Number.isFinite(sz) && sz > 0 ? sz : markerSize;
                }),
                color: COLORS[key],
                opacity: key === 'other' ? 0.56 : 0.94,
                line: {
                    width: key === 'other' ? 0.5 : 1,
                    color: key === 'other' ? 'rgba(90,98,112,0.14)' : 'rgba(17,24,39,0.22)',
                },
            },
            ...(showLabels && {
                text: pts.map((item) => item.label || ''),
                textposition: 'top center',
                textfont: { size: 11, color: key === 'other' ? '#667085' : COLORS[key] },
            }),
            name: LEGEND_LABELS[key],
            legendgroup: key,
            showlegend: true,
            hovertemplate: '%{hovertext}<extra></extra>',
            hovertext: pts.map((item) => {
                const info = programInfo[`P${item.program}`] || programInfo[item.program] || {};
                return buildHoverText(item, key, info);
            }),
            customdata: pts.map((item) => [item.program]),
        };
    }), [getBubbleSize, markerSize, mode, programInfo, showLabels, visibleRowsByColor]);

    const axisRanges = useMemo(() => {
        if (mode === MODES.SCATTER) {
            return {
                x: computeAxisRange(visibleRows.map((item) => item.progScore)),
                y: computeAxisRange(visibleRows.map((item) => item.regScore)),
            };
        }

        if (mode === MODES.RANK_PROG) {
            return {
                x: computeAxisRange(visibleRows.map((item) => item.progScore)),
                y: [effectiveTopN + 0.5, 0.5],
            };
        }

        return {
            x: computeAxisRange(visibleRows.map((item) => item.regScore)),
            y: [effectiveTopN + 0.5, 0.5],
        };
    }, [effectiveTopN, mode, visibleRows]);

    const layout = useMemo(() => {
        const isRank = mode !== MODES.SCATTER;
        const xTitle = mode === MODES.RANK_REG
            ? 'Regulator-burden correlation, signed −log₁₀(P)'
            : 'Program burden effect, signed −log₁₀(P)';
        const yTitle = isRank ? 'Rank' : 'Regulator-burden correlation, signed −log₁₀(P)';

        return {
            title: {
                text: `${mode === MODES.SCATTER ? 'Program × Regulator'
                    : (mode === MODES.RANK_PROG ? 'Program Rank' : 'Regulator Rank')} — ${fileId || ''}`,
                font: { size: 18, family: 'system-ui, -apple-system, sans-serif', color: '#333' },
                x: 0.01,
            },
            transition: {
                duration: PLOT_TRANSITION_DURATION,
                easing: 'cubic-in-out',
                ordering: 'traces first',
            },
            xaxis: {
                ...AXIS_STYLE,
                title: { text: xTitle, font: { size: 14 } },
                range: axisRanges.x,
                autorange: false,
                fixedrange: false,
            },
            yaxis: {
                ...AXIS_STYLE,
                title: { text: yTitle, font: { size: 14 } },
                range: axisRanges.y,
                autorange: false,
                fixedrange: false,
            },
            hovermode: 'closest',
            hoverlabel: {
                bgcolor: 'rgba(255,255,255,0.98)',
                bordercolor: '#cbd5e1',
                font: { size: 12, color: '#1f2937' },
                align: 'left',
            },
            margin: { l: 80, r: 40, t: 60, b: 60 },
            plot_bgcolor: '#fcfcfd',
            paper_bgcolor: 'white',
            showlegend: true,
            uirevision: 'program-scatter',
            legend: {
                title: { text: '' },
                itemsizing: 'constant',
                x: 0.02,
                y: 0.98,
                xanchor: 'left',
                yanchor: 'top',
                bgcolor: 'rgba(255,255,255,0.85)',
                bordercolor: '#e0e0e0',
                borderwidth: 1,
                font: { size: 12, color: '#555' },
            },
            shapes: mode === MODES.SCATTER ? [
                {
                    type: 'line',
                    xref: 'paper',
                    x0: 0,
                    x1: 1,
                    y0: 0,
                    y1: 0,
                    line: { color: '#bbb', width: 1.2, dash: '6px,3px' },
                    layer: 'below',
                },
                {
                    type: 'line',
                    yref: 'paper',
                    y0: 0,
                    y1: 1,
                    x0: 0,
                    x1: 0,
                    line: { color: '#bbb', width: 1.2, dash: '6px,3px' },
                    layer: 'below',
                },
            ] : [],
        };
    }, [axisRanges.x, axisRanges.y, fileId, mode]);

    const doExport = useCallback(() => {
        const gd = exportGdRef.current;
        if (!gd) return;
        const width = normalizeExportSize(expW, DEFAULT_EXPORT_WIDTH);
        const height = normalizeExportSize(expH, DEFAULT_EXPORT_HEIGHT);
        Plotly.toImage(gd, { format: expFmt, width, height }).then(dataUrl => {
            const a = document.createElement('a');
            a.href = dataUrl; a.download = `program_${sanitizeFileNamePart(fileId || 'plot')}.${expFmt}`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        });
    }, [expFmt, expW, expH, fileId]);

    const plotConfig = useMemo(() => ({
        responsive: true, displaylogo: false,
        edits: { legendPosition: true },
        modeBarButtonsToAdd: [{
            name: 'download', title: 'Download plot',
            icon: Plotly.Icons.disk,
            click: function (gd) { exportGdRef.current = gd; setExportOpen(true); },
        }],
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);

    const plotRevision = useMemo(() => ([
        mode,
        effectiveTopN,
        markerSize,
        bubbleScale.toFixed(1),
        showLabels ? 'labels-on' : 'labels-off',
        fileId || '',
        rows.length,
    ].join('|')), [bubbleScale, effectiveTopN, fileId, markerSize, mode, rows.length, showLabels]);


    if (!fileId) {
        return (
            <Box sx={{ p: 6, textAlign: 'center' }}>
                <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Select a trait to view program × regulator analysis
                </Typography>
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error" sx={{ m: 2 }}>{error.message}</Alert>;
    }

    const hasVisiblePoints = plotData.some((trace) => Array.isArray(trace.x) && trace.x.length > 0);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rows.length > 0 && (
                <Box sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    mb: 1.5,
                    bgcolor: '#f9f9fb',
                    borderRadius: 2,
                    border: '1px solid #e8e8ec',
                }}>
                    <ToggleButtonGroup
                        value={mode}
                        exclusive
                        size="small"
                        onChange={(_, value) => value && setMode(value)}
                        sx={{
                            '& .MuiToggleButton-root': {
                                px: 1.8,
                                py: 0.4,
                                textTransform: 'none',
                                fontWeight: 500,
                                fontSize: '0.8rem',
                                letterSpacing: 0.2,
                                color: '#777',
                                borderColor: '#ddd',
                                '&.Mui-selected': {
                                    color: '#222',
                                    bgcolor: '#e8e8ee',
                                    fontWeight: 600,
                                },
                                '&:hover': { bgcolor: '#f0f0f4' },
                            },
                        }}
                    >
                        <ToggleButton value={MODES.SCATTER}>Scatter</ToggleButton>
                        <ToggleButton value={MODES.RANK_PROG}>Rank · Program</ToggleButton>
                        <ToggleButton value={MODES.RANK_REG}>Rank · Regulator</ToggleButton>
                    </ToggleButtonGroup>


                    <FormControlLabel
                        control={(
                            <Switch
                                checked={showLabels}
                                onChange={(event) => setShowLabels(event.target.checked)}
                                size="small"
                            />
                        )}
                        label={<Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#666' }}>Labels</Typography>}
                        sx={{ mr: 0 }}
                    />

                    {mode !== MODES.SCATTER && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: '#888',
                                    fontSize: '0.72rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.8,
                                    fontWeight: 500,
                                }}
                            >
                                Top N
                            </Typography>
                            <Slider
                                value={effectiveTopN}
                                min={1}
                                max={maxTopN}
                                step={1}
                                onChange={(_, value) => setTopN(Number(value))}
                                sx={{
                                    width: 110,
                                    color: '#999',
                                    '& .MuiSlider-thumb': { width: 14, height: 14 },
                                    '& .MuiSlider-rail': { opacity: 0.25 },
                                }}
                            />
                            <Chip
                                label={`${effectiveTopN}/${maxTopN}`}
                                size="small"
                                sx={{
                                    minWidth: 52,
                                    height: 22,
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    bgcolor: '#eee',
                                    color: '#555',
                                }}
                            />
                        </Box>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: mode !== MODES.SCATTER ? 0 : 1 }}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#888',
                                fontSize: '0.72rem',
                                textTransform: 'uppercase',
                                letterSpacing: 0.8,
                                fontWeight: 500,
                            }}
                        >
                            Size
                        </Typography>
                            <Slider
                                value={mode === MODES.SCATTER ? markerSize : bubbleScale}
                                min={mode === MODES.SCATTER ? 3 : 0.8}
                                max={mode === MODES.SCATTER ? 25 : 2}
                                step={mode === MODES.SCATTER ? 1 : 0.1}
                                onChange={(_, value) => mode === MODES.SCATTER
                                    ? setMarkerSize(Number(value))
                                    : setBubbleScale(Number(value))}
                                sx={{
                                    width: 90,
                                    color: '#999',
                                    '& .MuiSlider-thumb': { width: 14, height: 14 },
                                    '& .MuiSlider-rail': { opacity: 0.25 },
                                }}
                            />
                        <Typography variant="caption" sx={{ color: '#999', fontSize: '0.72rem', minWidth: 28 }}>
                            {mode === MODES.SCATTER ? markerSize : `${bubbleScale.toFixed(1)}×`}
                        </Typography>
                    </Box>

                    <Box sx={{ flex: 1 }} />

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {TRACE_ORDER.map((key) => counts[key] > 0 && (
                            <Chip
                                key={key}
                                label={`${LEGEND_LABELS[key]}: ${counts[key]}`}
                                size="small"
                                sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    bgcolor: `${COLORS[key]}18`,
                                    color: COLORS[key],
                                    border: `1px solid ${COLORS[key]}44`,
                                    fontWeight: 500,
                                }}
                            />
                        ))}
                    </Box>

                </Box>
            )}

            {(isLoading || rows.length > 0) && (
                <Paper
                    variant="outlined"
                    sx={{
                        position: 'relative',
                        minHeight: isLoading || hasVisiblePoints ? 620 : undefined,
                        border: '1px solid #e8e8ec',
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: '#fff',
                        boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
                    }}
                >
                    {isLoading && (
                        <Box sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(255,255,255,0.7)',
                            zIndex: 10,
                        }}>
                            <CircularProgress size={40} />
                        </Box>
                    )}

                    {!isLoading && rows.length > 0 && !hasVisiblePoints && (
                        <Box sx={{ px: 2.5, py: 2 }}>
                            <Alert severity="info">
                                No valid points are available for the current mode.
                            </Alert>
                        </Box>
                    )}

                    {hasVisiblePoints && (
                        <Plot
                            onInitialized={onInitialized}
                            onUpdate={onUpdate}
                            onClick={(evt) => {
                                if (!evt?.points?.length) return;
                                const program = evt.points[0].customdata?.[0];
                                if (program) {
                                    setHighlight((prev) => ({ program, key: prev.key + 1 }));
                                    setTableOpen(true);
                                }
                            }}
                            data={plotData}
                            layout={layout}
                            config={plotConfig}
                            revision={plotRevision}
                            useResizeHandler
                            style={{ width: '100%', height: 620 }}
                        />
                    )}
                </Paper>
            )}

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

            <ProgramScatterTable
                rows={rows}
                tableOpen={tableOpen}
                setTableOpen={setTableOpen}
                setHighlight={setHighlight}
                downloadCSV={downloadCSV}
                sortBy={sortBy}
                sortDir={sortDir}
                handleSort={handleSort}
                sortedRows={sortedRows}
                highlight={highlight}
                tableRowRefs={tableRowRefs}
                COLORS={COLORS}
                LEGEND_LABELS={LEGEND_LABELS}
                TABLE_TONES={TABLE_TONES}
                thSx={thSx}
                tdSx={tdSx}
                navigate={navigate}
            />

        </Box>
    );
}
