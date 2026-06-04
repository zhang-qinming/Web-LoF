import React, { useCallback, useEffect, useRef, useState } from 'react';
import { alpha } from '@mui/material/styles';
import { Box, Button, Typography, useTheme } from '@mui/material';

const DEFAULT_OFFSET = 12;
const SAFE_MARGIN = 8;
const TOOLBAR_GUARD = { top: 8, right: 10, width: 116, height: 42 };

function getAxisPixelBounds(axis, fallbackStart, fallbackEnd) {
    if (!axis) return { start: fallbackStart, end: fallbackEnd };
    const start = Number.isFinite(axis._offset) ? axis._offset : fallbackStart;
    const length = Number.isFinite(axis._length) ? axis._length : Math.max(0, fallbackEnd - fallbackStart);
    return { start, end: start + length };
}

function rectsOverlap(a, b) {
    return !(
        a.left >= b.right
        || a.right <= b.left
        || a.top >= b.bottom
        || a.bottom <= b.top
    );
}

function getDistancePenalty(a, b) {
    const dx = a.right < b.left ? b.left - a.right : b.right < a.left ? a.left - b.right : 0;
    const dy = a.bottom < b.top ? b.top - a.bottom : b.bottom < a.top ? a.top - b.bottom : 0;
    if (dx === 0 && dy === 0) return 1800;
    const distance = Math.hypot(dx, dy);
    return Math.max(0, 240 - distance);
}

function buildProtectedRects(parentRect, gd) {
    const rects = [];
    const fullLayout = gd?._fullLayout;
    const titleNode = gd?.querySelector?.('.g-gtitle');
    const modebarNode = gd?.querySelector?.('.modebar');

    if (titleNode) {
        const rect = titleNode.getBoundingClientRect();
        rects.push({
            left: rect.left - parentRect.left - 10,
            top: rect.top - parentRect.top - 6,
            right: rect.right - parentRect.left + 10,
            bottom: rect.bottom - parentRect.top + 8,
            weight: 2400,
        });
    } else if (fullLayout?.margin?.t) {
        rects.push({
            left: SAFE_MARGIN,
            top: SAFE_MARGIN,
            right: parentRect.width - SAFE_MARGIN,
            bottom: Math.min(parentRect.height - SAFE_MARGIN, fullLayout.margin.t),
            weight: 1600,
        });
    }

    if (modebarNode) {
        const rect = modebarNode.getBoundingClientRect();
        rects.push({
            left: rect.left - parentRect.left - 8,
            top: rect.top - parentRect.top - 6,
            right: rect.right - parentRect.left + 8,
            bottom: rect.bottom - parentRect.top + 6,
            weight: 3200,
        });
    } else {
        rects.push({
            left: Math.max(SAFE_MARGIN, parentRect.width - TOOLBAR_GUARD.width - TOOLBAR_GUARD.right),
            top: TOOLBAR_GUARD.top,
            right: parentRect.width - TOOLBAR_GUARD.right,
            bottom: TOOLBAR_GUARD.top + TOOLBAR_GUARD.height,
            weight: 2200,
        });
    }

    return rects;
}

function buildPointRects(parentRect, gd) {
    const fullLayout = gd?._fullLayout;
    if (!fullLayout) return [];

    const xAxis = fullLayout.xaxis;
    const yAxis = fullLayout.yaxis;
    if (!xAxis || !yAxis || typeof xAxis.d2p !== 'function' || typeof yAxis.d2p !== 'function') return [];

    const xBounds = getAxisPixelBounds(xAxis, fullLayout.margin?.l || 0, parentRect.width - (fullLayout.margin?.r || 0));
    const yBounds = getAxisPixelBounds(yAxis, fullLayout.margin?.t || 0, parentRect.height - (fullLayout.margin?.b || 0));
    const traces = Array.isArray(gd?.data) ? gd.data : [];
    const clusters = new Map();

    traces.forEach((trace) => {
        if (!trace || !Array.isArray(trace.x) || !Array.isArray(trace.y)) return;
        const visible = trace.visible;
        if (visible === 'legendonly' || visible === false) return;

        for (let i = 0; i < trace.x.length; i += 1) {
            const rawX = trace.x[i];
            const rawY = trace.y[i];
            if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;

            const x = xAxis.d2p(rawX) + xBounds.start;
            const y = yAxis.d2p(rawY) + yBounds.start;
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            if (x < xBounds.start || x > xBounds.end || y < yBounds.start || y > yBounds.end) continue;

            const bucketX = Math.round(x / 28);
            const bucketY = Math.round(y / 28);
            const clusterKey = `${bucketX}:${bucketY}`;
            const existing = clusters.get(clusterKey);
            if (existing) {
                existing.count += 1;
                existing.left = Math.min(existing.left, x - 10);
                existing.top = Math.min(existing.top, y - 10);
                existing.right = Math.max(existing.right, x + 10);
                existing.bottom = Math.max(existing.bottom, y + 10);
                return;
            }
            clusters.set(clusterKey, {
                key: clusterKey,
                count: 1,
                left: x - 10,
                top: y - 10,
                right: x + 10,
                bottom: y + 10,
            });
        }
    });

    return Array.from(clusters.values())
        .filter((item) => item.count >= 2)
        .map((item) => ({
            left: Math.max(SAFE_MARGIN, item.left),
            top: Math.max(SAFE_MARGIN, item.top),
            right: Math.min(parentRect.width - SAFE_MARGIN, item.right),
            bottom: Math.min(parentRect.height - SAFE_MARGIN, item.bottom),
            weight: Math.min(2000, 260 + item.count * 70),
        }));
}

function getLegendRect(candidate, width, height, placement) {
    const left = placement === 'right'
        ? candidate.side
        : candidate.side;
    const right = left + width;
    return {
        left,
        right,
        top: candidate.top,
        bottom: candidate.top + height,
    };
}

function buildDefaultPosition(placement, top, sideOffset) {
    return {
        placement: placement === 'left' ? 'left' : 'right',
        top,
        side: sideOffset,
    };
}

export default function FloatingLegend({
    items,
    collapsed = false,
    onToggleCollapsed,
    title = 'Legend',
    width = { expanded: 196, collapsed: 118 },
    maxHeight = 272,
    defaultPlacement = 'right',
    defaultTop = 18,
    defaultSideOffset = DEFAULT_OFFSET,
    anchorPlotRef,
    showScale = true,
    sx,
}) {
    const theme = useTheme();
    const rootRef = useRef(null);
    const dragRef = useRef({
        pointerId: null,
        startClientX: 0,
        startClientY: 0,
        startTop: defaultTop,
        startSide: defaultSideOffset,
        startPlacement: defaultPlacement === 'left' ? 'left' : 'right',
    });
    const dragListenersRef = useRef(null);
    const [position, setPosition] = useState(() => buildDefaultPosition(defaultPlacement, defaultTop, defaultSideOffset));
    const [dragging, setDragging] = useState(false);
    const [manualPosition, setManualPosition] = useState(false);
    const [showTitle, setShowTitle] = useState(!collapsed);
    const [showContent, setShowContent] = useState(!collapsed);

    useEffect(() => {
        if (manualPosition) return;
        setPosition(buildDefaultPosition(defaultPlacement, defaultTop, defaultSideOffset));
    }, [defaultPlacement, defaultSideOffset, defaultTop, items.length, manualPosition, title]);

    useEffect(() => {
        if (!collapsed) {
            setShowTitle(true);
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setShowTitle(false);
        }, 180);

        return () => window.clearTimeout(timeoutId);
    }, [collapsed]);

    useEffect(() => {
        if (!collapsed) {
            setShowContent(true);
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setShowContent(false);
        }, 180);

        return () => window.clearTimeout(timeoutId);
    }, [collapsed]);

    const clampPosition = useCallback((nextTop, nextSide, placement = defaultPlacement) => {
        const parent = rootRef.current?.parentElement;
        const node = rootRef.current;
        const normalizedPlacement = placement === 'left' ? 'left' : 'right';
        if (!parent || !node) {
            return {
                placement: normalizedPlacement,
                top: Math.max(8, nextTop),
                side: Math.max(8, nextSide),
            };
        }

        const parentRect = parent.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const maxTop = Math.max(8, parentRect.height - nodeRect.height - 8);
        const maxSide = Math.max(8, parentRect.width - nodeRect.width - 8);

        return {
            placement: normalizedPlacement,
            top: Math.min(Math.max(8, nextTop), maxTop),
            side: Math.min(Math.max(8, nextSide), maxSide),
        };
    }, [defaultPlacement]);

    const stopDragging = useCallback((pointerId) => {
        if (dragRef.current.pointerId !== pointerId) return;
        if (dragListenersRef.current) {
            const { move, stop } = dragListenersRef.current;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            dragListenersRef.current = null;
        }
        dragRef.current.pointerId = null;
        setDragging(false);
    }, []);

    const handlePointerDown = (event) => {
        if (event.target.closest('button')) return;
        dragRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTop: position.top,
            startSide: position.side,
            startPlacement: position.placement,
        };
        setManualPosition(true);
        setDragging(true);
        event.preventDefault();
        const handleWindowPointerMove = (moveEvent) => {
            if (dragRef.current.pointerId !== moveEvent.pointerId) return;
            const deltaX = moveEvent.clientX - dragRef.current.startClientX;
            const deltaY = moveEvent.clientY - dragRef.current.startClientY;
            const next = clampPosition(
                dragRef.current.startTop + deltaY,
                dragRef.current.startPlacement === 'right'
                    ? dragRef.current.startSide - deltaX
                    : dragRef.current.startSide + deltaX,
                dragRef.current.startPlacement,
            );
            setPosition(next);
        };

        const handleWindowPointerStop = (stopEvent) => {
            stopDragging(stopEvent.pointerId);
        };

        dragListenersRef.current = {
            move: handleWindowPointerMove,
            stop: handleWindowPointerStop,
        };

        window.addEventListener('pointermove', handleWindowPointerMove);
        window.addEventListener('pointerup', handleWindowPointerStop);
        window.addEventListener('pointercancel', handleWindowPointerStop);
    };

    useEffect(() => () => {
        if (!dragListenersRef.current) return;
        const { move, stop } = dragListenersRef.current;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        dragListenersRef.current = null;
    }, []);

    useEffect(() => {
        if (dragging || manualPosition) return undefined;

        const node = rootRef.current;
        const parent = node?.parentElement;
        const gd = anchorPlotRef?.current;
        if (!node || !parent) return undefined;

        const placeLegend = () => {
            const parentRect = parent.getBoundingClientRect();
            const nodeRect = node.getBoundingClientRect();
            const widthPx = nodeRect.width;
            const heightPx = nodeRect.height;
            const maxTop = Math.max(SAFE_MARGIN, parentRect.height - heightPx - SAFE_MARGIN);
            const defaultSide = Math.max(SAFE_MARGIN, defaultSideOffset);
            const leftSide = defaultSide;
            const rightSide = Math.max(SAFE_MARGIN, parentRect.width - widthPx - defaultSide);

            const topCandidates = [
                defaultTop,
                56,
                78,
                104,
                Math.max(SAFE_MARGIN, Math.round((parentRect.height - heightPx) * 0.22)),
                Math.max(SAFE_MARGIN, Math.round((parentRect.height - heightPx) * 0.38)),
                Math.max(SAFE_MARGIN, Math.round((parentRect.height - heightPx) * 0.54)),
            ].map((value) => Math.min(maxTop, Math.max(SAFE_MARGIN, value)));

            const preferredPlacement = defaultPlacement === 'left' ? 'left' : 'right';
            const fallbackPlacement = preferredPlacement === 'left' ? 'right' : 'left';
            const sideForPlacement = {
                left: leftSide,
                right: rightSide,
            };
            const placementOrder = [preferredPlacement, fallbackPlacement];

            const baseCandidates = placementOrder.map((placement) => ({
                placement,
                side: sideForPlacement[placement],
                top: Math.min(maxTop, Math.max(SAFE_MARGIN, defaultTop)),
            }));

            const allCandidates = [
                ...baseCandidates,
                ...topCandidates.flatMap((top) => (
                    placementOrder.map((placement) => ({
                        placement,
                        side: sideForPlacement[placement],
                        top,
                    }))
                )),
            ];

            const protectedRects = [
                ...buildProtectedRects(parentRect, gd),
                ...buildPointRects(parentRect, gd),
            ];

            const scored = allCandidates.map((candidate, index) => {
                const rect = getLegendRect(candidate, widthPx, heightPx, candidate.placement);
                let score = candidate.placement === preferredPlacement ? 0 : 90;
                score += Math.abs(candidate.top - defaultTop) * 1.2;
                if (index > 1) score += 20;

                protectedRects.forEach((blocked) => {
                    const overlap = rectsOverlap(rect, blocked);
                    if (overlap) score += blocked.weight;
                    score += getDistancePenalty(rect, blocked) * 0.18;
                });

                return { candidate, score };
            }).sort((a, b) => a.score - b.score);

            const best = scored[0]?.candidate;
            if (!best) return;

            setPosition((prev) => {
                const next = {
                    placement: best.placement,
                    top: best.top,
                    side: best.placement === 'right'
                        ? Math.max(SAFE_MARGIN, parentRect.width - best.side - widthPx)
                        : best.side,
                };

                if (
                    prev.placement === next.placement
                    && prev.top === next.top
                    && prev.side === next.side
                ) {
                    return prev;
                }
                return next;
            });
        };

        const rafId = window.requestAnimationFrame(placeLegend);
        window.addEventListener('resize', placeLegend);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', placeLegend);
        };
    }, [anchorPlotRef, collapsed, defaultPlacement, defaultSideOffset, defaultTop, dragging, items, manualPosition, title]);

    useEffect(() => {
        if (!manualPosition) return undefined;

        const keepInBounds = () => {
            setPosition((prev) => clampPosition(prev.top, prev.side, prev.placement));
        };

        const rafId = window.requestAnimationFrame(keepInBounds);
        window.addEventListener('resize', keepInBounds);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', keepInBounds);
        };
    }, [clampPosition, collapsed, manualPosition, maxHeight]);

    if (!items.length) return null;

    const itemCount = items.length;
    const headerCountText = itemCount.toLocaleString();
    const maxItemCount = Math.max(...items.map((item) => item.count), 1);
    const maxCountTextLength = Math.max(...items.map((item) => item.count.toLocaleString().length), 1);
    const countColumnWidth = Math.max(34, Math.min(86, 12 + maxCountTextLength * 7.2));
    const badgeMinWidth = Math.max(18, 8 + headerCountText.length * 6.4);
    const expandedWidth = width.expanded + Math.max(0, countColumnWidth - 44);
    const collapsedWidth = Math.min(expandedWidth, Math.max(62, badgeMinWidth + 34));
    const activeWidth = collapsed ? collapsedWidth : expandedWidth;
    const surfaceTransition = theme.custom.motion.swift;
    const legendBorder = alpha(theme.palette.common.white, 0.76);
    const shellBorder = alpha(theme.palette.primary.main, 0.08);
    const shellShadow = dragging
        ? '0 18px 40px rgba(15, 23, 42, 0.16)'
        : '0 12px 28px rgba(15, 23, 42, 0.1)';

    return (
        <Box
            ref={rootRef}
            data-floating-legend="true"
            sx={{
                position: 'absolute',
                top: position.top,
                ...(position.placement === 'left' ? { left: position.side } : { right: position.side }),
                width: 'fit-content',
                minWidth: 0,
                maxWidth: activeWidth,
                maxHeight,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: alpha(theme.palette.background.paper, 0.82),
                border: `1px solid ${theme.custom.border.soft}`,
                boxShadow: shellShadow,
                backdropFilter: 'blur(12px) saturate(1.05)',
                WebkitBackdropFilter: 'blur(12px) saturate(1.05)',
                zIndex: 3,
                transition: dragging ? 'none' : `max-width ${surfaceTransition}, box-shadow ${surfaceTransition}, transform ${surfaceTransition}`,
                userSelect: 'none',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.5)} 0%, rgba(255,255,255,0) 42%)`,
                    opacity: 0.9,
                },
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    border: `1px solid ${legendBorder}`,
                    borderRadius: 'inherit',
                    opacity: 0.55,
                },
                ...sx,
            }}
        >
            <Box
                data-floating-legend-handle="true"
                onPointerDown={handlePointerDown}
                sx={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: collapsed ? 'minmax(18px, auto) 0px 24px' : 'minmax(18px, auto) minmax(0, 1fr) 24px',
                    columnGap: collapsed ? 0.32 : 0.45,
                    alignItems: 'center',
                    px: 0.75,
                    py: 0.64,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.75)}`,
                    bgcolor: alpha(theme.custom.surface.raised, 0.9),
                    cursor: dragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    transition: `padding ${surfaceTransition}, border-color ${surfaceTransition}, background-color ${surfaceTransition}`,
                }}
            >
                <Box
                    sx={{
                        gridColumn: '1',
                        gridRow: '1',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: badgeMinWidth,
                        height: 18,
                        px: 0.45,
                        borderRadius: 999,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        boxShadow: `inset 0 0 0 1px ${shellBorder}`,
                        color: theme.palette.primary.main,
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        flexShrink: 0,
                        transition: `transform ${surfaceTransition}, opacity ${surfaceTransition}, background-color ${surfaceTransition}`,
                    }}
                >
                    {headerCountText}
                </Box>
                {showTitle && (
                    <Box
                        sx={{
                            gridColumn: '2',
                            gridRow: '1',
                            minWidth: 0,
                            maxWidth: collapsed ? 0 : '100%',
                            pr: collapsed ? 0 : 0.15,
                            overflow: 'hidden',
                            opacity: collapsed ? 0 : 1,
                            transform: collapsed ? 'translateX(-8px)' : 'translateX(0)',
                            transition: `max-width ${surfaceTransition}, padding ${surfaceTransition}, opacity ${surfaceTransition}, transform ${surfaceTransition}`,
                            pointerEvents: 'none',
                            justifySelf: 'start',
                        }}
                    >
                        <Typography
                            data-floating-legend-title="true"
                            sx={{
                                minWidth: 0,
                                fontSize: collapsed ? '0.62rem' : '0.64rem',
                                fontWeight: 700,
                                color: theme.palette.text.primary,
                                lineHeight: 1.2,
                                pl: 0,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {title}
                        </Typography>
                    </Box>
                )}
                {onToggleCollapsed && (
                    <Button
                        data-floating-legend-toggle="true"
                        size="small"
                        onClick={onToggleCollapsed}
                        sx={{
                            gridColumn: '3',
                            gridRow: '1',
                            minWidth: 24,
                            width: 24,
                            height: 24,
                            flexShrink: 0,
                            p: 0,
                            borderRadius: 999,
                            color: theme.palette.text.secondary,
                            fontSize: '0.76rem',
                            lineHeight: 1,
                            textTransform: 'none',
                            bgcolor: alpha(theme.palette.common.white, 0.55),
                            boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.divider, 0.7)}`,
                            transition: `background-color ${surfaceTransition}, color ${surfaceTransition}, transform ${surfaceTransition}`,
                            '&:hover': {
                                bgcolor: alpha(theme.palette.common.white, 0.88),
                                color: theme.palette.text.primary,
                            },
                        }}
                    >
                        {collapsed ? '<' : '>'}
                    </Button>
                )}
            </Box>

            {showContent && (
                <Box
                    onWheelCapture={(event) => event.stopPropagation()}
                    sx={{
                        position: 'relative',
                        maxHeight: collapsed ? 0 : maxHeight - 50,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        overscrollBehavior: 'contain',
                        px: collapsed ? 0 : 0.58,
                        py: collapsed ? 0 : 0.6,
                        opacity: collapsed ? 0 : 1,
                        transform: collapsed ? 'translateY(-6px)' : 'translateY(0)',
                        pointerEvents: collapsed ? 'none' : 'auto',
                        transition: `max-height ${surfaceTransition}, padding ${surfaceTransition}, opacity ${surfaceTransition}, transform ${surfaceTransition}`,
                    }}
                >
                    {items.map((item) => {
                        const swatchColors = Array.isArray(item.colors) && item.colors.length > 1
                            ? item.colors
                            : null;
                        const swatchBg = swatchColors
                            ? `linear-gradient(90deg, ${swatchColors[0]} 0 50%, ${swatchColors[1]} 50% 100%)`
                            : item.color;

                        return (
                            <Box
                                key={item.key}
                                sx={{
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'stretch',
                                gap: 0.62,
                                px: 0.68,
                                py: 0.58,
                                borderRadius: 1.4,
                                transition: `background-color ${surfaceTransition}, transform ${surfaceTransition}, padding ${surfaceTransition}`,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.045),
                                },
                            }}
                            >
                                <Box
                                    sx={{
                                        alignSelf: 'flex-start',
                                        mt: 0.24,
                                        width: item.symbol === 'diamond' ? 12 : (swatchColors ? 14 : 10),
                                        height: 10,
                                        borderRadius: item.symbol === 'diamond' ? 2 : (swatchColors ? 999 : '50%'),
                                        bgcolor: swatchColors ? undefined : item.color,
                                        background: swatchBg,
                                        boxShadow: `0 0 0 2px ${alpha(item.color, 0.18)}`,
                                        flexShrink: 0,
                                        transform: item.symbol === 'diamond' ? 'rotate(45deg) translateY(1px)' : 'none',
                                        transition: `transform ${surfaceTransition}, box-shadow ${surfaceTransition}`,
                                    }}
                                />
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            gap: 0.75,
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                minWidth: 0,
                                                flex: 1,
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                color: theme.palette.text.primary,
                                                lineHeight: 1.3,
                                                whiteSpace: 'normal',
                                                overflow: 'visible',
                                                textOverflow: 'clip',
                                                overflowWrap: 'anywhere',
                                                wordBreak: 'break-word',
                                                transition: `color ${surfaceTransition}, transform ${surfaceTransition}`,
                                            }}
                                        >
                                            {item.label}
                                        </Typography>
                                        <Box
                                            sx={{
                                                flexShrink: 0,
                                                mt: 0.02,
                                                width: countColumnWidth,
                                                minWidth: countColumnWidth,
                                                textAlign: 'right',
                                                transition: `max-width ${surfaceTransition}, opacity ${surfaceTransition}, transform ${surfaceTransition}`,
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    display: 'block',
                                                    fontSize: '0.68rem',
                                                    color: theme.palette.text.secondary,
                                                    fontWeight: 700,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    lineHeight: 1.2,
                                                    whiteSpace: 'nowrap',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {item.count.toLocaleString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    {item.note && (
                                        <Typography
                                            sx={{
                                                mt: 0.18,
                                                fontSize: '0.64rem',
                                                lineHeight: 1.25,
                                                color: theme.palette.text.secondary,
                                                whiteSpace: 'normal',
                                                overflowWrap: 'anywhere',
                                            }}
                                        >
                                            {item.note}
                                        </Typography>
                                    )}
                                    {showScale && (
                                        <Box
                                            sx={{
                                                mt: item.note ? 0.38 : 0.45,
                                                maxHeight: 8,
                                                overflow: 'hidden',
                                                transition: `max-height ${surfaceTransition}, opacity ${surfaceTransition}, transform ${surfaceTransition}, margin-top ${surfaceTransition}`,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    height: 4,
                                                    width: '100%',
                                                    borderRadius: 999,
                                                    bgcolor: alpha(item.color, 0.12),
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        height: '100%',
                                                        width: `${Math.max(10, Math.min(100, (item.count / maxItemCount) * 100))}%`,
                                                        borderRadius: 999,
                                                        bgcolor: swatchColors ? undefined : item.color,
                                                        background: swatchColors ? swatchBg : undefined,
                                                        opacity: 0.92,
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
