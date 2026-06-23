import React, { useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseFullscreen from '@mui/icons-material/CloseFullscreen';
import Download from '@mui/icons-material/Download';
import OpenInNew from '@mui/icons-material/OpenInNew';
import OpenInFull from '@mui/icons-material/OpenInFull';
import RestartAlt from '@mui/icons-material/RestartAlt';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import {
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
                            label={selectedProgram}
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
                            Open program
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
    graphLayout,
    isFullGraph,
    isDragging,
    leftLayout,
    onOpenGene,
    onOpenProgram,
    onGraphViewModeToggle,
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
    svgRef,
    traitCenterY,
    traitDisplayLines,
    traitFontSize,
    traitNodeHeightValue,
    transform,
    visibleSides,
    zoomIn,
    zoomOut,
}) {
    const graphViewportRef = useRef(null);
    const layout = graphLayout;
    const exportStem = sanitizeFileNamePart(exportFileName || 'trait-program-gene');
    const exportSuffix = isFullGraph ? 'full' : 'compact';
    const renderMaxWidth = isFullGraph ? GRAPH_RENDER_MAX_WIDTH.full : GRAPH_RENDER_MAX_WIDTH.compact;

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

        const score = module.programScore;
        const direction = directionFromSign(module.programTraitSign, score);
        const isProgramSelected = selectedProgram === module.program;
        const hasGeneSelection = Boolean(selectedGeneKey);
        const moduleGeneMatches = hasGeneSelection && module.filteredGeneKeys.includes(selectedGeneKey);
        const edgeHighlighted = isProgramSelected || moduleGeneMatches;
        const muted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const edgeStyle = computeEdgeStyle(score, edgeHighlighted, muted);
        const centerY = module.yCenter;
        const traitLeftX = layout.traitCenterX - (layout.traitNodeW / 2);
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, leftLayout.modules.length, traitNodeHeightValue);
        const boxHeight = module.height;
        const titleLines = programDisplayLines(module, layout.leftProgramLabelChars);
        const nodeColor = programColor(module);

        return (
            <g key={`${module.program}:program`}>
                <ArrowOrCap
                    x1={layout.leftProgramX + layout.leftProgramW}
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
                    onClick={() => onSelectProgram(module.program, module.side)}
                    onDoubleClick={(event) => {
                        event.stopPropagation();
                        onOpenProgram?.(module.program);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <rect
                        x={layout.leftProgramX}
                        y={module.yTop}
                        width={layout.leftProgramW}
                        height={boxHeight}
                        rx="6"
                        fill={nodeColor}
                        fillOpacity={programFillOpacity(module, muted)}
                        stroke={isProgramSelected ? '#111' : nodeColor}
                        strokeWidth={isProgramSelected ? 3.2 : 2.6}
                    />
                    <rect
                        x={layout.leftProgramX}
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
                            x={layout.leftProgramX + (layout.leftProgramW / 2)}
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
                            x={layout.leftProgramX + 16}
                            y={layout.geneBoxStyle === 'legacy' ? module.yTop + 58 : module.yTop + (boxHeight / 2)}
                            dominantBaseline={layout.geneBoxStyle === 'legacy' ? undefined : 'middle'}
                            fontSize="18"
                            fill="#555"
                        >
                            {module.emptyReason || 'No overlap'}
                        </text>
                    ) : renderGeneColumns({
                        columns: module.geneColumns,
                        x: layout.leftProgramX,
                        y: module.yTop,
                        width: layout.leftProgramW,
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
        onOpenProgram,
        onSelectProgram,
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
        const muted = (Boolean(selectedProgram) && !isProgramSelected) || (hasGeneSelection && !moduleGeneMatches);
        const groupColor = group.sign === 'negative' ? EFFECT_COLORS.negative : EFFECT_COLORS.positive;

        if (layout.regulatorGroupStyle === 'legacy') {
            return (
                <g key={`${module.program}:regulator:${group.key}`}>
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
                    {group.genes.length ? renderGeneColumns({
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
            <g key={`${module.program}:regulator:${group.key}`}>
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
                {group.genes.length && layout.regulatorGeneLayout === 'single'
                    ? renderRegulatorGeneList({
                        genes: group.genes,
                        x,
                        y: yTop,
                        selectedProgramName: module.program,
                    })
                    : null}
                {group.genes.length && layout.regulatorGeneLayout !== 'single'
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
    }, [layout, renderGeneColumns, renderRegulatorGeneList, selectedGeneKey, selectedProgram]);

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
        const programBoxY = programY - (layout.rightProgramH / 2);
        const traitRightX = layout.traitCenterX + (layout.traitNodeW / 2);
        const traitTargetY = traitCenterY + traitPortY(module.layoutIndex, rightLayout.modules.length, traitNodeHeightValue);
        const programLines = programDisplayLines(module, layout.rightProgramLabelChars);
        const nodeColor = programColor(module);
        const regulatorGroups = module.regulatorGroups || [];
        let cursorY = module.yTop;
        const groupGap = regulatorGroups.length > 1 ? layout.regulatorGroupGap : 0;
        const groupWidth = regulatorGroups.length > 1 && layout.regulatorGroupLayout === 'horizontal'
            ? (layout.rightRegulatorW - ((regulatorGroups.length - 1) * groupGap)) / regulatorGroups.length
            : layout.rightRegulatorW;
        const groupLayouts = regulatorGroups.map((group, index) => {
            const height = module.regulatorGroupHeights?.[group.key] || regulatorGeneBoxHeight(group.genes, layout);
            if (layout.regulatorGroupLayout === 'vertical') {
                const width = regulatorGeneBoxWidth(group.genes, layout);
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
            <g key={`${module.program}:regulator`}>
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
                    const bucketMagnitude = Math.max(
                        ...group.genes.map((gene) => Math.abs(toFiniteNumber(gene.membershipScore, 0))),
                        Math.abs(toFiniteNumber(regulatorScore, 0)),
                    );
                    const bucketEdgeStyle = computeEdgeStyle(bucketMagnitude, edgeHighlighted, muted);

                    return (
                        <ArrowOrCap
                            key={`${module.program}:${group.key}:edge`}
                            x1={group.x}
                            y1={group.centerY}
                            x2={layout.rightProgramX + layout.rightProgramW}
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
                    onClick={() => onSelectProgram(module.program, module.side)}
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
                        stroke={isProgramSelected ? '#111' : nodeColor}
                        strokeWidth={isProgramSelected ? 3.2 : 2.4}
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
        onSelectProgram,
        onOpenProgram,
        layout,
        renderRegulatorGroup,
        rightLayout.modules.length,
        selectedGeneKey,
        selectedProgram,
        traitCenterY,
        traitNodeHeightValue,
        visibleSides,
    ]);

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
                        Trait-Program-Gene graph
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                        size="small"
                        variant={isFullGraph ? 'contained' : 'outlined'}
                        startIcon={isFullGraph ? <CloseFullscreen /> : <OpenInFull />}
                        onClick={onGraphViewModeToggle}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 680,
                            borderRadius: 1,
                            px: 1.25,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {isFullGraph ? 'Compact view' : 'Full view'}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download />}
                        onClick={() => svgRef.current && exportSvg(svgRef.current, `${exportStem}_trait_program_gene_${exportSuffix}.svg`)}
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
                        onClick={() => svgRef.current && exportPng(svgRef.current, `${exportStem}_trait_program_gene_${exportSuffix}.png`)}
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
                        gap: 2,
                        flexWrap: 'wrap',
                        width: '100%',
                        mt: 0.75,
                        pt: 0.75,
                        borderTop: '1px solid rgba(15,23,42,0.06)',
                    }}
                >
                    <Typography sx={{ fontWeight: 650, color: '#0f172a', fontSize: 13 }}>
                        Legend
                    </Typography>
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
                    viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
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
                            {'.trait-program-template text{font-family:Inter,Segoe UI,Arial,Helvetica,sans-serif;letter-spacing:0}.trait-program-template .section-title{font-size:26px;font-weight:900;fill:#111}.trait-program-template .section-note{font-size:21px;font-weight:900;fill:#111}'}
                        </style>
                    </defs>

                    <g className="trait-program-template" transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                        <rect x="0" y="0" width={SVG_WIDTH} height={svgHeight} fill="#fff" />

                        <text x="8" y="28" className="section-title">
                            Programs selected by
                        </text>
                        <text x="8" y="54" className="section-title">
                            program burden effects
                        </text>
                        <text
                            x={layout.rightProgramX}
                            y="28"
                            className="section-title"
                        >
                            Programs selected by
                        </text>
                        <text
                            x={layout.rightProgramX}
                            y="54"
                            className="section-title"
                        >
                            regulator-burden correlations
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

                        {leftLayout.modules.map(renderLeftProgramModule)}
                        {rightLayout.modules.map(renderRightProgramModule)}

                        {layout.showSectionNotes && (
                            <>
                                <SectionNote
                                    x={layout.leftProgramX + layout.leftProgramW + 16}
                                    y={traitCenterY - 310}
                                    lines={['Directions determined by', 'program burden effects']}
                                />
                                <SectionNote
                                    x={layout.traitCenterX + 76}
                                    y={traitCenterY - 310}
                                    lines={['Directions determined by', 'program-trait and regulator-program signs']}
                                />
                            </>
                        )}
                    </g>
                </svg>
            </Box>
        </Paper>
    );
}
