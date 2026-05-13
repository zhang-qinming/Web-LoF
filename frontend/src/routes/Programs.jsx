import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TableSortLabel, Paper, Skeleton,
} from '@mui/material';
import useSWR from 'swr';
import { fetcher } from '../api/gwas';
import GeneRegulation from '../components/GeneRegulation';

const thSx = {
    bgcolor: '#f8f9fb', fontWeight: 700, fontSize: '0.75rem',
    color: '#666', borderBottom: '2px solid #e8eaed', py: 1, px: 1.5,
    textTransform: 'uppercase', letterSpacing: '0.03em', position: 'sticky', top: 0, zIndex: 1,
};

function numSort(a, b) {
    return (parseInt(String(a).replace(/\D/g, '')) || 0) - (parseInt(String(b).replace(/\D/g, '')) || 0);
}

export default function Programs() {
    const { programId } = useParams();
    const navigate = useNavigate();
    const { data: info, isLoading: loading } = useSWR('/api/programs/info', fetcher, {
        keepPreviousData: true, revalidateOnFocus: false, revalidateOnReconnect: false,
    });
    const [programs, setPrograms] = useState([]);
    const [sortBy, setSortBy] = useState('program');
    const [sortDir, setSortDir] = useState('asc');

    useEffect(() => {
        fetch('/api/regulation/list').then(r => r.json()).then(res => setPrograms(res.programs || [])).catch(() => {});
    }, []);

    const infoObj = info || {};
    const rows = useMemo(() => {
        const items = Object.entries(infoObj).map(([k, v]) => ({ key: k, ...v }));
        const dir = sortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            if (sortBy === 'program') return numSort(a.program, b.program) * dir;
            if (sortBy === 'go_enrichment_p') return ((parseFloat(a.go_enrichment_p) || 0) - (parseFloat(b.go_enrichment_p) || 0)) * dir;
            return String(a[sortBy] || '').localeCompare(String(b[sortBy] || '')) * dir;
        });
        return items;
    }, [infoObj, sortBy, sortDir]);

    const handleSort = (col) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir('asc'); }
    };

    if (programId) {
        const regId = programId.replace(/^P/i, '');
        return (
            <Box sx={{ p: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>Program {programId}</Typography>
                <GeneRegulation programId={regId} programs={programs}
                    onProgramChange={(id) => navigate(`/programs/P${id}`)} />
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
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5, flexShrink: 0 }}>
                Program Annotations
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexShrink: 0 }}>
                Biological annotations and gene sets for cNMF programs
            </Typography>

            <Paper elevation={0} sx={{
                border: '1px solid rgba(0,0,0,.06)', borderRadius: 2,
                overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
            }}>
                <TableContainer sx={{ flex: 1 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ ...thSx, width: 80 }}>
                                    <TableSortLabel active={sortBy === 'program'} direction={sortDir}
                                        onClick={() => handleSort('program')}>Program</TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ ...thSx }}>
                                    <TableSortLabel active={sortBy === 'curated_annotation'} direction={sortDir}
                                        onClick={() => handleSort('curated_annotation')}>Annotation</TableSortLabel>
                                </TableCell>
                                <TableCell sx={thSx}>Representative GO</TableCell>
                                <TableCell sx={{ ...thSx, width: 90 }}>
                                    <TableSortLabel active={sortBy === 'go_enrichment_p'} direction={sortDir}
                                        onClick={() => handleSort('go_enrichment_p')}>GO P</TableSortLabel>
                                </TableCell>
                                <TableCell sx={thSx}>Top Genes</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? skeleton : rows.map((r, i) => (
                                <TableRow key={r.program} hover
                                    sx={{
                                        '& td': { py: 0.6, px: 1.5, borderBottom: '1px solid #f3f4f6' },
                                        animation: `rowIn 0.28s ${i * 15}ms cubic-bezier(0.22,1,0.36,1) both`,
                                        '@keyframes rowIn': {
                                            from: { opacity: 0, transform: 'translateY(4px)' },
                                            to: { opacity: 1, transform: 'translateY(0)' },
                                        },
                                        willChange: 'opacity, transform',
                                    }}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem', color: '#2563eb', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                        onClick={() => navigate(`/programs/${r.program}`)}>
                                        {r.program}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
                                        {r.curated_annotation}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: '#555' }}>
                                        {r.representative_go}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: '#888', fontFamily: 'monospace' }}>
                                        {r.go_enrichment_p}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.78rem', color: '#666', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}
                                        title={r.top10_genes}>
                                        {r.top10_genes}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
