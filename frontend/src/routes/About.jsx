import { Box, Typography } from '@mui/material';

export default function About() {
    return (
        <Box sx={{ maxWidth: 760, mx: 'auto', py: 4 }}>
            <Typography variant="h4" gutterBottom>About</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                GWAS Data Browser provides trait-level association browsing, program enrichment views, and downloadable analysis outputs for the project data bundle.
            </Typography>
        </Box>
    );
}
