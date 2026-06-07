import React from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
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
import { DATA_PAGE_MAX_WIDTH, sectionTitleSx } from '../themeUtils';
import { PageFrame, StatePanel } from '../components/PageScaffold';

function findAvailableId(files, candidates) {
    if (!Array.isArray(files)) return '';
    return candidates.find((candidate) => candidate && files.includes(candidate)) || '';
}

const TAB_KEY_TO_INDEX = {
    'program-scatter': 0,
    'trait-program-graph': 1,
    'manhattan': 2,
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

const FIGURE_FOCUS_HASH = '#trait-figure-panel';

function getVisibleHeaderOffset() {
    const headers = Array.from(document.querySelectorAll('.header, .mobile-header'));
    const visibleHeader = headers.find((header) => {
        const style = window.getComputedStyle(header);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });

    return visibleHeader?.getBoundingClientRect().height || 0;
}

export default function Trait() {
    const theme = useTheme();
    const { traitName } = useParams();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const fileId = traitName;
    const requestedTabKey = searchParams.get('tab');
    const hasExplicitTab = Object.prototype.hasOwnProperty.call(TAB_KEY_TO_INDEX, requestedTabKey);
    const requestedTab = hasExplicitTab ? TAB_KEY_TO_INDEX[requestedTabKey] : 2;
    const [tab, setTab] = React.useState(requestedTab);
    const userSelectedTabRef = React.useRef(false);
    const figurePanelRef = React.useRef(null);
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
    const shouldFocusFigure = location.hash === FIGURE_FOCUS_HASH;

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

    const scrollFigurePanelIntoView = React.useCallback(() => {
        const panel = figurePanelRef.current;
        if (!panel) return;

        const top = panel.getBoundingClientRect().top + window.scrollY - getVisibleHeaderOffset() - 8;
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'auto' });
    }, []);

    React.useLayoutEffect(() => {
        if (!fileId || !shouldFocusFigure) return undefined;

        const rafIds = [];
        const queueScroll = () => {
            const firstFrame = window.requestAnimationFrame(() => {
                const secondFrame = window.requestAnimationFrame(scrollFigurePanelIntoView);
                rafIds.push(secondFrame);
            });
            rafIds.push(firstFrame);
        };

        queueScroll();
        const settleTimer = window.setTimeout(queueScroll, 420);

        return () => {
            rafIds.forEach((rafId) => window.cancelAnimationFrame(rafId));
            window.clearTimeout(settleTimer);
        };
    }, [availabilityReady, fileId, metaData, scrollFigurePanelIntoView, shouldFocusFigure, tab]);

    if (!fileId) {
        return (
            <PageFrame
                title={null}
                subtitle={null}
                maxWidth={DATA_PAGE_MAX_WIDTH}
                compact
            >
                <GwasDataList
                    title="Browse Traits"
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
        <Box sx={{
            width: '100%',
            maxWidth: DATA_PAGE_MAX_WIDTH,
            minWidth: 0,
            mx: 'auto',
            px: { xs: 1.5, sm: 2, md: 3, xl: 4 },
            py: { xs: 2, md: 3, xl: 3.5 },
        }}>
            <TraitMetaCard fileId={fileId} />

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

            <Box
                id="trait-figure-panel"
                ref={figurePanelRef}
                sx={{ minHeight: 400, scrollMarginTop: { xs: 7, md: 8 } }}
            >
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
