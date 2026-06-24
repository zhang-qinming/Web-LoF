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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { useNavigate } from 'react-router-dom';
import {
    panelSx,
    sectionTitleSx,
    stickyTableContainerSx,
    stickyTableHeaderCellSx,
    stickyTableSx,
    tableRowRevealSx,
    tableTone,
} from '../themeUtils';
import { downloadBlob } from '../utils/download';

function formatEffect(value) {
    if (!Number.isFinite(value)) return 'NA';
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
        ...(payload?.matrix?.[rowIndex] || []).map((value) => value ?? ''),
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

export default function CrossTraitHeatmapTable({ payload, fileId }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const targets = payload?.targets || [];
    const genes = payload?.genes || [];
    const cellCount = targets.length * genes.length;
    const largeMatrix = cellCount > 2500;
    const [forceRenderTable, setForceRenderTable] = useState(false);
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
                            {genes.length.toLocaleString()} genes × {targets.length.toLocaleString()} traits ({cellCount.toLocaleString()} cells). The table is deferred so the plot stays responsive.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Tooltip title="Download the displayed matrix as CSV">
                            <Button
                                size="small"
                                startIcon={<DownloadOutlined />}
                                onClick={() => downloadBlob(
                                    new Blob([buildMatrixCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                                    `${fileId || 'trait'}-cross-trait-gene-effects.csv`,
                                )}
                                sx={{ textTransform: 'none', color: theme.palette.text.secondary }}
                            >
                                CSV
                            </Button>
                        </Tooltip>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setForceRenderTable(true)}
                            sx={{ textTransform: 'none' }}
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
                    <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem', mt: 0.2 }}>
                        All {genes.length.toLocaleString()} displayed genes and {targets.length.toLocaleString()} traits.
                    </Typography>
                </Box>
                <Tooltip title="Download the displayed matrix as CSV">
                    <Button
                        size="small"
                        startIcon={<DownloadOutlined />}
                        onClick={() => downloadBlob(
                            new Blob([buildMatrixCsv(payload)], { type: 'text/csv;charset=utf-8;' }),
                            `${fileId || 'trait'}-cross-trait-gene-effects.csv`,
                        )}
                        sx={{ textTransform: 'none', color: theme.palette.text.secondary }}
                    >
                        CSV
                    </Button>
                </Tooltip>
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
                                sx={stickyTableHeaderCellSx(theme, geneTone, 'left', {
                                    left: 0,
                                    zIndex: '46 !important',
                                    minWidth: GENE_COL_WIDTH,
                                })}
                            >
                                Gene
                            </TableCell>
                            <TableCell
                                sx={stickyTableHeaderCellSx(theme, geneTone, 'left', {
                                    left: GENE_COL_WIDTH,
                                    zIndex: '47 !important',
                                    minWidth: ENSG_COL_WIDTH,
                                    boxShadow: `8px 0 12px -12px ${alpha(theme.palette.common.black, 0.42)}, 0 2px 0 ${theme.custom.surface.base}, inset 0 -1px 0 ${geneTone.headerBorder}`,
                                })}
                            >
                                ENSG
                            </TableCell>
                             {targets.map((target) => (
                                 <TableCell
                                     key={target.file_id}
                                     align="right"
                                     onClick={() => navigate(`/trait/${encodeURIComponent(target.file_id)}`)}
                                     sx={stickyTableHeaderCellSx(theme, traitTone, 'right', {
                                         cursor: 'pointer',
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
                                     <Typography sx={{ fontSize: '0.68rem', fontWeight: 720, lineHeight: 1.18 }}>
                                         {target.trait_name || target.file_id}
                                     </Typography>
                                     <Typography sx={{ mt: 0.25, fontSize: '0.6rem', color: theme.palette.text.secondary }}>
                                         {target.n_sig == null ? target.file_id : `${Number(target.n_sig).toLocaleString()} loci`}
                                     </Typography>
                                 </TableCell>
                             ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {genes.map((gene, rowIndex) => (
                            <TableRow key={`${gene.ensg || gene.gene}-${rowIndex}`} hover sx={tableRowRevealSx(theme, rowIndex)}>
                                <TableCell sx={{
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
                                }}>
                                    {gene.gene || gene.ensg}
                                </TableCell>
                                <TableCell sx={{
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
                                }}>
                                    {gene.ensg || '-'}
                                </TableCell>
                                {(payload?.matrix?.[rowIndex] || []).map((value, colIndex) => (
                                    <TableCell
                                        key={`${gene.ensg || gene.gene}-${targets[colIndex]?.file_id || colIndex}`}
                                        align="right"
                                        sx={{
                                            py: 0.72,
                                            borderBottom: `1px solid ${theme.custom.border.soft}`,
                                            bgcolor: effectCellColor(theme, value, maxAbs),
                                            fontSize: '0.7rem',
                                            fontWeight: 650,
                                            fontVariantNumeric: 'tabular-nums',
                                        }}
                                    >
                                        {formatEffect(value)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
