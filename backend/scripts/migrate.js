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

        const [ldscPColumns] = await pool.query(
            `SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ?
               AND TABLE_NAME = 'trait_ldsc'
               AND COLUMN_NAME = 'enrichment_p'`,
            [dbName]
        );
        if (ldscPColumns.length === 0) {
            await pool.query(
                'ALTER TABLE trait_ldsc ADD COLUMN enrichment_p DOUBLE DEFAULT NULL AFTER enrichment'
            );
        }

        console.log('Schema migration completed successfully.');

        const [tables] = await pool.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('file_id_mapping','file_metadata','trait_ldsc','gwas_meta','lof_meta','program_info','trait_program_edge','gene_info_hg37_matched','gene_program_trait_edge','gene_summary')",
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
