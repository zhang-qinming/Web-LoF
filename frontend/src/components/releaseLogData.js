import Biotech from '@mui/icons-material/Biotech';
import FileDownload from '@mui/icons-material/FileDownload';
import Hub from '@mui/icons-material/Hub';
import QueryStats from '@mui/icons-material/QueryStats';
import Search from '@mui/icons-material/Search';
import Storage from '@mui/icons-material/Storage';

export const RELEASE_LOG_ANCHOR = 'release-log';

const releaseEntryDrafts = [
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'May 07, 2026',
            label: 'Foundation',
            title: 'The initial browser architecture was established',
            summary: 'The first working version defined the separated frontend and backend architecture, trait-oriented routes, browse workflow, and initial GWAS table and plotting components.',
            highlights: [
                'Express routes, MySQL models, the Vite frontend, and React routing were organized into a coherent project structure.',
                'Browse, trait detail, Manhattan plotting, and paginated GWAS table views formed the first complete review workflow.',
                'This release provided the structural basis for later figure, data, and graph-oriented workflows.',
            ],
            note: 'This entry marks the first traceable baseline of the current browser implementation.',
        },
        zh: {
            date: '2026-05-07',
            label: '基础',
            title: '初始浏览器架构建立',
            summary: '首个可运行版本明确了前后端分离架构、性状相关路由、浏览流程，以及初始 GWAS 表格和绘图组件。',
            highlights: [
                '后端 Express 路由、MySQL 模型、Vite 前端和 React 路由被组织为完整项目结构。',
                '浏览列表、性状详情、曼哈顿图和分页 GWAS 表格形成了第一条完整的结果复核路径。',
                '后续图形、数据和网络视图均在这一结构基础上继续扩展。',
            ],
            note: '该节点是当前浏览器实现中可追溯的第一个稳定基线。',
        },
    },
    {
        icon: Storage,
        color: '#0f766e',
        en: {
            date: 'May 08, 2026',
            label: 'Setup',
            title: 'Environment setup and metadata import were added',
            summary: 'Local and cluster configuration examples, database initialization helpers, and metadata import scripts were added so the application could be populated and run reproducibly.',
            highlights: [
                'Environment examples and setup scripts made local and cluster startup more repeatable.',
                'Metadata import and initialization helpers allowed trait context to be loaded from structured sources.',
                'This work converted the scaffold into an application that could be started and populated outside a single development machine.',
            ],
            note: 'Although this release was mostly operational, it was essential for reproducible use by other project members.',
        },
        zh: {
            date: '2026-05-08',
            label: '配置',
            title: '环境配置与元数据导入补齐',
            summary: '本地和集群配置示例、数据库初始化辅助脚本，以及元数据导入脚本被加入，使应用可以重复启动并导入数据。',
            highlights: [
                '环境示例和启动脚本提高了本地与集群环境中的启动一致性。',
                '元数据导入和初始化工具使性状上下文可以从结构化数据源载入。',
                '该阶段使项目不再依赖单一开发环境，可以被其他成员重复运行和填充数据。',
            ],
            note: '这一版本主要面向运行环境，但对项目协作和可重复部署非常关键。',
        },
    },
    {
        icon: Hub,
        color: '#0284c7',
        en: {
            date: 'May 09, 2026',
            label: 'Programs',
            title: 'Program and regulator views were introduced',
            summary: 'Program-regulator plots added a second analytical view for trait signals, extending interpretation beyond single-variant inspection.',
            highlights: [
                'A dedicated Programs route and a scatter-style figure family were added.',
                'Browse and metadata flows were extended so trait review could branch into program-centered exploration.',
                'The application moved from a trait-only browser toward a multi-view scientific review tool.',
            ],
            note: 'This release marks the first clear expansion from trait browsing toward program-level interpretation.',
        },
        zh: {
            date: '2026-05-09',
            label: '程序',
            title: '程序与调控因子视图引入',
            summary: '程序-调控因子图为性状信号增加了第二个分析视角，使解释不再局限于单个变异。',
            highlights: [
                '独立的程序页面和散点图视图被加入。',
                '浏览流程和元数据链路被扩展，使性状复核可以自然进入程序视角。',
                '应用从单一性状浏览器开始转向多视角科研复核工具。',
            ],
            note: '该版本是从性状浏览扩展到程序层面解释的第一个明确节点。',
        },
    },
    {
        icon: QueryStats,
        color: '#0284c7',
        en: {
            date: 'May 13, 2026',
            label: 'Data',
            title: 'Data access expanded and gene views were prepared',
            summary: 'Variant-oriented data routes matured while the first gene-oriented components were prepared for the next stage of browser expansion.',
            highlights: [
                'Data and download routes were expanded to expose variant-related outputs more consistently.',
                'Early gene regulation, program scatter, and supporting components were introduced before the full gene workflow.',
                'Variant-related views began to serve as practical entry points into result artifacts.',
            ],
            note: 'This release connects the original trait browser to the later gene and program workflows.',
        },
        zh: {
            date: '2026-05-13',
            label: '数据',
            title: '数据访问扩展并准备基因视图',
            summary: '面向变异的数据路由继续完善，同时首批基因相关组件被准备出来，为后续浏览器扩展奠定基础。',
            highlights: [
                '数据和下载相关路由被扩展，变异相关输出在界面中的呈现更加一致。',
                '早期基因调控、程序散点图和支撑组件在完整基因工作流之前被引入。',
                '变异相关页面开始成为进入结果文件的实际入口。',
            ],
            note: '该版本连接了早期性状浏览器和后续基因、程序工作流。',
        },
    },
    {
        icon: QueryStats,
        color: '#64748b',
        en: {
            date: 'May 18, 2026',
            label: 'Stability',
            title: 'The first interface stabilization pass was completed',
            summary: 'After the initial feature expansion, a focused correction pass improved the program scatter, Home, Trait, and Variants surfaces.',
            highlights: [
                'Multiple routes were reviewed together instead of being corrected as isolated pages.',
                'Program scatter behavior and trait-facing navigation were refined before additional analytical figures were added.',
                'The release improved interface stability before the next round of larger analytical components.',
            ],
            note: 'This was a modest but important quality pass that aligned correction work with feature delivery.',
        },
        zh: {
            date: '2026-05-18',
            label: '稳定',
            title: '首轮界面稳定化修正完成',
            summary: '在早期功能快速扩展后，程序散点图、首页、性状页和变异页进行了一轮集中修正。',
            highlights: [
                '多个路由被放在同一轮中复核，而不是作为彼此孤立的页面分别修补。',
                '程序散点图行为和性状相关导航在更多分析图形加入前先得到调整。',
                '该版本的重点是提升已有界面的稳定性，而不是继续增加新功能。',
            ],
            note: '该版本规模不大，但体现出功能交付后及时进行质量修正的工作节奏。',
        },
    },
    {
        icon: FileDownload,
        color: '#b45309',
        en: {
            date: 'May 19, 2026',
            label: 'Results',
            title: 'Result data became easier to access',
            summary: 'Data-facing routes and Home or variant entry paths were refined so users could reach output artifacts more directly.',
            highlights: [
                'Result-file access was strengthened through backend routes instead of remaining only page-level scaffolding.',
                'Home and variant entry points were adjusted together so search-based and route-based access became more consistent.',
                'This release prepared the system for coordinated development of plots, tables, and raw outputs.',
            ],
            note: 'This release mainly clarified routing and access paths before the larger figure expansion.',
        },
        zh: {
            date: '2026-05-19',
            label: '结果',
            title: '结果数据入口进一步明确',
            summary: '面向结果文件的数据路由以及首页、变异页入口被重新整理，用户可以更直接地进入实际输出文件。',
            highlights: [
                '结果文件访问被纳入后端路由体系，而不再停留在页面层面的临时结构。',
                '首页和变异页共同调整后，搜索入口和路由入口开始使用更一致的路径逻辑。',
                '该版本为后续图形、表格和原始输出的协同推进做好准备。',
            ],
            note: '这一版本主要处理路由和访问路径，为之后的图形扩展提供了基础。',
        },
    },
    {
        icon: QueryStats,
        color: '#ea580c',
        en: {
            date: 'May 20, 2026',
            label: 'Figures',
            title: 'Manhattan and volcano views matured',
            summary: 'GWAS Manhattan plots, burden volcano plots, and related cleanup work made the Trait page more suitable for analytical review.',
            highlights: [
                'The Manhattan view added locus-level signal inspection directly within the trait workflow.',
                'The volcano view added a complementary effect-oriented display for reading signal strength and direction together.',
                'Follow-up corrections stabilized route wiring, companion tables, and figure-side data loading.',
            ],
            note: 'Several smaller corrections around this date are represented here as one figure-oriented milestone.',
        },
        zh: {
            date: '2026-05-20',
            label: '图形',
            title: '曼哈顿图与火山图视图成熟',
            summary: 'GWAS 曼哈顿图、负担检验火山图及相关清理工作加入性状页后，该页面更适合进行分析复核。',
            highlights: [
                '曼哈顿图将位点级信号检查直接纳入性状工作流。',
                '火山图提供了互补的效应展示，使用户可以同时查看信号强度和方向。',
                '后续修正稳定了路由连接、配套表格和图形取数逻辑。',
            ],
            note: '该日期附近的若干小修正被合并为一个图形能力相关的里程碑。',
        },
    },
    {
        icon: Storage,
        color: '#0f766e',
        en: {
            date: 'May 21, 2026',
            label: 'Staging',
            title: 'File-backed data handling was consolidated',
            summary: 'Backend file stores, TSV handling, and multi-route data access were reorganized so rendered and downloadable outputs could be served more consistently.',
            highlights: [
                'File-backed data gained a clearer backend access pattern instead of route-specific handling.',
                'Trait, program, regulation, and data routes were adjusted together to unify output discovery.',
                'The reorganization made later rendering and download features easier to integrate.',
            ],
            note: 'Although mostly backend work, this release directly improved the dependability of browser-served result files.',
        },
        zh: {
            date: '2026-05-21',
            label: '文件',
            title: '文件型数据处理得到整合',
            summary: '后端文件存储、TSV 处理和多路由数据访问被重新整理，使渲染输出和可下载输出能够更一致地提供给前端。',
            highlights: [
                '文件型数据获得了更清晰的后端访问模式，不再依赖各路由分别处理。',
                '性状、程序、调控和数据相关路由在同一轮中调整，输出文件的发现方式更加统一。',
                '这次整理降低了后续渲染和下载功能的集成难度。',
            ],
            note: '这一版本主要涉及后端基础设施，但直接影响结果文件在浏览器中的可用性和稳定性。',
        },
    },
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'May 22, 2026',
            label: 'Transport',
            title: 'Backend configuration and request flow were reorganized',
            summary: 'Configuration, request helpers, model wiring, and frontend API consumers were reorganized to make internal data access less fragile.',
            highlights: [
                'Configuration, request utilities, models, and trait-facing frontend consumers were adjusted in one structural pass.',
                'Backend data access began to resemble a maintained service layer rather than controller-local glue code.',
                'Trait-side figure consumers were updated alongside backend changes, keeping the refactor connected to user-facing workflows.',
            ],
            note: 'This release improved the internal structure needed for safer feature development.',
        },
        zh: {
            date: '2026-05-22',
            label: '传输',
            title: '后端配置与请求流程重组',
            summary: '配置、请求辅助函数、模型连接方式和前端 API 消费端被系统整理，使内部数据访问更稳定。',
            highlights: [
                '配置、请求工具、模型和性状侧前端调用方在同一轮结构调整中被更新。',
                '后端数据访问开始从控制器内的局部连接逻辑转向更可维护的服务层结构。',
                '性状页图形取数逻辑与后端同步调整，使重构仍然服务于真实用户流程。',
            ],
            note: '该版本提升了内部结构质量，为后续功能开发提供了更稳固的基础。',
        },
    },
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'May 23, 2026',
            label: 'Render',
            title: 'Rendered outputs and environment paths were aligned',
            summary: 'The render pipeline, file-store handling, and environment examples were aligned for more reliable local and cluster deployment.',
            highlights: [
                'Request handling, rendered outputs, and file-store conventions were aligned across backend routes.',
                'Frontend, backend, and cluster environment examples were refreshed to improve rendered-asset path resolution.',
                'Trait-side figures were prepared to consume rendered outputs through shared path logic.',
            ],
            note: 'This release moved rendered-output handling closer to an operational deployment model.',
        },
        zh: {
            date: '2026-05-23',
            label: '渲染',
            title: '渲染输出与环境路径对齐',
            summary: '渲染管线、文件存储处理方式以及本地和集群环境示例被对齐，使部署和资源解析更加可靠。',
            highlights: [
                '后端多个路由中的请求处理、渲染输出和文件存储约定被统一。',
                '前端、后端和集群环境示例同步更新，使渲染资源路径解析更加一致。',
                '性状页图形通过共享路径逻辑适配渲染输出，避免各页面重复实现。',
            ],
            note: '该版本推动渲染输出处理从试验性实现转向更接近实际部署的状态。',
        },
    },
    {
        icon: FileDownload,
        color: '#b45309',
        en: {
            date: 'May 24, 2026',
            label: 'Download',
            title: 'Export and raw-file access became primary workflows',
            summary: 'Download helpers were integrated into the main browsing workflow so users could move from figures and tables back to exported result files more directly.',
            highlights: [
                'Explicit helper paths were added for variant files and other result exports.',
                'Trait, program, and variant-facing routes were reviewed together to keep download behavior consistent across views.',
                'Immediate follow-up corrections strengthened the export path after rollout.',
            ],
            note: 'This release improved confidence that file requests lead to clear and consistent responses.',
        },
        zh: {
            date: '2026-05-24',
            label: '下载',
            title: '导出与原始文件访问成为主要流程',
            summary: '下载辅助路径被纳入主浏览流程，用户可以更直接地从图形和表格回到具体导出文件。',
            highlights: [
                '变异文件和其他结果导出获得了更明确的辅助访问路径。',
                '性状、程序和变异相关路由被共同复核，使下载行为在不同视图中保持一致。',
                '上线后的即时修正进一步增强了导出路径的稳定性。',
            ],
            note: '该版本提升了文件请求的可靠性，使用户点击文件时能够得到明确、一致的响应。',
        },
    },
    {
        icon: Hub,
        color: '#7c3aed',
        en: {
            date: 'May 26, 2026',
            label: 'Graph',
            title: 'Trait-gene association map refinement began',
            summary: 'Before the larger gene release, the gene association map received a focused refinement pass so it could support more navigation and interpretation tasks.',
            highlights: [
                'Graph behavior was refined as its own task rather than being bundled into a larger feature release.',
                'This separated graph iteration from the gene workflow and clarified the component’s role in navigation.',
                'The changes prepared the graph for stronger gene-linked views in the following release.',
            ],
            note: 'This entry shows that the graph matured incrementally rather than through a single large change.',
        },
        zh: {
            date: '2026-05-26',
            label: '网络',
            title: '性状-程序图开始专项优化',
            summary: '在更大规模的基因功能发布之前，性状-程序图先完成了一次聚焦优化，使其能够承担更多导航和解释任务。',
            highlights: [
                '图行为被作为独立任务优化，而不是并入更大的功能发布。',
                '这次调整将图组件迭代与基因工作流拆分开来，明确了图在导航中的作用。',
                '相关改动为下一阶段更完整的基因关联图视图做好准备。',
            ],
            note: '该节点说明图组件是逐步成熟的，而不是通过一次大改完成的。',
        },
    },
    {
        icon: Biotech,
        color: '#7c3aed',
        en: {
            date: 'May 27, 2026',
            label: 'Genes',
            title: 'Gene evidence and trait-program links were expanded',
            summary: 'Gene-level evidence views were added alongside a stronger gene association map, connecting variant signals to more interpretable biological context.',
            highlights: [
                'Gene regulation, program scatter, data-browse summaries, and broader route support expanded the application.',
                'The gene association map was refined after its first rollout rather than remaining a static add-on.',
                'Navigation between genes, programs, variants, and traits became more coherent for biological interpretation.',
            ],
            note: 'This release brings gene evidence, graph navigation, and trait-program context into one integrated workflow.',
        },
        zh: {
            date: '2026-05-27',
            label: '基因',
            title: '基因证据与性状-程序联系扩展',
            summary: '基因层面证据视图与更完善的性状-程序图共同加入，使变异信号能够连接到更可解释的生物学背景。',
            highlights: [
                '基因调控、程序散点图、数据浏览摘要和更完整的路由支持被加入。',
                '性状-程序图在首次发布后继续优化，而不是作为静态附属组件保留。',
                '基因、程序、变异和性状之间形成了更连贯的生物学解释路径。',
            ],
            note: '该版本将基因证据、图导航和性状-程序语境整合为同一工作流。',
        },
    },
    {
        icon: QueryStats,
        color: '#c2410c',
        en: {
            date: 'May 29, 2026',
            label: 'Compare',
            title: 'Cross-trait heatmaps enabled comparative review',
            summary: 'Heatmap views made it easier to examine whether gene effects are shared or divergent across related traits without leaving the main exploration workflow.',
            highlights: [
                'A dedicated comparative matrix was added for cross-trait inspection.',
                'Backend cross-trait routes and frontend figure helpers were expanded together so the heatmap could fit into the existing trait workflow.',
                'Legend, help, and figure components were adjusted to support comparison-first interpretation.',
            ],
            note: 'This is the first release in the log organized explicitly around comparative analysis.',
        },
        zh: {
            date: '2026-05-29',
            label: '比较',
            title: '跨性状热图支持比较式复核',
            summary: '热图视图使用户可以在不离开主浏览流程的情况下，检查基因效应在相关性状之间是否共享或分化。',
            highlights: [
                '专门的比较矩阵被加入，用于跨性状检查。',
                '后端跨性状路由和前端图形辅助同步扩展，使热图能够嵌入既有性状工作流。',
                '图例、帮助说明和图形组件同步调整，以支持先比较、再细看的解释方式。',
            ],
            note: '这是版本记录中第一次明确围绕比较分析组织的发布。',
        },
    },
    {
        icon: QueryStats,
        color: '#0f766e',
        en: {
            date: 'May 31, 2026',
            label: 'Tables',
            title: 'Companion tables and summaries were standardized',
            summary: 'Tables across heatmaps, QQ and scatter panels, regulation views, and graph summaries were cleaned up so analytical pages could be read more consistently.',
            highlights: [
                'A broad set of companion tables was reviewed rather than a single figure family.',
                'Summary components and theme helpers were adjusted together so table views followed the same visual system.',
                'The release improved readability across analytical surfaces without introducing a new figure type.',
            ],
            note: 'This release focused on interpretability and consistency rather than adding a new analysis category.',
        },
        zh: {
            date: '2026-05-31',
            label: '表格',
            title: '配套表格与摘要视图标准化',
            summary: '热图、QQ 图、散点图、调控视图和图摘要中的表格被统一整理，使分析页面的阅读方式更一致。',
            highlights: [
                '一批配套表格被同时复核，而不是只调整单一图形类型的表格。',
                '摘要组件和主题辅助函数同步调整，使表格视图遵循同一视觉系统。',
                '该版本提升了分析界面的可读性，并未引入新的图形类别。',
            ],
            note: '该版本重点在于解释一致性和阅读质量，而不是新增分析类别。',
        },
    },
    {
        icon: Search,
        color: '#ff6b4a',
        en: {
            date: 'Jun 01, 2026',
            label: 'Home',
            title: 'Home page structure was reorganized into clearer modules',
            summary: 'The Home page was reorganized into clearer search, figure, and overview sections, improving scanability for new and returning users.',
            highlights: [
                'The page was divided into smaller blocks that are easier to scan.',
                'Search entry points were separated from the figure gateway so the page could support direct lookup and visual exploration.',
                'The new structure made later illustration, copy, and release-log improvements easier to integrate.',
            ],
            note: 'This release provided the structural cleanup behind the current Home page presentation.',
        },
        zh: {
            date: '2026-06-01',
            label: '主页',
            title: '首页结构被重组为更清晰的模块',
            summary: '首页被整理为更明确的搜索区、图形入口区和概览区，提高了新用户和回访用户的扫读效率。',
            highlights: [
                '页面被划分为更小、更容易扫读的内容块。',
                '搜索入口和图形入口被分开，使页面同时支持直接查找和视觉探索。',
                '新的结构为后续插图、文案和版本记录改进提供了更清晰的位置。',
            ],
            note: '该版本为当前首页展示方式提供了结构基础。',
        },
    },
    {
        icon: Search,
        color: '#f97316',
        en: {
            date: 'Jun 02, 2026',
            label: 'Polish',
            title: 'Home artwork and supporting copy were refined',
            summary: 'Featured figure thumbnails, SVG assets, and supporting browse metadata were refined so the refreshed Home page presented the project more coherently.',
            highlights: [
                'Featured Home illustrations were made more consistent in quality and presentation.',
                'Copy, spacing, and metadata support were refined across frontend and backend surfaces.',
                'Trait and browse pages were adjusted alongside Home so the visual language remained consistent beyond the first screen.',
            ],
            note: 'This release turned the Home refresh from structural reorganization into a more deliberate interface presentation.',
        },
        zh: {
            date: '2026-06-02',
            label: '润色',
            title: '首页插图与配套文案继续优化',
            summary: '代表性图形缩略图、SVG 资源和配套浏览元数据被进一步整理，使更新后的首页更连贯地呈现项目内容。',
            highlights: [
                '首页代表性插图的质量和呈现一致性得到提升。',
                '前端和后端相关页面的文案、间距和元数据支撑继续优化。',
                '性状页和浏览页也同步调整，使新的视觉语言不只停留在首页。',
            ],
            note: '该版本使首页更新从结构重排进一步转向更完整的界面呈现。',
        },
    },
    {
        icon: Hub,
        color: '#ff6b4a',
        en: {
            date: 'Jun 03, 2026',
            label: 'Graph',
            title: 'Search and trait-program-gene navigation were refined',
            summary: 'Search behavior and graph interaction were refined so users can move from the Home page into trait, program, and gene contexts more directly.',
            highlights: [
                'Home and trait entry paths around figures, tables, and featured destinations were cleaned up.',
                'Trait-program-gene graph behavior was refined across the trait-side visualization stack.',
                'The release log was expanded in the same cycle so recent work could be read as a coherent build history.',
            ],
            note: 'This release focused on smoothing the connected browsing experience rather than introducing a new category of analysis.',
        },
        zh: {
            date: '2026-06-03',
            label: '图谱',
            title: '搜索与性状-程序-基因导航继续优化',
            summary: '搜索行为和图交互逻辑被进一步优化，使用户可以更直接地从首页进入性状、程序和基因语境。',
            highlights: [
                '首页和性状页围绕图形、表格和推荐入口的进入路径被清理。',
                '性状-程序-基因图在性状侧可视化体系中的交互行为继续细化。',
                '版本记录在同一轮中得到扩展，使近期工作能够呈现为连贯的构建历史。',
            ],
            note: '该版本重点改善联动浏览体验，而不是新增分析类别。',
        },
    },
    {
        icon: Storage,
        color: '#0f766e',
        en: {
            date: 'Jun 08, 2026',
            label: 'Table',
            title: 'Responsive layout and table presentation were beautified',
            summary: 'Table styles, column alignments, responsive width rules, and spacing were standardized across all analytical routes to improve readability on various screen sizes.',
            highlights: [
                'Responsive layout rules were applied so page surfaces automatically adapt to wide and narrow screens.',
                'Header styling, padding, and alignments were unified across Trait, Genes, and Programs lists.',
                'Text wrapping and column widths were refined to minimize horizontal scrolling.',
            ],
            note: 'This pass ensured tables function cleanly as dense information dashboards.',
        },
        zh: {
            date: '2026-06-08',
            label: '表格',
            title: '响应式布局与表格呈现优化',
            summary: '在所有分析路由中统一了表格样式、列对齐、响应式宽度规则及间距，从而提升了不同屏幕尺寸下的可读性。',
            highlights: [
                '应用响应式布局规则，使页面自适应宽屏与窄屏显示。',
                '统一了性状、基因和程序列表的表头样式、边距及对齐方式。',
                '优化了文本折行和列宽，最大限度减少不必要的水平滚动。',
            ],
            note: '此轮优化确保了表格能作为密集信息看板清晰高效地工作。',
        },
    },
    {
        icon: QueryStats,
        color: '#ea580c',
        en: {
            date: 'Jun 13, 2026',
            label: 'Analysis',
            title: 'Trait effect correlation and page streamlining',
            summary: 'A dedicated Trait Effect Correlation view was introduced and pages were streamlined to provide direct access to core associations.',
            highlights: [
                'Implemented the Trait Effect Correlation component to help users analyze concordance and profile similarity.',
                'Integrated LDSC (linkage disequilibrium score regression) heritability metadata fields into trait summaries.',
                'Streamlined routing structure and simplified view layouts to accelerate navigation.',
            ],
            note: 'This release added a new dimension of comparison while reducing visual clutter.',
        },
        zh: {
            date: '2026-06-13',
            label: '分析',
            title: '引入性状效应相关性并简化页面',
            summary: '引入了专门的性状效应相关性分析视图，并对页面进行了流线型整理，提供了对核心关联的更直接访问。',
            highlights: [
                '实现了性状效应相关性组件，辅助用户分析效应一致性与轮廓相似度。',
                '在性状元数据中集成了 LDSC 遗传力指标及扩展字段。',
                '精简了路由结构，简化页面布局以加快导航速度。',
            ],
            note: '该版本在增加全新比较维度的同时，降低了界面的视觉杂乱感。',
        },
    },
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'Jun 17, 2026',
            label: 'Speed',
            title: 'Unified caching rules accelerated page loads',
            summary: 'Unified caching and data pre-retrieval rules were implemented across the backend and frontend, achieving faster page transition times.',
            highlights: [
                'Implemented server-side metadata caching and directory-level file list caching to avoid repeated disk reads.',
                'Unified API request-deduplication and response caching on the frontend to speed up repeated route hits.',
                'Optimized data payload sizes for full-mode Manhattan and cross-trait requests.',
            ],
            note: 'These changes resolved sluggish navigation by reducing cold-start API times.',
        },
        zh: {
            date: '2026-06-17',
            label: '速度',
            title: '统一缓存规则大幅提升加载速度',
            summary: '在前后端实现了统一的缓存和数据预取规则，大幅缩短了页面切换的加载等待时间。',
            highlights: [
                '实现了服务端元数据缓存与目录级文件列表缓存，避免重复的磁盘扫描。',
                '在前端统一了 API 请求去重与响应缓存，以加速对已访问路由重新装载。',
                '优化了全量曼哈顿图和跨性状请求的数据传输量，提高了大文件解析效率。',
            ],
            note: '这些更改通过缩短冷启动 API 响应时间，解决了页面切换时的卡顿问题。',
        },
    },
    {
        icon: Biotech,
        color: '#7c3aed',
        en: {
            date: 'Jun 25, 2026',
            label: 'UX Polish',
            title: 'Polished interactive components and page visual style',
            summary: 'Finished a comprehensive visual polish across the site, refining the Data Browser layout, resolving drag boundary bugs, and improving table column wrapping.',
            highlights: [
                'Beautified the Data Browser page with a clean sidebar folder layout, visual card grid, and inline action buttons.',
                'Resolved the Floating Legend boundary constraint bug to prevent erratic movement inside non-positioned containers.',
                'Implemented auto-wrapping responsive text rules for table cells to keep text-dense tables readable.',
            ],
            note: 'This release represents the latest refinement in user interaction and visual quality.',
        },
        zh: {
            date: '2026-06-25',
            label: '体验',
            title: '交互组件细节优化与视觉润色',
            summary: '完成了全站范围内的视觉和体验润色，重构了数据浏览器页面布局，修复了拖拽边界问题，并优化了表格内容折行。',
            highlights: [
                '美化数据浏览器页面，增加了侧边栏文件夹树、文件卡片网格和行内操作按钮。',
                '修复了悬浮图例在非定位父容器中的拖拽边界计算 bug，防止其出现异常移动。',
                '为所有数据表格引入了自适应文本折行规则，提升了文字密集型表格的可读性。',
            ],
            note: '该版本代表了用户交互体验与界面细节品质上的最新优化。',
        },
    },
];

function buildReleaseEntries(locale) {
    return releaseEntryDrafts.map((entry) => ({
        icon: entry.icon,
        color: entry.color,
        ...entry[locale],
    }));
}

export const releaseEntriesByLocale = {
    en: buildReleaseEntries('en'),
    zh: buildReleaseEntries('zh'),
};

export const releaseEntries = releaseEntriesByLocale.en;
