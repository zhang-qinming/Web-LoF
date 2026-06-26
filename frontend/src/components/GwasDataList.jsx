import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { alpha, useTheme } from '@mui/material/styles';
import { fetcher } from '../api/gwas';
import { downloadBlob } from '../utils/download';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { stableListSWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { UpdatingStatus } from './PageScaffold';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import TableSortLabel from '@mui/material/TableSortLabel';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Clear from '@mui/icons-material/Clear';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import Search from '@mui/icons-material/Search';
import {
    panelSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableHeaderCellSx,
    stickyTableSx,
    tableRowRevealSx,
    tableSkeletonCellSx,
} from '../themeUtils';

function PaginationControl({ totalPages, page, onChange }) {
    if (totalPages <= 1) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
            <Pagination
                count={totalPages}
                page={page}
                onChange={onChange}
                color="primary"
                shape="rounded"
                size="small"
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

function JumpToPageControl({ totalPages, page, onChange }) {
    const [inputPage, setInputPage] = useState(page);
    const pageNumber = Number(inputPage);

    const isValid = inputPage !== '' && Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isValid) {
            onChange(null, pageNumber);
            return;
        }
        setInputPage(page);
    };

    const handleBlur = () => {
        if (!isValid) setInputPage(page);
    };

    useEffect(() => {
        setInputPage(page);
    }, [page]);

    if (totalPages <= 1) return null;

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.45, flexShrink: 0, minHeight: 32 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, whiteSpace: 'nowrap' }}>
                Page
            </Typography>
            <TextField
                size="small"
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit(e);
                }}
                onBlur={handleBlur}
                type="number"
                inputProps={{ min: 1, max: totalPages, step: 1 }}
                sx={{
                    '& .MuiOutlinedInput-root': {
                        height: 32,
                        bgcolor: 'background.paper',
                    },
                    '& .MuiOutlinedInput-input': {
                        width: 52,
                        py: 0.48,
                        px: 0.7,
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        fontWeight: 650,
                    },
                    '& fieldset': { borderRadius: 1 },
                }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                / {totalPages.toLocaleString()}
            </Typography>
            <Button type="submit" size="small" variant="outlined" disabled={!isValid} sx={{ minWidth: 38, height: 32, px: 0.9, py: 0.35, textTransform: 'none', fontSize: '0.72rem', fontWeight: 680 }}>
                Go
            </Button>
        </Box>
    );
}

function HeaderPageControl({ totalPages, page, onChange }) {
    const [inputPage, setInputPage] = useState(page);
    const pageNumber = Number(inputPage);
    const isValid = inputPage !== ''
        && Number.isInteger(pageNumber)
        && pageNumber >= 1
        && pageNumber <= totalPages;

    useEffect(() => {
        setInputPage(page);
    }, [page]);

    if (totalPages <= 1) return null;

    const commitPage = () => {
        if (isValid) {
            onChange(pageNumber);
            return;
        }
        setInputPage(page);
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
                disabled={page <= 1}
                onClick={() => onChange(page - 1)}
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
                disabled={page >= totalPages}
                onClick={() => onChange(page + 1)}
                sx={{ width: 31, height: 30, borderRadius: 0 }}
            >
                <KeyboardArrowRight fontSize="small" />
            </IconButton>
        </Box>
    );
}

function formatCellValue(row, columnId) {
    if (columnId === 'sample_size' || columnId === 'Sample Size') {
        const value = row[columnId] ?? row.sample_size;
        return value != null && value !== '' ? Number(value).toLocaleString() : '-';
    }
    if (columnId === 'n_variants' || columnId === 'Variants') {
        const value = row[columnId] ?? row.n_variants;
        return value != null && value !== '' ? Number(value).toLocaleString() : '-';
    }
    if (columnId === 'year' || columnId === 'Year') {
        const value = row[columnId] ?? row.year;
        return value != null && value !== '' ? String(value) : '-';
    }
    if (columnId === 'n_sig' || columnId === 'Significant Loci') {
        const value = row[columnId] ?? row.n_sig;
        return value != null && value !== '' ? Number(value).toLocaleString() : '-';
    }
    if (columnId === 'qc_score' || columnId === 'QC') {
        const value = row[columnId] ?? row.qc_score;
        return value != null && value !== '' ? String(value) : '-';
    }
    if (columnId === 'mesh_term' || columnId === 'MeSH term') {
        return row[columnId] || row.mesh_term || '-';
    }
    if (columnId === 'population' || columnId === 'Population') {
        return row[columnId] || row.population || '-';
    }
    return row[columnId] || '-';
}

function escapeTsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildGwasTableTsv(rows, columns) {
    const header = columns.map((column) => escapeTsvValue(column.label)).join('\t');
    const lines = rows.map((row) => columns
        .map((column) => escapeTsvValue(formatCellValue(row, column.id)))
        .join('\t'));
    return `${[header, ...lines].join('\n')}\n`;
}

function matchesTraitRow(row, columns, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;

    return columns.some((column) => String(formatCellValue(row, column.id) ?? '')
        .toLowerCase()
        .includes(normalizedQuery));
}

function columnLayoutSx(column = {}) {
    const sx = {};
    if (column.width !== undefined) sx.width = column.width;
    if (column.minWidth !== undefined) sx.minWidth = column.minWidth;
    if (column.maxWidth !== undefined) sx.maxWidth = column.maxWidth;
    return sx;
}

function headerLayoutSx(column = {}) {
    if (!column.headerWrap) return {};
    return {
        whiteSpace: 'normal',
        overflow: 'visible',
        textOverflow: 'clip',
        lineHeight: 1.1,
        wordBreak: 'break-word',
        py: 0.9,
    };
}

const GWAS_TABLE_COLUMN_HEADER_HEIGHT = 46;
const TABLE_PAGINATION_THRESHOLD = 50;
const DEFAULT_ROWS_PER_PAGE = 25;

function useDebouncedValue(value, delayMs = 280) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delayMs);

        return () => window.clearTimeout(timeoutId);
    }, [delayMs, value]);

    return debouncedValue;
}

function parsePositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return fallback;
    if (parsed < min || parsed > max) return fallback;
    return parsed;
}

function getColumnAlign(column = {}) {
    if (column.align) return column.align;
    return 'center';
}

function justifyForAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

function normalizeSortOrder(value, fallback = 'ASC') {
    return String(value || '').toUpperCase() === 'DESC' ? 'DESC' : fallback;
}

function buildTraitHref(row) {
    const path = `/trait/${encodeURIComponent(row.file_id)}`;
    return path;
}

function metricValueTone(theme, tone) {
    if (tone === 'primary') {
        return {
            color: theme.palette.primary.dark,
            backgroundColor: alpha(theme.palette.primary.main, 0.055),
            borderColor: alpha(theme.palette.primary.main, 0.16),
        };
    }
    if (tone === 'cyan') {
        return {
            color: '#245089',
            backgroundColor: alpha('#0e7490', 0.055),
            borderColor: alpha('#0e7490', 0.16),
        };
    }
    if (tone === 'warning') {
        return {
            color: '#7c4d12',
            backgroundColor: alpha('#d97706', 0.07),
            borderColor: alpha('#d97706', 0.18),
        };
    }
    if (tone === 'success') {
        return {
            color: '#166534',
            backgroundColor: alpha('#15803d', 0.07),
            borderColor: alpha('#15803d', 0.18),
        };
    }
    return {
        color: '#92400e',
        backgroundColor: alpha('#b45309', 0.07),
        borderColor: alpha('#b45309', 0.18),
    };
}

function MetricValue({ value, tone, theme, align = 'center' }) {
    const colors = metricValueTone(theme, tone);
    const justifyContent = align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center';
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                justifyContent,
                alignItems: 'center',
                minWidth: 72,
                maxWidth: '100%',
                px: 0.7,
                py: 0.2,
                borderRadius: 0.75,
                border: `1px solid ${colors.borderColor}`,
                bgcolor: colors.backgroundColor,
                color: colors.color,
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" 1',
                fontSize: '0.76rem',
                fontWeight: 680,
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
            }}
        >
            {value}
        </Box>
    );
}

function TraitRow({ row, index, columns, theme }) {
    return (
        <TableRow
            sx={{
                backgroundColor: index % 2 === 0 ? 'rgba(37, 99, 235, 0.025)' : 'white',
                ...tableRowRevealSx(theme, index),
                transition: 'background-color 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1)',
                '&:hover': {
                    backgroundColor: 'rgba(37, 99, 235, 0.06)',
                    transform: 'translateY(-1px)',
                    boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.08)',
                },
                '& td': {
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    py: 1.5,
                    fontSize: '0.875rem',
                },
            }}
        >
            {columns.map((col) => {
                const columnAlign = getColumnAlign(col);

                return (
                <TableCell
                    key={col.id}
                    align={columnAlign}
                    sx={{
                        ...columnLayoutSx(col),
                        textAlign: columnAlign,
                        whiteSpace: 'normal',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                    }}
                >
                    {col.id === 'trait_name' ? (
                        <Link
                            component={RouterLink}
                            to={buildTraitHref(row)}
                            underline="hover"
                            sx={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.85rem' }}
                        >
                            {String(row[col.id] || '').replace(/^["']+|["']+$/g, '')}
                        </Link>
                    ) : (col.id === 'n_variants' || col.id === 'Variants') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone="cyan" theme={theme} align={columnAlign} />
                    ) : (col.id === 'n_sig' || col.id === 'Significant Loci') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone="warning" theme={theme} align={columnAlign} />
                    ) : (col.id === 'qc_score' || col.id === 'QC') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone={Number(row.qc_score) >= 100 ? 'success' : 'caution'} theme={theme} align={columnAlign} />
                    ) : (
                        formatCellValue(row, col.id)
                    )}
                </TableCell>
                );
            })}
        </TableRow>
    );
}

function LoadingSkeleton({ rows = 10, columns, theme }) {
    return (
        <>
            {Array.from(new Array(rows)).map((_, index) => (
                <TableRow key={index} sx={tableRowRevealSx(theme, index)}>
                    {columns.map((col, columnIndex) => (
                        <TableCell key={col.id} sx={{ py: 1.5 }}>
                            <Box
                                sx={tableSkeletonCellSx(
                                    theme,
                                    index + columnIndex,
                                    col.id === 'trait_name' ? 'primary' : 'neutral',
                                )}
                            />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}

function QuietTableRowsPlaceholder({ columns, rows = 10 }) {
    return (
        <TableRow aria-hidden="true">
            <TableCell
                colSpan={Math.max(columns.length, 1)}
                sx={{
                    height: Math.max(180, rows * 48),
                    py: 0,
                    borderBottom: 0,
                }}
            />
        </TableRow>
    );
}

const TRAIT_PLACEHOLDERS = [
    'e.g. GCST90081631',
    'e.g. PA00638 (Self-reported illness)',
    'e.g. Hypertension',
    'e.g. Diabetes',
    'e.g. PA00450 (Type 2 diabetes)',
    'e.g. Alzheimer\'s disease',
    'e.g. GCST90014269 (Coronary artery disease)',
    'e.g. Body mass index'
];

export default function GwasDataList({
    title = 'GWAS Data',
    columns = [],
    defaultSortBy = 'Trait',
    defaultOrder = 'ASC',
}) {
    const theme = useTheme();
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const searchPlaceholder = TRAIT_PLACEHOLDERS[placeholderIndex % TRAIT_PLACEHOLDERS.length];

    useEffect(() => {
        const timer = setInterval(() => {
            setPlaceholderIndex((index) => (index + 1) % TRAIT_PLACEHOLDERS.length);
        }, 3600);
        return () => clearInterval(timer);
    }, []);
    const [searchParams, setSearchParams] = useSearchParams();
    const rootRef = useRef(null);
    const availableSortColumns = useMemo(() => new Set(columns.map((column) => column.id)), [columns]);
    const resolvedDefaultSortBy = availableSortColumns.has(defaultSortBy) ? defaultSortBy : (columns[0]?.id || defaultSortBy);
    const resolvedDefaultOrder = normalizeSortOrder(defaultOrder);
    const [page, setPage] = useState(() => parsePositiveInteger(searchParams.get('page'), 1));
    const [limit, setLimit] = useState(() => parsePositiveInteger(searchParams.get('limit'), DEFAULT_ROWS_PER_PAGE, { min: 5, max: 200 }));
    const [sortBy, setSortBy] = useState(() => {
        const candidate = searchParams.get('sortBy');
        return candidate && availableSortColumns.has(candidate) ? candidate : resolvedDefaultSortBy;
    });
    const [order, setOrder] = useState(() => normalizeSortOrder(searchParams.get('order'), resolvedDefaultOrder));
    const [search, setSearch] = useState(() => searchParams.get('search') || '');
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const liveSearch = search.trim();
    const normalizedSearch = useDebouncedValue(liveSearch);

    const apiUrl = useMemo(() => {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sortBy,
            order,
        });
        if (normalizedSearch) params.set('search', normalizedSearch);

        return `/api/browse?${params.toString()}`;
    }, [limit, normalizedSearch, order, page, sortBy]);

    const traitResource = useCachedResourceState(
        useSWR(apiUrl, fetcher, stableListSWRConfig),
        { cacheKey: apiUrl, retainPreviousData: true },
    );
    const { displayData: data, error, isInitialLoading: isLoading, isRefreshing } = traitResource;

    const handleSort = useCallback((column) => {
        const isAsc = sortBy === column && order === 'ASC';
        setOrder(isAsc ? 'DESC' : 'ASC');
        setSortBy(column);
        setPage(1);
    }, [sortBy, order]);

    const handleChangeLimit = useCallback((e) => {
        const newLimit = Number(e.target.value);
        if (newLimit >= 5 && newLimit <= 200) {
            setLimit(newLimit);
            setPage(1);
        }
    }, []);

    useEffect(() => {
        const nextParams = new URLSearchParams(searchParams);

        nextParams.delete('tab');
        if (page > 1) nextParams.set('page', String(page));
        else nextParams.delete('page');

        if (limit !== DEFAULT_ROWS_PER_PAGE) nextParams.set('limit', String(limit));
        else nextParams.delete('limit');

        if (sortBy && sortBy !== resolvedDefaultSortBy) nextParams.set('sortBy', sortBy);
        else nextParams.delete('sortBy');

        if (order !== resolvedDefaultOrder) nextParams.set('order', order);
        else nextParams.delete('order');

        if (normalizedSearch) nextParams.set('search', normalizedSearch);
        else nextParams.delete('search');

        const currentParams = searchParams.toString();
        const updatedParams = nextParams.toString();
        if (currentParams !== updatedParams) {
            setSearchParams(nextParams, { replace: true });
        }
    }, [limit, normalizedSearch, order, page, resolvedDefaultOrder, resolvedDefaultSortBy, searchParams, setSearchParams, sortBy]);

    useEffect(() => {
        if (!normalizedSearch) return undefined;
        const timeoutId = window.setTimeout(() => {
            const node = rootRef.current;
            if (!node) return;
            const top = node.getBoundingClientRect().top + window.scrollY - 88;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 120);

        return () => window.clearTimeout(timeoutId);
    }, [normalizedSearch]);

    const rows = useMemo(() => data?.data || [], [data?.data]);
    const previewingSearch = Boolean(liveSearch) && (liveSearch !== normalizedSearch || isLoading);
    const visibleRows = useMemo(() => (
        previewingSearch ? rows.filter((row) => matchesTraitRow(row, columns, liveSearch)) : rows
    ), [columns, liveSearch, previewingSearch, rows]);
    const rowsReady = useAfterFirstPaint('trait-browser-table');
    const showPreparingRows = !isLoading && visibleRows.length > 0 && !rowsReady;
    const totalPages = data?.totalPages || 1;
    const totalCount = data?.totalCount || 0;
    const shouldPaginate = totalCount > TABLE_PAGINATION_THRESHOLD;

    useEffect(() => {
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleDownloadTsv = useCallback(async () => {
        if (!totalCount) return;

        setDownloading(true);
        setDownloadError('');
        try {
            const pageSize = 200;
            const pagesToFetch = Math.max(1, Math.ceil(totalCount / pageSize));
            const downloadedRows = [];

            for (let pageIndex = 1; pageIndex <= pagesToFetch; pageIndex += 1) {
                const params = new URLSearchParams({
                    page: String(pageIndex),
                    limit: String(pageSize),
                    sortBy,
                    order,
                });
                if (normalizedSearch) params.set('search', normalizedSearch);
                const payload = await fetcher(`/api/browse?${params.toString()}`);
                downloadedRows.push(...(payload?.data || []));
            }

            const suffix = normalizedSearch ? `-${normalizedSearch.replace(/[^a-z0-9_-]+/gi, '_')}` : '';
            downloadBlob(
                new Blob([buildGwasTableTsv(downloadedRows, columns)], { type: 'text/tab-separated-values;charset=utf-8;' }),
                `trait-browser${suffix}.tsv`,
            );
        } catch (err) {
            setDownloadError(err?.message || 'Failed to download trait TSV.');
        } finally {
            setDownloading(false);
        }
    }, [columns, normalizedSearch, order, sortBy, totalCount]);

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                Data loading failed: {error.message}
            </Alert>
        );
    }

    return (
        <Box ref={rootRef} sx={{ position: 'relative', width: '100%', minWidth: 0 }}>
            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    overflow: 'hidden',
                    borderColor: alpha('#245089', 0.18),
                    background: `linear-gradient(180deg, ${alpha('#245089', 0.035)} 0%, ${theme.palette.background.paper} 150px)`,
                })}
            >
                {title && (
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
                                gap: 0.55,
                                maxWidth: { lg: 280 },
                                '@media (min-width: 2200px)': {
                                    maxWidth: 420,
                                },
                            }}
                        >
                            <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.08rem', md: '1.22rem' }, color: '#173b5f', lineHeight: 1.15 })}>
                                {title}
                            </Typography>
                        </Box>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'center' }, gap: 0.55, flexWrap: 'wrap', minWidth: 0 }}>
                            <TextField
                                size="small"
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                placeholder={searchPlaceholder}
                                sx={{
                                    width: '100%',
                                    maxWidth: { lg: 320 },
                                    '@media (min-width: 2200px)': {
                                        maxWidth: 420,
                                    },
                                    '& .MuiOutlinedInput-root': {
                                        height: 36,
                                        bgcolor: theme.palette.background.paper,
                                        borderRadius: 1,
                                        borderColor: alpha('#245089', 0.16),
                                    },
                                    '& .MuiInputBase-input': {
                                        py: 0.55,
                                        fontSize: '0.8rem',
                                    },
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: search ? (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                aria-label="Clear trait search"
                                                onClick={() => {
                                                    setSearch('');
                                                    setPage(1);
                                                }}
                                                edge="end"
                                            >
                                                <Clear fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : null,
                                }}
                            />
                        </Box>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'flex-end' }, justifySelf: { xs: 'start', lg: 'end' }, gap: 0.85, minWidth: 0, flexWrap: { xs: 'wrap', lg: 'nowrap' }, whiteSpace: { lg: 'nowrap' } }}>
                            {shouldPaginate && <HeaderPageControl totalPages={totalPages} page={page} onChange={setPage} />}
                            {shouldPaginate && (
                                <FormControl size="small" sx={{ minWidth: 94 }}>
                                    <Select
                                        value={limit}
                                        onChange={handleChangeLimit}
                                        inputProps={{ 'aria-label': 'Rows per page' }}
                                        renderValue={(value) => `${value} / page`}
                                        sx={{
                                            height: 32,
                                            bgcolor: theme.palette.background.paper,
                                            fontSize: '0.78rem',
                                            fontWeight: 650,
                                            '& .MuiSelect-select': { py: 0.45, display: 'flex', alignItems: 'center' },
                                        }}
                                    >
                                        {[25, 50, 100, 200].map((v) => (
                                            <MenuItem key={v} value={v} dense>{v}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}
                            <UpdatingStatus active={isRefreshing} />
                            <Button
                                size="small"
                                startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                onClick={handleDownloadTsv}
                                disabled={!totalCount || downloading}
                                sx={{
                                    textTransform: 'none',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    color: '#173b5f',
                                    border: `1px solid ${alpha('#173b5f', 0.16)}`,
                                    bgcolor: theme.palette.background.paper,
                                    minWidth: 136,
                                    height: 36,
                                    px: 1.35,
                                    py: 0.45,
                                    flexShrink: 0,
                                    boxShadow: 'none',
                                    '&:hover': {
                                        bgcolor: alpha('#173b5f', 0.05),
                                        borderColor: alpha('#173b5f', 0.26),
                                        boxShadow: 'none',
                                    },
                                }}
                            >
                                {downloading ? 'Preparing' : 'Download Table'}
                            </Button>
                        </Box>
                    </Box>
                )}
                {downloadError && (
                    <Alert severity="error" sx={{ m: 1.5, borderRadius: 1 }}>
                        {downloadError}
                    </Alert>
                )}
                    <Box sx={{ position: 'relative' }}>
                        <TableContainer
                            sx={stickyTableContainerSx(theme, {
                                border: 0,
                                borderRadius: 0,
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                boxShadow: 'none',
                            })}
                        >
                            <Table
                                stickyHeader
                                sx={stickyTableSx(theme, {
                                    width: '100%',
                                    tableLayout: 'auto',
                                })}
                            >
                                <colgroup>
                                    {columns.map((column) => (
                                        <col
                                            key={column.id}
                                            style={{
                                                width: column.width,
                                                minWidth: column.minWidth,
                                                maxWidth: column.maxWidth,
                                            }}
                                        />
                                    ))}
                                </colgroup>
                                <TableHead>
                                    <TableRow>
                                        {columns.map((column) => {
                                            const columnAlign = getColumnAlign(column);

                                            return (
                                            <TableCell
                                                key={column.id}
                                                align={columnAlign}
                                                sx={stickyTableHeaderCellSx(theme, {
                                                    headerBg: '#eef7ff',
                                                    headerBorder: alpha('#245089', 0.22),
                                                    headerColor: '#245089',
                                                }, columnAlign, {
                                                    fontSize: '0.9rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.03em',
                                                    textTransform: 'none',
                                                    py: 1.2,
                                                    top: 0,
                                                    ...columnLayoutSx(column),
                                                    ...headerLayoutSx(column),
                                                })}
                                            >
                                                <TableSortLabel
                                                    active={sortBy === column.id}
                                                    direction={sortBy === column.id ? order.toLowerCase() : 'asc'}
                                                    onClick={() => handleSort(column.id)}
                                                sx={{
                                                    color: 'inherit',
                                                    display: 'flex',
                                                    width: '100%',
                                                    fontSize: '0.9rem',
                                                    whiteSpace: column.headerWrap ? 'normal' : 'nowrap',
                                                    lineHeight: column.headerWrap ? 1.1 : 1.2,
                                                    alignItems: 'center',
                                                        justifyContent: justifyForAlign(columnAlign),
                                                        '&:hover': { color: theme.palette.primary.main },
                                                        '&.Mui-active': { color: theme.palette.primary.main, fontWeight: 650 },
                                                        '& .MuiTableSortLabel-icon': {
                                                            color: `${theme.palette.primary.main} !important`,
                                                            flexShrink: 0,
                                                            marginLeft: 0.35,
                                                        },
                                                    }}
                                                >
                                                    {column.label}
                                                </TableSortLabel>
                                            </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {isLoading ? (
                                        <LoadingSkeleton columns={columns} rows={Math.min(limit, 20)} theme={theme} />
                                    ) : showPreparingRows ? (
                                        <QuietTableRowsPlaceholder columns={columns} rows={Math.min(limit, 12)} />
                                    ) : (
                                        <>
                                            {visibleRows.map((row, index) => (
                                                <TraitRow key={row.id || index} row={row} index={index} columns={columns} theme={theme} />
                                            ))}
                                        </>
                                    )}
                                </TableBody>
                            </Table>

                            {!isLoading && visibleRows.length === 0 && (
                                <Box sx={{ p: 8, textAlign: 'center', color: 'text.secondary', minHeight: 300 }}>
                                    <Typography variant="h6" gutterBottom>
                                        No data available
                                    </Typography>
                                </Box>
                            )}
                        </TableContainer>

                    </Box>

                    {visibleRows.length > 0 && (
                        <Box
                            sx={{
                                px: { xs: 1.5, md: 2 },
                                py: 1.35,
                                display: 'grid',
                                gridTemplateColumns: shouldPaginate ? { xs: '1fr', md: 'minmax(0, 1fr) auto' } : '1fr',
                                alignItems: 'center',
                                gap: 1.5,
                                background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.035)}, ${theme.custom.surface.subtle})`,
                                borderTop: `1px solid ${theme.custom.border.soft}`,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {totalCount === 0 ? 'No items' : `${Math.min(((page - 1) * limit) + 1, totalCount).toLocaleString()}-${Math.min(page * limit, totalCount).toLocaleString()} / ${totalCount.toLocaleString()} records`}
                            </Typography>

                            {shouldPaginate && (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1, flexWrap: 'wrap' }}>
                                    <JumpToPageControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />
                                    <PaginationControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />
                                </Box>
                            )}
                        </Box>
                    )}
            </Paper>
        </Box>
    );
}
