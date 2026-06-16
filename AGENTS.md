# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## 项目概览

GWAS 数据浏览与可视化 Web 应用，前后端分离架构。当前代码已经迁移到以 `file_metadata`、`gwas_meta`、文件系统 TSV、Program/Gene/Trait 关联表为核心的数据模型；旧 SQL GWAS 分页接口不再是当前运行路径。

## 环境配置

### 本地开发 Windows

MySQL 运行在 Linux 集群上，通过 SSH 隧道连接：

```powershell
ssh -N -L 33306:127.0.0.1:33306 qinminzhang@101.76.96.10
```

```bash
cp backend/.env.example backend/.env
# 编辑 backend/.env：DB_HOST=localhost, DB_PORT=33306
```

前端使用 Vite 代理 `/api -> localhost:4000`，通常无需额外配置。

### Linux 集群部署

```bash
bash scripts/setup_cluster.sh

conda activate Web-LoF

cd backend
npm install
npm run dev

cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173

ssh -N -L 5173:127.0.0.1:5173 -L 4000:127.0.0.1:4000 qinminzhang@101.76.96.10
# 浏览器打开 http://localhost:5173
```

当前服务器实际使用 `Web-LoF` conda 环境。代码或依赖更新后，先在对应的 `backend/` 或 `frontend/` 目录执行 `npm install`，避免服务器仍使用旧依赖。

当前集群上运行的是开发/调试模式：前端为 Vite dev server，后端为 `npm run dev`/nodemon，二者监听服务器本机 `127.0.0.1`，本地通过 SSH 隧道访问。这不是 production 部署；生产部署应改用进程管理器（如 systemd/pm2）和前端静态构建产物。

分析 bug 时，如需查看运行日志，可读取以下集群日志文件：

- 后端：`/gpfs/chencao/qinminzhang/workflow/Web-LoF/.runtime/logs/backend.log`
- 前端：`/gpfs/chencao/qinminzhang/workflow/Web-LoF/.runtime/logs/frontend.log`

注意日志以尾部为最新内容。排查问题时优先查看尾部最新若干行，而不是从文件开头读取；推荐使用只读命令，例如 `tail -n 200`、`tail -n 500`、`tail -f`（仅在确有必要时）或等价方式。

### 数据库迁移

```bash
cd backend
node scripts/migrate.js
```

## 常用命令

### 后端 `backend/`

```bash
npm run dev
npm start
```

### 前端 `frontend/`

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## 架构

```text
frontend (React 19 + Vite 7, port 5173)
  -> /api proxy
backend (Express 5 + MySQL2, port 4000)
  -> MySQL gwas + TSV file stores
```

### 后端分层

- `app.js`：应用入口，注册 CORS、JSON 中间件，挂载路由，监听 4000。
- `routes/Rbrowse.js`：`/api/browse` Trait 浏览、`/api/meta/:fileId` Trait 元信息、`/api/home/stats` 首页统计。
- `routes/Rtrait.js`：`/api/trait/manhattan/:traitName` Manhattan TSV 数据接口。
- `routes/Rprogram.js`：Program scatter/graph、Burden Volcano、Posterior Volcano 相关接口。
- `routes/Rgene.js`：Gene 列表、搜索、推荐和 Gene-Program 明细接口。
- `routes/Rdata.js`：文件浏览、全局搜索、单文件/批量下载接口。
- `routes/RcrossTrait.js`：Cross-trait 搜索、状态、推荐 target、heatmap matrix 接口。
- `routes/Rregulation.js`：Regulation 数据接口。
- `models/Mmeta.js`：Trait 元数据查询，主要使用 `file_metadata` 和 `gwas_meta`。
- `models/MgeneProgram.js`：Gene/Program/Trait 关联查询。
- `models/db.js`：MySQL 连接池，支持 `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`DB_POOL_SIZE`。
- `lib/tsv.js`：TSV 流解析工具。
- `lib/config.js`：服务、路径、分页、文件大小等配置。

### 当前主要 API

- `GET /api/browse`：分页获取 Trait 元数据。
- `GET /api/meta/:fileId`：获取 Trait 元信息，可包含 `trait_ldsc`。
- `GET /api/home/stats`：首页统计，可能扫描文件系统并使用内存缓存。
- `GET /api/trait/manhattan/:traitName`：读取 Manhattan TSV。请求失败应向前端暴露为 error，不应伪装为空数据。接口会检查 `MANHATTAN_MAX_FILE_BYTES`；full 模式支持服务端过滤和采样返回，响应包含 `sourceRowCount`、`filteredRowCount`、`returnedRowCount` 等计数，超过大小返回 413。
- `GET /api/burden-volcano/:fileId`、`GET /api/posterior-volcano/:fileId`：Volcano TSV 数据。前端应显式渲染错误和重试入口。
- `GET /api/data/search`：Data Browser 全局搜索。后端默认强制分页，前端应传 `page` 和 `limit`，不要一次性拉取所有匹配结果。
- `GET /api/cross-trait/:fileId/matrix`：Cross-trait heatmap matrix。`topGenes` 默认 80，最大 100；target 文件按 LOF `file_id` 命名。

旧 Trait SQL GWAS 接口当前不存在，不要按旧接口开发新功能。

### 前端分层

- `src/main.jsx`：React 入口。
- `src/App.jsx`：根组件、BrowserRouter、响应式导航。
- `src/api/gwas.js`：API 层，封装 axios 请求。Manhattan/Volcano 请求失败应抛出给组件处理。
- `src/routes/*.jsx`：页面级路由组件。
- `src/components/*.jsx`：可复用图表、表格和控制组件。

关键组件：

| 组件 | 用途 |
| --- | --- |
| `GwasDataList` | Trait browse 表格，服务端分页/排序/SWR 取数 |
| `TraitHitManhattan` | Trait Manhattan 图和联动表格 |
| `BurdenVolcano` | Burden/Posterior volcano 共用图表组件 |
| `CrossTraitHeatmap` | Cross-trait heatmap，默认 80 个 gene rows |
| `Variants` | Data Browser 页面，实际路由是 `/data` |
| `Genes` | Gene index、Gene detail 和相关导出 |
| `ProgramScatter` / `TraitProgramGraph` | Program/Trait 关联可视化 |

路由：`/` Home, `/trait`, `/trait/:traitName`, `/genes`, `/programs`, `/programs/:programId`, `/data`, `/help`, `/contact`, `/about`。

`/variants` 和 `/browse` 当前不是已注册路由。如需兼容旧链接，应显式添加 alias。

## 数据库与文件数据

当前主要数据库表：

| 表名 | 用途 |
| --- | --- |
| `file_metadata` | Trait 文件 ID、GWAS ID、trait name 主索引 |
| `gwas_meta` | GWAS 元信息 |
| `lof_meta` | LOF 元信息 |
| `trait_ldsc` | Trait heritability/meta 扩展 |
| `program_info` | Program 元信息 |
| `trait_program_edge` | Trait-Program 关联 |
| `gene_program_trait_edge` | Gene-Program-Trait 关联 |
| `gene_info_hg37_matched` | Gene 注释 |
| `file_id_mapping` | file_id / gwas_id / lof_id 映射 |

当前图表大量依赖文件系统 TSV：

- Manhattan：`GWAS_MANHATTAN_DATA_DIR`
- Program/Burden/Posterior/Gene-level 图表：相关 TSV 文件 store
- Cross-trait heatmap：`CROSS_TRAIT_HEATMAP_DIR`
- Data Browser：`DATA_ROOT`

不要假设旧 SQL GWAS 大表在当前运行库中存在。

## 实现注意事项

- 文件型图表接口要明确区分“真实无数据”和“请求失败”。前端组件应显示错误状态和重试按钮。
- 大 TSV 路径优先做文件大小检查；默认返回 hits/summary，full 模式应使用服务端过滤、采样或分页，避免整文件解析后完整 JSON 返回。
- Data Browser 全局搜索必须服务端分页；不要把全部匹配结果一次性发给前端再本地分页。
- Cross-trait target 文件当前按 LOF `file_id` 命名；不要在没有数据确认的情况下改成只按 `gwas_id` 查找。
- `topGenes` 默认 80，最大 100。如果实际返回少于请求数，优先检查源 TSV 中是否有足够的 `gene/ensg` 且 `post_mean` 可解析的行。
- 工作区可能已有用户修改。不要回滚或覆盖无关改动。
