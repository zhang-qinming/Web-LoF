import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Timeline } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import ProgramScatter from '../components/ProgramScatter';
import TraitProgramGraph from '../components/TraitProgramGraph';
import GwasDataList from '../components/GwasDataList';
import TraitHitManhattan from '../components/TraitHitManhattan';
import BurdenVolcano from '../components/BurdenVolcano';
import GeneLevelScatter from '../components/GeneLevelScatter';
import GeneLevelQQ from '../components/GeneLevelQQ';
import CrossTraitHeatmap from '../components/CrossTraitHeatmap';
import TraitMetaCard from '../components/TraitMetaCard';
import { sectionTitleSx } from '../themeUtils';
import { PageFrame, StatePanel } from '../components/PageScaffold';

function findAvailableId(files, candidates) {
    if (!Array.isArray(files)) return '';
    return candidates.find((candidate) => candidate && files.includes(candidate)) || '';
}

const TAB_KEY_TO_INDEX = {
    'program-scatter': 0,
    'trait-program-graph': 1,
    manhattan: 2,
    'burden-volcano': 3,
    'posterior-volcano': 4,
    'gene-evidence': 5,
    'gene-qq': 6,
    'cross-trait-heatmap': 7,
};

const TAB_INDEX_TO_KEY = [
    'program-scatter',
    'trait-program-graph',
    'manhattan',
    'burden-volcano',
    'posterior-volcano',
    'gene-evidence',
    'gene-qq',
    'cross-trait-heatmap',
];

export default function Trait() {
    const theme = useTheme();
    const { traitName } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const fileId = traitName;
    const requestedTabKey = searchParams.get('tab');
    const hasExplicitTab = Object.prototype.hasOwnProperty.call(TAB_KEY_TO_INDEX, requestedTabKey);
    const requestedTab = hasExplicitTab ? TAB_KEY_TO_INDEX[requestedTabKey] : 2;
    const [tab, setTab] = React.useState(requestedTab);
    const userSelectedTabRef = React.useRef(false);
    const { data: scatterListData } = useSWR('/api/programs/list', fetcher);
    const { data: graphListData } = useSWR('/api/programs/graph-list', fetcher);
    const { data: metaData } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const availabilityReady = scatterListData !== undefined && graphListData !== undefined;
    const meta = (metaData && !metaData.error) ? metaData : null;
    const gwasId = metaData === undefined ? '' : (meta?.gwas_id || fileId);
    const dataIdCandidates = React.useMemo(() => (
        [...new Set([fileId, gwasId, meta?.file_id].filter(Boolean))]
    ), [fileId, gwasId, meta?.file_id]);
    const scatterFileId = findAvailableId(scatterListData?.files, dataIdCandidates);
    const graphFileId = findAvailableId(graphListData?.files, dataIdCandidates);
    const hasProgramScatter = Boolean(scatterFileId);
    const hasProgramGraph = Boolean(graphFileId);
    const preferredTab = hasProgramScatter ? 0 : hasProgramGraph ? 1 : 2;

    const syncTabParam = React.useCallback((nextTab, options = {}) => {
        const tabKey = TAB_INDEX_TO_KEY[nextTab] || TAB_INDEX_TO_KEY[2];
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', tabKey);
        setSearchParams(nextParams, options);
    }, [searchParams, setSearchParams]);

    React.useEffect(() => {
        userSelectedTabRef.current = false;
        setTab(requestedTab);
    }, [fileId, requestedTab]);

    React.useEffect(() => {
        if (!availabilityReady) return;

        let nextTab = tab;
        if (tab === 0) nextTab = hasProgramScatter ? tab : preferredTab;
        else if (tab === 1) nextTab = hasProgramGraph ? tab : preferredTab;
        else if (tab === 2 && !userSelectedTabRef.current && !hasExplicitTab) nextTab = preferredTab;

        if (nextTab !== tab) {
            setTab(nextTab);
            syncTabParam(nextTab, { replace: true });
        }
    }, [availabilityReady, hasExplicitTab, hasProgramGraph, hasProgramScatter, preferredTab, syncTabParam, tab]);

    if (!fileId) {
        return (
            <PageFrame
                title="Browse Traits"
                subtitle="Select a trait to explore its GWAS and LoF analysis results."
                maxWidth={1500}
                compact
            >
                <GwasDataList
                    title=""
                    columns={[
                        { id: 'file_id', label: 'LoF ID', width: 132, minWidth: 132, whiteSpace: 'nowrap' },
                        { id: 'trait_name', label: 'Trait', width: '34%', minWidth: 360 },
                        { id: 'sample_size', label: 'Sample Size', numeric: true, width: 132, minWidth: 132, whiteSpace: 'nowrap', headerWrap: true },
                        { id: 'mesh_term', label: 'MeSH term', width: 170, minWidth: 170, headerWrap: true },
                        { id: 'year', label: 'Year', numeric: true, width: 84, minWidth: 84, whiteSpace: 'nowrap' },
                        { id: 'n_variants', label: 'Variants', numeric: true, width: 138, minWidth: 138, whiteSpace: 'nowrap' },
                    ]}
                    defaultSortBy="trait_name"
                    defaultOrder="ASC"
                />
            </PageFrame>
        );
    }

    return (
        <Box sx={{ maxWidth: 1560, mx: 'auto', px: { xs: 2, md: 3 }, py: 4 }}>
            <TraitMetaCard fileId={fileId} listData={scatterListData} />

            <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 1, mt: 4 })}>
                Figures
            </Typography>
            <Tabs
                value={tab}
                onChange={(e, v) => {
                    userSelectedTabRef.current = true;
                    setTab(v);
                    syncTabParam(v);
                }}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                    mb: 3,
                    '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                    },
                    '& .Mui-selected': { fontWeight: 700 },
                    '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
                    '& .MuiTabs-scrollButtons': {
                        borderRadius: 1.5,
                    },
                }}>
                <Tab label="Program Scatter" disabled={!hasProgramScatter} />
                <Tab label="Trait Program Graph" disabled={!hasProgramGraph} />
                <Tab label="Manhattan" />
                <Tab label="Burden Volcano" />
                <Tab label="Posterior Volcano" />
                <Tab label="Gene Evidence" />
                <Tab label="Gene QQ" />
                <Tab label="Cross-trait Heatmap" />
            </Tabs>

            <Box sx={{ minHeight: 400 }}>
                {tab === 0 && hasProgramScatter && <ProgramScatter key={scatterFileId} fileId={scatterFileId} />}
                {tab === 0 && !hasProgramScatter && (
                    <StatePanel
                        icon={Timeline}
                        title="No Program enrichment data"
                        message="This trait does not have a Program Scatter TSV available."
                        minHeight={360}
                    />
                )}
                {tab === 1 && hasProgramGraph && (
                    <TraitProgramGraph
                        key={`trait-program-graph-${graphFileId}`}
                        fileId={graphFileId}
                        traitLabel={meta?.trait_name || fileId}
                    />
                )}
                {tab === 1 && !hasProgramGraph && (
                    <StatePanel
                        icon={Timeline}
                        title="No Trait Program Graph data"
                        message="This trait does not have graph-linked program and regulator data available."
                        minHeight={360}
                    />
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
                {tab === 5 && (
                    <GeneLevelScatter
                        key={`gene-level-scatter-${fileId}-${gwasId}`}
                        fileId={fileId}
                        gwasId={gwasId}
                        traitLabel={meta?.trait_name || fileId}
                        lookupIds={dataIdCandidates}
                    />
                )}
                {tab === 6 && (
                    <GeneLevelQQ
                        key={`gene-level-qq-${fileId}-${gwasId}`}
                        fileId={fileId}
                        gwasId={gwasId}
                        traitLabel={meta?.trait_name || fileId}
                        lookupIds={dataIdCandidates}
                    />
                )}
                {tab === 7 && (
                    <CrossTraitHeatmap
                        key={`cross-trait-heatmap-${fileId}-${gwasId}`}
                        fileId={fileId}
                        gwasId={gwasId}
                        traitLabel={meta?.trait_name || fileId}
                    />
                )}
            </Box>
        </Box>
    );
}
