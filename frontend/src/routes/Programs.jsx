import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import axios from 'axios';
import GeneRegulation from '../components/GeneRegulation';

export default function Programs() {
    const { programId } = useParams();
    const [programs, setPrograms] = useState([]);
    const [selected, setSelected] = useState(programId || '');

    useEffect(() => {
        axios.get('/api/regulation/list')
            .then(res => {
                const list = res.data.programs || [];
                setPrograms(list);
            })
            .catch(console.error);
    }, []);

    // 数据就绪后同步选中项：URL param 优先，否则选第一个
    useEffect(() => {
        if (programs.length === 0) return;
        if (programId && programs.some(p => p.id === programId)) {
            setSelected(programId);
        } else if (!programId) {
            setSelected(programs[0].id);
        }
    }, [programId, programs]);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 1, fontWeight: 600, color: '#333' }}>
                Program Gene Regulation
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Volcano plot of gene-level perturbation effects (lm_es vs −log₁₀ P) for each cNMF program.
                Click a point to jump to its row in the table below.
            </Typography>
            <GeneRegulation programId={selected} programs={programs} onProgramChange={setSelected} />
        </Box>
    );
}
