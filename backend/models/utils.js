/**
 * 排序子句构建器（白名单校验）
 */
function buildOrderBy(sortBy, order, allowedCols, defaultCol) {
    const col = allowedCols.includes(sortBy) ? sortBy : defaultCol;
    const dir = ['ASC', 'DESC'].includes(String(order).toUpperCase()) ? String(order).toUpperCase() : 'ASC';
    return `ORDER BY ${col} ${dir}`;
}

/**
 * GWAS 数据 WHERE 子句构建器
 */
function buildWhereForGwas(traitName, filters = {}) {
    const where = ['Trait = ?'];
    const params = [traitName];

    if (filters.CHR != null && filters.CHR !== '') {
        let chrs = filters.CHR;
        if (typeof chrs === 'string') {
            chrs = chrs.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (!Array.isArray(chrs)) chrs = [chrs];
        if (chrs.length > 0) {
            where.push(`CHR IN (${chrs.map(() => '?').join(',')})`);
            params.push(...chrs);
        }
    }

    if (filters.BP_start != null) {
        const val = Number(filters.BP_start);
        if (Number.isFinite(val)) { where.push('BP >= ?'); params.push(val); }
    }
    if (filters.BP_end != null) {
        const val = Number(filters.BP_end);
        if (Number.isFinite(val)) { where.push('BP <= ?'); params.push(val); }
    }
    if (filters.P_max != null) {
        const val = Number(filters.P_max);
        if (Number.isFinite(val)) { where.push('P < ?'); params.push(val); }
    }
    if (filters.P_min != null) {
        const val = Number(filters.P_min);
        if (Number.isFinite(val)) { where.push('P > ?'); params.push(val); }
    }
    if (filters.rsID) {
        where.push('rsID = ?');
        params.push(filters.rsID);
    }

    return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

module.exports = { buildOrderBy, buildWhereForGwas };
