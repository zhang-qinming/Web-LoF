import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import {
    Box, Button, ButtonBase, Chip, InputAdornment, Paper, Popover, Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
    TablePagination,
    TableHead, TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AccountTreeOutlined, BiotechOutlined, DownloadOutlined, ExpandMore, HubOutlined, OpenInNew, ScienceOutlined, Search, TableChartOutlined } from '@mui/icons-material';
import useSWR from 'swr';
import { fetcher, getProgramGenes, getProgramTraits } from '../api/gwas';
import ProgramAssociatedTraits from '../components/ProgramAssociatedTraits';
import { PageFrame } from '../components/PageScaffold';
import { downloadBlob } from '../utils/download';
import {
    captionSx,
    groupedTableColumnHeaderCellSx,
    groupedTableHeaderMetrics,
    groupedTableHeaderCellSx,
    metricChipTone,
    panelSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    summaryChipSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';

function numSort(a, b) {
    return (parseInt(String(a).replace(/\D/g, '')) || 0) - (parseInt(String(b).replace(/\D/g, '')) || 0);
}

const GO_ACCESSION_PATTERN = /GO[:_]\d+/i;

const PROGRAM_TABLE_COLUMNS = [
    { key: 'program', label: 'Program', align: 'center', tone: 'identity', width: 100 },
    { key: 'curated_annotation', label: 'Annotation', align: 'left', tone: 'annotation', width: 360 },
    { key: 'go_term', label: 'GO Term', align: 'left', tone: 'annotation', width: 320 },
    { key: 'go_accession', label: 'Accession', align: 'center', tone: 'metric', width: 140 },
    { key: 'go_ontology', label: 'Ontology', align: 'center', tone: 'metric', width: 190 },
    { key: 'go_enrichment_p', label: 'P-value', align: 'right', tone: 'metric', width: 132 },
    { key: 'top10_genes', label: 'Top10 Gene', align: 'left', tone: 'genes', width: 380 },
];

const PROGRAM_TABLE_GROUPS = [
    { label: 'Program', span: 1, tone: 'identity' },
    { label: 'Functional Annotation', span: 2, tone: 'annotation' },
    { label: 'GO Evidence', span: 3, tone: 'metric' },
    { label: 'Gene Preview', span: 1, tone: 'genes' },
];
const PROGRAM_TABLE_TITLE_HEADER_HEIGHT = 48;

const PROGRAM_INFO_COLUMNS = [
    { key: 'program', label: 'Program', align: 'center', tone: 'identity', width: 120 },
    { key: 'annotation', label: 'Annotation', align: 'left', tone: 'annotation', width: 360 },
    { key: 'goTerm', label: 'GO Term', align: 'left', tone: 'annotation', width: 300 },
    { key: 'goOntology', label: 'GO Ontology', align: 'center', tone: 'annotation', width: 150 },
    { key: 'associatedGenes', label: 'Associated Genes', align: 'right', tone: 'genes', width: 150 },
    { key: 'associatedTraits', label: 'Associated Traits', align: 'right', tone: 'metric', width: 150 },
];

const PROGRAM_GENE_COLUMNS = [
    { key: 'geneSymbol', label: 'Symbol', align: 'center', tone: 'genes', width: 150 },
    { key: 'ensgId', label: 'ENSEMBL id', align: 'center', tone: 'identity', width: 180 },
    { key: 'location', label: 'Location', align: 'center', tone: 'annotation', width: 220 },
    { key: 'geneType', label: 'Gene Type', align: 'center', tone: 'annotation', width: 180 },
    { key: 'direction', label: 'Direction in Program', align: 'center', tone: 'metric', width: 210 },
    { key: 'value', label: 'Value', align: 'right', tone: 'metric', width: 140 },
];

const DETAIL_TABLE_TITLE_HEADER_HEIGHT = 56;

const programSortLabelSx = {
    fontSize: '0.68rem',
    m: 0,
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.82rem',
        margin: 0,
    },
};

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildGoUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const accession = extractGoAccession(text);
    if (accession) {
        return `https://amigo.geneontology.org/amigo/term/${accession}`;
    }
    return `https://amigo.geneontology.org/amigo/search/ontology?q=${encodeURIComponent(text)}`;
}

function extractGoAccession(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(GO_ACCESSION_PATTERN);
    return match ? match[0].replace('_', ':').toUpperCase() : '';
}

function splitTopGenes(value) {
    return String(value || '')
        .split(/[;,]\s*/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildProgramTableCsv(rows) {
    const header = ['Program', 'Annotation', 'GO Term', 'Accession', 'Ontology', 'P-value', 'Top10 Gene'];
    const lines = [
        header.map(escapeCsvValue).join(','),
        ...rows.map((row) => [
            row.program || '',
            row.curated_annotation || '',
            row.go_term || '',
            row.go_accession || '',
            row.go_ontology || '',
            row.go_enrichment_p || '',
            row.top10_genes || '',
        ].map(escapeCsvValue).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function programSortDescription(sortBy, sortDir) {
    const column = PROGRAM_TABLE_COLUMNS.find((item) => item.key === sortBy);
    return `${column?.label || sortBy} ${sortDir === 'desc' ? 'descending' : 'ascending'}`;
}

function sortDescription(columns, sortBy, sortDir) {
    const column = columns.find((item) => item.key === sortBy);
    return `${column?.label || sortBy} ${sortDir === 'desc' ? 'descending' : 'ascending'}`;
}

function compareProgramInfoRows(a, b, sortBy, sortDir) {
    let result = 0;
    if (['associatedGenes', 'associatedTraits'].includes(sortBy)) {
        result = (Number(a?.[sortBy]) || 0) - (Number(b?.[sortBy]) || 0);
    } else {
        result = String(a?.[sortBy] || '').localeCompare(String(b?.[sortBy] || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
        });
    }
    return sortDir === 'desc' ? -result : result;
}

function compareProgramGeneRows(a, b, sortBy, sortDir) {
    let result = 0;
    if (sortBy === 'value') {
        result = (Number(a?.value) || 0) - (Number(b?.value) || 0);
    } else if (sortBy === 'location') {
        result = String(a?.location || '').localeCompare(String(b?.location || ''), undefined, { numeric: true, sensitivity: 'base' });
    } else {
        result = String(a?.[sortBy] || '').localeCompare(String(b?.[sortBy] || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
        });
    }

    if (result === 0) {
        result = String(a?.geneSymbol || a?.ensgId || '').localeCompare(String(b?.geneSymbol || b?.ensgId || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
        });
    }
    return sortDir === 'desc' ? -result : result;
}

function buildProgramInfoCsv(rows) {
    const lines = [
        PROGRAM_INFO_COLUMNS.map((column) => escapeCsvValue(column.label)).join(','),
        ...rows.map((row) => PROGRAM_INFO_COLUMNS.map((column) => escapeCsvValue(row[column.key] ?? '')).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function buildProgramGeneCsv(rows) {
    const lines = [
        PROGRAM_GENE_COLUMNS.map((column) => escapeCsvValue(column.label)).join(','),
        ...rows.map((row) => PROGRAM_GENE_COLUMNS.map((column) => escapeCsvValue(row[column.key] ?? '')).join(',')),
    ];
    return `${lines.join('\n')}\n`;
}

function formatProgramGeneValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    if (Math.abs(number) >= 100) return number.toFixed(1);
    if (Math.abs(number) >= 1) return number.toFixed(3);
    return number.toPrecision(3);
}

function programTableCellSx(theme, tone, align = 'left', overrides = {}) {
    const useDataFont = overrides.fontFamily === 'monospace';
    const { fontFamily, ...restOverrides } = overrides;
    return {
        py: 0.72,
        px: 1,
        textAlign: align,
        fontSize: '0.74rem',
        lineHeight: 1.32,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        bgcolor: tone.cellSoft,
        color: theme.palette.text.primary,
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        ...restOverrides,
    };
}

function detailTableTitleCellSx(theme) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: '43 !important',
        height: DETAIL_TABLE_TITLE_HEADER_HEIGHT,
        py: 0.75,
        px: 1.25,
        bgcolor: theme.custom.surface.raised,
        backgroundColor: `${theme.custom.surface.raised} !important`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        color: theme.palette.text.primary,
    };
}

function detailTableColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: DETAIL_TABLE_TITLE_HEADER_HEIGHT,
    });
}

function detailTableFooterSx(theme) {
    return {
        px: { xs: 1.25, md: 1.6 },
        py: 1,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: 1,
        background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.028)}, ${theme.custom.surface.subtle})`,
        borderTop: `1px solid ${theme.custom.border.soft}`,
    };
}

function detailTableCellSx(theme, tone, align = 'left', overrides = {}) {
    const useDataFont = overrides.fontFamily === 'monospace';
    const { fontFamily, ...restOverrides } = overrides;
    return {
        py: 0.78,
        px: 1,
        textAlign: align,
        fontSize: '0.74rem',
        lineHeight: 1.3,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        bgcolor: tone.cellSoft,
        color: theme.palette.text.primary,
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontFamily: useDataFont ? 'inherit' : fontFamily,
        fontVariantNumeric: useDataFont ? 'tabular-nums' : undefined,
        fontFeatureSettings: useDataFont ? '"tnum" 1' : undefined,
        ...restOverrides,
    };
}

function programTableTitleCellSx(theme) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: '43 !important',
        height: PROGRAM_TABLE_TITLE_HEADER_HEIGHT,
        py: 0.75,
        px: 1.25,
        bgcolor: theme.custom.surface.raised,
        backgroundColor: `${theme.custom.surface.raised} !important`,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        color: theme.palette.text.primary,
    };
}

function programTableGroupHeaderSx(theme, tone) {
    return groupedTableHeaderCellSx(theme, tone, {
        top: PROGRAM_TABLE_TITLE_HEADER_HEIGHT,
    });
}

function programTableColumnHeaderSx(theme, tone, align) {
    return groupedTableColumnHeaderCellSx(theme, tone, align, {
        top: PROGRAM_TABLE_TITLE_HEADER_HEIGHT + groupedTableHeaderMetrics.groupHeight,
    });
}

function ProgramSummaryChips({ summary }) {
    const theme = useTheme();
    const items = [
        { label: 'Traits', value: summary?.totalTraits, tone: 'neutral', icon: <TableChartOutlined /> },
        { label: 'Program', value: summary?.selectedByProgram, tone: 'primary', icon: <ScienceOutlined /> },
        { label: 'Regulator', value: summary?.selectedByRegulator, tone: 'accent', icon: <AccountTreeOutlined /> },
        { label: 'Both', value: summary?.bothSelected, tone: 'success', icon: <HubOutlined /> },
        { label: 'Genes', value: summary?.totalGenes, tone: 'warning', icon: <BiotechOutlined /> },
    ];

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, minmax(92px, 1fr))', xl: 'repeat(5, 104px)' },
                gap: 0.75,
                width: { xs: '100%', xl: 'auto' },
            }}
        >
            {items.map((item) => {
                const colors = metricChipTone(theme, item.tone);
                return (
                    <Box
                        key={item.label}
                        sx={{
                            px: 1,
                            py: 0.8,
                            borderRadius: 1,
                            border: colors.border,
                            bgcolor: colors.backgroundColor,
                            color: colors.color,
                            minWidth: 0,
                        }}
                    >
                        <Stack direction="row" spacing={0.55} alignItems="center">
                            {React.cloneElement(item.icon, { sx: { fontSize: 15, flexShrink: 0 } })}
                            <Typography sx={{ fontSize: '1rem', lineHeight: 1.1, fontWeight: 740, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>
                                {(Number(item.value) || 0).toLocaleString()}
                            </Typography>
                        </Stack>
                        <Typography sx={{ mt: 0.25, fontSize: '0.62rem', fontWeight: 650, textTransform: 'none', letterSpacing: '0.05em' }}>
                            {item.label}
                        </Typography>
                    </Box>
                );
            })}
        </Box>
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
                        Program {selectedProgram?.label || '-'}
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

function ProgramInfoTable({ row, loading, loadingCounts = false }) {
    const theme = useTheme();
    const tones = {
        identity: tableTone(theme, 'neutral'),
        annotation: tableTone(theme, 'success'),
        genes: tableTone(theme, 'accent'),
        metric: tableTone(theme, 'primary'),
    };
    const [sortBy, setSortBy] = useState('program');
    const [sortDir, setSortDir] = useState('asc');

    const rows = useMemo(() => (
        row ? [row].sort((a, b) => compareProgramInfoRows(a, b, sortBy, sortDir)) : []
    ), [row, sortBy, sortDir]);

    const handleSort = useCallback((key) => {
        if (sortBy === key) {
            setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(key);
        setSortDir(['associatedGenes', 'associatedTraits'].includes(key) ? 'desc' : 'asc');
    }, [sortBy]);

    const handleDownload = useCallback(() => {
        downloadBlob(new Blob([buildProgramInfoCsv(rows)], { type: 'text/csv;charset=utf-8;' }), `${row?.program || 'program'}-information.csv`);
    }, [row?.program, rows]);

    const skeletonRows = Array.from({ length: 1 }, (_, index) => (
        <TableRow key={index}>
            {PROGRAM_INFO_COLUMNS.map((column) => (
                <TableCell key={column.key} sx={{ py: 1.2, px: 1 }}>
                    <Skeleton />
                </TableCell>
            ))}
        </TableRow>
    ));

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1260 })}>
                    <colgroup>
                        {PROGRAM_INFO_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell colSpan={PROGRAM_INFO_COLUMNS.length} sx={detailTableTitleCellSx(theme)}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.94rem', lineHeight: 1.2 })}>
                                            Program Information
                                        </Typography>
                                        <Typography sx={captionSx(theme, { fontSize: '0.7rem', lineHeight: 1.35 })}>
                                            Program annotation, representative GO function, and associated counts.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                        <Chip
                                            label={row?.associatedGenes == null ? 'genes loading' : `${Number(row.associatedGenes || 0).toLocaleString()} genes`}
                                            size="small"
                                            sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))}
                                        />
                                        <Button
                                            size="small"
                                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                            onClick={handleDownload}
                                            disabled={!rows.length}
                                            sx={{ textTransform: 'none', fontSize: '0.72rem', color: theme.palette.text.secondary, flexShrink: 0 }}
                                        >
                                            CSV
                                        </Button>
                                    </Stack>
                                </Stack>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_INFO_COLUMNS.map((column) => (
                                <TableCell key={column.key} sx={detailTableColumnHeaderSx(theme, tones[column.tone], column.align)}>
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        hideSortIcon
                                        onClick={() => handleSort(column.key)}
                                        sx={programSortLabelSx}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? skeletonRows : rows.map((item, index) => (
                            <TableRow key={item.program} hover sx={tableRowRevealSx(theme, index)}>
                                <TableCell sx={detailTableCellSx(theme, tones.identity, 'center', { bgcolor: tones.identity.cellStrong, fontFamily: 'monospace', fontWeight: 720 })}>
                                    {item.program || '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.annotation, 'left', { whiteSpace: 'normal' })}>
                                    {item.annotation || '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.annotation, 'left', { bgcolor: tones.annotation.cellStrong, whiteSpace: 'normal' })}>
                                    {item.goTerm ? (
                                        <Button
                                            component="a"
                                            href={buildGoUrl(item.goAccession || item.goTerm)}
                                            target="_blank"
                                            rel="noreferrer"
                                            endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
                                            sx={{ textTransform: 'none', px: 0, py: 0, color: tones.annotation.headerColor, fontWeight: 680, fontSize: '0.72rem', lineHeight: 1.25 }}
                                        >
                                            {item.goTerm}
                                        </Button>
                                    ) : '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.annotation, 'center')}>
                                    {item.goOntology || '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.genes, 'right', { fontFamily: 'monospace', fontWeight: 700, bgcolor: tones.genes.cellStrong })}>
                                    {loadingCounts && item.associatedGenes == null ? <Skeleton width={48} sx={{ ml: 'auto' }} /> : Number(item.associatedGenes || 0).toLocaleString()}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.metric, 'right', { fontFamily: 'monospace', fontWeight: 700, bgcolor: tones.metric.cellStrong })}>
                                    {loadingCounts && item.associatedTraits == null ? <Skeleton width={48} sx={{ ml: 'auto' }} /> : Number(item.associatedTraits || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <Box sx={detailTableFooterSx(theme)}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                    {loading ? 'Loading program information' : `Showing ${rows.length.toLocaleString()} row`}
                </Typography>
                <Chip
                    label={sortDescription(PROGRAM_INFO_COLUMNS, sortBy, sortDir)}
                    size="small"
                    sx={summaryChipSx(theme, { height: 22, color: theme.palette.text.secondary, bgcolor: alpha(theme.palette.text.primary, 0.045) })}
                />
            </Box>
        </Paper>
    );
}

function ProgramGenesTable({ programId, maxHeight = 640 }) {
    const theme = useTheme();
    const tones = {
        identity: tableTone(theme, 'neutral'),
        annotation: tableTone(theme, 'success'),
        genes: tableTone(theme, 'accent'),
        metric: tableTone(theme, 'primary'),
    };
    const [sortBy, setSortBy] = useState('value');
    const [sortDir, setSortDir] = useState('desc');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const { data, error, isLoading } = useSWR(
        programId ? ['program-genes', programId] : null,
        ([, id]) => getProgramGenes(id),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    const rows = useMemo(() => {
        const source = data?.genes || [];
        return [...source].sort((a, b) => compareProgramGeneRows(a, b, sortBy, sortDir));
    }, [data?.genes, sortBy, sortDir]);
    const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
    const currentPage = Math.min(page, pageCount - 1);
    const start = currentPage * rowsPerPage;
    const visibleRows = rows.slice(start, start + rowsPerPage);

    useEffect(() => {
        setPage(0);
    }, [programId, sortBy, sortDir]);

    const handleSort = useCallback((key) => {
        if (sortBy === key) {
            setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'));
            return;
        }
        setSortBy(key);
        setSortDir(key === 'value' ? 'desc' : 'asc');
    }, [sortBy]);

    const handleDownload = useCallback(() => {
        downloadBlob(new Blob([buildProgramGeneCsv(rows)], { type: 'text/csv;charset=utf-8;' }), `${programId || 'program'}-genes.csv`);
    }, [programId, rows]);

    const skeletonRows = Array.from({ length: 8 }, (_, index) => (
        <TableRow key={index}>
            {PROGRAM_GENE_COLUMNS.map((column) => (
                <TableCell key={column.key} sx={{ py: 1.1, px: 1 }}>
                    <Skeleton />
                </TableCell>
            ))}
        </TableRow>
    ));

    if (error) {
        return (
            <Paper elevation={0} sx={panelSx(theme, { p: 1.5 })}>
                <Typography sx={{ color: theme.palette.error.main, fontWeight: 680 }}>Failed to load program genes.</Typography>
            </Paper>
        );
    }

    if (data?.unavailable) {
        return (
            <Paper elevation={0} sx={panelSx(theme, { p: 1.5 })}>
                <Typography sx={{ color: theme.palette.warning.dark, fontWeight: 680 }}>Program gene SQL index is not available.</Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            <TableContainer sx={stickyTableContainerSx(theme, { maxHeight, overflowX: 'auto', overflowY: 'auto' })}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1080 })}>
                    <colgroup>
                        {PROGRAM_GENE_COLUMNS.map((column) => (
                            <col key={column.key} style={{ width: column.width }} />
                        ))}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell colSpan={PROGRAM_GENE_COLUMNS.length} sx={detailTableTitleCellSx(theme)}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.94rem', lineHeight: 1.2 })}>
                                            Program Genes
                                        </Typography>
                                        <Typography sx={captionSx(theme, { fontSize: '0.7rem', lineHeight: 1.35 })}>
                                            Showing {rows.length ? (start + 1).toLocaleString() : 0}-{Math.min(start + rowsPerPage, rows.length).toLocaleString()} of {rows.length.toLocaleString()} genes.
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                        <Chip
                                            label={`${rows.length.toLocaleString()} genes`}
                                            size="small"
                                            sx={summaryChipSx(theme, metricChipTone(theme, 'accent'))}
                                        />
                                        <Button
                                            size="small"
                                            startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                            onClick={handleDownload}
                                            disabled={!rows.length}
                                            sx={{ textTransform: 'none', fontSize: '0.72rem', color: theme.palette.text.secondary, flexShrink: 0 }}
                                        >
                                            CSV
                                        </Button>
                                    </Stack>
                                </Stack>
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            {PROGRAM_GENE_COLUMNS.map((column) => (
                                <TableCell key={column.key} sx={detailTableColumnHeaderSx(theme, tones[column.tone], column.align)}>
                                    <TableSortLabel
                                        active={sortBy === column.key}
                                        direction={sortBy === column.key ? sortDir : 'asc'}
                                        hideSortIcon
                                        onClick={() => handleSort(column.key)}
                                        sx={programSortLabelSx}
                                    >
                                        {column.label}
                                    </TableSortLabel>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? skeletonRows : visibleRows.map((item, index) => (
                            <TableRow
                                key={`${item.ensgId || item.geneSymbol}-${index}`}
                                hover
                                sx={{
                                    ...tableRowRevealSx(theme, index),
                                    '&:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                                }}
                            >
                                <TableCell sx={detailTableCellSx(theme, tones.genes, 'center', { bgcolor: tones.genes.cellStrong })}>
                                    <Button
                                        component={RouterLink}
                                        to={`/genes?query=${encodeURIComponent(item.geneSymbol || item.ensgId)}`}
                                        sx={{ textTransform: 'none', px: 0, py: 0, minHeight: 0, color: theme.palette.primary.dark, fontWeight: 700, fontSize: '0.74rem' }}
                                    >
                                        {item.geneSymbol || '-'}
                                    </Button>
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.identity, 'center', { fontFamily: 'monospace', fontSize: '0.7rem' })}>
                                    {item.ensgId || '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.annotation, 'center')}>
                                    {item.location || '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.annotation, 'center', { bgcolor: tones.annotation.cellStrong })}>
                                    {item.geneType || '-'}
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.metric, 'center')}>
                                    <Chip
                                        label={item.direction || '-'}
                                        size="small"
                                        sx={{ ...summaryChipSx(theme, metricChipTone(theme, 'subtle')), maxWidth: '100%', height: 21, fontSize: '0.62rem' }}
                                    />
                                </TableCell>
                                <TableCell sx={detailTableCellSx(theme, tones.metric, 'right', { bgcolor: tones.metric.cellStrong, fontFamily: 'monospace', fontWeight: 700 })}>
                                    {formatProgramGeneValue(item.value)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                component="div"
                count={rows.length}
                page={currentPage}
                onPageChange={(event, nextPage) => setPage(nextPage)}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[20, 50, 100, 250]}
                onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                }}
                sx={{
                    borderTop: `1px solid ${theme.custom.border.soft}`,
                    '& .MuiTablePagination-toolbar': { minHeight: 44 },
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                        fontSize: '0.74rem',
                        color: theme.palette.text.secondary,
                    },
                }}
            />
        </Paper>
    );
}

export default function Programs() {
    const theme = useTheme();
    const programTableTones = {
        identity: tableTone(theme, 'neutral'),
        annotation: tableTone(theme, 'success'),
        metric: tableTone(theme, 'primary'),
        genes: tableTone(theme, 'accent'),
    };
    const { programId } = useParams();
    const navigate = useNavigate();
    const { data: info, isLoading: loading } = useSWR('/api/programs/info', fetcher, {
        keepPreviousData: true, revalidateOnFocus: false, revalidateOnReconnect: false,
    });
    const [programs, setPrograms] = useState([]);
    const [programGeneSearch, setProgramGeneSearch] = useState('');
    const [sortBy, setSortBy] = useState('program');
    const [sortDir, setSortDir] = useState('asc');
    const normalizedProgramId = programId
        ? (/^P/i.test(programId) ? programId : `P${programId}`)
        : null;
    const programNumber = normalizedProgramId ? normalizedProgramId.replace(/^P/i, '') : '';
    const { data: traitData, error: traitError, isLoading: traitLoading } = useSWR(
        normalizedProgramId ? ['program-traits', normalizedProgramId] : null,
        ([, id]) => getProgramTraits(id),
        { keepPreviousData: true, revalidateOnFocus: false },
    );
    const { data: geneData, isLoading: geneLoading } = useSWR(
        normalizedProgramId ? ['program-genes', normalizedProgramId] : null,
        ([, id]) => getProgramGenes(id),
        { keepPreviousData: true, revalidateOnFocus: false },
    );

    useEffect(() => {
        fetch('/api/regulation/list').then(r => r.json()).then(res => setPrograms(res.programs || [])).catch(() => {});
    }, []);

    const rows = useMemo(() => {
        const query = programGeneSearch.trim().toLowerCase();
        const items = Object.entries(info || {}).map(([k, v]) => ({
            key: k,
            ...v,
            go_term: v?.go_term || v?.representative_go || '',
            go_accession: v?.go_accession || extractGoAccession(v?.representative_go),
            go_ontology: v?.go_ontology || '',
        }));
        const filteredItems = query
            ? items.filter((item) => splitTopGenes(item.top10_genes).some((gene) => gene.toLowerCase().includes(query)))
            : items;
        const dir = sortDir === 'asc' ? 1 : -1;
        filteredItems.sort((a, b) => {
            if (sortBy === 'program') return numSort(a.program, b.program) * dir;
            if (sortBy === 'go_enrichment_p') return ((parseFloat(a.go_enrichment_p) || 0) - (parseFloat(b.go_enrichment_p) || 0)) * dir;
            return String(a[sortBy] || '').localeCompare(String(b[sortBy] || '')) * dir;
        });
        return filteredItems;
    }, [info, programGeneSearch, sortBy, sortDir]);

    const selectedProgramInfo = info?.[normalizedProgramId] || info?.[programNumber] || {};
    const annotation = traitData?.program?.annotation || selectedProgramInfo?.curated_annotation || '';
    const programCount = Object.keys(info || {}).length;
    const detailSummary = {
        ...(traitData?.summary || {}),
        totalGenes: geneData?.genes?.length ?? traitData?.summary?.totalGenes ?? 0,
    };
    const detailInfoRow = normalizedProgramId ? {
        program: normalizedProgramId,
        annotation,
        goTerm: selectedProgramInfo?.go_term || selectedProgramInfo?.representative_go || geneData?.program?.representativeGo || '',
        goAccession: selectedProgramInfo?.go_accession || extractGoAccession(selectedProgramInfo?.go_term || selectedProgramInfo?.representative_go || geneData?.program?.representativeGo),
        goOntology: selectedProgramInfo?.go_ontology || '',
        associatedGenes: geneData?.genes?.length ?? null,
        associatedTraits: traitData?.summary?.totalTraits ?? null,
    } : null;
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
        return programOptions.find((item) => item.id === String(programNumber || '')) || {
            id: String(programNumber || ''),
            label: normalizedProgramId,
            annotation: annotation || 'Program annotation is not available',
        };
    }, [annotation, normalizedProgramId, programNumber, programOptions]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    const handleProgramTableDownload = useCallback(() => {
        const csv = buildProgramTableCsv(rows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'program-annotations.csv');
    }, [rows]);

    const handleProgramSelect = useCallback((id) => {
        navigate(`/programs/P${id}`);
    }, [navigate]);

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
                            <ProgramSummaryChips summary={detailSummary} />
                        </Box>
                    </Stack>
                </Paper>

                {traitError && (
                    <Paper elevation={0} sx={panelSx(theme, { p: 2, mb: 1.5 })}>
                        <Typography sx={{ color: theme.palette.error.main, fontWeight: 700 }}>Failed to load program trait index.</Typography>
                    </Paper>
                )}

                <Stack spacing={1.5}>
                    <ProgramInfoTable
                        row={detailInfoRow}
                        loading={loading}
                        loadingCounts={traitLoading || geneLoading}
                    />
                    <ProgramGenesTable programId={normalizedProgramId} maxHeight={640} />
                    <ProgramAssociatedTraits
                        programId={normalizedProgramId}
                        maxHeight={640}
                    />
                </Stack>
            </Box>
        );
    }

    const skeleton = Array.from({ length: 12 }, (_, i) => (
        <TableRow key={i}>
            {PROGRAM_TABLE_COLUMNS.map((column) => (
                <TableCell key={column.key} sx={{ py: 1.2, px: 2 }}>
                    <Skeleton />
                </TableCell>
            ))}
        </TableRow>
    ));

    return (
        <PageFrame
            title={null}
            subtitle={null}
            maxWidth={1500}
            compact
        >
            <Paper elevation={0} sx={panelSx(theme, {
                overflow: 'hidden',
            })}>
                <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                    <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: 1622 })}>
                        <colgroup>
                            {PROGRAM_TABLE_COLUMNS.map((column) => (
                                <col key={column.key} style={{ width: column.width }} />
                            ))}
                        </colgroup>
                        <TableHead>
                            <TableRow>
                                <TableCell colSpan={PROGRAM_TABLE_COLUMNS.length} sx={programTableTitleCellSx(theme)}>
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={0.9}
                                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                                        justifyContent="flex-start"
                                        sx={{ minWidth: 0 }}
                                    >
                                        <Box sx={{ minWidth: 0, flexShrink: 0 }}>
                                            <Typography sx={sectionTitleSx(theme, { fontSize: '0.98rem', lineHeight: 1.2 })}>
                                                Program Annotations
                                            </Typography>
                                        </Box>
                                        <Stack
                                            direction="row"
                                            spacing={0.65}
                                            alignItems="center"
                                            sx={{ flexWrap: 'wrap', justifyContent: 'flex-start', minWidth: 0 }}
                                        >
                                            <TextField
                                                size="small"
                                                value={programGeneSearch}
                                                onChange={(event) => setProgramGeneSearch(event.target.value)}
                                                placeholder="Filter by gene"
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Search sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                                sx={{
                                                    width: { xs: '100%', sm: 190 },
                                                    '& .MuiInputBase-root': {
                                                        height: 30,
                                                        fontSize: '0.72rem',
                                                        bgcolor: theme.palette.background.paper,
                                                    },
                                                }}
                                            />
                                            <Chip
                                                label={programGeneSearch.trim()
                                                    ? `${rows.length.toLocaleString()}/${programCount.toLocaleString()} programs`
                                                    : `${rows.length.toLocaleString()} programs`}
                                                size="small"
                                                sx={summaryChipSx(theme, {
                                                    height: 22,
                                                    color: theme.palette.primary.dark,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                                                })}
                                            />
                                            <Button
                                                size="small"
                                                startIcon={<DownloadOutlined sx={{ fontSize: 16 }} />}
                                                onClick={handleProgramTableDownload}
                                                disabled={!rows.length}
                                                sx={{ textTransform: 'none', fontSize: '0.72rem', color: theme.palette.text.secondary, flexShrink: 0 }}
                                            >
                                                CSV
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                {PROGRAM_TABLE_GROUPS.map((group) => (
                                    <TableCell
                                        key={group.label}
                                        colSpan={group.span}
                                        sx={programTableGroupHeaderSx(theme, programTableTones[group.tone])}
                                    >
                                        {group.label}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                {PROGRAM_TABLE_COLUMNS.map((column) => (
                                    <TableCell
                                        key={column.key}
                                        sx={programTableColumnHeaderSx(theme, programTableTones[column.tone], column.align)}
                                    >
                                        <TableSortLabel
                                            active={sortBy === column.key}
                                            direction={sortBy === column.key ? sortDir : 'asc'}
                                            hideSortIcon
                                            onClick={() => handleSort(column.key)}
                                            sx={programSortLabelSx}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? skeleton : rows.map((r, i) => (
                                <TableRow key={r.program} hover
                                    sx={{
                                        ...tableRowRevealSx(theme, i),
                                        '&:hover td': {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.035),
                                        },
                                    }}>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.identity, 'center', { bgcolor: programTableTones.identity.cellStrong })}>
                                        <Button
                                            component={RouterLink}
                                            to={`/programs/${r.program}`}
                                            sx={{
                                                textTransform: 'none',
                                                px: 0,
                                                py: 0,
                                                minHeight: 0,
                                                justifyContent: 'flex-start',
                                                color: theme.palette.primary.dark,
                                                fontVariantNumeric: 'tabular-nums',
                                                fontFeatureSettings: '"tnum" 1',
                                                fontWeight: 700,
                                                fontSize: '0.76rem',
                                            }}
                                        >
                                            {r.program}
                                        </Button>
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.annotation, 'left', { whiteSpace: 'normal' })}>
                                        <Typography sx={{ fontSize: '0.74rem', lineHeight: 1.35 }}>
                                            {r.curated_annotation || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ ...programTableCellSx(theme, programTableTones.annotation, 'left', { whiteSpace: 'normal' }), bgcolor: programTableTones.annotation.cellStrong }}>
                                        {r.go_term ? (
                                            <Button
                                                component="a"
                                                href={buildGoUrl(r.go_accession || r.go_term)}
                                                target="_blank"
                                                rel="noreferrer"
                                                endIcon={<OpenInNew sx={{ fontSize: 11 }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    px: 0,
                                                    py: 0,
                                                    minHeight: 0,
                                                    justifyContent: 'flex-start',
                                                    color: programTableTones.annotation.headerColor,
                                                    fontWeight: 680,
                                                    fontSize: '0.7rem',
                                                    lineHeight: 1.25,
                                                }}
                                            >
                                                {r.go_term}
                                            </Button>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.metric, 'center', { fontFamily: 'monospace', fontSize: '0.7rem' })}>
                                        {r.go_accession || '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.metric, 'center', { whiteSpace: 'normal', overflowWrap: 'anywhere' })}>
                                        {r.go_ontology || '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.metric, 'right', { bgcolor: programTableTones.metric.cellStrong, fontFamily: 'monospace', fontWeight: 680 })}>
                                        {r.go_enrichment_p || '-'}
                                    </TableCell>
                                    <TableCell sx={programTableCellSx(theme, programTableTones.genes, 'left', { whiteSpace: 'normal' })}>
                                        <Stack direction="row" spacing={0.45} sx={{ flexWrap: 'wrap' }}>
                                            {splitTopGenes(r.top10_genes).slice(0, 10).map((gene) => (
                                                <Chip
                                                    key={`${r.program}-${gene}`}
                                                    label={gene}
                                                    size="small"
                                                    component={RouterLink}
                                                    clickable
                                                    to={`/genes?query=${encodeURIComponent(gene)}`}
                                                    sx={{ ...summaryChipSx(theme, metricChipTone(theme, 'subtle')), height: 20, fontSize: '0.62rem' }}
                                                />
                                            ))}
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Box
                    sx={{
                        px: { xs: 1.5, md: 2 },
                        py: 1.35,
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
                        alignItems: 'center',
                        gap: 1.5,
                        background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.035)}, ${theme.custom.surface.subtle})`,
                        borderTop: `1px solid ${theme.custom.border.soft}`,
                    }}
                >
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {loading
                            ? 'Loading programs'
                            : programGeneSearch.trim()
                                ? `Showing ${rows.length.toLocaleString()} of ${programCount.toLocaleString()} programs filtered by gene`
                                : `Showing all ${rows.length.toLocaleString()} programs`}
                    </Typography>
                    <Chip
                        label={programSortDescription(sortBy, sortDir)}
                        size="small"
                        sx={summaryChipSx(theme, {
                            height: 22,
                            color: theme.palette.text.secondary,
                            bgcolor: alpha(theme.palette.text.primary, 0.045),
                        })}
                    />
                </Box>
            </Paper>
        </PageFrame>
    );
}
