require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const { config } = require('../lib/config');

const TOP_GENES_PER_PROGRAM = 10;

function hasFlag(flag) {
    return process.argv.includes(flag);
}

function groupTopGenes(rows) {
    const byProgram = new Map();
    rows.forEach((row) => {
        const program = String(row.program || '').trim();
        const gene = String(row.gene_label || '').trim();
        if (!program || !gene) return;
        if (!byProgram.has(program)) byProgram.set(program, []);
        byProgram.get(program).push(gene);
    });
    return byProgram;
}

async function fetchRepresentativeGenes(connection) {
    const [rows] = await connection.query(
        `SELECT program, gene_label
         FROM (
            SELECT
                ranked.*,
                ROW_NUMBER() OVER (
                    PARTITION BY ranked.program
                    ORDER BY
                        ranked.rank_value IS NULL ASC,
                        ranked.rank_value ASC,
                        ranked.score_abs DESC,
                        ranked.gene_label ASC
                ) AS row_num
            FROM (
                SELECT
                    pgre.program,
                    COALESCE(
                        NULLIF(gi_ensg.symbol, ''),
                        NULLIF(gi_symbol.symbol, ''),
                        NULLIF(gi_ensg.perturb_symbol, ''),
                        NULLIF(gi_symbol.perturb_symbol, ''),
                        NULLIF(pgre.gene_symbol, ''),
                        NULLIF(pgre.ensg_id, '')
                    ) AS gene_label,
                    ABS(COALESCE(pgre.score, 0)) AS score_abs,
                    pgre.rank_value
                 FROM program_gene_role_edge pgre
                 LEFT JOIN gene_info_hg37_matched gi_ensg
                    ON BINARY gi_ensg.ensembl = BINARY pgre.ensg_id
                 LEFT JOIN gene_info_hg37_matched gi_symbol
                    ON BINARY gi_symbol.perturb_symbol = BINARY pgre.gene_symbol
                 WHERE pgre.role = 'program_gene'
                    AND COALESCE(NULLIF(pgre.ensg_id, ''), NULLIF(pgre.gene_symbol, '')) IS NOT NULL
                    AND ABS(COALESCE(pgre.score, 0)) > 0
            ) ranked
         ) top_ranked
         WHERE row_num <= ?
         ORDER BY
            CAST(SUBSTRING(program, 2) AS UNSIGNED) ASC,
            row_num ASC`,
        [TOP_GENES_PER_PROGRAM],
    );
    return groupTopGenes(rows);
}

async function main() {
    const dryRun = hasFlag('--dry-run');
    const pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 1,
    });

    const connection = await pool.getConnection();
    try {
        const genesByProgram = await fetchRepresentativeGenes(connection);
        const [programRows] = await connection.query('SELECT program FROM program_info ORDER BY CAST(SUBSTRING(program, 2) AS UNSIGNED)');

        if (dryRun) {
            console.log(`Found representative genes for ${genesByProgram.size} programs.`);
            programRows.slice(0, 10).forEach((row) => {
                const genes = genesByProgram.get(row.program) || [];
                console.log(`${row.program}: ${genes.join(',')}`);
            });
            return;
        }

        await connection.beginTransaction();
        for (const row of programRows) {
            const genes = genesByProgram.get(row.program) || [];
            await connection.query(
                'UPDATE program_info SET top10_genes = ? WHERE program = ?',
                [genes.join(','), row.program],
            );
        }
        await connection.commit();

        console.log(`Updated top10_genes for ${programRows.length} programs; ${genesByProgram.size} programs have significant representative genes.`);
    } catch (err) {
        try {
            await connection.rollback();
        } catch (_) {
            // Ignore rollback errors when no transaction was opened.
        }
        throw err;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Failed to refresh program representative genes:', err.message);
    process.exit(1);
});
