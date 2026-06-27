import React, { useEffect, useMemo, useState } from 'react';
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
    { key: 'snp', label: 'SNP', align: 'center', width: 114, tone: 'locus' },
    { key: 'normalizedChr', label: 'CHR', align: 'center', width: 52, tone: 'locus' },
    { key: 'bp', label: 'BP', align: 'center', width: 94, tone: 'locus' },
    { key: 'p', label: 'p-value', align: 'center', width: 94, tone: 'locus' },
    { key: 'logp', label: '-log10(p-value)', align: 'center', width: 82, tone: 'locus' },
    { key: 'nearestGene', label: 'Gene', align: 'center', width: 112, tone: 'annotation' },
    { key: 'distanceToGene', label: 'distance_to_gene', align: 'center', width: 104, tone: 'annotation' },
    { key: 'program', label: 'Program', align: 'center', width: 136, tone: 'program' },
    { key: 'geneset', label: 'Geneset', align: 'center', width: 172, tone: 'program' },
];

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

function buildSearchIndex(row) {
    return [
        row.snp,
        row.normalizedChr,
        row.bp,
        row.nearestGene,
        row.distanceToGene,
        row.program,
        row.geneset,
        row.primaryProgram,
        row.primaryGeneset,
        ...(Array.isArray(row.genesets) ? row.genesets : []),
    ]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .join(' ')
        .toLowerCase();
}

function renderCellContent({ column, row, programColorMap, formatDistance, formatP, getProgramRoute, navigate }) {
    if (column.key === 'snp') return row.snp || '-';
    if (column.key === 'normalizedChr') return row.normalizedChr;
    if (column.key === 'bp') return row.bp?.toLocaleString() || '-';
    if (column.key === 'p') return formatP(row.p);
    if (column.key === 'logp') return row.logp.toFixed(2);
    if (column.key === 'nearestGene') return row.nearestGene || '-';
    if (column.key === 'distanceToGene') return formatDistance(row.distanceToGene);
    if (column.key === 'geneset') return row.geneset || row.primaryGeneset || '-';

    if (column.key === 'program') {
        const programs = Array.isArray(row.programs) && row.programs.length
            ? row.programs
            : [row.primaryProgram || row.program].filter(Boolean);
        if (!programs.length) return '-';

        const pointColor = programs[0] ? (programColorMap.get(programs[0]) || '#2563eb') : '#94a3b8';

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7, minWidth: 0 }}>
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
                <Box sx={{ minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center' }}>
                    {programs.map((program, index) => {
                        const route = getProgramRoute(program);
                        return (
                            <React.Fragment key={`${program}-${index}`}>
                                {index > 0 && <Box component="span" sx={{ color: '#94a3b8' }}>; </Box>}
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
                                        color: route ? (programColorMap.get(program) || pointColor) : '#64748b',
                                        cursor: route ? 'pointer' : 'default',
                                        font: 'inherit',
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        minWidth: 0,
                                        '&:hover': route ? { textDecoration: 'underline' } : undefined,
                                    }}
                                >
                                    {program}
                                </Box>
                            </React.Fragment>
                        );
                    })}
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
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const displayedRows = useMemo(() => {
        if (!normalizedSearch) return sortedRows;
        return sortedRows.filter((row) => buildSearchIndex(row).includes(normalizedSearch));
    }, [normalizedSearch, sortedRows]);
    const shouldPaginate = processedRows.length > 50;
    const visibleRows = shouldPaginate
        ? displayedRows.slice(tablePage * tableRowsPerPage, (tablePage * tableRowsPerPage) + tableRowsPerPage)
        : displayedRows;
    const TONES = {
        neutral: tableTone(theme, 'primary'),
        locus: tableTone(theme, 'primary'),
        annotation: tableTone(theme, 'primary'),
        program: tableTone(theme, 'primary'),
    };

    useEffect(() => {
        const maxPage = Math.max(0, Math.ceil(displayedRows.length / tableRowsPerPage) - 1);
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [displayedRows.length, setTablePage, tablePage, tableRowsPerPage]);

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
                            label={processedRows.length.toLocaleString()}
                            size="small"
                            sx={summaryChipSx(theme, { ml: 1, height: 20, fontSize: '0.68rem', ...metricChipTone(theme, 'neutral') })}
                        />
                    )}
                </Button>
                <Box sx={{ flex: 1 }} />
                <Box sx={tableToolbarGroupSx(theme, { ml: 'auto', width: { xs: '100%', sm: 'auto' } })}>
                    <TableSearchField
                        value={searchQuery}
                        placeholder="SNP, gene, program"
                        label="Search"
                        onChange={(value) => {
                            setSearchQuery(value);
                            setTablePage(0);
                        }}
                        onClear={() => {
                            setSearchQuery('');
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
                <TableContainer
                    sx={stickyTableContainerSx(theme, {
                        overflowX: 'auto',
                        overflowY: 'visible',
                    })}
                >
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', width: '100%', minWidth: { xs: 930, lg: 'unset' } })}>
                        <colgroup>
                            {COLUMN_SPECS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {COLUMN_SPECS.map((column) => (
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
                                        colSpan={COLUMN_SPECS.length}
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
                                                    fontFamily: ['snp', 'normalizedChr', 'bp', 'p', 'logp', 'distanceToGene', 'program'].includes(column.key)
                                                        ? 'monospace'
                                                        : undefined,
                                                    fontWeight: ['normalizedChr', 'logp', 'nearestGene', 'program'].includes(column.key) ? 600 : 400,
                                                    whiteSpace: ['nearestGene', 'program', 'geneset'].includes(column.key) ? 'normal' : 'nowrap',
                                                }),
                                            };

                                            if (column.key === 'normalizedChr') sx.color = '#245089';
                                            if (column.key === 'logp') sx.color = row.logp >= gwasHitLogp + 1 ? '#9a3412' : '#245089';
                                            if (column.key === 'geneset') {
                                                sx.lineHeight = 1.3;
                                                sx.color = '#5b3f86';
                                                sx.bgcolor = TONES.program.cellStrong;
                                            }
                                            if (column.key === 'nearestGene') {
                                                sx.lineHeight = 1.3;
                                                sx.bgcolor = TONES.annotation.cellStrong;
                                            }
                                            if (column.key === 'program') {
                                                sx.bgcolor = TONES.program.cellSoft;
                                            }
                                            if (isHighlighted) {
                                                sx.fontWeight = ['snp', 'nearestGene', 'program', 'geneset', 'logp'].includes(column.key) ? 700 : Math.max(500, sx.fontWeight || 400);
                                            }

                                            return (
                                                <TableCell key={column.key} align={column.align} sx={sx}>
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
