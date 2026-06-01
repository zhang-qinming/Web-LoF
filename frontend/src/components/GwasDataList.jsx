import React, { useState, useEffect, useCallback, useDeferredValue, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { Link as RouterLink } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { fetcher } from '../api/gwas';
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
    Chip,
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
    summaryChipSx,
    tableRowRevealSx,
    tableSkeletonCellSx,
    toolbarSx,
} from '../themeUtils';

function PaginationControl({ totalPages, page, onChange }) {
    if (totalPages <= 1) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Pagination
                count={totalPages}
                page={page}
                onChange={onChange}
                color="primary"
                shape="rounded"
                size="medium"
                showFirstButton
                showLastButton
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
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <TextField
                size="small"
                value={inputPage}
                onChange={(e) => setInputPage(e.target.value)}
                onBlur={handleBlur}
                type="number"
                slotProps={{ input: { min: 1, max: totalPages, sx: { textAlign: 'center', width: 52, py: 0.5, fontSize: '0.8rem' } } }}
                sx={{ '& fieldset': { borderRadius: 1.5 } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.3 }}>
                / {totalPages}
            </Typography>
            <Button type="submit" size="small" variant="text" disabled={!isValid} sx={{ minWidth: 0, px: 1, fontSize: '0.75rem' }}>
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
            {columns.map((col) => (
                <TableCell
                    key={col.id}
                    align={col.numeric ? 'right' : 'left'}
                    sx={columnLayoutSx(col)}
                >
                    {col.id === 'trait_name' ? (
                        <Link
                            component={RouterLink}
                            to={`/trait/${encodeURIComponent(row.file_id)}`}
                            underline="hover"
                            sx={{ color: theme.palette.primary.main, fontWeight: 600, fontSize: '0.85rem' }}
                        >
                            {String(row[col.id] || '').replace(/^["']+|["']+$/g, '')}
                        </Link>
                    ) : (col.id === 'sample_size' || col.id === 'Sample Size') ? (
                        <Chip
                            label={formatCellValue(row, col.id)}
                            size="small"
                            variant="outlined"
                            sx={summaryChipSx(theme, { color: theme.palette.primary.dark, backgroundColor: 'rgba(37, 99, 235, 0.05)' })}
                        />
                    ) : (col.id === 'n_variants' || col.id === 'Variants') ? (
                        <Chip
                            label={formatCellValue(row, col.id)}
                            size="small"
                            variant="outlined"
                            sx={summaryChipSx(theme, { color: '#245089', backgroundColor: 'rgba(14, 116, 144, 0.06)' })}
                        />
                    ) : (col.id === 'n_sig' || col.id === 'Significant Loci') ? (
                        <Chip
                            label={formatCellValue(row, col.id)}
                            size="small"
                            variant="outlined"
                            sx={summaryChipSx(theme, { color: '#7c4d12', backgroundColor: 'rgba(217, 119, 6, 0.08)' })}
                        />
                    ) : (col.id === 'qc_score' || col.id === 'QC') ? (
                        <Chip
                            label={formatCellValue(row, col.id)}
                            size="small"
                            variant="outlined"
                            sx={summaryChipSx(theme, {
                                color: Number(row.qc_score) >= 100 ? '#166534' : '#92400e',
                                backgroundColor: Number(row.qc_score) >= 100 ? 'rgba(21, 128, 61, 0.08)' : 'rgba(180, 83, 9, 0.08)',
                            })}
                        />
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
    traitName = null,
    defaultSortBy = 'Trait',
    defaultOrder = 'ASC',
}) {
    const theme = useTheme();
    const rootRef = useRef(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [sortBy, setSortBy] = useState(defaultSortBy);
    const [order, setOrder] = useState(defaultOrder);
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const normalizedSearch = deferredSearch.trim();

    const apiUrl = useMemo(() => {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            sortBy,
            order,
        });
        if (!traitName && normalizedSearch) params.set('search', normalizedSearch);

        return traitName
            ? `/api/trait/${encodeURIComponent(traitName)}?${params.toString()}`
            : `/api/browse?${params.toString()}`;
    }, [limit, normalizedSearch, order, page, sortBy, traitName]);

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
        if (traitName || !normalizedSearch) return undefined;
        const timeoutId = window.setTimeout(() => {
            const node = rootRef.current;
            if (!node) return;
            const top = node.getBoundingClientRect().top + window.scrollY - 88;
            window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }, 120);

        return () => window.clearTimeout(timeoutId);
    }, [normalizedSearch, traitName]);

    const rows = data?.data || [];
    const totalPages = data?.totalPages || 1;
    const totalCount = data?.totalCount || 0;

    useEffect(() => {
        if (page > totalPages && totalPages > 0) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                Data loading failed: {error.message}
            </Alert>
        );
    }

    return (
        <Box ref={rootRef} sx={{ position: 'relative' }}>
            {title && (
                <Typography variant="h5" sx={sectionTitleSx(theme, { mb: 2 })}>
                    {title}
                </Typography>
            )}
            <Card elevation={0} sx={{ ...panelSx(theme, { borderRadius: 3 }), overflow: 'hidden' }}>
                <Box
                    sx={toolbarSx(theme, {
                        px: 2,
                        py: 1.5,
                        borderRadius: 0,
                        border: 0,
                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                    })}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            Per page
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 70 }}>
                            <Select value={limit} onChange={handleChangeLimit} sx={{ fontSize: '0.8rem', '& .MuiSelect-select': { py: 0.6 } }}>
                                {[20, 50, 100, 200].map((v) => (
                                    <MenuItem key={v} value={v} dense>{v}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {normalizedSearch ? `${totalCount.toLocaleString()} matches` : `${totalCount.toLocaleString()} records`}
                    </Typography>

                    <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                        <PaginationControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />
                    </Box>

                    <JumpToPageControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />

                    {!traitName && (
                        <TextField
                            size="small"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search trait, LoF ID, MeSH term, population"
                            sx={{
                                width: { xs: '100%', sm: 280, md: 330 },
                                ml: { xs: 0, md: 1 },
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: theme.palette.background.paper,
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
                    )}
                </Box>

                <CardContent sx={{ p: 0 }}>
                    <Box sx={{ position: 'relative' }}>
                        <TableContainer component={Paper} elevation={0} sx={stickyTableContainerSx(theme, { border: 0, borderRadius: 0, maxHeight: 600, overflow: 'auto', boxShadow: 'none' })}>
                            <Table
                                stickyHeader
                                sx={stickyTableSx(theme, {
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
                                    <TableRow>
                                        {columns.map((column) => (
                                            <TableCell
                                                key={column.id}
                                                align={column.numeric ? 'right' : 'left'}
                                                sx={stickyTableHeaderCellSx(theme, {
                                                    headerBg: theme.custom.surface.subtle,
                                                    headerBorder: theme.custom.border.strong,
                                                    headerColor: '#475569',
                                                }, column.numeric ? 'right' : 'left', {
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.03em',
                                                    textTransform: 'uppercase',
                                                    py: 1.2,
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
                                                        '&:hover': { color: theme.palette.primary.main },
                                                        '&.Mui-active': { color: theme.palette.primary.main, fontWeight: 700 },
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
                                        <LoadingSkeleton columns={columns} rows={Math.min(limit, 10)} theme={theme} />
                                    ) : (
                                        <>
                                            {rows.map((row, index) => (
                                                <TraitRow key={row.id || index} row={row} index={index} columns={columns} theme={theme} />
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
                                p: 2,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 2,
                                background: theme.custom.surface.subtle,
                                borderTop: `1px solid ${theme.custom.border.soft}`,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {totalCount === 0 ? 'No items' : `Showing ${Math.min(((page - 1) * limit) + 1, totalCount)} - ${Math.min(page * limit, totalCount)} of ${totalCount} records`}
                            </Typography>

                            <PaginationControl totalPages={totalPages} page={page} onChange={(e, value) => setPage(value)} />
                        </Box>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
