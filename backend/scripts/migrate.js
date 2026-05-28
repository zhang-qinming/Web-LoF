const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function migrate() {
    const dbHost = process.env.DB_HOST || '127.0.0.1';
    const dbName = process.env.DB_NAME || 'gwas';

    const connectionConfig = {
        host: dbHost,
        port: parseInt(process.env.DB_PORT, 10) || 33306,
        user: process.env.DB_USER || 'root',
        database: dbName,
        waitForConnections: true,
        connectionLimit: 1,
        multipleStatements: true,
    };
    if (process.env.DB_PASSWORD) connectionConfig.password = process.env.DB_PASSWORD;
    const pool = mysql.createPool(connectionConfig);

    const sqlPath = path.join(__dirname, 'init_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`Executing ${sqlPath} on ${dbHost}/${dbName}...`);

    try {
        await pool.query(sql);
        console.log('Schema migration completed successfully.');

        const [tables] = await pool.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('file_id_mapping','trait','file_metadata','gene_annotation','gene_set','gene_set_member','gwas_variant','lof_burden','gene_posterior','gene_regulation','go_enrichment','cnmf_program','cnmf_spectra','program_enrichment','regulator_enrichment','perturb_effect','trans_eqtl','trait_program_edge','gene_program_trait_edge')",
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
