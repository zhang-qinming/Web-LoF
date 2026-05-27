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
    effectColors,
    effectSignFromGene,
    edgeColorFromScore,
    formatNumber,
}) {
    const theme = useTheme();
    const scoreField = side === 'program' ? 'programScore' : 'regulatorScore';
    const totalField = side === 'program' ? 'loadingTotalCount' : 'regulatorTotalCount';

    return (
        <Paper variant="outlined" sx={{ borderRadius: 1, borderColor: 'rgba(15,23,42,0.10)', overflow: 'hidden' }}>
            <Box
                sx={{
                    px: 1.5,
                    py: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    bgcolor: sideMeta.softBg,
                }}
            >
                <Typography sx={{ fontWeight: 800, color: sideMeta.accent, fontSize: 13 }}>
                    {title}
                </Typography>
                <Chip
                    label={`${modules.length} modules`}
                    size="small"
                    sx={{ height: 22, fontWeight: 700, color: sideMeta.accent, borderColor: sideMeta.accent }}
                    variant="outlined"
                />
            </Box>

            <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800, width: 92 }}>Program</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Score</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Genes</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>+ / -</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>Shown</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {modules.map((module, index) => {
                            const selected = selectedProgram === module.program;
                            const positiveCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'positive').length || 0;
                            const negativeCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'negative').length || 0;

                            return (
                                <TableRow
                                    key={`${module.program}:${side}`}
                                    hover
                                    selected={selected}
                                    onClick={() => onSelectProgram(module.program)}
                                    sx={{
                                        ...tableRowRevealSx(theme, index),
                                        cursor: 'pointer',
                                        '&.Mui-selected': { bgcolor: sideMeta.softBg },
                                        '&.Mui-selected:hover': { bgcolor: sideMeta.softBg },
                                    }}
                                >
                                    <TableCell>
                                        <Stack spacing={0.35}>
                                            <Typography sx={{ fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                                                {module.program}
                                            </Typography>
                                            <Typography sx={{ fontSize: 11.5, color: '#667085', lineHeight: 1.2 }}>
                                                {module.colorLabel}
                                            </Typography>
                                        </Stack>
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
                                                    onToggleExpanded(module.program, side);
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
                                <TableCell colSpan={5}>
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
