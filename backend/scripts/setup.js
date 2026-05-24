/**
 * 一键建表 + 导入 + 关联脚本
 * 用法：node backend/scripts/setup.js
 * 环境变量：DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
 * TSV 文件放在 backend/scripts/ 下
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

// ============================================================
// 配置 — 硬编码 TSV 文件名
// ============================================================
const SCRIPT_DIR = __dirname;

const FILES = {
    file_id_map:    path.join(SCRIPT_DIR, 'path.file_id_map.tsv'),
    gwas_meta_old:  path.join(SCRIPT_DIR, 'gwas_meta_old.tsv'),
    gwas_meta_2024: path.join(SCRIPT_DIR, 'gwas_meta_2024.tsv'),
    gwas_meta_2025: path.join(SCRIPT_DIR, 'gwas_meta_2025.tsv'),
    lof_meta:       path.join(SCRIPT_DIR, 'lof_meta.tsv'),
};

// ============================================================
// DDL — 全部建表语句
// ============================================================
const DDL = `
CREATE TABLE IF NOT EXISTS file_id_mapping (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    gwas_id     VARCHAR(100) NOT NULL,
    lof_id      VARCHAR(100) NOT NULL,
    gwas_path   VARCHAR(500) NOT NULL,
    lof_path    VARCHAR(500) NOT NULL,
    UNIQUE KEY uk_gwas_lof (gwas_id, lof_id),
    INDEX idx_gwas (gwas_id),
    INDEX idx_lof (lof_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS file_metadata (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id     VARCHAR(100) NOT NULL UNIQUE,
    gwas_id     VARCHAR(100) DEFAULT NULL,
    trait_name  VARCHAR(500) DEFAULT NULL,
    INDEX idx_trait (trait_name),
    INDEX idx_gwas (gwas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gwas_meta (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id         VARCHAR(100) DEFAULT NULL,
    gwas_id         VARCHAR(100) NOT NULL UNIQUE,
    trait           VARCHAR(500) DEFAULT NULL,
    mesh_term       VARCHAR(500) DEFAULT NULL,
    mesh_id         VARCHAR(50)  DEFAULT NULL,
    sample_size     INT UNSIGNED DEFAULT NULL,
    n_case          DOUBLE       DEFAULT NULL,
    n_control       DOUBLE       DEFAULT NULL,
    population      VARCHAR(200) DEFAULT NULL,
    first_author    VARCHAR(200) DEFAULT NULL,
    pmid            VARCHAR(50)  DEFAULT NULL,
    year            SMALLINT     DEFAULT NULL,
    n_variants      INT UNSIGNED DEFAULT NULL,
    n_sig           INT UNSIGNED DEFAULT NULL,
    qc_score        INT          DEFAULT NULL,
    if_ukb          BOOLEAN      DEFAULT FALSE,
    collect_date    VARCHAR(20)  DEFAULT NULL,
    url             VARCHAR(500) DEFAULT NULL,
    file_path       VARCHAR(500) DEFAULT NULL,
    mesh_source     VARCHAR(100) DEFAULT NULL,
    source_batch    VARCHAR(20)  DEFAULT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE SET NULL,
    INDEX idx_file (file_id),
    INDEX idx_trait (trait),
    INDEX idx_batch (source_batch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lof_meta (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    file_id     VARCHAR(100) DEFAULT NULL,
    lof_id      VARCHAR(200) NOT NULL,
    gwas_id     VARCHAR(100) NOT NULL,
    trait_name  VARCHAR(500) DEFAULT NULL,
    FOREIGN KEY (file_id) REFERENCES file_metadata(file_id) ON DELETE SET NULL,
    UNIQUE KEY uk_lof (lof_id),
    INDEX idx_gwas (gwas_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

// ============================================================
// GWAS meta 列映射（TSV 表头 → 数据库列）
// ============================================================
const GWAS_COL_MAPS = {
    old: {
        FileID: 'gwas_id', Trait: 'trait', MeshTerm: 'mesh_term', MeshID: 'mesh_id',
        SampleSize: 'sample_size', Ncase: 'n_case', Ncontrol: 'n_control',
        Population: 'population', FirstAuthor: 'first_author', PMID: 'pmid',
        Year: 'year', Nvariants: 'n_variants', Nsig: 'n_sig', QCscore: 'qc_score',
        ifUKB: 'if_ukb', CollectDate: 'collect_date', Url: 'url', FilePath: 'file_path',
    },
    '2024': {
        FileID: 'gwas_id', QCscore: 'qc_score', Nvariants: 'n_variants', NSig: 'n_sig',
        CollectDate: 'collect_date', PMID: 'pmid', 'FIRST AUTHOR': 'first_author',
        Url: 'url', Trait: 'trait', Ncase: 'n_case', Ncontrol: 'n_control',
        SampleSize: 'sample_size', ifUKB: 'if_ukb', Population: 'population',
        Year: 'year', FilePath: 'file_path', MeshTerm: 'mesh_term', MeshID: 'mesh_id',
        MeshSource: 'mesh_source',
    },
    '2025': {
        FileID: 'gwas_id', QCscore: 'qc_score', Nvariants: 'n_variants', NSig: 'n_sig',
        CollectDate: 'collect_date', PMID: 'pmid', 'FIRST AUTHOR': 'first_author',
        Url: 'url', Trait: 'trait', Ncase: 'n_case', Ncontrol: 'n_control',
        SampleSize: 'sample_size', ifUKB: 'if_ukb', Population: 'population',
        Year: 'year', FilePath: 'file_path', MeshTerm: 'mesh_term', MeshID: 'mesh_id',
    },
};

const GWAS_ALL_COLS = [
    'gwas_id','trait','mesh_term','mesh_id','sample_size','n_case','n_control',
    'population','first_author','pmid','year','n_variants','n_sig','qc_score',
    'if_ukb','collect_date','url','file_path','mesh_source',
];

// ============================================================
// 数据库连接
// ============================================================
function createPool() {
    return mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 33306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gwas',
        waitForConnections: true,
        connectionLimit: 1,
        multipleStatements: true,
    });
}

// ============================================================
// 辅助：读 TSV，跳过表头，逐行回调
// ============================================================
async function parseTSV(filePath, onRow, onHeader) {
    if (!fs.existsSync(filePath)) {
        console.error(`  [SKIP] File not found: ${filePath}`);
        return 0;
    }
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
    });
    let header = true;
    let count = 0;
    for await (const line of rl) {
        const cols = line.split('\t');
        if (cols.length < 2) continue;
        cols[0] = cols[0].replace(/^﻿/, ''); // 去 BOM
        if (header) {
            if (onHeader) await onHeader(cols.map(c => c.trim()));
            header = false;
            continue;
        }
        await onRow(cols);
        count++;
    }
    return count;
}

// ============================================================
// 1. 建表
// ============================================================
async function stepCreateTables(pool) {
    console.log('[1/6] Creating tables...');
    await pool.query(DDL);
    console.log('  OK');
}

// ============================================================
// 2. 导入 file_id_map
// ============================================================
async function stepImportFileIdMap(pool) {
    console.log('[2/6] Importing file_id_map...');
    const batch = [];
    let total = 0;

    await parseTSV(FILES.file_id_map,
        async (cols) => {
            batch.push([cols[0]?.trim(), cols[1]?.trim(), cols[2]?.trim(), cols[3]?.trim()]);
            if (batch.length >= 200) total += await flush();
        },
        () => {} // header: id1 id2 path1 path2
    );
    total += await flush();

    async function flush() {
        if (batch.length === 0) return 0;
        const placeholders = batch.map(() => '(?,?,?,?)').join(',');
        const vals = batch.flat();
        const n = batch.length;
        batch.length = 0;
        await pool.query(`INSERT IGNORE INTO file_id_mapping (gwas_id,lof_id,gwas_path,lof_path) VALUES ${placeholders}`, vals);
        return n;
    }
    console.log(`  Imported ${total} rows`);
}

// ============================================================
// 3. 初始化 file_metadata
// ============================================================
async function stepInitFileMetadata(pool) {
    console.log('[3/6] Initializing file_metadata...');
    await pool.query(`
        INSERT IGNORE INTO file_metadata (file_id, gwas_id)
        SELECT lof_id, gwas_id FROM file_id_mapping
    `);
    const [[{cnt}]] = await pool.query('SELECT COUNT(*) AS cnt FROM file_metadata');
    console.log(`  ${cnt} rows in file_metadata`);
}

// ============================================================
// 4. 导入 gwas_meta（三批）
// ============================================================
async function stepImportGwasMeta(pool) {
    console.log('[4/6] Importing gwas_meta...');

    for (const [source, filePath] of [
        ['old', FILES.gwas_meta_old],
        ['2024', FILES.gwas_meta_2024],
        ['2025', FILES.gwas_meta_2025],
    ]) {
        const colMap = GWAS_COL_MAPS[source];
        let headerIndices = {};
        const batch = [];
        let total = 0;

        await parseTSV(filePath,
            async (cols) => {
                const row = {};
                for (const dbCol of GWAS_ALL_COLS) {
                    const idx = headerIndices[dbCol];
                    row[dbCol] = (idx !== undefined && cols[idx]) ? cols[idx].trim() : null;
                }
                row.source_batch = source;
                if (!row.gwas_id) return;
                batch.push(row);
                if (batch.length >= 100) total += await flush();
            },
            (headers) => {
                for (let i = 0; i < headers.length; i++) {
                    const dbName = colMap[headers[i]];
                    if (dbName) headerIndices[dbName] = i;
                }
            }
        );
        total += await flush();
        console.log(`  ${source}: ${total} rows`);

        async function flush() {
            if (batch.length === 0) return 0;
            const rows = batch.splice(0, batch.length);
            const cols = [...GWAS_ALL_COLS, 'source_batch'];
            const singleSql = `INSERT INTO gwas_meta (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})
                ON DUPLICATE KEY UPDATE
                    trait=VALUES(trait), mesh_term=VALUES(mesh_term), mesh_id=VALUES(mesh_id),
                    sample_size=VALUES(sample_size), n_case=VALUES(n_case), n_control=VALUES(n_control),
                    population=VALUES(population), first_author=VALUES(first_author), pmid=VALUES(pmid),
                    year=VALUES(year), n_variants=VALUES(n_variants), n_sig=VALUES(n_sig), qc_score=VALUES(qc_score),
                    if_ukb=VALUES(if_ukb), collect_date=VALUES(collect_date), url=VALUES(url),
                    file_path=VALUES(file_path), mesh_source=VALUES(mesh_source), source_batch=VALUES(source_batch)`;
            let inserted = 0;
            for (const row of rows) {
                const vals = cols.map(c => row[c] || null);
                try {
                    await pool.query(singleSql, vals);
                    inserted += 1;
                } catch (err) {
                    console.error(`  [SKIP] ${source} ${row.gwas_id}: ${err.message}`);
                }
            }
            return inserted;
        }
    }
}

// ============================================================
// 5. 导入 lof_meta
// ============================================================
async function stepImportLofMeta(pool) {
    console.log('[5/6] Importing lof_meta...');
    const batch = [];
    let total = 0;

    await parseTSV(FILES.lof_meta,
        async (cols) => {
            batch.push([cols[0]?.trim(), cols[1]?.trim(), cols[2]?.trim()]);
            if (batch.length >= 200) total += await flush();
        },
        () => {}
    );

    total += await flush();
    console.log(`  Imported ${total} rows`);

    async function flush() {
        if (batch.length === 0) return 0;
        const placeholders = batch.map(() => '(?,?,?)').join(',');
        const vals = batch.flat();
        const n = batch.length;
        batch.length = 0;
        await pool.query(
            `INSERT IGNORE INTO lof_meta (lof_id, gwas_id, trait_name) VALUES ${placeholders}`,
            vals
        );
        return n;
    }
}

// ============================================================
// 6. 补齐 file_id 关联 + 同步 trait_name
// ============================================================
async function stepLinkAndSync(pool) {
    console.log('[6/6] Linking and syncing...');

    // 6a. gwas_meta → file_metadata（通过 gwas_id）
    const [a] = await pool.query(`
        UPDATE gwas_meta gm
        JOIN file_metadata fm ON fm.gwas_id = gm.gwas_id
        SET gm.file_id = fm.file_id
        WHERE gm.file_id IS NULL
    `);
    console.log(`  gwas_meta linked: ${a.affectedRows}`);

    // 6b. lof_meta → file_id_mapping → file_metadata
    const [b] = await pool.query(`
        UPDATE lof_meta lm
        JOIN file_id_mapping fim ON fim.lof_id = lm.gwas_id
        JOIN file_metadata fm ON fm.gwas_id = fim.gwas_id
        SET lm.file_id = fm.file_id
        WHERE lm.file_id IS NULL
    `);
    console.log(`  lof_meta linked: ${b.affectedRows}`);

    // 6c. 同步 trait_name 到 file_metadata（来自 lof_meta，优先级高于 gwas_meta）
    const [c] = await pool.query(`
        UPDATE file_metadata fm
        JOIN lof_meta lm ON lm.file_id = fm.file_id
        SET fm.trait_name = lm.trait_name
        WHERE lm.trait_name IS NOT NULL AND (fm.trait_name IS NULL OR fm.trait_name = '')
    `);
    console.log(`  trait synced from lof_meta: ${c.affectedRows}`);

    // 6d. 同步 trait_name 到 file_metadata（来自 gwas_meta，补漏）
    const [d] = await pool.query(`
        UPDATE file_metadata fm
        JOIN gwas_meta gm ON gm.file_id = fm.file_id
        SET fm.trait_name = gm.trait
        WHERE gm.trait IS NOT NULL AND (fm.trait_name IS NULL OR fm.trait_name = '')
    `);
    console.log(`  trait synced from gwas_meta: ${d.affectedRows}`);

    // 6e. 用 file_id_mapping 中的 ID 补全 gwas_meta 缺失的行
    const [e] = await pool.query(`
        INSERT IGNORE INTO file_metadata (file_id, gwas_id)
        SELECT lof_id, gwas_id FROM file_id_mapping
    `);
    if (e.affectedRows > 0) console.log(`  supplemented file_metadata: ${e.affectedRows}`);
}

// ============================================================
// 主流程
// ============================================================
async function main() {
    const pool = createPool();
    console.log('=== GWAS Data Browser — Setup ===\n');

    try {
        await stepCreateTables(pool);
        await stepImportFileIdMap(pool);
        await stepInitFileMetadata(pool);
        await stepImportGwasMeta(pool);
        await stepImportLofMeta(pool);
        await stepLinkAndSync(pool);

        // 汇总
        const [rows] = await pool.query(`
            SELECT 'file_id_mapping' AS tbl, COUNT(*) AS cnt FROM file_id_mapping
            UNION ALL SELECT 'file_metadata', COUNT(*) FROM file_metadata
            UNION ALL SELECT 'gwas_meta', COUNT(*) FROM gwas_meta
            UNION ALL SELECT 'lof_meta', COUNT(*) FROM lof_meta
        `);
        console.log('\n=== Summary ===');
        rows.forEach(r => console.log(`  ${r.tbl}: ${r.cnt}`));
        console.log('\nDone.');
    } catch (err) {
        console.error('Setup failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
