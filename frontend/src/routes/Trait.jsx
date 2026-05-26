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
    const [tab, setTab] = React.useState(2);
    const userSelectedTabRef = React.useRef(false);
    const { data: scatterListData } = useSWR('/api/programs/list', fetcher);
    const { data: graphListData } = useSWR('/api/programs/graph-list', fetcher);
    const { data: metaData } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const hasProgramScatter = scatterListData?.files?.includes(fileId);
    const hasProgramGraph = graphListData?.files?.includes(fileId);
    const availabilityReady = scatterListData !== undefined && graphListData !== undefined;
    const preferredTab = hasProgramScatter ? 0 : hasProgramGraph ? 1 : 2;
    const meta = (metaData && !metaData.error) ? metaData : null;
    const gwasId = metaData === undefined ? '' : (meta?.gwas_id || fileId);

    React.useEffect(() => {
        userSelectedTabRef.current = false;
        setTab(2);
    }, [fileId]);

    React.useEffect(() => {
        if (!availabilityReady) return;

        setTab((current) => {
            if (current === 0) return hasProgramScatter ? current : preferredTab;
            if (current === 1) return hasProgramGraph ? current : preferredTab;
            if (current === 2) return userSelectedTabRef.current ? current : preferredTab;
            return current;
        });
    }, [availabilityReady, hasProgramGraph, hasProgramScatter, preferredTab]);

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
            <TraitMetaCard fileId={fileId} listData={scatterListData} />

            {/* Figures */}
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#333', mb: 1, mt: 4 }}>
                Figures
            </Typography>
            <Tabs
                value={tab}
                onChange={(e, v) => {
                    userSelectedTabRef.current = true;
                    setTab(v);
                }}
                sx={{
                    mb: 3, '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: '0.9rem' },
                    '& .Mui-selected': { fontWeight: 700 },
                    '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
                }}>
                <Tab label="Program Scatter" disabled={!hasProgramScatter} />
                <Tab label="Trait Program Graph" disabled={!hasProgramGraph} />
                <Tab label="Manhattan" />
                <Tab label="Burden Volcano" />
                <Tab label="Posterior Volcano" />
            </Tabs>

            <Box sx={{ minHeight: 400 }}>
                {tab === 0 && hasProgramScatter && <ProgramScatter key={fileId} fileId={fileId} />}
                {tab === 0 && !hasProgramScatter && (
                    <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 3, bgcolor: '#fafbfc' }}>
                        <Timeline sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                        <Typography color="text.secondary">No Program enrichment data for this trait</Typography>
                    </Card>
                )}
                {tab === 1 && hasProgramGraph && (
                    <TraitProgramGraph
                        key={`trait-program-graph-${fileId}`}
                        fileId={fileId}
                        traitLabel={meta?.trait_name || fileId}
                    />
                )}
                {tab === 1 && !hasProgramGraph && (
                    <Card variant="outlined" sx={{ py: 8, textAlign: 'center', borderRadius: 3, bgcolor: '#fafbfc' }}>
                        <Timeline sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                        <Typography color="text.secondary">No Trait Program Graph data for this trait</Typography>
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
