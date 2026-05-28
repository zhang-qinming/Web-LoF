import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    InputAdornment,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    AccountTreeOutlined,
    BiotechOutlined,
    ManageSearchOutlined,
    OpenInNew,
    ScienceOutlined,
    TableChartOutlined,
} from '@mui/icons-material';
import useSWR from 'swr';
import { getGenePrograms, searchGenes } from '../api/gwas';
import { PageFrame, StatePanel } from '../components/PageScaffold';
import {
    captionSx,
    controlFieldSx,
    metricChipTone,
    panelSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
    toolbarSx,
} from '../themeUtils';

function formatNumber(value, digits = 3) {
    return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatSigned(value, digits = 3) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function roleTone(theme, role) {
    if (role === 'program') return metricChipTone(theme, 'primary');
    if (role === 'regulator') return metricChipTone(theme, 'accent');
    return metricChipTone(theme, 'neutral');
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
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.1 }}>
                    {Number(value || 0).toLocaleString()}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {label}
                </Typography>
            </Box>
        </Paper>
    );
}

function GeneSuggestionList({ suggestions, onSelect }) {
    const theme = useTheme();
    if (!suggestions?.genes?.length) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme)}>
                <Typography sx={sectionTitleSx(theme, { fontSize: '0.88rem' })}>
                    Matching genes
                </Typography>
                <Chip
                    label={suggestions.genes.length}
                    size="small"
                    sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                />
            </Box>
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {['Gene', 'ENSG', 'Programs', 'Traits', 'Roles'].map((label) => (
                                <TableCell key={label} sx={{ fontSize: '0.72rem', fontWeight: 800, color: theme.palette.text.secondary }}>
                                    {label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {suggestions.genes.map((gene, index) => (
                            <TableRow
                                key={`${gene.geneSymbol}-${gene.ensgId}`}
                                hover
                                onClick={() => onSelect(gene.geneSymbol || gene.ensgId)}
                                sx={{
                                    cursor: 'pointer',
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                                }}
                            >
                                <TableCell sx={{ fontWeight: 800, color: theme.palette.primary.dark }}>{gene.geneSymbol || '-'}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary }}>{gene.ensgId || '-'}</TableCell>
                                <TableCell>{gene.totalPrograms?.toLocaleString?.() || 0}</TableCell>
                                <TableCell>{gene.totalTraits?.toLocaleString?.() || 0}</TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.5}>
                                        <Chip label={`program ${gene.roles?.program || 0}`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                                        <Chip label={`regulator ${gene.roles?.regulator || 0}`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function GeneRecordsTable({ records }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(50);

    React.useEffect(() => {
        setPage(0);
    }, [records]);

    if (!records.length) return null;

    const pageCount = Math.max(1, Math.ceil(records.length / rowsPerPage));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * rowsPerPage;
    const visibleRecords = records.slice(start, start + rowsPerPage);

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap' })}>
                <Box>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.92rem' })}>
                        Gene - Program - Trait evidence
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>
                        Showing {(start + 1).toLocaleString()}-{Math.min(start + rowsPerPage, records.length).toLocaleString()} of {records.length.toLocaleString()} rows
                    </Typography>
                </Box>
                <Chip label={`${records.length.toLocaleString()} total`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
            </Box>
            <TableContainer sx={{ maxHeight: 620 }}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            {['Trait', 'Program', 'Role', 'Direction', 'post_mean', 'abs_gamma', 'membership', 'Concordance'].map((label) => (
                                <TableCell
                                    key={label}
                                    sx={{
                                        bgcolor: tone.headerBg,
                                        borderBottom: `2px solid ${tone.headerBorder}`,
                                        color: tone.headerColor,
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleRecords.map((row, index) => (
                            <TableRow
                                key={`${row.traitId}-${row.program}-${row.role}-${row.ensgId || row.geneSymbol}-${start + index}`}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={{ minWidth: 260 }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.fileId || row.traitId)}`}
                                        endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                        sx={{ textTransform: 'none', fontWeight: 750, justifyContent: 'flex-start', px: 0, color: theme.palette.text.primary }}
                                    >
                                        {row.traitName || row.traitId}
                                    </Button>
                                    <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                                        {row.traitId}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ minWidth: 150 }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{ textTransform: 'none', fontWeight: 800, px: 0, color: theme.palette.primary.dark }}
                                    >
                                        {row.program}
                                    </Button>
                                    {row.programAnnotation && (
                                        <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary, maxWidth: 260 }} noWrap>
                                            {row.programAnnotation}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip label={row.role} size="small" sx={summaryChipSx(theme, roleTone(theme, row.role))} />
                                </TableCell>
                                <TableCell sx={{ minWidth: 140 }}>
                                    <Typography sx={{ fontSize: '0.76rem', fontWeight: 700 }}>
                                        {row.predictedSign || row.gammaSign || '-'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                        gamma {row.gammaSign || '-'} / post {row.postMeanSign || '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace' }}>{formatSigned(row.postMean, 4)}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace' }}>{formatNumber(row.absGamma, 4)}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace' }}>{formatNumber(row.membershipScore, 4)}</TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={0.6}>
                                        {row.isConcordant && <Chip label="concordant" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'success'))} />}
                                        {row.isDiscordant && <Chip label="discordant" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />}
                                        {!row.isConcordant && !row.isDiscordant && <Chip label="-" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'subtle'))} />}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={records.length}
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

export default function Genes() {
    const theme = useTheme();
    const [params, setParams] = useSearchParams();
    const queryParam = params.get('query') || '';
    const [input, setInput] = React.useState(queryParam);
    const query = queryParam.trim();

    React.useEffect(() => {
        setInput(queryParam);
    }, [queryParam]);

    const { data: suggestions, isLoading: suggestionsLoading } = useSWR(
        input.trim().length >= 2 ? ['gene-search', input.trim()] : null,
        ([, q]) => searchGenes(q, { limit: 12 }),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    const { data: details, isLoading: detailLoading, error } = useSWR(
        query ? ['gene-programs', query] : null,
        ([, q]) => getGenePrograms(q),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    const runSearch = React.useCallback((value = input) => {
        const next = value.trim();
        if (!next) {
            setParams({});
            return;
        }
        setParams({ query: next });
    }, [input, setParams]);

    const records = details?.records || [];
    const summary = details?.summary || {};

    return (
        <PageFrame
            title="Gene Explorer"
            subtitle="Search a gene symbol or ENSG identifier to find trait-linked programs and regulator evidence."
            maxWidth={1500}
            compact
        >
            <Stack spacing={2}>
                <Box sx={toolbarSx(theme, { alignItems: 'stretch' })}>
                    <TextField
                        label="Gene symbol or ENSG"
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') runSearch();
                        }}
                        sx={controlFieldSx(theme, { minWidth: { xs: '100%', md: 420 } })}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <ManageSearchOutlined />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Button
                        variant="contained"
                        onClick={() => runSearch()}
                        startIcon={<BiotechOutlined />}
                        sx={{ textTransform: 'none', px: 2.4, fontWeight: 750 }}
                    >
                        Search
                    </Button>
                    {query && (
                        <Button
                            variant="text"
                            onClick={() => {
                                setInput('');
                                setParams({});
                            }}
                            sx={{ textTransform: 'none', color: theme.palette.text.secondary }}
                        >
                            Clear
                        </Button>
                    )}
                </Box>

                {details?.unavailable && (
                    <Alert severity="warning" sx={{ borderRadius: 1 }}>
                        Gene SQL index is not available yet. Run the schema migration and import script before using this page.
                    </Alert>
                )}

                {!query && (
                    <GeneSuggestionList
                        suggestions={suggestions}
                        onSelect={(gene) => runSearch(gene)}
                    />
                )}

                {!query && !suggestionsLoading && !suggestions?.genes?.length && (
                    <StatePanel
                        icon={ManageSearchOutlined}
                        title="Search for a gene"
                        message="Enter a gene symbol or ENSG identifier to find linked programs, traits, and direction evidence."
                        minHeight={300}
                    />
                )}

                {query && detailLoading && (
                    <StatePanel loading title="Loading gene evidence" message={`Searching ${query}`} minHeight={300} />
                )}

                {query && error && (
                    <StatePanel severity="error" title="Failed to load gene evidence" message={error.message || 'The gene lookup request failed.'} />
                )}

                {query && !detailLoading && !error && !details?.unavailable && records.length === 0 && (
                    <StatePanel
                        icon={TableChartOutlined}
                        title="No linked records"
                        message="This gene was not found in the imported gene-program-trait index."
                        minHeight={320}
                    />
                )}

                {query && !detailLoading && records.length > 0 && (
                    <>
                        <Paper elevation={0} sx={panelSx(theme, { p: 2 })}>
                            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                                <Box>
                                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.35rem' })}>
                                        {details?.gene?.geneSymbol || query}
                                    </Typography>
                                    <Typography sx={captionSx(theme)}>
                                        {details?.gene?.ensgId || 'No ENSG identifier in index'}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Chip icon={<ScienceOutlined />} label={`${summary.totalPrograms || 0} programs`} sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                                    <Chip icon={<AccountTreeOutlined />} label={`${summary.totalTraits || 0} traits`} sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />
                                </Stack>
                            </Stack>
                        </Paper>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1.2 }}>
                            <SummaryCard icon={TableChartOutlined} label="Rows" value={summary.totalRows} />
                            <SummaryCard icon={ScienceOutlined} label="Programs" value={summary.totalPrograms} tone="primary" />
                            <SummaryCard icon={AccountTreeOutlined} label="Traits" value={summary.totalTraits} tone="accent" />
                            <SummaryCard icon={BiotechOutlined} label="Program role" value={summary.programRoleRows} tone="primary" />
                            <SummaryCard icon={BiotechOutlined} label="Regulator role" value={summary.regulatorRoleRows} tone="accent" />
                            <SummaryCard icon={TableChartOutlined} label="Discordant" value={summary.discordantRows} tone="warning" />
                        </Box>

                        <GeneRecordsTable records={records} />
                    </>
                )}

                {!query && suggestionsLoading && (
                    <StatePanel loading title="Searching genes" message="Looking up matching gene symbols and ENSG identifiers." minHeight={220} />
                )}
            </Stack>
        </PageFrame>
    );
}
