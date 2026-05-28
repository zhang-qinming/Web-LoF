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
import TraitProgramGraphSummary from './TraitProgramGraphSummary';

const PROGRAM_COLORS = {
    other: '#98a2b3',
    program_enriched: '#f2994a',
    regulator_enriched: '#4f8cc9',
    both_enriched: '#3ca370',
};

const PROGRAM_SELECTION_LABELS = {
    other: 'Other',
    program_enriched: 'program',
    regulator_enriched: 'regulator',
    both_enriched: 'both',
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
        label: 'Regulator-program selected',
        shortLabel: 'Regulator',
        scoreLabel: 'Regulator score',
        accent: '#4f8cc9',
        softBg: 'rgba(79, 140, 201, 0.08)',
    },
};

const EFFECT_COLORS = {
    positive: '#ef4e2f',
    negative: '#347dcc',
    neutral: '#6b7280',
};

const DEFAULT_MAX_GENES = 8;
const SVG_WIDTH = 1680;
const TRAIT_CENTER_X = 560;
const TRAIT_NODE_W = 232;
const TRAIT_NODE_MIN_H = 128;
const LEFT_PROGRAM_X = 24;
const LEFT_PROGRAM_W = 266;
const RIGHT_PROGRAM_X = 820;
const RIGHT_PROGRAM_W = 266;
const RIGHT_PROGRAM_H = 62;
const RIGHT_REGULATOR_X = 1234;
const RIGHT_REGULATOR_W = 310;
const GENE_ROW_H = 25;
const MODULE_GAP = 42;
const REGULATOR_GROUP_GAP = 18;
const GRAPH_TOP_PADDING = 168;
const GRAPH_BOTTOM_PADDING = 96;
const BOX_STROKE = '#8c8c8c';
const TRAIT_PORT_INSET = 22;
const EDGE_TARGET_GAP = 28;

const INLINE_LEGEND_GROUPS = [
    {
        label: 'Gene',
        items: [
            { label: 'post_mean +', color: EFFECT_COLORS.positive },
            { label: 'post_mean -', color: EFFECT_COLORS.negative },
        ],
    },
    {
        label: 'Selected by',
        items: [
            { label: 'program', color: PROGRAM_COLORS.program_enriched },
            { label: 'regulator', color: PROGRAM_COLORS.regulator_enriched },
            { label: 'both', color: PROGRAM_COLORS.both_enriched },
        ],
    },
];

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

function formatProgramTooltip(program) {
    return [
        `Program: ${program.program}`,
        `Selected by: ${programSelectionLabel(program)}`,
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
        `program_trait_sign: ${gene.programTraitSign || 'NA'}`,
        `regulator_program_sign: ${gene.regulatorProgramSign || 'NA'}`,
        `predicted_sign: ${gene.predictedSign || 'NA'}`,
        `display_bucket: ${gene.displayBucket || 'NA'}`,
        `display_column: ${gene.displayColumn || 'NA'}`,
        `is_concordant: ${gene.isConcordant ? 'true' : 'false'}`,
        `is_discordant: ${gene.isDiscordant ? 'true' : 'false'}`,
    ].join('\n');
}

function displayGeneLabel(gene) {
    const raw = gene.geneLabel || gene.gene || '';
    if (!gene.isDiscordant) return raw;
    return /^\(.+\)$/.test(raw) ? raw : `(${raw})`;
}

function effectSignFromValue(value) {
    const parsed = toFiniteNumber(value, 0);
    if (parsed > 0.03) return 'positive';
    if (parsed < -0.03) return 'negative';
    return 'neutral';
}

function effectSignFromGene(gene) {
    if (gene.postMeanSign === 'positive' || gene.postMeanSign === 'negative') {
        return gene.postMeanSign;
    }
    return effectSignFromValue(gene.postMean);
}

function effectColorFromGene(gene) {
    return EFFECT_COLORS[effectSignFromGene(gene)];
}

function programSelectionKey(program) {
    if (program.selectedByProgram && program.selectedByRegulator) return 'both_enriched';
    if (program.selectedByProgram) return 'program_enriched';
    if (program.selectedByRegulator) return 'regulator_enriched';
    return 'other';
}

function programColor(program) {
    return PROGRAM_COLORS[programSelectionKey(program)] || PROGRAM_COLORS.other;
}

function programSelectionLabel(program) {
    return PROGRAM_SELECTION_LABELS[programSelectionKey(program)] || 'Other';
}

function programFillOpacity(program, muted) {
    if (muted) return 0.2;
    return programSelectionKey(program) === 'other' ? 0.12 : 0.42;
}

function programStripeOpacity(program, muted) {
    if (programSelectionKey(program) === 'other') return muted ? 0.18 : 0.32;
    return muted ? 0.38 : 0.95;
}

function displayColumnFromGene(gene) {
    if (gene.displayColumn === 'left' || gene.displayColumn === 'right') {
        return gene.displayColumn;
    }

    return effectSignFromGene(gene) === 'negative' ? 'right' : 'left';
}

function sortGenesWithinColumn(genes) {
    return [...genes].sort((a, b) => {
        const columnRankDelta = (a.displayColumnRank || Number.MAX_SAFE_INTEGER) - (b.displayColumnRank || Number.MAX_SAFE_INTEGER);
        if (columnRankDelta !== 0) return columnRankDelta;
        return (a.displayRank || Number.MAX_SAFE_INTEGER) - (b.displayRank || Number.MAX_SAFE_INTEGER);
    });
}

function edgeColorFromScore(score) {
    return toFiniteNumber(score, 0) >= 0 ? EFFECT_COLORS.positive : EFFECT_COLORS.negative;
}

function directionFromScore(score) {
    const parsed = toFiniteNumber(score, 0);
    if (parsed < 0) return 'flat';
    return 'arrow';
}

function normalizeEffectSign(value) {
    if (value === 'positive' || value === 'negative') return value;
    return null;
}

function edgeColorFromSign(sign, fallbackScore) {
    const normalized = normalizeEffectSign(sign);
    return normalized ? EFFECT_COLORS[normalized] : edgeColorFromScore(fallbackScore);
}

function directionFromSign(sign, fallbackScore) {
    const normalized = normalizeEffectSign(sign);
    if (normalized === 'negative') return 'flat';
    if (normalized === 'positive') return 'arrow';
    return directionFromScore(fallbackScore);
}

function splitGenesByEffect(genes) {
    const columns = genes.reduce((acc, gene) => {
        const column = displayColumnFromGene(gene);
        if (column === 'right') acc.right.push(gene);
        else acc.left.push(gene);
        return acc;
    }, { left: [], right: [] });

    return {
        left: sortGenesWithinColumn(columns.left),
        right: sortGenesWithinColumn(columns.right),
    };
}

function regulatorSignFromGene(gene) {
    if (gene.displayBucket === 'negative_regulators') return 'negative';
    if (gene.displayBucket === 'positive_regulators') return 'positive';
    return gene.regulatorProgramSign === 'negative' ? 'negative' : 'positive';
}

function groupRegulatorGenesByBucket(genes) {
    const groups = genes.reduce((map, gene) => {
        const regulatorSign = regulatorSignFromGene(gene);
        const bucket = `${regulatorSign}_regulators`;
        if (!map.has(bucket)) {
            map.set(bucket, {
                key: bucket,
                sign: regulatorSign,
                title: regulatorSign === 'negative' ? 'Negative regulators' : 'Positive regulators',
                genes: [],
            });
        }
        map.get(bucket).genes.push(gene);
        return map;
    }, new Map());

    return [...groups.values()]
        .map((group) => ({
            ...group,
            genes: [...group.genes].sort((a, b) => (a.displayRank || Number.MAX_SAFE_INTEGER) - (b.displayRank || Number.MAX_SAFE_INTEGER)),
        }))
        .sort((a, b) => {
            if (a.sign !== b.sign) return a.sign === 'positive' ? -1 : 1;
            return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        });
}

function geneBoxHeight(columns, titleRows = 1) {
    const rows = Math.max(columns.left.length, columns.right.length, 1);
    return (titleRows > 1 ? 78 : 52) + (rows * GENE_ROW_H);
}

function splitTextLines(value, maxChars = 22, maxLines = 2) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    const lines = [];
    let current = '';
    words.forEach((word) => {
        if (!current) {
            current = word;
            return;
        }
        if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
        else {
            lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);

    const fittedLines = lines.map((line) => (
        line.length > maxChars ? `${line.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...` : line
    ));

    if (fittedLines.length <= maxLines) return fittedLines;
    const limited = fittedLines.slice(0, maxLines);
    limited[maxLines - 1] = `${limited[maxLines - 1].replace(/\.*$/, '')}...`;
    return limited;
}

function normalizeTraitLabel(value) {
    const normalized = String(value || '')
        .trim()
        .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
        .replace(/\s+/g, ' ');
    return normalized.trim();
}

function splitTraitTextLines(value, maxChars = 18) {
    const words = normalizeTraitLabel(value).split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    const lines = [];
    let current = '';

    const pushPiece = (piece) => {
        if (!current) {
            current = piece;
            return;
        }

        if (`${current} ${piece}`.length <= maxChars) {
            current = `${current} ${piece}`;
            return;
        }

        lines.push(current);
        current = piece;
    };

    words.forEach((word) => {
        if (word.length <= maxChars) {
            pushPiece(word);
            return;
        }

        if (current) {
            lines.push(current);
            current = '';
        }

        for (let index = 0; index < word.length; index += maxChars) {
            lines.push(word.slice(index, index + maxChars));
        }
    });

    if (current) lines.push(current);
    return lines;
}

function traitNodeHeight(lines) {
    const extraLines = Math.max(0, lines.length - 2);
    return TRAIT_NODE_MIN_H + (extraLines * 22);
}

function programDisplayLines(module, maxChars = 22) {
    const label = module.annotation ? `${module.program} ${module.annotation}` : module.program;
    return splitTextLines(label, maxChars, 2);
}

function traitTextFontSize(lines) {
    const longest = Math.max(...lines.map((line) => line.length), 0);
    if (lines.length <= 1) return longest <= 8 ? 29 : 24;
    if (lines.length === 2) return longest <= 10 ? 24 : 21;
    if (lines.length === 3) return longest <= 12 ? 20 : 18;
    return 17;
}

function edgeEndpoint(startX, startY, endX, endY, distanceFromEnd) {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt((dx * dx) + (dy * dy)) || 1;
    return {
        x: endX - ((dx / length) * distanceFromEnd),
        y: endY - ((dy / length) * distanceFromEnd),
    };
}

function traitPortY(index, total, traitNodeHeightValue) {
    if (total <= 1) return 0;
    const usableHeight = traitNodeHeightValue - (TRAIT_PORT_INSET * 2);
    return -usableHeight / 2 + ((usableHeight / (total - 1)) * index);
}

function ArrowOrCap({
    x1,
    y1,
    x2,
    y2,
    color,
    direction,
    opacity = 1,
    width = 3,
    targetGap = EDGE_TARGET_GAP,
}) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 14;
    const headWidth = 9;
    const capHalf = 12;
    const tip = edgeEndpoint(x1, y1, x2, y2, targetGap);
    const base = {
        x: tip.x - (Math.cos(angle) * headLength),
        y: tip.y - (Math.sin(angle) * headLength),
    };
    const perp = {
        x: Math.cos(angle + (Math.PI / 2)),
        y: Math.sin(angle + (Math.PI / 2)),
    };

    return (
        <g>
            <line
                x1={x1}
                y1={y1}
                x2={direction === 'arrow' ? base.x : tip.x}
                y2={direction === 'arrow' ? base.y : tip.y}
                stroke={color}
                strokeWidth={width}
                strokeOpacity={opacity}
                strokeLinecap="round"
            />
            {direction === 'arrow' ? (
                <polygon
                    points={`${tip.x},${tip.y} ${base.x + (perp.x * headWidth)},${base.y + (perp.y * headWidth)} ${base.x - (perp.x * headWidth)},${base.y - (perp.y * headWidth)}`}
                    fill={color}
                    fillOpacity={opacity}
                />
            ) : (
                <line
                    x1={tip.x + (perp.x * capHalf)}
                    y1={tip.y + (perp.y * capHalf)}
                    x2={tip.x - (perp.x * capHalf)}
                    y2={tip.y - (perp.y * capHalf)}
                    stroke={color}
                    strokeWidth={Math.max(width, 3)}
                    strokeOpacity={opacity}
                    strokeLinecap="square"
                />
            )}
        </g>
    );
}

function SectionNote({ x, y, lines }) {
    return (
        <g>
            {lines.map((line, index) => (
                <text
                    key={line}
                    x={x}
                    y={y + (index * 24)}
                    className="section-note"
                    paintOrder="stroke"
                    stroke="#fff"
                    strokeWidth="8"
                    strokeLinejoin="round"
                >
                    {line}
                </text>
            ))}
        </g>
    );
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
        ctx.fillStyle = '#fff';
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

    const trySetPointerCapture = useCallback((target, pointerId) => {
        try {
            target?.setPointerCapture?.(pointerId);
        } catch {
            // Ignore invalid pointer capture transitions from rapid browser event sequences.
        }
    }, []);

    const tryReleasePointerCapture = useCallback((target, pointerId) => {
        try {
            target?.releasePointerCapture?.(pointerId);
        } catch {
            // Ignore release calls after the browser already cleared the capture state.
        }
    }, []);

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
        trySetPointerCapture(event.currentTarget, event.pointerId);
    }, [transform.x, transform.y, trySetPointerCapture]);

    const onPointerMove = useCallback((event) => {
        const dragState = dragRef.current;
        if (!dragState || dragState.id !== event.pointerId) return;

        const dx = event.clientX - dragState.x;
        const dy = event.clientY - dragState.y;
        if (!dragState.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            dragState.moved = true;
        }

        setTransform((current) => ({
            ...current,
            x: dragState.startX + dx,
            y: dragState.startY + dy,
        }));
    }, []);

    const onPointerUp = useCallback((event) => {
        if (dragRef.current?.id === event.pointerId) {
            if (dragRef.current.moved) {
                suppressClickUntilRef.current = Date.now() + 180;
            }
            dragRef.current = null;
            setIsDragging(false);
            tryReleasePointerCapture(event.currentTarget, event.pointerId);
        }
    }, [tryReleasePointerCapture]);

    const onWheel = useCallback((event) => {
        if (!event.ctrlKey && !event.metaKey) return;
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

function computeEdgeStyle(score, highlighted, muted) {
    const absScore = Math.abs(toFiniteNumber(score, 0));
    return {
        width: 1.4 + clamp(absScore, 0, 6) * 1.35,
        opacity: muted ? 0.14 : (highlighted ? 0.96 : 0.66 + clamp(absScore / 6, 0, 1) * 0.26),
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
        const geneColumns = splitGenesByEffect(visibleGenes);
        const regulatorGroups = side === 'regulator' ? groupRegulatorGenesByBucket(visibleGenes) : null;
        const titleRows = programDisplayLines(program, 19).length || 1;
        const regulatorGroupHeights = regulatorGroups
            ? regulatorGroups.reduce((acc, group) => {
                acc[group.key] = geneBoxHeight(splitGenesByEffect(group.genes));
                return acc;
            }, {})
            : null;
        const regulatorGroupsHeight = regulatorGroups
            ? regulatorGroups.reduce((sum, group, index) => (
                sum + (regulatorGroupHeights[group.key] || 0) + (index > 0 ? REGULATOR_GROUP_GAP : 0)
            ), 0)
            : 0;
        const height = program.collapsed
            ? 74
            : side === 'regulator'
                ? Math.max(RIGHT_PROGRAM_H + 34, regulatorGroupsHeight)
                : geneBoxHeight(geneColumns, titleRows);

        return {
            ...program,
            side,
            expanded,
            height,
            totalFilteredGenes: filteredGenes.length,
            filteredGeneKeys: filteredGenes.map((gene) => gene.highlightKey),
            visibleGenes,
            geneColumns,
            regulatorGroups,
            regulatorGroupHeights,
            regulatorGroupsHeight,
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

    const positionedModules = modules.map((module, index) => {
        const xProgram = side === 'program' ? LEFT_PROGRAM_X : RIGHT_PROGRAM_X;
        const rectXGenes = side === 'program' ? LEFT_PROGRAM_X : RIGHT_REGULATOR_X;
        const positioned = {
            ...module,
            layoutIndex: index,
            xProgram,
            rectXGenes,
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

export default function TraitProgramGraph({ fileId, traitLabel }) {
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

    const {
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
    } = useGraphTransform();

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
        reset();
    }, [fileId, reset]);

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
        return Math.max(940, Math.ceil(contentHeight + GRAPH_TOP_PADDING + GRAPH_BOTTOM_PADDING));
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
    const summaryModules = useMemo(
        () => allModules.filter((module) => visibleSides.has(module.side)),
        [allModules, visibleSides],
    );

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
        if (shouldSuppressClick()) return;
        setSelectedProgram((current) => (current === program ? null : program));
        setSelectedGene(null);
    }, [shouldSuppressClick]);

    const handleSelectGene = useCallback((gene) => {
        if (shouldSuppressClick()) return;

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
    }, [graph, selectedGeneKey, shouldSuppressClick]);

    const clearSelection = useCallback(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
    }, []);

    const selectedGeneOccurrences = useMemo(
        () => (selectedGeneKey ? (geneOccurrences.get(selectedGeneKey) || []) : []),
        [geneOccurrences, selectedGeneKey],
    );

    const traitDisplayLines = useMemo(() => {
        const label = traitLabel || graph?.traitNode?.label || fileId;
        return splitTraitTextLines(label, 18);
    }, [fileId, graph?.traitNode?.label, traitLabel]);
    const traitFontSize = useMemo(() => traitTextFontSize(traitDisplayLines), [traitDisplayLines]);
    const traitNodeHeightValue = useMemo(() => traitNodeHeight(traitDisplayLines), [traitDisplayLines]);

    const renderGeneColumns = useCallback(({
        columns,
        x,
        y,
        width,
        height,
        textAnchor = 'start',
        selectedProgramName,
        titleRows = 1,
    }) => {
        const columnGap = 12;
        const dividerX = x + (width / 2);
        const leftTextX = x + 14;
        const rightTextX = x + width - 14;
        const rowStartY = y + (titleRows > 1 ? 78 : 52);

        const renderGene = (gene, column, index) => {
            const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
            const geneProgramSelected = selectedProgram === selectedProgramName;
            const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected) || (Boolean(selectedGeneKey) && !geneMatched);
            const rowY = rowStartY + (index * GENE_ROW_H);
            const textX = column === 'left'
                ? (textAnchor === 'end' ? dividerX - columnGap : leftTextX)
                : (textAnchor === 'end' ? rightTextX : dividerX + columnGap);
            const anchor = column === 'left'
                ? (textAnchor === 'end' ? 'end' : 'start')
                : (textAnchor === 'end' ? 'end' : 'start');

            return (
                <g
                    key={`${gene.id}:${column}`}
                    data-graph-clickable="true"
                    onClick={() => handleSelectGene(gene)}
                    style={{ cursor: 'pointer' }}
                >
                    <text
                        x={textX}
                        y={rowY}
                        textAnchor={anchor}
                        fontSize="22"
                        fontWeight={geneMatched ? 900 : 800}
                        fontStyle={gene.isDiscordant ? 'normal' : 'normal'}
                        fill={geneMuted ? '#b5b5b5' : effectColorFromGene(gene)}
                        opacity={geneMuted ? 0.55 : 1}
                    >
                        {displayGeneLabel(gene)}
                    </text>
                    <title>{formatGeneTooltip(gene)}</title>
                </g>
            );
        };

        return (
            <g>
                <line
                    x1={dividerX}
                    y1={y + 42}
                    x2={dividerX}
                    y2={y + height - 18}
                    stroke="#555"
                    strokeWidth="1.5"
                    strokeDasharray="2 3"
                />
                {columns.left.map((gene, index) => renderGene(gene, 'left', index))}
                {columns.right.map((gene, index) => renderGene(gene, 'right', index))}
            </g>
        );
    }, [handleSelectGene, selectedGeneKey, selectedProgram]);

    const renderLeftProgramModule = useCallback((module) => {
        if (!visibleSides.has(module.side)) return null;

        const score = module.programScore;
        const direction = directionFromSign(module.programTraitSign, score);
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const edgeHighlighted = isProgramSelected || moduleGeneMatches;
        const muted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const edgeStyle = computeEdgeStyle(score, edgeHighlighted, muted);
        const centerY = module.yCenter;
        const traitLeftX = TRAIT_CENTER_X - (TRAIT_NODE_W / 2);
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, leftLayout.modules.length, traitNodeHeightValue);
        const boxHeight = module.height;
        const titleLines = programDisplayLines(module, 19);
        const nodeColor = programColor(module);

        return (
            <g key={`${module.program}:program`}>
                <ArrowOrCap
                    x1={LEFT_PROGRAM_X + LEFT_PROGRAM_W}
                    y1={centerY}
                    x2={traitLeftX}
                    y2={traitTargetY}
                    color={edgeColorFromSign(module.programTraitSign, score)}
                    direction={direction}
                    opacity={edgeStyle.opacity}
                    width={Math.max(2.8, edgeStyle.width * 0.82)}
                />

                <g
                    data-graph-clickable="true"
                    onClick={() => handleSelectProgram(module.program)}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={LEFT_PROGRAM_X}
                        y={module.yTop}
                        width={LEFT_PROGRAM_W}
                        height={boxHeight}
                        rx="6"
                        fill={nodeColor}
                        fillOpacity={programFillOpacity(module, muted)}
                        stroke={isProgramSelected ? '#111' : nodeColor}
                        strokeWidth={isProgramSelected ? 3.2 : 2.6}
                    />
                    <rect
                        x={LEFT_PROGRAM_X}
                        y={module.yTop}
                        width="12"
                        height={boxHeight}
                        rx="6"
                        fill={nodeColor}
                        fillOpacity={programStripeOpacity(module, muted)}
                        pointerEvents="none"
                    />
                    {titleLines.map((line, index) => (
                        <text
                            key={line}
                            x={LEFT_PROGRAM_X + (LEFT_PROGRAM_W / 2)}
                            y={module.yTop + 31 + (index * 25)}
                            textAnchor="middle"
                            fontSize="26"
                            fontWeight="900"
                            fill="#111"
                        >
                            {line}
                        </text>
                    ))}
                    {module.collapsed ? (
                        <text x={LEFT_PROGRAM_X + 16} y={module.yTop + 58} fontSize="18" fill="#555">
                            {module.emptyReason || 'No overlap'}
                        </text>
                    ) : renderGeneColumns({
                        columns: module.geneColumns,
                        x: LEFT_PROGRAM_X,
                        y: module.yTop,
                        width: LEFT_PROGRAM_W,
                        height: boxHeight,
                        textAnchor: 'start',
                        selectedProgramName: module.program,
                        titleRows: titleLines.length,
                    })}
                    <title>{formatProgramTooltip(module)}</title>
                </g>
            </g>
        );
    }, [
        handleSelectProgram,
        renderGeneColumns,
        selectedGeneKey,
        selectedProgram,
        leftLayout.modules.length,
        traitCenterY,
        traitNodeHeightValue,
        visibleSides,
    ]);

    const renderRegulatorGroup = useCallback((module, group, yTop, height) => {
        const columns = splitGenesByEffect(group.genes);
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && group.genes.some((gene) => gene.highlightKey === selectedGeneKey);
        const muted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const groupColor = group.sign === 'negative' ? EFFECT_COLORS.negative : EFFECT_COLORS.positive;

        return (
            <g key={`${module.program}:regulator:${group.key}`}>
                <rect
                    x={RIGHT_REGULATOR_X}
                    y={yTop}
                    width={RIGHT_REGULATOR_W}
                    height={height}
                    rx="6"
                    fill="#fff"
                    fillOpacity={muted ? 0.38 : 1}
                    stroke={groupColor}
                    strokeWidth="2.6"
                />
                <text x={RIGHT_REGULATOR_X + 14} y={yTop + 28} fontSize="24" fontWeight="900" fill={groupColor}>
                    {group.title}
                </text>
                {group.genes.length ? renderGeneColumns({
                    columns,
                    x: RIGHT_REGULATOR_X,
                    y: yTop,
                    width: RIGHT_REGULATOR_W,
                    height,
                    textAnchor: 'start',
                    selectedProgramName: module.program,
                }) : (
                    null
                )}
            </g>
        );
    }, [renderGeneColumns, selectedGeneKey, selectedProgram]);

    const renderRightProgramModule = useCallback((module) => {
        if (!visibleSides.has(module.side)) return null;

        const regulatorScore = module.regulatorScore;
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const edgeHighlighted = isProgramSelected || moduleGeneMatches;
        const muted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const programScore = module.programScore;
        const programEdgeStyle = computeEdgeStyle(programScore, edgeHighlighted, muted);
        const programY = module.yCenter;
        const programBoxY = programY - (RIGHT_PROGRAM_H / 2);
        const traitRightX = TRAIT_CENTER_X + (TRAIT_NODE_W / 2);
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, rightLayout.modules.length, traitNodeHeightValue);
        const programLines = programDisplayLines(module, 19);
        const nodeColor = programColor(module);
        const groupLayouts = [];
        let cursorY = module.yTop;
        (module.regulatorGroups || []).forEach((group, index) => {
            const height = module.regulatorGroupHeights?.[group.key] || geneBoxHeight(splitGenesByEffect(group.genes));
            groupLayouts.push({
                ...group,
                height,
                yTop: cursorY,
                centerY: cursorY + (height / 2),
            });
            cursorY += height + (index < (module.regulatorGroups.length - 1) ? REGULATOR_GROUP_GAP : 0);
        });

        return (
            <g key={`${module.program}:regulator`}>
                <ArrowOrCap
                    x1={RIGHT_PROGRAM_X}
                    y1={programY}
                    x2={traitRightX}
                    y2={traitTargetY}
                    color={edgeColorFromSign(module.programTraitSign, programScore)}
                    direction={directionFromSign(module.programTraitSign, programScore)}
                    opacity={programEdgeStyle.opacity}
                    width={Math.max(2.8, programEdgeStyle.width * 0.82)}
                />
                {groupLayouts.map((group, index) => {
                    const bucketDirection = group.sign === 'negative' ? 'flat' : 'arrow';
                    const bucketColor = group.sign === 'negative' ? EFFECT_COLORS.negative : EFFECT_COLORS.positive;
                    const bucketMagnitude = Math.max(
                        ...group.genes.map((gene) => Math.abs(toFiniteNumber(gene.membershipScore, 0))),
                        Math.abs(toFiniteNumber(regulatorScore, 0)),
                    );
                    const bucketEdgeStyle = computeEdgeStyle(bucketMagnitude, edgeHighlighted, muted);

                    return (
                        <ArrowOrCap
                            key={`${module.program}:${group.key}:edge`}
                            x1={RIGHT_REGULATOR_X}
                            y1={group.centerY}
                            x2={RIGHT_PROGRAM_X + RIGHT_PROGRAM_W}
                            y2={programY + ((index - ((groupLayouts.length - 1) / 2)) * 14)}
                            color={bucketColor}
                            direction={bucketDirection}
                            opacity={bucketEdgeStyle.opacity}
                            width={Math.max(2.4, bucketEdgeStyle.width * 0.65)}
                        />
                    );
                })}

                <g
                    data-graph-clickable="true"
                    onClick={() => handleSelectProgram(module.program)}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={RIGHT_PROGRAM_X}
                        y={programBoxY}
                        width={RIGHT_PROGRAM_W}
                        height={RIGHT_PROGRAM_H}
                        rx="5"
                        fill={nodeColor}
                        fillOpacity={programFillOpacity(module, muted)}
                        stroke={isProgramSelected ? '#111' : nodeColor}
                        strokeWidth={isProgramSelected ? 3.2 : 2.4}
                    />
                    <rect
                        x={RIGHT_PROGRAM_X}
                        y={programBoxY}
                        width="12"
                        height={RIGHT_PROGRAM_H}
                        rx="5"
                        fill={nodeColor}
                        fillOpacity={programStripeOpacity(module, muted)}
                        pointerEvents="none"
                    />
                    {programLines.map((line, index) => (
                        <text
                            key={line}
                            x={RIGHT_PROGRAM_X + (RIGHT_PROGRAM_W / 2)}
                            y={programBoxY + 30 + (index * 24)}
                            textAnchor="middle"
                            fontSize="25"
                            fontWeight="900"
                            fill="#111"
                        >
                            {line}
                        </text>
                    ))}
                    <title>{formatProgramTooltip(module)}</title>
                </g>

                {groupLayouts.map((group) => renderRegulatorGroup(
                    module,
                    group,
                    group.yTop,
                    group.height,
                ))}
            </g>
        );
    }, [
        handleSelectProgram,
        renderRegulatorGroup,
        selectedGeneKey,
        selectedProgram,
        rightLayout.modules.length,
        traitCenterY,
        traitNodeHeightValue,
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
                                <Button size="small" variant="outlined" onClick={zoomIn} startIcon={<ZoomIn />}>
                                    Zoom
                                </Button>
                            </Tooltip>
                            <Tooltip title="Zoom out">
                                <Button size="small" variant="outlined" onClick={zoomOut} startIcon={<ZoomOut />}>
                                    Out
                                </Button>
                            </Tooltip>
                            <Button size="small" variant="outlined" onClick={reset} startIcon={<RestartAlt />}>
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
                        <Chip label={`${graph.counts.totalPrograms} programs`} size="small" />
                        <Chip
                            label={`${graph.counts.leftPrograms} left`}
                            size="small"
                            sx={{ color: SIDE_META.program.accent, borderColor: SIDE_META.program.accent }}
                            variant="outlined"
                        />
                        <Chip
                            label={`${graph.counts.rightPrograms} right`}
                            size="small"
                            sx={{ color: SIDE_META.regulator.accent, borderColor: SIDE_META.regulator.accent }}
                            variant="outlined"
                        />
                        <Chip label={`${graph.counts.hiddenPrograms} hidden`} size="small" variant="outlined" />
                        <Chip label={`${hiddenCollapsedCount} no overlap`} size="small" variant="outlined" />
                        {selectedProgram && (
                            <Chip
                                label={selectedProgram}
                                color="warning"
                                size="small"
                                onDelete={() => setSelectedProgram(null)}
                            />
                        )}
                        {selectedGeneKey && (
                            <Chip
                                label={`${selectedGene?.geneLabel || selectedGene?.gene || selectedGeneKey} · ${selectedGeneOccurrences.length} rows`}
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
                            Program edges point from program to trait. Regulator edges point from regulator genes to program.
                            Scroll normally moves the page; use Ctrl/Command + wheel or the buttons to zoom the graph.
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

                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            flexWrap: 'wrap',
                            width: '100%',
                            mt: 1.25,
                            pt: 1.25,
                            borderTop: '1px solid rgba(15,23,42,0.06)',
                        }}
                    >
                        <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                            Legend
                        </Typography>
                        {INLINE_LEGEND_GROUPS.map((group) => (
                            <Box key={group.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontSize: 12.5, color: '#475467', fontWeight: 700 }}>
                                    {group.label}:
                                </Typography>
                                {group.items.map((item) => (
                                    <Box key={`${group.label}-${item.label}`} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.45 }}>
                                        <Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: item.color, border: '1px solid rgba(15,23,42,0.10)' }} />
                                        <Typography sx={{ fontSize: 12.5, color: '#475467', fontWeight: 600 }}>
                                            {item.label}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box
                    sx={{
                        px: { xs: 0.5, md: 1 },
                        py: 1,
                        background: '#fff',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        touchAction: 'pan-y',
                        userSelect: 'none',
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onWheel={onWheel}
                >
                    <svg
                        ref={svgRef}
                        width="100%"
                        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                    >
                        <defs>
                            <style>
                                {'.trait-program-template text{font-family:Arial, Helvetica, sans-serif;letter-spacing:0}.trait-program-template .section-title{font-size:26px;font-weight:900;fill:#111}.trait-program-template .section-note{font-size:21px;font-weight:900;fill:#111}'}
                            </style>
                        </defs>

                        <g className="trait-program-template" transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                            <rect x="0" y="0" width={SVG_WIDTH} height={svgHeight} fill="#fff" />

                            <text x="8" y="36" className="section-title">
                                Programs selected by
                            </text>
                            <text x="8" y="62" className="section-title">
                                program burden effects
                            </text>
                            <text
                                x={RIGHT_PROGRAM_X}
                                y="36"
                                className="section-title"
                            >
                                Programs selected by
                            </text>
                            <text
                                x={RIGHT_PROGRAM_X}
                                y="62"
                                className="section-title"
                            >
                                regulator-program effects
                            </text>

                            <g
                                data-graph-clickable="true"
                                onClick={() => clearSelection()}
                                style={{ cursor: 'pointer' }}
                            >
                                <rect
                                    x={TRAIT_CENTER_X - (TRAIT_NODE_W / 2)}
                                    y={traitCenterY - (traitNodeHeightValue / 2)}
                                    width={TRAIT_NODE_W}
                                    height={traitNodeHeightValue}
                                    rx="7"
                                    fill="#929b9b"
                                    stroke="#111"
                                    strokeWidth="3"
                                />
                                {traitDisplayLines.map((line, index) => (
                                    <text
                                        key={line}
                                        x={TRAIT_CENTER_X}
                                        y={traitCenterY - (((traitDisplayLines.length - 1) * 22) / 2) + 8 + (index * 22)}
                                        textAnchor="middle"
                                        fontSize={traitFontSize}
                                        fontWeight="900"
                                        fill="#fff"
                                    >
                                        {line}
                                    </text>
                                ))}
                            </g>

                            {leftLayout.modules.map(renderLeftProgramModule)}
                            {rightLayout.modules.map(renderRightProgramModule)}

                            <SectionNote
                                x={LEFT_PROGRAM_X + LEFT_PROGRAM_W + 16}
                                y={traitCenterY - 310}
                                lines={['Directions determined by', 'program burden effects']}
                            />
                            <SectionNote
                                x={TRAIT_CENTER_X + 76}
                                y={traitCenterY - 310}
                                lines={['Directions determined by', 'program-trait and regulator-program signs']}
                            />
                        </g>
                    </svg>
                </Box>
            </Paper>

            <Box
                sx={{
                    width: '100%',
                }}
            >
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                    <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                        Module summary
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#667085', mb: 1.5 }}>
                        Select programs, compare scores, check filtered gene counts, and expand crowded modules.
                    </Typography>
                    <TraitProgramGraphSummary
                        title="Visible modules"
                        modules={summaryModules}
                        side="program"
                        selectedProgram={selectedProgram}
                        onSelectProgram={handleSelectProgram}
                        onToggleExpanded={toggleExpanded}
                        sideMeta={SIDE_META.program}
                        sideMetaMap={SIDE_META}
                        programColor={programColor}
                        programSelectionLabel={programSelectionLabel}
                        effectColors={EFFECT_COLORS}
                        effectSignFromGene={effectSignFromGene}
                        edgeColorFromScore={edgeColorFromScore}
                        formatNumber={formatNumber}
                    />
                </Paper>
            </Box>
        </Stack>
    );
}
