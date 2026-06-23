import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
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
    GRAPH_VIEW_MODES,
    positionModules,
    programColor,
    programSelectionLabel,
    SIDE_META,
    splitTraitTextLines,
    traitNodeHeight,
    traitTextFontSize,
    useGraphTransform,
} from './traitProgramGraph/shared';

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
    const [graphViewMode, setGraphViewMode] = useState(GRAPH_VIEW_MODES.compact);

    const {
        transform,
        isDragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onWheel,
        zoomIn,
        zoomOut,
        reset,
        shouldSuppressClick,
    } = useGraphTransform();

    const graphLayout = GRAPH_LAYOUTS[graphViewMode] || GRAPH_LAYOUTS.compact;
    const isFullGraph = graphViewMode === GRAPH_VIEW_MODES.full;

    const filters = useMemo(() => ({
        gammaThreshold: 0,
        maxGenesPerProgram: graphLayout.defaultMaxGenes,
        discordantOnly: false,
        gammaSign: 'all',
        sideFilter: 'both',
    }), [graphLayout.defaultMaxGenes]);

    useEffect(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
        setExpandedPrograms(new Set());
        setGraphViewMode(GRAPH_VIEW_MODES.compact);
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
    const traitCenterY = useMemo(() => Math.round(svgHeight / 2), [svgHeight]);

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

    const toggleGraphViewMode = useCallback(() => {
        setGraphViewMode((current) => (
            current === GRAPH_VIEW_MODES.full ? GRAPH_VIEW_MODES.compact : GRAPH_VIEW_MODES.full
        ));
        reset();
    }, [reset]);

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
        return <Alert severity="error">Failed to load trait program graph.</Alert>;
    }

    if (!graph?.programs?.length) {
        return <Alert severity="info">No trait program graph data available.</Alert>;
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
                isFullGraph={isFullGraph}
                isDragging={isDragging}
                leftLayout={leftLayout}
                onGraphViewModeToggle={toggleGraphViewMode}
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

            <Box sx={{ width: '100%' }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: 'rgba(15,23,42,0.10)' }}>
                    <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                        Module summary
                    </Typography>
                    <TraitProgramGraphSummary
                        title="Visible modules"
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
                </Paper>
            </Box>
        </Stack>
    );
}
