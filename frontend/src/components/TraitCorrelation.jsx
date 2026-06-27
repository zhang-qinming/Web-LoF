import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Plot from '../lib/plotly';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import CompareArrows from '@mui/icons-material/CompareArrows';
import Download from '@mui/icons-material/Download';
import Hub from '@mui/icons-material/Hub';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import Refresh from '@mui/icons-material/Refresh';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Search from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    getCrossTraitStatus,
    getCrossTraitTargets,
    getTraitCorrelation,
} from '../api/gwas';
import FigureLoadingPanel from './FigureLoadingPanel';
import { detailSummarySWRConfig, figureResourceSWRConfig } from '../utils/swrOptions';
import { useAfterFirstPaint } from '../utils/useAfterFirstPaint';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { useDebouncedControlValue, useIdleRenderGate } from '../utils/renderScheduling';
import {
    buildPlotHoverTone,
    chartLayoutTokens,
    compactToggleGroupSx,
    metricChipTone,
    RESPONSIVE_EMPTY_PLOT_HEIGHT,
    RESPONSIVE_PLOT_MAX_HEIGHT,
    RESPONSIVE_PLOT_HEIGHT,
    stickyTableContainerSx,
    stickyTableHeaderCellSx,
    stickyTableSx,
    summaryChipSx,
    tableToolbarActionButtonSx,
    tableToolbarGroupSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';
import { StatePanel, UpdatingStatus } from './PageScaffold';
import { downloadBlob } from '../utils/download';
import { compareValues, nextSortDirection } from '../utils/sort';

const DEFAULT_TRAIT_LIMIT = 12;
const MIN_TRAIT_LIMIT = 2;
const MAX_TRAIT_LIMIT = 100;
const CORRELATION_TABLE_COLUMNS = [
    { key: 'trait', label: 'Trait', align: 'left', tone: 'neutral', type: 'text', defaultDirection: 'asc' },
    { key: 'correlation', label: 'Correlation', align: 'right', tone: 'primary', type: 'number', defaultDirection: 'desc' },
    { key: 'sharedGenes', label: 'Shared genes', align: 'right', tone: 'success', type: 'number', defaultDirection: 'desc' },
];

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
    if (!Number.isFinite(value)) return '-';
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
            ...traits.map((_, colIndex) => payload.matrix?.[rowIndex]?.[colIndex] ?? ''),
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

export default function TraitCorrelation({ fileId, gwasId, traitLabel }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const chartTokens = chartLayoutTokens(theme);
    const currentTrait = useMemo(() => normalizeTraitOption({
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitLabel,
    }), [fileId, gwasId, traitLabel]);
    const [statusAttempt, setStatusAttempt] = useState(0);
    const [recommended, setRecommended] = useState([]);
    const [selectedTraits, setSelectedTraits] = useState([]);
    const [targetTraitCount, setTargetTraitCount] = useState(DEFAULT_TRAIT_LIMIT);
    const [method, setMethod] = useState('spearman');
    const [appliedTraits, setAppliedTraits] = useState([]);
    const [appliedMethod, setAppliedMethod] = useState('spearman');
    const [renderVersion, setRenderVersion] = useState(0);
    const [summarySortBy, setSummarySortBy] = useState('absCorrelation');
    const [summarySortDir, setSummarySortDir] = useState('desc');
    const appliedTraitIds = useMemo(
        () => appliedTraits.map((item) => item.file_id).filter(Boolean),
        [appliedTraits],
    );
    const hasRenderedCorrelation = renderVersion > 0 && appliedTraits.length >= 2;
    const statusKey = fileId ? ['trait-correlation-status', fileId, statusAttempt] : null;
    const statusResource = useCachedResourceState(
        useSWR(statusKey, ([, id]) => getCrossTraitStatus(id), detailSummarySWRConfig),
        { cacheKey: statusKey, retainPreviousData: true },
    );
    const {
        displayData: status,
        error: statusError,
        isInitialLoading: statusLoading,
        isRefreshing: statusRefreshing,
    } = statusResource;
    const targetsKey = status?.available && fileId ? ['trait-correlation-targets', fileId] : null;
    const targetsResource = useCachedResourceState(
        useSWR(targetsKey, ([, id]) => getCrossTraitTargets(id), detailSummarySWRConfig),
        { cacheKey: targetsKey, retainPreviousData: true },
    );
    const { displayData: targetsData, isRefreshing: targetsRefreshing } = targetsResource;
    const correlationTraitKey = appliedTraitIds.join('|');
    const correlationKey = status?.available && hasRenderedCorrelation
        ? ['trait-correlation', fileId, correlationTraitKey, appliedMethod]
        : null;
    const correlationResource = useCachedResourceState(
        useSWR(
            correlationKey,
            ([, id, targetKey, selectedMethod]) => getTraitCorrelation(id, {
                targetIds: targetKey.split('|').filter(Boolean),
                method: selectedMethod,
            }),
            figureResourceSWRConfig,
        ),
        { cacheKey: correlationKey, retainPreviousData: false },
    );
    const {
        displayData: payload,
        error: correlationError,
        isInitialLoading: correlationLoading,
        isRefreshing: correlationRefreshing,
    } = correlationResource;
    const afterFirstPaint = useAfterFirstPaint(correlationKey || 'trait-correlation-empty');

    useEffect(() => {
        setTargetTraitCount(DEFAULT_TRAIT_LIMIT);
        setAppliedTraits([]);
        setAppliedMethod('spearman');
        setRenderVersion(0);
    }, [fileId]);

    useEffect(() => {
        if (!status?.available || !targetsData) return;
        const nextRecommended = prependPinnedTrait(targetsData?.targets || [], currentTrait);
        const nextCount = Math.min(DEFAULT_TRAIT_LIMIT, Math.max(MIN_TRAIT_LIMIT, nextRecommended.length));
        setRecommended(nextRecommended);
        setTargetTraitCount(nextCount);
        setSelectedTraits(nextRecommended.slice(0, nextCount));
    }, [currentTrait, status?.available, targetsData]);

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
    const [targetTraitCountDraft, setTargetTraitCountDraft, commitTargetTraitCount] = useDebouncedControlValue(
        Math.min(targetTraitCount, relatedTraitSliderMax),
        applyTopRelatedTraitCount,
        { delay: 350 },
    );
    const targetTraitCountDraftValue = Math.min(
        relatedTraitSliderMax,
        Math.max(MIN_TRAIT_LIMIT, Number(targetTraitCountDraft) || MIN_TRAIT_LIMIT),
    );

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

    const rawSourceCorrelationRows = useMemo(() => {
        const traits = payload?.traits || [];
        return traits.slice(1).map((trait, index) => ({
            trait,
            correlation: payload?.matrix?.[0]?.[index + 1] ?? null,
            sharedGenes: payload?.sharedGeneCounts?.[0]?.[index + 1] ?? 0,
        }));
    }, [payload]);
    const sourceCorrelationRows = useMemo(() => {
        const rows = [...rawSourceCorrelationRows];
        return rows.sort((a, b) => {
            let result = 0;
            if (summarySortBy === 'trait') {
                result = compareValues(a.trait.trait_name || a.trait.file_id, b.trait.trait_name || b.trait.file_id, 'text', summarySortDir);
            } else if (summarySortBy === 'correlation') {
                result = compareValues(a.correlation, b.correlation, 'number', summarySortDir);
            } else if (summarySortBy === 'sharedGenes') {
                result = compareValues(a.sharedGenes, b.sharedGenes, 'number', summarySortDir);
            } else {
                result = compareValues(Math.abs(a.correlation ?? 0), Math.abs(b.correlation ?? 0), 'number', summarySortDir);
            }

            return result
                || compareValues(a.trait.trait_name || a.trait.file_id, b.trait.trait_name || b.trait.file_id, 'text', 'asc');
        });
    }, [rawSourceCorrelationRows, summarySortBy, summarySortDir]);

    const strongestSourceCorrelation = sourceCorrelationRows.find((row) => row.correlation != null);
    const displayedMethod = hasRenderedCorrelation ? (payload?.summary?.method || appliedMethod) : method;

    const plotData = useMemo(() => {
        const traits = payload?.traits || [];
        if (!traits.length || !payload?.matrix?.length) return [];
        const showTraitLabels = traits.length > 2;
        const labels = traits.map((trait, index) => {
            if (showTraitLabels) return truncateLabel(trait.trait_name || trait.file_id, 25);
            if (index === 0) return 'Source trait';
            return traits.length === 2 ? 'Target trait' : `Target ${index}`;
        });
        const coefficientSymbol = displayedMethod === 'spearman' ? 'rho' : 'r';
        const showCellLabels = traits.length <= 14;
        const compactHover = traits.length * traits.length > 2500;
        const hovertext = compactHover ? undefined : payload.matrix.map((row, rowIndex) => row.map((value, colIndex) => {
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
            hovertemplate: compactHover
                ? `<b>%{y}</b><br>vs. %{x}<br>${displayedMethod === 'spearman' ? 'Spearman' : 'Pearson'} ${coefficientSymbol}: %{z:.4f}<br>Shared genes: %{customdata}<extra></extra>`
                : '%{hovertext}<extra></extra>',
            hoverlabel: buildPlotHoverTone(theme, '#64748b', {
                bgAlpha: 0.2,
                borderAlpha: 0.34,
            }),
            showscale: true,
            colorbar: {
                title: {
                    text: displayedMethod === 'spearman' ? 'Spearman rho' : 'Pearson r',
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
        () => Math.min(RESPONSIVE_PLOT_MAX_HEIGHT, Math.max(620, 320 + ((payload?.traits?.length || DEFAULT_TRAIT_LIMIT) * 30))),
        [payload?.traits?.length],
    );
    const plotMinWidth = useMemo(
        () => Math.max(880, 260 + ((payload?.traits?.length || DEFAULT_TRAIT_LIMIT) * 64)),
        [payload?.traits?.length],
    );
    const shouldRenderTable = useIdleRenderGate(
        !correlationLoading && !correlationError && sourceCorrelationRows.length > 0 && afterFirstPaint,
        `${correlationKey || 'trait-correlation-empty'}:${sourceCorrelationRows.length}`,
        { delay: sourceCorrelationRows.length > 80 ? 450 : 180, timeout: 1600 },
    );

    const handleSummarySort = useCallback((column) => {
        setSummarySortDir((current) => nextSortDirection(summarySortBy, column.key, current, column.defaultDirection));
        setSummarySortBy(column.key);
    }, [summarySortBy]);

    if (statusLoading) {
        return (
            <FigureLoadingPanel
                minHeight={RESPONSIVE_EMPTY_PLOT_HEIGHT}
                message="Checking trait correlation availability..."
                size={46}
            />
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflowAnchor: 'none' }}>
            {/* CARD 1: Filters & Options */}
            <Card variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'divider', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', overflowAnchor: 'none' }}>
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: theme.custom?.surface?.subtle || 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={{ fontWeight: 680, fontSize: '0.9rem', color: 'text.primary', letterSpacing: '0.02em' }}>
                            Trait Correlation Controls
                        </Typography>
                        <Tooltip
                            title={
                                displayedMethod === 'spearman'
                                    ? 'Color legend shows Spearman rank correlation across shared GeneBayes effect profiles; negative values are opposite and positive values are aligned.'
                                    : 'Color legend shows Pearson correlation across shared GeneBayes effect profiles; negative values are opposite and positive values are aligned.'
                            }
                            arrow
                        >
                            <Box
                                component="span"
                                tabIndex={0}
                                aria-label="Trait correlation color legend details"
                                sx={{
                                    display: 'inline-flex',
                                    color: theme.palette.text.secondary,
                                    opacity: 0.78,
                                    cursor: 'help',
                                    '&:focus-visible': {
                                        outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                                        outlineOffset: 2,
                                        borderRadius: 1,
                                    },
                                }}
                            >
                                <InfoOutlined sx={{ fontSize: 14 }} />
                            </Box>
                        </Tooltip>
                    </Box>
                    <Box sx={tableToolbarGroupSx(theme)}>
                        <Button
                            size="small"
                            startIcon={<RestartAlt />}
                            onClick={() => {
                                setTargetTraitCount(DEFAULT_TRAIT_LIMIT);
                                setSelectedTraits(prependPinnedTrait(recommended, currentTrait).slice(0, DEFAULT_TRAIT_LIMIT));
                                setMethod('spearman');
                                setAppliedTraits([]);
                                setAppliedMethod('spearman');
                                setRenderVersion(0);
                            }}
                            sx={tableToolbarActionButtonSx(theme, 'neutral')}
                        >
                            Reset
                        </Button>
                        {hasRenderedCorrelation && payload && (
                            <Button
                                size="small"
                                startIcon={<Download />}
                                onClick={() => downloadBlob(
                                    new Blob([buildCorrelationCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                                    `${fileId || 'trait'}-${displayedMethod}-effect-correlation.csv`,
                                )}
                                sx={tableToolbarActionButtonSx(theme)}
                            >
                                Export CSV
                            </Button>
                        )}
                    </Box>
                </Box>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {/* Top Related Traits Slider */}
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary', fontSize: '0.76rem', textTransform: 'none', letterSpacing: 0, whiteSpace: 'nowrap' }}>
                                Related Traits:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 240 }}>
                                <Slider
                                    size="small"
                                    value={targetTraitCountDraftValue}
                                    min={MIN_TRAIT_LIMIT}
                                    max={relatedTraitSliderMax}
                                    step={1}
                                    marks={relatedTraitCountMarks}
                                    onChange={(_, value) => setTargetTraitCountDraft(Array.isArray(value) ? value[0] : value)}
                                    onChangeCommitted={(_, value) => commitTargetTraitCount(Array.isArray(value) ? value[0] : value)}
                                    sx={{ flex: 1, '& .MuiSlider-thumb': { width: 13, height: 13 } }}
                                />
                                <TextField
                                    size="small"
                                    value={targetTraitCountDraftValue}
                                    onChange={(event) => setTargetTraitCountDraft(event.target.value)}
                                    slotProps={{
                                        htmlInput: {
                                            min: MIN_TRAIT_LIMIT,
                                            max: relatedTraitSliderMax,
                                            step: 1,
                                            inputMode: 'numeric',
                                        },
                                    }}
                                    sx={{
                                        width: 58,
                                        '& .MuiInputBase-input': {
                                            textAlign: 'center',
                                            fontWeight: 700,
                                            py: 0.5,
                                        },
                                    }}
                                />
                            </Box>
                        </Stack>

                        {/* Correlation Method */}
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary', fontSize: '0.76rem', textTransform: 'none', letterSpacing: 0, whiteSpace: 'nowrap' }}>
                                Method:
                            </Typography>
                            <ToggleButtonGroup
                                exclusive
                                size="small"
                                value={method}
                                onChange={(_, value) => value && setMethod(value)}
                                sx={[
                                    compactToggleGroupSx(theme),
                                    {
                                        '& .MuiToggleButton-root': {
                                            px: 1.25,
                                            py: 0.35,
                                            fontSize: '0.78rem',
                                        },
                                    },
                                ]}
                                aria-label="Correlation method"
                            >
                                <ToggleButton value="spearman">Spearman</ToggleButton>
                                <ToggleButton value="pearson">Pearson</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                    </Box>

                </CardContent>
            </Card>

            {correlationError && (
                <Alert
                    severity="error"
                    action={(
                        <Button color="inherit" size="small" onClick={() => { void correlationResource.mutate(); }}>
                            Retry
                        </Button>
                    )}
                >
                    {correlationError?.response?.data?.error || correlationError.message || 'Failed to calculate trait correlations.'}
                </Alert>
            )}

            {/* CARD 2: Correlation Heatmap Frame */}
            <Card variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'divider', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', overflowAnchor: 'none' }}>
                <Box sx={{ px: 2.5, py: 1.2, bgcolor: theme.custom?.surface?.subtle || 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" alignItems="center">
                        <Typography sx={{ fontWeight: 680, fontSize: '0.9rem', color: 'text.primary', letterSpacing: '0.02em' }}>
                            Trait Correlation Matrix
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mr: 0.5, fontSize: '0.74rem' }}>
                                Summary Stats:
                            </Typography>
                            <Chip
                                icon={<CompareArrows sx={{ fontSize: '14px !important' }} />}
                                label={displayedMethod === 'spearman' ? 'Spearman rho' : 'Pearson r'}
                                size="small"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))}
                            />
                            <Chip
                                icon={<Hub sx={{ fontSize: '14px !important' }} />}
                                label={`${payload?.summary?.traitCount || selectedTraits.length} traits`}
                                size="small"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                            />
                            <Chip
                                icon={<Search sx={{ fontSize: '14px !important' }} />}
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
                        </Stack>
                    </Stack>
                    <UpdatingStatus active={statusRefreshing || targetsRefreshing || correlationRefreshing} />
                </Box>
                <CardContent sx={{ p: 0, position: 'relative' }}>
                    {correlationLoading && (
                        <FigureLoadingPanel
                            minHeight={RESPONSIVE_PLOT_HEIGHT}
                            message="Calculating pairwise correlations..."
                        />
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

                    {!correlationLoading && !correlationError && plotData.length > 0 && !afterFirstPaint && (
                        <FigureLoadingPanel
                            minHeight={plotHeight}
                            message="Rendering trait correlation matrix..."
                        />
                    )}

                    {!correlationLoading && !correlationError && plotData.length > 0 && afterFirstPaint && (
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

            {shouldRenderTable && (
                <Card variant="outlined" sx={{ borderRadius: 1.5, borderColor: 'divider', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', overflowAnchor: 'none' }}>
                    <Box sx={{
                        px: 2.5,
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        bgcolor: theme.custom?.surface?.subtle || 'grey.50',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}>
                        <Typography sx={{ fontWeight: 680, fontSize: '0.9rem', color: 'text.primary', letterSpacing: '0.02em' }}>
                            {sourceCorrelationRows.length <= 1
                                ? 'Correlation summary'
                                : `Correlation with ${payload?.sourceTrait?.trait_name || traitLabel || fileId}`}
                        </Typography>
                    </Box>
                    <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                        <Table stickyHeader size="small" sx={stickyTableSx(theme, { minWidth: 720 })}>
                            <TableHead>
                                <TableRow>
                                    {CORRELATION_TABLE_COLUMNS.map((column) => (
                                        <TableCell
                                            key={column.key}
                                            align={column.align}
                                            sx={stickyTableHeaderCellSx(theme, tableTone(theme, column.tone), column.align)}
                                        >
                                            <TableSortLabel
                                                active={summarySortBy === column.key}
                                                direction={summarySortBy === column.key ? summarySortDir : column.defaultDirection}
                                                onClick={() => handleSummarySort(column)}
                                                sx={{
                                                    justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
                                                    width: '100%',
                                                    fontSize: 'inherit',
                                                }}
                                            >
                                                {column.label}
                                            </TableSortLabel>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sourceCorrelationRows.map((row, index) => {
                                    const traitLabelText = row.trait.trait_name || row.trait.file_id;
                                    const showTraitId = row.trait.file_id && row.trait.file_id !== traitLabelText;

                                    return (
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
                                            <TableCell align="left" sx={{ py: 0.85, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                                                <Typography sx={{ fontSize: '0.76rem', fontWeight: 680 }}>
                                                    {traitLabelText}
                                                </Typography>
                                                {showTraitId && (
                                                    <Typography sx={{ fontSize: '0.66rem', color: theme.palette.text.secondary }}>
                                                        {row.trait.file_id}
                                                    </Typography>
                                                )}
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
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            )}
        </Box>
    );
}
