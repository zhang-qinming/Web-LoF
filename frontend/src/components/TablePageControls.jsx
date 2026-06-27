import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Pagination from '@mui/material/Pagination';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

function TablePageNumberControl({ totalPages, page, onChange, size = 'small' }) {
    if (totalPages <= 1) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
            <Pagination
                count={totalPages}
                page={page + 1}
                onChange={(event, value) => onChange?.(event, value - 1)}
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

function TablePageJumpControl({ totalPages, page, onChange }) {
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
            onChange?.(null, pageNumber - 1);
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

export default function TablePageControls({ totalPages, page, onChange, size = 'small' }) {
    if (totalPages <= 1) return null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.9, flexWrap: 'wrap', minWidth: 0 }}>
            <TablePageNumberControl totalPages={totalPages} page={page} onChange={onChange} size={size} />
            <TablePageJumpControl totalPages={totalPages} page={page} onChange={onChange} />
        </Box>
    );
}

export function TablePaginationActions({ count, page, rowsPerPage, onPageChange }) {
    const totalPages = Math.max(1, Math.ceil((Number(count) || 0) / Math.max(Number(rowsPerPage) || 1, 1)));
    const currentPage = Math.min(Math.max(Number(page) || 0, 0), totalPages - 1);

    return (
        <TablePageControls
            totalPages={totalPages}
            page={currentPage}
            onChange={onPageChange}
        />
    );
}
