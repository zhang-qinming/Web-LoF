import { alpha } from '@mui/material/styles';

const RECT_RADIUS = 1;

export const APP_SHELL_MAX_WIDTH = 2400;
export const DATA_PAGE_MAX_WIDTH = 2400;
export const FIGURE_PAGE_MAX_WIDTH = 2400;
export const CONTENT_PAGE_MAX_WIDTH = 1600;
export const APP_TEXT_MAX_WIDTH = 1120;
export const RESPONSIVE_PLOT_MAX_HEIGHT = 980;
export const RESPONSIVE_PLOT_HEIGHT = 'clamp(560px, min(64dvh, 38vw), 980px)';
export const TABLE_RESPONSIVE_BREAKPOINT = 1200;
export const RESPONSIVE_TALL_PLOT_HEIGHT = 'clamp(600px, min(68dvh, 40vw), 980px)';
export const RESPONSIVE_COMPACT_PLOT_HEIGHT = 'clamp(400px, min(56dvh, 28vw), 740px)';
export const RESPONSIVE_EMPTY_PLOT_HEIGHT = 'clamp(280px, min(40dvh, 24vw), 500px)';

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
        fontWeight: 680,
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

export function figureToolbarSx(theme, overrides = {}) {
    const { borderRadius, ...rest } = overrides;
    return {
        display: 'grid',
        gridTemplateColumns: {
            xs: '1fr',
            lg: 'minmax(190px, 0.62fr) minmax(320px, 1.12fr) minmax(300px, 1fr)',
        },
        alignItems: 'stretch',
        gap: 1,
        px: 1,
        py: 1,
        borderRadius: normalizeRectRadius(borderRadius),
        backgroundColor: theme.custom.surface.subtle,
        border: `1px solid ${theme.custom.border.soft}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
        ...rest,
    };
}

export function figureToolbarPanelSx(theme, tone = 'neutral', overrides = {}) {
    const tones = {
        title: {
            accent: theme.palette.primary.main,
            bg: theme.palette.background.paper,
            border: theme.custom.border.soft,
        },
        info: {
            accent: '#3f78a8',
            bg: '#f8fbff',
            border: '#cfe0f6',
        },
        controls: {
            accent: '#64748b',
            bg: theme.palette.background.paper,
            border: theme.custom.border.strong,
        },
        display: {
            accent: '#8a5b12',
            bg: '#fffaf4',
            border: '#edd1a4',
        },
    };
    const selected = tones[tone] || tones.controls;

    return {
        minWidth: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        alignContent: 'center',
        gap: 0.9,
        px: 1.25,
        py: 0.95,
        borderRadius: 1,
        border: `1px solid ${selected.border}`,
        borderLeft: `3px solid ${selected.accent}`,
        backgroundColor: selected.bg,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.74)',
        ...overrides,
    };
}

export function figureToolbarLabelSx(theme, overrides = {}) {
    return {
        width: '100%',
        color: theme.palette.text.secondary,
        fontSize: '0.7rem',
        fontWeight: 680,
        letterSpacing: 0,
        lineHeight: 1.2,
        ...overrides,
    };
}

export function figureToolbarTitleSx(theme, overrides = {}) {
    return {
        color: theme.palette.text.primary,
        fontSize: '0.86rem',
        fontWeight: 760,
        letterSpacing: 0,
        lineHeight: 1.25,
        ...overrides,
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
            bg: '#eaf2ff',
            border: '#bfd6fb',
            color: '#245089',
        },
        success: {
            bg: '#edf8f1',
            border: '#c5e6d0',
            color: '#2f6a49',
        },
        accent: {
            bg: '#f4f0fb',
            border: '#d9cfee',
            color: '#5d3f8c',
        },
        warning: {
            bg: '#fff2dd',
            border: '#edd1a4',
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
        fontWeight: 650,
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
        overflowAnchor: 'none',
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

export function buildPlotHoverToneNeutral(theme, color = '#64748b', options = {}) {
    return buildPlotHoverTone(theme, color, {
        bgAlpha: 0.12,
        borderAlpha: 0.28,
        ...options,
    });
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

export function tableToolbarGroupSx(theme, overrides = {}) {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 0.75,
        flexWrap: 'wrap',
        px: 0.7,
        py: 0.6,
        borderRadius: 1.5,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.custom.surface.subtle, 0.92)} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.84), 0 8px 18px ${alpha('#0f172a', 0.05)}`,
        ...overrides,
    };
}

export function tableToolbarActionButtonSx(theme, tone = 'primary', overrides = {}) {
    const tones = {
        primary: {
            color: '#245089',
            borderColor: alpha(theme.palette.primary.main, 0.18),
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
            hoverBackground: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
            shadow: alpha(theme.palette.primary.main, 0.12),
        },
        neutral: {
            color: theme.palette.text.secondary,
            borderColor: alpha('#64748b', 0.18),
            background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.custom.surface.subtle, 0.96)} 100%)`,
            hoverBackground: `linear-gradient(135deg, ${alpha(theme.custom.surface.subtle, 0.98)} 0%, ${alpha('#e2e8f0', 0.98)} 100%)`,
            shadow: alpha('#64748b', 0.08),
        },
    };
    const selected = tones[tone] || tones.primary;

    return {
        minHeight: 34,
        px: 1.3,
        borderRadius: 1.25,
        border: `1px solid ${selected.borderColor}`,
        background: selected.background,
        color: selected.color,
        fontSize: '0.73rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        textTransform: 'none',
        boxShadow: `0 8px 16px -14px ${selected.shadow}`,
        transition: `transform ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}, border-color ${theme.custom.motion.swift}, background ${theme.custom.motion.swift}`,
        '&:hover': {
            borderColor: selected.borderColor,
            background: selected.hoverBackground,
            boxShadow: `0 12px 22px -16px ${selected.shadow}`,
            transform: 'translateY(-1px)',
        },
        '&:disabled': {
            color: alpha(theme.palette.text.secondary, 0.72),
            borderColor: alpha('#94a3b8', 0.22),
            background: alpha(theme.custom.surface.subtle, 0.78),
            boxShadow: 'none',
        },
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
            headerBg: '#eaf2ff',
            headerBorder: '#bfd6fb',
            headerColor: '#245089',
            cellSoft: '#f8fbff',
            cellStrong: '#f1f6fd',
        },
        success: {
            headerBg: '#edf8f1',
            headerBorder: '#c5e6d0',
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
            headerBg: '#fff2dd',
            headerBorder: '#edd1a4',
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

function justifyForTableAlign(align = 'left') {
    if (align === 'right') return 'flex-end';
    if (align === 'center') return 'center';
    return 'flex-start';
}

export function stickyTableContainerSx(theme, overrides = {}) {
    return {
        position: 'relative',
        isolation: 'isolate',
        backgroundColor: theme.palette.background.paper,
        ...overrides,
        '& .MuiTable-root.MuiTable-stickyHeader': {
            borderCollapse: 'separate',
            borderSpacing: 0,
        },
        '& .MuiTableHead-root': {
            position: 'relative',
            zIndex: 40,
        },
        '& .MuiTableCell-head': {
            position: 'sticky',
            zIndex: 41,
            background: theme.custom.surface.subtle,
            backgroundColor: theme.custom.surface.subtle,
            backgroundClip: 'border-box',
            backgroundRepeat: 'no-repeat',
            backgroundImage: 'none',
        },
        '& .MuiTableCell-stickyHeader': {
            background: theme.custom.surface.subtle,
            backgroundColor: theme.custom.surface.subtle,
            backgroundImage: 'none',
            zIndex: 41,
        },
        '& .MuiTableBody-root': {
            position: 'relative',
            zIndex: 0,
        },
        '& .MuiTableBody-root .MuiTableRow-root, & .MuiTableBody-root .MuiTableCell-root': {
            position: 'relative',
            zIndex: 0,
        },
    };
}

export function stickyTableSx(theme, overrides = {}) {
    return {
        borderCollapse: 'separate',
        borderSpacing: 0,
        backgroundColor: theme.palette.background.paper,
        '& thead': {
            position: 'relative',
            zIndex: 40,
        },
        '& thead tr': {
            position: 'relative',
        },
        '& thead th': {
            background: theme.custom.surface.subtle,
            backgroundColor: theme.custom.surface.subtle,
            backgroundClip: 'border-box',
            backgroundRepeat: 'no-repeat',
            backgroundImage: 'none',
            zIndex: 41,
        },
        '& tbody': {
            position: 'relative',
            zIndex: 0,
        },
        '& tbody tr, & tbody td': {
            position: 'relative',
            zIndex: 0,
        },
        ...overrides,
    };
}

export function groupedTableHeaderCellSx(theme, tone, overrides = {}) {
    return {
        position: 'sticky',
        top: 0,
        zIndex: '42 !important',
        height: groupedTableHeaderMetrics.groupHeight,
        minHeight: groupedTableHeaderMetrics.groupHeight,
        maxHeight: groupedTableHeaderMetrics.groupHeight,
        py: 0,
        px: 1,
        lineHeight: `${groupedTableHeaderMetrics.groupHeight}px`,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        bgcolor: tone.headerBg,
        backgroundColor: `${tone.headerBg} !important`,
        background: `${tone.headerBg} !important`,
        backgroundImage: 'none !important',
        borderBottom: `1px solid ${tone.headerBorder}`,
        color: tone.headerColor,
        fontWeight: 680,
        fontSize: '0.64rem',
        textTransform: 'none',
        letterSpacing: '0.06em',
        boxShadow: `inset 0 -1px 0 ${tone.headerBorder}, 0 1px 0 ${tone.headerBorder}`,
        backgroundClip: 'border-box',
        verticalAlign: 'middle',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...overrides,
    };
}

export function groupedTableColumnHeaderCellSx(theme, tone, align = 'left', overrides = {}) {
    const justifyContent = justifyForTableAlign(align);

    return {
        position: 'sticky',
        top: groupedTableHeaderMetrics.groupHeight,
        zIndex: '41 !important',
        height: groupedTableHeaderMetrics.columnHeight,
        minHeight: groupedTableHeaderMetrics.columnHeight,
        py: 0,
        px: 1,
        lineHeight: 1.15,
        textAlign: align,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        bgcolor: tone.headerBg,
        backgroundColor: `${tone.headerBg} !important`,
        background: `${tone.headerBg} !important`,
        backgroundImage: 'none !important',
        borderBottom: `2px solid ${tone.headerBorder}`,
        color: tone.headerColor,
        fontWeight: 620,
        fontSize: '0.67rem',
        boxShadow: `0 2px 0 ${theme.custom.surface.base}, inset 0 -1px 0 ${tone.headerBorder}`,
        backgroundClip: 'border-box',
        verticalAlign: 'middle',
        '& .MuiTableSortLabel-root': {
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            justifyContent,
            textAlign: align,
        },
        '& .MuiTableSortLabel-icon': {
            flexShrink: 0,
        },
        ...overrides,
    };
}

export function stickyTableHeaderCellSx(theme, tone, align = 'left', overrides = {}) {
    const justifyContent = justifyForTableAlign(align);

    return {
        position: 'sticky',
        top: 0,
        zIndex: '41 !important',
        bgcolor: tone.headerBg,
        backgroundColor: `${tone.headerBg} !important`,
        background: `${tone.headerBg} !important`,
        backgroundImage: 'none !important',
        color: tone.headerColor,
        borderBottom: `2px solid ${tone.headerBorder}`,
        textAlign: align,
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        backgroundClip: 'border-box',
        boxShadow: `0 2px 0 ${theme.custom.surface.base}, inset 0 -1px 0 ${tone.headerBorder}`,
        verticalAlign: 'middle',
        '& .MuiTableSortLabel-root': {
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            justifyContent,
            textAlign: align,
        },
        '& .MuiTableSortLabel-icon': {
            flexShrink: 0,
        },
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
    const { disableReveal = false, ...rest } = overrides;
    const delay = Math.min(index, 24) * 16;
    return {
        ...(disableReveal ? {} : {
            '@keyframes tableRowReveal': {
                from: {
                    opacity: 0,
                },
                to: {
                    opacity: 1,
                },
            },
            animation: `tableRowReveal 260ms ${delay}ms cubic-bezier(0.22, 1, 0.36, 1) backwards`,
        }),
        transition: `background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
        ...rest,
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

export function fadeUpKeyframes() {
    return {
        '@keyframes appFadeUp': {
            from: {
                opacity: 0,
            },
            to: {
                opacity: 1,
            },
        },
    };
}
