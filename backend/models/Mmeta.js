const pool = require('./db');
const { config } = require('../lib/config');

let hasTraitLdscTablePromise = null;
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
    const heritabilitySelect = includeHeritability ? `,
                tl.source_file AS heritability_source_file,
                tl.enrichment, tl.coefficient_z_score` : '';
    const heritabilityJoin = includeHeritability
        ? `\n         LEFT JOIN trait_ldsc tl
             ON tl.file_id COLLATE utf8mb4_unicode_ci = fm.file_id COLLATE utf8mb4_unicode_ci
             OR tl.gwas_id COLLATE utf8mb4_unicode_ci = fm.gwas_id COLLATE utf8mb4_unicode_ci
             OR tl.lof_id COLLATE utf8mb4_unicode_ci = lm.lof_id COLLATE utf8mb4_unicode_ci`
        : '';

    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.sample_size, gm.n_case, gm.n_control, gm.population,
                gm.first_author, gm.pmid, gm.year, gm.n_variants, gm.n_sig,
                gm.qc_score, gm.collect_date, gm.url,
                gm.mesh_term, gm.mesh_id,
                gm.source_batch AS gwas_source_batch,
                lm.lof_id${heritabilitySelect}
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         LEFT JOIN lof_meta lm ON lm.file_id = fm.file_id
         ${heritabilityJoin}
         WHERE fm.file_id = ? OR fm.gwas_id = ?
         LIMIT 1`,
        [safeFileId, safeFileId]
    );
    return rows[0] || null;
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

    return {
        traits: Number(row?.traits) || 0,
        variants: Number(row?.variants) || 0,
        significantLoci: Number(row?.significantLoci) || 0,
        minYear: row?.minYear ? Number(row.minYear) : null,
        maxYear: row?.maxYear ? Number(row.maxYear) : null,
        latestCollectDate: row?.latestCollectDate || null,
        sourceBatches: Number(row?.sourceBatches) || 0,
        populations: Number(row?.populations) || 0,
    };
}

module.exports = { getTraits, getTraitByName, getTraitMeta, getTraitCount, getHomeSummary };
