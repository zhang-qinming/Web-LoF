import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import BiotechOutlined from '@mui/icons-material/BiotechOutlined';
import BugReportOutlined from '@mui/icons-material/BugReportOutlined';
import ContactSupportOutlined from '@mui/icons-material/ContactSupportOutlined';
import DataObjectOutlined from '@mui/icons-material/DataObjectOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import HubOutlined from '@mui/icons-material/HubOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import LaunchOutlined from '@mui/icons-material/LaunchOutlined';
import RuleOutlined from '@mui/icons-material/RuleOutlined';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import { PageFrame } from '../components/PageScaffold';
import { RELEASE_LOG_ANCHOR, releaseEntriesByLocale } from '../components/releaseLogData';
import {
    CONTENT_PAGE_MAX_WIDTH,
    captionSx,
    metricChipTone,
    panelSx,
    sectionTitleSx,
    summaryChipSx,
} from '../themeUtils';
import helpBurdenVolcano from '../assets/help/screenshots/burden-volcano.png';
import helpCrossTraitHeatmap from '../assets/help/screenshots/cross-trait-heatmap.png';
import helpDataBrowser from '../assets/help/screenshots/data-browser.png';
import helpGeneAssociationMap from '../assets/help/screenshots/gene-association-map.png';
import helpGeneEvidence from '../assets/help/screenshots/gene-evidence.png';
import helpManhattan from '../assets/help/screenshots/manhattan.png';
import helpPosteriorVolcano from '../assets/help/screenshots/posterior-volcano.png';
import helpProgramScatter from '../assets/help/screenshots/program-scatter.png';
import helpProgramVolcano from '../assets/help/screenshots/program-volcano.png';
import helpQqPlot from '../assets/help/screenshots/qq-plot.png';
import helpTraitCorrelation from '../assets/help/screenshots/trait-correlation.png';
import helpTraitDetail from '../assets/help/screenshots/trait-detail.png';

const WORKFLOW_STEPS = [
    {
        step: '1',
        title: 'Start from a trait or GWAS identifier',
        body: 'Use Trait when you know a trait name, file ID, burden phenotype, GWAS ID, or a chart you need to review.',
        route: '/trait',
        page: 'Trait',
    },
    {
        step: '2',
        title: 'Start from a gene',
        body: 'Use Genes when the question is where a gene appears across traits, programs, and GeneBayes evidence.',
        route: '/genes',
        page: 'Genes',
    },
    {
        step: '3',
        title: 'Start from a program',
        body: 'Use Programs for cNMF program identity, representative genes, annotation labels, and associated traits.',
        route: '/programs',
        page: 'Programs',
    },
    {
        step: '4',
        title: 'Start from a file or output name',
        body: 'Use Downloads for file browsing, paginated global search, folder archives, and direct TSV verification.',
        route: '/data',
        page: 'Downloads',
    },
];

const FIGURE_GUIDE_TOC_ITEM = { id: 'figure-guide', title: 'Figure Guide' };

const FIGURE_GUIDE_ITEMS = [
    {
        title: 'Program Scatter',
        route: '/trait/:traitId?tab=program-scatter',
        src: helpProgramScatter,
        alt: 'Program Scatter screenshot showing trait-associated programs and regulators in an effect-size plot',
        caption: 'Use this panel to prioritize cellular programs or regulators with outlying trait associations. The scatter view is most useful as a first-pass screen before opening linked program, regulator, or gene-level evidence.',
    },
    {
        title: 'Gene Association Map',
        route: '/trait/:traitId?tab=trait-program-graph',
        src: helpGeneAssociationMap,
        alt: 'Gene Association Map screenshot linking a trait to cNMF programs, regulators, and candidate genes',
        caption: 'Use the map to trace how a trait connects to cNMF program burden, regulator burden, and the genes supporting those relationships. It is designed for mechanistic hypothesis generation rather than single-row statistical ranking.',
    },
    {
        title: 'Manhattan',
        route: '/trait/:traitId?tab=manhattan',
        src: helpManhattan,
        alt: 'Manhattan plot screenshot showing variant-level association strength across chromosomes',
        caption: 'Use the Manhattan view to localize genome-wide association signals by chromosome and position. Peaks should be interpreted with the linked TSV rows, especially when filters, sampling, or endpoint limits affect the returned points.',
    },
    {
        title: 'Burden Volcano',
        route: '/trait/:traitId?tab=burden-volcano',
        src: helpBurdenVolcano,
        alt: 'Burden Volcano screenshot showing loss-of-function burden effect size and significance by gene',
        caption: 'Use this volcano plot to compare LoF burden effect direction with statistical support. Genes in the high-significance tails are candidates for closer review, but their source rows should be checked before downstream interpretation.',
    },
    {
        title: 'Posterior Volcano',
        route: '/trait/:traitId?tab=posterior-volcano',
        src: helpPosteriorVolcano,
        alt: 'Posterior Volcano screenshot showing GeneBayes posterior effect estimates and support by gene',
        caption: 'Use this panel to rank genes by posterior effect magnitude and support under the GeneBayes-style evidence layer. It complements burden testing rather than duplicating it, so discordant genes deserve file-level verification.',
    },
    {
        title: 'Gene Evidence',
        route: '/trait/:traitId?tab=gene-evidence',
        src: helpGeneEvidence,
        alt: 'Gene Evidence screenshot comparing gene-level posterior evidence with perturb-seq regulation',
        caption: 'Use the gene-level scatter to identify convergence or discordance between LoF posterior evidence and perturb-seq regulation. Concordant outliers provide stronger mechanistic context than points supported by one evidence layer alone.',
    },
    {
        title: 'QQ Plot',
        route: '/trait/:traitId?tab=gene-qq',
        src: helpQqPlot,
        alt: 'QQ Plot screenshot comparing observed and expected gene-level association statistics',
        caption: 'Use the QQ plot to assess calibration, tail enrichment, and potential inflation in gene-level association statistics. Large departures from the null line should be read together with the highlighted genes and companion tables.',
    },
    {
        title: 'Cross-trait Heatmap',
        route: '/trait/:traitId?tab=cross-trait-heatmap',
        src: helpCrossTraitHeatmap,
        alt: 'Cross-trait Heatmap screenshot comparing gene-level posterior effects across target traits',
        caption: 'Use the heatmap to compare selected genes across related target traits and identify shared or divergent posterior-effect patterns. The displayed matrix reflects the requested target set and top-gene limit, not the full catalog.',
    },
    {
        title: 'Trait Correlation',
        route: '/trait/:traitId?tab=trait-correlation',
        src: helpTraitCorrelation,
        alt: 'Trait Correlation screenshot showing pairwise similarity among trait-level gene-effect profiles',
        caption: 'Use this matrix to summarize similarity among trait-level gene-effect profiles. High correlation suggests shared structure in the returned evidence, but it should not be treated as causal direction without additional analysis.',
    },
    {
        title: 'Program Volcano',
        route: '/programs/:programId',
        src: helpProgramVolcano,
        alt: 'Program detail volcano screenshot showing regulator and gene perturbation effects within a cNMF program',
        caption: 'Use the program-level volcano on a Program detail page to examine perturbation effect size and significance within one cNMF program. It helps distinguish broad program identity from individual regulator or gene candidates.',
    },
    {
        title: 'Trait Detail',
        route: '/trait/:traitId',
        src: helpTraitDetail,
        alt: 'Trait Detail screenshot showing trait metadata, study information, burden identifiers, and module context',
        caption: 'Use the trait detail header to confirm identifiers, sample context, reported trait labels, and burden metadata before interpreting figures. This prevents mixing file IDs, GWAS IDs, and LoF-side identifiers across panels.',
    },
    {
        title: 'Data Browser',
        route: '/data',
        src: helpDataBrowser,
        alt: 'Data Browser screenshot showing the Download Hub and source file archive cards',
        caption: 'Use Downloads to retrieve source artifacts, folder archives, and indexed outputs behind rendered views. It is the verification route when a plotted point, table row, or missing panel needs to be traced back to the underlying file.',
    },
];

const HELP_SECTIONS = [
    {
        id: 'data-structure',
        title: 'Data Structure',
        icon: DataObjectOutlined,
        kicker: 'TraitProgram connects trait metadata, file-system TSV outputs, gene evidence, and cNMF program relationships.',
        body: [
            'Trait records are indexed by file_metadata and enriched by gwas_meta, lof_meta, trait_ldsc, and file_id_mapping. Analytical panels then read prepared TSV or JSON artifacts from configured file stores.',
            'The browser should be read as a result-review surface. Database tables identify objects and relationships, while Manhattan, volcano, program, gene, and cross-trait views usually trace back to stored workflow outputs.',
        ],
        items: [
            'Use file ID when opening a trait detail page or locating a trait-specific TSV output.',
            'Use GWAS ID when matching original GWAS metadata, accessions, or aliases from upstream records.',
            'Use program ID when following cNMF program annotations, representative genes, and trait-program links.',
            'Use gene symbol or Ensembl ID when checking gene-first evidence and linked program membership.',
        ],
        terms: [
            { name: 'file_id', definition: 'The primary trait file identifier used by the web app and many file-backed chart endpoints.' },
            { name: 'gwas_id', definition: 'The GWAS metadata identifier or accession used as an alias for trait lookup and display.' },
            { name: 'lof_id', definition: 'The LOF-side identifier used by selected GeneBayes, burden, and cross-trait outputs.' },
            { name: 'program_id', definition: 'The cNMF program identifier from program_info and the program relationship tables.' },
        ],
    },
    {
        id: 'search-navigation',
        title: 'Search and Navigation',
        icon: SearchOutlined,
        kicker: 'Search routes should follow the object already in hand instead of forcing every question through one page.',
        body: [
            'Home search is the fastest broad entry point for genes, programs, traits, GCST-style accessions, file names, folders, and common output labels. The main navigation then separates object review from file retrieval.',
            'Trait, Genes, Programs, and Downloads expose different slices of the same result graph. Use linked rows and route URLs to move between them while preserving the identifier being reviewed.',
        ],
        items: [
            'Search genes by symbol or Ensembl ID, then open the gene detail page for linked traits and programs.',
            'Search programs by program ID, annotation, or representative-gene context.',
            'Search traits by trait name, file ID, burden phenotype, or GWAS ID before opening figure tabs.',
            'Search files in Downloads when the exact artifact matters more than the rendered chart.',
        ],
    },
    {
        id: 'trait-browser',
        title: 'Trait Browser',
        icon: InsightsOutlined,
        kicker: 'The Trait page is the main figure-centric review surface for one trait record.',
        body: [
            'The trait list is server paginated and sortable. Open a row to review metadata, LDSC extension fields when present, available analysis modules, and trait-specific chart tabs.',
            'The detail page keeps chart panels and linked tables together. If a panel reports an error, treat that as a failed request or missing artifact, not as evidence that the trait has no signal.',
        ],
        items: [
            'Use Manhattan for variant-level GWAS signal and switch between hits and full data only when the endpoint allows it.',
            'Use Burden Volcano and Posterior Volcano for gene-level LOF and GeneBayes evidence.',
            'Use Program Scatter and Trait Program Graph to move from trait signal to program-level context.',
            'Use Gene Evidence, QQ Plot, Cross-trait Heatmap, and Trait Correlation for gene-centered comparison across traits.',
        ],
        terms: [
            { name: 'sourceRowCount', definition: 'Rows available in the source Manhattan TSV before request-side filtering or sampling.' },
            { name: 'filteredRowCount', definition: 'Rows that remain after server-side filters are applied.' },
            { name: 'returnedRowCount', definition: 'Rows returned to the browser for the active chart request.' },
            { name: '413 response', definition: 'The file exceeded the configured maximum size for that request mode.' },
        ],
    },
    {
        id: 'trait-analysis',
        title: 'Trait Analysis Views',
        icon: AccountTreeOutlined,
        kicker: 'Trait-level views should be interpreted together rather than as isolated charts.',
        body: [
            'Program and graph panels show how trait evidence connects to cellular programs and genes. Volcano and gene panels expose gene-level association evidence. Cross-trait panels compare one trait against related target traits.',
            'When two views disagree, first check identifier mapping and the underlying file in Downloads. Many panels are intentionally driven by different output files and may have different row counts or inclusion rules.',
        ],
        items: [
            'Program Scatter is best for identifying outlier programs or regulators associated with a trait.',
            'Trait Program Graph is best for following linked trait, program, and gene relationships.',
            'Gene Evidence and QQ Plot help separate gene-level strength from calibration or tail behavior.',
            'Cross-trait Heatmap and Trait Correlation compare selected targets across shared gene evidence.',
        ],
    },
    {
        id: 'genes-page',
        title: 'Genes Page',
        icon: BiotechOutlined,
        kicker: 'Genes is the gene-first route for reviewing where a gene appears across the result set.',
        body: [
            'Use Genes when the known object is a gene symbol or Ensembl identifier. The index and detail view summarize metadata, linked programs, linked traits, and gene-program-trait records.',
            'Gene-first review is useful before returning to Trait, because it shows whether a gene is a single-trait observation or part of a broader program and trait pattern.',
        ],
        items: [
            'Search by gene symbol or Ensembl ID and sort by trait or program coverage.',
            'Open gene detail to inspect program membership and associated trait records.',
            'Use linked trait rows to jump back into figure-level evidence for a specific trait.',
            'Use gene-level downloads or tables when a plotted point needs row-level verification.',
        ],
        terms: [
            { name: 'membership score', definition: 'A gene-program relationship score used to rank linked programs for a gene.' },
            { name: 'absGamma', definition: 'An effect-style ranking field used by some gene-program views.' },
        ],
    },
    {
        id: 'programs-page',
        title: 'Programs Page',
        icon: ScienceOutlined,
        kicker: 'Programs focuses on cNMF program identity, annotation, representative genes, and associated traits.',
        body: [
            'Use Programs when the question starts from a program ID, annotation label, representative gene set, or regulator-enrichment context. Program details provide the bridge back to traits.',
            'Representative genes are a quick identity cue, not a substitute for checking the ranked gene table or linked trait evidence.',
        ],
        items: [
            'Search by program ID or annotation label in the main program table.',
            'Inspect representative genes to understand the program identity before interpreting associated traits.',
            'Use associated trait rows to move back into trait-level graphs and volcano panels.',
            'Check regulator enrichment in the original output files when direction or membership requires exact rows.',
        ],
        terms: [
            { name: 'cNMF program', definition: 'A cellular program derived from the perturbation-informed cNMF workflow.' },
            { name: 'representative genes', definition: 'Top-ranked genes shown as a compact identity summary for a program.' },
            { name: 'associated traits', definition: 'Trait records connected to the selected program through trait-program edge tables.' },
        ],
    },
    {
        id: 'score-definitions',
        title: 'Score Definitions',
        icon: RuleOutlined,
        kicker: 'Score columns are panel-specific; compare them only within the same data product and transformation.',
        body: [
            'The browser combines GWAS, LoF burden, GeneBayes posterior, cNMF loading, and trait-program relationship outputs. A field name may be meaningful only inside the panel that owns it.',
            'P values and transformed scales should be checked with the table rows behind the chart. Visual thresholds are review aids; they are not a replacement for the original workflow documentation.',
        ],
        items: [
            'For Manhattan views, use chromosome, position, rsID, P value, and -log10(P) together.',
            'For burden and posterior volcano views, compare effect direction, significance, and gene identity.',
            'For program views, distinguish program annotation, representative genes, and trait association strength.',
            'For cross-trait views, compare only the returned target traits and genes in the current request state.',
        ],
        terms: [
            { name: '-log10(P)', definition: 'A plot scale for P values; larger values indicate smaller P values.' },
            { name: 'post_mean', definition: 'A posterior mean field used by GeneBayes-style outputs and cross-trait gene selection.' },
            { name: 'topGenes', definition: 'The requested number of gene rows for cross-trait matrix generation; the API caps it at 100.' },
        ],
    },
    {
        id: 'cross-trait',
        title: 'Cross-trait Review',
        icon: HubOutlined,
        kicker: 'Cross-trait panels compare the selected trait against target traits using precomputed target files.',
        body: [
            'The cross-trait heatmap matrix is requested for one file ID plus selected targets. It uses server-side limits to keep the browser responsive and defaults to a focused gene set.',
            'If fewer genes are returned than requested, check whether the source target files contain enough parseable gene or Ensembl rows with post_mean values.',
        ],
        items: [
            'Use recommended targets when you want a fast comparison set.',
            'Use search when you need specific traits in the target list.',
            'Use the topGenes control to change matrix depth within the server cap.',
            'Use Trait Correlation when the question is effect-profile similarity rather than row-by-row heatmap inspection.',
        ],
        terms: [
            { name: 'target file', definition: 'A precomputed cross-trait file currently keyed by LOF file ID in the backend.' },
            { name: 'topGenes default', definition: 'The backend default is 80 genes and the maximum accepted value is 100.' },
        ],
    },
    {
        id: 'downloads-exports',
        title: 'Downloads and Exports',
        icon: TableChartOutlined,
        kicker: 'Downloads is the file-facing route for checking exactly what the charts and tables are built from.',
        body: [
            'The Downloads page exposes folder browsing, paginated global search, single-file downloads, batch downloads, and folder archives. It is the right place to verify whether a rendered panel matches the underlying artifact.',
            'Global search is server paginated. Refine the query, page through results, or download specific artifacts instead of expecting the browser to load every matching file at once.',
        ],
        items: [
            'Use folder browsing when you know the directory context.',
            'Use global search when you only know part of a filename, accession, or output label.',
            'Use ZIP archives for complete folders and individual downloads for exact file inspection.',
            'When reporting a mismatch, include the route, identifier, file path, active filters, and expected row or chart state.',
        ],
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: InfoOutlined,
        kicker: 'Most problems become actionable once the route, object identifier, and source file are clear.',
        body: [
            'A visible error state means the request failed or the backing artifact could not be read. It should not be interpreted as a true empty result without checking the source file or API response.',
            'For layout or data issues, reproduce from a concrete URL and keep the active tab, filters, selected file IDs, and approximate time. That is usually enough to distinguish a data problem from a browser-state problem.',
        ],
        items: [
            'For a missing Trait chart, check whether the corresponding TSV exists and whether its file size is within the endpoint limit.',
            'For missing cross-trait rows, check target files and parseable gene or Ensembl columns.',
            'For wrong downloads, compare the selected file path with the table or chart identifier.',
            'For gene or program mismatches, check both the object detail page and the linked trait page.',
        ],
    },
];

const APPENDIX_TOC_ITEMS = [
    { id: 'route-component-guide', title: 'Route Component Guide' },
    { id: 'support-reporting', title: 'Support and Reporting' },
    { id: RELEASE_LOG_ANCHOR, title: 'Release History' },
];

const ROUTE_GUIDE_SECTIONS = [
    {
        title: 'Navigation and shared UI',
        summary: 'Site entry points, mobile navigation, loading panels, and shared legends.',
        icon: InfoOutlined,
        items: [
            {
                name: 'Top Navigation',
                route: '/',
                role: 'Primary desktop navigation bar.',
                usage: [
                    'Use Home, Genes, Programs, Trait, Downloads, and Help to move across the app.',
                    'The active route is highlighted, and the browser URL can be copied to share the current page.',
                ],
            },
            {
                name: 'MobileNavDrawer',
                role: 'Floating mobile menu.',
                usage: [
                    'Tap the menu button to open route links on small screens.',
                    'The button can be dragged to either screen edge and snaps into place after release.',
                ],
            },
            {
                name: 'PageScaffold / StatePanel',
                role: 'Shared loading, empty, and error-state frame.',
                usage: [
                    'When a state panel appears, check the current filter state and API availability first.',
                    'A missing Trait file should show an explanatory panel instead of a blank chart.',
                ],
            },
            {
                name: 'FloatingLegend',
                role: 'Reusable plot legend for marker, color, and count encodings.',
                usage: [
                    'Use it to interpret active chart encodings.',
                    'Collapse it when it overlaps the plot area.',
                ],
            },
        ],
    },
    {
        title: 'Home',
        summary: 'Quick search, cached summary cards, and visual entry points into major result views.',
        icon: SearchOutlined,
        items: [
            {
                name: 'Home File Search',
                route: '/',
                role: 'Fast file and entity discovery.',
                usage: [
                    'Search by filename, folder name, accession, program label, gene symbol, or common output keyword.',
                    'Press Enter to carry the keyword into Downloads global search when file retrieval is the goal.',
                ],
            },
            {
                name: 'Home Stats Cards',
                route: '/',
                role: 'Cached summary cards and shortcuts.',
                usage: [
                    'Use the Traits, Programs, and Genes cards as route shortcuts, and the Associations card for the curated association package.',
                    'If live counts cannot load, the page may reuse cached summary values.',
                ],
            },
            {
                name: 'Home Figure Gallery',
                route: '/',
                role: 'Visual shortcut grid for major analysis panels.',
                usage: [
                    'Jump directly into example Trait figure tabs such as Program Scatter, Trait Program Graph, Manhattan, Volcano, Gene Evidence, QQ Plot, and Cross-trait Heatmap.',
                    'Use the Data Browser card when the question is about retrieving the underlying artifact.',
                ],
            },
        ],
    },
    {
        title: 'Trait views',
        summary: 'Trait browsing, metadata, charts, and chart-linked tables.',
        icon: InsightsOutlined,
        items: [
            {
                name: 'GwasDataList',
                route: '/trait',
                role: 'Trait table browser with search, sorting, and pagination.',
                usage: [
                    'Search by trait, Trait ID, burden phenotype, or GWAS ID.',
                    'Sort by column headers and open a row to enter trait detail.',
                ],
            },
            {
                name: 'TraitMetaCard',
                route: '/trait',
                role: 'Top metadata block on trait detail pages.',
                usage: [
                    'Review trait name, file ID, GWAS ID, burden phenotype, author, sample size, population, and variant summary fields.',
                    'Use metadata before interpreting downstream figure modules.',
                ],
            },
            {
                name: 'ProgramScatter / TraitProgramGraph',
                route: '/trait',
                role: 'Program-level trait interpretation.',
                usage: [
                    'Use Program Scatter to find outlier programs and regulator-supported signals.',
                    'Use Trait Program Graph to inspect trait-program-gene structure and row-level summary tables.',
                ],
            },
            {
                name: 'Manhattan and Volcano panels',
                route: '/trait',
                role: 'Variant-level and gene-level signal review.',
                usage: [
                    'Use Manhattan for chromosome-position GWAS signal and hits/full TSV context.',
                    'Use Burden and Posterior Volcano panels to compare effect direction, significance, and gene identity.',
                ],
            },
            {
                name: 'Gene Evidence, QQ Plot, Cross-trait',
                route: '/trait',
                role: 'Gene-centered comparison inside trait detail.',
                usage: [
                    'Use Gene Evidence and QQ Plot for gene-level strength and calibration.',
                    'Use Cross-trait Heatmap and Trait Correlation for target-trait comparison.',
                ],
            },
        ],
    },
    {
        title: 'Genes and Programs',
        summary: 'Object-first drilldowns for genes, cNMF programs, and linked trait evidence.',
        icon: BiotechOutlined,
        items: [
            {
                name: 'Genes Overview Table',
                route: '/genes',
                role: 'Gene index and detail entry point.',
                usage: [
                    'Review gene symbol, Ensembl ID, gene type, genomic location, and linked counts.',
                    'Open a gene row to inspect metadata and full evidence tables.',
                ],
            },
            {
                name: 'Gene Program Relationships',
                route: '/genes',
                role: 'Program-level table for the current gene.',
                usage: [
                    'Review Program, Function, GO Term, direction, and program gene counts.',
                    'Use this table to see whether the gene participates in coherent functional modules.',
                ],
            },
            {
                name: 'Gene Program Trait Evidence',
                route: '/genes',
                role: 'Full evidence table linking gene, program, and trait.',
                usage: [
                    'Inspect trait, program, role, direction, posterior mean, gamma, membership, and concordance fields together.',
                    'Use this table to judge whether a gene-program relationship is concordant across traits.',
                ],
            },
            {
                name: 'Programs Table and Detail',
                route: '/programs',
                role: 'cNMF program annotation browser.',
                usage: [
                    'Browse Program, Annotation, GO Term, Accession, Ontology, GO P, and Representative Genes.',
                    'Open a Program ID to review program information, genes, and associated traits.',
                ],
            },
            {
                name: 'Associated Traits',
                route: '/programs',
                role: 'Trait-level table linked to one program.',
                usage: [
                    'Review trait name, relationship class, program score, regulator score, visible gene counts, and top genes.',
                    'Use relationship filters and CSV export to separate program-selected, regulator-selected, and jointly selected traits.',
                ],
            },
        ],
    },
    {
        title: 'Downloads and export',
        summary: 'Directory browsing, global search, file selection, ZIP export, CSV export, and plot export.',
        icon: FolderOpenOutlined,
        items: [
            {
                name: 'Data Browser',
                route: '/data',
                role: 'Primary interface for navigating the data file tree.',
                usage: [
                    'Use column-style directory browsing, breadcrumbs, and current-folder filtering.',
                    'Select files for batch download or download individual files and folders.',
                ],
            },
            {
                name: 'Global Search Results',
                route: '/data?mode=global',
                role: 'Flat search view across indexed files and folders.',
                usage: [
                    'Enter at least two characters to start searching.',
                    'Select visible files or individual files, then download all or selected results.',
                ],
            },
            {
                name: 'DataBrowseSummary',
                route: '/data',
                role: 'Summary panel for directory browsing mode.',
                usage: [
                    'Review the current folder, active filter, file and folder counts, and selected file preview.',
                    'Use it when working with a single visible directory column.',
                ],
            },
            {
                name: 'Table CSV and Plot Export',
                route: '/trait',
                role: 'Analysis table and chart output.',
                usage: [
                    'Use Download CSV on chart-linked tables for the current processed result set.',
                    'Use Plotly export for SVG or PNG chart output when preparing figures.',
                ],
            },
        ],
    },
];

const SUPPORT_SECTIONS = [
    {
        icon: ContactSupportOutlined,
        title: 'When To Reach Out',
        body: 'Reach out when browser behavior blocks analysis, when a rendered value disagrees with the underlying result file, or when a route cannot expose data that should exist.',
        bullets: [
            'A Trait tab such as Manhattan, Program Scatter, Gene Evidence, QQ Plot, or Cross-trait Heatmap is missing a result file that should exist.',
            'A download fails repeatedly, returns the wrong artifact, or packages an unexpected folder.',
            'Trait metadata, identifiers, gene symbols, program IDs, rsIDs, or chart-linked table values look inconsistent.',
            'A Programs or Genes drilldown cannot find records present in indexed output files.',
        ],
    },
    {
        icon: DescriptionOutlined,
        title: 'What To Include',
        body: 'A short, concrete report makes the issue reproducible from the same page, route, and filter state.',
        bullets: [
            'Exact route, such as /trait/GCST90083727?tab=program-scatter, /programs/P12, /genes?query=PTMA, or /data?mode=global.',
            'Trait name, file ID, GWAS ID, burden phenotype, program ID, gene symbol, rsID, or file path involved.',
            'Expected result, actual result, active tab, filter state, selected downloads, screenshot, and approximate time.',
        ],
    },
    {
        icon: BugReportOutlined,
        title: 'Issue Categories',
        body: 'Framing the issue clearly helps route it to the data owner, backend owner, or frontend owner faster.',
        bullets: [
            'Data issue: missing rows, mismatched identifiers, incorrect counts, unexpected file contents, or stale indexed paths.',
            'Interface issue: broken layout, navigation problems, disabled controls, chart interaction failures, or text overflow.',
            'Workflow issue: unclear starting point, confusing export path, unsupported filter combination, or missing explanation in the UI.',
        ],
    },
];

const TRIAGE_ITEMS = [
    { label: 'Trait plot or tab', route: '/trait/:traitId', owner: 'Trait figure data and linked table state' },
    { label: 'Gene evidence', route: '/genes?query=GENE', owner: 'Gene index, program relationships, trait evidence rows' },
    { label: 'Program annotation', route: '/programs/PID', owner: 'Program metadata, program genes, associated traits' },
    { label: 'Raw file or download', route: '/data?mode=global', owner: 'Indexed paths, folder ZIP, selected-file downloads' },
];

const REPORT_ROWS = [
    ['Route', '/trait/GCST90083727?tab=program-scatter'],
    ['Object', 'Trait, GWAS ID, gene, program, rsID, or file path'],
    ['Expected', 'What should have appeared or downloaded'],
    ['Actual', 'What appeared, failed, or looked inconsistent'],
    ['State', 'Active tab, filters, selected files, browser, and approximate time'],
];

function WorkflowCard({ card, index }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.45, md: 1.65 },
                backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
            })}
        >
            <Stack spacing={1.05} sx={{ height: '100%' }}>
                <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between">
                    <Box
                        sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            color: theme.palette.primary.dark,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                            fontSize: '0.76rem',
                            fontWeight: 760,
                            fontFamily: theme.typography.fontFamily,
                            flexShrink: 0,
                        }}
                    >
                        {card.step}
                    </Box>
                    <Button
                        component={RouterLink}
                        to={card.route}
                        size="small"
                        variant="outlined"
                        endIcon={<LaunchOutlined sx={{ fontSize: 16 }} />}
                        sx={{ flexShrink: 0 }}
                    >
                        {card.page}
                    </Button>
                </Stack>
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.3, mb: 0.45 }}>
                        {card.title}
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                        {card.body}
                    </Typography>
                </Box>
            </Stack>
        </Paper>
    );
}

function TermList({ terms }) {
    const theme = useTheme();

    if (!terms?.length) return null;

    return (
        <Box
            component="dl"
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '170px minmax(0, 1fr)' },
                gap: { xs: 0.6, sm: '0.7rem 1rem' },
                m: 0,
                mt: 1.45,
                p: { xs: 1.2, md: 1.35 },
                borderRadius: 1,
                bgcolor: theme.custom.surface.raised,
                border: `1px solid ${theme.custom.border.soft}`,
            }}
        >
            {terms.map((term) => (
                <React.Fragment key={term.name}>
                    <Typography
                        component="dt"
                        variant="body2"
                        sx={{
                            color: theme.palette.primary.dark,
                            fontFamily: 'JetBrains Mono, Consolas, monospace',
                            fontSize: '0.75rem',
                            fontWeight: 760,
                            lineHeight: 1.5,
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {term.name}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, m: 0 })}>
                        {term.definition}
                    </Typography>
                </React.Fragment>
            ))}
        </Box>
    );
}

function FigureSlot({ figure }) {
    const theme = useTheme();

    if (!figure) return null;

    return (
        <Box
            sx={{
                mt: figure.title ? 0 : 1.25,
                overflow: 'hidden',
                borderRadius: 1,
                bgcolor: theme.palette.background.paper,
                border: `1px solid ${theme.custom.border.soft}`,
            }}
        >
            <Box
                component="img"
                src={figure.src}
                alt={figure.alt}
                loading="lazy"
                sx={{
                    display: 'block',
                    width: '100%',
                    height: 'auto',
                    objectFit: 'cover',
                    bgcolor: theme.palette.background.paper,
                    borderBottom: `1px solid ${theme.custom.border.soft}`,
                }}
            />
            <Box
                sx={{
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 0.7,
                    px: { xs: 1.2, md: 1.45 },
                    py: { xs: 1.05, md: 1.25 },
                    bgcolor: theme.custom.surface.raised,
                }}
            >
                {figure.title ? (
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle1" sx={{ fontWeight: 780, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                            {figure.title}
                        </Typography>
                        {figure.route ? (
                            <Chip
                                label={figure.route}
                                size="small"
                                sx={{
                                    height: 'auto',
                                    minHeight: 22,
                                    maxWidth: '100%',
                                    borderRadius: 1,
                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    color: theme.palette.primary.dark,
                                    fontFamily: 'JetBrains Mono, Consolas, monospace',
                                    fontSize: '0.68rem',
                                    fontWeight: 720,
                                    '& .MuiChip-label': {
                                        px: 0.8,
                                        overflowWrap: 'anywhere',
                                        whiteSpace: 'normal',
                                    },
                                }}
                            />
                        ) : null}
                    </Stack>
                ) : null}
                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0, lineHeight: 1.68 })}>
                    {figure.caption}
                </Typography>
            </Box>
        </Box>
    );
}

function FigureGuide() {
    const theme = useTheme();

    return (
        <Paper
            id={FIGURE_GUIDE_TOC_ITEM.id}
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.65, md: 1.95 },
                scrollMarginTop: 88,
                backgroundColor: theme.palette.background.paper,
            })}
        >
            <Box sx={{ mb: 1.2 }}>
                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.25 })}>
                    Figure Guide
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        display: 'block',
                        color: theme.palette.primary.dark,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                    }}
                >
                    Full-route screenshots from the current browser, paired with concise interpretation guidance for each analytical view.
                </Typography>
            </Box>
            <Stack spacing={1.1}>
                {FIGURE_GUIDE_ITEMS.map((figure) => (
                    <FigureSlot key={figure.title} figure={figure} />
                ))}
            </Stack>
        </Paper>
    );
}

function HelpSection({ section, index }) {
    const theme = useTheme();
    const Icon = section.icon;

    return (
        <Paper
            id={section.id}
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.65, md: 1.95 },
                scrollMarginTop: 88,
                backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
            })}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="flex-start">
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
                <Box sx={{ minWidth: 0, width: '100%' }}>
                    <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.25 })}>
                        {section.title}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            color: theme.palette.primary.dark,
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            mb: 0.8,
                        }}
                    >
                        {section.kicker}
                    </Typography>
                    <Stack spacing={0.85}>
                        {section.body.map((paragraph) => (
                            <Typography key={paragraph} variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                                {paragraph}
                            </Typography>
                        ))}
                    </Stack>
                    <FigureSlot figure={section.figure} />
                    <Stack spacing={0.78} sx={{ mt: 1.15 }}>
                        {section.items.map((item) => (
                            <Box key={item} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 2,
                                        mt: 1.05,
                                        borderRadius: 1,
                                        bgcolor: theme.palette.primary.main,
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                                    {item}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                    <TermList terms={section.terms} />
                </Box>
            </Stack>
        </Paper>
    );
}

function ReferenceCard({ section, index }) {
    const theme = useTheme();
    const Icon = section.icon;

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.45, md: 1.65 },
                backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
            })}
        >
            <Stack direction="row" spacing={1.1} alignItems="flex-start">
                <Box
                    sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                        flexShrink: 0,
                    }}
                >
                    <Icon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={sectionTitleSx(theme, { mb: 0.4 })}>
                        {section.title}
                    </Typography>
                    <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0.9 })}>
                        {section.body}
                    </Typography>
                    <Stack spacing={0.65}>
                        {section.bullets.map((bullet) => (
                            <Box key={bullet} sx={{ display: 'flex', gap: 0.9, alignItems: 'flex-start' }}>
                                <Box
                                    sx={{
                                        width: 6,
                                        height: 2,
                                        mt: 1,
                                        borderRadius: 1,
                                        bgcolor: theme.palette.primary.main,
                                        flexShrink: 0,
                                    }}
                                />
                                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
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

function RouteGuideItem({ item, index }) {
    const theme = useTheme();

    return (
        <Paper
            elevation={0}
            sx={panelSx(theme, {
                p: 1.25,
                backgroundColor: index % 2 === 0 ? theme.palette.background.paper : theme.custom.surface.raised,
                boxShadow: 'none',
            })}
        >
            <Stack spacing={0.8}>
                <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                            {item.name}
                        </Typography>
                        <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mt: 0.35, mb: 0 })}>
                            {item.role}
                        </Typography>
                    </Box>
                    {item.route ? (
                        <Button
                            component={RouterLink}
                            to={item.route}
                            size="small"
                            variant="outlined"
                            endIcon={<LaunchOutlined sx={{ fontSize: 16 }} />}
                            sx={{ flexShrink: 0 }}
                        >
                            Open
                        </Button>
                    ) : null}
                </Stack>
                <Stack spacing={0.55}>
                    {item.usage.map((line) => (
                        <Box key={line} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                            <Box
                                sx={{
                                    width: 5,
                                    height: 5,
                                    mt: 0.85,
                                    borderRadius: '50%',
                                    bgcolor: alpha(theme.palette.primary.main, 0.72),
                                    flexShrink: 0,
                                }}
                            />
                            <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                                {line}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            </Stack>
        </Paper>
    );
}

function RouteComponentGuide() {
    const theme = useTheme();

    return (
        <Paper
            id="route-component-guide"
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.55, md: 1.9 },
                scrollMarginTop: 88,
                backgroundColor: theme.palette.background.paper,
            })}
        >
            <Box sx={{ mb: 1.35 }}>
                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.35 })}>
                    Route Component Guide
                </Typography>
                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                    A compact map of the current routes and user-facing components, organized by the workflow each one supports.
                </Typography>
            </Box>

            <Stack spacing={1.2}>
                {ROUTE_GUIDE_SECTIONS.map((section) => {
                    const Icon = section.icon;

                    return (
                        <Box
                            key={section.title}
                            sx={{
                                p: { xs: 1.15, md: 1.35 },
                                borderRadius: 1,
                                border: `1px solid ${theme.custom.border.soft}`,
                                bgcolor: theme.custom.surface.raised,
                            }}
                        >
                            <Stack direction="row" spacing={0.9} alignItems="flex-start" sx={{ mb: 1 }}>
                                <Box
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 1,
                                        display: 'grid',
                                        placeItems: 'center',
                                        color: theme.palette.primary.main,
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon sx={{ fontSize: 18 }} />
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                                        {section.title}
                                    </Typography>
                                    <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mt: 0.35, mb: 0 })}>
                                        {section.summary}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                                    gap: 1,
                                }}
                            >
                                {section.items.map((item, index) => (
                                    <RouteGuideItem key={item.name} item={item} index={index} />
                                ))}
                            </Box>
                        </Box>
                    );
                })}
            </Stack>
        </Paper>
    );
}

function SupportReporting() {
    const theme = useTheme();

    return (
        <Box id="support-reporting" sx={{ scrollMarginTop: 88 }}>
            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    p: { xs: 1.55, md: 1.9 },
                    mb: 1.4,
                    backgroundColor: theme.custom.surface.raised,
                })}
            >
                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.35 })}>
                    Support and Reporting
                </Typography>
                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                    Reports are easiest to act on when they identify the route, object, expected result, and source artifact.
                </Typography>
            </Paper>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.15,
                    mb: 1.4,
                }}
            >
                {SUPPORT_SECTIONS.map((section, index) => (
                    <ReferenceCard key={section.title} section={section} index={index} />
                ))}
            </Box>

            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    p: { xs: 1.45, md: 1.7 },
                    mb: 1.4,
                    backgroundColor: theme.palette.background.paper,
                })}
            >
                <Typography variant="subtitle1" sx={sectionTitleSx(theme, { mb: 1 })}>
                    Triage Route Hints
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                        gap: 1,
                    }}
                >
                    {TRIAGE_ITEMS.map((item, index) => (
                        <Box
                            key={item.label}
                            sx={{
                                p: 1,
                                borderRadius: 1,
                                border: `1px solid ${theme.custom.border.soft}`,
                                bgcolor: index % 2 === 0 ? theme.custom.surface.raised : alpha(theme.palette.warning.main, 0.045),
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                                {item.label}
                            </Typography>
                            <Typography variant="body2" sx={captionSx(theme, { mt: 0.55, mb: 0.65, color: theme.palette.text.primary })}>
                                {item.owner}
                            </Typography>
                            <Chip label={item.route} size="small" sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                        </Box>
                    ))}
                </Box>
            </Paper>

            <Paper
                elevation={0}
                sx={panelSx(theme, {
                    p: { xs: 1.45, md: 1.7 },
                    backgroundColor: theme.palette.background.paper,
                })}
            >
                <Typography variant="subtitle1" sx={sectionTitleSx(theme, { mb: 1 })}>
                    Report Template
                </Typography>
                <Stack spacing={0.75}>
                    {REPORT_ROWS.map(([label, value]) => (
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
                            <Typography variant="body2" sx={{ fontWeight: 760, color: theme.palette.text.primary }}>
                                {label}
                            </Typography>
                            <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                                {value}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            </Paper>
        </Box>
    );
}

function ReleaseHistory() {
    const theme = useTheme();
    const entries = releaseEntriesByLocale.en;

    return (
        <Paper
            id={RELEASE_LOG_ANCHOR}
            elevation={0}
            sx={panelSx(theme, {
                p: { xs: 1.55, md: 1.9 },
                scrollMarginTop: 88,
                backgroundColor: theme.palette.background.paper,
            })}
        >
            <Box sx={{ mb: 1.35 }}>
                <Typography variant="h6" sx={sectionTitleSx(theme, { mb: 0.35 })}>
                    Release History
                </Typography>
                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                    A compact release log for tracking user-visible changes to the browser and analysis workflow.
                </Typography>
            </Box>
            <Stack spacing={0.95}>
                {entries.map((entry) => {
                    const Icon = entry.icon || InfoOutlined;

                    return (
                        <Box
                            key={`${entry.date}-${entry.title}`}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '138px minmax(0, 1fr)' },
                                gap: { xs: 0.7, md: 1.25 },
                                p: 1.15,
                                borderRadius: 1,
                                border: `1px solid ${alpha(entry.color || theme.palette.primary.main, 0.16)}`,
                                bgcolor: alpha(entry.color || theme.palette.primary.main, 0.035),
                            }}
                        >
                            <Box>
                                <Typography variant="caption" sx={{ display: 'block', fontWeight: 760, color: theme.palette.text.primary }}>
                                    {entry.date}
                                </Typography>
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontWeight: 760, color: entry.color || theme.palette.primary.main }}>
                                    {entry.label}
                                </Typography>
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.45 }}>
                                    <Box
                                        sx={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 1,
                                            display: 'grid',
                                            placeItems: 'center',
                                            color: entry.color || theme.palette.primary.main,
                                            bgcolor: alpha(entry.color || theme.palette.primary.main, 0.08),
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon sx={{ fontSize: 16 }} />
                                    </Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 760, color: theme.palette.text.primary, lineHeight: 1.25 }}>
                                        {entry.title}
                                    </Typography>
                                </Stack>
                                <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                                    {entry.summary}
                                </Typography>
                                {entry.highlights?.length ? (
                                    <Stack spacing={0.45} sx={{ mt: 0.75 }}>
                                        {entry.highlights.slice(0, 2).map((highlight) => (
                                            <Typography key={highlight} variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                                                {highlight}
                                            </Typography>
                                        ))}
                                    </Stack>
                                ) : null}
                            </Box>
                        </Box>
                    );
                })}
            </Stack>
        </Paper>
    );
}

export default function Help() {
    const theme = useTheme();
    const location = useLocation();
    const tocItems = React.useMemo(() => [
        FIGURE_GUIDE_TOC_ITEM,
        ...HELP_SECTIONS.map(({ id, title }) => ({ id, title })),
        ...APPENDIX_TOC_ITEMS,
    ], []);

    const isProgrammaticScroll = React.useRef(false);
    const targetSectionId = React.useRef(null);
    const scrollTimeoutRef = React.useRef(null);
    const hasManuallyScrolled = React.useRef(false);
    const containerRef = React.useRef(null);

    const [activeSection, setActiveSection] = React.useState(() => {
        if (typeof window !== 'undefined' && window.location.hash) {
            return window.location.hash.replace(/^#/, '');
        }
        return FIGURE_GUIDE_TOC_ITEM.id;
    });

    // Listen for manual interaction to clear programmatic scroll states and prevent auto-re-scrolling
    React.useEffect(() => {
        const handleUserInteraction = () => {
            hasManuallyScrolled.current = true;
            isProgrammaticScroll.current = false;
            targetSectionId.current = null;
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
        window.addEventListener('wheel', handleUserInteraction, { passive: true });
        window.addEventListener('touchmove', handleUserInteraction, { passive: true });
        window.addEventListener('mousedown', handleUserInteraction, { passive: true });
        window.addEventListener('keydown', handleUserInteraction, { passive: true });
        return () => {
            window.removeEventListener('wheel', handleUserInteraction);
            window.removeEventListener('touchmove', handleUserInteraction);
            window.removeEventListener('mousedown', handleUserInteraction);
            window.removeEventListener('keydown', handleUserInteraction);
        };
    }, []);

    React.useEffect(() => {
        const handleScroll = () => {
            if (isProgrammaticScroll.current) {
                if (scrollTimeoutRef.current) {
                    clearTimeout(scrollTimeoutRef.current);
                }
                scrollTimeoutRef.current = setTimeout(() => {
                    isProgrammaticScroll.current = false;
                    if (targetSectionId.current) {
                        setActiveSection(targetSectionId.current);
                        targetSectionId.current = null;
                    }
                }, 150);
            }

            const elements = tocItems.map(item => {
                const el = document.getElementById(item.id);
                return el ? { id: item.id, rect: el.getBoundingClientRect() } : null;
            }).filter(Boolean);

            if (elements.length === 0) return;

            const offset = 110; // accounting for sticky header
            let currentActive = '';

            for (let i = 0; i < elements.length; i++) {
                const { id, rect } = elements[i];
                if (rect.top <= offset) {
                    currentActive = id;
                }
            }

            // Fallback 1: above first element
            if (!currentActive && elements[0]) {
                currentActive = elements[0].id;
            }

            // Fallback 2: scrolled to bottom
            const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50;
            if (scrolledToBottom && elements.length > 0) {
                if (isProgrammaticScroll.current && targetSectionId.current) {
                    currentActive = targetSectionId.current;
                } else {
                    currentActive = elements[elements.length - 1].id;
                }
            }

            if (currentActive) {
                setActiveSection(currentActive);
            }
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [tocItems]);

    const scrollToHash = React.useCallback(() => {
        if (!window.location.hash) return;
        const targetId = window.location.hash.replace(/^#/, '');
        const target = document.getElementById(targetId);
        if (!target) return;

        const offset = 100;
        const elementPosition = target.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'auto'
        });
    }, []);

    // Re-scroll when location.hash changes
    React.useEffect(() => {
        hasManuallyScrolled.current = false;
        scrollToHash();
    }, [location.hash, scrollToHash]);

    // Re-scroll on layout shift if the user has not manually scrolled.
    React.useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            if (!hasManuallyScrolled.current && !isProgrammaticScroll.current) {
                scrollToHash();
            }
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [scrollToHash]);

    return (
        <PageFrame
            title="Help and Data Interpretation"
            subtitle="Guidance for navigating TraitProgram, interpreting trait-gene-program evidence, and tracing rendered views back to their source files."
            maxWidth={CONTENT_PAGE_MAX_WIDTH}
            compact
            sx={{ pt: { xs: 6, md: 2.5, xl: 3 } }}
        >
            <Box ref={containerRef}>
                <Paper
                    elevation={0}
                    sx={panelSx(theme, {
                        p: { xs: 1.8, md: 2.2 },
                        mb: 2,
                        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.success.main, 0.055)})`,
                    })}
                >
                    <Stack spacing={1.2}>
                        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip
                                icon={<InfoOutlined sx={{ fontSize: 16 }} />}
                                label="Use by starting point"
                                sx={summaryChipSx(theme, metricChipTone(theme, 'primary'))}
                            />
                            {['Trait-first review', 'Gene evidence', 'Program context', 'File verification'].map((label) => (
                                <Chip key={label} label={label} sx={summaryChipSx(theme, metricChipTone(theme, 'neutral'))} />
                            ))}
                        </Stack>
                        <Typography variant="body2" sx={captionSx(theme, { color: theme.palette.text.primary, mb: 0 })}>
                            Follow the same logic as the data products: identify the object, choose the matching route, inspect the rendered evidence, then verify important values against the backing TSV or indexed table.
                        </Typography>
                    </Stack>
                </Paper>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
                        gap: 1.15,
                        mb: 2,
                    }}
                >
                    {WORKFLOW_STEPS.map((card, index) => (
                        <WorkflowCard key={card.title} card={card} index={index} />
                    ))}
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr)' },
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
                        sx={panelSx(theme, {
                            p: 1.15,
                            position: { lg: 'sticky' },
                            top: { lg: 76 },
                            maxHeight: { lg: 'calc(100vh - 96px)' },
                            overflowY: { lg: 'auto' },
                        })}
                    >
                        <Box sx={{ px: 0.85, py: 0.7 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 760, color: theme.palette.text.primary, mb: 0.35 }}>
                                On this page
                            </Typography>
                            <Typography variant="caption" sx={captionSx(theme, { display: 'block', mb: 0 })}>
                                {tocItems.length} sections
                            </Typography>
                        </Box>
                        <Stack spacing={0.35} sx={{ mt: 1 }}>
                            {tocItems.map((item) => {
                                const isActive = item.id === activeSection;
                                return (
                                    <Box
                                        key={item.id}
                                        component="a"
                                        href={`#${item.id}`}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const target = document.getElementById(item.id);
                                            if (target) {
                                                const offset = 100; // accounting for sticky header offset
                                                const elementPosition = target.getBoundingClientRect().top + window.scrollY;
                                                const offsetPosition = elementPosition - offset;

                                                if (scrollTimeoutRef.current) {
                                                    clearTimeout(scrollTimeoutRef.current);
                                                }

                                                isProgrammaticScroll.current = true;
                                                targetSectionId.current = item.id;

                                                window.scrollTo({
                                                    top: offsetPosition,
                                                    behavior: 'smooth'
                                                });

                                                window.history.pushState(null, null, `#${item.id}`);
                                            }
                                        }}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.9,
                                            px: 1.25,
                                            py: 0.8,
                                            borderRadius: 1,
                                            color: isActive ? theme.palette.primary.dark : theme.palette.text.secondary,
                                            bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                            fontSize: '0.86rem',
                                            fontWeight: isActive ? 760 : 700,
                                            textDecoration: 'none',
                                            transition: `background-color ${theme.custom.motion.swift}, color ${theme.custom.motion.swift}, transform ${theme.custom.motion.swift}`,
                                            '&:hover': {
                                                color: theme.palette.primary.dark,
                                                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.07),
                                                transform: 'translateX(2px)',
                                            },
                                        }}
                                    >
                                        <Box sx={{ width: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                                            <Box
                                                sx={{
                                                    width: isActive ? 4 : 6,
                                                    height: isActive ? 16 : 6,
                                                    borderRadius: isActive ? '2px' : '50%',
                                                    bgcolor: isActive ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.3),
                                                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                }}
                                            />
                                        </Box>
                                        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                                            {item.title}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Paper>

                    <Stack spacing={1.5}>
                        <FigureGuide />
                        {HELP_SECTIONS.map((section, index) => (
                            <HelpSection key={section.id} section={section} index={index} />
                        ))}
                        <RouteComponentGuide />
                        <SupportReporting />
                        <ReleaseHistory />
                    </Stack>
                </Box>
            </Box>
        </PageFrame>
    );
}
