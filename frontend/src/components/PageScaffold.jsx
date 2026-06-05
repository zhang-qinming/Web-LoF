import React from 'react';
import { Alert, Box, CircularProgress, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { InfoOutlined } from '@mui/icons-material';
import { captionSx, fadeUpKeyframes, panelSx, sectionTitleSx } from '../themeUtils';

export function PageFrame({
    title,
    subtitle,
    actions,
    children,
    maxWidth = 1200,
    compact = false,
    sx,
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth,
                mx: 'auto',
                px: { xs: 2, md: 3 },
                py: compact ? { xs: 2, md: 3 } : { xs: 3, md: 4 },
                ...fadeUpKeyframes(),
                animation: `appFadeUp ${theme.custom.motion.smooth} both`,
                ...sx,
            }}
        >
            {(title || subtitle || actions) && (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', md: 'center' },
                        justifyContent: 'space-between',
                        gap: 2,
                        mb: 2.4,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        {title && (
                            <Typography variant="h4" sx={sectionTitleSx(theme, { mb: subtitle ? 0.55 : 0 })}>
                                {title}
                            </Typography>
                        )}
                        {subtitle && (
                            <Typography variant="body1" sx={captionSx(theme, { maxWidth: 820 })}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {actions && (
                        <Box sx={{ width: { xs: '100%', sm: 'auto' }, maxWidth: '100%', flexShrink: 0 }}>
                            {actions}
                        </Box>
                    )}
                </Box>
            )}
            {children}
        </Box>
    );
}

export function StatePanel({
    severity = 'info',
    title,
    message,
    icon,
    loading = false,
    minHeight = 260,
    framed = true,
    sx,
}) {
    const theme = useTheme();
    const tone = severity === 'error'
        ? theme.palette.error.main
        : severity === 'warning'
            ? theme.palette.warning.main
            : theme.palette.primary.main;
    const Icon = icon || InfoOutlined;
    const content = (
        <Box
            sx={{
                minHeight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 3,
                py: 4,
                textAlign: 'center',
                ...sx,
            }}
        >
            <Box sx={{ maxWidth: 720 }}>
                {loading ? (
                    <CircularProgress size={42} thickness={4} />
                ) : (
                    <Box
                        sx={{
                            width: 46,
                            height: 46,
                            mx: 'auto',
                            mb: 1.4,
                            borderRadius: 1,
                            display: 'grid',
                            placeItems: 'center',
                            color: tone,
                            bgcolor: alpha(tone, 0.09),
                            border: `1px solid ${alpha(tone, 0.18)}`,
                        }}
                    >
                        <Icon sx={{ fontSize: 22 }} />
                    </Box>
                )}
                {title && (
                    <Typography variant="subtitle1" sx={{ mt: loading ? 1.4 : 0, fontWeight: 750, color: theme.palette.text.primary }}>
                        {title}
                    </Typography>
                )}
                {message && (
                    <Typography variant="body2" sx={captionSx(theme, { mt: 0.6, mb: 0 })}>
                        {message}
                    </Typography>
                )}
            </Box>
        </Box>
    );

    if (!framed) return content;
    if (severity === 'error') {
        return (
            <Alert severity="error" sx={{ borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
                {message && <Typography variant="body2">{message}</Typography>}
            </Alert>
        );
    }

    return (
        <Paper elevation={0} sx={panelSx(theme, { overflow: 'hidden' })}>
            {content}
        </Paper>
    );
}
