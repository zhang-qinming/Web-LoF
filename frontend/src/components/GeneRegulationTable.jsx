import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import Download from '@mui/icons-material/Download';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import {
    highlightedRowSx,
    plotFrameSx,
    sectionPanelHeaderSx,
    stickyTableContainerSx,
    stickyTableSx,
    stickyTableHeaderCellSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

const COLUMNS = [
    { key: 'gene', label: 'Gene', align: 'center', width: 150, tone: 'gene' },
    { key: 'es', label: 'Effect Size (lm_es)', align: 'center', width: 160, tone: 'other' },
    { key: 'p', label: 'P-value (lm_p)', align: 'center', width: 150, tone: 'other' },
    { key: 'negLogP', label: '-log10(P)', align: 'center', width: 132, tone: 'other' },
];

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

const sortLabelSx = {
    fontSize: '0.72rem',
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.86rem',
        margin: 0,
    },
};

function formatCell(row, key) {
    if (key === 'gene') return row.gene || '-';
    if (key === 'es') return row.es?.toFixed(6) ?? '-';
    if (key === 'p') return row.p?.toExponential(3) ?? '-';
    if (key === 'negLogP') return row.negLogP?.toFixed(4) ?? '-';
    return '-';
}

function renderCellContent(row, column, theme) {
    if (column.key !== 'gene') return formatCell(row, column.key);

    const gene = row.gene || '';
    if (!gene) return '-';

    return (
        <Button
            component={RouterLink}
            to={`/genes?query=${encodeURIComponent(gene)}`}
            sx={{
                textTransform: 'none',
                px: 0,
                py: 0,
                minWidth: 0,
                minHeight: 0,
                color: theme.palette.primary.dark,
                fontWeight: 700,
                fontSize: '0.78rem',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
            }}
        >
            {gene}
        </Button>
    );
}

export default function GeneRegulationTable({
    rows,
    pagedRows,
    sortBy,
    sortDir,
    handleSort,
    highlightGene,
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    totalPages,
    shouldPaginate,
    jumpInput,
    setJumpInput,
    handleJumpToPage,
    tablePaperRef,
    tableRowRefs,
    downloadCSV,
    embedded = false,
}) {
    const theme = useTheme();
    const tones = {
        other: tableTone(theme, 'primary'),
    };

    if (!rows.length) return null;

    const body = (
        <>
            <Box
                sx={sectionPanelHeaderSx(theme, {
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    px: { xs: 1.5, md: 2 },
                    py: 1,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                })}
            >
                <Typography sx={{ color: theme.palette.text.primary, fontWeight: 700, fontSize: '0.82rem' }}>
                    Gene Data
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={downloadCSV}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: theme.palette.text.secondary }}
                >
                    CSV
                </Button>
            </Box>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: { xs: 620, lg: 'unset' } })}>
                    <colgroup>
                        {COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            {COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    align={column.align}
                                    sx={stickyTableHeaderCellSx(theme, tones.other, column.align, {
                                        fontWeight: 700,
                                        fontSize: '0.72rem',
                                        py: 0.78,
                                        px: 1.5,
                                    })}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
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
                        {pagedRows.map((row, idx) => {
                            const isHighlighted = highlightGene.gene === row.gene;
                            const even = ((page - 1) * rowsPerPage + idx) % 2 === 0;
                            return (
                                <TableRow
                                    key={row.gene}
                                    ref={(el) => { if (el) tableRowRefs.current[row.gene] = el; }}
                                    sx={{
                                        ...tableRowRevealSx(theme, idx),
                                        ...highlightedRowSx(theme, isHighlighted, even, 'geneRowFlashA', 'geneRowFlashB', highlightGene.key),
                                    }}
                                >
                                    {COLUMNS.map((column) => (
                                        <TableCell
                                            key={column.key}
                                            align={column.align}
                                            sx={{
                                                fontSize: '0.78rem',
                                                fontVariantNumeric: 'tabular-nums',
                                                fontFeatureSettings: '"tnum" 1',
                                                fontWeight: column.key === 'gene' ? 600 : 400,
                                                py: 0.58,
                                                px: 1.5,
                                                textAlign: column.align,
                                                color: column.key === 'gene' ? theme.palette.primary.dark : theme.palette.text.primary,
                                                bgcolor: tones.other.cellSoft,
                                                borderBottom: `1px solid ${theme.custom.border.soft}`,
                                            }}
                                        >
                                            {renderCellContent(row, column, theme)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: { xs: 1.5, md: 2 },
                    py: 1,
                    bgcolor: theme.custom.surface.raised,
                    borderTop: `1px solid ${theme.custom.border.soft}`,
                    flexWrap: 'wrap',
                }}
            >
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem', minWidth: 136 }}>
                    {!shouldPaginate
                        ? `Showing all ${rows.length.toLocaleString()}`
                        : rows.length
                        ? `${(((page - 1) * rowsPerPage) + 1).toLocaleString()}-${Math.min(page * rowsPerPage, rows.length).toLocaleString()} of ${rows.length.toLocaleString()}`
                        : 'No rows'}
                </Typography>
                {shouldPaginate && (
                    <FormControl size="small" sx={{ minWidth: 92 }}>
                        <Select
                            value={rowsPerPage}
                            onChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(1); }}
                            sx={{ fontSize: '0.75rem', height: 32 }}
                        >
                            {[10, 25, 50, 100].map((count) => (
                                <MenuItem key={count} value={count} sx={{ fontSize: '0.75rem' }}>{count} / page</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}
                <Box sx={{ flex: 1 }} />
                {shouldPaginate && (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                startIcon={<KeyboardArrowLeft />}
                                disabled={page <= 1}
                                onClick={() => setPage(Math.max(1, page - 1))}
                                sx={{ fontSize: '0.72rem', py: 0.25, px: 1, minWidth: 86 }}
                            >
                                Prev
                            </Button>
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.72rem', minWidth: 72, textAlign: 'center' }}>
                                {page} / {totalPages}
                            </Typography>
                            <Button
                                size="small"
                                variant="outlined"
                                endIcon={<KeyboardArrowRight />}
                                disabled={page >= totalPages}
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                sx={{ fontSize: '0.72rem', py: 0.25, px: 1, minWidth: 86 }}
                            >
                                Next
                            </Button>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <TextField
                                size="small"
                                value={jumpInput}
                                placeholder="Page"
                                onChange={(event) => setJumpInput(event.target.value)}
                                onKeyDown={(event) => { if (event.key === 'Enter') handleJumpToPage(); }}
                                sx={{ width: 64, '& .MuiOutlinedInput-input': { fontSize: '0.75rem', py: 0.55, textAlign: 'center' } }}
                            />
                            <Button size="small" variant="outlined" onClick={handleJumpToPage} sx={{ fontSize: '0.72rem', py: 0.2, px: 1.2, minWidth: 36 }}>
                                Go
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </>
    );

    if (embedded) {
        return (
            <Box ref={tablePaperRef} sx={{ borderTop: `1px solid ${theme.custom.border.soft}` }}>
                {body}
            </Box>
        );
    }

    return (
        <Paper ref={tablePaperRef} variant="outlined" sx={plotFrameSx(theme, { overflow: 'hidden', position: 'relative', zIndex: 2 })}>
            {body}
        </Paper>
    );
}
