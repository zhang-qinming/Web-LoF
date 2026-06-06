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
import homeFigureBrowserWorkflow from '../assets/home/home-figure-browser-workflow.svg';
import docsFigureBrowserSurfaces from '../assets/docs/docs-figure-browser-surfaces.svg';

const TEXT = {
    en: {
        pageTitle: 'Web Guide',
        pageSubtitle: 'An English-first usage guide for the browser. Switch languages at any time to view the same content in Chinese.',
        open: 'Open',
        contents: 'Contents',
        sectionsAndMethods: (sectionCount, methodCount) => `${sectionCount} sections / ${methodCount} topics`,
        components: (count) => `${count} components`,
        recommendedWorkflow: 'Recommended workflow',
        workflowText: 'Start from Home, Trait, or Genes depending on whether the question begins with a file, a trait, or a gene. Use Trait for figure-centric interpretation, Programs for annotation review, and Data Browser for raw file browsing and batch downloads.',
        workflowFigures: [
            {
                title: 'Analysis Workflow',
                body: 'This figure shows the project analysis path that feeds the browser: GWAS and LoF evidence connect to perturb-seq programs, association, and then web display.',
                image: homeFigureBrowserWorkflow,
                alt: 'Analysis workflow from GWAS and LoF to web display',
            },
            {
                title: 'Route Map',
                body: 'This figure shows the browser-side route split: search in Home, drill down in Trait, Genes, or Programs, then export from Data or read page-level guidance here.',
                image: docsFigureBrowserSurfaces,
                alt: 'Browser route map showing Home, Trait, Genes, Programs, Data, Guide, and About',
            },
        ],
        componentCoverageTitle: 'Component Coverage Index',
        componentCoverageBody: 'Visible routes and user-facing components are mapped to the guide entries below. Pure helpers, formatters, and loading skeletons stay grouped under their parent component.',
        mapped: (count) => `${count} mapped`,
        languageLabel: 'Language',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Trait List', to: '/trait', icon: <TableChartOutlined sx={{ fontSize: 17 }} /> },
            { label: 'Genes', to: '/genes', icon: <BiotechOutlined sx={{ fontSize: 17 }} /> },
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
                        role: 'Entry point into Program Scatter, Trait Program Graph, Manhattan, Burden Volcano, Posterior Volcano, Gene Evidence, Gene QQ, and Cross-trait Heatmap.',
                        usage: [
                            'Tabs with available data open normally; tabs without matching files are disabled or replaced with explanatory panels.',
                            'The page prefers available program-centric plots first and otherwise falls back to Manhattan.',
                            'Gene Evidence, Gene QQ, and Cross-trait Heatmap add gene-level comparison workflows beyond the Manhattan and volcano tabs.',
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
                            'Each point is one program. In Scatter mode, x is Program burden and y is Regulator burden, so the four quadrants separate programs that are strong on one side, both sides, or neither side.',
                            'Rank mode keeps the same programs but switches the axes to relative ranking, which is useful when absolute scores vary a lot across traits.',
                            'Colors encode enrichment class, while marker size or bubble scaling helps you see which programs carry stronger signed signal.',
                            'Use this plot to find programs that are jointly trait- and regulator-supported, then click a point to focus the matching row in the table below.',
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
                            'This graph answers how the current trait connects to programs and which regulator genes are driving those programs. The center nodes are programs; the two sides show upstream and downstream context.',
                            'The left side summarizes trait-to-program direction, while the right side summarizes regulator-to-program direction, so you can quickly see whether the same program is supported from both perspectives.',
                            'Gamma threshold, sign filters, max genes per program, visible side, and discordant-only filters are mainly density controls: raise them when the graph is crowded, lower them when you need more coverage.',
                            'Use zoom, pan, and row selection together. The graph is best for structure discovery, and the summary table below is best for exact values and row-level follow-up.',
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
                            'Each point is a variant. The x axis walks across chromosomes and genomic position, and the y axis is -log10(P), so taller peaks mark more significant loci.',
                            'Use Hits TSV when you want the condensed lead-signal view, and Full TSV when you need local background context around those peaks. If the hits file is missing, the page falls back automatically.',
                            'Color by Program or Geneset to see which loci are already annotated; combine chromosome, distance_to_gene, gene, rsID, program, and geneset filters to isolate a region or annotation class.',
                            'This plot is best for answering where the strongest GWAS signal sits in the genome and whether those loci already map to a program or regulator context.',
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
                            'Each point is a gene. The x axis is the effect estimate: burden beta in Burden Volcano, or posterior mean in Posterior Volcano. The y axis is -log10(P), so higher points are statistically stronger.',
                            'Genes on the right have positive effect; genes on the left have negative effect. The horizontal guide helps you judge which genes cross the nominal significance region at a glance.',
                            'Use hits vs full TSV depending on whether you want the concise significant set or the full gene background. Direction and effect-size filters are useful for separating one-sided signals.',
                            'This plot is the fastest way to find genes that are both large in magnitude and statistically strong, then inspect their exact values in the synced table.',
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
                    {
                        name: 'GeneLevelScatter',
                        route: '/trait',
                        role: 'Gene Evidence plot comparing GeneBayes posterior signal with perturbation support.',
                        usage: [
                            'Each point is a gene. The x axis is GeneBayes post_mean and the y axis is signed -log10(P) from perturbation evidence, so the sign of both axes matters, not only the magnitude.',
                            'Genes far from zero on both axes have stronger combined support. Concordant genes stay in the upper-right or lower-left logic implied by sign, while discordant genes separate toward opposite directions.',
                            'Color encodes evidence class, so you can distinguish broad background genes from posterior-high, regulation-supported, and direction-discordant genes without opening the table first.',
                            'Use this figure when you want to compare statistical gene prioritization against perturbation directionality, then click a point to inspect the matched row and labels below.',
                        ],
                    },
                    {
                        name: 'GeneLevelScatterTable',
                        route: '/trait',
                        role: 'Detail table below Gene Evidence.',
                        usage: [
                            'Review gene, ENSG, posterior effect, regulation score, FDR, evidence class, and labeling reasons.',
                            'Sort columns and export the current processed rows as CSV.',
                        ],
                    },
                    {
                        name: 'GeneLevelQQ',
                        route: '/trait',
                        role: 'Gene-level QQ-style comparison view with optional multi-trait overlays.',
                        usage: [
                            'This is a signed QQ plot at the gene level. X is expected signal and y is observed signal, so points that rise away from the expected line indicate stronger-than-null enrichment.',
                            'Positive and negative tails are still separated, which lets you see whether inflation or depletion is happening symmetrically or only on one side.',
                            'When you add extra traits, color encodes trait identity while marker shape still indicates tail direction. That makes it useful for checking whether multiple traits share the same tail behavior.',
                            'Use Trait stamp for export-ready comparisons, and use the table below when you need the exact expected, observed, deviation, and tail assignment for selected genes.',
                        ],
                    },
                    {
                        name: 'GeneLevelQQTable',
                        route: '/trait',
                        role: 'Detail table below Gene QQ.',
                        usage: [
                            'Review expected, observed, deviation, beta, P-value, and tail assignments for the visible rows.',
                            'Use sorting and CSV export for downstream review.',
                        ],
                    },
                    {
                        name: 'CrossTraitHeatmap',
                        route: '/trait',
                        role: 'Cross-trait heatmap of top source-trait genes across selected target traits.',
                        usage: [
                            'Rows are the current trait\'s top genes and columns are selected target traits. Each cell shows the target trait\'s post_mean for the same gene after gene-level alignment.',
                            'The color scale is centered at zero: warm cells mean positive post_mean, cool cells mean negative post_mean, and near-neutral cells indicate weak or missing directional effect.',
                            'Recommended, Recent, and Search are three different ways to build the target trait panel. Reset returns to the recommended starting set instead of the full universe.',
                            'Use this view to ask whether the same prioritized genes repeat across related traits and whether their effect directions stay consistent. Click a cell or target label to jump into that trait.',
                        ],
                    },
                ],
            },
            {
                id: 'genes',
                title: 'Genes',
                icon: BiotechOutlined,
                summary: 'Gene search, recommended entries, gene metadata, and linked program-trait evidence tables.',
                items: [
                    {
                        name: 'Gene Search',
                        route: '/genes',
                        role: 'Primary lookup entry for gene-centric browsing.',
                        usage: [
                            'Search by gene symbol to open direct evidence rows, or start from the recommended list if you want a quick sample of populated genes.',
                            'Use this page when the question begins with a specific gene and you need to trace its linked programs and traits without starting from a trait page first.',
                        ],
                    },
                    {
                        name: 'Genes Overview Table',
                        route: '/genes',
                        role: 'Landing table summarizing searchable genes and linked counts.',
                        usage: [
                            'Review Gene Symbol, Ensembl ID, gene type, genomic location, and associated program or trait counts.',
                            'Open a gene row to move from the index view into its full evidence detail page.',
                        ],
                    },
                    {
                        name: 'Gene Information',
                        route: '/genes',
                        role: 'Gene metadata card and external-reference panel.',
                        usage: [
                            'Check the gene description, Ensembl ID, genomic location, gene type, NCBI summary, and external links such as Ensembl, GeneCards, and NCBI.',
                            'Use this block first when you need to confirm that the selected gene symbol matches the expected locus and annotation context.',
                        ],
                    },
                    {
                        name: 'Gene Program Relationships',
                        route: '/genes',
                        role: 'Program-level table showing how the current gene connects to cNMF programs.',
                        usage: [
                            'Review Program, Function, GO Term, direction, and program gene counts to see whether the gene participates in coherent functional modules.',
                            'This table is best for answering which programs carry the gene and whether the regulator direction is consistent across modules.',
                        ],
                    },
                    {
                        name: 'Gene Program Trait Evidence',
                        route: '/genes',
                        role: 'Full evidence table linking the selected gene to programs and traits.',
                        usage: [
                            'Inspect Trait, Program, role, direction, posterior mean, gamma, membership, and concordance fields together.',
                            'Use this table to judge whether the same gene-program relationship stays concordant or discordant across multiple traits.',
                        ],
                    },
                ],
            },
            {
                id: 'programs',
                title: 'Programs',
                icon: ScienceOutlined,
                summary: 'Program annotation table plus the program detail switcher, information, gene, and trait evidence tables.',
                items: [
                    {
                        name: 'Programs Table',
                        route: '/programs',
                        role: 'cNMF program annotation browser.',
                        usage: [
                            'Browse Program, Annotation, GO Term, Accession, Ontology, GO P, and Top Genes columns.',
                            'Sort supported columns and open a Program ID to reach its detail page.',
                        ],
                    },
                    {
                        name: 'Program Switcher',
                        route: '/programs/P1',
                        role: 'Program detail header and searchable program picker.',
                        usage: [
                            'Use the header to confirm the current Program ID and curated annotation before reading downstream tables.',
                            'Open the picker to search by program id or annotation and jump directly between detail pages without returning to the main table.',
                        ],
                    },
                    {
                        name: 'Program Summary Chips',
                        route: '/programs/P1',
                        role: 'Compact trait, program, regulator, and gene count summary strip.',
                        usage: [
                            'Use these counts to see whether the current program is selected by program signal, regulator signal, both, and how many genes are in the linked SQL index.',
                            'This strip is a quick orientation layer before drilling into Program Information, Program Genes, or Associated Traits.',
                        ],
                    },
                    {
                        name: 'Program Information',
                        route: '/programs/P1',
                        role: 'Single-row detail table for the selected program annotation context.',
                        usage: [
                            'Review Program, Annotation, GO Term, GO Ontology, Associated Genes, and Associated Traits in one place.',
                            'Use this table to confirm the representative GO function and counts before interpreting the gene-level or trait-level detail tables.',
                        ],
                    },
                    {
                        name: 'Program Genes',
                        route: '/programs/P1',
                        role: 'Gene-level table for one selected cNMF program.',
                        usage: [
                            'Inspect Symbol, Ensembl ID, location, gene type, direction in program, and value across the sorted gene list.',
                            'Sort the table, page through long result sets, export CSV, or open a gene symbol to continue in the Genes page.',
                        ],
                    },
                    {
                        name: 'Associated Traits',
                        route: '/programs/P1',
                        role: 'Trait-level table linking the current program back to enriched traits.',
                        usage: [
                            'Review trait name, selection class, program score, regulator score, visible gene counts, and top genes together.',
                            'Use the selection filter and CSV export to separate program-selected, regulator-selected, and jointly selected traits.',
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
                summary: 'About, Contact, and shared floating legends.',
                items: [
                    {
                        name: 'About',
                        route: '/about',
                        role: 'Project overview page with workflow figures and route positioning.',
                        usage: [
                            'Use this page for a concise summary of the browser surfaces, the analysis workflow, and where each major route fits.',
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
                        role: 'Reusable floating legend used by Manhattan, Volcano, Program Scatter, Gene Regulation, Gene Evidence, and Gene QQ views.',
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
                            'Trait page plots such as Manhattan, Volcano, Gene Evidence, and Gene QQ support in-place image export from the toolbar.',
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
                    { name: 'Genes', target: 'Gene Search' },
                    { name: 'Programs', target: 'Programs Table' },
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
                    { name: 'GeneLevelScatter', target: 'GeneLevelScatter' },
                    { name: 'GeneLevelScatterTable', target: 'GeneLevelScatterTable' },
                    { name: 'GeneLevelQQ', target: 'GeneLevelQQ' },
                    { name: 'GeneLevelQQTable', target: 'GeneLevelQQTable' },
                    { name: 'CrossTraitHeatmap', target: 'CrossTraitHeatmap' },
                ],
            },
            {
                group: 'Gene, Program & Data',
                components: [
                    { name: 'Gene Search', target: 'Gene Search' },
                    { name: 'Genes Overview Table', target: 'Genes Overview Table' },
                    { name: 'Gene Information', target: 'Gene Information' },
                    { name: 'Gene Program Relationships', target: 'Gene Program Relationships' },
                    { name: 'Gene Program Trait Evidence', target: 'Gene Program Trait Evidence' },
                    { name: 'Program Switcher', target: 'Program Switcher' },
                    { name: 'Program Summary Chips', target: 'Program Summary Chips' },
                    { name: 'Program Information', target: 'Program Information' },
                    { name: 'Program Genes', target: 'Program Genes' },
                    { name: 'Associated Traits', target: 'Associated Traits' },
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
        workflowText: '如果问题先从文件、trait 或 gene 开始，分别从 Home、Trait 或 Genes 进入。Trait 负责图表解释，Programs 负责注释核查，Data Browser 负责原始文件浏览和批量下载。',
        workflowFigures: [
            {
                title: '分析工作流',
                body: '这张图展示项目结果如何进入浏览器：GWAS 和 LoF 证据连接到 perturb-seq programs、association，最后进入网页展示。',
                image: homeFigureBrowserWorkflow,
                alt: '从 GWAS 和 LoF 到网页展示的分析工作流',
            },
            {
                title: '页面路由图',
                body: '这张图展示前端页面分工：先在 Home 搜索，再进入 Trait、Genes 或 Programs 深入查看，最后在 Data 导出结果或回到本页看说明。',
                image: docsFigureBrowserSurfaces,
                alt: '展示 Home、Trait、Genes、Programs、Data、Guide 和 About 的页面关系图',
            },
        ],
        componentCoverageTitle: '组件覆盖索引',
        componentCoverageBody: '源码中的页面和可见组件都映射到下方说明条目；纯 helper、格式化函数和 loading skeleton 归入父组件。',
        mapped: (count) => `${count} 个映射`,
        languageLabel: '语言',
        english: 'English',
        chinese: '中文',
        quickLinks: [
            { label: 'Trait 列表', to: '/trait', icon: <TableChartOutlined sx={{ fontSize: 17 }} /> },
            { label: 'Genes', to: '/genes', icon: <BiotechOutlined sx={{ fontSize: 17 }} /> },
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
                        role: 'Program Scatter、Trait Program Graph、Manhattan、Burden Volcano、Posterior Volcano、Gene Evidence、Gene QQ 和 Cross-trait Heatmap 的入口。',
                        usage: [
                            '有数据的 tab 可正常打开；没有匹配文件的 tab 会禁用或显示说明面板。',
                            '页面会优先展示可用的 program 相关图，否则回退到 Manhattan。',
                            'Gene Evidence、Gene QQ 和 Cross-trait Heatmap 提供了额外的 gene-level 比较和跨 trait 浏览入口。',
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
                            '每个点代表一个 program。Scatter 模式下，x 轴是 Program burden，y 轴是 Regulator burden，因此四个象限天然对应偏 program、偏 regulator、两者都强或两者都弱的 program。',
                            'Rank 模式保留同一批 program，但把坐标改成相对排名，适合在不同 trait 间绝对分值差异较大时看相对位置。',
                            '颜色表示 enrichment class，点大小或 bubble scale 用来补充显示信号强弱，而不只是类别。',
                            '这个图适合先找同时得到 trait 与 regulator 支持的 program，再点击点位到下方表格查看具体数值。',
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
                            '这个图回答的是：当前 trait 通过哪些 program 连接到哪些 regulator genes。中间是 program，两侧分别给出上下游关系。',
                            '左侧概括 trait 到 program 的方向信息，右侧概括 regulator 到 program 的方向信息，因此可以快速判断同一个 program 是否同时得到两侧支持。',
                            'Gamma threshold、sign 过滤、每个 program 展示的 gene 数、可见侧别和 discordant-only 本质上都是密度控制项；图太挤时提高阈值，想看全时再放宽。',
                            '这个图更适合看结构和模块关系，图下方汇总表更适合看精确数值和逐行核查，二者应配合使用。',
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
                            '每个点代表一个 variant。x 轴沿染色体和基因组位置展开，y 轴是 -log10(P)，因此越高的峰代表统计学上越显著的 loci。',
                            'Hits TSV 适合看浓缩后的 lead signals，Full TSV 适合看这些峰周围的局部背景；如果 hits 文件缺失，页面会自动回退。',
                            '按 Program 或 Geneset 着色，可以直接看哪些 loci 已经有功能注释；再结合 chromosome、distance_to_gene、gene、rsID、program、geneset 过滤器定位具体区域。',
                            '这个图最适合回答强 GWAS 信号落在基因组哪里，以及这些 loci 是否已经能映射到 program 或 regulator 语境中。',
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
                            '每个点代表一个 gene。x 轴是效应估计：Burden Volcano 用 burden beta，Posterior Volcano 用 posterior mean；y 轴是 -log10(P)，因此越高表示统计证据越强。',
                            '右侧基因表示正向效应，左侧表示负向效应。横向参考线可以帮助快速判断哪些 gene 已经进入名义显著区域。',
                            'hits 与 full TSV 的切换分别对应精简显著集和完整背景集；方向过滤与 effect-size 过滤则适合拆开看单侧信号。',
                            '这个图适合优先找出“效应幅度大且统计支持强”的 gene，再到同步表格里核对具体数值。',
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
                    {
                        name: 'GeneLevelScatter',
                        route: '/trait',
                        role: '比较 GeneBayes posterior signal 与 perturbation 支持证据的 Gene Evidence 图。',
                        usage: [
                            '每个点都是一个 gene。x 轴是 GeneBayes post_mean，y 轴是扰动证据的 signed -log10(P)，所以这里不仅看绝对值大小，也要看两个轴的正负方向是否一致。',
                            '同时远离两个轴原点的 gene 往往有更强的联合支持；方向一致的 gene 会落在逻辑上相符的区域，方向冲突的 gene 会分离到相反方向。',
                            '颜色表示 evidence class，因此不用先展开表格，也能区分背景基因、posterior-high、regulation-supported 和 direction-discordant。',
                            '这个图适合对比统计优先级和扰动方向是否一致，再点击点位到下方表格查看对应 gene 的详细证据。',
                        ],
                    },
                    {
                        name: 'GeneLevelScatterTable',
                        route: '/trait',
                        role: 'Gene Evidence 下方的明细表。',
                        usage: [
                            '查看 gene、ENSG、posterior effect、regulation score、FDR、evidence class 和 label reason 等字段。',
                            '支持排序，并可导出当前处理后的 CSV。',
                        ],
                    },
                    {
                        name: 'GeneLevelQQ',
                        route: '/trait',
                        role: '支持附加 trait overlay 的 gene-level QQ 对比图。',
                        usage: [
                            '这是 gene-level 的 signed QQ 图。x 轴是 expected signal，y 轴是 observed signal，因此点越偏离 expected line，说明偏离空分布越明显。',
                            '正尾和负尾会分开显示，所以你可以判断信号膨胀或偏离是双侧都有，还是只集中在某一侧。',
                            '加入额外 trait 后，颜色表示 trait 身份，点形状仍表示 tail 方向，因此很适合比较多个 trait 是否共享相似的尾部行为。',
                            'Trait stamp 适合做导出图；如果需要精确查看 expected、observed、deviation 和 tail 分类，还是以下方表格为准。',
                        ],
                    },
                    {
                        name: 'GeneLevelQQTable',
                        route: '/trait',
                        role: 'Gene QQ 下方的明细表。',
                        usage: [
                            '查看 expected、observed、deviation、beta、P-value 和 tail 分类等字段。',
                            '支持排序和 CSV 导出，便于后续分析。',
                        ],
                    },
                    {
                        name: 'CrossTraitHeatmap',
                        route: '/trait',
                        role: '展示当前 trait 顶部 genes 在多个 target traits 中 post_mean 的跨 trait 热图。',
                        usage: [
                            '行是当前 trait 的 top genes，列是选中的 target traits。每个单元格表示同一个 gene 在目标 trait 中对齐后的 post_mean。',
                            '配色以 0 为中心：暖色表示正 post_mean，冷色表示负 post_mean，接近中性的颜色表示方向弱或接近缺失。',
                            'Recommended、Recent 和 Search 是三种构建目标 trait 面板的方式；Reset 不是恢复全量，而是恢复推荐的起始集合。',
                            '这个图适合回答：当前 trait 优先出来的 gene 是否也在其他 trait 中重复出现，以及方向是否保持一致。点击单元格或目标 trait 标签可继续跳转查看。',
                        ],
                    },
                ],
            },
            {
                id: 'genes',
                title: 'Genes',
                icon: BiotechOutlined,
                summary: 'Gene 搜索、推荐条目、gene 元信息和 program-trait 证据表。',
                items: [
                    {
                        name: 'Gene Search',
                        route: '/genes',
                        role: '面向 gene 视角浏览的主入口。',
                        usage: [
                            '按 gene symbol 搜索可以直接进入证据行，也可以先从推荐列表挑一个已有数据的 gene 开始。',
                            '如果问题是从某个特定 gene 出发，想追踪它关联的 programs 和 traits，这个页面比先从 Trait 进入更直接。',
                        ],
                    },
                    {
                        name: 'Genes Overview Table',
                        route: '/genes',
                        role: 'Genes 首页的总览表，汇总可检索 gene 及其关联数量。',
                        usage: [
                            '查看 Gene Symbol、Ensembl ID、gene type、基因组位置以及关联的 program/trait 数量。',
                            '点击某一行可以从索引视图进入该 gene 的完整证据详情页。',
                        ],
                    },
                    {
                        name: 'Gene Information',
                        route: '/genes',
                        role: 'gene 元信息卡片和外部参考链接区。',
                        usage: [
                            '检查 gene description、Ensembl ID、位置、gene type、NCBI summary 以及 Ensembl、GeneCards、NCBI 等外链。',
                            '当你需要先确认当前 gene symbol 是否就是目标 locus 或注释上下文时，先看这一块最合适。',
                        ],
                    },
                    {
                        name: 'Gene Program Relationships',
                        route: '/genes',
                        role: '展示当前 gene 与 cNMF programs 关系的 program-level 表格。',
                        usage: [
                            '查看 Program、Function、GO Term、direction 和 program gene count，判断该 gene 是否落在一致的功能模块里。',
                            '这一表更适合回答 gene 属于哪些 programs，以及 regulator direction 在不同模块中是否一致。',
                        ],
                    },
                    {
                        name: 'Gene Program Trait Evidence',
                        route: '/genes',
                        role: '把 gene、program 和 trait 连接起来的完整证据表。',
                        usage: [
                            '联合查看 Trait、Program、role、direction、posterior mean、gamma、membership 和 concordance 等字段。',
                            '用这张表判断同一个 gene-program 关系在多个 traits 里是保持 concordant 还是出现 discordant。',
                        ],
                    },
                ],
            },
            {
                id: 'programs',
                title: 'Programs',
                icon: ScienceOutlined,
                summary: 'Program 注释总表，以及 program 详情页里的切换器、信息表、基因表和 trait 关联表。',
                items: [
                    {
                        name: 'Programs Table',
                        route: '/programs',
                        role: 'cNMF program 注释浏览表。',
                        usage: [
                            '浏览 Program、Annotation、GO Term、Accession、Ontology、GO P 和 Top Genes 等列。',
                            '支持排序，并可通过 Program ID 打开详情页。',
                        ],
                    },
                    {
                        name: 'Program Switcher',
                        route: '/programs/P1',
                        role: 'program 详情页顶部的当前 program 标题和可搜索切换器。',
                        usage: [
                            '先在这里确认当前 Program ID 和 curated annotation，再继续看下方表格。',
                            '打开 picker 后可以按 program id 或 annotation 搜索，直接在详情页之间切换，不必回到总表。',
                        ],
                    },
                    {
                        name: 'Program Summary Chips',
                        route: '/programs/P1',
                        role: '紧凑的 trait / program / regulator / gene 数量摘要条。',
                        usage: [
                            '用这些数量先判断当前 program 是由 program signal、regulator signal、两者同时还是更偏弱地被选中。',
                            '这层摘要适合在进入 Program Information、Program Genes 和 Associated Traits 之前先快速定向。',
                        ],
                    },
                    {
                        name: 'Program Information',
                        route: '/programs/P1',
                        role: '展示当前 program 注释上下文的单行信息表。',
                        usage: [
                            '集中查看 Program、Annotation、GO Term、GO Ontology、Associated Genes 和 Associated Traits。',
                            '在解释 gene-level 或 trait-level 明细之前，先用这张表确认代表性 GO 功能和关联数量。',
                        ],
                    },
                    {
                        name: 'Program Genes',
                        route: '/programs/P1',
                        role: '单个 cNMF program 的 gene-level 明细表。',
                        usage: [
                            '查看 Symbol、Ensembl ID、location、gene type、direction in program 和 value 等字段。',
                            '支持排序、分页、CSV 导出，也可以点击 gene symbol 继续跳到 Genes 页面。',
                        ],
                    },
                    {
                        name: 'Associated Traits',
                        route: '/programs/P1',
                        role: '把当前 program 反向连接到 traits 的 trait-level 表。',
                        usage: [
                            '联合查看 trait name、selection class、program score、regulator score、visible gene counts 和 top genes。',
                            '配合 selection filter 和 CSV 导出，可以拆开看 program-selected、regulator-selected 和 jointly selected 的 traits。',
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
                summary: 'About、Contact 以及共享浮动图例。',
                items: [
                    {
                        name: 'About',
                        route: '/about',
                        role: '带有 workflow 图和页面定位说明的项目简介页。',
                        usage: [
                            '用于快速了解浏览器各页面分工、分析工作流以及各主路由的使用定位。',
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
                        role: 'Manhattan、Volcano、Program Scatter、Gene Regulation、Gene Evidence 和 Gene QQ 共用的浮动图例。',
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
                            'Trait 页中的 Manhattan、Volcano、Gene Evidence 和 Gene QQ 等图都支持在工具栏中直接导出图片。',
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
                    { name: 'Genes', target: 'Gene Search' },
                    { name: 'Programs', target: 'Programs Table' },
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
                    { name: 'GeneLevelScatter', target: 'GeneLevelScatter' },
                    { name: 'GeneLevelScatterTable', target: 'GeneLevelScatterTable' },
                    { name: 'GeneLevelQQ', target: 'GeneLevelQQ' },
                    { name: 'GeneLevelQQTable', target: 'GeneLevelQQTable' },
                    { name: 'CrossTraitHeatmap', target: 'CrossTraitHeatmap' },
                ],
            },
            {
                group: 'Gene、Program 与 Data',
                components: [
                    { name: 'Gene Search', target: 'Gene Search' },
                    { name: 'Genes Overview Table', target: 'Genes Overview Table' },
                    { name: 'Gene Information', target: 'Gene Information' },
                    { name: 'Gene Program Relationships', target: 'Gene Program Relationships' },
                    { name: 'Gene Program Trait Evidence', target: 'Gene Program Trait Evidence' },
                    { name: 'Program Switcher', target: 'Program Switcher' },
                    { name: 'Program Summary Chips', target: 'Program Summary Chips' },
                    { name: 'Program Information', target: 'Program Information' },
                    { name: 'Program Genes', target: 'Program Genes' },
                    { name: 'Associated Traits', target: 'Associated Traits' },
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
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
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

function WorkflowFigureCard({ figure, index }) {
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
            <Box sx={{ p: { xs: 1.3, md: 1.6 } }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.palette.text.primary, mb: 0.35 }}>
                    {figure.title}
                </Typography>
                <Typography variant="body2" sx={captionSx(theme, { mb: 0, color: theme.palette.text.primary })}>
                    {figure.body}
                </Typography>
            </Box>
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
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
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
                                        sx={{ height: 20, minWidth: 26, fontSize: '0.68rem', fontWeight: 650 }}
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

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1.5,
                            mb: 2,
                        }}
                    >
                        {copy.workflowFigures.map((figure, index) => (
                            <WorkflowFigureCard key={figure.title} figure={figure} index={index} />
                        ))}
                    </Box>

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
                                    <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, fontWeight: 650, textTransform: 'none', mb: 0.8 }}>
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
