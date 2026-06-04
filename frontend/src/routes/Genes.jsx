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
    TableSortLabel,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    AccountTreeOutlined,
    BiotechOutlined,
    DownloadOutlined,
    ManageSearchOutlined,
    OpenInNew,
    ScienceOutlined,
    TableChartOutlined,
} from '@mui/icons-material';
import useSWR from 'swr';
import { getGenePrograms, getGenes, getRecommendedGenes, searchGenes } from '../api/gwas';
import { PageFrame, StatePanel } from '../components/PageScaffold';
import { downloadBlob } from '../utils/download';
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

const GENE_TABLE_COLUMNS = [
    { key: 'geneSymbol', label: 'Gene Symbol', align: 'left', width: '18%' },
    { key: 'ensgId', label: 'Ensembl ID', align: 'left', width: '20%' },
    { key: 'location', label: 'Location', align: 'left', width: '18%' },
    { key: 'geneType', label: 'Gene Type', align: 'left', width: '16%' },
    { key: 'totalPrograms', label: 'Number of Associated Programs', align: 'right', width: '14%' },
    { key: 'totalTraits', label: 'Number of Associated Traits', align: 'right', width: '14%' },
];
const GENE_PROGRAM_COLUMNS = [
    { key: 'geneLabel', label: 'Gene', align: 'left', width: '14%' },
    { key: 'program', label: 'Program', align: 'left', width: '12%' },
    { key: 'programAnnotation', label: 'Program Function', align: 'left', width: '24%' },
    { key: 'programGoLabel', label: 'Program GO Function', align: 'left', width: '24%' },
    { key: 'geneDirection', label: 'Gene Direction In Program', align: 'left', width: '14%' },
    { key: 'programGeneCountSort', label: 'Program Gene Count', align: 'right', width: '12%' },
];
const GENE_TRAIT_COLUMNS = [
    { key: 'traitName', label: 'Trait', align: 'left', width: '24%' },
    { key: 'program', label: 'Program', align: 'left', width: '12%' },
    { key: 'programAnnotation', label: 'Program Function', align: 'left', width: '20%' },
    { key: 'role', label: 'Role', align: 'left', width: 110 },
    { key: 'direction', label: 'Direction', align: 'left', width: '12%' },
    { key: 'postMean', label: 'post_mean', align: 'right', width: 96 },
    { key: 'absGamma', label: 'abs_gamma', align: 'right', width: 96 },
    { key: 'membershipScore', label: 'membership', align: 'right', width: 104 },
    { key: 'concordance', label: 'Concordance', align: 'left', width: 160 },
];
const EMPTY_GENE_ROWS = [];
const EMPTY_RECORDS = [];
const GO_TERM_PATTERN = /GO:\d{7}/i;

function sortLabelSx() {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.15,
        fontSize: '0.72rem',
        m: 0,
        '& .MuiTableSortLabel-icon': {
            fontSize: '0.84rem',
            margin: 0,
        },
    };
}

function getGeneLocation(gene) {
    if (gene?.location) return gene.location;
    const chromosome = String(gene?.chromosome || '').trim();
    if (!chromosome) return '';
    const begin = Number.isFinite(gene?.beginPos) ? Math.trunc(gene.beginPos) : null;
    const end = Number.isFinite(gene?.endPos) ? Math.trunc(gene.endPos) : null;
    if (begin == null || end == null) return chromosome;
    return `${chromosome}:${begin}-${end}`;
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

function formatProgramGeneCount(loadingCount, regulatorCount) {
    const loading = Number(loadingCount) || 0;
    const regulator = Number(regulatorCount) || 0;
    if (loading && regulator) return `L:${loading} / R:${regulator}`;
    if (loading) return `L:${loading}`;
    if (regulator) return `R:${regulator}`;
    return '-';
}

function buildGeneInfoCsv(gene, summary) {
    const lines = [
        [
            'Gene Symbol',
            'Ensembl ID',
            'Gene Name',
            'Location',
            'Gene Type',
            'HGNC',
            'NCBI Gene ID',
            'Associated Programs',
            'Associated Traits',
            'Description',
            'Ensembl URL',
            'GeneCards URL',
            'NCBI URL',
        ].map((value) => escapeCsvValue(value)).join(','),
        [
            gene?.geneSymbol || '',
            gene?.ensgId || '',
            gene?.geneName || '',
            getGeneLocation(gene),
            gene?.geneType || '',
            gene?.hgnc || '',
            gene?.geneId || '',
            Number(summary?.totalPrograms) || 0,
            Number(summary?.totalTraits) || 0,
            gene?.description || '',
            buildEnsemblUrl(gene?.ensgId),
            buildGeneCardsUrl(gene?.geneSymbol),
            buildNcbiUrl(gene),
        ].map((value) => escapeCsvValue(value)).join(','),
    ];
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
            .map((role) => (role === 'program' ? 'loading' : 'regulator'))
            .join(' + ') || '-';
        const signValues = [...item.signs];
        let signLabel = '-';
        if (signValues.length === 1) signLabel = signValues[0];
        if (signValues.length > 1) signLabel = 'mixed';
        const geneDirection = roleLabel === '-' ? signLabel : (signLabel === '-' ? roleLabel : `${roleLabel} / ${signLabel}`);
        const programGeneCountSort = item.loadingGeneCount + item.regulatorGeneCount;

        return {
            geneLabel: item.geneLabel || item.geneSymbol || item.ensgId || '-',
            program: item.program,
            programAnnotation: item.programAnnotation || '-',
            programGoLabel: item.programGoLabel || '-',
            goEnrichmentP: item.goEnrichmentP || '',
            geneDirection,
            programGeneCountLabel: formatProgramGeneCount(item.loadingGeneCount, item.regulatorGeneCount),
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
            row.geneLabel || '',
            row.program || '',
            row.programAnnotation || '',
            row.programGoLabel || '',
            row.geneDirection || '',
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
            'Program Function',
            'Role',
            'Direction',
            'post_mean',
            'abs_gamma',
            'membership',
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
            Number.isFinite(row.absGamma) ? row.absGamma : '',
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
    if (sortBy === 'programGeneCountSort') result = (Number(a?.programGeneCountSort) || 0) - (Number(b?.programGeneCountSort) || 0);

    if (!result) result = compareText(a?.program, b?.program);
    return sortDir === 'desc' ? -result : result;
}

function compareGeneTraitRows(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'traitName') result = compareText(a?.traitName || a?.traitId, b?.traitName || b?.traitId);
    if (sortBy === 'program') result = compareText(a?.program, b?.program);
    if (sortBy === 'programAnnotation') result = compareText(a?.programAnnotation, b?.programAnnotation);
    if (sortBy === 'role') result = compareText(a?.role, b?.role);
    if (sortBy === 'direction') result = compareText(getRecordDirection(a), getRecordDirection(b));
    if (sortBy === 'postMean') result = (Number(a?.postMean) || 0) - (Number(b?.postMean) || 0);
    if (sortBy === 'absGamma') result = (Number(a?.absGamma) || 0) - (Number(b?.absGamma) || 0);
    if (sortBy === 'membershipScore') result = (Number(a?.membershipScore) || 0) - (Number(b?.membershipScore) || 0);
    if (sortBy === 'concordance') result = compareText(getConcordanceLabel(a), getConcordanceLabel(b));

    if (!result) result = compareText(a?.program, b?.program);
    if (!result) result = compareText(a?.traitName || a?.traitId, b?.traitName || b?.traitId);
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
    const rows = suggestions?.genes || EMPTY_GENE_ROWS;
    const [sortBy, setSortBy] = React.useState('totalTraits');
    const [sortDir, setSortDir] = React.useState('desc');

    const sortedRows = React.useMemo(
        () => [...rows].sort((a, b) => compareGenes(a, b, sortBy, sortDir)),
        [rows, sortBy, sortDir],
    );

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(key === 'totalPrograms' || key === 'totalTraits' ? 'desc' : 'asc');
    }, [sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneTableCsv(sortedRows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'gene-matches.csv');
    }, [sortedRows]);

    if (!rows.length) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap' })}>
                <Stack direction="row" spacing={0.8} alignItems="center">
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.88rem' })}>
                        Matching genes
                    </Typography>
                    <Chip
                        label={rows.length}
                        size="small"
                        sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                    />
                </Stack>
                <Button
                    size="small"
                    startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                    onClick={handleDownload}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                >
                    CSV
                </Button>
            </Box>
            <TableContainer sx={stickyTableContainerSx(theme)}>
                <Table size="small" stickyHeader sx={stickyTableSx(theme, { minWidth: 980 })}>
                    <TableHead>
                        <TableRow>
                            {GENE_TABLE_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    sx={stickyTableHeaderCellSx(theme, tableTone(theme, 'neutral'), column.align, {
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        width: column.width,
                                    })}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        onClick={() => handleSort(column.key)}
                                        sx={sortLabelSx()}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedRows.map((gene, index) => (
                            <TableRow
                                key={`${gene.geneSymbol || gene.geneLabel}-${gene.ensgId || index}`}
                                hover
                                onClick={() => onSelect(gene.geneSymbol || gene.ensgId)}
                                sx={{
                                    cursor: 'pointer',
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                                }}
                            >
                                <TableCell sx={{ fontWeight: 800, color: theme.palette.primary.dark }}>
                                    {gene.geneSymbol || '-'}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary }}>
                                    {gene.ensgId || '-'}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace' }}>
                                    {getGeneLocation(gene) || '-'}
                                </TableCell>
                                <TableCell>
                                    {gene.geneType || '-'}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                    {(Number(gene.totalPrograms) || 0).toLocaleString()}
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                    {(Number(gene.totalTraits) || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function GeneHomeTable({ onSelect }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);
    const [sortBy, setSortBy] = React.useState('totalTraits');
    const [sortDir, setSortDir] = React.useState('desc');
    const [downloading, setDownloading] = React.useState(false);
    const [downloadError, setDownloadError] = React.useState('');

    const { data, isLoading, error } = useSWR(
        ['gene-index', page, rowsPerPage, sortBy, sortDir],
        ([, pageIndex, limit, sortKey, direction]) => getGenes({
            page: pageIndex + 1,
            limit,
            sortBy: sortKey,
            order: direction,
        }),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    const rows = data?.genes || EMPTY_GENE_ROWS;
    const totalCount = Number(data?.totalCount) || rows.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / rowsPerPage));
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

    const handleDownload = React.useCallback(async () => {
        setDownloading(true);
        setDownloadError('');
        try {
            const payload = await getGenes({
                page: 1,
                limit: 0,
                sortBy,
                order: sortDir,
            });
            if (payload?.unavailable) {
                setDownloadError(payload.reason || 'Gene SQL index is not available yet.');
                return;
            }
            const csv = buildGeneTableCsv(payload?.genes || EMPTY_GENE_ROWS);
            downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'gene-index.csv');
        } catch (err) {
            setDownloadError(err?.message || 'Failed to download gene index.');
        } finally {
            setDownloading(false);
        }
    }, [sortBy, sortDir]);

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 })}>
                <Box>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.96rem' })}>
                        Gene index
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>
                        {totalCount
                            ? `Showing ${(start + 1).toLocaleString()}-${end.toLocaleString()} of ${totalCount.toLocaleString()} genes`
                            : 'No genes loaded from the imported index'}
                    </Typography>
                </Box>
                <Button
                    size="small"
                    startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                    onClick={handleDownload}
                    disabled={downloading || data?.unavailable}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                >
                    {downloading ? 'Preparing CSV' : 'CSV'}
                </Button>
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

            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 620, overflowX: 'auto', overflowY: 'auto' })}>
                <Table size="small" stickyHeader sx={stickyTableSx(theme, { minWidth: 980, tableLayout: 'fixed' })}>
                    <TableHead>
                        <TableRow>
                            {GENE_TABLE_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    sx={stickyTableHeaderCellSx(theme, tone, column.align, {
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        width: column.width,
                                    })}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        onClick={() => handleSort(column.key)}
                                        sx={sortLabelSx()}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading && !rows.length && (
                            <TableRow>
                                <TableCell colSpan={GENE_TABLE_COLUMNS.length} sx={{ py: 4, textAlign: 'center', color: theme.palette.text.secondary }}>
                                    Loading gene index...
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && !rows.length && !data?.unavailable && !error && (
                            <TableRow>
                                <TableCell colSpan={GENE_TABLE_COLUMNS.length} sx={{ py: 4, textAlign: 'center', color: theme.palette.text.secondary }}>
                                    No genes found in the imported gene-program-trait index.
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((gene, index) => {
                            const label = gene.geneSymbol || gene.ensgId || gene.geneLabel || '';
                            return (
                                <TableRow
                                    key={`${gene.geneSymbol || gene.geneLabel}-${gene.ensgId || index}`}
                                    hover
                                    onClick={() => {
                                        if (label) onSelect(label);
                                    }}
                                    sx={{
                                        cursor: label ? 'pointer' : 'default',
                                        ...tableRowRevealSx(theme, index),
                                        '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                                    }}
                                >
                                    <TableCell sx={{ fontWeight: 800, color: theme.palette.primary.dark }}>
                                        {gene.geneSymbol || '-'}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary }}>
                                        {gene.ensgId || '-'}
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace' }}>
                                        {getGeneLocation(gene) || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {gene.geneType || '-'}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                        {(Number(gene.totalPrograms) || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                        {(Number(gene.totalTraits) || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={totalCount}
                page={currentPage}
                onPageChange={(event, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[25, 50, 100, 200]}
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

function GeneInfoTable({ gene, summary }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');

    const links = [
        { label: 'ENSEMBL', href: buildEnsemblUrl(gene?.ensgId) },
        { label: 'GeneCards', href: buildGeneCardsUrl(gene?.geneSymbol) },
        { label: 'NCBI', href: buildNcbiUrl(gene) },
    ].filter((item) => item.href);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneInfoCsv(gene, summary);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-info.csv`);
    }, [gene, summary]);

    if (!gene) return null;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap' })}>
                <Box>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.92rem' })}>
                        Gene information
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>
                        Reference metadata and outbound resources for the selected gene.
                    </Typography>
                </Box>
                <Button
                    size="small"
                    startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                    onClick={handleDownload}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                >
                    CSV
                </Button>
            </Box>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1480 })}>
                    <TableHead>
                        <TableRow>
                            {[
                                { label: 'Gene Symbol', width: 120 },
                                { label: 'Ensembl ID', width: 170 },
                                { label: 'Gene Name', width: 220 },
                                { label: 'Location', width: 150 },
                                { label: 'Gene Type', width: 150 },
                                { label: 'HGNC', width: 100 },
                                { label: 'Programs', width: 90 },
                                { label: 'Traits', width: 90 },
                                { label: 'Description', width: 320 },
                                { label: 'External Links', width: 250 },
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
                        <TableRow hover>
                            <TableCell sx={{ fontWeight: 800, color: theme.palette.primary.dark }}>
                                {gene.geneSymbol || '-'}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', color: theme.palette.text.secondary }}>
                                {gene.ensgId || '-'}
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'top' }}>
                                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>
                                    {gene.geneName || gene.geneSymbol || '-'}
                                </Typography>
                                {(gene.geneId || gene.synonyms) && (
                                    <Typography sx={{ mt: 0.35, fontSize: '0.68rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}>
                                        {[
                                            gene.geneId ? `NCBI ${gene.geneId}` : '',
                                            gene.synonyms ? `Synonyms: ${gene.synonyms}` : '',
                                        ].filter(Boolean).join(' | ')}
                                    </Typography>
                                )}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>
                                {getGeneLocation(gene) || '-'}
                            </TableCell>
                            <TableCell>
                                {gene.geneType || '-'}
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>
                                {gene.hgnc || '-'}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                {(Number(summary?.totalPrograms) || 0).toLocaleString()}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                {(Number(summary?.totalTraits) || 0).toLocaleString()}
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'top' }}>
                                <Typography
                                    sx={{
                                        fontSize: '0.74rem',
                                        lineHeight: 1.35,
                                        color: theme.palette.text.secondary,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 4,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {gene.description || '-'}
                                </Typography>
                            </TableCell>
                            <TableCell>
                                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                                    {links.length ? links.map((link) => (
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
                                                px: 0,
                                                py: 0,
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                                color: theme.palette.primary.dark,
                                            }}
                                        >
                                            {link.label}
                                        </Button>
                                    )) : <Typography sx={{ fontSize: '0.74rem', color: theme.palette.text.secondary }}>-</Typography>}
                                </Stack>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function GeneProgramTable({ gene, records }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');
    const rows = React.useMemo(() => buildGeneProgramRows(gene, records), [gene, records]);
    const [sortBy, setSortBy] = React.useState('programGeneCountSort');
    const [sortDir, setSortDir] = React.useState('desc');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);

    const sortedRows = React.useMemo(
        () => [...rows].sort((a, b) => compareGenePrograms(a, b, sortBy, sortDir)),
        [rows, sortBy, sortDir],
    );

    React.useEffect(() => {
        setPage(0);
    }, [rows, sortBy, sortDir]);

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(key === 'programGeneCountSort' ? 'desc' : 'asc');
    }, [sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneProgramCsv(sortedRows);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-program.csv`);
    }, [gene, sortedRows]);

    if (!rows.length) return null;

    const pageCount = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * rowsPerPage;
    const visibleRows = sortedRows.slice(start, start + rowsPerPage);

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap' })}>
                <Box>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.92rem' })}>
                        Gene - Program relationships
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>
                        Showing {(start + 1).toLocaleString()}-{Math.min(start + rowsPerPage, sortedRows.length).toLocaleString()} of {sortedRows.length.toLocaleString()} linked programs
                    </Typography>
                </Box>
                <Button
                    size="small"
                    startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                    onClick={handleDownload}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                >
                    CSV
                </Button>
            </Box>
            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 540, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1480 })}>
                    <TableHead>
                        <TableRow>
                            {GENE_PROGRAM_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    sx={stickyTableHeaderCellSx(theme, tone, column.align, {
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        width: column.width,
                                    })}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        onClick={() => handleSort(column.key)}
                                        sx={sortLabelSx()}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleRows.map((row, index) => (
                            <TableRow
                                key={`${row.program}-${start + index}`}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={{ verticalAlign: 'top' }}>
                                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: theme.palette.primary.dark }}>
                                        {row.geneLabel}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ verticalAlign: 'top' }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 800,
                                            px: 0,
                                            py: 0,
                                            color: theme.palette.primary.dark,
                                            justifyContent: 'flex-start',
                                            minHeight: 0,
                                        }}
                                    >
                                        {row.program}
                                    </Button>
                                    <Typography sx={{ mt: 0.3, fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                        {row.totalTraits} linked traits
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ verticalAlign: 'top' }}>
                                    {row.programGoLabel !== '-' ? (
                                        <Button
                                            component="a"
                                            href={buildGoUrl(row.programGoLabel)}
                                            target="_blank"
                                            rel="noreferrer"
                                            endIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                                            sx={{
                                                textTransform: 'none',
                                                px: 0,
                                                py: 0,
                                                justifyContent: 'flex-start',
                                                minHeight: 0,
                                                color: theme.palette.text.primary,
                                                fontSize: '0.74rem',
                                                lineHeight: 1.3,
                                                display: 'inline-flex',
                                                textAlign: 'left',
                                            }}
                                        >
                                            {row.programAnnotation}
                                        </Button>
                                    ) : (
                                        <Typography
                                            sx={{
                                                fontSize: '0.74rem',
                                                lineHeight: 1.3,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {row.programAnnotation}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell sx={{ verticalAlign: 'top' }}>
                                    {row.programGoLabel !== '-' ? (
                                        <>
                                            <Button
                                                component="a"
                                                href={buildGoUrl(row.programGoLabel)}
                                                target="_blank"
                                                rel="noreferrer"
                                                endIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontWeight: 700,
                                                    px: 0,
                                                    py: 0,
                                                    justifyContent: 'flex-start',
                                                    minHeight: 0,
                                                    color: theme.palette.primary.dark,
                                                }}
                                            >
                                                {row.programGoLabel}
                                            </Button>
                                            {row.goEnrichmentP && (
                                                <Typography sx={{ mt: 0.3, fontSize: '0.68rem', color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                                                    GO P {row.goEnrichmentP}
                                                </Typography>
                                            )}
                                        </>
                                    ) : (
                                        <Typography sx={{ fontSize: '0.74rem', color: theme.palette.text.secondary }}>
                                            -
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Typography sx={{ fontSize: '0.74rem', fontWeight: 700 }}>
                                        {row.geneDirection}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                    {row.programGeneCountLabel}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={sortedRows.length}
                page={currentPage}
                onPageChange={(event, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10, 25, 50, 100]}
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

function GeneProgramTraitTable({ gene, records }) {
    const theme = useTheme();
    const tone = tableTone(theme, 'neutral');
    const rows = records || EMPTY_RECORDS;
    const [sortBy, setSortBy] = React.useState('absGamma');
    const [sortDir, setSortDir] = React.useState('desc');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(50);

    const sortedRows = React.useMemo(
        () => [...rows].sort((a, b) => compareGeneTraitRows(a, b, sortBy, sortDir)),
        [rows, sortBy, sortDir],
    );

    React.useEffect(() => {
        setPage(0);
    }, [rows, sortBy, sortDir]);

    const handleSort = React.useCallback((key) => {
        if (sortBy === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
            return;
        }
        setSortBy(key);
        setSortDir(['postMean', 'absGamma', 'membershipScore'].includes(key) ? 'desc' : 'asc');
    }, [sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneTraitCsv(sortedRows);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-program-trait.csv`);
    }, [gene, sortedRows]);

    if (!rows.length) return null;

    const pageCount = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * rowsPerPage;
    const visibleRecords = sortedRows.slice(start, start + rowsPerPage);

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between', flexWrap: 'wrap' })}>
                <Box>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '0.92rem' })}>
                        Gene - Program - Trait evidence
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>
                        Showing {(start + 1).toLocaleString()}-{Math.min(start + rowsPerPage, sortedRows.length).toLocaleString()} of {sortedRows.length.toLocaleString()} rows
                    </Typography>
                </Box>
                <Button
                    size="small"
                    startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                    onClick={handleDownload}
                    sx={{ textTransform: 'none', fontSize: '0.74rem', color: theme.palette.text.secondary }}
                >
                    CSV
                </Button>
            </Box>
            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 620, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1540 })}>
                    <TableHead>
                        <TableRow>
                            {GENE_TRAIT_COLUMNS.map((column) => (
                                <TableCell
                                    key={column.key}
                                    sx={stickyTableHeaderCellSx(theme, tone, column.align, {
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        width: column.width,
                                    })}
                                >
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        onClick={() => handleSort(column.key)}
                                        sx={sortLabelSx()}
                                    >
                                        {column.label}
                                    </TableSortLabel>
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
                                <TableCell sx={{ width: '24%', minWidth: 320, verticalAlign: 'top' }}>
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
                                <TableCell sx={{ width: '12%', minWidth: 150, verticalAlign: 'top' }}>
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
                                </TableCell>
                                <TableCell sx={{ width: '20%', minWidth: 240, verticalAlign: 'top' }}>
                                    <Typography
                                        sx={{
                                            fontSize: '0.7rem',
                                            color: theme.palette.text.secondary,
                                            lineHeight: 1.2,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 3,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {row.programAnnotation || '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ width: 110 }}>
                                    <Chip label={row.role} size="small" sx={summaryChipSx(theme, roleTone(theme, row.role))} />
                                </TableCell>
                                <TableCell sx={{ width: '12%', minWidth: 160 }}>
                                    <Typography sx={{ fontSize: '0.76rem', fontWeight: 700 }}>
                                        {getRecordDirection(row)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                        gamma {row.gammaSign || '-'} / post {row.postMeanSign || '-'}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ width: 96, textAlign: 'right', fontFamily: 'monospace' }}>{formatSigned(row.postMean, 4)}</TableCell>
                                <TableCell sx={{ width: 96, textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(row.absGamma, 4)}</TableCell>
                                <TableCell sx={{ width: 104, textAlign: 'right', fontFamily: 'monospace' }}>{formatNumber(row.membershipScore, 4)}</TableCell>
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
                count={sortedRows.length}
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
    const isTypingSearch = input.trim().length >= 2;

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

                {!query && isTypingSearch && !suggestionsLoading && !suggestions?.genes?.length && (
                    <StatePanel
                        icon={ManageSearchOutlined}
                        title="No matching genes"
                        message="Try a different gene symbol or ENSG identifier, or press Clear to return to the full gene index."
                        minHeight={220}
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
                                        {[
                                            details?.gene?.ensgId,
                                            details?.gene?.location,
                                            details?.gene?.geneType,
                                        ].filter(Boolean).join(' | ') || 'No ENSG identifier in index'}
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

                        <GeneInfoTable gene={details?.gene} summary={summary} />
                        <GeneProgramTable gene={details?.gene} records={records} />
                        <GeneProgramTraitTable gene={details?.gene} records={records} />
                    </>
                )}

                {!query && (
                    <>
                        <GeneDiscoveryPanel recommended={recommended} onSelect={(gene) => runSearch(gene)} />
                        <GeneHomeTable onSelect={(gene) => runSearch(gene)} />
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
