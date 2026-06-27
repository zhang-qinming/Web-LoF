import React, { startTransition, useEffect, useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Pagination from '@mui/material/Pagination';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Paper from '@mui/material/Paper';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { alpha, useTheme } from '@mui/material/styles';
import Download from '@mui/icons-material/Download';
import Folder from '@mui/icons-material/Folder';
import InsertDriveFile from '@mui/icons-material/InsertDriveFile';
import Search from '@mui/icons-material/Search';
import FolderOpen from '@mui/icons-material/FolderOpen';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Close from '@mui/icons-material/Close';
import FileDownload from '@mui/icons-material/FileDownload';
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBox from '@mui/icons-material/CheckBox';
import Storage from '@mui/icons-material/Storage';
import AccountTree from '@mui/icons-material/AccountTree';
import axios from 'axios';
import DataBrowseSummary from '../components/DataBrowseSummary';
import { downloadDataPaths, getZipName, triggerBatchDataDownload, triggerDataDownload, triggerDataPackageDownload, triggerTraitDataDownload } from '../utils/download';
import { createTtlCache } from '../utils/cache';
import { compareValues, nextSortDirection } from '../utils/sort';
import {
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

const SORT_LABEL_SX = {
    display: 'inline-flex',
    alignItems: 'center',
    width: '100%',
    fontSize: 'inherit',
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.88rem',
        margin: 0,
    },
};

function fmtSize(b) {
    if (b == null) return '';
    const bytes = Number(b);
    if (!Number.isFinite(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Math.max(0, bytes);
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    if (unitIndex === 0) return `${Math.round(value)} B`;
    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

const SelectionCtx = createContext({
    checked: new Set(), toggleFile: () => {}, toggleDirAll: () => {}, clearAll: () => {},
});

const DATA_BROWSER_CACHE_TTL_MS = 10 * 60 * 1000;
const LIST_CACHE = createTtlCache({ ttlMs: DATA_BROWSER_CACHE_TTL_MS, maxEntries: 120 });
const FILE_PATHS_CACHE = createTtlCache({ ttlMs: DATA_BROWSER_CACHE_TTL_MS, maxEntries: 40 });
const GLOBAL_SEARCH_CACHE = createTtlCache({ ttlMs: DATA_BROWSER_CACHE_TTL_MS, maxEntries: 80 });

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

function getListCacheKey(dir, page, filter, sortBy = 'name', sortDir = 'asc') {
    return `${dir}::${page}::${filter || ''}::${sortBy}::${sortDir}`;
}

function getFilePathsCacheKey(dir, filter) {
    return `${dir}::${filter || ''}`;
}

function getGlobalSearchCacheKey(query, page, sortBy = 'relevance', sortDir = 'asc') {
    return `${query}::${page}::${sortBy}::${sortDir}`;
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

        const cacheKey = getListCacheKey(dir, page, filter, sortBy, sortDir);
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

        API.get('/list', { params: { dir, page, limit: PER, search: filter || undefined, sortBy, order: sortDir } })
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
    }, [dir, onFiles, onStats, page, filter, sortBy, sortDir]);

    useEffect(() => { setPage(1); }, [filter]);
    useEffect(() => { setPage(1); }, [sortBy, sortDir]);
    useEffect(() => {
        if (animState === 'exit') return undefined;
        const t = setTimeout(() => { enterSettledRef.current = true; }, ANIM + 20);
        return () => clearTimeout(t);
    }, [animState]);

    const filtered = useMemo(() => {
        const list = [...items];
        list.sort((a, b) => {
            if (sortBy === 'size') return compareValues(a.size, b.size, 'number', sortDir);
            if (sortBy === 'type') return compareValues(a.type, b.type, 'text', sortDir) || compareValues(a.name, b.name, 'text', 'asc');
            return (Number(b.type === 'dir') - Number(a.type === 'dir')) || compareValues(a.name, b.name, 'text', sortDir);
        });
        return list;
    }, [items, sortBy, sortDir]);

    const handleSort = useCallback((key) => {
        setSortDir((current) => nextSortDirection(sortBy, key, current, key === 'size' ? 'desc' : 'asc'));
        setSortBy(key);
    }, [sortBy]);

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
                    <IconButton
                        size="small"
                        aria-label={headerDownloadTitle}
                        disabled={downloading}
                        onClick={() => { void handleHeaderDownload(); }}
                        sx={{ color: hasFilter ? theme.palette.primary.main : theme.palette.text.secondary, '&:hover': { color: hasFilter ? theme.palette.primary.dark : theme.palette.warning.dark, bgcolor: hasFilter ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.warning.main, 0.1) } }}
                    >
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
                                <Checkbox
                                    size="small"
                                    inputProps={{ 'aria-label': `Select all files in ${columnTitle}` }}
                                    sx={{ p: 0.3 }}
                                    checked={allCk}
                                    indeterminate={someCk}
                                    disabled={files.length === 0}
                                    onChange={() => toggleDirAll(dir, files.map(f => f.path))} />
                            </TableCell>
                            <TableCell sx={{ ...thSx, textAlign: 'left' }}>
                                <TableSortLabel
                                    active={sortBy === 'name'}
                                    direction={sortBy === 'name' ? sortDir : 'asc'}
                                    onClick={() => handleSort('name')}
                                    sx={{ ...SORT_LABEL_SX, justifyContent: 'flex-start' }}
                                >
                                    Name
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ ...thSx, width: 76, minWidth: 76, textAlign: 'center', px: 0.6, whiteSpace: 'nowrap' }}>
                                <TableSortLabel
                                    active={sortBy === 'size'}
                                    direction={sortBy === 'size' ? sortDir : 'asc'}
                                    onClick={() => handleSort('size')}
                                    sx={{ ...SORT_LABEL_SX, justifyContent: 'center', whiteSpace: 'nowrap' }}
                                >
                                    Size
                                </TableSortLabel>
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
                                const isHovered = hovered === f.path;
                                return (
                                    <TableRow key={f.path}
                                        onMouseEnter={() => setHov(f.path)}
                                        sx={{
                                            ...tableRowRevealSx(theme, rowIndex),
                                            '& td': { py: 0.3, px: 1.5 },
                                            bgcolor: isCk ? alpha(theme.palette.primary.main, 0.075) : 'transparent',
                                            transition: `background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                                            '&:hover': {
                                                bgcolor: isCk ? alpha(theme.palette.primary.main, 0.11) : alpha(theme.palette.primary.main, 0.045),
                                                boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.055)}`,
                                            },
                                            '& .dir-row-action': {
                                                opacity: isCk || isHovered ? 1 : 0.48,
                                                transform: isHovered ? 'translateY(0)' : 'translateY(1px)',
                                                transition: `opacity ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}`,
                                            },
                                            '&:hover .dir-row-action': {
                                                opacity: 1,
                                                transform: 'translateY(0)',
                                            },
                                        }}>
                                        <TableCell sx={{
                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                            borderLeft: `3px solid ${isCk ? theme.palette.primary.main : isHovered ? alpha(theme.palette.primary.main, 0.55) : 'transparent'}`,
                                            textAlign: 'center',
                                            px: 0.3,
                                            transition: `border-color ${theme.custom.motion.swift}`,
                                        }}>
                                            {isFile && <Checkbox
                                                size="small"
                                                inputProps={{ 'aria-label': `Select ${f.name}` }}
                                                sx={{ p: 0.3 }}
                                                checked={isCk}
                                                icon={<CheckBoxOutlineBlank sx={{ fontSize: 17 }} />}
                                                checkedIcon={<CheckBox sx={{ fontSize: 17 }} />}
                                                onChange={() => toggleFile(f.path)} />}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, textAlign: 'left' }}>
                                            {f.type === 'dir' ? (
                                                <Box component="button" onClick={() => onEnter(f.path)}
                                                    sx={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.7, width: '100%',
                                                        border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                                                        fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', fontSize: '0.79rem', fontWeight: 500,
                                                        color: theme.palette.primary.main, textAlign: 'left', px: 0, py: 0.2,
                                                        transition: `color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                                        '&:hover': { color: theme.palette.primary.dark, transform: 'translateX(2px)' },
                                                        '&:active': { transform: 'translateX(4px) scale(0.98)' },
                                                    }}>
                                                    <Folder sx={{ fontSize: 17, color: theme.palette.primary.light, flexShrink: 0 }} />
                                                    <Box component="span" title={f.name} sx={{ minWidth: 0, textAlign: 'left', ...multilineNameSx }}>{f.name}</Box>
                                                    <ChevronRight sx={{
                                                        fontSize: 16, opacity: 0.3, flexShrink: 0,
                                                        transition: 'opacity .15s, transform .15s',
                                                        '.MuiTableRow-root:hover &': { opacity: 0.7, transform: 'translateX(2px)' },
                                                    }} />
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 0.7 }}>
                                                    <InsertDriveFile sx={{ fontSize: 15, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />
                                                    <Box component="span" title={f.name}
                                                        sx={{ minWidth: 0, textAlign: 'left', fontSize: '0.79rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', ...multilineNameSx }}>
                                                        {f.name}
                                                    </Box>
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell align="center" sx={{
                                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                                            width: 76,
                                            minWidth: 76,
                                            px: 0.6,
                                            fontSize: '0.72rem',
                                            color: theme.palette.text.secondary,
                                            whiteSpace: 'nowrap',
                                            fontVariantNumeric: 'tabular-nums',
                                            fontFeatureSettings: '"tnum" 1',
                                        }}>
                                            {isFile ? fmtSize(f.size) : ''}
                                        </TableCell>
                                        <TableCell align="center" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
                                            {isFile ? (
                                                <Tooltip title="Download">
                                                    <IconButton className="dir-row-action" size="small" aria-label={`Download ${f.name}`} onClick={() => {
                                                        setDownloading(true);
                                                        setError('');
                                                        triggerDataDownload(f.path)
                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                            .finally(() => setDownloading(false));
                                                    }}
                                                        sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                                                        <Download sx={{ fontSize: 16, color: theme.palette.primary.main }} />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : !filter ? (
                                                <Tooltip title="Download as ZIP">
                                                    <IconButton className="dir-row-action" size="small" component="span" aria-label={`Download ${f.name} as ZIP`} onClick={() => {
                                                        setDownloading(true);
                                                        setError('');
                                                        Promise.resolve(triggerBatchDataDownload([f.path], getZipName(f.path)))
                                                            .catch((err) => setError(getRequestErrorMessage(err, 'Download failed')))
                                                            .finally(() => setDownloading(false));
                                                    }} sx={{ '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.1) } }}>
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

function GlobalSearchResults({ query, checked, toggleFile, togglePaths, clearAll, onOpenDirectory, embedded = false }) {
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
    const canSearch = trimmedQuery.length > 0;
    const [results, setResults] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');
    const [hovered, setHovered] = useState(null);
    const [sortBy, setSortBy] = useState('relevance');
    const [sortDir, setSortDir] = useState('asc');

    useEffect(() => {
        setPage(1);
    }, [trimmedQuery]);
    useEffect(() => {
        setPage(1);
    }, [sortBy, sortDir]);

    useEffect(() => {
        let cancelled = false;

        if (!canSearch) {
            setResults([]);
            setTotalCount(0);
            setTotalPages(1);
            setLoading(false);
            return () => { cancelled = true; };
        }

        const cacheKey = getGlobalSearchCacheKey(trimmedQuery, page, sortBy, sortDir);
        const cached = GLOBAL_SEARCH_CACHE.get(cacheKey);

        if (cached) {
            setResults(cached.results);
            setTotalCount(cached.totalCount);
            setTotalPages(cached.totalPages);
        } else {
            setResults([]);
            setTotalCount(0);
            setTotalPages(1);
        }

        setLoading(true);
        setError('');
        API.get('/search', { params: { q: trimmedQuery, page, limit: GLOBAL_PAGE_SIZE, sortBy, order: sortDir } })
            .then(({ data }) => {
                if (cancelled) return;
                const nextResults = data.results || [];
                const nextTotalCount = data.totalCount ?? nextResults.length;
                const nextTotalPages = data.totalPages || Math.max(1, Math.ceil(nextTotalCount / GLOBAL_PAGE_SIZE));
                GLOBAL_SEARCH_CACHE.set(cacheKey, {
                    results: nextResults,
                    totalCount: nextTotalCount,
                    totalPages: nextTotalPages,
                });
                setResults(nextResults);
                setTotalCount(nextTotalCount);
                setTotalPages(nextTotalPages);
            })
            .catch((err) => {
                if (cancelled) return;
                if (!cached) {
                    setResults([]);
                    setTotalCount(0);
                    setTotalPages(1);
                }
                setError(getRequestErrorMessage(err, 'Search failed'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [canSearch, page, sortBy, sortDir, trimmedQuery]);

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
    const handleSort = (key) => {
        setSortDir((current) => nextSortDirection(sortBy, key, current, key === 'size' ? 'desc' : 'asc'));
        setSortBy(key);
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
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`${totalCount.toLocaleString()} matches`} sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                    <Chip size="small" label={`${fileResults.length} files`} sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
                    <Chip size="small" label={`${results.length - fileResults.length} folders`} sx={summaryChipSx(theme, metricChipTone(theme, 'subtle'))} />
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

            <Paper elevation={0} sx={plotFrameSx(theme, {
                borderRadius: embedded ? 1.5 : 3,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                boxShadow: embedded ? 'none' : undefined,
            })}>
                {(loading || downloading) && <LinearProgress sx={loadingBarSx} />}
                {!canSearch ? (
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                            Type a search term to search files and folders.
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {loading && (
                            <Box sx={{ px: 2, py: 1, bgcolor: theme.custom.surface.raised, borderBottom: `1px solid ${theme.custom.border.soft}` }}>
                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 700 }}>
                                    {visibleResults.length > 0 ? 'Updating cached results.' : 'Searching server files. The first search may build the index and take longer.'}
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
                                        <TableCell sx={{ ...thSx, width: 360, textAlign: 'center' }}>
                                            <TableSortLabel
                                                active={sortBy === 'name'}
                                                direction={sortBy === 'name' ? sortDir : 'asc'}
                                                onClick={() => handleSort('name')}
                                                sx={{ ...SORT_LABEL_SX, justifyContent: 'center' }}
                                            >
                                                Name
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ ...thSx, width: { xs: 220, sm: 'auto' }, textAlign: 'center' }}>
                                            <TableSortLabel
                                                active={sortBy === 'path'}
                                                direction={sortBy === 'path' ? sortDir : 'asc'}
                                                onClick={() => handleSort('path')}
                                                sx={{ ...SORT_LABEL_SX, justifyContent: 'center' }}
                                            >
                                                Path
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ ...thSx, width: 84, textAlign: 'center' }}>
                                            <TableSortLabel
                                                active={sortBy === 'size'}
                                                direction={sortBy === 'size' ? sortDir : 'asc'}
                                                onClick={() => handleSort('size')}
                                                sx={{ ...SORT_LABEL_SX, justifyContent: 'center' }}
                                            >
                                                Size
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ ...thSx, width: 84, textAlign: 'center' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading && visibleResults.length === 0 ? (
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
                                                    <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, width: 360, textAlign: 'center' }}>
                                                        {item.type === 'dir' ? (
                                                            <Box
                                                                component="button"
                                                                onClick={() => onOpenDirectory(item.path)}
                                                                sx={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
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
                                                                    textAlign: 'center',
                                                                    px: 0,
                                                                    py: 0.2,
                                                                    transition: `color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                                                    '&:hover': { color: theme.palette.primary.dark, transform: 'translateX(2px)' },
                                                                    '&:active': { transform: 'translateX(4px) scale(0.98)' },
                                                                }}
                                                            >
                                                                <Folder sx={{ fontSize: 17, color: theme.palette.primary.light, flexShrink: 0 }} />
                                                                <Box component="span" title={item.name} sx={{ minWidth: 0, textAlign: 'center', ...multilineNameSx }}>
                                                                    {item.name}
                                                                </Box>
                                                            </Box>
                                                        ) : (
                                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.7 }}>
                                                                <InsertDriveFile sx={{ fontSize: 15, color: theme.custom.chart.axisSoft, flexShrink: 0 }} />
                                                                <Box component="span" title={item.name} sx={{ minWidth: 0, textAlign: 'center', fontSize: '0.79rem', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', ...multilineNameSx }}>
                                                                    {item.name}
                                                                </Box>
                                                            </Box>
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, width: { xs: 220, sm: 'auto' }, textAlign: 'center' }}>
                                                        <Box title={item.path} sx={{ fontSize: '0.75rem', textAlign: 'center', color: theme.palette.text.secondary, fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.path}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`, fontSize: '0.72rem', color: theme.palette.text.secondary }}>
                                                        {isFile ? fmtSize(item.size) : ''}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.3 }}>
                                                            {isFile && (
                                                                <Tooltip title="Download">
                                                                    <IconButton size="small" aria-label={`Download ${item.name}`} onClick={() => {
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
                                                                    <IconButton size="small" aria-label={`Download ${item.name} as ZIP`} onClick={() => {
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
                                                                <IconButton
                                                                    size="small"
                                                                    aria-label={item.type === 'dir' ? `Open ${item.name}` : `Open containing folder for ${item.name}`}
                                                                    onClick={() => onOpenDirectory(openDir)}
                                                                    sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                                                                >
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
                                            Hover results for details
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

function FullDataBrowser({ onBackToDownloads } = {}) {
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

    const showIntro = !onBackToDownloads && (isGlobalSearch || (columns.length === 1 && exitingCols.length === 0));
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
                '@media (min-width: 2200px)': {
                    px: 5,
                },
                height: { xs: 'auto', md: 'calc(100dvh - 96px)' },
                minHeight: { xs: 'calc(100dvh - 88px)', md: 560 },
                display: 'flex',
                flexDirection: 'column',
            }}>
                {showIntro && (
                    <Box sx={{
                        overflow: 'hidden',
                        maxHeight: 80,
                        opacity: 1,
                        transform: 'none',
                        transition: 'max-height .25s ease, opacity .2s ease, transform .22s ease',
                    }}>
                        <Box sx={{ pb: 2 }}>
                            <Typography variant="h4" sx={sectionTitleSx(theme, { mb: 0 })}>
                                {isGlobalSearch ? 'Global Search' : 'Data Browser'}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* toolbar */}
                <Box sx={toolbarSx(theme, {
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        md: onBackToDownloads
                            ? 'minmax(260px, 360px) auto minmax(0, 1fr) auto'
                            : 'minmax(260px, 420px) auto minmax(0, 1fr)',
                    },
                    alignItems: 'center',
                    gap: { xs: 0.9, md: 1.1 },
                    mb: onBackToDownloads ? 1.25 : 2,
                    flexShrink: 0,
                    borderRadius: onBackToDownloads ? 2 : undefined,
                    bgcolor: onBackToDownloads ? alpha(theme.palette.background.paper, 0.94) : undefined,
                    boxShadow: onBackToDownloads ? '0 10px 22px rgba(15, 23, 42, 0.045)' : undefined,
                    py: { xs: 1, md: 0.95 },
                })}>
                    <TextField
                        placeholder={isGlobalSearch ? 'Search files and folders' : 'Filter this folder'}
                        size="small"
                        value={filter} onChange={e => setFilter(e.target.value)}
                        error={false}
                        sx={controlFieldSx(theme, { width: '100%' })}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18, color: theme.custom.chart.axisSoft }} /></InputAdornment>,
                            endAdornment: filter ? (
                                <InputAdornment position="end" sx={{ ml: 0.4 }}>
                                    <IconButton size="small" aria-label="Clear filter" onClick={() => setFilter('')} sx={{ p: 0.3 }}>
                                        <Close sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />

                    <Box
                        component="label"
                        sx={{
                            minHeight: 34,
                            px: 0.8,
                            py: 0.35,
                            borderRadius: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: { xs: 'flex-start', md: 'center' },
                            gap: 0.35,
                            cursor: 'pointer',
                            bgcolor: isGlobalSearch ? alpha(theme.palette.primary.main, 0.08) : theme.custom.surface.base,
                            border: `1px solid ${isGlobalSearch ? alpha(theme.palette.primary.main, 0.2) : theme.custom.border.soft}`,
                            color: isGlobalSearch ? theme.palette.primary.main : theme.palette.text.secondary,
                            fontWeight: 750,
                        }}
                    >
                        <Checkbox
                            size="small"
                            inputProps={{ 'aria-label': 'Search globally' }}
                            checked={isGlobalSearch}
                            onChange={handleGlobalSearchToggle}
                            sx={{ p: 0.25, color: 'inherit', '&.Mui-checked': { color: theme.palette.primary.main } }}
                        />
                        <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 750 }}>
                            Global
                        </Typography>
                    </Box>

                    {!isGlobalSearch && (
                        <Box sx={{
                            display: 'flex', alignItems: 'center', gap: 1, minWidth: 0,
                            gridColumn: { xs: '1 / -1', md: 'auto' },
                        }}>
                            {/* breadcrumb */}
                            <Box sx={{
                                display: 'flex', alignItems: 'center', gap: 0.3, overflowX: 'auto', flex: 1, py: 0.25,
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

                    {onBackToDownloads && (
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={onBackToDownloads}
                            sx={{
                                justifySelf: { xs: 'stretch', md: 'end' },
                                alignSelf: 'center',
                                minHeight: 34,
                                px: 1.45,
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: theme.palette.background.paper,
                                borderColor: alpha(theme.palette.primary.main, 0.2),
                                color: theme.palette.text.primary,
                                '&:hover': {
                                    borderColor: alpha(theme.palette.primary.main, 0.38),
                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                },
                            }}
                        >
                            <ChevronRight sx={{ fontSize: 15, mr: 0.45, transform: 'rotate(180deg)' }} />
                            Back to downloads
                        </Button>
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
const FOLDER_DOWNLOAD_PAGE_SIZE = 50;
const DOWNLOAD_START_FEEDBACK_MS = 900;
const TRAIT_DOWNLOAD_PAGE_SIZE = 20;

function formatArchiveUpdated(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `Updated ${date.toLocaleDateString('en-US')} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

function getArchiveTooltip(archive) {
    return formatArchiveUpdated(archive?.mtime) || 'Prepared archive';
}

const resourceIconSx = (color) => ({
    width: 36,
    height: 36,
    borderRadius: 1,
    display: 'grid',
    placeItems: 'center',
    color: color,
    bgcolor: alpha(color, 0.06),
    flexShrink: 0,
});

function formatTraitTypeLabel(type) {
    const labels = {
        associations: 'Associations',
        'cross-trait': 'Cross-trait',
        manhattan: 'Manhattan',
        'program-scatter': 'Program',
        'trait-program-gene': 'Graph',
    };
    return labels[type] || String(type || '').replace(/[-_]+/g, ' ');
}

function TraitTypeChips({ types = [], theme, justifyContent = 'flex-start' }) {
    const visibleTypes = types.slice(0, 4);
    if (!visibleTypes.length) {
        return (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem', textAlign: justifyContent === 'center' ? 'center' : 'left', display: 'block' }}>
                Manifest only
            </Typography>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent }}>
            {visibleTypes.map((type) => (
                <Chip
                    key={type}
                    label={formatTraitTypeLabel(type)}
                    size="small"
                    sx={{
                        height: 20,
                        borderRadius: 1,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.info.main, 0.08),
                        color: theme.palette.info.dark,
                    }}
                />
            ))}
            {types.length > visibleTypes.length && (
                <Chip
                    label={`+${types.length - visibleTypes.length}`}
                    size="small"
                    sx={{
                        height: 20,
                        borderRadius: 1,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        bgcolor: alpha(theme.palette.text.secondary, 0.08),
                        color: theme.palette.text.secondary,
                    }}
                />
            )}
        </Box>
    );
}

function TraitDownloadPanel({ theme, query: externalQuery, embedded = false }) {
    const isControlledQuery = externalQuery != null;
    const [localQuery, setLocalQuery] = useState('');
    const [page, setPage] = useState(1);
    const [payload, setPayload] = useState({ data: [], totalPages: 1, totalCount: 0, maxDownloadTraits: 20 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(() => new Set());
    const [downloadKey, setDownloadKey] = useState(null);
    const [sortBy, setSortBy] = useState('trait_name');
    const [sortDir, setSortDir] = useState('asc');
    const resetTimerRef = useRef(null);
    const query = isControlledQuery ? externalQuery : localQuery;
    const trimmedQuery = query.trim();
    const canSearch = trimmedQuery.length >= 2;
    const rows = useMemo(() => payload.data || [], [payload.data]);
    const selectedIds = [...selected];
    const maxDownloadTraits = payload.maxDownloadTraits || 20;

    useEffect(() => {
        clearTimeout(resetTimerRef.current);
        return () => clearTimeout(resetTimerRef.current);
    }, []);

    useEffect(() => {
        setPage(1);
    }, [trimmedQuery]);
    useEffect(() => {
        setPage(1);
    }, [sortBy, sortDir]);

    useEffect(() => {
        if (!canSearch) {
            setPayload({ data: [], totalPages: 1, totalCount: 0, maxDownloadTraits });
            setSelected(new Set());
            setError('');
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        const timer = setTimeout(() => {
            setLoading(true);
            setError('');
            API.get('/traits/search', {
                params: { q: trimmedQuery, page, limit: TRAIT_DOWNLOAD_PAGE_SIZE, sortBy, order: sortDir },
            })
                .then((response) => {
                    if (cancelled) return;
                    setPayload({
                        data: response.data?.data || [],
                        totalPages: response.data?.totalPages || 1,
                        totalCount: response.data?.totalCount || 0,
                        maxDownloadTraits: response.data?.maxDownloadTraits || 20,
                    });
                })
                .catch((err) => {
                    if (!cancelled) setError(getRequestErrorMessage(err, 'Trait search failed'));
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [canSearch, maxDownloadTraits, page, sortBy, sortDir, trimmedQuery]);

    const toggleRow = useCallback((fileId) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(fileId)) next.delete(fileId);
            else if (next.size < maxDownloadTraits) next.add(fileId);
            return next;
        });
    }, [maxDownloadTraits]);

    const togglePage = useCallback(() => {
        const downloadableIds = rows
            .filter((row) => row.file_id && row.download?.hasDownloadableData)
            .map((row) => row.file_id);
        setSelected((current) => {
            const next = new Set(current);
            const allSelected = downloadableIds.length > 0 && downloadableIds.every((id) => next.has(id));
            if (allSelected) {
                downloadableIds.forEach((id) => next.delete(id));
                return next;
            }
            downloadableIds.forEach((id) => {
                if (next.size < maxDownloadTraits) next.add(id);
            });
            return next;
        });
    }, [maxDownloadTraits, rows]);

    const handleSort = useCallback((key) => {
        setSortDir((current) => nextSortDirection(sortBy, key, current, ['sample_size', 'n_sig', 'n_variants', 'year'].includes(key) ? 'desc' : 'asc'));
        setSortBy(key);
    }, [sortBy]);

    const handleDownload = useCallback(async (traitIds, key, filename) => {
        clearTimeout(resetTimerRef.current);
        setDownloadKey(key);
        setError('');
        try {
            await triggerTraitDataDownload(traitIds, filename);
            resetTimerRef.current = setTimeout(() => {
                setDownloadKey((current) => current === key ? null : current);
            }, DOWNLOAD_START_FEEDBACK_MS);
        } catch (err) {
            setError(getRequestErrorMessage(err, 'Download failed'));
            setDownloadKey(null);
        }
    }, []);

    const allPageDownloadable = rows
        .filter((row) => row.file_id && row.download?.hasDownloadableData)
        .map((row) => row.file_id);
    const pageAllSelected = allPageDownloadable.length > 0 && allPageDownloadable.every((id) => selected.has(id));
    const pageSomeSelected = allPageDownloadable.some((id) => selected.has(id)) && !pageAllSelected;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: embedded ? 1.2 : 2 }}>
            <Paper
                elevation={0}
                sx={{
                    p: embedded ? 1.5 : 2,
                    borderRadius: 1.5,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: 'background.paper',
                }}
            >
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: { xs: 'stretch', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
                    {isControlledQuery ? (
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'text.primary' }}>
                                Trait data packages
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem', mt: 0.2 }}>
                                Matching trait-level source bundles for "{trimmedQuery}"
                            </Typography>
                        </Box>
                    ) : (
                        <TextField
                            value={localQuery}
                            onChange={(event) => {
                                setLocalQuery(event.target.value);
                                setPage(1);
                            }}
                            placeholder="Search trait name, file ID, or GWAS ID"
                            size="small"
                            sx={controlFieldSx(theme, {
                                width: { xs: '100%', md: 440 },
                                flex: { xs: '1 1 100%', md: '0 0 440px' },
                                flexShrink: { xs: 1, md: 0 },
                            })}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search sx={{ fontSize: 18, color: theme.custom.chart.axisSoft }} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    )}
                    <Button
                        variant="contained"
                        disabled={selectedIds.length === 0 || Boolean(downloadKey)}
                        onClick={() => {
                            void handleDownload(selectedIds, 'selected', `trait-data-${selectedIds.length}-traits.zip`);
                        }}
                        sx={{ textTransform: 'none', borderRadius: 1, boxShadow: 'none', fontSize: '0.78rem', fontWeight: 700, minWidth: 184, flexShrink: 0 }}
                    >
                        <FileDownload sx={{ fontSize: 14, mr: 0.5 }} />
                        {downloadKey === 'selected' ? 'Preparing...' : `Download selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
                    </Button>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 650 }}>
                        Max {maxDownloadTraits} traits per package
                    </Typography>
                </Box>
            </Paper>

            {loading && <LinearProgress sx={{ height: 3, borderRadius: 999 }} />}
            {error && <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1.5, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
                <Table size="small" sx={{ tableLayout: 'fixed' }}>
                    <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.045) }}>
                            <TableCell padding="checkbox" align="center" sx={{ width: 42, textAlign: 'center' }}>
                                <Checkbox
                                    size="small"
                                    indeterminate={pageSomeSelected}
                                    checked={pageAllSelected}
                                    onChange={togglePage}
                                    disabled={allPageDownloadable.length === 0}
                                />
                            </TableCell>
                            <TableCell align="left" sx={{ fontWeight: 800, width: '32%', textAlign: 'left' }}>
                                <TableSortLabel
                                    active={sortBy === 'trait_name'}
                                    direction={sortBy === 'trait_name' ? sortDir : 'asc'}
                                    onClick={() => handleSort('trait_name')}
                                    sx={{ ...SORT_LABEL_SX, justifyContent: 'flex-start' }}
                                >
                                    Trait
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, width: '18%', textAlign: 'center' }}>
                                <TableSortLabel
                                    active={sortBy === 'file_id'}
                                    direction={sortBy === 'file_id' ? sortDir : 'asc'}
                                    onClick={() => handleSort('file_id')}
                                    sx={{ ...SORT_LABEL_SX, justifyContent: 'center' }}
                                >
                                    IDs
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, width: '14%', textAlign: 'center' }}>
                                <TableSortLabel
                                    active={sortBy === 'population'}
                                    direction={sortBy === 'population' ? sortDir : 'asc'}
                                    onClick={() => handleSort('population')}
                                    sx={{ ...SORT_LABEL_SX, justifyContent: 'center' }}
                                >
                                    Study
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, width: '24%', textAlign: 'center' }}>Available data</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, width: 128 }}>Download</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!canSearch && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ py: 5, textAlign: 'center', color: 'text.secondary', fontWeight: 650 }}>
                                    Enter at least 2 characters to search trait data packages.
                                </TableCell>
                            </TableRow>
                        )}
                        {canSearch && !loading && rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ py: 5, textAlign: 'center', color: 'text.secondary', fontWeight: 650 }}>
                                    No traits match this search.
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((row) => {
                            const fileId = row.file_id || '';
                            const isChecked = selected.has(fileId);
                            const isDownloadable = Boolean(row.download?.hasDownloadableData);
                            const isDownloading = downloadKey === fileId;
                            return (
                                <TableRow key={fileId || row.gwas_id} hover>
                                    <TableCell padding="checkbox" align="center" sx={{ textAlign: 'center' }}>
                                        <Checkbox
                                            size="small"
                                            checked={isChecked}
                                            disabled={!isDownloadable}
                                            onChange={() => toggleRow(fileId)}
                                        />
                                    </TableCell>
                                    <TableCell align="left" sx={{ minWidth: 0, textAlign: 'left' }}>
                                        <Typography sx={{ fontWeight: 760, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                                            {row.trait_name || fileId}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', textAlign: 'left', display: 'block' }}>
                                            {row.download?.fileCount || 0} source files / {row.download?.associationCount || 0} associations
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={{ textAlign: 'center' }}>
                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center' }} noWrap>{fileId || '-'}</Typography>
                                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'text.secondary', textAlign: 'center' }} noWrap>{row.gwas_id || '-'}</Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={{ textAlign: 'center' }}>
                                        <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, textAlign: 'center' }} noWrap>{row.population || '-'}</Typography>
                                        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', textAlign: 'center' }} noWrap>{row.year || '-'}</Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={{ textAlign: 'center' }}>
                                        <TraitTypeChips types={row.download?.availableTypes || []} theme={theme} justifyContent="center" />
                                        {!isDownloadable && (
                                            <Typography variant="caption" sx={{ display: 'block', mt: 0.4, color: 'text.secondary', fontSize: '0.66rem', textAlign: 'center' }}>
                                                No source files or associations found.
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={!isDownloadable || Boolean(downloadKey)}
                                            onClick={() => {
                                                void handleDownload([fileId], fileId, `trait-data-${fileId}.zip`);
                                            }}
                                            sx={{ textTransform: 'none', borderRadius: 1, fontSize: '0.72rem', fontWeight: 700 }}
                                        >
                                            <Download sx={{ fontSize: 13, mr: 0.4 }} />
                                            {isDownloading ? 'Preparing...' : 'Download'}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {payload.totalPages > 1 && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 650 }}>
                        {payload.totalCount.toLocaleString()} matching traits
                    </Typography>
                    <Pagination count={payload.totalPages} page={page} onChange={(_, value) => setPage(value)} size="small" />
                </Box>
            )}
        </Box>
    );
}

function HubTraitSearchPanel({ query }) {
    const theme = useTheme();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) return null;

    return (
        <Box sx={{ mb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <TraitDownloadPanel theme={theme} query={trimmedQuery} embedded />
        </Box>
    );
}

export default function DataBrowser() {
    const theme = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();
    const initialBrowserView = searchParams.get('view') === 'browser'
        || Boolean(searchParams.get('dir'))
        || (Boolean(searchParams.get('q')) && searchParams.get('mode') !== 'global');
    const initialHubTab = 0;
    const [showFullBrowser, setShowFullBrowser] = useState(() => initialBrowserView);
    const [tabValue, setTabValue] = useState(initialHubTab);
    const [hubSearchQuery, setHubSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [payload, setPayload] = useState({ data: [], totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [downloadState, setDownloadState] = useState({ path: null, error: '' });
    const [packagePayload, setPackagePayload] = useState({ data: [] });
    const [packageLoading, setPackageLoading] = useState(true);
    const [packageError, setPackageError] = useState('');
    const [packageDownloadId, setPackageDownloadId] = useState(null);
    const [folderRefreshKey, setFolderRefreshKey] = useState(0);
    const [packageRefreshKey, setPackageRefreshKey] = useState(0);
    const folderDownloadResetTimerRef = useRef(null);
    const packageDownloadResetTimerRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        API.get('/folders', { params: { dir: '', page, limit: FOLDER_DOWNLOAD_PAGE_SIZE } })
            .then((response) => {
                if (cancelled) return;
                setPayload({
                    data: response.data?.data || [],
                    totalPages: response.data?.totalPages || 1,
                });
            })
            .catch((err) => {
                if (!cancelled) setError(getRequestErrorMessage(err, 'Failed to load folders'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [page, folderRefreshKey]);

    useEffect(() => {
        let cancelled = false;
        setPackageLoading(true);
        setPackageError('');
        API.get('/packages')
            .then((response) => {
                if (!cancelled) setPackagePayload({ data: response.data?.data || [] });
            })
            .catch((err) => {
                if (!cancelled) setPackageError(getRequestErrorMessage(err, 'Failed to load database export'));
            })
            .finally(() => {
                if (!cancelled) setPackageLoading(false);
            });
        return () => { cancelled = true; };
    }, [packageRefreshKey]);

    useEffect(() => () => {
        clearTimeout(folderDownloadResetTimerRef.current);
        clearTimeout(packageDownloadResetTimerRef.current);
    }, []);

    const showDataBrowser = useCallback(() => {
        setSearchParams({ view: 'browser' }, { replace: true });
        setShowFullBrowser(true);
    }, [setSearchParams]);

    const returnFromDataBrowser = useCallback(() => {
        setSearchParams({}, { replace: true });
        setPage(1);
        setShowFullBrowser(false);
        setFolderRefreshKey((value) => value + 1);
        setPackageRefreshKey((value) => value + 1);
    }, [setSearchParams]);

    const downloadFolder = useCallback(async (folder) => {
        const folderPath = folder?.path || '';
        const downloadMode = folder?.download?.mode || 'archive';
        clearTimeout(folderDownloadResetTimerRef.current);
        setDownloadState({ path: folderPath, error: '' });
        try {
            if (downloadMode === 'dynamic') {
                triggerBatchDataDownload([folderPath], getZipName(folderPath, 'data'));
            } else {
                await triggerDataDownload(folderPath);
            }
            folderDownloadResetTimerRef.current = setTimeout(() => {
                setDownloadState((current) => current.path === folderPath ? { path: null, error: '' } : current);
            }, DOWNLOAD_START_FEEDBACK_MS);
        } catch (err) {
            setDownloadState({ path: null, error: getRequestErrorMessage(err, 'Download failed') });
        }
    }, []);

    const downloadPackage = useCallback(async (packageId) => {
        clearTimeout(packageDownloadResetTimerRef.current);
        setPackageDownloadId(packageId);
        setPackageError('');
        try {
            await triggerDataPackageDownload(packageId);
            packageDownloadResetTimerRef.current = setTimeout(() => {
                setPackageDownloadId((current) => current === packageId ? null : current);
            }, DOWNLOAD_START_FEEDBACK_MS);
        } catch (err) {
            setPackageError(getRequestErrorMessage(err, 'Download failed'));
            setPackageDownloadId(null);
        }
    }, []);

    if (showFullBrowser) {
        return <FullDataBrowser onBackToDownloads={returnFromDataBrowser} />;
    }

    const hasFolders = payload.data.length > 0;
    const trimmedHubSearchQuery = hubSearchQuery.trim();
    const hasHubSearchQuery = trimmedHubSearchQuery.length > 0;

    return (
        <Box sx={{
            width: '100%',
            maxWidth: DATA_PAGE_MAX_WIDTH,
            mx: 'auto',
            px: { xs: 1.5, sm: 2, md: 3, xl: 4 },
            py: { xs: 2, md: 3 },
        }}>
            <Paper
                elevation={0}
                sx={{
                    mb: 3,
                    p: { xs: 1.5, md: 1.8 },
                    borderRadius: 1.5,
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: theme.palette.background.paper,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Typography variant="h5" sx={{ fontWeight: 760, color: 'text.primary', fontSize: { xs: '1.08rem', md: '1.18rem' }, lineHeight: 1.1 }}>
                        Data Download Hub
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={showDataBrowser}
                        sx={{
                            alignSelf: { xs: 'flex-start', sm: 'center' },
                            textTransform: 'none',
                            borderColor: theme.palette.divider,
                            color: theme.palette.text.primary,
                            fontWeight: 600,
                            px: 1.6,
                            py: 0.45,
                            borderRadius: 1,
                            fontSize: '0.76rem',
                            '&:hover': {
                                borderColor: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.04),
                            },
                        }}
                    >
                        <FolderOpen sx={{ fontSize: 14, mr: 0.6 }} />
                        Explore File Browser
                    </Button>
                </Box>
                <Box sx={{ mt: 1.25 }}>
                    <TextField
                        value={hubSearchQuery}
                        onChange={(event) => setHubSearchQuery(event.target.value)}
                        placeholder="Search trait name, file ID, or GWAS ID"
                        size="small"
                        fullWidth
                        error={false}
                        helperText=" "
                        sx={controlFieldSx(theme)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Box sx={{ width: 26, display: 'inline-flex', justifyContent: 'center', visibility: hubSearchQuery ? 'visible' : 'hidden', pointerEvents: hubSearchQuery ? 'auto' : 'none' }}>
                                        <Tooltip title="Clear search">
                                            <IconButton size="small" aria-label="Clear search" onClick={() => setHubSearchQuery('')} sx={{ p: 0.35 }}>
                                                <Close sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
                {!hasHubSearchQuery && (
                <Box sx={{ mt: 0.25 }}>
                    <Tabs
                        value={tabValue}
                        onChange={(_, val) => setTabValue(val)}
                        aria-label="download categories"
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 0,
                            '& .MuiTab-root': {
                                minHeight: 34,
                                px: 1.25,
                                mr: 0.5,
                                textTransform: 'none',
                                fontSize: '0.79rem',
                                fontWeight: 650,
                                color: theme.palette.text.secondary,
                                alignItems: 'center',
                                minWidth: 0,
                            },
                            '& .MuiTab-root.Mui-selected': {
                                color: theme.palette.text.primary,
                            },
                            '& .MuiTabs-indicator': {
                                height: 2,
                            },
                        }}
                    >
                        <Tab label="Folder Archives" />
                        <Tab label="Database Tables" />
                    </Tabs>
                </Box>
                )}
            </Paper>

            {loading && <LinearProgress sx={{ mb: 3, borderRadius: 999, height: 4 }} />}
            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {downloadState.error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setDownloadState({ path: null, error: '' })}>{downloadState.error}</Alert>}
            {packageError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setPackageError('')}>{packageError}</Alert>}

            {hasHubSearchQuery && <HubTraitSearchPanel query={hubSearchQuery} />}

            {/* Folder Archives Content Panel */}
            {!hasHubSearchQuery && tabValue === 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                        gap: 2.5,
                    }}>
                        {!loading && !hasFolders && (
                            <Paper sx={{ gridColumn: 'span 2', py: 6, textAlign: 'center', bgcolor: theme.palette.background.paper, border: `1px dashed ${theme.palette.divider}`, borderRadius: 1.5 }}>
                                <FolderOpen sx={{ fontSize: 36, color: theme.palette.text.disabled, mb: 1 }} />
                                <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.85rem' }}>No folder archives available.</Typography>
                            </Paper>
                        )}
                        {payload.data.map((folder) => {
                            const downloadReady = Boolean(folder.download?.available);
                            const isDownloading = downloadState.path === folder.path;
                            return (
                                <Paper
                                    key={folder.path}
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        borderRadius: 1.5,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                                        <Box sx={resourceIconSx(theme.palette.primary.main)}>
                                            <Folder sx={{ fontSize: 18 }} />
                                        </Box>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {folder.name}
                                            </Typography>
                                            {folder.archive?.exists && folder.archive?.size ? (
                                                <Tooltip title={getArchiveTooltip(folder.archive)} arrow>
                                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'inline-block', mt: 0.3, fontSize: '0.72rem', cursor: 'help' }}>
                                                        {fmtSize(folder.archive.size)}
                                                    </Typography>
                                                </Tooltip>
                                            ) : null}
                                        </Box>
                                    </Box>

                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={isDownloading || !downloadReady}
                                        onClick={() => { void downloadFolder(folder); }}
                                        sx={{
                                            textTransform: 'none',
                                            boxShadow: 'none',
                                            borderRadius: 1,
                                            px: 1.8,
                                            py: 0.5,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            '&:hover': {
                                                boxShadow: 'none',
                                                bgcolor: theme.palette.primary.dark,
                                            }
                                        }}
                                    >
                                        {isDownloading ? (
                                            'Downloading...'
                                        ) : (
                                            <>
                                                <Download sx={{ fontSize: 13, mr: 0.4 }} />
                                                Download
                                            </>
                                        )}
                                    </Button>
                                </Paper>
                            );
                        })}
                    </Box>
                    {payload.totalPages > 1 && (
                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                            <Pagination count={payload.totalPages} page={page} onChange={(_, value) => setPage(value)} size="small" />
                        </Box>
                    )}
                </Box>
            )}

            {/* Database Tables Content Panel */}
            {!hasHubSearchQuery && tabValue === 1 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {packageLoading && <LinearProgress sx={{ height: 3, borderRadius: 999, mb: 1 }} />}

                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                        gap: 2.5,
                    }}>
                        {!packageLoading && packagePayload.data.length === 0 && (
                            <Paper sx={{ gridColumn: 'span 2', py: 6, textAlign: 'center', bgcolor: theme.palette.background.paper, border: `1px dashed ${theme.palette.divider}`, borderRadius: 1.5 }}>
                                <Storage sx={{ fontSize: 36, color: theme.palette.text.disabled, mb: 1 }} />
                                <Typography sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.85rem' }}>Database export not prepared.</Typography>
                            </Paper>
                        )}
                        {packagePayload.data.map((item) => {
                            const archiveReady = Boolean(item.archive?.exists);
                            const isDownloading = packageDownloadId === item.id;
                            return (
                                <Paper
                                    key={item.id}
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        borderRadius: 1.5,
                                        border: `1px solid ${theme.palette.divider}`,
                                        bgcolor: theme.palette.background.paper,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 2,
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            borderColor: theme.palette.secondary.main,
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                                        <Box
                                            sx={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 1,
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: theme.palette.secondary.main,
                                                bgcolor: alpha(theme.palette.secondary.main, 0.06),
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Storage sx={{ fontSize: 18 }} />
                                        </Box>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.title}
                                            </Typography>
                                            {archiveReady && item.archive?.size && (
                                                <Tooltip title={getArchiveTooltip(item.archive)} arrow>
                                                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'inline-block', mt: 0.3, fontSize: '0.72rem', cursor: 'help' }}>
                                                        {fmtSize(item.archive.size)}
                                                    </Typography>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </Box>

                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="secondary"
                                        disabled={isDownloading || !archiveReady}
                                        onClick={() => { void downloadPackage(item.id); }}
                                        sx={{
                                            textTransform: 'none',
                                            boxShadow: 'none',
                                            borderRadius: 1,
                                            px: 1.5,
                                            py: 0.4,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            '&:hover': {
                                                boxShadow: 'none',
                                                bgcolor: theme.palette.secondary.dark,
                                            }
                                        }}
                                    >
                                        {isDownloading ? (
                                            'Downloading...'
                                        ) : (
                                            <>
                                                <Download sx={{ fontSize: 13, mr: 0.4 }} />
                                                Download
                                            </>
                                        )}
                                    </Button>
                                </Paper>
                            );
                        })}
                    </Box>
                </Box>
            )}

        </Box>
    );
}

