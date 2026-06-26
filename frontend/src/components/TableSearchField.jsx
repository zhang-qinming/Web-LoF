import { useEffect, useRef, useState } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import Clear from '@mui/icons-material/Clear';
import Search from '@mui/icons-material/Search';

export default function TableSearchField({
    value,
    onChange,
    onClear,
    onSubmit,
    placeholder = 'Search table',
    label = 'Search',
    showLabel = false,
    error = false,
    helperText,
    width = { xs: '100%', sm: 260 },
    debounceMs = 350,
}) {
    const theme = useTheme();
    const [draftValue, setDraftValue] = useState(value || '');
    const debounceRef = useRef(null);
    const hasValue = Boolean(String(draftValue || '').trim());

    useEffect(() => {
        setDraftValue(value || '');
    }, [value]);

    useEffect(() => () => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
    }, []);

    const commitChange = (nextValue, immediate = false) => {
        if (debounceRef.current) window.clearTimeout(debounceRef.current);
        if (immediate || debounceMs <= 0) {
            onChange(nextValue);
            return;
        }
        debounceRef.current = window.setTimeout(() => {
            onChange(nextValue);
        }, debounceMs);
    };

    const handleClear = () => {
        setDraftValue('');
        if (onClear) {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
            onClear();
            return;
        }
        commitChange('', true);
    };

    return (
        <TextField
            size="small"
            value={draftValue}
            placeholder={placeholder}
            label={showLabel ? label : undefined}
            error={error}
            helperText={helperText}
            onChange={(event) => {
                const nextValue = event.target.value;
                setDraftValue(nextValue);
                commitChange(nextValue);
            }}
            InputLabelProps={showLabel ? { shrink: true } : undefined}
            FormHelperTextProps={{
                sx: {
                    display: helperText ? 'block' : 'none',
                    minHeight: 0,
                },
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && onSubmit) {
                    event.preventDefault();
                    commitChange(draftValue, true);
                    onSubmit();
                }
            }}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.35 }}>
                        <Search sx={{ fontSize: 17, color: error ? theme.palette.error.main : theme.palette.text.secondary }} />
                    </InputAdornment>
                ),
                endAdornment: hasValue ? (
                    <InputAdornment position="end">
                        <Tooltip title="Clear search" arrow>
                            <IconButton
                                size="small"
                                aria-label="Clear search"
                                onClick={handleClear}
                                sx={{
                                    width: 24,
                                    height: 24,
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                        color: theme.palette.text.primary,
                                        bgcolor: alpha(theme.palette.text.primary, 0.07),
                                    },
                                }}
                            >
                                <Clear sx={{ fontSize: 15 }} />
                            </IconButton>
                        </Tooltip>
                    </InputAdornment>
                ) : null,
            }}
            inputProps={{
                'aria-label': label,
            }}
            sx={{
                width,
                minWidth: { xs: 0, sm: 230 },
                flexShrink: 0,
                '& .MuiInputLabel-root': {
                    fontSize: '0.7rem',
                    fontWeight: 680,
                    color: error ? theme.palette.error.main : theme.palette.text.secondary,
                    transform: 'translate(13px, -7px) scale(0.78)',
                    bgcolor: theme.palette.background.paper,
                    px: 0.45,
                    lineHeight: 1.2,
                },
                '& .MuiOutlinedInput-root': {
                    height: 36,
                    borderRadius: 1.4,
                    bgcolor: error ? alpha(theme.palette.error.main, 0.04) : alpha(theme.palette.background.paper, 0.98),
                    backgroundImage: error
                        ? 'none'
                        : `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.custom.surface.subtle, 0.94)} 100%)`,
                    boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.84)}, 0 10px 22px -20px ${alpha('#0f172a', 0.22)}`,
                    transition: `border-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}`,
                    '& fieldset': {
                        borderColor: error ? alpha(theme.palette.error.main, 0.45) : alpha(theme.palette.primary.main, 0.12),
                    },
                    '&:hover fieldset': {
                        borderColor: error ? theme.palette.error.main : alpha(theme.palette.primary.main, 0.3),
                    },
                    '&.Mui-focused': {
                        bgcolor: theme.palette.background.paper,
                        backgroundImage: 'none',
                        boxShadow: `0 0 0 3px ${alpha(error ? theme.palette.error.main : theme.palette.primary.main, 0.1)}, 0 12px 24px -18px ${alpha('#0f172a', 0.2)}`,
                    },
                    '&.Mui-focused fieldset': {
                        borderColor: error ? theme.palette.error.main : alpha(theme.palette.primary.main, 0.72),
                        borderWidth: 1,
                    },
                },
                '& .MuiOutlinedInput-input': {
                    fontSize: '0.74rem',
                    py: 0.72,
                    color: theme.palette.text.primary,
                    '&::placeholder': {
                        color: theme.palette.text.secondary,
                        opacity: 0.72,
                    },
                },
                '& .MuiFormHelperText-root': {
                    mt: 0.5,
                    mx: 0.4,
                    fontSize: '0.68rem',
                    lineHeight: 1.25,
                },
            }}
        />
    );
}
