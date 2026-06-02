const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SOURCE_DIR = process.env.HERITABILITY_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/ldsc/';

function createPool() {
    const connectionConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 33306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'gwas',
        waitForConnections: true,
        connectionLimit: 4,
    };

    if (process.env.DB_PASSWORD) connectionConfig.password = process.env.DB_PASSWORD;
    return mysql.createPool(connectionConfig);
}

function normalizeGwasId(fileName) {
    return String(fileName || '')
        .replace(/_k562_atac\.results$/i, '')
        .replace(/\.(tsv|txt|csv|log|sumstats|results?)$/i, '')
        .trim();
}

function parseNumber(value) {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text || /^na$/i.test(text) || /^nan$/i.test(text)) return null;
    const num = Number(text);
    return Number.isFinite(num) ? num : null;
}

function parseLdscResult(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return { enrichment: null, coefficient_z_score: null, notes: 'Missing LDSC result row' };
    }

    const headers = lines[0].split('\t').map((item) => item.trim());
    const values = lines[1].split('\t').map((item) => item.trim());
    const indexByHeader = new Map(headers.map((header, index) => [header.toLowerCase(), index]));
    const enrichmentIndex = indexByHeader.get('enrichment');
    const zScoreIndex = indexByHeader.get('coefficient_z-score');

    return {
        enrichment: enrichmentIndex != null ? parseNumber(values[enrichmentIndex]) : null,
        coefficient_z_score: zScoreIndex != null ? parseNumber(values[zScoreIndex]) : null,
        notes: null,
    };
}

async function importDirectory() {
    const pool = createPool();
    const entries = fs.readdirSync(SOURCE_DIR, { withFileTypes: true }).filter((entry) => entry.isFile());

    console.log(`Importing trait heritability from ${SOURCE_DIR}`);

    try {
        let imported = 0;

        for (const entry of entries) {
            const sourceFile = entry.name;
            const gwasId = normalizeGwasId(sourceFile);
            if (!gwasId) continue;

            const fullPath = path.join(SOURCE_DIR, sourceFile);
            const text = fs.readFileSync(fullPath, 'utf-8');
            const parsed = parseLdscResult(text);

            const values = [
                gwasId,
                sourceFile,
                parsed.enrichment,
                parsed.coefficient_z_score,
                parsed.notes,
            ];

            await pool.query(
                `INSERT INTO trait_heritability (
                    gwas_id, source_file, enrichment, coefficient_z_score, notes
                ) VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    source_file = VALUES(source_file),
                    enrichment = VALUES(enrichment),
                    coefficient_z_score = VALUES(coefficient_z_score),
                    notes = VALUES(notes)`,
                values
            );
            imported += 1;
        }

        const [linked] = await pool.query(`
            UPDATE trait_heritability th
            JOIN file_metadata fm ON fm.gwas_id = th.gwas_id
            SET th.file_id = fm.file_id
            WHERE th.file_id IS NULL OR th.file_id != fm.file_id
        `);

        console.log(`Imported ${imported} files.`);
        console.log(`Linked ${linked.affectedRows} rows to file_metadata.`);
    } finally {
        await pool.end();
    }
}

importDirectory().catch((error) => {
    console.error('Trait heritability import failed:', error.message);
    process.exit(1);
});
