import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import Refresh from '@mui/icons-material/Refresh';
import { alpha, useTheme } from '@mui/material/styles';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { downloadBlob } from '../utils/download';
import { stableSWRConfig } from '../utils/swrOptions';
import { panelSx } from '../themeUtils';
import { StatePanel } from './PageScaffold';

const EMPTY_VALUE = '--';

function formatCount(value) {
    return value != null && value !== '' ? Number(value).toLocaleString() : EMPTY_VALUE;
}

function formatCases(info) {
    if (info.n_case == null && info.n_control == null) return EMPTY_VALUE;
    const cases = info.n_case != null ? `${Number(info.n_case).toLocaleString()} cases` : null;
    const controls = info.n_control != null ? `${Number(info.n_control).toLocaleString()} controls` : null;
    return [cases, controls].filter(Boolean).join(' / ');
}

function formatMetric(value, digits = 4) {
    if (value == null || value === '') return EMPTY_VALUE;
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : String(value);
}

function formatPValue(value) {
    if (value == null || value === '') return EMPTY_VALUE;
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number < 0.0001 ? number.toExponential(3) : number.toFixed(4);
}

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildTraitInfoCsv(rows) {
    return `${[
        ['Field', 'Value'].map(escapeCsvValue).join(','),
        ...rows.map((row) => [row.label, row.value].map(escapeCsvValue).join(',')),
    ].join('\n')}\n`;
}

function stripWrappingQuotes(value) {
    return String(value || '').replace(/^["'\s]+|["'\s]+$/g, '');
}

function isHttpUrl(value) {
    const text = String(value || '').trim();
    return /^https?:\/\//i.test(text);
}

function buildMeshUrl(meshId, meshTerm) {
    if (meshId) return `https://meshb.nlm.nih.gov/record/ui?ui=${encodeURIComponent(meshId)}`;
    if (meshTerm) return `https://meshb.nlm.nih.gov/search?searchInField=termDescriptor&sort=&size=20&searchType=exactMatch&searchMethod=FullWord&q=${encodeURIComponent(meshTerm)}`;
    return '';
}

function buildLdscSourceFile(info, fallbackId) {
    const id = String(info.heritability_trait_id || info.heritability_lof_id || info.file_id || fallbackId || '').trim();
    return id ? `${id}_k562_atac.results` : '';
}

function MetaSkeleton({ theme }) {
    return (
        <Paper elevation={0} sx={panelSx(theme, { mb: 3, overflow: 'hidden', p: { xs: 2, md: 3 } })}>
            <Skeleton width={240} height={42} sx={{ mb: 2.2 }} />
            {Array.from({ length: 3 }, (_, sectionIndex) => (
                <Box key={sectionIndex} sx={{ mb: sectionIndex === 2 ? 0 : 3 }}>
                    <Skeleton width={180} height={28} sx={{ mb: 1 }} />
                    {Array.from({ length: sectionIndex === 2 ? 2 : 3 }, (_, rowIndex) => (
                        <Box
                            key={rowIndex}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '180px minmax(0, 1fr) 180px minmax(0, 1fr)',
                                border: `1px solid ${theme.custom.border.soft}`,
                                borderTop: rowIndex === 0 ? `1px solid ${theme.custom.border.soft}` : 0,
                            }}
                        >
                            <Box sx={{ px: 1.5, py: 1.3, bgcolor: '#f5f5f5' }}>
                                <Skeleton width="62%" />
                            </Box>
                            <Box sx={{ px: 1.5, py: 1.3 }}>
                                <Skeleton width={rowIndex % 2 ? '48%' : '74%'} />
                            </Box>
                            <Box sx={{ px: 1.5, py: 1.3, bgcolor: '#f5f5f5' }}>
                                <Skeleton width="58%" />
                            </Box>
                            <Box sx={{ px: 1.5, py: 1.3 }}>
                                <Skeleton width={rowIndex % 2 ? '68%' : '52%'} />
                            </Box>
                        </Box>
                    ))}
                </Box>
            ))}
        </Paper>
    );
}

function Value({ row, color, linkColor }) {
    const valueSx = {
        color,
        fontSize: { xs: '0.96rem', md: row.emphasis ? '1.08rem' : '1rem' },
        fontWeight: row.emphasis ? 680 : row.strong ? 640 : 500,
        lineHeight: 1.45,
        overflowWrap: 'anywhere',
        fontVariantNumeric: row.mono ? 'tabular-nums' : undefined,
        fontFeatureSettings: row.mono ? '"tnum" 1' : undefined,
    };

    if (!row.href) {
        return <Typography sx={valueSx}>{row.value}</Typography>;
    }

    return (
        <Link
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{
                ...valueSx,
                color: linkColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                textDecorationThickness: '1px',
                textUnderlineOffset: '3px',
            }}
        >
            {row.value}
            <OpenInNew sx={{ fontSize: 13 }} />
        </Link>
    );
}

function TraitInfoTable({ title, rows, theme, action }) {
    const primary = title === 'Trait information';
    const rowPairs = [];
    for (let index = 0; index < rows.length; index += 2) {
        rowPairs.push([rows[index], rows[index + 1] || null]);
    }

    const labelCellSx = {
        px: { xs: 1.25, md: 1.5 },
        py: { xs: 1.2, md: 1.35 },
        bgcolor: '#f3f3f3',
        borderRight: `1px solid ${theme.custom.border.soft}`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        color: '#1f6fc9',
        fontSize: { xs: '0.88rem', md: '0.96rem' },
        fontWeight: 600,
        lineHeight: 1.35,
    };

    const valueCellSx = {
        px: { xs: 1.25, md: 1.5 },
        py: { xs: 1.2, md: 1.35 },
        borderRight: `1px solid ${theme.custom.border.soft}`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        bgcolor: '#ffffff',
    };

    return (
        <Box sx={{ mt: primary ? 0 : { xs: 2.5, md: 3 } }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.2}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 1.4 }}
            >
                <Typography
                    component={primary ? 'h1' : 'h2'}
                    sx={{
                        color: '#1f2933',
                        fontSize: primary ? { xs: '1.85rem', md: '2.25rem' } : { xs: '1.28rem', md: '1.5rem' },
                        fontWeight: 760,
                        lineHeight: 1.15,
                        letterSpacing: 0,
                    }}
                >
                    {title}
                </Typography>
                {action}
            </Stack>
            <TableContainer sx={{ border: `1px solid ${theme.custom.border.soft}`, borderRadius: 0, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 900, tableLayout: 'fixed' }}>
                    <colgroup>
                        <col style={{ width: 180 }} />
                        <col />
                        <col style={{ width: 180 }} />
                        <col />
                    </colgroup>
                    <TableBody>
                        {rowPairs.map(([leftRow, rightRow]) => (
                            <TableRow key={leftRow.label}>
                                <TableCell
                                    component="th"
                                    scope="row"
                                    sx={labelCellSx}
                                >
                                    {leftRow.label}
                                </TableCell>
                                <TableCell sx={valueCellSx}>
                                    <Value row={leftRow} color={theme.palette.text.primary} linkColor="#1f6fc9" />
                                </TableCell>
                                {rightRow ? (
                                    <>
                                        <TableCell component="th" scope="row" sx={labelCellSx}>
                                            {rightRow.label}
                                        </TableCell>
                                        <TableCell sx={{ ...valueCellSx, borderRight: 0 }}>
                                            <Value row={rightRow} color={theme.palette.text.primary} linkColor="#1f6fc9" />
                                        </TableCell>
                                    </>
                                ) : (
                                    <TableCell colSpan={2} sx={{ ...valueCellSx, borderRight: 0 }} />
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}

export default function TraitMetaCard({ fileId }) {
    const theme = useTheme();
    const { data, error, mutate } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher, stableSWRConfig);
    const info = (data && !data.error) ? data : null;

    if (error) {
        return (
            <Box sx={{ mb: 3 }}>
                <StatePanel
                    severity="error"
                    title="Failed to load trait metadata"
                    message={error?.response?.data?.error || error?.message || 'Trait metadata could not be loaded.'}
                    minHeight={220}
                >
                    <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={() => { void mutate(); }}
                    >
                        Retry
                    </Button>
                </StatePanel>
            </Box>
        );
    }

    if (!info) return <MetaSkeleton theme={theme} />;

    const traitName = stripWrappingQuotes(info.trait_name || fileId);
    const fileIdentifier = info.file_id || fileId || EMPTY_VALUE;
    const meshUrl = buildMeshUrl(info.mesh_id, info.mesh_term);
    const sourceUrl = String(info.url || '').trim();

    const traitRows = [
        { label: 'Trait ID', value: fileIdentifier, mono: true, strong: true },
        { label: 'Reported Trait', value: traitName, strong: true },
        {
            label: 'MeSH Term',
            value: info.mesh_term || EMPTY_VALUE,
            href: meshUrl,
            strong: true,
        },
        {
            label: 'MeSH ID',
            value: info.mesh_id || EMPTY_VALUE,
            href: info.mesh_id ? meshUrl : '',
            mono: true,
        },
        { label: 'Trait Type', value: info.mesh_term || EMPTY_VALUE },
        {
            label: 'More Information',
            value: info.mesh_term || info.mesh_id || EMPTY_VALUE,
            href: meshUrl,
        },
    ];

    const studyRows = [
        { label: 'Author', value: info.first_author || EMPTY_VALUE },
        { label: 'Study year', value: info.year || EMPTY_VALUE, mono: true },
        {
            label: 'PubMed',
            value: info.pmid || EMPTY_VALUE,
            href: info.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${info.pmid}` : '',
            mono: true,
        },
        {
            label: 'Source',
            value: sourceUrl || EMPTY_VALUE,
            href: isHttpUrl(sourceUrl) ? sourceUrl : '',
        },
        { label: 'Population', value: info.population || EMPTY_VALUE, strong: true },
        { label: 'Sample size', value: formatCount(info.sample_size), mono: true, emphasis: true },
        { label: 'Case / control', value: formatCases(info), mono: true },
        { label: 'Variants', value: formatCount(info.n_variants), mono: true, emphasis: true },
        { label: 'Significant loci', value: formatCount(info.n_sig), mono: true, emphasis: true },
        { label: 'QC score', value: formatCount(info.qc_score), mono: true },
    ];

    const hasLdscData = [
        info.heritability_source_file,
        info.heritability_source_row,
        info.heritability_gwas_id,
        info.heritability_trait_id,
        info.heritability_lof_id,
        info.enrichment,
        info.enrichment_p,
        info.coefficient_z_score,
    ].some((value) => value != null && value !== '');
    const ldscSourceFile = hasLdscData ? buildLdscSourceFile(info, fileIdentifier) : '';

    const burdenRows = [
        { label: 'Burden phenotype', value: info.burden_phenotype_id || EMPTY_VALUE, mono: true, strong: true },
    ];

    const ldscRows = [
        { label: 'LDSC file', value: ldscSourceFile || EMPTY_VALUE, mono: true },
        { label: 'LDSC row', value: hasLdscData ? (info.heritability_source_row || 'L2_0') : EMPTY_VALUE, mono: true, strong: true },
        { label: 'Enrichment', value: formatMetric(info.enrichment), mono: true, emphasis: true },
        { label: 'Enrichment p-value', value: formatPValue(info.enrichment_p), mono: true, emphasis: true },
        { label: 'Coefficient Z-score', value: formatMetric(info.coefficient_z_score), mono: true, emphasis: true },
    ];

    const csvRows = [
        ...traitRows,
        ...studyRows,
        ...burdenRows,
        ...ldscRows,
    ];

    const handleDownload = () => {
        downloadBlob(
            new Blob([buildTraitInfoCsv(csvRows)], { type: 'text/csv;charset=utf-8;' }),
            `${fileIdentifier}-trait-information.csv`,
        );
    };

    const exportButton = (
        <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
            onClick={handleDownload}
            sx={{
                minWidth: 92,
                borderColor: alpha('#1f6fc9', 0.24),
                bgcolor: '#ffffff',
                color: '#1f6fc9',
                fontSize: '0.76rem',
                fontWeight: 620,
                borderRadius: 1,
            }}
        >
            Export CSV
        </Button>
    );

    return (
        <Paper
            elevation={0}
            sx={{
                ...panelSx(theme, {
                    mb: 3,
                    overflow: 'hidden',
                    p: { xs: 2, md: 3 },
                    bgcolor: theme.palette.background.paper,
                    borderColor: theme.custom.border.soft,
                    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.045)',
                }),
                '@keyframes traitMetaReveal': {
                    from: { opacity: 0, transform: 'translateY(8px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                },
                animation: 'traitMetaReveal 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                    },
                    gap: { xs: 0 },
                    alignItems: 'start',
                    '& > *': {
                        minWidth: 0,
                    },
                    '@media (min-width: 2200px)': {
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 3,
                        '& > *': {
                            mt: '0 !important',
                        },
                    },
                }}
            >
                <TraitInfoTable title="Trait information" rows={traitRows} theme={theme} action={exportButton} />
                <TraitInfoTable title="Study information" rows={studyRows} theme={theme} />
                <TraitInfoTable title="Burden information" rows={burdenRows} theme={theme} />
                <TraitInfoTable title="LDSC information" rows={ldscRows} theme={theme} />
            </Box>
        </Paper>
    );
}
