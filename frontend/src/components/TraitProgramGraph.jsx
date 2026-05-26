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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
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
const TRAIT_NODE_H = 128;
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
const GRAPH_TOP_PADDING = 128;
const GRAPH_BOTTOM_PADDING = 176;
const BOX_STROKE = '#8c8c8c';
const TRAIT_PORT_INSET = 22;

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
    return genes.reduce((columns, gene) => {
        const sign = effectSignFromGene(gene);
        if (sign === 'negative') columns.right.push(gene);
        else columns.left.push(gene);
        return columns;
    }, { left: [], right: [] });
}

function groupRegulatorGenesByBucket(genes) {
    const groups = genes.reduce((map, gene) => {
        const regulatorSign = gene.regulatorProgramSign === 'negative' ? 'negative' : 'positive';
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

function geneBoxHeight(columns) {
    const rows = Math.max(columns.left.length, columns.right.length, 1);
    return 50 + (rows * GENE_ROW_H);
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

function programDisplayLines(module, maxChars = 22) {
    const label = module.annotation ? `${module.program} ${module.annotation}` : module.program;
    return splitTextLines(label, maxChars, 2);
}

function traitTextFontSize(lines) {
    const longest = Math.max(...lines.map((line) => line.length), 0);
    if (lines.length <= 1) return longest <= 8 ? 29 : 24;
    return longest <= 8 ? 24 : 21;
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

function traitPortY(index, total) {
    if (total <= 1) return 0;
    const usableHeight = TRAIT_NODE_H - (TRAIT_PORT_INSET * 2);
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
}) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 14;
    const headWidth = 9;
    const capHalf = 12;
    const tip = edgeEndpoint(x1, y1, x2, y2, direction === 'arrow' ? 0 : 2);
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

function EffectLegend({ x, y }) {
    return (
        <g>
            <text x={x} y={y} fontSize="28" fontWeight="800" fill="#111">
                Sign of effects, top genes
            </text>
            <rect x={x + 4} y={y + 24} width="28" height="28" rx="6" fill={EFFECT_COLORS.positive} />
            <text x={x + 44} y={y + 47} fontSize="27" fill="#111">Positive</text>
            <rect x={x + 4} y={y + 66} width="28" height="28" rx="6" fill={EFFECT_COLORS.negative} />
            <text x={x + 44} y={y + 89} fontSize="27" fill="#111">Negative</text>
            <text x={x - 52} y={y + 132} fontSize="24" fill="#111">
                (x): genes discordant to the whole model
            </text>
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

function ModuleSummaryTable({
    title,
    modules,
    side,
    selectedProgram,
    onSelectProgram,
    onToggleExpanded,
}) {
    const sideMeta = SIDE_META[side];
    const scoreField = side === 'program' ? 'programScore' : 'regulatorScore';
    const totalField = side === 'program' ? 'loadingTotalCount' : 'regulatorTotalCount';

    return (
        <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: 'rgba(15,23,42,0.10)', overflow: 'hidden' }}>
            <Box
                sx={{
                    px: 1.5,
                    py: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    bgcolor: sideMeta.softBg,
                }}
            >
                <Typography sx={{ fontWeight: 800, color: sideMeta.accent, fontSize: 13 }}>
                    {title}
                </Typography>
                <Chip
                    label={`${modules.length} modules`}
                    size="small"
                    sx={{ height: 22, fontWeight: 700, color: sideMeta.accent, borderColor: sideMeta.accent }}
                    variant="outlined"
                />
            </Box>

            <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800, width: 92 }}>Program</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Score</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Genes</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>+ / -</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Shown</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {modules.map((module) => {
                            const selected = selectedProgram === module.program;
                            const positiveCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'positive').length || 0;
                            const negativeCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'negative').length || 0;

                            return (
                                <TableRow
                                    key={`${module.program}:${side}`}
                                    hover
                                    selected={selected}
                                    onClick={() => onSelectProgram(module.program)}
                                    sx={{
                                        cursor: 'pointer',
                                        '&.Mui-selected': { bgcolor: sideMeta.softBg },
                                        '&.Mui-selected:hover': { bgcolor: sideMeta.softBg },
                                    }}
                                >
                                    <TableCell>
                                        <Stack spacing={0.35}>
                                            <Typography sx={{ fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                                                {module.program}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11.5, color: '#667085', lineHeight: 1.2 }}>
                                                {module.colorLabel}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography
                                            sx={{
                                                fontWeight: 800,
                                                color: edgeColorFromScore(module[scoreField]),
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {formatNumber(module[scoreField], 2)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {module.totalFilteredGenes}/{module[totalField]}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        <Box component="span" sx={{ color: EFFECT_COLORS.positive, fontWeight: 800 }}>{positiveCount}</Box>
                                        {' / '}
                                        <Box component="span" sx={{ color: EFFECT_COLORS.negative, fontWeight: 800 }}>{negativeCount}</Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        {module.collapsed ? (
                                            <Typography sx={{ fontSize: 12, color: '#667085' }}>none</Typography>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onToggleExpanded(module.program, side);
                                                }}
                                                sx={{ minWidth: 0, px: 0.5, textTransform: 'none', fontSize: 12 }}
                                            >
                                                {module.expanded ? 'all' : module.visibleGenes.length}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!modules.length && (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Typography sx={{ py: 2, textAlign: 'center', color: '#667085', fontSize: 13 }}>
                                        No modules after current filters
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
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
                : geneBoxHeight(geneColumns);

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
    const [hoverProgram, setHoverProgram] = useState(null);
    const [hoverGene, setHoverGene] = useState(null);

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
    const traitDisplayLines = useMemo(() => {
        const label = traitLabel || graph?.traitNode?.label || fileId;
        return splitTextLines(label, 13, 2);
    }, [fileId, graph?.traitNode?.label, traitLabel]);
    const traitFontSize = useMemo(() => traitTextFontSize(traitDisplayLines), [traitDisplayLines]);

    const renderGeneColumns = useCallback(({
        columns,
        x,
        y,
        width,
        height,
        textAnchor = 'start',
        selectedProgramName,
    }) => {
        const columnGap = 12;
        const dividerX = x + (width / 2);
        const leftTextX = x + 14;
        const rightTextX = x + width - 14;
        const startY = y + 52;

        const renderGene = (gene, column, index) => {
            const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
            const geneProgramSelected = selectedProgram === selectedProgramName;
            const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected) || (Boolean(selectedGeneKey) && !geneMatched);
            const rowY = startY + (index * GENE_ROW_H);
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
                    onMouseEnter={() => setHoverGene(gene)}
                    onMouseLeave={() => setHoverGene(null)}
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
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, leftLayout.modules.length);
        const boxHeight = module.height;
        const titleLines = programDisplayLines(module, 19);

        return (
            <g key={`${module.program}:program`}>
                <ArrowOrCap
                    x1={LEFT_PROGRAM_X + LEFT_PROGRAM_W + 6}
                    y1={centerY}
                    x2={traitLeftX - 8}
                    y2={traitTargetY}
                    color={edgeColorFromSign(module.programTraitSign, score)}
                    direction={direction}
                    opacity={edgeStyle.opacity}
                    width={Math.max(2.8, edgeStyle.width * 0.82)}
                />

                <g
                    data-graph-clickable="true"
                    onClick={() => handleSelectProgram(module.program)}
                    onMouseEnter={() => setHoverProgram(module)}
                    onMouseLeave={() => setHoverProgram(null)}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={LEFT_PROGRAM_X}
                        y={module.yTop}
                        width={LEFT_PROGRAM_W}
                        height={boxHeight}
                        rx="6"
                        fill="#fff"
                        fillOpacity={muted ? 0.38 : 1}
                        stroke={isProgramSelected ? '#111' : BOX_STROKE}
                        strokeWidth={isProgramSelected ? 3 : 2.2}
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
                <text x={RIGHT_REGULATOR_X + 14} y={yTop + 28} fontSize="26" fontWeight="900" fill={groupColor}>
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
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, rightLayout.modules.length);
        const programLines = programDisplayLines(module, 19);
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
                    x1={RIGHT_PROGRAM_X - 8}
                    y1={programY}
                    x2={traitRightX + 8}
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
                            x1={RIGHT_REGULATOR_X - 8}
                            y1={group.centerY}
                            x2={RIGHT_PROGRAM_X + RIGHT_PROGRAM_W + 8}
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
                    onMouseEnter={() => setHoverProgram(module)}
                    onMouseLeave={() => setHoverProgram(null)}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={RIGHT_PROGRAM_X}
                        y={programBoxY}
                        width={RIGHT_PROGRAM_W}
                        height={RIGHT_PROGRAM_H}
                        rx="5"
                        fill="#fff"
                        fillOpacity={muted ? 0.38 : 1}
                        stroke={isProgramSelected ? '#111' : BOX_STROKE}
                        strokeWidth={isProgramSelected ? 3 : 2}
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
                                    y={traitCenterY - (TRAIT_NODE_H / 2)}
                                    width={TRAIT_NODE_W}
                                    height={TRAIT_NODE_H}
                                    rx="7"
                                    fill="#929b9b"
                                    stroke="#111"
                                    strokeWidth="3"
                                />
                                {traitDisplayLines.map((line, index) => (
                                    <text
                                        key={line}
                                        x={TRAIT_CENTER_X}
                                        y={traitCenterY + (traitDisplayLines.length === 1 ? 10 : -5) + (index * 24)}
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
                            <EffectLegend x={370} y={svgHeight - 140} />
                        </g>
                    </svg>
                </Box>
            </Paper>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.8fr) minmax(280px, 0.75fr) minmax(260px, 0.65fr)' },
                    gap: 2.5,
                    alignItems: 'start',
                }}
            >
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                    <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                        Module summary
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#667085', mb: 1.5 }}>
                        Select programs, compare scores, check filtered gene counts, and expand crowded modules.
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: visibleSides.size > 1 ? '1fr 1fr' : '1fr' },
                            gap: 1.5,
                        }}
                    >
                        {visibleSides.has('program') && (
                            <ModuleSummaryTable
                                title="Program burden side"
                                modules={leftLayout.modules}
                                side="program"
                                selectedProgram={selectedProgram}
                                onSelectProgram={handleSelectProgram}
                                onToggleExpanded={toggleExpanded}
                            />
                        )}

                            {visibleSides.has('regulator') && (
                                <ModuleSummaryTable
                                    title="Regulator-program side"
                                    modules={rightLayout.modules}
                                    side="regulator"
                                    selectedProgram={selectedProgram}
                                onSelectProgram={handleSelectProgram}
                                onToggleExpanded={toggleExpanded}
                            />
                        )}
                    </Box>
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
                            <Box sx={{ width: 54, height: 0, borderTop: `3px solid ${EFFECT_COLORS.positive}`, position: 'relative' }}>
                                <Box sx={{ position: 'absolute', right: -2, top: -6, width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `10px solid ${EFFECT_COLORS.positive}` }} />
                            </Box>
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Positive score: arrow head
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 54, height: 0, borderTop: `3px solid ${EFFECT_COLORS.negative}`, position: 'relative' }}>
                                <Box sx={{ position: 'absolute', right: -1, top: -8, width: 3, height: 16, bgcolor: EFFECT_COLORS.negative }} />
                            </Box>
                            <Typography sx={{ fontSize: 12.5, color: '#475467' }}>
                                Negative score: flat cap
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Stack>
    );
}
