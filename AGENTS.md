# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概览

GWAS (全基因组关联分析) 数据浏览与可视化 Web 应用。前后端分离架构。

## 环境配置

### 本地开发 (Windows)

MySQL 运行在 Linux 集群上，通过 SSH 隧道连接：

```powershell
# PowerShell 中运行（保持窗口打开）
ssh -N -L 33306:127.0.0.1:33306 qinminzhang@101.76.96.10
```

```bash
# 后端配置
cp backend/.env.example backend/.env
# 编辑 backend/.env：DB_HOST=localhost, DB_PORT=33306

# 前端配置 — 使用 Vite 代理，无需额外配置
```

### Linux 集群部署

```bash
# 首次配置
bash scripts/setup_cluster.sh

# 后续启动（两个终端）
cd backend  && conda activate gwas-browser && npm run dev   # 后端 :4000
cd frontend && conda activate gwas-browser && npm run dev   # 前端 :5173

# 本地浏览器访问（通过 SSH 隧道）
ssh -N -L 5173:localhost:5173 -L 4000:localhost:4000 qinminzhang@101.76.96.10
# 浏览器打开 http://localhost:5173
```

### 数据库 Schema 迁移

```bash
cd backend
node scripts/migrate.js   # 创建新表（需 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD 环境变量）
```

## 常用命令

### 后端 (`backend/`)

```bash
cd backend
npm run dev        # 启动后端 (nodemon, 热重载, 端口 4000)
npm start          # 启动后端 (node, 端口 4000)
```

### 前端 (`frontend/`)

```bash
cd frontend
npm run dev        # 启动开发服务器 (Vite, 端口 5173, 内置代理 /api → localhost:4000)
npm run build      # 生产构建
npm run lint       # ESLint 检查
npm run preview    # 预览生产构建
```

## 架构

```
frontend (React 19 + Vite 7, port 5173)
  └─ /api proxy → backend (Express 5 + MySQL2, port 4000) → MySQL (数据库: gwas)
```

### 后端分层

- **`app.js`** — 应用入口，注册 CORS、JSON 中间件，挂载路由，监听 4000 端口
- **`routes/Rbrowse.js`** — `/api/browse` 路由，Trait 浏览接口
- **`routes/Rtrait.js`** — `/api/trait/*` 三个路由，GWAS 数据查询与筛选
- **`models/MgetTrait.js`** — Trait 元数据查询 (gwas_metadata 表)
- **`models/MgetGwasByTrait.js`** — GWAS SNP 数据查询与筛选 (gwas_data 表)
- **`models/utils.js`** — 共享工具函数 (`buildOrderBy`, `buildWhereForGwas`)
- **`models/db.js`** — MySQL 连接池，支持环境变量: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_POOL_SIZE`
- **`scripts/init_schema.sql`** — 新版数据库 Schema（15 张表）
- **`scripts/migrate.js`** — 数据库迁移脚本

API 端点：
- `GET /api/browse` — 分页获取所有 Trait 元数据
- `GET /api/trait/:traitName` — 分页获取 Trait 的 GWAS 数据
- `GET /api/trait/allgwas/:traitName` — 获取 Trait 全部 GWAS 数据（不分页）
- `GET /api/trait/filtergwas/:traitName` — 筛选 GWAS 数据 (CHR, BP 区间, P 值范围, rsID)

### 前端分层

- **`src/main.jsx`** — React 入口
- **`src/App.jsx`** — 根组件，BrowserRouter + 响应式导航 (大屏 NavLink，小屏 HamburgerMenu)
- **`src/api/gwas.js`** — API 层，封装 `fetcher`、`getTraitData`、`getFilteredGwasDataByTrait`
- **`src/routes/*.jsx`** — 页面级路由组件
- **`src/components/*.jsx`** — 可复用组件

关键组件：

| 组件 | 用途 |
|------|------|
| `GwasDataList` | 通用 GWAS 数据表格，服务端分页/排序/SWR 取数 |
| `ManhattanPlot` | 曼哈顿图核心组件 (Plotly.js scattergl) |
| `TraitManhattan` | Trait 详情页，组合 ManhattanPlot + 筛选面板 + 统计信息 |
| `HamburgerMenu` | 移动端可拖拽汉堡菜单导航 |
| `SearchGwasData` | 搜索输入组件 |

路由：`/` Home, `/trait` & `/trait/:traitName` Trait, `/genes` Genes, `/variants` Variants, `/browse` Browse, `/contact` Contact, `/about` About

技术栈：React 19, Vite 7, MUI 7, react-router-dom v7, SWR, Plotly.js (basic-dist), axios + qs

## 数据库

数据库 `gwas` 含 4 张表：

| 表名 | 用途 | 记录数 |
|------|------|--------|
| `gwas_metadata` | Trait 元信息 (Trait, mesh_term, sample_size, author, pmid, year, n_blocks, n_variants 等 17 列) | — |
| `gwas_data` | GWAS SNP 级数据 (Trait, CHR, BP, rsID, P, BETA, SE, MAF 等 14 列) | — |
| `huge_gwas_data` | 与 gwas_data 结构相同，大型数据集 | — |
| `moment_ukbb` | UK Biobank 数据 (summary, UDI, ratio, ICD10 等 17 列) | — |

当前代码使用 `gwas_metadata` 和 `gwas_data`。`huge_gwas_data` 和 `moment_ukbb` 尚未在代码中引用。
