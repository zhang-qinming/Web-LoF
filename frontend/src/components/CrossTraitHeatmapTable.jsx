import React, { useMemo } from 'react';
import {
    Box,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { DownloadOutlined } from '@mui/icons-material';
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

export default function CrossTraitHeatmapTable({ payload, fileId }) {
    const theme = useTheme();
    const navigate = useNavigate();
    const targets = payload?.targets || [];
    const genes = payload?.genes || [];
    const maxAbs = useMemo(() => Math.max(
        Math.abs(Number(payload?.summary?.valueRange?.min) || 0),
        Math.abs(Number(payload?.summary?.valueRange?.max) || 0),
        0.0001,
    ), [payload?.summary?.valueRange?.max, payload?.summary?.valueRange?.min]);
    const neutralTone = tableTone(theme, 'neutral');
    const effectTone = tableTone(theme, 'primary');

    if (!targets.length || !genes.length) return null;

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
                        minWidth: 300 + (targets.length * 132),
                    })}
                >
                    <colgroup>
                        <col style={{ width: 130 }} />
                        <col style={{ width: 170 }} />
                        {targets.map((target) => <col key={target.file_id} style={{ width: 132 }} />)}
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell
                                sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', {
                                    left: 0,
                                    zIndex: '44 !important',
                                })}
                            >
                                Gene
                            </TableCell>
                            <TableCell
                                sx={stickyTableHeaderCellSx(theme, neutralTone, 'left', {
                                    left: 130,
                                    zIndex: '44 !important',
                                })}
                            >
                                ENSG
                            </TableCell>
                            {targets.map((target) => (
                                <TableCell
                                    key={target.file_id}
                                    align="right"
                                    onClick={() => navigate(`/trait/${encodeURIComponent(target.file_id)}`)}
                                    sx={stickyTableHeaderCellSx(theme, effectTone, 'right', {
                                        cursor: 'pointer',
                                        whiteSpace: 'normal',
                                        lineHeight: 1.2,
                                        py: 0.8,
                                    })}
                                >
                                    <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, lineHeight: 1.2 }}>
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
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 2,
                                    py: 0.72,
                                    bgcolor: theme.palette.background.paper,
                                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                                    fontSize: '0.74rem',
                                    fontWeight: 680,
                                }}>
                                    {gene.gene || gene.ensg}
                                </TableCell>
                                <TableCell sx={{
                                    position: 'sticky',
                                    left: 130,
                                    zIndex: 2,
                                    py: 0.72,
                                    bgcolor: theme.palette.background.paper,
                                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                                    fontSize: '0.68rem',
                                    color: theme.palette.text.secondary,
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
