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
    stickyTableContainerSx,
    stickyTableSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

const COLUMN_SPECS = [
    { key: 'gene', label: 'Gene', align: 'left', tone: 'gene', width: 118 },
    { key: 'ensg', label: 'ENSG', align: 'left', tone: 'gene', width: 148 },
    { key: 'postMean', label: 'Post mean', align: 'right', tone: 'posterior', width: 104 },
    { key: 'signedLogP', label: 'signed -log10(P)', align: 'right', tone: 'regulation', width: 128 },
    { key: 'beta', label: 'Beta', align: 'right', tone: 'regulation', width: 92 },
    { key: 'p', label: 'P', align: 'right', tone: 'regulation', width: 104 },
    { key: 'fdr', label: 'FDR', align: 'right', tone: 'regulation', width: 104 },
    { key: 'evidenceClassLabel', label: 'Evidence', align: 'left', tone: 'evidence', width: 180 },
    { key: 'combinedScore', label: 'Score', align: 'right', tone: 'evidence', width: 94 },
    { key: 'labelReason', label: 'Label', align: 'left', tone: 'evidence', width: 130 },
];

const COLUMN_GROUPS = [
    { label: 'Gene', span: 2, tone: 'gene' },
    { label: 'Posterior', span: 1, tone: 'posterior' },
    { label: 'Perturb-seq regulation', span: 4, tone: 'regulation' },
    { label: 'Selection', span: 3, tone: 'evidence' },
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

function headerCellSx(theme, align, tone) {
    return groupedTableColumnHeaderCellSx(theme, tone, align);
}

function bodyCellSx({ align, tone, fontFamily, fontWeight = 400, whiteSpace = 'nowrap' }) {
    const useDataFont = fontFamily === 'monospace';
    return {
        px: 1,
        py: 0.62,
        textAlign: align,
        whiteSpace,
        fontSize: '0.71rem',
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        fontWeight,
        color: '#334155',
        bgcolor: tone.cellSoft,
        borderBottom: '1px solid rgba(226,232,240,0.72)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };
}

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatPValue(value) {
    return Number.isFinite(value) ? value.toExponential(2) : '-';
}

function formatLabelReason(value) {
    if (value === 'top_combined_score') return 'Top score';
    if (value === 'highlight_gene') return 'Highlighted';
    return value || '-';
}

function renderCellContent(column, row) {
    if (column.key === 'gene') return row.gene || '-';
    if (column.key === 'ensg') return row.ensg || '-';
    if (column.key === 'postMean') return formatNumber(row.postMean, 4);
    if (column.key === 'signedLogP') return formatNumber(row.signedLogP, 2);
    if (column.key === 'beta') return formatNumber(row.beta, 4);
    if (column.key === 'p') return formatPValue(row.p);
    if (column.key === 'fdr') return formatPValue(row.fdr);
    if (column.key === 'combinedScore') return formatNumber(row.combinedScore, 2);
    if (column.key === 'labelReason') return formatLabelReason(row.labelReason);
    if (column.key === 'evidenceClassLabel') return row.evidenceClassLabel || '-';
    return null;
}

export default function GeneLevelScatterTable({
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
        posterior: tableTone(theme, 'warning'),
        regulation: tableTone(theme, 'primary'),
        evidence: tableTone(theme, 'accent'),
    };

    if (!rows.length) return null;

    const shouldPaginate = sortedRows.length > 50;
    const visibleRows = shouldPaginate ? pagedRows : sortedRows;

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
            <Box sx={sectionPanelHeaderSx(theme, { borderBottom: tableOpen ? `1px solid ${theme.custom.border.soft}` : 'none' })}>
                <Button
                    onClick={() => setTableOpen((prev) => !prev)}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: theme.palette.text.primary, fontWeight: 600, fontSize: '0.8rem', px: 0.3 }}
                >
                    Gene evidence table
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
                <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', width: '100%', minWidth: 1210 })}>
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
                                            sx={groupedTableHeaderCellSx(theme, tone)}
                                        >
                                            {group.label}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                            <TableRow>
                                {COLUMN_SPECS.map((column) => (
                                    <TableCell key={column.key} sx={headerCellSx(theme, column.align, TONES[column.tone])}>
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
                            {visibleRows.map((row, index) => {
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
                                            ...highlightedRowSx(theme, isHighlighted, even, 'geneScatterRowFlashA', 'geneScatterRowFlashB', highlight.key),
                                        }}
                                    >
                                        {COLUMN_SPECS.map((column) => {
                                            const sx = {
                                                ...bodyCellSx({
                                                    align: column.align,
                                                    tone: TONES[column.tone],
                                                    fontFamily: ['ensg', 'postMean', 'signedLogP', 'beta', 'p', 'fdr', 'combinedScore'].includes(column.key) ? 'monospace' : undefined,
                                                    fontWeight: ['gene', 'evidenceClassLabel', 'combinedScore'].includes(column.key) ? 600 : 400,
                                                    whiteSpace: column.key === 'evidenceClassLabel' ? 'normal' : 'nowrap',
                                                }),
                                            };

                                            if (column.key === 'postMean') {
                                                sx.color = row.postMean >= 0 ? '#9a3412' : '#245089';
                                                sx.bgcolor = TONES.posterior.cellStrong;
                                            }
                                            if (['signedLogP', 'beta', 'p', 'fdr'].includes(column.key)) {
                                                sx.bgcolor = TONES.regulation.cellStrong;
                                            }
                                            if (column.key === 'signedLogP' || column.key === 'beta') {
                                                sx.color = row.beta >= 0 ? '#9a3412' : '#245089';
                                            }
                                            if (['evidenceClassLabel', 'combinedScore', 'labelReason'].includes(column.key)) {
                                                sx.bgcolor = TONES.evidence.cellStrong;
                                            }
                                            if (isHighlighted) {
                                                sx.fontWeight = ['gene', 'ensg', 'signedLogP', 'evidenceClassLabel'].includes(column.key) ? 700 : Math.max(500, sx.fontWeight || 400);
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
