const TEXT_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
});

export function isBlankValue(value) {
    return value == null || String(value).trim() === '';
}

export function toFiniteNumber(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function compareTextValues(left, right) {
    const leftBlank = isBlankValue(left);
    const rightBlank = isBlankValue(right);
    if (leftBlank && rightBlank) return 0;
    if (leftBlank) return 1;
    if (rightBlank) return -1;
    return TEXT_COLLATOR.compare(String(left), String(right));
}

export function compareNumberValues(left, right) {
    const leftNumber = toFiniteNumber(left);
    const rightNumber = toFiniteNumber(right);
    if (leftNumber == null && rightNumber == null) return 0;
    if (leftNumber == null) return 1;
    if (rightNumber == null) return -1;
    return leftNumber - rightNumber;
}

export function applySortDirection(result, direction) {
    return direction === 'desc' ? -result : result;
}

export function compareValues(left, right, type = 'text', direction = 'asc') {
    const result = type === 'number'
        ? compareNumberValues(left, right)
        : compareTextValues(left, right);
    return applySortDirection(result, direction);
}

export function nextSortDirection(currentKey, nextKey, currentDirection, defaultDirection = 'asc') {
    if (currentKey === nextKey) return currentDirection === 'asc' ? 'desc' : 'asc';
    return defaultDirection;
}
