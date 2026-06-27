import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Pagination from '@mui/material/Pagination';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import Clear from '@mui/icons-material/Clear';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import ExpandMore from '@mui/icons-material/ExpandMore';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import ManageSearchOutlined from '@mui/icons-material/ManageSearchOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import useSWR from 'swr';
import { getGeneAssociationTraits, getGeneOverview, getGeneProgramRoles, getGenes, searchGenes } from '../api/gwas';
import { PageFrame, StatePanel, UpdatingStatus } from '../components/PageScaffold';
import TableSearchField from '../components/TableSearchField';
import { downloadBlob } from '../utils/download';
import { detailSummarySWRConfig, interactiveSearchSWRConfig, stableListSWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import {
    captionSx,
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
    stickyTableHeaderCellSx,
    summaryChipSx,
    tableToolbarActionButtonSx,
    tableToolbarGroupSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatSigned(value, digits = 3) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function useDebouncedValue(value, delayMs = 280) {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    React.useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => window.clearTimeout(timeoutId);
    }, [delayMs, value]);

    return debouncedValue;
}

function GenePaginationControl({ totalPages, page, onChange, size = 'small', disabled = false }) {
    const pageCount = Math.max(Number(totalPages) || 1, 1);
    const currentPage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
            <Pagination
                count={pageCount}
                page={currentPage + 1}
                onChange={(event, value) => onChange(event, value - 1)}
                color="primary"
                disabled={disabled}
                shape="rounded"
                size={size}
                siblingCount={0}
                boundaryCount={1}
                sx={{
                    '& .MuiPagination-ul': {
                        flexWrap: 'nowrap',
                    },
                    '& .MuiPaginationItem-root': {
                        minWidth: 26,
                        height: 28,
                        fontSize: '0.74rem',
                    },
                }}
            />
        </Box>
    );
}

function GeneRowsControl({ rowsPerPage, onChange, showLabel = true, options = [25, 50, 100, 200], disabled = false }) {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.7, flexShrink: 0, minHeight: 32 }}>
            {showLabel ? (
                <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 650, whiteSpace: 'nowrap' }}>
                    Per page
                </Typography>
            ) : null}
            <FormControl size="small" sx={{ minWidth: showLabel ? 72 : 94 }}>
                <Select
                    value={rowsPerPage}
                    onChange={(event) => onChange(Number(event.target.value))}
                    disabled={disabled}
                    inputProps={{ 'aria-label': 'Rows per page' }}
                    renderValue={showLabel ? undefined : (value) => `${value} / page`}
                    sx={{
                        height: 32,
                        bgcolor: theme.palette.background.paper,
                        fontSize: '0.78rem',
                        fontWeight: 650,
                        '& .MuiSelect-select': { py: 0.45, display: 'flex', alignItems: 'center' },
                    }}
                >
                    {options.map((value) => (
                        <MenuItem key={value} value={value} dense>{value}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}

function GeneHeaderPageControl({ totalPages, page, onChange, disabled = false }) {
    const pageCount = Math.max(Number(totalPages) || 1, 1);
    const [inputPage, setInputPage] = React.useState(page + 1);
    const pageNumber = Number(inputPage);
    const canPage = !disabled && pageCount > 1;
    const isValid = inputPage !== ''
        && Number.isInteger(pageNumber)
        && pageNumber >= 1
        && pageNumber <= pageCount;

    React.useEffect(() => {
        setInputPage(page + 1);
    }, [page]);

    const commitPage = () => {
        if (canPage && isValid) {
            onChange(null, pageNumber - 1);
            return;
        }
        setInputPage(page + 1);
    };

    return (
        <Box
            component="form"
            onSubmit={(event) => {
                event.preventDefault();
                commitPage();
            }}
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 32,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                flexShrink: 0,
            }}
        >
            <IconButton
                size="small"
                aria-label="Previous page"
                disabled={!canPage || page <= 0}
                onClick={() => onChange(null, page - 1)}
                sx={{ width: 31, height: 30, borderRadius: 0 }}
            >
                <KeyboardArrowLeft fontSize="small" />
            </IconButton>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.35, px: 0.65, borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 650 }}>
                    Page
                </Typography>
                <TextField
                    size="small"
                    value={inputPage}
                    disabled={!canPage}
                    onChange={(event) => setInputPage(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            commitPage();
                        }
                    }}
                    onBlur={commitPage}
                    inputProps={{
                        'aria-label': 'Page number',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                    }}
                    sx={{
                        width: 38,
                        '& .MuiOutlinedInput-root': {
                            height: 30,
                            bgcolor: 'transparent',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                            border: 0,
                        },
                        '& .MuiOutlinedInput-input': {
                            py: 0,
                            px: 0.25,
                            textAlign: 'center',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                        },
                    }}
                />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 650, whiteSpace: 'nowrap' }}>
                    / {pageCount.toLocaleString()}
                </Typography>
            </Box>
            <IconButton
                size="small"
                aria-label="Next page"
                disabled={!canPage || page >= pageCount - 1}
                onClick={() => onChange(null, page + 1)}
                sx={{ width: 31, height: 30, borderRadius: 0 }}
            >
                <KeyboardArrowRight fontSize="small" />
            </IconButton>
        </Box>
    );
}

function GenePageJumpControl({ totalPages, page, onChange, disabled = false }) {
    const theme = useTheme();
    const pageCount = Math.max(Number(totalPages) || 1, 1);
    const [inputPage, setInputPage] = React.useState(page + 1);
    const pageNumber = Number(inputPage);
    const canPage = !disabled && pageCount > 1;
    const isValid = inputPage !== '' && Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= pageCount;

    React.useEffect(() => {
        setInputPage(page + 1);
    }, [page]);

    const submitPage = React.useCallback((event) => {
        event?.preventDefault?.();
        if (!canPage) return;
        if (isValid) {
            onChange(null, pageNumber - 1);
            return;
        }
        setInputPage(page + 1);
    }, [canPage, isValid, onChange, page, pageNumber]);

    return (
        <Box component="form" onSubmit={submitPage} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.45, flexShrink: 0, minHeight: 32 }}>
            <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 650, whiteSpace: 'nowrap' }}>
                Page
            </Typography>
            <TextField
                size="small"
                type="number"
                value={inputPage}
                disabled={!canPage}
                onChange={(event) => setInputPage(event.target.value)}
                onBlur={() => {
                    if (!isValid) setInputPage(page + 1);
                }}
                inputProps={{ min: 1, max: pageCount }}
                sx={{
                    width: 58,
                    '& .MuiOutlinedInput-root': { bgcolor: theme.palette.background.paper, height: 32 },
                    '& .MuiOutlinedInput-input': {
                        py: 0.48,
                        px: 0.7,
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        fontWeight: 650,
                    },
                }}
            />
            <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 700, whiteSpace: 'nowrap' }}>
                / {pageCount.toLocaleString()}
            </Typography>
            <Button
                type="submit"
                size="small"
                variant="outlined"
                disabled={!canPage || !isValid}
                sx={{ minWidth: 38, height: 32, px: 0.9, py: 0.35, textTransform: 'none', fontSize: '0.72rem', fontWeight: 680 }}
            >
                Go
            </Button>
        </Box>
    );
}

function GenePagerTools({
    totalCount,
    start,
    end,
    pageCount,
    currentPage,
    rowsPerPage,
    onRowsPerPageChange,
    onPageChange,
    showRange = false,
}) {
    const shouldPaginate = totalCount > TABLE_PAGINATION_THRESHOLD;
    const rangeLabel = totalCount === 0
        ? 'No genes'
        : `${Math.min(start + 1, totalCount).toLocaleString()}-${end.toLocaleString()} / ${totalCount.toLocaleString()} genes`;

    return (
        <Box
            sx={{
                width: showRange ? '100%' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: showRange ? 'space-between' : { xs: 'flex-start', lg: 'flex-end' },
                gap: 1,
                flexWrap: 'wrap',
                minWidth: 0,
            }}
        >
            {showRange && (
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 680, whiteSpace: 'nowrap' }}>
                    {rangeLabel}
                </Typography>
            )}
            <Stack direction="row" spacing={0.9} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', lg: 'flex-end' }, minWidth: 0, opacity: shouldPaginate ? 1 : 0.58 }}>
                <GeneRowsControl rowsPerPage={rowsPerPage} onChange={onRowsPerPageChange} showLabel={false} disabled={!shouldPaginate} />
                <GenePaginationControl totalPages={pageCount} page={currentPage} onChange={onPageChange} disabled={!shouldPaginate} />
                <GenePageJumpControl totalPages={pageCount} page={currentPage} onChange={onPageChange} disabled={!shouldPaginate} />
            </Stack>
        </Box>
    );
}

function QuietGeneTableRowsPlaceholder({ colSpan, rows = 25 }) {
    return (
        <TableRow aria-hidden="true">
            <TableCell
                colSpan={colSpan}
                sx={{
                    height: Math.max(220, Math.min(rows, 12) * 48),
                    py: 0,
                    borderBottom: 0,
                }}
            />
        </TableRow>
    );
}

function QuietDeferredPanel({ minHeight = 260 }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            aria-hidden="true"
            sx={panelSx(theme, {
                minHeight,
                bgcolor: theme.palette.background.paper,
                boxShadow: 'none',
            })}
        />
    );
}

const GENE_TABLE_COLUMNS = [
    { key: 'geneSymbol', label: 'Gene symbol', align: 'center', width: 138 },
    { key: 'geneDescription', label: 'Gene description', align: 'left', width: 320 },
    { key: 'ensgId', label: 'Ensembl ID', align: 'center', width: 170 },
    { key: 'location', label: 'Location', align: 'center', width: 190 },
    { key: 'geneType', label: 'Gene type', align: 'center', width: 150 },
    { key: 'totalPrograms', label: 'Associated programs', align: 'center', width: 156, headerWrap: true },
    { key: 'totalTraits', label: 'Associated traits', align: 'center', width: 156, headerWrap: true },
];
const GENE_PROGRAM_COLUMNS = [
    { key: 'program', label: 'program', align: 'center', width: 84, tone: 'program' },
    { key: 'loading_gene_score', label: 'score', align: 'center', width: 110, tone: 'neutral' },
    { key: 'loading_gene_rank', label: 'rank', align: 'center', width: 88, tone: 'neutral' },
    { key: 'loading_gene_direction', label: 'direction', align: 'center', width: 112, tone: 'neutral' },
    { key: 'regulator_score', label: 'score', align: 'center', width: 110, tone: 'neutral' },
    { key: 'regulator_rank', label: 'rank', align: 'center', width: 88, tone: 'neutral' },
    { key: 'regulator_direction', label: 'direction', align: 'center', width: 112, tone: 'neutral' },
];
const GENE_TRAIT_COLUMNS = [
    { key: 'trait', label: 'trait', align: 'left', width: 272, tone: 'trait' },
    { key: 'program', label: 'program', align: 'center', width: 82, tone: 'program' },
    { key: 'role', label: 'role', align: 'center', width: 92, tone: 'gene' },
    { key: 'post_mean', label: 'post_mean', align: 'center', width: 106, tone: 'neutral' },
    { key: 'abs_gamma', label: 'abs_gamma', align: 'center', width: 118, tone: 'neutral' },
    { key: 'membership_score', label: 'membership_score', align: 'center', width: 138, tone: 'neutral' },
    { key: 'direction', label: 'direction', align: 'center', width: 112, tone: 'gene' },
    { key: 'concordance', label: 'concordance', align: 'center', width: 132, tone: 'neutral' },
];

const GENE_PROGRAM_COLUMN_DESCRIPTIONS = {
    program: 'Program connected with the selected gene.',
    loading_gene: 'cNMF_all.gene_spectra_score membership evidence for loading genes.',
    regulator: 'cNMF_regulation/K562GW perturb effect evidence for regulators.',
    loading_gene_score: 'Membership score for role=program_gene.',
    loading_gene_rank: 'Rank within the program among program_gene membership rows.',
    loading_gene_direction: 'Direction inferred from the program_gene score sign.',
    regulator_score: 'Perturb/regulation score for role=regulator.',
    regulator_rank: 'Rank within the program among regulator rows.',
    regulator_direction: 'Direction inferred from the regulator score sign.',
};

const GENE_TRAIT_COLUMN_DESCRIPTIONS = {
    trait: 'Trait associated with this gene in the Trait-Gene Association Map.',
    program: 'Program context for the gene-trait association.',
    role: 'Association role in the Trait-Gene Association Map.',
    post_mean: 'Posterior mean LoF effect estimate from the source association map.',
    abs_gamma: 'Absolute gamma/effect magnitude used for prioritization in the source association map.',
    membership_score: 'Gene-program membership or regulator score carried by the source association map.',
    direction: 'Predicted direction/sign assembled from source sign fields.',
    concordance: 'Whether trait and program/regulator directions are concordant or discordant.',
};
const EMPTY_GENE_ROWS = [];
const EMPTY_RECORDS = [];
const TABLE_PAGINATION_THRESHOLD = 50;
const DEFAULT_ROWS_PER_PAGE = 25;
const RELATION_ROWS_PER_PAGE = 10;
const RELATION_PAGINATION_THRESHOLD = 10;
const relationIndexSWRConfig = {
    ...detailSummarySWRConfig,
    refreshInterval: (latestData) => (latestData?.unavailable ? 5000 : 0),
    revalidateIfStale: true,
    revalidateOnFocus: true,
};
const associationTraitsSWRConfig = {
    ...stableListSWRConfig,
    refreshInterval: (latestData) => (latestData?.unavailable ? 5000 : 0),
    revalidateIfStale: true,
    revalidateOnFocus: true,
};

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

function matchesGeneIndexRow(gene, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;

    return [
        gene?.geneSymbol,
        gene?.geneLabel,
        gene?.geneName,
        gene?.description,
        gene?.ensgId,
        getGeneLocation(gene),
        gene?.geneType,
        gene?.totalPrograms,
        gene?.totalTraits,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

const GENE_TABLE_TITLE_HEADER_HEIGHT = 54;

const geneSortLabelSx = {
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

function geneTableCellSx(theme, {
    align = 'left',
    fontFamily,
    fontWeight = 500,
    whiteSpace = 'normal',
} = {}) {
    const useDataFont = fontFamily === 'monospace';
    return {
        px: 1.1,
        py: 1.05,
        textAlign: align,
        whiteSpace,
        fontSize: '0.8rem',
        lineHeight: 1.3,
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        fontWeight,
        color: '#334155',
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        overflow: 'visible',
        textOverflow: 'clip',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        verticalAlign: 'middle',
    };
}

function geneBodyCellSx({ align = 'left', tone, fontFamily, fontWeight = 400, whiteSpace = 'nowrap' }) {
    const useDataFont = fontFamily === 'monospace';
    return {
        px: 0.85,
        py: 0.56,
        textAlign: align,
        whiteSpace,
        fontSize: '0.68rem',
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        fontWeight,
        color: '#334155',
        bgcolor: tone?.cellSoft,
        borderBottom: '1px solid rgba(226,232,240,0.72)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    };
}

function embeddedTableTitleCellSx(theme) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: '43 !important',
        height: GENE_TABLE_TITLE_HEADER_HEIGHT,
        py: 0.8,
        px: 1.25,
        bgcolor: theme.custom.surface.raised,
        backgroundColor: `${theme.custom.surface.raised} !important`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        color: theme.palette.text.primary,
    };
}

function embeddedColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: GENE_TABLE_TITLE_HEADER_HEIGHT,
        fontSize: '0.75rem',
        fontWeight: 680,
    });
}

function EmbeddedTableTitleRow({ title, caption, colSpan, onDownload, action = null, toolbar = null }) {
    const theme = useTheme();
    return (
        <TableRow>
            <TableCell colSpan={colSpan} sx={embeddedTableTitleCellSx(theme)}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.94rem', lineHeight: 1.2 })}>
                            {title}
                        </Typography>
                        {caption ? (
                            <Typography sx={captionSx(theme, { fontSize: '0.7rem', lineHeight: 1.35 })}>
                                {caption}
                            </Typography>
                        ) : null}
                    </Box>
                    {toolbar || (
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                            {action}
                            <Button
                                size="small"
                                startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                onClick={onDownload}
                                sx={{ textTransform: 'none', fontSize: '0.72rem', color: theme.palette.text.secondary, flexShrink: 0 }}
                            >
                                CSV
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </TableCell>
        </TableRow>
    );
}

function GeneRelationPagerFooter({
    totalCount,
    page,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
    itemLabel = 'rows',
}) {
    const theme = useTheme();
    const safeTotalCount = Math.max(Number(totalCount) || 0, 0);
    const safeRowsPerPage = Math.max(Number(rowsPerPage) || RELATION_ROWS_PER_PAGE, 1);
    const pageCount = Math.max(1, Math.ceil(safeTotalCount / safeRowsPerPage));
    const currentPage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);
    const start = safeTotalCount ? currentPage * safeRowsPerPage : 0;
    const end = safeTotalCount ? Math.min(start + safeRowsPerPage, safeTotalCount) : 0;
    const canPaginate = safeTotalCount > RELATION_PAGINATION_THRESHOLD;
    const rangeLabel = safeTotalCount === 0
        ? `No ${itemLabel}`
        : `${(start + 1).toLocaleString()}-${end.toLocaleString()} / ${safeTotalCount.toLocaleString()} ${itemLabel}`;

    return (
        <Box
            sx={{
                px: { xs: 1.25, md: 1.6 },
                py: 1.15,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                alignItems: 'center',
                gap: 1,
                borderTop: `1px solid ${theme.custom.border.soft}`,
                background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.024)}, ${theme.custom.surface.subtle})`,
            }}
        >
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {rangeLabel}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 0.9, flexWrap: 'wrap', minWidth: 0, opacity: canPaginate ? 1 : 0.58 }}>
                <GeneRowsControl
                    rowsPerPage={safeRowsPerPage}
                    onChange={onRowsPerPageChange}
                    showLabel={false}
                    options={[10, 25, 50, 100, 250]}
                    disabled={!canPaginate}
                />
                <GenePaginationControl totalPages={pageCount} page={currentPage} onChange={onPageChange} disabled={!canPaginate} />
                <GenePageJumpControl totalPages={pageCount} page={currentPage} onChange={onPageChange} disabled={!canPaginate} />
            </Box>
        </Box>
    );
}

function getGeneLocation(gene) {
    if (gene?.location) return normalizeLocationText(gene.location);
    const chromosome = String(gene?.chromosome || '').trim();
    if (!chromosome) return '';
    const begin = Number.isFinite(gene?.beginPos) ? Math.trunc(gene.beginPos) : null;
    const end = Number.isFinite(gene?.endPos) ? Math.trunc(gene.endPos) : null;
    if (begin == null || end == null) return normalizeChromosomeLabel(chromosome);
    return `${normalizeChromosomeLabel(chromosome)}:${begin}-${end}`;
}

function getGeneDescription(gene) {
    return gene?.geneName || gene?.description || '';
}

function normalizeChromosomeLabel(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.includes('_') || text.includes('.')) return text;
    if (/^chr/i.test(text)) return `chr${text.replace(/^chr/i, '')}`;
    return `chr${text}`;
}

function normalizeCoordinate(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const numeric = Number(text.replace(/,/g, ''));
    return Number.isFinite(numeric) ? String(Math.trunc(numeric)) : text;
}

function normalizeLocationText(value) {
    const text = String(value || '').trim();
    const match = text.match(/^([^:]+):(.+)-(.+)$/);

    if (!match) return normalizeChromosomeLabel(text);

    const chromosome = normalizeChromosomeLabel(match[1]);
    return `${chromosome}:${normalizeCoordinate(match[2])}-${normalizeCoordinate(match[3])}`;
}

function chromosomeSortRank(value) {
    const chr = String(value || '').trim().replace(/^chr/i, '');
    if (!chr) return { group: 3, value: Number.POSITIVE_INFINITY, text: '' };
    if (/^\d+$/.test(chr)) return { group: 0, value: Number(chr), text: chr };
    if (chr === 'X') return { group: 1, value: 23, text: chr };
    if (chr === 'Y') return { group: 1, value: 24, text: chr };
    if (chr === 'M' || chr === 'MT') return { group: 1, value: 25, text: chr };
    return { group: 2, value: Number.POSITIVE_INFINITY, text: chr };
}

function compareText(a, b) {
    const leftBlank = a == null || String(a).trim() === '';
    const rightBlank = b == null || String(b).trim() === '';
    if (leftBlank && rightBlank) return 0;
    if (leftBlank) return 1;
    if (rightBlank) return -1;
    return String(a).localeCompare(String(b), undefined, {
        sensitivity: 'base',
        numeric: true,
    });
}

function compareNullableNumber(a, b) {
    const parsedLeft = Number(a);
    const parsedRight = Number(b);
    const left = Number.isFinite(parsedLeft) ? parsedLeft : Number.POSITIVE_INFINITY;
    const right = Number.isFinite(parsedRight) ? parsedRight : Number.POSITIVE_INFINITY;
    return left - right;
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

function compareLocation(a, b) {
    const left = chromosomeSortRank(a?.chromosome);
    const right = chromosomeSortRank(b?.chromosome);

    if (left.group !== right.group) return left.group - right.group;
    if (left.value !== right.value) return left.value - right.value;
    if (left.text !== right.text) return compareText(left.text, right.text);

    const beginDiff = compareNullableNumber(a?.beginPos, b?.beginPos);
    if (beginDiff) return beginDiff;

    return compareNullableNumber(a?.endPos, b?.endPos);
}

function compareGenes(a, b, sortBy, sortDir) {
    let result = 0;

    if (sortBy === 'geneSymbol') result = compareText(a?.geneSymbol || a?.geneLabel, b?.geneSymbol || b?.geneLabel);
    if (sortBy === 'geneDescription') result = compareText(getGeneDescription(a), getGeneDescription(b));
    if (sortBy === 'ensgId') result = compareText(a?.ensgId, b?.ensgId);
    if (sortBy === 'location') result = compareLocation(a, b);
    if (sortBy === 'geneType') result = compareText(a?.geneType, b?.geneType);
    if (sortBy === 'totalPrograms') result = compareNullableNumber(a?.totalPrograms, b?.totalPrograms);
    if (sortBy === 'totalTraits') result = compareNullableNumber(a?.totalTraits, b?.totalTraits);

    if (!result) {
        result = compareText(a?.geneSymbol || a?.ensgId || a?.geneLabel, b?.geneSymbol || b?.ensgId || b?.geneLabel);
    }
    if (!result) result = compareText(a?.ensgId, b?.ensgId);

    return sortDir === 'desc' ? -result : result;
}

function escapeCsvValue(value) {
    const text = String(value ?? '');
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

function buildGeneTableCsv(rows) {
    const lines = [
        GENE_TABLE_COLUMNS.map((column) => escapeCsvValue(column.label)).join(','),
        ...rows.map((row) => ([
            row.geneSymbol || '',
            getGeneDescription(row),
            row.ensgId || '',
            getGeneLocation(row),
            row.geneType || '',
            Number(row.totalPrograms) || 0,
            Number(row.totalTraits) || 0,
        ].map((value) => escapeCsvValue(value)).join(','))),
    ];
    return `${lines.join('\n')}\n`;
}

function buildEnsemblUrl(ensgId) {
    return ensgId ? `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(ensgId)}` : '';
}

function buildGeneCardsUrl(geneSymbol) {
    return geneSymbol ? `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${encodeURIComponent(geneSymbol)}` : '';
}

function buildNcbiUrl(gene) {
    if (gene?.geneId) return `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(gene.geneId)}`;
    const searchTerm = gene?.geneSymbol || gene?.ensgId || '';
    return searchTerm ? `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(searchTerm)}` : '';
}

function getRecordDirection(row) {
    return row?.direction || row?.predictedSign || row?.gammaSign || row?.postMeanSign || '-';
}

function getConcordanceLabel(row) {
    if (row?.concordance) return row.concordance;
    if (row?.isConcordant && row?.isDiscordant) return 'concordant + discordant';
    if (row?.isConcordant) return 'concordant';
    if (row?.isDiscordant) return 'discordant';
    return '-';
}

function getPostMean(row) {
    const value = row?.post_mean ?? row?.postMean;
    return Number.isFinite(value) ? value : null;
}

function getAbsGamma(row) {
    const value = row?.abs_gamma ?? row?.absGamma;
    return Number.isFinite(value) ? value : null;
}

function getMembershipScore(row) {
    const value = row?.membership_score ?? row?.membershipScore;
    return Number.isFinite(value) ? value : null;
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

function groupGeneProgramRows(rows) {
    const grouped = new Map();
    rows.forEach((row) => {
        const program = row?.program || '';
        if (!program) return;
        const existing = grouped.get(program) || {
            program,
            roleMap: {},
        };
        const role = row.role || '';
        if (role) existing.roleMap[role] = betterRoleRecord(existing.roleMap[role], row);
        grouped.set(program, existing);
    });

    return Array.from(grouped.values()).map((row) => {
        return {
            program: row.program,
            program_gene: row.roleMap.program_gene || null,
            regulator: row.roleMap.regulator || null,
        };
    });
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
    const headerBackground = overrides.top === GENE_TABLE_TITLE_HEADER_HEIGHT + 36 ? tone.subHeaderBg : tone.headerBg;
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

function buildGeneInfoCsv(gene, summary) {
    const rows = [
        ['Field', 'Value'],
        ['Gene symbol', gene?.geneSymbol || '-'],
        ['Gene description', gene?.geneName || gene?.description || '-'],
        ['Ensembl ID', gene?.ensgId || '-'],
        ['Gene location', getGeneLocation(gene) || '-'],
        ['Gene type', gene?.geneType || '-'],
        ['NCBI gene summary', gene?.description || '-'],
        ['More information about the gene', [
            buildEnsemblUrl(gene?.ensgId),
            buildGeneCardsUrl(gene?.geneSymbol),
            buildNcbiUrl(gene),
        ].filter(Boolean).join(' | ') || '-'],
        ['Associated programs', Number(summary?.totalPrograms) || 0],
        ['Associated traits', Number(summary?.totalTraits) || 0],
    ];
    const lines = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(','));
    return `${lines.join('\n')}\n`;
}

function matchesGeneProgramRow(row, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;

    return [
        row?.geneLabel,
        row?.program,
        row?.program_gene?.score,
        row?.program_gene?.rank,
        row?.program_gene?.direction,
        row?.regulator?.score,
        row?.regulator?.rank,
        row?.regulator?.direction,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

function buildGeneProgramCsv(rows) {
    const lines = [
        [
            'program',
            'program_gene_score',
            'program_gene_rank',
            'program_gene_direction',
            'regulator_score',
            'regulator_rank',
            'regulator_direction',
        ].map(escapeCsvValue).join(','),
        ...rows.map((row) => ([
            row.program || '',
            row.program_gene?.score ?? '',
            row.program_gene?.rank ?? '',
            row.program_gene?.direction || '',
            row.regulator?.score ?? '',
            row.regulator?.rank ?? '',
            row.regulator?.direction || '',
        ].map((value) => escapeCsvValue(value)).join(','))),
    ];
    return `${lines.join('\n')}\n`;
}

function buildGeneTraitCsv(rows) {
    const lines = [
        GENE_TRAIT_COLUMNS.map((column) => escapeCsvValue(column.label)).join(','),
        ...rows.map((row) => ([
            row.trait || '',
            row.program || '',
            row.role || '',
            Number.isFinite(getPostMean(row)) ? getPostMean(row) : '',
            Number.isFinite(getAbsGamma(row)) ? getAbsGamma(row) : '',
            Number.isFinite(getMembershipScore(row)) ? getMembershipScore(row) : '',
            getRecordDirection(row),
            getConcordanceLabel(row),
        ].map((value) => escapeCsvValue(value)).join(','))),
    ];
    return `${lines.join('\n')}\n`;
}

function matchesGeneTraitRecord(row, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;

    return [
        row?.trait,
        row?.trait_id,
        row?.program,
        row?.role,
        getRecordDirection(row),
        getPostMean(row),
        getAbsGamma(row),
        getMembershipScore(row),
        getConcordanceLabel(row),
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery));
}

function compareGenePrograms(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'geneLabel') result = compareText(a?.geneLabel, b?.geneLabel);
    if (sortBy === 'program') result = compareText(a?.program, b?.program);
    if (sortBy === 'loading_gene_score') result = compareOptionalRoleNumber(a?.program_gene?.score, b?.program_gene?.score, sortDir);
    if (sortBy === 'loading_gene_rank') result = compareOptionalRoleNumber(a?.program_gene?.rank, b?.program_gene?.rank, sortDir);
    if (sortBy === 'loading_gene_direction') result = compareText(a?.program_gene?.direction, b?.program_gene?.direction);
    if (sortBy === 'regulator_score') result = compareOptionalRoleNumber(a?.regulator?.score, b?.regulator?.score, sortDir);
    if (sortBy === 'regulator_rank') result = compareOptionalRoleNumber(a?.regulator?.rank, b?.regulator?.rank, sortDir);
    if (sortBy === 'regulator_direction') result = compareText(a?.regulator?.direction, b?.regulator?.direction);

    if (!result) result = compareText(a?.program, b?.program);
    if (['loading_gene_score', 'loading_gene_rank', 'regulator_score', 'regulator_rank'].includes(sortBy)) return result;
    return sortDir === 'desc' ? -result : result;
}

function SummaryCard({ icon, label, value, tone = 'neutral' }) {
    const theme = useTheme();
    const Icon = icon;
    const colors = metricChipTone(theme, tone);
    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                px: 1.6,
                py: 1.2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                minHeight: 76,
            })}
        >
            <Box sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                display: 'grid',
                placeItems: 'center',
                ...colors,
            }}>
                <Icon sx={{ fontSize: 19 }} />
            </Box>
            <Box>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 720, lineHeight: 1.1 }}>
                    {Number(value || 0).toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 700, textTransform: 'none', letterSpacing: '0.06em' }}>
                    {label}
                </Typography>
            </Box>
        </Paper>
    );
}

function GeneChipLink({ gene, tone = 'subtle' }) {
    const theme = useTheme();
    const label = typeof gene === 'string' ? gene : (gene.geneSymbol || gene.ensgId || gene.geneLabel);
    if (!label) return null;

    return (
        <Chip
            label={label}
            size="small"
            component={RouterLink}
            clickable
            to={`/genes?query=${encodeURIComponent(label)}`}
            sx={summaryChipSx(theme, metricChipTone(theme, tone))}
        />
    );
}

function GeneSuggestionList({ suggestions, isLoading, onSelect }) {
    const theme = useTheme();
    const rows = suggestions?.genes || EMPTY_GENE_ROWS;

    const sortedRows = React.useMemo(
        () => [...rows].sort((a, b) => compareGenes(a, b, 'totalTraits', 'desc')),
        [rows],
    );

    if (isLoading) {
        return (
            <Box sx={{
                px: 1.75,
                py: 1,
                borderBottom: `1px solid ${theme.custom.border.soft}`,
                bgcolor: alpha(theme.palette.primary.main, 0.025),
                color: theme.palette.text.secondary,
                fontSize: '0.76rem',
                fontWeight: 650,
            }}>
                Searching matching genes...
            </Box>
        );
    }

    if (!rows.length) {
        return (
            <Box sx={{
                px: 1.75,
                py: 1,
                borderBottom: `1px solid ${theme.custom.border.soft}`,
                bgcolor: alpha(theme.palette.warning.main, 0.04),
                color: theme.palette.text.secondary,
                fontSize: '0.76rem',
                fontWeight: 650,
            }}>
                No matching genes. Try another gene symbol or ENSG identifier.
            </Box>
        );
    }

    return (
        <Box sx={{
            px: 1.5,
            py: 0.9,
            borderBottom: `1px solid ${theme.custom.border.soft}`,
            bgcolor: alpha(theme.palette.primary.main, 0.025),
        }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.74rem', fontWeight: 650, color: theme.palette.text.secondary, textTransform: 'none', letterSpacing: '0.05em' }}>
                    Most significant matches
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: theme.palette.text.secondary }}>
                    Ranked first by broad trait and program evidence.
                </Typography>
            </Stack>
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                    lg: 'repeat(6, minmax(0, 1fr))',
                },
                gap: 0.65,
            }}>
                {sortedRows.map((gene, index) => {
                    const label = gene.geneSymbol || gene.ensgId || gene.geneLabel;
                    const showEnsg = gene.ensgId && gene.ensgId !== label;
                    return (
                        <Button
                            key={`${label}-${gene.ensgId || index}`}
                            onClick={() => onSelect(label)}
                            sx={{
                                alignItems: 'flex-start',
                                justifyContent: 'flex-start',
                                flexDirection: 'column',
                                gap: 0.5,
                                textAlign: 'left',
                                textTransform: 'none',
                                px: 0.9,
                                py: 0.65,
                                borderRadius: 1,
                                border: `1px solid ${theme.custom.border.soft}`,
                                bgcolor: theme.palette.background.paper,
                                color: theme.palette.text.primary,
                                minWidth: 0,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.primary.main, 0.045),
                                    borderColor: alpha(theme.palette.primary.main, 0.26),
                                },
                            }}
                        >
                            <Box sx={{ minWidth: 0, width: '100%' }}>
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 720, lineHeight: 1.15 }} noWrap>
                                    {label}
                                </Typography>
                                {showEnsg && (
                                    <Typography sx={{ mt: 0.18, fontSize: '0.63rem', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }} noWrap>
                                        {gene.ensgId}
                                    </Typography>
                                )}
                            </Box>
                            <Stack direction="row" spacing={0.45} sx={{ width: '100%', flexWrap: 'wrap' }}>
                                <Chip label={`${Number(gene.totalTraits) || 0} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                                <Chip label={`${Number(gene.totalPrograms) || 0} programs`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                            </Stack>
                        </Button>
                    );
                })}
            </Box>
        </Box>
    );
}

const GENE_PLACEHOLDERS = [
    'e.g. PTMA',
    'e.g. BRCA1',
    'e.g. LDLR',
    'e.g. TP53',
    'e.g. APOE',
    'e.g. EGFR',
    'e.g. TNF',
    'e.g. IL6',
    'e.g. VEGFA',
    'e.g. AKT1',
    'e.g. ENSG00000139618'
];

function GeneHomeTable({
    input,
    setInput,
    suggestions,
    suggestionsLoading,
    onClear,
    onSelect,
}) {
    const theme = useTheme();
    const searchPlaceholder = 'Search gene symbol, ENSG ID, location';
    const geneTone = {
        ...tableTone(theme, 'success'),
        headerBg: '#f5faf8',
        headerBorder: alpha('#2f6a49', 0.24),
        headerColor: '#315d57',
    };
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(DEFAULT_ROWS_PER_PAGE);
    const [sortBy, setSortBy] = React.useState('totalTraits');
    const [sortDir, setSortDir] = React.useState('desc');
    const [downloading, setDownloading] = React.useState(false);
    const [downloadError, setDownloadError] = React.useState('');
    const searchInput = input.trim();
    const activeSearch = useDebouncedValue(searchInput);
    const isSearching = searchInput.length >= 2;
    const rowsReady = useAfterFirstPaint('gene-home-table');

    const geneIndexKey = ['gene-index', page, rowsPerPage, sortBy, sortDir, activeSearch];
    const geneIndexResource = useCachedResourceState(
        useSWR(geneIndexKey, ([, pageIndex, limit, sortKey, direction, search]) => getGenes({
            page: pageIndex + 1,
            limit,
            sortBy: sortKey,
            order: direction,
            search,
        }), stableListSWRConfig),
        { cacheKey: geneIndexKey, retainPreviousData: true },
    );
    const { displayData: data, isInitialLoading: isLoading, isRefreshing, error } = geneIndexResource;

    const rows = data?.genes || EMPTY_GENE_ROWS;
    const previewingSearch = Boolean(searchInput) && (searchInput !== activeSearch || isLoading);
    const visibleRows = React.useMemo(() => (
        previewingSearch ? rows.filter((gene) => matchesGeneIndexRow(gene, searchInput)) : rows
    ), [previewingSearch, rows, searchInput]);
    const showPreparingRows = !isLoading && visibleRows.length > 0 && !rowsReady;
    const totalCount = Number(data?.totalCount) || rows.length;
    const shouldPaginate = totalCount > TABLE_PAGINATION_THRESHOLD;
    const pageCount = shouldPaginate ? Math.max(1, Math.ceil(totalCount / rowsPerPage)) : 1;
    const currentPage = Math.min(page, pageCount - 1);
    const responsePage = Number(data?.page) || currentPage + 1;
    const start = totalCount ? ((responsePage - 1) * rowsPerPage) : 0;
    const end = totalCount ? Math.min(start + rows.length, totalCount) : 0;
    const handleSort = React.useCallback((key) => {
        setPage(0);
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(key === 'totalPrograms' || key === 'totalTraits' ? 'desc' : 'asc');
    }, [sortBy, sortDir]);
    const handleRowsPerPageChange = React.useCallback((value) => {
        setRowsPerPage(value);
        setPage(0);
    }, []);
    const handlePageChange = React.useCallback((event, nextPage) => {
        setPage(nextPage);
    }, []);
    const handleSearchInputChange = React.useCallback((event) => {
        setInput(event.target.value);
        setPage(0);
    }, [setInput]);
    const clearTableSearch = React.useCallback(() => {
        onClear();
        setPage(0);
    }, [onClear]);

    const handleDownload = React.useCallback(async () => {
        setDownloading(true);
        setDownloadError('');
        try {
            const payload = await getGenes({
                page: 1,
                limit: 0,
                sortBy,
                order: sortDir,
                search: activeSearch,
            });
            if (payload?.unavailable) {
                setDownloadError(payload.reason || 'Gene SQL index is not available yet.');
                return;
            }
            const csv = buildGeneTableCsv(payload?.genes || EMPTY_GENE_ROWS);
            const suffix = activeSearch ? `-${activeSearch.replace(/[^a-z0-9_-]+/gi, '_')}` : '';
            downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `gene-index${suffix}.csv`);
        } catch (err) {
            setDownloadError(err?.message || 'Failed to download gene index.');
        } finally {
            setDownloading(false);
        }
    }, [activeSearch, sortBy, sortDir]);

    const filterChipLabel = searchInput || activeSearch;

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                overflow: 'hidden',
                borderColor: alpha('#2f6a49', 0.18),
                background: `linear-gradient(180deg, ${alpha('#2f6a49', 0.035)} 0%, ${theme.palette.background.paper} 180px)`,
            })}
        >
            <Box
                sx={mainTableToolbarSx(theme)}
            >
                <Box
                    sx={mainTableToolbarTitleSlotSx(theme)}
                >
                    <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.08rem', md: '1.22rem' }, color: '#173b35', lineHeight: 1.15 })}>
                        Gene
                    </Typography>
                    <Stack direction="row" spacing={0.55} alignItems="center" sx={{ flexWrap: 'wrap', minWidth: 0 }}>
                        {filterChipLabel && (
                            <Chip
                                label={`Filter: ${filterChipLabel}`}
                                size="small"
                                onDelete={clearTableSearch}
                                sx={summaryChipSx(theme, {
                                    height: 22,
                                    maxWidth: { xs: '100%', sm: 240 },
                                    color: '#315d57',
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
                </Box>

                <Box
                    sx={mainTableToolbarSearchSlotSx(theme)}
                >
                    <TextField
                        size="small"
                        value={input}
                        onChange={handleSearchInputChange}
                        placeholder={searchPlaceholder}
                        sx={mainTableSearchFieldSx(theme, '#2f6a49')}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchOutlined fontSize="small" sx={{ color: '#2f6a49' }} />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment
                                    position="end"
                                    sx={{
                                        minWidth: 30,
                                        justifyContent: 'flex-end',
                                        visibility: searchInput || activeSearch ? 'visible' : 'hidden',
                                        pointerEvents: searchInput || activeSearch ? 'auto' : 'none',
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        aria-label="Clear gene search"
                                        onClick={clearTableSearch}
                                        edge="end"
                                        sx={{ width: 24, height: 24 }}
                                    >
                                        <Clear fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
                <Box
                    sx={mainTableToolbarActionsSx(theme)}
                >
                    <Box
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.65,
                            px: 0.55,
                            py: 0.35,
                            border: `1px solid ${alpha('#2f6a49', 0.1)}`,
                            borderRadius: 1,
                            bgcolor: alpha('#2f6a49', 0.025),
                            flexShrink: 0,
                            opacity: shouldPaginate ? 1 : 0.58,
                        }}
                    >
                        <GeneHeaderPageControl totalPages={pageCount} page={currentPage} onChange={handlePageChange} disabled={!shouldPaginate} />
                        <GeneRowsControl rowsPerPage={rowsPerPage} onChange={handleRowsPerPageChange} showLabel={false} disabled={!shouldPaginate} />
                    </Box>
                    <UpdatingStatus active={isRefreshing} reserveSpace />
                    <Button
                        size="small"
                        startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                        onClick={handleDownload}
                        disabled={downloading || data?.unavailable}
                        sx={mainTableActionButtonSx(theme, '#315d57')}
                    >
                        {downloading ? 'Preparing' : 'Download CSV'}
                    </Button>
                </Box>
            </Box>

            {data?.unavailable && (
                <Alert severity="warning" sx={{ m: 1.5, borderRadius: 1 }}>
                    Gene SQL index is not available yet. Run the schema migration and import script before using this table.
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ m: 1.5, borderRadius: 1 }}>
                    {error.message || 'Failed to load gene index.'}
                </Alert>
            )}
            {downloadError && (
                <Alert severity="error" sx={{ mx: 1.5, mb: 1.5, borderRadius: 1 }}>
                    {downloadError}
                </Alert>
            )}
            {isSearching && (
                <GeneSuggestionList
                    suggestions={suggestions}
                    isLoading={suggestionsLoading}
                    onSelect={onSelect}
                />
            )}

            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'hidden' })}>
                <Table size="small" stickyHeader sx={stickyTableSx(theme, { minWidth: 1280, tableLayout: 'fixed' })}>
                    <colgroup>
                        {GENE_TABLE_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            {GENE_TABLE_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    align={column.align}
                                    sx={stickyTableHeaderCellSx(theme, geneTone, column.align, {
                                        fontSize: '0.74rem',
                                        fontWeight: 680,
                                        letterSpacing: '0.03em',
                                        textTransform: 'none',
                                        py: column.headerWrap ? 0.8 : 1,
                                        width: column.width,
                                        whiteSpace: column.headerWrap ? 'normal' : 'nowrap',
                                        overflow: column.headerWrap ? 'visible' : 'hidden',
                                        textOverflow: column.headerWrap ? 'clip' : 'ellipsis',
                                        lineHeight: column.headerWrap ? 1.1 : 1.2,
                                        wordBreak: column.headerWrap ? 'break-word' : 'normal',
                                    })}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        onClick={() => handleSort(column.key)}
                                        sx={{
                                            color: 'inherit',
                                            display: 'flex',
                                            width: '100%',
                                            whiteSpace: column.headerWrap ? 'normal' : 'nowrap',
                                            lineHeight: column.headerWrap ? 1.1 : 1.2,
                                            alignItems: 'center',
                                            justifyContent: justifyForAlign(column.align),
                                            '&:hover': { color: '#2f6a49' },
                                            '&.Mui-active': { color: '#2f6a49', fontWeight: 700 },
                                            '& .MuiTableSortLabel-icon': {
                                                color: '#2f6a49 !important',
                                                flexShrink: 0,
                                                marginLeft: 0.35,
                                            },
                                        }}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading && !visibleRows.length && (
                            <TableRow>
                                <TableCell colSpan={GENE_TABLE_COLUMNS.length} sx={{ py: 4, textAlign: 'center', color: theme.palette.text.secondary }}>
                                    Loading gene index...
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && !visibleRows.length && !data?.unavailable && !error && (
                            <TableRow>
                                <TableCell colSpan={GENE_TABLE_COLUMNS.length} sx={{ py: 4, textAlign: 'center', color: theme.palette.text.secondary }}>
                                    {activeSearch
                                        ? `No genes match "${activeSearch}" in the imported gene relation indexes.`
                                        : 'No genes found in the imported gene relation indexes.'}
                                </TableCell>
                            </TableRow>
                        )}
                        {showPreparingRows && (
                            <QuietGeneTableRowsPlaceholder colSpan={GENE_TABLE_COLUMNS.length} rows={rowsPerPage} />
                        )}
                        {rowsReady && visibleRows.map((gene, index) => {
                            const label = gene.geneSymbol || gene.ensgId || gene.geneLabel || '';
                            return (
                                <TableRow
                                    key={`${gene.geneSymbol || gene.geneLabel}-${gene.ensgId || index}`}
                                    hover
                                    onClick={() => {
                                        if (label) onSelect(label);
                                    }}
                                    sx={{
                                        backgroundColor: index % 2 === 0 ? alpha('#2f6a49', 0.025) : theme.palette.background.paper,
                                        cursor: label ? 'pointer' : 'default',
                                        ...tableRowRevealSx(theme, index),
                                        transition: 'background-color 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1)',
                                        '& td:first-of-type': {
                                            borderLeft: `3px solid ${index % 2 === 0 ? alpha('#2f6a49', 0.22) : alpha('#245089', 0.18)}`,
                                        },
                                        '&:hover': {
                                            backgroundColor: alpha('#2f6a49', 0.065),
                                            transform: 'translateY(-1px)',
                                            boxShadow: `inset 0 0 0 1px ${alpha('#2f6a49', 0.12)}`,
                                        },
                                        '&:hover td:first-of-type': {
                                            borderLeftColor: '#2f6a49',
                                        },
                                    }}
                                >
                                    {GENE_TABLE_COLUMNS.map((column) => {
                                        const isNumeric = column.key === 'totalPrograms' || column.key === 'totalTraits';
                                        const isMono = ['ensgId', 'location', 'totalPrograms', 'totalTraits'].includes(column.key);
                                        let content = '-';

                                        if (column.key === 'geneSymbol') {
                                            content = (
                                                <Box sx={{ minWidth: 0, textAlign: 'center' }}>
                                                    <Typography sx={{ fontSize: '0.87rem', fontWeight: 740, lineHeight: 1.18, color: '#173b35', textAlign: 'center', overflowWrap: 'anywhere' }}>
                                                        {gene.geneSymbol || gene.geneLabel || '-'}
                                                    </Typography>
                                                </Box>
                                            );
                                        }
                                        if (column.key === 'geneDescription') {
                                            content = (
                                                <Typography sx={{ fontSize: '0.76rem', lineHeight: 1.35, color: theme.palette.text.primary, overflowWrap: 'anywhere', textAlign: column.align }}>
                                                    {getGeneDescription(gene) || '-'}
                                                </Typography>
                                            );
                                        }
                                        if (column.key === 'ensgId') {
                                            content = (
                                                <Typography sx={{ fontSize: '0.73rem', fontWeight: 650, color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', textAlign: 'center', overflowWrap: 'anywhere' }}>
                                                    {gene.ensgId || '-'}
                                                </Typography>
                                            );
                                        }
                                        if (column.key === 'location') content = getGeneLocation(gene) || '-';
                                        if (column.key === 'geneType') content = gene.geneType || '-';
                                        if (column.key === 'totalPrograms') {
                                            content = (Number(gene.totalPrograms) || 0).toLocaleString();
                                        }
                                        if (column.key === 'totalTraits') {
                                            content = (Number(gene.totalTraits) || 0).toLocaleString();
                                        }

                                        return (
                                            <TableCell
                                                key={column.key}
                                                align={column.align}
                                                sx={{
                                                    ...geneTableCellSx(theme, {
                                                        align: column.align,
                                                        fontFamily: isMono ? 'monospace' : undefined,
                                                        fontWeight: column.key === 'geneSymbol' || isNumeric ? 700 : 500,
                                                        whiteSpace: 'normal',
                                                    }),
                                                }}
                                            >
                                                {content}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box
                sx={{
                    px: { xs: 1.5, md: 2 },
                    py: 1.35,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1.5,
                    background: `linear-gradient(90deg, ${alpha('#2f6a49', 0.045)}, ${theme.custom.surface.subtle})`,
                    borderTop: `1px solid ${theme.custom.border.soft}`,
                }}
            >
                <GenePagerTools
                    totalCount={totalCount}
                    start={start}
                    end={end}
                    pageCount={pageCount}
                    currentPage={currentPage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleRowsPerPageChange}
                    onPageChange={handlePageChange}
                    showRange
                />
            </Box>
        </Paper>
    );
}

function GeneSwitcher({ gene, query, onSelect }) {
    const theme = useTheme();
    const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
    const searchPlaceholder = GENE_PLACEHOLDERS[placeholderIndex % GENE_PLACEHOLDERS.length];

    React.useEffect(() => {
        const timer = setInterval(() => {
            setPlaceholderIndex((index) => (index + 1) % GENE_PLACEHOLDERS.length);
        }, 3600);
        return () => clearInterval(timer);
    }, []);
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [search, setSearch] = React.useState('');
    const open = Boolean(anchorEl);
    const currentLabel = gene?.geneSymbol || query || gene?.ensgId || 'Gene';
    const searchTerm = search.trim();
    const debouncedSearchTerm = useDebouncedValue(searchTerm);
    const searchPending = open && searchTerm.length >= 2 && debouncedSearchTerm !== searchTerm;

    const { data, isLoading } = useSWR(
        open && debouncedSearchTerm.length >= 2 ? ['gene-switcher-search', debouncedSearchTerm] : null,
        ([, q]) => searchGenes(q, { limit: 12 }),
        interactiveSearchSWRConfig,
    );

    const rows = data?.genes || EMPTY_GENE_ROWS;

    React.useEffect(() => {
        if (!open) setSearch('');
    }, [open]);

    const closePopover = React.useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleSelect = React.useCallback((value) => {
        const next = String(value || '').trim();
        if (!next) return;
        closePopover();
        onSelect(next);
    }, [closePopover, onSelect]);

    return (
        <>
            <ButtonBase
                onClick={(event) => {
                    setAnchorEl(event.currentTarget);
                    setSearch(currentLabel);
                }}
                sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1.5,
                    border: `1px solid ${theme.custom.border.soft}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.015),
                    transition: `all ${theme.custom.motion.swift}`,
                    '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        borderColor: alpha(theme.palette.primary.main, 0.25),
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.06)}`,
                    },
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.35rem', md: '1.55rem' }, fontWeight: 800, color: '#173b35', lineHeight: 1 })}>
                        {currentLabel}
                    </Typography>
                </Box>
                <ExpandMore sx={{ color: theme.palette.text.secondary, flexShrink: 0 }} />
            </ButtonBase>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: panelSx(theme, {
                        mt: 0.75,
                        width: { xs: 'min(92vw, 560px)', sm: 540 },
                        overflow: 'hidden',
                        boxShadow: theme.custom.shadow.float,
                    }),
                }}
            >
                <Box sx={sectionPanelHeaderSx(theme, { display: 'block', p: 1.25 })}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 680, color: theme.palette.text.primary }}>
                        Search genes
                    </Typography>
                    <Typography sx={{ mt: 0.2, mb: 1, fontSize: '0.76rem', color: theme.palette.text.secondary }}>
                        Switch the current gene by symbol or ENSG identifier.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') handleSelect(search);
                        }}
                        placeholder={searchPlaceholder}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <ManageSearchOutlined fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
                <Box sx={{ maxHeight: 420, overflowY: 'auto', p: 1 }}>
                    {(isLoading || searchPending) && (
                        <Typography sx={{ px: 1, py: 2, fontSize: '0.8rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                            Searching genes...
                        </Typography>
                    )}
                    {!isLoading && !searchPending && searchTerm.length < 2 && (
                        <Typography sx={{ px: 1, py: 2, fontSize: '0.8rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                            Type at least two characters.
                        </Typography>
                    )}
                    {!isLoading && !searchPending && debouncedSearchTerm.length >= 2 && rows.length === 0 && (
                        <Typography sx={{ px: 1, py: 2, fontSize: '0.8rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                            No matching genes. Press Enter to search this exact value.
                        </Typography>
                    )}
                    {!isLoading && !searchPending && rows.map((item, index) => {
                        const label = item.geneSymbol || item.ensgId || item.geneLabel;
                        const selected = label === currentLabel || item.ensgId === gene?.ensgId;
                        const secondaryItems = [
                            item.ensgId && item.ensgId !== label ? item.ensgId : '',
                            getGeneLocation(item),
                            item.geneType,
                        ].filter(Boolean);
                        return (
                            <ButtonBase
                                key={`${label}-${item.ensgId || index}`}
                                onClick={() => handleSelect(label)}
                                sx={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                    flexDirection: 'column',
                                    gap: 0.65,
                                    mb: 0.7,
                                    px: 1.1,
                                    py: 0.9,
                                    borderRadius: 1,
                                    textAlign: 'left',
                                    border: selected ? `1px solid ${alpha(theme.palette.primary.main, 0.28)}` : `1px solid ${theme.custom.border.soft}`,
                                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.07) : theme.palette.background.paper,
                                    transition: `background-color ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                                        borderColor: alpha(theme.palette.primary.main, 0.24),
                                        transform: 'translateY(-1px)',
                                    },
                                }}
                            >
                                <Box sx={{ minWidth: 0, width: '100%' }}>
                                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.2 }}>
                                        {label}
                                    </Typography>
                                    <Typography sx={{ mt: 0.25, fontSize: '0.68rem', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }} noWrap>
                                        {secondaryItems.join(' | ') || '-'}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.45} sx={{ width: '100%', flexWrap: 'wrap' }}>
                                    <Chip label={`${Number(item.totalTraits) || 0} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                                    <Chip label={`${Number(item.totalPrograms) || 0} programs`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                                </Stack>
                            </ButtonBase>
                        );
                    })}
                </Box>
            </Popover>
        </>
    );
}

function GeneDetailHeader({ gene, query, summary, onSelect }) {
    const theme = useTheme();
    const metrics = [
        { label: 'Associations', value: summary?.totalRows, tone: 'neutral' },
        { label: 'Programs', value: summary?.totalPrograms, tone: 'warning' },
        { label: 'Traits', value: summary?.totalTraits, tone: 'primary' },
    ];

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.5, md: 2 },
                bgcolor: theme.palette.background.paper,
                boxShadow: '0 10px 22px rgba(15, 23, 42, 0.045)',
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
                    }}
                >
                    <GeneSwitcher gene={gene} query={query} onSelect={onSelect} />
                </Box>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'repeat(2, minmax(0, 1fr))',
                            sm: 'repeat(3, minmax(104px, 1fr))',
                            md: 'repeat(3, minmax(104px, 1fr))',
                            lg: 'repeat(3, minmax(116px, 1fr))',
                        },
                        gap: { xs: 0.75, md: 0.9 },
                        width: '100%',
                        minWidth: 0,
                        flex: { xs: '1 1 auto', md: '1 1 0%' },
                        maxWidth: { md: 420 },
                    }}
                >
                    {metrics.map((metric) => {
                        const colors = metricChipTone(theme, metric.tone);
                        return (
                            <Box
                                key={metric.label}
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
                                    {(Number(metric.value) || 0).toLocaleString()}
                                </Typography>
                                <Typography sx={{ mt: 0.28, fontSize: { xs: '0.62rem', md: '0.68rem' }, fontWeight: 680, textTransform: 'none', letterSpacing: '0.045em' }}>
                                    {metric.label}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            </Stack>
        </Paper>
    );
}

function GeneInfoTable({ gene, summary }) {
    const theme = useTheme();

    const links = [
        { label: 'Ensembl', href: buildEnsemblUrl(gene?.ensgId) },
        { label: 'GeneCards', href: buildGeneCardsUrl(gene?.geneSymbol) },
        { label: 'NCBI', href: buildNcbiUrl(gene) },
    ].filter((item) => item.href);
    const rows = [
        {
            label: 'Gene symbol',
            value: gene?.geneSymbol || '-',
            tone: 'link',
            align: 'center',
        },
        {
            label: 'Gene description',
            value: gene?.geneName || gene?.description || '-',
        },
        {
            label: 'Ensembl ID',
            value: gene?.ensgId || '-',
            mono: true,
            tone: 'link',
            align: 'center',
        },
        {
            label: 'Gene location',
            value: getGeneLocation(gene) || '-',
            mono: true,
            align: 'center',
        },
        {
            label: 'Gene type',
            value: gene?.geneType || '-',
            align: 'center',
        },
        {
            label: 'NCBI gene summary',
            value: gene?.description || '-',
            wrap: true,
        },
        {
            label: 'More information about the gene',
            links,
        },
    ];

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneInfoCsv(gene, summary);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-info.csv`);
    }, [gene, summary]);

    if (!gene) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden', bgcolor: theme.palette.background.paper })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto' })}>
                <Table size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 760 })}>
                    <colgroup>
                        <col style={{ width: 220 }} />
                        <col />
                    </colgroup>
                    <TableHead>
                        <EmbeddedTableTitleRow
                            title="Gene information"
                            colSpan={2}
                            onDownload={handleDownload}
                        />
                    </TableHead>
                    <TableBody>
                        {rows.map((row, index) => (
                            <TableRow
                                key={row.label}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell
                                    align="center"
                                    sx={{
                                        position: 'static',
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
                                    {row.label}
                                </TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        py: 1.05,
                                        px: 1.35,
                                        fontSize: '0.82rem',
                                        lineHeight: 1.42,
                                        fontVariantNumeric: row.mono ? 'tabular-nums' : undefined,
                                        fontFeatureSettings: row.mono ? '"tnum" 1' : undefined,
                                        fontWeight: row.tone === 'link' ? 750 : 500,
                                        color: row.tone === 'link' ? '#245089' : theme.palette.text.primary,
                                        bgcolor: theme.palette.background.paper,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        textAlign: 'center',
                                        whiteSpace: row.wrap ? 'normal' : 'nowrap',
                                        wordBreak: row.wrap ? 'break-word' : 'normal',
                                        verticalAlign: 'middle',
                                    }}
                                >
                                    {row.links ? (
                                        <Stack direction="row" spacing={0.75} justifyContent="center" sx={{ flexWrap: 'wrap' }}>
                                            {row.links.length ? row.links.map((link) => (
                                                <Button
                                                    key={link.label}
                                                    component="a"
                                                    href={link.href}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    endIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                                                    sx={{
                                                        textTransform: 'none',
                                                        minWidth: 0,
                                                        px: 0.75,
                                                        py: 0.2,
                                                        borderRadius: 0.75,
                                                        border: `1px solid ${theme.custom.border.soft}`,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        color: '#245089',
                                                        bgcolor: theme.custom.surface.subtle,
                                                        '&:hover': {
                                                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                        },
                                                    }}
                                                >
                                                    {link.label}
                                                </Button>
                                            )) : (
                                                <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                                    -
                                                </Typography>
                                            )}
                                        </Stack>
                                    ) : row.value}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function GeneProgramTable({ gene, records, programRows }) {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(RELATION_ROWS_PER_PAGE);
    const rows = React.useMemo(
        () => (programRows?.length ? programRows : []),
        [programRows],
    );
    void records;
    const [sortBy, setSortBy] = React.useState('loading_gene_score');
    const [sortDir, setSortDir] = React.useState('desc');

    const TONES = {
        gene: tableTone(theme, 'success'),
        neutral: tableTone(theme, 'success'),
    };

    const groupedRows = React.useMemo(
        () => groupGeneProgramRows(rows),
        [rows],
    );
    const sortedRows = React.useMemo(
        () => [...groupedRows].sort((a, b) => compareGenePrograms(a, b, sortBy, sortDir)),
        [groupedRows, sortBy, sortDir],
    );
    const filteredRows = React.useMemo(
        () => sortedRows.filter((row) => matchesGeneProgramRow(row, searchQuery)),
        [searchQuery, sortedRows],
    );
    const shouldPaginate = filteredRows.length > RELATION_PAGINATION_THRESHOLD;
    const pageCount = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
    const currentPage = shouldPaginate ? Math.min(page, pageCount - 1) : 0;
    const start = shouldPaginate ? currentPage * rowsPerPage : 0;
    const visibleRows = shouldPaginate ? filteredRows.slice(start, start + rowsPerPage) : filteredRows;

    React.useEffect(() => {
        setPage(0);
    }, [searchQuery, sortBy, sortDir]);

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(['loading_gene_score', 'regulator_score'].includes(key) ? 'desc' : 'asc');
    }, [sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneProgramCsv(filteredRows);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-program-roles.csv`);
    }, [filteredRows, gene]);

    if (!rows.length) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 704 })}>
                    <colgroup>
                        {GENE_PROGRAM_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <EmbeddedTableTitleRow
                            title="Associated programs"
                            colSpan={GENE_PROGRAM_COLUMNS.length}
                            onDownload={handleDownload}
                            toolbar={(
                                <Box sx={tableToolbarGroupSx(theme, {
                                    width: { xs: '100%', sm: 'auto' },
                                    px: 0,
                                    py: 0,
                                    border: 'none',
                                    background: 'transparent',
                                    boxShadow: 'none',
                                })}
                                >
                                    <TableSearchField
                                        label="Search"
                                        value={searchQuery}
                                        placeholder="Program, role, score"
                                        onChange={setSearchQuery}
                                        onClear={() => setSearchQuery('')}
                                        width={{ xs: '100%', sm: 280 }}
                                    />
                                    <Button
                                        size="small"
                                        startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                        onClick={handleDownload}
                                        sx={tableToolbarActionButtonSx(theme)}
                                    >
                                        Export CSV
                                    </Button>
                                </Box>
                            )}
                        />
                        <TableRow>
                            {GENE_PROGRAM_COLUMNS.slice(0, 1).map((column) => {
                                return (
                                    <TableCell
                                        key={column.key}
                                        align={column.align}
                                        rowSpan={2}
                                        sx={relationIdentityHeaderSx(theme, embeddedColumnHeaderSx(theme, TONES.neutral, column.align))}
                                    >
                                        <Tooltip title={GENE_PROGRAM_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                            <TableSortLabel
                                                active={sortBy === column.key}
                                                direction={sortBy === column.key ? sortDir : 'asc'}
                                                hideSortIcon
                                                onClick={() => handleSort(column.key)}
                                                sx={{ ...geneSortLabelSx, justifyContent: justifyForAlign(column.align) }}
                                            >
                                                {column.label}
                                            </TableSortLabel>
                                        </Tooltip>
                                    </TableCell>
                                );
                            })}
                            <TableCell
                                align="center"
                                colSpan={3}
                                sx={relationHeaderSx(theme, embeddedColumnHeaderSx(theme, TONES.neutral, 'center'), 'loading_gene', { boundary: true })}
                            >
                                <Tooltip title={GENE_PROGRAM_COLUMN_DESCRIPTIONS.loading_gene} arrow>
                                    <Box component="span">loading_gene</Box>
                                </Tooltip>
                            </TableCell>
                            <TableCell
                                align="center"
                                colSpan={3}
                                sx={relationHeaderSx(theme, embeddedColumnHeaderSx(theme, TONES.neutral, 'center'), 'regulator', { boundary: true })}
                            >
                                <Tooltip title={GENE_PROGRAM_COLUMN_DESCRIPTIONS.regulator} arrow>
                                    <Box component="span">regulator</Box>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {GENE_PROGRAM_COLUMNS.slice(1).map((column) => {
                                const palette = TONES[column.tone];
                                const group = column.key.startsWith('regulator') ? 'regulator' : 'loading_gene';
                                return (
                                    <TableCell
                                        key={column.key}
                                        align={column.align}
                                        sx={relationHeaderSx(theme, embeddedColumnHeaderSx(theme, palette, column.align), group, {
                                            boundary: column.key === 'loading_gene_score' || column.key === 'regulator_score',
                                            top: GENE_TABLE_TITLE_HEADER_HEIGHT + 36,
                                        })}
                                    >
                                        <Tooltip title={GENE_PROGRAM_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                            <TableSortLabel
                                                active={sortBy === column.key}
                                                direction={sortBy === column.key ? sortDir : 'asc'}
                                                hideSortIcon
                                                onClick={() => handleSort(column.key)}
                                                sx={{ ...geneSortLabelSx, justifyContent: justifyForAlign(column.align) }}
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
                        {visibleRows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={GENE_PROGRAM_COLUMNS.length}
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
                        ) : visibleRows.map((row, index) => (
                            <TableRow
                                key={`${row.program}-${start + index}`}
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace', fontWeight: 500 }), 'identity', true)}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.72rem',
                                            px: 0,
                                            py: 0,
                                            color: '#7c4d12',
                                            justifyContent: 'center',
                                            minHeight: 0,
                                            '&:hover': { color: '#5f3a0b', textDecoration: 'underline' },
                                        }}
                                    >
                                        {row.program}
                                    </Button>
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace', fontWeight: 700 }), 'loading_gene', false, true)}>
                                    {formatNumber(roleEvidenceValue(row, 'program_gene', 'score'), 4)}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace', fontWeight: 700 }), 'loading_gene', true)}>
                                    {roleEvidenceValue(row, 'program_gene', 'rank') ?? '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, whiteSpace: 'normal' }), 'loading_gene')}>
                                    {roleEvidenceValue(row, 'program_gene', 'direction') || '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace', fontWeight: 700 }), 'regulator', true, true)}>
                                    {formatNumber(roleEvidenceValue(row, 'regulator', 'score'), 4)}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace', fontWeight: 700 }), 'regulator')}>
                                    {roleEvidenceValue(row, 'regulator', 'rank') ?? '-'}
                                </TableCell>
                                <TableCell align="center" sx={relationCellSx(theme, geneBodyCellSx({ align: 'center', tone: TONES.neutral, whiteSpace: 'normal' }), 'regulator', true)}>
                                    {roleEvidenceValue(row, 'regulator', 'direction') || '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <GeneRelationPagerFooter
                totalCount={filteredRows.length}
                page={currentPage}
                rowsPerPage={rowsPerPage}
                onPageChange={(event, nextPage) => setPage(nextPage)}
                onRowsPerPageChange={(nextRowsPerPage) => {
                    setRowsPerPage(nextRowsPerPage);
                    setPage(0);
                }}
                itemLabel="programs"
            />
        </Paper>
    );
}

function GeneDetailHeaderSkeleton() {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.5, md: 2 },
                bgcolor: theme.palette.background.paper,
                boxShadow: '0 10px 22px rgba(15, 23, 42, 0.045)',
            })}
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={{ xs: 1.5, md: 1.9 }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
            >
                <Box sx={{ minWidth: 0, width: 'auto', flex: { xs: '1 1 auto', md: '0 1 auto' }, display: 'flex', alignItems: 'center' }}>
                    <Skeleton variant="rounded" width={120} height={38} sx={{ borderRadius: 1.5 }} />
                </Box>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'repeat(2, minmax(0, 1fr))',
                            sm: 'repeat(3, minmax(104px, 1fr))',
                            md: 'repeat(3, minmax(104px, 1fr))',
                            lg: 'repeat(3, minmax(116px, 1fr))',
                        },
                        gap: { xs: 0.75, md: 0.9 },
                        width: '100%',
                        minWidth: 0,
                        flex: { xs: '1 1 auto', md: '1 1 0%' },
                        maxWidth: { md: 420 },
                    }}
                >
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Box
                            key={index}
                            sx={{
                                px: { xs: 1, md: 1.15 },
                                py: { xs: 0.85, md: 0.95 },
                                minHeight: { xs: 58, md: 64 },
                                borderRadius: 1.2,
                                border: `1px solid ${theme.custom.border.soft}`,
                                bgcolor: theme.custom.surface.subtle,
                            }}
                        >
                            <Skeleton variant="text" width="52%" height={26} />
                            <Skeleton variant="text" width="68%" height={18} sx={{ mt: 0.2 }} />
                        </Box>
                    ))}
                </Box>
            </Stack>
        </Paper>
    );
}

function GeneInfoTableSkeleton() {
    const theme = useTheme();

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden', bgcolor: theme.palette.background.paper, p: 1.5 })}>
            <Skeleton variant="text" width={180} height={30} sx={{ mb: 1 }} />
            <Stack spacing={0.85}>
                {Array.from({ length: 6 }).map((_, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
                            gap: 0.9,
                            alignItems: 'center',
                        }}
                    >
                        <Skeleton variant="rounded" height={34} />
                        <Skeleton variant="rounded" height={34 + (index === 1 || index === 5 ? 20 : 0)} />
                    </Box>
                ))}
            </Stack>
        </Paper>
    );
}

function GeneProgramTraitTable({
    gene,
    records,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortDir,
    onPageChange,
    onRowsPerPageChange,
    onSort,
    isRefreshing = false,
}) {
    const theme = useTheme();
    const rows = records || EMPTY_RECORDS;
    const [searchQuery, setSearchQuery] = React.useState('');

    const TONES = {
        gene: tableTone(theme, 'success'),
        program: tableTone(theme, 'success'),
        trait: tableTone(theme, 'success'),
        neutral: tableTone(theme, 'success'),
    };

    const handleSort = React.useCallback((key) => {
        const nextDir = sortBy === key
            ? (sortDir === 'asc' ? 'desc' : 'asc')
            : (['post_mean', 'abs_gamma', 'membership_score', 'concordance'].includes(key) ? 'desc' : 'asc');
        onSort?.(key, nextDir);
    }, [onSort, sortBy, sortDir]);

    const visibleRecords = rows.filter((row) => matchesGeneTraitRecord(row, searchQuery));

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneTraitCsv(visibleRecords);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-association-traits-page.csv`);
    }, [gene, visibleRecords]);

    const safeTotalCount = Number(totalCount) || rows.length;
    const safeRowsPerPage = Number(rowsPerPage) || RELATION_ROWS_PER_PAGE;
    const shouldPaginate = safeTotalCount > RELATION_PAGINATION_THRESHOLD;
    const pageCount = shouldPaginate ? Math.max(1, Math.ceil(safeTotalCount / safeRowsPerPage)) : 1;
    const currentPage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);
    const start = safeTotalCount ? currentPage * safeRowsPerPage : 0;

    if (!rows.length && !safeTotalCount) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1090 })}>
                    <colgroup>
                        {GENE_TRAIT_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <EmbeddedTableTitleRow
                            title="Associated traits"
                            colSpan={GENE_TRAIT_COLUMNS.length}
                            onDownload={handleDownload}
                            toolbar={(
                                <Box sx={tableToolbarGroupSx(theme, {
                                    width: { xs: '100%', sm: 'auto' },
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
                                        placeholder="Search visible rows"
                                        onChange={setSearchQuery}
                                        onClear={() => setSearchQuery('')}
                                        width={{ xs: '100%', sm: 260 }}
                                    />
                                    <Button
                                        size="small"
                                        startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                        onClick={handleDownload}
                                        sx={tableToolbarActionButtonSx(theme)}
                                    >
                                        Export CSV
                                    </Button>
                                </Box>
                            )}
                        />
                        <TableRow>
                            {GENE_TRAIT_COLUMNS.map((column) => {
                                const palette = TONES[column.tone];
                                return (
                                    <TableCell
                                        key={column.key}
                                        align={column.align}
                                        sx={embeddedColumnHeaderSx(theme, palette, column.align)}
                                    >
                                        <Tooltip title={GENE_TRAIT_COLUMN_DESCRIPTIONS[column.key] || column.label} arrow>
                                            <TableSortLabel
                                                active={sortBy === column.key}
                                                direction={sortBy === column.key ? sortDir : 'asc'}
                                                hideSortIcon
                                                onClick={() => handleSort(column.key)}
                                                sx={{ ...geneSortLabelSx, justifyContent: justifyForAlign(column.align) }}
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
                        {visibleRecords.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={GENE_TRAIT_COLUMNS.length}
                                    sx={{
                                        py: 3,
                                        textAlign: 'center',
                                        color: theme.palette.text.secondary,
                                        fontSize: '0.78rem',
                                        bgcolor: theme.palette.background.paper,
                                    }}
                                >
                                    No matching rows on this page.
                                </TableCell>
                            </TableRow>
                        ) : visibleRecords.map((row, index) => (
                            <TableRow
                                key={`${row.trait_id}-${row.program}-${row.role}-${row.ensg_id || row.gene_symbol}-${start + index}`}
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell
                                    align="left"
                                    sx={{
                                        ...geneBodyCellSx({ align: 'left', tone: TONES.trait, whiteSpace: 'normal' }),
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        verticalAlign: 'top',
                                    }}
                                >
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.file_id || row.trait_id)}`}
                                        endIcon={<OpenInNew sx={{ fontSize: 11 }} />}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.69rem',
                                            justifyContent: 'flex-start',
                                            alignItems: 'flex-start',
                                            px: 0,
                                            py: 0,
                                            color: '#245089',
                                            width: '100%',
                                            minHeight: 0,
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                textAlign: 'left',
                                                width: '100%',
                                                whiteSpace: 'normal',
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                lineHeight: 1.28,
                                            }}
                                        >
                                            {row.trait || row.trait_id}
                                        </Box>
                                    </Button>
                                </TableCell>
                                <TableCell align="center" sx={geneBodyCellSx({ align: 'center', tone: TONES.program, fontFamily: 'monospace', fontWeight: 500 })}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.72rem',
                                            px: 0,
                                            py: 0,
                                            color: '#7c4d12',
                                            justifyContent: 'center',
                                            minHeight: 0,
                                            '&:hover': { color: '#5f3a0b', textDecoration: 'underline' },
                                        }}
                                    >
                                        {row.program}
                                    </Button>
                                </TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        ...geneBodyCellSx({ align: 'center', tone: TONES.neutral, whiteSpace: 'normal' }),
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        verticalAlign: 'top',
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '0.67rem',
                                            color: theme.palette.text.secondary,
                                            lineHeight: 1.2,
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word',
                                            overflowWrap: 'anywhere',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {row.role || '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center" sx={geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace' })}>{formatSigned(getPostMean(row), 4)}</TableCell>
                                <TableCell align="center" sx={geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace' })}>{formatNumber(getAbsGamma(row), 4)}</TableCell>
                                <TableCell align="center" sx={geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace' })}>{formatNumber(getMembershipScore(row), 4)}</TableCell>
                                <TableCell align="center" sx={geneBodyCellSx({ align: 'center', tone: TONES.gene, whiteSpace: 'normal' })}>
                                    <Typography sx={{ fontSize: '0.69rem', fontWeight: 700, textAlign: 'center' }}>
                                        {getRecordDirection(row)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center" sx={{ ...geneBodyCellSx({ align: 'center', tone: TONES.neutral }), bgcolor: TONES.neutral.cellStrong }}>
                                    {getConcordanceLabel(row)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <GeneRelationPagerFooter
                totalCount={safeTotalCount}
                page={currentPage}
                rowsPerPage={safeRowsPerPage}
                onPageChange={(event, nextPage) => onPageChange?.(nextPage)}
                onRowsPerPageChange={(nextRowsPerPage) => onRowsPerPageChange?.(nextRowsPerPage)}
                itemLabel="associations"
            />
        </Paper>
    );
}

export default function Genes() {
    const [params, setParams] = useSearchParams();
    const queryParam = params.get('query') || '';
    const [input, setInput] = React.useState(queryParam);
    const [traitPage, setTraitPage] = React.useState(0);
    const [traitRowsPerPage, setTraitRowsPerPage] = React.useState(RELATION_ROWS_PER_PAGE);
    const [traitSortBy, setTraitSortBy] = React.useState('membership_score');
    const [traitSortDir, setTraitSortDir] = React.useState('desc');
    const query = queryParam.trim();
    const debouncedInput = useDebouncedValue(input.trim());
    const suggestionQuery = !query ? debouncedInput : '';
    const suggestionsPending = !query && input.trim().length >= 2 && suggestionQuery !== input.trim();
    const detailTablesReady = useAfterFirstPaint(query ? `gene-detail-${query}` : 'gene-home');

    React.useEffect(() => {
        setInput(queryParam);
    }, [queryParam]);

    React.useEffect(() => {
        setTraitPage(0);
        setTraitSortBy('membership_score');
        setTraitSortDir('desc');
    }, [query]);

    const { data: suggestions, isLoading: suggestionsLoading } = useSWR(
        suggestionQuery.length >= 2 ? ['gene-search', suggestionQuery] : null,
        ([, q]) => searchGenes(q, { limit: 12 }),
        interactiveSearchSWRConfig,
    );

    const overviewKey = query ? ['gene-overview', query] : null;
    const overviewResource = useCachedResourceState(
        useSWR(overviewKey, ([, q]) => getGeneOverview(q), detailSummarySWRConfig),
        { cacheKey: overviewKey, retainPreviousData: true },
    );
    const { displayData: overview, isInitialLoading: overviewLoading, error: overviewError } = overviewResource;

    const runSearch = React.useCallback((value = input) => {
        const next = value.trim();
        setTraitPage(0);
        setTraitSortBy('membership_score');
        setTraitSortDir('desc');
        if (!next) {
            setParams({});
            return;
        }
        setParams({ query: next });
    }, [input, setParams]);

    const clearSearch = React.useCallback(() => {
        setInput('');
        setParams({});
    }, [setParams]);

    const overviewUnavailable = Boolean(overview?.unavailable);
    const overviewGene = overview?.gene || (query ? { geneSymbol: query } : null);
    const programRoleKey = query ? ['gene-program-roles', query] : null;
    const programRoleResource = useCachedResourceState(
        useSWR(programRoleKey, ([, q]) => getGeneProgramRoles(q), relationIndexSWRConfig),
        { cacheKey: programRoleKey, retainPreviousData: false },
    );
    const { displayData: programRoleData, isInitialLoading: programRolesLoading } = programRoleResource;
    const programRows = programRoleData?.programs || programRoleData?.roles || [];
    const roleSummary = programRoleData?.summary || {};
    const summary = {
        ...(overview?.summary || {}),
        totalPrograms: Number(roleSummary.totalPrograms ?? overview?.summary?.totalPrograms) || 0,
    };
    const totalOverviewCount = Number(summary.totalRows) || 0;
    const hasProgramRoles = programRows.length > 0;
    const hasAssociationRows = totalOverviewCount > 0;

    const recordKey = query && !overviewLoading && !overviewError && !overviewUnavailable && hasAssociationRows
        ? ['gene-association-traits', query, traitPage, traitRowsPerPage, traitSortBy, traitSortDir]
        : null;
    const recordResource = useCachedResourceState(
        useSWR(recordKey, ([, q, pageIndex, limit, sortKey, direction]) => getGeneAssociationTraits(q, {
            page: pageIndex + 1,
            limit,
            sortBy: sortKey,
            order: direction,
        }), associationTraitsSWRConfig),
        { cacheKey: recordKey, retainPreviousData: true },
    );
    const { displayData: recordData, isInitialLoading: recordsLoading, isRefreshing: recordsRefreshing, isStale: recordsStale, error: recordsError } = recordResource;

    const recordPage = recordData?.recordPage || {};
    const hasFreshRecordPage = Boolean(
        recordData?.query === query
        && Number(recordPage.page || 1) === traitPage + 1
        && Number(recordPage.limit || traitRowsPerPage) === traitRowsPerPage
        && String(recordPage.sortBy || '') === traitSortBy
        && String(recordPage.order || '').toLowerCase() === String(traitSortDir || '').toLowerCase(),
    );
    const records = hasFreshRecordPage || recordsStale ? (recordData?.records || []) : [];
    const totalRecordCount = Number(recordPage.totalCount ?? summary.totalRows) || totalOverviewCount;

    const handleTraitSort = React.useCallback((key, direction) => {
        setTraitSortBy(key);
        setTraitSortDir(direction);
        setTraitPage(0);
    }, []);

    const handleTraitRowsPerPageChange = React.useCallback((nextRowsPerPage) => {
        setTraitRowsPerPage(nextRowsPerPage);
        setTraitPage(0);
    }, []);

    return (
        <PageFrame
            title={null}
            subtitle={null}
            maxWidth={DATA_PAGE_MAX_WIDTH}
            compact
        >
            <Stack spacing={query ? 1.5 : 2}>
                {(overviewUnavailable || recordData?.unavailable || programRoleData?.unavailable) && (
                    <Alert severity="warning" sx={{ borderRadius: 1 }}>
                        Gene relation SQL indexes are not available yet. Run the schema migration and relation import scripts before using this page.
                    </Alert>
                )}

                {query && overviewLoading && (
                    <>
                        <GeneDetailHeaderSkeleton />
                        <GeneInfoTableSkeleton />
                        <QuietDeferredPanel minHeight={220} />
                        <QuietDeferredPanel minHeight={300} />
                    </>
                )}

                {query && overviewError && (
                    <StatePanel severity="error" title="Failed to load gene evidence" message={overviewError.message || 'The gene lookup request failed.'} />
                )}

                {query && !overviewLoading && !overviewError && !overviewUnavailable && !programRolesLoading && !hasProgramRoles && !hasAssociationRows && (
                    <>
                        <GeneDetailHeader
                            gene={overviewGene || { geneSymbol: query }}
                            query={query}
                            summary={summary}
                            onSelect={(gene) => runSearch(gene)}
                        />
                        <GeneInfoTable gene={overviewGene || { geneSymbol: query }} summary={summary} />
                        <StatePanel
                            icon={TableChartOutlined}
                            title="No linked records"
                            message="This gene was not found in the imported cNMF program-role or Gene Association Map indexes. Click the gene name above to search another symbol or ENSG identifier."
                            minHeight={300}
                        />
                    </>
                )}

                {query && !overviewLoading && !overviewError && !overviewUnavailable && (hasAssociationRows || hasProgramRoles) && (
                    <>
                        <GeneDetailHeader
                            gene={overviewGene}
                            query={query}
                            summary={summary}
                            onSelect={(gene) => runSearch(gene)}
                        />
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
                            <GeneInfoTable gene={overviewGene} summary={summary} />
                            {detailTablesReady ? (
                                <GeneProgramTable gene={overviewGene} records={records} programRows={programRows} />
                            ) : (
                                <QuietDeferredPanel minHeight={220} />
                            )}
                        </Box>
                        {!hasAssociationRows ? null : recordsError ? (
                            <StatePanel
                                severity="error"
                                title="Failed to load linked traits"
                                message={recordsError.message || 'The trait evidence request failed.'}
                            />
                        ) : (recordsLoading || (!hasFreshRecordPage && !records.length)) ? (
                            <QuietDeferredPanel minHeight={300} />
                        ) : !detailTablesReady ? (
                            <QuietDeferredPanel minHeight={300} />
                        ) : (
                            <GeneProgramTraitTable
                                gene={overviewGene}
                                records={records}
                                page={traitPage}
                                rowsPerPage={traitRowsPerPage}
                                totalCount={totalRecordCount}
                                sortBy={traitSortBy}
                                sortDir={traitSortDir}
                                onPageChange={setTraitPage}
                                onRowsPerPageChange={handleTraitRowsPerPageChange}
                                onSort={handleTraitSort}
                                isRefreshing={recordsRefreshing || !hasFreshRecordPage}
                            />
                        )}
                    </>
                )}

                {!query && (
                    <>
                        <GeneHomeTable
                            input={input}
                            setInput={setInput}
                            suggestions={suggestions}
                            suggestionsLoading={suggestionsLoading || suggestionsPending}
                            onClear={clearSearch}
                            onSelect={(gene) => runSearch(gene)}
                        />
                    </>
                )}
            </Stack>
        </PageFrame>
    );
}
