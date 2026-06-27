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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import useSWR from 'swr';
import { getProgramScatterTraits } from '../api/gwas';
import { StatePanel, UpdatingStatus } from './PageScaffold';
import { TablePaginationActions } from './TablePageControls';
import TableSearchField from './TableSearchField';
import { downloadBlob } from '../utils/download';
import { detailSummarySWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { compareValues } from '../utils/sort';
import { formatScientificNumber } from '../utils/numbers';
import {
    groupedTableColumnHeaderCellSx,
    panelSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    summaryChipSx,
    tableToolbarActionButtonSx,
    tableToolbarGroupSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

function formatScore(value) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(3)}`;
}

function formatPValue(value) {
    return formatScientificNumber(value, 2, '-');
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
    return tones[color] || tones.other;
}

const ENRICHMENT_LABELS = {
    other: 'Other',
    program_enriched: 'Program enriched',
    regulator_enriched: 'Regulator enriched',
    both_enriched: 'Both enriched',
};

const PROGRAM_TRAIT_COLUMNS = [
    { key: 'trait', label: 'trait', align: 'left', tone: 'trait', width: 310 },
    { key: 'enrichment_class', label: 'enrichment_class', align: 'center', tone: 'other', width: 172 },
    { key: 'program_score', label: 'score', align: 'center', group: 'program', width: 136 },
    { key: 'program_rank', label: 'rank', align: 'center', group: 'program', width: 104 },
    { key: 'program_p', label: 'p-value', align: 'center', group: 'program', width: 118 },
    { key: 'program_gamma', label: 'mean_gamma', align: 'center', group: 'program', width: 132 },
    { key: 'regulator_score', label: 'score', align: 'center', group: 'regulator', width: 136 },
    { key: 'regulator_rank', label: 'rank', align: 'center', group: 'regulator', width: 104 },
    { key: 'regulator_p', label: 'p-value', align: 'center', group: 'regulator', width: 118 },
    { key: 'regulator_beta', label: 'beta', align: 'center', group: 'regulator', width: 112 },
];

const PROGRAM_TRAIT_COLUMN_DESCRIPTIONS = {
    trait: 'Trait represented by the Program Scatter row.',
    enrichment_class: 'Program Scatter enrichment class: program enriched, regulator enriched, both enriched, or other.',
    program_score: 'Program burden score from the Program Scatter source data.',
    program_rank: 'Rank of this program for the trait by absolute program burden score.',
    program_p: 'Program-side p-value from the Program Scatter source data.',
    program_gamma: 'Program mean gamma from the Program Scatter source data.',
    regulator_score: 'Regulator-burden score from the Program Scatter source data.',
    regulator_rank: 'Rank of this program for the trait by absolute regulator-burden score.',
    regulator_p: 'Regulator-side p-value from the Program Scatter source data.',
    regulator_beta: 'Regulator beta from the Program Scatter source data.',
};

const PROGRAM_TRAIT_GROUP_DESCRIPTIONS = {
    program: 'Program-side evidence from the Program Scatter source data.',
    regulator: 'Regulator-side evidence from the Program Scatter source data.',
};

const PROGRAM_TRAIT_TITLE_HEADER_HEIGHT = 56;
const RELATION_ROWS_PER_PAGE = 10;
const RELATION_PAGINATION_THRESHOLD = 10;
const relationIndexSWRConfig = {
    ...detailSummarySWRConfig,
    refreshInterval: (latestData) => (latestData?.unavailable ? 5000 : 0),
    revalidateIfStale: true,
    revalidateOnFocus: true,
};

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
    return `${column?.key || sortBy} ${sortDir === 'desc' ? 'descending' : 'ascending'}`;
}

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function selectionLabel(row) {
    const color = row?.enrichment_class || row?.color || 'other';
    return ENRICHMENT_LABELS[color] || ENRICHMENT_LABELS.other;
}

function compareProgramTraits(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'trait') {
        result = compareValues(a?.trait || a?.trait_id, b?.trait || b?.trait_id, 'text', 'asc');
    } else if (sortBy === 'enrichment_class') {
        result = compareValues(selectionLabel(a), selectionLabel(b), 'text', 'asc');
    } else if (sortBy === 'program_score') {
        result = compareValues(a?.program_score, b?.program_score, 'number', 'asc');
    } else if (sortBy === 'regulator_score') {
        result = compareValues(a?.regulator_score, b?.regulator_score, 'number', 'asc');
    } else if (sortBy === 'program_p') {
        result = compareValues(a?.program_p, b?.program_p, 'number', 'asc');
    } else if (sortBy === 'program_rank') {
        result = compareValues(a?.program_rank, b?.program_rank, 'number', 'asc');
    } else if (sortBy === 'program_gamma') {
        result = compareValues(a?.program_gamma, b?.program_gamma, 'number', 'asc');
    } else if (sortBy === 'regulator_p') {
        result = compareValues(a?.regulator_p, b?.regulator_p, 'number', 'asc');
    } else if (sortBy === 'regulator_rank') {
        result = compareValues(a?.regulator_rank, b?.regulator_rank, 'number', 'asc');
    } else if (sortBy === 'regulator_beta') {
        result = compareValues(a?.regulator_beta, b?.regulator_beta, 'number', 'asc');
    }

    if (result === 0) {
        result = compareValues(a?.trait_id, b?.trait_id, 'text', 'asc');
    }
    return sortDir === 'desc' ? -result : result;
}

function matchesProgramTraitRow(row, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;

    return [
        row?.trait,
        row?.trait_id,
        selectionLabel(row),
        row?.program_score,
        row?.regulator_score,
        row?.program_p,
        row?.regulator_p,
        row?.program_rank,
        row?.regulator_rank,
        row?.program_gamma,
        row?.regulator_beta,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

function buildProgramTraitCsv(rows) {
    const lines = [
        PROGRAM_TRAIT_COLUMNS.map((column) => escapeCsvValue(column.key)).join(','),
        ...rows.map((row) => PROGRAM_TRAIT_COLUMNS.map((column) => escapeCsvValue(row[column.key] ?? '')).join(',')),
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

function evidenceGroupTone(group) {
    if (group === 'identity') {
        return {
            color: '#365f8c',
            accent: '#8cb3dc',
            headerBg: '#f1f7fd',
            subHeaderBg: '#f7fbff',
            cellBg: '#fbfdff',
            cellStrongBg: '#eef6fd',
            border: '#cbdff3',
        };
    }
    if (group === 'regulator') {
        return {
            color: '#3f6b4d',
            accent: '#8fbc9b',
            headerBg: '#f1f8f3',
            subHeaderBg: '#f7fbf8',
            cellBg: '#fbfdfb',
            cellStrongBg: '#edf7ef',
            border: '#cfe5d4',
        };
    }
    return {
        color: '#6e581f',
        accent: '#caa65b',
        headerBg: '#fbf8f1',
        subHeaderBg: '#fdfaf5',
        cellBg: '#fffefa',
        cellStrongBg: '#fbf5e8',
        border: '#eadab8',
    };
}

function stripHeaderBackground(baseSx) {
    const {
        bgcolor: unusedBaseBgcolor,
        background: unusedBaseBackground,
        backgroundColor: unusedBaseBackgroundColor,
        backgroundImage: unusedBaseBackgroundImage,
        ...baseWithoutBackground
    } = baseSx;
    void unusedBaseBgcolor;
    void unusedBaseBackground;
    void unusedBaseBackgroundColor;
    void unusedBaseBackgroundImage;
    return baseWithoutBackground;
}

function evidenceHeaderSx(theme, baseSx, group, overrides = {}) {
    const tone = evidenceGroupTone(group);
    const boundary = overrides.boundary;
    const { boundary: unusedBoundary, ...restOverrides } = overrides;
    void unusedBoundary;
    const headerBackground = overrides.top === PROGRAM_TRAIT_TITLE_HEADER_HEIGHT + 36 ? tone.subHeaderBg : tone.headerBg;
    return {
        ...stripHeaderBackground(baseSx),
        color: tone.color,
        bgcolor: headerBackground,
        backgroundColor: `${headerBackground} !important`,
        backgroundImage: 'none',
        borderLeft: boundary ? `1px solid ${tone.border}` : undefined,
        borderBottom: `1px solid ${tone.border}`,
        borderTop: `1px solid ${alpha(tone.accent, 0.14)}`,
        ...restOverrides,
    };
}

function identityHeaderSx(theme, baseSx, overrides = {}) {
    return evidenceHeaderSx(theme, baseSx, 'identity', overrides);
}

function evidenceCellSx(theme, baseSx, group, strong = false, boundary = false) {
    const tone = evidenceGroupTone(group);
    const background = strong ? tone.cellStrongBg : tone.cellBg;
    return {
        ...baseSx,
        bgcolor: background,
        backgroundColor: background,
        backgroundImage: 'none',
        borderLeft: boundary ? `1px solid ${tone.border}` : undefined,
    };
}

export default function ProgramAssociatedTraits({
    programId,
    showAll = false,
}) {
    const theme = useTheme();
    const tones = {
        other: tableTone(theme, 'neutral'),
    };
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(RELATION_ROWS_PER_PAGE);
    const [sortBy, setSortBy] = React.useState('program_score');
    const [sortDir, setSortDir] = React.useState('desc');
    const [searchQuery, setSearchQuery] = React.useState('');
    const traitKey = programId ? ['program-scatter-traits', programId] : null;
    const traitResource = useCachedResourceState(
        useSWR(
            traitKey,
            ([, id]) => getProgramScatterTraits(id),
            relationIndexSWRConfig,
        ),
        { cacheKey: traitKey, retainPreviousData: false },
    );
    const { displayData: data, error, isInitialLoading: isLoading, isRefreshing } = traitResource;

    React.useEffect(() => {
        setPage(0);
    }, [programId]);

    React.useEffect(() => {
        setPage(0);
    }, [sortBy, sortDir]);

    React.useEffect(() => {
        setPage(0);
    }, [searchQuery]);

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(['program_score', 'regulator_score'].includes(key) ? 'desc' : 'asc');
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
                Program scatter SQL index is not available yet. Run the schema migration and import_program_trait_scatter_index.js before using this table.
            </Alert>
        );
    }

    const traits = data?.traits || [];
    const filteredTraits = traits.filter((row) => matchesProgramTraitRow(row, searchQuery));
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
                message="This program was not found in the imported Program Scatter index."
                minHeight={240}
            />
        );
    }

    const shouldPaginate = !showAll && sortedTraits.length > RELATION_PAGINATION_THRESHOLD;
    const pageCount = Math.max(1, Math.ceil(sortedTraits.length / rowsPerPage));
    const currentPage = shouldPaginate ? Math.min(page, pageCount - 1) : 0;
    const start = shouldPaginate ? currentPage * rowsPerPage : 0;
    const visibleTraits = shouldPaginate ? sortedTraits.slice(start, start + rowsPerPage) : sortedTraits;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1342 })}>
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
                                            Associated traits
                                        </Typography>
                                    </Box>
                                    <Box sx={tableToolbarGroupSx(theme, {
                                        width: { xs: '100%', md: 'auto' },
                                        px: 0,
                                        py: 0,
                                        border: 'none',
                                        background: 'transparent',
                                        boxShadow: 'none',
                                    })}
                                    >
                                        <UpdatingStatus active={isRefreshing} reserveSpace />
                                        <TableSearchField
                                            label="Search"
                                            value={searchQuery}
                                            placeholder="Trait, enrichment class, p-value"
                                            onChange={setSearchQuery}
                                            onClear={() => setSearchQuery('')}
                                            width={{ xs: '100%', sm: 260 }}
                                        />
                                        <Button
                                            size="small"
                                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                            onClick={handleDownload}
                                            disabled={!sortedTraits.length}
                                            sx={tableToolbarActionButtonSx(theme)}
                                        >
                                            Export CSV
                                        </Button>
                                    </Box>
                                </Stack>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_TRAIT_COLUMNS.slice(0, 2).map((column) => (
                                <TableCell
                                    key={column.key}
                                    rowSpan={2}
                                    sx={identityHeaderSx(theme, programTraitColumnHeaderSx(theme, tones.other, column.align))}
                                >
                                    <Tooltip title={PROGRAM_TRAIT_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...programTraitSortLabelSx, justifyContent: justifyForAlign(column.align), width: '100%' }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </Tooltip>
                                </TableCell>
                            ))}
                            <TableCell
                                align="center"
                                colSpan={4}
                                sx={evidenceHeaderSx(theme, programTraitColumnHeaderSx(theme, tones.other, 'center'), 'program', { boundary: true })}
                            >
                                <Tooltip title={PROGRAM_TRAIT_GROUP_DESCRIPTIONS.program} arrow>
                                    <Box component="span">program</Box>
                                </Tooltip>
                            </TableCell>
                            <TableCell
                                align="center"
                                colSpan={4}
                                sx={evidenceHeaderSx(theme, programTraitColumnHeaderSx(theme, tones.other, 'center'), 'regulator', { boundary: true })}
                            >
                                <Tooltip title={PROGRAM_TRAIT_GROUP_DESCRIPTIONS.regulator} arrow>
                                    <Box component="span">regulator</Box>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_TRAIT_COLUMNS.slice(2).map((column) => {
                                const group = column.group;
                                return (
                                    <TableCell
                                        key={column.key}
                                        sx={evidenceHeaderSx(theme, programTraitColumnHeaderSx(theme, tones.other, column.align), group, {
                                            boundary: column.key === 'program_score' || column.key === 'regulator_score',
                                            top: PROGRAM_TRAIT_TITLE_HEADER_HEIGHT + 36,
                                        })}
                                    >
                                        <Tooltip title={PROGRAM_TRAIT_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                            <TableSortLabel
                                                active={sortBy === column.key}
                                                direction={sortBy === column.key ? sortDir : 'asc'}
                                                hideSortIcon
                                                onClick={() => handleSort(column.key)}
                                                sx={{ ...programTraitSortLabelSx, justifyContent: justifyForAlign(column.align), width: '100%' }}
                                            >
                                                {column.label}
                                            </TableSortLabel>
                                        </Tooltip>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleTraits.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={PROGRAM_TRAIT_COLUMNS.length}
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
                        ) : visibleTraits.map((row, index) => (
                            <TableRow
                                key={`${row.trait_id}-${row.program}`}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'left'), 'identity', true)}>
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.file_id || row.trait_id)}`}
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
                                        {row.trait || row.trait_id}
                                    </Button>
                                    <Typography sx={{ mt: 0.25, fontSize: '0.66rem', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }} noWrap>
                                        {row.trait_id}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center'), 'identity')}>
                                    <Chip
                                        label={selectionLabel(row)}
                                        size="small"
                                        sx={{
                                            ...summaryChipSx(theme, colorTone(theme, row.enrichment_class)),
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
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace', fontWeight: 680 }), 'program', true, true)}>
                                    {formatScore(row.program_score)}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace' }), 'program', true)}>
                                    {row.program_rank ?? '-'}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace' }), 'program')}>
                                    {formatPValue(row.program_p)}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace' }), 'program')}>
                                    {formatScore(row.program_gamma)}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace', fontWeight: 680 }), 'regulator', true, true)}>
                                    {formatScore(row.regulator_score)}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace' }), 'regulator', true)}>
                                    {row.regulator_rank ?? '-'}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace' }), 'regulator')}>
                                    {formatPValue(row.regulator_p)}
                                </TableCell>
                                <TableCell sx={evidenceCellSx(theme, programTraitCellSx(theme, tones.other, 'center', { fontFamily: 'monospace' }), 'regulator')}>
                                    {formatScore(row.regulator_beta)}
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
                    labelDisplayedRows={() => ''}
                    rowsPerPageOptions={[10, 25, 50, 100, 250]}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(Number(event.target.value));
                        setPage(0);
                    }}
                    ActionsComponent={TablePaginationActions}
                    sx={{
                        borderTop: `1px solid ${theme.custom.border.soft}`,
                        background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.024)}, ${theme.custom.surface.subtle})`,
                        '& .MuiTablePagination-toolbar': {
                            minHeight: 48,
                            px: { xs: 1.25, md: 1.6 },
                            gap: 1,
                            flexWrap: { xs: 'wrap', md: 'nowrap' },
                            alignItems: 'center',
                        },
                        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                            fontSize: '0.74rem',
                            color: theme.palette.text.secondary,
                            m: 0,
                        },
                        '& .MuiTablePagination-displayedRows': {
                            display: 'none',
                        },
                        '& .MuiTablePagination-select': {
                            fontSize: '0.74rem',
                        },
                        '& .MuiTablePagination-spacer': {
                            flex: '1 1 auto',
                        },
                        '& .MuiTablePagination-actions': {
                            marginLeft: 'auto',
                        },
                    }}
                />
            )}
        </Paper>
    );
}
