import React, { useCallback } from 'react';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import {
    computeEdgeStyle,
    directionFromSign,
    displayGeneLabel,
    edgeColorFromSign,
    effectColorFromGene,
    formatGeneTooltip,
    formatProgramTooltip,
    geneBoxHeight,
    GENE_ROW_H,
    INLINE_LEGEND_GROUPS,
    LEFT_PROGRAM_W,
    LEFT_PROGRAM_X,
    programColor,
    programDisplayLines,
    programFillOpacity,
    programStripeOpacity,
    REGULATOR_GROUP_GAP,
    RIGHT_PROGRAM_H,
    RIGHT_PROGRAM_W,
    RIGHT_PROGRAM_X,
    RIGHT_REGULATOR_W,
    RIGHT_REGULATOR_X,
    SIDE_META,
    splitGenesByEffect,
    SVG_WIDTH,
    toFiniteNumber,
    TRAIT_CENTER_X,
    TRAIT_NODE_W,
    traitPortY,
    EFFECT_COLORS,
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

export default function TraitProgramGraphCanvas({
    clearSelection,
    isDragging,
    leftLayout,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onSelectGene,
    onSelectProgram,
    onWheel,
    rightLayout,
    selectedGeneKey,
    selectedProgram,
    svgHeight,
    svgRef,
    traitCenterY,
    traitDisplayLines,
    traitFontSize,
    traitNodeHeightValue,
    transform,
    visibleSides,
}) {
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
                    onClick={() => onSelectGene(gene)}
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
    }, [onSelectGene, selectedGeneKey, selectedProgram]);

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
                    onClick={() => onSelectProgram(module.program)}
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
        leftLayout.modules.length,
        onSelectProgram,
        renderGeneColumns,
        selectedGeneKey,
        selectedProgram,
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
                }) : null}
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
                    onClick={() => onSelectProgram(module.program)}
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
        onSelectProgram,
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
                            onClick={clearSelection}
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
    );
}
