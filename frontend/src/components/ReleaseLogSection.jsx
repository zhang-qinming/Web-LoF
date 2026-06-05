import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { releaseEntries as defaultReleaseEntries } from './releaseLogData';

export default function ReleaseLogSection({
    action = null,
    anchorId,
    eyebrow = 'Release',
    entries = defaultReleaseEntries,
    heading = 'A curated build log since May 7, 2026',
    limit,
    newestFirst = false,
    outerSx = {},
    showDetails,
    showNotes = true,
    subtitle = 'Notes are written for humans rather than copied line-for-line from git, but the milestones still follow the arc of the project.',
}) {
    const theme = useTheme();
    const accent = '#ff6b4a';
    const shouldShowDetails = showDetails ?? showNotes;
    const resolvedEntries = React.useMemo(() => {
        const orderedEntries = newestFirst ? [...entries].reverse() : entries;
        return limit ? orderedEntries.slice(0, limit) : orderedEntries;
    }, [entries, limit, newestFirst]);

    return (
        <Box
            component="section"
            id={anchorId}
            aria-labelledby={anchorId ? `${anchorId}-heading` : 'release-log-heading'}
            sx={[
                {
                    scrollMarginTop: { xs: 84, md: 96 },
                },
                outerSx,
            ]}
        >
            <Box
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(accent, 0.12)}`,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
                    boxShadow: '0 18px 44px rgba(15,23,42,0.06)',
                }}
            >
                <Box
                    aria-hidden="true"
                    sx={{
                        position: 'absolute',
                        right: '-10%',
                        bottom: '-28%',
                        width: { xs: 220, md: 320 },
                        height: { xs: 220, md: 320 },
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(255,107,74,0.18) 0%, rgba(255,107,74,0) 72%)',
                        pointerEvents: 'none',
                    }}
                />
                <Stack
                    spacing={0.8}
                    sx={{
                        position: 'relative',
                        px: { xs: 2, md: 3 },
                        pt: { xs: 2.8, md: 3.4 },
                        pb: { xs: 1.3, md: 1.7 },
                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.4}
                        alignItems={{ xs: 'flex-start', md: 'flex-end' }}
                        justifyContent="space-between"
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ color: accent, fontSize: '0.76rem', fontWeight: 850, letterSpacing: '0.16em', textTransform: 'none' }}>
                                {eyebrow}
                            </Typography>
                            <Typography
                                id={anchorId ? `${anchorId}-heading` : 'release-log-heading'}
                                component="h2"
                                sx={{
                                    mt: 0.3,
                                    color: '#111827',
                                    fontFamily: 'Georgia, Cambria, serif',
                                    fontSize: { xs: '1.85rem', md: '2.3rem' },
                                    fontWeight: 850,
                                    lineHeight: 1.08,
                                }}
                            >
                                {heading}
                            </Typography>
                            <Typography sx={{ mt: 0.6, maxWidth: 760, color: '#64748b', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.72 }}>
                                {subtitle}
                            </Typography>
                        </Box>
                        {action ? (
                            <Box sx={{ flex: '0 0 auto' }}>
                                {action}
                            </Box>
                        ) : null}
                    </Stack>
                </Stack>
                <Box
                    sx={{
                        position: 'relative',
                        px: { xs: 2, md: 3 },
                        py: { xs: 2.4, md: 3.2 },
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 24,
                            bottom: 24,
                            left: { xs: 19, md: 177 },
                            width: '1px',
                            background: `linear-gradient(180deg, ${alpha(accent, 0.22)}, ${alpha('#94a3b8', 0.18)})`,
                        },
                    }}
                >
                    {resolvedEntries.map((entry) => {
                        const Icon = entry.icon;

                        return (
                            <Box
                                key={`${entry.date}-${entry.title}`}
                                sx={{
                                    position: 'relative',
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '154px minmax(0, 1fr)' },
                                    gap: { xs: 1.2, md: 2.4 },
                                    pl: { xs: 4.2, md: 0 },
                                    '&:not(:last-of-type)': {
                                        pb: { xs: 2.2, md: 2.6 },
                                    },
                                }}
                            >
                                <Box sx={{ pr: { md: 2.4 }, pt: { md: 0.55 } }}>
                                    <Typography sx={{ color: '#111827', fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                                        {entry.date}
                                    </Typography>
                                    <Typography sx={{ mt: 0.45, color: entry.color, fontSize: '0.73rem', fontWeight: 850, letterSpacing: '0.14em', textTransform: 'none' }}>
                                        {entry.label}
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        position: 'relative',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            left: { xs: -32, md: -29 },
                                            top: 20,
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            bgcolor: entry.color,
                                            boxShadow: `0 0 0 6px ${alpha(entry.color, 0.12)}`,
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            px: { xs: 1.5, md: 1.7 },
                                            py: { xs: 1.4, md: 1.55 },
                                            borderRadius: 1.2,
                                            border: `1px solid ${alpha(entry.color, 0.14)}`,
                                            bgcolor: 'rgba(255,255,255,0.88)',
                                            boxShadow: '0 12px 28px rgba(15,23,42,0.045)',
                                        }}
                                    >
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.7 }}>
                                            <Box
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 1,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    color: entry.color,
                                                    bgcolor: alpha(entry.color, 0.08),
                                                    flex: '0 0 auto',
                                                }}
                                                aria-hidden="true"
                                            >
                                                <Icon sx={{ fontSize: 18 }} />
                                            </Box>
                                            <Typography
                                                component="h3"
                                                sx={{
                                                    color: '#111827',
                                                    fontFamily: 'Georgia, Cambria, serif',
                                                    fontSize: { xs: '1.12rem', md: '1.24rem' },
                                                    fontWeight: 850,
                                                    lineHeight: 1.1,
                                                }}
                                            >
                                                {entry.title}
                                            </Typography>
                                        </Stack>
                                        <Typography sx={{ color: '#475569', fontSize: '0.9rem', lineHeight: 1.68 }}>
                                            {entry.summary}
                                        </Typography>
                                        {shouldShowDetails && entry.highlights?.length ? (
                                            <Box
                                                component="ul"
                                                sx={{
                                                    mt: 1.05,
                                                    mb: 0,
                                                    pl: 2.15,
                                                    display: 'grid',
                                                    gap: 0.55,
                                                    color: '#475569',
                                                    '& li::marker': {
                                                        color: alpha(entry.color, 0.84),
                                                    },
                                                }}
                                            >
                                                {entry.highlights.map((highlight) => (
                                                    <Typography
                                                        key={`${entry.date}-${highlight}`}
                                                        component="li"
                                                        sx={{
                                                            color: '#475569',
                                                            fontSize: '0.82rem',
                                                            lineHeight: 1.62,
                                                            pr: { md: 1 },
                                                        }}
                                                    >
                                                        {highlight}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        ) : null}
                                        {showNotes ? (
                                            <Typography sx={{ mt: 0.9, color: '#64748b', fontSize: '0.78rem', lineHeight: 1.55 }}>
                                                {entry.note}
                                            </Typography>
                                        ) : null}
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}
