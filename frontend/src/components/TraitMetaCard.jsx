import { Box, Card, CardContent, Chip, Divider, Link, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    OpenInNew,
    PersonOutline,
    ArticleOutlined,
    LanguageOutlined,
    SellOutlined,
    GroupOutlined,
    PolylineOutlined,
    VerifiedOutlined,
    ScatterPlotOutlined,
    AccountTreeOutlined,
    ShowChartOutlined,
    CategoryOutlined,
    FingerprintOutlined,
    EqualizerOutlined,
    TimelineOutlined,
    DescriptionOutlined,
} from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { panelSx } from '../themeUtils';

const EMPTY_VALUE = '--';

function MetaSkeleton() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 0.5 }}>
            <Skeleton variant="text" width="58%" height={34} />
            <Skeleton variant="text" width="34%" height={20} />
            <Skeleton variant="rounded" width={200} height={28} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1 }}>
                {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} variant="rounded" height={56} />
                ))}
            </Box>
        </Box>
    );
}

function SummaryStat({ label, value, theme }) {
    return (
        <Box
            sx={{
                minWidth: 0,
                px: 1.2,
                py: 1.05,
                borderRadius: 1.5,
                border: `1px solid ${theme.custom.border.soft}`,
                backgroundColor: alpha(theme.palette.primary.main, 0.035),
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    display: 'block',
                    mb: 0.25,
                    color: '#245089',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'none',
                }}
            >
                {label}
            </Typography>
            <Typography
                sx={{
                    color: theme.palette.text.primary,
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    overflowWrap: 'anywhere',
                }}
            >
                {value}
            </Typography>
        </Box>
    );
}

function Field({ icon: Icon, label, value, mono, href, theme, tone }) {
    const content = href ? (
        <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
                fontSize: '0.86rem',
                fontWeight: 600,
                color: theme.palette.text.primary,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.35,
                textDecorationColor: tone.border,
            }}
        >
            {value}
            <OpenInNew sx={{ fontSize: 13 }} />
        </Link>
    ) : (
        <Typography
            variant="body2"
            sx={{
                fontSize: '0.86rem',
                fontWeight: 600,
                color: theme.palette.text.primary,
                fontFamily: mono ? '"SF Mono", "Cascadia Code", monospace' : undefined,
                overflowWrap: 'anywhere',
            }}
        >
            {value}
        </Typography>
    );

    return (
        <Box
            sx={{
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: '30px minmax(0, 1fr)',
                gap: 0.85,
                alignItems: 'start',
            }}
        >
            <Box
                sx={{
                    width: 30,
                    height: 30,
                    borderRadius: 1.3,
                    border: `1px solid ${tone.border}`,
                    backgroundColor: tone.bg,
                    color: tone.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {Icon && <Icon sx={{ fontSize: 16 }} />}
            </Box>

            <Box sx={{ minWidth: 0 }}>
                <Typography
                    variant="caption"
                    sx={{
                        display: 'block',
                        mb: 0.22,
                        color: theme.palette.text.secondary,
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'none',
                    }}
                >
                    {label}
                </Typography>
                {content}
            </Box>
        </Box>
    );
}

function InfoSection({ title, children, theme, tone, columns, fullWidth = false }) {
    return (
        <Box
            sx={{
                minWidth: 0,
                p: 1.45,
                borderRadius: 2,
                border: `1px solid ${theme.custom.border.soft}`,
                backgroundColor: alpha(theme.palette.background.paper, 0.96),
                gridColumn: fullWidth ? { xl: '1 / -1' } : undefined,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.1 }}>
                <Box
                    sx={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: tone.color,
                        boxShadow: `0 0 0 4px ${tone.bg}`,
                        flexShrink: 0,
                    }}
                />
                <Typography
                    variant="caption"
                    sx={{
                        color: tone.color,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'none',
                    }}
                >
                    {title}
                </Typography>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: columns || { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.15,
                }}
            >
                {children}
            </Box>
        </Box>
    );
}

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
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits) : String(value);
}

function formatAvailability(value) {
    return value ? 'Available' : 'Not available';
}

export default function TraitMetaCard({ fileId, scatterListData, graphListData }) {
    const theme = useTheme();
    const { data } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const info = (data && !data.error) ? data : null;
    const idCandidates = [fileId, info?.file_id, info?.gwas_id].filter(Boolean);
    const hasProgramScatter = Array.isArray(scatterListData?.files)
        && idCandidates.some((id) => scatterListData.files.includes(id));
    const hasProgramGraph = Array.isArray(graphListData?.files)
        && idCandidates.some((id) => graphListData.files.includes(id));
    const hasHeritability = Boolean(
        info?.heritability_source_file
        || info?.enrichment != null
        || info?.coefficient_z_score != null
    );

    const tones = {
        study: {
            color: '#245089',
            bg: '#eaf2ff',
            border: '#bfd6fb',
        },
        gwas: {
            color: '#2f6a49',
            bg: '#edf8f1',
            border: '#c5e6d0',
        },
        analysis: {
            color: '#8a5b12',
            bg: '#fff2dd',
            border: '#edd1a4',
        },
    };

    if (!info) {
        return (
            <Card elevation={0} sx={{ ...panelSx(theme, { borderRadius: 3 }), mb: 3, overflow: 'hidden' }}>
                <Box sx={{ height: 2, backgroundColor: alpha(theme.palette.primary.main, 0.2) }} />
                <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                    <MetaSkeleton />
                </CardContent>
            </Card>
        );
    }

    const traitName = (info.trait_name || fileId).replace(/^["'\s]+|["'\s]+$/g, '');
    const fileIdentifier = info.file_id || fileId || EMPTY_VALUE;
    const studyTag = info.lof_id || EMPTY_VALUE;
    const stats = [
        { label: 'Year', value: info.year || EMPTY_VALUE },
        { label: 'Population', value: info.population || EMPTY_VALUE },
        { label: 'Sample size', value: formatCount(info.sample_size) },
        { label: 'Significant loci', value: formatCount(info.n_sig) },
    ];

    return (
        <Card elevation={0} sx={{ ...panelSx(theme, { borderRadius: 3 }), mb: 3, overflow: 'hidden' }}>
            <Box sx={{ height: 2, backgroundColor: alpha(theme.palette.primary.main, 0.2) }} />

            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', md: 'center' },
                        justifyContent: 'space-between',
                        gap: 1.25,
                        flexWrap: 'wrap',
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 700,
                                color: theme.palette.text.primary,
                                lineHeight: 1.15,
                                fontSize: { xs: '1.38rem', md: '1.55rem' },
                            }}
                        >
                            {traitName}
                        </Typography>
                        {info.mesh_term && (
                            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.4 }}>
                                {info.mesh_term}{info.mesh_id ? ` (${info.mesh_id})` : ''}
                            </Typography>
                        )}
                    </Box>

                    <Chip
                        label={`LoF ID: ${fileIdentifier}`}
                        size="small"
                        sx={{
                            height: 28,
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            '& .MuiChip-label': {
                                px: 1.05,
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                color: '#245089',
                                fontFamily: '"SF Mono", "Cascadia Code", monospace',
                            },
                        }}
                    />
                </Box>

                <Box
                    sx={{
                        mt: 1.65,
                        display: 'grid',
                        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                        gap: 1,
                    }}
                >
                    {stats.map((item) => (
                        <SummaryStat key={item.label} label={item.label} value={item.value} theme={theme} />
                    ))}
                </Box>

                <Divider sx={{ my: 1.9 }} />

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1.25,
                    }}
                >
                    <InfoSection title="Study details" theme={theme} tone={tones.study}>
                        <Field
                            icon={PersonOutline}
                            label="Author"
                            value={info.first_author ? `${info.first_author}${info.year ? ` (${info.year})` : ''}` : EMPTY_VALUE}
                            theme={theme}
                            tone={tones.study}
                        />
                        <Field
                            icon={ArticleOutlined}
                            label="PubMed"
                            value={info.pmid || EMPTY_VALUE}
                            href={info.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${info.pmid}` : undefined}
                            theme={theme}
                            tone={tones.study}
                        />
                        <Field
                            icon={LanguageOutlined}
                            label="Source link"
                            value={info.url ? 'Open source' : EMPTY_VALUE}
                            href={info.url || undefined}
                            theme={theme}
                            tone={tones.study}
                        />
                        <Field
                            icon={SellOutlined}
                            label="Study tag"
                            value={studyTag}
                            mono
                            theme={theme}
                            tone={tones.study}
                        />
                    </InfoSection>

                    <InfoSection
                        title="GWAS summary"
                        theme={theme}
                        tone={tones.gwas}
                        columns={{ xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }}
                    >
                        <Field
                            icon={GroupOutlined}
                            label="Case / control"
                            value={formatCases(info)}
                            theme={theme}
                            tone={tones.gwas}
                        />
                        <Field
                            icon={PolylineOutlined}
                            label="Variants"
                            value={formatCount(info.n_variants)}
                            theme={theme}
                            tone={tones.gwas}
                        />
                        <Field
                            icon={VerifiedOutlined}
                            label="QC score"
                            value={formatCount(info.qc_score)}
                            theme={theme}
                            tone={tones.gwas}
                        />
                    </InfoSection>

                    <InfoSection
                        title="Analysis and annotation"
                        theme={theme}
                        tone={tones.analysis}
                        fullWidth
                        columns={{ xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }}
                    >
                        <Field
                            icon={ScatterPlotOutlined}
                            label="Program scatter"
                            value={formatAvailability(hasProgramScatter)}
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={AccountTreeOutlined}
                            label="Trait graph"
                            value={formatAvailability(hasProgramGraph)}
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={ShowChartOutlined}
                            label="LDSC heritability"
                            value={formatAvailability(hasHeritability)}
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={CategoryOutlined}
                            label="MeSH term"
                            value={info.mesh_term || EMPTY_VALUE}
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={FingerprintOutlined}
                            label="MeSH ID"
                            value={info.mesh_id || EMPTY_VALUE}
                            mono
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={EqualizerOutlined}
                            label="LDSC enrichment"
                            value={formatMetric(info.enrichment)}
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={TimelineOutlined}
                            label="Coefficient z-score"
                            value={formatMetric(info.coefficient_z_score)}
                            theme={theme}
                            tone={tones.analysis}
                        />
                        <Field
                            icon={DescriptionOutlined}
                            label="Source file"
                            value={info.heritability_source_file || EMPTY_VALUE}
                            mono
                            theme={theme}
                            tone={tones.analysis}
                        />
                    </InfoSection>
                </Box>
            </CardContent>
        </Card>
    );
}
