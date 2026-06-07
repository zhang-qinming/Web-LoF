import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-basic-dist';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Stack,
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
    searchCrossTraits,
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

const DEFAULT_TOP_GENES = 30;
const MIN_TOP_GENES = 10;
const MAX_TOP_GENES = 100;
const DEFAULT_TARGET_LIMIT = 24;
const RECENT_STORAGE_KEY = 'cross-trait-heatmap-recent';
const MAX_RECENT = 12;

function truncateLabel(value, maxLength = 28) {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
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
        trait_name: traitName || gwasId || fileId || id,
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

function readRecentTraits() {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        const parsed = JSON.parse(raw || '[]');
        if (!Array.isArray(parsed)) return [];
        return uniqueTraitOptions(parsed).slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

function writeRecentTraits(items) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(uniqueTraitOptions(items).slice(0, MAX_RECENT)));
}

export default function CrossTraitHeatmap({ fileId, gwasId, traitLabel }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const chartTokens = chartLayoutTokens(theme);
    const currentTrait = useMemo(() => normalizeTraitOption({
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitLabel,
    }), [fileId, gwasId, traitLabel]);
    const [status, setStatus] = useState(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [recommended, setRecommended] = useState([]);
    const [selectedTargets, setSelectedTargets] = useState([]);
    const [topGeneCount, setTopGeneCount] = useState(DEFAULT_TOP_GENES);
    const [recentTargets, setRecentTargets] = useState(() => readRecentTraits());
    const [searchOptions, setSearchOptions] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [matrixPayload, setMatrixPayload] = useState(null);
    const [matrixLoading, setMatrixLoading] = useState(false);
    const [matrixError, setMatrixError] = useState(null);
    const selectedTargetIds = useMemo(
        () => selectedTargets.map((item) => item.file_id).filter(Boolean),
        [selectedTargets],
    );

    useEffect(() => {
        let cancelled = false;
        setStatusLoading(true);
        setStatus(null);
        setTopGeneCount(DEFAULT_TOP_GENES);
        getCrossTraitStatus(fileId)
            .then((res) => {
                if (!cancelled) setStatus(res);
            })
            .catch(() => {
                if (!cancelled) setStatus({ available: false });
            })
            .finally(() => {
                if (!cancelled) setStatusLoading(false);
            });
        return () => { cancelled = true; };
    }, [fileId]);

    useEffect(() => {
        if (!status?.available) return undefined;
        let cancelled = false;
        getCrossTraitTargets(fileId).then((res) => {
            if (cancelled) return;
            const nextTargets = prependPinnedTrait(res?.targets || [], currentTrait);
            setRecommended(nextTargets);
            setSelectedTargets(nextTargets.slice(0, DEFAULT_TARGET_LIMIT));
        }).catch(() => {
            if (!cancelled) setRecommended([]);
        });
        return () => { cancelled = true; };
    }, [currentTrait, fileId, status?.available]);

    useEffect(() => {
        const trimmed = searchInput.trim();
        if (trimmed.length < 2) {
            setSearchOptions([]);
            return undefined;
        }

        let cancelled = false;
        setSearchLoading(true);
        const timeoutId = window.setTimeout(() => {
            searchCrossTraits(trimmed, {
                limit: 12,
                excludeId: [fileId, gwasId, ...selectedTargetIds],
            }).then((res) => {
                if (!cancelled) setSearchOptions(uniqueTraitOptions(res?.traits || []));
            }).catch(() => {
                if (!cancelled) setSearchOptions([]);
            }).finally(() => {
                if (!cancelled) setSearchLoading(false);
            });
        }, 240);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [fileId, gwasId, searchInput, selectedTargetIds]);

    useEffect(() => {
        if (!status?.available || !selectedTargets.length) {
            setMatrixPayload(null);
            setMatrixError(null);
            return undefined;
        }

        let cancelled = false;
        setMatrixLoading(true);
        setMatrixError(null);
        getCrossTraitMatrix(fileId, {
            targetIds: selectedTargetIds,
            topGenes: topGeneCount,
        }).then((res) => {
            if (!cancelled) {
                setMatrixPayload(res);
                setRecentTargets((prev) => {
                    const nextRecent = uniqueTraitOptions([...selectedTargets, ...prev]);
                    writeRecentTraits(nextRecent);
                    return nextRecent;
                });
            }
        }).catch((error) => {
            if (!cancelled) {
                setMatrixPayload(null);
                setMatrixError(error);
            }
        }).finally(() => {
            if (!cancelled) setMatrixLoading(false);
        });
        return () => { cancelled = true; };
    }, [fileId, selectedTargetIds, selectedTargets, status?.available, topGeneCount]);

    const groupedOptions = useMemo(() => {
        const recommendIds = new Set(recommended.map((item) => item.file_id));
        const recentIds = new Set(recentTargets.map((item) => item.file_id));
        return prependPinnedTrait([
            ...recommended.map((item) => ({ ...item, group: 'Recommended' })),
            ...recentTargets
                .filter((item) => !recommendIds.has(item.file_id))
                .map((item) => ({ ...item, group: 'Recent' })),
            ...searchOptions
                .filter((item) => !recommendIds.has(item.file_id) && !recentIds.has(item.file_id))
                .map((item) => ({ ...item, group: 'Search' })),
        ], currentTrait);
    }, [currentTrait, recommended, recentTargets, searchOptions]);

    const plotData = useMemo(() => {
        if (!matrixPayload?.targets?.length || !matrixPayload?.genes?.length || !matrixPayload?.matrix?.length) return [];
        return [{
            type: 'heatmap',
            z: matrixPayload.matrix,
            x: matrixPayload.targets.map((target) => truncateLabel(target.trait_name, 24)),
            y: matrixPayload.genes.map((gene) => truncateLabel(gene.gene || gene.ensg, 22)),
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
            zmid: 0,
            hoverinfo: 'text',
            hoverlabel: buildPlotHoverTone(theme, '#64748b', {
                bgAlpha: 0.18,
                borderAlpha: 0.32,
            }),
            showscale: true,
            colorbar: {
                title: { text: 'post_mean', side: 'right' },
                thickness: 14,
                len: 0.72,
                outlinewidth: 0,
            },
        }];
    }, [fileId, matrixPayload, theme, traitLabel]);

    const layout = useMemo(() => ({
        autosize: true,
        title: {
            text: `${traitLabel || fileId} - Cross-trait Heatmap`,
            x: 0.01,
            font: { size: 18, family: theme.typography.fontFamily, color: theme.palette.text.primary },
        },
        margin: { l: 110, r: 60, t: 64, b: 120 },
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
            tickfont: { size: 11, color: theme.palette.text.secondary },
            automargin: true,
            showgrid: false,
            zeroline: false,
        },
        hovermode: 'closest',
    }), [chartTokens.paperBg, chartTokens.plotBg, fileId, theme.palette.text.primary, theme.palette.text.secondary, theme.typography.fontFamily, traitLabel]);

    const plotHeight = useMemo(() => {
        const geneRows = matrixPayload?.genes?.length || topGeneCount;
        return Math.min(1120, Math.max(560, 180 + (geneRows * 18)));
    }, [matrixPayload?.genes?.length, topGeneCount]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        modeBarButtonsToAdd: [{
            name: 'download',
            title: 'Download plot',
            icon: Plotly.Icons.disk,
            click: () => {},
        }],
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
            <Box sx={toolbarSx(theme)}>
                <Box sx={{ minWidth: 220, mr: 0.5 }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'none', color: theme.palette.text.secondary, mb: 0.35 }}>
                        Cross-trait Heatmap
                    </Typography>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                        Shared gene effects across selected traits
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        Rows are top genes from the current trait. The first column is always the current trait, followed by selected comparison traits.
                    </Typography>
                </Box>

                <Chip icon={<Timeline />} label={`${matrixPayload?.summary?.topGenes || topGeneCount} genes`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                <Chip icon={<Hub />} label={`${selectedTargets.length.toLocaleString()} targets`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                <Chip icon={<Search />} label={`${matrixPayload?.summary?.missingCells?.toLocaleString?.() || 0} missing`} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
            </Box>

            <Box sx={toolbarSx(theme, { alignItems: 'flex-start' })}>
                <Autocomplete
                    multiple
                    size="small"
                    options={groupedOptions}
                    filterSelectedOptions
                    limitTags={4}
                    loading={searchLoading}
                    value={selectedTargets}
                    groupBy={(option) => option.group || 'Selected'}
                    isOptionEqualToValue={(option, value) => option.file_id === value.file_id}
                    getOptionLabel={(option) => option.trait_name || option.file_id}
                    onChange={(_, value) => setSelectedTargets(prependPinnedTrait(value, currentTrait).slice(0, DEFAULT_TARGET_LIMIT))}
                    onInputChange={(_, value) => setSearchInput(value)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Target traits"
                            placeholder="Search traits"
                            helperText="The current trait stays first; recommended, recent, and search results are merged after it."
                        />
                    )}
                    sx={{
                        minWidth: 420,
                        maxWidth: 720,
                        flex: 1,
                        '& .MuiAutocomplete-inputRoot': {
                            alignItems: 'flex-start',
                            maxHeight: 168,
                            overflowY: 'auto',
                        },
                    }}
                />

                <Box
                    sx={{
                        width: 220,
                        minWidth: 220,
                        px: 1.2,
                        py: 0.85,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        backgroundColor: alpha(theme.palette.background.paper, 0.8),
                    }}
                >
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

                <Button
                    variant="text"
                    startIcon={<RestartAlt />}
                    onClick={() => {
                        setSelectedTargets(prependPinnedTrait(recommended, currentTrait).slice(0, DEFAULT_TARGET_LIMIT));
                        setTopGeneCount(DEFAULT_TOP_GENES);
                    }}
                    sx={{ textTransform: 'none', color: theme.palette.text.secondary, fontWeight: 600, minHeight: 38 }}
                >
                    Reset
                </Button>
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

                    {!matrixLoading && selectedTargets.length > 0 && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                            <Alert severity="info" sx={{ maxWidth: 760 }}>
                                <Typography variant="body2">No heatmap values are available for the current target trait selection.</Typography>
                            </Alert>
                        </Box>
                    )}

                    {!matrixLoading && plotData.length > 0 && (
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
                    )}
                </CardContent>
            </Card>

            {matrixPayload?.targets?.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {matrixPayload.targets.map((target) => (
                        <Chip
                            key={target.file_id}
                            label={truncateLabel(target.trait_name, 36)}
                            onClick={() => navigate(`/trait/${encodeURIComponent(target.file_id)}`)}
                            sx={{
                                borderRadius: 1,
                                backgroundColor: alpha(theme.palette.primary.main, 0.07),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                                color: theme.palette.text.primary,
                            }}
                        />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
