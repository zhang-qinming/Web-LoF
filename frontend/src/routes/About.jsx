import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
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
    AccountTreeOutlined,
    ArticleOutlined,
    BiotechOutlined,
    DataObjectOutlined,
    InsightsOutlined,
    LanguageOutlined,
    LaunchOutlined,
    StorageOutlined,
} from '@mui/icons-material';
import { PageFrame } from '../components/PageScaffold';
import ReleaseLogSection from '../components/ReleaseLogSection';
import { RELEASE_LOG_ANCHOR, releaseEntriesByLocale } from '../components/releaseLogData';
import { captionSx, metricChipTone, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';
import homeFigureBrowserWorkflow from '../assets/home/home-figure-browser-workflow.svg';
import docsFigureBrowserSurfaces from '../assets/docs/docs-figure-browser-surfaces.svg';

const COPY = {
    en: {
        title: 'About',
        subtitle: 'A concise map of the browser: what each route covers, how the analysis workflow reaches the UI, and where to start for trait, gene, or file-level questions.',
        language: 'Language',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Open Trait Browser', to: '/trait' },
            { label: 'Open Genes', to: '/genes' },
            { label: 'Open Programs', to: '/programs' },
            { label: 'Open Data Browser', to: '/data' },
        ],
        heroChips: ['Trait-level analysis', 'Gene-centric drilldown', 'Downloadable outputs'],
        figureCards: [
            {
                title: 'Analysis Workflow',
                body: 'This is the project-side data path: trait selection, LoF evidence, perturb-seq program modeling, association, then browser delivery.',
                image: homeFigureBrowserWorkflow,
                alt: 'Analysis workflow from GWAS and LoF to web display',
            },
            {
                title: 'Browser Surface Map',
                body: 'This is the user-side route map: move from search into focused Trait, Genes, Programs, and Data views, then use Guide or About for context.',
                image: docsFigureBrowserSurfaces,
                alt: 'Browser surface map showing Home, Trait, Genes, Programs, Data, and documentation routes',
            },
        ],
        releaseEyebrow: 'Release',
        releaseTitle: 'Full release log',
        releaseSubtitle: 'A longer milestone view of the project since May 7, 2026, written as readable product notes instead of raw commit text.',
        sections: [
            {
                icon: InsightsOutlined,
                title: 'What This Browser Covers',
                body: 'LoF Gene-Program-Trait Browser is a project-facing scientific browser for moving between trait signals, gene evidence, program annotations, and underlying output files.',
                bullets: [
                    'It combines route-level navigation, metadata lookup, chart interpretation, evidence tables, and file export in one interface.',
                    'The UI is organized so a user can start from a trait, a gene, a program, or a file path and still reach the linked downstream context.',
                ],
            },
            {
                icon: StorageOutlined,
                title: 'What The Data Includes',
                body: 'The frontend mixes database-backed metadata with indexed analysis outputs produced by the LoF, perturb-seq, enrichment, and export workflow.',
                bullets: [
                    'Trait metadata, GWAS identifiers, and study information come from MySQL-backed endpoints.',
                    'Manhattan plots, burden and posterior volcano tables, program scatter data, graph-linked TSV outputs, and gene evidence tables are loaded from indexed result files.',
                    'Data Browser exposes the directory structure directly so the analytical pages and the raw outputs stay traceable to the same artifacts.',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: 'How The App Is Structured',
                body: 'Each major route is scoped to one browsing mode so search, analysis, gene review, program review, and export stay distinct.',
                bullets: [
                    'Home is the fast search surface for files, directories, GCST accessions, and common output labels.',
                    'Trait is the main analysis surface for metadata, figure tabs, and chart-linked tables.',
                    'Genes and Programs provide dedicated drilldown views for gene evidence and cNMF program annotation.',
                    'Data Browser is the raw file, folder, and batch download layer; Guide and About provide route-level context.',
                ],
            },
            {
                icon: BiotechOutlined,
                title: 'Recommended Starting Points',
                body: 'Choose the first page based on the immediate question instead of following a fixed route every time.',
                bullets: [
                    'If you know the trait or study ID, start from Trait and open the relevant figure tab.',
                    'If you are checking a single gene across programs and traits, start from Genes.',
                    'If you are reviewing program annotation or regulator direction, start from Programs.',
                    'If you need the exact artifact path or a download batch, continue in Data Browser.',
                ],
            },
        ],
        footerTitle: 'Scope',
        footerBody: 'This browser is intended for exploration, interpretation, and export of project outputs. It is not a public knowledge portal or a general-purpose genomics database browser; it is a focused interface over this project workflow.',
        footerChip: 'Project-facing workspace',
    },
    zh: {
        title: '关于项目',
        subtitle: '用一页快速说明这个浏览器的页面分工、分析流程如何进入前端，以及 trait、gene、program、文件分别应从哪里开始。',
        language: '语言',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: '打开 Trait 浏览器', to: '/trait' },
            { label: '打开 Genes', to: '/genes' },
            { label: '打开 Programs', to: '/programs' },
            { label: '打开数据浏览器', to: '/data' },
        ],
        heroChips: ['Trait 分析入口', 'Gene 证据钻取', '结果下载'],
        figureCards: [
            {
                title: '分析工作流',
                body: '这张图对应项目结果如何进入前端：先定位 trait，再连接 LoF、perturb-seq program 建模、association，最后落到浏览器展示。',
                image: homeFigureBrowserWorkflow,
                alt: '从 GWAS 和 LoF 到网页展示的分析工作流',
            },
            {
                title: '页面结构图',
                body: '这张图对应用户在前端里的实际走法：从 Home 搜索进入 Trait、Genes、Programs、Data，再回到 Guide 或 About 查看说明。',
                image: docsFigureBrowserSurfaces,
                alt: '展示 Home、Trait、Genes、Programs、Data 和说明页面关系的页面结构图',
            },
        ],
        releaseEyebrow: '版本',
        releaseTitle: '完整版本记录',
        releaseSubtitle: '这里汇总了 2026 年 5 月 7 日以来的主要里程碑，用可读的版本说明而不是直接复制 git 提交信息。',
        sections: [
            {
                icon: InsightsOutlined,
                title: '这个浏览器覆盖什么',
                body: 'LoF Gene-Program-Trait Browser 是一个面向项目结果的科研数据浏览器，用来连接 trait 信号、gene 证据、program 注释和原始输出文件。',
                bullets: [
                    '它把路由导航、元信息检索、图表解释、证据表格和文件导出放在同一个界面里。',
                    '用户可以从 trait、gene、program 或文件路径任一入口进入，再跳转到对应的下游上下文。',
                ],
            },
            {
                icon: StorageOutlined,
                title: '数据包含什么',
                body: '前端同时整合数据库元信息和项目工作流生成的文件型分析结果。',
                bullets: [
                    'Trait metadata、GWAS 标识和 study 信息来自 MySQL 支持的接口。',
                    'Manhattan、burden/posterior volcano、program scatter、graph 关联 TSV 和 gene evidence 表等结果来自已索引输出文件。',
                    'Data Browser 直接暴露目录结构，让分析页和底层结果文件始终能互相对应。',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: '应用如何分区',
                body: '主要页面按浏览任务分区，让搜索、分析、gene 核查、program 核查和导出保持清晰分工。',
                bullets: [
                    'Home 适合快速搜索文件、目录、GCST accession 和常用输出标签。',
                    'Trait 是主要分析界面，集中展示 metadata、figure tabs 和图表联动表格。',
                    'Genes 和 Programs 提供 gene 证据钻取与 cNMF program 注释的独立界面。',
                    'Data Browser 负责原始文件、目录和批量下载；Guide 与 About 负责说明和定位。',
                ],
            },
            {
                icon: BiotechOutlined,
                title: '推荐起点',
                body: '更推荐按当前问题选入口，而不是每次都走同一条固定路径。',
                bullets: [
                    '如果你知道 trait 或 study ID，从 Trait 开始并打开对应 figure tab。',
                    '如果你要检查某个 gene 在 programs 和 traits 里的证据，从 Genes 开始。',
                    '如果你要复核 program 注释或 regulator 方向，从 Programs 开始。',
                    '如果你需要精确文件路径或批量下载，继续进入 Data Browser。',
                ],
            },
        ],
        footerTitle: '定位',
        footerBody: '这个浏览器的定位是项目结果浏览、解释和导出工具，不是公开知识门户，也不是通用基因组学数据库浏览器；它服务于当前项目工作流本身。',
        footerChip: '项目内部工作界面',
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

function FigureCard({ figure, index }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: 0,
                overflow: 'hidden',
                backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
            })}
        >
            <Box
                component="img"
                src={figure.image}
                alt={figure.alt}
                loading="lazy"
                sx={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                }}
            />
            <Box sx={{ p: { xs: 1.5, md: 1.8 } }}>
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.7 }}>
                    <Chip
                        icon={<ArticleOutlined sx={{ fontSize: 15 }} />}
                        label={figure.title}
                        size="small"
                        sx={summaryChipSx(theme, metricChipTone(theme, index % 2 === 0 ? 'primary' : 'success'))}
                    />
                </Stack>
                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                    {figure.body}
                </Typography>
            </Box>
        </Paper>
    );
}

export default function About() {
    const theme = useTheme();
    const location = useLocation();
    const [language, setLanguage] = React.useState('en');
    const copy = COPY[language];

    React.useEffect(() => {
        if (!location.hash) return undefined;

        const targetId = location.hash.replace(/^#/, '');
        const target = document.getElementById(targetId);
        if (!target) return undefined;

        const rafId = window.requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
        });

        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [location.hash]);

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
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
                })}
            >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                    <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                        {copy.heroChips.map((label) => (
                            <Chip key={label} label={label} sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))} />
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
                                endIcon={<LaunchOutlined sx={{ fontSize: 16 }} />}
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
                    gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                    mb: 2,
                }}
            >
                {copy.figureCards.map((figure, index) => (
                    <FigureCard key={figure.title} figure={figure} index={index} />
                ))}
            </Box>

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

            <ReleaseLogSection
                anchorId={RELEASE_LOG_ANCHOR}
                eyebrow={copy.releaseEyebrow}
                entries={releaseEntriesByLocale[language]}
                heading={copy.releaseTitle}
                subtitle={copy.releaseSubtitle}
                outerSx={{ mb: 2 }}
            />

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
                        icon={<DataObjectOutlined sx={{ fontSize: 16 }} />}
                        label={copy.footerChip}
                        sx={summaryChipSx(theme, metricChipTone(theme, 'success'))}
                    />
                </Stack>
            </Paper>
        </PageFrame>
    );
}
