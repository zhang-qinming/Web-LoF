import React, { startTransition, useEffect, useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box, Typography, TextField, IconButton, Checkbox,
    Chip, Pagination, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, InputAdornment, Tooltip, Button,
    Alert, LinearProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Download, Folder, InsertDriveFile, Search, FolderOpen, ChevronRight, Close,
    FileDownload, CheckBoxOutlineBlank, CheckBox,
} from '@mui/icons-material';
import axios from 'axios';
import DataBrowseSummary from '../components/DataBrowseSummary';
import { downloadDataPaths, getZipName, triggerBatchDataDownload, triggerDataDownload } from '../utils/download';
import {
    captionSx,
    controlFieldSx,
    DATA_PAGE_MAX_WIDTH,
    metricChipTone,
    plotFrameSx,
    sectionPanelHeaderSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableSx,
    stickyTableHeaderCellSx,
    summaryChipSx,
    tableRowRevealSx,
    tableSkeletonCellSx,
    tableTone,
    toolbarSx,
} from '../themeUtils';

const API = axios.create({ baseURL: '/api/data' });
const PER = 40, COL_W = 440, ANIM = 170;
const GLOBAL_PAGE_SIZE = 50;

function fmtSize(b) {
    if (b == null) return '';
    const bytes = Number(b);
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${Math.max(0, bytes)} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

const SelectionCtx = createContext({
    checked: new Set(), toggleFile: () => {}, toggleDirAll: () => {}, clearAll: () => {},
});

const LIST_CACHE = new Map();
const FILE_PATHS_CACHE = new Map();

function LoadingStripe({ theme, width = '100%', height = 14, tone = 'neutral', radius = 1, delayIndex = 0 }) {
    return (
        <Box
            sx={{
                width,
                height,
                borderRadius: radius,
                ...tableSkeletonCellSx(theme, delayIndex, tone),
            }}
        />
    );
}

function DirectoryPanelSkeleton({ theme }) {
    const subtleRowBg = alpha(theme.palette.primary.main, 0.018);
    return (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.paper }}>
            <Box sx={sectionPanelHeaderSx(theme, { py: 0.9, borderBottom: `2px solid ${tableTone(theme, 'neutral').headerBorder}` })}>
                <LoadingStripe theme={theme} width={18} height={18} tone="primary" radius={999} delayIndex={0} />
                <LoadingStripe theme={theme} width="34%" height={13} tone="neutral" delayIndex={1} />
                <Box sx={{ flex: 1 }} />
                <LoadingStripe theme={theme} width={36} height={18} tone="neutral" radius={999} delayIndex={2} />
                <LoadingStripe theme={theme} width={20} height={20} tone="action" radius={999} delayIndex={3} />
            </Box>

            <Box sx={{ px: 1.4, py: 0.95, display: 'grid', gridTemplateColumns: '38px minmax(0,1fr) 64px 42px', gap: 0, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <LoadingStripe theme={theme} width={16} height={16} tone="neutral" radius={0.8} delayIndex={4} />
                </Box>
                <LoadingStripe theme={theme} width="24%" height={11} tone="neutral" delayIndex={5} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <LoadingStripe theme={theme} width={28} height={11} tone="neutral" delayIndex={6} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <LoadingStripe theme={theme} width={14} height={14} tone="neutral" radius={999} delayIndex={7} />
                </Box>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, px: 0.2, pb: 0.3, display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 16 }, (_, index) => (
                    <Box
                        key={`dir-skeleton-${index}`}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: '38px minmax(0,1fr) 64px 42px',
                            alignItems: 'center',
                            minHeight: 35,
                            px: 1.2,
                            bgcolor: index % 2 === 0 ? subtleRowBg : 'transparent',
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <LoadingStripe theme={theme} width={16} height={16} tone="neutral" radius={0.8} delayIndex={8 + index} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                            <LoadingStripe
                                theme={theme}
                                width={index % 4 === 0 ? 17 : 15}
                                height={index % 4 === 0 ? 17 : 15}
                                tone="neutral"
                                radius={index % 4 === 0 ? 999 : 0.8}
                                delayIndex={16 + index}
                            />
                            <LoadingStripe
                                theme={theme}
                                width={`${Math.max(38, 74 - ((index % 5) * 8))}%`}
                                height={12}
                                tone="neutral"
                                delayIndex={24 + index}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <LoadingStripe theme={theme} width={28 + ((index % 3) * 8)} height={11} tone="neutral" delayIndex={32 + index} />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <LoadingStripe theme={theme} width={14} height={14} tone="neutral" radius={999} delayIndex={40 + index} />
                        </Box>
                    </Box>
                ))}
            </Box>

            <Box sx={{ px: 1.3, py: 0.9, borderTop: `1px solid ${theme.custom.border.soft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <LoadingStripe theme={theme} width={84} height={14} tone="neutral" delayIndex={58} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                    <LoadingStripe theme={theme} width={26} height={26} tone="neutral" radius={999} delayIndex={59} />
                    <LoadingStripe theme={theme} width={64} height={12} tone="neutral" delayIndex={60} />
                    <LoadingStripe theme={theme} width={26} height={26} tone="neutral" radius={999} delayIndex={61} />
                </Box>
            </Box>
        </Box>
    );
}

function GlobalSearchSkeleton({ theme }) {
    const subtleRowBg = alpha(theme.palette.primary.main, 0.018);
    return (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1, bgcolor: theme.custom.surface.raised, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                <LoadingStripe theme={theme} width="52%" height={12} tone="neutral" delayIndex={0} />
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, px: 0.2, py: 0.3, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '38px 240px minmax(220px,1fr) 96px 92px', gap: 0, px: 1.2, py: 0.95, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <LoadingStripe theme={theme} width={16} height={16} tone="neutral" radius={0.8} delayIndex={1} />
                    </Box>
                    <LoadingStripe theme={theme} width="24%" height={11} tone="neutral" delayIndex={2} />
                    <LoadingStripe theme={theme} width="26%" height={11} tone="neutral" delayIndex={3} />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <LoadingStripe theme={theme} width={36} height={11} tone="neutral" delayIndex={4} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <LoadingStripe theme={theme} width={34} height={11} tone="neutral" delayIndex={5} />
                    </Box>
                </Box>

                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {Array.from({ length: 14 }, (_, index) => (
                        <Box
                            key={`global-skeleton-${index}`}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: '38px 240px minmax(220px,1fr) 96px 92px',
                                alignItems: 'center',
                                minHeight: 40,
                                px: 1.2,
                                bgcolor: index % 2 === 0 ? subtleRowBg : 'transparent',
                                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                <LoadingStripe theme={theme} width={16} height={16} tone="neutral" radius={0.8} delayIndex={6 + index} />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0 }}>
                                <LoadingStripe
                                    theme={theme}
                                    width={index % 3 === 0 ? 15 : 17}
                                    height={index % 3 === 0 ? 15 : 17}
                                    tone="neutral"
                                    radius={index % 3 === 0 ? 0.8 : 999}
                                    delayIndex={18 + index}
                                />
                                <LoadingStripe theme={theme} width={`${Math.max(38, 78 - ((index % 4) * 8))}%`} height={12} tone="neutral" delayIndex={30 + index} />
                            </Box>
                            <LoadingStripe theme={theme} width={`${Math.max(42, 76 - ((index % 5) * 8))}%`} height={12} tone="neutral" delayIndex={42 + index} />
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <LoadingStripe theme={theme} width={40 + ((index % 3) * 10)} height={11} tone="neutral" delayIndex={54 + index} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.45 }}>
                                <LoadingStripe theme={theme} width={18} height={18} tone="neutral" radius={999} delayIndex={66 + index} />
                                <LoadingStripe theme={theme} width={18} height={18} tone="neutral" radius={999} delayIndex={78 + index} />
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

const multilineNameSx = {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    lineHeight: 1.28,
};

function getListCacheKey(dir, page, filter) {
    return `${dir}::${page}::${filter || ''}`;
}

function getFilePathsCacheKey(dir, filter) {
    return `${dir}::${filter || ''}`;
}

function getRequestErrorMessage(err, fallback) {
    return err.response?.data?.error || err.message || fallback;
}

async function fetchAllFilePaths(dir, filter) {
    const cacheKey = getFilePathsCacheKey(dir, filter);
    const cached = FILE_PATHS_CACHE.get(cacheKey);
    if (cached) return cached;

    const response = await API.get('/file-paths', { params: { dir, search: filter || undefined } });
    const paths = response.data?.paths || [];
    FILE_PATHS_CACHE.set(cacheKey, paths);
    return paths;
}

/* Directory column */
const DirColumn = React.memo(function DirColumn({ dir, filter, onEnter, onFiles, onStats, animState, theme }) {
    const neutralTone = tableTone(theme, 'neutral');
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotal] = useState(1);
    const [totalCount, setCnt] = useState(0);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [hovered, setHov] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [sortDir, setSortDir] = useState('asc');
    const enterSettledRef = useRef(animState === 'exit');
    const { checked, toggleFile, toggleDirAll } = useContext(SelectionCtx);

    useEffect(() => {
        let cancelled = false;
        const syncVisibleFilePaths = async (fallbackPaths) => {
            if (!filter) {
                onFiles(dir, fallbackPaths);
                return;
            }

            try {
                const allPaths = await fetchAllFilePaths(dir, filter);
                if (!cancelled) onFiles(dir, allPaths);
            } catch {
                if (!cancelled) onFiles(dir, fallbackPaths);
            }
        };

        const cacheKey = getListCacheKey(dir, page, filter);
        const cached = LIST_CACHE.get(cacheKey);

        if (cached) {
            setItems(cached.items);
            setTotal(cached.totalPages);
            setCnt(cached.totalCount);
            onStats(dir, cached.stats);
            void syncVisibleFilePaths(cached.filePaths);
            setLoading(false);
        } else {
            setItems([]);
            setTotal(1);
            setCnt(0);
            onStats(dir, { totalCount: 0, fileCount: 0, folderCount: 0 });
            setLoading(true);
        }

        API.get('/list', { params: { dir, page, limit: PER, search: filter || undefined } })
            .then(r => {
                if (cancelled) return;
                const d = r.data.data || [];
                const nextCache = {
                    items: d,
                    totalPages: r.data.totalPages || 1,
                    totalCount: r.data.totalCount || 0,
                    filePaths: d.filter(f => f.type === 'file').map(f => f.path),
                    stats: {
                        totalCount: r.data.totalCount || d.length,
                        fileCount: d.filter(f => f.type === 'file').length,
                        folderCount: d.filter(f => f.type === 'dir').length,
                    },
                };
                LIST_CACHE.set(cacheKey, nextCache);
                setItems(d);
                setTotal(nextCache.totalPages);
                setCnt(nextCache.totalCount);
                onStats(dir, nextCache.stats);
                void syncVisibleFilePaths(nextCache.filePaths);
            })
            .catch((err) => {
                if (!cancelled) setError(getRequestErrorMessage(err, 'Failed to load directory'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [dir, onFiles, onStats, page, filter]);

    useEffect(() => { setPage(1); }, [filter]);
    useEffect(() => {
        if (animState === 'exit') return undefined;
        const t = setTimeout(() => { enterSettledRef.current = true; }, ANIM + 20);
        return () => clearTimeout(t);
    }, [animState]);

    const filtered = useMemo(() => {
        const list = [...items];
        list.sort((a, b) => {
            const d = sortDir === 'asc' ? 1 : -1;
            if (sortBy === 'size') return ((a.size || 0) - (b.size || 0)) * d;
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase()) * d;
        });
        return list;
    }, [items, sortBy, sortDir]);

    const files = filtered.filter(f => f.type === 'file');
    const cked = files.filter(f => checked.has(f.path));
    const allCk = files.length > 0 && cked.length === files.length;
    const someCk = cked.length > 0 && !allCk;

    const hasFilter = Boolean(filter);
    const columnTitle = dir.split('/').pop() || 'data';
    const headerDownloadTitle = hasFilter ? 'Download filtered files' : 'Download folder as ZIP';
    const hoveredItem = useMemo(
        () => filtered.find((item) => item.path === hovered) || null,
        [filtered, hovered],
    );
    const handleHeaderDownload = async () => {
        setDownloading(true);
        setError('');
        try {
            if (hasFilter) {
                const allMatchingFilePaths = await fetchAllFilePaths(dir, filter);
                if (!allMatchingFilePaths.length) {
                    setError('No matching files to download');
                    return;
                }
                await downloadDataPaths(allMatchingFilePaths, {
                    filename: `${columnTitle}-filtered.zip`,
                });
                return;
            }
            triggerBatchDataDownload([dir || ''], getZipName(dir, 'data'));
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    const anim = animState === 'exit'
        ? `colExit ${ANIM}ms ease forwards`
        : enterSettledRef.current ? 'none' : `colEnter ${ANIM}ms cubic-bezier(0.22,1,0.36,1) both`;

    const thSx = {
        ...stickyTableHeaderCellSx(theme, neutralTone),
        fontWeight: 600,
        fontSize: '0.7rem',
        py: 0.8,
        px: 1.5,
    };

    const loadingBarSx = {
        height: 3,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
        },
    };

    return (
        <Box sx={{
            width: { xs: '100%', sm: COL_W },
            minWidth: { xs: '100%', sm: COL_W },
            maxWidth: { xs: '100%', sm: COL_W },
            flexShrink: 0,
            borderRight: `1px solid ${theme.custom.border.soft}`,
            display: 'flex', flexDirection: 'column', bgcolor: theme.palette.background.paper,
            animation: anim,
            pointerEvents: animState === 'exit' ? 'none' : 'auto',
            willChange: 'opacity, transform',
            '@keyframes colEnter': {
                from: { opacity: 0, transform: 'translateX(12px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
            },
            '@keyframes colExit': {
                from: { opacity: 1, transform: 'translateX(0)' },
                to: { opacity: 0, transform: 'translateX(-10px)' },
            },
        }}>
            <Box sx={sectionPanelHeaderSx(theme, {
                py: 0.9,
                borderBottom: `2px solid ${neutralTone.headerBorder}`,
            })}>
                <FolderOpen sx={{ fontSize: 17, color: theme.palette.primary.light, flexShrink: 0 }} />
                <Typography noWrap variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.04em', flex: 1 }}>
                    {columnTitle}
                </Typography>
                <Chip label={totalCount} size="small" sx={summaryChipSx(theme, { height: 20, fontSize: '0.65rem', ...metricChipTone(theme, 'neutral') })} />
                <Tooltip title={downloading ? 'Preparing download...' : headerDownloadTitle}>
                    <span>
                    <IconButton size="small" disabled={downloading} onClick={() => { void handleHeaderDownload(); }} sx={{ color: hasFilter ? theme.palette.primary.main : theme.palette.text.secondary, '&:hover': { color: hasFilter ? theme.palette.primary.dark : theme.palette.warning.dark, bgcolor: hasFilter ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.warning.main, 0.1) } }}>
                        <FileDownload sx={{ fontSize: 16 }} />
                    </IconButton>
                    </span>
                </Tooltip>
            </Box>
            {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
            {error && (
                <Alert severity="error" sx={{ m: 1, py: 0.2, fontSize: '0.72rem' }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* table */}
            <TableContainer sx={stickyTableContainerSx(theme, { flex: 1, overflowY: 'auto', overflowX: 'hidden' })} onMouseLeave={() => setHov(null)}>
                <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed' })}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...thSx, width: 38, textAlign: 'center', px: 0.3 }}>
                                <Checkbox size="small" sx={{ p: 0.3 }} checked={allCk} indeterminate={someCk}
                                    onChange={() => toggleDirAll(dir, files.map(f => f.path))} />
                            </TableCell>
                            <TableCell sx={{ ...thSx, cursor: 'pointer' }}
                                onClick={() => { if (sortBy === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('name'); setSortDir('asc'); } }}>
                                Name {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                            </TableCell>
                            <TableCell sx={{ ...thSx, width: 56, textAlign: 'right', cursor: 'pointer' }}
                                onClick={() => { if (sortBy === 'size') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('size'); setSortDir('desc'); } }}>
                                Size {sortBy === 'size' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                            </TableCell>
                            <TableCell sx={{ ...thSx, width: 36, textAlign: 'center', px: 0.6 }}><Download sx={{ fontSize: 15 }} /></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} sx={{ p: 0, borderBottom: 0, height: 0 }}>
                                    <DirectoryPanelSkeleton theme={theme} />
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5, color: theme.custom.chart.axisSoft, fontSize: '0.8rem' }}>
                                {filter ? 'No match' : 'No files'}
                            </TableCell></TableRow>
                        ) : (
                            filtered.map((f, rowIndex) => {
                                const isFile = f.type === 'file', isCk = checked.has(f.path);
                                return (
                                    <TableRow key={f.path}
                                        onMouseEnter={() => setHov(f.path)}
                                        sx={{
                                            ...tableRowRevealSx(theme, rowIndex),
                                            '& td': { py: 0.3, px: 1.5 },
                                            bgcolor: isCk ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                            '&:hover': { bgcolor: isCk ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.03) },
                                            transition: `background-color ${theme.custom.motion.swift}`,
                                        }}>
                                        <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, textAlign: 'center', px: 0.3 }}>
                                            {isFile && <Checkbox size="small" sx={{ p: 0.3 }} checked={isCk}
                                                icon={<CheckBoxOutlineBlank sx={{ fontSize: 17 }} />}
                                                checkedIcon={<CheckBox sx={{ fontSize: 17 }} />}
                                                onChange={() => toggleFile(f.path)} />}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
                                            {f.type === 'dir' ? (
                                                <Box component="button" onClick={() => onEnter(f.path)}
                                                    sx={{
                                                        display: 'flex', alignItems: 'center', gap: 0.7, width: '100%',
                                                        border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                                                        fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', fontSize: '0.79rem', fontWeight: 500,
                                                        color: theme.palette.primary.main, textAlign: 'left', px: 0, py: 0.2,
                                                        transition: `color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                                        '&:hover': { color: theme.palette.primary.dark, transform: 'translateX(2px)' },
                                                        '&:active': { transform: 'translateX(4px) scale(0.98)' },
                                                    }}>
                                                    <Folder sx={{ fontSize: 17, color: theme.palette.primary.light, flexShrink: 0 }} />
                                                    <Box component="span" title={f.name} sx={{ minWidth: 0, ...multilineNameSx }}>{f.name}</Box>
                                                    <ChevronRight sx={{
                                                        fontSize: 16, opacity: 0.3, flexShrink: 0, ml: 'auto',
                                                        transition: 'opacity .15s, transform .15s',
                                                        '.MuiTableRow-root:hover &': { opacity: 0.7, transform: 'translateX(2px)' },
                                                    }} />
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                    <InsertDriveFile sx={{ fontSize: 15, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />
                                                    <Box component="span" title={f.name}
                                                        sx={{ minWidth: 0, fontSize: '0.79rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', ...multilineNameSx }}>
                                                        {f.name}
                                                    </Box>
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell align="right" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, fontSize: '0.72rem', color: theme.palette.text.secondary }}>
                                            {isFile ? fmtSize(f.size) : ''}
                                        </TableCell>
                                        <TableCell align="center" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
                                            {isFile ? (
                                                <Tooltip title="Download">
                                                    <IconButton size="small" onClick={() => {
                                                        setDownloading(true);
                                                        setError('');
                                                        triggerDataDownload(f.path)
                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                            .finally(() => setDownloading(false));
                                                    }}
                                                        sx={{ opacity: (hovered === f.path || isCk) ? 0.95 : 0.24, transition: `opacity ${theme.custom.motion.swift}`, '&:hover': { opacity: 1, bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                                                        <Download sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : !filter ? (
                                                <Tooltip title="Download as ZIP">
                                                    <IconButton size="small" component="span" onClick={() => {
                                                        setDownloading(true);
                                                        setError('');
                                                        Promise.resolve(triggerBatchDataDownload([f.path], getZipName(f.path)))
                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                            .finally(() => setDownloading(false));
                                                    }} sx={{ opacity: hovered === f.path ? 0.92 : 0.34, transition: `opacity ${theme.custom.motion.swift}`, '&:hover': { opacity: 1, bgcolor: alpha(theme.palette.warning.main, 0.1) } }}>
                                                        <FileDownload sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{
                px: 1.5,
                py: 1,
                borderTop: `1px solid ${theme.custom.border.soft}`,
                bgcolor: hoveredItem ? theme.custom.surface.base : theme.custom.surface.raised,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 54,
                transition: `background-color ${theme.custom.motion.swift}`,
            }}>
                {hoveredItem ? (
                    <>
                        {hoveredItem.type === 'dir'
                            ? <Folder sx={{ fontSize: 16, color: theme.palette.primary.light, flexShrink: 0 }} />
                            : <InsertDriveFile sx={{ fontSize: 15, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography noWrap variant="caption" sx={{ display: 'block', color: theme.palette.text.primary, fontWeight: 700 }}>
                                {hoveredItem.name}
                            </Typography>
                            <Typography noWrap variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>
                                {hoveredItem.path}
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={hoveredItem.type === 'dir' ? 'Folder' : fmtSize(hoveredItem.size)}
                            sx={summaryChipSx(theme, {
                                height: 22,
                                ...(hoveredItem.type === 'dir' ? metricChipTone(theme, 'primary') : metricChipTone(theme, 'neutral')),
                            })}
                        />
                    </>
                ) : (
                    <>
                        <FolderOpen sx={{ fontSize: 16, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 700 }}>
                                Hover files or folders for details
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', color: theme.custom.chart.axisSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', sm: 'nowrap' } }}>
                                {filter ? 'Filtered items update here instantly as you move across the list.' : 'Full path and size metadata appear here while browsing.'}
                            </Typography>
                        </Box>
                        <Chip size="small" label={`${totalCount} items`} sx={summaryChipSx(theme, { height: 22, ...metricChipTone(theme, 'neutral') })} />
                    </>
                )}
            </Box>

            {totalPages > 1 && (
                <Box sx={{ py: 0.8, bgcolor: theme.custom.surface.raised, borderTop: `1px solid ${theme.custom.border.soft}`, display: 'flex', justifyContent: 'center' }}>
                    <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} size="small" siblingCount={0} boundaryCount={1} />
                </Box>
            )}
        </Box>
    );
});

const ExitingColumnGhost = React.memo(function ExitingColumnGhost({ dir, theme }) {
    const neutralTone = tableTone(theme, 'neutral');
    return (
        <Box sx={{
            width: { xs: '100%', sm: COL_W },
            minWidth: { xs: '100%', sm: COL_W },
            maxWidth: { xs: '100%', sm: COL_W },
            flexShrink: 0,
            borderRight: `1px solid ${theme.custom.border.soft}`,
            display: 'flex', flexDirection: 'column',
            bgcolor: theme.palette.background.paper,
            pointerEvents: 'none',
            animation: `colExit ${ANIM}ms ease forwards`,
            willChange: 'opacity, transform',
            '@keyframes colExit': {
                from: { opacity: 1, transform: 'translateX(0)' },
                to: { opacity: 0, transform: 'translateX(-10px)' },
            },
        }}>
            <Box sx={{
                px: 1.5, py: 0.9,
                bgcolor: theme.custom.surface.raised,
                borderBottom: `2px solid ${neutralTone.headerBorder}`,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            }}>
                <FolderOpen sx={{ fontSize: 17, color: theme.palette.primary.light, flexShrink: 0 }} />
                <Typography noWrap variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.primary, fontSize: '0.75rem', textTransform: 'none', letterSpacing: '0.04em', flex: 1 }}>
                    {dir.split('/').pop() || 'data'}
                </Typography>
            </Box>
            <Box sx={{ flex: 1, px: 2, py: 1.2 }}>
                {Array.from({ length: 8 }, (_, index) => (
                    <Box
                        key={`${dir}-ghost-${index}`}
                        sx={{
                            height: 12,
                            borderRadius: 1,
                            bgcolor: index % 2 === 0 ? alpha(theme.palette.primary.main, 0.1) : alpha(theme.palette.primary.main, 0.05),
                            mb: 1.2,
                            width: `${72 + ((index * 7) % 20)}%`,
                        }}
                    />
                ))}
            </Box>
        </Box>
    );
});

/* Data browser */
let _colId = 0;
const mkCol = (dir) => ({ dir, id: _colId++ });

function buildColumnsFromDir(dir) {
    if (!dir) return [mkCol('')];

    const parts = dir.split('/').filter(Boolean);
    const cols = [mkCol('')];
    let acc = '';
    for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        cols.push(mkCol(acc));
    }
    return cols;
}

function GlobalSearchResults({ query, checked, toggleFile, togglePaths, clearAll, onOpenDirectory }) {
    const theme = useTheme();
    const neutralTone = tableTone(theme, 'neutral');
    const loadingBarSx = {
        height: 3,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
        },
    };
    const thSx = {
        ...stickyTableHeaderCellSx(theme, neutralTone),
        fontWeight: 600,
        fontSize: '0.7rem',
        py: 0.8,
        px: 1.5,
    };
    const trimmedQuery = query.trim();
    const canSearch = trimmedQuery.length >= 2;
    const [results, setResults] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [hovered, setHovered] = useState(null);

    useEffect(() => {
        setPage(1);
    }, [trimmedQuery]);

    useEffect(() => {
        let cancelled = false;

        if (!canSearch) {
            setResults([]);
            setTotalCount(0);
            setTotalPages(1);
            setLoading(false);
            return () => { cancelled = true; };
        }

        setLoading(true);
        setError('');
        API.get('/search', { params: { q: trimmedQuery, page, limit: GLOBAL_PAGE_SIZE } })
            .then(({ data }) => {
                if (cancelled) return;
                const nextResults = data.results || [];
                setResults(nextResults);
                setTotalCount(data.totalCount ?? nextResults.length);
                setTotalPages(data.totalPages || Math.max(1, Math.ceil((data.totalCount ?? nextResults.length) / GLOBAL_PAGE_SIZE)));
            })
            .catch((err) => {
                if (cancelled) return;
                setResults([]);
                setTotalCount(0);
                setTotalPages(1);
                setError(getRequestErrorMessage(err, 'Search failed'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [canSearch, page, trimmedQuery]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const visibleResults = results;
    const fileResults = useMemo(
        () => results.filter((item) => item.type === 'file'),
        [results],
    );
    const allFilePaths = useMemo(
        () => fileResults.map((item) => item.path),
        [fileResults],
    );
    const hoveredItem = useMemo(
        () => results.find((item) => item.path === hovered) || null,
        [hovered, results],
    );

    const visibleFilePaths = useMemo(
        () => visibleResults.filter((item) => item.type === 'file').map((item) => item.path),
        [visibleResults],
    );
    const checkedCount = useMemo(
        () => fileResults.filter((item) => checked.has(item.path)).length,
        [checked, fileResults],
    );
    const visibleCheckedCount = visibleFilePaths.filter((path) => checked.has(path)).length;
    const allVisibleChecked = visibleFilePaths.length > 0 && visibleCheckedCount === visibleFilePaths.length;
    const someVisibleChecked = visibleCheckedCount > 0 && !allVisibleChecked;
    const allFilesChecked = allFilePaths.length > 0 && allFilePaths.every((path) => checked.has(path));
    const someFilesChecked = checkedCount > 0 && !allFilesChecked;

    const handleToggleAllVisible = () => {
        if (!visibleFilePaths.length) return;
        togglePaths(visibleFilePaths);
    };
    const handleToggleAllFiles = () => {
        if (!allFilePaths.length) return;
        togglePaths(allFilePaths);
    };

    const handleDownloadChecked = async () => {
        const selectedPaths = fileResults.filter((item) => checked.has(item.path)).map((item) => item.path);

        setDownloading(true);
        setError('');
        try {
            await downloadDataPaths(selectedPaths, {
                filename: `${trimmedQuery || 'data-global-search'}-matches.zip`,
            });
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };
    const handleDownloadAllFiles = async () => {
        setDownloading(true);
        setError('');
        try {
            await downloadDataPaths(allFilePaths, {
                filename: `${trimmedQuery || 'data-global-search'}-files.zip`,
            });
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="subtitle1" sx={sectionTitleSx(theme, { mb: 0.3, fontSize: '1rem' })}>
                        Global Search Results
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme)}>
                        Search across all indexed files and folders without the column browser layout.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mt: 1 }}>
                        <Chip size="small" label={`${totalCount.toLocaleString()} matches`} sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                        <Chip size="small" label={`${fileResults.length} page files`} sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                        <Chip size="small" label={`${results.length - fileResults.length} page folders`} sx={summaryChipSx(theme, metricChipTone(theme, 'subtle'))} />
                    </Box>
                </Box>

                {fileResults.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.7, py: 0.35, borderRadius: 1, bgcolor: allFilesChecked ? alpha(theme.palette.primary.main, 0.08) : theme.custom.surface.subtle, border: `1px solid ${theme.custom.border.soft}` }}>
                            <Checkbox size="small" sx={{ p: 0.25 }} checked={allFilesChecked} indeterminate={someFilesChecked} onChange={handleToggleAllFiles} />
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700 }}>
                                Page files
                            </Typography>
                        </Box>
                        <Button
                            size="small"
                            variant="outlined"
                            disabled={downloading}
                            sx={{ minWidth: 0, px: 1.4, py: 0.4, fontSize: '0.74rem', textTransform: 'none', borderColor: theme.custom.border.strong, color: theme.palette.text.primary }}
                            onClick={() => { void handleDownloadAllFiles(); }}
                        >
                            <FileDownload sx={{ fontSize: 14, mr: 0.4 }} /> {downloading ? 'Preparing...' : 'Download page'}
                        </Button>
                        {checkedCount > 0 && (
                            <Chip label={`${checkedCount} selected`} size="small" color="primary" onDelete={clearAll} />
                        )}
                        {checkedCount > 0 && (
                            <Button
                                size="small"
                                variant="contained"
                                disabled={downloading}
                                sx={{ minWidth: 0, px: 1.5, py: 0.4, fontSize: '0.74rem', textTransform: 'none', boxShadow: 'none' }}
                                onClick={() => { void handleDownloadChecked(); }}
                            >
                                <FileDownload sx={{ fontSize: 14, mr: 0.4 }} /> {downloading ? 'Preparing...' : 'Download selected'}
                            </Button>
                        )}
                    </Box>
                )}
            </Box>

            {error && (
                <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <Paper elevation={0} sx={plotFrameSx(theme, { borderRadius: 3, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 })}>
                {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
                {!canSearch ? (
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                            Enter at least 2 characters to search all files and folders.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {loading && (
                            <Box sx={{ px: 2, py: 1, bgcolor: theme.custom.surface.raised, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700 }}>
                                    Searching server files. The first global search may build the index and take longer.
                                </Typography>
                            </Box>
                        )}
                        <TableContainer sx={stickyTableContainerSx(theme, { flex: 1, overflowY: 'auto', overflowX: 'auto' })} onMouseLeave={() => setHovered(null)}>
                            <Table stickyHeader size="small" sx={stickyTableSx(theme, { tableLayout: 'fixed', minWidth: { xs: 720, sm: 780 } })}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ ...thSx, width: 38, textAlign: 'center', px: 0.3 }}>
                                            <Checkbox
                                                size="small"
                                                sx={{ p: 0.3 }}
                                                checked={allVisibleChecked}
                                                indeterminate={someVisibleChecked}
                                                onChange={handleToggleAllVisible}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ ...thSx, width: 360 }}>Name</TableCell>
                                        <TableCell sx={{ ...thSx, width: { xs: 220, sm: 'auto' } }}>Path</TableCell>
                                        <TableCell sx={{ ...thSx, width: 84, textAlign: 'right' }}>Size</TableCell>
                                        <TableCell sx={{ ...thSx, width: 84, textAlign: 'center' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} sx={{ p: 0, borderBottom: 0, height: 0 }}>
                                                <GlobalSearchSkeleton theme={theme} />
                                            </TableCell>
                                        </TableRow>
                                    ) : visibleResults.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 6, color: theme.custom.chart.axisSoft, fontSize: '0.82rem' }}>
                                                No global matches for "{trimmedQuery}"
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        visibleResults.map((item, rowIndex) => {
                                            const isFile = item.type === 'file';
                                            const isChecked = isFile && checked.has(item.path);
                                            const openDir = isFile ? item.path.split('/').slice(0, -1).join('/') : item.path;

                                            return (
                                                <TableRow
                                                    key={`${item.type}-${item.path}`}
                                                    onMouseEnter={() => setHovered(item.path)}
                                                    sx={{
                                                        ...tableRowRevealSx(theme, rowIndex),
                                                        '& td': { py: 0.7, px: 1.5 },
                                                        bgcolor: isChecked ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                                        '&:hover': { bgcolor: isChecked ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.03) },
                                                        transition: `background-color ${theme.custom.motion.swift}`,
                                                    }}
                                                >
                                                    <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, textAlign: 'center', px: 0.3 }}>
                                                        {isFile && (
                                                            <Checkbox
                                                                size="small"
                                                                sx={{ p: 0.3 }}
                                                                checked={isChecked}
                                                                icon={<CheckBoxOutlineBlank sx={{ fontSize: 17 }} />}
                                                                checkedIcon={<CheckBox sx={{ fontSize: 17 }} />}
                                                                onChange={() => toggleFile(item.path)}
                                                            />
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, width: 360 }}>
                                                        {item.type === 'dir' ? (
                                                            <Box
                                                                component="button"
                                                                onClick={() => onOpenDirectory(item.path)}
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 0.7,
                                                                    width: '100%',
                                                                    border: 'none',
                                                                    bgcolor: 'transparent',
                                                                    cursor: 'pointer',
                                                                    fontVariantNumeric: 'tabular-nums',
                                                                    fontFeatureSettings: '"tnum" 1',
                                                                    fontSize: '0.79rem',
                                                                    fontWeight: 500,
                                                                    color: theme.palette.primary.main,
                                                                    textAlign: 'left',
                                                                    px: 0,
                                                                    py: 0.2,
                                                                    transition: `color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                                                    '&:hover': { color: theme.palette.primary.dark, transform: 'translateX(2px)' },
                                                                    '&:active': { transform: 'translateX(4px) scale(0.98)' },
                                                                }}
                                                            >
                                                                <Folder sx={{ fontSize: 17, color: theme.palette.primary.light, flexShrink: 0 }} />
                                                                <Box component="span" title={item.name} sx={{ minWidth: 0, ...multilineNameSx }}>
                                                                    {item.name}
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                                                <InsertDriveFile sx={{ fontSize: 15, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />
                                                                <Box component="span" title={item.name} sx={{ minWidth: 0, fontSize: '0.79rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', ...multilineNameSx }}>
                                                                    {item.name}
                                                                </Box>
                                                            </Box>
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, width: { xs: 220, sm: 'auto' } }}>
                                                        <Box title={item.path} sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.path}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, fontSize: '0.72rem', color: theme.palette.text.secondary }}>
                                                        {isFile ? fmtSize(item.size) : ''}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.3 }}>
                                                            {isFile && (
                                                                <Tooltip title="Download">
                                                                    <IconButton size="small" onClick={() => {
                                                                        setDownloading(true);
                                                                        setError('');
                                                                        triggerDataDownload(item.path)
                                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                                            .finally(() => setDownloading(false));
                                                                    }} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                                                                        <Download sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            {!isFile && (
                                                                <Tooltip title="Download folder as ZIP">
                                                                    <IconButton size="small" onClick={() => {
                                                                        setDownloading(true);
                                                                        setError('');
                                                                        Promise.resolve(triggerBatchDataDownload([item.path], getZipName(item.path)))
                                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                                            .finally(() => setDownloading(false));
                                                                    }} sx={{ '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.1) } }}>
                                                                        <FileDownload sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            <Tooltip title={item.type === 'dir' ? 'Open folder' : 'Open containing folder'}>
                                                                <IconButton size="small" onClick={() => onOpenDirectory(openDir)} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                                                                    <FolderOpen sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{
                            px: 1.5,
                            py: 1,
                            borderTop: `1px solid ${theme.custom.border.soft}`,
                            bgcolor: hoveredItem ? theme.custom.surface.base : theme.custom.surface.raised,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            minHeight: 54,
                            transition: `background-color ${theme.custom.motion.swift}`,
                        }}>
                            {hoveredItem ? (
                                <>
                                    {hoveredItem.type === 'dir'
                                        ? <Folder sx={{ fontSize: 16, color: theme.palette.primary.light, flexShrink: 0 }} />
                                        : <InsertDriveFile sx={{ fontSize: 15, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography noWrap variant="caption" sx={{ display: 'block', color: theme.palette.text.primary, fontWeight: 700 }}>
                                            {hoveredItem.name}
                                        </Typography>
                                        <Typography noWrap variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' }}>
                                            {hoveredItem.path}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        size="small"
                                        label={hoveredItem.type === 'dir' ? 'Folder' : fmtSize(hoveredItem.size)}
                                        sx={summaryChipSx(theme, {
                                            height: 22,
                                            ...(hoveredItem.type === 'dir' ? metricChipTone(theme, 'primary') : metricChipTone(theme, 'neutral')),
                                        })}
                                    />
                                </>
                            ) : (
                                <>
                                    <Search sx={{ fontSize: 16, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 700 }}>
                                            Hover matches for details
                                        </Typography>
                                        <Typography noWrap variant="caption" sx={{ display: 'block', color: theme.custom.chart.axisSoft }}>
                                            Full path, file size, and quick folder context appear here while reviewing matches.
                                        </Typography>
                                    </Box>
                                    <Chip size="small" label={`${totalCount} matches`} sx={summaryChipSx(theme, { height: 22, ...metricChipTone(theme, 'neutral') })} />
                                </>
                            )}
                        </Box>

                        {totalPages > 1 && (
                            <Box sx={{ py: 0.8, bgcolor: theme.custom.surface.raised, borderTop: `1px solid ${theme.custom.border.soft}`, display: 'flex', justifyContent: 'center' }}>
                                <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} size="small" siblingCount={0} boundaryCount={1} />
                            </Box>
                        )}
                    </>
                )}
            </Paper>
        </Box>
    );
}

export default function DataBrowser() {
    const theme = useTheme();
    const loadingBarSx = {
        height: 3,
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
        },
    };
    const [searchParams, setSearchParams] = useSearchParams();
    const initDir = searchParams.get('dir') || '';
    const initFilter = searchParams.get('q') || '';
    const initMode = searchParams.get('mode') === 'global' || (initFilter && !initDir) ? 'global' : 'browse';

    const [columns, setColumns] = useState(() => buildColumnsFromDir(initDir));
    const [exitingCols, setExiting] = useState([]);
    const [filter, setFilter] = useState(() => initFilter);
    const [searchMode, setSearchMode] = useState(() => initMode);
    const [checked, setChecked] = useState(new Set());
    const [dirFileMap, setDirFileMap] = useState({});
    const [dirStatsMap, setDirStatsMap] = useState({});
    const [downloadState, setDownloadState] = useState({ loading: false, error: '' });
    const scrollRef = useRef(null);
    const exitTimer = useRef(null);
    const columnsRef = useRef(columns);
    const prevColumnCountRef = useRef(columns.length);
    columnsRef.current = columns;
    const isGlobalSearch = searchMode === 'global';

    // Schedule exit animation (dedup by id to handle Strict Mode)
    const scheduleExit = useCallback((removed) => {
        if (!removed.length) return;
        setExiting(old => {
            const ids = new Set(old.map(c => c.id));
            const fresh = removed.filter(c => !ids.has(c.id));
            return fresh.length ? [...old, ...fresh] : old;
        });
        clearTimeout(exitTimer.current);
        exitTimer.current = setTimeout(() => setExiting([]), ANIM + 30);
    }, []);

    const clearExitColumns = useCallback(() => {
        clearTimeout(exitTimer.current);
        setExiting([]);
    }, []);

    // Navigation side effects are kept outside state updaters.
    const syncUrl = useCallback((cols) => {
        const currentDir = cols[cols.length - 1]?.dir || '';
        const params = new URLSearchParams();
        if (!isGlobalSearch && currentDir) params.set('dir', currentDir);
        if (filter) params.set('q', filter);
        if (isGlobalSearch) params.set('mode', 'global');
        startTransition(() => {
            setSearchParams(params, { replace: true });
        });
    }, [filter, isGlobalSearch, setSearchParams]);

    const enterDir = useCallback((colIndex, subPath) => {
        const prev = columnsRef.current;
        clearExitColumns();
        const next = [...prev.slice(0, colIndex + 1), mkCol(subPath)];
        setColumns(next);
        syncUrl(next);
    }, [clearExitColumns, syncUrl]);

    const backTo = useCallback((colIndex) => {
        const prev = columnsRef.current;
        if (colIndex >= prev.length - 1) return;
        const removed = prev.slice(colIndex + 1);
        scheduleExit(removed);
        const next = prev.slice(0, colIndex + 1);
        setColumns(next);
        syncUrl(next);
    }, [scheduleExit, syncUrl]);

    useEffect(() => () => clearTimeout(exitTimer.current), []);
    useEffect(() => { syncUrl(columnsRef.current); }, [filter, syncUrl]);

    // auto-scroll right when columns change
    useEffect(() => {
        const el = scrollRef.current;
        const prevCount = prevColumnCountRef.current;
        prevColumnCountRef.current = columns.length;

        if (!el || columns.length <= prevCount) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollTo({ left: el.scrollWidth, behavior: 'auto' });
            });
        });
    }, [columns.length]);

    // Selection
    const onFiles = useCallback((dir, files) => {
        setDirFileMap(prev => ({ ...prev, [dir]: files }));
    }, []);
    const onStats = useCallback((dir, stats) => {
        setDirStatsMap(prev => ({ ...prev, [dir]: stats }));
    }, []);

    const toggleFile = useCallback((path) => {
        setChecked(p => { const n = new Set(p); n.has(path) ? n.delete(path) : n.add(path); return n; });
    }, []);
    const togglePaths = useCallback((paths) => {
        setChecked(p => {
            const n = new Set(p);
            const all = paths.every(path => n.has(path));
            if (all) paths.forEach(path => n.delete(path)); else paths.forEach(path => n.add(path));
            return n;
        });
    }, []);
    const toggleDirAll = useCallback((_dir, files) => {
        togglePaths(files);
    }, [togglePaths]);
    const clearAll = useCallback(() => setChecked(new Set()), []);

    const handleGlobalSearchToggle = useCallback((event) => {
        clearExitColumns();
        setSearchMode(event.target.checked ? 'global' : 'browse');
    }, [clearExitColumns]);

    const openDirectoryFromGlobalSearch = useCallback((dir) => {
        clearExitColumns();
        setColumns(buildColumnsFromDir(dir));
        setSearchMode('browse');
    }, [clearExitColumns]);

    const allVisibleFiles = useMemo(() => {
        const all = [];
        for (const c of columns) {
            const fs = dirFileMap[c.dir] || [];
            const fl = filter ? fs.filter(f => f.split('/').pop().toLowerCase().includes(filter.toLowerCase())) : fs;
            all.push(...fl);
        }
        return all;
    }, [columns, dirFileMap, filter]);
    const visCk = allVisibleFiles.filter(f => checked.has(f));
    const allVisCk = allVisibleFiles.length > 0 && visCk.length === allVisibleFiles.length;
    const someVisCk = visCk.length > 0 && !allVisCk;
    const currentDir = columns[columns.length - 1]?.dir || '';
    const currentStats = dirStatsMap[currentDir] || { totalCount: 0, fileCount: 0, folderCount: 0 };

    const toggleAllVis = () => {
        if (allVisCk) setChecked(p => { const n = new Set(p); allVisibleFiles.forEach(f => n.delete(f)); return n; });
        else setChecked(p => { const n = new Set(p); allVisibleFiles.forEach(f => n.add(f)); return n; });
    };
    const handleDownloadSelection = async () => {
        setDownloadState({ loading: true, error: '' });
        try {
            await downloadDataPaths([...visCk], { filename: 'data-selection.zip' });
        } catch (err) {
            setDownloadState({ loading: false, error: getRequestErrorMessage(err, 'Download failed') });
            return;
        }
        setDownloadState({ loading: false, error: '' });
    };

    const ctxVal = useMemo(() => ({ checked, toggleFile, toggleDirAll, clearAll }), [checked, toggleFile, toggleDirAll, clearAll]);

    const showIntro = isGlobalSearch || (columns.length === 1 && exitingCols.length === 0);
    const compactBrowseLayout = !isGlobalSearch && columns.length === 1 && exitingCols.length === 0;

    return (
        <SelectionCtx.Provider value={ctxVal}>
            <Box sx={{
                width: '100%',
                maxWidth: DATA_PAGE_MAX_WIDTH,
                minWidth: 0,
                mx: 'auto',
                px: { xs: 1.5, sm: 2, md: 3, xl: 4 },
                py: { xs: 1.5, md: 2, xl: 2.5 },
                height: { xs: 'auto', md: 'calc(100dvh - 96px)' },
                minHeight: { xs: 'calc(100dvh - 88px)', md: 560 },
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* intro */}
                <Box sx={{
                    overflow: 'hidden',
                    maxHeight: showIntro ? 80 : 0, opacity: showIntro ? 1 : 0,
                    transform: showIntro ? 'none' : 'translateY(-8px)',
                    transition: 'max-height .25s ease, opacity .2s ease, transform .22s ease',
                    mb: showIntro ? 0 : 0,
                }}>
                    <Box sx={{ pb: 2 }}>
                        <Typography variant="h4" sx={sectionTitleSx(theme, { mb: 0.5 })}>
                            {isGlobalSearch ? 'Global Search' : 'Data Browser'}
                        </Typography>
                        <Typography variant="body2" sx={captionSx(theme)}>
                            {isGlobalSearch
                                ? 'Search across all indexed files and folders with a flat results view.'
                                : 'Browse and download pipeline output files'}
                        </Typography>
                    </Box>
                </Box>

                {/* toolbar */}
                <Box sx={toolbarSx(theme, {
                    flexDirection: compactBrowseLayout ? 'column' : { xs: 'column', sm: 'row' },
                    alignItems: compactBrowseLayout ? 'stretch' : { xs: 'stretch', sm: 'center' },
                    mb: 2,
                    flexShrink: 0,
                    flexWrap: compactBrowseLayout ? 'nowrap' : 'wrap',
                })}>
                    <TextField placeholder={isGlobalSearch ? 'e.g. GCST90081631' : 'e.g. GCST90081631'} size="small"
                        value={filter} onChange={e => setFilter(e.target.value)}
                        sx={controlFieldSx(theme, { width: { xs: '100%', sm: isGlobalSearch ? 440 : 320 } })}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: theme.custom.chart.axisSoft }} /></InputAdornment>,
                            endAdornment: (
                                <InputAdornment position="end" sx={{ ml: 0.4 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                                        {filter && (
                                            <IconButton size="small" onClick={() => setFilter('')} sx={{ p: 0.3 }}>
                                                <Close sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        )}
                                        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: theme.custom.border.soft, mx: 0.25 }} />
                                        <Checkbox
                                            size="small"
                                            checked={isGlobalSearch}
                                            onChange={handleGlobalSearchToggle}
                                            sx={{ p: 0.35, color: theme.custom.chart.axisSoft, '&.Mui-checked': { color: theme.palette.primary.main } }}
                                        />
                                        <Typography variant="caption" sx={{ color: isGlobalSearch ? theme.palette.primary.main : theme.palette.text.secondary, fontWeight: 700, pr: 0.2 }}>
                                            Global
                                        </Typography>
                                    </Box>
                                </InputAdornment>
                            ),
                        }}
                    />

                    {!isGlobalSearch && (
                        <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, flexWrap: 'wrap',
                        }}>
                            {/* breadcrumb */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', gap: 0.3, overflowX: 'auto', flex: 1, py: 0.5,
                                '&::-webkit-scrollbar': { height: 3 }, '&::-webkit-scrollbar-thumb': { background: alpha(theme.palette.primary.main, 0.14), borderRadius: 2 },
                            }}>
                                {columns.map((c, i) => (
                                    <React.Fragment key={c.id}>
                                        {i > 0 && <ChevronRight sx={{ fontSize: 13, color: theme.custom.chart.axisSoft, flexShrink: 0, transition: `transform ${theme.custom.motion.swift}` }} />}
                                        <Chip label={c.dir.split('/').pop() || 'data'} size="small"
                                            variant={i === columns.length - 1 ? 'filled' : 'outlined'}
                                            color={i === columns.length - 1 ? 'primary' : 'default'}
                                            onClick={() => backTo(i)}
                                            sx={{
                                                cursor: 'pointer', fontWeight: i === columns.length - 1 ? 600 : 400, flexShrink: 0,
                                                transition: `all ${theme.custom.motion.swift}`,
                                                '&:hover': { transform: 'translateY(-1px)' },
                                                '&:active': { transform: 'scale(0.96)' },
                                            }} />
                                    </React.Fragment>
                                ))}
                            </Box>

                            {/* batch actions */}
                            {visCk.length > 0 && (
                                <Box sx={{
                                    display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0,
                                    animation: 'fadeIn .2s ease both',
                                    '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateX(6px)' }, to: { opacity: 1, transform: 'none' } },
                                }}>
                                    <Checkbox size="small" sx={{ p: 0.3 }} checked={allVisCk} indeterminate={someVisCk} onChange={toggleAllVis} title="Select all visible" />
                                    <Chip label={visCk.length} size="small" color="primary" onDelete={clearAll} sx={{ fontSize: '0.72rem' }} />
                                    <Button size="small" variant="contained"
                                        disabled={downloadState.loading}
                                        sx={{ minWidth: 0, px: 1.5, py: 0.3, fontSize: '0.7rem', textTransform: 'none', boxShadow: 'none' }}
                                        onClick={() => { void handleDownloadSelection(); }}>
                                        <FileDownload sx={{ fontSize: 14, mr: 0.3 }} /> {downloadState.loading ? 'Preparing...' : 'Download'}
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
                {downloadState.loading && <LinearProgress sx={{ ...loadingBarSx, mb: 1 }} />}
                {downloadState.error && (
                    <Alert severity="error" sx={{ mb: 1, borderRadius: 2 }} onClose={() => setDownloadState({ loading: false, error: '' })}>
                        {downloadState.error}
                    </Alert>
                )}

                {isGlobalSearch ? (
                    <GlobalSearchResults
                        query={filter}
                        checked={checked}
                        toggleFile={toggleFile}
                        togglePaths={togglePaths}
                        clearAll={clearAll}
                        onOpenDirectory={openDirectoryFromGlobalSearch}
                    />
                ) : (
                    <Paper elevation={0} sx={plotFrameSx(theme, { borderRadius: 3, flex: 1, display: 'flex', flexDirection: 'column' })}>
                        <Box ref={scrollRef} sx={{
                            display: 'flex', flex: 1, minHeight: 0,
                            overflowX: 'auto', overflowY: 'hidden',
                            '&::-webkit-scrollbar': { height: 6 },
                            '&::-webkit-scrollbar-thumb': { background: alpha(theme.palette.primary.main, 0.16), borderRadius: 3 },
                        }}>
                            {/* active columns */}
                            {columns.map((c, i) => (
                                <DirColumn key={c.id} dir={c.dir} filter={filter} onFiles={onFiles} onStats={onStats}
                                    theme={theme}
                                    animState="enter"
                                    onEnter={(subPath) => enterDir(i, subPath)} />
                            ))}
                            {/* pure back navigation keeps trailing columns exiting on the right */}
                            {exitingCols.map(c => (
                                <ExitingColumnGhost key={`x-${c.id}`} dir={c.dir} theme={theme} />
                            ))}
                            {compactBrowseLayout && (
                                <Box sx={{ display: { xs: 'none', md: 'contents' } }}>
                                <DataBrowseSummary
                                    currentDir={currentDir}
                                    filter={filter}
                                    selectedPaths={visCk}
                                    visibleItemCount={currentStats.totalCount}
                                    visibleFileCount={currentStats.fileCount}
                                    visibleFolderCount={currentStats.folderCount}
                                    columnCount={columns.length}
                                />
                                </Box>
                            )}
                        </Box>
                    </Paper>
                )}
            </Box>
        </SelectionCtx.Provider>
    );
}
