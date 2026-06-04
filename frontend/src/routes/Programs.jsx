import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link as RouterLink, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box, Button, ButtonBase, Chip, Paper, Popover, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TableSortLabel, Tabs, TextField, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AccountTreeOutlined, BiotechOutlined, ExpandMore, HubOutlined, InsightsOutlined, OpenInNew, ScienceOutlined, Search, TableChartOutlined } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher, getProgramTraits } from '../api/gwas';
import GeneRegulation from '../components/GeneRegulation';
import ProgramAssociatedTraits from '../components/ProgramAssociatedTraits';
import { PageFrame } from '../components/PageScaffold';
import {
    captionSx,
    metricChipTone,
    panelSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    stickyTableHeaderCellSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

function numSort(a, b) {
    return (parseInt(String(a).replace(/\D/g, '')) || 0) - (parseInt(String(b).replace(/\D/g, '')) || 0);
}

function scoreMagnitude(row) {
    return Math.abs(Number(row.programScore) || 0) + Math.abs(Number(row.regulatorScore) || 0);
}

const PROGRAM_DETAIL_TABS = new Set(['overview', 'traits', 'regulation']);

function ProgramSummaryChips({ summary }) {
    const theme = useTheme();
    const items = [
        { label: 'traits', value: summary?.totalTraits, tone: 'neutral', icon: <TableChartOutlined /> },
        { label: 'program selected', value: summary?.selectedByProgram, tone: 'primary', icon: <ScienceOutlined /> },
        { label: 'regulator selected', value: summary?.selectedByRegulator, tone: 'accent', icon: <AccountTreeOutlined /> },
        { label: 'both', value: summary?.bothSelected, tone: 'success', icon: <HubOutlined /> },
        { label: 'visible genes', value: summary?.totalGenes, tone: 'warning', icon: <BiotechOutlined /> },
    ];

    return (
        <Stack direction="row" spacing={0.7} sx={{ flexWrap: 'wrap' }}>
            {items.map((item) => (
                <Chip
                    key={item.label}
                    icon={React.cloneElement(item.icon, { sx: { fontSize: 15 } })}
                    label={`${Number(item.value || 0).toLocaleString()} ${item.label}`}
                    size="small"
                    sx={summaryChipSx(theme, metricChipTone(theme, item.tone))}
                />
            ))}
        </Stack>
    );
}

function ProgramSwitcher({ programOptions, selectedProgram, onSelect }) {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState(null);
    const [search, setSearch] = useState('');
    const interactive = programOptions.length > 0;
    const open = Boolean(anchorEl);
    const filteredProgramOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return programOptions;
        const normalizedId = query.replace(/^p/, '');
        return programOptions.filter((option) => (
            option.label.toLowerCase().includes(query)
            || option.annotation.toLowerCase().includes(query)
            || option.id.includes(normalizedId)
        ));
    }, [programOptions, search]);

    const closePopover = useCallback(() => {
        setAnchorEl(null);
        setSearch('');
    }, []);

    const handleSelect = useCallback((id) => {
        closePopover();
        onSelect?.(id);
    }, [closePopover, onSelect]);

    useEffect(() => {
        setAnchorEl(null);
        setSearch('');
    }, [selectedProgram?.id]);

    return (
        <>
            <ButtonBase
                onClick={(event) => {
                    if (interactive) setAnchorEl(event.currentTarget);
                }}
                disableRipple={!interactive}
                sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1.25,
                    px: 0.5,
                    py: 0.25,
                    borderRadius: 1.2,
                    textAlign: 'left',
                    transition: `transform ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}`,
                    '&:hover': interactive ? {
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        transform: 'translateY(-1px)',
                    } : undefined,
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={sectionTitleSx(theme, { lineHeight: 1.2 })}>
                        Program {selectedProgram?.label || '—'}
                    </Typography>
                    <Typography sx={captionSx(theme, { fontSize: '0.86rem', mt: 0.35 })}>
                        {selectedProgram?.annotation || 'Program annotation is not available'}
                    </Typography>
                </Box>
                {interactive && <ExpandMore sx={{ mt: 0.45, color: theme.palette.text.secondary }} />}
            </ButtonBase>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                    sx: panelSx(theme, {
                        mt: 0.75,
                        width: { xs: 'min(92vw, 520px)', sm: 500 },
                        overflow: 'hidden',
                        boxShadow: theme.custom.shadow.float,
                    }),
                }}
            >
                <Box sx={sectionPanelHeaderSx(theme, { display: 'block', p: 1.25 })}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: theme.palette.text.primary }}>
                                Program list
                            </Typography>
                            <Typography sx={{ mt: 0.2, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                Browse by program id or annotation
                            </Typography>
                        </Box>
                        <Chip
                            label={`${filteredProgramOptions.length}/${programOptions.length}`}
                            size="small"
                            sx={summaryChipSx(theme, { ...metricChipTone(theme, 'primary'), flexShrink: 0 })}
                        />
                    </Box>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search P54 or ATP"
                        InputProps={{
                            startAdornment: <Search fontSize="small" sx={{ color: theme.custom.chart.axisSoft, mr: 0.75 }} />,
                        }}
                    />
                </Box>

                <Box sx={{ maxHeight: 440, overflowY: 'auto', p: 1 }}>
                    {filteredProgramOptions.length > 0 ? filteredProgramOptions.map((option) => {
                        const selected = option.id === selectedProgram?.id;
                        return (
                            <ButtonBase
                                key={option.id}
                                onClick={() => handleSelect(option.id)}
                                sx={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 1,
                                    px: 1.25,
                                    py: 1,
                                    mb: 0.75,
                                    borderRadius: 1,
                                    textAlign: 'left',
                                    border: selected ? `1px solid ${alpha(theme.palette.primary.main, 0.28)}` : `1px solid ${theme.custom.border.soft}`,
                                    backgroundColor: selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
                                    transition: `transform ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                                    '&:hover': {
                                        transform: 'translateY(-1px)',
                                        borderColor: alpha(theme.palette.primary.main, 0.24),
                                        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.1) : theme.custom.surface.raised,
                                        boxShadow: theme.custom.shadow.panel,
                                    },
                                }}
                            >
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                                        {option.label}
                                    </Typography>
                                    <Typography sx={{ mt: 0.3, fontSize: '0.8rem', color: theme.palette.text.secondary, lineHeight: 1.45 }}>
                                        {option.annotation}
                                    </Typography>
                                </Box>
                            </ButtonBase>
                        );
                    }) : (
                        <Box sx={{ px: 1, py: 3, textAlign: 'center' }}>
                            <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: theme.palette.text.primary }}>
                                No matching programs
                            </Typography>
                            <Typography sx={{ mt: 0.35, fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                                Try a shorter search or a program id.
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Popover>
        </>
    );
}

function ProgramOverview({ data, programId, onTabChange }) {
    const theme = useTheme();
    const traits = data?.traits || [];
    const topTraits = [...traits].sort((a, b) => scoreMagnitude(b) - scoreMagnitude(a)).slice(0, 8);
    const geneCounts = new Map();

    traits.forEach((trait) => {
        (trait.topGenes || []).forEach((gene) => {
            if (!gene) return;
            geneCounts.set(gene, (geneCounts.get(gene) || 0) + 1);
        });
    });
    const topGenes = [...geneCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 24);

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.38fr) minmax(260px, 0.62fr)' }, gap: 2, alignItems: 'stretch' }}>
            <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
                <Box sx={sectionPanelHeaderSx(theme, { justifyContent: 'space-between' })}>
                    <Box>
                        <Typography sx={sectionTitleSx(theme, { fontSize: '1rem' })}>Top associated traits</Typography>
                        <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>Ranked by combined program and regulator score magnitude.</Typography>
                    </Box>
                    <Button
                        size="small"
                        onClick={() => onTabChange('traits')}
                        endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                        sx={{ textTransform: 'none', fontWeight: 750 }}
                    >
                        View table
                    </Button>
                </Box>
                <Stack divider={<Box sx={{ borderTop: `1px solid ${theme.custom.border.soft}` }} />} sx={{ p: 1.25 }}>
                    {topTraits.map((trait, index) => (
                        <Box key={`${trait.traitId}-${index}`} sx={{ py: 0.9, ...tableRowRevealSx(theme, index) }}>
                            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                                <Box sx={{ minWidth: 0 }}>
                                    <Button
                                        component={RouterLink}
                                        to={`/trait/${encodeURIComponent(trait.fileId || trait.traitId)}`}
                                        sx={{ textTransform: 'none', px: 0, justifyContent: 'flex-start', color: theme.palette.text.primary, fontWeight: 800, lineHeight: 1.25 }}
                                    >
                                        {trait.traitName || trait.traitId}
                                    </Button>
                                    <Typography sx={{ fontSize: '0.68rem', color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                                        {trait.traitId}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.45} sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    {trait.selectedByProgram && <Chip label="program" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />}
                                    {trait.selectedByRegulator && <Chip label="regulator" size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))} />}
                                </Stack>
                            </Stack>
                            <Typography sx={{ mt: 0.4, fontSize: '0.72rem', color: theme.palette.text.secondary }}>
                                program {Number(trait.programScore || 0).toFixed(3)} / regulator {Number(trait.regulatorScore || 0).toFixed(3)}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            </Paper>

            <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' })}>
                <Box sx={sectionPanelHeaderSx(theme)}>
                    <Box>
                        <Typography sx={sectionTitleSx(theme, { fontSize: '1rem' })}>Top genes preview</Typography>
                        <Typography sx={captionSx(theme, { fontSize: '0.74rem' })}>Single-gene frequency across associated traits.</Typography>
                    </Box>
                </Box>
                <Box
                    sx={{
                        p: 1.25,
                        display: 'flex',
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                    <Box sx={{ width: '100%', display: 'flex', minHeight: 0 }}>
                        {topGenes.length ? (
                            <Box
                                sx={{
                                    width: '100%',
                                    flex: 1,
                                    minHeight: 0,
                                    borderRadius: 1.15,
                                    border: `1px solid ${theme.custom.border.soft}`,
                                    overflow: 'hidden',
                                    backgroundColor: theme.palette.background.paper,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems="center"
                                    sx={{
                                        px: 1.25,
                                        py: 0.8,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        backgroundColor: theme.custom.surface.raised,
                                    }}
                                >
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
                                        Gene
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.palette.text.secondary }}>
                                        Value
                                    </Typography>
                                </Stack>
                                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                                    <Stack divider={<Box sx={{ borderTop: `1px solid ${theme.custom.border.soft}` }} />}>
                                        {topGenes.map(([gene, count], index) => (
                                            <Stack
                                                key={gene}
                                                direction="row"
                                                spacing={1}
                                                justifyContent="space-between"
                                                alignItems="center"
                                                sx={{
                                                    px: 1.25,
                                                    py: 0.82,
                                                    ...tableRowRevealSx(theme, index),
                                                }}
                                            >
                                                <Button
                                                    component={RouterLink}
                                                    to={`/genes?query=${encodeURIComponent(gene)}`}
                                                    sx={{
                                                        minWidth: 0,
                                                        px: 0,
                                                        py: 0,
                                                        justifyContent: 'flex-start',
                                                        textTransform: 'none',
                                                        color: theme.palette.text.primary,
                                                        fontWeight: 750,
                                                        fontSize: '0.84rem',
                                                        lineHeight: 1.25,
                                                    }}
                                                >
                                                    {gene}
                                                </Button>
                                                <Chip
                                                    label={count}
                                                    size="small"
                                                    sx={summaryChipSx(theme, metricChipTone(theme, count > 2 ? 'primary' : 'subtle'))}
                                                />
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Box>
                            </Box>
                        ) : (
                            <Typography sx={captionSx(theme, { fontSize: '0.8rem' })}>No top gene preview is available for {programId}.</Typography>
                        )}
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}

export default function Programs() {
    const theme = useTheme();
    const neutralTone = tableTone(theme, 'neutral');
    const programHeaderSx = {
        fontWeight: 700,
        fontSize: '0.75rem',
        py: 1,
        px: 1.5,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
    };
    const { programId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { data: info, isLoading: loading } = useSWR('/api/programs/info', fetcher, {
        keepPreviousData: true, revalidateOnFocus: false, revalidateOnReconnect: false,
    });
    const [programs, setPrograms] = useState([]);
    const [sortBy, setSortBy] = useState('program');
    const [sortDir, setSortDir] = useState('asc');
    const requestedTabKey = searchParams.get('tab');
    const activeTab = PROGRAM_DETAIL_TABS.has(requestedTabKey) ? requestedTabKey : 'overview';
    const normalizedProgramId = programId
        ? (/^P/i.test(programId) ? programId : `P${programId}`)
        : null;
    const regId = programId ? programId.replace(/^P/i, '') : '';
    const { data: traitData, error: traitError, isLoading: traitLoading } = useSWR(
        normalizedProgramId ? ['program-traits-page', normalizedProgramId] : null,
        ([, id]) => getProgramTraits(id),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    useEffect(() => {
        fetch('/api/regulation/list').then(r => r.json()).then(res => setPrograms(res.programs || [])).catch(() => {});
    }, []);

    const syncTabParam = useCallback((nextTab, options = {}) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', nextTab);
        setSearchParams(nextParams, options);
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (programId && requestedTabKey !== activeTab) {
            syncTabParam(activeTab, { replace: true });
        }
    }, [activeTab, programId, requestedTabKey, syncTabParam]);

    const rows = useMemo(() => {
        const items = Object.entries(info || {}).map(([k, v]) => ({ key: k, ...v }));
        const dir = sortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            if (sortBy === 'program') return numSort(a.program, b.program) * dir;
            if (sortBy === 'go_enrichment_p') return ((parseFloat(a.go_enrichment_p) || 0) - (parseFloat(b.go_enrichment_p) || 0)) * dir;
            return String(a[sortBy] || '').localeCompare(String(b[sortBy] || '')) * dir;
        });
        return items;
    }, [info, sortBy, sortDir]);

    const annotation = traitData?.program?.annotation || info?.[normalizedProgramId]?.curated_annotation || info?.[regId]?.curated_annotation || '';
    const programOptions = useMemo(() => {
        const seen = new Set();
        const sourceIds = programs.length > 0
            ? programs.map((item) => item?.id)
            : Object.keys(info || {}).map((key) => String(key).replace(/^P/i, ''));

        return sourceIds
            .map((rawId) => {
                const id = String(rawId || '').replace(/^P/i, '').trim();
                if (!id || seen.has(id)) return null;
                seen.add(id);
                const record = info?.[`P${id}`] || info?.[id];
                return {
                    id,
                    label: `P${id}`,
                    annotation: record?.curated_annotation || 'Unannotated',
                };
            })
            .filter(Boolean)
            .sort((a, b) => Number(a.id) - Number(b.id));
    }, [info, programs]);
    const selectedProgramOption = useMemo(() => {
        if (!normalizedProgramId) return null;
        return programOptions.find((item) => item.id === String(regId || '')) || {
            id: String(regId || ''),
            label: normalizedProgramId,
            annotation: annotation || 'Program annotation is not available',
        };
    }, [annotation, normalizedProgramId, programOptions, regId]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const handleTabChange = useCallback((nextTab) => {
        syncTabParam(nextTab);
    }, [syncTabParam]);

    const handleProgramSelect = useCallback((id) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', activeTab);
        navigate({
            pathname: `/programs/P${id}`,
            search: `?${nextParams.toString()}`,
        });
    }, [activeTab, navigate, searchParams]);

    if (programId) {
        return (
            <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 1, sm: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                <Paper elevation={0} sx={panelSx(theme, { p: 1.5, mb: 1.5 })}>
                    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'stretch', xl: 'flex-start' }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <ProgramSwitcher
                                programOptions={programOptions}
                                selectedProgram={selectedProgramOption}
                                onSelect={handleProgramSelect}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', xl: 'flex-end' } }}>
                            <ProgramSummaryChips summary={traitData?.summary || {}} />
                        </Box>
                    </Stack>
                </Paper>

                <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden', mb: 1.5 })}>
                    <Tabs
                        value={activeTab}
                        onChange={(event, value) => handleTabChange(value)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 44,
                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                            '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 750 },
                        }}
                    >
                        <Tab icon={<InsightsOutlined sx={{ fontSize: 18 }} />} iconPosition="start" value="overview" label="Overview" />
                        <Tab icon={<AccountTreeOutlined sx={{ fontSize: 18 }} />} iconPosition="start" value="traits" label="Associated Traits" />
                        <Tab icon={<ScienceOutlined sx={{ fontSize: 18 }} />} iconPosition="start" value="regulation" label="Gene Regulation" />
                    </Tabs>
                </Paper>

                {traitError && (
                    <Paper elevation={0} sx={panelSx(theme, { p: 2, mb: 1.5 })}>
                        <Typography sx={{ color: theme.palette.error.main, fontWeight: 700 }}>Failed to load program trait index.</Typography>
                    </Paper>
                )}

                {activeTab === 'overview' && (
                    traitLoading ? (
                        <Paper elevation={0} sx={panelSx(theme, { p: 2 })}>
                            <Skeleton height={180} />
                        </Paper>
                    ) : (
                        <ProgramOverview data={traitData} programId={normalizedProgramId} onTabChange={handleTabChange} />
                    )
                )}
                {activeTab === 'traits' && <ProgramAssociatedTraits programId={normalizedProgramId} />}
                {activeTab === 'regulation' && <GeneRegulation programId={regId} />}
            </Box>
        );
    }

    const skeleton = Array.from({ length: 12 }, (_, i) => (
        <TableRow key={i}>
            <TableCell sx={{ py: 1.2, px: 2 }}><Skeleton width={50} /></TableCell>
            <TableCell sx={{ py: 1.2, px: 2 }}><Skeleton width="80%" /></TableCell>
            <TableCell sx={{ py: 1.2, px: 2 }}><Skeleton width="60%" /></TableCell>
            <TableCell sx={{ py: 1.2, px: 2 }}><Skeleton width={80} /></TableCell>
            <TableCell sx={{ py: 1.2, px: 2 }}><Skeleton /></TableCell>
        </TableRow>
    ));

    return (
        <PageFrame
            title="Program Annotations"
            subtitle="Biological annotations and gene sets for cNMF programs"
            maxWidth={1200}
            compact
            sx={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
        >
            <Paper elevation={0} sx={panelSx(theme, {
                overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
            })}>
                <TableContainer sx={stickyTableContainerSx(theme, { flex: 1, overflowX: 'auto', overflowY: 'auto' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme)}>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', { ...programHeaderSx, width: 80 })}>
                                    <TableSortLabel active={sortBy === 'program'} direction={sortDir}
                                        onClick={() => handleSort('program')}>Program</TableSortLabel>
                                </TableCell>
                                <TableCell sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', programHeaderSx)}>
                                    <TableSortLabel active={sortBy === 'curated_annotation'} direction={sortDir}
                                        onClick={() => handleSort('curated_annotation')}>Annotation</TableSortLabel>
                                </TableCell>
                                <TableCell sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', programHeaderSx)}>Representative GO</TableCell>
                                <TableCell sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', { ...programHeaderSx, width: 90 })}>
                                    <TableSortLabel active={sortBy === 'go_enrichment_p'} direction={sortDir}
                                        onClick={() => handleSort('go_enrichment_p')}>GO P</TableSortLabel>
                                </TableCell>
                                <TableCell sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', programHeaderSx)}>Top Genes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? skeleton : rows.map((r, i) => (
                                <TableRow key={r.program} hover
                                    sx={{
                                        '& td': { py: 0.6, px: 1.5, borderBottom: '1px solid #f3f4f6' },
                                        ...tableRowRevealSx(theme, i),
                                        '&:hover td': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.035),
                                        },
                                    }}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem', color: theme.palette.primary.main, whiteSpace: 'nowrap', cursor: 'pointer' }}
                                        onClick={() => navigate(`/programs/${r.program}`)}>
                                        {r.program}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                                        {r.curated_annotation}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>
                                        {r.representative_go}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                                        {r.go_enrichment_p}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}
                                        title={r.top10_genes}>
                                        {r.top10_genes}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </PageFrame>
    );
}
