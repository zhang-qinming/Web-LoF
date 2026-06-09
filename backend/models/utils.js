function quoteIdentifier(identifier) {
    return `\`${String(identifier).replace(/`/g, '``')}\``;
}

function buildOrderBy(sortBy, order, allowedCols, defaultCol) {
    const col = allowedCols.includes(sortBy) ? sortBy : defaultCol;
    const dir = ['ASC', 'DESC'].includes(String(order).toUpperCase()) ? String(order).toUpperCase() : 'ASC';
    return `ORDER BY ${quoteIdentifier(col)} ${dir}`;
}

module.exports = {
    buildOrderBy,
};
