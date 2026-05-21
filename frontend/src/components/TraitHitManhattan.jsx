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

const UNASSIGNED_COLOR = '#6f7d90';
const DEFAULT_EXPORT_WIDTH = 1400;
const DEFAULT_EXPORT_HEIGHT = 760;
const PROGRAM_COLORS = [
    '#5194D6', '#D66351', '#51D6AA', '#D69451', '#9851D6', '#D65187', '#51BCD6', '#63D651',
    '#6351D6', '#D67E51', '#51D689', '#D651D6', '#51D6CD', '#D6C551', '#5175D6', '#D65168',
    '#51D663', '#B751D6', '#51AED6', '#9DD651', '#3C82C8', '#C84F3C', '#3CC899', '#C8823C',
    '#873CC8', '#C83C74', '#3CACC8', '#4FC83C', '#4F3CC8', '#C86B3C', '#3CC876', '#C83CC8',
    '#3CC8BF', '#C8B53C', '#3C61C8', '#C83C53', '#3CC84F', '#A73CC8', '#3C9EC8', '#8BC83C',
    '#73A1CE', '#CE7F73', '#73CEB0', '#CEA173', '#A473CE', '#CE7398', '#73BCCE', '#7FCE73',
    '#7F73CE', '#CE9273', '#73CE99', '#CE73CE', '#73CEC8', '#CEC273', '#738CCE', '#CE7382',
    '#73CE7F', '#B973CE', '#73B3CE', '#A7CE73',
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
const TOOLBAR_SX = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1.25,
    px: 2,
    py: 1.45,
    bgcolor: '#f9f9fb',
    borderRadius: 2,
    border: '1px solid #e8e8ec',
};

const COMPACT_TOGGLE_SX = {
    '& .MuiToggleButton-root': {
        px: 1.75,
        py: 0.42,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.8rem',
        letterSpacing: 0.2,
        color: '#6b7280',
        borderColor: '#d9dde3',
        '&.Mui-selected': {
            color: '#1f2937',
            bgcolor: '#e9edf3',
            fontWeight: 600,
        },
        '&:hover': {
            bgcolor: '#f1f4f8',
        },
    },
};

const SUMMARY_CHIP_SX = {
    height: 24,
    fontSize: '0.72rem',
    fontWeight: 600,
    '& .MuiChip-icon': {
        fontSize: 15,
    },
};

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

function buildCategoryColorMap(rows, field) {
    const categories = [...new Set(
        rows
            .map((item) => item[field])
            .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const colorMap = new Map();
    categories.forEach((category, index) => {
        colorMap.set(category, getProgramColor(index));
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
    const tableSectionRef = useRef(null);

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
    const [colorMode, setColorMode] = useState('program');
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
        if (!fileId) return undefined;
        let cancelled = false;
        setLoading(true);
        getTraitManhattanHits(fileId, { variant })
            .then((res) => {
                if (!cancelled) setPayload(res);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [fileId, variant]);

    const rows = useMemo(() => payload?.data || [], [payload]);
    const resolvedVariant = payload?.resolvedVariant || variant;
    const variantLabel = resolvedVariant === 'full' ? 'full' : 'hits';

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

    const colorField = colorMode === 'geneset' ? 'primaryGeneset' : 'primaryProgram';
    const colorModeTitle = colorMode === 'geneset' ? 'Genesets' : 'Programs';
    const colorMap = useMemo(() => buildCategoryColorMap(processedRows, colorField), [colorField, processedRows]);

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
            if (row[colorField]) {
                assigned.x.push(row.genomePos);
                assigned.y.push(row.logp);
                assigned.customdata.push(pointData);
                assigned.colors.push(colorMap.get(row[colorField]) || UNASSIGNED_COLOR);
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
                    size: 5.4,
                    color: UNASSIGNED_COLOR,
                    opacity: 0.3,
                    line: { width: 0.35, color: 'rgba(255,255,255,0.42)' },
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
                name: 'Program annotated',
                showlegend: false,
                hovertemplate: HOVER_TEMPLATE,
                marker: {
                    size: 7.5,
                    color: assigned.colors,
                    opacity: 0.96,
                    line: { width: 0.7, color: 'rgba(255,255,255,0.78)' },
                },
            });
        }

        return traces;
    }, [colorField, colorMap, processedRows]);

    const legendItems = useMemo(() => {
        const counts = new Map();
        processedRows.forEach((row) => {
            const key = row[colorField] || '__unassigned__';
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const items = [];
        if (counts.has('__unassigned__')) {
            items.push({
                key: '__unassigned__',
                label: 'others',
                count: counts.get('__unassigned__'),
                color: UNASSIGNED_COLOR,
            });
        }

        [...colorMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
            .forEach(([category, color]) => {
                items.push({
                    key: category,
                    label: category,
                    count: counts.get(category) || 0,
                    color,
                });
            });

        return items;
    }, [colorField, colorMap, processedRows]);

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
            text: `${traitLabel || fileId} — Manhattan`,
            x: 0.01,
            font: { size: 18, family: 'system-ui, -apple-system, sans-serif', color: '#333' },
        },
        xaxis: {
            title: { text: 'Chromosome', font: { color: '#374151', size: 14, family: 'system-ui, -apple-system, sans-serif' } },
            tickmode: 'array',
            tickvals: chromosomeRanges.map((range) => range.mid),
            ticktext: chromosomeRanges.map((range) => range.chrom),
            showgrid: false,
            zeroline: false,
            tickfont: { size: 12, color: '#666', family: 'system-ui, -apple-system, sans-serif' },
            range: [0, chromosomeRanges[chromosomeRanges.length - 1]?.end || 1],
            fixedrange: true,
            linewidth: 1,
            linecolor: '#ccc',
        },
        yaxis: {
            title: { text: '-log<sub>10</sub>(P)', font: { color: '#374151', size: 14, family: 'system-ui, -apple-system, sans-serif' } },
            showgrid: true,
            gridcolor: 'rgba(156,163,175,0.15)',
            gridwidth: 0.5,
            zeroline: false,
            tickfont: { size: 12, color: '#666', family: 'system-ui, -apple-system, sans-serif' },
            range: yAxisRange,
            linewidth: 1,
            linecolor: '#ccc',
            ticks: 'outside',
            ticklen: 4,
            tickcolor: '#ccc',
        },
        hovermode: 'closest',
        hoverlabel: {
            bgcolor: 'rgba(255,255,255,0.97)',
            bordercolor: '#cbd5e1',
            font: { size: 12, color: '#1f2937', family: 'system-ui, -apple-system, sans-serif' },
            align: 'left',
        },
        showlegend: false,
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#fcfcfd',
        margin: { l: 80, r: 40, t: 62, b: 60 },
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
                    fillcolor: index % 2 === 0 ? 'rgba(241,245,249,0.72)' : 'rgba(255,255,255,0)',
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
                font: { size: 11, color: '#ef4444', family: 'system-ui, -apple-system, sans-serif' },
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

    const handleVariantChange = (_, value) => {
        if (!value || value === variant) return;
        setVariant(value);
        setProgramOnly(false);
        setSelectedGenesets([]);
        setDistanceMode('all');
        setSelectedChromosomes([]);
        setSelectedPrograms([]);
        setGeneQuery('');
        setHighlight({ rowKey: '', key: 0 });
        setTablePage(0);
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
            const tableSection = tableSectionRef.current;
            if (tableSection) {
                const top = tableSection.getBoundingClientRect().top + window.scrollY - 84;
                window.scrollTo({ top, behavior: 'smooth' });
            }
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
        a.download = `manhattan_${variantLabel}_${sanitizeFileNamePart(gwasId || fileId)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [processedRows, gwasId, fileId, variantLabel]);

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={TOOLBAR_SX}>
                <Box sx={{ minWidth: 220, mr: 0.5 }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b', mb: 0.35 }}>
                        Trait Manhattan
                    </Typography>
                    <Typography sx={{ fontSize: '1.02rem', fontWeight: 700, color: '#1f2937', lineHeight: 1.25 }}>
                        {variantLabel === 'full' ? 'All GWAS Loci Overview' : 'GWAS Hit Loci Overview'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        {variantLabel === 'full'
                            ? 'Program / Geneset coloring across the full GWAS TSV. Click a point to focus its table row.'
                            : 'Program / Geneset coloring for trait-associated loci. Click a point to focus its table row.'}
                    </Typography>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={variant}
                    onChange={handleVariantChange}
                    sx={COMPACT_TOGGLE_SX}
                >
                    <ToggleButton value="hits">Hits TSV</ToggleButton>
                    <ToggleButton value="full" disabled={Boolean(payload) && !payload?.availableVariants?.full}>Full TSV</ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={colorMode}
                    onChange={(_, value) => { if (value) setColorMode(value); }}
                    sx={COMPACT_TOGGLE_SX}
                >
                    <ToggleButton value="program">Program</ToggleButton>
                    <ToggleButton value="geneset">Geneset</ToggleButton>
                </ToggleButtonGroup>

                <Chip
                    icon={<ScatterPlot sx={{ fontSize: 15 }} />}
                    label={`${summary.totalRows.toLocaleString()} ${variantLabel === 'full' ? 'loci' : 'hits'}`}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' }}
                />
                <Chip
                    icon={<Insights sx={{ fontSize: 15 }} />}
                    label={`${summary.withProgram.toLocaleString()} with program`}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#edf6ff', color: '#245089', border: '1px solid #d6e7fb' }}
                />
                <Chip
                    icon={<Timeline sx={{ fontSize: 15 }} />}
                    label={`${summary.withGeneset.toLocaleString()} with geneset`}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#f5f3ff', color: '#5b3f86', border: '1px solid #e5ddfb' }}
                />
                <Chip
                    icon={<Place sx={{ fontSize: 15 }} />}
                    label={`${summary.distanceBuckets.in_gene.toLocaleString()} in gene`}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#eefbf3', color: '#2f6a49', border: '1px solid #d7eee0' }}
                />
                <Chip
                    label={variantLabel === 'full' ? 'Full TSV' : 'Hits TSV'}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, bgcolor: variantLabel === 'full' ? '#ecfeff' : '#ffffff', color: '#0f766e', border: '1px solid #99f6e4', fontFamily: 'monospace' }}
                />
                <Chip
                    label={`GWAS ${gwasId || 'NA'}`}
                    size="small"
                    sx={{ ...SUMMARY_CHIP_SX, bgcolor: '#ffffff', color: '#64748b', border: '1px solid #d9dde3', fontFamily: 'monospace' }}
                />
            </Box>

            <Box sx={TOOLBAR_SX}>
                <FormControl size="small" sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}>
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

                <FormControl size="small" sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}>
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

                <FormControl size="small" sx={{ minWidth: 250, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}>
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

                <FormControl size="small" sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}>
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
                    sx={{ width: 190, '& .MuiOutlinedInput-root': { bgcolor: '#fff' } }}
                />

                <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.1, py: 0.55, borderRadius: 2, border: '1px solid #d9dde3', bgcolor: programOnly ? '#eef2f7' : '#fff' }}>
                    <Checkbox checked={programOnly} onChange={(event) => setProgramOnly(event.target.checked)} sx={{ p: 0.3, mr: 0.4 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                        Program only
                    </Typography>
                </Box>

                <Button variant="text" startIcon={<RestartAlt />} onClick={handleResetFilters} sx={{ textTransform: 'none', color: '#475569', fontWeight: 600, minHeight: 38 }}>
                    Reset filters
                </Button>

                <Typography sx={{ width: '100%', fontSize: '0.74rem', color: '#6b7280', lineHeight: 1.4 }}>
                    <strong>distance_to_gene:</strong> 0 = in gene body; 100s–1000s bp = near; 10000+ bp = distal.
                </Typography>
            </Box>

            <Card elevation={0} sx={{
                border: '1px solid #e8e8ec',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: '#ffffff',
                boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
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

                    {!loading && rows.length > 0 && processedRows.length === 0 && (
                        <Box sx={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No loci match the current filters.</Typography>
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
                                title={colorModeTitle}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>
            <TraitHitManhattanTable
                tableSectionRef={tableSectionRef}
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
                programColorMap={colorMap}
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
