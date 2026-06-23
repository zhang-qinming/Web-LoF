export function computeGeneLevelQQAxisRange(rows, extraValues = []) {
    let min = Infinity;
    let max = -Infinity;

    const include = (value) => {
        if (!Number.isFinite(value)) return;
        if (value < min) min = value;
        if (value > max) max = value;
    };

    rows.forEach((row) => {
        include(row.expected);
        include(row.observed);
    });
    extraValues.forEach(include);

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
    const span = Math.max(max - min, 1);
    const pad = span * 0.08;
    return [min - pad, max + pad];
}

