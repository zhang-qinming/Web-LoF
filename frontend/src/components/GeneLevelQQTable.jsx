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
    highlightedRowSx,
    metricChipTone,
    plotFrameSx,
    sectionPanelHeaderSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

const COLUMN_SPECS = [
    { key: 'gene', label: 'Gene', align: 'left', tone: 'gene', width: 122 },
    { key: 'ensg', label: 'ENSG', align: 'left', tone: 'gene', width: 150 },
    { key: 'tailSide', label: 'Tail', align: 'left', tone: 'tail', width: 92 },
    { key: 'expected', label: 'Expected', align: 'right', tone: 'qq', width: 104 },
    { key: 'observed', label: 'Observed', align: 'right', tone: 'qq', width: 104 },
    { key: 'deviation', label: 'Obs - Exp', align: 'right', tone: 'qq', width: 104 },
    { key: 'p', label: 'P', align: 'right', tone: 'stat', width: 106 },
    { key: 'fdr', label: 'FDR', align: 'right', tone: 'stat', width: 106 },
    { key: 'beta', label: 'Beta', align: 'right', tone: 'stat', width: 96 },
    { key: 'qqRank', label: 'Rank', align: 'right', tone: 'stat', width: 82 },
];

const COLUMN_GROUPS = [
    { label: 'Gene', span: 2, tone: 'gene' },
    { label: 'Direction', span: 1, tone: 'tail' },
    { label: 'QQ deviation', span: 3, tone: 'qq' },
    { label: 'Regulation statistic', span: 4, tone: 'stat' },
];

function sortLabelSx() {
    return {
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
}

function headerCellSx(align, tone) {
    return {
        px: 1,
        py: 0.72,
        textAlign: align,
        whiteSpace: 'nowrap',
        bgcolor: tone.headerBg,
        borderBottom: `2px solid ${tone.headerBorder}`,
        color: tone.headerColor,
        fontWeight: 600,
        fontSize: '0.67rem',
    };
}

function bodyCellSx({ align, tone, fontFamily, fontWeight = 400 }) {
    return {
        px: 1,
        py: 0.62,
        textAlign: align,
        whiteSpace: 'nowrap',
        fontSize: '0.71rem',
        fontFamily,
        fontWeight,
        color: '#334155',
        bgcolor: tone.cellSoft,
        borderBottom: '1px solid rgba(226,232,240,0.72)',
    };
}

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatPValue(value) {
    return Number.isFinite(value) ? value.toExponential(2) : '-';
}

function renderCellContent(column, row) {
    if (column.key === 'gene') return row.gene || row.ensg || '-';
    if (column.key === 'ensg') return row.ensg || '-';
    if (column.key === 'tailSide') return row.tailSide || '-';
    if (column.key === 'expected') return formatNumber(row.expected, 3);
    if (column.key === 'observed') return formatNumber(row.observed, 3);
    if (column.key === 'deviation') return formatNumber(row.deviation, 3);
    if (column.key === 'p') return formatPValue(row.p);
    if (column.key === 'fdr') return formatPValue(row.fdr);
    if (column.key === 'beta') return formatNumber(row.beta, 4);
    if (column.key === 'qqRank') return Number.isFinite(row.qqRank) ? row.qqRank : '-';
    return null;
}

export default function GeneLevelQQTable({
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
}) {
    const theme = useTheme();
    const TONES = {
        gene: tableTone(theme, 'neutral'),
        tail: tableTone(theme, 'accent'),
        qq: tableTone(theme, 'primary'),
        stat: tableTone(theme, 'warning'),
    };

    if (!rows.length) return null;

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
                    QQ deviation table
                    {!tableOpen && (
                        <Chip
                            label={sortedRows.length.toLocaleString()}
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
                <TableContainer sx={{ maxHeight: 560, overflowX: 'auto', overflowY: 'auto' }}>
                    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%', minWidth: 1066 }}>
                        <colgroup>
                            {COLUMN_SPECS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {COLUMN_GROUPS.map((group) => {
                                    const tone = TONES[group.tone];
                                    return (
                                        <TableCell
                                            key={group.label}
                                            colSpan={group.span}
                                            sx={{
                                                py: 0.58,
                                                px: 1,
                                                textAlign: 'center',
                                                whiteSpace: 'nowrap',
                                                bgcolor: tone.headerBg,
                                                borderBottom: `2px solid ${tone.headerBorder}`,
                                                color: tone.headerColor,
                                                fontWeight: 700,
                                                fontSize: '0.64rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                            }}
                                        >
                                            {group.label}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                            <TableRow>
                                {COLUMN_SPECS.map((column) => (
                                    <TableCell key={column.key} sx={headerCellSx(column.align, TONES[column.tone])}>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={sortLabelSx()}
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
                                            ...highlightedRowSx(theme, isHighlighted, even, 'geneQQRowFlashA', 'geneQQRowFlashB', highlight.key),
                                        }}
                                    >
                                        {COLUMN_SPECS.map((column) => {
                                            const sx = {
                                                ...bodyCellSx({
                                                    align: column.align,
                                                    tone: TONES[column.tone],
                                                    fontFamily: ['ensg', 'expected', 'observed', 'deviation', 'p', 'fdr', 'beta', 'qqRank'].includes(column.key) ? 'monospace' : undefined,
                                                    fontWeight: ['gene', 'tailSide', 'deviation'].includes(column.key) ? 600 : 400,
                                                }),
                                            };

                                            if (['expected', 'observed', 'deviation'].includes(column.key)) {
                                                sx.bgcolor = TONES.qq.cellStrong;
                                            }
                                            if (['p', 'fdr', 'beta', 'qqRank'].includes(column.key)) {
                                                sx.bgcolor = TONES.stat.cellStrong;
                                            }
                                            if (column.key === 'tailSide' || column.key === 'beta' || column.key === 'deviation') {
                                                sx.color = row.tailSide === 'positive' ? '#9a3412' : '#245089';
                                            }
                                            if (isHighlighted) {
                                                sx.fontWeight = ['gene', 'ensg', 'observed', 'deviation'].includes(column.key) ? 700 : Math.max(500, sx.fontWeight || 400);
                                            }

                                            return (
                                                <TableCell key={column.key} sx={sx}>
                                                    {renderCellContent(column, row)}
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
