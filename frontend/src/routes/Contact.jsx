import { Box, Typography } from '@mui/material';

export default function Contact() {
    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', py: 4 }}>
            <Typography variant="h4" gutterBottom>Contact</Typography>
            <Typography variant="body1" color="text.secondary">
                如有问题或建议，请联系项目维护者。
            </Typography>
        </Box>
    );
}
