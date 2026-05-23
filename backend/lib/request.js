const { config } = require('./config');

function parsePositiveInt(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function parsePageOptions(query = {}, {
    defaultLimit = config.query.defaultPageLimit,
    maxLimit = config.query.maxPageLimit,
    defaultSortBy,
} = {}) {
    return {
        page: parsePositiveInt(query.page, 1, Number.MAX_SAFE_INTEGER),
        limit: parsePositiveInt(query.limit, defaultLimit, maxLimit),
        sortBy: query.sortBy || defaultSortBy,
        order: String(query.order || '').toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    };
}

function normalizeIdentifier(value, maxLength = 255) {
    const cleaned = String(value || '').trim();
    if (!cleaned || cleaned.length > maxLength) return null;
    return cleaned;
}

function normalizeSafeBaseName(value, maxLength = 255) {
    const cleaned = normalizeIdentifier(value, maxLength);
    return cleaned && /^[A-Za-z0-9._-]+$/.test(cleaned) ? cleaned : null;
}

function normalizeSafeBaseNameList(value, maxLength = 255) {
    const values = Array.isArray(value) ? value : [value];
    const names = [];

    for (const item of values) {
        String(item || '')
            .split(',')
            .map((part) => normalizeSafeBaseName(part, maxLength))
            .filter(Boolean)
            .forEach((name) => {
                if (!names.includes(name)) names.push(name);
            });
    }

    return names;
}

module.exports = {
    normalizeIdentifier,
    normalizeSafeBaseName,
    normalizeSafeBaseNameList,
    parsePageOptions,
    parsePositiveInt,
};
