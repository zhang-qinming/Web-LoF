import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import FolderOpen from '@mui/icons-material/FolderOpen';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import Folder from '@mui/icons-material/Folder';
import Search from '@mui/icons-material/Search';
import { captionSx, metricChipTone, summaryChipSx } from '../themeUtils';

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
            <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${theme.custom.border.soft}`, bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.8 }}>
                    <Box sx={{ 
                        width: 30, 
                        height: 30, 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        color: theme.palette.primary.main
                    }}>
                        <FolderOpen sx={{ fontSize: 18 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.2 }}>
                            Overview
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ mt: 1.5, p: 1.2, bgcolor: theme.palette.background.paper, border: `1px solid ${theme.custom.border.soft}`, borderRadius: 1.5 }}>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.4 }}>
                        Current Directory
                    </Typography>
                    <Typography
                        title={currentLabel}
                        sx={{
                            fontSize: '0.78rem',
                            fontWeight: 500,
                            color: theme.palette.text.primary,
                            overflowWrap: 'anywhere',
                            fontVariantNumeric: 'tabular-nums',
                            fontFeatureSettings: '"tnum" 1',
                        }}
                    >
                        {currentLabel}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.2 }}>
                <Box sx={{ 
                    p: 1.2, 
                    bgcolor: theme.palette.background.paper, 
                    border: `1px solid ${theme.custom.border.soft}`, 
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        bgcolor: theme.palette.primary.main,
                    }
                }}>
                    <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0.4, color: theme.palette.text.secondary })}>
                        Total Items
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 750, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', color: theme.palette.text.primary, lineHeight: 1 }}>
                        {visibleItemCount}
                    </Typography>
                </Box>
                <Box sx={{ 
                    p: 1.2, 
                    bgcolor: theme.palette.background.paper, 
                    border: `1px solid ${theme.custom.border.soft}`, 
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        bgcolor: selectedPaths.length > 0 ? theme.palette.success.main : theme.palette.text.disabled,
                    }
                }}>
                    <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0.4, color: theme.palette.text.secondary })}>
                        Selected
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 750, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', color: selectedPaths.length > 0 ? theme.palette.success.main : theme.palette.text.primary, lineHeight: 1 }}>
                        {selectedPaths.length}
                    </Typography>
                </Box>
                <Box sx={{ 
                    p: 1.2, 
                    bgcolor: theme.palette.background.paper, 
                    border: `1px solid ${theme.custom.border.soft}`, 
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        bgcolor: theme.palette.info.main,
                    }
                }}>
                    <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0.4, color: theme.palette.text.secondary })}>
                        Columns
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 750, fontSize: '1.25rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', color: theme.palette.text.primary, lineHeight: 1 }}>
                        {columnCount}
                    </Typography>
                </Box>
            </Box>

            <Box sx={{ px: 2.5, pb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${visibleFolderCount} folders`} sx={summaryChipSx(theme, { height: 22, ...metricChipTone(theme, 'primary') })} />
                <Chip size="small" label={`${visibleFileCount} files`} sx={summaryChipSx(theme, { height: 22, ...metricChipTone(theme, 'neutral') })} />
            </Box>

            <Box sx={{ px: 2.5, py: 2.5, borderTop: `1px solid ${theme.custom.border.soft}`, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                            Selection Queue
                        </Typography>
                        {selectedPaths.length > 0 && (
                            <Chip 
                                size="small" 
                                label={`${selectedPaths.length} Active`} 
                                sx={summaryChipSx(theme, { height: 18, fontSize: '0.65rem', ...metricChipTone(theme, 'success') })} 
                            />
                        )}
                    </Box>
                    {filter && (
                        <Chip
                            size="small"
                            label={`filter: ${filter}`}
                            sx={summaryChipSx(theme, { maxWidth: 220, ...metricChipTone(theme, 'primary') })}
                        />
                    )}
                </Box>

                {selectedPaths.length > 0 ? (
                    <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 0.8, 
                        overflowY: 'auto', 
                        flex: 1,
                        pr: 0.5,
                        mr: -0.5,
                    }}>
                        {selectedPaths.map((path, idx) => (
                            <Box
                                key={path}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.2,
                                    px: 1.2,
                                    py: 1,
                                    bgcolor: alpha(theme.palette.success.main, 0.04),
                                    border: `1px solid ${alpha(theme.palette.success.main, 0.12)}`,
                                    borderRadius: 2,
                                    minWidth: 0,
                                    transition: `all ${theme.custom.motion.swift}`,
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.success.main, 0.08),
                                        borderColor: alpha(theme.palette.success.main, 0.25),
                                        transform: 'translateX(2px)',
                                    },
                                    animation: 'fadeInSlide 0.24s cubic-bezier(0.215, 0.61, 0.355, 1) both',
                                    animationDelay: `${Math.min(idx * 0.04, 0.4)}s`,
                                    '@keyframes fadeInSlide': {
                                        from: { opacity: 0, transform: 'translateX(-5px)' },
                                        to: { opacity: 1, transform: 'translateX(0)' },
                                    }
                                }}
                            >
                                <Box sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: theme.palette.success.main,
                                    bgcolor: alpha(theme.palette.success.main, 0.08),
                                    flexShrink: 0,
                                }}>
                                    <InsertDriveFile sx={{ fontSize: 14 }} />
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography 
                                        noWrap 
                                        title={path} 
                                        sx={{ 
                                            fontSize: '0.78rem', 
                                            fontWeight: 600, 
                                            color: theme.palette.text.primary, 
                                            fontVariantNumeric: 'tabular-nums', 
                                            fontFeatureSettings: '"tnum" 1' 
                                        }}
                                    >
                                        {path.split('/').pop()}
                                    </Typography>
                                    <Typography 
                                        noWrap 
                                        title={path} 
                                        sx={{ 
                                            fontSize: '0.68rem', 
                                            color: theme.palette.text.secondary, 
                                            fontVariantNumeric: 'tabular-nums', 
                                            fontFeatureSettings: '"tnum" 1',
                                            mt: 0.1
                                        }}
                                    >
                                        {path}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Box
                        sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 1.5,
                            textAlign: 'center',
                            bgcolor: alpha(theme.palette.text.disabled, 0.01),
                            border: `1.5px dashed ${alpha(theme.palette.text.disabled, 0.15)}`,
                            borderRadius: 3,
                            p: 3,
                        }}
                    >
                        <Box sx={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: theme.palette.text.disabled,
                            bgcolor: alpha(theme.palette.text.disabled, 0.08),
                            mb: 0.5
                        }}>
                            <CheckBoxOutlineBlank sx={{ fontSize: 22 }} />
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                                No files selected
                            </Typography>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.5, maxWidth: 200 }}>
                                Tick the checkbox next to any file to add it to your download queue.
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
