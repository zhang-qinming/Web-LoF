import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AccountTreeOutlined, OpenInNew } from '@mui/icons-material';
import useSWR from 'swr';
import { getProgramTraits } from '../api/gwas';
import { StatePanel } from './PageScaffold';
import {
    captionSx,
    compactToggleGroupSx,
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

function formatScore(value) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(3)}`;
}

function colorTone(theme, color) {
    if (color === 'program_enriched') return metricChipTone(theme, 'primary');
    if (color === 'regulator_enriched') return metricChipTone(theme, 'accent');
    if (color === 'both_enriched') return metricChipTone(theme, 'success');
    return metricChipTone(theme, 'neutral');
}

export default function ProgramAssociatedTraits({ programId }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(50);
    const [filter, setFilter] = React.useState('all');
    const { data, error, isLoading } = useSWR(
        programId ? ['program-traits', programId] : null,
        ([, id]) => getProgramTraits(id),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    React.useEffect(() => {
        setPage(0);
    }, [programId]);

    React.useEffect(() => {
        setPage(0);
    }, [filter]);

    if (isLoading) {
        return <StatePanel loading title="Loading associated traits" message="Querying the SQL trait-program index." minHeight={240} />;
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

    const pageCount = Math.max(1, Math.ceil(filteredTraits.length / rowsPerPage));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * rowsPerPage;
    const visibleTraits = filteredTraits.slice(start, start + rowsPerPage);

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } })}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1rem' })}>
                        Associated Traits
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.76rem' })}>
                        Showing {filteredTraits.length ? (start + 1).toLocaleString() : 0}-{Math.min(start + rowsPerPage, filteredTraits.length).toLocaleString()} of {filteredTraits.length.toLocaleString()} traits.
                    </Typography>
                </Box>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
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
                </Stack>
            </Box>

            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 520, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme)}>
                    <TableHead>
                        <TableRow>
                            {['Trait', 'Selection', 'Scores', 'Genes', 'Top genes'].map((label) => (
                                <TableCell
                                    key={label}
                                    sx={stickyTableHeaderCellSx(theme, tone, 'left', {
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                    })}
                                >
                                    {label}
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
                                <TableCell sx={{ minWidth: 270 }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.fileId || row.traitId)}`}
                                        endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                        sx={{ textTransform: 'none', px: 0, justifyContent: 'flex-start', color: theme.palette.text.primary, fontWeight: 750 }}
                                    >
                                        {row.traitName || row.traitId}
                                    </Button>
                                    <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                                        {row.traitId}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ minWidth: 170 }}>
                                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                                        {row.selectedByProgram && <Chip label="program" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />}
                                        {row.selectedByRegulator && <Chip label="regulator" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />}
                                        <Chip label={row.color || 'other'} size="small" sx={summaryChipSx(theme, colorTone(theme, row.color))} />
                                    </Stack>
                                </TableCell>
                                <TableCell sx={{ minWidth: 160 }}>
                                    <Typography sx={{ fontSize: '0.74rem', fontFamily: 'monospace', fontWeight: 700 }}>
                                        program {formatScore(row.programScore)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.74rem', fontFamily: 'monospace', color: theme.palette.text.secondary }}>
                                        regulator {formatScore(row.regulatorScore)}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ minWidth: 145 }}>
                                    <Typography sx={{ fontSize: '0.76rem', fontWeight: 700 }}>
                                        {Number(row.totalGenes || 0).toLocaleString()} visible
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                        {row.loadingGeneCount || 0} program / {row.regulatorGeneCount || 0} regulator
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 420 }}>
                                    <Stack direction="row" spacing={0.45} sx={{ flexWrap: 'wrap' }}>
                                        {(row.topGenes || []).slice(0, 8).map((gene) => (
                                            <Chip
                                                key={`${row.traitId}-${gene}`}
                                                label={gene}
                                                size="small"
                                                component={RouterLink}
                                                clickable
                                                to={`/genes?query=${encodeURIComponent(gene)}`}
                                                sx={summaryChipSx(theme, metricChipTone(theme, 'subtle'))}
                                            />
                                        ))}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={filteredTraits.length}
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
        </Paper>
    );
}
