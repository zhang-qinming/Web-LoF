import React from 'react';
import {
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { tableRowRevealSx } from '../themeUtils';

export default function TraitProgramGraphSummary({
    title,
    modules,
    side,
    selectedProgram,
    onSelectProgram,
    onToggleExpanded,
    sideMeta,
    sideMetaMap,
    programColor,
    programSelectionLabel,
    effectColors,
    effectSignFromGene,
    edgeColorFromScore,
    formatNumber,
}) {
    const theme = useTheme();
    const programCount = modules.filter((module) => (module.side || side) === 'program').length;
    const regulatorCount = modules.filter((module) => (module.side || side) === 'regulator').length;

    return (
        <Paper variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'rgba(15,23,42,0.10)', overflow: 'hidden' }}>
            <Box
                sx={{
                    px: 1.75,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    bgcolor: 'rgba(15,23,42,0.025)',
                    borderBottom: '1px solid rgba(15,23,42,0.06)',
                    flexWrap: 'wrap',
                }}
            >
                <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 13.5 }}>
                    {title}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip label={`${modules.length} modules`} size="small" sx={{ height: 22, fontWeight: 800 }} />
                    {programCount > 0 && (
                        <Chip
                            label={`program ${programCount}`}
                            size="small"
                            sx={{
                                height: 22,
                                fontWeight: 800,
                                color: (sideMetaMap?.program || sideMeta).accent,
                                bgcolor: (sideMetaMap?.program || sideMeta).softBg,
                            }}
                        />
                    )}
                    {regulatorCount > 0 && (
                        <Chip
                            label={`regulator ${regulatorCount}`}
                            size="small"
                            sx={{
                                height: 22,
                                fontWeight: 800,
                                color: (sideMetaMap?.regulator || sideMeta).accent,
                                bgcolor: (sideMetaMap?.regulator || sideMeta).softBg,
                            }}
                        />
                    )}
                </Stack>
            </Box>

            <TableContainer sx={{ maxHeight: 430 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800, width: 112 }}>Side</TableCell>
                            <TableCell sx={{ fontWeight: 800, width: 132 }}>Program</TableCell>
                            <TableCell sx={{ fontWeight: 800, width: 132 }}>Selected by</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Score</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Genes</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>+ / -</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Shown</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {modules.map((module, index) => {
                            const rowSide = module.side || side;
                            const rowMeta = sideMetaMap?.[rowSide] || sideMeta;
                            const scoreField = rowSide === 'program' ? 'programScore' : 'regulatorScore';
                            const totalField = rowSide === 'program' ? 'loadingTotalCount' : 'regulatorTotalCount';
                            const selected = selectedProgram === module.program;
                            const selectionColor = programColor(module);
                            const selectionLabel = programSelectionLabel(module);
                            const positiveCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'positive').length || 0;
                            const negativeCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'negative').length || 0;

                            return (
                                <TableRow
                                    key={`${module.program}:${rowSide}`}
                                    hover
                                    selected={selected}
                                    onClick={() => onSelectProgram(module.program)}
                                    sx={{
                                        ...tableRowRevealSx(theme, index),
                                        cursor: 'pointer',
                                        '&.Mui-selected': { bgcolor: rowMeta.softBg },
                                        '&.Mui-selected:hover': { bgcolor: rowMeta.softBg },
                                    }}
                                >
                                    <TableCell>
                                        <Chip
                                            label={rowSide}
                                            size="small"
                                            sx={{
                                                height: 22,
                                                borderRadius: 1,
                                                color: rowMeta.accent,
                                                bgcolor: rowMeta.softBg,
                                                fontWeight: 900,
                                                textTransform: 'lowercase',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Stack spacing={0.35}>
                                            <Typography sx={{ fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                                                {module.program}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11.5, color: '#667085', lineHeight: 1.2 }}>
                                                {rowSide === 'program' ? 'program burden' : 'regulator-program'}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 0.7,
                                                minWidth: 0,
                                                px: 0.75,
                                                py: 0.35,
                                                borderRadius: 1,
                                                bgcolor: `${selectionColor}18`,
                                                border: `1px solid ${selectionColor}55`,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: 0.75,
                                                    bgcolor: selectionColor,
                                                    border: '1px solid rgba(15,23,42,0.12)',
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: 12,
                                                    color: '#475467',
                                                    fontWeight: 700,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {selectionLabel}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography
                                            sx={{
                                                fontWeight: 800,
                                                color: edgeColorFromScore(module[scoreField]),
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {formatNumber(module[scoreField], 2)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {module.totalFilteredGenes}/{module[totalField]}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        <Box component="span" sx={{ color: effectColors.positive, fontWeight: 800 }}>{positiveCount}</Box>
                                        {' / '}
                                        <Box component="span" sx={{ color: effectColors.negative, fontWeight: 800 }}>{negativeCount}</Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        {module.collapsed ? (
                                            <Typography sx={{ fontSize: 12, color: '#667085' }}>none</Typography>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onToggleExpanded(module.program, rowSide);
                                                }}
                                                sx={{ minWidth: 0, px: 0.5, textTransform: 'none', fontSize: 12 }}
                                            >
                                                {module.expanded ? 'all' : module.visibleGenes.length}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!modules.length && (
                            <TableRow>
                                <TableCell colSpan={7}>
                                    <Typography sx={{ py: 2, textAlign: 'center', color: '#667085', fontSize: 13 }}>
                                        No modules after current filters
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
