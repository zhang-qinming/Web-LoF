import { Box, Button, Divider, Link, Paper, Skeleton, Stack, Typography } from '@mui/material';
import {
    ArticleOutlined,
    CategoryOutlined,
    DownloadOutlined,
    FingerprintOutlined,
    GroupOutlined,
    OpenInNew,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { downloadBlob } from '../utils/download';
import { panelSx } from '../themeUtils';

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

function MetaSkeleton({ theme }) {
    return (
        <Paper elevation={0} sx={panelSx(theme, { mb: 3, overflow: 'hidden' })}>
            <Box sx={{ px: { xs: 2, md: 2.8 }, py: 2.2, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                <Skeleton width={110} height={18} />
                <Skeleton width="58%" height={36} />
                <Skeleton width={280} height={18} />
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) minmax(300px, 0.82fr)' },
                }}
            >
                <Box sx={{ p: { xs: 2, md: 2.5 } }}>
                    {Array.from({ length: 9 }, (_, index) => (
                        <Box key={index} sx={{ py: 1.15, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                            <Skeleton width={index % 3 === 0 ? '28%' : '20%'} height={15} />
                            <Skeleton width={index % 2 === 0 ? '55%' : '40%'} height={22} />
                        </Box>
                    ))}
                </Box>
                <Box sx={{ p: { xs: 2, md: 2.5 }, bgcolor: '#f7f3ea' }}>
                    {Array.from({ length: 5 }, (_, index) => (
                        <Box key={index} sx={{ py: 1.2, borderBottom: '1px solid rgba(138, 91, 18, 0.14)' }}>
                            <Skeleton width="32%" height={15} />
                            <Skeleton width={index < 3 ? '82%' : '48%'} height={22} />
                        </Box>
                    ))}
                </Box>
            </Box>
        </Paper>
    );
}

function Value({ row, color, linkColor }) {
    const valueSx = {
        color,
        fontSize: row.emphasis ? { xs: '1rem', md: '1.06rem' } : '0.86rem',
        fontWeight: row.emphasis ? 740 : row.strong ? 690 : 570,
        lineHeight: 1.42,
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

function MetadataGrid({ rows, theme, columns = 2, compact = false }) {
    return (
        <Box
            component="dl"
            sx={{
                m: 0,
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: columns > 1 ? `repeat(${Math.min(columns, 2)}, minmax(0, 1fr))` : '1fr',
                    md: columns > 2 ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
                },
                columnGap: { sm: 2.4 },
            }}
        >
            {rows.map((row, index) => (
                <Box
                    key={row.label}
                    sx={{
                        minWidth: 0,
                        py: compact ? 1.05 : 1.15,
                        borderBottom: index < rows.length - 1 ? `1px solid ${theme.custom.border.soft}` : 'none',
                    }}
                >
                    <Typography
                        component="dt"
                        sx={{
                            mb: 0.22,
                            color: theme.palette.text.secondary,
                            fontSize: '0.65rem',
                            fontWeight: 720,
                            letterSpacing: '0.055em',
                            lineHeight: 1.25,
                            textTransform: 'uppercase',
                        }}
                    >
                        {row.label}
                    </Typography>
                    <Box component="dd" sx={{ m: 0 }}>
                        <Value row={row} color={theme.palette.text.primary} linkColor="#1d5fa7" />
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

function SectionHeading({ icon, kicker, title, theme }) {
    return (
        <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 0.6 }}>
            <Box
                sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#1d5fa7',
                    bgcolor: '#edf5fd',
                    border: '1px solid #d5e7f8',
                    flexShrink: 0,
                }}
            >
                {icon}
            </Box>
            <Box>
                <Typography
                    sx={{
                        color: '#6b7b8e',
                        fontSize: '0.62rem',
                        fontWeight: 760,
                        letterSpacing: '0.09em',
                        lineHeight: 1.2,
                        textTransform: 'uppercase',
                    }}
                >
                    {kicker}
                </Typography>
                <Typography sx={{ color: theme.palette.text.primary, fontSize: '0.94rem', fontWeight: 730, lineHeight: 1.25 }}>
                    {title}
                </Typography>
            </Box>
        </Stack>
    );
}

function LofRow({ row, index, total }) {
    return (
        <Box
            component="div"
            sx={{
                py: 1.25,
                borderBottom: index < total - 1 ? '1px solid rgba(138, 91, 18, 0.15)' : 'none',
            }}
        >
            <Typography
                component="dt"
                sx={{
                    mb: 0.24,
                    color: '#8a6a38',
                    fontSize: '0.63rem',
                    fontWeight: 760,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                }}
            >
                {row.label}
            </Typography>
            <Box component="dd" sx={{ m: 0 }}>
                <Value row={row} color="#2f2b24" linkColor="#7b5418" />
            </Box>
        </Box>
    );
}

export default function TraitMetaCard({ fileId }) {
    const theme = useTheme();
    const { data } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const info = (data && !data.error) ? data : null;

    if (!info) return <MetaSkeleton theme={theme} />;

    const traitName = (info.trait_name || fileId).replace(/^["'\s]+|["'\s]+$/g, '');
    const fileIdentifier = info.file_id || fileId || EMPTY_VALUE;
    const meshLabel = info.mesh_term
        ? `${info.mesh_term}${info.mesh_id ? ` / ${info.mesh_id}` : ''}`
        : 'No MeSH classification';

    const studyRows = [
        { label: 'GWAS ID', value: info.gwas_id || EMPTY_VALUE, mono: true, strong: true },
        { label: 'Author', value: info.first_author ? `${info.first_author}${info.year ? ` (${info.year})` : ''}` : EMPTY_VALUE },
        {
            label: 'PubMed',
            value: info.pmid || EMPTY_VALUE,
            href: info.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${info.pmid}` : '',
            mono: true,
        },
        {
            label: 'Source',
            value: info.url ? 'Open source study' : EMPTY_VALUE,
            href: info.url || '',
        },
    ];

    const cohortRows = [
        { label: 'Population', value: info.population || EMPTY_VALUE, strong: true },
        { label: 'Sample size', value: formatCount(info.sample_size), mono: true, emphasis: true },
        { label: 'Case / control', value: formatCases(info), mono: true },
        { label: 'Variants', value: formatCount(info.n_variants), mono: true, emphasis: true },
        { label: 'Significant loci', value: formatCount(info.n_sig), mono: true, emphasis: true },
        { label: 'QC score', value: formatCount(info.qc_score), mono: true },
    ];

    const classificationRows = [
        { label: 'MeSH term', value: info.mesh_term || EMPTY_VALUE, strong: true },
        { label: 'MeSH ID', value: info.mesh_id || EMPTY_VALUE, mono: true },
        { label: 'Study year', value: info.year || EMPTY_VALUE, mono: true },
    ];

    const lofRows = [
        { label: 'File ID', value: fileIdentifier, mono: true, strong: true },
        { label: 'LoF ID', value: info.lof_id || EMPTY_VALUE, mono: true, strong: true },
        { label: 'LDSC source file', value: info.heritability_source_file || EMPTY_VALUE, mono: true },
        { label: 'LDSC enrichment', value: formatMetric(info.enrichment), mono: true, emphasis: true },
        { label: 'Coefficient Z-score', value: formatMetric(info.coefficient_z_score), mono: true, emphasis: true },
    ];

    const csvRows = [
        { label: 'Trait Name', value: traitName },
        ...studyRows,
        ...cohortRows,
        ...classificationRows,
        ...lofRows,
    ];

    const handleDownload = () => {
        downloadBlob(
            new Blob([buildTraitInfoCsv(csvRows)], { type: 'text/csv;charset=utf-8;' }),
            `${fileIdentifier}-trait-information.csv`,
        );
    };

    return (
        <Paper
            elevation={0}
            sx={{
                ...panelSx(theme, {
                    mb: 3,
                    overflow: 'hidden',
                    bgcolor: theme.palette.background.paper,
                    borderColor: alpha('#245089', 0.17),
                    boxShadow: '0 18px 44px rgba(31, 55, 85, 0.08)',
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
                    position: 'relative',
                    overflow: 'hidden',
                    px: { xs: 2, md: 2.8 },
                    py: { xs: 2, md: 2.35 },
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    background: `
                        radial-gradient(circle at 88% 20%, rgba(56, 139, 185, 0.12), transparent 25%),
                        linear-gradient(115deg, #f8fbff 0%, #ffffff 56%, #f4f8fb 100%)
                    `,
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: '0 auto 0 0',
                        width: 5,
                        background: 'linear-gradient(180deg, #245089 0%, #3b91a8 100%)',
                    },
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: -56,
                        right: 52,
                        width: 150,
                        height: 150,
                        border: '1px solid rgba(36, 80, 137, 0.08)',
                        borderRadius: '50%',
                        boxShadow: '0 0 0 24px rgba(36, 80, 137, 0.025), 0 0 0 52px rgba(36, 80, 137, 0.018)',
                        pointerEvents: 'none',
                    },
                }}
            >
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1.5}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                    sx={{ position: 'relative', zIndex: 1 }}
                >
                    <Box sx={{ minWidth: 0, maxWidth: 920 }}>
                        <Typography
                            sx={{
                                mb: 0.42,
                                color: '#2d6880',
                                fontSize: '0.66rem',
                                fontWeight: 780,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                            }}
                        >
                            Trait record
                        </Typography>
                        <Typography
                            component="h1"
                            sx={{
                                color: '#142235',
                                fontSize: { xs: '1.3rem', md: '1.52rem' },
                                fontWeight: 760,
                                letterSpacing: '-0.018em',
                                lineHeight: 1.18,
                            }}
                        >
                            {traitName}
                        </Typography>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={{ xs: 0.25, sm: 1.2 }}
                            divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
                            sx={{ mt: 0.75 }}
                        >
                            <Typography sx={{ color: '#607084', fontSize: '0.76rem', fontWeight: 570 }}>
                                {meshLabel}
                            </Typography>
                            <Typography
                                sx={{
                                    color: '#607084',
                                    fontSize: '0.76rem',
                                    fontWeight: 620,
                                    fontVariantNumeric: 'tabular-nums',
                                }}
                            >
                                File {fileIdentifier}
                            </Typography>
                        </Stack>
                    </Box>

                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                        onClick={handleDownload}
                        sx={{
                            minWidth: 92,
                            borderColor: alpha('#245089', 0.2),
                            bgcolor: alpha('#ffffff', 0.72),
                            color: '#245089',
                            fontSize: '0.72rem',
                            fontWeight: 690,
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        Export CSV
                    </Button>
                </Stack>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        lg: 'minmax(0, 1.72fr) minmax(300px, 0.78fr)',
                    },
                    alignItems: 'stretch',
                }}
            >
                <Box sx={{ minWidth: 0, p: { xs: 2, md: 2.6 } }}>
                    <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.6 }}>
                        <Box>
                            <Typography sx={{ color: '#142235', fontSize: '1rem', fontWeight: 760, lineHeight: 1.25 }}>
                                GWAS metadata
                            </Typography>
                            <Typography sx={{ mt: 0.2, color: theme.palette.text.secondary, fontSize: '0.72rem' }}>
                                Study provenance, cohort composition, and clinical indexing
                            </Typography>
                        </Box>
                        <Typography
                            sx={{
                                display: { xs: 'none', sm: 'block' },
                                color: '#9aa6b4',
                                fontSize: '0.62rem',
                                fontWeight: 720,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            GWAS / {info.gwas_id || EMPTY_VALUE}
                        </Typography>
                    </Stack>

                    <SectionHeading
                        icon={<ArticleOutlined sx={{ fontSize: 17 }} />}
                        kicker="Study"
                        title="Publication and source"
                        theme={theme}
                    />
                    <MetadataGrid rows={studyRows} theme={theme} columns={2} />

                    <Divider sx={{ my: 1.7, borderColor: alpha('#245089', 0.13) }} />

                    <SectionHeading
                        icon={<GroupOutlined sx={{ fontSize: 17 }} />}
                        kicker="Cohort"
                        title="Population and association summary"
                        theme={theme}
                    />
                    <MetadataGrid rows={cohortRows} theme={theme} columns={3} compact />

                    <Divider sx={{ my: 1.7, borderColor: alpha('#245089', 0.13) }} />

                    <SectionHeading
                        icon={<CategoryOutlined sx={{ fontSize: 17 }} />}
                        kicker="Indexing"
                        title="Clinical classification"
                        theme={theme}
                    />
                    <MetadataGrid rows={classificationRows} theme={theme} columns={3} compact />
                </Box>

                <Box
                    component="aside"
                    sx={{
                        position: 'relative',
                        minWidth: 0,
                        p: { xs: 2, md: 2.5 },
                        borderTop: { xs: `1px solid ${theme.custom.border.soft}`, lg: 'none' },
                        borderLeft: { xs: 'none', lg: '1px solid rgba(138, 91, 18, 0.14)' },
                        background: 'linear-gradient(150deg, #fbf8f1 0%, #f5efe3 100%)',
                        overflow: 'hidden',
                        '&::after': {
                            content: '"LoF"',
                            position: 'absolute',
                            right: -7,
                            bottom: -28,
                            color: 'rgba(138, 91, 18, 0.045)',
                            fontSize: '6.8rem',
                            fontWeight: 800,
                            letterSpacing: '-0.08em',
                            lineHeight: 1,
                            pointerEvents: 'none',
                        },
                    }}
                >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Stack direction="row" spacing={1.05} alignItems="center">
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: '#fffaf0',
                                    color: '#8a5b12',
                                    border: '1px solid rgba(138, 91, 18, 0.18)',
                                }}
                            >
                                <FingerprintOutlined sx={{ fontSize: 18 }} />
                            </Box>
                            <Box>
                                <Typography
                                    sx={{
                                        color: '#8a6a38',
                                        fontSize: '0.62rem',
                                        fontWeight: 780,
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Loss of function
                                </Typography>
                                <Typography sx={{ color: '#322b21', fontSize: '1rem', fontWeight: 760, lineHeight: 1.25 }}>
                                    LoF metadata
                                </Typography>
                            </Box>
                        </Stack>
                        <Typography sx={{ mt: 1, mb: 1.1, color: '#766b5a', fontSize: '0.72rem', lineHeight: 1.55 }}>
                            Analysis identifiers and LDSC-derived annotations linked to this trait.
                        </Typography>

                        <Box component="dl" sx={{ m: 0 }}>
                            {lofRows.map((row, index) => (
                                <LofRow key={row.label} row={row} index={index} total={lofRows.length} />
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
}
