import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import { useTheme } from '@mui/material/styles';
import Download from '@mui/icons-material/Download';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import TableSearchField from './TableSearchField';
import {
    groupedTableColumnHeaderCellSx,
    highlightedRowSx,
    metricChipTone,
    plotFrameSx,
    sectionPanelHeaderSx,
    stickyTableContainerSx,
    stickyTableSx,
    summaryChipSx,
    tableToolbarActionButtonSx,
    tableToolbarGroupSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

const COLUMN_SPECS = [
    { key: 'sourceTraitName', label: 'Trait', align: 'center', tone: 'trait', width: 190 },
    { key: 'gene', label: 'Gene', align: 'center', tone: 'gene', width: 122 },
    { key: 'tailSide', label: 'Tail', align: 'center', tone: 'tail', width: 92 },
    { key: 'expected', label: 'Expected', align: 'center', tone: 'qq', width: 104 },
    { key: 'observed', label: 'Observed', align: 'center', tone: 'qq', width: 104 },
    { key: 'deviation', label: 'Obs - Exp', align: 'center', tone: 'qq', width: 104 },
    { key: 'p', label: 'P', align: 'center', tone: 'stat', width: 106 },
    { key: 'fdr', label: 'FDR', align: 'center', tone: 'stat', width: 106 },
    { key: 'beta', label: 'Beta', align: 'center', tone: 'stat', width: 96 },
    { key: 'qqRank', label: 'Rank', align: 'center', tone: 'stat', width: 82 },
];

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

function sortLabelSx() {
    return {
        display: 'flex',
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

function headerCellSx(theme, align, tone) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, { top: 0 });
}

function bodyCellSx({ align, tone, fontFamily, fontWeight = 400, whiteSpace = 'normal' }) {
    const useDataFont = fontFamily === 'monospace';
    return {
        px: 1,
        py: 0.62,
        textAlign: align,
        whiteSpace,
        wordBreak: whiteSpace === 'normal' ? 'break-word' : undefined,
        overflowWrap: whiteSpace === 'normal' ? 'anywhere' : undefined,
        fontSize: '0.71rem',
        fontFamily: useDataFont ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        fontWeight,
        color: '#334155',
        bgcolor: tone.cellSoft,
        borderBottom: '1px solid rgba(226,232,240,0.72)',
        verticalAlign: 'middle',
    };
}

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatPValue(value) {
    return Number.isFinite(value) ? value.toExponential(2) : '-';
}

function renderCellContent(column, row) {
    if (column.key === 'sourceTraitName') return row.sourceTraitName || row.sourceGwasId || row.sourceFileId || '-';
    if (column.key === 'gene') return row.geneLabel || row.gene || row.ensg || '-';
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
    geneQuery,
    setGeneQuery,
}) {
    const theme = useTheme();
    const TONES = {
        trait: tableTone(theme, 'primary'),
        gene: tableTone(theme, 'primary'),
        tail: tableTone(theme, 'primary'),
        qq: tableTone(theme, 'primary'),
        stat: tableTone(theme, 'primary'),
    };

    if (!rows.length) return null;

    const shouldPaginate = rows.length > 50;
    const visibleRows = shouldPaginate ? pagedRows : sortedRows;
    const traitCount = new Set(rows.map((row) => row.sourceTraitName || row.sourceGwasId || row.sourceFileId).filter(Boolean)).size;
    const columnSpecs = traitCount <= 1
        ? COLUMN_SPECS.filter((column) => column.key !== 'sourceTraitName')
        : COLUMN_SPECS;
    const tableMinWidth = columnSpecs.reduce((total, column) => total + column.width, 0);

    return (
        <Paper
            ref={tableSectionRef}
            variant="outlined"
            sx={plotFrameSx(theme, {
                mt: 2,
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
                zIndex: 2,
            })}
        >
            <Box sx={sectionPanelHeaderSx(theme, {
                borderBottom: tableOpen ? `1px solid ${theme.custom.border.soft}` : 'none',
                flexWrap: 'wrap',
            })}>
                <Button
                    onClick={() => setTableOpen((prev) => !prev)}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: theme.palette.text.primary, fontWeight: 600, fontSize: '0.8rem', px: 0.3 }}
                >
                    QQ Plot table
                    {!tableOpen && (
                        <Chip
                            label={sortedRows.length.toLocaleString()}
                            size="small"
                            sx={summaryChipSx(theme, { ml: 1, height: 20, fontSize: '0.68rem', ...metricChipTone(theme, 'neutral') })}
                        />
                    )}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Box sx={tableToolbarGroupSx(theme, { ml: 'auto', width: { xs: '100%', sm: 'auto' } })}>
                    <TableSearchField
                        label="Search"
                        value={geneQuery}
                        placeholder="Gene or ENSG"
                        onChange={(value) => {
                            setGeneQuery(value);
                            setTablePage(0);
                        }}
                        onClear={() => {
                            setGeneQuery('');
                            setTablePage(0);
                        }}
                        width={{ xs: '100%', sm: 260 }}
                    />
                    <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={downloadCSV}
                        sx={tableToolbarActionButtonSx(theme)}
                    >
                        Export CSV
                    </Button>
                </Box>
            </Box>

            <Collapse in={tableOpen}>
                <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', width: '100%', minWidth: { xs: tableMinWidth, lg: 'unset' } })}>
                        <colgroup>
                            {columnSpecs.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {columnSpecs.map((column) => (
                                    <TableCell key={column.key} align={column.align} sx={headerCellSx(theme, column.align, TONES[column.tone])}>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...sortLabelSx(), justifyContent: justifyForAlign(column.align), width: '100%' }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibleRows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columnSpecs.length}
                                        sx={{
                                            py: 3,
                                            textAlign: 'center',
                                            color: theme.palette.text.secondary,
                                            fontSize: '0.78rem',
                                            bgcolor: theme.palette.background.paper,
                                        }}
                                    >
                                        No matching rows.
                                    </TableCell>
                                </TableRow>
                            ) : visibleRows.map((row, index) => {
                                const isHighlighted = highlight.rowKey === row.rowKey;
                                const absoluteIndex = shouldPaginate ? (tablePage * tableRowsPerPage) + index : index;
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
                                        {columnSpecs.map((column) => {
                                            const sx = {
                                                ...bodyCellSx({
                                                    align: column.align,
                                                    tone: TONES[column.tone],
                                                    fontFamily: ['expected', 'observed', 'deviation', 'p', 'fdr', 'beta', 'qqRank'].includes(column.key) ? 'monospace' : undefined,
                                                    fontWeight: ['sourceTraitName', 'gene', 'tailSide', 'deviation'].includes(column.key) ? 600 : 400,
                                                    whiteSpace: ['sourceTraitName', 'gene'].includes(column.key) ? 'normal' : 'nowrap',
                                                }),
                                            };

                                            if (column.key === 'sourceTraitName') {
                                                sx.bgcolor = TONES.trait.cellStrong;
                                            }
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
                                                sx.fontWeight = ['sourceTraitName', 'gene', 'observed', 'deviation'].includes(column.key) ? 700 : Math.max(500, sx.fontWeight || 400);
                                            }

                                            return (
                                                <TableCell key={column.key} align={column.align} sx={sx}>
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
                {shouldPaginate && (
                    <TablePagination
                        component="div"
                        count={sortedRows.length}
                        page={tablePage}
                        onPageChange={(_, nextPage) => setTablePage(nextPage)}
                        rowsPerPage={tableRowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setTableRowsPerPage(Number(event.target.value) || 25);
                            setTablePage(0);
                        }}
                        rowsPerPageOptions={[25, 50, 100, 200]}
                    />
                )}
            </Collapse>
        </Paper>
    );
}
