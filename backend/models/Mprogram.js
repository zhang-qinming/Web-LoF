const pool = require('./db');

let programInfoColumnsPromise = null;

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeProgramSearch(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0, 120) : '';
}

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

async function searchPrograms(query, limit = 8) {
    const q = normalizeProgramSearch(query);
    if (!q) return { query: q, totalPrograms: 0, programs: [] };

    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8));
    const columns = await getProgramInfoColumns();
    const goTermSelect = columns.has('go_term') ? 'go_term' : 'representative_go AS go_term';
    const goAccessionSelect = columns.has('go_accession') ? 'go_accession' : 'NULL AS go_accession';
    const goOntologySelect = columns.has('go_ontology') ? 'go_ontology' : 'NULL AS go_ontology';
    const like = `%${escapeLike(q)}%`;
    const normalizedProgram = /^P?\d+$/i.test(q) ? `P${Number(String(q).replace(/^P/i, ''))}` : q;
    const where = [
        "program LIKE ? ESCAPE '\\\\'",
        "curated_annotation LIKE ? ESCAPE '\\\\'",
        "top10_genes LIKE ? ESCAPE '\\\\'",
        "top10_pathways LIKE ? ESCAPE '\\\\'",
        "representative_go LIKE ? ESCAPE '\\\\'",
    ];
    const params = [like, like, like, like, like];

    if (columns.has('go_term')) {
        where.push("go_term LIKE ? ESCAPE '\\\\'");
        params.push(like);
    }
    if (columns.has('go_accession')) {
        where.push("go_accession LIKE ? ESCAPE '\\\\'");
        params.push(like);
    }
    if (columns.has('go_ontology')) {
        where.push("go_ontology LIKE ? ESCAPE '\\\\'");
        params.push(like);
    }

    const whereSql = `WHERE ${where.join(' OR ')}`;
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM program_info ${whereSql}`,
        params,
    );
    const [rows] = await pool.query(
        'SELECT program, curated_annotation, top10_genes, top10_pathways, ' +
        `representative_go, ${goTermSelect}, ${goAccessionSelect}, ${goOntologySelect}, go_enrichment_p ` +
        `FROM program_info
         ${whereSql}
         ORDER BY
            (program = ?) DESC,
            CAST(SUBSTRING(program, 2) AS UNSIGNED) ASC
         LIMIT ?`,
        [...params, normalizedProgram, safeLimit],
    );

    return {
        query: q,
        totalPrograms: Number(total) || 0,
        programs: rows.map((row) => ({
            id: row.program,
            program: row.program,
            label: row.program,
            annotation: row.curated_annotation || '',
            goTerm: row.go_term || row.representative_go || '',
            goAccession: row.go_accession || '',
            goOntology: row.go_ontology || '',
            topGenes: row.top10_genes || '',
            topPathways: row.top10_pathways || '',
            enrichmentP: row.go_enrichment_p,
        })),
    };
}

module.exports = { getProgramInfo, searchPrograms };
