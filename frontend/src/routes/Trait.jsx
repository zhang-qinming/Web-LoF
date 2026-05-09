import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Chip, Tabs, Tab, Grid, Link, Skeleton } from '@mui/material';
import { OpenInNew } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import ProgramScatter from '../components/ProgramScatter';

function MetaCard({ meta, listData }) {
    const { data } = useSWR(meta ? `/api/meta/${meta}` : null, fetcher);
    const info = data && !data.error ? data : null;
    const hasProgram = listData?.files?.includes(meta);

    return (
        <Card elevation={2} sx={{ mb: 3 }}>
            <CardContent>
                {!info ? (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Skeleton width={120} /><Skeleton width={160} /><Skeleton width={100} />
                    </Box>
                ) : (
                    <>
                        <Typography variant="h6" gutterBottom>
                            {info.trait_name?.replace(/^"/, '').replace(/"$/, '') || meta}
                        </Typography>

                        <Grid container spacing={2} sx={{ mt: 1 }}>
                            {info.first_author && (
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Typography variant="caption" color="text.secondary">Author</Typography>
                                    <Typography variant="body2">
                                        {info.first_author}
                                        {info.year ? ` (${info.year})` : ''}
                                    </Typography>
                                </Grid>
                            )}
                            {info.pmid && (
                                <Grid size={{ xs: 6, sm: 3 }}>
                                    <Typography variant="caption" color="text.secondary">PMID</Typography>
                                    <Typography variant="body2">
                                        <Link href={`https://pubmed.ncbi.nlm.nih.gov/${info.pmid}`} target="_blank">
                                            {info.pmid} <OpenInNew sx={{ fontSize: 14, verticalAlign: 'middle' }} />
                                        </Link>
                                    </Typography>
                                </Grid>
                            )}
                            {info.sample_size && (
                                <Grid size={{ xs: 6, sm: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Sample Size</Typography>
                                    <Typography variant="body2">{Number(info.sample_size).toLocaleString()}</Typography>
                                </Grid>
                            )}
                            {info.population && (
                                <Grid size={{ xs: 6, sm: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Population</Typography>
                                    <Typography variant="body2">{info.population}</Typography>
                                </Grid>
                            )}
                            {info.n_case != null && (
                                <Grid size={{ xs: 6, sm: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Cases / Controls</Typography>
                                    <Typography variant="body2">
                                        {Number(info.n_case).toLocaleString()} / {Number(info.n_control).toLocaleString()}
                                    </Typography>
                                </Grid>
                            )}
                            {info.n_variants && (
                                <Grid size={{ xs: 6, sm: 2 }}>
                                    <Typography variant="caption" color="text.secondary">Variants</Typography>
                                    <Typography variant="body2">{Number(info.n_variants).toLocaleString()}</Typography>
                                </Grid>
                            )}
                            {info.mesh_term && (
                                <Grid size={{ xs: 6, sm: 4 }}>
                                    <Typography variant="caption" color="text.secondary">MeSH</Typography>
                                    <Typography variant="body2">{info.mesh_term}</Typography>
                                </Grid>
                            )}
                            <Grid size={{ xs: 6, sm: 2 }}>
                                <Typography variant="caption" color="text.secondary">GWAS ID</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{info.gwas_id}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 2 }}>
                                <Typography variant="caption" color="text.secondary">LoF ID</Typography>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{info.lof_id || info.file_id}</Typography>
                            </Grid>
                            {info.url && (
                                <Grid size={{ xs: 12 }}>
                                    <Typography variant="caption" color="text.secondary">Source</Typography>
                                    <Typography variant="body2">
                                        <Link href={info.url} target="_blank" sx={{ wordBreak: 'break-all' }}>
                                            {info.url} <OpenInNew sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                                        </Link>
                                    </Typography>
                                </Grid>
                            )}
                        </Grid>

                        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {info.gwas_source_batch && <Chip label={info.gwas_source_batch} size="small" color="primary" variant="outlined" />}
                            {info.qc_score && <Chip label={`QC: ${info.qc_score}`} size="small" />}
                            {hasProgram && <Chip label="Program" size="small" color="success" />}
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default function Trait() {
    const { traitName } = useParams();
    const fileId = traitName;
    const [tab, setTab] = React.useState(0);

    const { data: listData } = useSWR('/api/programs/list', fetcher);
    const hasProgram = listData?.files?.includes(fileId);

    return (
        <Box sx={{ p: 3 }}>
            <MetaCard meta={fileId} listData={listData} />

            <Typography variant="h5" sx={{ mb: 2 }}>Figures</Typography>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab label="Program Scatter" disabled={!hasProgram} />
                <Tab label="Manhattan" disabled />
                <Tab label="LoF Volcano" disabled />
            </Tabs>

            {tab === 0 && hasProgram && <ProgramScatter fileId={fileId} />}
            {tab === 0 && !hasProgram && (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    No Program data for this trait
                </Typography>
            )}
            {tab > 0 && (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                    Coming soon
                </Typography>
            )}
        </Box>
    );
}
