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
                        ranked.score DESC,
                        ranked.rank_within_side ASC,
                        ranked.total_traits DESC,
                        ranked.gene_label ASC
                ) AS row_num
            FROM (
                SELECT
                    gpte.program,
                    COALESCE(
                        NULLIF(MAX(gi.symbol), ''),
                        NULLIF(MAX(gi.perturb_symbol), ''),
                        NULLIF(MAX(gpte.gene_symbol), ''),
                        NULLIF(MAX(gpte.ensg_id), '')
                    ) AS gene_label,
                    MAX(GREATEST(
                        ABS(COALESCE(gpte.membership_score, 0)),
                        ABS(COALESCE(gpte.abs_gamma, 0)),
                        ABS(COALESCE(gpte.post_mean, 0))
                    )) AS score,
                    MIN(gpte.rank_within_side) AS rank_within_side,
                    COUNT(DISTINCT gpte.trait_id) AS total_traits
                 FROM trait_program_edge tpe
                 INNER JOIN gene_program_trait_edge gpte
                    ON gpte.program = tpe.program
                    AND gpte.trait_id = tpe.trait_id
                 INNER JOIN gene_info_hg37_matched gi
                    ON gi.ensembl = gpte.ensg_id
                 WHERE (tpe.program_sig = 1 OR tpe.selected_by_program = 1)
                    AND gpte.role = 'program'
                    AND gpte.rank_within_side IS NOT NULL
                    AND GREATEST(
                        ABS(COALESCE(gpte.membership_score, 0)),
                        ABS(COALESCE(gpte.abs_gamma, 0)),
                        ABS(COALESCE(gpte.post_mean, 0))
                    ) > 0
                    AND COALESCE(NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_symbol, '')) IS NOT NULL
                 GROUP BY
                    gpte.program,
                    COALESCE(NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_symbol, ''))
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
