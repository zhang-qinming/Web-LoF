import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    ButtonBase,
    Chip,
    FormControl,
    InputAdornment,
    MenuItem,
    Paper,
    Pagination,
    Popover,
    Select,
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
    ExpandMore,
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
    groupedTableColumnHeaderCellSx,
    groupedTableHeaderMetrics,
    groupedTableHeaderCellSx,
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
    if (role === 'program') return metricChipTone(theme, 'primary');
    if (role === 'regulator') return metricChipTone(theme, 'accent');
    return metricChipTone(theme, 'neutral');
}

function GenePaginationControl({ totalPages, page, onChange }) {
    if (totalPages <= 1) return null;

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Pagination
                count={totalPages}
                page={page + 1}
                onChange={(event, value) => onChange(event, value - 1)}
                color="primary"
                shape="rounded"
                size="medium"
                showFirstButton
                showLastButton
            />
        </Box>
    );
}

const GENE_TABLE_COLUMNS = [
    { key: 'geneSymbol', label: 'Gene Symbol', align: 'left', width: 150 },
    { key: 'ensgId', label: 'Ensembl ID', align: 'left', width: 190 },
    { key: 'location', label: 'Location', align: 'center', width: 230 },
    { key: 'geneType', label: 'Gene Type', align: 'center', width: 170 },
    { key: 'totalPrograms', label: 'Number of Associated Programs', align: 'right', width: 205, headerWrap: true },
    { key: 'totalTraits', label: 'Number of Associated Traits', align: 'right', width: 190, headerWrap: true },
];
const GENE_PROGRAM_COLUMNS = [
    { key: 'geneLabel', label: 'Gene', align: 'center', width: 110, tone: 'identity' },
    { key: 'program', label: 'Program', align: 'center', width: 100, tone: 'identity' },
    { key: 'programAnnotation', label: 'Function', align: 'left', width: 210, tone: 'annotation' },
    { key: 'programGoLabel', label: 'GO Function', align: 'left', width: 210, tone: 'annotation' },
    { key: 'geneDirection', label: 'Direction', align: 'center', width: 120, tone: 'evidence' },
    { key: 'programGeneCountSort', label: 'Gene Count', align: 'center', width: 90, tone: 'evidence' },
];
const GENE_PROGRAM_GROUPS = [
    { label: 'Identity', span: 2, tone: 'identity' },
    { label: 'Annotation', span: 2, tone: 'annotation' },
    { label: 'Evidence', span: 2, tone: 'evidence' },
];
const GENE_TRAIT_COLUMNS = [
    { key: 'traitName', label: 'Trait', align: 'left', width: 220, tone: 'trait' },
    { key: 'program', label: 'Program', align: 'center', width: 86, tone: 'trait' },
    { key: 'programAnnotation', label: 'Function', align: 'left', width: 170, tone: 'trait' },
    { key: 'role', label: 'Role', align: 'center', width: 88, tone: 'mapping' },
    { key: 'direction', label: 'Direction', align: 'center', width: 110, tone: 'mapping' },
    { key: 'postMean', label: 'post_mean', align: 'center', width: 86, tone: 'metric' },
    { key: 'absGamma', label: 'abs_gamma', align: 'center', width: 86, tone: 'metric' },
    { key: 'membershipScore', label: 'membership', align: 'center', width: 86, tone: 'metric' },
    { key: 'concordance', label: 'Concordance', align: 'center', width: 120, tone: 'metric' },
];
const GENE_TRAIT_GROUPS = [
    { label: 'Trait / Program', span: 3, tone: 'trait' },
    { label: 'Mapping', span: 2, tone: 'mapping' },
    { label: 'Metrics', span: 4, tone: 'metric' },
];
const EMPTY_GENE_ROWS = [];
const EMPTY_RECORDS = [];
const GO_TERM_PATTERN = /GO:\d{7}/i;
const GENE_TABLE_TITLE_HEADER_HEIGHT = 54;
const GENE_INDEX_TABLE_MAX_HEIGHT = 1120;

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
    whiteSpace = 'nowrap',
} = {}) {
    return {
        px: 1.45,
        py: 1.35,
        textAlign: align,
        whiteSpace,
        fontSize: '0.875rem',
        lineHeight: 1.35,
        fontFamily,
        fontWeight,
        color: '#334155',
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        verticalAlign: 'middle',
    };
}

function geneBodyCellSx({ align = 'left', tone, fontFamily, fontWeight = 400, whiteSpace = 'nowrap' }) {
    return {
        px: 1,
        py: 0.62,
        textAlign: align,
        whiteSpace,
        fontSize: '0.71rem',
        fontFamily,
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

function embeddedGroupHeaderSx(theme, tone) {
    return groupedTableHeaderCellSx(theme, tone, {
        top: GENE_TABLE_TITLE_HEADER_HEIGHT,
    });
}

function embeddedColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: GENE_TABLE_TITLE_HEADER_HEIGHT + groupedTableHeaderMetrics.groupHeight,
    });
}

function EmbeddedTableTitleRow({ title, caption, colSpan, onDownload }) {
    const theme = useTheme();
    return (
        <TableRow>
            <TableCell colSpan={colSpan} sx={embeddedTableTitleCellSx(theme)}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.88rem', lineHeight: 1.2 })}>
                            {title}
                        </Typography>
                        <Typography sx={captionSx(theme, { fontSize: '0.7rem', lineHeight: 1.35 })}>
                            {caption}
                        </Typography>
                    </Box>
                    <Button
                        size="small"
                        startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                        onClick={onDownload}
                        sx={{ textTransform: 'none', fontSize: '0.72rem', color: theme.palette.text.secondary, flexShrink: 0 }}
                    >
                        CSV
                    </Button>
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

function evidenceWidth(value, maxValue) {
    const count = Number(value) || 0;
    const max = Number(maxValue) || 0;
    if (!count || !max) return 0;
    return Math.max(12, Math.min(100, (count / max) * 100));
}

function geneTypeTone(theme, geneType) {
    const type = String(geneType || '').toLowerCase();
    if (type.includes('protein')) return {
        color: theme.palette.primary.dark,
        backgroundColor: alpha(theme.palette.primary.main, 0.08),
        borderColor: alpha(theme.palette.primary.main, 0.2),
    };
    if (type.includes('rna') || type.includes('transcript')) return {
        color: '#2f6a49',
        backgroundColor: alpha('#2f6a49', 0.08),
        borderColor: alpha('#2f6a49', 0.2),
    };
    if (type.includes('pseudo')) return {
        color: '#8a5b12',
        backgroundColor: alpha(theme.palette.warning.main, 0.1),
        borderColor: alpha(theme.palette.warning.main, 0.22),
    };
    return {
        color: theme.palette.text.secondary,
        backgroundColor: alpha(theme.palette.text.primary, 0.05),
        borderColor: theme.custom.border.soft,
    };
}

function sortDescription(sortBy, sortDir) {
    const column = GENE_TABLE_COLUMNS.find((item) => item.key === sortBy);
    return `${column?.label || sortBy} ${sortDir === 'desc' ? 'high to low' : 'low to high'}`;
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
            programGeneCountLabel: programGeneCountSort ? programGeneCountSort.toLocaleString() : '-',
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
            py: 1,
            borderBottom: `1px solid ${theme.custom.border.soft}`,
            bgcolor: alpha(theme.palette.primary.main, 0.025),
        }}>
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: theme.palette.text.secondary, textTransform: 'none', letterSpacing: '0.06em' }}>
                    Matching genes
                </Typography>
                <Chip
                    label={rows.length}
                    size="small"
                    sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                />
            </Stack>
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                gap: 0.75,
            }}>
                {sortedRows.slice(0, 8).map((gene, index) => {
                    const label = gene.geneSymbol || gene.ensgId || gene.geneLabel;
                    return (
                        <Button
                            key={`${label}-${gene.ensgId || index}`}
                            onClick={() => onSelect(label)}
                            sx={{
                                alignItems: 'flex-start',
                                justifyContent: 'flex-start',
                                flexDirection: 'column',
                                gap: 0.65,
                                textAlign: 'left',
                                textTransform: 'none',
                                px: 1,
                                py: 0.75,
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
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 850, lineHeight: 1.15 }} noWrap>
                                    {label}
                                </Typography>
                                {gene.ensgId && (
                                    <Typography sx={{ mt: 0.25, fontSize: '0.66rem', fontFamily: 'monospace', color: theme.palette.text.secondary }} noWrap>
                                        {gene.ensgId}
                                    </Typography>
                                )}
                            </Box>
                            <Stack direction="row" spacing={0.45} sx={{ width: '100%', flexWrap: 'wrap' }}>
                                <Chip label={`${Number(gene.totalTraits) || 0} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />
                                <Chip label={`${Number(gene.totalPrograms) || 0} programs`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                            </Stack>
                        </Button>
                    );
                })}
            </Box>
        </Box>
    );
}

function GeneLocationCell({ gene }) {
    const location = getGeneLocation(gene) || '-';

    return (
        <Box
            title={location}
            sx={{
                width: '100%',
                minWidth: 0,
                px: 0.85,
                py: 0.35,
                borderRadius: 0.75,
                fontFamily: 'monospace',
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#315d57',
                bgcolor: alpha('#2f6a49', 0.06),
                border: `1px solid ${alpha('#2f6a49', 0.14)}`,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}
        >
            {location}
        </Box>
    );
}

function GeneTypeBadge({ value }) {
    const theme = useTheme();
    const tone = geneTypeTone(theme, value);

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                maxWidth: '100%',
                px: 0.85,
                py: 0.3,
                borderRadius: 1,
                color: tone.color,
                bgcolor: tone.backgroundColor,
                border: `1px solid ${tone.borderColor}`,
                fontSize: '0.74rem',
                fontWeight: 800,
                lineHeight: 1.15,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
            }}
        >
            {value || '-'}
        </Box>
    );
}

function GeneAssociationMeter({ value, maxValue, tone = 'primary', compact = false }) {
    const count = Number(value) || 0;
    const width = evidenceWidth(count, maxValue);
    const color = tone === 'accent' ? '#5d3f8c' : '#245089';
    const softColor = tone === 'accent' ? alpha('#5d3f8c', 0.13) : alpha('#245089', 0.13);

    return (
        <Box sx={{ display: 'grid', gap: 0.55, justifyItems: 'end', minWidth: compact ? 78 : 118 }}>
            <Typography
                sx={{
                    fontFamily: 'monospace',
                    fontSize: compact ? '0.78rem' : '0.9rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    color,
                }}
            >
                {count.toLocaleString()}
            </Typography>
            <Box
                sx={{
                    width: compact ? 72 : 104,
                    height: compact ? 4 : 5,
                    borderRadius: 999,
                    bgcolor: softColor,
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        width: `${width}%`,
                        height: '100%',
                        borderRadius: 999,
                        bgcolor: color,
                    }}
                />
            </Box>
        </Box>
    );
}

function GeneHomeTable({
    input,
    setInput,
    suggestions,
    suggestionsLoading,
    onSearch,
    onClear,
    onSelect,
}) {
    const theme = useTheme();
    const geneTone = {
        ...tableTone(theme, 'neutral'),
        headerBg: '#f5faf8',
        headerBorder: alpha('#2f6a49', 0.24),
        headerColor: '#315d57',
    };
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(20);
    const [sortBy, setSortBy] = React.useState('totalTraits');
    const [sortDir, setSortDir] = React.useState('desc');
    const [downloading, setDownloading] = React.useState(false);
    const [downloadError, setDownloadError] = React.useState('');
    const isSearching = input.trim().length >= 2;

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
    const maxPrograms = React.useMemo(
        () => Math.max(1, ...rows.map((gene) => Number(gene.totalPrograms) || 0)),
        [rows],
    );
    const maxTraits = React.useMemo(
        () => Math.max(1, ...rows.map((gene) => Number(gene.totalTraits) || 0)),
        [rows],
    );
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
                    py: { xs: 1.5, md: 1.75 },
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
                    gap: 1.5,
                    alignItems: 'center',
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.55, flexWrap: 'wrap' }}>
                        <Chip
                            label={`${totalCount.toLocaleString()} genes`}
                            size="small"
                            sx={summaryChipSx(theme, {
                                height: 23,
                                color: '#2f6a49',
                                bgcolor: alpha('#2f6a49', 0.08),
                                border: `1px solid ${alpha('#2f6a49', 0.18)}`,
                            })}
                        />
                    </Stack>
                    <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.18rem', md: '1.35rem' }, color: '#173b35' })}>
                        Gene Explorer
                    </Typography>
                    <Typography sx={captionSx(theme, { mt: 0.35, maxWidth: 620 })}>
                        Search symbols or ENSG identifiers, then sort genes by location, type, programs, and traits.
                    </Typography>
                </Box>

                <Box
                    sx={{
                        width: { xs: '100%', lg: 560 },
                        p: 1,
                        borderRadius: 1.25,
                        bgcolor: alpha(theme.palette.background.paper, 0.86),
                        border: `1px solid ${alpha('#2f6a49', 0.16)}`,
                        boxShadow: `0 10px 30px ${alpha('#0f172a', 0.05)}`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') onSearch(input);
                            }}
                            placeholder="Gene symbol or ENSG"
                            sx={{
                                flex: { xs: '1 1 100%', sm: '1 1 240px' },
                                maxWidth: { sm: 310 },
                                '& .MuiOutlinedInput-root': {
                                    bgcolor: theme.palette.background.paper,
                                    borderRadius: 1,
                                },
                                '& .MuiOutlinedInput-input': {
                                    py: 0.78,
                                    fontSize: '0.84rem',
                                },
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <ManageSearchOutlined fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button
                            size="small"
                            variant="contained"
                            onClick={() => onSearch(input)}
                            startIcon={<BiotechOutlined />}
                            sx={{ textTransform: 'none', px: 1.25, fontWeight: 800, minWidth: 88 }}
                        >
                            Search
                        </Button>
                        {input.trim() && (
                            <Button
                                size="small"
                                variant="text"
                                onClick={onClear}
                                sx={{ textTransform: 'none', color: theme.palette.text.secondary, minWidth: 52 }}
                            >
                                Clear
                            </Button>
                        )}
                        <Button
                            size="small"
                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                            onClick={handleDownload}
                            disabled={downloading || data?.unavailable}
                            sx={{
                                textTransform: 'none',
                                fontSize: '0.74rem',
                                color: theme.palette.text.secondary,
                                minWidth: 70,
                            }}
                        >
                            {downloading ? 'Preparing' : 'CSV'}
                        </Button>
                    </Box>
                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.85, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 700 }}>
                            Rows
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 72 }}>
                            <Select
                                value={rowsPerPage}
                                onChange={(event) => {
                                    setRowsPerPage(Number(event.target.value));
                                    setPage(0);
                                }}
                                sx={{ fontSize: '0.78rem', '& .MuiSelect-select': { py: 0.45 } }}
                            >
                                {[20, 50, 100, 200].map((value) => (
                                    <MenuItem key={value} value={value} dense>{value}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Chip
                            label={`Sorted: ${sortDescription(sortBy, sortDir)}`}
                            size="small"
                            sx={summaryChipSx(theme, {
                                height: 22,
                                maxWidth: { xs: '100%', sm: 260 },
                                color: theme.palette.text.secondary,
                                bgcolor: alpha(theme.palette.text.primary, 0.045),
                            })}
                        />
                    </Stack>
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

            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: GENE_INDEX_TABLE_MAX_HEIGHT, overflowX: 'auto', overflowY: 'auto' })}>
                <Table size="small" stickyHeader sx={stickyTableSx(theme, { minWidth: 1115, tableLayout: 'fixed' })}>
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
                                        fontSize: '0.8rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.04em',
                                        textTransform: 'none',
                                        py: column.headerWrap ? 0.9 : 1.2,
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
                                            justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
                                            '&:hover': { color: '#2f6a49' },
                                            '&.Mui-active': { color: '#2f6a49', fontWeight: 800 },
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
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, lineHeight: 1.1, color: '#173b35' }} noWrap>
                                                        {gene.geneSymbol || gene.geneLabel || '-'}
                                                    </Typography>
                                                    {gene.geneName && (
                                                        <Typography sx={{ mt: 0.25, fontSize: '0.66rem', color: theme.palette.text.secondary }} noWrap>
                                                            {gene.geneName}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            );
                                        }
                                        if (column.key === 'ensgId') {
                                            content = (
                                                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 700, color: theme.palette.text.secondary }} noWrap>
                                                    {gene.ensgId || '-'}
                                                </Typography>
                                            );
                                        }
                                        if (column.key === 'location') content = <GeneLocationCell gene={gene} />;
                                        if (column.key === 'geneType') content = <GeneTypeBadge value={gene.geneType} />;
                                        if (column.key === 'totalPrograms') {
                                            content = <GeneAssociationMeter value={gene.totalPrograms} maxValue={maxPrograms} tone="primary" />;
                                        }
                                        if (column.key === 'totalTraits') {
                                            content = <GeneAssociationMeter value={gene.totalTraits} maxValue={maxTraits} tone="accent" />;
                                        }

                                        return (
                                            <TableCell
                                                key={column.key}
                                                sx={{
                                                    ...geneTableCellSx(theme, {
                                                        align: column.align,
                                                        fontFamily: isMono ? 'monospace' : undefined,
                                                        fontWeight: column.key === 'geneSymbol' || isNumeric ? 800 : 500,
                                                        whiteSpace: column.key === 'geneType' ? 'normal' : 'nowrap',
                                                    }),
                                                    ...(isNumeric ? { overflow: 'visible' } : {}),
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
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                    alignItems: 'center',
                    gap: 1.5,
                    background: `linear-gradient(90deg, ${alpha('#2f6a49', 0.045)}, ${theme.custom.surface.subtle})`,
                    borderTop: `1px solid ${theme.custom.border.soft}`,
                }}
            >
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexWrap: 'wrap', minWidth: 0 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {totalCount === 0
                            ? 'No genes'
                            : `${Math.min(start + 1, totalCount).toLocaleString()}-${end.toLocaleString()} / ${totalCount.toLocaleString()} genes`}
                    </Typography>
                    <Chip
                        label={sortDescription(sortBy, sortDir)}
                        size="small"
                        sx={summaryChipSx(theme, {
                            height: 22,
                            color: '#315d57',
                            bgcolor: alpha('#2f6a49', 0.08),
                            border: `1px solid ${alpha('#2f6a49', 0.14)}`,
                        })}
                    />
                </Stack>
                <GenePaginationControl totalPages={pageCount} page={currentPage} onChange={(event, nextPage) => setPage(nextPage)} />
            </Box>
        </Paper>
    );
}

function GeneDiscoveryPanel({ recommended, onSelect }) {
    const theme = useTheme();
    const fallbackGenes = ['RPL37', 'RPL36', 'PTMA', 'RPL23', 'RPL24', 'TP53'];
    const genes = recommended?.genes || [];
    const spotlightGenes = (genes.length ? genes : fallbackGenes.map((gene) => ({ geneSymbol: gene }))).slice(0, 8);
    const maxTraits = Math.max(1, ...spotlightGenes.map((gene) => Number(gene.totalTraits) || 0));
    const maxPrograms = Math.max(1, ...spotlightGenes.map((gene) => Number(gene.totalPrograms) || 0));

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                overflow: 'hidden',
                bgcolor: alpha('#2f6a49', 0.025),
                borderColor: alpha('#2f6a49', 0.14),
            })}
        >
            {recommended?.unavailable ? (
                <Alert severity="warning" sx={{ m: 1.5, borderRadius: 1 }}>
                    Gene SQL index is not available yet.
                </Alert>
            ) : (
                <Box
                    sx={{
                        p: { xs: 1.5, md: 1.75 },
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', xl: '240px minmax(0, 1fr)' },
                        gap: 1.35,
                        alignItems: 'stretch',
                    }}
                >
                    <Box
                        sx={{
                            p: 1.25,
                            borderRadius: 1.25,
                            bgcolor: theme.palette.background.paper,
                            border: `1px solid ${theme.custom.border.soft}`,
                        }}
                    >
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'none', color: '#2f6a49' }}>
                            Gene spotlight
                        </Typography>
                        <Typography sx={sectionTitleSx(theme, { mt: 0.35, fontSize: '0.96rem', color: '#173b35' })}>
                            High-connectivity entries
                        </Typography>
                        <Typography sx={captionSx(theme, { mt: 0.45, fontSize: '0.72rem', lineHeight: 1.45 })}>
                            Quick jumps into genes with broad trait and program evidence, kept below the atlas so the table stays primary.
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                            gap: 0.85,
                        }}
                    >
                        {spotlightGenes.map((gene, index) => {
                            const label = gene.geneSymbol || gene.ensgId || gene.geneLabel;
                            const traitCount = Number(gene.totalTraits) || 0;
                            const programCount = Number(gene.totalPrograms) || 0;
                            return (
                                <Button
                                    key={`${label}-${index}`}
                                    onClick={() => onSelect(label)}
                                    sx={{
                                        display: 'block',
                                        textAlign: 'left',
                                        textTransform: 'none',
                                        px: 1.1,
                                        py: 1,
                                        borderRadius: 1.25,
                                        border: `1px solid ${theme.custom.border.soft}`,
                                        color: theme.palette.text.primary,
                                        bgcolor: theme.palette.background.paper,
                                        minWidth: 0,
                                        transition: `background-color ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                        ...tableRowRevealSx(theme, index),
                                        '&:hover': {
                                            bgcolor: alpha('#2f6a49', 0.045),
                                            borderColor: alpha('#2f6a49', 0.24),
                                            transform: 'translateY(-1px)',
                                        },
                                    }}
                                >
                                    <Stack direction="row" spacing={0.75} alignItems="flex-start" justifyContent="space-between">
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography sx={{ fontSize: '0.88rem', fontWeight: 900, color: '#173b35', lineHeight: 1.12 }} noWrap>
                                                {label}
                                            </Typography>
                                            {gene.ensgId && (
                                                <Typography sx={{ mt: 0.25, fontSize: '0.65rem', fontFamily: 'monospace', color: theme.palette.text.secondary }} noWrap>
                                                    {gene.ensgId}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: alpha('#2f6a49', 0.08), border: `1px solid ${alpha('#2f6a49', 0.16)}` }} />
                                    </Stack>
                                    {(traitCount || programCount) ? (
                                        <Stack spacing={0.55} sx={{ mt: 0.9 }}>
                                            <Box>
                                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                                    <Typography sx={{ fontSize: '0.66rem', color: theme.palette.text.secondary, fontWeight: 800 }}>Traits</Typography>
                                                    <Typography sx={{ fontSize: '0.66rem', color: '#5d3f8c', fontFamily: 'monospace', fontWeight: 900 }}>{traitCount.toLocaleString()}</Typography>
                                                </Stack>
                                                <Box sx={{ height: 4, borderRadius: 999, bgcolor: alpha('#5d3f8c', 0.12), overflow: 'hidden' }}>
                                                    <Box sx={{ height: '100%', width: `${evidenceWidth(traitCount, maxTraits)}%`, bgcolor: '#5d3f8c' }} />
                                                </Box>
                                            </Box>
                                            <Box>
                                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                                    <Typography sx={{ fontSize: '0.66rem', color: theme.palette.text.secondary, fontWeight: 800 }}>Programs</Typography>
                                                    <Typography sx={{ fontSize: '0.66rem', color: '#245089', fontFamily: 'monospace', fontWeight: 900 }}>{programCount.toLocaleString()}</Typography>
                                                </Stack>
                                                <Box sx={{ height: 4, borderRadius: 999, bgcolor: alpha('#245089', 0.12), overflow: 'hidden' }}>
                                                    <Box sx={{ height: '100%', width: `${evidenceWidth(programCount, maxPrograms)}%`, bgcolor: '#245089' }} />
                                                </Box>
                                            </Box>
                                        </Stack>
                                    ) : (
                                        <Typography sx={{ mt: 0.9, fontSize: '0.68rem', color: theme.palette.text.secondary }}>
                                            Open gene evidence
                                        </Typography>
                                    )}
                                </Button>
                            );
                        })}
                    </Box>
                </Box>
            )}
        </Paper>
    );
}

function GeneSwitcher({ gene, query, onSelect }) {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [search, setSearch] = React.useState('');
    const open = Boolean(anchorEl);
    const currentLabel = gene?.geneSymbol || query || gene?.ensgId || 'Gene';
    const currentDescription = [
        gene?.ensgId,
        getGeneLocation(gene),
        gene?.geneType,
    ].filter(Boolean).join(' | ') || 'Search another gene';
    const searchTerm = search.trim();

    const { data, isLoading } = useSWR(
        open && searchTerm.length >= 2 ? ['gene-switcher-search', searchTerm] : null,
        ([, q]) => searchGenes(q, { limit: 12 }),
        { keepPreviousData: true, revalidateOnFocus: false },
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
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 1,
                    px: 0.5,
                    py: 0.35,
                    borderRadius: 1,
                    textAlign: 'left',
                    transition: `background-color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                    '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        transform: 'translateY(-1px)',
                    },
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={sectionTitleSx(theme, { fontSize: { xs: '1.55rem', md: '1.85rem' }, lineHeight: 1.12 })}>
                        {currentLabel}
                    </Typography>
                    <Typography sx={captionSx(theme, { mt: 0.35, fontSize: '0.82rem', fontFamily: gene?.ensgId ? 'monospace' : undefined })}>
                        {currentDescription}
                    </Typography>
                </Box>
                <ExpandMore sx={{ mt: 0.55, color: theme.palette.text.secondary, flexShrink: 0 }} />
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
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 750, color: theme.palette.text.primary }}>
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
                        placeholder="Search PTMA or ENSG00000187514"
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
                    {isLoading && (
                        <Typography sx={{ px: 1, py: 2, fontSize: '0.8rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                            Searching genes...
                        </Typography>
                    )}
                    {!isLoading && searchTerm.length < 2 && (
                        <Typography sx={{ px: 1, py: 2, fontSize: '0.8rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                            Type at least two characters.
                        </Typography>
                    )}
                    {!isLoading && searchTerm.length >= 2 && rows.length === 0 && (
                        <Typography sx={{ px: 1, py: 2, fontSize: '0.8rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                            No matching genes. Press Enter to search this exact value.
                        </Typography>
                    )}
                    {!isLoading && rows.map((item, index) => {
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
                                    <Typography sx={{ fontSize: '0.86rem', fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1.2 }}>
                                        {label}
                                    </Typography>
                                    <Typography sx={{ mt: 0.25, fontSize: '0.68rem', fontFamily: 'monospace', color: theme.palette.text.secondary }} noWrap>
                                        {[item.ensgId, getGeneLocation(item), item.geneType].filter(Boolean).join(' | ') || '-'}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.45} sx={{ width: '100%', flexWrap: 'wrap' }}>
                                    <Chip label={`${Number(item.totalTraits) || 0} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />
                                    <Chip label={`${Number(item.totalPrograms) || 0} programs`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
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
        { label: 'Rows', value: summary?.totalRows, tone: 'neutral' },
        { label: 'Programs', value: summary?.totalPrograms, tone: 'primary' },
        { label: 'Traits', value: summary?.totalTraits, tone: 'accent' },
        { label: 'Concordant', value: summary?.concordantRows, tone: 'success' },
        { label: 'Discordant', value: summary?.discordantRows, tone: 'warning' },
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
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.75} alignItems={{ xs: 'stretch', lg: 'flex-start' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <GeneSwitcher gene={gene} query={query} onSelect={onSelect} />
                </Box>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(92px, 1fr))', lg: 'repeat(5, 104px)' },
                        gap: 0.75,
                        flexShrink: 0,
                    }}
                >
                    {metrics.map((metric) => {
                        const colors = metricChipTone(theme, metric.tone);
                        return (
                            <Box
                                key={metric.label}
                                sx={{
                                    px: 1,
                                    py: 0.8,
                                    borderRadius: 1,
                                    border: colors.border,
                                    bgcolor: colors.backgroundColor,
                                    color: colors.color,
                                }}
                            >
                                <Typography sx={{ fontSize: '1rem', lineHeight: 1.1, fontWeight: 850, fontFamily: 'monospace' }}>
                                    {(Number(metric.value) || 0).toLocaleString()}
                                </Typography>
                                <Typography sx={{ mt: 0.25, fontSize: '0.62rem', fontWeight: 800, textTransform: 'none', letterSpacing: '0.06em' }}>
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
                            caption={gene?.externalSources?.length ? `Metadata supplemented from ${gene.externalSources.join(' + ')}` : 'Reference metadata and external resources'}
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
                                        fontWeight: 850,
                                        letterSpacing: '0.01em',
                                    }}
                                >
                                    {row.label}
                                </TableCell>
                                <TableCell
                                    sx={{
                                        py: 1.05,
                                        px: 1.35,
                                        fontSize: '0.82rem',
                                        lineHeight: 1.42,
                                        fontFamily: row.mono ? 'monospace' : undefined,
                                        fontWeight: row.tone === 'link' ? 750 : 500,
                                        color: row.tone === 'link' ? '#245089' : theme.palette.text.primary,
                                        bgcolor: theme.palette.background.paper,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        textAlign: row.align || 'left',
                                        whiteSpace: row.wrap ? 'normal' : 'nowrap',
                                        wordBreak: row.wrap ? 'break-word' : 'normal',
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
                                                        fontWeight: 800,
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
    const [sortBy, setSortBy] = React.useState('programGeneCountSort');
    const [sortDir, setSortDir] = React.useState('desc');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(25);

    const TONES = {
        identity: tableTone(theme, 'neutral'),
        annotation: tableTone(theme, 'success'),
        evidence: tableTone(theme, 'primary'),
    };

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
            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 540, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 840 })}>
                    <colgroup>
                        {GENE_PROGRAM_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <EmbeddedTableTitleRow
                            title="Gene - Program relationships"
                            caption={`Showing ${(start + 1).toLocaleString()}-${Math.min(start + rowsPerPage, sortedRows.length).toLocaleString()} of ${sortedRows.length.toLocaleString()} linked programs`}
                            colSpan={GENE_PROGRAM_COLUMNS.length}
                            onDownload={handleDownload}
                        />
                        <TableRow>
                            {GENE_PROGRAM_GROUPS.map((group) => {
                                const palette = TONES[group.tone];
                                return (
                                    <TableCell
                                        key={group.label}
                                        colSpan={group.span}
                                        sx={embeddedGroupHeaderSx(theme, palette)}
                                    >
                                        {group.label}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
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
                                            sx={geneSortLabelSx}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleRows.map((row, index) => (
                            <TableRow
                                key={`${row.program}-${start + index}`}
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.identity, fontWeight: 600 })}>
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: theme.palette.primary.dark }} noWrap>
                                        {row.geneLabel}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.identity, fontFamily: 'monospace', fontWeight: 500 })}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.72rem',
                                            px: 0,
                                            py: 0,
                                            color: '#1976D2',
                                            justifyContent: 'center',
                                            minHeight: 0,
                                            '&:hover': { color: '#0D47A1', textDecoration: 'underline' },
                                        }}
                                    >
                                        {row.program}
                                    </Button>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'left', tone: TONES.annotation, whiteSpace: 'normal' })}>
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
                                                textAlign: 'left',
                                            }}
                                        >
                                            {row.programAnnotation}
                                        </Button>
                                    ) : (
                                        <Typography
                                            sx={{
                                                fontSize: '0.69rem',
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
                                <TableCell sx={{ ...geneBodyCellSx({ align: 'left', tone: TONES.annotation, whiteSpace: 'normal' }), bgcolor: TONES.annotation.cellStrong }}>
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
                                                    color: TONES.annotation.headerColor,
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
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.evidence, fontWeight: 600 })}>
                                    <Typography sx={{ fontSize: '0.69rem', fontWeight: 700 }}>
                                        {row.geneDirection}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.evidence, fontFamily: 'monospace', fontWeight: 600 })}>
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
}) {
    const theme = useTheme();
    const rows = records || EMPTY_RECORDS;

    const TONES = {
        trait: tableTone(theme, 'neutral'),
        mapping: tableTone(theme, 'accent'),
        metric: tableTone(theme, 'primary'),
    };

    const handleSort = React.useCallback((key) => {
        const nextDir = sortBy === key
            ? (sortDir === 'asc' ? 'desc' : 'asc')
            : (['postMean', 'absGamma', 'membershipScore', 'concordance'].includes(key) ? 'desc' : 'asc');
        onSort?.(key, nextDir);
    }, [onSort, sortBy, sortDir]);

    const handleDownload = React.useCallback(() => {
        const csv = buildGeneTraitCsv(rows);
        const label = gene?.geneSymbol || gene?.ensgId || 'gene';
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}-gene-program-trait-page.csv`);
    }, [gene, rows]);

    const safeTotalCount = Number(totalCount) || rows.length;

    if (!rows.length && !safeTotalCount) return null;

    const currentPage = page;
    const start = currentPage * rowsPerPage;
    const visibleRecords = rows;

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight: 620, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1052 })}>
                    <colgroup>
                        {GENE_TRAIT_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <EmbeddedTableTitleRow
                            title="Gene - Program - Trait evidence"
                            caption={`Showing ${safeTotalCount ? (start + 1).toLocaleString() : 0}-${Math.min(start + rows.length, safeTotalCount).toLocaleString()} of ${safeTotalCount.toLocaleString()} rows`}
                            colSpan={GENE_TRAIT_COLUMNS.length}
                            onDownload={handleDownload}
                        />
                        <TableRow>
                            {GENE_TRAIT_GROUPS.map((group) => {
                                const palette = TONES[group.tone];
                                return (
                                    <TableCell
                                        key={group.label}
                                        colSpan={group.span}
                                        sx={embeddedGroupHeaderSx(theme, palette)}
                                    >
                                        {group.label}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
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
                                            sx={geneSortLabelSx}
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
                                <TableCell sx={geneBodyCellSx({ align: 'left', tone: TONES.trait, whiteSpace: 'normal' })}>
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
                                            color: theme.palette.text.primary,
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
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.trait, fontFamily: 'monospace', fontWeight: 500 })}>
                                    <Button
                                        component={RouterLink}
                                        to={`/programs/${encodeURIComponent(row.program)}`}
                                        sx={{
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.72rem',
                                            px: 0,
                                            py: 0,
                                            color: '#1976D2',
                                            justifyContent: 'center',
                                            minHeight: 0,
                                            '&:hover': { color: '#0D47A1', textDecoration: 'underline' },
                                        }}
                                    >
                                        {row.program}
                                    </Button>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'left', tone: TONES.trait, whiteSpace: 'normal' })}>
                                    <Typography
                                        sx={{
                                            fontSize: '0.67rem',
                                            color: theme.palette.text.secondary,
                                            lineHeight: 1.2,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {row.programAnnotation || '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.mapping })}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                        <Chip label={row.role} size="small" sx={{
                                            ...summaryChipSx(theme, roleTone(theme, row.role)),
                                            height: 20,
                                            fontSize: '0.62rem',
                                        }} />
                                    </Box>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.mapping, whiteSpace: 'normal' })}>
                                    <Typography sx={{ fontSize: '0.69rem', fontWeight: 700, textAlign: 'center' }}>
                                        {getRecordDirection(row)}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.metric, fontFamily: 'monospace' })}>{formatSigned(row.postMean, 4)}</TableCell>
                                <TableCell sx={{ ...geneBodyCellSx({ align: 'center', tone: TONES.metric, fontFamily: 'monospace', fontWeight: 600 }), bgcolor: TONES.metric.cellStrong }}>{formatNumber(row.absGamma, 4)}</TableCell>
                                <TableCell sx={geneBodyCellSx({ align: 'center', tone: TONES.metric, fontFamily: 'monospace' })}>{formatNumber(row.membershipScore, 4)}</TableCell>
                                <TableCell sx={{ ...geneBodyCellSx({ align: 'center', tone: TONES.metric }), bgcolor: TONES.metric.cellStrong }}>
                                    <Stack direction="row" spacing={0.4} justifyContent="center" sx={{ flexWrap: 'wrap' }}>
                                        {row.isConcordant && <Chip label="concordant" size="small" sx={{ ...summaryChipSx(theme, metricChipTone(theme, 'success')), height: 20, fontSize: '0.6rem' }} />}
                                        {row.isDiscordant && <Chip label="discordant" size="small" sx={{ ...summaryChipSx(theme, metricChipTone(theme, 'warning')), height: 20, fontSize: '0.6rem' }} />}
                                        {!row.isConcordant && !row.isDiscordant && <Chip label="—" size="small" sx={{ ...summaryChipSx(theme, metricChipTone(theme, 'subtle')), height: 20, fontSize: '0.6rem' }} />}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={safeTotalCount}
                page={currentPage}
                onPageChange={(event, nextPage) => onPageChange?.(nextPage)}
                rowsPerPage={rowsPerPage}
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
        </Paper>
    );
}

export default function Genes() {
    const [params, setParams] = useSearchParams();
    const queryParam = params.get('query') || '';
    const [input, setInput] = React.useState(queryParam);
    const [traitPage, setTraitPage] = React.useState(0);
    const [traitRowsPerPage, setTraitRowsPerPage] = React.useState(50);
    const [traitSortBy, setTraitSortBy] = React.useState('absGamma');
    const [traitSortDir, setTraitSortDir] = React.useState('desc');
    const query = queryParam.trim();

    React.useEffect(() => {
        setInput(queryParam);
    }, [queryParam]);

    React.useEffect(() => {
        setTraitPage(0);
        setTraitSortBy('absGamma');
        setTraitSortDir('desc');
    }, [query]);

    const { data: suggestions, isLoading: suggestionsLoading } = useSWR(
        !query && input.trim().length >= 2 ? ['gene-search', input.trim()] : null,
        ([, q]) => searchGenes(q, { limit: 12 }),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    const { data: recommended } = useSWR(
        !query ? ['recommended-genes'] : null,
        () => getRecommendedGenes({ limit: 12 }),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    const { data: details, isLoading: detailLoading, error } = useSWR(
        query ? ['gene-programs', query, traitPage, traitRowsPerPage, traitSortBy, traitSortDir] : null,
        ([, q, pageIndex, limit, sortKey, direction]) => getGenePrograms(q, {
            page: pageIndex + 1,
            limit,
            sortBy: sortKey,
            order: direction,
        }),
        { keepPreviousData: false, revalidateOnFocus: false },
    );

    const runSearch = React.useCallback((value = input) => {
        const next = value.trim();
        setTraitPage(0);
        setTraitSortBy('absGamma');
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

    const records = details?.records || [];
    const programRows = details?.programs || [];
    const summary = details?.summary || {};
    const recordPage = details?.recordPage || {};
    const totalRecordCount = Number(recordPage.totalCount ?? summary.totalRows) || 0;

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
            maxWidth={1500}
            compact
            sx={{ py: { xs: 1.5, md: 2 } }}
        >
            <Stack spacing={query ? 1.5 : 2}>
                {details?.unavailable && (
                    <Alert severity="warning" sx={{ borderRadius: 1 }}>
                        Gene SQL index is not available yet. Run the schema migration and import script before using this page.
                    </Alert>
                )}

                {query && detailLoading && (
                    <StatePanel loading title="Loading gene evidence" message={`Searching ${query}`} minHeight={300} />
                )}

                {query && error && (
                    <StatePanel severity="error" title="Failed to load gene evidence" message={error.message || 'The gene lookup request failed.'} />
                )}

                {query && !detailLoading && !error && !details?.unavailable && totalRecordCount === 0 && (
                    <>
                        <GeneDetailHeader
                            gene={details?.gene || { geneSymbol: query }}
                            query={query}
                            summary={summary}
                            onSelect={(gene) => runSearch(gene)}
                        />
                        <GeneInfoTable gene={details?.gene || { geneSymbol: query }} summary={summary} />
                        <StatePanel
                            icon={TableChartOutlined}
                            title="No linked records"
                            message="This gene was not found in the imported gene-program-trait index. Click the gene name above to search another symbol or ENSG identifier."
                            minHeight={300}
                        />
                    </>
                )}

                {query && !detailLoading && totalRecordCount > 0 && (
                    <>
                        <GeneDetailHeader
                            gene={details?.gene}
                            query={query}
                            summary={summary}
                            onSelect={(gene) => runSearch(gene)}
                        />
                        <GeneInfoTable gene={details?.gene} summary={summary} />
                        <GeneProgramTable gene={details?.gene} records={records} programRows={programRows} />
                        <GeneProgramTraitTable
                            gene={details?.gene}
                            records={records}
                            page={traitPage}
                            rowsPerPage={traitRowsPerPage}
                            totalCount={totalRecordCount}
                            sortBy={traitSortBy}
                            sortDir={traitSortDir}
                            onPageChange={setTraitPage}
                            onRowsPerPageChange={handleTraitRowsPerPageChange}
                            onSort={handleTraitSort}
                        />
                    </>
                )}

                {!query && (
                    <>
                        <GeneHomeTable
                            input={input}
                            setInput={setInput}
                            suggestions={suggestions}
                            suggestionsLoading={suggestionsLoading}
                            onSearch={(gene) => runSearch(gene)}
                            onClear={clearSearch}
                            onSelect={(gene) => runSearch(gene)}
                        />
                        <GeneDiscoveryPanel recommended={recommended} onSelect={(gene) => runSearch(gene)} />
                    </>
                )}
            </Stack>
        </PageFrame>
    );
}
