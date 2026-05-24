import { Box, Card, CardContent, Chip, Link, Skeleton, Divider, Avatar, Tooltip, Typography } from '@mui/material';
import {
    OpenInNew, Person, Article, People,
    Public, Numbers, Dns, Link as LinkIcon,
    BarChart,
} from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';

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

function Field({ icon: Icon, label, value, mono, href }) {
    const content = href ? (
        <Link href={href} target="_blank" rel="noopener noreferrer"
            sx={{ fontSize: '0.88rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
            {value} <OpenInNew sx={{ fontSize: 13 }} />
        </Link>
    ) : (
        <Typography variant="body2" sx={{
            fontSize: '0.88rem', fontWeight: 500, color: '#222',
            fontFamily: mono ? '"SF Mono", "Cascadia Code", monospace' : undefined,
        }}>
            {value}
        </Typography>
    );

    return (
        <Box sx={{ minWidth: 120 }}>
            <Typography variant="caption" sx={{
                color: '#888', fontSize: '0.7rem', letterSpacing: '0.04em',
                textTransform: 'uppercase', mb: 0.3, display: 'block',
            }}>
                {label}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                {Icon && <Icon sx={{ fontSize: 16, color: '#bbb' }} />}
                {content}
            </Box>
        </Box>
    );
}

export default function TraitMetaCard({ fileId, listData }) {
    const { data } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const info = (data && !data.error) ? data : null;
    const hasProgram = listData?.files?.includes(fileId);

    return (
        <Card elevation={0} sx={{
            mb: 3, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,.06)',
            borderRadius: 3,
            background: '#fff',
        }}>
            <Box sx={{ height: 4, background: 'linear-gradient(90deg, #2563eb, #34A853, #FEA601)' }} />

            <CardContent sx={{ p: 3 }}>
                {!info ? <MetaSkeleton /> : (
                    <>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                            <Avatar sx={{
                                bgcolor: '#f0f4ff', color: '#2563eb', width: 44, height: 44,
                                fontSize: 20, fontWeight: 700,
                            }}>
                                {(info.trait_name || '?').replace(/^["'\s]+|["'\s]+$/g, '').charAt(0)}
                            </Avatar>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
                                    {(info.trait_name || fileId).replace(/^["'\s]+|["'\s]+$/g, '')}
                                </Typography>
                                {info.mesh_term && (
                                    <Typography variant="body2" sx={{ color: '#888', mt: 0.3 }}>
                                        {info.mesh_term} {info.mesh_id && `(${info.mesh_id})`}
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                            <Chip icon={<Dns />} label={info.file_id} size="small"
                                sx={{ fontFamily: 'monospace', bgcolor: '#f8f9fb', border: '1px solid #e8eaed', fontWeight: 500 }} />
                            {info.gwas_id && info.gwas_id !== info.file_id && (
                                <Tooltip title="GWAS Catalog ID">
                                    <Chip label={info.gwas_id} size="small" variant="outlined"
                                        sx={{ fontFamily: 'monospace', color: '#666' }} />
                                </Tooltip>
                            )}
                            {info.gwas_source_batch && (
                                <Chip label={info.gwas_source_batch} size="small"
                                    sx={{ bgcolor: '#eef2ff', color: '#4f46e5', fontWeight: 600 }} />
                            )}
                            {info.qc_score && (
                                <Chip label={`QC ${info.qc_score}`} size="small"
                                    sx={{ bgcolor: info.qc_score >= 100 ? '#ecfdf5' : '#fffbeb',
                                        color: info.qc_score >= 100 ? '#065f46' : '#92400e' }} />
                            )}
                            {hasProgram && (
                                <Chip icon={<BarChart sx={{ fontSize: 14 }} />} label="Program data" size="small"
                                    color="success" variant="filled" />
                            )}
                        </Box>

                        <Divider sx={{ my: 2.5 }} />

                        <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 2.5, columnGap: 5 }}>
                            {info.first_author && (
                                <Field icon={Person} label="GWAS Author"
                                    value={`${info.first_author}${info.year ? ` (${info.year})` : ''}`} />
                            )}
                            {info.pmid && (
                                <Field icon={Article} label="PubMed"
                                    value={info.pmid} href={`https://pubmed.ncbi.nlm.nih.gov/${info.pmid}`} />
                            )}
                            {(info.sample_size || info.n_case != null) && (
                                <Field icon={People} label="Sample"
                                    value={[
                                        info.sample_size && Number(info.sample_size).toLocaleString(),
                                        info.n_case != null && `${Number(info.n_case).toLocaleString()} cases / ${Number(info.n_control).toLocaleString()} controls`,
                                    ].filter(Boolean).join('  ·  ')} />
                            )}
                            {info.population && (
                                <Field icon={Public} label="Population" value={info.population} />
                            )}
                            {info.n_variants && (
                                <Field icon={Numbers} label="Variants"
                                    value={Number(info.n_variants).toLocaleString()} />
                            )}
                            {info.url && (
                                <Field icon={LinkIcon} label="Source" value="Open" href={info.url} />
                            )}
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
