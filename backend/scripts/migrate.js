const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function migrate() {
    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbName = process.env.DB_NAME || 'gwas';

    const pool = mysql.createPool({
        host: dbHost,
        port: parseInt(process.env.DB_PORT, 10) || 33306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '123456',
        database: dbName,
        waitForConnections: true,
        connectionLimit: 1,
        multipleStatements: true,
    });

    const sqlPath = path.join(__dirname, 'init_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`Executing ${sqlPath} on ${dbHost}/${dbName}...`);

    try {
        await pool.query(sql);
        console.log('Schema migration completed successfully.');

        const [tables] = await pool.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('file_id_mapping','trait','file_metadata','gene_annotation','gene_set','gene_set_member','gwas_variant','lof_burden','gene_posterior','gene_regulation','go_enrichment','cnmf_program','cnmf_spectra','program_enrichment','regulator_enrichment','perturb_effect','trans_eqtl')",
            [dbName]
        );
        console.log('Created tables:', tables.map((item) => item.TABLE_NAME).join(', '));
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
