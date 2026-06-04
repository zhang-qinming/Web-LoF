import {
    Biotech,
    FileDownload,
    Hub,
    QueryStats,
    Search,
    Storage,
} from '@mui/icons-material';

export const RELEASE_LOG_ANCHOR = 'release-log';

const releaseEntryDrafts = [
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'May 07, 2026',
            label: 'Foundation',
            title: 'The first full browser skeleton landed',
            summary: 'The initial frontend-backend split, trait routes, browse flow, and first GWAS table/plot components were committed as a usable baseline.',
            highlights: [
                'The create commit established the project structure across Express, MySQL models, Vite, and React routes in one pass.',
                'Browse, trait detail, Manhattan plotting, and paged GWAS table views were wired into the first end-to-end reading loop.',
                'This is the baseline every later figure, data, and graph workflow built on top of.',
            ],
            note: 'This is the real git-tracked starting point of the current browser history.',
        },
        zh: {
            date: '2026-05-07',
            label: '基础',
            title: '浏览器主骨架首次落地',
            summary: '前后端拆分、Trait 路由、Browse 流程，以及首批 GWAS 表格和绘图组件在这次提交中一起成型，构成了可用基线。',
            highlights: [
                'create 提交一次性搭好了 Express、MySQL 模型、Vite 和 React 路由的项目骨架。',
                'Browse、trait detail、Manhattan 绘图和分页 GWAS 表格被串成第一条可完整走通的浏览路径。',
                '后续图形、数据和网络视图基本都建立在这套基线上扩展。',
            ],
            note: '这是当前浏览器历史在 git 中可追溯的真实起点。',
        },
    },
    {
        icon: Storage,
        color: '#0f766e',
        en: {
            date: 'May 08, 2026',
            label: 'Setup',
            title: 'Environment and metadata import were wired up',
            summary: 'Local and cluster setup examples, database bootstrap helpers, and metadata import scripts were added so the app could be populated and run repeatably.',
            highlights: [
                'The test env commits introduced `.env` examples, setup scripts, and environment definitions for repeatable startup.',
                'The sql metadata work added metadata import and setup helpers so trait context could be loaded instead of mocked.',
                'This was the operational groundwork that turned the scaffold into something teammates could actually boot.',
            ],
            note: 'It was less visible on the surface, but it made the app runnable outside a single dev machine.',
        },
        zh: {
            date: '2026-05-08',
            label: '配置',
            title: '环境配置与元数据导入接通',
            summary: '本地和集群启动示例、数据库初始化辅助脚本，以及 metadata 导入脚本被补齐，让项目可以重复部署和填充数据。',
            highlights: [
                'test env 系列提交加入了 `.env` 示例、setup 脚本和环境定义。',
                'sql metadata 相关工作补上了 metadata 导入与初始化助手，不再依赖手工或占位数据。',
                '这一步更偏运维准备，但它让项目不再只能在单一开发环境中运行。',
            ],
            note: '它在界面上不显眼，但决定了这个应用是否真的能被别人启动起来。',
        },
    },
    {
        icon: Hub,
        color: '#0284c7',
        en: {
            date: 'May 09, 2026',
            label: 'Programs',
            title: 'Program and regulator views arrived',
            summary: 'Program-regulator plots introduced a second lens on the trait signal, adding structure beyond the single-variant view.',
            highlights: [
                'The Program-Regulator-plot pass added a dedicated programs route and a new scatter-style figure family.',
                'Browse and metadata plumbing were widened so trait reading could branch into program-centric exploration.',
                'This was the first release that clearly moved the app beyond a trait-only browser.',
            ],
            note: 'This is where the app first started to feel genuinely multi-view.',
        },
        zh: {
            date: '2026-05-09',
            label: '程序',
            title: 'Program 与 regulator 视图上线',
            summary: 'Program-regulator 图把 trait 信号从单一变异视角扩展到程序和调控层面，应用开始具备多视角浏览能力。',
            highlights: [
                'Program-Regulator-plot 这轮提交新增了独立的 Programs 路由和新的散点图视图。',
                'Browse 和 metadata 的数据链路一起被拓宽，使 trait 浏览可以自然分流到 program 视角。',
                '这是应用第一次明显走出“只看 trait”的单一路径。',
            ],
            note: '从这里开始，这个浏览器才真正有了多视角分析界面的味道。',
        },
    },
    {
        icon: QueryStats,
        color: '#0284c7',
        en: {
            date: 'May 13, 2026',
            label: 'Data',
            title: 'Data access widened and gene work was prepared',
            summary: 'Variant-facing data routes matured while the first gene-oriented components were staged for the next expansion of the browser.',
            highlights: [
                'Several data and download-oriented commits expanded `Rdata` usage and improved how variant outputs were exposed in the UI.',
                'The prepare for gene pass introduced early gene-regulation, program-scatter, and supporting component work before the full gene release.',
                'Variants stopped being just a placeholder route and started becoming a real entry path into result artifacts.',
            ],
            note: 'This was the bridge between the original trait browser and the later gene-program stack.',
        },
        zh: {
            date: '2026-05-13',
            label: '数据',
            title: '数据访问拓宽，并为 gene 视图预热',
            summary: '面向 variant 的数据路由继续成熟，同时首批 gene 相关组件被提前铺设，为后续浏览器扩展做准备。',
            highlights: [
                '多次 data / download 方向的提交扩大了 `Rdata` 的使用范围，也改进了 variant 输出在前端的呈现方式。',
                'prepare for gene 这次提交提前引入了 gene regulation、program scatter 和相关支撑组件。',
                'Variants 不再只是占位页面，而开始变成真正能进入结果文件的入口。',
            ],
            note: '这是最初 trait 浏览器向后续 gene-program 工作流过渡的桥段。',
        },
    },
    {
        icon: QueryStats,
        color: '#64748b',
        en: {
            date: 'May 18, 2026',
            label: 'Stability',
            title: 'The first UI stabilization pass landed',
            summary: 'After the early feature burst, the app got a dedicated bug-fix pass across program scatter, home, trait, and variants surfaces.',
            highlights: [
                'The bug fix commit touched multiple routes instead of treating each page as an isolated patch target.',
                'Program scatter behavior and trait-facing navigation were tightened before more figure-heavy work shipped.',
                'This release was mostly about reducing wobble before the next round of analytical components.',
            ],
            note: 'Small release, but important: it marked the point where fixes started to follow feature delivery closely.',
        },
        zh: {
            date: '2026-05-18',
            label: '稳定',
            title: '首轮界面稳定化修正落地',
            summary: '在前期功能快速堆叠后，program scatter、Home、Trait 和 Variants 页面迎来了一轮集中修复。',
            highlights: [
                '这次 bug fix 提交同时覆盖了多个路由，而不是把每个页面当成彼此孤立的小补丁。',
                'program scatter 的行为和 trait 相关导航在更多图形功能上线前先被收紧了一轮。',
                '这一阶段的重点不是再加功能，而是先把已有界面的晃动感降下来。',
            ],
            note: '这是个小时间点，但很关键，它说明修复开始紧跟在功能发布之后发生。',
        },
    },
    {
        icon: FileDownload,
        color: '#b45309',
        en: {
            date: 'May 19, 2026',
            label: 'Results',
            title: 'Result data surfaces became easier to reach',
            summary: 'The browser’s data-facing routes and home/variant entry paths were refined so users could get to output artifacts with less friction.',
            highlights: [
                'The data commit deepened result-file access through backend routes instead of leaving it as route-level scaffolding.',
                'Home and Variants were adjusted together so search-style and route-style access started to converge.',
                'This release set up the week where plots, tables, and raw outputs began to move in lockstep.',
            ],
            note: 'Think of this as the quiet routing release right before the larger figure wave.',
        },
        zh: {
            date: '2026-05-19',
            label: '结果',
            title: '结果数据入口更容易触达',
            summary: '面向结果文件的数据路由，以及 Home / Variants 的入口路径被重新理顺，用户更容易从页面进入实际输出物。',
            highlights: [
                '这次 data 提交把结果文件访问更深入地放进了后端路由，而不再只是页面层的临时拼接。',
                'Home 和 Variants 一起调整后，搜索式入口和路由式入口开始收敛到同一套路径逻辑。',
                '这一轮为后面“图、表、原始输出一起推进”的那周工作先打好了路。',
            ],
            note: '可以把它看作大批图形功能到来之前，一次相对安静但必要的路由整理。',
        },
    },
    {
        icon: QueryStats,
        color: '#ea580c',
        en: {
            date: 'May 20, 2026',
            label: 'Figures',
            title: 'Manhattan and volcano views matured',
            summary: 'The figure layer expanded fast: GWAS Manhattan, burden volcano, and related cleanup made the featured trait page feel analysis-ready.',
            highlights: [
                'The gwas manhattan work brought a locus-level signal view directly into the trait workflow.',
                'The volcano pass added a complementary burden-style effect plot so users could read strength and direction together.',
                'Follow-up fixes stabilized route wiring, table companions, and figure-side data loading around the new views.',
            ],
            note: 'Several small fix commits around this date are folded into one readable release moment.',
        },
        zh: {
            date: '2026-05-20',
            label: '图形',
            title: 'Manhattan 与 volcano 视图走向成熟',
            summary: 'GWAS Manhattan、burden volcano 及相关清理集中到 Trait 页面后，分析界面开始接近可直接使用的状态。',
            highlights: [
                'gwas manhattan 这轮工作把位点级信号视图直接带进了 trait 工作流。',
                'volcano 视图补上了与之互补的 burden 效应展示，让用户能同时看强度和方向。',
                '后续的小修复把路由连接、表格搭配和图形取数稳定在了同一套路径上。',
            ],
            note: '这一天附近有几次小修复，这里把它们合并成一个更像版本说明的节点。',
        },
    },
    {
        icon: Storage,
        color: '#0f766e',
        en: {
            date: 'May 21, 2026',
            label: 'Staging',
            title: 'File-store staging started to solidify',
            summary: 'Backend file-store, TSV handling, and multi-route data plumbing were reorganized so rendered and downloaded outputs could be served more consistently.',
            highlights: [
                'The stage commit introduced a more deliberate backend path for file-backed data instead of route-by-route improvisation.',
                'Trait, program, regulation, and data routes were all touched in the same pass, which helped unify how outputs were discovered.',
                'This change made the later render and download releases much easier to land cleanly.',
            ],
            note: 'Mostly backend plumbing, but it mattered directly to how dependable the browser could become.',
        },
        zh: {
            date: '2026-05-21',
            label: '暂存',
            title: '文件存储与中间层开始稳定',
            summary: '后端 file-store、TSV 处理和多路由数据管线被重新整理，让渲染输出和下载输出可以更一致地被服务出来。',
            highlights: [
                'stage 提交为文件型数据建立了更明确的后端路径，不再完全依赖各个路由临时拼装。',
                'Trait、program、regulation 和 data 路由在同一轮一起被调整，因此输出物的发现方式更统一了。',
                '后续 render 和 download 这两次版本能更顺利落地，基本都受益于这里的整理。',
            ],
            note: '它大部分是后端基础设施工作，但会直接影响浏览器最终是否稳定可靠。',
        },
    },
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'May 22, 2026',
            label: 'Transport',
            title: 'Backend request and config movement settled',
            summary: 'Configuration, request helpers, model wiring, and frontend API consumers were reorganized in a broader move that made the app less brittle internally.',
            highlights: [
                'The move success commit touched config, HTTP/request utilities, models, and frontend trait consumers in one structural sweep.',
                'This was the point where backend data access stopped being only controller glue and started looking like a maintained service layer.',
                'Trait-side figure consumers were updated alongside the backend move so the refactor stayed connected to actual user flows.',
            ],
            note: 'It reads like a plumbing release, but it materially improved how much future work could be layered on safely.',
        },
        zh: {
            date: '2026-05-22',
            label: '传输',
            title: '后端请求层与配置迁移稳定下来',
            summary: '配置、请求辅助函数、模型连接方式，以及前端 API 消费端一起经历了一次更系统的迁移，应用内部结构明显更稳。',
            highlights: [
                'move success 提交同时动到了 config、HTTP/request 工具、models 和 trait 侧前端消费者。',
                '从这里开始，后端数据访问不再只是控制器里的胶水代码，而更像一层正在成型的服务层。',
                'Trait 页面上的图形取数端也同步更新，说明这次重构是围绕真实用户路径做的，而不是空转。',
            ],
            note: '它看起来像一轮“管线整理”，但确实提高了后续功能继续叠加时的安全边界。',
        },
    },
    {
        icon: Storage,
        color: '#2563eb',
        en: {
            date: 'May 23, 2026',
            label: 'Render',
            title: 'Rendered outputs and environment wiring aligned',
            summary: 'The app’s render pipeline, file-store handling, and environment examples were brought into a more deployable shape across local and cluster usage.',
            highlights: [
                'The all render pass aligned request handling, render outputs, and file-store conventions across backend routes.',
                'Environment examples for frontend, backend, and cluster setup were refreshed so rendered assets could resolve more consistently.',
                'Trait-side figures were prepared to consume those outputs without each route inventing its own path logic.',
            ],
            note: 'This is the release where rendering stopped feeling experimental and started looking operational.',
        },
        zh: {
            date: '2026-05-23',
            label: '渲染',
            title: '渲染输出与环境接线开始对齐',
            summary: '应用的渲染管线、file-store 处理方式，以及本地和集群环境示例被整理到更接近可部署的状态。',
            highlights: [
                'all render 这轮工作对齐了后端多个路由中的请求处理、render 输出和文件存储约定。',
                '前端、后端和集群启动示例一起更新，使渲染资源的路径解析更一致。',
                'Trait 页图形也提前适配了这套输出，而不是让每个页面各写一套路径逻辑。',
            ],
            note: '这是渲染能力从“实验状态”开始转向“可运作状态”的时间点。',
        },
    },
    {
        icon: FileDownload,
        color: '#b45309',
        en: {
            date: 'May 24, 2026',
            label: 'Download',
            title: 'Export and raw-file access became first-class',
            summary: 'Download helpers were promoted into the main browsing flow so users could move from figures and tables back to exported result files with less friction.',
            highlights: [
                'The download commit added explicit helper paths for variant files and other result exports.',
                'Trait, program, and variant-facing routes were cleaned up together so download behavior stayed consistent across views.',
                'Two quick bug-fix passes immediately after rollout hardened the new export path instead of leaving it half-integrated.',
            ],
            note: 'This release is mostly about trust: when a user clicks for a file, the app should have a clear answer.',
        },
        zh: {
            date: '2026-05-24',
            label: '下载',
            title: '导出与原始文件访问升为一等能力',
            summary: '下载辅助路径被正式推进到主浏览流程中，用户可以更自然地从图形和表格回到具体导出文件。',
            highlights: [
                'download 提交为 variant 文件和其他结果导出加入了更明确的辅助路径。',
                'Trait、program 和 variant 相关页面一起清理后，下载行为在不同视图之间更一致了。',
                '上线后紧接着的两次 bug fix 把这条导出路径补强，而不是让它停留在半接通状态。',
            ],
            note: '这轮版本的核心其实是“可信度”：用户点击文件时，应用应该能给出稳定明确的响应。',
        },
    },
    {
        icon: Hub,
        color: '#7c3aed',
        en: {
            date: 'May 26, 2026',
            label: 'Graph',
            title: 'Trait-program graph refinement began',
            summary: 'Before the larger gene drop, the trait-program graph got its first focused refinement pass so it could carry more of the navigation load.',
            highlights: [
                'The first trait-program-modified commit concentrated specifically on graph behavior instead of bundling it into a larger release.',
                'This separated graph refinement from the gene rollout and made the component feel actively iterated rather than merely introduced.',
                'It set up the stronger gene-linked graph release that followed one day later.',
            ],
            note: 'A small but useful timestamp because it shows the graph matured incrementally, not all at once.',
        },
        zh: {
            date: '2026-05-26',
            label: '网络',
            title: 'Trait-program 图开始专项打磨',
            summary: '在更大的 gene 功能集到来前，trait-program 图先经历了一次独立的聚焦修整，使它能承担更多导航职责。',
            highlights: [
                '第一条 trait-program-modified 提交专门聚焦图本身的行为，而没有被打包进更大的版本里。',
                '这让图组件的演进从 gene 发布中被拆开，显得更像持续迭代，而不是一次性附带上线。',
                '它也为第二天更完整的 gene 相关图谱版本提前铺好了路。',
            ],
            note: '这是个小节点，但很有价值，因为它说明图不是一次长成的，而是被逐步打磨出来的。',
        },
    },
    {
        icon: Biotech,
        color: '#7c3aed',
        en: {
            date: 'May 27, 2026',
            label: 'Genes',
            title: 'Gene evidence and trait-program links deepened',
            summary: 'Gene-level evidence views landed alongside a stronger trait-program graph, connecting variant signals back to interpretable biology.',
            highlights: [
                'The gene pass expanded the app with gene regulation, program scatter, data-browse summary, and broader route support.',
                'Two trait-program-modified commits refined the graph after the first rollout instead of treating it as a static add-on.',
                'Navigation now linked genes, programs, variants, and traits into one more coherent biological story.',
            ],
            note: 'This release bundles the gene, graph, and trait-program work into one story.',
        },
        zh: {
            date: '2026-05-27',
            label: '基因',
            title: 'Gene 证据与 trait-program 链接继续加深',
            summary: 'Gene 级证据视图和更强的 trait-program 图一起落地，把 variant 信号更自然地连回可解释的生物学层面。',
            highlights: [
                'gene 这轮版本扩展出了 gene regulation、program scatter、data-browse summary 以及更完整的路由支撑。',
                'trait-program 图在首次发布后又经历了两次继续打磨，而不是被当成一个静态附属组件放着不动。',
                '基因、程序、变异和 trait 之间的导航关系开始形成更连贯的一条生物学解释链。',
            ],
            note: '这一版把 gene、graph 和 trait-program 相关工作第一次真正串成了一个完整故事。',
        },
    },
    {
        icon: QueryStats,
        color: '#c2410c',
        en: {
            date: 'May 29, 2026',
            label: 'Compare',
            title: 'Cross-trait heatmaps opened comparative reading',
            summary: 'Heatmap views made it easier to scan how gene effects repeat or diverge across related traits without leaving the main exploration flow.',
            highlights: [
                'The cross_trait_heatmap release added a dedicated comparative matrix instead of forcing one-trait-at-a-time inspection.',
                'Backend cross-trait routes and frontend figure helpers were expanded together so the heatmap fit inside the existing trait workflow.',
                'Related legend, help, and figure components were adjusted to support this comparison-first reading mode.',
            ],
            note: 'It is the first release in the log built explicitly around comparison instead of inspection.',
        },
        zh: {
            date: '2026-05-29',
            label: '比较',
            title: 'Cross-trait heatmap 开启比较式阅读',
            summary: 'Heatmap 视图让用户可以在不离开主浏览流程的情况下，更快查看 gene 效应在相关 traits 之间的重复与分化。',
            highlights: [
                'cross_trait_heatmap 版本加入了专门的比较矩阵，而不再强迫用户一次只看一个 trait。',
                '后端 cross-trait 路由和前端图形辅助一起扩展，因此热图能够自然嵌进原有 trait 工作流。',
                '相关 legend、help 和图形组件也同步调整，去支撑这种“先比较、再细看”的阅读方式。',
            ],
            note: '这是版本记录里第一次明确围绕“比较”而不是“单点查看”来组织的一次发布。',
        },
    },
    {
        icon: QueryStats,
        color: '#0f766e',
        en: {
            date: 'May 31, 2026',
            label: 'Tables',
            title: 'Table companions and summaries were tightened',
            summary: 'Table views across heatmaps, QQ/scatter panels, regulation views, and graph summaries were cleaned up so analytical pages read more consistently.',
            highlights: [
                'The table fix commit touched a broad set of companion tables instead of only one figure family.',
                'Summary components and theme helpers were adjusted together so tabular views felt like part of the same system.',
                'This pass improved the readability of the growing analysis surface without introducing another new figure type.',
            ],
            note: 'It was a quality-of-reading release: less new capability, more consistent interpretation scaffolding.',
        },
        zh: {
            date: '2026-05-31',
            label: '表格',
            title: '配套表格与摘要视图被统一收紧',
            summary: '热图、QQ/scatter、regulation 和 graph summary 附近的表格视图被集中清理，让分析页面读起来更一致。',
            highlights: [
                'table fix 这次提交覆盖的是一大批配套表格，而不是只改某一类图的伴随表。',
                'summary 组件和主题辅助函数一起调整后，表格终于更像同一个系统的一部分。',
                '这轮工作提升的是增长中分析界面的可读性，而不是再引入新的图形类型。',
            ],
            note: '它更像一次“阅读质量”版本：新能力较少，但解释支架更统一了。',
        },
    },
    {
        icon: Search,
        color: '#ff6b4a',
        en: {
            date: 'Jun 01, 2026',
            label: 'Home',
            title: 'Landing-page structure was split into clearer modules',
            summary: 'The home page stopped behaving like one long stack and was reorganized into clearer search, figure, and overview sections.',
            highlights: [
                'The home modified and split commits reorganized the landing page into smaller, easier-to-scan blocks.',
                'Search entry points were separated from the figure gateway so the page could support both direct lookup and visual exploration.',
                'This structural pass made later illustration, copy, and release-log improvements easier to slot in.',
            ],
            note: 'This is the architectural cleanup behind the newer home-page presentation.',
        },
        zh: {
            date: '2026-06-01',
            label: '主页',
            title: '首页结构被拆成更清晰的模块',
            summary: 'Home 页面不再像一整条长堆栈，而被重组为更明确的搜索区、图形入口区和概览区。',
            highlights: [
                'home modified 和 split 这几次提交把首页重新拆成更小、更容易扫读的模块。',
                '搜索入口和图形入口被主动分开，使页面可以同时支持直接查找和视觉探索两种用法。',
                '后面插入插画、文案和 release log 改进时，这层结构整理都起了支撑作用。',
            ],
            note: '这是新版首页展示方式背后的结构性清理节点。',
        },
    },
    {
        icon: Search,
        color: '#f97316',
        en: {
            date: 'Jun 02, 2026',
            label: 'Polish',
            title: 'Home artwork and supporting copy were tightened',
            summary: 'Featured figure thumbnails, SVG assets, and supporting browse metadata were polished so the refreshed landing page felt intentional rather than provisional.',
            highlights: [
                'The home svg and svg fix commits improved the quality and consistency of the featured home illustrations.',
                'Additional home modified work tightened copy, spacing, and metadata support across both frontend and backend surfaces.',
                'Trait and browse pages were adjusted alongside the landing page so the refreshed visual language did not stop at the first screen.',
            ],
            note: 'This is the point where the home refresh became a designed surface instead of just a rearranged one.',
        },
        zh: {
            date: '2026-06-02',
            label: '润色',
            title: '首页插图与配套文案继续收紧',
            summary: 'Featured figure 缩略图、SVG 资源和配套 browse metadata 被进一步打磨，让刷新后的首页更像完整设计，而不是临时拼接。',
            highlights: [
                'home svg 和 svg fix 这几次提交提升了首页重点插图的质量和一致性。',
                '后续 home modified 工作又继续收紧了前后端两侧的文案、间距和 metadata 支撑。',
                'Trait 和 Browse 页面也跟着一起调整，因此新的视觉语言没有只停留在第一页。',
            ],
            note: '这是首页刷新从“只是重新摆放”过渡到“有设计完成度”的那个时间点。',
        },
    },
    {
        icon: Hub,
        color: '#ff6b4a',
        en: {
            date: 'Jun 03, 2026',
            label: 'Graph',
            title: 'Search and trait-program-gene navigation were refined',
            summary: 'The latest pass tightened search behavior and graph interaction so users can move from the landing page into trait, program, and gene context with less friction.',
            highlights: [
                'The search fix commit cleaned up home and trait entry paths around figures, tables, and featured destinations.',
                'The Trait-Program-Gene graph modified pass refined graph behavior across the trait-side visualization stack.',
                'The release log itself was expanded in the same cycle so recent work reads more like a real build history than a sparse milestone list.',
            ],
            note: 'This is the current polish release: less about new categories, more about making the connected experience read cleanly.',
        },
        zh: {
            date: '2026-06-03',
            label: '图谱',
            title: '搜索与 trait-program-gene 导航继续打磨',
            summary: '最新一轮工作收紧了搜索行为和图交互逻辑，让用户从首页走到 trait、program 和 gene 语境时更顺滑。',
            highlights: [
                'search fix 提交清理了首页和 Trait 页围绕图形、表格和推荐入口的进入路径。',
                'Trait-Program-Gene graph modified 则继续细化了 trait 侧整套图谱的交互行为。',
                'release log 本身也在同一轮里被补全，使近期工作读起来更像真实 build history，而不是稀疏节点列表。',
            ],
            note: '这是当前阶段的润色型版本：新增类别不多，但整条联动体验更顺了。',
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
