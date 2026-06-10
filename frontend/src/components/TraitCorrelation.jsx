import React, { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
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
    searchCrossTraits,
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
const MAX_TRAIT_LIMIT = 24;
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
        trait_name: traitName || id,
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

function readRecentTraits() {
    if (typeof window === 'undefined') return [];
    try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? uniqueTraitOptions(parsed).slice(0, MAX_RECENT) : [];
    } catch {
        return [];
    }
}

function writeRecentTraits(items) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
        RECENT_STORAGE_KEY,
        JSON.stringify(uniqueTraitOptions(items).slice(0, MAX_RECENT)),
    );
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
    const [recentTraits, setRecentTraits] = useState(() => readRecentTraits());
    const [selectedTraits, setSelectedTraits] = useState([]);
    const [searchOptions, setSearchOptions] = useState([]);
    const [searchInput, setSearchInput] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [method, setMethod] = useState('spearman');
    const [payload, setPayload] = useState(null);
    const [correlationLoading, setCorrelationLoading] = useState(false);
    const [correlationError, setCorrelationError] = useState(null);
    const selectedTraitIds = useMemo(
        () => selectedTraits.map((item) => item.file_id).filter(Boolean),
        [selectedTraits],
    );

    useEffect(() => {
        let cancelled = false;
        setStatusLoading(true);
        setStatusError(null);
        setStatus(null);
        getCrossTraitStatus(fileId)
            .then((result) => {
                if (!cancelled) setStatus(result);
            })
            .catch((error) => {
                if (!cancelled) setStatusError(error);
            })
            .finally(() => {
                if (!cancelled) setStatusLoading(false);
            });
        return () => { cancelled = true; };
    }, [fileId, statusAttempt]);

    useEffect(() => {
        if (!status?.available) return undefined;
        let cancelled = false;
        getCrossTraitTargets(fileId)
            .then((result) => {
                if (cancelled) return;
                const nextRecommended = prependPinnedTrait(result?.targets || [], currentTrait);
                setRecommended(nextRecommended);
                setSelectedTraits(nextRecommended.slice(0, DEFAULT_TRAIT_LIMIT));
            })
            .catch(() => {
                if (!cancelled) setRecommended(prependPinnedTrait([], currentTrait));
            });
        return () => { cancelled = true; };
    }, [currentTrait, fileId, status?.available]);

    useEffect(() => {
        const query = searchInput.trim();
        if (query.length < 2) {
            setSearchOptions([]);
            return undefined;
        }

        let cancelled = false;
        setSearchLoading(true);
        const timerId = window.setTimeout(() => {
            searchCrossTraits(query, {
                limit: 12,
                excludeId: [fileId, gwasId, ...selectedTraitIds],
            }).then((result) => {
                if (!cancelled) setSearchOptions(uniqueTraitOptions(result?.traits || []));
            }).catch(() => {
                if (!cancelled) setSearchOptions([]);
            }).finally(() => {
                if (!cancelled) setSearchLoading(false);
            });
        }, 240);

        return () => {
            cancelled = true;
            window.clearTimeout(timerId);
        };
    }, [fileId, gwasId, searchInput, selectedTraitIds]);

    useEffect(() => {
        if (!status?.available || selectedTraitIds.length < 2) {
            setPayload(null);
            setCorrelationError(null);
            return undefined;
        }

        let cancelled = false;
        setCorrelationLoading(true);
        setCorrelationError(null);
        getTraitCorrelation(fileId, {
            targetIds: selectedTraitIds,
            method,
        }).then((result) => {
            if (cancelled) return;
            setPayload(result);
            setRecentTraits((previous) => {
                const nextRecent = uniqueTraitOptions([...selectedTraits, ...previous]);
                writeRecentTraits(nextRecent);
                return nextRecent;
            });
        }).catch((error) => {
            if (!cancelled) {
                setPayload(null);
                setCorrelationError(error);
            }
        }).finally(() => {
            if (!cancelled) setCorrelationLoading(false);
        });

        return () => { cancelled = true; };
    }, [fileId, method, selectedTraitIds, selectedTraits, status?.available]);

    const groupedOptions = useMemo(() => {
        const recommendedIds = new Set(recommended.map((item) => item.file_id));
        const recentIds = new Set(recentTraits.map((item) => item.file_id));
        return prependPinnedTrait([
            ...recommended.map((item) => ({ ...item, group: 'Recommended' })),
            ...recentTraits
                .filter((item) => !recommendedIds.has(item.file_id))
                .map((item) => ({ ...item, group: 'Recent' })),
            ...searchOptions
                .filter((item) => !recommendedIds.has(item.file_id) && !recentIds.has(item.file_id))
                .map((item) => ({ ...item, group: 'Search' })),
        ], currentTrait);
    }, [currentTrait, recentTraits, recommended, searchOptions]);

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

    const plotData = useMemo(() => {
        const traits = payload?.traits || [];
        if (!traits.length || !payload?.matrix?.length) return [];
        const labels = traits.map((trait) => truncateLabel(trait.trait_name || trait.file_id, 25));
        const coefficientSymbol = method === 'spearman' ? 'ρ' : 'r';
        const hovertext = payload.matrix.map((row, rowIndex) => row.map((value, colIndex) => {
            const rowTrait = traits[rowIndex];
            const colTrait = traits[colIndex];
            const sharedGenes = payload.sharedGeneCounts?.[rowIndex]?.[colIndex] ?? 0;
            return [
                `<b>${rowTrait.trait_name || rowTrait.file_id}</b>`,
                `vs. ${colTrait.trait_name || colTrait.file_id}`,
                `${method === 'spearman' ? 'Spearman' : 'Pearson'} ${coefficientSymbol}: ${formatCorrelation(value)}`,
                `Shared genes: ${sharedGenes.toLocaleString()}`,
            ].join('<br>');
        }));
        const cellText = payload.matrix.map((row) => row.map((value) => (
            Number.isFinite(value) ? value.toFixed(2) : ''
        )));

        return [{
            type: 'heatmap',
            z: payload.matrix,
            x: labels,
            y: labels,
            text: cellText,
            hovertext,
            customdata: payload.sharedGeneCounts,
            texttemplate: traits.length <= 14 ? '%{text}' : '',
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
                    text: method === 'spearman' ? 'Effect-rank correlation' : 'Effect correlation',
                    side: 'top',
                    font: { size: 11 },
                },
                orientation: 'h',
                x: 0.99,
                xanchor: 'right',
                y: 1.055,
                yanchor: 'bottom',
                thickness: 10,
                len: 0.3,
                outlinewidth: 0,
                tickvals: [-1, -0.5, 0, 0.5, 1],
                ticktext: ['Opposite', '-0.5', '0', '+0.5', 'Aligned'],
                tickfont: { size: 10, color: theme.palette.text.secondary },
            },
        }];
    }, [method, payload, theme]);

    const plotLayout = useMemo(() => ({
        autosize: true,
        title: {
            text: `${traitLabel || fileId} - Trait Effect Correlation`,
            x: 0.01,
            font: {
                size: 18,
                family: theme.typography.fontFamily,
                color: theme.palette.text.primary,
            },
        },
        margin: { l: 180, r: 28, t: 94, b: 170 },
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
        fileId,
        theme.palette.text.primary,
        theme.palette.text.secondary,
        theme.typography.fontFamily,
        traitLabel,
    ]);

    const plotConfig = useMemo(() => ({
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        toImageButtonOptions: {
            format: 'png',
            filename: `${fileId || 'trait'}-${method}-effect-correlation`,
            width: 1600,
            height: 1200,
            scale: 2,
        },
    }), [fileId, method]);

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
            <Box sx={toolbarSx(theme)}>
                <Box sx={{ minWidth: 240, flex: '1 1 420px' }}>
                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.16em', color: theme.palette.text.secondary, mb: 0.35 }}>
                        Trait Effect Correlation
                    </Typography>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1.02rem', lineHeight: 1.25 })}>
                        Pairwise similarity of GeneBayes effect profiles
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontSize: '0.79rem', lineHeight: 1.45, mt: 0.25 }}>
                        Calculated from shared-gene post_mean values. This is a gene-effect profile comparison, not LDSC genetic correlation.
                    </Typography>
                </Box>
                <Chip
                    icon={<CompareArrows />}
                    label={method === 'spearman' ? 'Spearman ρ' : 'Pearson r'}
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

            <Box sx={toolbarSx(theme, { alignItems: 'flex-start' })}>
                <Autocomplete
                    multiple
                    size="small"
                    options={groupedOptions}
                    filterSelectedOptions
                    limitTags={4}
                    loading={searchLoading}
                    value={selectedTraits}
                    groupBy={(option) => option.group || 'Selected'}
                    isOptionEqualToValue={(option, value) => option.file_id === value.file_id}
                    getOptionLabel={(option) => option.trait_name || option.file_id}
                    onChange={(_, value) => setSelectedTraits(
                        prependPinnedTrait(value, currentTrait).slice(0, MAX_TRAIT_LIMIT),
                    )}
                    onInputChange={(_, value) => setSearchInput(value)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Traits"
                            placeholder="e.g. GCST90081631"
                            helperText={`Select up to ${MAX_TRAIT_LIMIT} traits; the current trait remains first.`}
                        />
                    )}
                    sx={{
                        minWidth: { xs: '100%', md: 440 },
                        maxWidth: 760,
                        flex: '1 1 520px',
                        '& .MuiAutocomplete-inputRoot': {
                            alignItems: 'flex-start',
                            maxHeight: 168,
                            overflowY: 'auto',
                        },
                    }}
                />

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

                <Tooltip title="Reset trait selection and method">
                    <IconButton
                        aria-label="Reset correlation controls"
                        onClick={() => {
                            setSelectedTraits(prependPinnedTrait(recommended, currentTrait).slice(0, DEFAULT_TRAIT_LIMIT));
                            setMethod('spearman');
                        }}
                        sx={{ border: `1px solid ${theme.custom.border.soft}`, borderRadius: 1 }}
                    >
                        <RestartAlt />
                    </IconButton>
                </Tooltip>
            </Box>

            {correlationError && (
                <Alert
                    severity="error"
                    action={(
                        <Button color="inherit" size="small" onClick={() => setStatusAttempt((value) => value + 1)}>
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

                    {!correlationLoading && !correlationError && plotData.length === 0 && (
                        <Box sx={{ minHeight: RESPONSIVE_EMPTY_PLOT_HEIGHT, display: 'grid', placeItems: 'center', px: 3 }}>
                            <Alert severity="info">Select at least two traits to render the correlation matrix.</Alert>
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
                            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem', mt: 0.2 }}>
                                Ordered by absolute correlation magnitude.
                            </Typography>
                        </Box>
                        <Tooltip title="Download correlation matrix as CSV">
                            <Button
                                size="small"
                                startIcon={<DownloadOutlined />}
                                onClick={() => downloadBlob(
                                    new Blob([buildCorrelationCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                                    `${fileId || 'trait'}-${method}-effect-correlation.csv`,
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
