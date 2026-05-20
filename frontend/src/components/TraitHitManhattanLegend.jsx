import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';

const DEFAULT_POSITION = { top: 12, right: 12 };

export default function TraitHitManhattanLegend({
    items,
    collapsed,
    onToggleCollapsed,
    title = 'Programs',
}) {
    const rootRef = useRef(null);
    const dragRef = useRef({
        pointerId: null,
        startClientX: 0,
        startClientY: 0,
        startTop: DEFAULT_POSITION.top,
        startRight: DEFAULT_POSITION.right,
    });
    const [position, setPosition] = useState(DEFAULT_POSITION);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        setPosition(DEFAULT_POSITION);
    }, [items.length]);

    if (!items.length) return null;

    const clampPosition = (nextTop, nextRight) => {
        const parent = rootRef.current?.parentElement;
        const node = rootRef.current;
        if (!parent || !node) return { top: Math.max(8, nextTop), right: Math.max(8, nextRight) };

        const parentRect = parent.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const maxTop = Math.max(8, parentRect.height - nodeRect.height - 8);
        const maxRight = Math.max(8, parentRect.width - nodeRect.width - 8);

        return {
            top: Math.min(Math.max(8, nextTop), maxTop),
            right: Math.min(Math.max(8, nextRight), maxRight),
        };
    };

    const handlePointerMove = (event) => {
        if (dragRef.current.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - dragRef.current.startClientX;
        const deltaY = event.clientY - dragRef.current.startClientY;
        const next = clampPosition(
            dragRef.current.startTop + deltaY,
            dragRef.current.startRight - deltaX,
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
            startRight: position.right,
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
                right: position.right,
                width: collapsed ? 108 : 154,
                maxHeight: 244,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.84)',
                border: '1px solid rgba(226,232,240,0.84)',
                boxShadow: dragging ? '0 10px 26px rgba(15,23,42,0.14)' : '0 6px 18px rgba(15,23,42,0.08)',
                backdropFilter: 'blur(7px)',
                zIndex: 3,
                transition: dragging ? 'none' : 'width 0.18s ease, box-shadow 0.18s ease',
                userSelect: 'none',
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
                    bgcolor: 'rgba(248,250,252,0.8)',
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
                        textTransform: 'none',
                        color: '#475569',
                    }}
                >
                    {title}
                </Typography>
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
            </Box>

            <Box
                onWheelCapture={(event) => event.stopPropagation()}
                sx={{
                    maxHeight: 210,
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
                            alignItems: 'center',
                            columnGap: 0.48,
                            px: 0.36,
                            py: 0.28,
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
                            noWrap
                            sx={{
                                minWidth: 0,
                                fontSize: '0.69rem',
                                color: '#334155',
                                fontFamily: 'monospace',
                            }}
                        >
                            {item.label}
                        </Typography>
                        {!collapsed && (
                            <Typography
                                sx={{
                                    fontSize: '0.66rem',
                                    color: '#64748b',
                                    fontWeight: 600,
                                    fontVariantNumeric: 'tabular-nums',
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
