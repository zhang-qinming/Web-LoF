import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from '../lib/plotly';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import { alpha, useTheme } from '@mui/material/styles';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Hub from '@mui/icons-material/Hub';
import Search from '@mui/icons-material/Search';
import Timeline from '@mui/icons-material/Timeline';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    getCrossTraitMatrix,
    getCrossTraitStatus,
    getCrossTraitTargets,
} from '../api/gwas';
import { detailSummarySWRConfig, figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useDebouncedControlValue, useIdleRenderGate } from '../utils/renderScheduling';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    metricChipTone,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_PLOT_MAX_HEIGHT,
    RESPONSIVE_PLOT_HEIGHT,
    sectionTitleSx,
    summaryChipSx,
    toolbarSx,
} from '../themeUtils';
import { StatePanel, UpdatingStatus } from './PageScaffold';
import CrossTraitHeatmapTable from './CrossTraitHeatmapTable';

const DEFAULT_TOP_GENES = 25;
const MIN_TOP_GENES = 10;
const MAX_TOP_GENES = 100;
const DEFAULT_TARGET_LIMIT = 25;
const MIN_TARGET_LIMIT = 2;
const MAX_TARGET_LIMIT = 100;

function truncateLabel(value, maxLength = 28) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalizeTraitOption(option) {
    if (!option) return null;
    const fileId = String(option.file_id || '').trim();
    const gwasId = String(option.gwas_id || '').trim();
    const traitName = String(option.trait_name || '').trim();
    const id = fileId || gwasId;
    if (!id) return null;
    return {
        file_id: fileId || id,
        gwas_id: gwasId || id,
        trait_name: traitName || fileId || gwasId || id,
        n_sig: option.n_sig == null ? null : Number(option.n_sig),
        sample_size: option.sample_size == null ? null : Number(option.sample_size),
        selection_rank: option.selection_rank == null ? null : Number(option.selection_rank),
        selection_basis: option.selection_basis || null,
        correlation: option.correlation == null ? null : Number(option.correlation),
        shared_genes: option.shared_genes == null ? null : Number(option.shared_genes),
    };
}

function uniqueTraitOptions(items = []) {
    const seen = new Set();
    const list = [];
    items.forEach((item) => {
        const normalized = normalizeTraitOption(item);
        if (!normalized) return;
        if (seen.has(normalized.file_id)) return;
        seen.add(normalized.file_id);
        list.push(normalized);
    });
    return list;
}

function prependPinnedTrait(items = [], pinnedTrait) {
    if (!pinnedTrait) return uniqueTraitOptions(items);
    return uniqueTraitOptions([pinnedTrait, ...items]);
}

function traitListKey(items = []) {
    return items.map((item) => item?.file_id || '').filter(Boolean).join('|');
}

export default function CrossTraitHeatmap({ fileId, gwasId, traitLabel }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const chartTokens = chartLayoutTokens(theme);
    const toolbarPanelSx = useMemo(() => ({
        px: 1,
        py: 0.7,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.82),
    }), [theme.palette.background.paper, theme.palette.divider]);
    const currentTrait = useMemo(() => normalizeTraitOption({
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitLabel,
    }), [fileId, gwasId, traitLabel]);
    const [recommended, setRecommended] = useState([]);
    const [selectedTargets, setSelectedTargets] = useState([]);
    const [targetTraitCount, setTargetTraitCount] = useState(DEFAULT_TARGET_LIMIT);
    const [topGeneCount, setTopGeneCount] = useState(DEFAULT_TOP_GENES);
    const [appliedTargets, setAppliedTargets] = useState([]);
    const [appliedTopGeneCount, setAppliedTopGeneCount] = useState(DEFAULT_TOP_GENES);
    const [renderVersion, setRenderVersion] = useState(0);
    const appliedTargetIds = useMemo(
        () => appliedTargets.map((item) => item.file_id).filter(Boolean),
        [appliedTargets],
    );
    const hasRenderedMatrix = renderVersion > 0 && appliedTargets.length > 0;
    const statusKey = fileId ? ['cross-trait-status', fileId] : null;
    const statusResource = useCachedResourceState(
        useSWR(statusKey, ([, id]) => getCrossTraitStatus(id), detailSummarySWRConfig),
        { cacheKey: statusKey, retainPreviousData: true },
    );
    const {
        displayData: statusData,
        isInitialLoading: statusLoading,
        isRefreshing: statusRefreshing,
    } = statusResource;
    const status = statusData || { available: false };
    const targetsKey = status?.available && fileId ? ['cross-trait-targets', fileId] : null;
    const targetsResource = useCachedResourceState(
        useSWR(targetsKey, ([, id]) => getCrossTraitTargets(id), detailSummarySWRConfig),
        { cacheKey: targetsKey, retainPreviousData: true },
    );
    const { displayData: targetsData, isRefreshing: targetsRefreshing } = targetsResource;
    const matrixTargetKey = appliedTargetIds.join('|');
    const matrixKey = useMemo(() => (
        status?.available && hasRenderedMatrix
            ? ['cross-trait-matrix', fileId, matrixTargetKey, appliedTopGeneCount]
            : null
    ), [appliedTopGeneCount, fileId, hasRenderedMatrix, matrixTargetKey, status?.available]);
    const matrixResource = useCachedResourceState(
        useSWR(
            matrixKey,
            ([, id, targetKey, topGenes]) => getCrossTraitMatrix(id, {
                targetIds: targetKey.split('|').filter(Boolean),
                topGenes,
            }),
            figureResourceSWRConfig,
        ),
        { cacheKey: matrixKey, retainPreviousData: false },
    );
    const {
        displayData: matrixPayload,
        error: matrixError,
        isInitialLoading: matrixLoading,
        isRefreshing: matrixRefreshing,
    } = matrixResource;
    const afterFirstPaint = useAfterFirstPaint(matrixKey || 'cross-trait-heatmap-empty');

    useEffect(() => {
        setRecommended([]);
        setSelectedTargets([]);
        setTopGeneCount(DEFAULT_TOP_GENES);
        setTargetTraitCount(DEFAULT_TARGET_LIMIT);
        setAppliedTargets([]);
        setAppliedTopGeneCount(DEFAULT_TOP_GENES);
        setRenderVersion(0);
    }, [fileId]);

    useEffect(() => {
        if (!status?.available || !targetsData) return;
        const nextTargets = prependPinnedTrait(targetsData?.targets || [], currentTrait);
        const nextCount = Math.min(DEFAULT_TARGET_LIMIT, Math.max(MIN_TARGET_LIMIT, nextTargets.length));
        setRecommended(nextTargets);
        setTargetTraitCount(nextCount);
        setSelectedTargets(nextTargets.slice(0, nextCount));
    }, [currentTrait, status?.available, targetsData]);

    const relatedTraitSliderMax = useMemo(
        () => Math.max(MIN_TARGET_LIMIT, Math.min(MAX_TARGET_LIMIT, recommended.length || MAX_TARGET_LIMIT)),
        [recommended.length],
    );

    const applyTopRelatedTraitCount = useCallback((value) => {
        const nextCount = Math.min(
            relatedTraitSliderMax,
            Math.max(MIN_TARGET_LIMIT, Number(value) || DEFAULT_TARGET_LIMIT),
        );
        setTargetTraitCount(nextCount);
        setSelectedTargets(prependPinnedTrait(recommended, currentTrait).slice(0, nextCount));
    }, [currentTrait, recommended, relatedTraitSliderMax]);

    const relatedTraitCountMarks = useMemo(() => (
        [...new Set([MIN_TARGET_LIMIT, DEFAULT_TARGET_LIMIT, relatedTraitSliderMax])]
            .filter((value) => value >= MIN_TARGET_LIMIT && value <= relatedTraitSliderMax)
            .map((value) => ({ value, label: String(value) }))
    ), [relatedTraitSliderMax]);

    const commitTopGeneCount = useCallback((value) => {
        const nextValue = Math.min(
            MAX_TOP_GENES,
            Math.max(MIN_TOP_GENES, Number(value) || DEFAULT_TOP_GENES),
        );
        setTopGeneCount(nextValue);
    }, []);
    const [targetTraitCountDraft, setTargetTraitCountDraft, commitTargetTraitCount] = useDebouncedControlValue(
        targetTraitCount,
        applyTopRelatedTraitCount,
        { delay: 350 },
    );
    const [topGeneCountDraft, setTopGeneCountDraft, commitTopGeneCountDraft] = useDebouncedControlValue(
        topGeneCount,
        commitTopGeneCount,
        { delay: 350 },
    );
    const targetTraitCountDraftValue = Math.min(
        relatedTraitSliderMax,
        Math.max(MIN_TARGET_LIMIT, Number(targetTraitCountDraft) || MIN_TARGET_LIMIT),
    );
    const topGeneCountDraftValue = Math.min(
        MAX_TOP_GENES,
        Math.max(MIN_TOP_GENES, Number(topGeneCountDraft) || MIN_TOP_GENES),
    );
    const controlsPending = targetTraitCountDraftValue !== targetTraitCount || topGeneCountDraftValue !== topGeneCount;

    useEffect(() => {
        if (!status?.available || !targetsData || !selectedTargets.length) return;
        const nextTargets = prependPinnedTrait(selectedTargets, currentTrait).slice(0, MAX_TARGET_LIMIT);
        if (!nextTargets.length) return;
        const nextTargetKey = traitListKey(nextTargets);
        if (traitListKey(selectedTargets) !== nextTargetKey) {
            setSelectedTargets(nextTargets);
            return;
        }
        if (
            renderVersion > 0
            && traitListKey(appliedTargets) === nextTargetKey
            && topGeneCount === appliedTopGeneCount
        ) {
            return;
        }
        setAppliedTargets(nextTargets);
        setAppliedTopGeneCount(topGeneCount);
        setRenderVersion((value) => value + 1);
    }, [
        appliedTargets,
        appliedTopGeneCount,
        currentTrait,
        renderVersion,
        selectedTargets,
        status?.available,
        targetsData,
        topGeneCount,
    ]);

    const plotData = useMemo(() => {
        if (!matrixPayload?.targets?.length || !matrixPayload?.genes?.length || !matrixPayload?.matrix?.length) return [];
        const maxAbs = Math.max(
            Math.abs(Number(matrixPayload?.summary?.valueRange?.min) || 0),
            Math.abs(Number(matrixPayload?.summary?.valueRange?.max) || 0),
            0.0001,
        );
        const cellCount = (matrixPayload.targets.length || 0) * (matrixPayload.genes.length || 0);
        const compactHover = cellCount > 2500;
        return [{
            type: 'heatmap',
            z: matrixPayload.matrix,
            x: matrixPayload.targets.map((target) => truncateLabel(target.trait_name, 24)),
            y: matrixPayload.genes.map((_, index) => index),
            customdata: compactHover
                ? matrixPayload.matrix.map((row, rowIndex) => row.map((_, colIndex) => [
                    matrixPayload.genes[rowIndex]?.gene || matrixPayload.genes[rowIndex]?.ensg || `Gene ${rowIndex + 1}`,
                    matrixPayload.targets[colIndex]?.trait_name || matrixPayload.targets[colIndex]?.file_id || `Trait ${colIndex + 1}`,
                ]))
                : undefined,
            text: compactHover ? undefined : matrixPayload.matrix.map((row, rowIndex) => row.map((value, colIndex) => {
                const gene = matrixPayload.genes[rowIndex];
                const target = matrixPayload.targets[colIndex];
                return [
                    `<b>${gene.gene || gene.ensg}</b>`,
                    `Source: ${matrixPayload.sourceTrait?.trait_name || traitLabel || fileId}`,
                    `Target: ${target.trait_name}`,
                    `LoF effect (post_mean): ${value == null ? 'NA' : Number(value).toFixed(4)}`,
                ].join('<br>');
            })),
            hovertemplate: compactHover
                ? '<b>%{customdata[0]}</b><br>Target: %{customdata[1]}<br>LoF effect (post_mean): %{z:.4f}<extra></extra>'
                : undefined,
            colorscale: [
                [0, '#527ea8'],
                [0.5, '#eef2f6'],
                [1, '#c96a43'],
            ],
            zmin: -maxAbs,
            zmax: maxAbs,
            zmid: 0,
            hoverinfo: compactHover ? undefined : 'text',
            hoverlabel: buildPlotHoverTone(theme, '#64748b', {
                bgAlpha: 0.18,
                borderAlpha: 0.32,
            }),
            showscale: true,
            colorbar: {
                title: { text: 'Gene LoF effect (post_mean)', side: 'top', font: { size: 11 } },
                orientation: 'h',
                x: 0.99,
                xanchor: 'right',
                y: 1.015,
                yanchor: 'bottom',
                thickness: 10,
                len: 0.24,
                outlinewidth: 0,
                tickvals: [-maxAbs, 0, maxAbs],
                ticktext: [
                    `-${maxAbs.toFixed(2)}`,
                    '0',
                    `+${maxAbs.toFixed(2)}`,
                ],
                tickfont: { size: 10, color: theme.palette.text.secondary },
            },
        }];
    }, [fileId, matrixPayload, theme, traitLabel]);

    const yTickLabels = useMemo(
        () => (matrixPayload?.genes || []).map((gene) => truncateLabel(gene.gene || gene.ensg, 22)),
        [matrixPayload?.genes],
    );
    const yTickValues = useMemo(
        () => (matrixPayload?.genes || []).map((_, index) => index),
        [matrixPayload?.genes],
    );

    const layout = useMemo(() => ({
        autosize: true,
        margin: { l: 110, r: 26, t: 44, b: 112 },
        paper_bgcolor: chartTokens.paperBg,
        plot_bgcolor: chartTokens.plotBg,
        xaxis: {
            tickangle: -32,
            tickfont: { size: 11, color: theme.palette.text.secondary },
            side: 'bottom',
            automargin: true,
            showgrid: false,
            zeroline: false,
        },
        yaxis: {
            tickmode: 'array',
            tickvals: yTickValues,
            ticktext: yTickLabels,
            tickfont: { size: 11, color: theme.palette.text.secondary },
            automargin: true,
            showgrid: false,
            zeroline: false,
        },
        hovermode: 'closest',
    }), [chartTokens.paperBg, chartTokens.plotBg, theme.palette.text.secondary, yTickLabels, yTickValues]);

    const plotHeight = useMemo(() => {
        const geneRows = matrixPayload?.genes?.length || appliedTopGeneCount || topGeneCount;
        return Math.min(RESPONSIVE_PLOT_MAX_HEIGHT, Math.max(560, 180 + (geneRows * 18)));
    }, [appliedTopGeneCount, matrixPayload?.genes?.length, topGeneCount]);
    const plotMinWidth = useMemo(
        () => Math.max(960, 260 + ((matrixPayload?.targets?.length || appliedTargets.length || selectedTargets.length) * 56)),
        [appliedTargets.length, matrixPayload?.targets?.length, selectedTargets.length],
    );

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }), []);
    const matrixCellCount = (matrixPayload?.genes?.length || 0) * (matrixPayload?.targets?.length || 0);
    const plotRenderKey = useMemo(() => (
        matrixKey && matrixPayload
            ? [
                'cross-trait-heatmap',
                fileId,
                matrixTargetKey,
                appliedTopGeneCount,
                matrixPayload?.summary?.topGenes || 0,
                matrixPayload?.summary?.targetCount || 0,
                matrixCellCount,
            ].join(':')
            : 'cross-trait-heatmap-empty'
    ), [
        appliedTopGeneCount,
        fileId,
        matrixCellCount,
        matrixKey,
        matrixPayload,
        matrixTargetKey,
    ]);
    const [readyPlotKey, setReadyPlotKey] = useState(null);
    const plotReady = plotData.length > 0 && readyPlotKey === plotRenderKey;
    const matrixBusy = matrixLoading || controlsPending;

    useEffect(() => {
        setReadyPlotKey(null);
    }, [plotRenderKey]);

    const markPlotReady = useCallback(() => {
        setReadyPlotKey(plotRenderKey);
    }, [plotRenderKey]);

    const shouldRenderTable = useIdleRenderGate(
        !matrixBusy && afterFirstPaint && plotReady && Boolean(matrixPayload?.targets?.length && matrixPayload?.genes?.length),
        `${matrixKey || 'cross-trait-empty'}:${matrixCellCount}`,
        { delay: matrixCellCount > 2500 ? 650 : 180, timeout: 1800 },
    );

    if (statusLoading) {
        return (
            <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={46} />
            </Box>
        );
    }

    if (!status?.available) {
        return (
            <StatePanel
                icon={Hub}
                title="No Cross-trait Heatmap data"
                message="This trait does not have cross-trait heatmap data available."
                minHeight={360}
            />
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={toolbarSx(theme, { alignItems: 'stretch', px: 1.25, py: 0.85, gap: 0.75 })}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            lg: 'minmax(260px, 1.1fr) minmax(240px, 280px) minmax(260px, 320px)',
                        },
                        gap: 0.75,
                        alignItems: 'stretch',
                        width: '100%',
                    }}
                >
                    <Box sx={{ ...toolbarPanelSx, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 0.55 }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.15 }}>
                                Cross-trait Heatmap
                            </Typography>
                            <Typography sx={sectionTitleSx(theme, { fontSize: '0.96rem', lineHeight: 1.2 })}>
                                Shared gene effects across selected traits
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.45 }}>
                            <Chip icon={<Timeline />} label={`${matrixPayload?.summary?.topGenes || topGeneCount} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                            <Chip icon={<Hub />} label={`${selectedTargets.length.toLocaleString()} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                            <Chip icon={<Search />} label={`${matrixPayload?.summary?.missingCells?.toLocaleString?.() || 0} missing`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                            <UpdatingStatus active={statusRefreshing || targetsRefreshing || matrixRefreshing} />
                        </Box>
                    </Box>

                    <Box sx={toolbarPanelSx}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.4 }}>
                            Top related traits
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Slider
                                size="small"
                                value={targetTraitCountDraftValue}
                                min={MIN_TARGET_LIMIT}
                                max={relatedTraitSliderMax}
                                step={1}
                                marks={relatedTraitCountMarks}
                                onChange={(_, value) => setTargetTraitCountDraft(Array.isArray(value) ? value[0] : value)}
                                onChangeCommitted={(_, value) => commitTargetTraitCount(Array.isArray(value) ? value[0] : value)}
                                sx={{ flex: 1, mt: 0.35, mb: 0 }}
                            />
                            <TextField
                                size="small"
                                value={targetTraitCountDraftValue}
                                onChange={(event) => setTargetTraitCountDraft(event.target.value)}
                                slotProps={{
                                    htmlInput: {
                                        min: MIN_TARGET_LIMIT,
                                        max: relatedTraitSliderMax,
                                        step: 1,
                                        inputMode: 'numeric',
                                    },
                                }}
                                sx={{
                                    width: 72,
                                    '& .MuiInputBase-input': {
                                        textAlign: 'center',
                                        fontWeight: 700,
                                    },
                                }}
                            />
                        </Box>
                    </Box>

                    <Box sx={toolbarPanelSx}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75, mb: 0.4 }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary }}>
                                Gene rows
                            </Typography>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<RestartAlt />}
                                onClick={() => {
                                    setTargetTraitCount(DEFAULT_TARGET_LIMIT);
                                    setSelectedTargets(prependPinnedTrait(recommended, currentTrait).slice(0, DEFAULT_TARGET_LIMIT));
                                    setTopGeneCount(DEFAULT_TOP_GENES);
                                    setAppliedTargets([]);
                                    setAppliedTopGeneCount(DEFAULT_TOP_GENES);
                                    setRenderVersion(0);
                                }}
                                sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 28, py: 0, px: 0.5 }}
                            >
                                Reset
                            </Button>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Slider
                                size="small"
                                value={topGeneCountDraftValue}
                                min={MIN_TOP_GENES}
                                max={MAX_TOP_GENES}
                                step={5}
                                marks={[
                                    { value: MIN_TOP_GENES, label: String(MIN_TOP_GENES) },
                                    { value: 50, label: '50' },
                                    { value: MAX_TOP_GENES, label: String(MAX_TOP_GENES) },
                                ]}
                                onChange={(_, value) => setTopGeneCountDraft(Array.isArray(value) ? value[0] : value)}
                                onChangeCommitted={(_, value) => commitTopGeneCountDraft(Array.isArray(value) ? value[0] : value)}
                                sx={{ flex: 1, mt: 0.35, mb: 0 }}
                            />
                            <TextField
                                size="small"
                                value={topGeneCountDraftValue}
                                onChange={(event) => {
                                    const raw = Number.parseInt(event.target.value, 10);
                                    if (Number.isNaN(raw)) {
                                        setTopGeneCountDraft(MIN_TOP_GENES);
                                        return;
                                    }
                                    setTopGeneCountDraft(Math.min(MAX_TOP_GENES, Math.max(MIN_TOP_GENES, raw)));
                                }}
                                slotProps={{
                                    htmlInput: {
                                        min: MIN_TOP_GENES,
                                        max: MAX_TOP_GENES,
                                        step: 5,
                                        inputMode: 'numeric',
                                    },
                                }}
                                sx={{
                                    width: 72,
                                    '& .MuiInputBase-input': {
                                        textAlign: 'center',
                                        fontWeight: 700,
                                    },
                                }}
                            />
                        </Box>
                    </Box>
                </Box>
            </Box>

            {!selectedTargets.length && (
                <Alert severity="info">
                    Select at least one target trait to render the cross-trait heatmap.
                </Alert>
            )}

            {matrixError && (
                <Alert severity="error">
                    {matrixError.message || 'Failed to load cross-trait heatmap data.'}
                </Alert>
            )}

            <Card elevation={0} sx={plotFrameSx(theme)}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {matrixBusy && (
                        <Box sx={{ minHeight: RESPONSIVE_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    {matrixLoading ? 'Loading cross-trait heatmap...' : 'Updating cross-trait heatmap...'}
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!matrixBusy && hasRenderedMatrix && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No heatmap values are available for the current target trait selection.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!matrixBusy && !hasRenderedMatrix && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">Select target traits above to view the heatmap.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!matrixBusy && plotData.length > 0 && !afterFirstPaint && (
                        <Box sx={{ minHeight: plotHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Rendering cross-trait heatmap...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!matrixBusy && plotData.length > 0 && afterFirstPaint && !plotReady && (
                        <Box sx={{ minHeight: plotHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Rendering cross-trait heatmap...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!matrixBusy && plotData.length > 0 && afterFirstPaint && (
                        <Box sx={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: { xs: `${plotMinWidth}px`, xl: '100%' } }}>
                                <Plot
                                    key={plotRenderKey}
                                    data={plotData}
                                    layout={layout}
                                    config={plotConfig}
                                    onInitialized={markPlotReady}
                                    onUpdate={markPlotReady}
                                    onClick={(event) => {
                                        const point = event?.points?.[0];
                                        const target = matrixPayload?.targets?.[point?.pointNumber?.[1] ?? point?.pointIndex];
                                        if (target?.file_id) navigate(`/trait/${encodeURIComponent(target.file_id)}`);
                                    }}
                                    useResizeHandler
                                    style={{
                                        width: '100%',
                                        height: `${plotHeight}px`,
                                        opacity: plotReady ? 1 : 0,
                                        position: plotReady ? 'static' : 'absolute',
                                        inset: plotReady ? undefined : 0,
                                        pointerEvents: plotReady ? 'auto' : 'none',
                                    }}
                                />
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {shouldRenderTable && <CrossTraitHeatmapTable payload={matrixPayload} fileId={fileId} />}
        </Box>
    );
}
