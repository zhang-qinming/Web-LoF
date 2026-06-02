const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const LDSC_DIR = process.env.LDSC_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/ldsc';
const DRY_RUN = process.argv.includes('--apply') ? false : true;

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

function extractGwasId(fileName) {
    const match = String(fileName || '').match(/^(.+?)_k562_atac\.results$/i);
    return match ? match[1] : null;
}

async function main() {
    const pool = createPool();

    try {
        const [rows] = await pool.query(`
            SELECT
                fim.gwas_id,
                fim.lof_id
            FROM file_id_mapping fim
            WHERE fim.gwas_id IS NOT NULL
              AND fim.lof_id IS NOT NULL
        `);

        const mapping = new Map(rows.map((row) => [String(row.gwas_id).trim(), String(row.lof_id).trim()]));

        console.log(`# LDSC rename preview`);
        console.log(`# mode=${DRY_RUN ? 'dry-run' : 'apply'}`);
        console.log(`# dir=${LDSC_DIR}`);
        console.log(`# expected rename pattern: <gwas_id>_k562_atac.results -> <lof_id>_gwas.results`);
        console.log('');

        console.log('# Run this on the server to preview candidate files:');
        console.log(`find ${LDSC_DIR} -maxdepth 1 -type f -name '*.results' | sed -n '1,20p'`);
        console.log('');

        let previewCount = 0;
        for (const [gwasId, lofId] of mapping.entries()) {
            const oldName = `${gwasId}_k562_atac.results`;
            const newName = `${lofId}_gwas.results`;
            previewCount += 1;

            if (DRY_RUN) {
                console.log(`mv '${path.posix.join(LDSC_DIR, oldName)}' '${path.posix.join(LDSC_DIR, newName)}'`);
            } else {
                console.log(`# apply mode requested, but this preview script intentionally does not execute filesystem writes.`);
                console.log(`mv '${path.posix.join(LDSC_DIR, oldName)}' '${path.posix.join(LDSC_DIR, newName)}'`);
            }
        }

        console.log('');
        console.log(`# total mapped rename candidates: ${previewCount}`);
        console.log('# review commands above before any server-side execution');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
