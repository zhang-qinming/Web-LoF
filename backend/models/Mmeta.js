const pool = require('./db');
const { buildOrderBy } = require('./utils');

const ALLOWED_SORT = ['file_id', 'trait_name', 'gwas_id'];

async function getTraits({ page = 1, limit = 20, sortBy = 'trait_name', order = 'ASC' } = {}) {
    const orderBySql = buildOrderBy(sortBy, order, ALLOWED_SORT, 'trait_name');
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(1000, Number(limit) || 20));
    const offset = (p - 1) * l;

    const [rows] = await pool.query(
        `SELECT file_id, gwas_id, trait_name
         FROM file_metadata
         WHERE trait_name IS NOT NULL AND trait_name != ''
         ${orderBySql}
         LIMIT ? OFFSET ?`,
        [l, offset]
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM file_metadata
         WHERE trait_name IS NOT NULL AND trait_name != ''`
    );

    return {
        data: rows,
        totalCount: total,
        page: p,
        totalPages: Math.ceil(total / l),
    };
}

async function getTraitByName(traitName) {
    const [rows] = await pool.query(
        'SELECT file_id, gwas_id, trait_name FROM file_metadata WHERE trait_name = ? LIMIT 20',
        [traitName]
    );
    return rows;
}

async function getTraitMeta(fileId) {
    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.sample_size, gm.n_case, gm.n_control, gm.population,
                gm.first_author, gm.pmid, gm.year, gm.n_variants, gm.n_sig,
                gm.qc_score, gm.collect_date, gm.url,
                gm.mesh_term, gm.mesh_id,
                gm.source_batch AS gwas_source_batch,
                lm.lof_id
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         LEFT JOIN lof_meta lm ON lm.file_id = fm.file_id
         WHERE fm.file_id = ?
         LIMIT 1`,
        [fileId]
    );
    return rows[0] || null;
}

module.exports = { getTraits, getTraitByName, getTraitMeta };
