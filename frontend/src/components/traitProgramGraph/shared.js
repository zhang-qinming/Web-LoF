import { useCallback, useRef, useState } from 'react';
import { downloadBlob } from '../../utils/download';

const PROGRAM_SELECTION_LABELS = {
    other: 'Other',
    program_enriched: 'program',
    regulator_enriched: 'regulator',
    both_enriched: 'both',
};

export const PROGRAM_COLORS = {
    other: '#b8c0cc',
    program_enriched: '#E69F00',
    regulator_enriched: '#0072B2',
    both_enriched: '#009E73',
};

export const SIDE_META = {
    program: {
        label: 'Program burden selected',
        shortLabel: 'Program',
        scoreLabel: 'Program score',
        accent: '#E69F00',
        softBg: 'rgba(230, 159, 0, 0.10)',
    },
    regulator: {
        label: 'Regulator-program selected',
        shortLabel: 'Regulator',
        scoreLabel: 'Regulator score',
        accent: '#0072B2',
        softBg: 'rgba(0, 114, 178, 0.09)',
    },
};

export const EFFECT_COLORS = {
    positive: '#e7653d',
    negative: '#2f80ed',
    neutral: '#6b7280',
};

export const EFFECT_COLOR_RGB = {
    positive: '231, 101, 61',
    negative: '47, 128, 237',
    neutral: '107, 114, 128',
};

export const GRAPH_VIEW_MODES = {
    compact: 'compact',
    full: 'full',
};

export const SVG_WIDTH = 1680;
export const GRAPH_LAYOUTS = {
    compact: {
        mode: GRAPH_VIEW_MODES.compact,
        defaultMaxGenes: 6,
        traitCenterX: 615,
        traitNodeW: 280,
        traitNodeMinH: 142,
        traitExtraLineH: 26,
        traitTextLineStep: 27,
        leftProgramX: 24,
        leftProgramW: 350,
        rightProgramX: 825,
        rightProgramW: 212,
        rightProgramH: 56,
        rightRegulatorX: 1192,
        rightRegulatorW: 430,
        rightRegulatorMinW: 360,
        geneRowH: 22,
        geneFontSize: 19,
        geneHeaderH: 48,
        geneHeaderHTall: 70,
        geneDividerTopInset: 38,
        geneDividerBottomInset: 14,
        geneColumnGap: 18,
        geneSubcolumnGap: 20,
        geneSidePadding: 18,
        geneEmptySideW: 78,
        geneBottomPadding: 8,
        oneSidedDividerRatio: 0.84,
        moduleGap: 20,
        regulatorGroupGap: 12,
        regulatorEdgeTargetSpacing: 24,
        graphTopPadding: 80,
        graphBottomPadding: 40,
        minContentHeight: 400,
        minSvgHeight: 680,
        geneSubcolumnThreshold: Number.POSITIVE_INFINITY,
        regulatorGroupLayout: 'vertical',
        regulatorGeneLayout: 'effectColumns',
        regulatorMinGeneBoxH: 104,
        regulatorGroupTitleSuffix: '',
        leftProgramTitleFontSize: 24,
        rightProgramTitleFontSize: 21,
        leftProgramTitleStep: 22,
        rightProgramTitleStep: 20,
        leftProgramLabelChars: 24,
        rightProgramLabelChars: 14,
        showSectionNotes: false,
    },
    full: {
        mode: GRAPH_VIEW_MODES.full,
        defaultMaxGenes: 8,
        traitCenterX: 560,
        traitNodeW: 232,
        traitNodeMinH: 128,
        traitExtraLineH: 22,
        traitTextLineStep: 22,
        leftProgramX: 24,
        leftProgramW: 266,
        rightProgramX: 820,
        rightProgramW: 266,
        rightProgramH: 62,
        rightRegulatorX: 1234,
        rightRegulatorW: 310,
        rightRegulatorMinW: 310,
        geneRowH: 25,
        geneFontSize: 22,
        geneHeaderH: 52,
        geneHeaderHTall: 78,
        geneDividerTopInset: 42,
        geneDividerBottomInset: 18,
        geneColumnGap: 12,
        geneSubcolumnGap: 12,
        geneSidePadding: 14,
        geneEmptySideW: 78,
        geneBottomPadding: 0,
        oneSidedDividerRatio: 0.5,
        geneBoxStyle: 'legacy',
        moduleGap: 42,
        regulatorGroupGap: 18,
        regulatorEdgeTargetSpacing: 14,
        graphTopPadding: 168,
        graphBottomPadding: 96,
        minContentHeight: 560,
        minSvgHeight: 940,
        geneSubcolumnThreshold: Number.POSITIVE_INFINITY,
        regulatorGroupLayout: 'vertical',
        regulatorGeneLayout: 'effectColumns',
        regulatorGroupTitleSuffix: ' regulators',
        leftProgramTitleFontSize: 26,
        rightProgramTitleFontSize: 25,
        leftProgramTitleStep: 25,
        rightProgramTitleStep: 24,
        leftProgramLabelChars: 19,
        rightProgramLabelChars: 19,
        showSectionNotes: true,
    },
};

export const DEFAULT_GRAPH_LAYOUT = GRAPH_LAYOUTS.compact;
export const DEFAULT_MAX_GENES = DEFAULT_GRAPH_LAYOUT.defaultMaxGenes;
export const TRAIT_CENTER_X = DEFAULT_GRAPH_LAYOUT.traitCenterX;
export const TRAIT_NODE_W = DEFAULT_GRAPH_LAYOUT.traitNodeW;
export const LEFT_PROGRAM_X = DEFAULT_GRAPH_LAYOUT.leftProgramX;
export const LEFT_PROGRAM_W = DEFAULT_GRAPH_LAYOUT.leftProgramW;
export const RIGHT_PROGRAM_X = DEFAULT_GRAPH_LAYOUT.rightProgramX;
export const RIGHT_PROGRAM_W = DEFAULT_GRAPH_LAYOUT.rightProgramW;
export const RIGHT_PROGRAM_H = DEFAULT_GRAPH_LAYOUT.rightProgramH;
export const RIGHT_REGULATOR_X = DEFAULT_GRAPH_LAYOUT.rightRegulatorX;
export const RIGHT_REGULATOR_W = DEFAULT_GRAPH_LAYOUT.rightRegulatorW;
export const GENE_ROW_H = DEFAULT_GRAPH_LAYOUT.geneRowH;
export const GENE_FONT_SIZE = DEFAULT_GRAPH_LAYOUT.geneFontSize;
export const GENE_HEADER_H = DEFAULT_GRAPH_LAYOUT.geneHeaderH;
export const GENE_HEADER_H_TALL = DEFAULT_GRAPH_LAYOUT.geneHeaderHTall;
export const MODULE_GAP = DEFAULT_GRAPH_LAYOUT.moduleGap;
export const REGULATOR_GROUP_GAP = DEFAULT_GRAPH_LAYOUT.regulatorGroupGap;
export const GRAPH_TOP_PADDING = DEFAULT_GRAPH_LAYOUT.graphTopPadding;
export const GRAPH_BOTTOM_PADDING = DEFAULT_GRAPH_LAYOUT.graphBottomPadding;
const TRAIT_PORT_INSET = 22;
export const EDGE_TARGET_GAP = 28;

export const INLINE_LEGEND_GROUPS = [
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
    {
        label: 'Regulator group',
        items: [
            { label: 'positive', color: EFFECT_COLORS.positive },
            { label: 'negative', color: EFFECT_COLORS.negative },
        ],
    },
];

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function toFiniteNumber(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeFileNamePart(value) {
    return String(value || 'trait-program-gene').replace(/[\\/:*?"<>|]+/g, '_');
}

export function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : 'NA';
}

export function formatProgramTooltip(program) {
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

export function formatGeneTooltip(gene) {
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

export function displayGeneLabel(gene) {
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

export function effectSignFromGene(gene) {
    if (gene.postMeanSign === 'positive' || gene.postMeanSign === 'negative') {
        return gene.postMeanSign;
    }
    return effectSignFromValue(gene.postMean);
}

export function effectColorFromGene(gene) {
    return EFFECT_COLORS[effectSignFromGene(gene)];
}

function programSelectionKey(program) {
    if (program.selectedByProgram && program.selectedByRegulator) return 'both_enriched';
    if (program.selectedByProgram) return 'program_enriched';
    if (program.selectedByRegulator) return 'regulator_enriched';
    return 'other';
}

export function programColor(program) {
    return PROGRAM_COLORS[programSelectionKey(program)] || PROGRAM_COLORS.other;
}

export function programSelectionLabel(program) {
    return PROGRAM_SELECTION_LABELS[programSelectionKey(program)] || 'Other';
}

export function programFillOpacity(program, muted) {
    if (muted) return 0.2;
    return programSelectionKey(program) === 'other' ? 0.12 : 0.42;
}

export function programStripeOpacity(program, muted) {
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

export function edgeColorFromScore(score) {
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

export function edgeColorFromSign(sign, fallbackScore) {
    const normalized = normalizeEffectSign(sign);
    return normalized ? EFFECT_COLORS[normalized] : edgeColorFromScore(fallbackScore);
}

export function directionFromSign(sign, fallbackScore) {
    const normalized = normalizeEffectSign(sign);
    if (normalized === 'negative') return 'flat';
    if (normalized === 'positive') return 'arrow';
    return directionFromScore(fallbackScore);
}

export function splitGenesByEffect(genes) {
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

function groupRegulatorGenesByBucket(genes, layout = DEFAULT_GRAPH_LAYOUT) {
    const groups = genes.reduce((map, gene) => {
        const regulatorSign = regulatorSignFromGene(gene);
        const bucket = `${regulatorSign}_regulators`;
        if (!map.has(bucket)) {
            const signTitle = regulatorSign === 'negative' ? 'Negative' : 'Positive';
            map.set(bucket, {
                key: bucket,
                sign: regulatorSign,
                title: `${signTitle}${layout.regulatorGroupTitleSuffix || ''}`,
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

export function geneBoxHeight(columns, titleRows = 1, layout = DEFAULT_GRAPH_LAYOUT) {
    const headerHeight = titleRows > 1 ? layout.geneHeaderHTall : layout.geneHeaderH;
    return headerHeight
        + (geneVisualRowCount(columns, layout) * layout.geneRowH)
        + (layout.geneBottomPadding || 0);
}

export function regulatorGeneBoxHeight(genes, layout = DEFAULT_GRAPH_LAYOUT) {
    if (layout.regulatorGeneLayout === 'single') {
        const height = layout.geneHeaderH
            + (Math.max(genes.length, 1) * layout.geneRowH)
            + (layout.geneBottomPadding || 0);
        return Math.max(height, layout.regulatorMinGeneBoxH || 0);
    }

    const height = geneBoxHeight(splitGenesByEffect(genes), 1, layout);
    return Math.max(height, layout.regulatorMinGeneBoxH || 0);
}

function maxDisplayLabelLength(genes) {
    return genes.reduce((maxLength, gene) => Math.max(maxLength, displayGeneLabel(gene).length), 0);
}

export function regulatorGeneBoxWidth(genes, layout = DEFAULT_GRAPH_LAYOUT) {
    const minWidth = layout.rightRegulatorMinW || layout.rightRegulatorW;
    const maxWidth = layout.rightRegulatorW;
    const charWidth = layout.geneFontSize * 0.62;
    const titleWidth = (`Negative${layout.regulatorGroupTitleSuffix || ''}`.length * 21) * 0.62 + 56;

    if (layout.regulatorGeneLayout === 'single') {
        const contentWidth = maxDisplayLabelLength(genes) * charWidth + 56;
        return Math.min(maxWidth, Math.max(minWidth, Math.ceil(contentWidth), Math.ceil(titleWidth)));
    }

    const columns = splitGenesByEffect(genes);
    const oneSided = layout.geneBoxStyle !== 'legacy' && isOneSidedGeneBox(columns);
    const contentWidth = (Math.max(
        maxDisplayLabelLength(columns.left),
        maxDisplayLabelLength(columns.right),
        6,
    ) * charWidth * 2) + 58;
    const adjustedContentWidth = oneSided
        ? contentWidth / (layout.oneSidedDividerRatio || 0.72)
        : contentWidth;

    return Math.min(maxWidth, Math.max(minWidth, Math.ceil(adjustedContentWidth), Math.ceil(titleWidth)));
}

function isOneSidedGeneBox(columns) {
    return (columns.left.length > 0 && columns.right.length === 0)
        || (columns.right.length > 0 && columns.left.length === 0);
}

function geneDisplayColumnCount(genes, layout = DEFAULT_GRAPH_LAYOUT, forceSplit = false) {
    if (forceSplit && genes.length > 1) return 2;
    return genes.length > layout.geneSubcolumnThreshold ? 2 : 1;
}

export function geneVisualRowCount(columns, layout = DEFAULT_GRAPH_LAYOUT) {
    const forceSplit = layout.geneBoxStyle !== 'legacy' && isOneSidedGeneBox(columns);
    const rowCountForSide = (genes) => Math.max(1, Math.ceil(genes.length / geneDisplayColumnCount(genes, layout, forceSplit)));
    return Math.max(rowCountForSide(columns.left), rowCountForSide(columns.right), 1);
}

export function splitGeneDisplayColumns(genes, layout = DEFAULT_GRAPH_LAYOUT, options = {}) {
    const columnCount = geneDisplayColumnCount(genes, layout, Boolean(options.forceSplit));
    const rowCount = Math.ceil(genes.length / columnCount);

    return Array.from({ length: columnCount }, (_item, index) => (
        genes.slice(index * rowCount, (index + 1) * rowCount)
    ));
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

export function splitTraitTextLines(value, maxChars = 18) {
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

export function traitNodeHeight(lines, layout = DEFAULT_GRAPH_LAYOUT) {
    const extraLines = Math.max(0, lines.length - 2);
    return layout.traitNodeMinH + (extraLines * layout.traitExtraLineH);
}

export function programDisplayLines(module, maxChars = 22) {
    const label = module.annotation ? `${module.program} ${module.annotation}` : module.program;
    return splitTextLines(label, maxChars, 2);
}

export function traitTextFontSize(lines, layout = DEFAULT_GRAPH_LAYOUT) {
    const longest = Math.max(...lines.map((line) => line.length), 0);
    if (layout.mode === GRAPH_VIEW_MODES.full) {
        if (lines.length <= 1) return longest <= 8 ? 33 : 28;
        if (lines.length === 2) return longest <= 10 ? 28 : 25;
        if (lines.length === 3) return longest <= 12 ? 24 : 21;
        return 20;
    }
    if (lines.length <= 1) {
        if (longest <= 8) return 38;
        if (longest <= 14) return 34;
        return 30;
    }
    if (lines.length === 2) return longest <= 10 ? 32 : 29;
    if (lines.length === 3) return longest <= 12 ? 27 : 24;
    return 22;
}

export function traitPortY(index, total, traitNodeHeightValue) {
    if (total <= 1) return 0;
    const usableHeight = traitNodeHeightValue - (TRAIT_PORT_INSET * 2);
    return -usableHeight / 2 + ((usableHeight / (total - 1)) * index);
}

export function normalizeGeneLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_MAX_GENES;
    return clamp(Math.round(parsed), 1, 50);
}

function buildExportSvg(svgElement) {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    return `<?xml version="1.0" standalone="no"?>\n${source}`;
}

export function exportSvg(svgElement, fileName) {
    const source = buildExportSvg(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, fileName);
}

export function exportPng(svgElement, fileName) {
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

export function useGraphTransform() {
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

export function computeEdgeStyle(score, highlighted, muted) {
    const absScore = Math.abs(toFiniteNumber(score, 0));
    return {
        width: 1.4 + clamp(absScore, 0, 6) * 1.35,
        opacity: muted ? 0.14 : (highlighted ? 0.96 : 0.66 + clamp(absScore / 6, 0, 1) * 0.26),
    };
}

export function buildModuleBlueprints(programs, side, filters, expandedPrograms, layout = DEFAULT_GRAPH_LAYOUT) {
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
        const regulatorGroups = side === 'regulator' ? groupRegulatorGenesByBucket(visibleGenes, layout) : null;
        const titleRows = programDisplayLines(program, 19).length || 1;
        const regulatorGroupHeights = regulatorGroups
            ? regulatorGroups.reduce((acc, group) => {
                acc[group.key] = regulatorGeneBoxHeight(group.genes, layout);
                return acc;
            }, {})
            : null;
        const regulatorGroupsHeight = regulatorGroups && layout.regulatorGroupLayout === 'vertical'
            ? regulatorGroups.reduce((sum, group, index) => (
                sum + (regulatorGroupHeights[group.key] || 0) + (index > 0 ? layout.regulatorGroupGap : 0)
            ), 0)
            : regulatorGroups
                ? Math.max(...regulatorGroups.map((group) => regulatorGroupHeights[group.key] || 0), 0)
                : 0;
        const height = program.collapsed
            ? 74
            : side === 'regulator'
                ? Math.max(layout.rightProgramH + (layout.mode === GRAPH_VIEW_MODES.full ? 34 : 24), regulatorGroupsHeight)
                : geneBoxHeight(geneColumns, titleRows, layout);

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
        ? modules.reduce((sum, module) => sum + module.height, 0) + ((modules.length - 1) * layout.moduleGap)
        : 0;

    return { modules, contentHeight };
}

export function positionModules(modules, side, traitCenterY, layout = DEFAULT_GRAPH_LAYOUT) {
    const contentHeight = modules.length
        ? modules.reduce((sum, module) => sum + module.height, 0) + ((modules.length - 1) * layout.moduleGap)
        : 0;
    const startY = Math.max(layout.graphTopPadding, traitCenterY - (contentHeight / 2));
    let cursorY = startY;

    const positionedModules = modules.map((module, index) => {
        const xProgram = side === 'program' ? layout.leftProgramX : layout.rightProgramX;
        const rectXGenes = side === 'program' ? layout.leftProgramX : layout.rightRegulatorX;
        const positioned = {
            ...module,
            layoutIndex: index,
            xProgram,
            rectXGenes,
            yTop: cursorY,
            yCenter: cursorY + (module.height / 2),
        };
        cursorY += module.height + layout.moduleGap;
        return positioned;
    });

    return {
        modules: positionedModules,
        contentHeight,
        bottomY: cursorY,
    };
}
