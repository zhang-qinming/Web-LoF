# GWAS Browser 前后端与 SQL 性能报告

日期：2026-06-06  
范围：`frontend/`、`backend/`、运行库 `gwas` 的只读结构与代表查询计划。  
方法：静态代码审计、`information_schema` 元数据检查、代表 SQL `EXPLAIN`、少量只读聚合计时。本文已按 2026-06-06 当前代码和运行库复查更新。

## 结论摘要

当前最大的性能风险不是单个慢索引，而是文件型图表响应、Gene 汇总缓存和部分 SQL join 仍有扩展性上限：

1. 旧 GWAS SQL 接口已经从当前代码路径删除；当前运行路径使用 `file_metadata`、`gwas_meta` 和文件系统 TSV。不要恢复旧的全量 GWAS SQL JSON 接口。
2. Gene 首页依赖 `gene_program_trait_edge` 全表聚合后放进 Node 进程内缓存。当前精确行数 297,549；优化器估算扫描 281,492 行，汇总聚合实测约 2.86 秒。数据增长或多进程部署后会放大。
3. Gene 搜索已经做过一轮优化：后端先 exact lookup，再 prefix search；前端也有 280 ms debounce。`EN` / `ENS` / `ENSG` 已跳过 prefix fallback；普通 symbol 允许 1 字符 prefix，需继续观察 `M` 这类高命中前缀的 p95。
4. 多个 join key 的 collation 不一致，代码用 `BINARY` / `COLLATE` 规避报错。功能上可运行，但查询计划退化为 hash scan，阻断正常等值索引 join。
5. 图表接口大量依赖 TSV 整文件读取和前端全量过滤/排序/渲染；这不是 SQL 慢查询，但会和后端响应体大小、Node 内存、浏览器主线程一起形成性能上限。

建议优先级：先修 schema/接口一致性和 collation；再把 Gene 汇总改为物化表，并给短前缀搜索加保护；最后收敛 TSV 全量响应和冗余索引。

## 运行库现状

当前运行库表规模：

| 表 | 近似/实测行数 | 数据大小 | 索引大小 | 备注 |
|---|---:|---:|---:|---|
| `gene_program_trait_edge` | 297,549 | 89.64 MB | 142.52 MB | 最大表，Gene 首页/详情/Program 详情核心来源；`EXPLAIN` 估算约 281,492 行 |
| `gwas_meta` | 28,627 | 10.52 MB | 5.86 MB | 仅 2,415 个非空 `file_id`，26,212 行为空或缺失 `file_id` |
| `trait_program_edge` | 18,664 | 3.52 MB | 6.05 MB | Program/Trait 关联 |
| `gene_info_hg37_matched` | 7,161 | 3.52 MB | 1.17 MB | Gene 注释 |
| `file_metadata` | 2,415 traits | 0.33 MB | 0.42 MB | Trait 列表主表 |
| `trait_ldsc` | 2,344 | - | - | Trait meta heritability |

旧 SQL GWAS 大表不属于当前运行路径。

collation 不一致：

| 表组 | collation |
|---|---|
| `file_metadata`、`gwas_meta`、`program_info`、`lof_meta`、`file_id_mapping` | `utf8mb4_0900_ai_ci` |
| `gene_program_trait_edge`、`trait_program_edge`、`gene_info_hg37_matched`、`trait_ldsc` | `utf8mb4_unicode_ci` |

这解释了为什么代码里出现 `BINARY tpe.trait_id = BINARY gpte.trait_id` 和 `COLLATE utf8mb4_unicode_ci`：普通等值 join 会报 collation mismatch。

## 主要问题

### P0. 旧 GWAS SQL 接口已删除，避免回归

相关代码：

- 当前已无 `backend/models/MgetGwasByTrait.js`。
- `backend/routes/Rtrait.js` 当前只保留 `/api/trait/manhattan/:traitName`。
- `frontend/src/api/gwas.js` 当前已无旧 SQL GWAS 数据 API helper。
- `frontend/src/components/GwasDataList.jsx` 当前只调用 `/api/browse`。

问题：

- 当前问题已经止血：前后端没有继续暴露旧 SQL GWAS 路由。
- 风险转为回归风险：将来如果恢复 SNP SQL 表，不应恢复旧式全量 JSON 和深页 `OFFSET`。

建议：

- 保持当前 TSV/Manhattan 文件路线，不再恢复旧 SQL GWAS API。
- 如果未来必须恢复 SNP SQL 查询，必须新设计分页契约：投影列查询、强制 limit、优先 keyset/cursor，不要在深页长期使用 `OFFSET`。

### P1. Gene 首页全表聚合依赖进程内缓存

相关代码：

- `backend/models/MgeneProgram.js`
  - `getGeneSummaryCache()` 全表 `GROUP BY gpte.gene_symbol, gpte.ensg_id`
  - `getGenes()` 从缓存数组排序和分页
  - `warmGeneSummaryCache()` 在 `app.listen` 后预热
- `frontend/src/routes/Genes.jsx`
  - `GeneHomeTable` 用 `getGenes({ page, limit, sortBy, order })`
  - CSV 下载调用 `getGenes({ limit: 0 })`

证据：

- `EXPLAIN` 估算 `gene_program_trait_edge` 扫描 281,492 行；精确表行数是 297,549。查询会排序后聚合，再按 `gene_info_hg37_matched` 主键逐行 lookup。
- 实测聚合计时：`SELECT COUNT(*) FROM (gene summary GROUP BY ...)` 返回 7,161 个 gene group，用时约 2.86 秒。
- 缓存 TTL 为 1 小时，且是 Node 进程内变量；多实例部署时每个进程都会独立预热。

风险：

- 服务启动后预热会吃掉一次完整聚合成本。
- 缓存过期时第一个请求会阻塞等待聚合。
- 排序/分页在 JS 内存中完成，无法利用数据库排序索引。
- `limit=0` 导出虽然复用缓存，但会把所有 gene 一次性组装为响应。

建议：

- 在导入脚本结束后生成物化表，例如 `gene_summary`：

```sql
CREATE TABLE gene_summary (
  gene_key VARCHAR(140) NOT NULL PRIMARY KEY,
  gene_symbol VARCHAR(100),
  ensg_id VARCHAR(30),
  chromosome VARCHAR(50),
  begin_pos BIGINT,
  end_pos BIGINT,
  gene_type VARCHAR(100),
  total_rows BIGINT NOT NULL,
  total_programs INT NOT NULL,
  total_traits INT NOT NULL,
  program_role_rows BIGINT NOT NULL,
  regulator_role_rows BIGINT NOT NULL,
  KEY idx_gene_summary_symbol (gene_symbol),
  KEY idx_gene_summary_ensg (ensg_id),
  KEY idx_gene_summary_traits (total_traits DESC, total_programs DESC, total_rows DESC),
  KEY idx_gene_summary_programs (total_programs DESC, total_traits DESC)
);
```

- `/api/genes` 改为直接查物化表并在 SQL 里排序分页。
- CSV 导出改为流式响应或后台生成文件，避免一次性 JSON + 前端拼 CSV。

### P1. Gene 搜索已缓解，高频 Ensembl 前缀已加保护

相关代码：

- `backend/models/MgeneProgram.js`：`searchGenes()`
- `frontend/src/routes/Genes.jsx`：首页 suggestion 和 Gene switcher 都调用 `searchGenes(q, { limit: 12 })`

当前实现：

```sql
-- 第一步：exact lookup，命中后直接返回
WHERE gpte.gene_symbol = ? OR gpte.ensg_id = ?

-- 第二步：只有 exact 无结果且 query 不在 EN/ENS/ENSG 黑名单时才 prefix search
WHERE gpte.gene_symbol LIKE 'q%' ESCAPE '\\'
   OR gpte.ensg_id LIKE 'q%' ESCAPE '\\'
```

证据：

- `FNDC10` exact 查询走 `idx_gpte_gene` / `idx_gpte_ensg`，过滤 40 行，实测约 20 ms。
- `FNDC%` prefix 查询也走索引 range scan，估算 93 行，实测约 11 ms。
- 修改前短前缀 `EN%` 会匹配大量 Ensembl ID，计划退回 `gene_program_trait_edge` 大范围扫描，本次复测约 3.49 秒。
- 修改后 `EN` / `ENS` / `ENSG` exact miss 后跳过 prefix fallback；`EN` 本次约 146 ms，`ENS` / `ENSG` 约 6-7 ms。
- 1 字符 symbol prefix 已允许；`M` 本次返回 12 个候选，约 507 ms，后续应通过 route timing 看真实 p95。

前端现状：

- `Genes.jsx` 已有 `useDebouncedValue(value, 280)`；首页 suggestion 和 Gene switcher 都使用 debounce 后的查询值。
- 前端 suggestion 触发阈值仍是 2 个字符；后端已对 `EN` / `ENS` / `ENSG` 做 fallback 保护。

建议：

1. 保留现有 exact 快路径和 prefix search。
2. 对 prefix fallback 加保护：普通 gene symbol 允许 1 个字符前缀；`EN` / `ENS` / `ENSG` 等 Ensembl 通用前缀只做 exact lookup，不触发 prefix fallback。
3. 更稳的长期方案是让 `searchGenes()` 查 `gene_summary` 物化表，而不是每次在 edge 表上聚合。
4. 如果需要真正 substring 搜索，再单独建立 FULLTEXT/ngram 搜索表，不要回到 `%LIKE%`。

### P1. collation 不一致导致 BINARY/COLLATE join 退化

相关代码：

- `backend/models/MgeneProgram.js`
  - `getGenePrograms()` 多处 `ON BINARY ... = BINARY ...`
  - `getProgramTraits()` 多处 `ON BINARY ... = BINARY ...`
  - `getProgramGenes()` `ON BINARY gi.ensembl = BINARY gpte.ensg_id`
- `backend/models/Mmeta.js`
  - `trait_ldsc` join 使用三段 `OR + COLLATE`

证据：

- 去掉 `BINARY` 后，`file_metadata` 与 edge 表普通 join 会报 `Illegal mix of collations`。
- 用 `CAST(... AS BINARY)` 模拟计划时，`getGenePrograms()` 在 base gene 已用索引过滤到约 41 行后，右侧仍对 `trait_program_edge`、`file_metadata`、`program_info`、`gene_info_hg37_matched` 做 hash scan。
- `/api/meta/:fileId` 的 `trait_ldsc` join 因为 `OR + COLLATE` 对 `trait_ldsc` 做全表 scan；当前只有 2,344 行，但增长后会恶化。

建议：

- 维护窗口内统一 join key collation。MySQL 8/9 可统一到 `utf8mb4_0900_ai_ci`，也可以统一到 `utf8mb4_unicode_ci`；关键是全库 join key 一致。
- 统一后删除 SQL 里的 `BINARY` / 多余 `COLLATE`，让现有索引重新参与 join。
- `trait_ldsc` meta 关联拆成多次 indexed lookup 或 `UNION ALL` 候选表，而不是一个三条件 OR join。

### P2. Program 详情聚合当前可接受，但增长后需要预计算

相关代码：

- `backend/models/MgeneProgram.js`
  - `getProgramTraits()`
  - `getProgramGenes()`

证据，以 `P14` 为例：

- `gene_program_trait_edge WHERE program='P14'`：4,248 行。
- `trait_program_edge WHERE program='P14'`：267 行。
- top genes 窗口函数聚合返回 2,135 行，实测约 0.12 秒。
- program genes 聚合返回 730 个 gene group，本次复查约 0.07 秒。

当前规模下可以接受。若 program 数、trait 数或 gene edge 增长，建议在导入时预计算：

- `program_trait_top_genes(program, trait_id, rank, gene_label, score)`
- `program_gene_summary(program, gene_key, value, rank_within_side, total_traits, roles, signs)`

### P2. Browse 列表搜索现在能用，但增长后会退化

相关代码：

- `backend/models/Mmeta.js`：`getTraits()`
- `frontend/src/components/GwasDataList.jsx`：Trait browse table

证据：

- 无搜索时列表查询走 `file_metadata.idx_trait`，再用 `gwas_meta.idx_file` lookup。
- COUNT 查询当前会 scan `file_metadata`，但表只有 2,415 行。
- 搜索条件是多列 `%LIKE%`，过滤发生在 join 后；当前数据量很小，用时可接受。

建议：

- 无搜索 COUNT 可直接从 `file_metadata` 计数，不必 join `gwas_meta`。
- 若 trait metadata 增长到十万级，建立专门搜索表或 FULLTEXT 索引，不要长期依赖多列 `%LIKE%`。
- 当前 `gwas_meta.file_id` 数据上唯一，可以考虑加唯一约束改善优化器估计：

```sql
-- MySQL 允许多个 NULL；加约束前先保留一次重复检查
ALTER TABLE gwas_meta ADD UNIQUE KEY uk_gwas_meta_file_id (file_id);
```

## 前端触发与渲染风险

### Gene 页面

- Gene 首页每次分页/排序都请求 `/api/genes`，但后端实际从进程内大数组排序分页。
- 搜索 suggestion 和 Gene switcher 已有 280 ms debounce，常规 exact/prefix 查询已明显变快；`EN` / `ENS` / `ENSG` 已由后端显式跳过 fallback，剩余风险是 1 字符 symbol prefix 的高命中查询。
- CSV 下载调用 `limit=0` 拉全量 gene，再在前端构造 CSV。

### Trait 页面

- Trait 详情加载时并发请求：
  - `/api/programs/list`
  - `/api/programs/graph-list`
  - `/api/meta/:fileId`
- `programs/list`、`graph-list` 是目录扫描，不是 SQL；当前已加 60 秒进程内 TTL 缓存，避免每个 trait 页面都扫目录。
- Manhattan、volcano、gene evidence 等图表从后端拿整份 TSV JSON/文本，再在前端 `useMemo` 里过滤、排序、构造 Plotly traces。
- `.env.example` 给出 `DATA_MAX_TSV_ROWS=1000000`、`MANHATTAN_MAX_FILE_BYTES=1gb`；其中通用 TSV 路由使用 max rows，Manhattan 路由现在会检查 file size，但限额内仍整文件解析并返回给前端。这对浏览器主线程和 Node 响应内存仍偏激进。

建议：

- 图表接口增加 `variant=hits` 默认、小样本摘要、分页 table 数据、server-side filter。
- 大文件响应启用 gzip/brotli、ETag/Last-Modified、短期内存或文件 stat 缓存。
- 对 Plotly 大点数使用阈值降采样或只渲染显著点，表格分页不要依赖前端全量排序。

## 后端连接与缓存

- DB pool 默认 `DB_POOL_SIZE=10`。当前慢点主要是 CPU/聚合和文件读取，单纯增大 pool 不会解决问题，反而可能让 MySQL 并发全表扫描更多。
- `warmGeneSummaryCache()` 是进程内预热。多实例部署时缓存不共享。
- TSV cache 只在 Manhattan 路由有 `TSV_CACHE`；volcano、gene evidence、QQ 等仍按请求读文件。

建议：

- 添加 route timing middleware，记录 method/path/status/duration/response size。
- 开启 MySQL slow query log，阈值先设 200ms，优化后收敛到 100ms。
- 对稳定文件数据使用带 mtime 的 LRU 缓存，限制总内存。
- 对跨实例部署，用物化表优先于共享缓存；缓存只作为加速层。

## 索引整理建议

当前 `gene_program_trait_edge` 索引大小约为数据大小的 1.59 倍；`trait_program_edge` 为 1.72 倍。

疑似冗余索引：

- `gene_program_trait_edge.idx_gpte_gene` 被 `idx_gpte_gene_program(gene_symbol, program)` 左前缀覆盖。
- `gene_program_trait_edge.idx_gpte_ensg` 被 `idx_gpte_ensg_program(ensg_id, program)` 左前缀覆盖。
- `gene_program_trait_edge.idx_gpte_program` 被 `idx_gpte_program_trait(program, trait_id)` 左前缀覆盖。
- `gene_program_trait_edge.idx_gpte_trait` 被 `idx_gpte_trait_program(trait_id, program)` 左前缀覆盖。
- `trait_program_edge.idx_tpe_program` / `idx_tpe_trait` 同理被复合索引覆盖。
- `program_info.idx_program` 与唯一索引 `program` 重复。
- `file_id_mapping.idx_gwas` 被 `uk_gwas_lof(gwas_id, lof_id)` 左前缀覆盖。

不要立即批量删除。建议在 collation 修复、SQL 重写和 `ANALYZE TABLE` 后，用 `performance_schema.table_io_waits_summary_by_index_usage` 或慢查询计划确认未使用，再分批 drop。

## 推荐实施路线

### 第 1 阶段：正确性与低风险止血

1. 保持旧 Trait SQL GWAS API 删除状态，避免回归。
2. 保留前端 Gene 搜索 debounce；后端 prefix fallback 允许 1 字符 symbol 前缀，但 `EN` / `ENS` / `ENSG` 不走 prefix fallback。
3. 保留 `/api/programs/list`、`/api/programs/graph-list` 的 60 秒 TTL 缓存。
4. Browse 无搜索 COUNT 去掉不必要的 `gwas_meta` join。
5. 增加 route duration 和 response size 日志，用真实请求数据确认后续优化优先级。

### 第 2 阶段：schema 与查询计划修复

1. 统一 join key collation。
2. 移除 `BINARY` / `COLLATE` join workaround。
3. 重写 `trait_ldsc` OR join 为 indexed lookups。
4. 加 `ANALYZE TABLE` 到导入/迁移流程。

### 第 3 阶段：物化与数据服务重构

1. 建立 `gene_summary` 物化表，替换 Node 内存大聚合。
2. 建立 `program_gene_summary`、`program_trait_top_genes`，降低 Program 详情聚合成本。
3. 大型 TSV 图表接口支持 server-side filter、分页、采样和 HTTP 缓存。
4. CSV 导出改流式或后台生成。

## 验收指标

建议目标：

| 路径 | 当前观察 | 目标 |
|---|---:|---:|
| Gene summary 冷聚合 | 约 2.86s | 请求路径不再执行；物化刷新离线完成 |
| Gene 搜索 exact | 约 20 ms | p95 < 100ms |
| Gene 搜索短前缀 | 修改前 `EN%` 约 3.49s；修改后 `M%` 约 0.51s | `EN` / `ENS` / `ENSG` 跳过 prefix fallback；普通 symbol 短前缀 p95 < 200ms |
| Program traits / genes | 0.1s 级 | p95 < 200ms，数据增长 5 倍后仍稳定 |
| Browse 无搜索 | 当前可接受 | p95 < 100ms |
| Trait meta | 当前小表可接受 | 无全表 `trait_ldsc` scan |
| 图表 full TSV 加载 | 受文件大小影响 | 首屏只加载 hits/summary，full 数据按需 |

## 附：本次取证要点

- `gene_program_trait_edge`：精确 297,549 行；`EXPLAIN` 估算约 281,492 行；`P14` 对应 4,248 行；`FNDC10` 对应 40 行。
- Gene summary 聚合：7,161 个 gene group，约 2.86 秒。
- Gene search `FNDC10` exact：1 个 group，约 20 ms；旧式 `%FNDC10%` 写法约 0.40 秒。
- Gene search `FNDC%` prefix：3 个 group，约 11 ms。
- Gene search `EN%` prefix：修改前短前缀高匹配，本次复测约 3.49 秒；修改后 `EN/ENS/ENSG` 跳过 fallback。
- Gene search `M%` prefix：1 字符 symbol prefix 返回 12 个候选，本次约 0.51 秒。
- Program top genes `P14`：2,135 行，约 0.12 秒。
- Program genes `P14`：730 个 gene group，约 0.07 秒。
- `file_metadata` trait 数：2,415。
- `gwas_meta`：28,627 行，非空 `file_id` 去重 2,415；当前不会放大 Browse join。
