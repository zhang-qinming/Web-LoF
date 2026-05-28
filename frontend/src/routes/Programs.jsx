import React, { useEffect, useState, useMemo } from 'react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import {
    Box, Button, Chip, Paper, Skeleton, Stack, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TableSortLabel, Tabs, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AccountTreeOutlined, BiotechOutlined, HubOutlined, InsightsOutlined, OpenInNew, ScienceOutlined, TableChartOutlined } from '@mui/icons-material';
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
        .slice(0, 16);

    return (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)' }, gap: 2 }}>
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

            <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
                <Box sx={sectionPanelHeaderSx(theme)}>
                    <Typography sx={sectionTitleSx(theme, { fontSize: '1rem' })}>Top genes preview</Typography>
                </Box>
                <Box sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={0.55} sx={{ flexWrap: 'wrap' }}>
                        {topGenes.length ? topGenes.map(([gene, count]) => (
                            <Chip
                                key={gene}
                                label={`${gene} ${count}`}
                                size="small"
                                component={RouterLink}
                                clickable
                                to={`/genes?query=${encodeURIComponent(gene)}`}
                                sx={summaryChipSx(theme, metricChipTone(theme, count > 2 ? 'primary' : 'subtle'))}
                            />
                        )) : (
                            <Typography sx={captionSx(theme, { fontSize: '0.8rem' })}>No top gene preview is available for {programId}.</Typography>
                        )}
                    </Stack>
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
    const { data: info, isLoading: loading } = useSWR('/api/programs/info', fetcher, {
        keepPreviousData: true, revalidateOnFocus: false, revalidateOnReconnect: false,
    });
    const [programs, setPrograms] = useState([]);
    const [sortBy, setSortBy] = useState('program');
    const [sortDir, setSortDir] = useState('asc');
    const [activeTab, setActiveTab] = useState('overview');
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

    const handleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    if (programId) {
        const annotation = traitData?.program?.annotation || info?.[normalizedProgramId]?.curated_annotation || info?.[regId]?.curated_annotation || '';

        return (
            <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 1, sm: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
                <Paper elevation={0} sx={panelSx(theme, { p: 1.5, mb: 1.5 })}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h5" sx={sectionTitleSx(theme, { lineHeight: 1.2 })}>
                                Program {normalizedProgramId}
                            </Typography>
                            <Typography sx={captionSx(theme, { fontSize: '0.86rem', mt: 0.35 })}>
                                {annotation || 'Program annotation is not available'}
                            </Typography>
                        </Box>
                        <ProgramSummaryChips summary={traitData?.summary || {}} />
                    </Stack>
                </Paper>

                <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden', mb: 1.5 })}>
                    <Tabs
                        value={activeTab}
                        onChange={(event, value) => setActiveTab(value)}
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
                        <ProgramOverview data={traitData} programId={normalizedProgramId} onTabChange={setActiveTab} />
                    )
                )}
                {activeTab === 'traits' && <ProgramAssociatedTraits programId={normalizedProgramId} />}
                {activeTab === 'regulation' && (
                    <GeneRegulation programId={regId} programs={programs}
                        onProgramChange={(id) => navigate(`/programs/P${id}`)} />
                )}
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
                <TableContainer sx={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                    <Table stickyHeader size="small">
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
