import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Biotech from '@mui/icons-material/Biotech';
import Close from '@mui/icons-material/Close';
import Hub from '@mui/icons-material/Hub';
import Search from '@mui/icons-material/Search';
import TableChart from '@mui/icons-material/TableChart';
import axios from 'axios';
import useSWR from 'swr';
import ReleaseLogSection from '../components/ReleaseLogSection';
import { RELEASE_LOG_ANCHOR } from '../components/releaseLogData';
import { getHomeStats } from '../api/gwas';
import { createTtlCache } from '../utils/cache';
import { detailSummarySWRConfig } from '../utils/swrOptions';
import { useCachedResourceState } from '../utils/useCachedResourceState';
import { APP_SHELL_MAX_WIDTH, captionSx, panelSx, summaryChipSx } from '../themeUtils';
import homeFigureBurdenVolcano from '../assets/home/home-figure-burden-volcano.svg';
import homeFigureCrossTraitHeatmap from '../assets/home/home-figure-cross-trait-heatmap.svg';
import homeFigureGwasManhattan from '../assets/home/home-figure-gwas-manhattan.svg';
import homeFigureLofGene from '../assets/home/home-figure-lof-gene.svg';
import homeFigurePosteriorVolcano from '../assets/home/home-figure-posterior-volcano.svg';
import homeFigureProgramScatter from '../assets/home/home-figure-program-scatter.svg';
import homeFigureQqPlot from '../assets/home/home-figure-qq-plot.svg';
import homeFigureTraitProgramNetwork from '../assets/home/home-figure-trait-program-network.svg';
import traitsIcon from '../assets/home/traits.svg';
import variantsIcon from '../assets/home/variants.svg';
import programsIcon from '../assets/home/programs.svg';
import associationsIcon from '../assets/home/associations.svg';
import homeFigureDataBrowser from '../assets/home/home-figure-data-browser.svg';
import homeFigureProgramVolcano from '../assets/home/home-figure-program-volcano.svg';
import homeFigureTraitCorrelation from '../assets/home/home-figure-trait-correlation.svg';
import homeFigureVariantDetail from '../assets/home/home-figure-variant-detail.svg';

const accent = '#ff6b4a';
const siteName = 'TraitProgram';
const EMPTY_ENTITY_RESULTS = { traits: [], genes: [], programs: [] };
const EMPTY_ENTITY_META = { traits: 0, genes: 0, programs: 0 };
const SEARCH_DEBOUNCE_MS = 220;
const SEARCH_CACHE_TTL_MS = 90 * 1000;
const SEARCH_CACHE = createTtlCache({ ttlMs: SEARCH_CACHE_TTL_MS, maxEntries: 80 });
const FEATURED_TRAIT = {
    fileId: 'GCST90083727',
    name: 'ICD10 E11.9: Type 2 diabetes mellitus without complications',
};
const FEATURED_PROGRAM = {
    id: 'P1',
    name: 'ATP dependent activity',
};
const FEATURED_GENES = [
    { symbol: 'BRCA1', name: 'BRCA1 DNA repair associated' },
    { symbol: 'LDLR', name: 'low density lipoprotein receptor' },
];
const FIGURE_FOCUS_HASH = 'trait-figure-panel';
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
});

const quickSearchSeeds = [
    { label: `Trait ${FEATURED_TRAIT.fileId}`, query: FEATURED_TRAIT.fileId },
    { label: FEATURED_TRAIT.name, query: FEATURED_TRAIT.name },
    { label: `Program ${FEATURED_PROGRAM.id}: ${FEATURED_PROGRAM.name}`, query: FEATURED_PROGRAM.id },
    { label: FEATURED_PROGRAM.name, query: FEATURED_PROGRAM.name },
    { label: `Gene ${FEATURED_GENES[0].symbol}: ${FEATURED_GENES[0].name}`, query: FEATURED_GENES[0].symbol },
    { label: `Gene ${FEATURED_GENES[1].symbol}: ${FEATURED_GENES[1].name}`, query: FEATURED_GENES[1].symbol },
];

const searchPlaceholderExamples = [
    `Search genes: ${FEATURED_GENES[0].symbol} (${FEATURED_GENES[0].name}) or ${FEATURED_GENES[1].symbol} (${FEATURED_GENES[1].name})`,
    `Search programs: ${FEATURED_PROGRAM.id} (${FEATURED_PROGRAM.name})`,
    `Search traits: ${FEATURED_TRAIT.fileId} or ${FEATURED_TRAIT.name}`,
];

const loadingBarSx = {
    height: 3,
    bgcolor: 'rgba(226,232,240,0.72)',
    '& .MuiLinearProgress-bar': {
        background: 'linear-gradient(90deg, #2563eb, #0f766e)',
    },
};

const shimmerSx = {
    position: 'relative',
    overflow: 'hidden',
    '&::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        transform: 'translateX(-100%)',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
        animation: 'homeDataShimmer 1.25s ease-in-out infinite',
    },
    '@keyframes homeDataShimmer': {
        '100%': { transform: 'translateX(100%)' },
    },
};

function traitTabPath(tab) {
    return `/trait/${encodeURIComponent(FEATURED_TRAIT.fileId)}?tab=${encodeURIComponent(tab)}#${FIGURE_FOCUS_HASH}`;
}

const traitFigureCards = [
    {
        title: 'Program Scatter',
        description: 'Used to prioritize cellular programs and regulators with outlying effect estimates, supporting trait-relevant mechanism discovery.',
        image: homeFigureProgramScatter,
        to: traitTabPath('program-scatter'),
        color: '#0284c7',
    },
    {
        title: 'Trait Program Graph',
        description: 'Used to map trait, program, and gene-level evidence into an interpretable network for mechanistic hypothesis generation.',
        image: homeFigureTraitProgramNetwork,
        to: traitTabPath('trait-program-graph'),
        color: '#0f766e',
    },
    {
        title: 'Manhattan',
        description: 'Used to localize genome-wide association signals across loci and identify the strongest variant-level peaks for a trait.',
        image: homeFigureGwasManhattan,
        to: traitTabPath('manhattan'),
        color: '#2563eb',
    },
    {
        title: 'Burden Volcano',
        description: 'Used to evaluate the magnitude and significance of LoF burden associations, enabling rapid nomination of candidate genes.',
        image: homeFigureBurdenVolcano,
        to: traitTabPath('burden-volcano'),
        color: '#ea580c',
    },
    {
        title: 'Posterior Volcano',
        description: 'Used to rank genes by posterior effect size and statistical support under the GeneBayes gene-level association framework.',
        image: homeFigurePosteriorVolcano,
        to: traitTabPath('posterior-volcano'),
        color: '#a21caf',
    },
    {
        title: 'Gene Evidence',
        description: 'Used to consolidate trait-linked evidence at the gene level and assess whether multiple signals converge on the same target gene.',
        image: homeFigureLofGene,
        to: traitTabPath('gene-evidence'),
        color: '#7c3aed',
    },
    {
        title: 'QQ Plot',
        description: 'Used to assess calibration of gene-level association statistics and determine whether the observed tail exceeds null expectation.',
        image: homeFigureQqPlot,
        to: traitTabPath('gene-qq'),
        color: '#1d4ed8',
    },
    {
        title: 'Cross-trait Heatmap',
        description: 'Used to compare shared gene-level effects across traits and reveal recurrent cross-trait patterns in posterior evidence.',
        image: homeFigureCrossTraitHeatmap,
        to: traitTabPath('cross-trait-heatmap'),
        color: '#c2410c',
    },
    {
        title: 'Trait Correlation',
        description: 'Used to quantify similarity between trait-level gene effect profiles and identify traits with concordant genetic architecture.',
        image: homeFigureTraitCorrelation,
        to: traitTabPath('trait-correlation'),
        color: '#2563eb',
    },
    {
        title: 'Program Volcano',
        description: 'Used to evaluate program-level effect direction and significance, highlighting cellular pathways most strongly linked to the trait.',
        image: homeFigureProgramVolcano,
        to: traitTabPath('program-scatter'),
        color: '#7c3aed',
    },
    {
        title: 'Trait Detail',
        description: 'Used to contextualize downstream analyses with curated trait metadata, study identifiers, and linked evidence modules.',
        image: homeFigureVariantDetail,
        to: `/trait/${encodeURIComponent(FEATURED_TRAIT.fileId)}`,
        color: '#d97706',
    },
    {
        title: 'Data Browser',
        description: 'Used to retrieve indexed result files and supporting outputs for validation, reuse, and reproducible downstream analysis.',
        image: homeFigureDataBrowser,
        to: '/data',
        color: '#b45309',
    },
];

function fmtCount(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return '-';
    return numberFormatter.format(numericValue);
}

function fmtMetricCount(value, compact = false) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return '-';
    return compact ? compactNumberFormatter.format(numericValue) : numberFormatter.format(numericValue);
}

function CoverageGlyph({ color, kind }) {
    const common = {
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: 2,
    };

    return (
        <Box
            component="svg"
            viewBox="0 0 40 40"
            sx={{
                width: { xs: 25, md: 28 },
                height: { xs: 25, md: 28 },
                color,
                overflow: 'visible',
            }}
            aria-hidden="true"
        >
            {kind === 'traits' && (
                <>
                    <path {...common} d="M9 30V11M9 30h23" opacity="0.48" />
                    <path {...common} d="m11 25 6-7 5 4 8-11" />
                    <circle cx="11" cy="25" r="2.2" fill="currentColor" />
                    <circle cx="17" cy="18" r="2.2" fill="currentColor" opacity="0.72" />
                    <circle cx="22" cy="22" r="2.2" fill="currentColor" opacity="0.72" />
                    <circle cx="30" cy="11" r="2.8" fill="currentColor" />
                </>
            )}
            {kind === 'variants' && (
                <>
                    <path {...common} d="M13 8c0 8 14 16 14 24M27 8c0 8-14 16-14 24" />
                    <path {...common} d="M15 12h10M16 17h8M16 23h8M15 28h10" opacity="0.5" />
                    <circle cx="27" cy="8" r="2.5" fill="currentColor" />
                    <circle cx="13" cy="32" r="2.5" fill="currentColor" opacity="0.72" />
                </>
            )}
            {kind === 'programs' && (
                <>
                    <path {...common} d="M20 19 12 12M20 19l8-7M20 19v10" opacity="0.58" />
                    <rect x="8" y="8" width="8" height="8" rx="2.2" {...common} />
                    <rect x="24" y="8" width="8" height="8" rx="2.2" {...common} />
                    <rect x="16" y="25" width="8" height="8" rx="2.2" {...common} />
                    <circle cx="20" cy="19" r="3.4" fill="currentColor" />
                </>
            )}
            {kind === 'outputs' && (
                <>
                    <path {...common} d="M14 9h10l5 5v17H14V9Z" />
                    <path {...common} d="M24 9v6h5M18 21h7M18 26h7" opacity="0.62" />
                    <path {...common} d="M10 13v21h15" opacity="0.48" />
                    <circle cx="29" cy="31" r="2.6" fill="currentColor" />
                </>
            )}
        </Box>
    );
}

function getRequestErrorMessage(err, fallback) {
    return err.response?.data?.error || err.message || fallback;
}

function getCachedSearchResult(query) {
    return SEARCH_CACHE.get(query) || null;
}

function buildGeneHref(gene) {
    const query = gene?.geneSymbol || gene?.geneLabel || gene?.ensgId || '';
    return query ? `/genes?query=${encodeURIComponent(query)}` : '/genes';
}

function buildTraitHref(trait) {
    const id = trait?.file_id || trait?.fileId || trait?.gwas_id || trait?.trait_name || '';
    return id ? `/trait/${encodeURIComponent(id)}` : '/trait';
}

function buildProgramHref(program) {
    const id = program?.program || program?.id || program?.label || '';
    return id ? `/programs/${encodeURIComponent(id)}` : '/programs';
}

function normalizeHomeEntitySearchPayload(payload = {}) {
    const traits = payload.traits?.results || [];
    const genes = payload.genes?.results || [];
    const programs = payload.programs?.results || [];
    return {
        entityResults: { traits, genes, programs },
        entityMeta: {
            traits: Number(payload.traits?.totalCount) || traits.length,
            genes: Number(payload.genes?.totalCount) || genes.length,
            programs: Number(payload.programs?.totalCount) || programs.length,
        },
        entityErrors: payload.errors || {},
    };
}

function EntityResultSection({ title, totalCount, shownCount, children, theme }) {
    if (!shownCount) return null;

    return (
        <>
            <Box
                sx={{
                    px: 2,
                    py: 0.8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: theme.custom.surface.subtle,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
            >
                <Typography variant="overline" sx={{ fontWeight: 700, color: theme.palette.text.secondary }}>
                    {title}
                </Typography>
                <Chip
                    label={totalCount > shownCount ? `${shownCount}/${fmtCount(totalCount)}` : shownCount}
                    size="small"
                    sx={summaryChipSx(theme)}
                />
            </Box>
            {children}
        </>
    );
}

function EntityResultItem({ icon, title, secondary, chipLabel, chipSx, to, theme }) {
    return (
        <ListItemButton
            component={RouterLink}
            to={to}
            sx={{
                px: 1.75,
                py: 1,
                textDecoration: 'none',
                color: 'inherit',
                borderBottom: `1px solid ${theme.custom.border.soft}`,
            }}
        >
            <ListItemIcon sx={{ minWidth: 30 }}>
                {icon}
            </ListItemIcon>
            <ListItemText
                primary={title}
                secondary={secondary}
                primaryTypographyProps={{ fontSize: '0.84rem', fontWeight: 650, noWrap: true, title }}
                secondaryTypographyProps={{ fontSize: '0.73rem', noWrap: true, title: secondary }}
            />
            {chipLabel && <Chip label={chipLabel} size="small" sx={chipSx || summaryChipSx(theme)} />}
        </ListItemButton>
    );
}

function SearchResultsPanel({
    canSearch,
    entityErrors,
    entityMeta,
    entityResults,
    error,
    loading,
    panelOpen,
    setError,
    theme,
    trimmedQ,
}) {
    const traitResults = entityResults.traits || [];
    const geneResults = entityResults.genes || [];
    const programResults = entityResults.programs || [];
    const entityResultCount = traitResults.length + geneResults.length + programResults.length;
    const quickMatchSummary = `${entityResultCount} gene/program/trait matches`;
    const hasAnyResults = entityResultCount > 0;
    const entityErrorText = Object.values(entityErrors || {}).filter(Boolean).join(' ');

    if (!panelOpen || !canSearch) return null;

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                right: 0,
                zIndex: 70,
                overflow: 'hidden',
                backgroundColor: '#fff',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 22px 48px rgba(15,23,42,0.16)',
            })}
        >
            {loading && <LinearProgress sx={loadingBarSx} />}
            <Box
                sx={{
                    px: 2,
                    py: 1.1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    flexWrap: 'wrap',
                    bgcolor: theme.custom.surface.subtle,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
                aria-live="polite"
            >
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                    <Chip label="Genes + programs + traits" size="small" sx={summaryChipSx(theme)} />
                    <Chip label={quickMatchSummary} size="small" sx={summaryChipSx(theme)} />
                    {traitResults.length > 0 && (
                        <Chip label={`${traitResults.length} traits`} size="small" sx={summaryChipSx(theme)} />
                    )}
                    {geneResults.length > 0 && (
                        <Chip label={`${geneResults.length} genes`} size="small" sx={summaryChipSx(theme)} />
                    )}
                    {programResults.length > 0 && (
                        <Chip label={`${programResults.length} programs`} size="small" sx={summaryChipSx(theme)} />
                    )}
                </Stack>
            </Box>

            {entityErrorText && (
                <Alert severity="warning" sx={{ mx: 2, mt: 1, borderRadius: 1 }}>
                    Some table results could not be loaded. {entityErrorText}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mx: 2, mt: 1, borderRadius: 1 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {loading && !hasAnyResults ? (
                <Box sx={{ px: 2, py: 1.6 }}>
                    {[0, 1, 2, 3].map((item) => (
                        <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, px: 0.5, py: 1 }}>
                            <Skeleton variant="rounded" width={16} height={16} sx={shimmerSx} />
                            <Skeleton variant="rounded" width={18} height={18} sx={shimmerSx} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Skeleton variant="text" width="50%" height={24} sx={shimmerSx} />
                                <Skeleton variant="text" width="82%" height={18} sx={shimmerSx} />
                            </Box>
                            <Skeleton variant="rounded" width={58} height={22} sx={shimmerSx} />
                        </Box>
                    ))}
                </Box>
            ) : hasAnyResults ? (
                <Box sx={{ maxHeight: { xs: 'min(46vh, 320px)', sm: 'min(50vh, 360px)' }, overflow: 'auto' }}>
                    <List disablePadding>
                        <EntityResultSection title="Traits" shownCount={traitResults.length} totalCount={entityMeta.traits} theme={theme}>
                            {traitResults.map((item) => (
                                <EntityResultItem
                                    key={`trait-${item.file_id || item.gwas_id || item.trait_name}`}
                                    icon={<TableChart sx={{ fontSize: 18, color: '#2563eb' }} />}
                                    title={item.trait_name || item.file_id || item.gwas_id || 'Trait'}
                                    secondary={[item.file_id, item.gwas_id, item.population].filter(Boolean).join(' | ')}
                                    chipLabel={item.year || 'trait'}
                                    chipSx={summaryChipSx(theme, { bgcolor: alpha(theme.palette.primary.main, 0.08) })}
                                    to={buildTraitHref(item)}
                                    theme={theme}
                                />
                            ))}
                        </EntityResultSection>
                        <EntityResultSection title="Genes" shownCount={geneResults.length} totalCount={entityMeta.genes} theme={theme}>
                            {geneResults.map((item) => (
                                <EntityResultItem
                                    key={`gene-${item.geneSymbol || item.ensgId || item.geneLabel}`}
                                    icon={<Biotech sx={{ fontSize: 18, color: '#0f766e' }} />}
                                    title={item.geneSymbol || item.geneLabel || item.ensgId || 'Gene'}
                                    secondary={[item.ensgId, item.geneName, item.location].filter(Boolean).join(' | ')}
                                    chipLabel={`${fmtCount(item.totalTraits)} traits`}
                                    chipSx={summaryChipSx(theme, { bgcolor: alpha(theme.palette.success.main, 0.08) })}
                                    to={buildGeneHref(item)}
                                    theme={theme}
                                />
                            ))}
                        </EntityResultSection>
                        <EntityResultSection title="Programs" shownCount={programResults.length} totalCount={entityMeta.programs} theme={theme}>
                            {programResults.map((item) => (
                                <EntityResultItem
                                    key={`program-${item.program || item.id}`}
                                    icon={<Hub sx={{ fontSize: 18, color: '#7c3aed' }} />}
                                    title={item.program || item.label || 'Program'}
                                    secondary={[item.annotation, item.goTerm].filter(Boolean).join(' | ')}
                                    chipLabel={item.goOntology || 'program'}
                                    chipSx={summaryChipSx(theme, { bgcolor: alpha(theme.palette.secondary.main, 0.08) })}
                                    to={buildProgramHref(item)}
                                    theme={theme}
                                />
                            ))}
                        </EntityResultSection>
                    </List>
                </Box>
            ) : (
                <Box sx={{ px: 2, py: 2.2 }}>
                    <Typography sx={captionSx(theme, { fontSize: '0.86rem' })}>
                        No traits, genes, or programs matched "{trimmedQ}".
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}

function HomeSearch({
    embedded = false,
    showCoverage = true,
    stats,
    statsError,
    statsLoading,
    theme,
}) {
    const [q, setQ] = useState('');
    const [entityResults, setEntityResults] = useState(EMPTY_ENTITY_RESULTS);
    const [entityMeta, setEntityMeta] = useState(EMPTY_ENTITY_META);
    const [entityErrors, setEntityErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const [placeholderIndex, setPlaceholderIndex] = useState(0);

    const trimmedQ = q.trim();
    const searchKey = trimmedQ.toLowerCase();
    const canSearch = trimmedQ.length >= 2;
    const panelOpen = open && canSearch;
    const searchPlaceholder = searchPlaceholderExamples[placeholderIndex % searchPlaceholderExamples.length];

    useEffect(() => {
        if (q) return undefined;

        const timer = window.setInterval(() => {
            setPlaceholderIndex((index) => (index + 1) % searchPlaceholderExamples.length);
        }, 3600);

        return () => window.clearInterval(timer);
    }, [q]);

    useEffect(() => {
        if (!canSearch) {
            setEntityResults(EMPTY_ENTITY_RESULTS);
            setEntityMeta(EMPTY_ENTITY_META);
            setEntityErrors({});
            setLoading(false);
            setError('');
            return undefined;
        }

        const cached = getCachedSearchResult(searchKey);
        if (cached) {
            setEntityResults(cached.entityResults || EMPTY_ENTITY_RESULTS);
            setEntityMeta(cached.entityMeta || EMPTY_ENTITY_META);
            setEntityErrors(cached.entityErrors || {});
            setLoading(false);
            setError('');
        } else {
            setEntityResults(EMPTY_ENTITY_RESULTS);
            setEntityMeta(EMPTY_ENTITY_META);
            setEntityErrors({});
        }

        let cancelled = false;
        const controller = new AbortController();
        setError('');
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const entitySearch = await axios.get('/api/home/search', {
                    params: { q: trimmedQ, limit: 6 },
                    signal: controller.signal,
                });
                if (cancelled) return;
                const entityData = normalizeHomeEntitySearchPayload(entitySearch.data);
                const payload = {
                    ...entityData,
                };
                SEARCH_CACHE.set(searchKey, payload);
                setEntityResults(payload.entityResults);
                setEntityMeta(payload.entityMeta);
                setEntityErrors(payload.entityErrors);
                setError('');
            } catch (err) {
                if (cancelled || axios.isCancel?.(err) || err.code === 'ERR_CANCELED') return;
                if (!cancelled) {
                    if (!cached) {
                        setEntityResults(EMPTY_ENTITY_RESULTS);
                        setEntityMeta(EMPTY_ENTITY_META);
                        setEntityErrors({});
                    }
                    setError(getRequestErrorMessage(err, 'Search failed'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [canSearch, searchKey, trimmedQ]);

    const clearSearch = () => {
        setQ('');
        setOpen(false);
        setEntityResults(EMPTY_ENTITY_RESULTS);
        setEntityMeta(EMPTY_ENTITY_META);
        setEntityErrors({});
        setError('');
    };

    const runQuickSearch = (query) => {
        const nextQ = query.trim();
        const nextKey = nextQ.toLowerCase();
        setQ(nextQ);
        setOpen(true);
        setError('');

        if (nextQ.length < 2) return;

        const cached = getCachedSearchResult(nextKey);
        if (cached) {
            setEntityResults(cached.entityResults || EMPTY_ENTITY_RESULTS);
            setEntityMeta(cached.entityMeta || EMPTY_ENTITY_META);
            setEntityErrors(cached.entityErrors || {});
            setLoading(false);
            return;
        }

        setEntityResults(EMPTY_ENTITY_RESULTS);
        setEntityMeta(EMPTY_ENTITY_META);
        setEntityErrors({});
        setLoading(true);
    };

    return (
        <Box
            id="home-search"
            component={embedded ? 'div' : 'section'}
            sx={{
                maxWidth: embedded ? '100%' : 1040,
                mx: 'auto',
                px: embedded ? 0 : { xs: 2, sm: 3, lg: 4 },
                pb: embedded ? 0 : { xs: 5, md: 6.2 },
                position: 'relative',
                zIndex: 20,
            }}
        >
            <Box sx={panelSx(theme, { p: { xs: 1.5, sm: 1.8, md: 2.1 }, width: '100%', overflow: 'visible', backgroundColor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(14px)' })}>
                <Stack spacing={{ xs: 1.5, md: 1.8 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Box>
                            <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0, textTransform: 'none', color: '#111827' }}>
                                Search
                            </Typography>

                        </Box>
                    </Stack>
                    <ClickAwayListener onClickAway={() => setOpen(false)}>
                        <Stack spacing={1.1}>
                            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                                {quickSearchSeeds.map((item) => (
                                    <Chip
                                        key={item.query}
                                        label={item.label}
                                        onClick={() => runQuickSearch(item.query)}
                                        sx={summaryChipSx(theme, {
                                            cursor: 'pointer',
                                            backgroundColor: alpha(theme.palette.primary.main, 0.07),
                                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                                        })}
                                    />
                                ))}
                            </Stack>
                            <Box sx={{ position: 'relative' }}>
                            <TextField
                                fullWidth
                                placeholder={searchPlaceholder}
                                inputProps={{ 'aria-label': 'Search genes, programs, and traits' }}
                                value={q}
                                onChange={(event) => {
                                    setQ(event.target.value);
                                    setOpen(true);
                                }}
                                onFocus={() => {
                                    if (canSearch) setOpen(true);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') setOpen(false);
                                    if (event.key === 'Enter' && canSearch) {
                                        event.preventDefault();
                                        setOpen(true);
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search sx={{ color: '#64748b', fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: loading
                                        ? <CircularProgress size={18} sx={{ mr: 1 }} />
                                        : (q && (
                                            <IconButton size="small" aria-label="Clear search" onClick={clearSearch}>
                                                <Close fontSize="small" />
                                            </IconButton>
                                        )),
                                }}
                            />
                            <SearchResultsPanel
                                canSearch={canSearch}
                                entityErrors={entityErrors}
                                entityMeta={entityMeta}
                                entityResults={entityResults}
                                error={error}
                                loading={loading}
                                panelOpen={panelOpen}
                                setError={setError}
                                theme={theme}
                                trimmedQ={trimmedQ}
                            />
                            </Box>
                        </Stack>
                    </ClickAwayListener>
                    {showCoverage && (
                        <DataCoveragePanel
                            embedded
                            error={statsError}
                            loading={statsLoading}
                            stats={stats}
                            theme={theme}
                        />
                    )}
                </Stack>
            </Box>
        </Box>
    );
}

function DataCoveragePanel({ embedded = false, error, loading, stats, theme }) {
    const metrics = [
        {
            label: 'Traits',
            value: stats?.traits,
            kind: 'traits',
            color: '#2563eb',
        },
        {
            label: 'Variants',
            value: stats?.variants,
            kind: 'variants',
            color: '#0f766e',
            compact: true,
        },
        {
            label: 'Programs',
            value: stats?.programs,
            kind: 'programs',
            color: '#7c3aed',
        },
        {
            label: 'Data outputs',
            value: stats?.dataOutputs,
            kind: 'outputs',
            color: '#b45309',
        },
    ];

    return (
        <Box
            component={embedded ? 'div' : 'section'}
            aria-label="Data coverage"
            sx={{
                width: '100%',
                maxWidth: embedded ? '100%' : 980,
                mx: 'auto',
                mt: embedded ? { xs: 0.4, md: 0.6 } : { xs: 3.2, md: 4.2 },
                pt: embedded ? { xs: 1.6, md: 1.8 } : { xs: 2, md: 2.2 },
                borderTop: `1px solid ${theme.custom.border.soft}`,
            }}
        >
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                    gap: { xs: 1.1, md: 1.4 },
                }}
            >
                {metrics.map((metric) => (
                        <Box
                            key={metric.label}
                            sx={{
                                minHeight: { xs: 92, md: 96 },
                                px: { xs: 1.5, md: 1.7 },
                                py: { xs: 1.35, md: 1.45 },
                                display: 'flex',
                                alignItems: 'center',
                                gap: { xs: 1, md: 1.15 },
                                borderRadius: 1,
                                border: `1px solid ${alpha(metric.color, 0.13)}`,
                                bgcolor: '#fff',
                                boxShadow: '0 10px 24px rgba(15,23,42,0.045)',
                            }}
                        >
                            <Box
                                sx={{
                                    width: { xs: 38, md: 42 },
                                    height: { xs: 38, md: 42 },
                                    borderRadius: 1,
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: metric.color,
                                    bgcolor: alpha(metric.color, 0.08),
                                    flex: '0 0 auto',
                                }}
                                aria-hidden="true"
                            >
                                <CoverageGlyph color={metric.color} kind={metric.kind} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography
                                    sx={{
                                        color: '#111827',
                                        fontSize: { xs: '1.35rem', md: '1.55rem' },
                                        fontWeight: 780,
                                        lineHeight: 1,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {loading ? <Skeleton variant="text" width={82} height={34} /> : fmtMetricCount(metric.value, metric.compact)}
                                </Typography>
                                <Typography sx={{ mt: 0.55, color: '#64748b', fontSize: { xs: '0.76rem', md: '0.8rem' }, lineHeight: 1.2 }}>
                                    {metric.label}
                                </Typography>
                            </Box>
                        </Box>
                ))}
            </Box>
            {error && (
                <Typography sx={{ mt: 1, color: theme.palette.warning.dark, fontSize: '0.76rem', textAlign: 'center' }}>
                    Live coverage stats are unavailable.
                </Typography>
            )}
        </Box>
    );
}

function FigureCard({ item }) {
    return (
        <Box
            component={RouterLink}
            to={item.to}
            aria-label={`Open ${item.title}`}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                border: '1px solid rgba(226,232,240,0.78)',
                bgcolor: 'rgba(255,255,255,0.96)',
                color: 'inherit',
                overflow: 'hidden',
                position: 'relative',
                textDecoration: 'none',
                boxShadow: '0 14px 34px rgba(15,23,42,0.06)',
                transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: alpha(item.color, 0.28),
                    boxShadow: `0 22px 48px ${alpha(item.color, 0.15)}`,
                },
                '&:hover .figure-card-image, &:focus-visible .figure-card-image': {
                    transform: 'scale(1.04)',
                },
                '&:hover .figure-card-frame, &:focus-visible .figure-card-frame': {
                    opacity: 1,
                },
                '&:hover .figure-card-details, &:focus-visible .figure-card-details': {
                    opacity: 1,
                    transform: 'translateY(0)',
                },
                '&:hover .figure-card-title, &:focus-visible .figure-card-title': {
                    color: item.color,
                },
                '&:focus-visible': {
                    outline: `3px solid ${alpha(item.color, 0.24)}`,
                    outlineOffset: 3,
                },
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '720 / 420',
                    overflow: 'hidden',
                    bgcolor: alpha(item.color, 0.035),
                }}
            >
                <Box
                    component="img"
                    className="figure-card-image"
                    src={item.image}
                    alt=""
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transform: 'scale(1.03)',
                        transformOrigin: 'center',
                        transition: 'transform 360ms ease',
                    }}
                />
                <Box
                    className="figure-card-frame"
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        border: `1px solid ${alpha(item.color, 0.22)}`,
                        boxShadow: `inset 0 0 0 1px ${alpha(item.color, 0.08)}`,
                        opacity: 0,
                        transition: 'opacity 180ms ease',
                        pointerEvents: 'none',
                    }}
                />
                <Box
                    className="figure-card-details"
                    sx={{
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        bottom: 12,
                        zIndex: 2,
                        px: 1.25,
                        py: 0.85,
                        borderRadius: 1,
                        bgcolor: 'rgba(255,255,255,0.98)',
                        border: `1px solid ${alpha(item.color, 0.16)}`,
                        boxShadow: '0 12px 28px rgba(15,23,42,0.16)',
                        opacity: 0,
                        transform: 'translateY(8px)',
                        transition: 'opacity 160ms ease, transform 180ms ease',
                        pointerEvents: 'none',
                    }}
                >
                    <Typography
                        sx={{
                            maxWidth: 320,
                            color: '#475569',
                            fontSize: '0.76rem',
                            fontWeight: 560,
                            lineHeight: 1.45,
                            textAlign: 'left',
                        }}
                    >
                        {item.description}
                    </Typography>
                </Box>
            </Box>
            <Stack alignItems="center" justifyContent="center" sx={{ px: 1.5, pt: 1, pb: 1.15, minWidth: 0 }}>
                <Typography
                    component="h3"
                    className="figure-card-title"
                    sx={{
                        color: '#111827',
                        fontSize: '1rem',
                        fontWeight: 740,
                        lineHeight: 1.22,
                        textAlign: 'center',
                        transition: 'color 180ms ease',
                    }}
                >
                    {item.title}
                </Typography>
            </Stack>
        </Box>
    );
}

function FigureGateway({ items }) {
    return (
        <Box
            component="section"
            sx={{
                position: 'relative',
                zIndex: 1,
                maxWidth: APP_SHELL_MAX_WIDTH,
                mx: 'auto',
                px: { xs: 2, sm: 3, lg: 4, xl: 5 },
                pb: { xs: 6, md: 8 },
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    overflow: 'visible',
                    borderRadius: 1,
                    border: '1px solid rgba(226,232,240,0.82)',
                    backgroundColor: 'rgba(255,255,255,0.72)',
                    boxShadow: '0 12px 34px rgba(15,23,42,0.045)',
                    px: { xs: 1.4, sm: 2, md: 2.4 },
                    pt: { xs: 1.8, md: 2.2 },
                    pb: { xs: 1.4, md: 2 },
                }}
            >
                <Typography
                    component="h2"
                    sx={{
                        color: '#0f172a',
                        fontSize: { xs: '1.28rem', sm: '1.45rem', md: '1.65rem' },
                        fontWeight: 760,
                        lineHeight: 1.18,
                        mb: { xs: 1.6, md: 2 },
                    }}
                >
                    Explore analysis figures
                </Typography>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            md: 'repeat(3, minmax(0, 1fr))',
                            xl: 'repeat(4, minmax(0, 1fr))',
                        },
                        gap: { xs: 2.2, md: 2.8 },
                    }}
                >
                    {items.map((item) => (
                        <FigureCard key={item.title} item={item} />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

/* ─── Animated SVG background for the hero ─── */
function HeroBackground() {
    return (
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 0,
            }}
            aria-hidden="true"
        >
            {/* Gradient base */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#ffffff',
                    backgroundImage: `
                        radial-gradient(at 0% 0%, hsla(217, 100%, 94%, 1) 0px, transparent 50%),
                        radial-gradient(at 80% 0%, hsla(189, 100%, 92%, 1) 0px, transparent 50%),
                        radial-gradient(at 100% 100%, hsla(248, 100%, 95%, 1) 0px, transparent 50%),
                        radial-gradient(at 0% 100%, hsla(210, 100%, 96%, 1) 0px, transparent 50%)
                    `,
                }}
            />

            {/* SVG illustration layer */}
            <Box
                component="svg"
                viewBox="0 0 1440 560"
                preserveAspectRatio="xMidYMid slice"
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0.55,
                }}
            >
                <defs>
                    <linearGradient id="heroHelixGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity="0.2" />
                    </linearGradient>
                </defs>

                {/* DNA helix strands — left side */}
                <g opacity="0.5">
                    <path d="M60,80 C120,120 120,200 60,240 C0,280 0,360 60,400 C120,440 120,520 60,560" fill="none" stroke="url(#heroHelixGrad)" strokeWidth="1.5">
                        <animateTransform attributeName="transform" type="translate" values="0,0;8,0;0,0" dur="6s" repeatCount="indefinite" />
                    </path>
                    <path d="M100,80 C40,120 40,200 100,240 C160,280 160,360 100,400 C40,440 40,520 100,560" fill="none" stroke="url(#heroHelixGrad)" strokeWidth="1.5">
                        <animateTransform attributeName="transform" type="translate" values="0,0;-8,0;0,0" dur="6s" repeatCount="indefinite" />
                    </path>
                    {/* Cross rungs */}
                    {[120, 200, 280, 360, 440, 520].map((y) => (
                        <line key={y} x1="65" y1={y} x2="95" y2={y} stroke="#3b82f6" strokeWidth="0.8" opacity="0.25">
                            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" begin={`${(y - 120) * 0.005}s`} repeatCount="indefinite" />
                        </line>
                    ))}
                </g>

                {/* DNA helix — right side */}
                <g opacity="0.4" transform="translate(1280, 0)">
                    <path d="M60,0 C120,40 120,120 60,160 C0,200 0,280 60,320 C120,360 120,440 60,480" fill="none" stroke="url(#heroHelixGrad)" strokeWidth="1.5">
                        <animateTransform attributeName="transform" type="translate" values="0,0;-6,0;0,0" dur="7s" repeatCount="indefinite" />
                    </path>
                    <path d="M100,0 C40,40 40,120 100,160 C160,200 160,280 100,320 C40,360 40,440 100,480" fill="none" stroke="url(#heroHelixGrad)" strokeWidth="1.5">
                        <animateTransform attributeName="transform" type="translate" values="0,0;6,0;0,0" dur="7s" repeatCount="indefinite" />
                    </path>
                    {[40, 120, 200, 280, 360, 440].map((y) => (
                        <line key={y} x1="65" y1={y} x2="95" y2={y} stroke="#0d9488" strokeWidth="0.8" opacity="0.2">
                            <animate attributeName="opacity" values="0.15;0.45;0.15" dur="4s" begin={`${(y - 40) * 0.004}s`} repeatCount="indefinite" />
                        </line>
                    ))}
                </g>


                {/* Network nodes — center */}
                <g opacity="0.35">
                    {[
                        { cx: 480, cy: 180, r: 3 },
                        { cx: 540, cy: 140, r: 2.5 },
                        { cx: 620, cy: 200, r: 3.5 },
                        { cx: 700, cy: 160, r: 2 },
                        { cx: 760, cy: 220, r: 3 },
                        { cx: 820, cy: 140, r: 2.5 },
                        { cx: 900, cy: 190, r: 3 },
                        { cx: 560, cy: 260, r: 2 },
                        { cx: 660, cy: 300, r: 2.5 },
                        { cx: 780, cy: 290, r: 2 },
                    ].map((node, i) => (
                        <g key={i}>
                            <circle cx={node.cx} cy={node.cy} r={node.r} fill="#6366f1">
                                <animate attributeName="r" values={`${node.r};${node.r + 1.2};${node.r}`} dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.6;1;0.6" dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
                            </circle>
                        </g>
                    ))}
                    {/* Connecting edges */}
                    {[
                        [480, 180, 540, 140],
                        [540, 140, 620, 200],
                        [620, 200, 700, 160],
                        [700, 160, 760, 220],
                        [760, 220, 820, 140],
                        [820, 140, 900, 190],
                        [480, 180, 560, 260],
                        [620, 200, 660, 300],
                        [760, 220, 780, 290],
                        [560, 260, 660, 300],
                        [660, 300, 780, 290],
                    ].map(([x1, y1, x2, y2], i) => (
                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth="0.8" opacity="0.2">
                            <animate attributeName="opacity" values="0.15;0.4;0.15" dur={`${4 + i * 0.3}s`} repeatCount="indefinite" />
                        </line>
                    ))}
                </g>


            </Box>

            {/* Smooth transition mask to blend with the main content background */}
            <Box
                sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '240px',
                    background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, #f5f7fb 100%)',
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
            />
        </Box>
    );
}

/* ─── Redesigned hero section ─── */
function HeroSection({ stats, statsLoading, theme }) {
    return (
        <Box
            component="section"
            sx={{
                position: 'relative',
                width: 'calc(100% + var(--page-pad-x) * 2)',
                ml: 'calc(var(--page-pad-x) * -1)',
                mt: 'calc(var(--page-pad-y) * -1)',
                overflow: 'visible',
            }}
        >
            <HeroBackground />

            <Box
                sx={{
                    position: 'relative',
                    zIndex: 2,
                    maxWidth: APP_SHELL_MAX_WIDTH,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4, xl: 5 },
                    pt: { xs: 5, md: 7, lg: 8.5 },
                    pb: { xs: 5, md: 7 },
                }}
            >
                <Box sx={{ maxWidth: 860, mx: 'auto', textAlign: 'center' }}>


                    {/* Title */}
                    <Typography
                        component="h1"
                        aria-label={siteName}
                        sx={{
                            maxWidth: 920,
                            mx: 'auto',
                            px: 1,
                            color: '#0f172a',
                            fontFamily: theme.typography.fontFamily,
                            fontSize: { xs: '2rem', sm: '3.2rem', md: '4.6rem', lg: '4.8rem' },
                            fontWeight: 780,
                            lineHeight: { xs: 1.16, md: 1.1 },
                            letterSpacing: { xs: '-0.01em', md: '-0.018em' },
                            overflow: 'visible',
                            textWrap: 'balance',
                            animation: 'heroFadeIn 700ms 80ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        <Box
                            component="span"
                            sx={{
                                display: 'inline-block',
                                maxWidth: '100%',
                                px: '0.08em',
                                pb: '0.08em',
                                mx: '-0.08em',
                                overflow: 'visible',
                                background: 'linear-gradient(135deg, #2563eb 0%, #0d9488 50%, #7c3aed 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                color: 'transparent',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            {siteName}
                        </Box>
                    </Typography>

                    {/* Subtitle */}
                    <Typography
                        sx={{
                            maxWidth: 700,
                            mx: 'auto',
                            mt: { xs: 2, md: 2.8 },
                            color: '#475569',
                            fontFamily: theme.typography.fontFamily,
                            fontSize: 'clamp(0.95rem, 1.05vw, 1.1rem)',
                            lineHeight: 1.78,
                            animation: 'heroFadeIn 700ms 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        A program-centric atlas linking genes, cellular programs, and human traits through GWAS datasets, genetic perturbation analyses, and interactive mechanistic exploration.
                    </Typography>

                    {/* Stats row — glassmorphism */}
                    <Box
                        sx={{
                            mt: { xs: 3, md: 4 },
                            mx: 'auto',
                            maxWidth: 860,
                            display: 'grid',
                            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                            gap: { xs: 2, md: 3 },
                            animation: 'heroFadeIn 700ms 240ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        {[
                            { label: 'Traits', value: statsLoading ? <Skeleton variant="text" width={64} height={36} sx={{ bgcolor: 'rgba(15,23,42,0.05)' }} /> : (stats?.traits ? stats.traits.toLocaleString() : '...'), color: '#2563eb', href: '/trait', icon: (
                                <Box component="img" src={traitsIcon} alt="Traits" sx={{ width: 56, height: 56, mb: 1, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }} />
                            )},
                            { label: 'Programs', value: statsLoading ? <Skeleton variant="text" width={64} height={36} sx={{ bgcolor: 'rgba(15,23,42,0.05)' }} /> : (stats?.programs ? stats.programs.toLocaleString() : '...'), color: '#7c3aed', href: '/programs', icon: (
                                <Box component="img" src={programsIcon} alt="Programs" sx={{ width: 56, height: 56, mb: 1, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }} />
                            )},
                            { label: 'Genes', value: statsLoading ? <Skeleton variant="text" width={64} height={36} sx={{ bgcolor: 'rgba(15,23,42,0.05)' }} /> : (stats?.genes ? stats.genes.toLocaleString() : '...'), color: '#0f766e', href: '/genes', icon: (
                                <Box component="img" src={variantsIcon} alt="Genes" sx={{ width: 56, height: 56, mb: 1, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }} />
                            )},
                            { label: 'Associations', value: statsLoading ? <Skeleton variant="text" width={64} height={36} sx={{ bgcolor: 'rgba(15,23,42,0.05)' }} /> : (stats?.associations ? stats.associations.toLocaleString() : '...'), color: '#ea580c', href: '/programs', icon: (
                                <Box component="img" src={associationsIcon} alt="Associations" sx={{ width: 56, height: 56, mb: 1, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }} />
                            )},
                        ].map((metric) => (
                            <Box
                                component={RouterLink}
                                to={metric.href}
                                key={metric.label}
                                sx={{
                                    textDecoration: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    px: { xs: 2.5, md: 3 },
                                    py: { xs: 2, md: 2.5 },
                                    borderRadius: 3,
                                    bgcolor: 'rgba(255,255,255,0.6)',
                                    border: '1px solid rgba(255,255,255,0.9)',
                                    boxShadow: '0 8px 32px rgba(15,23,42,0.03)',
                                    backdropFilter: 'blur(12px)',
                                    transition: 'background-color 220ms ease, box-shadow 220ms ease, transform 220ms ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(255,255,255,0.85)',
                                        boxShadow: '0 12px 48px rgba(15,23,42,0.06)',
                                        transform: 'translateY(-2px)',
                                    },
                                }}
                            >
                                <Box sx={{ color: metric.color }}>
                                    {metric.icon}
                                </Box>
                                <Typography
                                    sx={{
                                        fontSize: { xs: '1.5rem', md: '1.8rem' },
                                        fontWeight: 800,
                                        lineHeight: 1,
                                        color: metric.color,
                                        fontVariantNumeric: 'tabular-nums',
                                    }}
                                >
                                    {metric.value}
                                </Typography>
                                <Typography sx={{ mt: 0.8, fontSize: '0.85rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.03em' }}>
                                    {metric.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    {/* CTA buttons */}
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.2}
                        justifyContent="center"
                        sx={{
                            mt: { xs: 3, md: 3.5 },
                            animation: 'heroFadeIn 700ms 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
                        }}
                    >
                        <Button
                            variant="contained"
                            size="large"
                            endIcon={<ArrowForward />}
                            component={RouterLink}
                            to="/trait"
                            sx={{
                                px: 3.5,
                                py: 1.2,
                                borderRadius: 999,
                                bgcolor: accent,
                                color: '#fff',
                                fontWeight: 680,
                                fontSize: '0.95rem',
                                '&:hover': { bgcolor: '#e8593a', transform: 'translateY(-2px)' },
                                boxShadow: '0 8px 28px rgba(255,107,74,0.35)',
                                transition: 'transform 220ms ease, background-color 180ms ease, box-shadow 220ms ease',
                            }}
                        >
                            Browse traits
                        </Button>

                    </Stack>
                </Box>
                <Box
                    sx={{
                        mt: { xs: 3, md: 4 },
                        maxWidth: 1120,
                        mx: 'auto',
                        position: 'relative',
                        zIndex: 100,
                        animation: 'heroFadeIn 700ms 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
                    }}
                >
                    <HomeSearch
                        embedded
                        showCoverage={false}
                        stats={stats}
                        statsLoading={statsLoading}
                        theme={theme}
                    />
                </Box>
            </Box>
        </Box>
    );
}


function Home() {
    const theme = useTheme();
    const homeStatsResource = useCachedResourceState(
        useSWR('/api/home/stats', getHomeStats, detailSummarySWRConfig),
        { cacheKey: '/api/home/stats' },
    );
    const { displayData: homeStats, error: homeStatsError, isInitialLoading: homeStatsIsLoading } = homeStatsResource;
    const homeStatsLoading = homeStatsIsLoading && !homeStats && !homeStatsError;

    return (
        <Box sx={{ width: '100%', minHeight: '100%', color: '#1f2933', bgcolor: '#f5f7fb', mx: 'auto' }}>
            <HeroSection stats={homeStats} statsLoading={homeStatsLoading} theme={theme} />

            <FigureGateway items={traitFigureCards} />

            <ReleaseLogSection
                eyebrow={null}
                heading="Recent releases"
                subtitle={null}
                limit={3}
                newestFirst
                outerSx={{
                    maxWidth: APP_SHELL_MAX_WIDTH,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4, xl: 5 },
                    pb: { xs: 7, md: 9 },
                }}
                showNotes={false}
                action={(
                    <Button
                        component={RouterLink}
                        to={`/help#${RELEASE_LOG_ANCHOR}`}
                        size="small"
                        variant="outlined"
                        endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                    >
                        Full release log
                    </Button>
                )}
            />

            <Box
                component="footer"
                sx={{
                    maxWidth: APP_SHELL_MAX_WIDTH,
                    mx: 'auto',
                    px: { xs: 2, sm: 3, lg: 4, xl: 5 },
                    pb: { xs: 4, md: 5.5 },
                }}
            >
                <Box
                    sx={panelSx(theme, {
                        px: { xs: 2, sm: 2.5 },
                        py: { xs: 1.6, sm: 1.9 },
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        textAlign: 'center',
                        backgroundColor: alpha('#ffffff', 0.82),
                    })}
                >
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 650, color: '#475569' }}>
                        Contact
                    </Typography>
                    <Typography
                        component="a"
                        href="mailto:caochen@njmu.edu.cn"
                        sx={{
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: '#2563eb',
                            textDecoration: 'none',
                            '&:hover': {
                                textDecoration: 'underline',
                            },
                        }}
                    >
                        caochen@njmu.edu.cn
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

export default Home;
