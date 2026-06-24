import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { alpha, useTheme } from '@mui/material/styles';
import { stickyTableContainerSx, stickyTableHeaderCellSx, stickyTableSx, tableRowRevealSx, tableTone } from '../themeUtils';

export default function TraitProgramGraphSummary({
    title,
    modules,
    side,
    selectedProgram,
    selectedGeneKey,
    onSelectProgram,
    onSelectGene,
    onClearSelection,
    onToggleExpanded,
    sideMeta,
    sideMetaMap,
    programColor,
    programSelectionLabel,
    effectColors,
    effectSignFromGene,
    edgeColorFromScore,
    formatNumber,
    onOpenProgram,
    onOpenGene,
}) {
    const theme = useTheme();
    const [filter, setFilter] = React.useState('all');
    const [tablePage, setTablePage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);
    const headerTone = tableTone(theme, 'primary');
    const programCount = modules.filter((module) => (module.side || side) === 'program').length;
    const regulatorCount = modules.filter((module) => (module.side || side) === 'regulator').length;
    const filteredModules = React.useMemo(() => modules.filter((module) => {
        const rowSide = module.side || side;
        if (filter === 'program') return rowSide === 'program';
        if (filter === 'regulator') return rowSide === 'regulator';
        if (filter === 'selected') return selectedProgram && module.program === selectedProgram;
        if (filter === 'gene') return selectedGeneKey && module.filteredGeneKeys?.includes(selectedGeneKey);
        return true;
    }), [filter, modules, selectedGeneKey, selectedProgram, side]);
    const shouldPaginate = filteredModules.length > 50;
    const visibleModules = shouldPaginate
        ? filteredModules.slice(tablePage * rowsPerPage, (tablePage * rowsPerPage) + rowsPerPage)
        : filteredModules;

    React.useEffect(() => {
        if (filter === 'gene' && !selectedGeneKey) setFilter('all');
        if (filter === 'selected' && !selectedProgram) setFilter('all');
    }, [filter, selectedGeneKey, selectedProgram]);

    React.useEffect(() => {
        const maxPage = shouldPaginate ? Math.max(0, Math.ceil(filteredModules.length / rowsPerPage) - 1) : 0;
        if (tablePage > maxPage) setTablePage(maxPage);
    }, [filteredModules.length, rowsPerPage, shouldPaginate, tablePage]);

    React.useEffect(() => {
        setTablePage(0);
    }, [filter, modules.length]);

    const filterOptions = [
        { key: 'all', label: 'All', disabled: false },
        { key: 'program', label: 'Program side', disabled: programCount === 0 },
        { key: 'regulator', label: 'Regulator side', disabled: regulatorCount === 0 },
        { key: 'selected', label: 'Selected only', disabled: !selectedProgram },
        { key: 'gene', label: 'Gene focused', disabled: !selectedGeneKey },
    ];

    return (
        <Paper variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'rgba(15,23,42,0.10)', overflow: 'hidden' }}>
            <Box
                sx={{
                    px: 1.75,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    bgcolor: 'rgba(15,23,42,0.025)',
                    borderBottom: '1px solid rgba(15,23,42,0.06)',
                    flexWrap: 'wrap',
                }}
            >
                <Typography sx={{ fontWeight: 720, color: '#0f172a', fontSize: 13.5 }}>
                    {title}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip label={`${modules.length} modules`} size="small" sx={{ height: 22, fontWeight: 650 }} />
                    {programCount > 0 && (
                        <Chip
                            label={`program ${programCount}`}
                            size="small"
                            sx={{
                                height: 22,
                                fontWeight: 680,
                                color: (sideMetaMap?.program || sideMeta).accent,
                                bgcolor: (sideMetaMap?.program || sideMeta).softBg,
                            }}
                        />
                    )}
                    {regulatorCount > 0 && (
                        <Chip
                            label={`regulator ${regulatorCount}`}
                            size="small"
                            sx={{
                                height: 22,
                                fontWeight: 680,
                                color: (sideMetaMap?.regulator || sideMeta).accent,
                                bgcolor: (sideMetaMap?.regulator || sideMeta).softBg,
                            }}
                        />
                    )}
                </Stack>
                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ width: '100%' }}>
                    {filterOptions.map((option) => (
                        <Button
                            key={option.key}
                            size="small"
                            variant={filter === option.key ? 'contained' : 'outlined'}
                            disabled={option.disabled}
                            onClick={() => setFilter(option.key)}
                            sx={{ minHeight: 26, py: 0.15, px: 1, fontSize: 11.5, textTransform: 'none' }}
                        >
                            {option.label}
                        </Button>
                    ))}
                    {(selectedProgram || selectedGeneKey) && (
                        <Button
                            size="small"
                            variant="text"
                            onClick={onClearSelection}
                            sx={{ minHeight: 26, py: 0.15, px: 1, fontSize: 11.5, textTransform: 'none' }}
                        >
                            Clear focus
                        </Button>
                    )}
                </Stack>
            </Box>

            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table size="small" stickyHeader sx={stickyTableSx(theme)}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 650, width: 112 })}>Side</TableCell>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 650, width: 132 })}>Program</TableCell>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 650, width: 132 })}>Selected by</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 650 })}>Evidence score</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 650 })}>Genes</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 650 })}>+ / -</TableCell>
                            <TableCell sx={stickyTableHeaderCellSx(theme, headerTone, 'left', { fontWeight: 650, minWidth: 260 })}>Visible genes</TableCell>
                            <TableCell align="right" sx={stickyTableHeaderCellSx(theme, headerTone, 'right', { fontWeight: 650 })}>Gene display</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleModules.map((module, index) => {
                            const rowSide = module.side || side;
                            const rowMeta = sideMetaMap?.[rowSide] || sideMeta;
                            const scoreField = rowSide === 'program' ? 'programScore' : 'regulatorScore';
                            const totalField = rowSide === 'program' ? 'loadingTotalCount' : 'regulatorTotalCount';
                            const selected = selectedProgram === module.program;
                            const geneFocused = Boolean(selectedGeneKey) && module.filteredGeneKeys?.includes(selectedGeneKey);
                            const selectionColor = programColor(module);
                            const selectionLabel = programSelectionLabel(module);
                            const positiveCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'positive').length || 0;
                            const negativeCount = module.visibleGenes?.filter((gene) => effectSignFromGene(gene) === 'negative').length || 0;
                            const uniqueGenes = [];
                            const seenGenes = new Set();
                            (module.visibleGenes || []).forEach((gene) => {
                                const key = gene.highlightKey || gene.ensg || gene.gene;
                                if (!key || seenGenes.has(key)) return;
                                seenGenes.add(key);
                                uniqueGenes.push(gene);
                            });

                            return (
                                <TableRow
                                    key={`${module.program}:${rowSide}`}
                                    hover
                                    selected={selected}
                                    onClick={() => onSelectProgram(module.program, rowSide)}
                                    sx={{
                                        ...tableRowRevealSx(theme, index),
                                        cursor: 'pointer',
                                        bgcolor: geneFocused && !selected ? alpha(effectColors.positive, 0.06) : undefined,
                                        '&.Mui-selected': { bgcolor: rowMeta.softBg },
                                        '&.Mui-selected:hover': { bgcolor: rowMeta.softBg },
                                        '&:hover': {
                                            bgcolor: selected
                                                ? rowMeta.softBg
                                                : geneFocused
                                                    ? alpha(effectColors.positive, 0.10)
                                                    : undefined,
                                        },
                                    }}
                                >
                                    <TableCell>
                                        <Chip
                                            label={rowSide}
                                            size="small"
                                            sx={{
                                                height: 22,
                                                borderRadius: 1,
                                                color: rowMeta.accent,
                                                bgcolor: rowMeta.softBg,
                                                fontWeight: 700,
                                                textTransform: 'lowercase',
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Stack spacing={0.35}>
                                            <Stack direction="row" spacing={0.25} alignItems="center">
                                                <Tooltip title={`Focus ${module.program} in graph and table`}>
                                                    <Button
                                                        size="small"
                                                        variant="text"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onSelectProgram(module.program, rowSide);
                                                        }}
                                                        sx={{
                                                            justifyContent: 'flex-start',
                                                            minWidth: 0,
                                                            p: 0,
                                                            color: '#245089',
                                                            fontWeight: 740,
                                                            lineHeight: 1,
                                                            textTransform: 'none',
                                                        }}
                                                    >
                                                        {module.program}
                                                    </Button>
                                                </Tooltip>
                                                <Tooltip title={`Open ${module.program}`}>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Open ${module.program}`}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onOpenProgram?.(module.program);
                                                        }}
                                                        sx={{ width: 24, height: 24, color: '#667085' }}
                                                    >
                                                        <OpenInNew sx={{ fontSize: 15 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                            <Typography sx={{ fontSize: 11.5, color: '#667085', lineHeight: 1.2 }}>
                                                {rowSide === 'program' ? 'program burden' : 'regulator-burden'}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 0.7,
                                                minWidth: 0,
                                                px: 0.75,
                                                py: 0.35,
                                                borderRadius: 1,
                                                bgcolor: `${selectionColor}18`,
                                                border: `1px solid ${selectionColor}55`,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 12,
                                                    height: 12,
                                                    borderRadius: 0.75,
                                                    bgcolor: selectionColor,
                                                    border: '1px solid rgba(15,23,42,0.12)',
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    fontSize: 12,
                                                    color: '#475467',
                                                    fontWeight: 700,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {selectionLabel}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography
                                            sx={{
                                                fontWeight: 700,
                                                color: edgeColorFromScore(module[scoreField]),
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {formatNumber(module[scoreField], 2)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {module.totalFilteredGenes}/{module[totalField]}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        <Box component="span" sx={{ color: effectColors.positive, fontWeight: 700 }}>{positiveCount}</Box>
                                        {' / '}
                                        <Box component="span" sx={{ color: effectColors.negative, fontWeight: 700 }}>{negativeCount}</Box>
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                            {uniqueGenes.length ? uniqueGenes.slice(0, 10).map((gene) => {
                                                const geneLabel = gene.geneLabel || gene.gene || gene.ensg || 'gene';
                                                const sign = effectSignFromGene(gene);
                                                const geneSelected = selectedGeneKey === gene.highlightKey;
                                                return (
                                                    <Chip
                                                        key={gene.highlightKey || `${module.program}:${geneLabel}`}
                                                        label={geneLabel}
                                                        size="small"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onSelectGene?.(gene);
                                                        }}
                                                        onDelete={(event) => {
                                                            event.stopPropagation();
                                                            onOpenGene?.(gene);
                                                        }}
                                                        deleteIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                                        sx={{
                                                            height: 22,
                                                            borderRadius: 1,
                                                            fontSize: 11,
                                                            fontWeight: 680,
                                                            color: geneSelected ? '#fff' : (effectColors[sign] || '#475467'),
                                                            bgcolor: geneSelected
                                                                ? (effectColors[sign] || '#475467')
                                                                : sign === 'negative'
                                                                ? alpha(effectColors.negative, 0.10)
                                                                : sign === 'positive'
                                                                    ? alpha(effectColors.positive, 0.10)
                                                                    : 'rgba(15,23,42,0.06)',
                                                            border: `1px solid ${geneSelected
                                                                ? (effectColors[sign] || '#475467')
                                                                : sign === 'negative'
                                                                ? alpha(effectColors.negative, 0.24)
                                                                : sign === 'positive'
                                                                    ? alpha(effectColors.positive, 0.24)
                                                                    : 'rgba(15,23,42,0.10)'}`,
                                                            cursor: 'pointer',
                                                            '& .MuiChip-deleteIcon': {
                                                                color: geneSelected ? 'rgba(255,255,255,0.92)' : '#667085',
                                                                mr: 0.35,
                                                                '&:hover': {
                                                                    color: geneSelected ? '#fff' : '#245089',
                                                                },
                                                            },
                                                        }}
                                                    />
                                                );
                                            }) : (
                                                <Typography sx={{ fontSize: 12, color: '#667085' }}>none</Typography>
                                            )}
                                            {uniqueGenes.length > 10 && (
                                                <Chip label={`+${uniqueGenes.length - 10}`} size="small" sx={{ height: 22, borderRadius: 1, fontSize: 11, fontWeight: 650 }} />
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="right">
                                        {module.collapsed ? (
                                            <Typography sx={{ fontSize: 12, color: '#667085' }}>none</Typography>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onToggleExpanded(module.program, rowSide);
                                                }}
                                                sx={{ minWidth: 0, px: 0.5, textTransform: 'none', fontSize: 12 }}
                                            >
                                                {module.expanded ? 'Collapse' : 'Show all'}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!filteredModules.length && (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Typography sx={{ py: 2, textAlign: 'center', color: '#667085', fontSize: 13 }}>
                                        No modules after current filters
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            {shouldPaginate && (
                <TablePagination
                    component="div"
                    count={filteredModules.length}
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
        </Paper>
    );
}
