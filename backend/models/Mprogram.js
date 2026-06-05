const pool = require('./db');

let programInfoColumnsPromise = null;

async function getProgramInfoColumns() {
    if (!programInfoColumnsPromise) {
        programInfoColumnsPromise = pool.query(
            `SELECT COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_info'`,
        )
            .then(([rows]) => new Set(rows.map((row) => row.COLUMN_NAME)))
            .catch((err) => {
                programInfoColumnsPromise = null;
                throw err;
            });
    }
    return programInfoColumnsPromise;
}

async function getProgramInfo() {
    const columns = await getProgramInfoColumns();
    const goTermSelect = columns.has('go_term') ? 'go_term' : 'representative_go AS go_term';
    const goAccessionSelect = columns.has('go_accession') ? 'go_accession' : 'NULL AS go_accession';
    const goOntologySelect = columns.has('go_ontology') ? 'go_ontology' : 'NULL AS go_ontology';
    const [rows] = await pool.query(
        'SELECT program, curated_annotation, top10_genes, top10_pathways, ' +
        `representative_go, ${goTermSelect}, ${goAccessionSelect}, ${goOntologySelect}, go_enrichment_p, top10_chip_tf, representative_tf, ` +
        'representative_tf_kd_z, representative_tf_p, representative_tf_class, marker_coexpression ' +
        'FROM program_info ORDER BY CAST(SUBSTRING(program, 2) AS UNSIGNED)'
    );
    const map = {};
    for (const r of rows) {
        map[r.program] = r;
    }
    return map;
}

module.exports = { getProgramInfo };
