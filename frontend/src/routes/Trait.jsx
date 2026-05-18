import React from 'react';
import { useParams } from 'react-router-dom';
import {
    Box, Typography, Card, CardContent, Chip, Tabs, Tab,
    Link, Skeleton, Divider, Avatar, Tooltip,
} from '@mui/material';
import {
    OpenInNew, Person, Article, People,
    Public, Science, Numbers, Dns, Link as LinkIcon,
    BarChart, Timeline,
} from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import ProgramScatter from '../components/ProgramScatter';
import GwasDataList from '../components/GwasDataList';

// ---- 骨架屏 ----
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

// 小字段块
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

// ---- 元信息卡片 ----
function MetaCard({ fileId, listData }) {
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
            {/* 顶部色条 */}
            <Box sx={{ height: 4, background: 'linear-gradient(90deg, #2563eb, #34A853, #FEA601)' }} />

            <CardContent sx={{ p: 3 }}>
                {!info ? <MetaSkeleton /> : (
                    <>
                        {/* 标题行 */}
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

                        {/* ID 标识行 */}
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

                        {/* 元数据字段网格 */}
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

// ---- Trait 页面 ----
export default function Trait() {
    const { traitName } = useParams();
    const fileId = traitName;
    const [tab, setTab] = React.useState(0);
    const { data: listData } = useSWR('/api/programs/list', fetcher);
    const hasProgram = listData?.files?.includes(fileId);

    if (!fileId) {
        return (
            <Box style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 16px' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Browse Traits</Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Select a trait to explore its GWAS and LoF analysis results.
                </Typography>
                <GwasDataList
                    title=""
                    columns={[
                        { id: 'file_id', label: 'LoF ID' },
                        { id: 'gwas_id', label: 'GWAS ID' },
                        { id: 'trait_name', label: 'Trait' },
                    ]}
                    defaultSortBy="trait_name"
                    defaultOrder="ASC"
                />
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 1300, mx: 'auto', px: 3, py: 4 }}>
            <MetaCard fileId={fileId} listData={listData} />

            {/* Figures */}
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333', mb: 1, mt: 4 }}>
                Figures
            </Typography>
            <Tabs value={tab} onChange={(e, v) => setTab(v)}
                sx={{
                    mb: 3, '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: '0.9rem' },
                    '& .Mui-selected': { fontWeight: 700 },
                    '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
                }}>
                <Tab label="Program Scatter" disabled={!hasProgram} />
                <Tab label="Manhattan" disabled />
                <Tab label="LoF Volcano" disabled />
            </Tabs>

            <Box sx={{ minHeight: 400 }}>
                {tab === 0 && hasProgram && <ProgramScatter key={fileId} fileId={fileId} />}
                {tab === 0 && !hasProgram && (
                    <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 3, bgcolor: '#fafbfc' }}>
                        <Timeline sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                        <Typography color="text.secondary">No Program enrichment data for this trait</Typography>
                    </Card>
                )}
                {tab > 0 && (
                    <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 3, bgcolor: '#fafbfc' }}>
                        <Science sx={{ fontSize: 48, color: '#ddd', mb: 2 }} />
                        <Typography color="text.secondary">Coming soon</Typography>
                    </Card>
                )}
            </Box>
        </Box>
    );
}
