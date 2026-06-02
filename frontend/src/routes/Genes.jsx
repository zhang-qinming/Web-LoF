import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
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
    SchemaOutlined,
    ScienceOutlined,
    TableChartOutlined,
} from '@mui/icons-material';
import useSWR from 'swr';
import { getGenePrograms, getRecommendedGenes, searchGenes } from '../api/gwas';
import { PageFrame, StatePanel } from '../components/PageScaffold';
import {
    captionSx,
    controlFieldSx,
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
            <TableContainer sx={stickyTableContainerSx(theme)}>
                <Table size="small" sx={stickyTableSx(theme)}>
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

function GeneDiscoveryPanel({ recommended, onSelect }) {
    const theme = useTheme();
    const fallbackGenes = ['RPL37', 'RPL36', 'PTMA', 'RPL23', 'RPL24', 'TP53'];
    const genes = recommended?.genes || [];

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap' })}>
                <Box>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.96rem' })}>
                        High-connectivity genes
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>
                        Genes with the broadest program and trait evidence in the imported index.
                    </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
                    {fallbackGenes.slice(0, 4).map((gene) => <GeneChipLink key={gene} gene={gene} tone="primary" />)}
                </Stack>
            </Box>

            {recommended?.unavailable ? (
                <Alert severity="warning" sx={{ m: 1.5, borderRadius: 1 }}>
                    Gene SQL index is not available yet.
                </Alert>
            ) : (
                <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1 }}>
                    {(genes.length ? genes : fallbackGenes.map((gene) => ({ geneSymbol: gene }))).map((gene, index) => {
                        const label = gene.geneSymbol || gene.ensgId || gene.geneLabel;
                        return (
                            <Button
                                key={`${label}-${index}`}
                                onClick={() => onSelect(label)}
                                sx={{
                                    justifyContent: 'space-between',
                                    textAlign: 'left',
                                    textTransform: 'none',
                                    px: 1.25,
                                    py: 1,
                                    borderRadius: 1,
                                    border: `1px solid ${theme.custom.border.soft}`,
                                    color: theme.palette.text.primary,
                                    bgcolor: theme.palette.background.paper,
                                    transition: `background-color ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                                        borderColor: alpha(theme.palette.primary.main, 0.24),
                                        transform: 'translateY(-1px)',
                                    },
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '0.92rem', fontWeight: 800, lineHeight: 1.2 }}>
                                        {label}
                                    </Typography>
                                    {gene.ensgId && (
                                        <Typography sx={{ mt: 0.25, fontSize: '0.68rem', fontFamily: 'monospace', color: theme.palette.text.secondary }} noWrap>
                                            {gene.ensgId}
                                        </Typography>
                                    )}
                                </Box>
                                {Number.isFinite(gene.totalTraits) && (
                                    <Stack direction="row" spacing={0.5} sx={{ ml: 1, flexShrink: 0 }}>
                                        <Chip label={`${gene.totalTraits} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />
                                        <Chip label={`${gene.totalPrograms} programs`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                                    </Stack>
                                )}
                            </Button>
                        );
                    })}
                </Box>
            )}
        </Paper>
    );
}

function buildTopPrograms(records) {
    const map = new Map();
    records.forEach((row) => {
        if (!row.program) return;
        if (!map.has(row.program)) {
            map.set(row.program, {
                program: row.program,
                annotation: row.programAnnotation,
                traits: new Set(),
                rows: 0,
                programRows: 0,
                regulatorRows: 0,
                concordantRows: 0,
                discordantRows: 0,
            });
        }
        const item = map.get(row.program);
        if (row.traitId) item.traits.add(row.traitId);
        item.rows += 1;
        if (row.role === 'program') item.programRows += 1;
        if (row.role === 'regulator') item.regulatorRows += 1;
        if (row.isConcordant) item.concordantRows += 1;
        if (row.isDiscordant) item.discordantRows += 1;
    });

    return [...map.values()]
        .map((item) => ({ ...item, totalTraits: item.traits.size }))
        .sort((a, b) => (
            b.totalTraits - a.totalTraits
            || b.rows - a.rows
            || a.program.localeCompare(b.program)
        ))
        .slice(0, 8);
}

function TopProgramsPanel({ records }) {
    const theme = useTheme();
    const programs = React.useMemo(() => buildTopPrograms(records), [records]);

    if (!programs.length) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme)}>
                <SchemaOutlined sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                <Typography sx={sectionTitleSx(theme, { fontSize: '0.92rem' })}>
                    Top programs for this gene
                </Typography>
            </Box>
            <Box sx={{ p: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 1 }}>
                {programs.map((program, index) => (
                    <Button
                        key={program.program}
                        component={RouterLink}
                        to={`/programs/${encodeURIComponent(program.program)}`}
                        sx={{
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            textTransform: 'none',
                            px: 1.25,
                            py: 1,
                            borderRadius: 1,
                            border: `1px solid ${theme.custom.border.soft}`,
                            color: theme.palette.text.primary,
                            ...tableRowRevealSx(theme, index),
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                        }}
                    >
                        <Box sx={{ minWidth: 0, width: '100%' }}>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.35 }}>
                                <Typography sx={{ fontWeight: 850, color: theme.palette.primary.dark }}>{program.program}</Typography>
                                <Chip label={`${program.totalTraits} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />
                                <Chip label={`${program.rows} rows`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                            </Stack>
                            <Typography sx={{ fontSize: '0.74rem', color: theme.palette.text.secondary }} noWrap>
                                {program.annotation || 'No annotation'}
                            </Typography>
                            <Typography sx={{ mt: 0.35, fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                {program.programRows} program rows / {program.regulatorRows} regulator rows
                            </Typography>
                        </Box>
                    </Button>
                ))}
            </Box>
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
            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 620, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1280 })}>
                    <TableHead>
                        <TableRow>
                            {[
                                { label: 'Trait', width: '30%' },
                                { label: 'Program', width: '20%' },
                                { label: 'Role', width: 110 },
                                { label: 'Direction', width: '16%' },
                                { label: 'post_mean', width: 96 },
                                { label: 'abs_gamma', width: 96 },
                                { label: 'membership', width: 104 },
                                { label: 'Concordance', width: 160 },
                            ].map((column) => (
                                <TableCell
                                    key={column.label}
                                    sx={stickyTableHeaderCellSx(theme, tone, 'left', {
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        width: column.width,
                                    })}
                                >
                                    {column.label}
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
                                <TableCell sx={{ width: '30%', minWidth: 360, verticalAlign: 'top' }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(row.fileId || row.traitId)}`}
                                        endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 750,
                                            justifyContent: 'flex-start',
                                            alignItems: 'flex-start',
                                            px: 0,
                                            py: 0,
                                            color: theme.palette.text.primary,
                                            width: '100%',
                                            maxWidth: '100%',
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
                                                lineHeight: 1.28,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {row.traitName || row.traitId}
                                        </Box>
                                    </Button>
                                    <Typography
                                        sx={{
                                            fontSize: '0.7rem',
                                            color: theme.palette.text.secondary,
                                            fontFamily: 'monospace',
                                            mt: 0.25,
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-all',
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {row.traitId}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ width: '20%', minWidth: 220, verticalAlign: 'top' }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 800,
                                            px: 0,
                                            py: 0,
                                            color: theme.palette.primary.dark,
                                            width: '100%',
                                            justifyContent: 'flex-start',
                                            minHeight: 0,
                                        }}
                                    >
                                        {row.program}
                                    </Button>
                                    {row.programAnnotation && (
                                        <Typography
                                            sx={{
                                                fontSize: '0.7rem',
                                                color: theme.palette.text.secondary,
                                                mt: 0.25,
                                                lineHeight: 1.2,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {row.programAnnotation}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell sx={{ width: 110 }}>
                                    <Chip label={row.role} size="small" sx={summaryChipSx(theme, roleTone(theme, row.role))} />
                                </TableCell>
                                <TableCell sx={{ width: '16%', minWidth: 180 }}>
                                    <Typography sx={{ fontSize: '0.76rem', fontWeight: 700 }}>
                                        {row.predictedSign || row.gammaSign || '-'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                        gamma {row.gammaSign || '-'} / post {row.postMeanSign || '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ width: 96, fontFamily: 'monospace' }}>{formatSigned(row.postMean, 4)}</TableCell>
                                <TableCell sx={{ width: 96, fontFamily: 'monospace' }}>{formatNumber(row.absGamma, 4)}</TableCell>
                                <TableCell sx={{ width: 104, fontFamily: 'monospace' }}>{formatNumber(row.membershipScore, 4)}</TableCell>
                                <TableCell sx={{ width: 160 }}>
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

    const { data: recommended } = useSWR(
        !query ? ['recommended-genes'] : null,
        () => getRecommendedGenes({ limit: 12 }),
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
                        <Paper elevation={0} sx={panelSx(theme, { p: 1.5 })}>
                            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.25} alignItems={{ xs: 'flex-start', md: 'center' }}>
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
                                    <Chip label={`${summary.concordantRows || 0} concordant`} sx={summaryChipSx(theme, metricChipTone(theme, 'success'))} />
                                    <Chip label={`${summary.discordantRows || 0} discordant`} sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                                </Stack>
                            </Stack>
                        </Paper>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
                            <SummaryCard icon={TableChartOutlined} label="Rows" value={summary.totalRows} />
                            <SummaryCard icon={ScienceOutlined} label="Programs" value={summary.totalPrograms} tone="primary" />
                            <SummaryCard icon={AccountTreeOutlined} label="Traits" value={summary.totalTraits} tone="accent" />
                            <SummaryCard icon={BiotechOutlined} label="Program role" value={summary.programRoleRows} tone="primary" />
                        </Box>

                        <TopProgramsPanel records={records} />
                        <GeneRecordsTable records={records} />
                    </>
                )}

                {!query && (
                    <>
                        <GeneDiscoveryPanel recommended={recommended} onSelect={(gene) => runSearch(gene)} />
                        <Divider sx={{ borderColor: theme.custom.border.soft }} />
                        <Typography sx={captionSx(theme, { fontSize: '0.78rem' })}>
                            Tip: use exact gene symbols for direct lookup, or type two or more characters to search matching gene symbols and ENSG identifiers.
                        </Typography>
                    </>
                )}

                {!query && suggestionsLoading && (
                    <StatePanel loading title="Searching genes" message="Looking up matching gene symbols and ENSG identifiers." minHeight={220} />
                )}
            </Stack>
        </PageFrame>
    );
}
