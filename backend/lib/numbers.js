const MISSING_NUMBER_PATTERN = /^(?:na|nan|n\/a|null|\.)$/i;

function parseNullableNumber(value, fallback = null) {
    if (value == null) return fallback;

    const normalized = typeof value === 'string' ? value.trim() : value;
    if (
        normalized === ''
        || (typeof normalized === 'string' && MISSING_NUMBER_PATTERN.test(normalized))
    ) {
        return fallback;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
    parseNullableNumber,
};
