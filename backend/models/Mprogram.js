const pool = require('./db');

async function getProgramInfo() {
    const [rows] = await pool.query(
        'SELECT program, curated_annotation, top10_genes, top10_pathways, ' +
        'representative_go, go_enrichment_p, top10_chip_tf, representative_tf, ' +
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
