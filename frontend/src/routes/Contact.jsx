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
        subtitle: 'Use this page as the project support checklist for TraitVista data, route, chart, and download issues.',
        language: 'Language',
        english: 'English',
        chinese: '中文',
        chips: ['Trait files', 'Program evidence', 'Downloads', 'UI behavior'],
        quickLinks: [
            { label: 'Open Guide', to: '/help' },
            { label: 'Open Data Browser', to: '/data' },
            { label: 'Open Trait Browser', to: '/trait' },
            { label: 'Open Programs', to: '/programs' },
        ],
        triageTitle: 'Triage Route Hints',
        triageBody: 'Most reports can be narrowed quickly by checking the page that owns the failing data surface.',
        triageItems: [
            { label: 'Trait plot or tab', route: '/trait/:traitId', owner: 'Trait figure data and linked table state' },
            { label: 'Gene evidence', route: '/genes?query=GENE', owner: 'Gene index, program relationships, trait evidence rows' },
            { label: 'Program annotation', route: '/programs/PID', owner: 'Program metadata, program genes, associated traits' },
            { label: 'Raw file or download', route: '/data?mode=global', owner: 'Indexed paths, folder ZIP, selected-file downloads' },
        ],
        templateTitle: 'Report Template',
        templateBody: 'Copy this structure into the project support channel once a real contact destination is defined.',
        templateRows: [
            ['Route', '/trait/GCST90081631?tab=manhattan'],
            ['Object', 'Trait, GWAS ID, gene, program, rsID, or file path'],
            ['Expected', 'What should have appeared or downloaded'],
            ['Actual', 'What appeared, failed, or looked inconsistent'],
            ['State', 'Active tab, filters, selected files, browser, and approximate time'],
        ],
        sections: [
            {
                icon: ContactSupportOutlined,
                title: 'When To Reach Out',
                body: 'Reach out when browser behavior blocks analysis, when a rendered value disagrees with the underlying result file, or when a route cannot expose data that should exist.',
                bullets: [
                    'A Trait tab such as Manhattan, Program Scatter, Gene Evidence, Gene QQ, or Cross-trait Heatmap is missing a result file that should exist.',
                    'A Data Browser download fails repeatedly, returns the wrong artifact, or packages an unexpected folder.',
                    'Trait metadata, Trait IDs, GWAS IDs, burden phenotypes, program IDs, gene symbols, or chart-linked table values look inconsistent.',
                    'A Programs or Genes drilldown cannot find records that are present in the indexed output files.',
                ],
            },
            {
                icon: DescriptionOutlined,
                title: 'What To Include',
                body: 'A short, concrete report makes the issue reproducible from the same page, route, and filter state.',
                bullets: [
                    'The exact route, such as /trait/GCST90081631?tab=manhattan, /programs/P12, /genes?query=PTMA, or /data?mode=global.',
                    'The trait name, Trait ID, GWAS ID, burden phenotype, program ID, gene symbol, rsID, or file path involved.',
                    'What you expected to see and what actually happened.',
                    'The visible filter state, active tab, selected download paths, browser screenshot, and approximate time of the issue.',
                ],
            },
            {
                icon: SearchOutlined,
                title: 'Where To Check First',
                body: 'Use the page that matches the failing workflow before escalating so the report can point to the right data layer.',
                bullets: [
                    'For trait plots and chart-linked tables, compare the Trait page with the matching TSV or folder in Data Browser.',
                    'For gene evidence, check both the Genes page and the trait-level Gene Evidence or Gene QQ tab when available.',
                    'For program annotation or regulator direction, check Programs and the Trait Program Graph or Program Scatter tab.',
                    'For empty states, use Guide to confirm whether the component is expected to show a fallback panel.',
                ],
            },
            {
                icon: BugReportOutlined,
                title: 'Issue Categories',
                body: 'Framing the issue clearly helps route it to the maintainer, data owner, or frontend owner faster.',
                bullets: [
                    'Data issue: missing rows, mismatched identifiers, incorrect counts, unexpected file contents, or stale indexed paths.',
                    'Interface issue: broken layout, navigation problems, disabled controls, chart interaction failures, or text overflow.',
                    'Workflow issue: unclear starting point, confusing export path, unsupported filter combination, or missing explanation in the UI.',
                ],
            },
        ],
        footerTitle: 'Maintainer Details',
        footerBody: 'No public maintainer email, ticket queue, or support channel is currently defined in the repository. Treat this page as the reporting checklist until the official contact method is added.',
        footerChip: 'Official contact pending',
    },
    zh: {
        title: '联系',
        subtitle: '这个页面作为 TraitVista 数据、路由、图表和下载问题的项目支持检查清单。',
        language: '语言',
        english: 'English',
        chinese: '中文',
        chips: ['Trait 文件', 'Program 证据', '下载', '界面行为'],
        quickLinks: [
            { label: '打开 Guide', to: '/help' },
            { label: '打开数据浏览器', to: '/data' },
            { label: '打开 Trait 浏览器', to: '/trait' },
            { label: '打开 Programs', to: '/programs' },
        ],
        triageTitle: '排查路由提示',
        triageBody: '大多数报告都可以先通过负责该数据面的页面缩小范围。',
        triageItems: [
            { label: 'Trait 图或 tab', route: '/trait/:traitId', owner: 'Trait 图形数据和联动表格状态' },
            { label: 'Gene 证据', route: '/genes?query=GENE', owner: 'Gene 索引、program 关系、trait 证据行' },
            { label: 'Program 注释', route: '/programs/PID', owner: 'Program metadata、program genes、associated traits' },
            { label: '原始文件或下载', route: '/data?mode=global', owner: '索引路径、文件夹 ZIP、已选文件下载' },
        ],
        templateTitle: '报告模板',
        templateBody: '正式联系渠道补齐后，可以按这个结构把问题发给项目支持方。',
        templateRows: [
            ['路由', '/trait/GCST90081631?tab=manhattan'],
            ['对象', 'Trait、GWAS ID、gene、program、rsID 或文件路径'],
            ['预期结果', '原本应该显示或下载什么'],
            ['实际结果', '实际显示、失败或不一致的内容'],
            ['状态', '活动 tab、筛选条件、已选文件、浏览器和大致时间'],
        ],
        sections: [
            {
                icon: ContactSupportOutlined,
                title: '什么时候需要联系',
                body: '当浏览器行为阻塞分析、页面展示值与底层结果文件不一致，或某个路由无法展示本应存在的数据时，就需要联系维护者或数据负责人。',
                bullets: [
                    'Trait 页中的 Manhattan、Program Scatter、Gene Evidence、Gene QQ 或 Cross-trait Heatmap 等 tab 缺少本应存在的结果文件。',
                    'Data Browser 下载反复失败、返回错误文件，或打包了不符合预期的目录。',
                    'Trait metadata、Trait ID、GWAS ID、burden phenotype、program ID、gene symbol、rsID 或图表联动表格数值看起来不一致。',
                    'Programs 或 Genes 钻取页找不到已存在于索引输出文件里的记录。',
                ],
            },
            {
                icon: DescriptionOutlined,
                title: '联系时应附带什么',
                body: '简洁且具体的问题描述可以让维护者从同一页面、路由和筛选状态复现问题。',
                bullets: [
                    '准确路由，例如 /trait/GCST90081631?tab=manhattan、/programs/P12、/genes?query=PTMA 或 /data?mode=global。',
                    '涉及的 trait 名称、Trait ID、GWAS ID、burden phenotype、program ID、gene symbol、rsID 或文件路径。',
                    '你期望看到什么，以及实际发生了什么。',
                    '当前筛选条件、活动 tab、选中的下载路径、浏览器截图以及大致发生时间。',
                ],
            },
            {
                icon: SearchOutlined,
                title: '先从哪里检查',
                body: '先用与问题对应的页面复核一次，可以帮助报告直接指向正确的数据层。',
                bullets: [
                    'Trait 图和图表联动表格的问题，先把 Trait 页面与 Data Browser 中对应 TSV 或目录对照。',
                    'Gene 证据问题，同时检查 Genes 页面，以及可用的 trait-level Gene Evidence 或 Gene QQ tab。',
                    'Program 注释或 regulator 方向问题，同时检查 Programs 页面、Trait Program Graph 和 Program Scatter tab。',
                    '空态问题先查 Guide，确认该组件是否本来就会显示 fallback 面板。',
                ],
            },
            {
                icon: BugReportOutlined,
                title: '问题类型',
                body: '把问题归类清楚，有助于更快转给维护者、数据负责人或前端负责人。',
                bullets: [
                    '数据问题：缺行、标识符不匹配、计数异常、文件内容不符合预期或索引路径过期。',
                    '界面问题：布局错乱、导航异常、控件失效、图表交互失败或文字溢出。',
                    '流程问题：入口不清晰、导出路径难懂、筛选组合不支持或 UI 缺少解释信息。',
                ],
            },
        ],
        footerTitle: '维护者信息',
        footerBody: '当前仓库尚未定义公开维护者邮箱、工单队列或支持渠道。在正式联系方式补齐前，这个页面先作为问题报告检查清单使用。',
        footerChip: '正式联系方式待补充',
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

function TriageHints({ copy }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.6, md: 2 },
                mb: 2,
                backgroundColor: theme.custom.surface.raised,
            })}
        >
            <Box sx={{ mb: 1.2 }}>
                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0 })}>
                    {copy.triageTitle}
                </Typography>
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                    gap: 1,
                }}
            >
                {copy.triageItems.map((item, index) => (
                    <Box
                        key={item.label}
                        sx={{
                            p: 1.15,
                            borderRadius: 1,
                            border: `1px solid ${theme.custom.border.soft}`,
                            bgcolor: index % 2 === 0 ? theme.palette.background.paper : alpha(theme.palette.warning.main, 0.045),
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 740, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                            {item.label}
                        </Typography>
                        <Typography variant="body2" sx={captionSx(theme, { mt: 0.6, mb: 0.7, color: theme.palette.text.primary })}>
                            {item.owner}
                        </Typography>
                        <Chip
                            label={item.route}
                            size="small"
                            sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                        />
                    </Box>
                ))}
            </Box>
        </Paper>
    );
}

function ReportTemplate({ copy }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.6, md: 2 },
                mb: 2,
                backgroundColor: theme.palette.background.paper,
            })}
        >
            <Box sx={{ mb: 1.2 }}>
                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.35 })}>
                    {copy.templateTitle}
                </Typography>

            </Box>
            <Stack spacing={0.75}>
                {copy.templateRows.map(([label, value]) => (
                    <Box
                        key={label}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '132px minmax(0, 1fr)' },
                            gap: { xs: 0.35, sm: 1 },
                            p: 1,
                            borderRadius: 1,
                            border: `1px solid ${theme.custom.border.soft}`,
                            bgcolor: theme.custom.surface.raised,
                        }}
                    >
                        <Typography variant="body2" sx={{ fontWeight: 740, color: theme.palette.text.primary }}>
                            {label}
                        </Typography>
                        <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                            {value}
                        </Typography>
                    </Box>
                ))}
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

            <TriageHints copy={copy} />
            <ReportTemplate copy={copy} />

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
