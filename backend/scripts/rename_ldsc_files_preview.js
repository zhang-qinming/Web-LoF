const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LDSC_DIR = process.env.LDSC_DIR || process.env.HERITABILITY_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/ldsc';
const APPLY = process.argv.includes('--apply');

function createPool() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.DB_PORT, 10) || 33306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || undefined,
        database: process.env.DB_NAME || 'gwas',
        waitForConnections: true,
        connectionLimit: 4,
    };
    return mysql.createPool(config);
}

function shellQuote(value) {
    return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function getLdscStem(fileName) {
    const name = String(fileName || '').trim();
    const suffix = '_k562_atac.results';
    if (name.toLowerCase().endsWith(suffix)) return name.slice(0, -suffix.length);
    const ext = path.extname(name);
    return ext ? name.slice(0, -ext.length) : name;
}

function targetLdscId(row) {
    return String(row.lof_id || row.file_id || '').trim();
}

async function loadIdMap(pool) {
    const [rows] = await pool.query(`
        SELECT
            fm.file_id,
            fm.gwas_id,
            COALESCE(fim.lof_id, fm.file_id) AS lof_id
        FROM file_metadata fm
        LEFT JOIN file_id_mapping fim ON fim.gwas_id = fm.gwas_id
        WHERE fm.gwas_id IS NOT NULL OR fm.file_id IS NOT NULL OR fim.lof_id IS NOT NULL
    `);

    const idMap = new Map();
    for (const row of rows) {
        const normalized = {
            file_id: String(row.file_id || '').trim(),
            gwas_id: String(row.gwas_id || '').trim(),
            lof_id: String(row.lof_id || '').trim(),
        };

        for (const id of [normalized.gwas_id, normalized.file_id, normalized.lof_id]) {
            if (!id) continue;
            idMap.set(id.toLowerCase(), normalized);
        }
    }
    return idMap;
}

async function main() {
    const pool = createPool();

    try {
        const idMap = await loadIdMap(pool);
        const entries = fs.readdirSync(LDSC_DIR, { withFileTypes: true }).filter((entry) => entry.isFile());

        let renameCount = 0;
        let skipped = 0;

        console.log(`# LDSC rename ${APPLY ? 'apply' : 'dry-run'}`);
        console.log(`# dir=${LDSC_DIR}`);
        console.log('# rule: <gwas_id>_k562_atac.results -> <file_id>_k562_atac.results');
        console.log('');

        for (const entry of entries) {
            const stem = getLdscStem(entry.name);
            const mapping = idMap.get(stem.toLowerCase());
            const nextStem = mapping ? targetLdscId(mapping) : '';

            if (!mapping || !nextStem || nextStem === stem) {
                skipped += 1;
                continue;
            }

            const nextName = `${nextStem}_k562_atac.results`;
            const oldPath = path.join(LDSC_DIR, entry.name);
            const newPath = path.join(LDSC_DIR, nextName);

            if (fs.existsSync(newPath)) {
                skipped += 1;
                console.warn(`# skip existing target: ${newPath}`);
                continue;
            }

            console.log(`mv ${shellQuote(oldPath)} ${shellQuote(newPath)}`);
            if (APPLY) fs.renameSync(oldPath, newPath);
            renameCount += 1;
        }

        console.log('');
        console.log(`# ${APPLY ? 'renamed' : 'rename candidates'}: ${renameCount}`);
        console.log(`# skipped: ${skipped}`);
        if (!APPLY) console.log('# rerun with --apply after reviewing the commands above');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
