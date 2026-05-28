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
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AccountTreeOutlined, OpenInNew, ScienceOutlined, TableChartOutlined } from '@mui/icons-material';
import useSWR from 'swr';
import { getProgramTraits } from '../api/gwas';
import { StatePanel } from './PageScaffold';
import {
    captionSx,
    metricChipTone,
    panelSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
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

function SummaryStrip({ summary }) {
    const theme = useTheme();
    const items = [
        { label: 'traits', value: summary.totalTraits, tone: 'neutral', icon: <TableChartOutlined /> },
        { label: 'program selected', value: summary.selectedByProgram, tone: 'primary', icon: <ScienceOutlined /> },
        { label: 'regulator selected', value: summary.selectedByRegulator, tone: 'accent', icon: <AccountTreeOutlined /> },
        { label: 'both', value: summary.bothSelected, tone: 'success', icon: <AccountTreeOutlined /> },
        { label: 'visible genes', value: summary.totalGenes, tone: 'warning', icon: <ScienceOutlined /> },
    ];

    return (
        <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
            {items.map((item) => (
                <Chip
                    key={item.label}
                    icon={React.cloneElement(item.icon, { sx: { fontSize: 16 } })}
                    label={`${Number(item.value || 0).toLocaleString()} ${item.label}`}
                    size="small"
                    sx={summaryChipSx(theme, metricChipTone(theme, item.tone))}
                />
            ))}
        </Stack>
    );
}

export default function ProgramAssociatedTraits({ programId }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(50);
    const { data, error, isLoading } = useSWR(
        programId ? ['program-traits', programId] : null,
        ([, id]) => getProgramTraits(id),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    React.useEffect(() => {
        setPage(0);
    }, [programId]);

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

    const pageCount = Math.max(1, Math.ceil(traits.length / rowsPerPage));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * rowsPerPage;
    const visibleTraits = traits.slice(start, start + rowsPerPage);

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } })}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1rem' })}>
                        Associated Traits
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.76rem' })}>
                        Showing {(start + 1).toLocaleString()}-{Math.min(start + rowsPerPage, traits.length).toLocaleString()} of {traits.length.toLocaleString()} traits where {data.program?.id || programId} is selected.
                    </Typography>
                </Box>
                <SummaryStrip summary={data.summary || {}} />
            </Box>

            <TableContainer sx={{ maxHeight: 520 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {['Trait', 'Selection', 'Scores', 'Genes', 'Top genes'].map((label) => (
                                <TableCell
                                    key={label}
                                    sx={{
                                        bgcolor: tone.headerBg,
                                        borderBottom: `2px solid ${tone.headerBorder}`,
                                        color: tone.headerColor,
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                    }}
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
                count={traits.length}
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
