const { config } = require('../lib/config');

function quoteIdentifier(identifier) {
    return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function buildOrderBy(sortBy, order, allowedCols, defaultCol) {
    const col = allowedCols.includes(sortBy) ? sortBy : defaultCol;
    const dir = ['ASC', 'DESC'].includes(String(order).toUpperCase()) ? String(order).toUpperCase() : 'ASC';
    return `ORDER BY ${quoteIdentifier(col)} ${dir}`;
}

function normalizeChromosomeValues(value) {
    let chrs = value;
    if (typeof chrs === 'string') {
        chrs = chrs.split(',').map((item) => item.trim()).filter(Boolean);
    }
    if (!Array.isArray(chrs)) chrs = [chrs];

    return chrs
        .map((chr) => String(chr).trim().replace(/^chr/i, '').toUpperCase())
        .filter((chr) => /^(?:[1-9]|1[0-9]|2[0-2]|X|Y|MT|M)$/.test(chr))
        .slice(0, config.query.maxChrFilterValues);
}

function addNumericFilter(where, params, column, operator, value) {
    if (value == null || value === '') return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    where.push(`${quoteIdentifier(column)} ${operator} ?`);
    params.push(parsed);
}

function buildWhereForGwas(traitName, filters = {}) {
    const where = [`${quoteIdentifier('Trait')} = ?`];
    const params = [traitName];

    if (filters.CHR != null && filters.CHR !== '') {
        const chrs = normalizeChromosomeValues(filters.CHR);
        if (chrs.length > 0) {
            where.push(`${quoteIdentifier('CHR')} IN (${chrs.map(() => '?').join(',')})`);
            params.push(...chrs);
        }
    }

    addNumericFilter(where, params, 'BP', '>=', filters.BP_start);
    addNumericFilter(where, params, 'BP', '<=', filters.BP_end);
    addNumericFilter(where, params, 'P', '<', filters.P_max);
    addNumericFilter(where, params, 'P', '>', filters.P_min);

    if (filters.rsID) {
        const rsID = String(filters.rsID).trim();
        if (rsID && rsID.length <= config.query.maxRsIdLength && /^[A-Za-z0-9:._-]+$/.test(rsID)) {
            where.push(`${quoteIdentifier('rsID')} = ?`);
            params.push(rsID);
        }
    }

    return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

module.exports = {
    buildOrderBy,
    buildWhereForGwas,
};
