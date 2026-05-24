import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Card, Tabs, Tab } from '@mui/material';
import { Timeline } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import ProgramScatter from '../components/ProgramScatter';
import TraitProgramGraph from '../components/TraitProgramGraph';
import GwasDataList from '../components/GwasDataList';
import TraitHitManhattan from '../components/TraitHitManhattan';
import BurdenVolcano from '../components/BurdenVolcano';
import TraitMetaCard from '../components/TraitMetaCard';

// ---- Trait 页面 ----
export default function Trait() {
    const { traitName } = useParams();
    const fileId = traitName;
    const [tab, setTab] = React.useState(0);
    const { data: listData } = useSWR('/api/programs/list', fetcher);
    const { data: metaData } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const hasProgram = listData?.files?.includes(fileId);
    const meta = (metaData && !metaData.error) ? metaData : null;
    const gwasId = metaData === undefined ? '' : (meta?.gwas_id || fileId);

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
        <Box sx={{ maxWidth: 1560, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}>
            <TraitMetaCard fileId={fileId} listData={listData} />

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
                <Tab label="Trait Program Graph" disabled={!hasProgram} />
                <Tab label="Manhattan" />
                <Tab label="Burden Volcano" />
                <Tab label="Posterior Volcano" />
            </Tabs>

            <Box sx={{ minHeight: 400 }}>
                {tab === 0 && hasProgram && <ProgramScatter key={fileId} fileId={fileId} />}
                {tab === 0 && !hasProgram && (
                    <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 3, bgcolor: '#fafbfc' }}>
                        <Timeline sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                        <Typography color="text.secondary">No Program enrichment data for this trait</Typography>
                    </Card>
                )}
                {tab === 1 && hasProgram && <TraitProgramGraph key={`trait-program-graph-${fileId}`} fileId={fileId} />}
                {tab === 1 && !hasProgram && (
                    <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 3, bgcolor: '#fafbfc' }}>
                        <Timeline sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                        <Typography color="text.secondary">No Program enrichment data for this trait</Typography>
                    </Card>
                )}
                {tab === 2 && (
                    <TraitHitManhattan
                        key={`manhattan-${fileId}-${gwasId}`}
                        fileId={fileId}
                        gwasId={gwasId}
                        traitLabel={meta?.trait_name || fileId}
                    />
                )}
                {tab === 3 && (
                    <BurdenVolcano
                        key={`burden-volcano-${fileId}`}
                        fileId={fileId}
                        gwasId={gwasId}
                        traitLabel={meta?.trait_name || fileId}
                        volcanoType="burden"
                    />
                )}
                {tab === 4 && (
                    <BurdenVolcano
                        key={`posterior-volcano-${fileId}`}
                        fileId={fileId}
                        gwasId={gwasId}
                        traitLabel={meta?.trait_name || fileId}
                        volcanoType="posterior"
                    />
                )}
            </Box>
        </Box>
    );
}
