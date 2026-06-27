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
import { formatScientificNumber } from '../utils/numbers';
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

function getColumnSpecs({ effectLabel = 'Beta', includePosteriorColumns = false } = {}) {
    const effectColumns = [
        { key: 'effect', label: effectLabel, align: 'center', tone: 'effect', width: 98 },
    ];

    if (includePosteriorColumns) {
        effectColumns.push(
            { key: 'posteriorSd', label: 'Posterior SD', align: 'center', tone: 'effect', width: 92 },
            { key: 'lower95', label: 'Lower 95', align: 'center', tone: 'effect', width: 92 },
            { key: 'upper95', label: 'Upper 95', align: 'center', tone: 'effect', width: 92 },
        );
    }

    effectColumns.push(
        { key: 'logp', label: '-log10(p-value)', align: 'center', tone: 'effect', width: 94 },
        { key: 'p', label: 'p-value', align: 'center', tone: 'effect', width: 98 },
        { key: 'fdr', label: 'FDR', align: 'center', tone: 'effect', width: 92 },
    );

    return [
        { key: 'gene', label: 'Gene', align: 'center', tone: 'info', width: 122 },
        { key: 'ensg', label: 'ENSG', align: 'center', tone: 'info', width: 146 },
        ...effectColumns,
        { key: 'primaryProgram', label: 'Program', align: 'center', tone: 'annotation', width: 138 },
        { key: 'primaryGeneset', label: 'Geneset', align: 'center', tone: 'annotation', width: 188 },
    ];
}

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

const sortLabelSx = {
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

function headerCellSx(theme, align, tone) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, { top: 0 });
}

function bodyCellSx({ align, tone, fontFamily, fontWeight = 400, whiteSpace = 'normal' }) {
    const palette = tone;
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
        bgcolor: palette.cellSoft,
        borderBottom: '1px solid rgba(226,232,240,0.72)',
        verticalAlign: 'middle',
    };
}

function renderCellContent({ column, row, getProgramRoute, navigate }) {
    if (column.key === 'gene') return row.gene || '-';
    if (column.key === 'ensg') return row.ensg || '-';
    if (column.key === 'effect') return Number.isFinite(row.effect) ? row.effect.toFixed(4) : '-';
    if (column.key === 'posteriorSd') return Number.isFinite(row.posteriorSd) ? row.posteriorSd.toFixed(4) : '-';
    if (column.key === 'lower95') return Number.isFinite(row.lower95) ? row.lower95.toFixed(4) : '-';
    if (column.key === 'upper95') return Number.isFinite(row.upper95) ? row.upper95.toFixed(4) : '-';
    if (column.key === 'logp') return Number.isFinite(row.logp) ? row.logp.toFixed(2) : '-';
    if (column.key === 'p') return formatScientificNumber(row.p, 2, '-');
    if (column.key === 'fdr') return formatScientificNumber(row.fdr, 2, '-');
    if (column.key === 'primaryGeneset') return row.primaryGeneset || '-';

    if (column.key === 'primaryProgram') {
        const route = getProgramRoute(row.primaryProgram);
        if (!row.primaryProgram) return '-';
        if (!route) return row.primaryProgram;

        return (
            <Box
                component="button"
                type="button"
                onClick={() => {
                    navigate(route);
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
                    textAlign: 'center',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': { textDecoration: 'underline' },
                }}
            >
                {row.primaryProgram}
            </Box>
        );
    }

    return null;
}

function buildVolcanoSearchIndex(row) {
    return [
        row.gene,
        row.ensg,
        row.primaryProgram,
        row.primaryGeneset,
        row.effect,
        row.p,
        row.fdr,
    ]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .join(' ')
        .toLowerCase();
}

export default function BurdenVolcanoTable({
    tableSectionRef,
    rows,
    sortedRows,
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
    const [tableSearch, setTableSearch] = React.useState('');
    const TONES = {
        info: tableTone(theme, 'primary'),
        effect: tableTone(theme, 'primary'),
        annotation: tableTone(theme, 'primary'),
    };
    const tableSearchQuery = tableSearch.trim().toLowerCase();
    const displayedRows = React.useMemo(() => {
        if (!tableSearchQuery) return sortedRows;
        return sortedRows.filter((row) => buildVolcanoSearchIndex(row).includes(tableSearchQuery));
    }, [sortedRows, tableSearchQuery]);
    const shouldPaginate = rows.length > 50;
    const visibleRows = shouldPaginate
        ? displayedRows.slice(tablePage * tableRowsPerPage, (tablePage * tableRowsPerPage) + tableRowsPerPage)
        : displayedRows;
    const columnSpecs = getColumnSpecs({ effectLabel, includePosteriorColumns });
    const tableMinWidth = includePosteriorColumns ? 1320 : 1040;
    const responsiveMinWidth = { xs: tableMinWidth, lg: 'unset' };

    React.useEffect(() => {
        const maxPage = Math.max(0, Math.ceil(displayedRows.length / tableRowsPerPage) - 1);
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [displayedRows.length, setTablePage, tablePage, tableRowsPerPage]);

    if (!rows.length) return null;

    return (
        <Paper
            ref={tableSectionRef}
            variant="outlined"
            sx={plotFrameSx(theme, {
                mt: 2,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
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
                    Data table
                    {!tableOpen && (
                        <Chip
                            label={rows.length.toLocaleString()}
                            size="small"
                            sx={summaryChipSx(theme, { ml: 1, height: 20, fontSize: '0.68rem', ...metricChipTone(theme, 'neutral') })}
                        />
                    )}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Box sx={tableToolbarGroupSx(theme, { ml: 'auto', width: { xs: '100%', sm: 'auto' } })}>
                    <TableSearchField
                        label="Search"
                        value={tableSearch}
                        placeholder="Gene, ENSG, program"
                        onChange={(value) => {
                            setTableSearch(value);
                            setTablePage(0);
                        }}
                        onClear={() => {
                            setTableSearch('');
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

            <Collapse in={tableOpen} unmountOnExit>
                <TableContainer
                    sx={stickyTableContainerSx(theme, {
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        overflowX: 'auto',
                        overflowY: 'visible',
                    })}
                >
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', width: '100%', minWidth: responsiveMinWidth })}>
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
                                            sx={{ ...sortLabelSx, justifyContent: justifyForAlign(column.align), width: '100%' }}
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
                                                ...highlightedRowSx(theme, isHighlighted, even, 'volcanoRowFlashA', 'volcanoRowFlashB', highlight.key),
                                            }}
                                        >
                                            {columnSpecs.map((column) => {
                                                const sx = {
                                                    ...bodyCellSx({
                                                        align: column.align,
                                                        tone: TONES[column.tone],
                                                        fontFamily: ['ensg', 'effect', 'posteriorSd', 'lower95', 'upper95', 'logp', 'p', 'fdr', 'primaryProgram'].includes(column.key) ? 'monospace' : undefined,
                                                        fontWeight: ['gene', 'logp', 'primaryProgram'].includes(column.key) ? 600 : 400,
                                                        whiteSpace: ['gene', 'primaryGeneset'].includes(column.key) ? 'normal' : 'nowrap',
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
                                                    <TableCell key={column.key} align={column.align} sx={sx}>
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
                {shouldPaginate && (
                    <TablePagination
                        component="div"
                        count={displayedRows.length}
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
