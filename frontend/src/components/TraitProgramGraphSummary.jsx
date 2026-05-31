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
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { stickyTableContainerSx, stickyTableHeaderCellSx, stickyTableSx, tableRowRevealSx, tableTone } from '../themeUtils';

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
    onOpenProgram,
    onOpenGene,
}) {
    const theme = useTheme();
    const headerTone = tableTone(theme, 'neutral');
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

            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 430, overflowX: 'auto', overflowY: 'auto' })}>
                <Table size="small" stickyHeader sx={stickyTableSx(theme)}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 800, width: 112 })}>Side</TableCell>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 800, width: 132 })}>Program</TableCell>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 800, width: 132 })}>Selected by</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 800 })}>Score</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 800 })}>Genes</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 800 })}>+ / -</TableCell>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 800, minWidth: 260 })}>Visible genes</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 800 })}>Shown</TableCell>
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
                            const uniqueGenes = [];
                            const seenGenes = new Set();
                            (module.visibleGenes || []).forEach((gene) => {
                                const key = gene.highlightKey || gene.ensg || gene.gene;
                                if (!key || seenGenes.has(key)) return;
                                seenGenes.add(key);
                                uniqueGenes.push(gene);
                            });

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
                                            <Tooltip title={`Open ${module.program}`}>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onOpenProgram?.(module.program);
                                                    }}
                                                    sx={{
                                                        justifyContent: 'flex-start',
                                                        minWidth: 0,
                                                        p: 0,
                                                        color: '#245089',
                                                        fontWeight: 900,
                                                        lineHeight: 1,
                                                        textTransform: 'none',
                                                    }}
                                                >
                                                    {module.program}
                                                </Button>
                                            </Tooltip>
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
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {uniqueGenes.length ? uniqueGenes.slice(0, 10).map((gene) => {
                                                const geneLabel = gene.geneLabel || gene.gene || gene.ensg || 'gene';
                                                const sign = effectSignFromGene(gene);
                                                return (
                                                    <Chip
                                                        key={gene.highlightKey || `${module.program}:${geneLabel}`}
                                                        label={geneLabel}
                                                        size="small"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onOpenGene?.(gene);
                                                        }}
                                                        sx={{
                                                            height: 22,
                                                            borderRadius: 1,
                                                            fontSize: 11,
                                                            fontWeight: 800,
                                                            color: effectColors[sign] || '#475467',
                                                            bgcolor: sign === 'negative' ? 'rgba(52,125,204,0.10)' : sign === 'positive' ? 'rgba(239,78,47,0.10)' : 'rgba(15,23,42,0.06)',
                                                            border: `1px solid ${sign === 'negative' ? 'rgba(52,125,204,0.24)' : sign === 'positive' ? 'rgba(239,78,47,0.24)' : 'rgba(15,23,42,0.10)'}`,
                                                            cursor: 'pointer',
                                                        }}
                                                    />
                                                );
                                            }) : (
                                                <Typography sx={{ fontSize: 12, color: '#667085' }}>none</Typography>
                                            )}
                                            {uniqueGenes.length > 10 && (
                                                <Chip label={`+${uniqueGenes.length - 10}`} size="small" sx={{ height: 22, borderRadius: 1, fontSize: 11, fontWeight: 800 }} />
                                            )}
                                        </Stack>
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
                                <TableCell colSpan={8}>
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
