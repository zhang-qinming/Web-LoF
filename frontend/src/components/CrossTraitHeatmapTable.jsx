import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import Download from '@mui/icons-material/Download';
import {
    panelSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableHeaderCellSx,
    stickyTableSx,
    tableToolbarActionButtonSx,
    tableToolbarGroupSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';
import { downloadBlob } from '../utils/download';
import { compareValues, nextSortDirection } from '../utils/sort';

function formatEffect(value) {
    if (!Number.isFinite(value)) return '-';
    return `${value > 0 ? '+' : ''}${value.toFixed(4)}`;
}

function escapeCsvValue(value) {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildMatrixCsv(payload) {
    const targets = payload?.targets || [];
    const header = ['Gene', 'ENSG', ...targets.map((target) => target.trait_name || target.file_id)];
    const rows = (payload?.genes || []).map((gene, rowIndex) => [
        gene.gene || '',
        gene.ensg || '',
        ...targets.map((_, colIndex) => payload?.matrix?.[rowIndex]?.[colIndex] ?? ''),
    ]);
    return `${[header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')}\n`;
}

function effectCellColor(theme, value, maxAbs) {
    if (!Number.isFinite(value) || !maxAbs) return theme.palette.background.paper;
    const strength = Math.min(0.24, 0.04 + ((Math.abs(value) / maxAbs) * 0.2));
    return alpha(value >= 0 ? '#c45f3c' : '#3f78a8', strength);
}

const GENE_COL_WIDTH = 150;
const ENSG_COL_WIDTH = 176;
const TRAIT_COL_WIDTH = 196;
const FROZEN_COL_WIDTH = GENE_COL_WIDTH + ENSG_COL_WIDTH;
const EMPTY_ITEMS = [];
const sortLabelSx = {
    display: 'inline-flex',
    justifyContent: 'center',
    width: '100%',
    fontSize: 'inherit',
    '& .MuiTableSortLabel-icon': {
        fontSize: '0.82rem',
        margin: 0,
    },
};

export default function CrossTraitHeatmapTable({ payload, fileId }) {
    const theme = useTheme();
    const targets = payload?.targets || EMPTY_ITEMS;
    const genes = payload?.genes || EMPTY_ITEMS;
    const cellCount = targets.length * genes.length;
    const largeMatrix = cellCount > 2500;
    const [forceRenderTable, setForceRenderTable] = useState(false);
    const [sortBy, setSortBy] = useState('gene');
    const [sortDir, setSortDir] = useState('asc');
    const maxAbs = useMemo(() => Math.max(
        Math.abs(Number(payload?.summary?.valueRange?.min) || 0),
        Math.abs(Number(payload?.summary?.valueRange?.max) || 0),
        0.0001,
    ), [payload?.summary?.valueRange?.max, payload?.summary?.valueRange?.min]);
    const geneTone = tableTone(theme, 'primary');
    const traitTone = tableTone(theme, 'primary');

    useEffect(() => {
        setForceRenderTable(false);
    }, [payload]);

    const sortedGeneRows = useMemo(() => {
        const rows = genes.map((gene, index) => ({ gene, originalIndex: index }));
        return rows.sort((a, b) => {
            if (sortBy === 'gene') {
                return compareValues(a.gene?.gene, b.gene?.gene, 'text', sortDir)
                    || compareValues(a.gene?.ensg, b.gene?.ensg, 'text', 'asc');
            }
            if (sortBy === 'ensg') {
                return compareValues(a.gene?.ensg, b.gene?.ensg, 'text', sortDir)
                    || compareValues(a.gene?.gene, b.gene?.gene, 'text', 'asc');
            }
            if (sortBy.startsWith('target:')) {
                const columnIndex = Number(sortBy.slice('target:'.length));
                return compareValues(
                    payload?.matrix?.[a.originalIndex]?.[columnIndex],
                    payload?.matrix?.[b.originalIndex]?.[columnIndex],
                    'number',
                    sortDir,
                ) || compareValues(a.gene?.gene, b.gene?.gene, 'text', 'asc');
            }
            return 0;
        });
    }, [genes, payload?.matrix, sortBy, sortDir]);

    const handleSort = (key, defaultDirection = 'asc') => {
        setSortDir((current) => nextSortDirection(sortBy, key, current, defaultDirection));
        setSortBy(key);
    };

    if (!targets.length || !genes.length) return null;

    if (largeMatrix && !forceRenderTable) {
        return (
            <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
                <Box sx={{
                    px: 1.75,
                    py: 1.15,
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    justifyContent: 'space-between',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1,
                    backgroundColor: theme.custom.surface.raised,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}>
                    <Box>
                        <Typography sx={sectionTitleSx(theme, { fontSize: '0.9rem' })}>
                            Cross-trait gene effect matrix
                        </Typography>
                        <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem', mt: 0.2 }}>
                            {genes.length.toLocaleString()} genes x {targets.length.toLocaleString()} traits ({cellCount.toLocaleString()} cells). The table is deferred so the plot stays responsive.
                        </Typography>
                    </Box>
                    <Box sx={tableToolbarGroupSx(theme)}>
                        <Tooltip title="Download the displayed matrix as CSV">
                            <Button
                                size="small"
                                startIcon={<Download />}
                                onClick={() => downloadBlob(
                                    new Blob([buildMatrixCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                                    `${fileId || 'trait'}-cross-trait-gene-effects.csv`,
                                )}
                                sx={tableToolbarActionButtonSx(theme)}
                            >
                                Export CSV
                            </Button>
                        </Tooltip>
                        <Button
                            size="small"
                            onClick={() => setForceRenderTable(true)}
                            sx={tableToolbarActionButtonSx(theme, 'neutral')}
                        >
                            Render table
                        </Button>
                    </Box>
                </Box>
            </Paper>
        );
    }

    return (
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
                        Cross-trait gene effect matrix
                    </Typography>
                </Box>
                <Box sx={tableToolbarGroupSx(theme)}>
                    <Tooltip title="Download the displayed matrix as CSV">
                        <Button
                            size="small"
                            startIcon={<Download />}
                            onClick={() => downloadBlob(
                                new Blob([buildMatrixCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                                `${fileId || 'trait'}-cross-trait-gene-effects.csv`,
                            )}
                            sx={tableToolbarActionButtonSx(theme)}
                        >
                            Export CSV
                        </Button>
                    </Tooltip>
                </Box>
            </Box>

            <TableContainer sx={stickyTableContainerSx(theme, { overflowX: 'auto', overflowY: 'visible' })}>
                <Table
                    stickyHeader
                    size="small"
                    sx={stickyTableSx(theme, {
                        tableLayout: 'fixed',
                        minWidth: FROZEN_COL_WIDTH + (targets.length * TRAIT_COL_WIDTH),
                    })}
                >
                    <colgroup>
                        <col style={{ width: GENE_COL_WIDTH }} />
                        <col style={{ width: ENSG_COL_WIDTH }} />
                        {targets.map((target) => <col key={target.file_id} style={{ width: TRAIT_COL_WIDTH }} />)}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell
                                align="center"
                                sx={stickyTableHeaderCellSx(theme, geneTone, 'center', {
                                    left: 0,
                                    zIndex: '46 !important',
                                    minWidth: GENE_COL_WIDTH,
                                })}
                            >
                                <TableSortLabel
                                    active={sortBy === 'gene'}
                                    direction={sortBy === 'gene' ? sortDir : 'asc'}
                                    onClick={() => handleSort('gene', 'asc')}
                                    sx={sortLabelSx}
                                >
                                    Gene
                                </TableSortLabel>
                            </TableCell>
                            <TableCell
                                align="center"
                                sx={stickyTableHeaderCellSx(theme, geneTone, 'center', {
                                    left: GENE_COL_WIDTH,
                                    zIndex: '47 !important',
                                    minWidth: ENSG_COL_WIDTH,
                                    boxShadow: `8px 0 12px -12px ${alpha(theme.palette.common.black, 0.42)}, 0 2px 0 ${theme.custom.surface.base}, inset 0 -1px 0 ${geneTone.headerBorder}`,
                                })}
                            >
                                <TableSortLabel
                                    active={sortBy === 'ensg'}
                                    direction={sortBy === 'ensg' ? sortDir : 'asc'}
                                    onClick={() => handleSort('ensg', 'asc')}
                                    sx={sortLabelSx}
                                >
                                    ENSG
                                </TableSortLabel>
                            </TableCell>
                             {targets.map((target, colIndex) => (
                                  <TableCell
                                      key={target.file_id}
                                      align="center"
                                      sx={stickyTableHeaderCellSx(theme, traitTone, 'center', {
                                          whiteSpace: 'normal',
                                          wordBreak: 'break-word',
                                         overflowWrap: 'anywhere',
                                         overflow: 'visible',
                                         textOverflow: 'clip',
                                         lineHeight: 1.18,
                                         py: 0.9,
                                         px: 1,
                                         verticalAlign: 'top',
                                      })}
                                  >
                                      <TableSortLabel
                                          active={sortBy === `target:${colIndex}`}
                                          direction={sortBy === `target:${colIndex}` ? sortDir : 'asc'}
                                          onClick={() => handleSort(`target:${colIndex}`, 'desc')}
                                          sx={{ ...sortLabelSx, whiteSpace: 'normal', alignItems: 'flex-start' }}
                                      >
                                          <Box sx={{ minWidth: 0 }}>
                                              <Typography sx={{ fontSize: '0.68rem', fontWeight: 720, lineHeight: 1.18 }}>
                                                  {target.trait_name || target.file_id}
                                              </Typography>
                                              {(target.n_sig != null || (target.trait_name && target.file_id && target.trait_name !== target.file_id)) && (
                                                  <Typography sx={{ mt: 0.25, fontSize: '0.6rem', color: theme.palette.text.secondary, textAlign: 'center' }}>
                                                      {target.n_sig == null ? target.file_id : `${Number(target.n_sig).toLocaleString()} loci`}
                                                  </Typography>
                                              )}
                                          </Box>
                                      </TableSortLabel>
                                  </TableCell>
                              ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedGeneRows.map(({ gene, originalIndex }, rowIndex) => (
                            <TableRow key={`${gene.ensg || gene.gene}-${originalIndex}`} hover sx={tableRowRevealSx(theme, rowIndex)}>
                                <TableCell
                                    align="center"
                                    sx={{
                                        position: 'sticky !important',
                                        left: 0,
                                        zIndex: '4 !important',
                                        py: 0.72,
                                        bgcolor: `${geneTone.cellStrong} !important`,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        fontSize: '0.74rem',
                                        fontWeight: 680,
                                        whiteSpace: 'nowrap',
                                        minWidth: GENE_COL_WIDTH,
                                        textAlign: 'center',
                                    }}
                                >
                                    {gene.gene || '-'}
                                </TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        position: 'sticky !important',
                                        left: GENE_COL_WIDTH,
                                        zIndex: '5 !important',
                                        py: 0.72,
                                        bgcolor: `${geneTone.cellSoft} !important`,
                                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                                        fontSize: '0.68rem',
                                        color: theme.palette.text.secondary,
                                        whiteSpace: 'nowrap',
                                        fontVariantNumeric: 'tabular-nums',
                                        minWidth: ENSG_COL_WIDTH,
                                        boxShadow: `8px 0 12px -12px ${alpha(theme.palette.common.black, 0.32)}`,
                                        textAlign: 'center',
                                    }}
                                >
                                    {gene.ensg || '-'}
                                </TableCell>
                                {targets.map((target, colIndex) => {
                                    const value = payload?.matrix?.[originalIndex]?.[colIndex];
                                    return (
                                    <TableCell
                                        key={`${gene.ensg || gene.gene}-${target.file_id || colIndex}`}
                                        align="center"
                                        sx={{
                                            py: 0.72,
                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                            bgcolor: effectCellColor(theme, value, maxAbs),
                                            fontSize: '0.7rem',
                                            fontWeight: 650,
                                            fontVariantNumeric: 'tabular-nums',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {formatEffect(value)}
                                    </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
