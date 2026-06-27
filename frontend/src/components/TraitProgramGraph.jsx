import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { getTraitProgramGraph } from '../api/gwas';
import { UpdatingStatus } from './PageScaffold';
import TraitProgramGraphSummary from './TraitProgramGraphSummary';
import TraitProgramGraphCanvas from './traitProgramGraph/TraitProgramGraphCanvas';
import { figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import {
    buildModuleBlueprints,
    EFFECT_COLORS,
    edgeColorFromScore,
    effectSignFromGene,
    formatNumber,
    GRAPH_LAYOUTS,
    positionModules,
    programColor,
    programSelectionLabel,
    SIDE_META,
    splitTraitTextLines,
    SVG_WIDTH,
    traitNodeHeight,
    traitTextFontSize,
    useGraphTransform,
} from './traitProgramGraph/shared';

const GENE_LIMIT_OPTIONS = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: 'All', value: Number.POSITIVE_INFINITY },
];

function normalizeGeneQueryValue(value) {
    const text = String(value || '').trim();
    const wrapped = text.match(/^\(([^()]+)\)$/);
    return wrapped ? wrapped[1].trim() : text;
}

function geneQueryCandidates(gene) {
    return [
        gene?.ensg,
        gene?.highlightKey,
        gene?.gene,
        gene?.geneLabel,
    ]
        .map(normalizeGeneQueryValue)
        .filter(Boolean);
}

export default function TraitProgramGraph({ fileId, traitLabel }) {
    const navigate = useNavigate();
    const graphKey = fileId ? ['trait-program-graph', fileId] : null;
    const graphResource = useCachedResourceState(
        useSWR(graphKey, ([, id]) => getTraitProgramGraph(id), figureResourceSWRConfig),
        { cacheKey: graphKey, retainPreviousData: false },
    );
    const { displayData: data, error, isInitialLoading: isLoading, isRefreshing } = graphResource;
    const afterFirstPaint = useAfterFirstPaint(graphKey || 'trait-program-graph-empty');
    const graph = data;
    const svgRef = useRef(null);

    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedGene, setSelectedGene] = useState(null);
    const [expandedPrograms, setExpandedPrograms] = useState(() => new Set());
    const [geneLimit, setGeneLimit] = useState(5);
    const [expandedAllGeneModuleKey, setExpandedAllGeneModuleKey] = useState(null);

    const {
        transform,
        isDragging,
        isTransformAnimating,
        transformAnimationMs,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onWheel,
        zoomIn,
        zoomOut,
        reset,
        animateToTransform,
        focusBounds,
        shouldSuppressClick,
    } = useGraphTransform();

    const isAllGeneMode = geneLimit === Number.POSITIVE_INFINITY;
    const expandedAllGeneSide = isAllGeneMode ? expandedAllGeneModuleKey?.split(':')[0] : null;
    const graphLayout = useMemo(() => {
        if (!isAllGeneMode) return geneLimit >= 10 ? GRAPH_LAYOUTS.full : GRAPH_LAYOUTS.compact;

        const layout = {
            ...GRAPH_LAYOUTS.compact,
            mode: GRAPH_LAYOUTS.full.mode,
            defaultMaxGenes: 5,
            leftProgramX: 56,
            traitCenterX: 700,
            rightProgramX: 900,
            rightRegulatorX: 1250,
            allGeneLabelCount: 5,
            allGeneOverviewProgramW: GRAPH_LAYOUTS.full.leftProgramW,
            allGeneOverviewRightProgramW: GRAPH_LAYOUTS.full.rightProgramW,
            allGeneOverviewRegulatorW: GRAPH_LAYOUTS.full.rightRegulatorW,
            allGeneProgramFocusCenterX: SVG_WIDTH * 0.36,
            allGeneRegulatorFocusCenterX: SVG_WIDTH * 0.62,
            allGeneProgramModuleH: 126,
            allGeneRegulatorGroupH: 92,
            allGeneExpandedPanelGap: 12,
            allGeneExpandedMinH: 360,
            allGeneDetailHeaderH: 52,
            allGeneDetailGroupHeaderH: 22,
            allGeneDetailRowH: 21,
            allGeneDetailCellMinW: 86,
            allGeneDetailCellGap: 7,
            allGeneDetailGroupGap: 10,
            allGeneDetailPaddingX: 12,
            allGeneDetailPaddingY: 10,
            allGeneDetailMaxColumns: 9,
            allGeneExpandedProgramPanelW: 820,
            allGeneExpandedRegulatorPanelW: 900,
            moduleGap: GRAPH_LAYOUTS.compact.moduleGap,
            regulatorGroupGap: 12,
            graphTopPadding: 64,
            graphBottomPadding: 34,
            minContentHeight: 400,
            minSvgHeight: GRAPH_LAYOUTS.compact.minSvgHeight,
            showSectionNotes: false,
        };

        if (expandedAllGeneSide === 'regulator') {
            return {
                ...layout,
                traitCenterX: 600,
                rightProgramX: 790,
                rightRegulatorX: 1190,
                allGeneRegulatorFocusCenterX: SVG_WIDTH * 0.62,
            };
        }

        if (expandedAllGeneSide === 'program') {
            return {
                ...layout,
                traitCenterX: 1030,
                rightProgramX: 1200,
                rightProgramW: 220,
                rightRegulatorX: 1445,
                allGeneOverviewRightProgramW: 220,
                allGeneOverviewRegulatorW: 220,
                allGeneProgramFocusCenterX: SVG_WIDTH * 0.36,
            };
        }

        return layout;
    }, [expandedAllGeneSide, geneLimit, isAllGeneMode]);
    const maxGenesPerProgram = geneLimit;

    const filters = useMemo(() => ({
        gammaThreshold: 0,
        maxGenesPerProgram,
        discordantOnly: false,
        gammaSign: 'all',
        sideFilter: 'both',
        allGeneExpandedKey: isAllGeneMode ? expandedAllGeneModuleKey : null,
    }), [expandedAllGeneModuleKey, isAllGeneMode, maxGenesPerProgram]);

    useEffect(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
        setExpandedPrograms(new Set());
        setExpandedAllGeneModuleKey(null);
        setGeneLimit(5);
        reset();
    }, [fileId, reset]);

    const leftPrograms = useMemo(() => graph?.layout?.leftPrograms || [], [graph]);
    const rightPrograms = useMemo(() => graph?.layout?.rightPrograms || [], [graph]);

    const leftBlueprint = useMemo(
        () => buildModuleBlueprints(leftPrograms, 'program', filters, expandedPrograms, graphLayout),
        [expandedPrograms, filters, graphLayout, leftPrograms],
    );
    const rightBlueprint = useMemo(
        () => buildModuleBlueprints(rightPrograms, 'regulator', filters, expandedPrograms, graphLayout),
        [expandedPrograms, filters, graphLayout, rightPrograms],
    );

    const svgHeight = useMemo(() => {
        const contentHeight = Math.max(leftBlueprint.contentHeight, rightBlueprint.contentHeight, graphLayout.minContentHeight);
        return Math.max(graphLayout.minSvgHeight, Math.ceil(contentHeight + graphLayout.graphTopPadding + graphLayout.graphBottomPadding));
    }, [graphLayout, leftBlueprint.contentHeight, rightBlueprint.contentHeight]);
    const allGeneViewportHeight = useMemo(() => {
        if (!isAllGeneMode) return svgHeight;

        const viewportFilters = {
            ...filters,
            allGeneExpandedKey: null,
        };
        const leftViewportBlueprint = buildModuleBlueprints(leftPrograms, 'program', viewportFilters, expandedPrograms, graphLayout);
        const rightViewportBlueprint = buildModuleBlueprints(rightPrograms, 'regulator', viewportFilters, expandedPrograms, graphLayout);
        const contentHeight = Math.max(leftViewportBlueprint.contentHeight, rightViewportBlueprint.contentHeight, graphLayout.minContentHeight);
        return Math.max(graphLayout.minSvgHeight, Math.ceil(contentHeight + graphLayout.graphTopPadding + graphLayout.graphBottomPadding));
    }, [expandedPrograms, filters, graphLayout, isAllGeneMode, leftPrograms, rightPrograms, svgHeight]);
    const svgViewportHeight = isAllGeneMode ? allGeneViewportHeight : svgHeight;
    const traitCenterY = useMemo(() => Math.round(svgViewportHeight / 2), [svgViewportHeight]);

    const leftLayout = useMemo(
        () => positionModules(leftBlueprint.modules, 'program', traitCenterY, graphLayout),
        [graphLayout, leftBlueprint.modules, traitCenterY],
    );
    const rightLayout = useMemo(
        () => positionModules(rightBlueprint.modules, 'regulator', traitCenterY, graphLayout),
        [graphLayout, rightBlueprint.modules, traitCenterY],
    );

    const allModules = useMemo(
        () => [...leftLayout.modules, ...rightLayout.modules],
        [leftLayout.modules, rightLayout.modules],
    );

    const allGenes = useMemo(() => {
        const genes = [];
        (graph?.programs || []).forEach((program) => {
            genes.push(...program.genes.program, ...program.genes.regulator);
        });
        return genes;
    }, [graph]);

    const geneOccurrences = useMemo(() => {
        const map = new Map();
        allGenes.forEach((gene) => {
            const key = gene.highlightKey;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(gene);
        });
        return map;
    }, [allGenes]);

    const selectedGeneKey = selectedGene?.highlightKey || null;

    const visibleSides = useMemo(() => new Set(['program', 'regulator']), []);
    const summaryModules = useMemo(
        () => allModules.filter((module) => visibleSides.has(module.side)),
        [allModules, visibleSides],
    );

    useEffect(() => {
        if (!selectedProgram) return;
        const stillVisible = allModules.some((module) => visibleSides.has(module.side) && module.program === selectedProgram);
        if (!stillVisible) setSelectedProgram(null);
    }, [allModules, selectedProgram, visibleSides]);

    useEffect(() => {
        if (!selectedGeneKey) return;
        const stillVisible = allModules.some(
            (module) => visibleSides.has(module.side) && module.filteredGeneKeys.includes(selectedGeneKey),
        );
        if (!stillVisible) setSelectedGene(null);
    }, [allModules, selectedGeneKey, visibleSides]);

    useEffect(() => {
        if (!expandedAllGeneModuleKey) return;
        if (!isAllGeneMode) {
            setExpandedAllGeneModuleKey(null);
            return;
        }

        const stillVisible = allModules.some((module) => module.allGeneModuleKey === expandedAllGeneModuleKey);
        if (!stillVisible) {
            setExpandedAllGeneModuleKey(null);
        }
    }, [allModules, expandedAllGeneModuleKey, isAllGeneMode]);

    useEffect(() => {
        if (!expandedAllGeneModuleKey || !isAllGeneMode) return;

        const module = allModules.find((item) => item.allGeneModuleKey === expandedAllGeneModuleKey && item.allGeneExpanded);
        if (!module) return;

        const panelWidth = module.allGeneDetailPanelWidth || (
            module.side === 'regulator' ? graphLayout.rightRegulatorW : graphLayout.leftProgramW
        );
        const x = module.side === 'regulator' ? graphLayout.rightProgramX : module.xProgram;
        const bounds = {
            x: Math.max(0, x - 26),
            y: Math.max(0, module.yTop - 32),
            width: Math.min(SVG_WIDTH - x, panelWidth) + 52,
            height: module.height + 64,
        };
        const tallFocus = bounds.height > svgViewportHeight * 0.74;
        const paddingX = module.side === 'regulator'
            ? (tallFocus ? 76 : 116)
            : (tallFocus ? 82 : 104);
        const paddingY = tallFocus ? 30 : 54;
        const fitScale = Math.min(
            SVG_WIDTH / Math.max(1, bounds.width + (paddingX * 2)),
            svgViewportHeight / Math.max(1, bounds.height + (paddingY * 2)),
        );
        const preferredScale = module.side === 'regulator' ? 1.28 : 1.38;
        const targetScale = Math.min(preferredScale, Math.max(tallFocus ? 1.04 : 1.12, fitScale * 1.08));

        focusBounds(bounds, { width: SVG_WIDTH, height: svgViewportHeight }, {
            scale: targetScale,
            minScale: tallFocus ? 1.02 : 1.1,
            maxScale: module.side === 'regulator' ? 1.42 : 1.52,
            centerX: module.side === 'regulator'
                ? (graphLayout.allGeneRegulatorFocusCenterX ?? SVG_WIDTH / 2)
                : (graphLayout.allGeneProgramFocusCenterX ?? SVG_WIDTH / 2),
            paddingX,
            paddingY,
            durationMs: 620,
        });
    }, [allModules, expandedAllGeneModuleKey, focusBounds, graphLayout, isAllGeneMode, svgViewportHeight]);

    const toggleExpanded = useCallback((program, side) => {
        setExpandedPrograms((current) => {
            const next = new Set(current);
            const key = `${program}:${side}`;
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const handleSelectProgram = useCallback((program) => {
        if (shouldSuppressClick()) return;
        setSelectedProgram((current) => (current === program ? null : program));
        setSelectedGene(null);
    }, [shouldSuppressClick]);

    const handleSelectGene = useCallback((gene) => {
        if (shouldSuppressClick()) return;

        const nextKey = gene.highlightKey;
        setSelectedProgram(null);
        setSelectedGene((current) => (current?.highlightKey === nextKey ? null : gene));
    }, [shouldSuppressClick]);

    const clearSelection = useCallback(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
    }, []);

    const collapseAllGeneFocus = useCallback((options = {}) => {
        setExpandedAllGeneModuleKey(null);
        animateToTransform({ x: 0, y: 0, scale: 1 }, { durationMs: options.durationMs ?? 360 });
    }, [animateToTransform]);

    const handleGeneLimitChange = useCallback((nextLimit) => {
        setExpandedAllGeneModuleKey(null);
        setGeneLimit(nextLimit);
        reset();
    }, [reset]);

    const handleToggleAllGeneModule = useCallback((moduleKey) => {
        if (!moduleKey) return;

        const collapsing = expandedAllGeneModuleKey === moduleKey;
        setSelectedGene(null);
        setSelectedProgram(null);
        setExpandedAllGeneModuleKey(collapsing ? null : moduleKey);

        if (collapsing) {
            collapseAllGeneFocus({ durationMs: 360 });
        }
    }, [collapseAllGeneFocus, expandedAllGeneModuleKey]);

    const handleClearAllGeneFocus = useCallback(() => {
        if (!expandedAllGeneModuleKey) return;
        collapseAllGeneFocus({ durationMs: 360 });
    }, [collapseAllGeneFocus, expandedAllGeneModuleKey]);

    const openProgram = useCallback((program) => {
        if (!program) return;
        navigate(`/programs/${encodeURIComponent(program)}`);
    }, [navigate]);

    const openGene = useCallback((gene) => {
        const [label] = geneQueryCandidates(gene);
        if (!label) return;
        navigate(`/genes?query=${encodeURIComponent(label)}`);
    }, [navigate]);

    const selectedGeneOccurrences = useMemo(
        () => (selectedGeneKey ? (geneOccurrences.get(selectedGeneKey) || []) : []),
        [geneOccurrences, selectedGeneKey],
    );

    const traitDisplayLines = useMemo(() => {
        const label = traitLabel || graph?.traitNode?.label || fileId;
        return splitTraitTextLines(label, 18);
    }, [fileId, graph?.traitNode?.label, traitLabel]);
    const traitFontSize = useMemo(() => traitTextFontSize(traitDisplayLines, graphLayout), [graphLayout, traitDisplayLines]);
    const traitNodeHeightValue = useMemo(() => traitNodeHeight(traitDisplayLines, graphLayout), [graphLayout, traitDisplayLines]);

    if (isLoading) {
        return (
            <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error && !graph) {
        return <Alert severity="error">Failed to load gene association map.</Alert>;
    }

    if (!graph?.programs?.length) {
        return <Alert severity="info">No gene association map data available.</Alert>;
    }

    if (!afterFirstPaint) {
        return <Box sx={{ minHeight: 360 }} />;
    }

    return (
        <Stack spacing={2.5}>
            <UpdatingStatus active={isRefreshing} />
            <TraitProgramGraphCanvas
                clearSelection={clearSelection}
                exportFileName={fileId}
                graphLayout={graphLayout}
                geneLimit={geneLimit}
                geneLimitOptions={GENE_LIMIT_OPTIONS}
                isDragging={isDragging}
                isTransformAnimating={isTransformAnimating}
                transformAnimationMs={transformAnimationMs}
                leftLayout={leftLayout}
                expandedAllGeneModuleKey={expandedAllGeneModuleKey}
                onGeneLimitChange={handleGeneLimitChange}
                onClearAllGeneFocus={handleClearAllGeneFocus}
                onToggleAllGeneModule={handleToggleAllGeneModule}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onOpenGene={openGene}
                onOpenProgram={openProgram}
                onSelectGene={handleSelectGene}
                onSelectProgram={handleSelectProgram}
                onWheel={onWheel}
                resetView={reset}
                rightLayout={rightLayout}
                selectedGene={selectedGene}
                selectedGeneKey={selectedGeneKey}
                selectedGeneOccurrences={selectedGeneOccurrences}
                selectedProgram={selectedProgram}
                shouldSuppressClick={shouldSuppressClick}
                svgHeight={svgHeight}
                svgViewportHeight={svgViewportHeight}
                svgRef={svgRef}
                traitCenterY={traitCenterY}
                traitDisplayLines={traitDisplayLines}
                traitFontSize={traitFontSize}
                traitNodeHeightValue={traitNodeHeightValue}
                transform={transform}
                visibleSides={visibleSides}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
            />

            <TraitProgramGraphSummary
                title="Gene association summary"
                modules={summaryModules}
                side="program"
                selectedProgram={selectedProgram}
                selectedGeneKey={selectedGeneKey}
                onSelectProgram={handleSelectProgram}
                onSelectGene={handleSelectGene}
                onClearSelection={clearSelection}
                onToggleExpanded={toggleExpanded}
                onOpenProgram={openProgram}
                onOpenGene={openGene}
                sideMeta={SIDE_META.program}
                sideMetaMap={SIDE_META}
                programColor={programColor}
                programSelectionLabel={programSelectionLabel}
                effectColors={EFFECT_COLORS}
                effectSignFromGene={effectSignFromGene}
                edgeColorFromScore={edgeColorFromScore}
                formatNumber={formatNumber}
            />
        </Stack>
    );
}
