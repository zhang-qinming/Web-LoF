const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SOURCE_DIR = process.env.LDSC_DIR || process.env.HERITABILITY_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/ldsc/';
const LDSC_ROW = 'L2_0';

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

function normalizeLdscStem(fileName) {
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

function splitLdscLine(line) {
    const trimmed = String(line || '').trim();
    return trimmed.includes('\t') ? trimmed.split('\t').map((item) => item.trim()) : trimmed.split(/\s+/).map((item) => item.trim());
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function findHeaderIndex(indexByHeader, names) {
    for (const name of names) {
        const index = indexByHeader.get(normalizeKey(name));
        if (index != null) return index;
    }
    return undefined;
}

function parseLdscResult(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return { enrichment: null, coefficient_z_score: null, rowName: null };
    }

    const headers = splitLdscLine(lines[0]);
    const indexByHeader = new Map(headers.map((header, index) => [normalizeKey(header), index]));
    const resolvedCategoryIndex = findHeaderIndex(indexByHeader, ['category', 'annotation', 'ld_score']);
    const categoryIndex = resolvedCategoryIndex == null ? 0 : resolvedCategoryIndex;
    const enrichmentIndex = findHeaderIndex(indexByHeader, ['enrichment']);
    const zScoreIndex = findHeaderIndex(indexByHeader, ['coefficient_z-score', 'coefficient_z_score', 'coefficient z-score']);

    const dataRows = lines.slice(1).map(splitLdscLine);
    const values = dataRows.find((row) => normalizeKey(row[categoryIndex]) === normalizeKey(LDSC_ROW)) || dataRows[0] || [];

    return {
        enrichment: enrichmentIndex != null ? parseNumber(values[enrichmentIndex]) : null,
        coefficient_z_score: zScoreIndex != null ? parseNumber(values[zScoreIndex]) : null,
        rowName: values[categoryIndex] || null,
    };
}

async function loadTraitIdMap(pool) {
    const [rows] = await pool.query(`
        SELECT
            fm.file_id,
            fm.gwas_id,
            COALESCE(fim.lof_id, fm.file_id) AS lof_id
        FROM file_metadata fm
        LEFT JOIN file_id_mapping fim ON fim.gwas_id = fm.gwas_id
        WHERE fm.file_id IS NOT NULL OR fm.gwas_id IS NOT NULL OR fim.lof_id IS NOT NULL
    `);

    const idMap = new Map();
    for (const row of rows) {
        const normalized = {
            gwas_id: String(row.gwas_id || '').trim(),
            file_id: String(row.file_id || '').trim(),
            lof_id: String(row.lof_id || '').trim(),
        };

        for (const id of [normalized.gwas_id, normalized.file_id, normalized.lof_id]) {
            if (id) idMap.set(id.toLowerCase(), normalized);
        }
    }
    return idMap;
}

function resolveTraitIds(fileStem, idMap) {
    const stem = String(fileStem || '').trim();
    const mapped = idMap.get(stem.toLowerCase());
    if (mapped) return mapped;
    return { gwas_id: stem, file_id: '', lof_id: '' };
}

async function importDirectory() {
    const pool = createPool();
    const entries = fs.readdirSync(SOURCE_DIR, { withFileTypes: true }).filter((entry) => entry.isFile());

    console.log(`Importing trait LDSC from ${SOURCE_DIR}`);

    try {
        const traitIdMap = await loadTraitIdMap(pool);
        let imported = 0;

        for (const entry of entries) {
            const sourceFile = entry.name;
            const sourceStem = normalizeLdscStem(sourceFile);
            if (!sourceStem) continue;

            const traitIds = resolveTraitIds(sourceStem, traitIdMap);
            if (!traitIds.gwas_id) {
                console.warn(`Skipping ${sourceFile}: could not resolve GWAS ID`);
                continue;
            }

            const fullPath = path.join(SOURCE_DIR, sourceFile);
            const text = fs.readFileSync(fullPath, 'utf-8');
            const parsed = parseLdscResult(text);
            if (normalizeKey(parsed.rowName) !== normalizeKey(LDSC_ROW)) {
                console.warn(`Warning ${sourceFile}: ${LDSC_ROW} row not found; imported first data row`);
            }

            const values = [
                traitIds.gwas_id,
                traitIds.file_id || traitIds.lof_id || null,
                traitIds.lof_id || traitIds.file_id || null,
                sourceFile,
                parsed.enrichment,
                parsed.coefficient_z_score,
            ];

            await pool.query(
                `INSERT INTO trait_ldsc (
                    gwas_id, file_id, lof_id, source_file, enrichment, coefficient_z_score
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    file_id = VALUES(file_id),
                    lof_id = VALUES(lof_id),
                    source_file = VALUES(source_file),
                    enrichment = VALUES(enrichment),
                    coefficient_z_score = VALUES(coefficient_z_score),
                    imported_at = CURRENT_TIMESTAMP`,
                values
            );
            imported += 1;
        }

        const [linked] = await pool.query(`
            UPDATE trait_ldsc tl
            JOIN file_metadata fm ON fm.gwas_id = tl.gwas_id
            LEFT JOIN file_id_mapping fim ON fim.gwas_id = fm.gwas_id
            SET
                tl.file_id = fm.file_id,
                tl.lof_id = COALESCE(fim.lof_id, fm.file_id, tl.lof_id)
            WHERE tl.file_id IS NULL
               OR tl.file_id != fm.file_id
               OR (COALESCE(fim.lof_id, fm.file_id) IS NOT NULL
                   AND (tl.lof_id IS NULL OR tl.lof_id != COALESCE(fim.lof_id, fm.file_id)))
        `);

        console.log(`Imported ${imported} files.`);
        console.log(`Linked ${linked.affectedRows} rows to file_metadata.`);
    } finally {
        await pool.end();
    }
}

importDirectory().catch((error) => {
    console.error('Trait LDSC import failed:', error.message);
    process.exit(1);
});
