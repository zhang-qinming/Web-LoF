import React from 'react';
import { Box, Button, Typography } from '@mui/material';

export default function TraitHitManhattanLegend({
    items,
    collapsed,
    onToggleCollapsed,
}) {
    if (!items.length) return null;

    return (
        <Box
            sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: collapsed ? 132 : 174,
                maxHeight: 246,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.96)',
                border: '1px solid rgba(226,232,240,0.96)',
                boxShadow: '0 6px 18px rgba(15,23,42,0.08)',
                backdropFilter: 'blur(8px)',
                zIndex: 3,
                transition: 'width 0.18s ease',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.8,
                    py: 0.45,
                    borderBottom: '1px solid rgba(226,232,240,0.92)',
                    bgcolor: '#f8fafc',
                }}
            >
                <Typography
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#475569',
                    }}
                >
                    Programs
                </Typography>
                <Button
                    size="small"
                    onClick={onToggleCollapsed}
                    sx={{
                        minWidth: 0,
                        px: 0.4,
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
                    px: 0.55,
                    py: 0.5,
                }}
            >
                {items.map((item) => (
                    <Box
                        key={item.key}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: collapsed ? '8px minmax(0, 1fr)' : '8px minmax(0, 1fr) auto',
                            alignItems: 'center',
                            columnGap: 0.55,
                            px: 0.45,
                            py: 0.33,
                            borderRadius: 1,
                            '&:hover': { bgcolor: '#f8fafc' },
                        }}
                    >
                        <Box
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: item.color,
                                boxShadow: '0 0 0 1px rgba(15,23,42,0.06)',
                            }}
                        />
                        <Typography
                            noWrap
                            sx={{
                                minWidth: 0,
                                fontSize: '0.71rem',
                                color: '#334155',
                                fontFamily: 'monospace',
                            }}
                        >
                            {item.label}
                        </Typography>
                        {!collapsed && (
                            <Typography
                                sx={{
                                    fontSize: '0.67rem',
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
