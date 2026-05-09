import React, { useState, useEffect } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import axios from 'axios';
import ProgramScatter from '../components/ProgramScatter';

export default function Programs() {
    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState('');

    useEffect(() => {
        axios.get('/api/programs/list')
            .then(res => {
                setFiles(res.data.files || []);
                if (res.data.files?.length > 0) setSelected(res.data.files[0]);
            })
            .catch(console.error);
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Program Enrichment Scatter</Typography>

            <FormControl sx={{ minWidth: 300, mb: 3 }}>
                <InputLabel>Select File ID</InputLabel>
                <Select value={selected} onChange={e => setSelected(e.target.value)} label="Select File ID">
                    {files.map(f => (
                        <MenuItem key={f} value={f}>{f}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <ProgramScatter fileId={selected} />
        </Box>
    );
}
