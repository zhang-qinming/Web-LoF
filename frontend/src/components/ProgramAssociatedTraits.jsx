import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import useSWR from 'swr';
import { getProgramTraits } from '../api/gwas';
import { StatePanel, UpdatingStatus } from './PageScaffold';
import { downloadBlob } from '../utils/download';
import { detailSummarySWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import {
    compactToggleGroupSx,
    groupedTableColumnHeaderCellSx,
    metricChipTone,
    panelSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

function formatScore(value) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(3)}`;
}

function colorTone(theme, color) {
    void color;
    const tones = {
        other: {
            backgroundColor: alpha('#E69F00', 0.14),
            color: '#8a5b12',
            border: `1px solid ${alpha('#E69F00', 0.32)}`,
        },
        program_enriched: {
            backgroundColor: alpha('#E69F00', 0.14),
            color: '#8a5b12',
            border: `1px solid ${alpha('#E69F00', 0.32)}`,
        },
        regulator_enriched: {
            backgroundColor: alpha('#0072B2', 0.12),
            color: '#245089',
            border: `1px solid ${alpha('#0072B2', 0.28)}`,
        },
        both_enriched: {
            backgroundColor: alpha('#009E73', 0.12),
            color: '#2f6a49',
            border: `1px solid ${alpha('#009E73', 0.3)}`,
        },
    };
    return tones.other;
}

const ENRICHMENT_LABELS = {
    other: 'Other',
    program_enriched: 'Program enriched',
    regulator_enriched: 'Regulator enriched',
    both_enriched: 'Both enriched',
};

const PROGRAM_TRAIT_COLUMNS = [
    { key: 'traitName', label: 'Trait', align: 'left', tone: 'trait', width: 310 },
    { key: 'selection', label: 'Relationship', align: 'center', tone: 'other', width: 185 },
    { key: 'programScore', label: 'Program Burden Score', align: 'center', tone: 'program', width: 168 },
    { key: 'regulatorScore', label: 'Regulator-Burden Score', align: 'center', tone: 'other', width: 182 },
    { key: 'topGenes', label: 'Top Evidence Genes', align: 'left', tone: 'gene', width: 370 },
];

const PROGRAM_TRAIT_TITLE_HEADER_HEIGHT = 56;
const TABLE_PAGINATION_THRESHOLD = 50;
const DEFAULT_ROWS_PER_PAGE = 25;

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

const programTraitSortLabelSx = {
    fontSize: '0.68rem',
    m: 0,
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.82rem',
        margin: 0,
    },
};

function programTraitSortDescription(sortBy, sortDir) {
    const column = PROGRAM_TRAIT_COLUMNS.find((item) => item.key === sortBy);
    return `${column?.label || sortBy} ${sortDir === 'desc' ? 'descending' : 'ascending'}`;
}

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function selectionLabel(row) {
    const color = row?.color || 'other';
    return ENRICHMENT_LABELS[color] || ENRICHMENT_LABELS.other;
}

function compareProgramTraits(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'traitName') {
        result = String(a?.traitName || a?.traitId || '').localeCompare(String(b?.traitName || b?.traitId || ''));
    } else if (sortBy === 'selection') {
        result = selectionLabel(a).localeCompare(selectionLabel(b));
    } else if (sortBy === 'programScore') {
        result = (Number(a?.programScore) || 0) - (Number(b?.programScore) || 0);
    } else if (sortBy === 'regulatorScore') {
        result = (Number(a?.regulatorScore) || 0) - (Number(b?.regulatorScore) || 0);
    } else if (sortBy === 'topGenes') {
        result = (a?.topGenes?.length || 0) - (b?.topGenes?.length || 0);
    }

    if (result === 0) {
        result = String(a?.traitId || '').localeCompare(String(b?.traitId || ''));
    }
    return sortDir === 'desc' ? -result : result;
}

function buildProgramTraitCsv(rows) {
    const header = [
        'Trait',
        'Trait ID',
        'Relationship',
        'Program Burden Score',
        'Regulator-Burden Score',
        'Program Evidence Gene Count',
        'Regulator Evidence Gene Count',
        'Top Evidence Genes',
    ];
    const lines = [
        header.map(escapeCsvValue).join(','),
        ...rows.map((row) => [
            row.traitName || '',
            row.traitId || '',
            selectionLabel(row),
            row.programScore ?? '',
            row.regulatorScore ?? '',
            Number(row.loadingGeneCount) || 0,
            Number(row.regulatorGeneCount) || 0,
            (row.topGenes || []).join('; '),
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function programTraitCellSx(theme, tone, align = 'left', overrides = {}) {
    const useDataFont = overrides.fontFamily === 'monospace';
    const { fontFamily, ...restOverrides } = overrides;
    return {
        py: 0.72,
        px: 1,
        textAlign: align,
        fontSize: '0.74rem',
        lineHeight: 1.28,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        bgcolor: tone.cellSoft,
        color: theme.palette.text.primary,
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        ...restOverrides,
    };
}

function programTraitTitleCellSx(theme) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: '43 !important',
        height: PROGRAM_TRAIT_TITLE_HEADER_HEIGHT,
        py: 0.75,
        px: 1.25,
        bgcolor: theme.custom.surface.raised,
        backgroundColor: `${theme.custom.surface.raised} !important`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        color: theme.palette.text.primary,
    };
}

function programTraitColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: PROGRAM_TRAIT_TITLE_HEADER_HEIGHT,
    });
}

export default function ProgramAssociatedTraits({
    programId,
    showAll = false,
}) {
    const theme = useTheme();
    const tones = {
        trait: tableTone(theme, 'warning'),
        program: tableTone(theme, 'warning'),
        gene: tableTone(theme, 'warning'),
        other: tableTone(theme, 'warning'),
    };
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(DEFAULT_ROWS_PER_PAGE);
    const [filter, setFilter] = React.useState('all');
    const [sortBy, setSortBy] = React.useState('programScore');
    const [sortDir, setSortDir] = React.useState('desc');
    const traitKey = programId ? ['program-traits', programId] : null;
    const traitResource = useCachedResourceState(
        useSWR(
            traitKey,
            ([, id]) => getProgramTraits(id),
            detailSummarySWRConfig,
        ),
        { cacheKey: traitKey, retainPreviousData: false },
    );
    const { displayData: data, error, isInitialLoading: isLoading, isRefreshing } = traitResource;

    React.useEffect(() => {
        setPage(0);
    }, [programId]);

    React.useEffect(() => {
        setPage(0);
    }, [filter, sortBy, sortDir]);

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(['programScore', 'regulatorScore', 'topGenes'].includes(key) ? 'desc' : 'asc');
    }, [sortBy, sortDir]);

    if (isLoading) {
        return <Paper elevation={0} aria-hidden="true" sx={panelSx(theme, { minHeight: 240, boxShadow: 'none' })} />;
    }

    if (error) {
        return <StatePanel severity="error" title="Failed to load associated traits" message={error.message || 'The request failed.'} />;
    }

    if (data?.unavailable) {
        return (
            <Alert severity="warning" sx={{ borderRadius: 1 }}>
                Program-trait SQL index is not available yet. Run the schema migration and import script before using this table.
            </Alert>
        );
    }

    const traits = data?.traits || [];
    const filteredTraits = traits.filter((trait) => {
        if (filter === 'program') return trait.selectedByProgram;
        if (filter === 'regulator') return trait.selectedByRegulator;
        if (filter === 'both') return trait.selectedByProgram && trait.selectedByRegulator;
        return true;
    });
    const sortedTraits = [...filteredTraits].sort((a, b) => compareProgramTraits(a, b, sortBy, sortDir));

    const handleDownload = () => {
        const csv = buildProgramTraitCsv(sortedTraits);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${programId || 'program'}-associated-traits.csv`);
    };

    if (!traits.length) {
        return (
            <StatePanel
                icon={AccountTreeOutlined}
                title="No associated traits"
                message="This program was not found in the imported trait-program index."
                minHeight={240}
            />
        );
    }

    const shouldPaginate = !showAll && sortedTraits.length > TABLE_PAGINATION_THRESHOLD;
    const pageCount = Math.max(1, Math.ceil(sortedTraits.length / rowsPerPage));
    const currentPage = shouldPaginate ? Math.min(page, pageCount - 1) : 0;
    const start = shouldPaginate ? currentPage * rowsPerPage : 0;
    const visibleTraits = shouldPaginate ? sortedTraits.slice(start, start + rowsPerPage) : sortedTraits;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1139 })}>
                    <colgroup>
                        {PROGRAM_TRAIT_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell colSpan={PROGRAM_TRAIT_COLUMNS.length} sx={programTraitTitleCellSx(theme)}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.92rem', lineHeight: 1.2 })}>
                                            Associated Traits
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                        <UpdatingStatus active={isRefreshing} />
                                        <ToggleButtonGroup
                                            size="small"
                                            exclusive
                                            value={filter}
                                            onChange={(event, value) => value && setFilter(value)}
                                            sx={compactToggleGroupSx(theme)}
                                        >
                                            <ToggleButton value="all">All</ToggleButton>
                                            <ToggleButton value="program">Program</ToggleButton>
                                            <ToggleButton value="regulator">Regulator</ToggleButton>
                                            <ToggleButton value="both">Both</ToggleButton>
                                        </ToggleButtonGroup>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                            onClick={handleDownload}
                                            disabled={!sortedTraits.length}
                                            sx={{ textTransform: 'none', fontSize: '0.72rem', color: theme.palette.text.secondary }}
                                        >
                                            CSV
                                        </Button>
                                    </Stack>
                                </Stack>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_TRAIT_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    sx={programTraitColumnHeaderSx(theme, tones[column.tone], column.align)}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        hideSortIcon
                                        onClick={() => handleSort(column.key)}
                                        sx={{ ...programTraitSortLabelSx, justifyContent: justifyForAlign(column.align), width: '100%' }}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleTraits.map((row, index) => (
                            <TableRow
                                key={`${row.traitId}-${row.program}`}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={programTraitCellSx(theme, tones.trait, 'left', { bgcolor: tones.trait.cellStrong })}>
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.fileId || row.traitId)}`}
                                        endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                        sx={{
                                            textTransform: 'none',
                                            px: 0,
                                            py: 0,
                                            justifyContent: 'flex-start',
                                            alignItems: 'flex-start',
                                            color: theme.palette.text.primary,
                                            fontWeight: 680,
                                            fontSize: '0.74rem',
                                            lineHeight: 1.25,
                                            minHeight: 0,
                                            maxWidth: '100%',
                                        }}
                                    >
                                        {row.traitName || row.traitId}
                                    </Button>
                                    <Typography sx={{ mt: 0.25, fontSize: '0.66rem', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }} noWrap>
                                        {row.traitId}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={programTraitCellSx(theme, tones.other, 'center')}>
                                    <Chip
                                        label={selectionLabel(row)}
                                        size="small"
                                        sx={{
                                            ...summaryChipSx(theme, colorTone(theme, row.color)),
                                            height: 'auto',
                                            minHeight: 22,
                                            fontSize: '0.64rem',
                                            '& .MuiChip-label': {
                                                display: 'block',
                                                whiteSpace: 'normal',
                                                py: 0.25,
                                            },
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={programTraitCellSx(theme, tones.program, 'center', { fontFamily: 'monospace', fontWeight: 680, bgcolor: tones.program.cellStrong })}>
                                    {formatScore(row.programScore)}
                                </TableCell>
                                <TableCell sx={programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace', fontWeight: 680, bgcolor: tones.other.cellStrong })}>
                                    {formatScore(row.regulatorScore)}
                                </TableCell>
                                <TableCell sx={programTraitCellSx(theme, tones.gene, 'left', { whiteSpace: 'normal' })}>
                                    <Stack direction="row" spacing={0.45} sx={{ flexWrap: 'wrap' }}>
                                        {(row.topGenes || []).slice(0, 8).map((gene) => (
                                            <Chip
                                                key={`${row.traitId}-${gene}`}
                                                label={gene}
                                                size="small"
                                                component={RouterLink}
                                                clickable
                                                to={`/genes?query=${encodeURIComponent(gene)}`}
                                                sx={{ ...summaryChipSx(theme, metricChipTone(theme, 'subtle')), height: 20, fontSize: '0.62rem' }}
                                            />
                                        ))}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {!shouldPaginate ? (
                <Box
                    sx={{
                        px: { xs: 1.25, md: 1.6 },
                        py: 1,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                        alignItems: 'center',
                        gap: 1,
                        background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.028)}, ${theme.custom.surface.subtle})`,
                        borderTop: `1px solid ${theme.custom.border.soft}`,
                    }}
                >
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Showing all {sortedTraits.length.toLocaleString()} traits
                    </Typography>
                    <Chip
                        label={programTraitSortDescription(sortBy, sortDir)}
                        size="small"
                        sx={summaryChipSx(theme, {
                            height: 22,
                            color: theme.palette.text.secondary,
                            bgcolor: alpha(theme.palette.text.primary, 0.045),
                        })}
                    />
                </Box>
            ) : (
                <TablePagination
                    component="div"
                    count={sortedTraits.length}
                    page={currentPage}
                    onPageChange={(event, nextPage) => setPage(nextPage)}
                    rowsPerPage={rowsPerPage}
                    rowsPerPageOptions={[25, 50, 100, 250]}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(Number(event.target.value));
                        setPage(0);
                    }}
                    sx={{
                        borderTop: `1px solid ${theme.custom.border.soft}`,
                        '& .MuiTablePagination-toolbar': { minHeight: 44 },
                        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                            fontSize: '0.74rem',
                            color: theme.palette.text.secondary,
                        },
                    }}
                />
            )}
        </Paper>
    );
}
