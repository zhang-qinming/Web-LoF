/**
 * 导入 GWAS 元数据（三批 TSV 文件）→ gwas_meta 表
 *
 * 用法（集群上）：
 *   # 先导出 Excel → TSV（另存为 UTF-8 无 BOM 的 TSV）
 *   # 第一批：老数据，列: FileID Trait MeshTerm MeshID SampleSize Ncase Ncontrol
 *   #         Population FirstAuthor PMID Year Nvariants Nsig FilePath Url QCscore ifUKB CollectDate
 *   # 第二批：24/26年，列: FileID QCscore Nvariants NSig CollectDate PMID "FIRST AUTHOR" Url
 *   #         Trait CORE_ANCESTRY Ncase Ncontrol SampleSize ifUKB Population Year FilePath MeshTerm MeshID MeshSource
 *   # 第三批：25年，列: 同上减掉 MeshSource
 *
 *   node scripts/import_gwas_meta.js old.tsv old       --source old
 *   node scripts/import_gwas_meta.js 2024.tsv 2024     --source 2024
 *   node scripts/import_gwas_meta.js 2025.tsv 2025     --source 2025
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

// ============================================================
// 列映射：TSV 表头 → 数据库列名
// 不同来源的 TSV 列名可能不同，在这里统一
// ============================================================

const COLUMN_MAPS = {
    old: {
        FileID: 'gwas_id',
        Trait: 'trait',
        MeshTerm: 'mesh_term',
        MeshID: 'mesh_id',
        SampleSize: 'sample_size',
        Ncase: 'n_case',
        Ncontrol: 'n_control',
        Population: 'population',
        FirstAuthor: 'first_author',
        PMID: 'pmid',
        Year: 'year',
        Nvariants: 'n_variants',
        Nsig: 'n_sig',
        QCscore: 'qc_score',
        ifUKB: 'if_ukb',
        CollectDate: 'collect_date',
        Url: 'url',
        FilePath: 'file_path',
    },
    '2024': {
        FileID: 'gwas_id',
        QCscore: 'qc_score',
        Nvariants: 'n_variants',
        NSig: 'n_sig',
        CollectDate: 'collect_date',
        PMID: 'pmid',
        'FIRST AUTHOR': 'first_author',
        Url: 'url',
        Trait: 'trait',
        Ncase: 'n_case',
        Ncontrol: 'n_control',
        SampleSize: 'sample_size',
        ifUKB: 'if_ukb',
        Population: 'population',
        Year: 'year',
        FilePath: 'file_path',
        MeshTerm: 'mesh_term',
        MeshID: 'mesh_id',
        MeshSource: 'mesh_source',
    },
    '2025': {
        FileID: 'gwas_id',
        QCscore: 'qc_score',
        Nvariants: 'n_variants',
        NSig: 'n_sig',
        CollectDate: 'collect_date',
        PMID: 'pmid',
        'FIRST AUTHOR': 'first_author',
        Url: 'url',
        Trait: 'trait',
        Ncase: 'n_case',
        Ncontrol: 'n_control',
        SampleSize: 'sample_size',
        ifUKB: 'if_ukb',
        Population: 'population',
        Year: 'year',
        FilePath: 'file_path',
        MeshTerm: 'mesh_term',
        MeshID: 'mesh_id',
    },
};

// 所有可能的数据库列
const ALL_COLS = [
    'gwas_id', 'trait', 'mesh_term', 'mesh_id', 'sample_size',
    'n_case', 'n_control', 'population', 'first_author', 'pmid',
    'year', 'n_variants', 'n_sig', 'qc_score', 'if_ukb',
    'collect_date', 'url', 'file_path', 'mesh_source',
];

const BATCH_SIZE = 100;

// ============================================================
async function importFile(tsvPath, source) {
    const colMap = COLUMN_MAPS[source];
    if (!colMap) {
        console.error(`Unknown source: ${source}. Must be one of: old, 2024, 2025`);
        process.exit(1);
    }

    if (!fs.existsSync(tsvPath)) {
        console.error(`File not found: ${tsvPath}`);
        process.exit(1);
    }

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 33306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gwas',
        waitForConnections: true,
        connectionLimit: 1,
    });

    const rl = readline.createInterface({
        input: fs.createReadStream(tsvPath),
        crlfDelay: Infinity,
    });

    let headerLine = true;
    let headerIndices = {}; // { dbColName: tsvColumnIndex }
    let batch = [];
    let totalRows = 0;
    let skippedRows = 0;

    for await (const line of rl) {
        const cols = line.split('\t');
        if (cols.length < 2) continue; // skip empty lines

        if (headerLine) {
            // 解析表头，建立索引
            // cols[0] 可能有 BOM，trim 掉
            cols[0] = cols[0].replace(/^﻿/, '').trim();
            for (let i = 0; i < cols.length; i++) {
                const rawName = cols[i].trim();
                const dbName = colMap[rawName];
                if (dbName) {
                    headerIndices[dbName] = i;
                }
            }
            headerLine = false;
            continue;
        }

        // 构建数据行
        const row = {};
        for (const dbCol of ALL_COLS) {
            const idx = headerIndices[dbCol];
            row[dbCol] = (idx !== undefined && cols[idx] !== undefined)
                ? cols[idx].trim()
                : null;
        }
        row.source_batch = source;

        // 跳过没有 gwas_id 的行
        if (!row.gwas_id) {
            skippedRows++;
            continue;
        }

        batch.push(row);
        if (batch.length >= BATCH_SIZE) {
            await insertBatch(pool, batch);
            totalRows += batch.length;
            console.log(`  Imported ${totalRows} rows...`);
            batch = [];
        }
    }

    // 最后一批
    if (batch.length > 0) {
        await insertBatch(pool, batch);
        totalRows += batch.length;
    }

    // 同步 trait_name 到 file_metadata
    await syncTraitNames(pool, source);

    console.log(`Done: ${totalRows} rows imported, ${skippedRows} skipped.`);
    await pool.end();
}

// ============================================================
async function insertBatch(pool, rows) {
    const cols = [...ALL_COLS, 'source_batch'];
    const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
    const values = rows.flatMap(r => cols.map(c => r[c] || null));

    const sql = `INSERT INTO gwas_meta (${cols.join(',')}) VALUES ${placeholders}
                 ON DUPLICATE KEY UPDATE
                     trait = VALUES(trait),
                     mesh_term = VALUES(mesh_term),
                     mesh_id = VALUES(mesh_id),
                     sample_size = VALUES(sample_size),
                     n_case = VALUES(n_case),
                     n_control = VALUES(n_control),
                     population = VALUES(population),
                     first_author = VALUES(first_author),
                     pmid = VALUES(pmid),
                     year = VALUES(year),
                     n_variants = VALUES(n_variants),
                     n_sig = VALUES(n_sig),
                     qc_score = VALUES(qc_score),
                     if_ukb = VALUES(if_ukb),
                     collect_date = VALUES(collect_date),
                     url = VALUES(url),
                     file_path = VALUES(file_path),
                     mesh_source = VALUES(mesh_source),
                     source_batch = VALUES(source_batch)`;

    try {
        await pool.query(sql, values);
    } catch (err) {
        console.error('Batch insert failed:', err.message);
        // 逐行重试：每次只插一行，用单行 SQL
        const singleSql = `INSERT INTO gwas_meta (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})
                           ON DUPLICATE KEY UPDATE
                               trait = VALUES(trait), mesh_term = VALUES(mesh_term),
                               mesh_id = VALUES(mesh_id), sample_size = VALUES(sample_size),
                               n_case = VALUES(n_case), n_control = VALUES(n_control),
                               population = VALUES(population), first_author = VALUES(first_author),
                               pmid = VALUES(pmid), year = VALUES(year),
                               n_variants = VALUES(n_variants), n_sig = VALUES(n_sig),
                               qc_score = VALUES(qc_score), if_ukb = VALUES(if_ukb),
                               collect_date = VALUES(collect_date), url = VALUES(url),
                               file_path = VALUES(file_path), mesh_source = VALUES(mesh_source),
                               source_batch = VALUES(source_batch)`;
        for (const row of rows) {
            try {
                const vals = cols.map(c => row[c] || null);
                await pool.query(singleSql, vals);
            } catch (e) {
                console.error(`  Skipping row ${row.gwas_id}: ${e.message}`);
            }
        }
    }
}

// ============================================================
// 将 gwas_meta.gwas_id 匹配到 file_metadata.gwas_id，同步 trait_name 和 file_id
async function syncTraitNames(pool, source) {
    // 先补齐 gwas_meta.file_id（通过 gwas_id 关联到 file_metadata）
    const [a] = await pool.query(
        `UPDATE gwas_meta gm
         JOIN file_metadata fm ON fm.gwas_id = gm.gwas_id
         SET gm.file_id = fm.file_id
         WHERE gm.file_id IS NULL AND gm.source_batch = ?`,
        [source]
    );
    console.log(`  Linked ${a.affectedRows} gwas_meta rows to file_metadata.`);

    // 再把 trait 名同步到 file_metadata
    const [b] = await pool.query(
        `UPDATE file_metadata fm
         JOIN gwas_meta gm ON gm.gwas_id = fm.gwas_id
         SET fm.trait_name = gm.trait
         WHERE gm.trait IS NOT NULL AND gm.source_batch = ?`,
        [source]
    );
    console.log(`  Synced ${b.affectedRows} trait names to file_metadata.`);
}

// ============================================================
const tsvPath = process.argv[2];
const source = process.argv[3];

if (!tsvPath || !source) {
    console.log('Usage: node scripts/import_gwas_meta.js <tsv_file> <source>');
    console.log('  source: old | 2024 | 2025');
    process.exit(1);
}

importFile(tsvPath, source).catch(err => {
    console.error(err);
    process.exit(1);
});
