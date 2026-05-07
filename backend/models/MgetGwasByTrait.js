const pool = require('./db');
const { buildOrderBy, buildWhereForGwas } = require('./utils');

const GWAS_ALLOWED_COLS = ['CHR', 'BP', 'rsID', 'P', 'BETA', 'SE', 'Zscore', 'EAF', 'MAF'];

/**
 * 根据 Trait + 可选筛选条件获取 GWAS 数据
 * @param {string} traitName
 * @param {Object} filters - { CHR, BP_start, BP_end, P_min, P_max, rsID }
 * @param {Object} options - { page, limit, sortBy, order }
 */
async function queryGwasData(traitName, filters = {}, { page = 1, limit, sortBy = 'CHR', order = 'ASC' } = {}) {
    const orderBySql = buildOrderBy(sortBy, order, GWAS_ALLOWED_COLS, 'CHR');
    const { whereSql, params } = buildWhereForGwas(traitName, filters);
    const isPaged = limit && limit > 0;

    let query = `SELECT * FROM gwas_data ${whereSql} ${orderBySql}`;
    const queryParams = [...params];

    if (isPaged) {
        const l = Math.min(5000, Math.max(1, Number(limit)));
        const p = Math.max(1, Number(page));
        const offset = (p - 1) * l;
        query += ` LIMIT ? OFFSET ?`;
        queryParams.push(l, offset);

        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total FROM gwas_data ${whereSql}`,
            params
        );
        const [rows] = await pool.query(query, queryParams);

        return { data: rows, totalCount: total, page: p, totalPages: Math.ceil(total / l) };
    }

    const [rows] = await pool.query(query, queryParams);
    return { data: rows };
}

// 按 Trait 获取全部 GWAS 数据（不分页）
function getGwasDataByTrait(traitName, options = {}) {
    return queryGwasData(traitName, {}, options);
}

// 按 Trait + 筛选条件获取 GWAS 数据
function getFilteredGwasDataByTrait(traitName, filters = {}, options = {}) {
    return queryGwasData(traitName, filters, options);
}

module.exports = { getGwasDataByTrait, getFilteredGwasDataByTrait };
