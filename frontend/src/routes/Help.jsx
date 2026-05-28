import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Button,
    Chip,
    Divider,
    Link,
    Paper,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    ArticleOutlined,
    BiotechOutlined,
    ChevronRightRounded,
    DataObjectOutlined,
    DownloadOutlined,
    FolderOpenOutlined,
    HubOutlined,
    InfoOutlined,
    InsightsOutlined,
    LanguageOutlined,
    ManageSearchOutlined,
    NavigationOutlined,
    ScienceOutlined,
    TableChartOutlined,
} from '@mui/icons-material';
import { PageFrame } from '../components/PageScaffold';
import {
    captionSx,
    metricChipTone,
    panelSx,
    sectionTitleSx,
    summaryChipSx,
    tableRowRevealSx,
} from '../themeUtils';

const TEXT = {
    en: {
        pageTitle: 'Web Guide',
        pageSubtitle: 'An English-first usage guide for the browser. Switch languages at any time to view the same content in Chinese.',
        open: 'Open',
        contents: 'Contents',
        sectionsAndMethods: (sectionCount, methodCount) => `${sectionCount} sections / ${methodCount} topics`,
        components: (count) => `${count} components`,
        recommendedWorkflow: 'Recommended workflow',
        workflowText: 'Start from Home or Trait to locate a trait, then inspect Manhattan, program enrichment, and gene-level views inside the Trait page. Use Data Browser for raw file browsing and batch downloads.',
        componentCoverageTitle: 'Component Coverage Index',
        componentCoverageBody: 'Visible routes and user-facing components are mapped to the guide entries below. Pure helpers, formatters, and loading skeletons stay grouped under their parent component.',
        mapped: (count) => `${count} mapped`,
        languageLabel: 'Language',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Trait List', to: '/trait', icon: <TableChartOutlined sx={{ fontSize: 17 }} /> },
            { label: 'Programs', to: '/programs', icon: <ScienceOutlined sx={{ fontSize: 17 }} /> },
            { label: 'Data Browser', to: '/data', icon: <DataObjectOutlined sx={{ fontSize: 17 }} /> },
        ],
        guideSections: [
            {
                id: 'navigation',
                title: 'Navigation',
                icon: NavigationOutlined,
                summary: 'Site entry points, desktop navigation, mobile menu, and shared state panels.',
                items: [
                    {
                        name: 'Top Navigation',
                        route: '/',
                        role: 'Primary desktop navigation bar.',
                        usage: [
                            'Use Home, Trait, Programs, Genes, Data, Guide, Contact, and About to move across the app.',
                            'The current route is highlighted, and the browser URL can be copied to share the current page.',
                        ],
                    },
                    {
                        name: 'MobileNavDrawer',
                        route: null,
                        role: 'Floating hamburger menu for mobile layouts.',
                        usage: [
                            'Tap the hamburger button to open the drawer and select a destination.',
                            'The button can be dragged to either screen edge and will snap into place after release.',
                        ],
                    },
                    {
                        name: 'PageScaffold / StatePanel',
                        route: null,
                        role: 'Shared layout, loading, empty, and error-state container.',
                        usage: [
                            'When you see Loading, No data, Page not found, or error messaging, verify the current filter state and API availability first.',
                            'If a Trait lacks a specific result file, its tab shows an explanation panel instead of a blank chart.',
                        ],
                    },
                ],
            },
            {
                id: 'home',
                title: 'Home',
                icon: ManageSearchOutlined,
                summary: 'Quick entry point for searching files, directories, GCST accessions, and program outputs.',
                items: [
                    {
                        name: 'Home File Search',
                        route: '/',
                        role: 'Fast file and folder discovery across the project outputs.',
                        usage: [
                            'Enter at least two characters to begin searching by filename, folder name, GCST accession, or program label.',
                            'Files in the result list can be selected for batch download or downloaded individually.',
                            'Folder results can be opened in Data Browser or downloaded as ZIP archives.',
                            'Press Enter to carry the current keyword into Data Browser global search.',
                        ],
                    },
                    {
                        name: 'Home Stats Cards',
                        route: '/',
                        role: 'Shortcut cards into the main browser areas.',
                        usage: [
                            'Select GWAS Traits to open the trait list.',
                            'Select Programs to open the program annotation table.',
                            'Select Data Files to open the data file browser.',
                        ],
                    },
                ],
            },
            {
                id: 'trait',
                title: 'Trait',
                icon: InsightsOutlined,
                summary: 'Trait browsing, metadata, and trait-level analysis views.',
                items: [
                    {
                        name: 'GwasDataList',
                        route: '/trait',
                        role: 'Trait table browser with search and pagination.',
                        usage: [
                            'Use the search box to filter by trait, LoF ID, or GWAS ID.',
                            'Sort by clicking column headers, and manage result volume with per-page, paging, and jump controls.',
                            'Open a trait row to enter its detail page.',
                        ],
                    },
                    {
                        name: 'TraitMetaCard',
                        route: '/trait',
                        role: 'Top metadata block on the trait detail page.',
                        usage: [
                            'Review trait name, LoF ID, GWAS ID, author, sample size, population, and variant summary fields.',
                            'PubMed and Source fields link to external references, while Program data chips indicate additional downstream views.',
                        ],
                    },
                    {
                        name: 'Trait Figure Tabs',
                        route: '/trait',
                        role: 'Entry point into Program Scatter, Trait Program Graph, Manhattan, Burden Volcano, and Posterior Volcano.',
                        usage: [
                            'Tabs with available data open normally; tabs without matching files are disabled or replaced with explanatory panels.',
                            'The page prefers available program-centric plots first and otherwise falls back to Manhattan.',
                        ],
                    },
                ],
            },
            {
                id: 'trait-figures',
                title: 'Trait Figures',
                icon: HubOutlined,
                summary: 'Detailed chart and table components inside the trait detail page.',
                items: [
                    {
                        name: 'ProgramScatter',
                        route: '/trait',
                        role: 'Trait-level scatter plot comparing program burden with regulator burden.',
                        usage: [
                            'Use Scatter mode for 2D score comparison and Rank mode for relative ranking views.',
                            'Colors separate program-enriched, regulator-enriched, both-enriched, and other categories.',
                            'Top N, marker size, bubble scaling, and label controls adjust density and readability.',
                            'Selecting a point highlights and scrolls to the matching row in the table below.',
                        ],
                    },
                    {
                        name: 'ProgramScatterTable',
                        route: '/trait',
                        role: 'Detail table for the Program Scatter view.',
                        usage: [
                            'Expand or collapse the data table as needed.',
                            'Sort by any supported column and open Program cells to jump into the related Program view.',
                            'Use Download CSV to export the current scatter table data.',
                        ],
                    },
                    {
                        name: 'TraitProgramGraph',
                        route: '/trait',
                        role: 'Relationship graph linking trait, programs, and regulator genes.',
                        usage: [
                            'The left side shows trait-program directionality, while the right side shows regulator-program directionality.',
                            'Gamma threshold, sign filters, max genes per program, visible side, and discordant-only filters control graph density.',
                            'Zoom controls, reset, and selection clearing manage navigation in the SVG workspace.',
                            'Download SVG and TSV for publication output or downstream review.',
                        ],
                    },
                    {
                        name: 'TraitProgramGraphSummary',
                        route: '/trait',
                        role: 'Full-width summary table underneath the graph.',
                        usage: [
                            'Inspect visible modules by side, program, source, score, and displayed gene counts.',
                            'Selecting a row syncs focus back into the graph and can expand crowded modules.',
                        ],
                    },
                    {
                        name: 'TraitHitManhattan',
                        route: '/trait',
                        role: 'Manhattan view for trait-level GWAS loci or full point sets.',
                        usage: [
                            'Switch between Hits TSV and Full TSV. If the hits file is unavailable, the view falls back automatically.',
                            'Color points by Program or Geneset, and combine chromosome, program, geneset, distance, gene, or rsID filters.',
                            'Program-only mode isolates annotated loci. Reset filters restores the default state.',
                            'The Plotly toolbar supports zoom, pan, and export actions.',
                        ],
                    },
                    {
                        name: 'TraitHitManhattanLegend',
                        route: '/trait',
                        role: 'Floating legend for the Manhattan view.',
                        usage: [
                            'Review active color encodings and category counts.',
                            'Collapse the legend when you need more room for the plot area.',
                        ],
                    },
                    {
                        name: 'TraitHitManhattanTable',
                        route: '/trait',
                        role: 'Locus detail table below the Manhattan plot.',
                        usage: [
                            'Expand or collapse the table from its header controls.',
                            'Search within the current result set by SNP, gene, or program and jump to matches.',
                            'Sort columns and export the processed table as CSV.',
                        ],
                    },
                    {
                        name: 'BurdenVolcano',
                        route: '/trait',
                        role: 'Shared gene-level plot for Burden Volcano and Posterior Volcano.',
                        usage: [
                            'Switch between hits and full TSV inputs. The view falls back automatically if a hits file lacks data.',
                            'Use direction filters, significance filters, and effect-size sliders to refine visible genes.',
                            'Clicking a point highlights the corresponding gene row in the table.',
                            'Export the chart as SVG or PNG from the plot controls.',
                        ],
                    },
                    {
                        name: 'BurdenVolcanoTable',
                        route: '/trait',
                        role: 'Gene-level detail table below each volcano plot.',
                        usage: [
                            'Review Gene, ENSG, effect, P, FDR, Program, and Geneset fields.',
                            'Sort columns, open Program links, and export the current table as CSV.',
                        ],
                    },
                ],
            },
            {
                id: 'programs',
                title: 'Programs',
                icon: ScienceOutlined,
                summary: 'Program annotation tables and program-level gene regulation plots.',
                items: [
                    {
                        name: 'Programs Table',
                        route: '/programs',
                        role: 'cNMF program annotation browser.',
                        usage: [
                            'Browse Program, Annotation, Representative GO, GO P, and Top Genes columns.',
                            'Sort supported columns and open a Program ID to reach its detail page.',
                        ],
                    },
                    {
                        name: 'GeneRegulation',
                        route: '/programs/P1',
                        role: 'Perturb-seq gene-level regulation plot for a single program.',
                        usage: [
                            'Use the program picker to switch programs by ID or annotation keyword.',
                            'The scatter plot maps effect size on x and -log10(P-value) on y, with colors for background and hit classes.',
                            'Hover for gene details, click to focus rows below, and use the Plotly toolbar for fullscreen or export.',
                        ],
                    },
                    {
                        name: 'GeneRegulationTable',
                        route: '/programs/P1',
                        role: 'Gene-level regulation table for a selected program.',
                        usage: [
                            'Expand or collapse the table and export the current program rows as CSV.',
                            'Sort columns and use the pager to change page size or jump between result pages.',
                        ],
                    },
                ],
            },
            {
                id: 'data',
                title: 'Data',
                icon: FolderOpenOutlined,
                summary: 'Directory browsing, global search, selection, and download workflows.',
                items: [
                    {
                        name: 'DataBrowser',
                        route: '/data',
                        role: 'Primary interface for navigating the data file tree.',
                        usage: [
                            'The default mode is column-style directory browsing. Open folders to append the next column and use breadcrumbs to move back.',
                            'Filter by name applies to the current browsing context, while Global switches into flat index search.',
                            'Select files for batch download and clear selections from the active chips.',
                        ],
                    },
                    {
                        name: 'DirectoryPanel',
                        route: '/data',
                        role: 'Single directory column inside Data Browser.',
                        usage: [
                            'Each column shows the current folder title and provides download actions for the folder or current filtered subset.',
                            'Files support checkbox selection and single download; folders support navigation and ZIP download.',
                            'Use the pager at the bottom when a directory contains many entries.',
                        ],
                    },
                    {
                        name: 'GlobalSearchResults',
                        route: '/data?mode=global',
                        role: 'Flattened search view across all indexed files and folders.',
                        usage: [
                            'Enter at least two characters to start searching. The first run may need time to build the search index.',
                            'Select all files, visible files, or individual files, then download all or selected results.',
                            'Folder actions open the parent directory context, while files and folders both support direct download.',
                        ],
                    },
                    {
                        name: 'DataBrowseSummary',
                        route: '/data',
                        role: 'Right-side summary panel for directory browsing mode.',
                        usage: [
                            'Review the current folder, active filter, file and folder counts, and a preview of selected files.',
                            'This panel is especially useful when you are working with a single visible directory column.',
                        ],
                    },
                ],
            },
            {
                id: 'support-pages',
                title: 'Other Pages',
                icon: InfoOutlined,
                summary: 'Genes, About, Contact, and shared floating legends.',
                items: [
                    {
                        name: 'Genes',
                        route: '/genes',
                        role: 'Placeholder page for future gene lookup workflows.',
                        usage: [
                            'The production gene endpoint is not connected yet, so use Trait or Programs for current gene-level exploration.',
                        ],
                    },
                    {
                        name: 'About',
                        route: '/about',
                        role: 'Project overview page.',
                        usage: [
                            'Use this page for a concise summary of trait browsing, program enrichment, and downloadable outputs.',
                        ],
                    },
                    {
                        name: 'Contact',
                        route: '/contact',
                        role: 'Project contact information page.',
                        usage: [
                            'Use the provided contact details when you encounter data, API, or page-level issues.',
                        ],
                    },
                    {
                        name: 'FloatingLegend',
                        route: null,
                        role: 'Reusable floating legend used by Manhattan, Volcano, Program Scatter, and Gene Regulation views.',
                        usage: [
                            'Use it to interpret color, marker, and count encodings for the active plot.',
                            'Collapse it when you need to reduce overlap with the chart area.',
                        ],
                    },
                ],
            },
            {
                id: 'downloads',
                title: 'Downloads & Export',
                icon: DownloadOutlined,
                summary: 'Raw data downloads, CSV export, ZIP export, and chart output.',
                items: [
                    {
                        name: 'File Download',
                        route: '/data',
                        role: 'Raw file or directory download workflow.',
                        usage: [
                            'Use row actions for single files and checkbox selection plus Download for multiple files.',
                            'Directory downloads are packaged as ZIP archives, and large requests may show a preparation phase first.',
                        ],
                    },
                    {
                        name: 'Table CSV Export',
                        route: '/trait',
                        role: 'CSV export from analysis tables.',
                        usage: [
                            'Most detail tables below charts provide Download CSV for the current processed result set.',
                            'These exports are suitable for review, further filtering, or supplementary tables.',
                        ],
                    },
                    {
                        name: 'Plot Export',
                        route: '/trait',
                        role: 'Chart image export workflow.',
                        usage: [
                            'Open the Plotly download control to choose export options.',
                            'Set width, height, and SVG or PNG output. Prefer SVG for publications or vector editing.',
                        ],
                    },
                ],
            },
        ],
        componentIndex: [
            {
                group: 'Routes',
                components: [
                    { name: 'App / Router', target: 'Top Navigation' },
                    { name: 'Home', target: 'Home File Search' },
                    { name: 'Trait', target: 'Trait Figure Tabs' },
                    { name: 'Programs', target: 'Programs Table' },
                    { name: 'Genes', target: 'Genes' },
                    { name: 'Variants / DataBrowser', target: 'DataBrowser' },
                    { name: 'Guide', target: 'Guide' },
                    { name: 'Contact', target: 'Contact' },
                    { name: 'About', target: 'About' },
                ],
            },
            {
                group: 'Shared UI',
                components: [
                    { name: 'MobileNavDrawer', target: 'MobileNavDrawer' },
                    { name: 'PageFrame', target: 'PageScaffold / StatePanel' },
                    { name: 'StatePanel', target: 'PageScaffold / StatePanel' },
                    { name: 'FloatingLegend', target: 'FloatingLegend' },
                    { name: 'Loading skeletons', target: 'PageScaffold / StatePanel' },
                ],
            },
            {
                group: 'Trait Views',
                components: [
                    { name: 'GwasDataList', target: 'GwasDataList' },
                    { name: 'TraitMetaCard', target: 'TraitMetaCard' },
                    { name: 'ProgramScatter', target: 'ProgramScatter' },
                    { name: 'ProgramScatterTable', target: 'ProgramScatterTable' },
                    { name: 'TraitProgramGraph', target: 'TraitProgramGraph' },
                    { name: 'TraitProgramGraphSummary', target: 'TraitProgramGraphSummary' },
                    { name: 'TraitHitManhattan', target: 'TraitHitManhattan' },
                    { name: 'TraitHitManhattanLegend', target: 'TraitHitManhattanLegend' },
                    { name: 'TraitHitManhattanTable', target: 'TraitHitManhattanTable' },
                    { name: 'BurdenVolcano', target: 'BurdenVolcano' },
                    { name: 'BurdenVolcanoTable', target: 'BurdenVolcanoTable' },
                ],
            },
            {
                group: 'Program & Data',
                components: [
                    { name: 'GeneRegulation', target: 'GeneRegulation' },
                    { name: 'GeneRegulationTable', target: 'GeneRegulationTable' },
                    { name: 'DataBrowseSummary', target: 'DataBrowseSummary' },
                    { name: 'DirColumn / DirectoryPanel', target: 'DirectoryPanel' },
                    { name: 'GlobalSearchResults', target: 'GlobalSearchResults' },
                    { name: 'Download utilities', target: 'File Download' },
                ],
            },
        ],
    },
    zh: {
        pageTitle: '网页指南',
        pageSubtitle: '默认展示英文说明，也可以随时切换到中文查看同一套页面和组件说明。',
        open: '打开',
        contents: '目录',
        sectionsAndMethods: (sectionCount, methodCount) => `${sectionCount} 个章节 / ${methodCount} 个主题`,
        components: (count) => `${count} 个组件`,
        recommendedWorkflow: '推荐使用路径',
        workflowText: '建议先在 Home 或 Trait 定位 trait，再在 Trait 页面查看 Manhattan、program enrichment 和 gene-level 结果；原始文件浏览和批量下载统一使用 Data Browser。',
        componentCoverageTitle: '组件覆盖索引',
        componentCoverageBody: '源码中的页面和可见组件都映射到下方说明条目；纯 helper、格式化函数和 loading skeleton 归入父组件。',
        mapped: (count) => `${count} 个映射`,
        languageLabel: '语言',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Trait 列表', to: '/trait', icon: <TableChartOutlined sx={{ fontSize: 17 }} /> },
            { label: 'Programs', to: '/programs', icon: <ScienceOutlined sx={{ fontSize: 17 }} /> },
            { label: '数据浏览器', to: '/data', icon: <DataObjectOutlined sx={{ fontSize: 17 }} /> },
        ],
        guideSections: [
            {
                id: 'navigation',
                title: '导航',
                icon: NavigationOutlined,
                summary: '全站入口、桌面导航、移动端菜单和通用状态面板。',
                items: [
                    {
                        name: 'Top Navigation',
                        route: '/',
                        role: '桌面端顶部主导航栏。',
                        usage: [
                            '使用 Home、Trait、Programs、Genes、Data、Guide、Contact 和 About 在应用中切换页面。',
                            '当前路由会高亮显示，浏览器地址可直接复制分享当前页面。',
                        ],
                    },
                    {
                        name: 'MobileNavDrawer',
                        route: null,
                        role: '移动端浮动汉堡菜单。',
                        usage: [
                            '点击汉堡按钮打开抽屉并选择页面。',
                            '按钮可拖动到屏幕左右边缘，松手后会自动贴边。',
                        ],
                    },
                    {
                        name: 'PageScaffold / StatePanel',
                        route: null,
                        role: '统一页面框架、加载态、空态和错误态容器。',
                        usage: [
                            '当出现 Loading、No data、Page not found 或错误信息时，先检查当前筛选条件和 API 可用性。',
                            '如果某个 Trait 缺少特定结果文件，对应 tab 会显示说明面板而不是空白图。',
                        ],
                    },
                ],
            },
            {
                id: 'home',
                title: '首页',
                icon: ManageSearchOutlined,
                summary: '用于快速搜索文件、目录、GCST accession 和 program 输出。',
                items: [
                    {
                        name: 'Home File Search',
                        route: '/',
                        role: '跨项目输出的快速文件和目录检索。',
                        usage: [
                            '输入至少 2 个字符后开始搜索，可按文件名、文件夹名、GCST accession 或 program 标签匹配。',
                            '结果中的文件可勾选后批量下载，也可单独下载。',
                            '文件夹结果可在 Data Browser 中打开，或直接下载 ZIP。',
                            '按 Enter 会把当前关键词带入 Data Browser 的全局搜索。',
                        ],
                    },
                    {
                        name: 'Home Stats Cards',
                        route: '/',
                        role: '进入主要功能区的快捷卡片。',
                        usage: [
                            '点击 GWAS Traits 打开 trait 列表。',
                            '点击 Programs 打开 program 注释表。',
                            '点击 Data Files 打开数据文件浏览器。',
                        ],
                    },
                ],
            },
            {
                id: 'trait',
                title: 'Trait',
                icon: InsightsOutlined,
                summary: 'Trait 浏览、元信息展示和 trait 级分析视图。',
                items: [
                    {
                        name: 'GwasDataList',
                        route: '/trait',
                        role: '支持搜索和分页的 trait 表格浏览器。',
                        usage: [
                            '使用搜索框按 trait、LoF ID 或 GWAS ID 过滤结果。',
                            '点击列表头排序，并用每页数量、分页和跳页控件管理结果量。',
                            '点击 trait 行进入详情页。',
                        ],
                    },
                    {
                        name: 'TraitMetaCard',
                        route: '/trait',
                        role: 'Trait 详情页顶部的元信息区块。',
                        usage: [
                            '查看 trait 名称、LoF ID、GWAS ID、作者、样本量、population 和 variant 汇总信息。',
                            'PubMed 和 Source 字段可跳转到外部参考来源，Program data 标签表示存在更多下游视图。',
                        ],
                    },
                    {
                        name: 'Trait Figure Tabs',
                        route: '/trait',
                        role: 'Program Scatter、Trait Program Graph、Manhattan、Burden Volcano 和 Posterior Volcano 的入口。',
                        usage: [
                            '有数据的 tab 可正常打开；没有匹配文件的 tab 会禁用或显示说明面板。',
                            '页面会优先展示可用的 program 相关图，否则回退到 Manhattan。',
                        ],
                    },
                ],
            },
            {
                id: 'trait-figures',
                title: 'Trait 图表',
                icon: HubOutlined,
                summary: 'Trait 详情页内的详细图表和表格组件。',
                items: [
                    {
                        name: 'ProgramScatter',
                        route: '/trait',
                        role: '比较 program burden 与 regulator burden 的 trait 级散点图。',
                        usage: [
                            'Scatter 模式用于二维 score 对比，Rank 模式用于相对排名视图。',
                            '颜色区分 program-enriched、regulator-enriched、both-enriched 和 other。',
                            'Top N、marker size、bubble scale 和 label 控件用于调节密度和可读性。',
                            '点击点位会高亮并滚动到下方对应表格行。',
                        ],
                    },
                    {
                        name: 'ProgramScatterTable',
                        route: '/trait',
                        role: 'Program Scatter 视图的明细表。',
                        usage: [
                            '可按需展开或收起数据表。',
                            '支持按列排序，并可通过 Program 单元格跳转到对应 Program 页面。',
                            '使用 Download CSV 导出当前散点图表格数据。',
                        ],
                    },
                    {
                        name: 'TraitProgramGraph',
                        route: '/trait',
                        role: '连接 trait、program 和 regulator genes 的关系图。',
                        usage: [
                            '左侧表示 trait-program 方向关系，右侧表示 regulator-program 方向关系。',
                            'Gamma threshold、sign 过滤、每个 program 展示的基因数、可见侧别和 discordant-only 都会影响图密度。',
                            '缩放、重置和清空选择用于管理 SVG 工作区视图。',
                            '可下载 SVG 和 TSV 用于论文或后续核查。',
                        ],
                    },
                    {
                        name: 'TraitProgramGraphSummary',
                        route: '/trait',
                        role: '图下方的全宽汇总表。',
                        usage: [
                            '按 side、program、来源、score 和当前显示的 gene 数查看可见 module。',
                            '选中某一行会同步聚焦图中的对应模块，并可展开拥挤模块。',
                        ],
                    },
                    {
                        name: 'TraitHitManhattan',
                        route: '/trait',
                        role: '展示 trait 级 GWAS loci 或完整点集的 Manhattan 图。',
                        usage: [
                            '可在 Hits TSV 和 Full TSV 之间切换；如果 hits 文件不可用会自动回退。',
                            '可按 Program 或 Geneset 着色，并结合 chromosome、program、geneset、distance、gene 或 rsID 过滤。',
                            'Program-only 模式可只保留带注释的 loci；Reset filters 可恢复默认状态。',
                            'Plotly 工具栏支持缩放、平移和导出。',
                        ],
                    },
                    {
                        name: 'TraitHitManhattanLegend',
                        route: '/trait',
                        role: 'Manhattan 图的浮动图例。',
                        usage: [
                            '查看当前颜色编码和分类数量。',
                            '当图例遮挡图区时可将其折叠。',
                        ],
                    },
                    {
                        name: 'TraitHitManhattanTable',
                        route: '/trait',
                        role: 'Manhattan 图下方的 loci 明细表。',
                        usage: [
                            '通过表头控件展开或收起表格。',
                            '按 SNP、gene 或 program 在当前结果集内搜索并跳转。',
                            '支持按列排序，并可导出当前处理后的 CSV。',
                        ],
                    },
                    {
                        name: 'BurdenVolcano',
                        route: '/trait',
                        role: 'Burden Volcano 和 Posterior Volcano 共用的 gene-level 图。',
                        usage: [
                            '可在 hits 和 full TSV 数据间切换；如果 hits 文件没有数据会自动回退。',
                            '方向过滤、显著性过滤和 effect-size slider 用于筛选可见 gene。',
                            '点击点位会高亮对应基因并定位下方表格。',
                            '可通过图形控件导出 SVG 或 PNG。',
                        ],
                    },
                    {
                        name: 'BurdenVolcanoTable',
                        route: '/trait',
                        role: '每个 volcano 图下方的 gene-level 明细表。',
                        usage: [
                            '查看 Gene、ENSG、effect、P、FDR、Program 和 Geneset 等字段。',
                            '支持按列排序、打开 Program 链接，并导出当前 CSV。',
                        ],
                    },
                ],
            },
            {
                id: 'programs',
                title: 'Programs',
                icon: ScienceOutlined,
                summary: 'Program 注释表和 program 级 gene regulation 图。',
                items: [
                    {
                        name: 'Programs Table',
                        route: '/programs',
                        role: 'cNMF program 注释浏览表。',
                        usage: [
                            '浏览 Program、Annotation、Representative GO、GO P 和 Top Genes 等列。',
                            '支持排序，并可通过 Program ID 打开详情页。',
                        ],
                    },
                    {
                        name: 'GeneRegulation',
                        route: '/programs/P1',
                        role: '单个 program 的 Perturb-seq gene-level regulation 图。',
                        usage: [
                            '可通过 program picker 按 ID 或注释关键词切换 program。',
                            '散点图 x 轴为 effect size，y 轴为 -log10(P-value)，颜色区分背景和 hit 类型。',
                            '悬停查看 gene 细节，点击聚焦下方表格，并可通过 Plotly 工具栏全屏或导出。',
                        ],
                    },
                    {
                        name: 'GeneRegulationTable',
                        route: '/programs/P1',
                        role: '选中 program 的 gene-level regulation 表。',
                        usage: [
                            '可展开或收起表格，并导出当前 program 的 CSV。',
                            '支持按列排序，并通过分页控件调整每页数量或切换页面。',
                        ],
                    },
                ],
            },
            {
                id: 'data',
                title: '数据',
                icon: FolderOpenOutlined,
                summary: '目录浏览、全局搜索、选择和下载流程。',
                items: [
                    {
                        name: 'DataBrowser',
                        route: '/data',
                        role: '浏览数据文件树的主界面。',
                        usage: [
                            '默认是列式目录浏览，打开文件夹会追加下一列，面包屑可返回上级。',
                            'Filter by name 只作用于当前浏览上下文，Global 则切到平铺索引搜索。',
                            '勾选文件后可批量下载，选中项可通过 chips 清除。',
                        ],
                    },
                    {
                        name: 'DirectoryPanel',
                        route: '/data',
                        role: 'Data Browser 中的单个目录列。',
                        usage: [
                            '每列展示当前目录标题，并提供目录整体或当前筛选子集的下载操作。',
                            '文件支持勾选和单独下载，文件夹支持继续进入或打包 ZIP 下载。',
                            '目录项较多时可使用底部分页器。',
                        ],
                    },
                    {
                        name: 'GlobalSearchResults',
                        route: '/data?mode=global',
                        role: '跨所有索引文件和文件夹的平铺搜索视图。',
                        usage: [
                            '输入至少 2 个字符开始搜索，首次搜索可能需要等待索引构建。',
                            '可选择全部文件、当前可见文件或单个文件，然后统一下载。',
                            '文件夹操作可打开其父目录上下文，文件和文件夹都支持直接下载。',
                        ],
                    },
                    {
                        name: 'DataBrowseSummary',
                        route: '/data',
                        role: '目录浏览模式下右侧的摘要面板。',
                        usage: [
                            '查看当前目录、活动过滤词、文件/文件夹数量以及已选文件预览。',
                            '当界面只显示一个目录列时，这个面板尤其适合确认当前上下文。',
                        ],
                    },
                ],
            },
            {
                id: 'support-pages',
                title: '其他页面',
                icon: InfoOutlined,
                summary: 'Genes、About、Contact 以及共享浮动图例。',
                items: [
                    {
                        name: 'Genes',
                        route: '/genes',
                        role: '后续 gene lookup 流程的占位页。',
                        usage: [
                            '当前 production 的 gene endpoint 尚未接入，现阶段请从 Trait 或 Programs 页面查看 gene-level 信息。',
                        ],
                    },
                    {
                        name: 'About',
                        route: '/about',
                        role: '项目简介页面。',
                        usage: [
                            '用于快速了解 trait browsing、program enrichment 和可下载输出的覆盖范围。',
                        ],
                    },
                    {
                        name: 'Contact',
                        route: '/contact',
                        role: '项目联系信息页面。',
                        usage: [
                            '当遇到数据、API 或页面层问题时，使用该页提供的联系方式。',
                        ],
                    },
                    {
                        name: 'FloatingLegend',
                        route: null,
                        role: 'Manhattan、Volcano、Program Scatter 和 Gene Regulation 共用的浮动图例。',
                        usage: [
                            '用于解释当前图中的颜色、标记和数量编码。',
                            '当图例遮挡图区时可折叠。',
                        ],
                    },
                ],
            },
            {
                id: 'downloads',
                title: '下载与导出',
                icon: DownloadOutlined,
                summary: '原始数据下载、CSV 导出、ZIP 打包和图像导出。',
                items: [
                    {
                        name: 'File Download',
                        route: '/data',
                        role: '原始文件或目录下载流程。',
                        usage: [
                            '单文件使用行内操作，多文件使用勾选后统一 Download。',
                            '目录会打包成 ZIP，大型请求可能先经历 Preparing 阶段。',
                        ],
                    },
                    {
                        name: 'Table CSV Export',
                        route: '/trait',
                        role: '分析表格的 CSV 导出。',
                        usage: [
                            '大多数图表下方的明细表都提供 Download CSV，用于导出当前处理后的结果集。',
                            '这些导出适合复核、进一步筛选或补充表整理。',
                        ],
                    },
                    {
                        name: 'Plot Export',
                        route: '/trait',
                        role: '图像导出流程。',
                        usage: [
                            '通过 Plotly 下载控件打开导出选项。',
                            '设置宽高和 SVG 或 PNG 输出；论文或矢量编辑优先使用 SVG。',
                        ],
                    },
                ],
            },
        ],
        componentIndex: [
            {
                group: 'Routes',
                components: [
                    { name: 'App / Router', target: 'Top Navigation' },
                    { name: 'Home', target: 'Home File Search' },
                    { name: 'Trait', target: 'Trait Figure Tabs' },
                    { name: 'Programs', target: 'Programs Table' },
                    { name: 'Genes', target: 'Genes' },
                    { name: 'Variants / DataBrowser', target: 'DataBrowser' },
                    { name: 'Guide', target: 'Guide' },
                    { name: 'Contact', target: 'Contact' },
                    { name: 'About', target: 'About' },
                ],
            },
            {
                group: 'Shared UI',
                components: [
                    { name: 'MobileNavDrawer', target: 'MobileNavDrawer' },
                    { name: 'PageFrame', target: 'PageScaffold / StatePanel' },
                    { name: 'StatePanel', target: 'PageScaffold / StatePanel' },
                    { name: 'FloatingLegend', target: 'FloatingLegend' },
                    { name: 'Loading skeletons', target: 'PageScaffold / StatePanel' },
                ],
            },
            {
                group: 'Trait Views',
                components: [
                    { name: 'GwasDataList', target: 'GwasDataList' },
                    { name: 'TraitMetaCard', target: 'TraitMetaCard' },
                    { name: 'ProgramScatter', target: 'ProgramScatter' },
                    { name: 'ProgramScatterTable', target: 'ProgramScatterTable' },
                    { name: 'TraitProgramGraph', target: 'TraitProgramGraph' },
                    { name: 'TraitProgramGraphSummary', target: 'TraitProgramGraphSummary' },
                    { name: 'TraitHitManhattan', target: 'TraitHitManhattan' },
                    { name: 'TraitHitManhattanLegend', target: 'TraitHitManhattanLegend' },
                    { name: 'TraitHitManhattanTable', target: 'TraitHitManhattanTable' },
                    { name: 'BurdenVolcano', target: 'BurdenVolcano' },
                    { name: 'BurdenVolcanoTable', target: 'BurdenVolcanoTable' },
                ],
            },
            {
                group: 'Program & Data',
                components: [
                    { name: 'GeneRegulation', target: 'GeneRegulation' },
                    { name: 'GeneRegulationTable', target: 'GeneRegulationTable' },
                    { name: 'DataBrowseSummary', target: 'DataBrowseSummary' },
                    { name: 'DirColumn / DirectoryPanel', target: 'DirectoryPanel' },
                    { name: 'GlobalSearchResults', target: 'GlobalSearchResults' },
                    { name: 'Download utilities', target: 'File Download' },
                ],
            },
        ],
    },
};

function slugLabel(text) {
    return text.replace(/\s+/g, '-').toLowerCase();
}

function MethodCard({ item, index, copy }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            id={slugLabel(item.name)}
            sx={{
                ...panelSx(theme, {
                    p: { xs: 1.5, md: 2 },
                    boxShadow: 'none',
                    backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
                }),
                scrollMarginTop: 88,
                ...tableRowRevealSx(theme, index),
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
                        {item.name}
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme, { mt: 0.25 })}>
                        {item.role}
                    </Typography>
                </Box>
                {item.route && (
                    <Button
                        component={RouterLink}
                        to={item.route}
                        size="small"
                        variant="outlined"
                        endIcon={<ChevronRightRounded sx={{ fontSize: 17 }} />}
                        sx={{ flexShrink: 0 }}
                    >
                        {copy.open}
                    </Button>
                )}
            </Box>
            <Stack spacing={0.85}>
                {item.usage.map((line) => (
                    <Box key={line} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <Box
                            sx={{
                                width: 5,
                                height: 5,
                                mt: 0.85,
                                borderRadius: '50%',
                                bgcolor: theme.palette.primary.main,
                                flexShrink: 0,
                            }}
                        />
                        <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary })}>
                            {line}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Paper>
    );
}

function SectionBlock({ section, sectionIndex, copy }) {
    const theme = useTheme();
    const Icon = section.icon;
    const componentCount = section.items.length;

    return (
        <Box id={section.id} sx={{ scrollMarginTop: 88 }}>
            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    overflow: 'hidden',
                    mb: 2,
                })}
            >
                <Box
                    sx={{
                        px: { xs: 1.6, md: 2 },
                        py: { xs: 1.4, md: 1.6 },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        borderBottom: `1px solid ${theme.custom.border.soft}`,
                        background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minWidth: 0 }}>
                        <Box
                            sx={{
                                width: 36,
                                height: 36,
                                borderRadius: 1,
                                display: 'grid',
                                placeItems: 'center',
                                color: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                                flexShrink: 0,
                            }}
                        >
                            <Icon sx={{ fontSize: 20 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.2 })}>
                                {section.title}
                            </Typography>
                            <Typography variant="body2" sx={captionSx(theme, { mb: 0 })}>
                                {section.summary}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={copy.components(componentCount)}
                        size="small"
                        sx={summaryChipSx(theme, metricChipTone(theme, sectionIndex % 2 === 0 ? 'primary' : 'success'))}
                    />
                </Box>
                <Stack spacing={1.2} sx={{ p: { xs: 1.2, md: 1.5 } }}>
                    {section.items.map((item, index) => (
                        <MethodCard key={item.name} item={item} index={index} copy={copy} />
                    ))}
                </Stack>
            </Paper>
        </Box>
    );
}

export default function Help() {
    const theme = useTheme();
    const [language, setLanguage] = React.useState('en');
    const copy = TEXT[language];
    const totalComponents = copy.guideSections.reduce((sum, section) => sum + section.items.length, 0);
    const indexCount = copy.componentIndex.reduce((sum, group) => sum + group.components.length, 0);

    return (
        <PageFrame
            title={copy.pageTitle}
            subtitle={copy.pageSubtitle}
            maxWidth={1480}
            compact
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                    {copy.quickLinks.map(({ label, to, icon }) => (
                        <Button
                            key={to}
                            component={RouterLink}
                            to={to}
                            size="small"
                            variant="outlined"
                            startIcon={icon}
                            sx={{
                                maxWidth: '100%',
                                '& .MuiButton-startIcon': { flexShrink: 0 },
                            }}
                        >
                            {label}
                        </Button>
                    ))}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Chip
                        icon={<LanguageOutlined sx={{ fontSize: 16 }} />}
                        label={copy.languageLabel}
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
            </Stack>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '270px minmax(0, 1fr)' },
                    gap: 2,
                    alignItems: 'start',
                    minWidth: 0,
                    '& > *': {
                        minWidth: 0,
                    },
                }}
            >
                <Paper
                    elevation={0}
                    sx={{
                        ...panelSx(theme, {
                            p: 1.2,
                            position: { lg: 'sticky' },
                            top: { lg: 76 },
                        }),
                    }}
                >
                    <Box sx={{ px: 0.8, py: 0.7 }}>
                        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                            <ArticleOutlined sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                {copy.contents}
                            </Typography>
                        </Stack>
                        <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 1 })}>
                            {copy.sectionsAndMethods(copy.guideSections.length, totalComponents)}
                        </Typography>
                    </Box>
                    <Divider sx={{ mb: 0.8 }} />
                    <Stack spacing={0.35}>
                        {copy.guideSections.map((section) => {
                            const Icon = section.icon;
                            return (
                                <Link
                                    key={section.id}
                                    href={`#${section.id}`}
                                    underline="none"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.9,
                                        px: 1,
                                        py: 0.8,
                                        borderRadius: 1,
                                        color: theme.palette.text.secondary,
                                        fontSize: '0.86rem',
                                        fontWeight: 700,
                                        transition: `background-color ${theme.custom.motion.swift}, color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                        '&:hover': {
                                            color: theme.palette.primary.dark,
                                            bgcolor: alpha(theme.palette.primary.main, 0.07),
                                            transform: 'translateX(2px)',
                                        },
                                    }}
                                >
                                    <Icon sx={{ fontSize: 17, flexShrink: 0 }} />
                                    <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                                        {section.title}
                                    </Box>
                                    <Chip
                                        label={section.items.length}
                                        size="small"
                                        sx={{ height: 20, minWidth: 26, fontSize: '0.68rem', fontWeight: 800 }}
                                    />
                                </Link>
                            );
                        })}
                    </Stack>
                </Paper>

                <Box>
                    <Paper
                        elevation={0}
                        sx={panelSx(theme, {
                            p: { xs: 1.6, md: 2 },
                            mb: 2,
                            backgroundColor: theme.custom.surface.raised,
                        })}
                    >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                            <Chip
                                icon={<BiotechOutlined sx={{ fontSize: 16 }} />}
                                label={copy.recommendedWorkflow}
                                sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))}
                            />
                            <Typography variant="body2" sx={captionSx(theme, { mb: 0 })}>
                                {copy.workflowText}
                            </Typography>
                        </Stack>
                    </Paper>

                    <Paper
                        elevation={0}
                        id="component-coverage-index"
                        sx={panelSx(theme, {
                            p: { xs: 1.6, md: 2 },
                            mb: 2,
                            overflow: 'hidden',
                            scrollMarginTop: 88,
                        })}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.4 }}>
                            <Box>
                                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.3 })}>
                                    {copy.componentCoverageTitle}
                                </Typography>
                                <Typography variant="body2" sx={captionSx(theme, { mb: 0 })}>
                                    {copy.componentCoverageBody}
                                </Typography>
                            </Box>
                            <Chip
                                label={copy.mapped(indexCount)}
                                size="small"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))}
                            />
                        </Box>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                gap: 1,
                            }}
                        >
                            {copy.componentIndex.map((group) => (
                                <Box
                                    key={group.group}
                                    sx={{
                                        p: 1.2,
                                        borderRadius: 1,
                                        border: `1px solid ${theme.custom.border.soft}`,
                                        bgcolor: theme.custom.surface.raised,
                                    }}
                                >
                                    <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 800, textTransform: 'uppercase', mb: 0.8 }}>
                                        {group.group}
                                    </Typography>
                                    <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                                        {group.components.map((component) => {
                                            const targetId = component.target === 'Guide' ? 'component-coverage-index' : slugLabel(component.target);
                                            return (
                                                <Chip
                                                    key={component.name}
                                                    component="a"
                                                    href={`#${targetId}`}
                                                    clickable
                                                    label={component.name}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        height: 24,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        bgcolor: theme.palette.background.paper,
                                                        '&:hover': {
                                                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                            borderColor: alpha(theme.palette.primary.main, 0.24),
                                                        },
                                                    }}
                                                />
                                            );
                                        })}
                                    </Stack>
                                </Box>
                            ))}
                        </Box>
                    </Paper>

                    {copy.guideSections.map((section, index) => (
                        <SectionBlock key={section.id} section={section} sectionIndex={index} copy={copy} />
                    ))}
                </Box>
            </Box>
        </PageFrame>
    );
}
