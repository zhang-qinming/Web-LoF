import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import TraitProgramGraphSummary from './TraitProgramGraphSummary';
import TraitProgramGraphCanvas from './traitProgramGraph/TraitProgramGraphCanvas';
import TraitProgramGraphControls from './traitProgramGraph/TraitProgramGraphControls';
import {
    buildModuleBlueprints,
    DEFAULT_MAX_GENES,
    EFFECT_COLORS,
    edgeColorFromScore,
    effectSignFromGene,
    formatNumber,
    GRAPH_BOTTOM_PADDING,
    GRAPH_TOP_PADDING,
    normalizeGeneLimit,
    positionModules,
    programColor,
    programSelectionLabel,
    SIDE_META,
    splitTraitTextLines,
    traitNodeHeight,
    traitTextFontSize,
    useGraphTransform,
} from './traitProgramGraph/shared';

export default function TraitProgramGraph({ fileId, traitLabel }) {
    const navigate = useNavigate();
    const { data, error, isLoading } = useSWR(
        fileId ? `/api/programs/${fileId}/graph` : null,
        fetcher,
    );
    const graph = data;
    const svgRef = useRef(null);

    const [gammaThreshold, setGammaThreshold] = useState(0);
    const [maxGenesPerProgram, setMaxGenesPerProgram] = useState(DEFAULT_MAX_GENES);
    const [discordantOnly, setDiscordantOnly] = useState(false);
    const [gammaSign, setGammaSign] = useState('all');
    const [sideFilter, setSideFilter] = useState('both');
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedGene, setSelectedGene] = useState(null);
    const [expandedPrograms, setExpandedPrograms] = useState(() => new Set());

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

    const filters = useMemo(() => ({
        gammaThreshold,
        maxGenesPerProgram: normalizeGeneLimit(maxGenesPerProgram),
        discordantOnly,
        gammaSign,
        sideFilter,
    }), [discordantOnly, gammaSign, gammaThreshold, maxGenesPerProgram, sideFilter]);

    useEffect(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
        setExpandedPrograms(new Set());
        reset();
    }, [fileId, reset]);

    const leftPrograms = useMemo(() => graph?.layout?.leftPrograms || [], [graph]);
    const rightPrograms = useMemo(() => graph?.layout?.rightPrograms || [], [graph]);
    const hiddenPrograms = useMemo(() => graph?.layout?.hiddenPrograms || [], [graph]);

    const leftBlueprint = useMemo(
        () => buildModuleBlueprints(leftPrograms, 'program', filters, expandedPrograms),
        [expandedPrograms, filters, leftPrograms],
    );
    const rightBlueprint = useMemo(
        () => buildModuleBlueprints(rightPrograms, 'regulator', filters, expandedPrograms),
        [expandedPrograms, filters, rightPrograms],
    );

    const svgHeight = useMemo(() => {
        const contentHeight = Math.max(leftBlueprint.contentHeight, rightBlueprint.contentHeight, 560);
        return Math.max(940, Math.ceil(contentHeight + GRAPH_TOP_PADDING + GRAPH_BOTTOM_PADDING));
    }, [leftBlueprint.contentHeight, rightBlueprint.contentHeight]);
    const traitCenterY = useMemo(() => Math.round(svgHeight / 2), [svgHeight]);

    const leftLayout = useMemo(
        () => positionModules(leftBlueprint.modules, 'program', traitCenterY),
        [leftBlueprint.modules, traitCenterY],
    );
    const rightLayout = useMemo(
        () => positionModules(rightBlueprint.modules, 'regulator', traitCenterY),
        [rightBlueprint.modules, traitCenterY],
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

    const visibleSides = useMemo(() => {
        if (sideFilter === 'program') return new Set(['program']);
        if (sideFilter === 'regulator') return new Set(['regulator']);
        return new Set(['program', 'regulator']);
    }, [sideFilter]);
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

        const nextKey = selectedGeneKey === gene.highlightKey ? null : gene.highlightKey;
        setSelectedProgram(null);
        setSelectedGene((current) => (current?.highlightKey === gene.highlightKey ? null : gene));

        if (!nextKey) return;

        setExpandedPrograms((current) => {
            const next = new Set(current);
            (graph?.programs || []).forEach((program) => {
                ['program', 'regulator'].forEach((side) => {
                    if ((program.genes[side] || []).some((entry) => entry.highlightKey === nextKey)) {
                        next.add(`${program.program}:${side}`);
                    }
                });
            });
            return next;
        });
    }, [graph, selectedGeneKey, shouldSuppressClick]);

    const clearSelection = useCallback(() => {
        setSelectedProgram(null);
        setSelectedGene(null);
    }, []);

    const openProgram = useCallback((program) => {
        if (!program) return;
        navigate(`/programs/${encodeURIComponent(program)}`);
    }, [navigate]);

    const openGene = useCallback((gene) => {
        const label = gene?.geneLabel || gene?.gene || gene?.ensg || gene?.highlightKey;
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
    const traitFontSize = useMemo(() => traitTextFontSize(traitDisplayLines), [traitDisplayLines]);
    const traitNodeHeightValue = useMemo(() => traitNodeHeight(traitDisplayLines), [traitDisplayLines]);

    const hiddenCollapsedCount = hiddenPrograms.filter((program) => program.collapsed || !program.hasOverlap).length;

    if (isLoading) {
        return (
            <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">Failed to load trait program graph.</Alert>;
    }

    if (!graph?.programs?.length) {
        return <Alert severity="info">No trait program graph data available.</Alert>;
    }

    return (
        <Stack spacing={2.5}>
            <TraitProgramGraphControls
                clearSelection={clearSelection}
                discordantOnly={discordantOnly}
                fileId={fileId}
                gammaSign={gammaSign}
                gammaThreshold={gammaThreshold}
                graph={graph}
                hiddenCollapsedCount={hiddenCollapsedCount}
                maxGenesPerProgram={maxGenesPerProgram}
                onDiscordantOnlyChange={setDiscordantOnly}
                onGammaSignChange={setGammaSign}
                onGammaThresholdChange={setGammaThreshold}
                onMaxGenesPerProgramChange={setMaxGenesPerProgram}
                onSelectedGeneClear={() => setSelectedGene(null)}
                onSelectedProgramClear={() => setSelectedProgram(null)}
                onSideFilterChange={setSideFilter}
                selectedGene={selectedGene}
                selectedGeneKey={selectedGeneKey}
                selectedGeneOccurrences={selectedGeneOccurrences}
                selectedProgram={selectedProgram}
                sideFilter={sideFilter}
                svgRef={svgRef}
            />

            <TraitProgramGraphCanvas
                clearSelection={clearSelection}
                isDragging={isDragging}
                leftLayout={leftLayout}
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
                    <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                        Module summary
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#667085', mb: 1.5 }}>
                        Select programs, compare scores, check filtered gene counts, and expand crowded modules.
                    </Typography>
                    <TraitProgramGraphSummary
                        title="Visible modules"
                        modules={summaryModules}
                        side="program"
                        selectedProgram={selectedProgram}
                        selectedGeneKey={selectedGeneKey}
                        onSelectProgram={handleSelectProgram}
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
