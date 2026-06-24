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
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
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
import { getGeneOverview, getGeneProgramRecords, getGenes, searchGenes } from '../api/gwas';
import { PageFrame, StatePanel, UpdatingStatus } from '../components/PageScaffold';
import { downloadBlob } from '../utils/download';
import { detailSummarySWRConfig, interactiveSearchSWRConfig, stableListSWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import {
    captionSx,
    DATA_PAGE_MAX_WIDTH,
    groupedTableColumnHeaderCellSx,
    metricChipTone,
    panelSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    stickyTableHeaderCellSx,
    summaryChipSx,
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

function roleTone(theme, role) {
    if (role === 'program') return metricChipTone(theme, 'warning');
    if (role === 'regulator') return metricChipTone(theme, 'accent');
    return metricChipTone(theme, 'neutral');
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

function GenePaginationControl({ totalPages, page, onChange, size = 'small' }) {
    if (totalPages <= 1) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
            <Pagination
                count={totalPages}
                page={page + 1}
                onChange={(event, value) => onChange(event, value - 1)}
                color="primary"
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

function GeneRowsControl({ rowsPerPage, onChange, showLabel = true }) {
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
                    {[25, 50, 100, 200].map((value) => (
                        <MenuItem key={value} value={value} dense>{value}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}

function GeneHeaderPageControl({ totalPages, page, onChange }) {
    const [inputPage, setInputPage] = React.useState(page + 1);
    const pageNumber = Number(inputPage);
    const isValid = inputPage !== ''
        && Number.isInteger(pageNumber)
        && pageNumber >= 1
        && pageNumber <= totalPages;

    React.useEffect(() => {
        setInputPage(page + 1);
    }, [page]);

    if (totalPages <= 1) return null;

    const commitPage = () => {
        if (isValid) {
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
                disabled={page <= 0}
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
                    / {totalPages.toLocaleString()}
                </Typography>
            </Box>
            <IconButton
                size="small"
                aria-label="Next page"
                disabled={page >= totalPages - 1}
                onClick={() => onChange(null, page + 1)}
                sx={{ width: 31, height: 30, borderRadius: 0 }}
            >
                <KeyboardArrowRight fontSize="small" />
            </IconButton>
        </Box>
    );
}

function GenePageJumpControl({ totalPages, page, onChange }) {
    const theme = useTheme();
    const [inputPage, setInputPage] = React.useState(page + 1);
    const pageNumber = Number(inputPage);
    const canPage = totalPages > 1;
    const isValid = inputPage !== '' && Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages;

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
                inputProps={{ min: 1, max: totalPages }}
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
                / {totalPages.toLocaleString()}
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
            {shouldPaginate && (
                <Stack direction="row" spacing={0.9} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: { xs: 'flex-start', lg: 'flex-end' }, minWidth: 0 }}>
                    <GeneRowsControl rowsPerPage={rowsPerPage} onChange={onRowsPerPageChange} />
                    <GenePaginationControl totalPages={pageCount} page={currentPage} onChange={onPageChange} />
                    <GenePageJumpControl totalPages={pageCount} page={currentPage} onChange={onPageChange} />
                </Stack>
            )}
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
    { key: 'geneSymbol', label: 'Gene Symbol', align: 'center', width: 138 },
    { key: 'geneDescription', label: 'Gene Description', align: 'left', width: 320 },
    { key: 'ensgId', label: 'Ensembl ID', align: 'center', width: 170 },
    { key: 'location', label: 'Location', align: 'center', width: 190 },
    { key: 'geneType', label: 'Gene Type', align: 'center', width: 150 },
    { key: 'totalPrograms', label: 'Associated Programs', align: 'center', width: 156, headerWrap: true },
    { key: 'totalTraits', label: 'Associated Traits', align: 'center', width: 156, headerWrap: true },
];
const GENE_PROGRAM_COLUMNS = [
    { key: 'program', label: 'Program', align: 'center', width: 84, tone: 'program' },
    { key: 'programAnnotation', label: 'Function Annotation', align: 'left', width: 292, tone: 'neutral' },
    { key: 'programGoLabel', label: 'GO Term', align: 'left', width: 244, tone: 'neutral' },
    { key: 'geneDirection', label: 'Gene Role / Direction', align: 'center', width: 170, tone: 'gene' },
    { key: 'totalTraits', label: 'Associated Traits', align: 'center', width: 122, tone: 'trait' },
    { key: 'programGeneCountSort', label: 'Gene Count', align: 'center', width: 128, tone: 'gene' },
];
const GENE_TRAIT_COLUMNS = [
    { key: 'traitName', label: 'Trait', align: 'left', width: 272, tone: 'trait' },
    { key: 'program', label: 'Program', align: 'center', width: 82, tone: 'program' },
    { key: 'programAnnotation', label: 'Function Annotation', align: 'left', width: 228, tone: 'neutral' },
    { key: 'role', label: 'Role', align: 'center', width: 92, tone: 'gene' },
    { key: 'direction', label: 'Direction', align: 'center', width: 112, tone: 'gene' },
    { key: 'postMean', label: 'LoF Effect', align: 'center', width: 98, tone: 'neutral' },
    { key: 'membershipScore', label: 'Beta', align: 'center', width: 100, tone: 'neutral' },
    { key: 'concordance', label: 'Concordance', align: 'center', width: 132, tone: 'neutral' },
];
const EMPTY_GENE_ROWS = [];
const EMPTY_RECORDS = [];
const GO_TERM_PATTERN = /GO:\d{7}/i;
const TABLE_PAGINATION_THRESHOLD = 50;
const DEFAULT_ROWS_PER_PAGE = 25;

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

function geneProgramRoleLabel(role) {
    const value = String(role || '').trim().toLowerCase();
    if (!value) return '';
    if (value === 'program' || value === 'loading') return 'program';
    if (value === 'regulator') return 'regulator';
    return value;
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

function EmbeddedTableTitleRow({ title, caption, colSpan, onDownload, action = null }) {
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
                </Stack>
            </TableCell>
        </TableRow>
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
    return String(a || '').localeCompare(String(b || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
    });
}

function compareNullableNumber(a, b) {
    const left = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY;
    const right = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY;
    return left - right;
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
    if (sortBy === 'totalPrograms') result = (Number(a?.totalPrograms) || 0) - (Number(b?.totalPrograms) || 0);
    if (sortBy === 'totalTraits') result = (Number(a?.totalTraits) || 0) - (Number(b?.totalTraits) || 0);

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

function buildGoUrl(goText) {
    const text = String(goText || '').trim();
    if (!text) return '';
    const match = text.match(GO_TERM_PATTERN);
    if (match) return `https://www.ebi.ac.uk/QuickGO/term/${match[0].toUpperCase()}`;
    return `https://amigo.geneontology.org/amigo/search/ontology?q=${encodeURIComponent(text)}`;
}

function getRecordDirection(row) {
    return row?.predictedSign || row?.gammaSign || row?.postMeanSign || '-';
}

function getConcordanceLabel(row) {
    if (row?.isConcordant && row?.isDiscordant) return 'concordant + discordant';
    if (row?.isConcordant) return 'concordant';
    if (row?.isDiscordant) return 'discordant';
    return '-';
}

function buildGeneInfoCsv(gene, summary) {
    const rows = [
        ['Field', 'Value'],
        ['Gene Symbol', gene?.geneSymbol || 'NA'],
        ['Gene Description', gene?.geneName || gene?.description || 'NA'],
        ['Ensembl ID', gene?.ensgId || 'NA'],
        ['Gene Location', getGeneLocation(gene) || 'NA'],
        ['Gene Type', gene?.geneType || 'NA'],
        ['NCBI Gene Summary', gene?.description || 'NA'],
        ['More Information About the Gene', [
            buildEnsemblUrl(gene?.ensgId),
            buildGeneCardsUrl(gene?.geneSymbol),
            buildNcbiUrl(gene),
        ].filter(Boolean).join(' | ') || 'NA'],
        ['Associated Programs', Number(summary?.totalPrograms) || 0],
        ['Associated Traits', Number(summary?.totalTraits) || 0],
    ];
    const lines = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(','));
    return `${lines.join('\n')}\n`;
}

function buildGeneProgramRows(gene, records) {
    const map = new Map();

    records.forEach((row) => {
        if (!row.program) return;
        if (!map.has(row.program)) {
            map.set(row.program, {
                geneLabel: gene?.geneSymbol || row.geneSymbol || gene?.ensgId || row.ensgId || '',
                geneSymbol: gene?.geneSymbol || row.geneSymbol || '',
                ensgId: gene?.ensgId || row.ensgId || '',
                program: row.program,
                programAnnotation: row.programAnnotation || '',
                programGoLabel: row.representativeGo || row.top10Pathways || '',
                goEnrichmentP: row.goEnrichmentP || '',
                roles: new Set(),
                signs: new Set(),
                loadingGeneCount: 0,
                regulatorGeneCount: 0,
                traitIds: new Set(),
                primaryRow: null,
                topStrength: -1,
            });
        }

        const item = map.get(row.program);
        if (!item.programAnnotation && row.programAnnotation) item.programAnnotation = row.programAnnotation;
        if (!item.programGoLabel && (row.representativeGo || row.top10Pathways)) {
            item.programGoLabel = row.representativeGo || row.top10Pathways;
        }
        if (!item.goEnrichmentP && row.goEnrichmentP) item.goEnrichmentP = row.goEnrichmentP;
        if (row.role) item.roles.add(row.role);
        const direction = getRecordDirection(row);
        if (direction && direction !== '-') item.signs.add(direction);
        if (row.traitId) item.traitIds.add(row.traitId);
        item.loadingGeneCount = Math.max(item.loadingGeneCount, Number(row.loadingGeneCount) || 0);
        item.regulatorGeneCount = Math.max(item.regulatorGeneCount, Number(row.regulatorGeneCount) || 0);

        const strength = Math.max(
            Math.abs(Number(row.absGamma) || 0),
            Math.abs(Number(row.postMean) || 0),
            Math.abs(Number(row.membershipScore) || 0),
        );
        if (strength > item.topStrength) {
            item.topStrength = strength;
            item.primaryRow = row;
        }
    });

    return [...map.values()].map((item) => {
        const roleLabel = [...item.roles]
            .map(geneProgramRoleLabel)
            .filter(Boolean)
            .join(' + ') || '-';
        const signValues = [...item.signs];
        let signLabel = '-';
        if (signValues.length === 1) signLabel = signValues[0];
        if (signValues.length > 1) signLabel = 'mixed';
        const geneDirection = roleLabel === '-' ? signLabel : (signLabel === '-' ? roleLabel : `${roleLabel} / ${signLabel}`);
        const programGeneCountSort = (Number(item.loadingGeneCount) || 0) + (Number(item.regulatorGeneCount) || 0);

        return {
            geneLabel: item.geneLabel || item.geneSymbol || item.ensgId || '-',
            program: item.program,
            programAnnotation: item.programAnnotation || '-',
            programGoLabel: item.programGoLabel || '-',
            goEnrichmentP: item.goEnrichmentP || '',
            geneDirection,
            programGeneCountLabel: programGeneCountSort ? `${programGeneCountSort.toLocaleString()} genes` : '-',
            programGeneCountSort,
            totalTraits: item.traitIds.size,
        };
    }).sort((a, b) => (
        b.totalTraits - a.totalTraits
        || b.programGeneCountSort - a.programGeneCountSort
        || compareText(a.program, b.program)
    ));
}

function buildGeneProgramCsv(rows) {
    const lines = [
        GENE_PROGRAM_COLUMNS.map((column) => escapeCsvValue(column.label)).join(','),
        ...rows.map((row) => ([
            row.program || '',
            row.programAnnotation || '',
            row.programGoLabel || '',
            row.geneDirection || '',
            row.totalTraits || '',
            row.programGeneCountLabel || '',
        ].map((value) => escapeCsvValue(value)).join(','))),
    ];
    return `${lines.join('\n')}\n`;
}

function buildGeneTraitCsv(rows) {
    const lines = [
        [
            'Trait',
            'Trait ID',
            'Program',
            'Function Annotation',
            'Role',
            'Direction',
            'LoF Effect',
            'Beta',
            'Concordance',
        ].map((value) => escapeCsvValue(value)).join(','),
        ...rows.map((row) => ([
            row.traitName || '',
            row.traitId || '',
            row.program || '',
            row.programAnnotation || '',
            row.role || '',
            getRecordDirection(row),
            Number.isFinite(row.postMean) ? row.postMean : '',
            Number.isFinite(row.membershipScore) ? row.membershipScore : '',
            getConcordanceLabel(row),
        ].map((value) => escapeCsvValue(value)).join(','))),
    ];
    return `${lines.join('\n')}\n`;
}

function compareGenePrograms(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'geneLabel') result = compareText(a?.geneLabel, b?.geneLabel);
    if (sortBy === 'program') result = compareText(a?.program, b?.program);
    if (sortBy === 'programAnnotation') result = compareText(a?.programAnnotation, b?.programAnnotation);
    if (sortBy === 'programGoLabel') result = compareText(a?.programGoLabel, b?.programGoLabel);
    if (sortBy === 'geneDirection') result = compareText(a?.geneDirection, b?.geneDirection);
    if (sortBy === 'totalTraits') result = (Number(a?.totalTraits) || 0) - (Number(b?.totalTraits) || 0);
    if (sortBy === 'programGeneCountSort') result = (Number(a?.programGeneCountSort) || 0) - (Number(b?.programGeneCountSort) || 0);

    if (!result) result = compareText(a?.program, b?.program);
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
                                {gene.ensgId && (
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
    const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
    const searchPlaceholder = GENE_PLACEHOLDERS[placeholderIndex % GENE_PLACEHOLDERS.length];

    React.useEffect(() => {
        const timer = setInterval(() => {
            setPlaceholderIndex((index) => (index + 1) % GENE_PLACEHOLDERS.length);
        }, 3600);
        return () => clearInterval(timer);
    }, []);
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
                sx={{
                    px: { xs: 1.5, md: 2 },
                    py: { xs: 1.1, md: 1.15 },
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        lg: 'max-content minmax(180px, 1fr) max-content',
                    },
                    alignItems: 'center',
                    gap: { xs: 0.7, lg: 1.1 },
                    minWidth: 0,
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 0.65,
                        flexWrap: 'wrap',
                        maxWidth: { lg: 280 },
                        '@media (min-width: 2200px)': {
                            maxWidth: 420,
                        },
                    }}
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
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: { xs: 'flex-start', lg: 'center' },
                        gap: 0.85,
                        flexWrap: 'wrap',
                        minWidth: 0,
                    }}
                >
                    <TextField
                        size="small"
                        value={input}
                        onChange={handleSearchInputChange}
                        placeholder={searchPlaceholder}
                        sx={{
                            width: '100%',
                            maxWidth: { lg: 260 },
                            '@media (min-width: 2200px)': {
                                maxWidth: 360,
                            },
                            '& .MuiOutlinedInput-root': {
                                height: 32,
                                bgcolor: theme.palette.background.paper,
                                borderRadius: 1,
                                borderColor: alpha('#2f6a49', 0.16),
                            },
                            '& .MuiOutlinedInput-input': {
                                py: 0.55,
                                fontSize: '0.8rem',
                            },
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchOutlined fontSize="small" sx={{ color: '#2f6a49' }} />
                                </InputAdornment>
                            ),
                        }}
                    />
                    {(searchInput || activeSearch) && (
                        <Button
                            size="small"
                            variant="text"
                            onClick={clearTableSearch}
                            sx={{ textTransform: 'none', color: theme.palette.text.secondary, minWidth: 48, height: 32, py: 0.45 }}
                        >
                            Clear
                        </Button>
                    )}
                </Box>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: { xs: 'flex-start', lg: 'flex-end' },
                        justifySelf: { xs: 'start', lg: 'end' },
                        gap: 0.85,
                        flexWrap: { xs: 'wrap', lg: 'nowrap' },
                        whiteSpace: { lg: 'nowrap' },
                        minWidth: 0,
                    }}
                >
                    {shouldPaginate && <GeneHeaderPageControl totalPages={pageCount} page={currentPage} onChange={handlePageChange} />}
                    {shouldPaginate && <GeneRowsControl rowsPerPage={rowsPerPage} onChange={handleRowsPerPageChange} showLabel={false} />}
                    <UpdatingStatus active={isRefreshing} />
                    <Button
                        size="small"
                        startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                        onClick={handleDownload}
                        disabled={downloading || data?.unavailable}
                        sx={{
                            textTransform: 'none',
                            fontSize: '0.74rem',
                            color: '#315d57',
                            border: `1px solid ${alpha('#2f6a49', 0.18)}`,
                            bgcolor: alpha('#2f6a49', 0.045),
                            minWidth: 116,
                            height: 32,
                            py: 0.38,
                            flexShrink: 0,
                            '&:hover': {
                                bgcolor: alpha('#2f6a49', 0.08),
                                borderColor: alpha('#2f6a49', 0.28),
                            },
                        }}
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
                <Table size="small" stickyHeader sx={stickyTableSx(theme, { minWidth: 1280, tableLayout: 'auto' })}>
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
                                        ? `No genes match "${activeSearch}" in the imported gene-program-trait index.`
                                        : 'No genes found in the imported gene-program-trait index.'}
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
                                                <Typography sx={{ fontSize: '0.76rem', lineHeight: 1.35, color: theme.palette.text.primary, overflowWrap: 'anywhere' }}>
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
                                        {[item.ensgId, getGeneLocation(item), item.geneType].filter(Boolean).join(' | ') || '-'}
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
            label: 'Gene Symbol',
            value: gene?.geneSymbol || 'NA',
            tone: 'link',
            align: 'center',
        },
        {
            label: 'Gene Description',
            value: gene?.geneName || gene?.description || 'NA',
        },
        {
            label: 'Ensembl ID',
            value: gene?.ensgId || 'NA',
            mono: true,
            tone: 'link',
            align: 'center',
        },
        {
            label: 'Gene Location',
            value: getGeneLocation(gene) || 'NA',
            mono: true,
            align: 'center',
        },
        {
            label: 'Gene Type',
            value: gene?.geneType || 'NA',
            align: 'center',
        },
        {
            label: 'NCBI Gene Summary',
            value: gene?.description || 'NA',
            wrap: true,
        },
        {
            label: 'More Information About the Gene',
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
                                                    NA
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
    const rows = React.useMemo(
        () => (programRows?.length ? programRows : buildGeneProgramRows(gene, records)),
        [gene, records, programRows],
    );
    const [sortBy, setSortBy] = React.useState('totalTraits');
    const [sortDir, setSortDir] = React.useState('desc');

    const TONES = {
        gene: tableTone(theme, 'success'),
        program: tableTone(theme, 'success'),
        trait: tableTone(theme, 'success'),
        neutral: tableTone(theme, 'success'),
    };

    const sortedRows = React.useMemo(
        () => [...rows].sort((a, b) => compareGenePrograms(a, b, sortBy, sortDir)),
        [rows, sortBy, sortDir],
    );

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(key === 'programGeneCountSort' || key === 'totalTraits' ? 'desc' : 'asc');
    }, [sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneProgramCsv(sortedRows);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-program.csv`);
    }, [gene, sortedRows]);

    if (!rows.length) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1056 })}>
                    <colgroup>
                        {GENE_PROGRAM_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <EmbeddedTableTitleRow
                            title="Associated Programs"
                            colSpan={GENE_PROGRAM_COLUMNS.length}
                            onDownload={handleDownload}
                        />
                        <TableRow>
                            {GENE_PROGRAM_COLUMNS.map((column) => {
                                const palette = TONES[column.tone];
                                return (
                                    <TableCell
                                        key={column.key}
                                        sx={embeddedColumnHeaderSx(theme, palette, column.align)}
                                    >
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...geneSortLabelSx, justifyContent: justifyForAlign(column.align) }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedRows.map((row, index) => (
                            <TableRow
                                key={`${row.program}-${index}`}
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.program, fontFamily: 'monospace', fontWeight: 500 })}>
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
                                    sx={{
                                        ...geneBodyCellSx({ align: 'left', tone: TONES.neutral, whiteSpace: 'normal' }),
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        verticalAlign: 'top',
                                    }}
                                >
                                    {row.programGoLabel !== '-' ? (
                                        <Button
                                            component="a"
                                            href={buildGoUrl(row.programGoLabel)}
                                            target="_blank"
                                            rel="noreferrer"
                                            endIcon={<OpenInNew sx={{ fontSize: 11 }} />}
                                            sx={{
                                                textTransform: 'none',
                                                px: 0,
                                                py: 0,
                                                justifyContent: 'flex-start',
                                                minHeight: 0,
                                                color: theme.palette.text.primary,
                                                fontSize: '0.69rem',
                                                lineHeight: 1.3,
                                                display: 'inline-flex',
                                                width: '100%',
                                                textAlign: 'left',
                                                whiteSpace: 'normal',
                                            }}
                                        >
                                            {row.programAnnotation}
                                        </Button>
                                    ) : (
                                        <Typography
                                            sx={{
                                                fontSize: '0.69rem',
                                                lineHeight: 1.3,
                                                whiteSpace: 'normal',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {row.programAnnotation}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell
                                    sx={{
                                        ...geneBodyCellSx({ align: 'left', tone: TONES.neutral, whiteSpace: 'normal' }),
                                        bgcolor: TONES.neutral.cellStrong,
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        verticalAlign: 'top',
                                    }}
                                >
                                    {row.programGoLabel !== '-' ? (
                                        <>
                                            <Button
                                                component="a"
                                                href={buildGoUrl(row.programGoLabel)}
                                                target="_blank"
                                                rel="noreferrer"
                                                endIcon={<OpenInNew sx={{ fontSize: 11 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontWeight: 700,
                                                    fontSize: '0.69rem',
                                                    px: 0,
                                                    py: 0,
                                                    justifyContent: 'flex-start',
                                                    minHeight: 0,
                                                    color: TONES.neutral.headerColor,
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    whiteSpace: 'normal',
                                                }}
                                            >
                                                {row.programGoLabel}
                                            </Button>
                                        </>
                                    ) : (
                                        <Typography sx={{ fontSize: '0.69rem', color: theme.palette.text.secondary }}>
                                            —
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.gene, fontWeight: 600 })}>
                                    <Typography sx={{ fontSize: '0.69rem', fontWeight: 700 }}>
                                        {row.geneDirection}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.trait, fontFamily: 'monospace', fontWeight: 600 })}>
                                    {Number(row.totalTraits || 0).toLocaleString()}
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.gene, fontFamily: 'monospace', fontWeight: 600 })}>
                                    {row.programGeneCountLabel}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
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

    const TONES = {
        gene: tableTone(theme, 'success'),
        program: tableTone(theme, 'success'),
        trait: tableTone(theme, 'success'),
        neutral: tableTone(theme, 'success'),
    };

    const handleSort = React.useCallback((key) => {
        const nextDir = sortBy === key
            ? (sortDir === 'asc' ? 'desc' : 'asc')
            : (['postMean', 'membershipScore', 'concordance'].includes(key) ? 'desc' : 'asc');
        onSort?.(key, nextDir);
    }, [onSort, sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneTraitCsv(rows);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-program-trait-page.csv`);
    }, [gene, rows]);

    const safeTotalCount = Number(totalCount) || rows.length;
    const safeRowsPerPage = Number(rowsPerPage) || DEFAULT_ROWS_PER_PAGE;
    const shouldPaginate = safeTotalCount > TABLE_PAGINATION_THRESHOLD;
    const pageCount = shouldPaginate ? Math.max(1, Math.ceil(safeTotalCount / safeRowsPerPage)) : 1;
    const currentPage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);
    const start = safeTotalCount ? currentPage * safeRowsPerPage : 0;

    if (!rows.length && !safeTotalCount) return null;

    const visibleRecords = rows;

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
                            title="Associated Traits"
                            colSpan={GENE_TRAIT_COLUMNS.length}
                            onDownload={handleDownload}
                            action={<UpdatingStatus active={isRefreshing} />}
                        />
                        <TableRow>
                            {GENE_TRAIT_COLUMNS.map((column) => {
                                const palette = TONES[column.tone];
                                return (
                                    <TableCell
                                        key={column.key}
                                        sx={embeddedColumnHeaderSx(theme, palette, column.align)}
                                    >
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={{ ...geneSortLabelSx, justifyContent: justifyForAlign(column.align) }}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleRecords.map((row, index) => (
                            <TableRow
                                key={`${row.traitId}-${row.program}-${row.role}-${row.ensgId || row.geneSymbol}-${start + index}`}
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell
                                    sx={{
                                        ...geneBodyCellSx({ align: 'left', tone: TONES.trait, whiteSpace: 'normal' }),
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        verticalAlign: 'top',
                                    }}
                                >
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.fileId || row.traitId)}`}
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
                                            {row.traitName || row.traitId}
                                        </Box>
                                    </Button>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.program, fontFamily: 'monospace', fontWeight: 500 })}>
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
                                    sx={{
                                        ...geneBodyCellSx({ align: 'left', tone: TONES.neutral, whiteSpace: 'normal' }),
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
                                        }}
                                    >
                                        {row.programAnnotation || '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.gene })}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                        <Chip label={row.role} size="small" sx={{
                                            ...summaryChipSx(theme, roleTone(theme, row.role)),
                                            height: 20,
                                            fontSize: '0.62rem',
                                        }} />
                                    </Box>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.gene, whiteSpace: 'normal' })}>
                                    <Typography sx={{ fontSize: '0.69rem', fontWeight: 700, textAlign: 'center' }}>
                                        {getRecordDirection(row)}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace' })}>{formatSigned(row.postMean, 4)}</TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.neutral, fontFamily: 'monospace' })}>{formatNumber(row.membershipScore, 4)}</TableCell>
                                <TableCell sx={{ ...geneBodyCellSx({ align: 'center', tone: TONES.neutral }), bgcolor: TONES.neutral.cellStrong }}>
                                    {getConcordanceLabel(row)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {shouldPaginate && (
                <TablePagination
                    component="div"
                    count={safeTotalCount}
                    page={currentPage}
                    onPageChange={(event, nextPage) => onPageChange?.(nextPage)}
                    rowsPerPage={safeRowsPerPage}
                    labelRowsPerPage="Associations per page"
                    rowsPerPageOptions={[25, 50, 100, 250]}
                    onRowsPerPageChange={(event) => {
                        onRowsPerPageChange?.(Number(event.target.value));
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

export default function Genes() {
    const [params, setParams] = useSearchParams();
    const queryParam = params.get('query') || '';
    const [input, setInput] = React.useState(queryParam);
    const [traitPage, setTraitPage] = React.useState(0);
    const [traitRowsPerPage, setTraitRowsPerPage] = React.useState(DEFAULT_ROWS_PER_PAGE);
    const [traitSortBy, setTraitSortBy] = React.useState('membershipScore');
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
        setTraitSortBy('membershipScore');
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
        setTraitSortBy('membershipScore');
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
    const programRows = overview?.programs || [];
    const summary = overview?.summary || {};
    const totalOverviewCount = Number(summary.totalRows) || 0;

    const recordKey = query && !overviewLoading && !overviewError && !overviewUnavailable && totalOverviewCount > 0
        ? ['gene-records', query, traitPage, traitRowsPerPage, traitSortBy, traitSortDir]
        : null;
    const recordResource = useCachedResourceState(
        useSWR(recordKey, ([, q, pageIndex, limit, sortKey, direction]) => getGeneProgramRecords(q, {
            page: pageIndex + 1,
            limit,
            sortBy: sortKey,
            order: direction,
        }), stableListSWRConfig),
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
                {(overviewUnavailable || recordData?.unavailable) && (
                    <Alert severity="warning" sx={{ borderRadius: 1 }}>
                        Gene SQL index is not available yet. Run the schema migration and import script before using this page.
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

                {query && !overviewLoading && !overviewError && !overviewUnavailable && totalOverviewCount === 0 && (
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
                            message="This gene was not found in the imported gene-program-trait index. Click the gene name above to search another symbol or ENSG identifier."
                            minHeight={300}
                        />
                    </>
                )}

                {query && !overviewLoading && !overviewError && !overviewUnavailable && totalOverviewCount > 0 && (
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
                        {recordsError ? (
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
