import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Button,
    Chip,
    Paper,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    BugReportOutlined,
    ContactSupportOutlined,
    DescriptionOutlined,
    LanguageOutlined,
    LinkOutlined,
    MailOutline,
    SearchOutlined,
} from '@mui/icons-material';
import { PageFrame } from '../components/PageScaffold';
import { captionSx, metricChipTone, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';

const COPY = {
    en: {
        title: 'Contact',
        subtitle: 'Use this page to understand what to collect before reaching the project maintainer or data owner.',
        language: 'Language',
        english: 'English',
        chinese: '中文',
        chips: ['Data issues', 'UI issues', 'Download issues'],
        quickLinks: [
            { label: 'Open Guide', to: '/help' },
            { label: 'Open Data Browser', to: '/data' },
            { label: 'Open Trait Browser', to: '/trait' },
        ],
        sections: [
            {
                icon: ContactSupportOutlined,
                title: 'When To Reach Out',
                body: 'Contact the project maintainer or the relevant data owner when the browser behavior blocks your work or when a result appears inconsistent with the expected project outputs.',
                bullets: [
                    'A trait page is missing files that should exist.',
                    'A download fails repeatedly or returns the wrong artifact.',
                    'Metadata, identifiers, or plot-linked values look inconsistent.',
                    'You need clarification on the intended interpretation of a program or trait-level result.',
                ],
            },
            {
                icon: DescriptionOutlined,
                title: 'What To Include',
                body: 'A short, concrete report will make support much faster. Include enough context to reproduce the issue on the same page and route.',
                bullets: [
                    'The exact page or route, such as /trait, /programs/P12, or /data.',
                    'The trait name, LoF ID, GWAS ID, program ID, or file path involved.',
                    'What you expected to see and what actually happened.',
                    'If possible, include the visible filter state, a screenshot, and the approximate time of the issue.',
                ],
            },
            {
                icon: SearchOutlined,
                title: 'Before Sending A Report',
                body: 'A few quick checks often separate a true data issue from a temporary view or filter issue.',
                bullets: [
                    'Retry the same page after clearing filters or reopening the route.',
                    'Check the same trait or file from both the focused page and Data Browser.',
                    'Use Guide to confirm whether the component is expected to show a fallback or empty-state panel.',
                ],
            },
            {
                icon: BugReportOutlined,
                title: 'Issue Categories',
                body: 'Framing the issue clearly helps route it to the right person faster.',
                bullets: [
                    'Data issue: missing rows, mismatched identifiers, incorrect counts, or unexpected file contents.',
                    'Interface issue: broken layout, navigation problems, disabled controls, or chart interaction failures.',
                    'Workflow issue: unclear starting point, confusing export path, or missing explanation in the UI.',
                ],
            },
        ],
        footerTitle: 'Maintainer Details',
        footerBody: 'No direct maintainer email or public support channel is currently exposed in the repository. If you want, we can add a real contact method here once you provide it.',
        footerChip: 'Contact info pending',
    },
    zh: {
        title: '联系',
        subtitle: '这个页面用于说明在联系项目维护者或数据负责人前，最好先准备哪些信息。',
        language: '语言',
        english: 'English',
        chinese: '中文',
        chips: ['数据问题', '界面问题', '下载问题'],
        quickLinks: [
            { label: '打开 Guide', to: '/help' },
            { label: '打开数据浏览器', to: '/data' },
            { label: '打开 Trait 浏览器', to: '/trait' },
        ],
        sections: [
            {
                icon: ContactSupportOutlined,
                title: '什么时候需要联系',
                body: '当浏览器行为已经影响你的工作，或某个结果与预期项目输出不一致时，应联系项目维护者或相关数据负责人。',
                bullets: [
                    '某个 trait 页面缺少本应存在的结果文件。',
                    '下载反复失败，或返回了错误的文件。',
                    '元信息、标识符或图表关联数值看起来不一致。',
                    '你需要确认某个 program 或 trait 级结果的解释方式。',
                ],
            },
            {
                icon: DescriptionOutlined,
                title: '联系时应附带什么',
                body: '简洁且具体的问题描述会明显加快处理速度。最好提供能在相同页面和路由下复现问题的上下文。',
                bullets: [
                    '准确的页面或路由，例如 /trait、/programs/P12 或 /data。',
                    '涉及的 trait 名称、LoF ID、GWAS ID、program ID 或文件路径。',
                    '你期望看到什么，以及实际发生了什么。',
                    '如果可以，附上当前筛选条件、截图以及大致发生时间。',
                ],
            },
            {
                icon: SearchOutlined,
                title: '发送前先做的检查',
                body: '一些快速检查可以帮助区分真实数据问题和临时的视图/筛选问题。',
                bullets: [
                    '清空筛选条件后重试，或重新打开同一路由。',
                    '从当前分析页和 Data Browser 两边都检查一次同一个 trait 或文件。',
                    '使用 Guide 确认该组件是否本来就会显示 fallback 或 empty-state 面板。',
                ],
            },
            {
                icon: BugReportOutlined,
                title: '问题类型',
                body: '把问题归类清楚，有助于更快找到正确处理人。',
                bullets: [
                    '数据问题：缺行、标识符不匹配、计数异常或文件内容不符合预期。',
                    '界面问题：布局错乱、导航异常、控件失效或图表交互失败。',
                    '流程问题：入口不清晰、导出路径难懂或 UI 缺少解释信息。',
                ],
            },
        ],
        footerTitle: '维护者信息',
        footerBody: '当前仓库里没有公开暴露维护者邮箱或支持渠道。如果你提供真实联系方式，我可以把它补到这里。',
        footerChip: '联系方式待补充',
    },
};

function SectionCard({ section, index }) {
    const theme = useTheme();
    const Icon = section.icon;

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.8, md: 2.2 },
                backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
            })}
        >
            <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                        flexShrink: 0,
                    }}
                >
                    <Icon sx={{ fontSize: 21 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.45 })}>
                        {section.title}
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 1.1 })}>
                        {section.body}
                    </Typography>
                    <Stack spacing={0.8}>
                        {section.bullets.map((bullet) => (
                            <Box key={bullet} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <Box
                                    sx={{
                                        width: 5,
                                        height: 5,
                                        mt: 0.8,
                                        borderRadius: '50%',
                                        bgcolor: theme.palette.primary.main,
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary })}>
                                    {bullet}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            </Stack>
        </Paper>
    );
}

export default function Contact() {
    const theme = useTheme();
    const [language, setLanguage] = React.useState('en');
    const copy = COPY[language];

    return (
        <PageFrame
            title={copy.title}
            subtitle={copy.subtitle}
            maxWidth={1080}
            compact
            actions={(
                <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                        icon={<LanguageOutlined sx={{ fontSize: 16 }} />}
                        label={copy.language}
                        sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                    />
                    <ToggleButtonGroup
                        value={language}
                        exclusive
                        size="small"
                        onChange={(_event, value) => {
                            if (value) setLanguage(value);
                        }}
                    >
                        <ToggleButton value="en">{copy.english}</ToggleButton>
                        <ToggleButton value="zh">{copy.chinese}</ToggleButton>
                    </ToggleButtonGroup>
                </Stack>
            )}
        >
            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    p: { xs: 1.8, md: 2.3 },
                    mb: 2,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.warning.main, 0.08)})`,
                })}
            >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                    <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                        {copy.chips.map((label) => (
                            <Chip key={label} label={label} sx={summaryChipSx(theme, metricChipTone(theme, 'warning'))} />
                        ))}
                    </Stack>
                    <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                        {copy.quickLinks.map((link) => (
                            <Button
                                key={link.to}
                                component={RouterLink}
                                to={link.to}
                                size="small"
                                variant="outlined"
                                endIcon={<LinkOutlined sx={{ fontSize: 16 }} />}
                            >
                                {link.label}
                            </Button>
                        ))}
                    </Stack>
                </Stack>
            </Paper>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                    mb: 2,
                }}
            >
                {copy.sections.map((section, index) => (
                    <SectionCard key={section.title} section={section} index={index} />
                ))}
            </Box>

            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    p: { xs: 1.7, md: 2.1 },
                    backgroundColor: theme.custom.surface.raised,
                })}
            >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                    <Box>
                        <Typography variant="subtitle1" sx={sectionTitleSx(theme, { mb: 0.45 })}>
                            {copy.footerTitle}
                        </Typography>
                        <Typography variant="body2" sx={captionSx(theme)}>
                            {copy.footerBody}
                        </Typography>
                    </Box>
                    <Chip
                        icon={<MailOutline sx={{ fontSize: 16 }} />}
                        label={copy.footerChip}
                        sx={summaryChipSx(theme, metricChipTone(theme, 'subtle'))}
                    />
                </Stack>
            </Paper>
        </PageFrame>
    );
}
