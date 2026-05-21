const pool = require('./db');
const { config } = require('../lib/config');
const { buildOrderBy, buildWhereForGwas } = require('./utils');

const GWAS_ALLOWED_COLS = ['CHR', 'BP', 'rsID', 'P', 'BETA', 'SE', 'Zscore', 'EAF', 'MAF'];

/**
 * 根据 Trait + 可选筛选条件获取 GWAS 数据
 * @param {string} traitName
 * @param {Object} filters - { CHR, BP_start, BP_end, P_min, P_max, rsID }
 * @param {Object} options - { page, limit, sortBy, order }
 */
async function queryGwasData(traitName, filters = {}, { page = 1, limit, sortBy = 'CHR', order = 'ASC' } = {}) {
    const safeTraitName = String(traitName || '').trim();
    if (!safeTraitName || safeTraitName.length > 500) {
        return limit ? { data: [], totalCount: 0, page: 1, totalPages: 0 } : { data: [] };
    }

    const orderBySql = buildOrderBy(sortBy, order, GWAS_ALLOWED_COLS, 'CHR');
    const { whereSql, params } = buildWhereForGwas(safeTraitName, filters);
    const numericLimit = Number(limit);
    const isPaged = Number.isFinite(numericLimit) && numericLimit > 0;

    let query = `SELECT * FROM gwas_data ${whereSql} ${orderBySql}`;
    const queryParams = [...params];

    if (isPaged) {
        const l = Math.min(config.query.maxGwasPageLimit, Math.max(1, numericLimit));
        const p = Math.max(1, Number(page) || 1);
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

    query += ` LIMIT ?`;
    queryParams.push(config.query.maxUnpagedGwasRows);
    const [rows] = await pool.query(query, queryParams);
    return {
        data: rows,
        truncated: rows.length >= config.query.maxUnpagedGwasRows,
        limit: config.query.maxUnpagedGwasRows,
    };
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
