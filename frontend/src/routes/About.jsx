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
        subtitle: 'TraitVista is a project-oriented browser for reviewing GWAS trait signals, loss-of-function gene evidence, perturb-seq programs, and downloadable analysis outputs in a single interface.',
        language: 'Language',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Open Home Search', to: '/' },
            { label: 'Open Trait Browser', to: '/trait' },
            { label: 'Open Gene Browser', to: '/genes' },
            { label: 'Open Program Browser', to: '/programs' },
            { label: 'Open Data Browser', to: '/data' },
        ],
        heroChips: ['GWAS trait signals', 'Loss-of-function gene evidence', 'Perturb-seq programs', 'Downloadable analysis outputs'],
        dataStatistics: {
            title: 'Data Coverage Summary',
            body: 'This section summarizes the indexed coverage available to the browser, including GWAS records, genetic variants, significant loci, perturb-seq programs, and result files.',
            chip: 'Live API summary',
            emptyValue: 'Not available',
            errorTitle: 'Statistics unavailable',
            errorBody: 'The coverage summary request failed.',
            emptyTitle: 'No coverage statistics yet',
            emptyBody: 'The home statistics endpoint did not return measurable coverage values.',
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
                summaryBody: 'Catalog-scale measures are shown on a logarithmic axis so the much larger variant count does not obscure trait, locus, and file totals. Annotation dimensions are shown on a linear count axis.',
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
                title: 'Derived Coverage Density',
                body: 'These ratios convert raw totals into normalized browsing density, supporting comparison across catalog scale, result-file depth, and source coverage.',
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
        releaseSubtitle: 'A milestone-level record of the project since May 7, 2026. Each entry describes the scientific browsing capability introduced or refined at that stage.',
        releaseSummary: [
            { label: 'History span', value: 'May 7 - Jun 3, 2026' },
            { label: 'Milestones', value: '15 releases' },
            { label: 'Coverage', value: 'Home, Trait, Genes, Programs, Data Browser' },
        ],
        sections: [
            {
                icon: InsightsOutlined,
                title: 'Scope of TraitVista',
                body: 'TraitVista supports scientific review of project outputs by linking trait-level associations, gene-level evidence, program annotations, and the source files that generate each view.',
                bullets: [
                    'The interface combines search, trait metadata, analytical figures, chart-linked evidence tables, gene and program drilldowns, and file export within a single browsing workflow.',
                    'A result can usually be accessed from the trait, gene, program, or file context, allowing researchers to begin from the information they already have.',
                    'Visual interpretation remains connected to the underlying TSV files and directory context so plots, tables, and downloadable artifacts can be verified together.',
                ],
            },
            {
                icon: StorageOutlined,
                title: 'Data Sources and Outputs',
                body: 'The application combines database-backed metadata with indexed analysis outputs generated by the loss-of-function, perturb-seq, enrichment, and export workflows.',
                bullets: [
                    'Trait metadata, GWAS identifiers, study information, and imported gene-program-trait indexes are retrieved from API-backed data sources.',
                    'Manhattan plots, burden and posterior volcano tables, program scatter views, trait-program graph inputs, gene evidence views, gene QQ plots, and cross-trait heatmaps are driven by indexed result files.',
                    'The Data Browser exposes the result directory structure so analytical pages and raw outputs remain traceable to the same artifacts.',
                    'Download and CSV export controls are treated as part of the review workflow rather than as a separate archival page.',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: 'Application Structure',
                body: 'Each major route is aligned with a distinct browsing task so search, trait analysis, gene review, program review, and data export remain clear.',
                bullets: [
                    'Home provides rapid search across files, directories, GCST accessions, common output labels, featured figures, and release milestones.',
                    'Trait is the primary analysis surface for metadata and figure views, including program scatter, trait-program graphs, Manhattan plots, volcano plots, gene evidence, gene QQ plots, and cross-trait heatmaps.',
                    'Gene and Program pages provide focused drilldowns for gene evidence, cNMF program annotation, regulator direction, and associated traits.',
                    'The Data Browser handles raw files, folders, global search, ZIP export, and batch download, while Guide, Contact, and About provide page-level context.',
                ],
            },
            {
                icon: BiotechOutlined,
                title: 'Recommended Starting Points',
                body: 'Select the entry point based on the object already known, rather than following one fixed path for every question.',
                bullets: [
                    'If you know a GCST accession, trait, loss-of-function identifier, or GWAS identifier, start from Trait and open the relevant figure view.',
                    'If you know a gene symbol or Ensembl identifier, start from Gene and review gene information, program relationships, and trait evidence.',
                    'If you know a cNMF program or need to review regulator direction, start from Program and inspect the associated trait table.',
                    'If you know a filename, folder, or output label, start from Home search or Data Browser global search, then open or download the matching directory or file.',
                ],
            },
        ],
        footerTitle: 'Scope',
        footerBody: 'TraitVista is intended for exploration, interpretation, verification, and export of project outputs. It is not a general-purpose genomics database and does not replace statistical review of the underlying GWAS and loss-of-function analyses.',
        footerChip: 'Project result browser',
    },
    zh: {
        title: '关于项目',
        subtitle: 'TraitVista 是面向项目结果的科研浏览器，用于在同一界面中查看全基因组关联研究（GWAS）性状信号、功能缺失（LoF）基因证据、扰动测序（perturb-seq）程序和可下载分析结果。',
        language: '语言',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: '打开首页搜索', to: '/' },
            { label: '打开性状浏览器', to: '/trait' },
            { label: '打开基因页面', to: '/genes' },
            { label: '打开程序页面', to: '/programs' },
            { label: '打开数据浏览器', to: '/data' },
        ],
        heroChips: ['GWAS 性状信号', '功能缺失基因证据', '扰动测序程序', '可下载分析结果'],
        dataStatistics: {
            title: '数据覆盖统计',
            body: '本节概述当前已被浏览器索引的数据范围，包括 GWAS 记录、遗传变异、显著关联位点、扰动测序程序和结果文件。',
            chip: '实时 API 汇总',
            emptyValue: '暂无数据',
            errorTitle: '统计信息不可用',
            errorBody: '覆盖统计请求失败。',
            emptyTitle: '暂无覆盖统计',
            emptyBody: '首页统计接口没有返回可展示的覆盖数值。',
            metrics: {
                traits: { label: 'GWAS 性状' },
                variants: { label: '已索引变异' },
                significantLoci: { label: '显著关联位点' },
                dataOutputs: { label: '结果文件' },
            },
            supplemental: {
                title: '补充覆盖范围',
                chartAria: '补充覆盖范围柱状图和文本摘要',
                summaryTitle: '覆盖计数',
                countAxisLabel: '计数',
                items: {
                    programs: { label: '扰动测序程序' },
                    populations: { label: '人群分组' },
                    sourceBatches: { label: '数据来源批次' },
                    studyYears: { label: '覆盖研究年份' },
                },
            },
            chart: {
                chartAria: '数据覆盖柱状图和文本摘要',
                catalogScale: '目录规模',
                annotationScale: '注释规模',
                logAxisLabel: '对数计数',
                countAxisLabel: '计数',
                summaryTitle: '覆盖维度',
                summaryBody: '目录规模指标使用对数坐标轴展示，以避免变异数量过大而遮蔽性状、位点和文件总量；注释维度使用线性计数坐标轴展示。',
                dimensions: {
                    traits: { label: '性状' },
                    variants: { label: '变异' },
                    significantLoci: { label: '显著关联位点' },
                    programs: { label: '程序' },
                    dataOutputs: { label: '数据输出' },
                    populations: { label: '人群' },
                    sourceBatches: { label: '来源批次' },
                },
            },
            studySpan: {
                yearRange: '研究年份',
                latestCollectDate: '最近数据收集日期',
                populations: '人群数量',
                sourceBatches: '来源批次',
            },
            derived: {
                title: '派生覆盖密度',
                body: '这些比率将原始总量转换为标准化浏览密度，用于比较目录规模、结果文件深度和数据来源覆盖。',
                chartAria: '派生覆盖密度柱状图和文本摘要',
                summaryTitle: '密度比率',
                logAxisLabel: '对数比率',
                items: {
                    variantsPerTrait: { label: '每个性状的变异数', unit: '变异数/性状' },
                    lociPerTrait: { label: '每个性状的显著关联位点', unit: '位点数/性状' },
                    lociPerMillionVariants: { label: '每百万变异的显著关联位点', unit: '位点数/百万变异' },
                    filesPerTrait: { label: '每个性状的结果文件', unit: '文件数/性状' },
                    filesPerProgram: { label: '每个程序的结果文件', unit: '文件数/程序' },
                    traitsPerYear: { label: '每个研究年份的性状数', unit: '性状数/年' },
                    traitsPerBatch: { label: '每个来源批次的性状数', unit: '性状数/批次' },
                    variantsPerPopulation: { label: '每个人群分组的变异数', unit: '变异数/人群' },
                },
            },
        },
        releaseEyebrow: '版本',
        releaseTitle: '完整版本记录',
        releaseSubtitle: '这里记录了 2026 年 5 月 7 日以来的主要里程碑。每条记录说明该阶段新增或完善的科研浏览能力。',
        releaseSummary: [
            { label: '历史范围', value: '2026-05-07 至 2026-06-03' },
            { label: '里程碑', value: '15 个版本' },
            { label: '覆盖页面', value: '首页、性状、基因、程序、数据浏览器' },
        ],
        sections: [
            {
                icon: InsightsOutlined,
                title: 'TraitVista 的覆盖范围',
                body: 'TraitVista 支持对项目结果进行科研复核，将性状层面的关联信号、基因层面的证据、程序注释和生成各类视图的源文件联系起来。',
                bullets: [
                    '界面将检索、性状元数据、分析图形、图表联动证据表、基因与程序钻取以及文件导出整合到同一浏览流程中。',
                    '同一结果通常可以从性状、基因、程序或文件四个入口进入，便于研究者根据已知信息选择路径。',
                    '图形解释与底层 TSV 文件和目录上下文保持关联，使图表、表格和可下载结果能够共同核查。',
                ],
            },
            {
                icon: StorageOutlined,
                title: '数据来源与结果文件',
                body: '应用同时整合数据库元信息和由功能缺失、扰动测序、富集分析及导出流程生成的文件型分析结果。',
                bullets: [
                    '性状元数据、GWAS 标识符、研究信息以及导入后的基因-程序-性状索引来自后端数据源。',
                    '曼哈顿图、负担检验火山图、后验概率火山图、程序散点图、性状-程序图、基因证据、基因 QQ 图和跨性状热图均由已索引结果文件驱动。',
                    '数据浏览器直接呈现结果目录结构，使分析页面和底层结果文件始终可以互相追溯。',
                    '下载和 CSV 导出属于分析复核流程的一部分，而不是独立的归档页面。',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: '应用结构',
                body: '主要页面按浏览任务分区，使检索、性状分析、基因复核、程序复核和数据导出保持清晰分工。',
                bullets: [
                    '首页用于快速检索文件、目录、GCST 编号、常用输出标签、代表性图形和版本里程碑。',
                    '性状页是主要分析界面，用于查看元数据以及程序散点图、性状-程序图、曼哈顿图、火山图、基因证据、基因 QQ 图和跨性状热图等图形视图。',
                    '基因页和程序页提供基因证据、cNMF 程序注释、调控因子方向和关联性状的独立钻取界面。',
                    '数据浏览器负责原始文件、目录、全局搜索、压缩包导出和批量下载；指南、联系和关于页面提供页面级说明。',
                ],
            },
            {
                icon: BiotechOutlined,
                title: '推荐起点',
                body: '建议根据已经掌握的研究对象选择入口，而不是对所有问题使用同一条固定路径。',
                bullets: [
                    '如果已知 GCST 编号、性状、功能缺失标识符或 GWAS 标识符，可从性状页进入并打开对应图形视图。',
                    '如果已知基因符号或 Ensembl 标识符，可从基因页进入，查看基因信息、程序关系和性状证据。',
                    '如果已知 cNMF 程序，或需要复核调控因子方向，可从程序页进入并查看关联性状表。',
                    '如果已知文件名、文件夹或输出标签，可从首页搜索或数据浏览器的全局搜索进入，再打开或下载对应目录和文件。',
                ],
            },
        ],
        footerTitle: '定位',
        footerBody: 'TraitVista 用于项目结果的浏览、解释、核查和导出。它不是通用基因组学数据库，也不能替代对底层 GWAS 与功能缺失分析的统计复核。',
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

            <AboutDataStatistics copy={copy.dataStatistics} locale={language} />

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
