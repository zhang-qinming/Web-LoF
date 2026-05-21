const pool = require('./db');
const { config } = require('../lib/config');
const { buildOrderBy } = require('./utils');

async function getAllTraitsInfo({ page = 1, limit = 20, sortBy = 'Trait', order = 'ASC' } = {}) {
    const allowedSortCols = ['Trait', 'mesh_term', 'mesh_id', 'sample_size', 'n_blocks', 'n_variants'];
    const orderBySql = buildOrderBy(sortBy, order, allowedSortCols, 'Trait');

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(config.query.maxPageLimit, Number(limit) || 20));
    const offset = (p - 1) * l;

    const [rows] = await pool.query(
        `SELECT * FROM gwas_metadata ${orderBySql} LIMIT ? OFFSET ?`,
        [l, offset]
    );

    const [[{ total }]] = await pool.query(`SELECT COUNT(DISTINCT Trait) as total FROM gwas_metadata`);

    return {
        data: rows,
        totalCount: total,
        page: p,
        totalPages: Math.ceil(total / l),
    };
}

module.exports = { getAllTraitsInfo };
