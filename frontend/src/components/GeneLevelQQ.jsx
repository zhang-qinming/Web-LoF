import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Plot, { Plotly } from '../lib/plotly';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import Download from '@mui/icons-material/Download';
import FilterAlt from '@mui/icons-material/FilterAlt';
import Insights from '@mui/icons-material/Insights';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Timeline from '@mui/icons-material/Timeline';
import useSWR from 'swr';
import { getCrossTraitTargets, getDataFileText } from '../api/gwas';
import { UpdatingStatus } from './PageScaffold';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementNearViewportCenter } from '../utils/scroll';
import { detailSummarySWRConfig, figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    controlFieldSx,
    metricChipTone,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_TALL_PLOT_HEIGHT,
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
const DEFAULT_POINT_SIZE = 7;
const DEFAULT_LABEL_LIMIT = 4;
const DEFAULT_COMPARE_TRAITS = 1;
const MAX_COMPARE_TRAITS = 12;
const GENE_QQ_PLOT_HEIGHT = RESPONSIVE_TALL_PLOT_HEIGHT;
const MAX_ENVELOPE_POINTS = 360;
const NOMINAL_LOGP = -Math.log10(0.05);
const BASE_POINT_COLOR = '#53677f';
const TRAIT_PALETTE = ['#155e9f', '#c45121', '#047857', '#6d4cc2', '#9a5b12', '#b42358'];

const TAIL_META = {
    negative: {
        label: 'Negative tail',
        color: '#1b6f9f',
        symbol: 'diamond',
    },
    positive: {
        label: 'Positive tail',
        color: '#c65d2e',
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
        trait_name: traitName || fileId || gwasId || id,
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

function traitListKey(items = []) {
    return items.map((item) => item?.file_id || '').filter(Boolean).join('|');
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

async function loadGeneLevelQQPayload({ appliedTraits, availableTraits, candidateIds, primaryTrait }) {
    const chosenTraits = uniqueTraitOptions(appliedTraits).slice(0, MAX_COMPARE_TRAITS);
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
    if (!mergedRows.length && lastError) throw lastError;

    return {
        rows: mergedRows,
        fileId: loadedTraits[0]?.resolved_file_id || chosenTraits[0]?.file_id || candidateIds[0] || '',
        path: loadedTraits[0]?.path || '',
        selectedTraits: loadedTraits.map((item) => {
            const { rows, ...rest } = item;
            void rows;
            return rest;
        }),
        availableTraits,
    };
}

function computeAxisRange(rows, extraValues = []) {
    const values = [
        ...rows.flatMap((row) => [row.expected, row.observed]),
        ...extraValues,
    ].filter(Number.isFinite);
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

function logGamma(value) {
    const coeffs = [
        676.5203681218851,
        -1259.1392167224028,
        771.3234287776531,
        -176.6150291621406,
        12.507343278686905,
        -0.13857109526572012,
        9.984369578019572e-6,
        1.5056327351493116e-7,
    ];
    if (value < 0.5) {
        return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
    }
    let x = 0.9999999999998099;
    const z = value - 1;
    coeffs.forEach((coeff, index) => {
        x += coeff / (z + index + 1);
    });
    const t = z + coeffs.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaContinuedFraction(a, b, x) {
    const maxIterations = 100;
    const epsilon = 3e-7;
    const fpMin = 1e-30;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - ((qab * x) / qap);
    if (Math.abs(d) < fpMin) d = fpMin;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m += 1) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + (aa * d);
        if (Math.abs(d) < fpMin) d = fpMin;
        c = 1 + (aa / c);
        if (Math.abs(c) < fpMin) c = fpMin;
        d = 1 / d;
        h *= d * c;

        aa = -((a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + (aa * d);
        if (Math.abs(d) < fpMin) d = fpMin;
        c = 1 + (aa / c);
        if (Math.abs(c) < fpMin) c = fpMin;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < epsilon) break;
    }
    return h;
}

function regularizedIncompleteBeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const logBetaTerm = logGamma(a + b) - logGamma(a) - logGamma(b) + (a * Math.log(x)) + (b * Math.log1p(-x));
    const betaTerm = Math.exp(logBetaTerm);
    if (x < (a + 1) / (a + b + 2)) {
        return betaTerm * betaContinuedFraction(a, b, x) / a;
    }
    return 1 - ((betaTerm * betaContinuedFraction(b, a, 1 - x)) / b);
}

function betaQuantile(probability, a, b) {
    if (probability <= 0) return Number.MIN_VALUE;
    if (probability >= 1) return 1 - Number.EPSILON;
    let lower = 0;
    let upper = 1;
    for (let i = 0; i < 56; i += 1) {
        const mid = (lower + upper) / 2;
        if (regularizedIncompleteBeta(mid, a, b) < probability) lower = mid;
        else upper = mid;
    }
    return clamp((lower + upper) / 2, Number.MIN_VALUE, 1 - Number.EPSILON);
}

function buildEnvelopeRanks(n) {
    if (n <= MAX_ENVELOPE_POINTS) {
        return Array.from({ length: n }, (_, index) => index + 1);
    }
    const ranks = new Set([1, n]);
    for (let i = 0; i < MAX_ENVELOPE_POINTS; i += 1) {
        const t = i / (MAX_ENVELOPE_POINTS - 1);
        ranks.add(Math.round(1 + ((t ** 2) * (n - 1))));
    }
    return [...ranks].sort((a, b) => a - b);
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
        const ranks = buildEnvelopeRanks(n);

        const x = [];
        const upper = [];
        const lower = [];
        ranks.forEach((rank) => {
            const row = sorted[rank - 1];
            if (!row) return;
            const sign = tailSide === 'negative' ? -1 : 1;
            const loP = betaQuantile(0.025, rank, n + 1 - rank);
            const hiP = betaQuantile(0.975, rank, n + 1 - rank);
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
            line: {
                color: alpha(TAIL_META[tailSide].color, 0.28),
                width: 1,
                dash: 'dot',
            },
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
            line: {
                color: alpha(TAIL_META[tailSide].color, 0.28),
                width: 1,
                dash: 'dot',
            },
            hoverinfo: 'skip',
            showlegend: false,
        });
    }
    return traces;
}

export default function GeneLevelQQ({ fileId, gwasId, traitLabel, lookupIds = [] }) {
    const theme = useTheme();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const toolbarPanelSx = useMemo(() => ({
        px: 1.2,
        py: 0.95,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.82),
    }), [theme.palette.background.paper, theme.palette.divider]);
    const plotRef = useRef(null);
    const plotElRef = useRef(null);
    const tableRowRefs = useRef({});
    const tableSectionRef = useRef(null);

    const [tailMode, setTailMode] = useState(TAIL_MODES.BOTH);
    const [geneQuery, setGeneQuery] = useState('');
    const [showExpectedLine, setShowExpectedLine] = useState(true);
    const [showNominalLine, setShowNominalLine] = useState(false);
    const [showFdrLine, setShowFdrLine] = useState(true);
    const [showEnvelope, setShowEnvelope] = useState(true);
    const [showTopLabels, setShowTopLabels] = useState(true);
    const [pointSize, setPointSize] = useState(DEFAULT_POINT_SIZE);
    const [labelLimit, setLabelLimit] = useState(DEFAULT_LABEL_LIMIT);
    const [tableOpen, setTableOpen] = useState(true);
    const [sortBy, setSortBy] = useState('absDeviation');
    const [sortDir, setSortDir] = useState('desc');
    const [highlight, setHighlight] = useState({ rowKey: '', key: 0 });
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(25);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');
    const [legendCollapsed, setLegendCollapsed] = useState(false);
    const [selectedTraits, setSelectedTraits] = useState([]);
    const [appliedTraits, setAppliedTraits] = useState([]);
    const [renderVersion, setRenderVersion] = useState(0);
    const [comparisonTraitCount, setComparisonTraitCount] = useState(DEFAULT_COMPARE_TRAITS);

    const primaryTrait = useMemo(() => normalizeTraitOption({
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitLabel || fileId || gwasId,
    }), [fileId, gwasId, traitLabel]);

    useEffect(() => {
        if (!primaryTrait) return;
        setComparisonTraitCount(DEFAULT_COMPARE_TRAITS);
        setSelectedTraits([primaryTrait]);
        setAppliedTraits([]);
        setRenderVersion(0);
    }, [primaryTrait]);

    const candidateIds = useMemo(() => (
        [...new Set([...(lookupIds || []), fileId, gwasId].filter(Boolean))]
    ), [fileId, gwasId, lookupIds]);

    const targetsKey = primaryTrait?.file_id ? ['gene-level-qq-targets', primaryTrait.file_id] : null;
    const targetsResource = useCachedResourceState(
        useSWR(targetsKey, ([, id]) => getCrossTraitTargets(id), detailSummarySWRConfig),
        { cacheKey: targetsKey, retainData: false },
    );
    const { displayData: targetsData, isRefreshing: targetsRefreshing } = targetsResource;
    const availableTraits = useMemo(
        () => uniqueTraitOptions([primaryTrait, ...(targetsData?.targets || [])]),
        [primaryTrait, targetsData],
    );
    const hasRenderedQQ = renderVersion > 0 && appliedTraits.length > 0;
    const qqKey = hasRenderedQQ
        ? ['gene-level-qq', traitListKey(appliedTraits), candidateIds.join('|'), primaryTrait?.file_id || '']
        : null;
    const qqResource = useCachedResourceState(
        useSWR(
            qqKey,
            () => loadGeneLevelQQPayload({
                appliedTraits,
                availableTraits,
                candidateIds,
                primaryTrait,
            }),
            figureResourceSWRConfig,
        ),
        { cacheKey: qqKey, retainData: false },
    );
    const {
        displayData: cachedPayload,
        error,
        isInitialLoading: isLoading,
        isRefreshing,
    } = qqResource;
    const payload = cachedPayload || { rows: [], fileId: '', path: '', selectedTraits: [], availableTraits };
    const afterFirstPaint = useAfterFirstPaint(qqKey || 'gene-level-qq-empty');
    const payloadTraitKey = useMemo(() => traitListKey(payload.selectedTraits), [payload.selectedTraits]);

    useEffect(() => {
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    }, [payload.fileId, payloadTraitKey]);

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

    const useTailColors = activeTraits.length <= 1;

    const relatedTraitSliderMax = useMemo(
        () => Math.max(DEFAULT_COMPARE_TRAITS, Math.min(MAX_COMPARE_TRAITS, availableTraits.length || MAX_COMPARE_TRAITS)),
        [availableTraits.length],
    );

    const applyComparisonTraitCount = useCallback((value) => {
        const nextCount = Math.min(
            relatedTraitSliderMax,
            Math.max(DEFAULT_COMPARE_TRAITS, Number(value) || DEFAULT_COMPARE_TRAITS),
        );
        setComparisonTraitCount(nextCount);
        setSelectedTraits(uniqueTraitOptions([primaryTrait, ...availableTraits]).slice(0, nextCount));
    }, [availableTraits, primaryTrait, relatedTraitSliderMax]);

    useEffect(() => {
        if (!primaryTrait) return;
        const nextTraits = uniqueTraitOptions([primaryTrait, ...selectedTraits]).slice(0, MAX_COMPARE_TRAITS);
        if (!nextTraits.length) return;
        const nextTraitKey = traitListKey(nextTraits);
        if (traitListKey(selectedTraits) !== nextTraitKey) {
            setSelectedTraits(nextTraits);
            return;
        }
        if (renderVersion > 0 && traitListKey(appliedTraits) === nextTraitKey) {
            return;
        }
        setAppliedTraits(nextTraits);
        setRenderVersion((value) => value + 1);
    }, [appliedTraits, primaryTrait, renderVersion, selectedTraits]);

    const comparisonTraitCountMarks = useMemo(() => (
        [...new Set([DEFAULT_COMPARE_TRAITS, relatedTraitSliderMax])]
            .filter((value) => value >= DEFAULT_COMPARE_TRAITS && value <= relatedTraitSliderMax)
            .map((value) => ({ value, label: String(value) }))
    ), [relatedTraitSliderMax]);

    const fdrGuide = useMemo(() => {
        const sig = filteredRows.filter((row) => Number.isFinite(row.fdr) && row.fdr <= 0.05 && Number.isFinite(row.p) && row.p > 0);
        if (!sig.length) return null;
        return -Math.log10(Math.max(...sig.map((row) => row.p)));
    }, [filteredRows]);

    const envelopeTraces = useMemo(() => (
        showEnvelope ? buildEnvelope(filteredRows) : []
    ), [filteredRows, showEnvelope]);

    const envelopeAxisValues = useMemo(() => (
        envelopeTraces.flatMap((trace) => [
            ...(Array.isArray(trace.x) ? trace.x : []),
            ...(Array.isArray(trace.y) ? trace.y : []),
        ])
    ), [envelopeTraces]);

    const axisRange = useMemo(() => (
        computeAxisRange(filteredRows, envelopeAxisValues)
    ), [envelopeAxisValues, filteredRows]);

    const labelRows = useMemo(() => {
        if (!showTopLabels || labelLimit <= 0) return [];
        const ranked = [...filteredRows]
            .sort((a, b) => (b.absDeviation || -Infinity) - (a.absDeviation || -Infinity));
        return pickSparseLabelRows(ranked, labelLimit, axisRange);
    }, [axisRange, filteredRows, labelLimit, showTopLabels]);

    const axisStyle = useMemo(() => ({
        zeroline: false,
        showgrid: true,
        gridwidth: 1,
        gridcolor: alpha(theme.palette.text.secondary, 0.09),
        showline: true,
        linewidth: 1,
        linecolor: alpha(theme.palette.text.secondary, 0.24),
        ticks: 'outside',
        ticklen: 5,
        tickwidth: 1,
        tickcolor: alpha(theme.palette.text.secondary, 0.24),
        tickfont: { size: 12, color: alpha(theme.palette.text.primary, 0.72), family: theme.typography.fontFamily },
    }), [theme.palette.text.primary, theme.palette.text.secondary, theme.typography.fontFamily]);

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
                    hovertext: [],
                    customdata: [],
                    sizes: [],
                    colors: [],
                    opacity: [],
                });
            }
            const group = grouped.get(groupKey);
            const normalizedDeviation = clamp((row.absDeviation || 0) / deviationCap, 0, 1);
            const intensity = normalizedDeviation ** 0.72;
            const deviationScale = intensity * 1.5;
            const traitColor = traitColorMap.get(row.sourceFileId) || TAIL_META[row.tailSide].color;
            const pointColor = useTailColors ? TAIL_META[row.tailSide].color : traitColor;
            group.x.push(row.expected);
            group.y.push(row.observed);
            group.hovertext.push(buildHoverText(row));
            group.customdata.push([row.rowKey]);
            group.sizes.push(pointSize + deviationScale);
            group.colors.push(mixColors(BASE_POINT_COLOR, pointColor, 0.86 + (intensity * 0.1), 0.92 + (intensity * 0.06)));
            group.opacity.push(1);
        });

        return [...grouped.values()].map((group) => {
            const traceColor = useTailColors
                ? TAIL_META[group.tailSide].color
                : traitColorMap.get(group.traitId) || TAIL_META[group.tailSide].color;

            return {
                type: 'scattergl',
                mode: 'markers',
                name: `${group.traitName} · ${TAIL_META[group.tailSide].label}`,
                x: group.x,
                y: group.y,
                hovertext: group.hovertext,
                customdata: group.customdata,
                hovertemplate: '%{hovertext}<extra></extra>',
                hoverlabel: buildPlotHoverTone(theme, traceColor, {
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
            };
        });
    }, [filteredRows, payload.fileId, pointSize, theme, traitColorMap, traitLabel, useTailColors]);

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
                size: 10.5,
                color: labelRows.map((row) => (
                    useTailColors
                        ? TAIL_META[row.tailSide].color
                        : traitColorMap.get(row.sourceFileId) || TAIL_META[row.tailSide].color
                )),
                family: theme.typography.fontFamily,
            },
            hoverinfo: 'skip',
        }];
    }, [labelRows, theme.typography.fontFamily, traitColorMap, useTailColors]);

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
                note: useTailColors
                    ? 'Blue diamond: negative; orange circle: positive.'
                    : trait.gwas_id && trait.gwas_id !== trait.trait_name ? trait.gwas_id : '',
                color: traitColorMap.get(trait.file_id) || TRAIT_PALETTE[0],
                colors: useTailColors ? [TAIL_META.negative.color, TAIL_META.positive.color] : undefined,
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
    }, [activeTraits, filteredRows, showEnvelope, theme.palette.text.secondary, traitColorMap, useTailColors]);

    const layout = useMemo(() => {
        const shapes = [];
        const annotations = [];

        if (axisRange[0] < 0 && axisRange[1] > 0) {
            const zeroGuide = alpha(theme.palette.text.secondary, 0.16);
            shapes.push(
                {
                    type: 'line',
                    x0: 0,
                    y0: axisRange[0],
                    x1: 0,
                    y1: axisRange[1],
                    line: { color: zeroGuide, width: 0.9 },
                },
                {
                    type: 'line',
                    x0: axisRange[0],
                    y0: 0,
                    x1: axisRange[1],
                    y1: 0,
                    line: { color: zeroGuide, width: 0.9 },
                },
            );
        }

        if (showExpectedLine) {
            shapes.push({
                type: 'line',
                x0: axisRange[0],
                y0: axisRange[0],
                x1: axisRange[1],
                y1: axisRange[1],
                line: { color: '#9f1d1d', width: 1.45, dash: 'solid' },
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
                font: { size: 11, color: '#9f1d1d', family: theme.typography.fontFamily },
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
                    line: { color: alpha(chartTokens.threshold, 0.72), width: 1, dash: 'dot' },
                },
                {
                    type: 'line',
                    x0: axisRange[0],
                    x1: axisRange[1],
                    y0: -NOMINAL_LOGP,
                    y1: -NOMINAL_LOGP,
                    line: { color: alpha(chartTokens.threshold, 0.72), width: 1, dash: 'dot' },
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
                    line: { color: alpha(chartTokens.threshold, 0.72), width: 1.1, dash: 'dot' },
                },
                {
                    type: 'line',
                    x0: axisRange[0],
                    x1: axisRange[1],
                    y0: -fdrGuide,
                    y1: -fdrGuide,
                    line: { color: alpha(chartTokens.threshold, 0.72), width: 1.1, dash: 'dot' },
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
            autosize: true,
            title: {
                text: `${traitLabel || payload.fileId || fileId} - Gene-level QQ`,
                font: { size: 18, color: theme.palette.text.primary, family: theme.typography.fontFamily },
                x: 0.02,
                xanchor: 'left',
            },
            paper_bgcolor: theme.palette.background.paper,
            plot_bgcolor: chartTokens.plotBg,
            margin: { l: 72, r: 26, t: 76, b: 64 },
            hovermode: 'closest',
            hoverdistance: 16,
            dragmode: 'pan',
            showlegend: false,
            xaxis: {
                ...axisStyle,
                title: { text: 'Expected signed -log10(P)', font: { size: 12.5, color: theme.palette.text.primary, family: theme.typography.fontFamily }, standoff: 10 },
                range: axisRange,
                fixedrange: false,
                automargin: true,
            },
            yaxis: {
                ...axisStyle,
                title: { text: 'Observed signed -log10(P)', font: { size: 12.5, color: theme.palette.text.primary, family: theme.typography.fontFamily }, standoff: 10 },
                range: axisRange,
                fixedrange: false,
                automargin: true,
            },
            shapes,
            annotations,
            transition: { duration: 220, easing: 'cubic-in-out' },
        };
    }, [axisRange, axisStyle, chartTokens.plotBg, chartTokens.threshold, fdrGuide, fileId, payload.fileId, showExpectedLine, showFdrLine, showNominalLine, theme, traitLabel]);

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
        setShowEnvelope(true);
        setShowTopLabels(true);
        setComparisonTraitCount(DEFAULT_COMPARE_TRAITS);
        setSelectedTraits(primaryTrait ? [primaryTrait] : []);
        setAppliedTraits([]);
        setRenderVersion(0);
        setPointSize(DEFAULT_POINT_SIZE);
        setLabelLimit(DEFAULT_LABEL_LIMIT);
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
    }, [primaryTrait]);

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
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.35 }}>
                        Gene-level QQ
                    </Typography>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                        Signed deviation from expectation
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
                <UpdatingStatus active={targetsRefreshing || isRefreshing} />
            </Box>

            <Box sx={toolbarSx(theme, { alignItems: 'stretch' })}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            lg: 'minmax(220px, 240px) minmax(320px, 1fr)',
                            xl: 'minmax(220px, 240px) minmax(340px, 1.15fr) minmax(260px, 320px) auto',
                        },
                        gap: 1.15,
                        alignItems: 'stretch',
                        width: '100%',
                    }}
                >
                    <Box sx={toolbarPanelSx}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.7 }}>
                            Trait overlays
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                            <Slider
                                size="small"
                                value={Math.min(comparisonTraitCount, relatedTraitSliderMax)}
                                min={DEFAULT_COMPARE_TRAITS}
                                max={relatedTraitSliderMax}
                                step={1}
                                marks={comparisonTraitCountMarks}
                                onChange={(_, value) => applyComparisonTraitCount(Array.isArray(value) ? value[0] : value)}
                                sx={{ flex: 1, mt: 0.6, mb: 0.1 }}
                            />
                            <TextField
                                size="small"
                                value={Math.min(comparisonTraitCount, relatedTraitSliderMax)}
                                onChange={(event) => applyComparisonTraitCount(event.target.value)}
                                slotProps={{
                                    htmlInput: {
                                        min: DEFAULT_COMPARE_TRAITS,
                                        max: relatedTraitSliderMax,
                                        step: 1,
                                        inputMode: 'numeric',
                                    },
                                }}
                                sx={{
                                    width: 64,
                                    '& .MuiInputBase-input': {
                                        textAlign: 'center',
                                        fontWeight: 700,
                                    },
                                }}
                            />
                        </Box>
                    </Box>

                    <Box sx={toolbarPanelSx}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.55 }}>
                            Guides
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
                                gap: 0.2,
                            }}
                        >
                            <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={showExpectedLine} onChange={(event) => setShowExpectedLine(event.target.checked)} size="small" />} label="Expected line" />
                            <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={showFdrLine} onChange={(event) => setShowFdrLine(event.target.checked)} size="small" />} label="FDR guide" />
                            <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={showNominalLine} onChange={(event) => setShowNominalLine(event.target.checked)} size="small" />} label="P=0.05" />
                            <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={showEnvelope} onChange={(event) => setShowEnvelope(event.target.checked)} size="small" />} label="95% envelope" />
                            <FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={showTopLabels} onChange={(event) => setShowTopLabels(event.target.checked)} size="small" />} label="Top labels" />
                        </Box>
                    </Box>

                    <Box sx={toolbarPanelSx}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.65 }}>
                            Density
                        </Typography>
                        <Stack spacing={1.1}>
                            <Stack direction="row" spacing={1.2} alignItems="center">
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'none', minWidth: 42 }}>
                                    Point
                                </Typography>
                                <Slider
                                    value={pointSize}
                                    min={3}
                                    max={14}
                                    step={1}
                                    onChange={(_, value) => setPointSize(Number(value))}
                                    sx={{ flex: 1, color: theme.palette.primary.main, '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.25 } }}
                                />
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, minWidth: 20, textAlign: 'right' }}>{pointSize}</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1.2} alignItems="center">
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'none', minWidth: 42 }}>
                                    Labels
                                </Typography>
                                <Slider
                                    value={labelLimit}
                                    min={0}
                                    max={30}
                                    step={1}
                                    onChange={(_, value) => setLabelLimit(Number(value))}
                                    disabled={!showTopLabels}
                                    sx={{ flex: 1, color: theme.palette.text.secondary, '& .MuiSlider-thumb': { width: 14, height: 14 }, '& .MuiSlider-rail': { opacity: 0.25 } }}
                                />
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, minWidth: 24, textAlign: 'right' }}>{labelLimit}</Typography>
                            </Stack>
                        </Stack>
                    </Box>

                    <Box
                        sx={{
                            ...toolbarPanelSx,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: { xs: 'flex-start', xl: 'flex-end' },
                        }}
                    >
                        <Stack direction={{ xs: 'row', xl: 'column' }} spacing={1} sx={{ width: { xs: '100%', xl: 'auto' } }}>
                            <Button variant="text" startIcon={<RestartAlt />} onClick={resetControls} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38, justifyContent: { xs: 'center', xl: 'flex-start' } }}>
                                Reset
                            </Button>
                            <Button variant="text" startIcon={<Download />} onClick={downloadCSV} disabled={!rows.length} sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38, justifyContent: { xs: 'center', xl: 'flex-start' } }}>
                                CSV
                            </Button>
                        </Stack>
                    </Box>
                </Box>
            </Box>

            <Card elevation={0} sx={plotFrameSx(theme)}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {isLoading && (
                        <Box sx={{ minHeight: GENE_QQ_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Loading gene-level QQ TSV...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!isLoading && rows.length === 0 && !hasRenderedQQ && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">Preparing the QQ plot for the selected traits.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && rows.length === 0 && hasRenderedQQ && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No gene-level QQ rows are available for this trait.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && rows.length > 0 && !hasVisiblePoints && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No genes match the current QQ filters.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!isLoading && hasVisiblePoints && !afterFirstPaint && (
                        <Box sx={{ minHeight: GENE_QQ_PLOT_HEIGHT }} />
                    )}

                    {!isLoading && hasVisiblePoints && afterFirstPaint && (
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
                                style={{ width: '100%', height: GENE_QQ_PLOT_HEIGHT }}
                            />
                            <FloatingLegend
                                items={legendItems}
                                collapsed={legendCollapsed}
                                onToggleCollapsed={() => setLegendCollapsed((prev) => !prev)}
                                title="Traits"
                                width={{ expanded: 260, collapsed: 118 }}
                                defaultPlacement="left"
                                defaultTop={64}
                                defaultSideOffset={52}
                                anchorPlotRef={plotElRef}
                                showScale={false}
                                sx={{
                                    borderRadius: 1.2,
                                    bgcolor: alpha(theme.palette.background.paper, 0.88),
                                    border: `1px solid ${alpha(theme.palette.text.secondary, 0.14)}`,
                                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
                                    backdropFilter: 'blur(8px) saturate(1.02)',
                                    WebkitBackdropFilter: 'blur(8px) saturate(1.02)',
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        inset: 0,
                                        pointerEvents: 'none',
                                        background: `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.42)} 0%, rgba(255,255,255,0) 44%)`,
                                        opacity: 0.62,
                                    },
                                }}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {!isLoading && afterFirstPaint && (
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
            )}

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
