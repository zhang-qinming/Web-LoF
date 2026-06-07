import React, { useState, useEffect, useCallback, useDeferredValue, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { alpha, useTheme } from '@mui/material/styles';
import { fetcher } from '../api/gwas';
import { downloadBlob } from '../utils/download';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    FormControl,
    Select,
    MenuItem,
    Box,
    Typography,
    Pagination,
    TableSortLabel,
    Link,
    TextField,
    Card,
    CardContent,
    Alert,
    Button,
    IconButton,
    InputAdornment,
} from '@mui/material';
import { Clear, Search } from '@mui/icons-material';
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
                showFirstButton
                showLastButton
                sx={{
                    '& .MuiPagination-ul': {
                        flexWrap: 'nowrap',
                    },
                    '& .MuiPaginationItem-root': {
                        minWidth: 28,
                        height: 28,
                        fontSize: '0.76rem',
                    },
                }}
            />
        </Box>
    );
}

function JumpToPageControl({ totalPages, page, onChange }) {
    const [inputPage, setInputPage] = useState(page);

    const isValid = inputPage !== '' && Number(inputPage) >= 1 && Number(inputPage) <= totalPages;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isValid) {
            onChange(null, Number(inputPage));
        }
    };

    const handleBlur = () => {
        const value = inputPage;
        if (value === '') {
            setInputPage(page);
            return;
        }

        const numValue = Number(value);
        if (Number.isNaN(numValue)) {
            setInputPage(page);
            return;
        }

        if (numValue < 1) setInputPage(1);
        else if (numValue > totalPages) setInputPage(totalPages);
    };

    useEffect(() => {
        setInputPage(page);
    }, [page]);

    if (totalPages <= 1) return null;

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.45, flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, whiteSpace: 'nowrap' }}>
                Page
            </Typography>
            <TextField
                size="small"
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                onBlur={handleBlur}
                type="number"
                slotProps={{ input: { min: 1, max: totalPages, sx: { textAlign: 'center', width: 52, py: 0.48, px: 0.7, fontSize: '0.78rem', fontWeight: 650 } } }}
                sx={{
                    '& .MuiOutlinedInput-root': {
                        bgcolor: 'background.paper',
                    },
                    '& fieldset': { borderRadius: 1 },
                }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                / {totalPages.toLocaleString()}
            </Typography>
            <Button type="submit" size="small" variant="outlined" disabled={!isValid} sx={{ minWidth: 38, px: 0.9, py: 0.35, textTransform: 'none', fontSize: '0.72rem', fontWeight: 680 }}>
                Go
            </Button>
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

function columnLayoutSx(column = {}) {
    const sx = {};
    if (column.width !== undefined) sx.width = column.width;
    if (column.minWidth !== undefined) sx.minWidth = column.minWidth;
    if (column.maxWidth !== undefined) sx.maxWidth = column.maxWidth;
    if (column.whiteSpace !== undefined) sx.whiteSpace = column.whiteSpace;
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

const GWAS_TABLE_TITLE_HEADER_HEIGHT = 94;
const GWAS_TABLE_COLUMN_HEADER_HEIGHT = 46;
const TABLE_PAGINATION_THRESHOLD = 50;

function buildTraitHref(row, figureTab) {
    const path = `/trait/${encodeURIComponent(row.file_id)}`;
    return figureTab ? `${path}?tab=${encodeURIComponent(figureTab)}` : path;
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

function MetricValue({ value, tone, theme }) {
    const colors = metricValueTone(theme, tone);
    return (
        <Box
            component="span"
            sx={{
                display: 'inline-flex',
                justifyContent: 'flex-end',
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

function TraitRow({ row, index, columns, theme, figureTab }) {
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
            {columns.map((col) => (
                <TableCell
                    key={col.id}
                    align={col.numeric ? 'right' : 'left'}
                    sx={columnLayoutSx(col)}
                >
                    {col.id === 'trait_name' ? (
                        <Link
                            component={RouterLink}
                            to={buildTraitHref(row, figureTab)}
                            underline="hover"
                            sx={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.85rem' }}
                        >
                            {String(row[col.id] || '').replace(/^["']+|["']+$/g, '')}
                        </Link>
                    ) : (col.id === 'sample_size' || col.id === 'Sample Size') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone="primary" theme={theme} />
                    ) : (col.id === 'n_variants' || col.id === 'Variants') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone="cyan" theme={theme} />
                    ) : (col.id === 'n_sig' || col.id === 'Significant Loci') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone="warning" theme={theme} />
                    ) : (col.id === 'qc_score' || col.id === 'QC') ? (
                        <MetricValue value={formatCellValue(row, col.id)} tone={Number(row.qc_score) >= 100 ? 'success' : 'caution'} theme={theme} />
                    ) : (
                        formatCellValue(row, col.id)
                    )}
                </TableCell>
            ))}
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

export default function GwasDataList({
    title = 'GWAS Data',
    columns = [],
    defaultSortBy = 'Trait',
    defaultOrder = 'ASC',
}) {
    const theme = useTheme();
    const [searchParams] = useSearchParams();
    const figureTab = searchParams.get('tab') || '';
    const rootRef = useRef(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(TABLE_PAGINATION_THRESHOLD);
    const [sortBy, setSortBy] = useState(defaultSortBy);
    const [order, setOrder] = useState(defaultOrder);
    const [search, setSearch] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

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

    const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        refreshInterval: 0,
        shouldRetryOnError: false,
    });

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
        setPage(1);
    }, [normalizedSearch]);

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

    const rows = data?.data || [];
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

    const resultLabel = normalizedSearch ? `${totalCount.toLocaleString()} matches` : `${totalCount.toLocaleString()} records`;

    return (
        <Box ref={rootRef} sx={{ position: 'relative', width: '100%', minWidth: 0 }}>
            <Card elevation={0} sx={{
                ...panelSx(theme, {
                    borderRadius: 3,
                    borderColor: alpha('#245089', 0.18),
                    background: `linear-gradient(180deg, ${alpha('#245089', 0.035)} 0%, ${theme.palette.background.paper} 150px)`,
                }),
                overflow: 'hidden',
                width: '100%',
                minWidth: 0,
            }}>
                <CardContent sx={{ p: 0 }}>
                    {downloadError && (
                        <Alert severity="error" sx={{ m: 1.5, borderRadius: 1 }}>
                            {downloadError}
                        </Alert>
                    )}
                    <Box sx={{ position: 'relative' }}>
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            sx={stickyTableContainerSx(theme, {
                                border: 0,
                                borderRadius: 0,
                                overflowX: 'auto',
                                overflowY: 'visible',
                                boxShadow: 'none',
                            })}
                        >
                            <Table
                                stickyHeader
                                sx={stickyTableSx(theme, {
                                    width: '100%',
                                    tableLayout: columns.some((column) => column.width || column.minWidth || column.maxWidth) ? 'fixed' : 'auto',
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
                                    {title && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={Math.max(columns.length, 1)}
                                                sx={stickyTableHeaderCellSx(theme, {
                                                    headerBg: '#f7fbff',
                                                    headerBorder: alpha('#245089', 0.16),
                                                    headerColor: '#173b5f',
                                                }, 'left', {
                                                    top: 0,
                                                    zIndex: '45 !important',
                                                    height: GWAS_TABLE_TITLE_HEADER_HEIGHT,
                                                    py: 1,
                                                    px: 1.5,
                                                    whiteSpace: 'normal',
                                                    overflow: 'visible',
                                                    textOverflow: 'clip',
                                                })}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '1fr',
                                                        alignItems: 'center',
                                                        gap: 0.65,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            minWidth: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: 1,
                                                            flexWrap: { xs: 'wrap', md: 'nowrap' },
                                                        }}
                                                    >
                                                        <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.08rem', md: '1.22rem' }, color: '#173b5f', lineHeight: 1.15 })}>
                                                            {title}
                                                        </Typography>
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            display: 'grid',
                                                            gridTemplateColumns: {
                                                                xs: '1fr',
                                                                lg: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                                                            },
                                                            alignItems: 'center',
                                                            justifyItems: { xs: 'stretch', md: 'start' },
                                                            gap: { xs: 0.7, md: 0.9, lg: 1.1 },
                                                            minWidth: 0,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: '100%',
                                                                display: 'grid',
                                                                gap: 0.35,
                                                                minWidth: 0,
                                                            }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                                                                <Typography
                                                                    sx={{
                                                                        px: 0.85,
                                                                        py: 0.32,
                                                                        borderRadius: 1,
                                                                        border: `1px solid ${alpha('#245089', 0.18)}`,
                                                                        bgcolor: alpha('#245089', 0.08),
                                                                        color: '#245089',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 680,
                                                                        whiteSpace: 'nowrap',
                                                                        flexShrink: 0,
                                                                    }}
                                                                >
                                                                    {resultLabel}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.55, flexWrap: 'wrap', minWidth: 0 }}>
                                                                <TextField
                                                                    size="small"
                                                                    value={search}
                                                                    onChange={(event) => setSearch(event.target.value)}
                                                                    placeholder="Search trait, LoF ID, MeSH term"
                                                                    sx={{
                                                                        flex: { xs: '1 1 100%', sm: '0 1 260px' },
                                                                        maxWidth: { sm: 280 },
                                                                        '& .MuiOutlinedInput-root': {
                                                                            bgcolor: theme.palette.background.paper,
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
                                                                                    onClick={() => setSearch('')}
                                                                                    edge="end"
                                                                                >
                                                                                    <Clear fontSize="small" />
                                                                                </IconButton>
                                                                            </InputAdornment>
                                                                        ) : null,
                                                                    }}
                                                                />
                                                            </Box>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', justifySelf: { xs: 'stretch', lg: 'center' }, gap: 0.75, flexWrap: 'wrap' }}>
                                                            {shouldPaginate && <PaginationControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />}
                                                        </Box>
                                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, justifySelf: { xs: 'start', lg: 'end' }, gap: 0.7, flexShrink: 0, flexWrap: 'wrap' }}>
                                                            {shouldPaginate && <JumpToPageControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />}
                                                            {shouldPaginate && (
                                                                <>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, whiteSpace: 'nowrap' }}>
                                                                        Rows
                                                                    </Typography>
                                                                    <FormControl size="small" sx={{ minWidth: 70 }}>
                                                                        <Select
                                                                            value={limit}
                                                                            onChange={handleChangeLimit}
                                                                            sx={{
                                                                                bgcolor: theme.palette.background.paper,
                                                                                fontSize: '0.78rem',
                                                                                fontWeight: 650,
                                                                                '& .MuiSelect-select': { py: 0.45 },
                                                                            }}
                                                                        >
                                                                            {[50, 100, 200].map((v) => (
                                                                                <MenuItem key={v} value={v} dense>{v}</MenuItem>
                                                                            ))}
                                                                        </Select>
                                                                    </FormControl>
                                                                </>
                                                            )}
                                                            <Button
                                                                size="small"
                                                                onClick={handleDownloadTsv}
                                                                disabled={!totalCount || downloading}
                                                                sx={{
                                                                    textTransform: 'none',
                                                                    fontSize: '0.74rem',
                                                                    color: '#245089',
                                                                    border: `1px solid ${alpha('#245089', 0.18)}`,
                                                                    bgcolor: alpha('#245089', 0.045),
                                                                    minWidth: 64,
                                                                    py: 0.38,
                                                                    '&:hover': {
                                                                        bgcolor: alpha('#245089', 0.08),
                                                                        borderColor: alpha('#245089', 0.28),
                                                                    },
                                                                }}
                                                            >
                                                                {downloading ? 'Preparing' : 'TSV'}
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    <TableRow>
                                        {columns.map((column) => (
                                            <TableCell
                                                key={column.id}
                                                align={column.numeric ? 'right' : 'left'}
                                                sx={stickyTableHeaderCellSx(theme, {
                                                    headerBg: '#eef7ff',
                                                    headerBorder: alpha('#245089', 0.22),
                                                    headerColor: '#245089',
                                                }, column.numeric ? 'right' : 'left', {
                                                    fontSize: '0.8rem',
                                                    fontWeight: 650,
                                                    letterSpacing: '0.03em',
                                                    textTransform: 'none',
                                                    py: 1.2,
                                                    top: title ? GWAS_TABLE_TITLE_HEADER_HEIGHT : 0,
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
                                                        whiteSpace: column.headerWrap ? 'normal' : 'nowrap',
                                                        lineHeight: column.headerWrap ? 1.1 : 1.2,
                                                        alignItems: 'center',
                                                        justifyContent: column.numeric ? 'flex-end' : 'flex-start',
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
                                        ))}
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {isLoading ? (
                                        <LoadingSkeleton columns={columns} rows={Math.min(limit, 20)} theme={theme} />
                                    ) : (
                                        <>
                                            {rows.map((row, index) => (
                                                <TraitRow key={row.id || index} row={row} index={index} columns={columns} theme={theme} figureTab={figureTab} />
                                            ))}
                                        </>
                                    )}
                                </TableBody>
                            </Table>

                            {!isLoading && rows.length === 0 && (
                                <Box sx={{ p: 8, textAlign: 'center', color: 'text.secondary', minHeight: 300 }}>
                                    <Typography variant="h6" gutterBottom>
                                        No data available
                                    </Typography>
                                </Box>
                            )}
                        </TableContainer>

                    </Box>

                    {rows.length > 0 && (
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
                </CardContent>
            </Card>
        </Box>
    );
}
