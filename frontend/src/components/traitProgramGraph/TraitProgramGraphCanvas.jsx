import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Download from '@mui/icons-material/Download';
import OpenInNew from '@mui/icons-material/OpenInNew';
import RestartAlt from '@mui/icons-material/RestartAlt';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import {
    allGeneDetailColumnCount,
    allGeneDetailGroups,
    computeEdgeStyle,
    directionFromSign,
    displayGeneLabel,
    edgeColorFromSign,
    effectColorFromGene,
    exportPng,
    exportSvg,
    formatGeneTooltip,
    formatProgramTooltip,
    GRAPH_RENDER_MAX_WIDTH,
    INLINE_LEGEND_GROUPS,
    programColor,
    programDisplayLines,
    programFillOpacity,
    programStripeOpacity,
    sanitizeFileNamePart,
    splitGeneDisplayColumns,
    splitGenesByEffect,
    regulatorGeneBoxHeight,
    regulatorGeneBoxWidth,
    SVG_WIDTH,
    toFiniteNumber,
    traitPortY,
    EFFECT_COLORS,
    EFFECT_COLOR_RGB,
    EDGE_TARGET_GAP,
} from './shared';

function edgeEndpoint(startX, startY, endX, endY, distanceFromEnd) {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt((dx * dx) + (dy * dy)) || 1;
    return {
        x: endX - ((dx / length) * distanceFromEnd),
        y: endY - ((dy / length) * distanceFromEnd),
    };
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

function centeredLineY(top, height, lineCount, lineStep, index) {
    return top + (height / 2) - (((lineCount - 1) * lineStep) / 2) + (index * lineStep);
}

function selectedGeneLabel(gene) {
    return gene?.geneLabel || gene?.gene || gene?.ensg || gene?.highlightKey || '';
}

function splitModulesForFocus(modules, focusActive, isFocused) {
    if (!focusActive) return { background: modules, focused: [] };

    return modules.reduce((acc, module) => {
        if (isFocused(module)) acc.focused.push(module);
        else acc.background.push(module);
        return acc;
    }, { background: [], focused: [] });
}

function ZoomToolbar({ scale, zoomIn, zoomOut, resetView }) {
    const zoomLabel = `${Math.round(scale * 100)}%`;

    return (
        <Box
            data-graph-control="true"
            onPointerDown={(event) => event.stopPropagation()}
            sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 3,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.75,
                py: 0.65,
                borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.94)',
                border: '1px solid rgba(15,23,42,0.12)',
                boxShadow: '0 12px 34px rgba(15,23,42,0.12)',
                backdropFilter: 'blur(8px)',
            }}
        >
            <Chip
                label={zoomLabel}
                size="small"
                sx={{
                    height: 26,
                    minWidth: 58,
                    borderRadius: 1,
                    fontWeight: 740,
                    color: '#0f172a',
                    bgcolor: 'rgba(15,23,42,0.06)',
                }}
            />
            <Tooltip title="Zoom out">
                <IconButton size="small" aria-label="Zoom out" onClick={zoomOut}>
                    <ZoomOut fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Zoom in">
                <IconButton size="small" aria-label="Zoom in" onClick={zoomIn}>
                    <ZoomIn fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Reset view">
                <IconButton size="small" aria-label="Reset view" onClick={resetView}>
                    <RestartAlt fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

function SelectionActions({
    clearSelection,
    onOpenGene,
    onOpenProgram,
    selectedGene,
    selectedGeneOccurrences,
    selectedProgram,
}) {
    if (!selectedProgram && !selectedGene) return null;

    const geneLabel = selectedGeneLabel(selectedGene);
    const occurrenceCount = selectedGeneOccurrences?.length || 0;

    return (
        <Box
            data-graph-control="true"
            onPointerDown={(event) => event.stopPropagation()}
            sx={{
                position: 'absolute',
                left: 12,
                bottom: 12,
                zIndex: 3,
                maxWidth: { xs: 'calc(100% - 24px)', sm: 460 },
                p: 1,
                borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(15,23,42,0.12)',
                boxShadow: '0 16px 42px rgba(15,23,42,0.14)',
                backdropFilter: 'blur(8px)',
            }}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                {selectedProgram && (
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Chip
                            label={`Context: ${selectedProgram}`}
                            size="small"
                            sx={{
                                borderRadius: 1,
                                fontWeight: 740,
                                color: '#334155',
                                bgcolor: 'rgba(15,23,42,0.07)',
                                maxWidth: 190,
                            }}
                        />
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNew />}
                            onClick={() => onOpenProgram?.(selectedProgram)}
                            sx={{ textTransform: 'none', fontWeight: 680, whiteSpace: 'nowrap' }}
                        >
                            Open context
                        </Button>
                    </Stack>
                )}
                {selectedGene && (
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Chip
                            label={`${geneLabel} - ${occurrenceCount} rows`}
                            size="small"
                            sx={{
                                borderRadius: 1,
                                fontWeight: 740,
                                color: EFFECT_COLORS.positive,
                                bgcolor: `rgba(${EFFECT_COLOR_RGB.positive},0.12)`,
                                maxWidth: 230,
                            }}
                        />
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNew />}
                            onClick={() => onOpenGene?.(selectedGene)}
                            sx={{ textTransform: 'none', fontWeight: 680, whiteSpace: 'nowrap' }}
                        >
                            Open gene
                        </Button>
                    </Stack>
                )}
                <Button
                    size="small"
                    variant="text"
                    onClick={clearSelection}
                    sx={{ textTransform: 'none', fontWeight: 680, whiteSpace: 'nowrap' }}
                >
                    Clear focus
                </Button>
            </Stack>
        </Box>
    );
}

export default function TraitProgramGraphCanvas({
    clearSelection,
    exportFileName,
    expandedAllGeneModuleKey,
    geneLimit,
    geneLimitOptions = [],
    graphLayout,
    isDragging,
    isTransformAnimating,
    leftLayout,
    onOpenGene,
    onOpenProgram,
    onClearAllGeneFocus,
    onGeneLimitChange,
    onToggleAllGeneModule,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onSelectGene,
    onSelectProgram,
    onWheel,
    resetView,
    rightLayout,
    selectedGene,
    selectedGeneKey,
    selectedGeneOccurrences,
    selectedProgram,
    shouldSuppressClick,
    svgHeight,
    svgViewportHeight,
    svgRef,
    traitCenterY,
    traitDisplayLines,
    traitFontSize,
    traitNodeHeightValue,
    transform,
    transformAnimationMs = 0,
    visibleSides,
    zoomIn,
    zoomOut,
}) {
    const graphViewportRef = useRef(null);
    const layout = graphLayout;
    const exportStem = sanitizeFileNamePart(exportFileName || 'trait-gene-association-map');
    const exportSuffix = geneLimit === Number.POSITIVE_INFINITY ? 'all_overview' : `genes_${geneLimit}`;
    const renderMaxWidth = graphLayout.mode === 'full' ? GRAPH_RENDER_MAX_WIDTH.full : GRAPH_RENDER_MAX_WIDTH.compact;
    const displayGeneLimit = geneLimit;
    const displayGeneLimitLabel = displayGeneLimit === Number.POSITIVE_INFINITY
        ? (graphLayout.allGeneLabelCount || graphLayout.defaultMaxGenes || 5)
        : displayGeneLimit;
    const isAllGeneMode = geneLimit === Number.POSITIVE_INFINITY;
    const allGeneFocusActive = isAllGeneMode && Boolean(expandedAllGeneModuleKey);
    const isFocusedAllGeneModule = useCallback(
        (module) => allGeneFocusActive && module?.allGeneModuleKey === expandedAllGeneModuleKey,
        [allGeneFocusActive, expandedAllGeneModuleKey],
    );

    useEffect(() => {
        const element = graphViewportRef.current;
        if (!element) return undefined;

        const handleWheel = (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            if (event.cancelable) event.preventDefault();
        };

        element.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            element.removeEventListener('wheel', handleWheel);
        };
    }, []);

    const handlePlotBlankClick = useCallback((event) => {
        const target = event.target;
        const clickedInteractiveElement = target?.closest?.('[data-graph-clickable="true"]');
        const clickedGraphControl = target?.closest?.('[data-graph-control="true"]');

        if (clickedInteractiveElement || clickedGraphControl || shouldSuppressClick()) return;
        clearSelection();
        onClearAllGeneFocus?.();
    }, [clearSelection, onClearAllGeneFocus, shouldSuppressClick]);

    const handleProgramModuleClick = useCallback((module) => {
        if (shouldSuppressClick()) return;
        if (isAllGeneMode && module?.allGeneOverview) {
            onToggleAllGeneModule?.(module.allGeneModuleKey, module);
            return;
        }
        onSelectProgram(module.program, module.side);
    }, [isAllGeneMode, onSelectProgram, onToggleAllGeneModule, shouldSuppressClick]);

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
        const legacyGeneBox = layout.geneBoxStyle === 'legacy';
        const columnGap = layout.geneColumnGap || 16;
        const subcolumnGap = layout.geneSubcolumnGap || 18;
        const sidePadding = layout.geneSidePadding || 16;
        const headerHeight = titleRows > 1 ? layout.geneHeaderHTall : layout.geneHeaderH;
        const leftHasGenes = columns.left.length > 0;
        const rightHasGenes = columns.right.length > 0;
        const oneSided = !legacyGeneBox && leftHasGenes !== rightHasGenes;
        const emptySideWidth = Math.min(
            Math.max(layout.geneEmptySideW || 72, width * 0.12),
            width * 0.28,
        );
        const dividerX = legacyGeneBox
            ? x + (width / 2)
            : oneSided
            ? (leftHasGenes ? x + width - emptySideWidth : x + emptySideWidth)
            : x + (width / 2);
        const rowStartY = y + headerHeight + (legacyGeneBox ? 0 : layout.geneRowH / 2);
        const dividerTop = legacyGeneBox ? y + (layout.geneDividerTopInset || 42) : y + headerHeight + 8;
        const dividerBottom = legacyGeneBox
            ? y + height - (layout.geneDividerBottomInset || 18)
            : y + height - Math.max(12, (layout.geneBottomPadding || 0) * 0.6);
        const sideAreas = {
            left: {
                start: x + sidePadding,
                end: dividerX - columnGap,
            },
            right: {
                start: dividerX + columnGap,
                end: x + width - sidePadding,
            },
        };

        const renderGene = (gene, column, subcolumnIndex, rowIndex, subcolumnCount) => {
            const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
            const geneProgramSelected = selectedProgram === selectedProgramName;
            const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected) || (Boolean(selectedGeneKey) && !geneMatched);
            const rowY = rowStartY + (rowIndex * layout.geneRowH);
            const area = sideAreas[column];
            const totalGap = Math.max(0, subcolumnCount - 1) * subcolumnGap;
            const subcolumnWidth = Math.max(1, ((area.end - area.start) - totalGap) / subcolumnCount);
            const textX = textAnchor === 'end'
                ? area.end - ((subcolumnCount - 1 - subcolumnIndex) * (subcolumnWidth + subcolumnGap))
                : area.start + (subcolumnIndex * (subcolumnWidth + subcolumnGap));
            const anchor = textAnchor === 'end' ? 'end' : 'start';

            return (
                <g
                    key={`${gene.id}:${column}:${subcolumnIndex}:${rowIndex}`}
                    data-graph-clickable="true"
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelectGene(gene);
                    }}
                    onDoubleClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpenGene?.(gene);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <text
                        x={textX}
                        y={rowY}
                        textAnchor={anchor}
                        dominantBaseline={legacyGeneBox ? undefined : 'middle'}
                        fontSize={layout.geneFontSize}
                        fontWeight={geneMatched ? (legacyGeneBox ? 900 : 800) : (legacyGeneBox ? 800 : 700)}
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
                {dividerBottom > dividerTop && (
                    <line
                        x1={dividerX}
                        y1={dividerTop}
                        x2={dividerX}
                        y2={dividerBottom}
                        stroke={legacyGeneBox ? '#555' : '#94a3b8'}
                        strokeWidth={legacyGeneBox ? '1.5' : '1.35'}
                        strokeDasharray={legacyGeneBox ? '2 3' : '5 5'}
                        strokeLinecap={legacyGeneBox ? undefined : 'round'}
                    />
                )}
                {splitGeneDisplayColumns(columns.left, layout, { forceSplit: oneSided && leftHasGenes }).map((genes, subcolumnIndex, subcolumns) => (
                    genes.map((gene, rowIndex) => renderGene(gene, 'left', subcolumnIndex, rowIndex, subcolumns.length))
                ))}
                {splitGeneDisplayColumns(columns.right, layout, { forceSplit: oneSided && rightHasGenes }).map((genes, subcolumnIndex, subcolumns) => (
                    genes.map((gene, rowIndex) => renderGene(gene, 'right', subcolumnIndex, rowIndex, subcolumns.length))
                ))}
            </g>
        );
    }, [layout, onOpenGene, onSelectGene, selectedGeneKey, selectedProgram]);

    const renderGeneOverview = useCallback(({
        genes,
        x,
        y,
        width,
        height,
        selectedProgramName,
        titleRows = 1,
        forceMuted = false,
    }) => {
        const columns = splitGenesByEffect(genes || []);
        const tightOverview = height <= 104;
        const headerHeight = tightOverview
            ? Math.min(42, Math.max(34, layout.geneHeaderH - 8))
            : titleRows > 1 ? layout.geneHeaderHTall : layout.geneHeaderH;
        const contentY = y + headerHeight + (tightOverview ? 5 : 8);
        const contentH = Math.max(tightOverview ? 34 : 56, height - headerHeight - (tightOverview ? 12 : 16));
        const laneInsetX = tightOverview ? 14 : 18;
        const laneX = x + laneInsetX;
        const laneGap = tightOverview ? 6 : 8;
        const laneW = tightOverview
            ? Math.max(58, (width - (laneInsetX * 2) - laneGap) / 2)
            : Math.max(40, width - (laneInsetX * 2));
        const laneH = tightOverview
            ? Math.max(30, contentH)
            : Math.max(28, (contentH - laneGap) / 2);
        const lanes = [
            { key: 'left', label: 'Effect +', genes: columns.left, color: EFFECT_COLORS.positive },
            { key: 'right', label: 'Effect -', genes: columns.right, color: EFFECT_COLORS.negative },
        ];

        const renderLane = (lane, index) => {
            const laneY = tightOverview ? contentY : contentY + (index * (laneH + laneGap));
            const currentLaneX = tightOverview ? laneX + (index * (laneW + laneGap)) : laneX;
            const plotX = tightOverview ? currentLaneX + 8 : currentLaneX + 78;
            const plotY = tightOverview ? laneY + 20 : laneY + 6;
            const plotW = Math.max(tightOverview ? 24 : 24, laneW - (tightOverview ? 16 : 88));
            const plotH = Math.max(tightOverview ? 10 : 18, laneH - (tightOverview ? 25 : 12));
            const geneCount = lane.genes.length;

            if (forceMuted) {
                const segmentCount = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(Math.max(geneCount, 1)))));
                const segmentGap = tightOverview ? 2 : 3;
                const segmentW = Math.max(2, (plotW - ((segmentCount - 1) * segmentGap)) / segmentCount);
                const segmentH = Math.max(4, Math.min(tightOverview ? 9 : 13, plotH * 0.55));

                return (
                    <g key={lane.key}>
                        <rect
                            x={currentLaneX}
                            y={laneY}
                            width={laneW}
                            height={laneH}
                            rx="6"
                            fill="rgba(15,23,42,0.018)"
                            stroke="rgba(15,23,42,0.055)"
                        />
                        <text
                            x={currentLaneX + 8}
                            y={laneY + (tightOverview ? 13 : 15)}
                            fontSize={tightOverview ? 10 : 12}
                            fontWeight="820"
                            fill="#94a3b8"
                        >
                            {lane.label}
                        </text>
                        <text
                            x={tightOverview ? currentLaneX + laneW - 8 : currentLaneX + 9}
                            y={laneY + (tightOverview ? 13 : 29)}
                            textAnchor={tightOverview ? 'end' : 'start'}
                            fontSize={tightOverview ? 10 : 10}
                            fontWeight="740"
                            fill="#94a3b8"
                            fontVariant="tabular-nums"
                        >
                            {tightOverview ? geneCount : `${geneCount} genes`}
                        </text>
                        <g opacity={geneCount ? 0.48 : 0.18}>
                            {Array.from({ length: segmentCount }, (_item, segmentIndex) => (
                                <rect
                                    key={`${lane.key}:density:${segmentIndex}`}
                                    x={plotX + (segmentIndex * (segmentW + segmentGap))}
                                    y={plotY + ((plotH - segmentH) / 2)}
                                    width={segmentW}
                                    height={segmentH}
                                    rx="2"
                                    fill={lane.color}
                                    fillOpacity={0.25 + (segmentIndex / Math.max(1, segmentCount - 1)) * 0.28}
                                    pointerEvents="none"
                                />
                            ))}
                        </g>
                    </g>
                );
            }

            const sortedGenes = [...lane.genes].sort((a, b) => (b.absGamma || 0) - (a.absGamma || 0));
            const gridCols = Math.max(
                1,
                Math.ceil(Math.sqrt(Math.max(sortedGenes.length, 1) * (plotW / Math.max(plotH, 1)))),
            );
            const gridRows = Math.max(1, Math.ceil(Math.max(sortedGenes.length, 1) / gridCols));
            const cell = Math.max(
                tightOverview ? 1.2 : 1.5,
                Math.min(tightOverview ? 4.6 : 6, Math.min(plotW / gridCols, plotH / gridRows) - 0.6),
            );
            const xStep = plotW / Math.max(gridCols, 1);
            const yStep = plotH / Math.max(gridRows, 1);
            const markerOpacity = sortedGenes.length > 140 ? 0.58 : sortedGenes.length > 70 ? 0.68 : 0.82;
            const markerFill = (gene) => {
                const abs = Math.min(Math.abs(gene.absGamma || gene.postMean || 0), 6);
                if (abs > 3) return lane.color;
                return abs > 1.5 ? `${lane.color}CC` : `${lane.color}99`;
            };

            return (
                <g key={lane.key}>
                    <rect
                        x={currentLaneX}
                        y={laneY}
                        width={laneW}
                        height={laneH}
                        rx="6"
                        fill="rgba(15,23,42,0.035)"
                        stroke="rgba(15,23,42,0.08)"
                    />
                    <text
                        x={currentLaneX + 8}
                        y={laneY + (tightOverview ? 13 : 15)}
                        fontSize={tightOverview ? 10 : 12}
                        fontWeight="850"
                        fill={lane.color}
                    >
                        {lane.label}
                    </text>
                    <text
                        x={tightOverview ? currentLaneX + laneW - 8 : currentLaneX + 9}
                        y={laneY + (tightOverview ? 13 : 29)}
                        textAnchor={tightOverview ? 'end' : 'start'}
                        fontSize={tightOverview ? 10 : 10}
                        fontWeight="750"
                        fill="#64748b"
                        fontVariant="tabular-nums"
                    >
                        {tightOverview ? geneCount : `${geneCount} genes`}
                    </text>
                    {sortedGenes.map((gene, geneIndex) => {
                        const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
                        const geneProgramSelected = selectedProgram === selectedProgramName;
                        const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected)
                            || (Boolean(selectedGeneKey) && !geneMatched);
                        const col = geneIndex % gridCols;
                        const row = Math.floor(geneIndex / gridCols);
                        const markerX = plotX + (col * xStep) + ((xStep - cell) / 2);
                        const markerY = plotY + (row * yStep) + ((yStep - cell) / 2);
                        return (
                            <rect
                                key={`${gene.id}:overview:${lane.key}:${geneIndex}`}
                                x={markerX}
                                y={markerY}
                                width={cell}
                                height={cell}
                                rx={cell < 3 ? 0.4 : 1}
                                fill={geneMuted ? '#cbd5e1' : markerFill(gene)}
                                fillOpacity={geneMatched ? 1 : geneMuted ? 0.35 : markerOpacity}
                                stroke={geneMatched ? '#111827' : 'transparent'}
                                strokeWidth={geneMatched ? Math.max(1, cell * 0.35) : 0}
                                pointerEvents="none"
                            />
                        );
                    })}
                </g>
            );
        };

        return (
            <g>
                {lanes.map(renderLane)}
            </g>
        );
    }, [layout, selectedGeneKey, selectedProgram]);

    const renderAllGeneDetailPanel = useCallback(({
        module,
        x,
        y,
        width,
        height,
        selectedProgramName,
    }) => {
        const groups = allGeneDetailGroups(module.allGenes || []);
        const totalGenes = groups.reduce((sum, group) => sum + group.genes.length, 0);
        const paddingX = layout.allGeneDetailPaddingX ?? 14;
        const paddingY = layout.allGeneDetailPaddingY ?? 12;
        const headerH = layout.allGeneDetailHeaderH ?? 58;
        const groupHeaderH = layout.allGeneDetailGroupHeaderH ?? 24;
        const rowH = layout.allGeneDetailRowH ?? 24;
        const cellGap = layout.allGeneDetailCellGap ?? 8;
        const groupGap = layout.allGeneDetailGroupGap ?? 12;
        const columnCount = allGeneDetailColumnCount(width, layout);
        const contentX = x + paddingX;
        const contentW = width - (paddingX * 2);
        const cellW = Math.max(72, (contentW - ((columnCount - 1) * cellGap)) / columnCount);
        const titleLines = programDisplayLines(module, module.side === 'regulator' ? layout.rightProgramLabelChars : layout.leftProgramLabelChars);
        const nodeColor = programColor(module);
        const isProgramSelected = selectedProgram === selectedProgramName;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const panelMuted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const panelOriginX = x + (width / 2);
        const panelOriginY = y + Math.min(height, 96);
        let cursorY = y + paddingY + headerH;

        return (
            <g
                className="all-gene-expanded-panel"
                data-graph-clickable="true"
                onClick={(event) => event.stopPropagation()}
                style={{
                    transform: 'scale(1)',
                    transformOrigin: `${panelOriginX}px ${panelOriginY}px`,
                    transformBox: 'view-box',
                    transition: 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
                    animation: 'allGenePanelSettle 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
                }}
            >
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx="8"
                    fill="#fff"
                    stroke={nodeColor}
                    strokeWidth="2.8"
                    opacity={panelMuted ? 0.62 : 1}
                    style={{ transition: 'height 220ms ease, opacity 180ms ease' }}
                />
                <rect
                    x={x}
                    y={y}
                    width="14"
                    height={height}
                    rx="8"
                    fill={nodeColor}
                    fillOpacity={panelMuted ? 0.34 : 0.94}
                    pointerEvents="none"
                />
                <rect
                    x={x + 14}
                    y={y + 9}
                    width={width - 28}
                    height={headerH - 14}
                    rx="6"
                    fill="rgba(15,23,42,0.045)"
                    pointerEvents="none"
                />
                {titleLines.map((line, index) => (
                    <text
                        key={`${line}:${index}`}
                        x={x + 30}
                        y={y + 27 + (index * 17)}
                        fontSize={titleLines.length > 1 ? 13 : 15}
                        fontWeight="850"
                        fill="#111827"
                    >
                        {line}
                    </text>
                ))}
                <text
                    x={x + width - 28}
                    y={y + 33}
                    textAnchor="end"
                    fontSize="12"
                    fontWeight="800"
                    fill="#475467"
                    fontVariant="tabular-nums"
                >
                    {totalGenes} genes
                </text>
                <rect
                    x={x + 14}
                    y={y + 9}
                    width={width - 28}
                    height={headerH - 14}
                    rx="6"
                    fill="transparent"
                    data-graph-clickable="true"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleProgramModuleClick(module);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <title>{formatProgramTooltip(module)}</title>
                </rect>
                {groups.length === 0 ? (
                    <text
                        x={contentX}
                        y={y + paddingY + headerH + 32}
                        fontSize="13"
                        fontWeight="720"
                        fill="#667085"
                    >
                        No overlapping genes
                    </text>
                ) : (
                    <g
                        opacity="1"
                        style={{
                            animation: 'allGeneContentFade 360ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        {groups.map((group, groupIndex) => {
                    const rows = Math.ceil(group.genes.length / columnCount);
                    const groupH = groupHeaderH + (rows * rowH);
                    const groupY = cursorY + (groupIndex > 0 ? groupGap : 0);
                    cursorY = groupY + groupH;

                    return (
                        <g key={`${module.program}:${module.side}:${group.key}`}>
                            <rect
                                x={contentX}
                                y={groupY}
                                width={contentW}
                                height={groupH}
                                rx="7"
                                fill={`${group.color}0D`}
                                stroke={`${group.color}36`}
                                strokeWidth="1.2"
                                pointerEvents="none"
                            />
                            <rect
                                x={contentX}
                                y={groupY}
                                width={contentW}
                                height={groupHeaderH}
                                rx="7"
                                fill={`${group.color}18`}
                                pointerEvents="none"
                            />
                            <text
                                x={contentX + 12}
                                y={groupY + 16}
                                fontSize="12"
                                fontWeight="850"
                                fill={group.color}
                            >
                                {group.label}
                            </text>
                            <text
                                x={contentX + contentW - 12}
                                y={groupY + 16}
                                textAnchor="end"
                                fontSize="11"
                                fontWeight="780"
                                fill="#64748b"
                                fontVariant="tabular-nums"
                            >
                                {group.genes.length}
                            </text>
                            {group.genes.map((gene, geneIndex) => {
                                const col = geneIndex % columnCount;
                                const row = Math.floor(geneIndex / columnCount);
                                const cellX = contentX + (col * (cellW + cellGap));
                                const cellY = groupY + groupHeaderH + (row * rowH) + 3;
                                const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
                                const geneProgramSelected = selectedProgram === selectedProgramName;
                                const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected) || (Boolean(selectedGeneKey) && !geneMatched);
                                const color = effectColorFromGene(gene);
                                const label = displayGeneLabel(gene);
                                const maxChars = Math.max(8, Math.floor((cellW - 18) / 7.2));
                                const fittedLabel = label.length > maxChars ? `${label.slice(0, Math.max(1, maxChars - 3))}...` : label;

                                return (
                                    <g
                                        key={`${gene.id}:${group.key}:all-expanded:${geneIndex}`}
                                        data-graph-clickable="true"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onSelectGene(gene);
                                        }}
                                        onDoubleClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            onOpenGene?.(gene);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <rect
                                            x={cellX}
                                            y={cellY}
                                            width={cellW}
                                            height={rowH - 6}
                                            rx="4"
                                            fill={geneMatched ? `${color}1F` : '#fff'}
                                            stroke={geneMatched ? '#111827' : `${color}3B`}
                                            strokeWidth={geneMatched ? 1.8 : 1}
                                            opacity={geneMuted ? 0.42 : 1}
                                            style={{ transition: 'opacity 160ms ease, stroke 160ms ease, fill 160ms ease' }}
                                        />
                                        <rect
                                            x={cellX + 5}
                                            y={cellY + 5}
                                            width="5"
                                            height={rowH - 16}
                                            rx="2"
                                            fill={color}
                                            opacity={geneMuted ? 0.48 : 0.95}
                                            pointerEvents="none"
                                        />
                                        <text
                                            x={cellX + 16}
                                            y={cellY + ((rowH - 6) / 2)}
                                            dominantBaseline="middle"
                                            fontSize="11.5"
                                            fontWeight={geneMatched ? 880 : 760}
                                            fill={geneMuted ? '#94a3b8' : color}
                                        >
                                            {fittedLabel}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    );
                        })}
                    </g>
                )}
            </g>
        );
    }, [handleProgramModuleClick, layout, onOpenGene, onSelectGene, selectedGeneKey, selectedProgram]);

    const renderRegulatorGeneList = useCallback(({ genes, x, y, selectedProgramName }) => {
        const rowStartY = y + layout.geneHeaderH + (layout.geneRowH / 2);
        const textX = x + 28;

        return (
            <g>
                {genes.map((gene, rowIndex) => {
                    const geneMatched = Boolean(selectedGeneKey) && gene.highlightKey === selectedGeneKey;
                    const geneProgramSelected = selectedProgram === selectedProgramName;
                    const geneMuted = (Boolean(selectedProgram) && !geneProgramSelected) || (Boolean(selectedGeneKey) && !geneMatched);

                    return (
                        <g
                            key={`${gene.id}:regulator-single:${rowIndex}`}
                            data-graph-clickable="true"
                            onClick={(event) => {
                                event.stopPropagation();
                                onSelectGene(gene);
                            }}
                            onDoubleClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onOpenGene?.(gene);
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <text
                                x={textX}
                                y={rowStartY + (rowIndex * layout.geneRowH)}
                                textAnchor="start"
                                dominantBaseline="middle"
                                fontSize={layout.geneFontSize}
                                fontWeight={geneMatched ? 800 : 700}
                                fill={geneMuted ? '#b5b5b5' : effectColorFromGene(gene)}
                                opacity={geneMuted ? 0.55 : 1}
                            >
                                {displayGeneLabel(gene)}
                            </text>
                            <title>{formatGeneTooltip(gene)}</title>
                        </g>
                    );
                })}
            </g>
        );
    }, [layout, onOpenGene, onSelectGene, selectedGeneKey, selectedProgram]);

    const renderLeftProgramModule = useCallback((module) => {
        if (!visibleSides.has(module.side)) return null;

        const isCollapsedAllOverview = module.allGeneOverview && !module.allGeneExpanded;
        const programBoxX = layout.leftProgramX;
        const programBoxW = isCollapsedAllOverview
            ? (layout.allGeneOverviewProgramW || layout.leftProgramW)
            : layout.leftProgramW;
        const score = module.programScore;
        const direction = directionFromSign(module.programTraitSign, score);
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const allGeneFocused = isFocusedAllGeneModule(module);
        const allGeneMuted = allGeneFocusActive && !allGeneFocused;
        const edgeHighlighted = isProgramSelected || moduleGeneMatches || allGeneFocused;
        const muted = allGeneMuted || (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const edgeStyle = computeEdgeStyle(score, edgeHighlighted, muted);
        const centerY = module.yCenter;
        const traitLeftX = layout.traitCenterX - (layout.traitNodeW / 2);
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, leftLayout.modules.length, traitNodeHeightValue);
        const boxHeight = module.height;
        const titleLines = programDisplayLines(module, layout.leftProgramLabelChars);
        const nodeColor = programColor(module);

        if (allGeneMuted) {
            return (
                <g
                    key={`${module.program}:program`}
                    opacity="0.2"
                    style={{ transition: 'opacity 160ms ease' }}
                >
                    <ArrowOrCap
                        x1={programBoxX + programBoxW}
                        y1={centerY}
                        x2={traitLeftX}
                        y2={traitTargetY}
                        color={edgeColorFromSign(module.programTraitSign, score)}
                        direction={direction}
                        opacity={0.32}
                        width={2.2}
                    />

                    <g
                        data-graph-clickable="true"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleProgramModuleClick(module);
                        }}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            onOpenProgram?.(module.program);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        <rect
                            x={programBoxX}
                            y={module.yTop}
                            width={programBoxW}
                            height={boxHeight}
                            rx="6"
                            fill="#fff"
                            fillOpacity="0.74"
                            stroke={nodeColor}
                            strokeOpacity="0.62"
                            strokeWidth="2.2"
                        />
                        <rect
                            x={programBoxX}
                            y={module.yTop}
                            width="10"
                            height={boxHeight}
                            rx="6"
                            fill={nodeColor}
                            fillOpacity="0.62"
                            pointerEvents="none"
                        />
                        {titleLines.map((line, index) => (
                            <text
                                key={line}
                                x={programBoxX + (programBoxW / 2)}
                                y={centeredLineY(
                                    module.yTop,
                                    Math.min(boxHeight, layout.geneHeaderH),
                                    titleLines.length,
                                    Math.max(16, layout.leftProgramTitleStep - 4),
                                    index,
                                )}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={Math.max(15, layout.leftProgramTitleFontSize - 5)}
                                fontWeight="780"
                                fill="#64748b"
                            >
                                {line}
                            </text>
                        ))}
                        <text
                            x={programBoxX + programBoxW - 14}
                            y={module.yTop + boxHeight - 12}
                            textAnchor="end"
                            fontSize="11"
                            fontWeight="760"
                            fill="#94a3b8"
                            fontVariant="tabular-nums"
                        >
                            {module.totalFilteredGenes}
                        </text>
                        <title>{formatProgramTooltip(module)}</title>
                    </g>
                </g>
            );
        }

        return (
            <g
                key={`${module.program}:program`}
                opacity={allGeneMuted ? 0.22 : 1}
                style={{ transition: 'opacity 180ms ease' }}
            >
                <ArrowOrCap
                    x1={programBoxX + programBoxW}
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
                    onClick={(event) => {
                        event.stopPropagation();
                        handleProgramModuleClick(module);
                    }}
                    onDoubleClick={(event) => {
                        event.stopPropagation();
                        onOpenProgram?.(module.program);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={programBoxX}
                        y={module.yTop}
                        width={programBoxW}
                        height={boxHeight}
                        rx="6"
                        fill={nodeColor}
                        fillOpacity={programFillOpacity(module, muted)}
                        stroke={isProgramSelected ? '#111' : nodeColor}
                        strokeWidth={isProgramSelected ? 3.2 : 2.6}
                    />
                    <rect
                        x={programBoxX}
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
                            x={programBoxX + (programBoxW / 2)}
                            y={layout.geneBoxStyle === 'legacy'
                                ? module.yTop + 31 + (index * layout.leftProgramTitleStep)
                                : centeredLineY(
                                    module.yTop,
                                    titleLines.length > 1 ? layout.geneHeaderHTall : layout.geneHeaderH,
                                    titleLines.length,
                                    layout.leftProgramTitleStep,
                                    index,
                                )}
                            textAnchor="middle"
                            dominantBaseline={layout.geneBoxStyle === 'legacy' ? undefined : 'middle'}
                            fontSize={layout.leftProgramTitleFontSize}
                            fontWeight={layout.geneBoxStyle === 'legacy' ? '900' : '800'}
                            fill="#111"
                        >
                            {line}
                        </text>
                    ))}
                    {module.collapsed ? (
                        <text
                            x={programBoxX + 16}
                            y={layout.geneBoxStyle === 'legacy' ? module.yTop + 58 : module.yTop + (boxHeight / 2)}
                            dominantBaseline={layout.geneBoxStyle === 'legacy' ? undefined : 'middle'}
                            fontSize="18"
                            fill="#555"
                        >
                            {module.emptyReason || 'No overlap'}
                        </text>
                    ) : module.allGeneOverview ? (
                        module.allGeneExpanded ? renderAllGeneDetailPanel({
                            module,
                            x: layout.leftProgramX,
                            y: module.yTop,
                            width: module.allGeneDetailPanelWidth || layout.leftProgramW,
                            height: boxHeight,
                            selectedProgramName: module.program,
                        }) : renderGeneOverview({
                            genes: module.allGenes,
                            x: programBoxX,
                            y: module.yTop,
                            width: programBoxW,
                            height: boxHeight,
                            selectedProgramName: module.program,
                            titleRows: titleLines.length,
                            forceMuted: muted,
                        })
                    ) : renderGeneColumns({
                        columns: module.geneColumns,
                        x: programBoxX,
                        y: module.yTop,
                        width: programBoxW,
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
        leftLayout.modules.length,
        layout,
        handleProgramModuleClick,
        allGeneFocusActive,
        isFocusedAllGeneModule,
        onOpenProgram,
        renderAllGeneDetailPanel,
        renderGeneOverview,
        renderGeneColumns,
        selectedGeneKey,
        selectedProgram,
        traitCenterY,
        traitNodeHeightValue,
        visibleSides,
    ]);

    const renderRegulatorGroup = useCallback((module, group, x, yTop, width, height) => {
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && group.genes.some((gene) => gene.highlightKey === selectedGeneKey);
        const allGeneFocused = isFocusedAllGeneModule(module);
        const allGeneMuted = allGeneFocusActive && !allGeneFocused;
        const muted = allGeneMuted || (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const groupColor = group.sign === 'negative' ? EFFECT_COLORS.negative : EFFECT_COLORS.positive;
        const allModeGroupClickProps = module.allGeneOverview ? {
            'data-graph-clickable': 'true',
            onClick: (event) => {
                event.stopPropagation();
                handleProgramModuleClick(module);
            },
            style: { cursor: 'pointer' },
        } : {};

        if (layout.regulatorGroupStyle === 'legacy') {
            return (
                <g key={`${module.program}:regulator:${group.key}`} {...allModeGroupClickProps}>
                    <rect
                        x={x}
                        y={yTop}
                        width={width}
                        height={height}
                        rx="6"
                        fill="#fff"
                        fillOpacity={muted ? 0.38 : 1}
                        stroke={groupColor}
                        strokeWidth="2.6"
                    />
                    <text x={x + 14} y={yTop + 28} fontSize="24" fontWeight="900" fill={groupColor}>
                        {group.title}
                    </text>
                    {group.genes.length && module.allGeneOverview ? renderGeneOverview({
                        genes: group.genes,
                        x,
                        y: yTop,
                        width,
                        height,
                        selectedProgramName: module.program,
                        forceMuted: muted,
                    }) : null}
                    {group.genes.length && !module.allGeneOverview ? renderGeneColumns({
                        columns: splitGenesByEffect(group.genes),
                        x,
                        y: yTop,
                        width,
                        height,
                        textAnchor: 'start',
                        selectedProgramName: module.program,
                    }) : null}
                </g>
            );
        }

        const groupRgb = group.sign === 'negative' ? EFFECT_COLOR_RGB.negative : EFFECT_COLOR_RGB.positive;
        const groupFill = `rgba(${groupRgb},0.10)`;
        const groupHeaderFill = `rgba(${groupRgb},0.16)`;

        return (
            <g key={`${module.program}:regulator:${group.key}`} {...allModeGroupClickProps}>
                <rect
                    x={x}
                    y={yTop}
                    width={width}
                    height={height}
                    rx="6"
                    fill="#fff"
                    stroke={groupColor}
                    strokeWidth="2.6"
                />
                <rect
                    x={x}
                    y={yTop}
                    width={width}
                    height={height}
                    rx="6"
                    fill={groupFill}
                    fillOpacity={muted ? 0.32 : 1}
                    pointerEvents="none"
                />
                <rect
                    x={x}
                    y={yTop}
                    width="14"
                    height={height}
                    rx="6"
                    fill={groupColor}
                    fillOpacity={muted ? 0.34 : 0.9}
                    pointerEvents="none"
                />
                <rect
                    x={x + 14}
                    y={yTop + 8}
                    width={width - 28}
                    height="32"
                    rx="5"
                    fill={groupHeaderFill}
                    fillOpacity={muted ? 0.32 : 1}
                    pointerEvents="none"
                />
                <text
                    x={x + 28}
                    y={yTop + 24}
                    dominantBaseline="middle"
                    fontSize="21"
                    fontWeight="800"
                    fill={muted ? '#8a8f98' : groupColor}
                >
                    {group.title}
                </text>
                {group.genes.length && module.allGeneOverview
                    ? renderGeneOverview({
                        genes: group.genes,
                        x,
                        y: yTop,
                        width,
                        height,
                        selectedProgramName: module.program,
                        forceMuted: muted,
                    })
                    : null}
                {group.genes.length && !module.allGeneOverview && layout.regulatorGeneLayout === 'single'
                    ? renderRegulatorGeneList({
                        genes: group.genes,
                        x,
                        y: yTop,
                        selectedProgramName: module.program,
                    })
                    : null}
                {group.genes.length && !module.allGeneOverview && layout.regulatorGeneLayout !== 'single'
                    ? renderGeneColumns({
                        columns: splitGenesByEffect(group.genes),
                        x,
                        y: yTop,
                        width,
                        height,
                        textAnchor: 'start',
                        selectedProgramName: module.program,
                    })
                    : null}
            </g>
        );
    }, [
        allGeneFocusActive,
        handleProgramModuleClick,
        isFocusedAllGeneModule,
        layout,
        renderGeneColumns,
        renderGeneOverview,
        renderRegulatorGeneList,
        selectedGeneKey,
        selectedProgram,
    ]);

    const renderRightProgramModule = useCallback((module) => {
        if (!visibleSides.has(module.side)) return null;

        const isCollapsedAllOverview = module.allGeneOverview && !module.allGeneExpanded;
        const programBoxX = layout.rightProgramX;
        const programBoxW = isCollapsedAllOverview
            ? (layout.allGeneOverviewRightProgramW || layout.rightProgramW)
            : layout.rightProgramW;
        const regulatorBoxW = isCollapsedAllOverview
            ? (layout.allGeneOverviewRegulatorW || layout.rightRegulatorW)
            : layout.rightRegulatorW;
        const regulatorScore = module.regulatorScore;
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const allGeneFocused = isFocusedAllGeneModule(module);
        const allGeneMuted = allGeneFocusActive && !allGeneFocused;
        const edgeHighlighted = isProgramSelected || moduleGeneMatches || allGeneFocused;
        const muted = allGeneMuted || (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const programScore = module.programScore;
        const programEdgeStyle = computeEdgeStyle(programScore, edgeHighlighted, muted);
        const programY = module.allGeneExpanded ? module.yTop + (layout.rightProgramH / 2) : module.yCenter;
        const programBoxY = programY - (layout.rightProgramH / 2);
        const traitRightX = layout.traitCenterX + (layout.traitNodeW / 2);
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, rightLayout.modules.length, traitNodeHeightValue);
        const programLines = programDisplayLines(module, layout.rightProgramLabelChars);
        const nodeColor = programColor(module);
        const regulatorGroups = module.regulatorGroups || [];

        if (allGeneMuted) {
            const regulatorGhostH = Math.max(
                layout.rightProgramH + 20,
                Math.min(module.height, regulatorGroups.length
                    ? regulatorGroups.reduce((sum, group, index) => (
                        sum
                        + (module.regulatorGroupHeights?.[group.key] || layout.allGeneRegulatorGroupH || 92)
                        + (index > 0 ? Math.min(layout.regulatorGroupGap, 10) : 0)
                    ), 0)
                    : (layout.allGeneRegulatorGroupH || 92)),
            );
            const regulatorGhostY = module.yTop + ((module.height - regulatorGhostH) / 2);
            const regulatorGhostCenterY = regulatorGhostY + (regulatorGhostH / 2);

            return (
                <g
                    key={`${module.program}:regulator`}
                    opacity="0.2"
                    style={{ transition: 'opacity 160ms ease' }}
                >
                    <ArrowOrCap
                        x1={programBoxX}
                        y1={programY}
                        x2={traitRightX}
                        y2={traitTargetY}
                        color={edgeColorFromSign(module.programTraitSign, programScore)}
                        direction={directionFromSign(module.programTraitSign, programScore)}
                        opacity={0.32}
                        width={2.2}
                    />
                    <line
                        x1={layout.rightRegulatorX}
                        y1={regulatorGhostCenterY}
                        x2={programBoxX + programBoxW}
                        y2={programY}
                        stroke={edgeColorFromSign(module.regulatorProgramSign, regulatorScore)}
                        strokeWidth="2"
                        strokeOpacity="0.22"
                        strokeLinecap="round"
                    />
                    <g
                        data-graph-clickable="true"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleProgramModuleClick(module);
                        }}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            onOpenProgram?.(module.program);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        <rect
                            x={programBoxX}
                            y={programBoxY}
                            width={programBoxW}
                            height={layout.rightProgramH}
                            rx="5"
                            fill="#fff"
                            fillOpacity="0.74"
                            stroke={nodeColor}
                            strokeOpacity="0.62"
                            strokeWidth="2.1"
                        />
                        <rect
                            x={programBoxX}
                            y={programBoxY}
                            width="10"
                            height={layout.rightProgramH}
                            rx="5"
                            fill={nodeColor}
                            fillOpacity="0.62"
                            pointerEvents="none"
                        />
                        {programLines.map((line, index) => (
                            <text
                                key={line}
                                x={programBoxX + (programBoxW / 2)}
                                y={centeredLineY(
                                    programBoxY,
                                    layout.rightProgramH,
                                    programLines.length,
                                    Math.max(15, layout.rightProgramTitleStep - 4),
                                    index,
                                )}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={Math.max(14, layout.rightProgramTitleFontSize - 5)}
                                fontWeight="780"
                                fill="#64748b"
                            >
                                {line}
                            </text>
                        ))}
                        <rect
                            x={layout.rightRegulatorX}
                            y={regulatorGhostY}
                            width={regulatorBoxW}
                            height={regulatorGhostH}
                            rx="7"
                            fill="#fff"
                            fillOpacity="0.68"
                            stroke="#94a3b8"
                            strokeOpacity="0.45"
                            strokeWidth="1.8"
                        />
                        <rect
                            x={layout.rightRegulatorX}
                            y={regulatorGhostY}
                            width="10"
                            height={regulatorGhostH}
                            rx="7"
                            fill={nodeColor}
                            fillOpacity="0.42"
                            pointerEvents="none"
                        />
                        <text
                            x={layout.rightRegulatorX + 24}
                            y={regulatorGhostY + 25}
                            fontSize="14"
                            fontWeight="780"
                            fill="#64748b"
                        >
                            regulator context
                        </text>
                        <text
                            x={layout.rightRegulatorX + regulatorBoxW - 14}
                            y={regulatorGhostY + regulatorGhostH - 14}
                            textAnchor="end"
                            fontSize="11"
                            fontWeight="760"
                            fill="#94a3b8"
                            fontVariant="tabular-nums"
                        >
                            {module.totalFilteredGenes}
                        </text>
                        <title>{formatProgramTooltip(module)}</title>
                    </g>
                </g>
            );
        }

        if (module.allGeneExpanded) {
            const panelGap = layout.allGeneExpandedPanelGap || 12;
            const panelY = programBoxY + layout.rightProgramH + panelGap;
            const panelWidth = module.allGeneDetailPanelWidth || layout.allGeneExpandedRegulatorPanelW || layout.rightRegulatorW;

            return (
                <g
                    key={`${module.program}:regulator`}
                    opacity={allGeneMuted ? 0.22 : 1}
                    style={{ transition: 'opacity 180ms ease' }}
                >
                    <ArrowOrCap
                        x1={layout.rightProgramX}
                        y1={programY}
                        x2={traitRightX}
                        y2={traitTargetY}
                        color={edgeColorFromSign(module.programTraitSign, programScore)}
                        direction={directionFromSign(module.programTraitSign, programScore)}
                        opacity={programEdgeStyle.opacity}
                        width={Math.max(2.8, programEdgeStyle.width * 0.82)}
                    />
                    <g
                        data-graph-clickable="true"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleProgramModuleClick(module);
                        }}
                        onDoubleClick={(event) => {
                            event.stopPropagation();
                            onOpenProgram?.(module.program);
                        }}
                        style={{ cursor: 'pointer' }}
                    >
                        <rect
                            x={layout.rightProgramX}
                            y={programBoxY}
                            width={layout.rightProgramW}
                            height={layout.rightProgramH}
                            rx="5"
                            fill={nodeColor}
                            fillOpacity={programFillOpacity(module, muted)}
                            stroke={allGeneFocused ? '#111827' : nodeColor}
                            strokeWidth={allGeneFocused ? 3.2 : 2.8}
                        />
                        <rect
                            x={layout.rightProgramX}
                            y={programBoxY}
                            width="12"
                            height={layout.rightProgramH}
                            rx="5"
                            fill={nodeColor}
                            fillOpacity={programStripeOpacity(module, muted)}
                            pointerEvents="none"
                        />
                        {programLines.map((line, index) => (
                            <text
                                key={line}
                                x={layout.rightProgramX + (layout.rightProgramW / 2)}
                                y={centeredLineY(
                                    programBoxY,
                                    layout.rightProgramH,
                                    programLines.length,
                                    layout.rightProgramTitleStep,
                                    index,
                                )}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={layout.rightProgramTitleFontSize}
                                fontWeight="800"
                                fill="#111"
                            >
                                {line}
                            </text>
                        ))}
                        <title>{formatProgramTooltip(module)}</title>
                    </g>
                    {renderAllGeneDetailPanel({
                        module,
                        x: layout.rightProgramX,
                        y: panelY,
                        width: panelWidth,
                        height: module.allGeneDetailHeight,
                        selectedProgramName: module.program,
                    })}
                </g>
            );
        }

        let cursorY = module.yTop;
        const groupGap = regulatorGroups.length > 1 ? layout.regulatorGroupGap : 0;
        const groupWidth = regulatorGroups.length > 1 && layout.regulatorGroupLayout === 'horizontal'
            ? (regulatorBoxW - ((regulatorGroups.length - 1) * groupGap)) / regulatorGroups.length
            : regulatorBoxW;
        const groupLayouts = regulatorGroups.map((group, index) => {
            const height = module.regulatorGroupHeights?.[group.key] || regulatorGeneBoxHeight(group.genes, layout);
            if (layout.regulatorGroupLayout === 'vertical') {
                const width = isCollapsedAllOverview
                    ? regulatorBoxW
                    : regulatorGeneBoxWidth(group.genes, layout);
                const positioned = {
                    ...group,
                    height,
                    width,
                    x: layout.rightRegulatorX,
                    yTop: cursorY,
                    centerY: cursorY + (height / 2),
                };
                cursorY += height + (index < regulatorGroups.length - 1 ? layout.regulatorGroupGap : 0);
                return positioned;
            }

            return {
                ...group,
                height,
                width: groupWidth,
                x: layout.rightRegulatorX + (index * (groupWidth + groupGap)),
                yTop: module.yTop + ((module.height - height) / 2),
                centerY: module.yTop + (module.height / 2),
            };
        });

        return (
            <g
                key={`${module.program}:regulator`}
                opacity={allGeneMuted ? 0.22 : 1}
                style={{ transition: 'opacity 180ms ease' }}
            >
                <ArrowOrCap
                    x1={layout.rightProgramX}
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
                    const bucketMagnitude = allGeneMuted
                        ? Math.abs(toFiniteNumber(regulatorScore, 0))
                        : Math.max(
                            ...group.genes.map((gene) => Math.abs(toFiniteNumber(gene.membershipScore, 0))),
                            Math.abs(toFiniteNumber(regulatorScore, 0)),
                        );
                    const bucketEdgeStyle = computeEdgeStyle(bucketMagnitude, edgeHighlighted, muted);

                    return (
                        <ArrowOrCap
                            key={`${module.program}:${group.key}:edge`}
                            x1={group.x}
                            y1={group.centerY}
                            x2={programBoxX + programBoxW}
                            y2={programY + ((index - ((groupLayouts.length - 1) / 2)) * layout.regulatorEdgeTargetSpacing)}
                            color={bucketColor}
                            direction={bucketDirection}
                            opacity={bucketEdgeStyle.opacity}
                            width={Math.max(2.4, bucketEdgeStyle.width * 0.65)}
                        />
                    );
                })}

                <g
                    data-graph-clickable="true"
                    onClick={(event) => {
                        event.stopPropagation();
                        handleProgramModuleClick(module);
                    }}
                    onDoubleClick={(event) => {
                        event.stopPropagation();
                        onOpenProgram?.(module.program);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={programBoxX}
                        y={programBoxY}
                        width={programBoxW}
                        height={layout.rightProgramH}
                        rx="5"
                        fill={nodeColor}
                        fillOpacity={programFillOpacity(module, muted)}
                        stroke={isProgramSelected ? '#111' : nodeColor}
                        strokeWidth={isProgramSelected ? 3.2 : 2.4}
                    />
                    <rect
                        x={programBoxX}
                        y={programBoxY}
                        width="12"
                        height={layout.rightProgramH}
                        rx="5"
                        fill={nodeColor}
                        fillOpacity={programStripeOpacity(module, muted)}
                        pointerEvents="none"
                    />
                    {programLines.map((line, index) => (
                        <text
                            key={line}
                            x={programBoxX + (programBoxW / 2)}
                            y={layout.geneBoxStyle === 'legacy'
                                ? programBoxY + 30 + (index * layout.rightProgramTitleStep)
                                : centeredLineY(
                                    programBoxY,
                                    layout.rightProgramH,
                                    programLines.length,
                                    layout.rightProgramTitleStep,
                                    index,
                                )}
                            textAnchor="middle"
                            dominantBaseline={layout.geneBoxStyle === 'legacy' ? undefined : 'middle'}
                            fontSize={layout.rightProgramTitleFontSize}
                            fontWeight={layout.geneBoxStyle === 'legacy' ? '900' : '800'}
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
                    group.x,
                    group.yTop,
                    group.width,
                    group.height,
                ))}
            </g>
        );
    }, [
        onOpenProgram,
        handleProgramModuleClick,
        allGeneFocusActive,
        isFocusedAllGeneModule,
        layout,
        renderAllGeneDetailPanel,
        renderRegulatorGroup,
        rightLayout.modules.length,
        selectedGeneKey,
        selectedProgram,
        traitCenterY,
        traitNodeHeightValue,
        visibleSides,
    ]);

    const leftRenderGroups = useMemo(
        () => splitModulesForFocus(leftLayout.modules, allGeneFocusActive, isFocusedAllGeneModule),
        [allGeneFocusActive, isFocusedAllGeneModule, leftLayout.modules],
    );
    const rightRenderGroups = useMemo(
        () => splitModulesForFocus(rightLayout.modules, allGeneFocusActive, isFocusedAllGeneModule),
        [allGeneFocusActive, isFocusedAllGeneModule, rightLayout.modules],
    );

    return (
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
                    py: 1.25,
                    borderBottom: '1px solid rgba(15,23,42,0.06)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Box>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: 23, lineHeight: 1.1 }}>
                        Gene Association Map
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {geneLimitOptions.length > 0 && (
                        <Box
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.45,
                                px: 0.6,
                                py: 0.35,
                                border: '1px solid rgba(15,23,42,0.12)',
                                borderRadius: 1,
                                bgcolor: '#f8fafc',
                            }}
                        >
                            <Typography sx={{ fontSize: 12, color: '#475467', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                Gene display
                            </Typography>
                            {geneLimitOptions.map((option) => {
                                const selected = option.value === geneLimit;
                                return (
                                    <Button
                                        key={option.label}
                                        size="small"
                                        variant={selected ? 'contained' : 'text'}
                                        onClick={() => onGeneLimitChange?.(option.value)}
                                        sx={{
                                            minWidth: option.label === 'All' ? 38 : 30,
                                            px: 0.65,
                                            py: 0.2,
                                            borderRadius: 0.75,
                                            fontSize: 12,
                                            lineHeight: 1.3,
                                            textTransform: 'none',
                                            fontWeight: 760,
                                            boxShadow: 'none',
                                        }}
                                    >
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </Box>
                    )}
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download />}
                        onClick={() => svgRef.current && exportSvg(svgRef.current, `${exportStem}_trait_gene_association_map_${exportSuffix}.svg`)}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 680,
                            borderRadius: 1,
                            px: 1.25,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Export SVG
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download />}
                        onClick={() => svgRef.current && exportPng(svgRef.current, `${exportStem}_trait_gene_association_map_${exportSuffix}.png`)}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 680,
                            borderRadius: 1,
                            px: 1.25,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Export PNG
                    </Button>
                </Stack>

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        flexWrap: 'wrap',
                        width: '100%',
                        mt: 0.75,
                        pt: 0.75,
                        borderTop: '1px solid rgba(15,23,42,0.06)',
                    }}
                >
                    {INLINE_LEGEND_GROUPS.map((group) => (
                        <Box key={group.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: 12.5, color: '#475467', fontWeight: 650 }}>
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
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.55 }}>
                        <Typography sx={{ fontSize: 12.5, color: '#475467', fontWeight: 650 }}>
                            Parentheses:
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#667085', fontWeight: 600 }}>
                            discordant gene direction
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.55, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: 12.5, color: '#475467', fontWeight: 650 }}>
                            Display:
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#667085', fontWeight: 600 }}>
                            {displayGeneLimit === Number.POSITIVE_INFINITY
                                ? (expandedAllGeneModuleKey
                                    ? 'showing all genes for selected association context'
                                    : 'showing all genes as compact overview')
                                : `showing top ${displayGeneLimitLabel} genes per association context`}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box
                ref={graphViewportRef}
                sx={{
                    px: { xs: 0.5, md: 1 },
                    py: 0.5,
                    position: 'relative',
                    overflow: 'hidden',
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
                onClickCapture={handlePlotBlankClick}
            >
                <ZoomToolbar
                    scale={transform.scale}
                    zoomIn={zoomIn}
                    zoomOut={zoomOut}
                    resetView={resetView}
                />
                <SelectionActions
                    clearSelection={clearSelection}
                    onOpenGene={onOpenGene}
                    onOpenProgram={onOpenProgram}
                    selectedGene={selectedGene}
                    selectedGeneOccurrences={selectedGeneOccurrences}
                    selectedProgram={selectedProgram}
                />
                <svg
                    ref={svgRef}
                    width="100%"
                    viewBox={`0 0 ${SVG_WIDTH} ${svgViewportHeight || svgHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{
                        display: 'block',
                        width: `min(100%, ${renderMaxWidth}px)`,
                        height: 'auto',
                        margin: '0 auto',
                    }}
                >
                    <defs>
                        <style>
                            {'.trait-program-template text{font-family:Inter,Segoe UI,Arial,Helvetica,sans-serif;letter-spacing:0}.trait-program-template .section-title{font-size:26px;font-weight:900;fill:#111}.trait-program-template .section-note{font-size:21px;font-weight:900;fill:#111}@keyframes allGenePanelSettle{from{opacity:.88;transform:scale(.988)}to{opacity:1;transform:scale(1)}}@keyframes allGeneContentFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}'}
                        </style>
                    </defs>

                    <g
                        className="trait-program-template"
                        style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transformOrigin: '0 0',
                            transformBox: 'view-box',
                            transition: isTransformAnimating
                                ? `transform ${Math.max(120, transformAnimationMs)}ms cubic-bezier(0.22, 1, 0.36, 1)`
                                : 'none',
                            willChange: isTransformAnimating || isDragging ? 'transform' : 'auto',
                        }}
                    >
                        <rect
                            data-graph-background="true"
                            x="0"
                            y="0"
                            width={SVG_WIDTH}
                            height={svgHeight}
                            fill="#fff"
                        />

                        <text x="8" y="28" className="section-title">
                            Genes linked by
                        </text>
                        <text x="8" y="54" className="section-title">
                            program burden
                        </text>
                        <text
                            x={layout.rightProgramX}
                            y="28"
                            className="section-title"
                        >
                            Genes linked by
                        </text>
                        <text
                            x={layout.rightProgramX}
                            y="54"
                            className="section-title"
                        >
                            regulator burden
                        </text>

                        <g
                            data-graph-clickable="true"
                            onClick={() => {
                                if (!shouldSuppressClick()) clearSelection();
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            <rect
                                x={layout.traitCenterX - (layout.traitNodeW / 2)}
                                y={traitCenterY - (traitNodeHeightValue / 2)}
                                width={layout.traitNodeW}
                                height={traitNodeHeightValue}
                                rx="7"
                                fill="#929b9b"
                                stroke="#111"
                                strokeWidth="3"
                            />
                            {traitDisplayLines.map((line, index) => (
                                <text
                                    key={line}
                                    x={layout.traitCenterX}
                                    y={centeredLineY(
                                        traitCenterY - (traitNodeHeightValue / 2),
                                        traitNodeHeightValue,
                                        traitDisplayLines.length,
                                        layout.traitTextLineStep,
                                        index,
                                    )}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={traitFontSize}
                                    fontWeight="900"
                                    fill="#fff"
                                >
                                    {line}
                                </text>
                            ))}
                        </g>

                        {leftRenderGroups.background.map(renderLeftProgramModule)}
                        {rightRenderGroups.background.map(renderRightProgramModule)}
                        {leftRenderGroups.focused.map(renderLeftProgramModule)}
                        {rightRenderGroups.focused.map(renderRightProgramModule)}

                        {layout.showSectionNotes && (
                            <>
                                <SectionNote
                                    x={layout.leftProgramX + layout.leftProgramW + 16}
                                    y={traitCenterY - 310}
                                    lines={['Gene direction from', 'program burden effects']}
                                />
                                <SectionNote
                                    x={layout.traitCenterX + 76}
                                    y={traitCenterY - 310}
                                    lines={['Gene direction from', 'program-trait and regulator-program signs']}
                                />
                            </>
                        )}
                    </g>
                </svg>
            </Box>
        </Paper>
    );
}
