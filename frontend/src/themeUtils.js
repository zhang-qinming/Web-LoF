import { alpha } from '@mui/material/styles';

const RECT_RADIUS = 1;

function normalizeRectRadius(value) {
    if (value === 0 || value === '0' || value === '0px') {
        return 0;
    }
    return RECT_RADIUS;
}

export function panelSx(theme, overrides = {}) {
    const { borderRadius, ...rest } = overrides;
    return {
        border: `1px solid ${theme.custom.border.soft}`,
        borderRadius: normalizeRectRadius(borderRadius),
        backgroundColor: theme.custom.surface.base,
        boxShadow: theme.custom.shadow.panel,
        ...rest,
    };
}

export function mutedPanelSx(theme, overrides = {}) {
    return panelSx(theme, {
        backgroundColor: theme.custom.surface.raised,
        ...overrides,
    });
}

export function sectionTitleSx(theme, overrides = {}) {
    return {
        fontWeight: 700,
        color: theme.palette.text.primary,
        letterSpacing: 0,
        ...overrides,
    };
}

export function captionSx(theme, overrides = {}) {
    return {
        color: theme.palette.text.secondary,
        lineHeight: 1.65,
        ...overrides,
    };
}

export function toolbarSx(theme, overrides = {}) {
    const { borderRadius, ...rest } = overrides;
    return {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1.25,
        px: 2,
        py: 1.4,
        borderRadius: normalizeRectRadius(borderRadius),
        backgroundColor: theme.custom.surface.subtle,
        border: `1px solid ${theme.custom.border.soft}`,
        ...rest,
    };
}

export function tableHeaderTone(theme, tone = 'neutral') {
    const tones = {
        neutral: {
            bg: theme.custom.surface.subtle,
            border: theme.custom.border.strong,
            color: '#475569',
        },
        primary: {
            bg: alpha(theme.palette.primary.main, 0.08),
            border: alpha(theme.palette.primary.main, 0.2),
            color: '#245089',
        },
        success: {
            bg: alpha(theme.palette.success.main, 0.08),
            border: alpha(theme.palette.success.main, 0.22),
            color: '#2f6a49',
        },
        accent: {
            bg: '#f4f0fb',
            border: '#d9cfee',
            color: '#5d3f8c',
        },
        warning: {
            bg: alpha(theme.palette.warning.main, 0.09),
            border: alpha(theme.palette.warning.main, 0.24),
            color: '#8a5b12',
        },
    };
    return tones[tone] || tones.neutral;
}

export function compactToggleGroupSx(theme) {
    return {
        '& .MuiToggleButton-root': {
            px: 1.6,
            py: 0.45,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: theme.palette.text.secondary,
            borderColor: theme.custom.border.soft,
            '&.Mui-selected': {
                color: theme.palette.primary.dark,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
            '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
        },
    };
}

export function summaryChipSx(theme, overrides = {}) {
    return {
        height: 24,
        fontSize: '0.72rem',
        fontWeight: 700,
        color: '#475569',
        backgroundColor: theme.custom.surface.subtle,
        border: `1px solid ${theme.custom.border.soft}`,
        ...overrides,
    };
}

export function metricChipTone(theme, tone = 'neutral') {
    const tones = {
        neutral: {
            backgroundColor: theme.custom.surface.subtle,
            color: '#475569',
            border: `1px solid ${theme.custom.border.soft}`,
        },
        primary: {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            color: '#245089',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
        },
        success: {
            backgroundColor: alpha(theme.palette.success.main, 0.09),
            color: '#2f6a49',
            border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
        },
        warning: {
            backgroundColor: alpha(theme.palette.warning.main, 0.1),
            color: '#8a5b12',
            border: `1px solid ${alpha(theme.palette.warning.main, 0.24)}`,
        },
        accent: {
            backgroundColor: '#f4f0fb',
            color: '#5d3f8c',
            border: '1px solid #d9cfee',
        },
        subtle: {
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.secondary,
            border: `1px solid ${theme.custom.border.strong}`,
        },
    };
    return tones[tone] || tones.neutral;
}

export function controlFieldSx(theme, overrides = {}) {
    return {
        '& .MuiOutlinedInput-root': {
            backgroundColor: theme.palette.background.paper,
        },
        ...overrides,
    };
}

export function statusToggleSx(theme, overrides = {}) {
    return {
        '& .MuiToggleButton-root': {
            px: 2.1,
            py: 0.55,
            fontSize: '0.8rem',
            fontWeight: 600,
            color: theme.palette.text.secondary,
            borderColor: theme.custom.border.soft,
            '&.Mui-selected': {
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
            '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
        },
        ...overrides,
    };
}

export function plotFrameSx(theme, overrides = {}) {
    return panelSx(theme, {
        overflow: 'hidden',
        backgroundColor: theme.palette.background.paper,
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
        ...overrides,
    });
}

export function buildPlotHoverTone(theme, color, options = {}) {
    const {
        bgAlpha = 0.16,
        borderAlpha = 0.42,
        fontColor = theme.palette.text.primary,
        fontSize = 12,
        family = theme.typography.fontFamily,
        align = 'left',
    } = options;

    return {
        bgcolor: alpha(color, bgAlpha),
        bordercolor: alpha(color, borderAlpha),
        font: {
            color: fontColor,
            size: fontSize,
            family,
        },
        align,
    };
}

export function buildPlotHoverToneArray(theme, colors, options = {}) {
    const {
        bgAlpha = 0.16,
        borderAlpha = 0.42,
        fontColor = theme.palette.text.primary,
        fontSize = 12,
        family = theme.typography.fontFamily,
        align = 'left',
    } = options;

    return {
        bgcolor: colors.map((color) => alpha(color, bgAlpha)),
        bordercolor: colors.map((color) => alpha(color, borderAlpha)),
        font: {
            color: fontColor,
            size: fontSize,
            family,
        },
        align,
    };
}

export function sectionPanelHeaderSx(theme, overrides = {}) {
    return {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.75,
        py: 1,
        backgroundColor: theme.custom.surface.raised,
        borderBottom: `1px solid ${theme.custom.border.soft}`,
        ...overrides,
    };
}

export function tableTone(theme, tone = 'neutral') {
    const tones = {
        neutral: {
            headerBg: theme.custom.surface.subtle,
            headerBorder: theme.custom.border.strong,
            headerColor: '#475569',
            cellSoft: '#fbfcfd',
            cellStrong: '#f4f7fa',
        },
        primary: {
            headerBg: alpha(theme.palette.primary.main, 0.08),
            headerBorder: alpha(theme.palette.primary.main, 0.18),
            headerColor: '#245089',
            cellSoft: '#f8fbff',
            cellStrong: '#f1f6fd',
        },
        success: {
            headerBg: alpha(theme.palette.success.main, 0.08),
            headerBorder: alpha(theme.palette.success.main, 0.18),
            headerColor: '#2f6a49',
            cellSoft: '#f8fcf8',
            cellStrong: '#f1f8f2',
        },
        accent: {
            headerBg: '#f4f0fb',
            headerBorder: '#d9cfee',
            headerColor: '#5d3f8c',
            cellSoft: '#faf8fe',
            cellStrong: '#f4effc',
        },
        warning: {
            headerBg: alpha(theme.palette.warning.main, 0.08),
            headerBorder: alpha(theme.palette.warning.main, 0.2),
            headerColor: '#8a5b12',
            cellSoft: '#fffaf4',
            cellStrong: '#fdf3e4',
        },
    };
    return tones[tone] || tones.neutral;
}

export const groupedTableHeaderMetrics = {
    groupHeight: 30,
    columnHeight: 36,
};

export function groupedTableHeaderCellSx(theme, tone, overrides = {}) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: 5,
        height: groupedTableHeaderMetrics.groupHeight,
        minHeight: groupedTableHeaderMetrics.groupHeight,
        maxHeight: groupedTableHeaderMetrics.groupHeight,
        py: 0,
        px: 1,
        lineHeight: `${groupedTableHeaderMetrics.groupHeight}px`,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        bgcolor: tone.headerBg,
        backgroundColor: tone.headerBg,
        borderBottom: `1px solid ${tone.headerBorder}`,
        color: tone.headerColor,
        fontWeight: 750,
        fontSize: '0.64rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        boxShadow: `inset 0 -1px 0 ${tone.headerBorder}`,
        backgroundClip: 'padding-box',
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...overrides,
    };
}

export function groupedTableColumnHeaderCellSx(theme, tone, align = 'left', overrides = {}) {
    return {
        position: 'sticky',
        top: groupedTableHeaderMetrics.groupHeight,
        zIndex: 4,
        height: groupedTableHeaderMetrics.columnHeight,
        minHeight: groupedTableHeaderMetrics.columnHeight,
        py: 0,
        px: 1,
        lineHeight: 1.15,
        textAlign: align,
        whiteSpace: 'nowrap',
        bgcolor: tone.headerBg,
        backgroundColor: tone.headerBg,
        borderBottom: `2px solid ${tone.headerBorder}`,
        color: tone.headerColor,
        fontWeight: 650,
        fontSize: '0.67rem',
        boxShadow: `0 2px 0 ${theme.custom.surface.base}, inset 0 -1px 0 ${tone.headerBorder}`,
        backgroundClip: 'padding-box',
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...overrides,
    };
}

export function stickyTableHeaderCellSx(theme, tone, align = 'left', overrides = {}) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: 4,
        bgcolor: tone.headerBg,
        backgroundColor: tone.headerBg,
        color: tone.headerColor,
        borderBottom: `2px solid ${tone.headerBorder}`,
        textAlign: align,
        whiteSpace: 'nowrap',
        backgroundClip: 'padding-box',
        boxShadow: `0 2px 0 ${theme.custom.surface.base}, inset 0 -1px 0 ${tone.headerBorder}`,
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...overrides,
    };
}

export function highlightedRowSx(theme, isHighlighted, even, animationNameA, animationNameB, key) {
    const base = '#fff1b8';
    const flash = '#ffe082';
    return {
        [`@keyframes ${animationNameA}`]: {
            '0%': { backgroundColor: flash },
            '28%': { backgroundColor: '#ffef99' },
            '100%': { backgroundColor: base },
        },
        [`@keyframes ${animationNameB}`]: {
            '0%': { backgroundColor: '#ffd969' },
            '28%': { backgroundColor: '#ffeb8a' },
            '100%': { backgroundColor: base },
        },
        bgcolor: isHighlighted ? base : (even ? theme.palette.background.paper : '#fbfcfd'),
        boxShadow: isHighlighted ? 'inset 0 0 0 1px rgba(217,119,6,0.18), 0 0 0 2px rgba(245,158,11,0.12)' : 'none',
        '& td': {
            backgroundColor: isHighlighted ? `${base} !important` : undefined,
            transition: `background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}, color ${theme.custom.motion.swift}`,
            animation: isHighlighted ? `${key % 2 === 0 ? animationNameA : animationNameB} 1.15s ease-out` : 'none',
        },
        '&:hover td': {
            bgcolor: isHighlighted ? `${base} !important` : '#f3f6fa',
            boxShadow: 'inset 0 -1px 0 rgba(226,232,240,0.78)',
        },
    };
}

export function tableRowRevealSx(theme, index = 0, overrides = {}) {
    const delay = Math.min(index, 24) * 16;
    return {
        '@keyframes tableRowReveal': {
            from: {
                opacity: 0,
            },
            to: {
                opacity: 1,
            },
        },
        animation: `tableRowReveal 260ms ${delay}ms cubic-bezier(0.22, 1, 0.36, 1) backwards`,
        transition: `background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
        ...overrides,
    };
}

export function tableSkeletonCellSx(theme, index = 0, tone = 'neutral') {
    const toneColor = tone === 'primary'
        ? alpha(theme.palette.primary.main, 0.1)
        : tone === 'action'
            ? alpha(theme.palette.warning.main, 0.1)
            : alpha(theme.palette.text.primary, 0.055);
    return {
        height: 16,
        width: '100%',
        borderRadius: 1,
        bgcolor: toneColor,
        position: 'relative',
        overflow: 'hidden',
        opacity: 0.9,
        '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            transform: 'translateX(-100%)',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.82), transparent)',
            animation: `tableSkeletonSweep 1.25s ${index * 70}ms ease-in-out infinite`,
        },
        '@keyframes tableSkeletonSweep': {
            '100%': { transform: 'translateX(100%)' },
        },
    };
}

export function chartLayoutTokens(theme) {
    return {
        axisColor: theme.custom.chart.axis,
        axisSoft: theme.custom.chart.axisSoft,
        gridColor: theme.custom.chart.grid,
        plotBg: theme.custom.surface.raised,
        paperBg: theme.palette.background.paper,
        legendBg: theme.custom.chart.legendBg,
        legendBorder: theme.custom.border.soft,
        hoverBg: theme.custom.chart.hoverBg,
        hoverBorder: theme.custom.chart.hoverBorder,
        threshold: theme.custom.chart.threshold,
        significance: theme.custom.chart.significance,
        highlight: theme.custom.chart.highlight,
        band: theme.custom.chart.band,
        overlay: theme.custom.chart.overlay,
    };
}

export function fadeUpKeyframes(distance = 10) {
    return {
        '@keyframes appFadeUp': {
            from: {
                opacity: 0,
                transform: `translateY(${distance}px)`,
            },
            to: {
                opacity: 1,
                transform: 'translateY(0)',
            },
        },
    };
}
