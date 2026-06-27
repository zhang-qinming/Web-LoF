import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import Clear from '@mui/icons-material/Clear';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import ExpandMore from '@mui/icons-material/ExpandMore';
import OpenInNew from '@mui/icons-material/OpenInNew';
import Search from '@mui/icons-material/Search';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import useSWR, { unstable_serialize, useSWRConfig } from 'swr';
import { fetcher, getProgramGeneRoles, getProgramScatterTraits } from '../api/gwas';
import { PageFrame, StatePanel, UpdatingStatus } from '../components/PageScaffold';
import { TablePaginationActions } from '../components/TablePageControls';
import TableSearchField from '../components/TableSearchField';
import { downloadBlob } from '../utils/download';
import { detailSummarySWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useProgressiveCount, useStagedMount } from '../utils/useProgressiveRender';
import { formatScientificNumber } from '../utils/numbers';
import { compareValues } from '../utils/sort';
import {
    DATA_PAGE_MAX_WIDTH,
    groupedTableColumnHeaderCellSx,
    mainTableActionButtonSx,
    mainTableSearchFieldSx,
    mainTableToolbarActionsSx,
    mainTableToolbarSearchSlotSx,
    mainTableToolbarSx,
    mainTableToolbarTitleSlotSx,
    metricChipTone,
    panelSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    summaryChipSx,
    tableToolbarActionButtonSx,
    tableToolbarGroupSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

const loadGeneRegulation = () => import('../components/GeneRegulation');
const loadProgramAssociatedTraits = () => import('../components/ProgramAssociatedTraits');

const GeneRegulation = React.lazy(loadGeneRegulation);
const ProgramAssociatedTraits = React.lazy(loadProgramAssociatedTraits);
const PROGRAM_DETAIL_PRELOADERS = [loadGeneRegulation, loadProgramAssociatedTraits];
const preloadedProgramDetailLoaders = new Set();
const prefetchedProgramData = new Set();

function scheduleIdleTask(callback, timeout = 1200) {
    if (typeof window === 'undefined') return () => { };

    if ('requestIdleCallback' in window) {
        const idleId = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback(idleId);
    }

    const timerId = window.setTimeout(callback, Math.min(timeout, 600));
    return () => window.clearTimeout(timerId);
}

function preloadProgramDetail(index) {
    const loader = PROGRAM_DETAIL_PRELOADERS[index];
    if (!loader || preloadedProgramDetailLoaders.has(loader)) return undefined;

    preloadedProgramDetailLoaders.add(loader);
    return loader().catch((error) => {
        preloadedProgramDetailLoaders.delete(loader);
        throw error;
    });
}

function ProgramDetailFallback({ minHeight = 320 }) {
    return <Box aria-hidden="true" sx={{ minHeight, width: '100%' }} />;
}

function DeferredProgramPanel({ ready, minHeight = 320, children }) {
    if (!ready) return <ProgramDetailFallback minHeight={minHeight} />;

    return (
        <Box
            sx={{
                minWidth: 0,
                contentVisibility: 'auto',
                containIntrinsicSize: `auto ${minHeight}px`,
            }}
        >
            {children}
        </Box>
    );
}

function numSort(a, b) {
    return (parseInt(String(a).replace(/\D/g, '')) || 0) - (parseInt(String(b).replace(/\D/g, '')) || 0);
}

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

const GO_ACCESSION_PATTERN = /GO[:_]\d+/i;

const PROGRAM_TABLE_COLUMNS = [
    { key: 'program', label: 'Program', align: 'center', tone: 'identity', width: '7%' },
    { key: 'curated_annotation', label: 'Function annotation', align: 'left', tone: 'annotation', width: '22%' },
    { key: 'go_term', label: 'GO Term', align: 'left', tone: 'annotation', width: '20%' },
    { key: 'go_accession', label: 'GO Accession', align: 'center', tone: 'metric', width: '9%' },
    { key: 'go_ontology', label: 'Ontology', align: 'center', tone: 'metric', width: '11%' },
    { key: 'go_enrichment_p', label: 'p-value', align: 'center', tone: 'metric', width: '9%' },
    { key: 'top10_genes', label: 'Representative genes', align: 'left', tone: 'genes', width: '22%' },
];

const PROGRAM_INFO_FIELDS = [
    { key: 'program', label: 'Program ID' },
    { key: 'annotation', label: 'Function annotation' },
    { key: 'goTerm', label: 'Representative GO function' },
    { key: 'goOntology', label: 'GO Ontology' },
    { key: 'associatedGenes', label: 'Associated genes' },
    { key: 'associatedTraits', label: 'Associated traits' },
];

const PROGRAM_GENE_COLUMNS = [
    { key: 'gene_symbol', label: 'gene_symbol', align: 'center', tone: 'genes', width: 150 },
    { key: 'ensg_id', label: 'ensg_id', align: 'center', tone: 'genes', width: 180 },
    { key: 'loading_gene_score', label: 'score', align: 'center', tone: 'metric', width: 110 },
    { key: 'loading_gene_rank', label: 'rank', align: 'center', tone: 'metric', width: 88 },
    { key: 'loading_gene_direction', label: 'direction', align: 'center', tone: 'metric', width: 112 },
    { key: 'regulator_score', label: 'score', align: 'center', tone: 'metric', width: 110 },
    { key: 'regulator_rank', label: 'rank', align: 'center', tone: 'metric', width: 88 },
    { key: 'regulator_direction', label: 'direction', align: 'center', tone: 'metric', width: 112 },
];

const PROGRAM_GENE_COLUMN_DESCRIPTIONS = {
    gene_symbol: 'Gene symbol from the program-gene role index.',
    ensg_id: 'Ensembl gene identifier from the program-gene role index.',
    loading_gene: 'cNMF_all.gene_spectra_score membership evidence for loading genes.',
    regulator: 'cNMF_regulation/K562GW perturb effect evidence for regulators.',
    loading_gene_score: 'Membership score for role=program_gene.',
    loading_gene_rank: 'Rank within this program among program_gene membership rows.',
    loading_gene_direction: 'Direction inferred from the program_gene score sign.',
    regulator_score: 'Perturb/regulation score for role=regulator.',
    regulator_rank: 'Rank within this program among regulator rows.',
    regulator_direction: 'Direction inferred from the regulator score sign.',
};

const DETAIL_TABLE_TITLE_HEADER_HEIGHT = 56;
const RELATION_ROWS_PER_PAGE = 10;
const RELATION_PAGINATION_THRESHOLD = 10;
const PROGRAM_INITIAL_RENDER_ROWS = 10;
const PROGRAM_RENDER_STEP = 10;
const PROGRAM_DETAIL_STAGE_COUNT = 4;
const EMPTY_PROGRAM_LIST = [];
const relationIndexSWRConfig = {
    ...detailSummarySWRConfig,
    refreshInterval: (latestData) => (latestData?.unavailable ? 5000 : 0),
    revalidateIfStale: true,
    revalidateOnFocus: true,
};

const programSortLabelSx = {
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
    fontSize: '0.68rem',
    lineHeight: 1.15,
    whiteSpace: 'normal',
    m: 0,
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.82rem',
        margin: '1px 0 0 4px',
        alignSelf: 'flex-start',
        flexShrink: 0,
    },
};

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildGoUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const accession = extractGoAccession(text);
    if (accession) {
        return `https://amigo.geneontology.org/amigo/term/${accession}`;
    }
    return `https://amigo.geneontology.org/amigo/search/ontology?q=${encodeURIComponent(text)}`;
}

function extractGoAccession(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(GO_ACCESSION_PATTERN);
    return match ? match[0].replace('_', ':').toUpperCase() : '';
}

function normalizeRepresentativeGenes(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            const label = String(item?.label || item?.geneSymbol || item?.ensgId || '').trim();
            const query = String(item?.query || item?.geneSymbol || item?.ensgId || '').trim();
            if (!label || !query) return null;
            return {
                label,
                query,
                geneSymbol: String(item?.geneSymbol || '').trim(),
                ensgId: String(item?.ensgId || '').trim(),
            };
        })
        .filter(Boolean);
}

function buildProgramTableCsv(rows) {
    const header = ['Program', 'Function annotation', 'GO Term', 'Accession', 'Ontology', 'p-value', 'Representative genes'];
    const lines = [
        header.map(escapeCsvValue).join(','),
        ...rows.map((row) => [
            row.program || '',
            row.curated_annotation || '',
            row.go_term || '',
            row.go_accession || '',
            row.go_ontology || '',
            row.go_enrichment_p || '',
            row.top10_genes || '',
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function compareProgramGeneRows(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'loading_gene_score') {
        result = compareOptionalRoleNumber(a?.program_gene?.score, b?.program_gene?.score, sortDir);
        if (result !== 0) return result;
    } else if (sortBy === 'loading_gene_rank') {
        result = compareOptionalRoleNumber(a?.program_gene?.rank, b?.program_gene?.rank, sortDir);
        if (result !== 0) return result;
    } else if (sortBy === 'loading_gene_direction') {
        result = compareValues(a?.program_gene?.direction, b?.program_gene?.direction, 'text', 'asc');
    } else if (sortBy === 'regulator_score') {
        result = compareOptionalRoleNumber(a?.regulator?.score, b?.regulator?.score, sortDir);
        if (result !== 0) return result;
    } else if (sortBy === 'regulator_rank') {
        result = compareOptionalRoleNumber(a?.regulator?.rank, b?.regulator?.rank, sortDir);
        if (result !== 0) return result;
    } else if (sortBy === 'regulator_direction') {
        result = compareValues(a?.regulator?.direction, b?.regulator?.direction, 'text', 'asc');
    } else {
        result = compareValues(a?.[sortBy], b?.[sortBy], 'text', 'asc');
    }

    if (result === 0) {
        result = compareValues(a?.gene_symbol || a?.ensg_id, b?.gene_symbol || b?.ensg_id, 'text', 'asc');
    }
    return sortDir === 'desc' ? -result : result;
}

function compareOptionalRoleNumber(leftValue, rightValue, sortDir) {
    const left = Number(leftValue);
    const right = Number(rightValue);
    const leftMissing = !Number.isFinite(left);
    const rightMissing = !Number.isFinite(right);
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const result = left - right;
    return sortDir === 'desc' ? -result : result;
}

function betterRoleRecord(current, candidate) {
    if (!current) return candidate;
    const currentRank = Number.isFinite(Number(current.rank)) ? Number(current.rank) : Number.POSITIVE_INFINITY;
    const candidateRank = Number.isFinite(Number(candidate.rank)) ? Number(candidate.rank) : Number.POSITIVE_INFINITY;
    if (candidateRank !== currentRank) return candidateRank < currentRank ? candidate : current;
    const currentScore = Math.abs(Number(current.score) || 0);
    const candidateScore = Math.abs(Number(candidate.score) || 0);
    return candidateScore > currentScore ? candidate : current;
}

function groupProgramGeneRows(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
        const geneKey = row?.ensg_id || row?.gene_symbol;
        if (!geneKey) return;
        const existing = grouped.get(geneKey) || {
            gene_symbol: row.gene_symbol || '',
            ensg_id: row.ensg_id || '',
            roleMap: {},
        };
        if (!existing.gene_symbol && row.gene_symbol) existing.gene_symbol = row.gene_symbol;
        if (!existing.ensg_id && row.ensg_id) existing.ensg_id = row.ensg_id;
        const role = row.role || '';
        if (role) existing.roleMap[role] = betterRoleRecord(existing.roleMap[role], row);
        grouped.set(geneKey, existing);
    });

    return Array.from(grouped.values()).map((row) => {
        return {
            gene_symbol: row.gene_symbol,
            ensg_id: row.ensg_id,
            program_gene: row.roleMap.program_gene || null,
            regulator: row.roleMap.regulator || null,
        };
    });
}

function buildProgramInfoCsv(row) {
    const lines = [
        ['Field', 'Value'].map(escapeCsvValue).join(','),
        ...PROGRAM_INFO_FIELDS.map((field) => [
            field.label,
            row?.[field.key] ?? '',
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function buildProgramGeneCsv(rows) {
    const lines = [
        [
            'gene_symbol',
            'ensg_id',
            'program_gene_score',
            'program_gene_rank',
            'program_gene_direction',
            'regulator_score',
            'regulator_rank',
            'regulator_direction',
        ].map(escapeCsvValue).join(','),
        ...rows.map((row) => [
            row.gene_symbol || '',
            row.ensg_id || '',
            row.program_gene?.score ?? '',
            row.program_gene?.rank ?? '',
            row.program_gene?.direction || '',
            row.regulator?.score ?? '',
            row.regulator?.rank ?? '',
            row.regulator?.direction || '',
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function matchesProgramGeneRow(row, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;

    return [
        row?.gene_symbol,
        row?.ensg_id,
        row?.program_gene?.score,
        row?.program_gene?.rank,
        row?.program_gene?.direction,
        row?.regulator?.score,
        row?.regulator?.rank,
        row?.regulator?.direction,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

function formatPValue(value) {
    return formatScientificNumber(value, 2, '-');
}

function formatProgramGeneValue(value) {
    if (value == null || value === '') return '-';
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    if (Math.abs(number) >= 100) return number.toFixed(1);
    if (Math.abs(number) >= 1) return number.toFixed(3);
    return number.toPrecision(3);
}

function roleEvidenceValue(row, evidence, field) {
    const record = row?.[evidence];
    if (!record) return field === 'direction' ? '-' : null;
    return record[field];
}

function relationGroupTone(group) {
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

function relationHeaderSx(theme, baseSx, group, overrides = {}) {
    const tone = relationGroupTone(group);
    const boundary = overrides.boundary;
    const { boundary: unusedBoundary, ...restOverrides } = overrides;
    const { bgcolor: unusedBaseBgcolor, backgroundColor: unusedBaseBackgroundColor, ...baseWithoutBackground } = baseSx;
    void unusedBoundary;
    void unusedBaseBgcolor;
    void unusedBaseBackgroundColor;
    const headerBackground = overrides.top === DETAIL_TABLE_TITLE_HEADER_HEIGHT + 36 ? tone.subHeaderBg : tone.headerBg;
    return {
        ...baseWithoutBackground,
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

function relationCellSx(theme, baseSx, group, strong = false, boundary = false) {
    const tone = relationGroupTone(group);
    return {
        ...baseSx,
        bgcolor: strong ? tone.cellStrongBg : tone.cellBg,
        backgroundColor: strong ? tone.cellStrongBg : tone.cellBg,
        backgroundImage: 'none',
        borderLeft: boundary ? `1px solid ${tone.border}` : undefined,
    };
}

function relationIdentityHeaderSx(theme, baseSx, overrides = {}) {
    return relationHeaderSx(theme, baseSx, 'identity', overrides);
}

function programTableCellSx(theme, tone, align = 'left', overrides = {}) {
    const useDataFont = overrides.fontFamily === 'monospace';
    const { fontFamily, ...restOverrides } = overrides;
    return {
        py: 0.72,
        px: 1,
        textAlign: align,
        fontSize: '0.74rem',
        lineHeight: 1.32,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        bgcolor: tone.cellSoft,
        color: theme.palette.text.primary,
        verticalAlign: 'middle',
        overflow: 'visible',
        textOverflow: 'clip',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        ...restOverrides,
    };
}

function detailTableTitleCellSx(theme) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: '43 !important',
        height: DETAIL_TABLE_TITLE_HEADER_HEIGHT,
        py: 0.75,
        px: 1.25,
        bgcolor: theme.custom.surface.raised,
        backgroundColor: `${theme.custom.surface.raised} !important`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        color: theme.palette.text.primary,
    };
}

function detailTableColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: DETAIL_TABLE_TITLE_HEADER_HEIGHT,
    });
}

function detailTableCellSx(theme, tone, align = 'left', overrides = {}) {
    const useDataFont = overrides.fontFamily === 'monospace';
    const { fontFamily, ...restOverrides } = overrides;
    return {
        py: 0.78,
        px: 1,
        textAlign: align,
        fontSize: '0.74rem',
        lineHeight: 1.3,
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

function programTableColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: 0,
        height: 54,
        minHeight: 54,
        py: 0.45,
        whiteSpace: 'normal',
        overflow: 'visible',
        textOverflow: 'clip',
    });
}

function ProgramSummaryChips({ summary }) {
    const theme = useTheme();
    const items = [
        { label: 'Traits', value: summary?.totalTraits, tone: 'primary' },
        { label: 'Program Enriched', value: summary?.selectedByProgram, tone: 'warning' },
        { label: 'Regulator Enriched', value: summary?.selectedByRegulator, tone: 'primary' },
        { label: 'Both Enriched', value: summary?.bothSelected, tone: 'success' },
    ];

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(4, minmax(104px, 1fr))',
                    md: 'repeat(4, minmax(104px, 1fr))',
                    lg: 'repeat(4, minmax(116px, 1fr))',
                },
                gap: { xs: 0.75, md: 0.9 },
                width: '100%',
                minWidth: 0,
            }}
        >
            {items.map((item) => {
                const colors = metricChipTone(theme, item.tone);
                return (
                    <Box
                        key={item.label}
                        sx={{
                            px: { xs: 1, md: 1.15 },
                            py: { xs: 0.85, md: 0.95 },
                            minHeight: { xs: 58, md: 64 },
                            borderRadius: 1.2,
                            border: colors.border,
                            bgcolor: colors.backgroundColor,
                            color: colors.color,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: `0 6px 14px ${alpha(colors.color, 0.08)}`,
                                borderColor: alpha(colors.color, 0.32),
                            },
                        }}
                    >
                        <Typography sx={{ fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.08, fontWeight: 760, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>
                            {(Number(item.value) || 0).toLocaleString()}
                        </Typography>
                        <Typography sx={{ mt: 0.35, fontSize: '0.66rem', fontWeight: 650, letterSpacing: '0.04em', textTransform: 'none', color: alpha(colors.color, 0.82) }}>
                            {item.label}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
    );
}

const PROGRAM_PLACEHOLDERS = [
    'e.g. P21',
    'e.g. P1',
    'e.g. P5',
    'e.g. P10',
    'e.g. P50',
    'e.g. P80',
    'e.g. P120',
    'e.g. P150'
];

function ProgramSwitcher({ programOptions, selectedProgram, onSelect, onPreload }) {
    const theme = useTheme();
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const searchPlaceholder = PROGRAM_PLACEHOLDERS[placeholderIndex % PROGRAM_PLACEHOLDERS.length];

    useEffect(() => {
        const timer = setInterval(() => {
            setPlaceholderIndex((index) => (index + 1) % PROGRAM_PLACEHOLDERS.length);
        }, 3600);
        return () => clearInterval(timer);
    }, []);
    const [anchorEl, setAnchorEl] = useState(null);
    const [search, setSearch] = useState('');
    const interactive = programOptions.length > 0;
    const open = Boolean(anchorEl);
    const filteredProgramOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return programOptions;
        const normalizedId = query.replace(/^p/, '');
        return programOptions.filter((option) => (
            option.label.toLowerCase().includes(query)
            || option.annotation.toLowerCase().includes(query)
            || option.id.includes(normalizedId)
        ));
    }, [programOptions, search]);

    const closePopover = useCallback(() => {
        setAnchorEl(null);
        setSearch('');
    }, []);

    const handleSelect = useCallback((id) => {
        closePopover();
        onSelect?.(id);
    }, [closePopover, onSelect]);

    useEffect(() => {
        setAnchorEl(null);
        setSearch('');
    }, [selectedProgram?.id]);

    return (
        <>
            <ButtonBase
                onClick={(event) => {
                    if (interactive) setAnchorEl(event.currentTarget);
                }}
                disableRipple={!interactive}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1.5,
                    border: interactive ? `1px solid ${theme.custom.border.soft}` : 'none',
                    bgcolor: interactive ? alpha(theme.palette.primary.main, 0.015) : 'transparent',
                    transition: `all ${theme.custom.motion.swift}`,
                    '&:hover': interactive ? {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        borderColor: alpha(theme.palette.primary.main, 0.25),
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.06)}`,
                    } : undefined,
                }}
            >
                <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.35rem', md: '1.55rem' }, fontWeight: 800, color: '#173b35', lineHeight: 1 })}>
                    Program {selectedProgram?.label || '-'}
                </Typography>
                {interactive && <ExpandMore sx={{ color: theme.palette.text.secondary, flexShrink: 0 }} />}
            </ButtonBase>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                    sx: panelSx(theme, {
                        mt: 0.75,
                        width: { xs: 'min(92vw, 520px)', sm: 500 },
                        overflow: 'hidden',
                        boxShadow: theme.custom.shadow.float,
                    }),
                }}
            >
                <Box sx={sectionPanelHeaderSx(theme, { display: 'block', p: 1.25 })}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: theme.palette.text.primary }}>
                                Program list
                            </Typography>
                            <Typography sx={{ mt: 0.2, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                Browse by program id or annotation
                            </Typography>
                        </Box>
                        <Chip
                            label={`${filteredProgramOptions.length}/${programOptions.length}`}
                            size="small"
                            sx={summaryChipSx(theme, { ...metricChipTone(theme, 'warning'), flexShrink: 0 })}
                        />
                    </Box>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={searchPlaceholder}
                        InputProps={{
                            startAdornment: <Search fontSize="small" sx={{ color: theme.custom.chart.axisSoft, mr: 0.75 }} />,
                        }}
                    />
                </Box>

                <Box sx={{ maxHeight: 440, overflowY: 'auto', p: 1 }}>
                    {filteredProgramOptions.length > 0 ? filteredProgramOptions.map((option) => {
                        const selected = option.id === selectedProgram?.id;
                        return (
                            <ButtonBase
                                key={option.id}
                                onClick={() => handleSelect(option.id)}
                                onMouseEnter={() => onPreload?.(option.id)}
                                onFocus={() => onPreload?.(option.id)}
                                sx={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    px: 1.25,
                                    py: 1,
                                    mb: 0.75,
                                    borderRadius: 1,
                                    textAlign: 'left',
                                    border: selected ? `1px solid ${alpha(theme.palette.primary.main, 0.28)}` : `1px solid ${theme.custom.border.soft}`,
                                    backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
                                    transition: `transform ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        borderColor: alpha(theme.palette.primary.main, 0.24),
                                        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.1) : theme.custom.surface.raised,
                                        boxShadow: theme.custom.shadow.panel,
                                    },
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                                        {option.label}
                                    </Typography>
                                    <Typography sx={{ mt: 0.3, fontSize: '0.8rem', color: theme.palette.text.secondary, lineHeight: 1.45 }}>
                                        {option.annotation}
                                    </Typography>
                                </Box>
                            </ButtonBase>
                        );
                    }) : (
                        <Box sx={{ px: 1, py: 3, textAlign: 'center' }}>
                            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: theme.palette.text.primary }}>
                                No matching programs
                            </Typography>
                            <Typography sx={{ mt: 0.35, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                Try a shorter search or a program id.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Popover>
        </>
    );
}

function ProgramInfoTable({ row, loading, loadingCounts = false }) {
    const theme = useTheme();
    const fields = useMemo(() => [
        {
            key: 'program',
            label: 'Program ID',
            value: row?.program || '-',
            mono: true,
            accent: true,
        },
        {
            key: 'annotation',
            label: 'Function annotation',
            value: row?.annotation || '-',
            wrap: true,
        },
        {
            key: 'goTerm',
            label: 'Representative GO function',
            value: row?.goTerm || '-',
            href: row?.goTerm ? buildGoUrl(row.goAccession || row.goTerm) : '',
            wrap: true,
        },
        {
            key: 'goOntology',
            label: 'GO Ontology',
            value: row?.goOntology || '-',
        },
        {
            key: 'associatedGenes',
            label: 'Associated genes',
            value: Number(row?.associatedGenes || 0).toLocaleString(),
            loading: loadingCounts && row?.associatedGenes == null,
            mono: true,
        },
        {
            key: 'associatedTraits',
            label: 'Associated traits',
            value: Number(row?.associatedTraits || 0).toLocaleString(),
            loading: loadingCounts && row?.associatedTraits == null,
            mono: true,
        },
    ], [loadingCounts, row]);
    const handleDownload = useCallback(() => {
        const exportRow = fields.reduce((accumulator, field) => {
            accumulator[field.key] = field.value;
            return accumulator;
        }, {});
        downloadBlob(new Blob([buildProgramInfoCsv(exportRow)], { type: 'text/csv;charset=utf-8;' }), `${row?.program || 'program'}-information.csv`);
    }, [row, fields]);

    const skeletonRows = Array.from({ length: PROGRAM_INFO_FIELDS.length }, (_, index) => (
        <TableRow key={index}>
            <TableCell sx={{ width: 220, py: 1, px: 1.25, bgcolor: theme.custom.surface.subtle }}>
                <Skeleton width="62%" />
            </TableCell>
            <TableCell sx={{ py: 1, px: 1.35 }}>
                <Skeleton width={index === 1 ? '78%' : '42%'} />
            </TableCell>
        </TableRow>
    ));

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: { xs: 760, lg: 'unset' } })}>
                    <colgroup>
                        <col style={{ width: 220 }} />
                        <col />
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell colSpan={2} sx={detailTableTitleCellSx(theme)}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.94rem', lineHeight: 1.2 })}>
                                            Program Information
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                                        <Button
                                            size="small"
                                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                            onClick={handleDownload}
                                            sx={{
                                                textTransform: 'none',
                                                fontSize: '0.72rem',
                                                color: theme.palette.text.secondary,
                                                flexShrink: 0,
                                            }}
                                        >
                                            CSV
                                        </Button>
                                    </Stack>
                                </Stack>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? skeletonRows : fields.map((field, index) => (
                            <TableRow
                                key={field.key}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell
                                    align="center"
                                    sx={{
                                        width: 220,
                                        px: 1.25,
                                        py: 1,
                                        textAlign: 'center',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        color: '#334155',
                                        bgcolor: theme.custom.surface.subtle,
                                        borderRight: `1px solid ${theme.custom.border.soft}`,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        fontSize: '0.76rem',
                                        fontWeight: 720,
                                        letterSpacing: '0.01em',
                                    }}
                                >
                                    {field.label}
                                </TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        py: 1.05,
                                        px: 1.35,
                                        fontSize: '0.82rem',
                                        lineHeight: 1.42,
                                        fontVariantNumeric: field.mono ? 'tabular-nums' : undefined,
                                        fontFeatureSettings: field.mono ? '"tnum" 1' : undefined,
                                        fontWeight: field.accent ? 750 : 500,
                                        color: field.accent ? '#245089' : theme.palette.text.primary,
                                        bgcolor: theme.palette.background.paper,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        textAlign: 'center',
                                        whiteSpace: field.wrap ? 'normal' : 'nowrap',
                                        wordBreak: field.wrap ? 'break-word' : 'normal',
                                        verticalAlign: 'middle',
                                    }}
                                >
                                    {field.loading ? (
                                        <Skeleton width={64} sx={{ mx: 'auto' }} />
                                    ) : field.href ? (
                                        <Button
                                            component="a"
                                            href={field.href}
                                            target="_blank"
                                            rel="noreferrer"
                                            endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
                                            sx={{ textTransform: 'none', px: 0.5, py: 0.2, color: '#245089', fontWeight: 680, fontSize: '0.78rem', lineHeight: 1.3 }}
                                        >
                                            {field.value}
                                        </Button>
                                    ) : field.value}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function ProgramGenesTable({ programId }) {
    const theme = useTheme();
    const tones = {
        annotation: tableTone(theme, 'warning'),
        metric: tableTone(theme, 'warning'),
    };
    const [sortBy, setSortBy] = useState('gene_symbol');
    const [sortDir, setSortDir] = useState('asc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(RELATION_ROWS_PER_PAGE);
    const [searchQuery, setSearchQuery] = useState('');
    const geneKey = programId ? ['program-gene-roles', programId] : null;
    const geneResource = useCachedResourceState(
        useSWR(geneKey, ([, id]) => getProgramGeneRoles(id), relationIndexSWRConfig),
        { cacheKey: geneKey, retainPreviousData: false },
    );
    const { displayData: data, error, isInitialLoading: isLoading, isRefreshing } = geneResource;

    const rows = useMemo(() => {
        const source = data?.roles || data?.genes || [];
        return groupProgramGeneRows(source).sort((a, b) => compareProgramGeneRows(a, b, sortBy, sortDir));
    }, [data?.genes, data?.roles, sortBy, sortDir]);
    const filteredRows = useMemo(
        () => rows.filter((row) => matchesProgramGeneRow(row, searchQuery)),
        [rows, searchQuery],
    );
    const shouldPaginate = filteredRows.length > RELATION_PAGINATION_THRESHOLD;
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
    const currentPage = shouldPaginate ? Math.min(page, pageCount - 1) : 0;
    const start = shouldPaginate ? currentPage * rowsPerPage : 0;
    const visibleRows = shouldPaginate ? filteredRows.slice(start, start + rowsPerPage) : filteredRows;

    useEffect(() => {
        setPage(0);
    }, [programId, sortBy, sortDir]);

    useEffect(() => {
        setPage(0);
    }, [searchQuery]);

    const handleSort = useCallback((key) => {
        if (sortBy === key) {
            setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(key);
        setSortDir(['loading_gene_score', 'regulator_score'].includes(key) ? 'desc' : 'asc');
    }, [sortBy]);

    const handleDownload = useCallback(() => {
        downloadBlob(new Blob([buildProgramGeneCsv(filteredRows)], { type: 'text/csv;charset=utf-8;' }), `${programId || 'program'}-gene-roles.csv`);
    }, [filteredRows, programId]);

    const skeletonRows = Array.from({ length: 8 }, (_, index) => (
        <TableRow key={index}>
            {PROGRAM_GENE_COLUMNS.map((column) => (
                <TableCell key={column.key} align={column.align} sx={{ py: 1.1, px: 1 }}>
                    <Skeleton />
                </TableCell>
            ))}
        </TableRow>
    ));

    if (error) {
        return (
            <Paper elevation={0} sx={panelSx(theme, { p: 1.5 })}>
                <Typography sx={{ color: theme.palette.error.main, fontWeight: 680 }}>Failed to load program gene roles.</Typography>
            </Paper>
        );
    }

    if (data?.unavailable) {
        return (
            <Paper elevation={0} sx={panelSx(theme, { p: 1.5 })}>
                <Typography sx={{ color: theme.palette.warning.dark, fontWeight: 680 }}>Program gene role SQL index is not available.</Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: { xs: 850, lg: 850 } })}>
                    <colgroup>
                        {PROGRAM_GENE_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell colSpan={PROGRAM_GENE_COLUMNS.length} sx={detailTableTitleCellSx(theme)}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.94rem', lineHeight: 1.2 })}>
                                            Program Genes and Regulators
                                        </Typography>
                                    </Box>
                                    <Box sx={tableToolbarGroupSx(theme, {
                                        width: { xs: '100%', md: 'auto' },
                                        minWidth: 0,
                                        px: 0,
                                        py: 0,
                                        border: 'none',
                                        background: 'transparent',
                                        boxShadow: 'none',
                                        '& .MuiTextField-root': {
                                            flex: { xs: '1 1 100%', sm: '1 1 240px' },
                                            minWidth: { xs: 0, sm: 220 },
                                            maxWidth: '100%',
                                        },
                                    })}
                                    >
                                        <UpdatingStatus active={isRefreshing} reserveSpace />
                                        <TableSearchField
                                            label="Search"
                                            value={searchQuery}
                                            placeholder="Gene, ENSG, role, score"
                                            onChange={setSearchQuery}
                                            onClear={() => setSearchQuery('')}
                                            width={{ xs: '100%', sm: 240 }}
                                        />
                                        <Button
                                            size="small"
                                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                            onClick={handleDownload}
                                            disabled={!filteredRows.length}
                                            sx={tableToolbarActionButtonSx(theme)}
                                        >
                                            Export CSV
                                        </Button>
                                    </Box>
                                </Stack>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_GENE_COLUMNS.slice(0, 2).map((column) => (
                                <TableCell
                                    key={column.key}
                                    align={column.align}
                                    rowSpan={2}
                                    sx={relationIdentityHeaderSx(theme, detailTableColumnHeaderSx(theme, tones.metric, column.align), {
                                        minWidth: column.width,
                                        whiteSpace: 'nowrap',
                                    })}
                                >
                                    <Tooltip title={PROGRAM_GENE_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...programSortLabelSx, justifyContent: justifyForAlign(column.align) }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </Tooltip>
                                </TableCell>
                            ))}
                            <TableCell
                                align="center"
                                colSpan={3}
                                sx={relationHeaderSx(theme, detailTableColumnHeaderSx(theme, tones.metric, 'center', { fontSize: '0.72rem' }), 'loading_gene', { boundary: true })}
                            >
                                <Tooltip title={PROGRAM_GENE_COLUMN_DESCRIPTIONS.loading_gene} arrow>
                                    <Box component="span">loading_gene</Box>
                                </Tooltip>
                            </TableCell>
                            <TableCell
                                align="center"
                                colSpan={3}
                                sx={relationHeaderSx(theme, detailTableColumnHeaderSx(theme, tones.metric, 'center', { fontSize: '0.72rem' }), 'regulator', { boundary: true })}
                            >
                                <Tooltip title={PROGRAM_GENE_COLUMN_DESCRIPTIONS.regulator} arrow>
                                    <Box component="span">regulator</Box>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_GENE_COLUMNS.slice(2).map((column) => {
                                const group = column.key.startsWith('regulator') ? 'regulator' : 'loading_gene';
                                return (
                                <TableCell
                                    key={column.key}
                                    align={column.align}
                                    sx={relationHeaderSx(theme, detailTableColumnHeaderSx(theme, tones[column.tone], column.align), group, {
                                        boundary: column.key === 'loading_gene_score' || column.key === 'regulator_score',
                                        top: DETAIL_TABLE_TITLE_HEADER_HEIGHT + 36,
                                        minWidth: column.width,
                                        whiteSpace: column.key.endsWith('direction') ? 'normal' : 'nowrap',
                                    })}
                                >
                                    <Tooltip title={PROGRAM_GENE_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...programSortLabelSx, justifyContent: justifyForAlign(column.align) }}
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
                        {isLoading ? skeletonRows : visibleRows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={PROGRAM_GENE_COLUMNS.length}
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
                        ) : visibleRows.map((item, index) => (
                            <TableRow
                                key={`${item.ensg_id || item.gene_symbol}-${index}`}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center'), 'identity', true)}>
                                    <Button
                                        component={RouterLink}
                                        to={`/genes?query=${encodeURIComponent(item.gene_symbol || item.ensg_id)}`}
                                        sx={{ textTransform: 'none', px: 0, py: 0, minHeight: 0, color: theme.palette.primary.dark, fontWeight: 700, fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                                    >
                                        {item.gene_symbol || '-'}
                                    </Button>
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', {
                                    fontFamily: 'monospace',
                                    fontSize: '0.7rem',
                                    whiteSpace: 'nowrap',
                                }), 'identity')}>
                                    {item.ensg_id || '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', { fontFamily: 'monospace', fontWeight: 700 }), 'loading_gene', false, true)}>
                                    {formatProgramGeneValue(roleEvidenceValue(item, 'program_gene', 'score'))}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', { fontFamily: 'monospace', fontWeight: 700 }), 'loading_gene', true)}>
                                    {roleEvidenceValue(item, 'program_gene', 'rank') ?? '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', { whiteSpace: 'normal' }), 'loading_gene')}>
                                    {roleEvidenceValue(item, 'program_gene', 'direction') || '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', { fontFamily: 'monospace', fontWeight: 700 }), 'regulator', true, true)}>
                                    {formatProgramGeneValue(roleEvidenceValue(item, 'regulator', 'score'))}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', { fontFamily: 'monospace', fontWeight: 700 }), 'regulator')}>
                                    {roleEvidenceValue(item, 'regulator', 'rank') ?? '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, detailTableCellSx(theme, tones.metric, 'center', { whiteSpace: 'normal' }), 'regulator', true)}>
                                    {roleEvidenceValue(item, 'regulator', 'direction') || '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {shouldPaginate && (
                <TablePagination
                    component="div"
                    count={filteredRows.length}
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

export default function Programs() {
    const theme = useTheme();
    const { cache, mutate } = useSWRConfig();
    const geneSearchPlaceholder = 'Search gene, ENSG, annotation';
    const programTableTones = {
        identity: tableTone(theme, 'warning'),
        annotation: tableTone(theme, 'warning'),
        metric: tableTone(theme, 'warning'),
        genes: tableTone(theme, 'warning'),
    };
    const { programId } = useParams();
    const navigate = useNavigate();
    const infoResource = useCachedResourceState(
        useSWR('/api/programs/info', fetcher, detailSummarySWRConfig),
        { cacheKey: '/api/programs/info' },
    );
    const { displayData: info, isInitialLoading: loading } = infoResource;
    const regulationListResource = useCachedResourceState(
        useSWR('/api/regulation/list', fetcher, detailSummarySWRConfig),
        { cacheKey: '/api/regulation/list' },
    );
    const programs = regulationListResource.displayData?.programs || EMPTY_PROGRAM_LIST;
    const [programGeneInput, setProgramGeneInput] = useState('');
    const [sortBy, setSortBy] = useState('program');
    const [sortDir, setSortDir] = useState('asc');
    const programGeneSearch = programGeneInput.trim();
    const normalizedProgramId = programId
        ? (/^P/i.test(programId) ? programId : `P${programId}`)
        : null;
    const programNumber = normalizedProgramId ? normalizedProgramId.replace(/^P/i, '') : '';
    const traitKey = normalizedProgramId ? ['program-scatter-traits', normalizedProgramId] : null;
    const traitResource = useCachedResourceState(
        useSWR(traitKey, ([, id]) => getProgramScatterTraits(id), relationIndexSWRConfig),
        { cacheKey: traitKey, retainPreviousData: false },
    );
    const { displayData: traitData, error: traitError, isInitialLoading: traitLoading, isRefreshing: traitRefreshing } = traitResource;
    const detailGeneKey = normalizedProgramId ? ['program-gene-roles', normalizedProgramId] : null;
    const detailGeneResource = useCachedResourceState(
        useSWR(detailGeneKey, ([, id]) => getProgramGeneRoles(id), relationIndexSWRConfig),
        { cacheKey: detailGeneKey, retainPreviousData: false },
    );
    const { displayData: geneData, isInitialLoading: geneLoading, isRefreshing: geneRefreshing } = detailGeneResource;
    const detailStage = useStagedMount(
        normalizedProgramId ? `program-detail-${normalizedProgramId}` : 'program-index',
        normalizedProgramId ? PROGRAM_DETAIL_STAGE_COUNT : 0,
    );

    useEffect(() => {
        const preloadQueue = PROGRAM_DETAIL_PRELOADERS.map((_, index) => index);
        let cancelled = false;
        let cancelIdleTask = () => { };

        const preloadNext = () => {
            if (cancelled || preloadQueue.length === 0) return;

            const nextIndex = preloadQueue.shift();
            cancelIdleTask = scheduleIdleTask(() => {
                preloadProgramDetail(nextIndex)?.catch(() => { });
                preloadNext();
            }, 1400);
        };

        preloadNext();

        return () => {
            cancelled = true;
            cancelIdleTask();
        };
    }, []);

    const rows = useMemo(() => {
        const query = programGeneSearch.trim().toLowerCase();
        const items = Object.entries(info || {}).map(([k, v]) => ({
            key: k,
            ...v,
            go_term: v?.go_term || v?.representative_go || '',
            go_accession: v?.go_accession || extractGoAccession(v?.representative_go),
            go_ontology: v?.go_ontology || '',
            representativeGenes: normalizeRepresentativeGenes(v?.representative_genes).slice(0, 10),
        }));
        const filteredItems = query
            ? items.filter((item) => item.representativeGenes.some((gene) => [
                gene.label,
                gene.query,
                gene.geneSymbol,
                gene.ensgId,
            ].some((value) => String(value || '').toLowerCase().includes(query))))
            : items;
        const dir = sortDir === 'asc' ? 1 : -1;
        filteredItems.sort((a, b) => {
            if (sortBy === 'program') return numSort(a.program, b.program) * dir;
            if (sortBy === 'go_enrichment_p') return compareValues(a.go_enrichment_p, b.go_enrichment_p, 'number', sortDir);
            return compareValues(a[sortBy], b[sortBy], 'text', sortDir);
        });
        return filteredItems;
    }, [info, programGeneSearch, sortBy, sortDir]);
    const programRenderKey = `${programGeneSearch}|${sortBy}|${sortDir}|${rows.map((row) => row.program).join(',')}`;
    const renderedProgramRowCount = useProgressiveCount(loading ? 0 : rows.length, {
        resetKey: programRenderKey,
        initialCount: PROGRAM_INITIAL_RENDER_ROWS,
        step: PROGRAM_RENDER_STEP,
    });
    const visibleProgramRows = rows.slice(0, renderedProgramRowCount);

    const selectedProgramInfo = info?.[normalizedProgramId] || info?.[programNumber] || {};
    const annotation = traitData?.program?.annotation || selectedProgramInfo?.curated_annotation || '';
    const roleRows = geneData ? (geneData.roles || geneData.genes || []) : null;
    const detailSummary = {
        ...(traitData?.summary || {}),
        totalGenes: roleRows?.length ?? traitData?.summary?.totalGenes ?? 0,
    };
    const detailInfoRow = normalizedProgramId ? {
        program: normalizedProgramId,
        annotation,
        goTerm: selectedProgramInfo?.go_term || selectedProgramInfo?.representative_go || geneData?.program?.representativeGo || '',
        goAccession: selectedProgramInfo?.go_accession || extractGoAccession(selectedProgramInfo?.go_term || selectedProgramInfo?.representative_go || geneData?.program?.representativeGo),
        goOntology: selectedProgramInfo?.go_ontology || '',
        associatedGenes: roleRows?.length ?? null,
        associatedTraits: traitData?.summary?.totalTraits ?? null,
    } : null;
    const programOptions = useMemo(() => {
        const seen = new Set();
        const sourceIds = programs.length > 0
            ? programs.map((item) => item?.id)
            : Object.keys(info || {}).map((key) => String(key).replace(/^P/i, ''));

        return sourceIds
            .map((rawId) => {
                const id = String(rawId || '').replace(/^P/i, '').trim();
                if (!id || seen.has(id)) return null;
                seen.add(id);
                const record = info?.[`P${id}`] || info?.[id];
                return {
                    id,
                    label: `P${id}`,
                    annotation: record?.curated_annotation || 'Unannotated',
                };
            })
            .filter(Boolean)
            .sort((a, b) => Number(a.id) - Number(b.id));
    }, [info, programs]);
    const selectedProgramOption = useMemo(() => {
        if (!normalizedProgramId) return null;
        return programOptions.find((item) => item.id === String(programNumber || '')) || {
            id: String(programNumber || ''),
            label: normalizedProgramId,
            annotation: annotation || 'Program annotation is not available',
        };
    }, [annotation, normalizedProgramId, programNumber, programOptions]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const clearProgramGeneSearch = useCallback(() => {
        setProgramGeneInput('');
    }, []);

    const handleProgramTableDownload = useCallback(() => {
        const csv = buildProgramTableCsv(rows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'program-annotations.csv');
    }, [rows]);

    const handleProgramSelect = useCallback((id) => {
        navigate(`/programs/P${id}`);
    }, [navigate]);

    const preloadProgram = useCallback((rawId) => {
        const id = String(rawId || '').replace(/^P/i, '').trim();
        if (!id) return;

        PROGRAM_DETAIL_PRELOADERS.forEach((_, index) => {
            preloadProgramDetail(index)?.catch(() => { });
        });

        const normalizedId = `P${id}`;
        const traitPrefetchKey = ['program-scatter-traits', normalizedId];
        const genePrefetchKey = ['program-gene-roles', normalizedId];
        const hasTraitData = cache.get(unstable_serialize(traitPrefetchKey)) !== undefined;
        const hasGeneData = cache.get(unstable_serialize(genePrefetchKey)) !== undefined;
        if (hasTraitData && hasGeneData) return;
        if (prefetchedProgramData.has(normalizedId)) return;
        prefetchedProgramData.add(normalizedId);

        const tasks = [];
        if (!hasTraitData) {
            tasks.push(mutate(traitPrefetchKey, getProgramScatterTraits(normalizedId), {
                populateCache: true,
                revalidate: false,
            }));
        }
        if (!hasGeneData) {
            tasks.push(mutate(genePrefetchKey, getProgramGeneRoles(normalizedId), {
                populateCache: true,
                revalidate: false,
            }));
        }

        Promise.allSettled(tasks).finally(() => {
            prefetchedProgramData.delete(normalizedId);
        });
    }, [cache, mutate]);

    if (programId) {
        return (
            <Box sx={{
                width: '100%',
                maxWidth: DATA_PAGE_MAX_WIDTH,
                minWidth: 0,
                mx: 'auto',
                px: { xs: 1.5, sm: 2, md: 3, xl: 4 },
                py: { xs: 1.5, md: 2.5, xl: 3 },
                '@media (min-width: 2200px)': {
                    px: 5,
                },
            }}>
                <Paper
                    elevation={0}
                    sx={panelSx(theme, {
                        p: { xs: 1.5, md: 2 },
                        bgcolor: theme.palette.background.paper,
                        boxShadow: '0 10px 22px rgba(15, 23, 42, 0.045)',
                        mb: 1.5,
                    })}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={{ xs: 1.5, md: 1.9 }}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box
                            sx={{
                                minWidth: 0,
                                width: 'auto',
                                flex: { xs: '1 1 auto', md: '0 1 auto' },
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                            }}
                        >
                            <ProgramSwitcher
                                programOptions={programOptions}
                                selectedProgram={selectedProgramOption}
                                onSelect={handleProgramSelect}
                                onPreload={preloadProgram}
                            />
                            <UpdatingStatus active={traitRefreshing || geneRefreshing} />
                        </Box>
                        <Box
                            sx={{
                                minWidth: 0,
                                flex: { xs: '1 1 auto', md: '1 1 0%' },
                                maxWidth: { md: 560 },
                                width: '100%',
                            }}
                        >
                            <ProgramSummaryChips summary={detailSummary} />
                        </Box>
                    </Stack>
                </Paper>

                {traitError && (
                    <Paper elevation={0} sx={panelSx(theme, { p: 2, mb: 1.5 })}>
                        <Typography sx={{ color: theme.palette.error.main, fontWeight: 700 }}>Failed to load program trait index.</Typography>
                    </Paper>
                )}

                <Stack spacing={1.5}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: 'minmax(0, 1fr)',
                            },
                            gap: 1.5,
                            alignItems: 'start',
                            minWidth: 0,
                            '& > *': {
                                minWidth: 0,
                            },
                        }}
                    >
                        <DeferredProgramPanel ready={detailStage >= 1} minHeight={260}>
                            <ProgramInfoTable
                                row={detailInfoRow}
                                loading={loading}
                                loadingCounts={traitLoading || geneLoading}
                            />
                        </DeferredProgramPanel>
                        <DeferredProgramPanel ready={detailStage >= 3} minHeight={420}>
                            <React.Suspense fallback={<ProgramDetailFallback minHeight={420} />}>
                                <GeneRegulation programId={programNumber} />
                            </React.Suspense>
                        </DeferredProgramPanel>
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: 'minmax(0, 1fr)',
                            },
                            gap: 1.5,
                            alignItems: 'start',
                            minWidth: 0,
                            '& > *': {
                                minWidth: 0,
                            },
                        }}
                    >
                        <DeferredProgramPanel ready={detailStage >= 2} minHeight={520}>
                            <ProgramGenesTable programId={normalizedProgramId} />
                        </DeferredProgramPanel>
                        <DeferredProgramPanel ready={detailStage >= 4} minHeight={520}>
                            <React.Suspense fallback={<ProgramDetailFallback minHeight={520} />}>
                                <ProgramAssociatedTraits
                                    programId={normalizedProgramId}
                                />
                            </React.Suspense>
                        </DeferredProgramPanel>
                    </Box>
                </Stack>
            </Box>
        );
    }

    const skeleton = Array.from({ length: 12 }, (_, i) => (
        <TableRow key={i}>
            {PROGRAM_TABLE_COLUMNS.map((column) => (
                <TableCell key={column.key} sx={{ py: 1.2, px: 2 }}>
                    <Skeleton />
                </TableCell>
            ))}
        </TableRow>
    ));

    return (
        <PageFrame
            title={null}
            subtitle={null}
            maxWidth={DATA_PAGE_MAX_WIDTH}
            compact
        >
            <Paper elevation={0} sx={panelSx(theme, {
                overflow: 'hidden',
                borderColor: alpha('#d97706', 0.18),
                background: `linear-gradient(180deg, ${alpha('#d97706', 0.035)} 0%, ${theme.palette.background.paper} 150px)`,
            })}>
                <Box
                    sx={mainTableToolbarSx(theme)}
                >
                    <Stack
                        direction="row"
                        spacing={0.55}
                        alignItems="center"
                        sx={mainTableToolbarTitleSlotSx(theme, { gap: 0.55 })}
                    >
                        <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.08rem', md: '1.22rem' }, color: '#7c4d12', lineHeight: 1.15 })}>
                            Program
                        </Typography>
                        {programGeneSearch && (
                            <Chip
                                label={`Gene: ${programGeneSearch}`}
                                size="small"
                                onDelete={clearProgramGeneSearch}
                                sx={summaryChipSx(theme, {
                                    height: 22,
                                    maxWidth: { xs: '100%', sm: 220 },
                                    color: '#2f6a49',
                                    bgcolor: alpha('#2f6a49', 0.075),
                                    border: `1px solid ${alpha('#2f6a49', 0.18)}`,
                                    '& .MuiChip-label': {
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    },
                                })}
                            />
                        )}
                    </Stack>
                    <Box
                        sx={mainTableToolbarSearchSlotSx(theme)}
                    >
                        <TextField
                            size="small"
                            value={programGeneInput}
                            onChange={(event) => setProgramGeneInput(event.target.value)}
                            placeholder={geneSearchPlaceholder}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchOutlined fontSize="small" sx={{ color: '#7c4d12' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment
                                        position="end"
                                        sx={{
                                            minWidth: 30,
                                            justifyContent: 'flex-end',
                                            visibility: programGeneInput || programGeneSearch ? 'visible' : 'hidden',
                                            pointerEvents: programGeneInput || programGeneSearch ? 'auto' : 'none',
                                        }}
                                    >
                                        <IconButton
                                            size="small"
                                            aria-label="Clear program gene search"
                                            onClick={clearProgramGeneSearch}
                                            edge="end"
                                            sx={{ width: 24, height: 24 }}
                                        >
                                            <Clear fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            sx={mainTableSearchFieldSx(theme, '#7c4d12')}
                        />
                    </Box>
                    <Box
                        sx={mainTableToolbarActionsSx(theme)}
                    >
                        <Button
                            size="small"
                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                            onClick={handleProgramTableDownload}
                            disabled={!rows.length}
                            sx={mainTableActionButtonSx(theme, '#7c4d12')}
                        >
                            Export CSV
                        </Button>
                    </Box>
                </Box>
                <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'hidden' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { width: '100%', tableLayout: 'fixed' })}>
                        <colgroup>
                            {PROGRAM_TABLE_COLUMNS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                {PROGRAM_TABLE_COLUMNS.map((column) => (
                                    <TableCell
                                        key={column.key}
                                        sx={programTableColumnHeaderSx(theme, programTableTones[column.tone], column.align)}
                                    >
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...programSortLabelSx, justifyContent: justifyForAlign(column.align) }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? skeleton : visibleProgramRows.length === 0 && rows.length > 0 ? (
                                <TableRow aria-hidden="true">
                                    <TableCell
                                        colSpan={PROGRAM_TABLE_COLUMNS.length}
                                        sx={{ height: 420, p: 0, borderBottom: 0 }}
                                    />
                                </TableRow>
                            ) : visibleProgramRows.map((r, i) => (
                                <TableRow
                                    key={r.program}
                                    hover
                                    sx={{
                                        ...tableRowRevealSx(theme, i, {
                                            disableReveal: i >= PROGRAM_INITIAL_RENDER_ROWS,
                                        }),
                                        '&:hover td': {
                                            backgroundColor: alpha('#d97706', 0.08),
                                        },
                                    }}>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.identity, 'center', { bgcolor: programTableTones.identity.cellStrong })}>
                                        <Button
                                            component={RouterLink}
                                            to={`/programs/${r.program}`}
                                            onMouseEnter={() => preloadProgram(r.program)}
                                            onFocus={() => preloadProgram(r.program)}
                                            sx={{
                                                textTransform: 'none',
                                                px: 0,
                                                py: 0,
                                                minHeight: 0,
                                                justifyContent: 'center',
                                                color: '#7c4d12',
                                                fontVariantNumeric: 'tabular-nums',
                                                fontFeatureSettings: '"tnum" 1',
                                                fontWeight: 700,
                                                fontSize: '0.76rem',
                                            }}
                                        >
                                            {r.program}
                                        </Button>
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.annotation, 'left', { whiteSpace: 'normal' })}>
                                        {r.curated_annotation ? (
                                            <Button
                                                component={RouterLink}
                                                to={`/programs/${r.program}`}
                                                onMouseEnter={() => preloadProgram(r.program)}
                                                onFocus={() => preloadProgram(r.program)}
                                                sx={{
                                                    textTransform: 'none',
                                                    px: 0,
                                                    py: 0,
                                                    minHeight: 0,
                                                    justifyContent: 'flex-start',
                                                    textAlign: 'left',
                                                    whiteSpace: 'normal',
                                                    color: theme.palette.text.primary,
                                                    fontSize: '0.74rem',
                                                    lineHeight: 1.35,
                                                    fontWeight: 500,
                                                    '&:hover': {
                                                        color: '#7c4d12',
                                                        textDecoration: 'underline',
                                                        backgroundColor: 'transparent',
                                                    },
                                                }}
                                            >
                                                {r.curated_annotation}
                                            </Button>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell sx={{ ...programTableCellSx(theme, programTableTones.annotation, 'left', { whiteSpace: 'normal' }), bgcolor: programTableTones.annotation.cellStrong }}>
                                        {r.go_term ? (
                                            <Button
                                                component="a"
                                                href={buildGoUrl(r.go_accession || r.go_term)}
                                                target="_blank"
                                                rel="noreferrer"
                                                endIcon={<OpenInNew sx={{ fontSize: 11 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    px: 0,
                                                    py: 0,
                                                    minHeight: 0,
                                                    justifyContent: 'flex-start',
                                                    alignItems: 'flex-start',
                                                    whiteSpace: 'normal',
                                                    textAlign: 'left',
                                                    color: programTableTones.annotation.headerColor,
                                                    fontWeight: 680,
                                                    fontSize: '0.7rem',
                                                    lineHeight: 1.25,
                                                }}
                                            >
                                                {r.go_term}
                                            </Button>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.metric, 'center', { fontFamily: 'monospace', fontSize: '0.7rem' })}>
                                        {r.go_accession || '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.metric, 'center', { whiteSpace: 'normal', overflowWrap: 'anywhere' })}>
                                        {r.go_ontology || '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.metric, 'center', { bgcolor: programTableTones.metric.cellStrong, fontFamily: 'monospace', fontWeight: 680 })}>
                                        {formatPValue(r.go_enrichment_p)}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.genes, 'left', { whiteSpace: 'normal' })}>
                                        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                            {r.representativeGenes.map((gene) => (
                                                <Chip
                                                    key={`${r.program}-${gene.query}`}
                                                    label={gene.label}
                                                    size="small"
                                                    component={RouterLink}
                                                    to={`/genes?query=${encodeURIComponent(gene.query)}`}
                                                    clickable
                                                    sx={{
                                                        ...summaryChipSx(theme, {
                                                            color: '#7c4d12',
                                                            bgcolor: alpha('#facc15', 0.18),
                                                            border: `1px solid ${alpha('#d97706', 0.28)}`,
                                                        }),
                                                        height: 22,
                                                        fontSize: '0.64rem',
                                                        fontWeight: 700,
                                                        '& .MuiChip-label': {
                                                            px: 0.9,
                                                        },
                                                        '&:hover': {
                                                            bgcolor: alpha('#facc15', 0.26),
                                                            borderColor: alpha('#d97706', 0.38),
                                                        },
                                                    }}
                                                />
                                            ))}
                                            {r.representativeGenes.length === 0 && '-'}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </PageFrame>
    );
}
