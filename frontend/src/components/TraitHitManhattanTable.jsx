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
import { Download, ExpandLess, ExpandMore } from '@mui/icons-material';

const COLUMN_SPECS = [
    { key: 'snp', label: 'SNP', align: 'left', width: 114, tone: 'locus' },
    { key: 'normalizedChr', label: 'CHR', align: 'center', width: 52, tone: 'locus' },
    { key: 'bp', label: 'BP', align: 'right', width: 94, tone: 'locus' },
    { key: 'p', label: 'P-value', align: 'right', width: 94, tone: 'locus' },
    { key: 'logp', label: '-log10(P)', align: 'right', width: 82, tone: 'locus' },
    { key: 'nearestGene', label: 'Gene', align: 'left', width: 112, tone: 'annotation' },
    { key: 'distanceToGene', label: 'distance_to_gene', align: 'right', width: 104, tone: 'annotation' },
    { key: 'primaryProgram', label: 'Program', align: 'left', width: 126, tone: 'program' },
    { key: 'primaryGeneset', label: 'Regulator', align: 'left', width: 144, tone: 'program' },
];

const GROUPS = [
    { label: 'Locus', span: 5, tone: 'locus' },
    { label: 'Annotation', span: 2, tone: 'annotation' },
    { label: 'Program', span: 1, tone: 'program' },
    { label: 'Regulator', span: 1, tone: 'program' },
];

const TONES = {
    neutral: {
        headerBg: '#f8fafc',
        headerBorder: '#d9e2ec',
        headerColor: '#475569',
        cellSoft: '#fbfcfd',
        cellStrong: '#f5f7fa',
    },
    locus: {
        headerBg: '#edf3fb',
        headerBorder: '#cad9ec',
        headerColor: '#245089',
        cellSoft: '#f8fbff',
        cellStrong: '#f1f6fd',
    },
    annotation: {
        headerBg: '#eef6f1',
        headerBorder: '#cbdccc',
        headerColor: '#2f6a49',
        cellSoft: '#f8fcf8',
        cellStrong: '#f1f8f2',
    },
    program: {
        headerBg: '#f4f0fb',
        headerBorder: '#d9cfee',
        headerColor: '#5d3f8c',
        cellSoft: '#faf8fe',
        cellStrong: '#f4effc',
    },
};

function headerCellSx(align, tone) {
    const palette = TONES[tone];
    return {
        px: 1,
        py: 0.72,
        textAlign: align,
        whiteSpace: 'nowrap',
        bgcolor: palette.headerBg,
        borderBottom: `2px solid ${palette.headerBorder}`,
        color: palette.headerColor,
        fontWeight: 600,
        fontSize: '0.67rem',
    };
}

function bodyCellSx({ align, tone, fontFamily, fontWeight = 400, whiteSpace = 'nowrap' }) {
    const palette = TONES[tone];
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

function renderCellContent({ column, row, programColorMap, formatDistance, formatP, getProgramRoute, navigate }) {
    if (column.key === 'snp') return row.snp || '—';
    if (column.key === 'normalizedChr') return row.normalizedChr;
    if (column.key === 'bp') return row.bp?.toLocaleString() || '—';
    if (column.key === 'p') return formatP(row.p);
    if (column.key === 'logp') return row.logp.toFixed(2);
    if (column.key === 'nearestGene') return row.nearestGene || '—';
    if (column.key === 'distanceToGene') return formatDistance(row.distanceToGene);
    if (column.key === 'primaryGeneset') return row.primaryGeneset || '—';

    if (column.key === 'primaryProgram') {
        const route = getProgramRoute(row.primaryProgram);
        const pointColor = row.primaryProgram ? (programColorMap.get(row.primaryProgram) || '#2563eb') : '#94a3b8';
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
                <Box
                    sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: pointColor,
                        flexShrink: 0,
                        boxShadow: '0 0 0 1px rgba(15,23,42,0.08)',
                    }}
                />
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
                        color: route ? pointColor : '#64748b',
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
                    {row.primaryProgram || '—'}
                </Box>
            </Box>
        );
    }

    return null;
}

export default function TraitHitManhattanTable({
    processedRows,
    sortedRows,
    pagedRows,
    highlight,
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
    tableRowRefs,
    navigate,
    getProgramRoute,
    programColorMap,
    formatDistance,
    formatP,
    gwasHitLogp,
}) {
    if (!processedRows.length) return null;

    return (
        <Paper
            variant="outlined"
            sx={{
                mt: 2,
                border: '1px solid #e8edf3',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: '#ffffff',
                boxShadow: '0 10px 26px rgba(15,23,42,0.05)',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.75,
                    py: 1,
                    bgcolor: '#fafbfc',
                    borderBottom: tableOpen ? '1px solid #e9edf2' : 'none',
                    gap: 1,
                }}
            >
                <Button
                    onClick={() => setTableOpen((prev) => !prev)}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: '#334155', fontWeight: 600, fontSize: '0.8rem', px: 0.3 }}
                >
                    Data Table
                    {!tableOpen && (
                        <Chip
                            label={processedRows.length.toLocaleString()}
                            size="small"
                            sx={{ ml: 1, height: 20, fontSize: '0.68rem', bgcolor: '#e9eef5', color: '#526171' }}
                        />
                    )}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={downloadCSV}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: '#475569' }}
                >
                    CSV
                </Button>
            </Box>

            <Collapse in={tableOpen}>
                <TableContainer
                    sx={{
                        maxHeight: 520,
                        overflowX: 'auto',
                        overflowY: 'auto',
                    }}
                >
                    <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%', minWidth: 930 }}>
                        <colgroup>
                            {COLUMN_SPECS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {GROUPS.map((group) => {
                                    const palette = TONES[group.tone];
                                    return (
                                        <TableCell
                                            key={group.label}
                                            colSpan={group.span}
                                            sx={{
                                                py: 0.58,
                                                px: 1,
                                                textAlign: 'center',
                                                whiteSpace: 'nowrap',
                                                bgcolor: palette.headerBg,
                                                borderBottom: `2px solid ${palette.headerBorder}`,
                                                color: palette.headerColor,
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
                                    <TableCell key={column.key} sx={headerCellSx(column.align, column.tone)}>
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
                                            bgcolor: isHighlighted ? '#fff5bf' : (even ? '#ffffff' : '#fbfcfd'),
                                            boxShadow: isHighlighted ? 'inset 0 0 0 1px rgba(217,119,6,0.12)' : 'none',
                                            '& td': {
                                                transition: 'background-color 0.14s ease, box-shadow 0.14s ease',
                                            },
                                            '&:hover td': {
                                                bgcolor: isHighlighted ? '#ffef9f' : '#f3f6fa',
                                                boxShadow: 'inset 0 -1px 0 rgba(226,232,240,0.78)',
                                            },
                                        }}
                                    >
                                        {COLUMN_SPECS.map((column) => {
                                            const cellTone = column.tone === 'neutral'
                                                ? (even ? 'neutral' : 'neutral')
                                                : column.tone;

                                            const sx = {
                                                ...bodyCellSx({
                                                    align: column.align,
                                                    tone: cellTone,
                                                    fontFamily: ['snp', 'normalizedChr', 'bp', 'p', 'logp', 'distanceToGene', 'primaryProgram'].includes(column.key)
                                                        ? 'monospace'
                                                        : undefined,
                                                    fontWeight: ['normalizedChr', 'logp', 'nearestGene', 'primaryProgram'].includes(column.key) ? 600 : 400,
                                                    whiteSpace: ['nearestGene', 'primaryGeneset'].includes(column.key) ? 'normal' : 'nowrap',
                                                }),
                                            };

                                            if (column.key === 'normalizedChr') sx.color = '#245089';
                                            if (column.key === 'logp') sx.color = row.logp >= gwasHitLogp + 1 ? '#9a3412' : '#245089';
                                            if (column.key === 'primaryGeneset') {
                                                sx.lineHeight = 1.3;
                                                sx.color = '#5b3f86';
                                                sx.bgcolor = TONES.program.cellStrong;
                                            }
                                            if (column.key === 'nearestGene') {
                                                sx.lineHeight = 1.3;
                                                sx.bgcolor = TONES.annotation.cellStrong;
                                            }
                                            if (column.key === 'primaryProgram') {
                                                sx.bgcolor = TONES.program.cellSoft;
                                            }

                                            return (
                                                <TableCell key={column.key} sx={sx}>
                                                    {renderCellContent({
                                                        column,
                                                        row,
                                                        programColorMap,
                                                        formatDistance,
                                                        formatP,
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
