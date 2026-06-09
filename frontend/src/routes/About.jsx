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
    BiotechOutlined,
    DataObjectOutlined,
    InsightsOutlined,
    LanguageOutlined,
    LaunchOutlined,
    StorageOutlined,
} from '@mui/icons-material';
import { PageFrame } from '../components/PageScaffold';
import AboutDataStatistics from '../components/AboutDataStatistics';
import ReleaseLogSection from '../components/ReleaseLogSection';
import { RELEASE_LOG_ANCHOR, releaseEntriesByLocale } from '../components/releaseLogData';
import { captionSx, metricChipTone, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';

const COPY = {
    en: {
        title: 'About',
        subtitle: 'TraitVista connects GWAS traits, LoF gene evidence, perturb-seq programs, and downloadable result files in one project-facing browser.',
        language: 'Language',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Open Home Search', to: '/' },
            { label: 'Open Trait Browser', to: '/trait' },
            { label: 'Open Genes', to: '/genes' },
            { label: 'Open Programs', to: '/programs' },
            { label: 'Open Data Browser', to: '/data' },
        ],
        heroChips: ['GWAS trait signals', 'LoF gene evidence', 'Perturb-seq programs', 'Downloadable outputs'],
        dataStatistics: {
            title: 'Data Coverage Statistics',
            body: 'A compact view of how much GWAS, LoF, perturb-seq, and result-file evidence is currently indexed for browsing.',
            chip: 'Live API summary',
            emptyValue: 'Not available',
            errorTitle: 'Statistics unavailable',
            errorBody: 'The coverage summary request failed.',
            emptyTitle: 'No coverage statistics yet',
            emptyBody: 'The home statistics endpoint returned no measurable coverage values.',
            metrics: {
                traits: { label: 'GWAS traits' },
                variants: { label: 'Variants indexed' },
                significantLoci: { label: 'Significant loci' },
                dataOutputs: { label: 'Result files' },
            },
            supplemental: {
                title: 'Additional coverage',
                chartAria: 'Additional coverage bar chart and text summary',
                summaryTitle: 'Coverage counts',
                countAxisLabel: 'count',
                items: {
                    programs: { label: 'Perturb-seq programs' },
                    populations: { label: 'Population groups' },
                    sourceBatches: { label: 'Source batches' },
                    studyYears: { label: 'Study years covered' },
                },
            },
            chart: {
                chartAria: 'Data coverage bar charts and text summary',
                catalogScale: 'Catalog scale',
                annotationScale: 'Annotation scale',
                logAxisLabel: 'log count',
                countAxisLabel: 'count',
                summaryTitle: 'Coverage dimensions',
                summaryBody: 'The catalog chart uses a log axis so variants do not hide smaller trait, locus, and file counts. Annotation dimensions stay on a linear count axis.',
                dimensions: {
                    traits: { label: 'Traits' },
                    variants: { label: 'Variants' },
                    significantLoci: { label: 'Significant loci' },
                    programs: { label: 'Programs' },
                    dataOutputs: { label: 'Data outputs' },
                    populations: { label: 'Populations' },
                    sourceBatches: { label: 'Source batches' },
                },
            },
            studySpan: {
                yearRange: 'Study years',
                latestCollectDate: 'Latest collection',
                populations: 'Populations',
                sourceBatches: 'Source batches',
            },
            derived: {
                title: 'Derived coverage density',
                body: 'These ratios translate raw totals into browsing density, helping compare catalog scale, result-file depth, and source coverage.',
                chartAria: 'Derived coverage density bar chart and text summary',
                summaryTitle: 'Density ratios',
                logAxisLabel: 'log ratio',
                items: {
                    variantsPerTrait: { label: 'Variants per trait', unit: 'variants / trait' },
                    lociPerTrait: { label: 'Significant loci per trait', unit: 'loci / trait' },
                    lociPerMillionVariants: { label: 'Significant loci per 1M variants', unit: 'loci / 1M variants' },
                    filesPerTrait: { label: 'Result files per trait', unit: 'files / trait' },
                    filesPerProgram: { label: 'Result files per program', unit: 'files / program' },
                    traitsPerYear: { label: 'Traits per study year', unit: 'traits / year' },
                    traitsPerBatch: { label: 'Traits per source batch', unit: 'traits / batch' },
                    variantsPerPopulation: { label: 'Variants per population group', unit: 'variants / population' },
                },
            },
        },
        releaseEyebrow: 'Release',
        releaseTitle: 'Full release log',
        releaseSubtitle: 'A longer milestone view of the project since May 7, 2026, written as readable product notes instead of raw commit text.',
        releaseSummary: [
            { label: 'History span', value: 'May 7 - Jun 3, 2026' },
            { label: 'Milestones', value: '15 releases' },
            { label: 'Coverage', value: 'Home, Trait, Genes, Programs, Data' },
        ],
        sections: [
            {
                icon: InsightsOutlined,
                title: 'What TraitVista Covers',
                body: 'TraitVista is a scientific result browser for moving between trait signals, gene evidence, program annotations, and the files that produced each view.',
                bullets: [
                    'It combines Home search, trait metadata, figure tabs, chart-linked evidence tables, gene and program drilldowns, and file export in one interface.',
                    'The same result can usually be approached from multiple directions: trait-first, gene-first, program-first, or file-first.',
                    'The browser is meant to keep interpretation close to the source artifact instead of separating plots from their downloadable TSV or directory context.',
                ],
            },
            {
                icon: StorageOutlined,
                title: 'What The Data Includes',
                body: 'The frontend mixes database-backed metadata with indexed analysis outputs produced by the LoF, perturb-seq, enrichment, and export workflow.',
                bullets: [
                    'Trait metadata, GWAS identifiers, study information, and imported gene-program-trait indexes come from API-backed data sources.',
                    'Manhattan plots, burden and posterior volcano tables, Program Scatter data, Trait Program Graph TSVs, Gene Evidence, Gene QQ, and Cross-trait Heatmap inputs are loaded from indexed result files.',
                    'Data Browser exposes the directory structure directly so analytical pages and raw outputs stay traceable to the same artifacts.',
                    'Download and CSV export controls are part of the analysis workflow, not a separate archive-only section.',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: 'How The App Is Structured',
                body: 'Each major route is scoped to one browsing mode so search, analysis, gene review, program review, and export stay distinct.',
                bullets: [
                    'Home is the fast search surface for files, directories, GCST accessions, common output labels, featured figures, and release milestones.',
                    'Trait is the main analysis surface for metadata plus Program Scatter, Trait Program Graph, Manhattan, volcano, Gene Evidence, Gene QQ, and Cross-trait Heatmap tabs.',
                    'Genes and Programs provide dedicated drilldown views for gene evidence, cNMF program annotation, regulator direction, and associated traits.',
                    'Data Browser is the raw file, folder, global-search, ZIP, and batch-download layer; Guide, Contact, and About provide route-level context.',
                ],
            },
            {
                icon: BiotechOutlined,
                title: 'Recommended Starting Points',
                body: 'Choose the first page based on the object you already know instead of following a fixed route every time.',
                bullets: [
                    'If you know a GCST accession, trait, LoF ID, or GWAS ID, start from Trait and open the relevant figure tab.',
                    'If you know a gene symbol or Ensembl ID, start from Genes and review gene information, program relationships, and trait evidence.',
                    'If you know a cNMF program or want to review regulator direction, start from Programs and open the associated traits table.',
                    'If you know a filename, folder, or output label, start from Home search or Data Browser global search, then download or open the matching directory.',
                ],
            },
        ],
        footerTitle: 'Scope',
        footerBody: 'TraitVista is intended for exploration, interpretation, verification, and export of project outputs. It is not a general-purpose genomics database or a replacement for statistical review of the underlying GWAS and LoF analyses.',
        footerChip: 'Project result browser',
    },
    zh: {
        title: '关于项目',
        subtitle: 'TraitVista 在一个项目结果浏览器中连接 GWAS traits、LoF gene 证据、perturb-seq programs 和可下载结果文件。',
        language: '语言',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: '打开 Home 搜索', to: '/' },
            { label: '打开 Trait 浏览器', to: '/trait' },
            { label: '打开 Genes', to: '/genes' },
            { label: '打开 Programs', to: '/programs' },
            { label: '打开数据浏览器', to: '/data' },
        ],
        heroChips: ['GWAS trait 信号', 'LoF gene 证据', 'Perturb-seq programs', '结果下载'],
        dataStatistics: {
            title: '数据覆盖统计',
            body: '用紧凑统计视图概览当前已进入浏览器索引的 GWAS、LoF、perturb-seq 和结果文件覆盖范围。',
            chip: '实时 API 汇总',
            emptyValue: '暂无数据',
            errorTitle: '统计信息不可用',
            errorBody: '覆盖统计请求失败。',
            emptyTitle: '暂无覆盖统计',
            emptyBody: 'Home 统计接口没有返回可展示的覆盖数值。',
            metrics: {
                traits: { label: 'GWAS traits' },
                variants: { label: '已索引变异' },
                significantLoci: { label: '显著位点' },
                dataOutputs: { label: '结果文件' },
            },
            supplemental: {
                title: '补充覆盖量',
                chartAria: '补充覆盖量柱状图与文本摘要',
                summaryTitle: '覆盖计数',
                countAxisLabel: '数量',
                items: {
                    programs: { label: 'Perturb-seq programs' },
                    populations: { label: '人群分组' },
                    sourceBatches: { label: '来源批次' },
                    studyYears: { label: '覆盖研究年份' },
                },
            },
            chart: {
                chartAria: '数据覆盖柱状图与文本摘要',
                catalogScale: '目录规模',
                annotationScale: '注释规模',
                logAxisLabel: 'log 数量',
                countAxisLabel: '数量',
                summaryTitle: '覆盖维度',
                summaryBody: '目录规模图使用 log 轴，避免 variants 数量过大时压缩 traits、loci 和文件数量；注释维度保持线性计数。',
                dimensions: {
                    traits: { label: 'Traits' },
                    variants: { label: 'Variants' },
                    significantLoci: { label: 'Significant loci' },
                    programs: { label: 'Programs' },
                    dataOutputs: { label: 'Data outputs' },
                    populations: { label: 'Populations' },
                    sourceBatches: { label: 'Source batches' },
                },
            },
            studySpan: {
                yearRange: '研究年份',
                latestCollectDate: '最近收集日期',
                populations: '人群数量',
                sourceBatches: '来源批次',
            },
            derived: {
                title: '派生覆盖密度',
                body: '这些比率把原始总量转成浏览密度，用于比较目录规模、结果文件深度和来源覆盖。',
                chartAria: '派生覆盖密度柱状图与文本摘要',
                summaryTitle: '密度比率',
                logAxisLabel: 'log 比率',
                items: {
                    variantsPerTrait: { label: '每个 trait 的变异数', unit: 'variants / trait' },
                    lociPerTrait: { label: '每个 trait 的显著位点', unit: 'loci / trait' },
                    lociPerMillionVariants: { label: '每百万变异的显著位点', unit: 'loci / 1M variants' },
                    filesPerTrait: { label: '每个 trait 的结果文件', unit: 'files / trait' },
                    filesPerProgram: { label: '每个 program 的结果文件', unit: 'files / program' },
                    traitsPerYear: { label: '每个研究年份的 traits', unit: 'traits / year' },
                    traitsPerBatch: { label: '每个来源批次的 traits', unit: 'traits / batch' },
                    variantsPerPopulation: { label: '每个人群分组的变异数', unit: 'variants / population' },
                },
            },
        },
        releaseEyebrow: '版本',
        releaseTitle: '完整版本记录',
        releaseSubtitle: '这里汇总了 2026 年 5 月 7 日以来的主要里程碑，用可读的版本说明而不是直接复制 git 提交信息。',
        releaseSummary: [
            { label: '历史范围', value: '2026-05-07 至 2026-06-03' },
            { label: '里程碑', value: '15 个版本' },
            { label: '覆盖页面', value: 'Home、Trait、Genes、Programs、Data' },
        ],
        sections: [
            {
                icon: InsightsOutlined,
                title: 'TraitVista 覆盖什么',
                body: 'TraitVista 是一个科研结果浏览器，用来在 trait 信号、gene 证据、program 注释以及生成这些视图的结果文件之间来回切换。',
                bullets: [
                    '它把 Home 搜索、trait metadata、figure tabs、图表联动证据表、Genes/Programs 钻取和文件导出放在同一个界面里。',
                    '同一个结果通常可以从多个方向进入：trait-first、gene-first、program-first 或 file-first。',
                    '浏览器的目标是让解释过程尽量贴近源文件，而不是把图表和可下载 TSV 或目录上下文拆开。',
                ],
            },
            {
                icon: StorageOutlined,
                title: '数据包含什么',
                body: '前端同时整合数据库元信息和项目工作流生成的文件型分析结果。',
                bullets: [
                    'Trait metadata、GWAS 标识、study 信息以及导入后的 gene-program-trait 索引来自 API 支持的数据源。',
                    'Manhattan、burden/posterior volcano、Program Scatter、Trait Program Graph TSV、Gene Evidence、Gene QQ 和 Cross-trait Heatmap 的输入来自已索引结果文件。',
                    'Data Browser 直接暴露目录结构，让分析页和底层结果文件始终能互相对应。',
                    '下载和 CSV 导出属于分析流程的一部分，而不是单独的归档页面。',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: '应用如何分区',
                body: '主要页面按浏览任务分区，让搜索、分析、gene 核查、program 核查和导出保持清晰分工。',
                bullets: [
                    'Home 适合快速搜索文件、目录、GCST accession、常用输出标签、示例图和版本里程碑。',
                    'Trait 是主要分析界面，集中展示 metadata，以及 Program Scatter、Trait Program Graph、Manhattan、volcano、Gene Evidence、Gene QQ 和 Cross-trait Heatmap 等 tabs。',
                    'Genes 和 Programs 提供 gene 证据、cNMF program 注释、regulator 方向和关联 traits 的独立钻取界面。',
                    'Data Browser 负责原始文件、目录、全局搜索、ZIP 和批量下载；Guide、Contact 与 About 负责说明和定位。',
                ],
            },
            {
                icon: BiotechOutlined,
                title: '推荐起点',
                body: '更推荐按照你已经知道的对象选择入口，而不是每次都走同一条固定路径。',
                bullets: [
                    '如果你知道 GCST accession、trait、LoF ID 或 GWAS ID，从 Trait 开始并打开对应 figure tab。',
                    '如果你知道 gene symbol 或 Ensembl ID，从 Genes 开始查看 gene 信息、program 关系和 trait 证据。',
                    '如果你知道 cNMF program，或想复核 regulator 方向，从 Programs 开始查看 associated traits 表。',
                    '如果你知道文件名、文件夹或输出标签，从 Home 搜索或 Data Browser 全局搜索开始，再下载或打开对应目录。',
                ],
            },
        ],
        footerTitle: '定位',
        footerBody: 'TraitVista 用于项目结果的浏览、解释、核查和导出。它不是通用基因组学数据库，也不能替代对底层 GWAS 与 LoF 分析的统计审阅。',
        footerChip: '项目结果浏览器',
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

            <AboutDataStatistics copy={copy.dataStatistics} />

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
                summaryItems={copy.releaseSummary}
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
