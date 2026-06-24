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
import {
    groupedTableColumnHeaderCellSx,
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
    { key: 'program', label: 'Program', align: 'left', tone: 'program', width: 118 },
    { key: 'color', label: 'Class', align: 'left', tone: 'info', width: 126 },
    { key: 'progScore', label: 'Score', align: 'right', tone: 'program', width: 92 },
    { key: 'rankProg', label: 'Rank', align: 'center', tone: 'program', width: 70 },
    { key: 'progP', label: 'P-value', align: 'right', tone: 'program', width: 92 },
    { key: 'progGamma', label: 'Mean gamma', align: 'right', tone: 'program', width: 104 },
    { key: 'regScore', label: 'Score', align: 'right', tone: 'regulator', width: 92 },
    { key: 'rankReg', label: 'Rank', align: 'center', tone: 'regulator', width: 70 },
    { key: 'regP', label: 'P-value', align: 'right', tone: 'regulator', width: 92 },
    { key: 'regBeta', label: 'Reg beta', align: 'right', tone: 'regulator', width: 92 },
];

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

const sortLabelSx = {
    fontSize: '0.69rem',
    m: 0,
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.82rem',
        margin: 0,
    },
};

function renderCell(column, row, helpers) {
    const {
        COLORS,
        LEGEND_LABELS,
        TABLE_TONES,
        tdSx,
        navigate,
    } = helpers;

    const isTopProg = Number.isFinite(row.rankProg) && row.rankProg <= 3;
    const isTopReg = Number.isFinite(row.rankReg) && row.rankReg <= 3;

    switch (column.key) {
    case 'program':
        return (
            <TableCell
                key={column.key}
                sx={{
                    ...tdSx('left', 'monospace', 500),
                    cursor: 'pointer',
                    color: '#1976D2',
                    '&:hover': { color: '#0D47A1', textDecoration: 'underline' },
                }}
                onClick={() => {
                    const num = row.program.match(/\d+/);
                    if (num) navigate(`/programs/${num[0]}`);
                }}
                title="Go to gene regulation view"
            >
                {row.program}
            </TableCell>
        );
    case 'color':
        return (
            <TableCell key={column.key} sx={tdSx('left')}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: COLORS[row.color], flexShrink: 0 }} />
                    <Box component="span" sx={{ color: row.color === 'other' ? '#667085' : COLORS[row.color], fontWeight: row.color === 'other' ? 400 : 600 }}>
                        {LEGEND_LABELS[row.color]}
                    </Box>
                </Box>
            </TableCell>
        );
    case 'progScore':
        return <TableCell key={column.key} sx={tdSx('right', 'monospace', 400, TABLE_TONES.program.cellStrong)}>{row.progScore?.toFixed(3) ?? '—'}</TableCell>;
    case 'rankProg':
        return <TableCell key={column.key} sx={{ ...tdSx('center', undefined, isTopProg ? 700 : 400, TABLE_TONES.program.rankCell), color: isTopProg ? TABLE_TONES.program.headerColor : '#888' }}>{row.rankProg ?? '—'}</TableCell>;
    case 'progP':
        return <TableCell key={column.key} sx={tdSx('right', 'monospace', 400, TABLE_TONES.program.cellSoft)}>{row.progP != null ? row.progP.toExponential(2) : '—'}</TableCell>;
    case 'progGamma':
        return <TableCell key={column.key} sx={tdSx('right', 'monospace', 400, TABLE_TONES.program.cellStrong)}>{row.progGamma?.toFixed(4) ?? '—'}</TableCell>;
    case 'regScore':
        return <TableCell key={column.key} sx={tdSx('right', 'monospace', 400, TABLE_TONES.regulator.cellStrong)}>{row.regScore?.toFixed(3) ?? '—'}</TableCell>;
    case 'rankReg':
        return <TableCell key={column.key} sx={{ ...tdSx('center', undefined, isTopReg ? 700 : 400, TABLE_TONES.regulator.rankCell), color: isTopReg ? TABLE_TONES.regulator.headerColor : '#888' }}>{row.rankReg ?? '—'}</TableCell>;
    case 'regP':
        return <TableCell key={column.key} sx={tdSx('right', 'monospace', 400, TABLE_TONES.regulator.cellSoft)}>{row.regP != null ? row.regP.toExponential(2) : '—'}</TableCell>;
    case 'regBeta':
        return <TableCell key={column.key} sx={tdSx('right', 'monospace', 400, TABLE_TONES.regulator.cellStrong)}>{row.regBeta?.toFixed(4) ?? '—'}</TableCell>;
    default:
        return null;
    }
}

export default function ProgramScatterTable({
    rows,
    tableOpen,
    setTableOpen,
    setHighlight,
    downloadCSV,
    sortBy,
    sortDir,
    handleSort,
    sortedRows,
    highlight,
    tableRowRefs,
    tableSectionRef,
    COLORS,
    LEGEND_LABELS,
    TABLE_TONES,
    thSx,
    tdSx,
    navigate,
}) {
    const theme = useTheme();
    const infoTone = tableTone(theme, 'primary');
    const [tablePage, setTablePage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);
    const shouldPaginate = sortedRows.length > 50;
    const visibleRows = shouldPaginate
        ? sortedRows.slice(tablePage * rowsPerPage, (tablePage * rowsPerPage) + rowsPerPage)
        : sortedRows;

    React.useEffect(() => {
        const maxPage = shouldPaginate ? Math.max(0, Math.ceil(sortedRows.length / rowsPerPage) - 1) : 0;
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [rowsPerPage, shouldPaginate, sortedRows.length, tablePage]);

    React.useEffect(() => {
        setTablePage(0);
    }, [sortBy, sortDir]);

    React.useEffect(() => {
        if (!shouldPaginate || !highlight.program) return;
        const rowIndex = sortedRows.findIndex((row) => row.program === highlight.program);
        if (rowIndex < 0) return;
        const nextPage = Math.floor(rowIndex / rowsPerPage);
        if (nextPage !== tablePage) setTablePage(nextPage);
    }, [highlight.program, rowsPerPage, shouldPaginate, sortedRows, tablePage]);

    if (!rows.length) return null;

    return (
        <Paper ref={tableSectionRef} variant="outlined" sx={plotFrameSx(theme, { mt: 2, borderRadius: 2, position: 'relative', zIndex: 2 })}>
            <Box sx={sectionPanelHeaderSx(theme, { px: 2, py: 1.2, borderBottom: tableOpen ? `1px solid ${theme.custom.border.soft}` : 'none' })}>
                <Button
                    onClick={() => { setTableOpen((v) => !v); setHighlight({ program: null, key: 0 }); }}
                    endIcon={tableOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none', color: theme.palette.text.primary, fontWeight: 500, fontSize: '0.82rem' }}
                >
                    Data Table <Chip label={rows.length} size="small" sx={summaryChipSx(theme, { ml: 1, height: 20, fontSize: '0.7rem', ...metricChipTone(theme, 'neutral') })} />
                </Button>
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
            <Collapse in={tableOpen}>
                <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 980 })}>
                        <colgroup>
                            {COLUMN_SPECS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {COLUMN_SPECS.map((column) => {
                                    const tone = column.tone === 'info' ? infoTone : TABLE_TONES[column.tone];
                                    return (
                                        <TableCell
                                            key={column.key}
                                            sx={{
                                                ...thSx(column.align),
                                                ...groupedTableColumnHeaderCellSx(theme, tone, column.align, { top: 0 }),
                                            }}
                                        >
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
                                    );
                                })}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibleRows.map((row, idx) => {
                                const isHL = highlight.program === row.program;
                                const absoluteIndex = shouldPaginate ? (tablePage * rowsPerPage) + idx : idx;
                                const even = absoluteIndex % 2 === 0;
                                return (
                                    <TableRow
                                        key={row.program}
                                        ref={(el) => { if (el) tableRowRefs.current[row.program] = el; }}
                                        sx={{
                                            ...tableRowRevealSx(theme, idx),
                                            ...highlightedRowSx(theme, isHL, even, 'programRowFlashA', 'programRowFlashB', highlight.key),
                                        }}
                                    >
                                        {COLUMN_SPECS.map((column) => renderCell(column, row, {
                                            COLORS,
                                            LEGEND_LABELS,
                                            TABLE_TONES,
                                            tdSx,
                                            navigate,
                                        }))}
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
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                            setRowsPerPage(Number(event.target.value) || 25);
                            setTablePage(0);
                        }}
                        rowsPerPageOptions={[25, 50, 100, 200]}
                    />
                )}
            </Collapse>
        </Paper>
    );
}
