import { Box, Alert, Typography } from '@mui/material';

export default function Genes() {
    return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
            <Typography variant="h4" gutterBottom>Genes</Typography>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
                Gene-level lookup is not wired to a production data endpoint yet. Use Trait or Programs to inspect gene annotations from loaded analysis files.
            </Alert>
        </Box>
    );
}
