import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot, { Plotly } from '../lib/plotly';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import Insights from '@mui/icons-material/Insights';
import Place from '@mui/icons-material/Place';
import Refresh from '@mui/icons-material/Refresh';
import RestartAlt from '@mui/icons-material/RestartAlt';
import ScatterPlot from '@mui/icons-material/ScatterPlot';
import Timeline from '@mui/icons-material/Timeline';
import useSWR, { useSWRConfig } from 'swr';
import { getTraitManhattanHits } from '../api/gwas';
import { UpdatingStatus } from './PageScaffold';
import TraitHitManhattanLegend from './TraitHitManhattanLegend';
import TraitHitManhattanTable from './TraitHitManhattanTable';
import { downloadBlob, downloadDataUrl } from '../utils/download';
import { scrollElementNearViewportCenter } from '../utils/scroll';
import { figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useIdleRenderGate } from '../utils/renderScheduling';
import {
    buildPlotHoverTone,
    buildPlotHoverToneArray,
    buildPlotHoverToneNeutral,
    chartLayoutTokens,
    compactToggleGroupSx,
    metricChipTone,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_TALL_PLOT_HEIGHT,
    summaryChipSx,
    toolbarSx,
} from '../themeUtils';

const UNASSIGNED_COLOR = '#6f7d90';
const FULL_BACKGROUND_CHROM_COLORS = ['#e58d2a', '#3b7fc4'];
const DEFAULT_EXPORT_WIDTH = 1400;
const DEFAULT_EXPORT_HEIGHT = 760;
const MANHATTAN_PLOT_HEIGHT = RESPONSIVE_TALL_PLOT_HEIGHT;
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
const AUTO_FULL_MIN_POINTS = 30;
const EMPTY_MANHATTAN_ROWS = [];

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

function buildPointHoverText(row) {
    const lines = [
        `<b>${row.snp || 'Variant'}</b>`,
        `CHR ${row.normalizedChr}:${Number.isFinite(row.bp) ? row.bp.toLocaleString() : 'NA'}`,
        `P ${formatP(row.p)} | -log10(P) ${row.logp.toFixed(2)}`,
    ];
    if (row.nearestGene) lines.push(`Nearest gene: ${row.nearestGene}`);
    if (row.distanceToGene != null) lines.push(`distance_to_gene: ${formatDistance(row.distanceToGene)}`);
    if (row.primaryProgram) lines.push(`Program: ${row.primaryProgram}`);
    if (row.primaryGeneset) lines.push(`Geneset: ${row.primaryGeneset}`);
    return lines.join('<br>');
}

function getProgramRoute(program) {
    const match = String(program || '').match(/\d+/);
    return match ? `/programs/${match[0]}` : null;
}

function buildManhattanCacheKey(fileId, gwasId, variant, retryKey) {
    return fileId ? ['trait-manhattan', fileId, gwasId || '', variant, retryKey] : null;
}

function serializeCacheKey(key) {
    if (!key) return '';
    try {
        return JSON.stringify(key);
    } catch {
        return String(key);
    }
}

export default function TraitHitManhattan({ fileId, gwasId }) {
    const theme = useTheme();
    const { mutate } = useSWRConfig();
    const chartTokens = useMemo(() => chartLayoutTokens(theme), [theme]);
    const toolbarStyles = useMemo(() => toolbarSx(theme), [theme]);
    const compactToggleStyles = useMemo(() => compactToggleGroupSx(theme), [theme]);
    const baseChipSx = useCallback((tone = 'neutral', overrides = {}) => (
        summaryChipSx(theme, {
            '& .MuiChip-icon': { fontSize: 15 },
            ...metricChipTone(theme, tone),
            ...overrides,
        })
    ), [theme]);
    const navigate = useNavigate();
    const tableRowRefs = useRef({});
    const plotRef = useRef(null);
    const tableSectionRef = useRef(null);
    const prefetchedFullKeysRef = useRef(new Set());
    const exportBaseName = useMemo(() => sanitizeFileNamePart(fileId || gwasId || 'trait'), [fileId, gwasId]);

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
    const [tableOpen, setTableOpen] = useState(true);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportWidth, setExportWidth] = useState(DEFAULT_EXPORT_WIDTH);
    const [exportHeight, setExportHeight] = useState(DEFAULT_EXPORT_HEIGHT);
    const [exportFmt, setExportFmt] = useState('svg');
    const [colorMode, setColorMode] = useState('program');
    const [legendCollapsed, setLegendCollapsed] = useState(false);
    const [tablePage, setTablePage] = useState(0);
    const [tableRowsPerPage, setTableRowsPerPage] = useState(25);
    const [retryKey, setRetryKey] = useState(0);
    const deferredGeneQuery = useDeferredValue(geneQuery);
    const manhattanKey = useMemo(
        () => buildManhattanCacheKey(fileId, gwasId, variant, retryKey),
        [fileId, gwasId, retryKey, variant],
    );
    const manhattanResource = useCachedResourceState(
        useSWR(
            manhattanKey,
            ([, traitName, aliasId, requestedVariant]) => getTraitManhattanHits(traitName, {
                variant: requestedVariant,
                aliasId: aliasId || undefined,
                autoFullMinPoints: requestedVariant === 'hits' ? AUTO_FULL_MIN_POINTS : undefined,
            }),
            figureResourceSWRConfig,
        ),
        { cacheKey: manhattanKey, retainPreviousData: false },
    );
    const { displayData: payload, error, isInitialLoading: loading, isRefreshing } = manhattanResource;
    const afterFirstPaint = useAfterFirstPaint(manhattanKey || 'trait-manhattan-empty');
    const rawRows = payload?.data || EMPTY_MANHATTAN_ROWS;
    const dataReady = useIdleRenderGate(
        Boolean(payload && !loading && !error && afterFirstPaint),
        `${serializeCacheKey(manhattanKey)}:${rawRows.length}`,
        {
            delay: rawRows.length > 2000 ? 90 : 20,
            timeout: rawRows.length > 2000 ? 700 : 300,
        },
    );
    const isPreparingData = rawRows.length > 0 && !dataReady;

    const onInitialized = useCallback((_figure, graphDiv) => {
        plotRef.current = graphDiv;
    }, []);

    const onUpdate = useCallback((_figure, graphDiv) => {
        plotRef.current = graphDiv;
    }, []);

    const rows = dataReady ? rawRows : EMPTY_MANHATTAN_ROWS;
    const resolvedVariant = payload?.resolvedVariant || variant;
    const variantLabel = resolvedVariant === 'full' ? 'full' : 'hits';
    const variantControlValue = variantLabel === 'full' ? 'full' : variant;
    const isTruncated = Boolean(payload?.truncated);

    useEffect(() => {
        setTableOpen(!(resolvedVariant === 'full' && rawRows.length > 1000));
    }, [fileId, rawRows.length, resolvedVariant]);

    const summary = payload?.summary || {
        totalRows: 0,
        withProgram: 0,
        withGeneset: 0,
        distanceBuckets: { in_gene: 0, near: 0, moderate: 0, distal: 0, unknown: 0 },
    };

    useEffect(() => {
        if (!fileId || !payload || error) return;
        if (variant !== 'hits') return;
        if (resolvedVariant !== 'full') return;

        const fullKey = buildManhattanCacheKey(fileId, gwasId, 'full', retryKey);
        void mutate(fullKey, payload, { populateCache: true, revalidate: false });
        setVariant('full');
    }, [error, fileId, gwasId, mutate, payload, resolvedVariant, retryKey, variant]);

    useEffect(() => {
        if (!fileId || !payload || error || loading) return;
        if (variant !== 'hits' || resolvedVariant !== 'hits') return;
        if (!payload?.availableVariants?.full) return;

        const rawPointCount = payload?.autoFullPointCount ?? payload?.returnedRowCount ?? rawRows.length;
        if (rawPointCount < AUTO_FULL_MIN_POINTS) return;

        const fullKey = buildManhattanCacheKey(fileId, gwasId, 'full', retryKey);
        const serializedKey = serializeCacheKey(fullKey);
        if (prefetchedFullKeysRef.current.has(serializedKey)) return;

        prefetchedFullKeysRef.current.add(serializedKey);
        void mutate(
            fullKey,
            getTraitManhattanHits(fileId, {
                variant: 'full',
                aliasId: gwasId || undefined,
            }),
            {
                populateCache: true,
                revalidate: false,
                rollbackOnError: false,
                throwOnError: false,
            },
        ).catch(() => {});
    }, [error, fileId, gwasId, loading, mutate, payload, rawRows.length, resolvedVariant, retryKey, variant]);

    const filterOptions = useMemo(() => {
        const genesetSet = new Set();
        const programSet = new Set();
        const chromosomeSet = new Set();

        rows.forEach((item) => {
            item.genesets.forEach((geneset) => {
                if (geneset) genesetSet.add(geneset);
            });
            item.programs.forEach((program) => {
                if (program) programSet.add(program);
            });
            const chromosome = normalizeChromosome(item.chr);
            if (chromosome) chromosomeSet.add(chromosome);
        });

        return {
            genesets: [...genesetSet].sort((a, b) => a.localeCompare(b)),
            programs: [...programSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
            chromosomes: CHROM_ORDER.filter((chromosome) => chromosomeSet.has(chromosome)),
        };
    }, [rows]);
    const genesetOptions = filterOptions.genesets;
    const chromosomeOptions = filterOptions.chromosomes;
    const programOptions = filterOptions.programs;

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
        const present = new Set();
        const maxBpPerChr = {};
        for (const item of filteredRows) {
            const chr = normalizeChromosome(item.chr);
            if (!chr) continue;
            present.add(chr);
            const bp = Number(item.bp) || 0;
            if (!maxBpPerChr[chr] || bp > maxBpPerChr[chr]) maxBpPerChr[chr] = bp;
        }

        const ordered = CHROM_ORDER.filter((chrom) => present.has(chrom));
        let offset = 0;
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
        .map((row, index) => {
            const normalizedChr = normalizeChromosome(row.chr);
            const bp = Number(row.bp);
            const logp = Number(row.logp);
            if (!normalizedChr || !Number.isFinite(bp) || !Number.isFinite(logp)) return null;
            return {
                ...row,
                normalizedChr,
                genomePos: bp + (chromosomeOffsets[normalizedChr] || 0),
                rowKey: `${normalizedChr}-${bp}-${row.snp || row.nearestGene || 'point'}-${index}`,
                logp,
            };
        })
        .filter(Boolean), [chromosomeOffsets, filteredRows]);

    const colorField = colorMode === 'geneset' ? 'primaryGeneset' : 'primaryProgram';
    const colorModeTitle = colorMode === 'geneset' ? 'Genesets' : 'Programs';
    const colorMap = useMemo(() => (
        buildCategoryColorMap(processedRows, colorField)
    ), [colorField, processedRows]);
    const chromosomeIndexMap = useMemo(() => {
        const map = {};
        chromosomeRanges.forEach((range, index) => {
            map[range.chrom] = index;
        });
        return map;
    }, [chromosomeRanges]);

    const yAxisRange = useMemo(() => {
        if (processedRows.length === 0) return [0, GWAS_HIT_LOGP + 1.7];
        let minValue = Infinity;
        let maxValue = -Infinity;
        for (const item of processedRows) {
            if (item.logp < minValue) minValue = item.logp;
            if (item.logp > maxValue) maxValue = item.logp;
        }

        const ceil = Math.max(GWAS_HIT_LOGP + 0.35, Math.ceil(maxValue * 10) / 10 + 0.35);
        if (variantLabel === 'full') {
            const floor = Math.max(0, Math.floor(minValue * 10) / 10 - 0.15);
            return [floor, Math.max(floor + 0.9, ceil)];
        }

        const floor = Math.max(GWAS_HIT_LOGP - 0.35, Math.floor(minValue * 10) / 10 - 0.15);
        return [floor, Math.max(floor + 0.9, ceil)];
    }, [processedRows, variantLabel]);

    const plotData = useMemo(() => {
        const fullBackground = {
            x: [],
            y: [],
            text: [],
            customdata: [],
            colors: [],
        };
        const unassigned = {
            x: [],
            y: [],
            text: [],
            customdata: [],
        };
        const assigned = {
            x: [],
            y: [],
            text: [],
            customdata: [],
            colors: [],
        };
        processedRows.forEach((row) => {
            const hoverText = buildPointHoverText(row);
            if (variantLabel === 'full' && row.logp < GWAS_HIT_LOGP) {
                const chromIndex = chromosomeIndexMap[row.normalizedChr] ?? 0;
                fullBackground.x.push(row.genomePos);
                fullBackground.y.push(row.logp);
                fullBackground.text.push(hoverText);
                fullBackground.customdata.push([row.rowKey]);
                fullBackground.colors.push(FULL_BACKGROUND_CHROM_COLORS[chromIndex % FULL_BACKGROUND_CHROM_COLORS.length]);
                return;
            }

            if (row[colorField]) {
                assigned.x.push(row.genomePos);
                assigned.y.push(row.logp);
                assigned.text.push(hoverText);
                assigned.customdata.push([row.rowKey]);
                assigned.colors.push(colorMap.get(row[colorField]) || UNASSIGNED_COLOR);
                return;
            }

            unassigned.x.push(row.genomePos);
            unassigned.y.push(row.logp);
            unassigned.text.push(hoverText);
            unassigned.customdata.push([row.rowKey]);
        });

        const traces = [];
        if (fullBackground.x.length > 0) {
            traces.push({
                x: fullBackground.x,
                y: fullBackground.y,
                text: fullBackground.text,
                customdata: fullBackground.customdata,
                mode: 'markers',
                type: 'scattergl',
                name: 'Below hit threshold',
                showlegend: false,
                hovertemplate: '%{text}<extra></extra>',
                hoverlabel: buildPlotHoverTone(theme, FULL_BACKGROUND_CHROM_COLORS[0], {
                    bgAlpha: 0.16,
                    borderAlpha: 0.36,
                }),
                marker: {
                    size: 5.2,
                    color: fullBackground.colors,
                    opacity: 0.52,
                    line: { width: 0 },
                },
            });
        }

        if (unassigned.x.length > 0) {
            traces.push({
                x: unassigned.x,
                y: unassigned.y,
                text: unassigned.text,
                customdata: unassigned.customdata,
                mode: 'markers',
                type: 'scattergl',
                name: 'No program',
                showlegend: false,
                hovertemplate: '%{text}<extra></extra>',
                hoverlabel: buildPlotHoverTone(theme, UNASSIGNED_COLOR, {
                    bgAlpha: 0.14,
                    borderAlpha: 0.28,
                }),
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
                text: assigned.text,
                customdata: assigned.customdata,
                mode: 'markers',
                type: 'scattergl',
                name: 'Program annotated',
                showlegend: false,
                hovertemplate: '%{text}<extra></extra>',
                hoverlabel: buildPlotHoverToneArray(theme, assigned.colors, {
                    bgAlpha: 0.18,
                    borderAlpha: 0.42,
                }),
                marker: {
                    size: 7.5,
                    color: assigned.colors,
                    opacity: 0.96,
                    line: { width: 0.3, color: 'rgba(255,255,255,0.24)' },
                },
            });
        }

        return traces;
    }, [chromosomeIndexMap, colorField, colorMap, processedRows, theme, variantLabel]);
    const legendItems = useMemo(() => {
        const counts = new Map();
        const backgroundCounts = [0, 0];
        processedRows.forEach((row) => {
            if (variantLabel === 'full' && row.logp < GWAS_HIT_LOGP) {
                const chromIndex = chromosomeIndexMap[row.normalizedChr] ?? 0;
                backgroundCounts[chromIndex % 2] += 1;
                return;
            }
            const key = row[colorField] || '__unassigned__';
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        const items = [];
        if (variantLabel === 'full' && (backgroundCounts[0] > 0 || backgroundCounts[1] > 0)) {
            items.push({
                key: '__below_threshold__',
                label: 'below threshold',
                count: backgroundCounts[0] + backgroundCounts[1],
                color: FULL_BACKGROUND_CHROM_COLORS[0],
                colors: FULL_BACKGROUND_CHROM_COLORS,
            });
        }

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
    }, [chromosomeIndexMap, colorField, colorMap, processedRows, variantLabel]);

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
                line: { width: 2.5, color: theme.palette.text.primary },
                symbol: 'circle-open',
            },
        }];
    }, [highlight.rowKey, processedRows, theme.palette.text.primary]);

    const layout = useMemo(() => ({
        autosize: true,
        title: {
            text: `${fileId || gwasId} - Manhattan`,
            x: 0.01,
            font: { size: 18, family: theme.typography.fontFamily, color: theme.palette.text.primary },
        },
        xaxis: {
            title: { text: 'Chromosome', font: { color: chartTokens.axisColor, size: 14, family: theme.typography.fontFamily } },
            tickmode: 'array',
            tickvals: chromosomeRanges.map((range) => range.mid),
            ticktext: chromosomeRanges.map((range) => range.chrom),
            showgrid: false,
            zeroline: false,
            tickfont: { size: 12, color: chartTokens.axisSoft, family: theme.typography.fontFamily },
            range: [0, chromosomeRanges[chromosomeRanges.length - 1]?.end || 1],
            fixedrange: true,
            linewidth: 1,
            linecolor: chartTokens.axisSoft,
        },
        yaxis: {
            title: { text: '-log<sub>10</sub>(P)', font: { color: chartTokens.axisColor, size: 14, family: theme.typography.fontFamily } },
            showgrid: true,
            gridcolor: chartTokens.gridColor,
            gridwidth: 0.5,
            zeroline: false,
            tickfont: { size: 12, color: chartTokens.axisSoft, family: theme.typography.fontFamily },
            range: yAxisRange,
            linewidth: 1,
            linecolor: chartTokens.axisSoft,
            ticks: 'outside',
            ticklen: 4,
            tickcolor: chartTokens.axisSoft,
        },
        hovermode: 'closest',
        hoverlabel: buildPlotHoverToneNeutral(theme, '#7d8b9e', {
            fontSize: 12,
            family: theme.typography.fontFamily,
            align: 'left',
        }),
        showlegend: false,
        paper_bgcolor: chartTokens.paperBg,
        plot_bgcolor: chartTokens.plotBg,
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
                    fillcolor: index % 2 === 0 ? chartTokens.band : 'rgba(255,255,255,0)',
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
                line: { width: 1.5, color: chartTokens.significance, dash: 'dot' },
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
                text: '<b>5e-8</b>',
                font: { size: 11, color: chartTokens.significance, family: theme.typography.fontFamily },
            },
        ],
    }), [chartTokens, chromosomeRanges, fileId, gwasId, theme, yAxisRange]);

    const plotRevision = useMemo(() => JSON.stringify({
        highlightKey: highlight.key,
        rowCount: processedRows.length,
        variant: variantLabel,
    }), [highlight.key, processedRows.length, variantLabel]);

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
        if (!value || value === variantControlValue) return;
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
    const tableDataReady = useIdleRenderGate(
        dataReady && processedRows.length > 0 && tableOpen,
        `${serializeCacheKey(manhattanKey)}:${processedRows.length}:${sortBy}:${sortDir}`,
        {
            delay: processedRows.length > 1000 ? 520 : 180,
            timeout: 1800,
        },
    );

    const sortedRows = useMemo(() => {
        if (!tableDataReady) return EMPTY_MANHATTAN_ROWS;
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
    }, [collator, processedRows, sortBy, sortDir, tableDataReady]);

    const pagedRows = useMemo(() => {
        const start = tablePage * tableRowsPerPage;
        return sortedRows.slice(start, start + tableRowsPerPage);
    }, [sortedRows, tablePage, tableRowsPerPage]);
    const shouldRenderTable = useIdleRenderGate(
        !loading && !error && dataReady && processedRows.length > 0,
        `${manhattanKey || 'trait-manhattan-empty'}:${processedRows.length}:${sortedRows.length}`,
        { delay: 220, timeout: 900 },
    );

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
            scrollElementNearViewportCenter(tableSectionRef.current, { viewportOffset: 0.08 });
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
            downloadDataUrl(dataUrl, `${exportBaseName}-${variantLabel}-manhattan.${exportFmt}`);
        });
    }, [exportBaseName, exportFmt, exportHeight, exportWidth, variantLabel]);

    const downloadCSV = useCallback(() => {
        const cols = ['SNP', 'CHR', 'BP', 'P', '-log10(P)', 'Gene', 'distance_to_gene', 'Program', 'Geneset', 'Primary Program', 'Primary Geneset'];
        const header = cols.join(',');
        const body = processedRows.map((row) => [
            row.snp || '', row.normalizedChr, row.bp || '', formatP(row.p), row.logp?.toFixed(4) || '',
            row.nearestGene || '', row.distanceToGene ?? '', row.program || '', row.geneset || '',
            row.primaryProgram || '', row.primaryGeneset || '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
        downloadBlob(blob, `manhattan_${variantLabel}_${exportBaseName}.csv`);
    }, [exportBaseName, processedRows, variantLabel]);

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
            <Box sx={toolbarStyles}>
                <Box sx={{ minWidth: 220, mr: 0.5 }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.35 }}>
                        Trait Manhattan
                    </Typography>
                    <Typography sx={{ fontSize: '1.02rem', fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                        {variantLabel === 'full' ? 'All GWAS Loci Overview' : 'GWAS Hit Loci Overview'}
                    </Typography>
                </Box>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={variantControlValue}
                    onChange={handleVariantChange}
                    sx={compactToggleStyles}
                >
                    <ToggleButton value="hits">Hits TSV</ToggleButton>
                    <ToggleButton value="full" disabled={Boolean(payload) && !payload?.availableVariants?.full}>Full TSV</ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={colorMode}
                    onChange={(_, value) => { if (value) setColorMode(value); }}
                    sx={compactToggleStyles}
                >
                    <ToggleButton value="program">Program</ToggleButton>
                    <ToggleButton value="geneset">Geneset</ToggleButton>
                </ToggleButtonGroup>

                <Chip
                    icon={<ScatterPlot sx={{ fontSize: 15 }} />}
                    label={`${summary.totalRows.toLocaleString()} ${isTruncated ? 'loaded' : (variantLabel === 'full' ? 'loci' : 'hits')}`}
                    size="small"
                    sx={baseChipSx('neutral')}
                />
                <Chip
                    icon={<Insights sx={{ fontSize: 15 }} />}
                    label={`${summary.withProgram.toLocaleString()} program`}
                    size="small"
                    sx={baseChipSx('primary')}
                />
                <Chip
                    icon={<Timeline sx={{ fontSize: 15 }} />}
                    label={`${summary.withGeneset.toLocaleString()} geneset`}
                    size="small"
                    sx={baseChipSx('accent')}
                />
                <Chip
                    icon={<Place sx={{ fontSize: 15 }} />}
                    label={`${summary.distanceBuckets.in_gene.toLocaleString()} in-gene`}
                    size="small"
                    sx={baseChipSx('success')}
                />
                <UpdatingStatus active={isRefreshing} />
            </Box>

            <Box sx={toolbarStyles}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
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

                <FormControl size="small" sx={{ minWidth: 250 }}>
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

                <FormControl size="small" sx={{ minWidth: 180 }}>
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
                    placeholder="e.g. rs11902841"
                    sx={{ width: 190 }}
                />

                <Box sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.1,
                    py: 0.55,
                    borderRadius: 1,
                    border: `1px solid ${programOnly ? alpha(theme.palette.primary.main, 0.28) : theme.custom.border.strong}`,
                    bgcolor: programOnly ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
                    transition: `background-color ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}`,
                }}>
                    <Checkbox checked={programOnly} onChange={(event) => setProgramOnly(event.target.checked)} sx={{ p: 0.3, mr: 0.4 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        Program only
                    </Typography>
                </Box>

                <Button variant="text" startIcon={<RestartAlt />} onClick={handleResetFilters} sx={{ color: theme.palette.text.secondary, minHeight: 38 }}>
                    Reset filters
                </Button>

                <Typography sx={{ width: '100%', fontSize: '0.74rem', color: theme.palette.text.secondary, lineHeight: 1.4 }}>
                    <strong>distance_to_gene:</strong> 0 = in gene body; hundreds or thousands bp = near; 10000+ bp = distal.
                </Typography>
                {isTruncated && (
                    <Typography sx={{ width: '100%', fontSize: '0.74rem', color: theme.palette.warning.dark, lineHeight: 1.4 }}>
                        The backend marked this TSV response as truncated.
                    </Typography>
                )}
            </Box>

            <Box sx={plotFrameSx(theme, { position: 'relative' })}>
                <Box sx={{ p: 0, position: 'relative' }}>
                    {loading && (
                        <Box sx={{ minHeight: MANHATTAN_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Loading Manhattan data from GWAS TSV...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!loading && !error && isPreparingData && (
                        <Box aria-hidden="true" sx={{ minHeight: MANHATTAN_PLOT_HEIGHT }} />
                    )}

                    {!loading && error && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert
                                severity="error"
                                sx={{ maxWidth: 760 }}
                                action={(
                                    <Button
                                        color="inherit"
                                        size="small"
                                        startIcon={<Refresh />}
                                        onClick={() => setRetryKey((key) => key + 1)}
                                    >
                                        Retry
                                    </Button>
                                )}
                            >
                                <Typography variant="body2">
                                    {error?.response?.data?.error || error?.message || 'Failed to load Manhattan data.'}
                                </Typography>
                            </Alert>
                        </Box>
                    )}

                    {!loading && !error && !isPreparingData && rawRows.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="warning" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No Manhattan rows are currently available for this trait.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!loading && !error && dataReady && rawRows.length > 0 && processedRows.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No loci match the current filters.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!loading && !error && processedRows.length > 0 && !afterFirstPaint && (
                        <Box sx={{ minHeight: MANHATTAN_PLOT_HEIGHT }} />
                    )}

                    {!loading && !error && processedRows.length > 0 && afterFirstPaint && (
                            <Box sx={{ position: 'relative', minHeight: MANHATTAN_PLOT_HEIGHT }}>
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
                                style={{ width: '100%', height: MANHATTAN_PLOT_HEIGHT }}
                            />
                            <TraitHitManhattanLegend
                                items={legendItems}
                                collapsed={legendCollapsed}
                                onToggleCollapsed={() => setLegendCollapsed((prev) => !prev)}
                                title={colorModeTitle}
                                anchorPlotRef={plotRef}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
            {shouldRenderTable && (
                <TraitHitManhattanTable
                    tableSectionRef={tableSectionRef}
                    processedRows={processedRows}
                    sortedRows={sortedRows}
                    pagedRows={pagedRows}
                    highlight={highlight}
                    setHighlight={setHighlight}
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
            )}

            <Dialog open={exportOpen} onClose={() => setExportOpen(false)}>
                <DialogTitle sx={{ fontWeight: 700, color: theme.palette.text.primary }}>Export Plot</DialogTitle>
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
                        sx={compactToggleStyles}
                    >
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setExportOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={() => { handleExport(); setExportOpen(false); }}>Export</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
