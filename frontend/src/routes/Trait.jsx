import React from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, Tabs, Tab } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Refresh, Timeline } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import TraitMetaCard from '../components/TraitMetaCard';
import { DATA_PAGE_MAX_WIDTH, sectionTitleSx } from '../themeUtils';
import { PageFrame, StatePanel } from '../components/PageScaffold';

const loadGwasDataList = () => import('../components/GwasDataList');
const loadProgramScatter = () => import('../components/ProgramScatter');
const loadTraitProgramGraph = () => import('../components/TraitProgramGraph');
const loadTraitHitManhattan = () => import('../components/TraitHitManhattan');
const loadBurdenVolcano = () => import('../components/BurdenVolcano');
const loadGeneLevelScatter = () => import('../components/GeneLevelScatter');
const loadGeneLevelQQ = () => import('../components/GeneLevelQQ');
const loadCrossTraitHeatmap = () => import('../components/CrossTraitHeatmap');

const GwasDataList = React.lazy(loadGwasDataList);
const ProgramScatter = React.lazy(loadProgramScatter);
const TraitProgramGraph = React.lazy(loadTraitProgramGraph);
const TraitHitManhattan = React.lazy(loadTraitHitManhattan);
const BurdenVolcano = React.lazy(loadBurdenVolcano);
const GeneLevelScatter = React.lazy(loadGeneLevelScatter);
const GeneLevelQQ = React.lazy(loadGeneLevelQQ);
const CrossTraitHeatmap = React.lazy(loadCrossTraitHeatmap);

const TAB_PRELOADERS = [
    loadProgramScatter,
    loadTraitProgramGraph,
    loadTraitHitManhattan,
    loadBurdenVolcano,
    loadBurdenVolcano,
    loadGeneLevelScatter,
    loadGeneLevelQQ,
    loadCrossTraitHeatmap,
];
const preloadedTraitLoaders = new Set();

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

function scheduleIdleTask(callback, timeout = 1200) {
    if (typeof window === 'undefined') return () => {};

    if ('requestIdleCallback' in window) {
        const idleId = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback(idleId);
    }

    const timerId = window.setTimeout(callback, Math.min(timeout, 600));
    return () => window.clearTimeout(timerId);
}

function preloadTraitTab(tabIndex) {
    const loader = TAB_PRELOADERS[tabIndex];
    if (!loader || preloadedTraitLoaders.has(loader)) return undefined;

    preloadedTraitLoaders.add(loader);
    return loader().catch((error) => {
        preloadedTraitLoaders.delete(loader);
        throw error;
    });
}

function TraitFigureFallback() {
    return (
        <StatePanel
            loading
            title="Loading figure"
            message="Preparing this visualization panel."
            minHeight={360}
        />
    );
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
    const {
        data: scatterListData,
        error: scatterListError,
        mutate: retryScatterList,
    } = useSWR('/api/programs/list', fetcher);
    const {
        data: graphListData,
        error: graphListError,
        mutate: retryGraphList,
    } = useSWR('/api/programs/graph-list', fetcher);
    const { data: metaData } = useSWR(fileId ? `/api/meta/${fileId}` : null, fetcher);
    const availabilityError = scatterListError || graphListError;
    const availabilityReady = (
        (scatterListData !== undefined || scatterListError)
        && (graphListData !== undefined || graphListError)
    );
    const meta = (metaData && !metaData.error) ? metaData : null;
    const resolvedFileId = meta?.file_id || fileId;
    const gwasId = metaData === undefined ? '' : (meta?.gwas_id || fileId);
    const dataIdCandidates = React.useMemo(() => (
        [...new Set([resolvedFileId, fileId, gwasId].filter(Boolean))]
    ), [fileId, gwasId, resolvedFileId]);
    const scatterFileId = findAvailableId(scatterListData?.files, dataIdCandidates);
    const graphFileId = findAvailableId(graphListData?.files, dataIdCandidates);
    const hasProgramScatter = Boolean(scatterFileId);
    const hasProgramGraph = Boolean(graphFileId);
    const preferredTab = hasProgramScatter ? 0 : hasProgramGraph ? 1 : 2;
    const shouldFocusFigure = location.hash === FIGURE_FOCUS_HASH;
    let displayedTab = tab;
    if (availabilityReady) {
        if (tab === 0 && !hasProgramScatter) displayedTab = preferredTab;
        else if (tab === 1 && !hasProgramGraph) displayedTab = preferredTab;
        else if (tab === 2 && !userSelectedTabRef.current && !hasExplicitTab) displayedTab = preferredTab;
    }
    const shouldDeferFigureTab = Boolean(fileId && !hasExplicitTab && !availabilityReady);

    const syncTabParam = React.useCallback((nextTab, options = {}) => {
        const tabKey = TAB_INDEX_TO_KEY[nextTab] || TAB_INDEX_TO_KEY[2];
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', tabKey);
        setSearchParams(nextParams, options);
    }, [searchParams, setSearchParams]);

    const warmTraitTab = React.useCallback((tabIndex) => {
        preloadTraitTab(tabIndex)?.catch(() => {});
    }, []);

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

    React.useEffect(() => {
        if (!fileId || shouldDeferFigureTab) return undefined;

        const preloadQueue = TAB_PRELOADERS
            .map((_, index) => index)
            .filter((index) => index !== displayedTab);
        let cancelled = false;
        let cancelIdleTask = () => {};

        const preloadNext = () => {
            if (cancelled || preloadQueue.length === 0) return;

            const nextTab = preloadQueue.shift();
            cancelIdleTask = scheduleIdleTask(() => {
                warmTraitTab(nextTab);
                preloadNext();
            }, 1400);
        };

        preloadNext();

        return () => {
            cancelled = true;
            cancelIdleTask();
        };
    }, [displayedTab, fileId, shouldDeferFigureTab, warmTraitTab]);

    if (!fileId) {
        return (
            <PageFrame
                title={null}
                subtitle={null}
                maxWidth={DATA_PAGE_MAX_WIDTH}
                compact
            >
                <React.Suspense fallback={<TraitFigureFallback />}>
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
                </React.Suspense>
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
                value={shouldDeferFigureTab ? false : displayedTab}
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
                <Tab label="Program Scatter" disabled={!hasProgramScatter} onMouseEnter={() => warmTraitTab(0)} onFocus={() => warmTraitTab(0)} />
                <Tab label="Trait Program Graph" disabled={!hasProgramGraph} onMouseEnter={() => warmTraitTab(1)} onFocus={() => warmTraitTab(1)} />
                <Tab label="Manhattan" onMouseEnter={() => warmTraitTab(2)} onFocus={() => warmTraitTab(2)} />
                <Tab label="Burden Volcano" onMouseEnter={() => warmTraitTab(3)} onFocus={() => warmTraitTab(3)} />
                <Tab label="Posterior Volcano" onMouseEnter={() => warmTraitTab(4)} onFocus={() => warmTraitTab(4)} />
                <Tab label="Gene Evidence" onMouseEnter={() => warmTraitTab(5)} onFocus={() => warmTraitTab(5)} />
                <Tab label="Gene QQ" onMouseEnter={() => warmTraitTab(6)} onFocus={() => warmTraitTab(6)} />
                <Tab label="Cross-trait Heatmap" onMouseEnter={() => warmTraitTab(7)} onFocus={() => warmTraitTab(7)} />
            </Tabs>

            <Box
                id="trait-figure-panel"
                ref={figurePanelRef}
                sx={{ minHeight: 400, scrollMarginTop: { xs: 7, md: 8 } }}
            >
                {availabilityError ? (
                    <StatePanel
                        severity="error"
                        icon={Timeline}
                        title="Failed to load trait figure availability"
                        message={availabilityError?.response?.data?.error || availabilityError?.message || 'Program figure lists could not be loaded.'}
                        minHeight={360}
                    >
                        <Button
                            variant="outlined"
                            startIcon={<Refresh />}
                            onClick={() => {
                                void retryScatterList();
                                void retryGraphList();
                            }}
                        >
                            Retry
                        </Button>
                    </StatePanel>
                ) : shouldDeferFigureTab ? (
                    <TraitFigureFallback />
                ) : (
                    <React.Suspense fallback={<TraitFigureFallback />}>
                        {displayedTab === 0 && hasProgramScatter && <ProgramScatter key={scatterFileId} fileId={scatterFileId} />}
                        {displayedTab === 0 && !hasProgramScatter && (
                            <StatePanel
                                icon={Timeline}
                                title="No Program enrichment data"
                                message="This trait does not have a Program Scatter TSV available."
                                minHeight={360}
                            />
                        )}
                        {displayedTab === 1 && hasProgramGraph && (
                            <TraitProgramGraph
                                key={`trait-program-graph-${graphFileId}`}
                                fileId={graphFileId}
                                traitLabel={meta?.trait_name || fileId}
                            />
                        )}
                        {displayedTab === 1 && !hasProgramGraph && (
                            <StatePanel
                                icon={Timeline}
                                title="No Trait Program Graph data"
                                message="This trait does not have graph-linked program and regulator data available."
                                minHeight={360}
                            />
                        )}
                        {displayedTab === 2 && (
                            <TraitHitManhattan
                                key={`manhattan-${fileId}-${gwasId}`}
                                fileId={resolvedFileId}
                                gwasId={gwasId}
                                traitLabel={meta?.trait_name || fileId}
                            />
                        )}
                        {displayedTab === 3 && (
                            <BurdenVolcano
                                key={`burden-volcano-${fileId}`}
                                fileId={resolvedFileId}
                                gwasId={gwasId}
                                traitLabel={meta?.trait_name || fileId}
                                volcanoType="burden"
                            />
                        )}
                        {displayedTab === 4 && (
                            <BurdenVolcano
                                key={`posterior-volcano-${fileId}`}
                                fileId={resolvedFileId}
                                gwasId={gwasId}
                                traitLabel={meta?.trait_name || fileId}
                                volcanoType="posterior"
                            />
                        )}
                        {displayedTab === 5 && (
                            <GeneLevelScatter
                                key={`gene-level-scatter-${fileId}-${gwasId}`}
                                fileId={resolvedFileId}
                                gwasId={gwasId}
                                traitLabel={meta?.trait_name || fileId}
                                lookupIds={dataIdCandidates}
                            />
                        )}
                        {displayedTab === 6 && (
                            <GeneLevelQQ
                                key={`gene-level-qq-${fileId}-${gwasId}`}
                                fileId={resolvedFileId}
                                gwasId={gwasId}
                                traitLabel={meta?.trait_name || fileId}
                                lookupIds={dataIdCandidates}
                            />
                        )}
                        {displayedTab === 7 && (
                            <CrossTraitHeatmap
                                key={`cross-trait-heatmap-${fileId}-${gwasId}`}
                                fileId={resolvedFileId}
                                gwasId={gwasId}
                                traitLabel={meta?.trait_name || fileId}
                            />
                        )}
                    </React.Suspense>
                )}
            </Box>
        </Box>
    );
}
