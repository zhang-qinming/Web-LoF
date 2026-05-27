const pool = require('./db');
const { config } = require('../lib/config');
const { buildOrderBy } = require('./utils');

const ALLOWED_SORT = ['file_id', 'trait_name', 'gwas_id'];

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeSearch(value) {
    const cleaned = String(value || '').trim();
    return cleaned ? cleaned.slice(0, 200) : '';
}

async function getTraits({ page = 1, limit = 20, sortBy = 'trait_name', order = 'ASC', search = '' } = {}) {
    const orderBySql = buildOrderBy(sortBy, order, ALLOWED_SORT, 'trait_name');
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(config.query.maxPageLimit, Number(limit) || 20));
    const offset = (p - 1) * l;
    const searchText = normalizeSearch(search);
    const where = ["trait_name IS NOT NULL", "trait_name != ''"];
    const params = [];

    if (searchText) {
        const like = `%${escapeLike(searchText)}%`;
        where.push(`(
            trait_name LIKE ? ESCAPE '\\\\'
            OR file_id LIKE ? ESCAPE '\\\\'
            OR gwas_id LIKE ? ESCAPE '\\\\'
        )`);
        params.push(like, like, like);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [rows] = await pool.query(
        `SELECT file_id, gwas_id, trait_name
         FROM file_metadata
         ${whereSql}
         ${orderBySql}
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM file_metadata
         ${whereSql}`,
        params
    );

    return {
        data: rows,
        totalCount: total,
        page: p,
        totalPages: Math.ceil(total / l),
    };
}

async function getTraitByName(traitName) {
    const safeTraitName = String(traitName || '').trim();
    if (!safeTraitName || safeTraitName.length > 500) return [];

    const [rows] = await pool.query(
        'SELECT file_id, gwas_id, trait_name FROM file_metadata WHERE trait_name = ? LIMIT 20',
        [safeTraitName]
    );
    return rows;
}

async function getTraitMeta(fileId) {
    const safeFileId = String(fileId || '').trim();
    if (!safeFileId || safeFileId.length > 255) return null;

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
         WHERE fm.file_id = ? OR fm.gwas_id = ?
         LIMIT 1`,
        [safeFileId, safeFileId]
    );
    return rows[0] || null;
}

module.exports = { getTraits, getTraitByName, getTraitMeta };
