import { Box, Typography } from '@mui/material';
import ManhattanPlot from '../components/ManhattanPlot.jsx';

const sampleData = [
    { CHR: '1', BP: 12345006, SNP: 'rs1', P: 2e-6 },
    { CHR: '1', BP: 22345006, SNP: 'rs2', P: 1e-8 },
    { CHR: '2', BP: 24895642, SNP: 'rs3', P: 0.0002 },
    { CHR: '22', BP: 28871830, SNP: 'rs3', P: 0.0002 },
    { CHR: 'X', BP: 29410015, SNP: 'rsX1', P: 1e-7 },
];

export default function Genes() {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4" gutterBottom>Genes</Typography>
            <ManhattanPlot
                data={sampleData}
                genomewideP={5e-8}
                suggestiveP={1e-5}
                height={520}
                width="100%"
                markerSize={7}
                onPointClick={(row) => console.log('clicked point:', row)}
            />
        </Box>
    );
}
