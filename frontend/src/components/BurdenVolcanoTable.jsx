import React from 'react';
import {
    Box,
    Button,
    Chip,
    Collapse,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Download, ExpandLess, ExpandMore } from '@mui/icons-material';
import {
    groupedTableColumnHeaderCellSx,
    groupedTableHeaderCellSx,
    highlightedRowSx,
    metricChipTone,
    plotFrameSx,
    sectionPanelHeaderSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

function getColumnSpecs({ effectLabel = 'Beta', includePosteriorColumns = false } = {}) {
    const effectColumns = [
        { key: 'effect', label: effectLabel, align: 'right', tone: 'effect', width: 98 },
    ];

    if (includePosteriorColumns) {
        effectColumns.push(
            { key: 'posteriorSd', label: 'Post SD', align: 'right', tone: 'effect', width: 92 },
            { key: 'lower95', label: 'Lower 95', align: 'right', tone: 'effect', width: 92 },
            { key: 'upper95', label: 'Upper 95', align: 'right', tone: 'effect', width: 92 },
        );
    }

    effectColumns.push(
        { key: 'logp', label: '-log10(P)', align: 'right', tone: 'effect', width: 94 },
        { key: 'p', label: 'P-value', align: 'right', tone: 'effect', width: 98 },
        { key: 'fdr', label: 'FDR', align: 'right', tone: 'effect', width: 92 },
    );

    return [
        { key: 'gene', label: 'Gene', align: 'left', tone: 'info', width: 122 },
        { key: 'ensg', label: 'ENSG', align: 'left', tone: 'info', width: 146 },
        ...effectColumns,
        { key: 'primaryProgram', label: 'Program', align: 'left', tone: 'annotation', width: 138 },
        { key: 'primaryGeneset', label: 'Geneset', align: 'left', tone: 'annotation', width: 188 },
    ];
}

function getColumnGroups(includePosteriorColumns = false) {
    return [
        { label: 'Gene', span: 2, tone: 'info' },
        { label: 'Effect', span: includePosteriorColumns ? 7 : 4, tone: 'effect' },
        { label: 'Annotation', span: 2, tone: 'annotation' },
    ];
}

const sortLabelSx = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.15,
    fontSize: '0.67rem',
    m: 0,
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.82rem',
        margin: 0,
    },
};

function headerCellSx(theme, align, tone) {
    return groupedTableColumnHeaderCellSx(theme, tone, align);
}

function bodyCellSx({ align, tone, fontFamily, fontWeight = 400, whiteSpace = 'nowrap' }) {
    const palette = tone;
    return {
        px: 1,
        py: 0.62,
        textAlign: align,
        whiteSpace,
        fontSize: '0.71rem',
        fontFamily,
        fontWeight,
        color: '#334155',
        bgcolor: palette.cellSoft,
        borderBottom: '1px solid rgba(226,232,240,0.72)',
    };
}

function renderCellContent({ column, row, getProgramRoute, navigate }) {
    if (column.key === 'gene') return row.gene || '—';
    if (column.key === 'ensg') return row.ensg || '—';
    if (column.key === 'effect') return Number.isFinite(row.effect) ? row.effect.toFixed(4) : '—';
    if (column.key === 'posteriorSd') return Number.isFinite(row.posteriorSd) ? row.posteriorSd.toFixed(4) : '—';
    if (column.key === 'lower95') return Number.isFinite(row.lower95) ? row.lower95.toFixed(4) : '—';
    if (column.key === 'upper95') return Number.isFinite(row.upper95) ? row.upper95.toFixed(4) : '—';
    if (column.key === 'logp') return Number.isFinite(row.logp) ? row.logp.toFixed(2) : '—';
    if (column.key === 'p') return Number.isFinite(row.p) ? row.p.toExponential(2) : '—';
    if (column.key === 'fdr') return Number.isFinite(row.fdr) ? row.fdr.toExponential(2) : '—';
    if (column.key === 'primaryGeneset') return row.primaryGeneset || 'others';

    if (column.key === 'primaryProgram') {
        const route = getProgramRoute(row.primaryProgram);
        return (
            <Box
                component="button"
                type="button"
                onClick={() => {
                    if (route) navigate(route);
                }}
                sx={{
                    appearance: 'none',
                    border: 0,
                    p: 0,
                    m: 0,
                    background: 'transparent',
                    color: route ? '#245089' : '#64748b',
                    cursor: route ? 'pointer' : 'default',
                    font: 'inherit',
                    fontWeight: 600,
                    textAlign: 'left',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': route ? { textDecoration: 'underline' } : undefined,
                }}
            >
                {row.primaryProgram || 'others'}
            </Box>
        );
    }

    return null;
}

export default function BurdenVolcanoTable({
    tableSectionRef,
    rows,
    sortedRows,
    pagedRows,
    tableOpen,
    setTableOpen,
    tablePage,
    setTablePage,
    tableRowsPerPage,
    setTableRowsPerPage,
    sortBy,
    sortDir,
    handleSort,
    downloadCSV,
    highlight,
    tableRowRefs,
    navigate,
    getProgramRoute,
    effectLabel = 'Beta',
    includePosteriorColumns = false,
}) {
    const theme = useTheme();
    const TONES = {
        info: tableTone(theme, 'neutral'),
        effect: tableTone(theme, 'primary'),
        annotation: tableTone(theme, 'accent'),
    };
    if (!rows.length) return null;

    const columnSpecs = getColumnSpecs({ effectLabel, includePosteriorColumns });
    const columnGroups = getColumnGroups(includePosteriorColumns);
    const tableMinWidth = includePosteriorColumns ? 1320 : 1040;

    return (
        <Paper
            ref={tableSectionRef}
            variant="outlined"
            sx={plotFrameSx(theme, {
                mt: 2,
                borderRadius: 2,
                overflow: 'hidden',
            })}
        >
            <Box sx={sectionPanelHeaderSx(theme, { borderBottom: tableOpen ? `1px solid ${theme.custom.border.soft}` : 'none' })}>
                <Button
                    onClick={() => setTableOpen((prev) => !prev)}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: theme.palette.text.primary, fontWeight: 600, fontSize: '0.8rem', px: 0.3 }}
                >
                    Data Table
                    {!tableOpen && (
                        <Chip
                            label={rows.length.toLocaleString()}
                            size="small"
                            sx={summaryChipSx(theme, { ml: 1, height: 20, fontSize: '0.68rem', ...metricChipTone(theme, 'neutral') })}
                        />
                    )}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={downloadCSV}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                >
                    CSV
                </Button>
            </Box>

            <Collapse in={tableOpen}>
                <TableContainer sx={{ maxHeight: 520, overflowX: 'auto', overflowY: 'auto' }}>
                    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%', minWidth: tableMinWidth }}>
                        <colgroup>
                            {columnSpecs.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {columnGroups.map((group) => {
                                    const palette = TONES[group.tone];
                                    return (
                                        <TableCell
                                            key={group.label}
                                            colSpan={group.span}
                                            sx={groupedTableHeaderCellSx(theme, palette)}
                                        >
                                            {group.label}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                            <TableRow>
                                {columnSpecs.map((column) => (
                                    <TableCell key={column.key} sx={headerCellSx(theme, column.align, TONES[column.tone])}>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={sortLabelSx}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pagedRows.map((row, index) => {
                                const isHighlighted = highlight.rowKey === row.rowKey;
                                const absoluteIndex = (tablePage * tableRowsPerPage) + index;
                                const even = absoluteIndex % 2 === 0;

                                return (
                                    <TableRow
                                        key={row.rowKey}
                                        ref={(el) => {
                                            if (el) tableRowRefs.current[row.rowKey] = el;
                                        }}
                                        sx={{
                                            ...tableRowRevealSx(theme, index),
                                            ...highlightedRowSx(theme, isHighlighted, even, 'volcanoRowFlashA', 'volcanoRowFlashB', highlight.key),
                                        }}
                                    >
                                        {columnSpecs.map((column) => {
                                            const sx = {
                                                ...bodyCellSx({
                                                    align: column.align,
                                                    tone: column.tone,
                                                    fontFamily: ['ensg', 'effect', 'posteriorSd', 'lower95', 'upper95', 'logp', 'p', 'fdr', 'primaryProgram'].includes(column.key) ? 'monospace' : undefined,
                                                    fontWeight: ['gene', 'logp', 'primaryProgram'].includes(column.key) ? 600 : 400,
                                                    whiteSpace: ['primaryGeneset'].includes(column.key) ? 'normal' : 'nowrap',
                                                }),
                                            };

                                            if (column.key === 'effect') {
                                                sx.color = row.effect >= 0 ? '#9a3412' : '#245089';
                                                sx.bgcolor = TONES.effect.cellStrong;
                                            }
                                            if (['posteriorSd', 'lower95', 'upper95', 'logp'].includes(column.key)) sx.bgcolor = TONES.effect.cellStrong;
                                            if (column.key === 'primaryGeneset') {
                                                sx.lineHeight = 1.3;
                                                sx.color = '#5b3f86';
                                                sx.bgcolor = TONES.annotation.cellStrong;
                                            }
                                            if (isHighlighted) {
                                                sx.fontWeight = ['gene', 'ensg', 'logp', 'primaryProgram', 'primaryGeneset'].includes(column.key) ? 700 : Math.max(500, sx.fontWeight || 400);
                                            }

                                            return (
                                                <TableCell key={column.key} sx={sx}>
                                                    {renderCellContent({
                                                        column,
                                                        row,
                                                        getProgramRoute,
                                                        navigate,
                                                    })}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    component="div"
                    count={sortedRows.length}
                    page={tablePage}
                    onPageChange={(_, nextPage) => setTablePage(nextPage)}
                    rowsPerPage={tableRowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setTableRowsPerPage(Number(event.target.value) || 50);
                        setTablePage(0);
                    }}
                    rowsPerPageOptions={[50, 100, 200]}
                />
            </Collapse>
        </Paper>
    );
}
