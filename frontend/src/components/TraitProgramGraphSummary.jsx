import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { alpha, useTheme } from '@mui/material/styles';
import { stickyTableContainerSx, stickyTableHeaderCellSx, stickyTableSx, tableRowRevealSx, tableTone } from '../themeUtils';
import { compareValues, nextSortDirection } from '../utils/sort';

const formatGeneName = (gene) => gene.geneLabel || gene.gene || gene.ensg || 'gene';

const finiteOrMax = (value) => (
    Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER
);

const finiteOrZero = (value) => (
    Number.isFinite(Number(value)) ? Number(value) : 0
);

const SUMMARY_COLUMNS = [
    { key: 'gene', label: 'gene', width: 158, description: 'Gene symbol for the association row.', type: 'text', defaultDirection: 'asc' },
    { key: 'program', label: 'program', width: 178, description: 'Program connected with this gene for the selected trait.', type: 'text', defaultDirection: 'asc' },
    { key: 'side', label: 'role', width: 104, description: 'Program or regulator evidence role for this association row.', type: 'text', defaultDirection: 'asc' },
    { key: 'effect', label: 'post_mean_sign', width: 116, description: 'Direction inferred from the post_mean source field.', type: 'text', defaultDirection: 'asc' },
    { key: 'postMean', label: 'post_mean', width: 116, description: 'Source post_mean value for the gene.', type: 'number', defaultDirection: 'desc' },
    { key: 'absGamma', label: 'abs_gamma', width: 126, description: 'Source abs_gamma value used as fallback priority when rank is missing.', type: 'number', defaultDirection: 'desc' },
    { key: 'direction', label: 'concordance', width: 132, description: 'Whether trait and regulator/program signs are concordant or discordant.', type: 'text', defaultDirection: 'asc' },
    { key: 'scores', label: 'score / membership_score', width: 158, description: 'Context score followed by source membership_score.', type: 'number', defaultDirection: 'desc' },
];

function compareGenePriority(a, b) {
    const rankDelta = finiteOrMax(a.gene.rankWithinSide) - finiteOrMax(b.gene.rankWithinSide);
    if (rankDelta !== 0) return rankDelta;

    const effectDelta = Math.abs(finiteOrZero(b.gene.absGamma)) - Math.abs(finiteOrZero(a.gene.absGamma));
    if (effectDelta !== 0) return effectDelta;

    const membershipDelta = Math.abs(finiteOrZero(b.gene.membershipScore)) - Math.abs(finiteOrZero(a.gene.membershipScore));
    if (membershipDelta !== 0) return membershipDelta;

    const geneDelta = formatGeneName(a.gene).localeCompare(formatGeneName(b.gene), undefined, { numeric: true, sensitivity: 'base' });
    if (geneDelta !== 0) return geneDelta;

    return a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: 'base' });
}

function getDirectionLabel(gene) {
    if (gene.isDiscordant) return 'discordant';
    if (gene.isConcordant) return 'concordant';
    return 'not flagged';
}

function compareSummaryRows(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'gene') {
        result = compareValues(formatGeneName(a.gene), formatGeneName(b.gene), 'text', sortDir);
    } else if (sortBy === 'program') {
        result = compareValues(a.module.program, b.module.program, 'text', sortDir);
    } else if (sortBy === 'side') {
        result = compareValues(a.rowSide, b.rowSide, 'text', sortDir);
    } else if (sortBy === 'effect') {
        result = compareValues(a.sign, b.sign, 'text', sortDir);
    } else if (sortBy === 'postMean') {
        result = compareValues(a.gene.postMean, b.gene.postMean, 'number', sortDir);
    } else if (sortBy === 'absGamma') {
        result = compareValues(a.gene.absGamma, b.gene.absGamma, 'number', sortDir);
    } else if (sortBy === 'direction') {
        result = compareValues(getDirectionLabel(a.gene), getDirectionLabel(b.gene), 'text', sortDir);
    } else if (sortBy === 'scores') {
        result = compareValues(a.score, b.score, 'number', sortDir)
            || compareValues(a.gene.membershipScore, b.gene.membershipScore, 'number', sortDir);
    }

    return result || compareGenePriority(a, b);
}

export default function TraitProgramGraphSummary({
    title,
    modules,
    side,
    selectedProgram,
    selectedGeneKey,
    onSelectProgram,
    onSelectGene,
    onClearSelection,
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
    const [tablePage, setTablePage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(50);
    const [showAllGenes, setShowAllGenes] = React.useState(false);
    const [sortBy, setSortBy] = React.useState('priority');
    const [sortDir, setSortDir] = React.useState('asc');
    const headerTone = tableTone(theme, 'primary');
    const compactCellSx = {
        py: 0.55,
        px: 0.9,
        fontSize: 12,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        textAlign: 'center',
    };
    const compactNumericCellSx = {
        ...compactCellSx,
        fontVariantNumeric: 'tabular-nums',
    };

    const geneRows = React.useMemo(() => {
        const rows = modules.flatMap((module) => {
            const rowSide = module.side || side;
            const rowMeta = sideMetaMap?.[rowSide] || sideMeta;
            const scoreField = rowSide === 'program' ? 'programScore' : 'regulatorScore';
            const plotGenes = module.plotGenes || module.visibleGenes || [];
            const sourceGenes = showAllGenes ? (module.allGenes || plotGenes) : plotGenes;
            const seenGenes = new Set();

            return sourceGenes.reduce((moduleRows, gene, geneIndex) => {
                const geneKey = gene.highlightKey || gene.ensg || gene.gene || `${module.program}:${rowSide}:${geneIndex}`;
                if (seenGenes.has(geneKey)) return moduleRows;
                seenGenes.add(geneKey);
                moduleRows.push({
                    key: `${module.program}:${rowSide}:${geneKey}`,
                    module,
                    rowSide,
                    rowMeta,
                    gene,
                    geneKey,
                    score: module[scoreField],
                    selectionColor: programColor(module),
                    selectionLabel: programSelectionLabel(module),
                    sign: effectSignFromGene(gene),
                });
                return moduleRows;
            }, []);
        });

        return rows.sort(compareGenePriority);
    }, [effectSignFromGene, modules, programColor, programSelectionLabel, showAllGenes, side, sideMeta, sideMetaMap]);

    const hasHiddenGenes = React.useMemo(() => modules.some((module) => {
        const plotKeys = new Set((module.plotGenes || module.visibleGenes || [])
            .map((gene) => gene.highlightKey || gene.ensg || gene.gene)
            .filter(Boolean));
        return (module.allGenes || []).some((gene) => {
            const key = gene.highlightKey || gene.ensg || gene.gene;
            return key && !plotKeys.has(key);
        });
    }), [modules]);

    const sortedGeneRows = React.useMemo(() => {
        if (sortBy === 'priority') return geneRows;
        return [...geneRows].sort((a, b) => compareSummaryRows(a, b, sortBy, sortDir));
    }, [geneRows, sortBy, sortDir]);

    const shouldPaginate = sortedGeneRows.length > 80;
    const visibleRows = shouldPaginate
        ? sortedGeneRows.slice(tablePage * rowsPerPage, (tablePage * rowsPerPage) + rowsPerPage)
        : sortedGeneRows;

    const handleSort = React.useCallback((column) => {
        setSortDir((current) => nextSortDirection(sortBy, column.key, current, column.defaultDirection));
        setSortBy(column.key);
    }, [sortBy]);

    React.useEffect(() => {
        const maxPage = shouldPaginate ? Math.max(0, Math.ceil(sortedGeneRows.length / rowsPerPage) - 1) : 0;
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [rowsPerPage, shouldPaginate, sortedGeneRows.length, tablePage]);

    React.useEffect(() => {
        setTablePage(0);
    }, [modules.length, showAllGenes, sortBy, sortDir]);

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
                <Typography sx={{ fontWeight: 720, color: '#0f172a', fontSize: 13.5 }}>
                    {title}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {hasHiddenGenes && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setShowAllGenes((current) => !current)}
                            sx={{ minHeight: 26, py: 0.15, px: 1, fontSize: 11.5, textTransform: 'none' }}
                        >
                            {showAllGenes ? 'Show plot genes' : 'Show all genes'}
                        </Button>
                    )}
                    {(selectedProgram || selectedGeneKey) && (
                        <Button
                            size="small"
                            variant="text"
                            onClick={onClearSelection}
                            sx={{ minHeight: 26, py: 0.15, px: 1, fontSize: 11.5, textTransform: 'none' }}
                        >
                            Clear focus
                        </Button>
                    )}
                </Stack>
            </Box>

            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table
                    size="small"
                    stickyHeader
                    sx={stickyTableSx(theme, {
                        minWidth: 1048,
                        tableLayout: 'fixed',
                        '& .MuiTableCell-root': {
                            borderBottom: '1px solid rgba(226,232,240,0.72)',
                        },
                    })}
                >
                    <colgroup>
                        {SUMMARY_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            {SUMMARY_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    align="center"
                                    sx={stickyTableHeaderCellSx(theme, headerTone, 'center', { fontWeight: 650 })}
                                >
                                    <Tooltip title={column.description} arrow>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : column.defaultDirection}
                                            onClick={() => handleSort(column)}
                                            sx={{
                                                justifyContent: 'center',
                                                width: '100%',
                                                fontSize: 'inherit',
                                                cursor: 'pointer',
                                                '& .MuiTableSortLabel-icon': {
                                                    fontSize: '0.82rem',
                                                    margin: 0,
                                                },
                                            }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </Tooltip>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleRows.map((row, index) => {
                            const geneSelected = selectedGeneKey === row.gene.highlightKey;
                            const contextSelected = selectedProgram === row.module.program;
                            const effectColor = effectColors[row.sign] || '#475467';
                            return (
                                <TableRow
                                    key={row.key}
                                    hover
                                    selected={geneSelected || contextSelected}
                                    onClick={() => onSelectGene?.(row.gene)}
                                    sx={{
                                        ...tableRowRevealSx(theme, index),
                                        cursor: 'pointer',
                                        '&.Mui-selected': {
                                            bgcolor: geneSelected ? alpha(effectColor, 0.12) : row.rowMeta.softBg,
                                        },
                                        '&.Mui-selected:hover': {
                                            bgcolor: geneSelected ? alpha(effectColor, 0.16) : row.rowMeta.softBg,
                                        },
                                    }}
                                >
                                    <TableCell sx={compactCellSx}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25, minWidth: 0 }}>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onSelectGene?.(row.gene);
                                                }}
                                                sx={{
                                                    justifyContent: 'center',
                                                    minWidth: 0,
                                                    maxWidth: 116,
                                                    p: 0,
                                                    color: geneSelected ? effectColor : '#245089',
                                                    fontSize: 12,
                                                    fontWeight: 780,
                                                    lineHeight: 1.1,
                                                    textTransform: 'none',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {formatGeneName(row.gene)}
                                            </Button>
                                            <Tooltip title={`Open ${formatGeneName(row.gene)}`}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`Open ${formatGeneName(row.gene)}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onOpenGene?.(row.gene);
                                                    }}
                                                    sx={{ width: 20, height: 20, color: '#667085', flexShrink: 0 }}
                                                >
                                                    <OpenInNew sx={{ fontSize: 13 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={compactCellSx}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25, minWidth: 0 }}>
                                            <Tooltip title={`Focus ${row.module.program} in the gene association map and summary`}>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onSelectProgram(row.module.program, row.rowSide);
                                                    }}
                                                    sx={{
                                                        justifyContent: 'center',
                                                        minWidth: 0,
                                                        maxWidth: 132,
                                                        p: 0,
                                                        color: '#245089',
                                                        fontSize: 12,
                                                        fontWeight: 740,
                                                        lineHeight: 1.1,
                                                        textTransform: 'none',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {row.module.program}
                                                </Button>
                                            </Tooltip>
                                            <Tooltip title={`Open ${row.module.program}`}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`Open ${row.module.program}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onOpenProgram?.(row.module.program);
                                                    }}
                                                    sx={{ width: 20, height: 20, color: '#667085', flexShrink: 0 }}
                                                >
                                                    <OpenInNew sx={{ fontSize: 13 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={compactCellSx}>
                                        <Chip
                                            label={row.rowSide}
                                            size="small"
                                            sx={{
                                                height: 20,
                                                borderRadius: 1,
                                                color: row.rowMeta.accent,
                                                bgcolor: row.rowMeta.softBg,
                                                fontSize: 10.5,
                                                fontWeight: 700,
                                                textTransform: 'lowercase',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={compactCellSx}>
                                        <Chip
                                            label={row.sign || 'neutral'}
                                            size="small"
                                            sx={{
                                                height: 20,
                                                borderRadius: 1,
                                                fontSize: 10.5,
                                                fontWeight: 720,
                                                color: effectColor,
                                                bgcolor: alpha(effectColor, 0.10),
                                                border: `1px solid ${alpha(effectColor, 0.24)}`,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="center" sx={{ ...compactNumericCellSx, color: effectColor, fontWeight: 780 }}>
                                        {formatNumber(row.gene.postMean, 3)}
                                    </TableCell>
                                    <TableCell align="center" sx={{ ...compactNumericCellSx, color: '#475467', fontWeight: 700 }}>
                                        {formatNumber(row.gene.absGamma, 3)}
                                    </TableCell>
                                    <TableCell sx={{ ...compactCellSx, color: row.gene.isDiscordant ? '#b45309' : '#667085', fontWeight: row.gene.isDiscordant ? 760 : 620 }}>
                                        {getDirectionLabel(row.gene)}
                                    </TableCell>
                                    <TableCell align="center" sx={compactNumericCellSx}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.8 }}>
                                            <Box component="span" sx={{ color: edgeColorFromScore(row.score), fontWeight: 780 }}>
                                                {formatNumber(row.score, 2)}
                                            </Box>
                                            <Box component="span" sx={{ color: '#667085', fontWeight: 680 }}>
                                                {formatNumber(row.gene.membershipScore, 3)}
                                            </Box>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!geneRows.length && (
                            <TableRow>
                                <TableCell colSpan={SUMMARY_COLUMNS.length}>
                                    <Typography sx={{ py: 2, textAlign: 'center', color: '#667085', fontSize: 13 }}>
                                        No genes available
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {shouldPaginate && (
                <TablePagination
                    component="div"
                    count={sortedGeneRows.length}
                    page={tablePage}
                    onPageChange={(_, nextPage) => setTablePage(nextPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(Number(event.target.value) || 50);
                        setTablePage(0);
                    }}
                    rowsPerPageOptions={[50, 100, 200, 500]}
                />
            )}
        </Paper>
    );
}
