import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Slider,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Download,
    RestartAlt,
    ZoomIn,
    ZoomOut,
} from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { downloadBlob } from '../utils/download';

const PROGRAM_COLORS = {
    other: '#98a2b3',
    program_enriched: '#f2994a',
    regulator_enriched: '#4f8cc9',
    both_enriched: '#3ca370',
};

const SIDE_META = {
    program: {
        label: 'Program burden selected',
        shortLabel: 'Program',
        scoreLabel: 'Program score',
        accent: '#f2994a',
        softBg: 'rgba(242, 153, 74, 0.08)',
    },
    regulator: {
        label: 'Regulator-burden selected',
        shortLabel: 'Regulator',
        scoreLabel: 'Regulator score',
        accent: '#4f8cc9',
        softBg: 'rgba(79, 140, 201, 0.08)',
    },
};

const GENE_BASE_COLORS = {
    positive: [214, 84, 84],
    negative: [72, 116, 203],
    neutral: [148, 163, 184],
};

const DEFAULT_MAX_GENES = 8;
const SVG_WIDTH = 1520;
const TRAIT_CENTER_X = SVG_WIDTH / 2;
const TRAIT_RADIUS = 92;
const PROGRAM_NODE_W = 136;
const PROGRAM_NODE_H = 48;
const GENE_CARD_W = 198;
const GENE_ROW_H = 24;
const MODULE_GAP = 52;
const GRAPH_TOP_PADDING = 132;
const GRAPH_BOTTOM_PADDING = 132;
const SIDE_PROGRAM_X = {
    program: 458,
    regulator: 1062,
};
const SIDE_GENE_RECT_X = {
    program: 92,
    regulator: SVG_WIDTH - 92 - GENE_CARD_W,
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function toFiniteNumber(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeFileNamePart(value) {
    return String(value || 'trait-program-gene').replace(/[\\/:*?"<>|]+/g, '_');
}

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : 'NA';
}

function blend(base, target, ratio) {
    return base.map((value, index) => Math.round(value + (target[index] - value) * ratio));
}

function geneFill(postMean, absGamma) {
    const gamma = Math.abs(toFiniteNumber(absGamma, 0));
    const intensity = clamp(gamma / 1.5, 0, 1);
    const sign = Number.isFinite(postMean)
        ? (postMean > 0.03 ? 'positive' : (postMean < -0.03 ? 'negative' : 'neutral'))
        : 'neutral';
    const rgb = blend([243, 244, 246], GENE_BASE_COLORS[sign], sign === 'neutral' ? intensity * 0.6 : intensity);
    return `rgb(${rgb.join(',')})`;
}

function getGeneStroke(gene, highlighted) {
    if (highlighted) return '#111827';
    if (gene.isDiscordant) return '#7c3aed';
    return 'rgba(15,23,42,0.18)';
}

function formatProgramTooltip(program) {
    return [
        `Program: ${program.program}`,
        `Selected side: ${program.selectedSide}`,
        `Program score: ${formatNumber(program.programScore)}`,
        `Regulator score: ${formatNumber(program.regulatorScore)}`,
        `Loading genes: ${program.loadingGeneCount}`,
        `Regulator genes: ${program.regulatorGeneCount}`,
        program.annotation ? `Annotation: ${program.annotation}` : null,
        program.emptyReason ? `Note: ${program.emptyReason}` : null,
    ].filter(Boolean).join('\n');
}

function formatGeneTooltip(gene) {
    return [
        `Gene: ${gene.gene}`,
        `ENSG: ${gene.ensg || 'NA'}`,
        `post_mean: ${formatNumber(gene.postMean, 4)}`,
        `abs_gamma: ${formatNumber(gene.absGamma, 4)}`,
        `membership_score: ${formatNumber(gene.membershipScore, 4)}`,
        `predicted_sign: ${gene.predictedSign || 'NA'}`,
        `is_discordant: ${gene.isDiscordant ? 'true' : 'false'}`,
    ].join('\n');
}

function displayGeneLabel(gene) {
    const raw = gene.geneLabel || gene.gene || '';
    if (!gene.isDiscordant) return raw;
    return /^\(.+\)$/.test(raw) ? raw : `(${raw})`;
}

function normalizeGeneLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_MAX_GENES;
    return clamp(Math.round(parsed), 1, 50);
}

function buildExportSvg(svgElement) {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    return `<?xml version="1.0" standalone="no"?>\n${source}`;
}

function exportSvg(svgElement, fileName) {
    const source = buildExportSvg(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, fileName);
}

function exportPng(svgElement, fileName) {
    const source = buildExportSvg(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
        const viewBox = svgElement.viewBox.baseVal;
        const exportWidth = Math.max(1, Math.round((viewBox.width || SVG_WIDTH) * 2));
        const exportHeight = Math.max(1, Math.round((viewBox.height || 1000) * 2));
        const canvas = document.createElement('canvas');
        canvas.width = exportWidth;
        canvas.height = exportHeight;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f6f8fb';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
            if (pngBlob) downloadBlob(pngBlob, fileName);
            URL.revokeObjectURL(url);
        }, 'image/png');
    };

    image.src = url;
}

function useGraphTransform() {
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);
    const suppressClickUntilRef = useRef(0);

    const onPointerDown = useCallback((event) => {
        if (event.target.closest?.('[data-graph-clickable="true"]')) return;

        dragRef.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            startX: transform.x,
            startY: transform.y,
            moved: false,
        };
        setIsDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, [transform.x, transform.y]);

    const onPointerMove = useCallback((event) => {
        if (!dragRef.current || dragRef.current.id !== event.pointerId) return;

        const dx = event.clientX - dragRef.current.x;
        const dy = event.clientY - dragRef.current.y;
        if (!dragRef.current.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            dragRef.current.moved = true;
        }

        setTransform((current) => ({
            ...current,
            x: dragRef.current.startX + dx,
            y: dragRef.current.startY + dy,
        }));
    }, []);

    const onPointerUp = useCallback((event) => {
        if (dragRef.current?.id === event.pointerId) {
            if (dragRef.current.moved) {
                suppressClickUntilRef.current = Date.now() + 180;
            }
            dragRef.current = null;
            setIsDragging(false);
            event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
    }, []);

    const onWheel = useCallback((event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.08 : 0.92;
        setTransform((current) => ({
            ...current,
            scale: clamp(current.scale * factor, 0.5, 2.2),
        }));
    }, []);

    const zoomIn = useCallback(() => {
        setTransform((current) => ({ ...current, scale: clamp(current.scale * 1.12, 0.5, 2.2) }));
    }, []);

    const zoomOut = useCallback(() => {
        setTransform((current) => ({ ...current, scale: clamp(current.scale * 0.9, 0.5, 2.2) }));
    }, []);

    const reset = useCallback(() => {
        setTransform({ x: 0, y: 0, scale: 1 });
        suppressClickUntilRef.current = 0;
    }, []);

    const shouldSuppressClick = useCallback(() => Date.now() < suppressClickUntilRef.current, []);

    return {
        transform,
        isDragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onWheel,
        zoomIn,
        zoomOut,
        reset,
        shouldSuppressClick,
    };
}

function ControlBlock({ title, children }) {
    return (
        <Box sx={{ minWidth: { xs: '100%', sm: 180, lg: 170 } }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475467', mb: 1 }}>
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function ProgramBadge({
    program,
    side,
    selected,
    expanded,
    onSelect,
    onToggle,
}) {
    const sideMeta = SIDE_META[side];
    const score = side === 'program' ? program.programScore : program.regulatorScore;
    const displayCount = program.totalFilteredGenes;
    const totalCount = side === 'program' ? program.loadingTotalCount : program.regulatorTotalCount;

    return (
        <Paper
            variant="outlined"
            onClick={onSelect}
            sx={{
                p: 1.35,
                borderRadius: 2.5,
                borderColor: selected ? sideMeta.accent : 'rgba(15,23,42,0.10)',
                background: selected ? sideMeta.softBg : '#fff',
                cursor: 'pointer',
                transition: 'border-color 160ms ease, background 160ms ease, transform 160ms ease',
                '&:hover': {
                    borderColor: sideMeta.accent,
                    transform: 'translateY(-1px)',
                },
            }}
        >
            <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                        label={program.program}
                        size="small"
                        sx={{
                            bgcolor: PROGRAM_COLORS[program.colorKey] || PROGRAM_COLORS.other,
                            color: '#fff',
                            fontWeight: 700,
                        }}
                    />
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: sideMeta.accent }}>
                        {sideMeta.shortLabel}
                    </Typography>
                </Stack>
                {!program.collapsed && (
                    <Button
                        size="small"
                        variant="text"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggle();
                        }}
                        sx={{ minWidth: 0, px: 1, textTransform: 'none' }}
                    >
                        {expanded ? 'Collapse' : 'Expand'}
                    </Button>
                )}
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.15 }}>
                <Chip
                    label={`score ${formatNumber(score)}`}
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: sideMeta.accent, color: sideMeta.accent, fontWeight: 600 }}
                />
                <Chip
                    label={program.collapsed ? (program.emptyReason || 'No overlap') : `${displayCount}/${totalCount} visible`}
                    size="small"
                    sx={{ bgcolor: '#f4f6f8', color: '#475467' }}
                />
            </Stack>
        </Paper>
    );
}

function computeEdgeStyle(score, highlighted, muted) {
    const absScore = Math.abs(toFiniteNumber(score, 0));
    return {
        width: 1.4 + clamp(absScore, 0, 6) * 1.35,
        opacity: muted ? 0.12 : (highlighted ? 0.94 : 0.28 + clamp(absScore / 6, 0, 1) * 0.40),
    };
}

function buildModuleBlueprints(programs, side, filters, expandedPrograms) {
    const allowedSign = filters.gammaSign;
    const threshold = filters.gammaThreshold;
    const maxGenes = filters.maxGenesPerProgram;

    const modules = programs.map((program) => {
        const genes = [...program.genes[side]];
        const filteredGenes = genes.filter((gene) => {
            if (!gene.hasOverlap) return false;
            if ((gene.absGamma || 0) < threshold) return false;
            if (filters.discordantOnly && !gene.isDiscordant) return false;
            if (allowedSign === 'positive' && gene.gammaSign !== 'positive') return false;
            if (allowedSign === 'negative' && gene.gammaSign !== 'negative') return false;
            return true;
        });

        const expanded = expandedPrograms.has(`${program.program}:${side}`);
        const visibleGenes = expanded ? filteredGenes : filteredGenes.slice(0, maxGenes);
        const visibleGeneCount = program.collapsed ? 0 : visibleGenes.length;
        const height = program.collapsed
            ? 84
            : Math.max(PROGRAM_NODE_H + 30, visibleGeneCount * GENE_ROW_H + 30);

        return {
            ...program,
            side,
            expanded,
            height,
            totalFilteredGenes: filteredGenes.length,
            filteredGeneKeys: filteredGenes.map((gene) => gene.highlightKey),
            visibleGenes,
        };
    });

    const contentHeight = modules.length
        ? modules.reduce((sum, module) => sum + module.height, 0) + ((modules.length - 1) * MODULE_GAP)
        : 0;

    return { modules, contentHeight };
}

function positionModules(modules, side, traitCenterY) {
    const contentHeight = modules.length
        ? modules.reduce((sum, module) => sum + module.height, 0) + ((modules.length - 1) * MODULE_GAP)
        : 0;
    const startY = Math.max(GRAPH_TOP_PADDING, traitCenterY - (contentHeight / 2));
    let cursorY = startY;

    const positionedModules = modules.map((module) => {
        const positioned = {
            ...module,
            xProgram: SIDE_PROGRAM_X[side],
            rectXGenes: SIDE_GENE_RECT_X[side],
            yTop: cursorY,
            yCenter: cursorY + (module.height / 2),
        };
        cursorY += module.height + MODULE_GAP;
        return positioned;
    });

    return {
        modules: positionedModules,
        contentHeight,
        bottomY: cursorY,
    };
}

export default function TraitProgramGraph({ fileId }) {
    const { data, error, isLoading } = useSWR(
        fileId ? `/api/programs/${fileId}/graph` : null,
        fetcher,
    );
    const graph = data;
    const svgRef = useRef(null);

    const [gammaThreshold, setGammaThreshold] = useState(0);
    const [maxGenesPerProgram, setMaxGenesPerProgram] = useState(DEFAULT_MAX_GENES);
    const [discordantOnly, setDiscordantOnly] = useState(false);
    const [gammaSign, setGammaSign] = useState('all');
    const [sideFilter, setSideFilter] = useState('both');
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedGene, setSelectedGene] = useState(null);
    const [expandedPrograms, setExpandedPrograms] = useState(() => new Set());
    const [hoverProgram, setHoverProgram] = useState(null);
    const [hoverGene, setHoverGene] = useState(null);

    const transformApi = useGraphTransform();

    const filters = useMemo(() => ({
        gammaThreshold,
        maxGenesPerProgram: normalizeGeneLimit(maxGenesPerProgram),
        discordantOnly,
        gammaSign,
        sideFilter,
    }), [discordantOnly, gammaSign, gammaThreshold, maxGenesPerProgram, sideFilter]);

    useEffect(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
        setExpandedPrograms(new Set());
        transformApi.reset();
    }, [fileId, transformApi]);

    const leftPrograms = useMemo(() => graph?.layout?.leftPrograms || [], [graph]);
    const rightPrograms = useMemo(() => graph?.layout?.rightPrograms || [], [graph]);
    const hiddenPrograms = useMemo(() => graph?.layout?.hiddenPrograms || [], [graph]);

    const leftBlueprint = useMemo(
        () => buildModuleBlueprints(leftPrograms, 'program', filters, expandedPrograms),
        [expandedPrograms, filters, leftPrograms],
    );
    const rightBlueprint = useMemo(
        () => buildModuleBlueprints(rightPrograms, 'regulator', filters, expandedPrograms),
        [expandedPrograms, filters, rightPrograms],
    );

    const svgHeight = useMemo(() => {
        const contentHeight = Math.max(leftBlueprint.contentHeight, rightBlueprint.contentHeight, 560);
        return Math.max(860, Math.ceil(contentHeight + GRAPH_TOP_PADDING + GRAPH_BOTTOM_PADDING));
    }, [leftBlueprint.contentHeight, rightBlueprint.contentHeight]);
    const traitCenterY = useMemo(() => Math.round(svgHeight / 2), [svgHeight]);

    const leftLayout = useMemo(
        () => positionModules(leftBlueprint.modules, 'program', traitCenterY),
        [leftBlueprint.modules, traitCenterY],
    );
    const rightLayout = useMemo(
        () => positionModules(rightBlueprint.modules, 'regulator', traitCenterY),
        [rightBlueprint.modules, traitCenterY],
    );

    const allModules = useMemo(
        () => [...leftLayout.modules, ...rightLayout.modules],
        [leftLayout.modules, rightLayout.modules],
    );

    const allGenes = useMemo(() => {
        const genes = [];
        (graph?.programs || []).forEach((program) => {
            genes.push(...program.genes.program, ...program.genes.regulator);
        });
        return genes;
    }, [graph]);

    const geneOccurrences = useMemo(() => {
        const map = new Map();
        allGenes.forEach((gene) => {
            const key = gene.highlightKey;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(gene);
        });
        return map;
    }, [allGenes]);

    const selectedGeneKey = selectedGene?.highlightKey || null;

    const visibleSides = useMemo(() => {
        if (sideFilter === 'program') return new Set(['program']);
        if (sideFilter === 'regulator') return new Set(['regulator']);
        return new Set(['program', 'regulator']);
    }, [sideFilter]);

    useEffect(() => {
        if (!selectedProgram) return;
        const stillVisible = allModules.some((module) => visibleSides.has(module.side) && module.program === selectedProgram);
        if (!stillVisible) setSelectedProgram(null);
    }, [allModules, selectedProgram, visibleSides]);

    useEffect(() => {
        if (!selectedGeneKey) return;
        const stillVisible = allModules.some(
            (module) => visibleSides.has(module.side) && module.filteredGeneKeys.includes(selectedGeneKey),
        );
        if (!stillVisible) setSelectedGene(null);
    }, [allModules, selectedGeneKey, visibleSides]);

    const toggleExpanded = useCallback((program, side) => {
        setExpandedPrograms((current) => {
            const next = new Set(current);
            const key = `${program}:${side}`;
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const handleSelectProgram = useCallback((program) => {
        if (transformApi.shouldSuppressClick()) return;
        setSelectedProgram((current) => (current === program ? null : program));
        setSelectedGene(null);
    }, [transformApi]);

    const handleSelectGene = useCallback((gene) => {
        if (transformApi.shouldSuppressClick()) return;

        const nextKey = selectedGeneKey === gene.highlightKey ? null : gene.highlightKey;
        setSelectedProgram(null);
        setSelectedGene((current) => (current?.highlightKey === gene.highlightKey ? null : gene));

        if (!nextKey) return;

        setExpandedPrograms((current) => {
            const next = new Set(current);
            (graph?.programs || []).forEach((program) => {
                ['program', 'regulator'].forEach((side) => {
                    if ((program.genes[side] || []).some((entry) => entry.highlightKey === nextKey)) {
                        next.add(`${program.program}:${side}`);
                    }
                });
            });
            return next;
        });
    }, [graph, selectedGeneKey, transformApi]);

    const clearSelection = useCallback(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
    }, []);

    const selectedProgramNode = useMemo(
        () => graph?.programs?.find((program) => program.program === selectedProgram) || null,
        [graph, selectedProgram],
    );
    const selectedGeneOccurrences = useMemo(
        () => (selectedGeneKey ? (geneOccurrences.get(selectedGeneKey) || []) : []),
        [geneOccurrences, selectedGeneKey],
    );
    const selectedGenePrograms = useMemo(
        () => [...new Set(selectedGeneOccurrences.map((gene) => gene.program))],
        [selectedGeneOccurrences],
    );

    const inspectorGene = hoverGene || selectedGene;
    const inspectorProgram = hoverProgram || selectedProgramNode;

    const renderModule = useCallback((module) => {
        if (!visibleSides.has(module.side)) return null;

        const side = module.side;
        const sideMeta = SIDE_META[side];
        const score = side === 'program' ? module.programScore : module.regulatorScore;
        const direction = side === 'program' ? module.edgeMeta.program.direction : module.edgeMeta.regulator.direction;
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const edgeHighlighted = isProgramSelected || moduleGeneMatches;
        const muted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const edgeStyle = computeEdgeStyle(score, edgeHighlighted, muted);

        const programX = module.xProgram;
        const centerY = module.yCenter;
        const programRectX = programX - (PROGRAM_NODE_W / 2);
        const programRectY = centerY - (PROGRAM_NODE_H / 2);
        const edgeStartX = side === 'program' ? programX + (PROGRAM_NODE_W / 2) : programX - (PROGRAM_NODE_W / 2);
        const edgeEndX = TRAIT_CENTER_X + (side === 'program' ? -TRAIT_RADIUS + 4 : TRAIT_RADIUS - 4);
        const geneRectX = module.rectXGenes;
        const textAnchor = side === 'program' ? 'start' : 'end';
        const leaderStartX = side === 'program' ? geneRectX + GENE_CARD_W : geneRectX;
        const leaderEndX = side === 'program' ? programRectX : programRectX + PROGRAM_NODE_W;
        const edgeColor = sideMeta.accent;

        return (
            <g key={`${module.program}:${side}`}>
                <line
                    x1={edgeStartX}
                    y1={centerY}
                    x2={edgeEndX}
                    y2={traitCenterY}
                    stroke={edgeColor}
                    strokeWidth={edgeStyle.width}
                    strokeOpacity={edgeStyle.opacity}
                    strokeLinecap="round"
                />
                {direction === 'arrow' ? (
                    <polygon
                        points={side === 'program'
                            ? `${edgeEndX},${traitCenterY} ${edgeEndX - 14},${traitCenterY - 8} ${edgeEndX - 14},${traitCenterY + 8}`
                            : `${edgeEndX},${traitCenterY} ${edgeEndX + 14},${traitCenterY - 8} ${edgeEndX + 14},${traitCenterY + 8}`}
                        fill={edgeColor}
                        fillOpacity={edgeStyle.opacity}
                    />
                ) : (
                    <line
                        x1={edgeEndX}
                        y1={traitCenterY - 12}
                        x2={edgeEndX}
                        y2={traitCenterY + 12}
                        stroke={edgeColor}
                        strokeWidth={Math.max(2, edgeStyle.width * 0.9)}
                        strokeOpacity={edgeStyle.opacity}
                    />
                )}

                <g
                    data-graph-clickable="true"
                    onClick={() => handleSelectProgram(module.program)}
                    onMouseEnter={() => setHoverProgram(module)}
                    onMouseLeave={() => setHoverProgram(null)}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={programRectX}
                        y={programRectY}
                        width={PROGRAM_NODE_W}
                        height={PROGRAM_NODE_H}
                        rx={12}
                        fill={PROGRAM_COLORS[module.colorKey] || PROGRAM_COLORS.other}
                        fillOpacity={muted ? 0.32 : 0.94}
                        stroke={isProgramSelected ? '#111827' : 'rgba(15,23,42,0.14)'}
                        strokeWidth={isProgramSelected ? 3 : 1.4}
                        filter="url(#moduleShadow)"
                    />
                    <text
                        x={programX}
                        y={centerY - 4}
                        textAnchor="middle"
                        fontSize="15"
                        fontWeight="700"
                        fill="#fff"
                    >
                        {module.program}
                    </text>
                    <text
                        x={programX}
                        y={centerY + 14}
                        textAnchor="middle"
                        fontSize="10.5"
                        fill="rgba(255,255,255,0.90)"
                    >
                        {`${formatNumber(score, 2)}  ${side === 'program' ? 'L' : 'R'} ${side === 'program' ? module.loadingGeneCount : module.regulatorGeneCount}`}
                    </text>
                    <title>{formatProgramTooltip(module)}</title>
                </g>

                {module.collapsed ? (
                    <g>
                        <rect
                            x={geneRectX}
                            y={centerY - 16}
                            width={GENE_CARD_W}
                            height={32}
                            rx={11}
                            fill="#fff"
                            stroke="rgba(15,23,42,0.12)"
                        />
                        <text
                            x={side === 'program' ? geneRectX + 12 : geneRectX + GENE_CARD_W - 12}
                            y={centerY + 4}
                            textAnchor={textAnchor}
                            fontSize="12"
                            fill="#667085"
                        >
                            {module.emptyReason || 'No overlap'}
                        </text>
                    </g>
                ) : (
                    <g>
                        {module.visibleGenes.map((gene, index) => {
                            const rowY = module.yTop + 18 + (index * GENE_ROW_H);
                            const rectX = geneRectX;
                            const rectY = rowY - 14;
                            const textX = side === 'program' ? rectX + 12 : rectX + GENE_CARD_W - 12;
                            const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
                            const geneProgramSelected = selectedProgram === module.program;
                            const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected) || (Boolean(selectedGeneKey) && !geneMatched);

                            return (
                                <g key={gene.id}>
                                    <line
                                        x1={leaderStartX}
                                        y1={rowY - 1}
                                        x2={leaderEndX}
                                        y2={centerY}
                                        stroke={sideMeta.accent}
                                        strokeOpacity={geneMuted ? 0.06 : (geneMatched || geneProgramSelected ? 0.42 : 0.15)}
                                        strokeWidth={geneMatched || geneProgramSelected ? 1.6 : 1}
                                    />
                                    <g
                                        data-graph-clickable="true"
                                        onClick={() => handleSelectGene(gene)}
                                        onMouseEnter={() => setHoverGene(gene)}
                                        onMouseLeave={() => setHoverGene(null)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <rect
                                            x={rectX}
                                            y={rectY}
                                            width={GENE_CARD_W}
                                            height={20}
                                            rx={6}
                                            fill={geneFill(gene.postMean, gene.absGamma)}
                                            fillOpacity={geneMuted ? 0.24 : 0.94}
                                            stroke={getGeneStroke(gene, geneMatched)}
                                            strokeWidth={geneMatched ? 2.2 : (gene.isDiscordant ? 1.4 : 0.9)}
                                            strokeDasharray={gene.isDiscordant ? '5 3' : undefined}
                                        />
                                        <text
                                            x={textX}
                                            y={rowY}
                                            textAnchor={textAnchor}
                                            fontSize="11.5"
                                            fontStyle={gene.isDiscordant ? 'italic' : 'normal'}
                                            fontWeight={geneMatched ? 700 : 500}
                                            fill={geneMuted ? '#98a2b3' : '#0f172a'}
                                        >
                                            {displayGeneLabel(gene)}
                                        </text>
                                        <title>{formatGeneTooltip(gene)}</title>
                                    </g>
                                </g>
                            );
                        })}
                    </g>
                )}
            </g>
        );
    }, [
        handleSelectGene,
        handleSelectProgram,
        selectedGeneKey,
        selectedProgram,
        traitCenterY,
        visibleSides,
    ]);

    const hiddenCollapsedCount = hiddenPrograms.filter((program) => program.collapsed || !program.hasOverlap).length;

    if (isLoading) {
        return (
            <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">Failed to load trait program graph.</Alert>;
    }

    if (!graph?.programs?.length) {
        return <Alert severity="info">No trait program graph data available.</Alert>;
    }

    return (
        <Stack spacing={2.5}>
            <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={2.5} alignItems={{ xs: 'stretch', xl: 'flex-start' }}>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2.25}
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ flex: 1 }}
                        >
                            <ControlBlock title="Gamma threshold">
                                <Slider
                                    min={0}
                                    max={2}
                                    step={0.05}
                                    value={gammaThreshold}
                                    onChange={(_event, value) => setGammaThreshold(value)}
                                    valueLabelDisplay="auto"
                                    size="small"
                                />
                            </ControlBlock>

                            <ControlBlock title="Max genes / program">
                                <Slider
                                    min={1}
                                    max={24}
                                    step={1}
                                    value={maxGenesPerProgram}
                                    onChange={(_event, value) => setMaxGenesPerProgram(value)}
                                    valueLabelDisplay="auto"
                                    size="small"
                                />
                            </ControlBlock>

                            <ControlBlock title="Gamma sign">
                                <FormControl fullWidth size="small">
                                    <InputLabel id="gamma-sign-label">Gamma sign</InputLabel>
                                    <Select
                                        labelId="gamma-sign-label"
                                        value={gammaSign}
                                        label="Gamma sign"
                                        onChange={(event) => setGammaSign(event.target.value)}
                                    >
                                        <MenuItem value="all">All</MenuItem>
                                        <MenuItem value="positive">Positive only</MenuItem>
                                        <MenuItem value="negative">Negative only</MenuItem>
                                    </Select>
                                </FormControl>
                            </ControlBlock>

                            <ControlBlock title="Visible side">
                                <FormControl fullWidth size="small">
                                    <InputLabel id="side-filter-label">Side</InputLabel>
                                    <Select
                                        labelId="side-filter-label"
                                        value={sideFilter}
                                        label="Side"
                                        onChange={(event) => setSideFilter(event.target.value)}
                                    >
                                        <MenuItem value="both">Program + regulator</MenuItem>
                                        <MenuItem value="program">Program only</MenuItem>
                                        <MenuItem value="regulator">Regulator only</MenuItem>
                                    </Select>
                                </FormControl>
                            </ControlBlock>

                            <ControlBlock title="Flags">
                                <FormControlLabel
                                    control={(
                                        <Switch
                                            checked={discordantOnly}
                                            onChange={(event) => setDiscordantOnly(event.target.checked)}
                                        />
                                    )}
                                    label="Discordant only"
                                    sx={{ mt: 0.2 }}
                                />
                            </ControlBlock>
                        </Stack>

                        <Stack
                            direction="row"
                            spacing={1}
                            flexWrap="wrap"
                            useFlexGap
                            justifyContent={{ xs: 'flex-start', xl: 'flex-end' }}
                            sx={{ minWidth: { xl: 280 } }}
                        >
                            <Tooltip title="Zoom in">
                                <Button size="small" variant="outlined" onClick={transformApi.zoomIn} startIcon={<ZoomIn />}>
                                    Zoom
                                </Button>
                            </Tooltip>
                            <Tooltip title="Zoom out">
                                <Button size="small" variant="outlined" onClick={transformApi.zoomOut} startIcon={<ZoomOut />}>
                                    Out
                                </Button>
                            </Tooltip>
                            <Button size="small" variant="outlined" onClick={transformApi.reset} startIcon={<RestartAlt />}>
                                Reset view
                            </Button>
                            <Button size="small" variant="outlined" onClick={clearSelection}>
                                Clear highlight
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Download />}
                                onClick={() => svgRef.current && exportSvg(svgRef.current, `${sanitizeFileNamePart(fileId)}_trait_program_gene.svg`)}
                            >
                                SVG
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<Download />}
                                onClick={() => svgRef.current && exportPng(svgRef.current, `${sanitizeFileNamePart(fileId)}_trait_program_gene.png`)}
                            >
                                PNG
                            </Button>
                        </Stack>
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label={`Programs ${graph.counts.totalPrograms}`} size="small" />
                        <Chip
                            label={`Left ${graph.counts.leftPrograms}`}
                            size="small"
                            sx={{ color: SIDE_META.program.accent, borderColor: SIDE_META.program.accent }}
                            variant="outlined"
                        />
                        <Chip
                            label={`Right ${graph.counts.rightPrograms}`}
                            size="small"
                            sx={{ color: SIDE_META.regulator.accent, borderColor: SIDE_META.regulator.accent }}
                            variant="outlined"
                        />
                        <Chip label={`Hidden ${graph.counts.hiddenPrograms}`} size="small" variant="outlined" />
                        <Chip label={`No overlap ${hiddenCollapsedCount}`} size="small" variant="outlined" />
                        {selectedProgram && (
                            <Chip
                                label={`Program ${selectedProgram}`}
                                color="warning"
                                size="small"
                                onDelete={() => setSelectedProgram(null)}
                            />
                        )}
                        {selectedGeneKey && (
                            <Chip
                                label={`Gene ${selectedGene?.geneLabel || selectedGene?.gene || selectedGeneKey} in ${selectedGeneOccurrences.length} rows`}
                                color="primary"
                                size="small"
                                onDelete={() => setSelectedGene(null)}
                            />
                        )}
                    </Stack>
                </CardContent>
            </Card>

            <Paper
                variant="outlined"
                sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    borderColor: 'rgba(15,23,42,0.10)',
                    background: '#fff',
                }}
            >
                <Box
                    sx={{
                        px: { xs: 2, md: 2.5 },
                        py: 2,
                        borderBottom: '1px solid rgba(15,23,42,0.06)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 2,
                        flexWrap: 'wrap',
                    }}
                >
                    <Box>
                        <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: 26, lineHeight: 1.1 }}>
                            Trait-Program-Gene graph
                        </Typography>
                        <Typography sx={{ mt: 0.6, fontSize: 13.5, color: '#667085', maxWidth: 880 }}>
                            Program-selected modules stay on the left and regulator-selected modules stay on the right.
                            Click a program to follow its burden connection. Click a gene to trace that gene across modules.
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {visibleSides.has('program') && (
                            <Chip
                                label={`${SIDE_META.program.shortLabel} modules ${leftLayout.modules.length}`}
                                size="small"
                                sx={{ bgcolor: SIDE_META.program.softBg, color: SIDE_META.program.accent, fontWeight: 700 }}
                            />
                        )}
                        {visibleSides.has('regulator') && (
                            <Chip
                                label={`${SIDE_META.regulator.shortLabel} modules ${rightLayout.modules.length}`}
                                size="small"
                                sx={{ bgcolor: SIDE_META.regulator.softBg, color: SIDE_META.regulator.accent, fontWeight: 700 }}
                            />
                        )}
                    </Stack>
                </Box>

                <Box
                    sx={{
                        px: { xs: 1, md: 2 },
                        py: 2,
                        background: 'linear-gradient(180deg, #fbfcfe 0%, #f3f6fb 100%)',
                        cursor: transformApi.isDragging ? 'grabbing' : 'grab',
                        touchAction: 'none',
                        userSelect: 'none',
                    }}
                    onPointerDown={transformApi.onPointerDown}
                    onPointerMove={transformApi.onPointerMove}
                    onPointerUp={transformApi.onPointerUp}
                    onPointerLeave={transformApi.onPointerUp}
                    onWheel={transformApi.onWheel}
                >
                    <svg
                        ref={svgRef}
                        width="100%"
                        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                    >
                        <defs>
                            <filter id="traitShadow" x="-60%" y="-60%" width="220%" height="220%">
                                <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="rgba(15,23,42,0.24)" />
                            </filter>
                            <filter id="moduleShadow" x="-40%" y="-40%" width="180%" height="180%">
                                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="rgba(15,23,42,0.12)" />
                            </filter>
                            <linearGradient id="traitRing" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#1f2937" />
                                <stop offset="100%" stopColor="#0f172a" />
                            </linearGradient>
                        </defs>

                        <g transform={`translate(${transformApi.transform.x} ${transformApi.transform.y}) scale(${transformApi.transform.scale})`}>
                            <text x="92" y="56" fontSize="17" fontWeight="700" fill={SIDE_META.program.accent}>
                                {SIDE_META.program.label}
                            </text>
                            <text
                                x={SVG_WIDTH - 92}
                                y="56"
                                textAnchor="end"
                                fontSize="17"
                                fontWeight="700"
                                fill={SIDE_META.regulator.accent}
                            >
                                {SIDE_META.regulator.label}
                            </text>

                            <g filter="url(#traitShadow)">
                                <circle cx={TRAIT_CENTER_X} cy={traitCenterY} r={TRAIT_RADIUS + 12} fill="rgba(15,23,42,0.10)" />
                                <circle cx={TRAIT_CENTER_X} cy={traitCenterY} r={TRAIT_RADIUS} fill="url(#traitRing)" />
                            </g>
                            <text
                                x={TRAIT_CENTER_X}
                                y={traitCenterY - 6}
                                textAnchor="middle"
                                fontSize="18"
                                fontWeight="700"
                                fill="#fff"
                            >
                                {graph.traitNode.label}
                            </text>
                            <text
                                x={TRAIT_CENTER_X}
                                y={traitCenterY + 20}
                                textAnchor="middle"
                                fontSize="12"
                                fill="rgba(255,255,255,0.82)"
                            >
                                trait
                            </text>

                            {leftLayout.modules.map(renderModule)}
                            {rightLayout.modules.map(renderModule)}
                        </g>
                    </svg>
                </Box>
            </Paper>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1.45fr 1fr 1fr' },
                    gap: 2.5,
                    alignItems: 'start',
                }}
            >
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 1.6 }}>
                        Program modules
                    </Typography>
                    <Stack spacing={2}>
                        {visibleSides.has('program') && (
                            <Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: SIDE_META.program.accent, mb: 1 }}>
                                    Program side
                                </Typography>
                                <Stack spacing={1}>
                                    {leftLayout.modules.map((module) => (
                                        <ProgramBadge
                                            key={`${module.program}:program`}
                                            program={module}
                                            side="program"
                                            selected={selectedProgram === module.program}
                                            expanded={module.expanded}
                                            onSelect={() => handleSelectProgram(module.program)}
                                            onToggle={() => toggleExpanded(module.program, 'program')}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {visibleSides.has('regulator') && (
                            <Box>
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: SIDE_META.regulator.accent, mb: 1 }}>
                                    Regulator side
                                </Typography>
                                <Stack spacing={1}>
                                    {rightLayout.modules.map((module) => (
                                        <ProgramBadge
                                            key={`${module.program}:regulator`}
                                            program={module}
                                            side="regulator"
                                            selected={selectedProgram === module.program}
                                            expanded={module.expanded}
                                            onSelect={() => handleSelectProgram(module.program)}
                                            onToggle={() => toggleExpanded(module.program, 'regulator')}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 1.6 }}>
                        Inspector
                    </Typography>

                    {inspectorGene ? (
                        <Stack spacing={1}>
                            <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                                {inspectorGene.gene}
                            </Typography>
                            <Typography sx={{ fontSize: 12.5, color: '#667085' }}>
                                Seen in {selectedGeneOccurrences.length || 1} rows across {selectedGenePrograms.length || 1} programs.
                            </Typography>
                            <Divider />
                            <Typography component="pre" sx={{ m: 0, fontSize: 12, lineHeight: 1.65, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                {formatGeneTooltip(inspectorGene)}
                            </Typography>
                            {selectedGenePrograms.length > 0 && (
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {selectedGenePrograms.map((program) => (
                                        <Chip key={program} label={program} size="small" variant="outlined" />
                                    ))}
                                </Stack>
                            )}
                        </Stack>
                    ) : inspectorProgram ? (
                        <Stack spacing={1}>
                            <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                                {inspectorProgram.program}
                            </Typography>
                            <Chip
                                label={inspectorProgram.selectedSide}
                                size="small"
                                sx={{
                                    alignSelf: 'flex-start',
                                    bgcolor: inspectorProgram.selectedSide === 'program'
                                        ? SIDE_META.program.softBg
                                        : SIDE_META.regulator.softBg,
                                    color: inspectorProgram.selectedSide === 'program'
                                        ? SIDE_META.program.accent
                                        : SIDE_META.regulator.accent,
                                    fontWeight: 700,
                                }}
                            />
                            <Divider />
                            <Typography component="pre" sx={{ m: 0, fontSize: 12, lineHeight: 1.65, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                {formatProgramTooltip(inspectorProgram)}
                            </Typography>
                        </Stack>
                    ) : (
                        <Typography sx={{ fontSize: 13, color: '#667085', lineHeight: 1.7 }}>
                            Hover a node for quick values, or click a program or gene to lock the inspection panel and highlight the corresponding structure.
                        </Typography>
                    )}
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 1.6 }}>
                        Legend
                    </Typography>

                    <Stack spacing={1.25}>
                        {Object.entries(PROGRAM_COLORS).map(([key, value]) => (
                            <Stack key={key} direction="row" spacing={1} alignItems="center">
                                <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: value }} />
                                <Typography sx={{ fontSize: 13, color: '#475467' }}>{key}</Typography>
                            </Stack>
                        ))}

                        <Divider sx={{ my: 0.25 }} />

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 18, borderRadius: 1, bgcolor: 'rgb(228,127,127)', border: '1px solid rgba(15,23,42,0.12)' }} />
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Positive post_mean
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 18, borderRadius: 1, bgcolor: 'rgb(131,158,218)', border: '1px solid rgba(15,23,42,0.12)' }} />
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Negative post_mean
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 18, borderRadius: 1, bgcolor: 'rgb(218,224,231)', border: '1px solid rgba(15,23,42,0.12)' }} />
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Near-zero post_mean
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 18, borderRadius: 1, bgcolor: '#f7f7ff', border: '1px dashed #7c3aed' }} />
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Discordant gene
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 0, borderTop: '3px solid #f2994a', position: 'relative' }}>
                                <Box sx={{ position: 'absolute', right: -2, top: -6, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid #f2994a' }} />
                            </Box>
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Positive score points toward the trait
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 0, borderTop: '3px solid #4f8cc9', position: 'relative' }}>
                                <Box sx={{ position: 'absolute', right: -1, top: -8, width: 3, height: 16, bgcolor: '#4f8cc9' }} />
                            </Box>
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Negative score ends with a flat cap
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Stack>
    );
}
