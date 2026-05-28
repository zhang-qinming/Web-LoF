import { alpha, createTheme } from '@mui/material/styles';

const baseShadow = '0 14px 30px rgba(15, 23, 42, 0.06)';
const panelBorder = '1px solid rgba(148, 163, 184, 0.2)';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#2563eb',
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#0f766e',
            light: '#2dd4bf',
            dark: '#115e59',
        },
        success: {
            main: '#15803d',
            light: '#4ade80',
            dark: '#166534',
        },
        warning: {
            main: '#b45309',
            light: '#f59e0b',
            dark: '#92400e',
        },
        error: {
            main: '#b91c1c',
        },
        background: {
            default: '#eef4fb',
            paper: '#ffffff',
        },
        text: {
            primary: '#0f172a',
            secondary: '#5b6472',
        },
        divider: 'rgba(148, 163, 184, 0.22)',
    },
    shape: {
        borderRadius: 6,
    },
    typography: {
        fontFamily: [
            'Inter',
            'Segoe UI',
            '-apple-system',
            'BlinkMacSystemFont',
            'Helvetica Neue',
            'Arial',
            'sans-serif',
        ].join(','),
        h4: {
            fontWeight: 750,
            letterSpacing: 0,
        },
        h5: {
            fontWeight: 720,
            letterSpacing: 0,
        },
        h6: {
            fontWeight: 680,
            letterSpacing: 0,
        },
        subtitle1: {
            fontWeight: 650,
        },
        button: {
            textTransform: 'none',
            fontWeight: 650,
            letterSpacing: 0,
        },
    },
    spacing: 8,
    custom: {
        appShell: {
            maxWidth: 1600,
            background: 'linear-gradient(180deg, #f6f9fd 0%, #eef4fb 100%)',
        },
        surface: {
            base: '#ffffff',
            raised: '#fbfdff',
            subtle: '#f8fafc',
            accent: '#eef4ff',
        },
        border: {
            soft: 'rgba(148, 163, 184, 0.18)',
            strong: 'rgba(148, 163, 184, 0.26)',
        },
        shadow: {
            panel: baseShadow,
            float: '0 18px 40px rgba(15, 23, 42, 0.1)',
            focus: '0 0 0 4px rgba(37, 99, 235, 0.12)',
        },
        chart: {
            positive: '#cc6f3c',
            negative: '#4f7da8',
            neutral: '#6f7d90',
            muted: '#98a2b3',
            program: '#d28b35',
            regulator: '#3f7fc0',
            overlap: '#2f8f69',
            highlight: '#0f172a',
            band: 'rgba(148, 163, 184, 0.08)',
            grid: 'rgba(15, 23, 42, 0.08)',
            axis: '#475569',
            axisSoft: '#94a3b8',
            legendBg: 'rgba(255, 255, 255, 0.9)',
            hoverBg: 'rgba(255, 255, 255, 0.98)',
            hoverBorder: 'rgba(148, 163, 184, 0.38)',
            threshold: '#b45309',
            significance: '#b91c1c',
            overlay: 'rgba(255, 255, 255, 0.72)',
        },
        motion: {
            swift: '180ms cubic-bezier(0.22, 1, 0.36, 1)',
            smooth: '260ms cubic-bezier(0.22, 1, 0.36, 1)',
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                ':root': {
                    colorScheme: 'light',
                },
                'html, body, #root': {
                    minHeight: '100%',
                },
                body: {
                    margin: 0,
                    background: 'linear-gradient(180deg, #f6f9fd 0%, #eef4fb 100%) fixed',
                    color: '#0f172a',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                },
                '*': {
                    boxSizing: 'border-box',
                },
                '*::-webkit-scrollbar': {
                    width: 8,
                    height: 8,
                },
                '*::-webkit-scrollbar-track': {
                    background: 'rgba(148, 163, 184, 0.08)',
                    borderRadius: 999,
                },
                '*::-webkit-scrollbar-thumb': {
                    background: 'rgba(100, 116, 139, 0.28)',
                    borderRadius: 999,
                },
                '*::-webkit-scrollbar-thumb:hover': {
                    background: 'rgba(100, 116, 139, 0.4)',
                },
                '@media (prefers-reduced-motion: reduce)': {
                    '*, *::before, *::after': {
                        animationDuration: '0.01ms !important',
                        animationIterationCount: '1 !important',
                        transitionDuration: '0.01ms !important',
                        scrollBehavior: 'auto !important',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
            defaultProps: {
                elevation: 0,
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    border: panelBorder,
                    boxShadow: baseShadow,
                    backgroundImage: 'none',
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    paddingInline: 14,
                    transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                },
                containedPrimary: {
                    boxShadow: `0 10px 18px ${alpha('#2563eb', 0.16)}`,
                    '&:hover': {
                        boxShadow: `0 14px 24px ${alpha('#2563eb', 0.22)}`,
                        transform: 'translateY(-1px)',
                    },
                },
                outlined: {
                    borderColor: 'rgba(148, 163, 184, 0.28)',
                    '&:hover': {
                        backgroundColor: 'rgba(37, 99, 235, 0.04)',
                        borderColor: 'rgba(37, 99, 235, 0.28)',
                    },
                },
                text: {
                    '&:hover': {
                        backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 999,
                    fontWeight: 600,
                },
                outlined: {
                    borderColor: 'rgba(148, 163, 184, 0.26)',
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                variant: 'outlined',
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    backgroundColor: '#ffffff',
                    transition: 'box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(100, 116, 139, 0.34)',
                    },
                    '&.Mui-focused': {
                        boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.12)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#2563eb',
                        borderWidth: 1,
                    },
                },
                notchedOutline: {
                    borderColor: 'rgba(148, 163, 184, 0.26)',
                },
                input: {
                    paddingBlock: 11,
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    height: 3,
                    borderRadius: '999px 999px 0 0',
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    minHeight: 40,
                    paddingInline: 14,
                    color: '#5b6472',
                    '&.Mui-selected': {
                        color: '#0f172a',
                        fontWeight: 700,
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottomColor: 'rgba(226, 232, 240, 0.88)',
                },
                head: {
                    fontWeight: 700,
                    color: '#475569',
                    backgroundColor: '#f8fafc',
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 6,
                    border: panelBorder,
                    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.14)',
                },
            },
        },
        MuiToggleButtonGroup: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    overflow: 'hidden',
                },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    color: '#5b6472',
                    '&.Mui-selected': {
                        backgroundColor: alpha('#2563eb', 0.08),
                        color: '#1d4ed8',
                        fontWeight: 700,
                    },
                },
            },
        },
    },
});

export default theme;
