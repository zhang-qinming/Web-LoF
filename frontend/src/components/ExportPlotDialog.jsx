import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Download from '@mui/icons-material/Download';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { compactToggleGroupSx, controlFieldSx } from '../themeUtils';

export default function ExportPlotDialog({
    open,
    onClose,
    width,
    onWidthChange,
    height,
    onHeightChange,
    format,
    onFormatChange,
    onExport,
    title = 'Export Image',
}) {
    const theme = useTheme();
    const fieldSx = controlFieldSx(theme, {
        flex: 1,
        minWidth: 132,
        '& .MuiInputBase-input': {
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
        },
    });

    const handleExport = () => {
        onExport();
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    overflow: 'hidden',
                    borderRadius: 1,
                    border: `1px solid ${theme.custom.border.soft}`,
                    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.16)',
                },
            }}
        >
            <DialogTitle
                sx={{
                    px: 2.2,
                    py: 1.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: theme.custom.surface.raised,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
            >
                <Box
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                    }}
                >
                    <ImageOutlined sx={{ fontSize: 18 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.98rem', fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                        {title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, lineHeight: 1.35, mt: 0.15 }}>
                        Choose size and format for the current plot.
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ px: 2.2, py: 2 }}>
                <Box
                    sx={{
                        p: 1.4,
                        mb: 1.4,
                        borderRadius: 1,
                        border: `1px solid ${theme.custom.border.soft}`,
                        bgcolor: theme.custom.surface.subtle,
                    }}
                >
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 680, letterSpacing: 0, color: theme.palette.text.secondary, mb: 1 }}>
                        Dimensions
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                        <TextField
                            label="Width"
                            type="number"
                            size="small"
                            value={width}
                            onChange={(event) => onWidthChange(event.target.value)}
                            sx={fieldSx}
                        />
                        <TextField
                            label="Height"
                            type="number"
                            size="small"
                            value={height}
                            onChange={(event) => onHeightChange(event.target.value)}
                            sx={fieldSx}
                        />
                    </Stack>
                </Box>

                <Box
                    sx={{
                        p: 1.4,
                        borderRadius: 1,
                        border: `1px solid ${theme.custom.border.soft}`,
                        bgcolor: theme.palette.background.paper,
                    }}
                >
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 680, letterSpacing: 0, color: theme.palette.text.secondary, mb: 1 }}>
                        Format
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={format}
                        onChange={(_, value) => { if (value) onFormatChange(value); }}
                        sx={{
                            ...compactToggleGroupSx(theme),
                            width: '100%',
                            '& .MuiToggleButton-root': {
                                flex: 1,
                                py: 0.6,
                            },
                        }}
                    >
                        <ToggleButton value="svg">SVG</ToggleButton>
                        <ToggleButton value="png">PNG</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 2.2, py: 1.6, bgcolor: theme.custom.surface.raised, borderTop: `1px solid ${theme.custom.border.soft}` }}>
                <Button onClick={onClose} sx={{ color: theme.palette.text.secondary }}>
                    Cancel
                </Button>
                <Button variant="contained" startIcon={<Download />} onClick={handleExport}>
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
}
