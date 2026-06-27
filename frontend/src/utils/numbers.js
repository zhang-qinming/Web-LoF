const MISSING_NUMBER_PATTERN = /^(?:na|nan|n\/a|null|\.)$/i;

export function parseNullableNumber(value, fallback = null) {
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

export function normalizeScientificNotation(value) {
    return String(value).replace(/(\d(?:\.\d+)?)E([+-]?\d+)/g, '$1e$2');
}

export function formatScientificNumber(value, digits = 2, fallback = '-') {
    const number = parseNullableNumber(value, null);
    if (!Number.isFinite(number)) {
        return value == null || value === '' ? fallback : normalizeScientificNotation(value);
    }
    return number.toExponential(digits).replace('E', 'e');
}
