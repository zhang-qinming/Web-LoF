import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Slider,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Download,
    FilterAlt,
    Insights,
    RestartAlt,
    Timeline,
} from '@mui/icons-material';
import { getCrossTraitTargets, getDataFileText, searchCrossTraits } from '../api/gwas';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementNearViewportCenter } from '../utils/scroll';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    controlFieldSx,
    metricChipTone,
    plotFrameSx,
    sectionTitleSx,
    statusToggleSx,
    summaryChipSx,
    toolbarSx,
} from '../themeUtils';
import FloatingLegend from './FloatingLegend';
import GeneLevelQQTable from './GeneLevelQQTable';

const DATA_DIR = 'gene_level_qq/tables';
const DEFAULT_EXPORT_WIDTH = 1280;
const DEFAULT_EXPORT_HEIGHT = 820;
const DEFAULT_POINT_SIZE = 5;
const DEFAULT_LABEL_LIMIT = 4;
const MAX_COMPARE_TRAITS = 6;
const NOMINAL_LOGP = -Math.log10(0.05);
const BASE_POINT_COLOR = '#c8d0dc';
const TRAIT_PALETTE = ['#356fbb', '#d96a3a', '#1f8a70', '#8d5fd3', '#b7791f', '#c44569'];

const TAIL_META = {
    negative: {
        label: 'Negative tail',
        color: '#356fbb',
        symbol: 'diamond',
    },
    positive: {
        label: 'Positive tail',
        color: '#d96a3a',
        symbol: 'circle',
    },
};

const TAIL_ORDER = ['negative', 'positive'];

const TAIL_MODES = {
    BOTH: 'both',
    POSITIVE: 'positive',
    NEGATIVE: 'negative',
};

function normalizeTraitOption(option) {
    if (!option) return null;
    const fileId = String(option.file_id || option.fileId || '').trim();
    const gwasId = String(option.gwas_id || option.gwasId || '').trim();
    const traitName = String(option.trait_name || option.traitName || '').trim();
    const id = fileId || gwasId;
    if (!id) return null;
    return {
        file_id: fileId || id,
        gwas_id: gwasId || id,
        trait_name: traitName || gwasId || fileId || id,
    };
}

function uniqueTraitOptions(items = []) {
    const seen = new Set();
    const list = [];
    items.forEach((item) => {
        const normalized = normalizeTraitOption(item);
        if (!normalized) return;
        if (seen.has(normalized.file_id)) return;
        seen.add(normalized.file_id);
        list.push(normalized);
    });
    return list;
}

function buildTraitStamp(selectedTraits = [], fallback = '') {
    const labels = selectedTraits
        .map((trait) => String(trait?.trait_name || trait?.gwas_id || trait?.file_id || '').trim())
        .filter(Boolean);
    if (!labels.length) return fallback;
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
    return `${labels[0]} + ${labels.length - 1} more`;
}

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

function getDataPath(fileId) {
    return `${DATA_DIR}/${encodeURIComponent(fileId)}.tsv`;
}

function parseTsv(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t');

    return lines.slice(1).map((line, index) => {
        const cells = line.split('\t');
        const raw = {};
        headers.forEach((header, i) => {
            raw[header] = cells[i] ?? '';
        });

        const tailSide = TAIL_META[raw.tail_side] ? raw.tail_side : (Number(raw.beta_withShet) >= 0 ? 'positive' : 'negative');
        const ensg = String(raw.ensg || '').trim();
        const gene = String(raw.gene || raw.GENE || '').trim() || ensg;
        const expected = toFiniteNumber(raw.expected);
        const observed = toFiniteNumber(raw.observed);
        const deviation = Number.isFinite(expected) && Number.isFinite(observed) ? observed - expected : null;
        const absDeviation = Number.isFinite(deviation) ? Math.abs(deviation) : null;
        const p = toFiniteNumber(raw.P_withShet);

        return {
            rowKey: `${ensg || gene || 'gene'}-${tailSide}-${index}`,
            raw,
            index,
            ensg,
            gene,
            tailSide,
            p,
            fdr: null,
            beta: toFiniteNumber(raw.beta_withShet),
            signedLogP: toFiniteNumber(raw.signed_log10_p),
            expected,
            observed,
            deviation,
            absDeviation,
            qqRank: toFiniteNumber(raw.qq_rank),
            traitId: String(raw.trait_id || '').trim(),
        };
    }).filter((row) => (
        Number.isFinite(row.expected)
        && Number.isFinite(row.observed)
        && TAIL_META[row.tailSide]
    ));
}

function addFdr(rows) {
    const indexed = rows
        .map((row, index) => ({ row, index, p: row.p }))
        .filter((item) => Number.isFinite(item.p) && item.p > 0)
        .sort((a, b) => a.p - b.p);

    const adjusted = new Array(rows.length).fill(null);
    let runningMin = Infinity;
    for (let i = indexed.length - 1; i >= 0; i -= 1) {
        const rank = i + 1;
        const q = Math.min(1, indexed[i].p * indexed.length / rank);
        runningMin = Math.min(runningMin, q);
        adjusted[indexed[i].index] = runningMin;
    }

    return rows.map((row, index) => ({ ...row, fdr: adjusted[index] }));
}

function computeAxisRange(rows) {
    const values = rows.flatMap((row) => [row.expected, row.observed]).filter(Number.isFinite);
    if (!values.length) return [-1, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
    const pad = span * 0.08;
    return [min - pad, max + pad];
}

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : 'NA';
}

function formatPValue(value) {
    return Number.isFinite(value) ? value.toExponential(2) : 'NA';
}

function buildHoverText(row) {
    return [
        `<b>${row.gene || row.ensg}</b>`,
        row.ensg ? `<span style="color:#64748b">${row.ensg}</span>` : '',
        row.sourceTraitName ? `<span style="color:#475569;font-weight:600">${row.sourceTraitName}</span>` : '',
        `<span style="color:${TAIL_META[row.tailSide].color};font-weight:600">${TAIL_META[row.tailSide].label}</span>`,
        '',
        `Expected: ${formatNumber(row.expected, 3)}`,
        `Observed: ${formatNumber(row.observed, 3)}`,
        `Observed - expected: ${formatNumber(row.deviation, 3)}`,
        `Rank: ${Number.isFinite(row.qqRank) ? row.qqRank : 'NA'}`,
        '',
        `P_withShet: ${formatPValue(row.p)}`,
        `FDR: ${formatPValue(row.fdr)}`,
        `beta_withShet: ${formatNumber(row.beta, 4)}`,
    ].filter(Boolean).join('<br>');
}

function pickSparseLabelRows(rows, limit, axisRange) {
    if (!Array.isArray(rows) || !rows.length || limit <= 0) return [];
    const xSpan = Math.max((axisRange?.[1] ?? 1) - (axisRange?.[0] ?? 0), 1);
    const ySpan = xSpan;
    const minDx = xSpan * 0.09;
    const minDy = ySpan * 0.075;
    const chosen = [];

    for (const row of rows) {
        const tooClose = chosen.some((picked) => (
            Math.abs((picked.expected ?? 0) - (row.expected ?? 0)) < minDx
            && Math.abs((picked.observed ?? 0) - (row.observed ?? 0)) < minDy
        ));
        if (tooClose) continue;
        chosen.push(row);
        if (chosen.length >= limit) break;
    }

    return chosen;
}

function hexToRgb(hex) {
    const normalized = String(hex || '').replace('#', '');
    if (normalized.length !== 6) return { r: 183, g: 192, b: 205 };
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function mixColors(baseHex, accentHex, ratio, alphaValue) {
    const base = hexToRgb(baseHex);
    const accent = hexToRgb(accentHex);
    const t = clamp(ratio, 0, 1);
    const r = Math.round(base.r + ((accent.r - base.r) * t));
    const g = Math.round(base.g + ((accent.g - base.g) * t));
    const b = Math.round(base.b + ((accent.b - base.b) * t));
    return `rgba(${r}, ${g}, ${b}, ${clamp(alphaValue, 0, 1)})`;
}

function normalQuantile(p) {
    // Acklam's inverse-normal approximation; sufficient for drawing a QQ envelope.
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const plow = 0.02425;
    const phigh = 1 - plow;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    let q;
    if (p < plow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= phigh) {
        q = p - 0.5;
        const r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
            / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
        / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function betaApproxQuantile(alpha, beta, probability) {
    const mean = alpha / (alpha + beta);
    const variance = (alpha * beta) / (((alpha + beta) ** 2) * (alpha + beta + 1));
    const sd = Math.sqrt(Math.max(variance, 0));
    return clamp(mean + normalQuantile(probability) * sd, Number.MIN_VALUE, 1 - Number.EPSILON);
}

function buildEnvelope(rows) {
    const byTail = new Map();
    rows.forEach((row) => {
        if (!byTail.has(row.tailSide)) byTail.set(row.tailSide, []);
        byTail.get(row.tailSide).push(row);
    });

    const traces = [];
    for (const [tailSide, tailRows] of byTail.entries()) {
        const sorted = [...tailRows].sort((a, b) => Math.abs(b.expected) - Math.abs(a.expected));
        const n = sorted.length;
        if (n < 10) continue;

        const x = [];
        const upper = [];
        const lower = [];
        sorted.forEach((row, index) => {
            const rank = index + 1;
            const sign = tailSide === 'negative' ? -1 : 1;
            const loP = betaApproxQuantile(rank, n + 1 - rank, 0.025);
            const hiP = betaApproxQuantile(rank, n + 1 - rank, 0.975);
            const lo = sign * -Math.log10(hiP);
            const hi = sign * -Math.log10(loP);
            x.push(row.expected);
            lower.push(Math.min(lo, hi));
            upper.push(Math.max(lo, hi));
        });

        traces.push({
            type: 'scatter',
            mode: 'lines',
            name: `${TAIL_META[tailSide].label} envelope`,
            x,
            y: upper,
            line: { color: TAIL_META[tailSide].color, width: 0 },
            hoverinfo: 'skip',
            showlegend: false,
        });
        traces.push({
            type: 'scatter',
            mode: 'lines',
            name: `${TAIL_META[tailSide].label} envelope`,
            x,
            y: lower,
            fill: 'tonexty',
            fillcolor: alpha(TAIL_META[tailSide].color, 0.1),
            line: { color: TAIL_META[tailSide].color, width: 0 },
            hoverinfo: 'skip',
            showlegend: false,
        });
    }
    return traces;
}

export default function GeneLevelQQ({ fileId, gwasId, traitLabel, lookupIds = [] }) {
    const theme = useTheme();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const plotRef = useRef(null);
    const plotElRef = useRef(null);
    const tableRowRefs = useRef({});
    const tableSectionRef = useRef(null);

    const [payload, setPayload] = useState({ rows: [], fileId: '', path: '', selectedTraits: [], availableTraits: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tailMode, setTailMode] = useState(TAIL_MODES.BOTH);
    const [geneQuery, setGeneQuery] = useState('');
    const [showExpectedLine, setShowExpectedLine] = useState(true);
    const [showNominalLine, setShowNominalLine] = useState(false);
    const [showFdrLine, setShowFdrLine] = useState(true);
    const [showEnvelope, setShowEnvelope] = useState(false);
    const [showTopLabels, setShowTopLabels] = useState(true);
    const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE);
    const [labelLimit, setLabelLimit] = useState(DEFAULT_LABEL_LIMIT);
    const [tableOpen, setTableOpen] = useState(false);
    const [sortBy, setSortBy] = useState('absDeviation');
    const [sortDir, setSortDir] = useState('desc');
    const [highlight, setHighlight] = useState({ rowKey: '', key: 0 });
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(50);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');
    const [legendCollapsed, setLegendCollapsed] = useState(false);
    const [showTraitStamp, setShowTraitStamp] = useState(true);
    const [traitStampText, setTraitStampText] = useState('');
    const [availableTraits, setAvailableTraits] = useState([]);
    const [selectedTraits, setSelectedTraits] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [searchOptions, setSearchOptions] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    const primaryTrait = useMemo(() => normalizeTraitOption({
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitLabel || gwasId || fileId,
    }), [fileId, gwasId, traitLabel]);

    useEffect(() => {
        if (!primaryTrait) return;
        setSelectedTraits((prev) => {
            const preserved = uniqueTraitOptions([primaryTrait, ...prev.filter((item) => item.file_id !== primaryTrait.file_id)]);
            return preserved.slice(0, MAX_COMPARE_TRAITS);
        });
    }, [primaryTrait]);

    useEffect(() => {
        setTraitStampText(buildTraitStamp(selectedTraits, String(traitLabel || gwasId || fileId || '').trim()));
    }, [fileId, gwasId, selectedTraits, traitLabel]);

    const candidateIds = useMemo(() => (
        [...new Set([...(lookupIds || []), fileId, gwasId].filter(Boolean))]
    ), [fileId, gwasId, lookupIds]);

    useEffect(() => {
        if (!primaryTrait?.file_id) {
            setAvailableTraits([]);
            return undefined;
        }
        let cancelled = false;
        getCrossTraitTargets(primaryTrait.file_id)
            .then((res) => {
                if (cancelled) return;
                const next = uniqueTraitOptions([primaryTrait, ...(res?.targets || [])]);
                setAvailableTraits(next);
            })
            .catch(() => {
                if (!cancelled) setAvailableTraits(primaryTrait ? [primaryTrait] : []);
            });
        return () => {
            cancelled = true;
        };
    }, [primaryTrait]);

    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed.length < 2) {
            setSearchOptions([]);
            return undefined;
        }
        let cancelled = false;
        setSearchLoading(true);
        const timeoutId = window.setTimeout(() => {
            searchCrossTraits(trimmed, {
                limit: 12,
                excludeId: [
                    ...selectedTraits.map((item) => item.file_id),
                    ...candidateIds,
                ],
            }).then((res) => {
                if (!cancelled) setSearchOptions(uniqueTraitOptions(res?.traits || []));
            }).catch(() => {
                if (!cancelled) setSearchOptions([]);
            }).finally(() => {
                if (!cancelled) setSearchLoading(false);
            });
        }, 220);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [candidateIds, searchInput, selectedTraits]);

    useEffect(() => {
        if (!selectedTraits.length && !candidateIds.length) {
            setPayload({ rows: [], fileId: '', path: '', selectedTraits: [], availableTraits });
            return undefined;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        (async () => {
            const chosenTraits = uniqueTraitOptions([
                ...selectedTraits,
                ...(selectedTraits.length ? [] : (primaryTrait ? [primaryTrait] : [])),
            ]).slice(0, MAX_COMPARE_TRAITS);
            const loadedTraits = [];
            let lastError = null;

            for (let traitIndex = 0; traitIndex < chosenTraits.length; traitIndex += 1) {
                const trait = chosenTraits[traitIndex];
                const loadCandidates = [...new Set([
                    trait.file_id,
                    trait.gwas_id,
                    ...(trait.file_id === primaryTrait?.file_id ? candidateIds : []),
                ].filter(Boolean))];

                for (const candidate of loadCandidates) {
                    const path = getDataPath(candidate);
                    try {
                        const text = await getDataFileText(path);
                        const parsedRows = addFdr(parseTsv(text)).map((row) => ({
                            ...row,
                            rowKey: `${trait.file_id}::${row.rowKey}`,
                            sourceFileId: trait.file_id,
                            sourceGwasId: trait.gwas_id,
                            sourceTraitName: trait.trait_name,
                            traitIndex,
                        }));
                        loadedTraits.push({
                            ...trait,
                            resolved_file_id: candidate,
                            path,
                            rows: parsedRows,
                        });
                        break;
                    } catch (err) {
                        lastError = err;
                    }
                }
            }

            const mergedRows = loadedTraits.flatMap((item) => item.rows);
            if (!cancelled) {
                setPayload({
                    rows: mergedRows,
                    fileId: loadedTraits[0]?.resolved_file_id || chosenTraits[0]?.file_id || candidateIds[0] || '',
                    path: loadedTraits[0]?.path || '',
                    selectedTraits: loadedTraits.map((item) => {
                        const { rows, ...rest } = item;
                        void rows;
                        return rest;
                    }),
                    availableTraits,
                });
                setHighlight({ rowKey: '', key: 0 });
                setTablePage(0);
                if (!mergedRows.length && lastError) {
                    setError(lastError);
                }
            }
        })().finally(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [availableTraits, candidateIds, primaryTrait, selectedTraits]);

    const rows = payload.rows;

    const filteredRows = useMemo(() => {
        const query = geneQuery.trim().toLowerCase();
        return rows.filter((row) => {
            if (tailMode === TAIL_MODES.POSITIVE && row.tailSide !== 'positive') return false;
            if (tailMode === TAIL_MODES.NEGATIVE && row.tailSide !== 'negative') return false;
            if (query && !`${row.gene} ${row.ensg}`.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [geneQuery, rows, tailMode]);

    const counts = useMemo(() => {
        const base = {
            total: rows.length,
            filtered: filteredRows.length,
            positive: 0,
            negative: 0,
            fdr: 0,
            maxDeviation: 0,
        };
        rows.forEach((row) => {
            if (row.tailSide === 'positive') base.positive += 1;
            if (row.tailSide === 'negative') base.negative += 1;
            if (Number.isFinite(row.absDeviation)) base.maxDeviation = Math.max(base.maxDeviation, row.absDeviation);
        });
        filteredRows.forEach((row) => {
            if (Number.isFinite(row.fdr) && row.fdr <= 0.05) base.fdr += 1;
        });
        return base;
    }, [filteredRows, rows]);

    const activeTraits = useMemo(() => (
        payload.selectedTraits?.length ? payload.selectedTraits : selectedTraits
    ), [payload.selectedTraits, selectedTraits]);

    const traitColorMap = useMemo(() => {
        const map = new Map();
        activeTraits.forEach((trait, index) => {
            map.set(trait.file_id, TRAIT_PALETTE[index % TRAIT_PALETTE.length]);
        });
        return map;
    }, [activeTraits]);

    const groupedTraitOptions = useMemo(() => {
        const availableIds = new Set(availableTraits.map((item) => item.file_id));
        return uniqueTraitOptions([
            ...availableTraits.map((item) => ({ ...item, group: item.file_id === primaryTrait?.file_id ? 'Current' : 'Related' })),
            ...searchOptions
                .filter((item) => !availableIds.has(item.file_id))
                .map((item) => ({ ...item, group: 'Search' })),
        ]);
    }, [availableTraits, primaryTrait, searchOptions]);

    const fdrGuide = useMemo(() => {
        const sig = filteredRows.filter((row) => Number.isFinite(row.fdr) && row.fdr <= 0.05 && Number.isFinite(row.p) && row.p > 0);
        if (!sig.length) return null;
        return -Math.log10(Math.max(...sig.map((row) => row.p)));
    }, [filteredRows]);

    const axisRange = useMemo(() => computeAxisRange(filteredRows), [filteredRows]);

    const labelRows = useMemo(() => {
        if (!showTopLabels || labelLimit <= 0) return [];
        const ranked = [...filteredRows]
            .sort((a, b) => (b.absDeviation || -Infinity) - (a.absDeviation || -Infinity));
        return pickSparseLabelRows(ranked, labelLimit, axisRange);
    }, [axisRange, filteredRows, labelLimit, showTopLabels]);

    const axisStyle = useMemo(() => ({
        zeroline: false,
        showgrid: true,
        gridwidth: 0.5,
        gridcolor: chartTokens.gridColor,
        showline: true,
        linewidth: 1,
        linecolor: chartTokens.axisSoft,
        ticks: 'inside',
        tickfont: { size: 13, color: chartTokens.axisColor, family: theme.typography.fontFamily },
    }), [chartTokens, theme.typography.fontFamily]);

    const envelopeTraces = useMemo(() => (
        showEnvelope ? buildEnvelope(filteredRows) : []
    ), [filteredRows, showEnvelope]);

    const pointTraces = useMemo(() => {
        const grouped = new Map();
        let deviationCap = 0.8;

        filteredRows.forEach((row) => {
            if (Number.isFinite(row.absDeviation)) {
                deviationCap = Math.max(deviationCap, row.absDeviation);
            }
        });

        filteredRows.forEach((row) => {
            const groupKey = `${row.sourceFileId || payload.fileId || 'trait'}::${row.tailSide}`;
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, {
                    traitId: row.sourceFileId || payload.fileId || 'trait',
                    traitName: row.sourceTraitName || traitLabel || row.sourceFileId || payload.fileId || 'Trait',
                    tailSide: row.tailSide,
                    x: [],
                    y: [],
                    text: [],
                    customdata: [],
                    sizes: [],
                    colors: [],
                    opacity: [],
                });
            }
            const group = grouped.get(groupKey);
            const normalizedDeviation = clamp((row.absDeviation || 0) / deviationCap, 0, 1);
            const intensity = normalizedDeviation ** 0.72;
            const deviationScale = intensity * 1.6;
            const traitColor = traitColorMap.get(row.sourceFileId) || TAIL_META[row.tailSide].color;
            group.x.push(row.expected);
            group.y.push(row.observed);
            group.text.push(buildHoverText(row));
            group.customdata.push([row.rowKey]);
            group.sizes.push(pointSize + deviationScale);
            group.colors.push(mixColors(BASE_POINT_COLOR, traitColor, 0.5 + (intensity * 0.5), 0.62 + (intensity * 0.3)));
            group.opacity.push(1);
        });

        return [...grouped.values()].map((group) => ({
                type: 'scattergl',
                mode: 'markers',
                name: `${group.traitName} · ${TAIL_META[group.tailSide].label}`,
                x: group.x,
                y: group.y,
                text: group.text,
                customdata: group.customdata,
                hovertemplate: '%{text}<extra></extra>',
                hoverlabel: buildPlotHoverTone(theme, traitColorMap.get(group.traitId) || TAIL_META[group.tailSide].color, {
                    bgAlpha: 0.16,
                    borderAlpha: 0.36,
                }),
                marker: {
                    color: group.colors,
                    symbol: TAIL_META[group.tailSide].symbol,
                    size: group.sizes,
                    opacity: group.opacity,
                    line: {
                        color: 'rgba(255,255,255,0)',
                        width: 0,
                    },
                },
            }));
    }, [filteredRows, payload.fileId, pointSize, theme, traitColorMap, traitLabel]);

    const labelTrace = useMemo(() => {
        if (!labelRows.length) return [];
        return [{
            type: 'scatter',
            mode: 'text',
            name: 'Top labels',
            showlegend: false,
            x: labelRows.map((row) => row.expected),
            y: labelRows.map((row) => row.observed),
            text: labelRows.map((row) => row.gene || row.ensg),
            textposition: labelRows.map((row, index) => {
                if (row.observed >= row.expected) return index % 2 === 0 ? 'top left' : 'top right';
                return index % 2 === 0 ? 'bottom left' : 'bottom right';
            }),
            textfont: {
                size: 10,
                color: labelRows.map((row) => traitColorMap.get(row.sourceFileId) || TAIL_META[row.tailSide].color),
                family: theme.typography.fontFamily,
            },
            hoverinfo: 'skip',
        }];
    }, [labelRows, theme.typography.fontFamily, traitColorMap]);

    const highlightedPoint = useMemo(() => {
        if (!highlight.rowKey) return [];
        const row = rows.find((item) => item.rowKey === highlight.rowKey);
        if (!row) return [];
        return [{
            type: 'scatter',
            mode: 'markers',
            name: 'Selected gene',
            showlegend: false,
            x: [row.expected],
            y: [row.observed],
            hoverinfo: 'skip',
            marker: {
                size: pointSize + 12,
                color: 'rgba(255,255,255,0)',
                line: { color: '#111827', width: 2.4 },
                symbol: 'circle',
            },
        }];
    }, [highlight.rowKey, pointSize, rows]);

    const legendItems = useMemo(() => {
        const traitItems = activeTraits
            .filter((trait) => filteredRows.some((row) => row.sourceFileId === trait.file_id))
            .map((trait) => ({
                key: trait.file_id,
                label: trait.trait_name,
                note: trait.gwas_id && trait.gwas_id !== trait.trait_name ? trait.gwas_id : '',
                color: traitColorMap.get(trait.file_id) || TRAIT_PALETTE[0],
                count: filteredRows.filter((row) => row.sourceFileId === trait.file_id).length,
            }));

        if (showEnvelope) {
            traitItems.push({
                key: 'envelope',
                label: '95% envelope',
                note: 'Tail shape uses marker symbol; envelope is computed from visible rows.',
                color: alpha(theme.palette.text.secondary, 0.68),
                count: filteredRows.length,
            });
        }

        return traitItems;
    }, [activeTraits, filteredRows, showEnvelope, theme.palette.text.secondary, traitColorMap]);

    const layout = useMemo(() => {
        const shapes = [];
        const annotations = [];

        if (showTraitStamp && traitStampText.trim()) {
            annotations.push({
                xref: 'paper',
                yref: 'paper',
                x: 0.016,
                y: 0.985,
                xanchor: 'left',
                yanchor: 'top',
                showarrow: false,
                text: `<b>${traitStampText.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>`,
                font: { size: 11, color: theme.palette.text.primary, family: theme.typography.fontFamily },
                bgcolor: alpha(theme.palette.background.paper, 0.94),
                bordercolor: theme.custom.border.strong,
                borderpad: 5,
            });
        }

        if (showExpectedLine) {
            shapes.push({
                type: 'line',
                x0: axisRange[0],
                y0: axisRange[0],
                x1: axisRange[1],
                y1: axisRange[1],
                line: { color: chartTokens.axisSoft, width: 1.2, dash: 'dash' },
            });
            annotations.push({
                xref: 'paper',
                yref: 'paper',
                x: 0.98,
                y: 0.97,
                xanchor: 'right',
                yanchor: 'top',
                showarrow: false,
                text: '<b>expected line</b>',
                font: { size: 11, color: chartTokens.axisColor, family: theme.typography.fontFamily },
            });
        }

        if (showNominalLine) {
            shapes.push(
                {
                    type: 'line',
                    x0: axisRange[0],
                    x1: axisRange[1],
                    y0: NOMINAL_LOGP,
                    y1: NOMINAL_LOGP,
                    line: { color: chartTokens.threshold, width: 1, dash: 'dot' },
                },
                {
                    type: 'line',
                    x0: axisRange[0],
                    x1: axisRange[1],
                    y0: -NOMINAL_LOGP,
                    y1: -NOMINAL_LOGP,
                    line: { color: chartTokens.threshold, width: 1, dash: 'dot' },
                },
            );
        }

        if (showFdrLine && Number.isFinite(fdrGuide)) {
            shapes.push(
                {
                    type: 'line',
                    x0: axisRange[0],
                    x1: axisRange[1],
                    y0: fdrGuide,
                    y1: fdrGuide,
                    line: { color: chartTokens.threshold, width: 1.1, dash: 'dot' },
                },
                {
                    type: 'line',
                    x0: axisRange[0],
                    x1: axisRange[1],
                    y0: -fdrGuide,
                    y1: -fdrGuide,
                    line: { color: chartTokens.threshold, width: 1.1, dash: 'dot' },
                },
            );
            annotations.push({
                xref: 'paper',
                yref: 'y',
                x: 1,
                y: fdrGuide,
                xanchor: 'right',
                yanchor: 'bottom',
                showarrow: false,
                text: '<b>FDR 0.05</b>',
                font: { size: 11, color: chartTokens.threshold, family: theme.typography.fontFamily },
            });
        }

        return {
            title: {
                text: 'Gene-level QQ',
                font: { size: 18, color: theme.palette.text.primary, family: theme.typography.fontFamily },
                x: 0.02,
                xanchor: 'left',
            },
            paper_bgcolor: chartTokens.paperBg,
            plot_bgcolor: chartTokens.plotBg,
            margin: { l: 76, r: 28, t: 92, b: 70 },
            hovermode: 'closest',
            dragmode: 'pan',
            showlegend: false,
            xaxis: {
                ...axisStyle,
                title: { text: 'Expected signed -log10(P)', font: { size: 14, color: theme.palette.text.primary } },
                range: axisRange,
                fixedrange: false,
            },
            yaxis: {
                ...axisStyle,
                title: { text: 'Observed signed -log10(P)', font: { size: 14, color: theme.palette.text.primary } },
                range: axisRange,
                fixedrange: false,
            },
            shapes,
            annotations,
            transition: { duration: 220, easing: 'cubic-in-out' },
        };
    }, [axisRange, axisStyle, chartTokens, fdrGuide, showExpectedLine, showFdrLine, showNominalLine, showTraitStamp, theme, traitStampText]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        scrollZoom: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        modeBarButtonsToAdd: [{
            name: 'download',
            title: 'Download plot',
            icon: Plotly.Icons.disk,
            click: () => setExportOpen(true),
        }],
    }), []);

    const sortedRows = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        return [...filteredRows].sort((a, b) => {
            if (['gene', 'ensg', 'tailSide'].includes(sortBy)) {
                return collator.compare(String(a[sortBy] || ''), String(b[sortBy] || '')) * dir;
            }
            const av = a[sortBy] ?? -Infinity;
            const bv = b[sortBy] ?? -Infinity;
            if (av === bv) return 0;
            return av > bv ? dir : -dir;
        });
    }, [filteredRows, sortBy, sortDir]);

    const pagedRows = useMemo(() => {
        const start = tablePage * tableRowsPerPage;
        return sortedRows.slice(start, start + tableRowsPerPage);
    }, [sortedRows, tablePage, tableRowsPerPage]);

    useEffect(() => {
        const maxPage = Math.max(0, Math.ceil(sortedRows.length / tableRowsPerPage) - 1);
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [sortedRows.length, tablePage, tableRowsPerPage]);

    useEffect(() => {
        if (!highlight.rowKey || !tableOpen) return undefined;
        const rowIndex = sortedRows.findIndex((item) => item.rowKey === highlight.rowKey);
        if (rowIndex < 0) return undefined;
        const nextPage = Math.floor(rowIndex / tableRowsPerPage);
        if (nextPage !== tablePage) {
            setTablePage(nextPage);
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            scrollElementNearViewportCenter(tableSectionRef.current, { viewportOffset: 0.08 });
            const el = tableRowRefs.current[highlight.rowKey];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);
        return () => window.clearTimeout(timeoutId);
    }, [highlight, sortedRows, tableOpen, tablePage, tableRowsPerPage]);

    const handleSort = useCallback((column) => {
        if (column === sortBy) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(column);
        setSortDir(['gene', 'ensg', 'tailSide'].includes(column) ? 'asc' : 'desc');
    }, [sortBy]);

    const resetControls = useCallback(() => {
        setTailMode(TAIL_MODES.BOTH);
        setGeneQuery('');
        setShowExpectedLine(true);
        setShowNominalLine(false);
        setShowFdrLine(true);
        setShowEnvelope(false);
        setShowTopLabels(true);
        setShowTraitStamp(true);
        setSelectedTraits(primaryTrait ? [primaryTrait] : []);
        setTraitStampText(buildTraitStamp(primaryTrait ? [primaryTrait] : [], String(traitLabel || gwasId || fileId || '').trim()));
        setPointSize(DEFAULT_POINT_SIZE);
        setLabelLimit(DEFAULT_LABEL_LIMIT);
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    }, [fileId, gwasId, primaryTrait, traitLabel]);

    const handleExport = useCallback(() => {
        const gd = plotRef.current;
        if (!gd) return;
        const width = normalizeExportSize(exportWidth, DEFAULT_EXPORT_WIDTH);
        const height = normalizeExportSize(exportHeight, DEFAULT_EXPORT_HEIGHT);
        Plotly.toImage(gd, { format: exportFmt, width, height }).then((dataUrl) => {
            downloadDataUrl(dataUrl, `${sanitizeFileNamePart(payload.fileId || fileId)}-gene-level-qq.${exportFmt}`);
        });
    }, [exportFmt, exportHeight, exportWidth, fileId, payload.fileId]);

    const downloadCSV = useCallback(() => {
        const cols = ['gene', 'ensg', 'tail_side', 'expected', 'observed', 'deviation', 'P_withShet', 'FDR', 'beta_withShet', 'qq_rank'];
        const header = cols.join(',');
        const body = rows.map((row) => [
            row.gene,
            row.ensg,
            row.tailSide,
            row.expected ?? '',
            row.observed ?? '',
            row.deviation ?? '',
            row.p ?? '',
            row.fdr ?? '',
            row.beta ?? '',
            row.qqRank ?? '',
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `${sanitizeFileNamePart(payload.fileId || fileId)}-gene-level-qq.csv`);
    }, [fileId, payload.fileId, rows]);

    const plotRevision = useMemo(() => JSON.stringify({
        rows: filteredRows.length,
        traits: activeTraits.map((trait) => trait.file_id).join('|'),
        tailMode,
        query: geneQuery,
        lines: [showExpectedLine, showNominalLine, showFdrLine, showEnvelope, showTopLabels].join('-'),
        pointSize,
        labelLimit,
        highlight: highlight.key,
    }), [activeTraits, filteredRows.length, geneQuery, highlight.key, labelLimit, pointSize, showEnvelope, showExpectedLine, showFdrLine, showNominalLine, showTopLabels, tailMode]);

    const plotKey = useMemo(() => [
        payload.fileId || fileId || 'qq',
        activeTraits.map((trait) => trait.file_id).join('+'),
        tailMode,
        geneQuery.trim().toLowerCase(),
        showEnvelope ? 'envelope' : 'no-envelope',
        showTopLabels ? `labels-${labelLimit}` : 'no-labels',
    ].join('|'), [activeTraits, fileId, geneQuery, labelLimit, payload.fileId, showEnvelope, showTopLabels, tailMode]);

    const hasVisiblePoints = pointTraces.some((trace) => Array.isArray(trace.x) && trace.x.length > 0);

    if (error && !isLoading && rows.length === 0) {
        return (
            <Alert severity="info" sx={{ m: 2 }}>
                Gene-level QQ TSV is not available for this trait yet.
            </Alert>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={toolbarSx(theme)}>
                <Box sx={{ minWidth: 270, mr: 0.5 }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.palette.text.secondary, mb: 0.35 }}>
                        Gene-level QQ
                    </Typography>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                        Signed deviation from expectation
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        Signed QQ plot of perturb-seq gene-level P values. Add multiple traits to overlay them in one frame; color encodes trait, marker shape still separates positive and negative tails.
                    </Typography>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={tailMode}
                    onChange={(_, value) => { if (value) setTailMode(value); }}
                    sx={statusToggleSx(theme)}
                >
                    <ToggleButton value={TAIL_MODES.BOTH}>Both tails</ToggleButton>
                    <ToggleButton value={TAIL_MODES.POSITIVE}>Positive</ToggleButton>
                    <ToggleButton value={TAIL_MODES.NEGATIVE}>Negative</ToggleButton>
                </ToggleButtonGroup>

                <TextField
                    size="small"
                    label="Gene"
                    value={geneQuery}
                    onChange={(event) => {
                        setGeneQuery(event.target.value);
                        setTablePage(0);
                    }}
                    sx={controlFieldSx(theme, { width: 180 })}
                />

                <Chip icon={<Timeline />} label={`${counts.filtered.toLocaleString()} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                <Chip icon={<FilterAlt />} label={`${activeTraits.length.toLocaleString()} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                <Chip icon={<Insights />} label={`${counts.fdr.toLocaleString()} FDR hits`} size="small" sx={summaryChipSx(theme, { backgroundColor: alpha(chartTokens.threshold, 0.08), color: chartTokens.threshold, border: `1px solid ${alpha(chartTokens.threshold, 0.22)}` })} />
                <Chip icon={<FilterAlt />} label={`${counts.positive.toLocaleString()} positive`} size="small" sx={summaryChipSx(theme, { backgroundColor: alpha(TAIL_META.positive.color, 0.08), color: TAIL_META.positive.color, border: `1px solid ${alpha(TAIL_META.positive.color, 0.2)}` })} />
                <Chip icon={<FilterAlt />} label={`${counts.negative.toLocaleString()} negative`} size="small" sx={summaryChipSx(theme, { backgroundColor: alpha(TAIL_META.negative.color, 0.08), color: TAIL_META.negative.color, border: `1px solid ${alpha(TAIL_META.negative.color, 0.2)}` })} />
            </Box>

            <Box sx={toolbarSx(theme)}>
                <Autocomplete
                    multiple
                    size="small"
                    options={groupedTraitOptions}
                    loading={searchLoading}
                    value={activeTraits}
                    groupBy={(option) => option.group || 'Traits'}
                    isOptionEqualToValue={(option, value) => option.file_id === value.file_id}
                    getOptionLabel={(option) => option.trait_name || option.gwas_id || option.file_id}
                    onChange={(_, value) => setSelectedTraits(uniqueTraitOptions(value).slice(0, MAX_COMPARE_TRAITS))}
                    onInputChange={(_, value) => setSearchInput(value)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Compare traits"
                            placeholder="Search traits"
                            helperText="Overlay up to 6 traits in the same QQ frame."
                        />
                    )}
                    sx={{ minWidth: 360, maxWidth: 720, flex: 1 }}
                />

                <Stack direction="row" spacing={0.4} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControlLabel control={<Checkbox checked={showExpectedLine} onChange={(event) => setShowExpectedLine(event.target.checked)} size="small" />} label="Expected line" />
                    <FormControlLabel control={<Checkbox checked={showFdrLine} onChange={(event) => setShowFdrLine(event.target.checked)} size="small" />} label="FDR guide" />
                    <FormControlLabel control={<Checkbox checked={showNominalLine} onChange={(event) => setShowNominalLine(event.target.checked)} size="small" />} label="P=0.05" />
                    <FormControlLabel control={<Checkbox checked={showEnvelope} onChange={(event) => setShowEnvelope(event.target.checked)} size="small" />} label="Envelope" />
                    <FormControlLabel control={<Checkbox checked={showTopLabels} onChange={(event) => setShowTopLabels(event.target.checked)} size="small" />} label="Top labels" />
                    <FormControlLabel control={<Checkbox checked={showTraitStamp} onChange={(event) => setShowTraitStamp(event.target.checked)} size="small" />} label="Trait stamp" />
                </Stack>

                <TextField
                    size="small"
                    label="Trait stamp"
                    value={traitStampText}
                    onChange={(event) => setTraitStampText(event.target.value)}
                    disabled={!showTraitStamp}
                    sx={controlFieldSx(theme, { width: 260 })}
                />

                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 240 }}>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Point
                    </Typography>
                    <Slider
                        value={pointSize}
                        min={3}
                        max={14}
                        step={1}
                        onChange={(_, value) => setPointSize(Number(value))}
                        sx={{ width: 108, color: theme.palette.primary.main, '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.25 } }}
                    />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, minWidth: 20 }}>{pointSize}</Typography>
                </Stack>

                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 240 }}>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Labels
                    </Typography>
                    <Slider
                        value={labelLimit}
                        min={0}
                        max={30}
                        step={1}
                        onChange={(_, value) => setLabelLimit(Number(value))}
                        disabled={!showTopLabels}
                        sx={{ width: 108, color: theme.palette.text.secondary, '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.25 } }}
                    />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, minWidth: 24 }}>{labelLimit}</Typography>
                </Stack>

                <Button variant="text" startIcon={<RestartAlt />} onClick={resetControls} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38 }}>
                    Reset
                </Button>
                <Button variant="text" startIcon={<Download />} onClick={downloadCSV} disabled={!rows.length} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38 }}>
                    CSV
                </Button>
                <Typography sx={{ width: '100%', fontSize: '0.74rem', color: theme.palette.text.secondary, lineHeight: 1.4 }}>
                    The trait stamp is written into the plot itself, so exported images can carry your current comparison set. Color encodes trait identity; marker shape still indicates positive vs negative tail.
                </Typography>
            </Box>

            <Card elevation={0} sx={plotFrameSx(theme)}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {isLoading && (
                        <Box sx={{ minHeight: 640, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Loading gene-level QQ TSV...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!isLoading && rows.length === 0 && (
                        <Box sx={{ minHeight: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No gene-level QQ rows are available for this trait.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && rows.length > 0 && !hasVisiblePoints && (
                        <Box sx={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No genes match the current QQ filters.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && hasVisiblePoints && (
                        <>
                            <Plot
                                key={plotKey}
                                data={[...envelopeTraces, ...pointTraces, ...labelTrace, ...highlightedPoint]}
                                layout={layout}
                                config={plotConfig}
                                revision={plotRevision}
                                onInitialized={(_figure, graphDiv) => {
                                    plotRef.current = graphDiv;
                                    plotElRef.current = graphDiv;
                                }}
                                onUpdate={(_figure, graphDiv) => {
                                    plotRef.current = graphDiv;
                                    plotElRef.current = graphDiv;
                                }}
                                onClick={(evt) => {
                                    const rowKey = evt?.points?.[0]?.customdata?.[0];
                                    if (!rowKey) return;
                                    setHighlight((prev) => ({ rowKey, key: prev.key + 1 }));
                                    setTableOpen(true);
                                }}
                                useResizeHandler
                                style={{ width: '100%', height: '640px' }}
                            />
                            <FloatingLegend
                                items={legendItems}
                                collapsed={legendCollapsed}
                                onToggleCollapsed={() => setLegendCollapsed((prev) => !prev)}
                                title="Traits"
                                width={{ expanded: 236, collapsed: 118 }}
                                defaultPlacement="right"
                                defaultTop={68}
                                defaultSideOffset={10}
                                anchorPlotRef={plotElRef}
                                showScale={false}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            <GeneLevelQQTable
                tableSectionRef={tableSectionRef}
                rows={rows}
                sortedRows={sortedRows}
                pagedRows={pagedRows}
                tableOpen={tableOpen}
                setTableOpen={setTableOpen}
                tablePage={tablePage}
                setTablePage={setTablePage}
                tableRowsPerPage={tableRowsPerPage}
                setTableRowsPerPage={setTableRowsPerPage}
                sortBy={sortBy}
                sortDir={sortDir}
                handleSort={handleSort}
                downloadCSV={downloadCSV}
                highlight={highlight}
                tableRowRefs={tableRowRefs}
            />

            <Dialog open={exportOpen} onClose={() => setExportOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700, color: theme.palette.text.primary }}>Export Plot</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        <TextField label="Width" type="number" size="small" value={exportWidth} onChange={(event) => setExportWidth(event.target.value)} sx={controlFieldSx(theme)} />
                        <TextField label="Height" type="number" size="small" value={exportHeight} onChange={(event) => setExportHeight(event.target.value)} sx={controlFieldSx(theme)} />
                    </Stack>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={exportFmt}
                        onChange={(_, value) => { if (value) setExportFmt(value); }}
                        sx={statusToggleSx(theme, { '& .MuiToggleButton-root': { textTransform: 'none', px: 2.5 } })}
                    >
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setExportOpen(false)} sx={{ textTransform: 'none', color: theme.palette.text.secondary }}>Cancel</Button>
                    <Button variant="contained" onClick={() => { handleExport(); setExportOpen(false); }} sx={{ textTransform: 'none' }}>Export</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
