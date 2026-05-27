import React from 'react';
import { Box, Chip, Divider, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { CheckBoxOutlineBlank, FolderOpen, InsertDriveFile } from '@mui/icons-material';
import { captionSx, metricChipTone, summaryChipSx } from '../themeUtils';

function truncatePath(path, maxLength = 58) {
    if (!path || path.length <= maxLength) return path || 'data';
    const start = path.slice(0, 24);
    const end = path.slice(-(maxLength - start.length - 3));
    return `${start}...${end}`;
}

export default function DataBrowseSummary({
    currentDir,
    filter,
    selectedPaths,
    visibleItemCount,
    visibleFileCount,
    visibleFolderCount,
    columnCount,
}) {
    const theme = useTheme();
    const currentLabel = currentDir || 'data';
    const selectedPreview = selectedPaths.slice(0, 6);

    return (
        <Box
            sx={{
                flex: 1,
                minWidth: { xs: 288, md: 360 },
                display: 'flex',
                flexDirection: 'column',
                bgcolor: theme.custom.surface.raised,
                borderLeft: `1px solid ${theme.custom.border.soft}`,
            }}
        >
            <Box sx={{ px: 2, py: 1.45, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                    <FolderOpen sx={{ fontSize: 18, color: theme.palette.primary.light }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 750, color: theme.palette.text.primary }}>
                        Browse Summary
                    </Typography>
                </Box>
                <Typography
                    title={currentLabel}
                    sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.78rem',
                        color: theme.palette.text.secondary,
                        overflowWrap: 'anywhere',
                    }}
                >
                    {truncatePath(currentLabel)}
                </Typography>
            </Box>

            <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
                <Box sx={{ p: 1.1, bgcolor: theme.palette.background.paper, border: `1px solid ${theme.custom.border.soft}`, borderRadius: 1 }}>
                    <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0.2 })}>
                        Items
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 760, fontSize: '1.15rem' }}>
                        {visibleItemCount}
                    </Typography>
                </Box>
                <Box sx={{ p: 1.1, bgcolor: theme.palette.background.paper, border: `1px solid ${theme.custom.border.soft}`, borderRadius: 1 }}>
                    <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0.2 })}>
                        Selected
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 760, fontSize: '1.15rem' }}>
                        {selectedPaths.length}
                    </Typography>
                </Box>
                <Box sx={{ p: 1.1, bgcolor: theme.palette.background.paper, border: `1px solid ${theme.custom.border.soft}`, borderRadius: 1 }}>
                    <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0.2 })}>
                        Columns
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 760, fontSize: '1.15rem' }}>
                        {columnCount}
                    </Typography>
                </Box>
            </Box>

            <Divider sx={{ borderColor: theme.custom.border.soft }} />

            <Box sx={{ px: 2, pb: 0.6 }}>
                <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`${visibleFolderCount} folders`} sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                    <Chip size="small" label={`${visibleFileCount} files`} sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                </Box>
            </Box>

            <Box sx={{ px: 2, py: 1.6, flex: 1, minHeight: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 740, color: theme.palette.text.primary }}>
                        Selection
                    </Typography>
                    {filter && (
                        <Chip
                            size="small"
                            label={`filter: ${filter}`}
                            sx={summaryChipSx(theme, { maxWidth: 220, ...metricChipTone(theme, 'primary') })}
                        />
                    )}
                </Box>

                {selectedPreview.length > 0 ? (
                    <Box sx={{ display: 'grid', gap: 0.7 }}>
                        {selectedPreview.map((path) => (
                            <Box
                                key={path}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.8,
                                    px: 1,
                                    py: 0.75,
                                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                                    borderRadius: 1,
                                    minWidth: 0,
                                }}
                            >
                                <InsertDriveFile sx={{ fontSize: 16, color: theme.palette.primary.main, flexShrink: 0 }} />
                                <Typography noWrap title={path} sx={{ fontFamily: 'monospace', fontSize: '0.76rem', color: theme.palette.text.primary }}>
                                    {path}
                                </Typography>
                            </Box>
                        ))}
                        {selectedPaths.length > selectedPreview.length && (
                            <Chip
                                size="small"
                                label={`+${selectedPaths.length - selectedPreview.length} more`}
                                sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                            />
                        )}
                    </Box>
                ) : (
                    <Box
                        sx={{
                            minHeight: 146,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 1,
                            textAlign: 'center',
                            bgcolor: theme.palette.background.paper,
                            border: `1px dashed ${theme.custom.border.strong}`,
                            borderRadius: 1,
                            px: 2,
                        }}
                    >
                        <CheckBoxOutlineBlank sx={{ fontSize: 24, color: theme.custom.chart.axisSoft }} />
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 650 }}>
                            No files selected
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
