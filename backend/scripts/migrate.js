/**
 * 数据库迁移脚本 — 读取 init_schema.sql 并执行
 * 用法：node backend/scripts/migrate.js
 * 环境变量：DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'Admin',
        password: process.env.DB_PASSWORD || '123456',
        database: process.env.DB_NAME || 'gwas',
        waitForConnections: true,
        connectionLimit: 1,
        multipleStatements: true,
    });

    const sqlPath = path.join(__dirname, 'init_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`Executing ${sqlPath} on ${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'gwas'}...`);

    try {
        await pool.query(sql);
        console.log('Schema migration completed successfully.');

        // 验证新表
        const [tables] = await pool.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('file_id_mapping','trait','file_metadata','gene_annotation','gene_set','gene_set_member','gwas_variant','lof_burden','gene_posterior','gene_regulation','go_enrichment','cnmf_program','cnmf_spectra','program_enrichment','regulator_enrichment','perturb_effect','trans_eqtl')",
            [process.env.DB_NAME || 'gwas']
        );
        console.log('Created tables:', tables.map(t => t.TABLE_NAME).join(', '));
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
