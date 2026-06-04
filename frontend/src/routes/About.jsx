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
import ReleaseLogSection from '../components/ReleaseLogSection';
import { RELEASE_LOG_ANCHOR, releaseEntriesByLocale } from '../components/releaseLogData';
import { captionSx, metricChipTone, panelSx, sectionTitleSx, summaryChipSx } from '../themeUtils';

const COPY = {
    en: {
        title: 'About',
        subtitle: 'A concise overview of what this browser covers, how the data is organized, and where users should start.',
        language: 'Language',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Open Trait Browser', to: '/trait' },
            { label: 'Open Programs', to: '/programs' },
            { label: 'Open Data Browser', to: '/data' },
        ],
        heroChips: ['Trait-level browsing', 'Program enrichment', 'Downloadable outputs'],
        releaseEyebrow: 'Release',
        releaseTitle: 'Full release log',
        releaseSubtitle: 'A longer milestone view of the project since May 7, 2026, written as readable product notes instead of raw commit text.',
        sections: [
            {
                icon: InsightsOutlined,
                title: 'What This Browser Does',
                body: 'LoF Gene-Program-Trait Browser is a scientific data browser organized around a LoF -> gene -> regulator/program -> trait workflow.',
                bullets: [
                    'It combines metadata lookup, chart-based interpretation, and raw file access in one place.',
                    'The interface is designed for fast movement between trait discovery, figure inspection, and downstream download.',
                ],
            },
            {
                icon: StorageOutlined,
                title: 'What The Data Includes',
                body: 'The application brings together database-backed metadata and file-backed analysis outputs generated from the project workflow.',
                bullets: [
                    'Trait metadata, GWAS identifiers, and study information come from MySQL-backed endpoints.',
                    'Manhattan plots, burden and posterior volcano tables, program scatter data, and graph-linked TSV outputs come from indexed result files.',
                    'Data Browser exposes the underlying directory structure for direct retrieval and batch export.',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: 'How The App Is Structured',
                body: 'The main user flow is split into a few focused areas so that discovery and validation stay separate.',
                bullets: [
                    'Home is optimized for fast file and folder lookup.',
                    'Trait is the main analytical surface for plots, tables, and trait metadata.',
                    'Programs focuses on cNMF program annotation and gene regulation views.',
                    'Data Browser is the raw file and archive access layer.',
                ],
            },
            {
                icon: BiotechOutlined,
                title: 'Recommended Starting Points',
                body: 'New users usually get the best results by choosing an entry path based on their immediate question.',
                bullets: [
                    'If you know the trait or study ID, start from Trait.',
                    'If you need a result file quickly, start from Home search.',
                    'If you need the exact output artifact or batch download, continue in Data Browser.',
                ],
            },
        ],
        footerTitle: 'Scope',
        footerBody: 'This browser is intended for exploration, interpretation, and export of project outputs. It is not positioned as a public documentation site or a general-purpose genomics database browser.',
        footerChip: 'Project-facing workspace',
    },
    zh: {
        title: '关于项目',
        subtitle: '简要说明这个浏览器覆盖什么内容、数据如何组织，以及用户应当从哪里开始使用。',
        language: '语言',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: '打开 Trait 浏览器', to: '/trait' },
            { label: '打开 Programs', to: '/programs' },
            { label: '打开数据浏览器', to: '/data' },
        ],
        heroChips: ['Trait 级浏览', 'Program enrichment', '结果下载'],
        releaseEyebrow: '版本',
        releaseTitle: '完整版本记录',
        releaseSubtitle: '这里汇总了 2026 年 5 月 7 日以来的主要里程碑，用可读的版本说明而不是直接复制 git 提交信息。',
        sections: [
            {
                icon: InsightsOutlined,
                title: '这个浏览器做什么',
                body: 'LoF Gene-Program-Trait Browser 是一个科研数据浏览器，围绕 LoF 优先的 gene-program-trait 主链路组织结果浏览，并连接 perturb-seq regulator 与 trait 关联。',
                bullets: [
                    '它把元信息检索、图表解释和原始文件访问整合在同一个界面里。',
                    '页面流程强调 trait 发现、图形检查和后续下载之间的快速切换。',
                ],
            },
            {
                icon: StorageOutlined,
                title: '数据包含什么',
                body: '应用同时整合了数据库元信息和项目工作流产生的文件型分析结果。',
                bullets: [
                    'Trait metadata、GWAS 标识和 study 信息来自 MySQL 支持的接口。',
                    'Manhattan、burden/posterior volcano、program scatter 和图关联 TSV 等结果来自已索引的输出文件。',
                    'Data Browser 暴露底层目录结构，方便直接下载和批量导出。',
                ],
            },
            {
                icon: AccountTreeOutlined,
                title: '应用如何分区',
                body: '主要用户路径被拆成几个清晰区域，让发现和核查过程分离。',
                bullets: [
                    'Home 适合快速查找文件和目录。',
                    'Trait 是主要分析界面，集中展示图表、表格和 trait 元信息。',
                    'Programs 主要用于 cNMF program 注释和 gene regulation 视图。',
                    'Data Browser 是原始文件和归档下载入口。',
                ],
            },
            {
                icon: BiotechOutlined,
                title: '推荐起点',
                body: '新用户通常可以根据当前问题选择最合适的入口。',
                bullets: [
                    '如果你知道 trait 或 study ID，从 Trait 开始。',
                    '如果你要尽快找到某个结果文件，从 Home 搜索开始。',
                    '如果你需要精确输出文件或批量下载，继续进入 Data Browser。',
                ],
            },
        ],
        footerTitle: '定位',
        footerBody: '这个浏览器的定位是项目结果浏览、解释和导出工具，不是公开文档站点，也不是通用基因组学门户。',
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
