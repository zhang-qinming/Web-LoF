import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from '../lib/plotly';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    TextField,
    Typography,
    Slider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { RestartAlt, Hub, Search, Timeline } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    getCrossTraitMatrix,
    getCrossTraitStatus,
    getCrossTraitTargets,
    isCanceledRequest,
} from '../api/gwas';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    metricChipTone,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_PLOT_HEIGHT,
    sectionTitleSx,
    summaryChipSx,
    toolbarSx,
} from '../themeUtils';
import { StatePanel } from './PageScaffold';
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
        px: 1.2,
        py: 0.95,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.82),
    }), [theme.palette.background.paper, theme.palette.divider]);
    const currentTrait = useMemo(() => normalizeTraitOption({
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitLabel,
    }), [fileId, gwasId, traitLabel]);
    const [status, setStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [recommended, setRecommended] = useState([]);
    const [selectedTargets, setSelectedTargets] = useState([]);
    const [targetTraitCount, setTargetTraitCount] = useState(DEFAULT_TARGET_LIMIT);
    const [topGeneCount, setTopGeneCount] = useState(DEFAULT_TOP_GENES);
    const [appliedTargets, setAppliedTargets] = useState([]);
    const [appliedTopGeneCount, setAppliedTopGeneCount] = useState(DEFAULT_TOP_GENES);
    const [renderVersion, setRenderVersion] = useState(0);
    const [matrixPayload, setMatrixPayload] = useState(null);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [matrixError, setMatrixError] = useState(null);
    const appliedTargetIds = useMemo(
        () => appliedTargets.map((item) => item.file_id).filter(Boolean),
        [appliedTargets],
    );
    const hasRenderedMatrix = renderVersion > 0 && appliedTargets.length > 0;

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        setStatusLoading(true);
        setStatus(null);
        setTopGeneCount(DEFAULT_TOP_GENES);
        setTargetTraitCount(DEFAULT_TARGET_LIMIT);
        setAppliedTargets([]);
        setAppliedTopGeneCount(DEFAULT_TOP_GENES);
        setRenderVersion(0);
        setMatrixPayload(null);
        setMatrixError(null);
        setMatrixLoading(false);
        getCrossTraitStatus(fileId, { signal: controller.signal })
            .then((res) => {
                if (!cancelled && !controller.signal.aborted) setStatus(res);
            })
            .catch((error) => {
                if (isCanceledRequest(error)) return;
                if (!cancelled && !controller.signal.aborted) setStatus({ available: false });
            })
            .finally(() => {
                if (!cancelled && !controller.signal.aborted) setStatusLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [fileId]);

    useEffect(() => {
        if (!status?.available) return undefined;
        const controller = new AbortController();
        let cancelled = false;
        getCrossTraitTargets(fileId, { signal: controller.signal }).then((res) => {
            if (cancelled || controller.signal.aborted) return;
            const nextTargets = prependPinnedTrait(res?.targets || [], currentTrait);
            const nextCount = Math.min(DEFAULT_TARGET_LIMIT, Math.max(MIN_TARGET_LIMIT, nextTargets.length));
            setRecommended(nextTargets);
            setTargetTraitCount(nextCount);
            setSelectedTargets(nextTargets.slice(0, nextCount));
        }).catch((error) => {
            if (isCanceledRequest(error)) return;
            if (!cancelled && !controller.signal.aborted) setRecommended([]);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [currentTrait, fileId, status?.available]);

    useEffect(() => {
        if (!status?.available || !appliedTargets.length || renderVersion === 0) {
            setMatrixPayload(null);
            setMatrixError(null);
            return undefined;
        }

        const controller = new AbortController();
        let cancelled = false;
        setMatrixLoading(true);
        setMatrixError(null);
        getCrossTraitMatrix(fileId, {
            targetIds: appliedTargetIds,
            topGenes: appliedTopGeneCount,
            signal: controller.signal,
        }).then((res) => {
            if (!cancelled && !controller.signal.aborted) {
                setMatrixPayload(res);
            }
        }).catch((error) => {
            if (isCanceledRequest(error)) return;
            if (!cancelled) {
                setMatrixPayload(null);
                setMatrixError(error);
            }
        }).finally(() => {
            if (!cancelled && !controller.signal.aborted) setMatrixLoading(false);
        });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [appliedTargetIds, appliedTargets, appliedTopGeneCount, fileId, renderVersion, status?.available]);

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

    useEffect(() => {
        if (!status?.available) return;
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
        setMatrixError(null);
        setRenderVersion((value) => value + 1);
    }, [
        appliedTargets,
        appliedTopGeneCount,
        currentTrait,
        renderVersion,
        selectedTargets,
        status?.available,
        topGeneCount,
    ]);

    const plotData = useMemo(() => {
        if (!matrixPayload?.targets?.length || !matrixPayload?.genes?.length || !matrixPayload?.matrix?.length) return [];
        const maxAbs = Math.max(
            Math.abs(Number(matrixPayload?.summary?.valueRange?.min) || 0),
            Math.abs(Number(matrixPayload?.summary?.valueRange?.max) || 0),
            0.0001,
        );
        return [{
            type: 'heatmap',
            z: matrixPayload.matrix,
            x: matrixPayload.targets.map((target) => truncateLabel(target.trait_name, 24)),
            y: matrixPayload.genes.map((_, index) => index),
            text: matrixPayload.matrix.map((row, rowIndex) => row.map((value, colIndex) => {
                const gene = matrixPayload.genes[rowIndex];
                const target = matrixPayload.targets[colIndex];
                return [
                    `<b>${gene.gene || gene.ensg}</b>`,
                    `Source: ${matrixPayload.sourceTrait?.trait_name || traitLabel || fileId}`,
                    `Target: ${target.trait_name}`,
                    `post_mean: ${value == null ? 'NA' : Number(value).toFixed(4)}`,
                ].join('<br>');
            })),
            colorscale: [
                [0, '#527ea8'],
                [0.5, '#eef2f6'],
                [1, '#c96a43'],
            ],
            zmin: -maxAbs,
            zmax: maxAbs,
            zmid: 0,
            hoverinfo: 'text',
            hoverlabel: buildPlotHoverTone(theme, '#64748b', {
                bgAlpha: 0.18,
                borderAlpha: 0.32,
            }),
            showscale: true,
            colorbar: {
                title: { text: 'Gene effect (post_mean)', side: 'top', font: { size: 11 } },
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
        return Math.max(560, 180 + (geneRows * 18));
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={toolbarSx(theme, { alignItems: 'stretch' })}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            lg: 'minmax(260px, 1.1fr) minmax(240px, 280px) minmax(220px, 260px) auto',
                        },
                        gap: 1.15,
                        alignItems: 'stretch',
                        width: '100%',
                    }}
                >
                    <Box sx={{ ...toolbarPanelSx, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1 }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.35 }}>
                                Cross-trait Heatmap
                            </Typography>
                            <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                                Shared gene effects across selected traits
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                            <Chip icon={<Timeline />} label={`${matrixPayload?.summary?.topGenes || topGeneCount} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                            <Chip icon={<Hub />} label={`${selectedTargets.length.toLocaleString()} traits`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                            <Chip icon={<Search />} label={`${matrixPayload?.summary?.missingCells?.toLocaleString?.() || 0} missing`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                        </Box>
                    </Box>

                    <Box sx={toolbarPanelSx}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.7 }}>
                            Top related traits
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                            <Slider
                                size="small"
                                value={Math.min(targetTraitCount, relatedTraitSliderMax)}
                                min={MIN_TARGET_LIMIT}
                                max={relatedTraitSliderMax}
                                step={1}
                                marks={relatedTraitCountMarks}
                                onChange={(_, value) => applyTopRelatedTraitCount(Array.isArray(value) ? value[0] : value)}
                                sx={{ flex: 1, mt: 0.6, mb: 0.1 }}
                            />
                            <TextField
                                size="small"
                                value={Math.min(targetTraitCount, relatedTraitSliderMax)}
                                onChange={(event) => applyTopRelatedTraitCount(event.target.value)}
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
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.7 }}>
                            Gene rows
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                            <Slider
                                size="small"
                                value={topGeneCount}
                                min={MIN_TOP_GENES}
                                max={MAX_TOP_GENES}
                                step={5}
                                marks={[
                                    { value: MIN_TOP_GENES, label: String(MIN_TOP_GENES) },
                                    { value: 50, label: '50' },
                                    { value: MAX_TOP_GENES, label: String(MAX_TOP_GENES) },
                                ]}
                                onChange={(_, value) => setTopGeneCount(Array.isArray(value) ? value[0] : value)}
                                sx={{ flex: 1, mt: 0.6, mb: 0.1 }}
                            />
                            <TextField
                                size="small"
                                value={topGeneCount}
                                onChange={(event) => {
                                    const raw = Number.parseInt(event.target.value, 10);
                                    if (Number.isNaN(raw)) {
                                        setTopGeneCount(MIN_TOP_GENES);
                                        return;
                                    }
                                    setTopGeneCount(Math.min(MAX_TOP_GENES, Math.max(MIN_TOP_GENES, raw)));
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

                    <Box sx={{ ...toolbarPanelSx, display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'center' } }}>
                        <Button
                            variant="text"
                            startIcon={<RestartAlt />}
                            onClick={() => {
                                setTargetTraitCount(DEFAULT_TARGET_LIMIT);
                                setSelectedTargets(prependPinnedTrait(recommended, currentTrait).slice(0, DEFAULT_TARGET_LIMIT));
                                setTopGeneCount(DEFAULT_TOP_GENES);
                                setAppliedTargets([]);
                                setAppliedTopGeneCount(DEFAULT_TOP_GENES);
                                setRenderVersion(0);
                                setMatrixPayload(null);
                                setMatrixError(null);
                                setMatrixLoading(false);
                            }}
                            sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38, justifyContent: { xs: 'center', lg: 'flex-start' } }}
                        >
                            Reset
                        </Button>
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
                    {matrixLoading && (
                        <Box sx={{ minHeight: RESPONSIVE_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Loading cross-trait heatmap...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!matrixLoading && hasRenderedMatrix && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No heatmap values are available for the current target trait selection.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!matrixLoading && !hasRenderedMatrix && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">Select target traits above to view the heatmap.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!matrixLoading && plotData.length > 0 && (
                        <Box sx={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: { xs: `${plotMinWidth}px`, xl: '100%' } }}>
                                <Plot
                                    data={plotData}
                                    layout={layout}
                                    config={plotConfig}
                                    onClick={(event) => {
                                        const point = event?.points?.[0];
                                        const target = matrixPayload?.targets?.[point?.pointNumber?.[1] ?? point?.pointIndex];
                                        if (target?.file_id) navigate(`/trait/${encodeURIComponent(target.file_id)}`);
                                    }}
                                    useResizeHandler
                                    style={{ width: '100%', height: `${plotHeight}px` }}
                                />
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>

            <CrossTraitHeatmapTable payload={matrixPayload} fileId={fileId} />
        </Box>
    );
}
