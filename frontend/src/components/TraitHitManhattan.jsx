import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Alert,
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
    FormControl,
    InputLabel,
    ListItemText,
    MenuItem,
    OutlinedInput,
    Select,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import {
    Insights,
    Place,
    RestartAlt,
    ScatterPlot,
    Timeline,
} from '@mui/icons-material';
import { getTraitManhattanHits } from '../api/gwas';
import TraitHitManhattanLegend from './TraitHitManhattanLegend';
import TraitHitManhattanTable from './TraitHitManhattanTable';

const UNASSIGNED_COLOR = '#94a3b8';
const DEFAULT_EXPORT_WIDTH = 1400;
const DEFAULT_EXPORT_HEIGHT = 760;
const PROGRAM_COLORS = [
    '#2457C5', '#B84A6A', '#0F8C79', '#D96F1A', '#6A4FBF', '#C03E4C', '#0086A7', '#8E6B10',
    '#C44E8B', '#2C7A50', '#5C6BC0', '#A8582B', '#0E7490', '#9A3F6B', '#6B8E23', '#7B52B9',
    '#BD5A2F', '#1D7F84', '#A8445B', '#4E7E2B', '#4C6EDB', '#B26A12', '#8A4C9E', '#147E68',
    '#CC5C3A', '#2D62A8', '#A84D88', '#4C8F4B', '#A33E3E', '#1472B0', '#92721D', '#7B5AC8',
    '#B75474', '#087F8C', '#9A6536', '#4059B5', '#9B4F54', '#26825D', '#8858A8', '#C06A14',
    '#0D6E90', '#A34773', '#5D7D2F', '#3E5FC9', '#BE5F49', '#177D75', '#8F4A95', '#A46821',
    '#2E73A8', '#B54862', '#4B8652', '#6E57B8', '#CB6A2B', '#176C9A', '#9D5A2D', '#7C4D9F',
    '#B34D4D', '#0E8575', '#6D78D6', '#A85F8A',
];
const HOVER_TEMPLATE = [
    '<b>%{customdata[1]}</b>',
    'CHR %{customdata[2]}:%{customdata[3]}',
    'P %{customdata[4]}  ·  -log₁₀(P) %{y:.2f}',
    'Nearest gene: %{customdata[5]}',
    'distance_to_gene: %{customdata[6]}',
    'Program: %{customdata[7]}',
    'Geneset: %{customdata[8]}',
    '<extra></extra>',
].join('<br>');

const CHROM_ORDER = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
    '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y',
];

const CHROM_LENGTHS = {
    '1': 248956422,
    '2': 242193529,
    '3': 198295559,
    '4': 190214555,
    '5': 181538259,
    '6': 170805979,
    '7': 159345973,
    '8': 145138636,
    '9': 138394717,
    '10': 133797422,
    '11': 135086622,
    '12': 133275309,
    '13': 114364328,
    '14': 107043718,
    '15': 101991189,
    '16': 90338345,
    '17': 83257441,
    '18': 80373285,
    '19': 58617616,
    '20': 64444167,
    '21': 46709983,
    '22': 50818468,
    X: 156040895,
    Y: 57227415,
};

const CHROM_GAP = 3000000;
const GWAS_HIT_LOGP = -Math.log10(5e-8);

function sanitizeFileNamePart(value) {
    return String(value || 'plot').replace(/[\\/:*?"<>|]+/g, '_');
}

function normalizeChromosome(value) {
    let text = String(value || '').trim();
    if (!text) return '';
    text = text.replace(/^chr/i, '').toUpperCase();
    if (text === '23') return 'X';
    if (text === '24') return 'Y';
    return text;
}

function formatDistance(distance) {
    if (distance == null) return '—';
    if (distance === 0) return '0 bp';
    return `${Math.abs(distance).toLocaleString()} bp`;
}

function formatP(value) {
    return Number.isFinite(value) ? value.toExponential(2) : '—';
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function normalizeExportSize(value, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return clamp(Math.round(num), 200, 4000);
}

function getProgramColor(index) {
    return PROGRAM_COLORS[index % PROGRAM_COLORS.length];
}

function buildProgramColorMap(rows) {
    const programs = [...new Set(
        rows
            .map((item) => item.primaryProgram)
            .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const colorMap = new Map();
    programs.forEach((program, index) => {
        colorMap.set(program, getProgramColor(index));
    });
    return colorMap;
}

function buildPointCustomdata(row) {
    return [
        row.rowKey,
        row.snp || 'NA',
        row.normalizedChr,
        Number.isFinite(row.bp) ? row.bp.toLocaleString() : 'NA',
        formatP(row.p),
        row.nearestGene || 'NA',
        formatDistance(row.distanceToGene),
        row.primaryProgram || 'None',
        row.primaryGeneset || 'None',
    ];
}

function getProgramRoute(program) {
    const match = String(program || '').match(/\d+/);
    return match ? `/programs/${match[0]}` : null;
}

export default function TraitHitManhattan({ fileId, gwasId, traitLabel }) {
    const navigate = useNavigate();
    const tableRowRefs = useRef({});
    const plotRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [payload, setPayload] = useState(null);
    const [variant, setVariant] = useState('hits');
    const [programOnly, setProgramOnly] = useState(false);
    const [selectedGenesets, setSelectedGenesets] = useState([]);
    const [distanceMode, setDistanceMode] = useState('all');
    const [selectedChromosomes, setSelectedChromosomes] = useState([]);
    const [geneQuery, setGeneQuery] = useState('');
    const [selectedPrograms, setSelectedPrograms] = useState([]);
    const [highlight, setHighlight] = useState({ rowKey: '', key: 0 });
    const [sortBy, setSortBy] = useState('logp');
    const [sortDir, setSortDir] = useState('desc');
    const [tableOpen, setTableOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');
    const [legendCollapsed, setLegendCollapsed] = useState(true);
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(50);
    const deferredGeneQuery = useDeferredValue(geneQuery);

    const onInitialized = useCallback((_figure, graphDiv) => {
        plotRef.current = graphDiv;
    }, []);

    const onUpdate = useCallback((_figure, graphDiv) => {
        plotRef.current = graphDiv;
    }, []);

    useEffect(() => {
        if (!gwasId) return undefined;
        let cancelled = false;
        setLoading(true);
        getTraitManhattanHits(gwasId, { variant })
            .then((res) => {
                if (!cancelled) setPayload(res);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [gwasId, variant]);

    const rows = useMemo(() => payload?.data || [], [payload]);

    const summary = payload?.summary || {
        totalRows: 0,
        withProgram: 0,
        withGeneset: 0,
        distanceBuckets: { in_gene: 0, near: 0, moderate: 0, distal: 0, unknown: 0 },
    };

    const genesetOptions = useMemo(() => {
        const genesetSet = new Set();
        rows.forEach((item) => {
            item.genesets.forEach((geneset) => {
                if (geneset) genesetSet.add(geneset);
            });
        });
        return [...genesetSet].sort((a, b) => a.localeCompare(b));
    }, [rows]);

    const chromosomeOptions = useMemo(() => {
        const present = new Set(rows.map((item) => normalizeChromosome(item.chr)).filter(Boolean));
        return CHROM_ORDER.filter((chrom) => present.has(chrom));
    }, [rows]);

    const programOptions = useMemo(() => {
        const programSet = new Set();
        rows.forEach((item) => {
            item.programs.forEach((program) => {
                if (program) programSet.add(program);
            });
        });
        return [...programSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }, [rows]);

    const selectedChromosomeSet = useMemo(() => new Set(selectedChromosomes), [selectedChromosomes]);
    const selectedProgramSet = useMemo(() => new Set(selectedPrograms), [selectedPrograms]);
    const selectedGenesetSet = useMemo(() => new Set(selectedGenesets), [selectedGenesets]);
    const normalizedGeneQuery = useMemo(() => deferredGeneQuery.trim().toLowerCase(), [deferredGeneQuery]);

    const filteredRows = useMemo(() => {
        let nextRows = rows;

        if (programOnly) {
            nextRows = nextRows.filter((item) => item.hasProgram);
        }

        if (selectedChromosomeSet.size > 0) {
            nextRows = nextRows.filter((item) => selectedChromosomeSet.has(normalizeChromosome(item.chr)));
        }

        if (selectedProgramSet.size > 0) {
            nextRows = nextRows.filter((item) => item.programs.some((program) => selectedProgramSet.has(program)));
        }

        if (selectedGenesetSet.size > 0) {
            nextRows = nextRows.filter((item) => item.genesets.some((geneset) => selectedGenesetSet.has(geneset)));
        }

        if (distanceMode !== 'all') {
            nextRows = nextRows.filter((item) => item.distanceBucket === distanceMode);
        }

        if (normalizedGeneQuery) {
            nextRows = nextRows.filter((item) => {
                const gene = String(item.nearestGene || '').toLowerCase();
                const snp = String(item.snp || '').toLowerCase();
                return gene.includes(normalizedGeneQuery) || snp.includes(normalizedGeneQuery);
            });
        }

        return nextRows;
    }, [distanceMode, normalizedGeneQuery, programOnly, rows, selectedChromosomeSet, selectedGenesetSet, selectedProgramSet]);

    const chromosomeRanges = useMemo(() => {
        const present = new Set(filteredRows.map((item) => normalizeChromosome(item.chr)).filter(Boolean));
        const ordered = CHROM_ORDER.filter((chrom) => present.has(chrom));
        let offset = 0;

        // Pre-compute max BP per chromosome using reduce (avoids stack overflow with spread)
        const maxBpPerChr = {};
        for (const item of filteredRows) {
            const chr = normalizeChromosome(item.chr);
            const bp = Number(item.bp) || 0;
            if (!maxBpPerChr[chr] || bp > maxBpPerChr[chr]) maxBpPerChr[chr] = bp;
        }

        return ordered.map((chrom) => {
            const dynamicLength = Math.max(maxBpPerChr[chrom] || 0, 1);
            const length = Math.max(CHROM_LENGTHS[chrom] || 0, dynamicLength);
            const range = {
                chrom,
                start: offset,
                end: offset + length,
                mid: offset + (length / 2),
            };
            offset += length + CHROM_GAP;
            return range;
        });
    }, [filteredRows]);

    const chromosomeOffsets = useMemo(() => {
        const offsets = {};
        chromosomeRanges.forEach((range) => {
            offsets[range.chrom] = range.start;
        });
        return offsets;
    }, [chromosomeRanges]);

    const processedRows = useMemo(() => filteredRows
        .map((row) => {
            const normalizedChr = normalizeChromosome(row.chr);
            const bp = Number(row.bp);
            const logp = Number(row.logp);
            if (!normalizedChr || !Number.isFinite(bp) || !Number.isFinite(logp)) return null;
            return {
                ...row,
                normalizedChr,
                genomePos: bp + (chromosomeOffsets[normalizedChr] || 0),
                rowKey: `${normalizedChr}-${bp}-${row.snp || row.nearestGene || 'point'}`,
                logp,
            };
        })
        .filter(Boolean), [chromosomeOffsets, filteredRows]);

    const programColorMap = useMemo(() => buildProgramColorMap(processedRows), [processedRows]);

    const yAxisRange = useMemo(() => {
        if (processedRows.length === 0) return [GWAS_HIT_LOGP - 0.3, GWAS_HIT_LOGP + 1.7];
        let minValue = Infinity;
        let maxValue = -Infinity;
        for (const item of processedRows) {
            if (item.logp < minValue) minValue = item.logp;
            if (item.logp > maxValue) maxValue = item.logp;
        }
        const floor = Math.max(GWAS_HIT_LOGP - 0.35, Math.floor(minValue * 10) / 10 - 0.15);
        const ceil = Math.max(floor + 0.9, Math.ceil(maxValue * 10) / 10 + 0.35);
        return [floor, ceil];
    }, [processedRows]);

    const plotData = useMemo(() => {
        const unassigned = {
            x: [],
            y: [],
            customdata: [],
        };
        const assigned = {
            x: [],
            y: [],
            customdata: [],
            colors: [],
        };

        processedRows.forEach((row) => {
            const pointData = buildPointCustomdata(row);
            if (row.primaryProgram) {
                assigned.x.push(row.genomePos);
                assigned.y.push(row.logp);
                assigned.customdata.push(pointData);
                assigned.colors.push(programColorMap.get(row.primaryProgram) || UNASSIGNED_COLOR);
                return;
            }

            unassigned.x.push(row.genomePos);
            unassigned.y.push(row.logp);
            unassigned.customdata.push(pointData);
        });

        const traces = [];
        if (unassigned.x.length > 0) {
            traces.push({
                x: unassigned.x,
                y: unassigned.y,
                customdata: unassigned.customdata,
                mode: 'markers',
                type: 'scattergl',
                name: 'No program',
                showlegend: false,
                hovertemplate: HOVER_TEMPLATE,
                marker: {
                    size: 6,
                    color: UNASSIGNED_COLOR,
                    opacity: 0.18,
                    line: { width: 0 },
                },
            });
        }

        if (assigned.x.length > 0) {
            traces.push({
                x: assigned.x,
                y: assigned.y,
                customdata: assigned.customdata,
                mode: 'markers',
                type: 'scattergl',
                name: 'Program hits',
                showlegend: false,
                hovertemplate: HOVER_TEMPLATE,
                marker: {
                    size: 8,
                    color: assigned.colors,
                    opacity: 1,
                    line: { width: 0.3, color: 'rgba(15,23,42,0.1)' },
                },
            });
        }

        return traces;
    }, [processedRows, programColorMap]);

    const legendItems = useMemo(() => {
        const counts = new Map();
        processedRows.forEach((row) => {
            const key = row.primaryProgram || '__unassigned__';
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const items = [];
        if (counts.has('__unassigned__')) {
            items.push({
                key: '__unassigned__',
                label: 'No program',
                count: counts.get('__unassigned__'),
                color: UNASSIGNED_COLOR,
            });
        }

        [...programColorMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .forEach(([program, color]) => {
                items.push({
                    key: program,
                    label: program,
                    count: counts.get(program) || 0,
                    color,
                });
            });

        return items;
    }, [processedRows, programColorMap]);

    const highlightedPoint = useMemo(() => {
        if (!highlight.rowKey) return [];
        const row = processedRows.find((item) => item.rowKey === highlight.rowKey);
        if (!row) return [];
        return [{
            x: [row.genomePos],
            y: [row.logp],
            mode: 'markers',
            type: 'scatter',
            showlegend: false,
            hoverinfo: 'skip',
            marker: {
                size: 16,
                color: 'rgba(255,255,255,0)',
                line: { width: 2.5, color: '#111827' },
                symbol: 'circle-open',
            },
        }];
    }, [highlight.rowKey, processedRows]);

    const layout = useMemo(() => ({
        title: {
            text: `${traitLabel || fileId} — GWAS Manhattan`,
            x: 0.02,
            font: { size: 18, family: 'Inter, "Segoe UI", system-ui, sans-serif', color: '#111827', weight: 700 },
        },
        xaxis: {
            title: { text: 'Chromosome', font: { color: '#374151', size: 14, family: 'Inter, "Segoe UI", system-ui, sans-serif', weight: 600 } },
            tickmode: 'array',
            tickvals: chromosomeRanges.map((range) => range.mid),
            ticktext: chromosomeRanges.map((range) => range.chrom),
            showgrid: false,
            zeroline: false,
            tickfont: { size: 12, color: '#6b7280', family: 'Inter, "Segoe UI", system-ui, sans-serif', weight: 600 },
            range: [0, chromosomeRanges[chromosomeRanges.length - 1]?.end || 1],
            fixedrange: true,
            linewidth: 1,
            linecolor: '#d1d5db',
        },
        yaxis: {
            title: { text: '-log<sub>10</sub>(P)', font: { color: '#374151', size: 14, family: 'Inter, "Segoe UI", system-ui, sans-serif', weight: 600 } },
            showgrid: true,
            gridcolor: 'rgba(156,163,175,0.15)',
            gridwidth: 0.5,
            zeroline: false,
            tickfont: { size: 12, color: '#6b7280', family: 'Inter, "Segoe UI", system-ui, sans-serif' },
            range: yAxisRange,
            linewidth: 1,
            linecolor: '#d1d5db',
            ticks: 'outside',
            ticklen: 4,
            tickcolor: '#d1d5db',
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'rgba(255,255,255,0.97)',
            bordercolor: '#e5e7eb',
            font: { size: 12, color: '#1f2937', family: 'Inter, system-ui, sans-serif' },
            align: 'left',
        },
        showlegend: false,
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        margin: { l: 68, r: 24, t: 72, b: 64 },
        shapes: [
            ...chromosomeRanges.flatMap((range, index) => ([
                {
                    type: 'rect',
                    xref: 'x',
                    yref: 'paper',
                    x0: range.start,
                    x1: range.end,
                    y0: 0,
                    y1: 1,
                    fillcolor: index % 2 === 0 ? 'rgba(243,244,246,0.65)' : 'rgba(255,255,255,0)',
                    line: { width: 0 },
                    layer: 'below',
                },
            ])),
            {
                type: 'line',
                xref: 'paper',
                yref: 'y',
                x0: 0,
                x1: 1,
                y0: GWAS_HIT_LOGP,
                y1: GWAS_HIT_LOGP,
                line: { width: 1.5, color: '#ef4444', dash: 'dot' },
                layer: 'below',
            },
        ],
        annotations: [
            {
                xref: 'paper',
                yref: 'y',
                x: 1,
                y: GWAS_HIT_LOGP,
                xanchor: 'right',
                yanchor: 'bottom',
                showarrow: false,
                text: '<b>5×10⁻⁸</b>',
                font: { size: 11, color: '#ef4444', family: 'Inter, system-ui, sans-serif' },
            },
        ],
    }), [chromosomeRanges, fileId, traitLabel, yAxisRange]);

    const plotRevision = useMemo(() => JSON.stringify({
        highlightKey: highlight.key,
        rowCount: processedRows.length,
        variant,
    }), [highlight.key, processedRows.length, variant]);

    const handleResetFilters = () => {
        setProgramOnly(false);
        setSelectedGenesets([]);
        setDistanceMode('all');
        setSelectedChromosomes([]);
        setSelectedPrograms([]);
        setGeneQuery('');
        setHighlight({ rowKey: '', key: 0 });
    };

    const handleSort = (column) => {
        if (column === sortBy) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(column);
        setSortDir(['snp', 'nearestGene', 'normalizedChr', 'primaryProgram', 'primaryGeneset'].includes(column) ? 'asc' : 'desc');
    };

    const collator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);

    const sortedRows = useMemo(() => {
        const dir = sortDir === 'asc' ? 1 : -1;
        return [...processedRows].sort((a, b) => {
            if (['snp', 'nearestGene', 'normalizedChr', 'primaryProgram', 'primaryGeneset'].includes(sortBy)) {
                return collator.compare(String(a[sortBy] || ''), String(b[sortBy] || '')) * dir;
            }
            const av = a[sortBy] ?? -Infinity;
            const bv = b[sortBy] ?? -Infinity;
            if (av === bv) return 0;
            return av > bv ? dir : -dir;
        });
    }, [collator, processedRows, sortBy, sortDir]);

    const pagedRows = useMemo(() => {
        const start = tablePage * tableRowsPerPage;
        return sortedRows.slice(start, start + tableRowsPerPage);
    }, [sortedRows, tablePage, tableRowsPerPage]);

    useEffect(() => {
        const maxPage = Math.max(0, Math.ceil(sortedRows.length / tableRowsPerPage) - 1);
        if (tablePage > maxPage) {
            setTablePage(maxPage);
        }
    }, [sortedRows.length, tablePage, tableRowsPerPage]);

    useEffect(() => {
        if (!highlight.rowKey || !tableOpen) return undefined;
        const rowIndex = sortedRows.findIndex((item) => item.rowKey === highlight.rowKey);
        if (rowIndex < 0) return;

        const nextPage = Math.floor(rowIndex / tableRowsPerPage);
        if (nextPage !== tablePage) {
            setTablePage(nextPage);
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            const el = tableRowRefs.current[highlight.rowKey];
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);

        return () => window.clearTimeout(timeoutId);
    }, [highlight, sortedRows, tableOpen, tablePage, tableRowsPerPage]);

    const handleExport = useCallback(() => {
        const gd = plotRef.current;
        if (!gd) return;
        const width = normalizeExportSize(exportWidth, DEFAULT_EXPORT_WIDTH);
        const height = normalizeExportSize(exportHeight, DEFAULT_EXPORT_HEIGHT);
        Plotly.toImage(gd, { format: exportFmt, width, height }).then((dataUrl) => {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `${sanitizeFileNamePart(gwasId || fileId)}-${variant}-manhattan.${exportFmt}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }, [exportFmt, exportHeight, exportWidth, fileId, gwasId, variant]);

    const downloadCSV = useCallback(() => {
        const cols = ['SNP', 'CHR', 'BP', 'P', '-log10(P)', 'Gene', 'distance_to_gene', 'Program', 'Geneset', 'Primary Program', 'Primary Geneset'];
        const header = cols.join(',');
        const body = processedRows.map((row) => [
            row.snp || '', row.normalizedChr, row.bp || '', formatP(row.p), row.logp?.toFixed(4) || '',
            row.nearestGene || '', row.distanceToGene ?? '', row.program || '', row.geneset || '',
            row.primaryProgram || '', row.primaryGeneset || '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `manhattan_hits_${sanitizeFileNamePart(gwasId || fileId)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [processedRows, gwasId, fileId]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        modeBarButtonsToAdd: [
            {
                name: 'download',
                title: 'Download plot',
                icon: Plotly.Icons.disk,
                click: () => setExportOpen(true),
            },
        ],
    }), []);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Card elevation={0} sx={{
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.9) 100%)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                backdropFilter: 'blur(12px)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 40%, #059669 70%, #d97706 100%)',
                },
            }}>
                <CardContent sx={{ p: 3, pt: 3.5 }}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'flex-start' }}>
                        <Box>
                            <Typography sx={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                letterSpacing: '0.2em',
                                textTransform: 'uppercase',
                                color: '#6366f1',
                                mb: 0.5,
                            }}>
                                Trait Manhattan
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827', mb: 0.4, fontFamily: 'Inter, system-ui, sans-serif', fontSize: '1.4rem' }}>
                                GWAS Hit Loci Overview
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6b7280', lineHeight: 1.7, maxWidth: 860, fontSize: '0.88rem' }}>
                                Each program has a unique color in both the plot legend and table. Click a point to highlight its row. Use filters below to refine the view.
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={variant}
                                onChange={(_, value) => { if (value) setVariant(value); }}
                                sx={{
                                    '& .MuiToggleButton-root': {
                                        px: 1.6,
                                        textTransform: 'none',
                                        borderColor: '#e5e7eb',
                                        color: '#6b7280',
                                        fontWeight: 500,
                                        fontSize: '0.82rem',
                                    },
                                    '& .Mui-selected': {
                                        bgcolor: '#111827 !important',
                                        color: '#fff !important',
                                        fontWeight: 600,
                                    },
                                }}
                            >
                                <ToggleButton value="hits">Hits TSV</ToggleButton>
                                <ToggleButton value="full" disabled={Boolean(payload) && !payload?.availableVariants?.full}>Full TSV</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                        <Chip icon={<ScatterPlot sx={{ fontSize: 15 }} />} label={`${summary.totalRows.toLocaleString()} hits`} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, border: '1px solid #dbeafe' }} />
                        <Chip icon={<Insights sx={{ fontSize: 15 }} />} label={`${summary.withProgram.toLocaleString()} with program`} size="small" sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 600, border: '1px solid #d1fae5' }} />
                        <Chip icon={<Timeline sx={{ fontSize: 15 }} />} label={`${summary.withGeneset.toLocaleString()} with geneset`} size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 600, border: '1px solid #fde68a' }} />
                        <Chip icon={<Place sx={{ fontSize: 15 }} />} label={`${summary.distanceBuckets.in_gene.toLocaleString()} in gene`} size="small" sx={{ bgcolor: '#f0fdf4', color: '#166534', fontWeight: 600, border: '1px solid #bbf7d0' }} />
                        <Chip label={`GWAS ${gwasId || 'NA'}`} size="small" sx={{ bgcolor: '#f8fafc', fontFamily: 'monospace', color: '#64748b', fontSize: '0.72rem', border: '1px solid #e2e8f0' }} />
                    </Stack>
                </CardContent>
            </Card>

            <Card elevation={0} sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 3,
                bgcolor: '#ffffff',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            }}>
                <CardContent sx={{ p: 2.5 }}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }} flexWrap="wrap" useFlexGap>
                        <FormControl size="small" sx={{ minWidth: 160 }}>
                            <InputLabel id="chromosome-select-label">Chromosome</InputLabel>
                            <Select
                                labelId="chromosome-select-label"
                                multiple
                                value={selectedChromosomes}
                                onChange={(event) => setSelectedChromosomes(event.target.value)}
                                input={<OutlinedInput label="Chromosome" />}
                                renderValue={(selected) => selected.length ? selected.join(', ') : 'Chromosome'}
                            >
                                {chromosomeOptions.map((chromosome) => (
                                    <MenuItem key={chromosome} value={chromosome}>
                                        <Checkbox checked={selectedChromosomes.includes(chromosome)} />
                                        <ListItemText primary={`Chr ${chromosome}`} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel id="program-select-label">Program filter</InputLabel>
                            <Select
                                labelId="program-select-label"
                                multiple
                                value={selectedPrograms}
                                onChange={(event) => setSelectedPrograms(event.target.value)}
                                input={<OutlinedInput label="Program filter" />}
                                renderValue={(selected) => selected.length ? `${selected.length} programs selected` : 'Program filter'}
                            >
                                {programOptions.map((program) => (
                                    <MenuItem key={program} value={program}>
                                        <Checkbox checked={selectedPrograms.includes(program)} />
                                        <ListItemText primary={program} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 260 }}>
                            <InputLabel id="geneset-select-label">Geneset filter</InputLabel>
                            <Select
                                labelId="geneset-select-label"
                                multiple
                                value={selectedGenesets}
                                onChange={(event) => setSelectedGenesets(event.target.value)}
                                input={<OutlinedInput label="Geneset filter" />}
                                renderValue={(selected) => selected.length ? `${selected.length} genesets selected` : 'Geneset filter'}
                            >
                                {genesetOptions.map((geneset) => (
                                    <MenuItem key={geneset} value={geneset}>
                                        <Checkbox checked={selectedGenesets.includes(geneset)} />
                                        <ListItemText primary={geneset} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size="small" sx={{ minWidth: 190 }}>
                            <InputLabel id="distance-mode-label">distance_to_gene</InputLabel>
                            <Select
                                labelId="distance-mode-label"
                                value={distanceMode}
                                label="distance_to_gene"
                                onChange={(event) => setDistanceMode(event.target.value)}
                            >
                                <MenuItem value="all">All distances</MenuItem>
                                <MenuItem value="in_gene">In gene</MenuItem>
                                <MenuItem value="near">Near gene</MenuItem>
                                <MenuItem value="moderate">Moderate distance</MenuItem>
                                <MenuItem value="distal">Distal</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            size="small"
                            label="Gene / rsID"
                            value={geneQuery}
                            onChange={(event) => setGeneQuery(event.target.value)}
                            placeholder="e.g. NADK or rs35301881"
                            sx={{ width: 190 }}
                        />

                        <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.1, py: 0.6, borderRadius: 2.2, border: '1px solid rgba(49,66,91,0.12)', bgcolor: programOnly ? 'rgba(35,64,107,0.08)' : 'rgba(255,255,255,0.8)' }}>
                            <Checkbox checked={programOnly} onChange={(event) => setProgramOnly(event.target.checked)} sx={{ p: 0.3, mr: 0.4 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                Program only
                            </Typography>
                        </Box>

                        <Button variant="text" startIcon={<RestartAlt />} onClick={handleResetFilters} sx={{ textTransform: 'none', color: '#23406b', fontWeight: 600 }}>
                            Reset filters
                        </Button>
                    </Stack>

                    <Alert severity="info" sx={{ mt: 2, borderRadius: 2, bgcolor: '#f0f9ff', color: '#1e40af', border: '1px solid #bfdbfe', '& .MuiAlert-icon': { color: '#3b82f6' } }}>
                        <Typography variant="body2" sx={{ mb: 0.3, fontSize: '0.82rem' }}>
                            <strong>distance_to_gene:</strong> 0 = in gene body; 100s–1000s bp = near; 10000+ bp = distal.
                        </Typography>
                    </Alert>
                </CardContent>
            </Card>

            <Card elevation={0} sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: '#ffffff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
            }}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {loading && (
                        <Box sx={{ minHeight: 620, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: '#6b7280' }}>
                                    Loading Manhattan data from GWAS TSV...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!loading && rows.length === 0 && (
                        <Box sx={{ minHeight: 460, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="warning" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No Manhattan rows are currently available for this trait.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!loading && processedRows.length > 0 && (
                        <Box sx={{ position: 'relative' }}>
                            <Plot
                                data={[...plotData, ...highlightedPoint]}
                                layout={layout}
                                config={plotConfig}
                                revision={plotRevision}
                                onInitialized={onInitialized}
                                onUpdate={onUpdate}
                                onClick={(evt) => {
                                    const rowKey = evt?.points?.[0]?.customdata?.[0];
                                    if (!rowKey) return;
                                    setHighlight((prev) => {
                                        if (prev.rowKey === rowKey) {
                                            return { rowKey, key: prev.key + 1 };
                                        }
                                        return { rowKey, key: prev.key + 1 };
                                    });
                                    setTableOpen((prev) => (prev ? prev : true));
                                }}
                                useResizeHandler
                                style={{ width: '100%', height: '620px' }}
                            />
                            <TraitHitManhattanLegend
                                items={legendItems}
                                collapsed={legendCollapsed}
                                onToggleCollapsed={() => setLegendCollapsed((prev) => !prev)}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>
            <TraitHitManhattanTable
                processedRows={processedRows}
                sortedRows={sortedRows}
                pagedRows={pagedRows}
                highlight={highlight}
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
                tableRowRefs={tableRowRefs}
                navigate={navigate}
                getProgramRoute={getProgramRoute}
                programColorMap={programColorMap}
                formatDistance={formatDistance}
                formatP={formatP}
                gwasHitLogp={GWAS_HIT_LOGP}
            />

            <Dialog open={exportOpen} onClose={() => setExportOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 700, color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>Export Plot</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                        <TextField label="Width" type="number" size="small" value={exportWidth} onChange={(event) => setExportWidth(event.target.value)} />
                        <TextField label="Height" type="number" size="small" value={exportHeight} onChange={(event) => setExportHeight(event.target.value)} />
                    </Stack>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={exportFmt}
                        onChange={(_, v) => { if (v) setExportFmt(v); }}
                        sx={{
                            '& .MuiToggleButton-root': { textTransform: 'none', px: 2.5 },
                            '& .Mui-selected': { bgcolor: '#111827 !important', color: '#fff !important' },
                        }}
                    >
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setExportOpen(false)} sx={{ textTransform: 'none', color: '#6b7280' }}>Cancel</Button>
                    <Button variant="contained" onClick={() => { handleExport(); setExportOpen(false); }} sx={{ textTransform: 'none', bgcolor: '#111827', '&:hover': { bgcolor: '#1f2937' } }}>Export</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
