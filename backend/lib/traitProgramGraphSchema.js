const { parseNullableNumber } = require('./numbers');

const PROGRAM_COLOR_KEYS = new Set([
    'other',
    'program_enriched',
    'regulator_enriched',
    'both_enriched',
]);

function cleanText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function hasText(value) {
    return cleanText(value) !== '';
}

function toBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeProgramId(value) {
    const text = cleanText(value);
    const match = text.match(/^P?(\d+)$/i);
    return match ? `P${Number(match[1])}` : text;
}

function signLabelFromNumber(value) {
    const num = parseNullableNumber(value);
    if (num == null) return '';
    if (num > 0) return 'positive';
    if (num < 0) return 'negative';
    return 'zero';
}

function signedLogScore(effectValue, pValue) {
    const effect = parseNullableNumber(effectValue);
    const p = parseNullableNumber(pValue);
    if (effect == null || effect === 0 || p == null || p < 0) return null;
    if (p === 0) return Math.sign(effect) * -Math.log10(Number.MIN_VALUE);
    if (p > 1) return null;
    return Math.sign(effect) * -Math.log10(p);
}

function deriveColor(programSig, regulatorSig) {
    if (programSig && regulatorSig) return 'both_enriched';
    if (programSig) return 'program_enriched';
    if (regulatorSig) return 'regulator_enriched';
    return 'other';
}

function normalizeProgramRow(row, { rowIndex = null } = {}) {
    const normalized = { ...row };
    const program = normalizeProgramId(normalized.Program);
    const selectedByProgram = toBoolean(normalized.selected_by_program);
    const selectedByRegulator = toBoolean(normalized.selected_by_regulator);
    const programScore = parseNullableNumber(normalized.program_score)
        ?? signedLogScore(normalized.meanG, normalized.P);
    const regulatorScore = parseNullableNumber(normalized.regulator_score)
        ?? signedLogScore(normalized.regulator_model_coef, normalized.regulator_model_p);
    const programP = parseNullableNumber(normalized.P);
    const regulatorP = parseNullableNumber(normalized.regulator_model_p);
    const programSig = hasText(normalized.program_sig)
        ? toBoolean(normalized.program_sig)
        : (programP == null ? selectedByProgram : programP <= 0.05);
    const regulatorSig = hasText(normalized.regulator_sig)
        ? toBoolean(normalized.regulator_sig)
        : (regulatorP == null ? selectedByRegulator : regulatorP <= 0.05);
    const loadingGeneCount = parseNullableNumber(normalized.loading_gene_count) ?? 0;
    const regulatorGeneCount = parseNullableNumber(normalized.regulator_gene_count) ?? 0;
    const priorityScore = Math.max(Math.abs(programScore || 0), Math.abs(regulatorScore || 0));
    const color = cleanText(normalized.color);

    normalized.Program = program;
    normalized.program_score = programScore == null ? normalized.program_score : String(programScore);
    normalized.regulator_score = regulatorScore == null ? normalized.regulator_score : String(regulatorScore);
    normalized.program_sig = programSig ? 'TRUE' : 'FALSE';
    normalized.regulator_sig = regulatorSig ? 'TRUE' : 'FALSE';
    normalized.selected_by_program = selectedByProgram ? 'TRUE' : 'FALSE';
    normalized.selected_by_regulator = selectedByRegulator ? 'TRUE' : 'FALSE';
    normalized.color = PROGRAM_COLOR_KEYS.has(color) ? color : deriveColor(programSig, regulatorSig);
    normalized.program_trait_sign = cleanText(normalized.program_trait_sign)
        || signLabelFromNumber(normalized.meanG)
        || signLabelFromNumber(programScore);
    normalized.program_label = cleanText(
        normalized.program_label,
        program ? `${program}  L:${loadingGeneCount}  R:${regulatorGeneCount}` : '',
    );
    normalized.loading_gene_count = String(loadingGeneCount);
    normalized.regulator_gene_count = String(regulatorGeneCount);
    normalized.priority_score = cleanText(normalized.priority_score, String(priorityScore));
    normalized.priority_tier = cleanText(normalized.priority_tier, '3');
    if (!hasText(normalized.panel_row) && rowIndex != null) {
        normalized.panel_row = String(rowIndex + 1);
    }

    return normalized;
}

function buildProgramContext(programRows) {
    const byProgram = new Map();
    for (const row of programRows) {
        const program = normalizeProgramId(row.Program);
        if (program) byProgram.set(program, row);
    }
    return byProgram;
}

function regulatorProgramSignFromGene(row, programRow) {
    const explicit = cleanText(row.regulator_program_sign);
    if (explicit) return explicit;

    const predictedEffect = parseNullableNumber(row.predicted_effect);
    const regulatorCoefficient = parseNullableNumber(programRow?.regulator_model_coef);
    if (predictedEffect != null && regulatorCoefficient != null && regulatorCoefficient !== 0) {
        return signLabelFromNumber(predictedEffect / regulatorCoefficient);
    }

    return signLabelFromNumber(predictedEffect) || cleanText(row.predicted_sign);
}

function normalizeGeneRow(row, { programsById = new Map() } = {}) {
    const normalized = { ...row };
    const program = normalizeProgramId(normalized.Program);
    const programRow = programsById.get(program);
    const role = cleanText(normalized.side).toLowerCase() === 'regulator' ? 'regulator' : 'program';
    const programTraitSign = cleanText(normalized.program_trait_sign)
        || cleanText(programRow?.program_trait_sign)
        || (role === 'program' ? cleanText(normalized.predicted_sign) : '');
    const regulatorProgramSign = role === 'regulator'
        ? regulatorProgramSignFromGene(normalized, programRow)
        : cleanText(normalized.regulator_program_sign);
    let displayBucket = cleanText(normalized.display_bucket);
    let displayBucketLabel = cleanText(normalized.display_bucket_label);

    if (role === 'program') {
        displayBucket = displayBucket || 'program_genes';
        displayBucketLabel = displayBucketLabel || 'Program genes';
    } else if (!displayBucket || displayBucket === 'regulator_genes') {
        const regulatorSign = regulatorProgramSign === 'negative' ? 'negative' : 'positive';
        displayBucket = `${regulatorSign}_regulators`;
        displayBucketLabel = regulatorSign === 'negative' ? 'Negative regulators' : 'Positive regulators';
    }

    normalized.Program = program;
    normalized.program_trait_sign = programTraitSign;
    normalized.regulator_program_sign = regulatorProgramSign;
    normalized.display_bucket = displayBucket;
    normalized.display_bucket_label = displayBucketLabel;
    normalized.program_label = cleanText(normalized.program_label, cleanText(programRow?.program_label, program));
    normalized.gene_label = cleanText(normalized.gene_label, cleanText(normalized.gene));

    return normalized;
}

function normalizeGraphRows(programRows, geneRows) {
    const normalizedProgramRows = programRows.map((row, index) => normalizeProgramRow(row, { rowIndex: index }));
    const programsById = buildProgramContext(normalizedProgramRows);
    const normalizedGeneRows = geneRows.map((row) => normalizeGeneRow(row, { programsById }));
    const countsByProgram = normalizedGeneRows.reduce((map, row) => {
        const program = normalizeProgramId(row.Program);
        if (!program) return map;
        if (!map.has(program)) map.set(program, { program: 0, regulator: 0 });
        const counts = map.get(program);
        if (cleanText(row.side).toLowerCase() === 'regulator') counts.regulator += 1;
        else counts.program += 1;
        return map;
    }, new Map());

    for (const row of normalizedProgramRows) {
        const counts = countsByProgram.get(row.Program);
        if (!counts) continue;
        row.loading_gene_count = String(counts.program);
        row.regulator_gene_count = String(counts.regulator);
        row.program_label = `${row.Program}  L:${counts.program}  R:${counts.regulator}`;
    }

    return {
        programRows: normalizedProgramRows,
        geneRows: normalizedGeneRows,
        programsById,
    };
}

module.exports = {
    normalizeGeneRow,
    normalizeGraphRows,
    normalizeProgramRow,
};
