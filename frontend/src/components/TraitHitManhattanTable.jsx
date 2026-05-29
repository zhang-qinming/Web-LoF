import React, { useCallback, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Collapse,
    InputAdornment,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    TextField,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Download, ExpandLess, ExpandMore, Search } from '@mui/icons-material';
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
    { label: 'Mapping', span: 2, tone: 'program' },
];

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

function buildSearchIndex(row) {
    return [
        row.snp,
        row.normalizedChr,
        row.bp,
        row.nearestGene,
        row.distanceToGene,
        row.primaryProgram,
        row.primaryGeneset,
        ...(Array.isArray(row.genesets) ? row.genesets : []),
    ]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .join(' ')
        .toLowerCase();
}

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
    tableSectionRef,
    processedRows,
    sortedRows,
    pagedRows,
    highlight,
    setHighlight,
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
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchError, setSearchError] = useState('');
    const TONES = {
        neutral: tableTone(theme, 'neutral'),
        locus: tableTone(theme, 'primary'),
        annotation: tableTone(theme, 'success'),
        program: tableTone(theme, 'accent'),
    };

    const handleLocateRow = useCallback(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        if (!normalizedQuery) {
            setSearchError('');
            return;
        }

        const rowIndex = sortedRows.findIndex((row) => buildSearchIndex(row).includes(normalizedQuery));
        if (rowIndex < 0) {
            setSearchError('No matching row in the current table.');
            return;
        }

        const row = sortedRows[rowIndex];
        setSearchError('');
        setTableOpen(true);
        setTablePage(Math.floor(rowIndex / tableRowsPerPage));
        setHighlight((prev) => ({ rowKey: row.rowKey, key: prev.key + 1 }));
    }, [searchQuery, setHighlight, setTableOpen, setTablePage, sortedRows, tableRowsPerPage]);

    if (!processedRows.length) return null;

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
            })}>
                <Button
                    onClick={() => setTableOpen((prev) => !prev)}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: theme.palette.text.primary, fontWeight: 600, fontSize: '0.8rem', px: 0.3 }}
                >
                    Data Table
                    {!tableOpen && (
                        <Chip
                            label={processedRows.length.toLocaleString()}
                            size="small"
                            sx={summaryChipSx(theme, { ml: 1, height: 20, fontSize: '0.68rem', ...metricChipTone(theme, 'neutral') })}
                        />
                    )}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', maxWidth: '100%' }}>
                    <TextField
                        size="small"
                        value={searchQuery}
                        placeholder="Search SNP, Gene, Program..."
                        error={Boolean(searchError)}
                        helperText={searchError || undefined}
                        onChange={(event) => {
                            setSearchQuery(event.target.value);
                            if (searchError) setSearchError('');
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleLocateRow();
                            }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                                </InputAdornment>
                            ),
                        }}
                        sx={{
                            width: { xs: '100%', sm: 250, md: 300 },
                            '& .MuiOutlinedInput-input': {
                                fontSize: '0.75rem',
                                py: 0.72,
                            },
                            '& .MuiFormHelperText-root': {
                                mt: 0.45,
                                fontSize: '0.68rem',
                                lineHeight: 1.25,
                            },
                        }}
                    />
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Search />}
                        onClick={handleLocateRow}
                        disabled={!searchQuery.trim()}
                        sx={{ textTransform: 'none', fontSize: '0.74rem', minWidth: 88 }}
                    >
                        Locate
                    </Button>
                    <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={downloadCSV}
                        sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                    >
                        CSV
                    </Button>
                </Box>
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
                                            sx={groupedTableHeaderCellSx(theme, palette)}
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
                                            ...highlightedRowSx(theme, isHighlighted, even, 'traitRowFlashA', 'traitRowFlashB', highlight.key),
                                        }}
                                    >
                                        {COLUMN_SPECS.map((column) => {
                                            const cellTone = column.tone === 'neutral'
                                                ? TONES.neutral
                                                : TONES[column.tone];

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
                                            if (isHighlighted) {
                                                sx.fontWeight = ['snp', 'nearestGene', 'primaryProgram', 'primaryGeneset', 'logp'].includes(column.key) ? 700 : Math.max(500, sx.fontWeight || 400);
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
