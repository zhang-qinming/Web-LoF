import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

export default function FigureLoadingPanel({
    message = 'Rendering figure...',
    longMessage = 'This figure is taking longer than usual. Large TSV-backed views can need a few extra seconds.',
    minHeight = 360,
    size = 52,
}) {
    const theme = useTheme();
    const [longWait, setLongWait] = useState(false);

    useEffect(() => {
        setLongWait(false);
        const timer = window.setTimeout(() => setLongWait(true), 3500);
        return () => window.clearTimeout(timer);
    }, [message]);

    return (
        <Box
            sx={{
                minHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 3,
            }}
        >
            <Box sx={{ textAlign: 'center', maxWidth: 480 }}>
                <CircularProgress size={size} />
                <Typography variant="body2" sx={{ mt: 1.5, color: theme.palette.text.secondary }}>
                    {message}
                </Typography>
                {longWait && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: theme.palette.warning.main, lineHeight: 1.45 }}>
                        {longMessage}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}
