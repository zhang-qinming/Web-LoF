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
    IconButton,
    Paper,
    Slider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    CompareArrows,
    DownloadOutlined,
    Hub,
    Refresh,
    RestartAlt,
    Search,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    getCrossTraitStatus,
    getCrossTraitTargets,
    getTraitCorrelation,
    isCanceledRequest,
} from '../api/gwas';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    compactToggleGroupSx,
    metricChipTone,
    panelSx,
    plotFrameSx,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_PLOT_HEIGHT,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableHeaderCellSx,
    stickyTableSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
    toolbarSx,
} from '../themeUtils';
import { StatePanel } from './PageScaffold';
import { downloadBlob } from '../utils/download';

const DEFAULT_TRAIT_LIMIT = 12;
const MIN_TRAIT_LIMIT = 2;
const MAX_TRAIT_LIMIT = 100;

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
        trait_name: traitName || id,
        correlation: option.correlation == null ? null : Number(option.correlation),
        shared_genes: option.shared_genes == null ? null : Number(option.shared_genes),
        selection_rank: option.selection_rank == null ? null : Number(option.selection_rank),
        selection_basis: option.selection_basis || null,
    };
}

function uniqueTraitOptions(items = []) {
    const seen = new Set();
    const list = [];
    items.forEach((item) => {
        const normalized = normalizeTraitOption(item);
        if (!normalized || seen.has(normalized.file_id)) return;
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

function formatCorrelation(value) {
    if (!Number.isFinite(value)) return 'NA';
    return `${value > 0 ? '+' : ''}${value.toFixed(4)}`;
}

function correlationTone(theme, value) {
    if (!Number.isFinite(value)) return metricChipTone(theme, 'subtle');
    if (value > 0.05) return metricChipTone(theme, 'warning');
    if (value < -0.05) return metricChipTone(theme, 'primary');
    return metricChipTone(theme, 'neutral');
}

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCorrelationCsv(payload) {
    const traits = payload?.traits || [];
    const header = ['Trait', 'Trait ID', ...traits.map((trait) => trait.trait_name || trait.file_id)];
    const lines = [
        header.map(escapeCsvValue).join(','),
        ...traits.map((trait, rowIndex) => [
            trait.trait_name || '',
            trait.file_id || '',
            ...(payload.matrix?.[rowIndex] || []).map((value) => value ?? ''),
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

export default function TraitCorrelation({ fileId, gwasId, traitLabel }) {
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
    const [statusError, setStatusError] = useState(null);
    const [statusAttempt, setStatusAttempt] = useState(0);
    const [recommended, setRecommended] = useState([]);
    const [selectedTraits, setSelectedTraits] = useState([]);
    const [targetTraitCount, setTargetTraitCount] = useState(DEFAULT_TRAIT_LIMIT);
    const [method, setMethod] = useState('spearman');
    const [appliedTraits, setAppliedTraits] = useState([]);
    const [appliedMethod, setAppliedMethod] = useState('spearman');
    const [renderVersion, setRenderVersion] = useState(0);
    const [payload, setPayload] = useState(null);
    const [correlationLoading, setCorrelationLoading] = useState(false);
    const [correlationError, setCorrelationError] = useState(null);
    const appliedTraitIds = useMemo(
        () => appliedTraits.map((item) => item.file_id).filter(Boolean),
        [appliedTraits],
    );
    const hasRenderedCorrelation = renderVersion > 0 && appliedTraits.length >= 2;

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        setStatusLoading(true);
        setStatusError(null);
        setStatus(null);
        setTargetTraitCount(DEFAULT_TRAIT_LIMIT);
        setAppliedTraits([]);
        setAppliedMethod('spearman');
        setRenderVersion(0);
        setPayload(null);
        setCorrelationError(null);
        setCorrelationLoading(false);
        getCrossTraitStatus(fileId, { signal: controller.signal })
            .then((result) => {
                if (!cancelled && !controller.signal.aborted) setStatus(result);
            })
            .catch((error) => {
                if (isCanceledRequest(error)) return;
                if (!cancelled && !controller.signal.aborted) setStatusError(error);
            })
            .finally(() => {
                if (!cancelled && !controller.signal.aborted) setStatusLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [fileId, statusAttempt]);

    useEffect(() => {
        if (!status?.available) return undefined;
        const controller = new AbortController();
        let cancelled = false;
        getCrossTraitTargets(fileId, { signal: controller.signal })
            .then((result) => {
                if (cancelled || controller.signal.aborted) return;
                const nextRecommended = prependPinnedTrait(result?.targets || [], currentTrait);
                const nextCount = Math.min(DEFAULT_TRAIT_LIMIT, Math.max(MIN_TRAIT_LIMIT, nextRecommended.length));
                setRecommended(nextRecommended);
                setTargetTraitCount(nextCount);
                setSelectedTraits(nextRecommended.slice(0, nextCount));
            })
            .catch((error) => {
                if (isCanceledRequest(error)) return;
                if (!cancelled && !controller.signal.aborted) setRecommended(prependPinnedTrait([], currentTrait));
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [currentTrait, fileId, status?.available]);

    useEffect(() => {
        if (!status?.available || appliedTraitIds.length < 2 || renderVersion === 0) {
            setPayload(null);
            setCorrelationError(null);
            return undefined;
        }

        const controller = new AbortController();
        let cancelled = false;
        setCorrelationLoading(true);
        setCorrelationError(null);
        getTraitCorrelation(fileId, {
            targetIds: appliedTraitIds,
            method: appliedMethod,
            signal: controller.signal,
        }).then((result) => {
            if (cancelled || controller.signal.aborted) return;
            setPayload(result);
        }).catch((error) => {
            if (isCanceledRequest(error)) return;
            if (!cancelled) {
                setPayload(null);
                setCorrelationError(error);
            }
        }).finally(() => {
            if (!cancelled && !controller.signal.aborted) setCorrelationLoading(false);
        });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [appliedMethod, appliedTraitIds, appliedTraits, fileId, renderVersion, status?.available]);

    const relatedTraitSliderMax = useMemo(
        () => Math.max(MIN_TRAIT_LIMIT, Math.min(MAX_TRAIT_LIMIT, recommended.length || MAX_TRAIT_LIMIT)),
        [recommended.length],
    );

    const applyTopRelatedTraitCount = useCallback((value) => {
        const nextCount = Math.min(
            relatedTraitSliderMax,
            Math.max(MIN_TRAIT_LIMIT, Number(value) || DEFAULT_TRAIT_LIMIT),
        );
        setTargetTraitCount(nextCount);
        setSelectedTraits(prependPinnedTrait(recommended, currentTrait).slice(0, nextCount));
    }, [currentTrait, recommended, relatedTraitSliderMax]);

    const relatedTraitCountMarks = useMemo(() => (
        [...new Set([MIN_TRAIT_LIMIT, DEFAULT_TRAIT_LIMIT, relatedTraitSliderMax])]
            .filter((value) => value >= MIN_TRAIT_LIMIT && value <= relatedTraitSliderMax)
            .map((value) => ({ value, label: String(value) }))
    ), [relatedTraitSliderMax]);

    useEffect(() => {
        if (!status?.available) return;
        const nextTraits = prependPinnedTrait(selectedTraits, currentTrait).slice(0, MAX_TRAIT_LIMIT);
        if (nextTraits.length < 2) return;
        const nextTraitKey = traitListKey(nextTraits);
        if (traitListKey(selectedTraits) !== nextTraitKey) {
            setSelectedTraits(nextTraits);
            return;
        }
        if (
            renderVersion > 0
            && traitListKey(appliedTraits) === nextTraitKey
            && method === appliedMethod
        ) {
            return;
        }
        setAppliedTraits(nextTraits);
        setAppliedMethod(method);
        setCorrelationError(null);
        setRenderVersion((value) => value + 1);
    }, [
        appliedMethod,
        appliedTraits,
        currentTrait,
        method,
        renderVersion,
        selectedTraits,
        status?.available,
    ]);

    const sourceCorrelationRows = useMemo(() => {
        const traits = payload?.traits || [];
        return traits.slice(1).map((trait, index) => ({
            trait,
            correlation: payload?.matrix?.[0]?.[index + 1] ?? null,
            sharedGenes: payload?.sharedGeneCounts?.[0]?.[index + 1] ?? 0,
        })).sort((a, b) => {
            if (a.correlation == null) return 1;
            if (b.correlation == null) return -1;
            return Math.abs(b.correlation) - Math.abs(a.correlation);
        });
    }, [payload]);

    const strongestSourceCorrelation = sourceCorrelationRows.find((row) => row.correlation != null);
    const displayedMethod = hasRenderedCorrelation ? (payload?.summary?.method || appliedMethod) : method;

    const plotData = useMemo(() => {
        const traits = payload?.traits || [];
        if (!traits.length || !payload?.matrix?.length) return [];
        const labels = traits.map((trait) => truncateLabel(trait.trait_name || trait.file_id, 25));
        const coefficientSymbol = displayedMethod === 'spearman' ? 'rho' : 'r';
        const showCellLabels = traits.length <= 14;
        const hovertext = payload.matrix.map((row, rowIndex) => row.map((value, colIndex) => {
            const rowTrait = traits[rowIndex];
            const colTrait = traits[colIndex];
            const sharedGenes = payload.sharedGeneCounts?.[rowIndex]?.[colIndex] ?? 0;
            return [
                `<b>${rowTrait.trait_name || rowTrait.file_id}</b>`,
                `vs. ${colTrait.trait_name || colTrait.file_id}`,
                `${displayedMethod === 'spearman' ? 'Spearman' : 'Pearson'} ${coefficientSymbol}: ${formatCorrelation(value)}`,
                `Shared genes: ${sharedGenes.toLocaleString()}`,
            ].join('<br>');
        }));
        const cellText = showCellLabels ? payload.matrix.map((row) => row.map((value) => (
            Number.isFinite(value) ? value.toFixed(2) : ''
        ))) : undefined;

        return [{
            type: 'heatmap',
            z: payload.matrix,
            x: labels,
            y: labels,
            text: cellText,
            hovertext,
            customdata: payload.sharedGeneCounts,
            texttemplate: showCellLabels ? '%{text}' : '',
            textfont: { size: traits.length <= 10 ? 11 : 9, color: theme.palette.text.primary },
            colorscale: [
                [0, '#3f78a8'],
                [0.5, '#f4f6f8'],
                [1, '#c45f3c'],
            ],
            zmin: -1,
            zmax: 1,
            zmid: 0,
            xgap: 1,
            ygap: 1,
            hovertemplate: '%{hovertext}<extra></extra>',
            hoverlabel: buildPlotHoverTone(theme, '#64748b', {
                bgAlpha: 0.2,
                borderAlpha: 0.34,
            }),
            showscale: true,
            colorbar: {
                title: {
                    text: displayedMethod === 'spearman' ? 'Effect-rank correlation' : 'Effect correlation',
                    side: 'top',
                    font: { size: 11 },
                },
                orientation: 'h',
                x: 0.99,
                xanchor: 'right',
                y: 1.015,
                yanchor: 'bottom',
                thickness: 10,
                len: 0.26,
                outlinewidth: 0,
                tickvals: [-1, -0.5, 0, 0.5, 1],
                ticktext: ['Opposite', '-0.5', '0', '+0.5', 'Aligned'],
                tickfont: { size: 10, color: theme.palette.text.secondary },
            },
        }];
    }, [displayedMethod, payload, theme]);

    const plotLayout = useMemo(() => ({
        autosize: true,
        margin: { l: 180, r: 26, t: 44, b: 160 },
        paper_bgcolor: chartTokens.paperBg,
        plot_bgcolor: chartTokens.plotBg,
        xaxis: {
            tickangle: -38,
            tickfont: { size: 11, color: theme.palette.text.secondary },
            automargin: true,
            showgrid: false,
            zeroline: false,
        },
        yaxis: {
            tickfont: { size: 11, color: theme.palette.text.secondary },
            automargin: true,
            autorange: 'reversed',
            showgrid: false,
            zeroline: false,
        },
        hovermode: 'closest',
    }), [
        chartTokens.paperBg,
        chartTokens.plotBg,
        theme.palette.text.secondary,
    ]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: {
            format: 'png',
            filename: `${fileId || 'trait'}-${displayedMethod}-effect-correlation`,
            width: 1600,
            height: 1200,
            scale: 2,
        },
    }), [displayedMethod, fileId]);

    const plotHeight = useMemo(
        () => Math.max(620, 320 + ((payload?.traits?.length || DEFAULT_TRAIT_LIMIT) * 30)),
        [payload?.traits?.length],
    );
    const plotMinWidth = useMemo(
        () => Math.max(880, 260 + ((payload?.traits?.length || DEFAULT_TRAIT_LIMIT) * 64)),
        [payload?.traits?.length],
    );

    if (statusLoading) {
        return (
            <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={46} />
            </Box>
        );
    }

    if (statusError) {
        return (
            <StatePanel
                severity="error"
                icon={CompareArrows}
                title="Failed to check Trait Correlation availability"
                message={statusError?.response?.data?.error || statusError.message || 'The availability request failed.'}
                minHeight={360}
            >
                <Button startIcon={<Refresh />} variant="outlined" onClick={() => setStatusAttempt((value) => value + 1)}>
                    Retry
                </Button>
            </StatePanel>
        );
    }

    if (!status?.available) {
        return (
            <StatePanel
                icon={CompareArrows}
                title="No Trait Correlation data"
                message="This trait does not have a gene-level posterior effect profile."
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
                            lg: 'minmax(280px, 1.2fr) minmax(240px, 280px) minmax(210px, 240px) auto',
                        },
                        gap: 1.15,
                        alignItems: 'stretch',
                        width: '100%',
                    }}
                >
                    <Box sx={{ ...toolbarPanelSx, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 1 }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', color: theme.palette.text.secondary, mb: 0.35 }}>
                                Trait Effect Correlation
                            </Typography>
                            <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                                Pairwise similarity of GeneBayes effect profiles
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                            <Chip
                                icon={<CompareArrows />}
                                label={displayedMethod === 'spearman' ? 'Spearman rho' : 'Pearson r'}
                                size="small"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))}
                            />
                            <Chip
                                icon={<Hub />}
                                label={`${payload?.summary?.traitCount || selectedTraits.length} traits`}
                                size="small"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                            />
                            <Chip
                                icon={<Search />}
                                label={`${payload?.summary?.sharedGeneRange?.min?.toLocaleString?.() || 0}+ shared genes`}
                                size="small"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'success'))}
                            />
                            {strongestSourceCorrelation && (
                                <Chip
                                    label={`max |corr| ${Math.abs(strongestSourceCorrelation.correlation).toFixed(3)}`}
                                    size="small"
                                    sx={summaryChipSx(theme, correlationTone(theme, strongestSourceCorrelation.correlation))}
                                />
                            )}
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
                                min={MIN_TRAIT_LIMIT}
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
                                        min: MIN_TRAIT_LIMIT,
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

                    <Box sx={{ ...toolbarPanelSx, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.7 }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'none', color: theme.palette.text.secondary }}>
                            Correlation method
                        </Typography>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={method}
                            onChange={(_, value) => value && setMethod(value)}
                            sx={compactToggleGroupSx(theme)}
                            aria-label="Correlation method"
                        >
                            <ToggleButton value="spearman">Spearman</ToggleButton>
                            <ToggleButton value="pearson">Pearson</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Box sx={{ ...toolbarPanelSx, display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', lg: 'center' } }}>
                        <Tooltip title="Reset trait selection and method">
                            <IconButton
                                aria-label="Reset correlation controls"
                                onClick={() => {
                                    setTargetTraitCount(DEFAULT_TRAIT_LIMIT);
                                    setSelectedTraits(prependPinnedTrait(recommended, currentTrait).slice(0, DEFAULT_TRAIT_LIMIT));
                                    setMethod('spearman');
                                    setAppliedTraits([]);
                                    setAppliedMethod('spearman');
                                    setRenderVersion(0);
                                    setPayload(null);
                                    setCorrelationError(null);
                                    setCorrelationLoading(false);
                                }}
                                sx={{ border: `1px solid ${theme.custom.border.soft}`, borderRadius: 1 }}
                            >
                                <RestartAlt />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            </Box>

            {correlationError && (
                <Alert
                    severity="error"
                    action={(
                        <Button color="inherit" size="small" onClick={() => setRenderVersion((value) => value + 1)}>
                            Retry
                        </Button>
                    )}
                >
                    {correlationError?.response?.data?.error || correlationError.message || 'Failed to calculate trait correlations.'}
                </Alert>
            )}

            <Card elevation={0} sx={plotFrameSx(theme)}>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {correlationLoading && (
                        <Box sx={{ minHeight: RESPONSIVE_PLOT_HEIGHT, display: 'grid', placeItems: 'center' }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <CircularProgress size={52} />
                                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                                    Calculating pairwise correlations...
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    {!correlationLoading && !correlationError && !hasRenderedCorrelation && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'grid', placeItems: 'center', px: 3 }}>
                            <Alert severity="info">Select at least two traits to view the correlation matrix.</Alert>
                        </Box>
                    )}

                    {!correlationLoading && !correlationError && hasRenderedCorrelation && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'grid', placeItems: 'center', px: 3 }}>
                            <Alert severity="info">No correlation values are available for the current trait selection.</Alert>
                        </Box>
                    )}

                    {!correlationLoading && !correlationError && plotData.length > 0 && (
                        <Box sx={{ overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: { xs: `${plotMinWidth}px`, md: '100%' } }}>
                                <Plot
                                    data={plotData}
                                    layout={plotLayout}
                                    config={plotConfig}
                                    onClick={(event) => {
                                        const point = event?.points?.[0];
                                        const columnIndex = point?.pointNumber?.[1];
                                        const target = payload?.traits?.[columnIndex];
                                        if (target?.file_id) navigate(`/trait/${encodeURIComponent(target.file_id)}?tab=trait-correlation`);
                                    }}
                                    useResizeHandler
                                    style={{ width: '100%', height: `${plotHeight}px` }}
                                />
                            </Box>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {sourceCorrelationRows.length > 0 && (
                <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
                    <Box sx={{
                        px: 1.75,
                        py: 1.15,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        backgroundColor: theme.custom.surface.raised,
                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                    }}>
                        <Box>
                            <Typography sx={sectionTitleSx(theme, { fontSize: '0.9rem' })}>
                                Correlation with {payload?.sourceTrait?.trait_name || traitLabel || fileId}
                            </Typography>
                        </Box>
                        <Tooltip title="Download correlation matrix as CSV">
                            <Button
                                size="small"
                                startIcon={<DownloadOutlined />}
                                onClick={() => downloadBlob(
                                    new Blob([buildCorrelationCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                                    `${fileId || 'trait'}-${displayedMethod}-effect-correlation.csv`,
                                )}
                                sx={{ textTransform: 'none', color: theme.palette.text.secondary }}
                            >
                                CSV
                            </Button>
                        </Tooltip>
                    </Box>
                    <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                        <Table stickyHeader size="small" sx={stickyTableSx(theme, { minWidth: 720 })}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={stickyTableHeaderCellSx(theme, tableTone(theme, 'neutral'))}>Trait</TableCell>
                                    <TableCell align="right" sx={stickyTableHeaderCellSx(theme, tableTone(theme, 'primary'), 'right')}>Correlation</TableCell>
                                    <TableCell align="right" sx={stickyTableHeaderCellSx(theme, tableTone(theme, 'success'), 'right')}>Shared genes</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sourceCorrelationRows.map((row, index) => (
                                    <TableRow
                                        hover
                                        key={row.trait.file_id}
                                        onClick={() => navigate(`/trait/${encodeURIComponent(row.trait.file_id)}?tab=trait-correlation`)}
                                        sx={{
                                            ...tableRowRevealSx(theme, index),
                                            cursor: 'pointer',
                                            '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                        }}
                                    >
                                        <TableCell sx={{ py: 0.85, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                                            <Typography sx={{ fontSize: '0.76rem', fontWeight: 680 }}>
                                                {row.trait.trait_name || row.trait.file_id}
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.66rem', color: theme.palette.text.secondary }}>
                                                {row.trait.file_id}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: 0.85, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                                            <Chip
                                                label={formatCorrelation(row.correlation)}
                                                size="small"
                                                sx={summaryChipSx(theme, correlationTone(theme, row.correlation))}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: 0.85, borderBottom: `1px solid ${theme.custom.border.soft}`, fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums' }}>
                                            {row.sharedGenes.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Box>
    );
}
