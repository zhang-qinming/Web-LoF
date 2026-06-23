import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
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
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import {
    highlightedRowSx,
    metricChipTone,
    plotFrameSx,
    sectionPanelHeaderSx,
    stickyTableContainerSx,
    stickyTableSx,
    stickyTableHeaderCellSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

const COLUMNS = [
    { key: 'gene', label: 'Gene', align: 'center', width: 150 },
    { key: 'es', label: 'Effect Size (lm_es)', align: 'right', width: 160 },
    { key: 'p', label: 'P-value (lm_p)', align: 'right', width: 150 },
    { key: 'negLogP', label: '-log10(P)', align: 'right', width: 132 },
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
    tableOpen,
    setTableOpen,
    sortBy,
    sortDir,
    handleSort,
    highlightGene,
    setHighlightGene,
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
    stats,
    annotation,
    embedded = false,
}) {
    const theme = useTheme();
    const tone = tableTone(theme, 'primary');

    if (!rows.length) return null;

    const body = (
        <>
            <Box
                sx={sectionPanelHeaderSx(theme, {
                    borderBottom: tableOpen ? `1px solid ${theme.custom.border.soft}` : 'none',
                    px: { xs: 1.5, md: 2 },
                    py: 1,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                })}
            >
                <Button
                    onClick={() => { setTableOpen((v) => !v); setHighlightGene({ gene: null, key: 0 }); }}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: theme.palette.text.primary, fontWeight: 600, fontSize: '0.82rem', px: 0.3 }}
                >
                    Gene Data
                </Button>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
                    <Chip
                        label={`${(stats?.total ?? rows.length).toLocaleString()} genes`}
                        size="small"
                        sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                    />
                    <Chip
                        label={`${(stats?.sig ?? 0).toLocaleString()} significant`}
                        size="small"
                        sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))}
                    />
                    {annotation && (
                        <Chip
                            label={annotation}
                            size="small"
                            sx={summaryChipSx(theme, {
                                ...metricChipTone(theme, 'primary'),
                                maxWidth: { xs: '100%', sm: 360 },
                                '& .MuiChip-label': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                },
                            })}
                        />
                    )}
                </Box>
                <Box sx={{ flex: 1 }} />
                {tableOpen && (
                    <Button
                        size="small"
                        startIcon={<Download />}
                        onClick={downloadCSV}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', color: theme.palette.text.secondary }}
                    >
                        CSV
                    </Button>
                )}
            </Box>
            <Collapse in={tableOpen}>
                <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 620 })}>
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
                                        sx={stickyTableHeaderCellSx(theme, tone, column.align, {
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
                                                sx={{
                                                    fontSize: '0.78rem',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    fontFeatureSettings: '"tnum" 1',
                                                    fontWeight: column.key === 'gene' ? 600 : 400,
                                                    py: 0.58,
                                                    px: 1.5,
                                                    textAlign: column.align,
                                                    color: column.key === 'gene' ? theme.palette.primary.dark : theme.palette.text.primary,
                                                    bgcolor: column.key === 'gene' ? tone.cellStrong : tone.cellSoft,
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
                                {[25, 50, 100, 200].map((count) => (
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
            </Collapse>
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
