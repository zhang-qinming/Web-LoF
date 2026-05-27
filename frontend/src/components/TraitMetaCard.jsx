import { Box, Card, CardContent, Chip, Link, Skeleton, Divider, Avatar, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    OpenInNew, Person, Article, People,
    Public, Numbers, Dns, Link as LinkIcon,
    BarChart,
} from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import { panelSx, summaryChipSx } from '../themeUtils';

function MetaSkeleton() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
            <Skeleton variant="text" width="60%" height={36} />
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[100, 140, 90, 120, 80].map((w, i) => (
                    <Box key={i}>
                        <Skeleton variant="text" width={50} height={14} />
                        <Skeleton variant="text" width={w} height={22} />
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

function Field({ icon: Icon, label, value, mono, href, theme }) {
    const content = href ? (
        <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ fontSize: '0.88rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}
        >
            {value} <OpenInNew sx={{ fontSize: 13 }} />
        </Link>
    ) : (
        <Typography
            variant="body2"
            sx={{
                fontSize: '0.88rem',
                fontWeight: 500,
                color: theme.palette.text.primary,
                fontFamily: mono ? '"SF Mono", "Cascadia Code", monospace' : undefined,
            }}
        >
            {value}
        </Typography>
    );

    return (
        <Box sx={{ minWidth: 120 }}>
            <Typography
                variant="caption"
                sx={{
                    color: theme.palette.text.secondary,
                    fontSize: '0.7rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    mb: 0.3,
                    display: 'block',
                }}
            >
                {label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                {Icon && <Icon sx={{ fontSize: 16, color: '#94a3b8' }} />}
                {content}
            </Box>
        </Box>
    );
}

export default function TraitMetaCard({ fileId, listData }) {
    const theme = useTheme();
    const { data } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const info = (data && !data.error) ? data : null;
    const idCandidates = [fileId, info?.file_id, info?.gwas_id].filter(Boolean);
    const hasProgram = Array.isArray(listData?.files) && idCandidates.some((id) => listData.files.includes(id));

    return (
        <Card elevation={0} sx={{ ...panelSx(theme, { borderRadius: 3 }), mb: 3, overflow: 'hidden' }}>
            <Box sx={{ height: 4, background: 'linear-gradient(90deg, #2563eb, #0f766e, #d97706)' }} />

            <CardContent sx={{ p: 3 }}>
                {!info ? <MetaSkeleton /> : (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                            <Avatar
                                sx={{
                                    bgcolor: 'rgba(37, 99, 235, 0.1)',
                                    color: theme.palette.primary.main,
                                    width: 44,
                                    height: 44,
                                    fontSize: 20,
                                    fontWeight: 700,
                                }}
                            >
                                {(info.trait_name || '?').replace(/^["'\s]+|["'\s]+$/g, '').charAt(0)}
                            </Avatar>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.3 }}>
                                    {(info.trait_name || fileId).replace(/^["'\s]+|["'\s]+$/g, '')}
                                </Typography>
                                {info.mesh_term && (
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.3 }}>
                                        {info.mesh_term} {info.mesh_id && `(${info.mesh_id})`}
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                            <Chip icon={<Dns />} label={info.file_id} size="small" sx={summaryChipSx(theme, { fontFamily: 'monospace' })} />
                            {info.gwas_id && info.gwas_id !== info.file_id && (
                                <Tooltip title="GWAS Catalog ID">
                                    <Chip label={info.gwas_id} size="small" variant="outlined" sx={summaryChipSx(theme, { fontFamily: 'monospace' })} />
                                </Tooltip>
                            )}
                            {info.gwas_source_batch && (
                                <Chip
                                    label={info.gwas_source_batch}
                                    size="small"
                                    sx={summaryChipSx(theme, { color: '#4338ca', backgroundColor: 'rgba(79, 70, 229, 0.08)' })}
                                />
                            )}
                            {info.qc_score && (
                                <Chip
                                    label={`QC ${info.qc_score}`}
                                    size="small"
                                    sx={summaryChipSx(theme, {
                                        backgroundColor: info.qc_score >= 100 ? 'rgba(21, 128, 61, 0.1)' : 'rgba(180, 83, 9, 0.1)',
                                        color: info.qc_score >= 100 ? '#166534' : '#92400e',
                                    })}
                                />
                            )}
                            {hasProgram && (
                                <Chip icon={<BarChart sx={{ fontSize: 14 }} />} label="Program data" size="small" color="success" variant="filled" />
                            )}
                        </Box>

                        <Divider sx={{ my: 2.5 }} />

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 2.5, columnGap: 5 }}>
                            {info.first_author && (
                                <Field icon={Person} label="GWAS Author" value={`${info.first_author}${info.year ? ` (${info.year})` : ''}`} theme={theme} />
                            )}
                            {info.pmid && (
                                <Field icon={Article} label="PubMed" value={info.pmid} href={`https://pubmed.ncbi.nlm.nih.gov/${info.pmid}`} theme={theme} />
                            )}
                            {(info.sample_size || info.n_case != null) && (
                                <Field
                                    icon={People}
                                    label="Sample"
                                    value={[
                                        info.sample_size && Number(info.sample_size).toLocaleString(),
                                        info.n_case != null && `${Number(info.n_case).toLocaleString()} cases / ${Number(info.n_control).toLocaleString()} controls`,
                                    ].filter(Boolean).join('  ·  ')}
                                    theme={theme}
                                />
                            )}
                            {info.population && (
                                <Field icon={Public} label="Population" value={info.population} theme={theme} />
                            )}
                            {info.n_variants && (
                                <Field icon={Numbers} label="Variants" value={Number(info.n_variants).toLocaleString()} theme={theme} />
                            )}
                            {info.url && (
                                <Field icon={LinkIcon} label="Source" value="Open" href={info.url} theme={theme} />
                            )}
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
