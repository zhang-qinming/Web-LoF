const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { config } = require('../lib/config');

let hasTraitLdscTablePromise = null;
const LDSC_ROW = 'L2_0';
const SORT_COLUMN_MAP = {
    file_id: 'fm.file_id',
    trait_name: 'fm.trait_name',
    gwas_id: 'fm.gwas_id',
    sample_size: 'gm.sample_size',
    population: 'gm.population',
    mesh_term: 'gm.mesh_term',
    year: 'gm.year',
    n_variants: 'gm.n_variants',
    n_sig: 'gm.n_sig',
    qc_score: 'gm.qc_score',
};

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeSearch(value) {
    const cleaned = String(value || '').trim();
    return cleaned ? cleaned.slice(0, 200) : '';
}

function buildMetaOrderBy(sortBy, order) {
    const column = SORT_COLUMN_MAP[sortBy] || SORT_COLUMN_MAP.trait_name;
    const direction = String(order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `ORDER BY ${column} ${direction}`;
}

function parseNumber(value) {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text || /^na$/i.test(text) || /^nan$/i.test(text)) return null;
    const num = Number(text);
    return Number.isFinite(num) ? num : null;
}

function splitLdscLine(line) {
    const trimmed = String(line || '').trim();
    return trimmed.indexOf('\t') >= 0
        ? trimmed.split('\t').map((item) => item.trim())
        : trimmed.split(/\s+/).map((item) => item.trim());
}

function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
}

function findHeaderIndex(indexByHeader, names) {
    for (const name of names) {
        const index = indexByHeader.get(normalizeKey(name));
        if (index != null) return index;
    }
    return undefined;
}

function parseLdscText(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) return null;

    const headers = splitLdscLine(lines[0]);
    const indexByHeader = new Map(headers.map((header, index) => [normalizeKey(header), index]));
    const resolvedCategoryIndex = findHeaderIndex(indexByHeader, ['category', 'annotation', 'ld_score']);
    const categoryIndex = resolvedCategoryIndex == null ? 0 : resolvedCategoryIndex;
    const enrichmentIndex = findHeaderIndex(indexByHeader, ['enrichment']);
    const enrichmentPIndex = findHeaderIndex(indexByHeader, ['enrichment_p', 'enrichment-p', 'enrichment p']);
    const zScoreIndex = findHeaderIndex(indexByHeader, ['coefficient_z-score', 'coefficient_z_score', 'coefficient z-score']);
    const rows = lines.slice(1).map(splitLdscLine);
    const values = rows.find((row) => normalizeKey(row[categoryIndex]) === normalizeKey(LDSC_ROW)) || null;

    if (!values) return null;

    return {
        enrichment: enrichmentIndex != null ? parseNumber(values[enrichmentIndex]) : null,
        enrichment_p: enrichmentPIndex != null ? parseNumber(values[enrichmentPIndex]) : null,
        coefficient_z_score: zScoreIndex != null ? parseNumber(values[zScoreIndex]) : null,
        rowName: values[categoryIndex] || LDSC_ROW,
    };
}

function safeLdscId(value) {
    const text = String(value || '').trim();
    return /^[A-Za-z0-9_.-]+$/.test(text) ? text : '';
}

async function loadLdscFromFile(meta) {
    const ids = [
        meta && meta.heritability_lof_id,
        meta && meta.ldsc_file_id,
        meta && meta.file_id,
        meta && meta.gwas_id,
    ]
        .map(safeLdscId)
        .filter(Boolean);

    for (const id of [...new Set(ids)]) {
        const sourceFile = `${id}_k562_atac.results`;
        const fullPath = path.join(config.paths.ldscDir, sourceFile);

        try {
            const text = await fs.promises.readFile(fullPath, 'utf8');
            const parsed = parseLdscText(text);
            if (!parsed) continue;
            return {
                heritability_source_row: parsed.rowName || LDSC_ROW,
                heritability_gwas_id: (meta && meta.gwas_id) || null,
                heritability_lof_id: id,
                heritability_source_file: sourceFile,
                enrichment: parsed.enrichment,
                enrichment_p: parsed.enrichment_p,
                coefficient_z_score: parsed.coefficient_z_score,
            };
        } catch (error) {
            if (error && error.code === 'ENOENT') continue;
            throw error;
        }
    }

    return null;
}

async function fillMissingLdscFromFile(meta) {
    if (!meta || (
        meta.enrichment != null
        && meta.enrichment_p != null
        && meta.coefficient_z_score != null
    )) return meta;
    const fallback = await loadLdscFromFile(meta);
    return fallback ? { ...meta, ...fallback } : meta;
}

async function hasTraitLdscTable() {
    if (!hasTraitLdscTablePromise) {
        hasTraitLdscTablePromise = pool.query(
            `SELECT 1
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'trait_ldsc'
             LIMIT 1`
        )
            .then(([rows]) => rows.length > 0)
            .catch(() => false);
    }

    return hasTraitLdscTablePromise;
}

function quoteIdentifier(identifier) {
    const allowed = new Set(['burden_phenotype_id', 'lof_id', 'trait_id', 'gwas_id']);
    if (!allowed.has(identifier)) {
        throw new Error(`Unsupported lof_meta column: ${identifier}`);
    }
    return `\`${identifier}\``;
}

async function getLofMetaColumns() {
    const [rows] = await pool.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'lof_meta'
           AND COLUMN_NAME IN ('burden_phenotype_id', 'lof_id', 'trait_id', 'gwas_id')`
    );
    const columns = new Set(rows.map((row) => row.COLUMN_NAME));

    return {
        burdenPhenotypeColumn: columns.has('burden_phenotype_id') ? 'burden_phenotype_id' : 'lof_id',
        traitColumn: columns.has('trait_id') ? 'trait_id' : 'gwas_id',
    };
}

async function getTraits({ page = 1, limit = 20, sortBy = 'trait_name', order = 'ASC', search = '' } = {}) {
    const orderBySql = buildMetaOrderBy(sortBy, order);
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(config.query.maxPageLimit, Number(limit) || 20));
    const offset = (p - 1) * l;
    const searchText = normalizeSearch(search);
    const where = ["fm.trait_name IS NOT NULL", "fm.trait_name != ''"];
    const params = [];

    if (searchText) {
        const like = `%${escapeLike(searchText)}%`;
        where.push(`(
            fm.trait_name LIKE ? ESCAPE '\\\\'
            OR fm.file_id LIKE ? ESCAPE '\\\\'
            OR fm.gwas_id LIKE ? ESCAPE '\\\\'
            OR gm.mesh_term LIKE ? ESCAPE '\\\\'
            OR gm.population LIKE ? ESCAPE '\\\\'
        )`);
        params.push(like, like, like, like, like);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.sample_size, gm.n_case, gm.n_control, gm.population,
                gm.first_author, gm.pmid, gm.year, gm.n_variants, gm.n_sig,
                gm.qc_score, gm.mesh_term, gm.source_batch AS gwas_source_batch
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         ${whereSql}
         ${orderBySql}
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
    );

    const countSql = searchText
        ? `SELECT COUNT(*) AS total
           FROM file_metadata fm
           LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
           ${whereSql}`
        : `SELECT COUNT(*) AS total
           FROM file_metadata fm
           ${whereSql}`;

    const [[{ total }]] = await pool.query(countSql, params);

    return {
        data: rows,
        totalCount: total,
        page: p,
        totalPages: Math.ceil(total / l),
    };
}

async function getTraitByName(traitName) {
    const safeTraitName = String(traitName || '').trim();
    if (!safeTraitName || safeTraitName.length > 500) return [];

    const [rows] = await pool.query(
        'SELECT file_id, gwas_id, trait_name FROM file_metadata WHERE trait_name = ? LIMIT 20',
        [safeTraitName]
    );
    return rows;
}

async function getTraitMeta(fileId) {
    const safeFileId = String(fileId || '').trim();
    if (!safeFileId || safeFileId.length > 255) return null;

    const includeHeritability = await hasTraitLdscTable();
    const lofMetaColumns = await getLofMetaColumns();
    const burdenPhenotypeExpr = `lm.${quoteIdentifier(lofMetaColumns.burdenPhenotypeColumn)}`;
    const burdenTraitExpr = `lm.${quoteIdentifier(lofMetaColumns.traitColumn)}`;
    const heritabilitySelect = includeHeritability ? `,
                CASE WHEN tl.gwas_id IS NOT NULL THEN 'L2_0' ELSE NULL END AS heritability_source_row,
                tl.gwas_id AS heritability_gwas_id,
                tl.lof_id AS heritability_trait_id,
                tl.lof_id AS heritability_lof_id,
                tl.source_file AS heritability_source_file,
                tl.enrichment, tl.enrichment_p, tl.coefficient_z_score` : '';
    const heritabilityJoin = includeHeritability
        ? `\n         LEFT JOIN trait_ldsc tl
             ON tl.file_id COLLATE utf8mb4_unicode_ci = fm.file_id COLLATE utf8mb4_unicode_ci
             OR tl.gwas_id COLLATE utf8mb4_unicode_ci = fm.gwas_id COLLATE utf8mb4_unicode_ci
             OR tl.lof_id COLLATE utf8mb4_unicode_ci = ${burdenTraitExpr} COLLATE utf8mb4_unicode_ci`
        : '';

    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.sample_size, gm.n_case, gm.n_control, gm.population,
                gm.first_author, gm.pmid, gm.year, gm.n_variants, gm.n_sig,
                gm.qc_score, gm.collect_date, gm.url,
                gm.mesh_term, gm.mesh_id,
                gm.source_batch AS gwas_source_batch,
                fim.lof_id AS ldsc_file_id,
                ${burdenTraitExpr} AS burden_trait_id,
                ${burdenPhenotypeExpr} AS burden_phenotype_id${heritabilitySelect}
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         LEFT JOIN lof_meta lm ON lm.file_id = fm.file_id
         LEFT JOIN file_id_mapping fim ON fim.gwas_id = fm.gwas_id
         ${heritabilityJoin}
         WHERE fm.file_id = ? OR fm.gwas_id = ?
         LIMIT 1`,
        [safeFileId, safeFileId]
    );
    return fillMissingLdscFromFile(rows[0] || null);
}

async function getTraitCount() {
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM file_metadata
         WHERE trait_name IS NOT NULL AND trait_name != ''`
    );
    return Number(total) || 0;
}

async function getHomeSummary() {
    const [[row]] = await pool.query(
        `SELECT
                COUNT(DISTINCT CASE
                    WHEN fm.trait_name IS NOT NULL AND fm.trait_name != '' THEN fm.file_id
                END) AS traits,
                COALESCE(SUM(CASE WHEN gm.n_variants IS NULL THEN 0 ELSE gm.n_variants END), 0) AS variants,
                COALESCE(SUM(CASE WHEN gm.n_sig IS NULL THEN 0 ELSE gm.n_sig END), 0) AS significantLoci,
                MIN(gm.year) AS minYear,
                MAX(gm.year) AS maxYear,
                MAX(NULLIF(gm.collect_date, '')) AS latestCollectDate,
                COUNT(DISTINCT NULLIF(gm.source_batch, '')) AS sourceBatches,
                COUNT(DISTINCT NULLIF(gm.population, '')) AS populations
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id`
    );

    const [[geneRow]] = await pool.query(`SELECT COUNT(*) AS genes FROM gene_info_hg37_matched`);
    const [[associationRow]] = await pool.query(`SELECT COUNT(*) AS associations FROM gene_program_trait_edge`);

    return {
        traits: Number(row && row.traits) || 0,
        variants: Number(row && row.variants) || 0,
        genes: Number(geneRow && geneRow.genes) || 0,
        associations: Number(associationRow && associationRow.associations) || 0,
        significantLoci: Number(row && row.significantLoci) || 0,
        minYear: row && row.minYear ? Number(row.minYear) : null,
        maxYear: row && row.maxYear ? Number(row.maxYear) : null,
        latestCollectDate: row && row.latestCollectDate ? row.latestCollectDate : null,
        sourceBatches: Number(row && row.sourceBatches) || 0,
        populations: Number(row && row.populations) || 0,
    };
}

module.exports = { getTraits, getTraitByName, getTraitMeta, getTraitCount, getHomeSummary };
