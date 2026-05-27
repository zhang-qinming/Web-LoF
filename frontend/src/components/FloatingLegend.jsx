import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

const DEFAULT_OFFSET = 12;

function buildDefaultPosition(placement, top, sideOffset) {
    const next = { top };
    if (placement !== 'left') next.right = sideOffset;
    else next.left = sideOffset;
    return next;
}

export default function FloatingLegend({
    items,
    collapsed = false,
    onToggleCollapsed,
    title = 'Legend',
    width = { expanded: 170, collapsed: 112 },
    maxHeight = 244,
    defaultPlacement = 'right',
    defaultTop = 18,
    defaultSideOffset = DEFAULT_OFFSET,
    sx,
}) {
    const rootRef = useRef(null);
    const isRightPlaced = defaultPlacement !== 'left';
    const dragRef = useRef({
        pointerId: null,
        startClientX: 0,
        startClientY: 0,
        startTop: defaultTop,
        startSide: defaultSideOffset,
    });
    const [position, setPosition] = useState(() => buildDefaultPosition(defaultPlacement, defaultTop, defaultSideOffset));
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        setPosition(buildDefaultPosition(defaultPlacement, defaultTop, defaultSideOffset));
    }, [defaultPlacement, defaultSideOffset, defaultTop, items.length, title]);

    if (!items.length) return null;

    const clampPosition = (nextTop, nextSide) => {
        const parent = rootRef.current?.parentElement;
        const node = rootRef.current;
        if (!parent || !node) {
            const fallback = { top: Math.max(8, nextTop) };
            if (isRightPlaced) fallback.right = Math.max(8, nextSide);
            else fallback.left = Math.max(8, nextSide);
            return fallback;
        }

        const parentRect = parent.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const maxTop = Math.max(8, parentRect.height - nodeRect.height - 8);
        const maxSide = Math.max(8, parentRect.width - nodeRect.width - 8);

        const clamped = {
            top: Math.min(Math.max(8, nextTop), maxTop),
        };
        if (isRightPlaced) clamped.right = Math.min(Math.max(8, nextSide), maxSide);
        else clamped.left = Math.min(Math.max(8, nextSide), maxSide);
        return clamped;
    };

    const handlePointerMove = (event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - dragRef.current.startClientX;
        const deltaY = event.clientY - dragRef.current.startClientY;
        const next = clampPosition(
            dragRef.current.startTop + deltaY,
            isRightPlaced
                ? dragRef.current.startSide - deltaX
                : dragRef.current.startSide + deltaX,
        );
        setPosition(next);
    };

    const stopDragging = (pointerId) => {
        if (dragRef.current.pointerId !== pointerId) return;
        dragRef.current.pointerId = null;
        setDragging(false);
    };

    const handlePointerDown = (event) => {
        if (event.target.closest('button')) return;
        dragRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startTop: position.top,
            startSide: isRightPlaced ? position.right : position.left,
        };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    return (
        <Box
            ref={rootRef}
            sx={{
                position: 'absolute',
                top: position.top,
                ...(isRightPlaced ? { right: position.right } : { left: position.left }),
                width: collapsed ? width.collapsed : width.expanded,
                maxHeight,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.86)',
                border: '1px solid rgba(226,232,240,0.84)',
                boxShadow: dragging ? '0 10px 26px rgba(15,23,42,0.14)' : '0 6px 18px rgba(15,23,42,0.08)',
                backdropFilter: 'blur(7px)',
                zIndex: 3,
                transition: dragging ? 'none' : 'width 0.18s ease, box-shadow 0.18s ease',
                userSelect: 'none',
                ...sx,
            }}
        >
            <Box
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(event) => stopDragging(event.pointerId)}
                onPointerCancel={(event) => stopDragging(event.pointerId)}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.45,
                    px: 0.65,
                    py: 0.38,
                    borderBottom: '1px solid rgba(226,232,240,0.82)',
                    bgcolor: 'rgba(248,250,252,0.82)',
                    cursor: dragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                }}
            >
                <Typography
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: '0.63rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: '#475569',
                    }}
                >
                    {title}
                </Typography>
                {onToggleCollapsed && (
                    <Button
                        size="small"
                        onClick={onToggleCollapsed}
                        sx={{
                            minWidth: 0,
                            px: 0.28,
                            py: 0,
                            color: '#475569',
                            fontSize: '0.74rem',
                            lineHeight: 1.2,
                            textTransform: 'none',
                        }}
                    >
                        {collapsed ? '<' : '>'}
                    </Button>
                )}
            </Box>

            <Box
                onWheelCapture={(event) => event.stopPropagation()}
                sx={{
                    maxHeight: maxHeight - 34,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    overscrollBehavior: 'contain',
                    px: 0.45,
                    py: 0.42,
                }}
            >
                {items.map((item) => (
                    <Box
                        key={item.key}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: collapsed ? '8px minmax(0, 1fr)' : '8px minmax(0, 1fr) auto',
                            alignItems: 'start',
                            columnGap: 0.48,
                            px: 0.36,
                            py: collapsed ? 0.3 : 0.34,
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'rgba(248,250,252,0.84)' },
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: item.color,
                                boxShadow: '0 0 0 1px rgba(15,23,42,0.05)',
                            }}
                        />
                        <Typography
                            sx={{
                                minWidth: 0,
                                fontSize: '0.69rem',
                                color: '#334155',
                                fontFamily: 'monospace',
                                lineHeight: 1.28,
                                whiteSpace: collapsed ? 'nowrap' : 'normal',
                                overflow: collapsed ? 'hidden' : 'visible',
                                textOverflow: collapsed ? 'ellipsis' : 'clip',
                                overflowWrap: 'anywhere',
                            }}
                        >
                            {item.label}
                        </Typography>
                        {!collapsed && (
                            <Typography
                                sx={{
                                    alignSelf: 'start',
                                    justifySelf: 'end',
                                    pl: 0.5,
                                    fontSize: '0.66rem',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
                                    lineHeight: 1.2,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {item.count.toLocaleString()}
                            </Typography>
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
