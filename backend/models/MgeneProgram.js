const pool = require('./db');

const TABLE_MISSING_CODES = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);
const GENE_INFO_TABLE = 'gene_info_hg37_matched';
let geneInfoTableAvailablePromise = null;

function isMissingIndexTableError(err) {
    return TABLE_MISSING_CODES.has(err?.code);
}

async function hasGeneInfoTable() {
    if (!geneInfoTableAvailablePromise) {
        geneInfoTableAvailablePromise = pool.query(
            `SELECT 1
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
             LIMIT 1`,
            [GENE_INFO_TABLE],
        )
            .then(([rows]) => rows.length > 0)
            .catch((err) => {
                geneInfoTableAvailablePromise = null;
                throw err;
            });
    }
    return geneInfoTableAvailablePromise;
}

function normalizeGeneQuery(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0, 120) : '';
}

function normalizeProgramId(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/^P?(\d+)$/i);
    return match ? `P${Number(match[1])}` : text.slice(0, 100);
}

function emptyUnavailable(payload = {}) {
    return {
        unavailable: true,
        reason: 'Gene/program SQL index is not available. Run schema migration and import_gene_program_trait_index.js first.',
        ...payload,
    };
}

function boolValue(value) {
    return Boolean(Number(value));
}

function toNullableNumber(value) {
    return value == null ? null : Number(value);
}

function formatLocation(chromosome, beginPos, endPos) {
    const chr = String(chromosome || '').trim();
    const begin = Number.isFinite(beginPos) ? Math.trunc(beginPos) : null;
    const end = Number.isFinite(endPos) ? Math.trunc(endPos) : null;

    if (!chr) return '';
    if (begin == null || end == null) return chr;
    return `${chr}:${begin}-${end}`;
}

function normalizeGeneSummary(row) {
    const beginPos = toNullableNumber(row.begin_pos);
    const endPos = toNullableNumber(row.end_pos);
    return {
        geneSymbol: row.gene_symbol || '',
        ensgId: row.ensg_id || '',
        geneLabel: row.gene_symbol || row.ensg_id || '',
        totalPrograms: Number(row.total_programs) || 0,
        totalTraits: Number(row.total_traits) || 0,
        totalRows: Number(row.total_rows) || 0,
        chromosome: row.chromosome || '',
        beginPos,
        endPos,
        location: formatLocation(row.chromosome, beginPos, endPos),
        geneType: row.gene_type || '',
        roles: {
            program: Number(row.program_role_rows) || 0,
            regulator: Number(row.regulator_role_rows) || 0,
        },
    };
}

function normalizeGeneListSortBy(value) {
    const sortBy = String(value || '').trim();
    return [
        'geneSymbol',
        'ensgId',
        'location',
        'geneType',
        'totalPrograms',
        'totalTraits',
    ].includes(sortBy) ? sortBy : 'totalTraits';
}

function normalizeSortDirection(value, fallback = 'DESC') {
    const direction = String(value || fallback).toUpperCase();
    return direction === 'ASC' ? 'ASC' : 'DESC';
}

function buildGeneListOrderBy(sortBy, order, includeGeneInfo) {
    const key = normalizeGeneListSortBy(sortBy);
    const direction = normalizeSortDirection(order);
    const tieBreakers = [
        "COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, ''), '') ASC",
        'gpte.ensg_id ASC',
    ];

    if (key === 'geneSymbol') {
        return `ORDER BY COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, ''), '') ${direction}, ${tieBreakers.join(', ')}`;
    }

    if (key === 'ensgId') {
        return `ORDER BY COALESCE(NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_symbol, ''), '') ${direction}, ${tieBreakers.join(', ')}`;
    }

    if (key === 'geneType') {
        if (!includeGeneInfo) return `ORDER BY ${tieBreakers.join(', ')}`;
        return `ORDER BY COALESCE(MAX(gi.gene_type), '') ${direction}, ${tieBreakers.join(', ')}`;
    }

    if (key === 'location') {
        if (!includeGeneInfo) return `ORDER BY ${tieBreakers.join(', ')}`;
        const chrExpr = "UPPER(REPLACE(REPLACE(COALESCE(MAX(gi.chromosome), ''), 'chr', ''), 'CHR', ''))";
        return `ORDER BY
            (${chrExpr} = '') ASC,
            CASE
                WHEN ${chrExpr} REGEXP '^[0-9]+$' THEN 0
                WHEN ${chrExpr} IN ('X', 'Y', 'M', 'MT') THEN 1
                ELSE 2
            END ${direction},
            CASE
                WHEN ${chrExpr} REGEXP '^[0-9]+$' THEN CAST(${chrExpr} AS UNSIGNED)
                WHEN ${chrExpr} = 'X' THEN 23
                WHEN ${chrExpr} = 'Y' THEN 24
                WHEN ${chrExpr} IN ('M', 'MT') THEN 25
                ELSE 999
            END ${direction},
            COALESCE(MAX(gi.begin_pos), 9223372036854775807) ${direction},
            COALESCE(MAX(gi.end_pos), 9223372036854775807) ${direction},
            ${tieBreakers.join(', ')}`;
    }

    if (key === 'totalPrograms') {
        return `ORDER BY total_programs ${direction}, total_traits DESC, ${tieBreakers.join(', ')}`;
    }

    return `ORDER BY total_traits ${direction}, total_programs DESC, total_rows DESC, ${tieBreakers.join(', ')}`;
}

function normalizeRecord(row) {
    const beginPos = toNullableNumber(row.begin_pos);
    const endPos = toNullableNumber(row.end_pos);
    return {
        traitId: row.trait_id,
        traitName: row.trait_name || row.trait_id,
        fileId: row.file_id,
        gwasId: row.gwas_id || '',
        program: row.program,
        programAnnotation: row.program_annotation || row.curated_annotation || '',
        programLabel: row.program_label || row.program,
        role: row.role,
        side: row.side || '',
        ensgId: row.ensg_id || '',
        geneSymbol: row.gene_symbol || '',
        geneLabel: row.gene_label || row.gene_symbol || row.ensg_id || '',
        chromosome: row.chromosome || '',
        beginPos,
        endPos,
        location: formatLocation(row.chromosome, beginPos, endPos),
        geneType: row.gene_type || '',
        geneName: row.gene_name || '',
        geneId: row.gene_id || '',
        hgnc: row.hgnc || '',
        synonyms: row.synonyms || '',
        description: row.description || '',
        postMean: row.post_mean == null ? null : Number(row.post_mean),
        absGamma: row.abs_gamma == null ? null : Number(row.abs_gamma),
        membershipScore: row.membership_score == null ? null : Number(row.membership_score),
        rankWithinSide: row.rank_within_side == null ? null : Number(row.rank_within_side),
        gammaSign: row.gamma_sign || '',
        predictedSign: row.predicted_sign || '',
        postMeanSign: row.post_mean_sign || '',
        programTraitSign: row.program_trait_sign || '',
        regulatorProgramSign: row.regulator_program_sign || '',
        isConcordant: boolValue(row.is_concordant),
        isDiscordant: boolValue(row.is_discordant),
        displayBucket: row.display_bucket || '',
        displayBucketLabel: row.display_bucket_label || '',
        hasOverlap: row.has_overlap == null ? true : boolValue(row.has_overlap),
        programScore: row.program_score == null ? null : Number(row.program_score),
        regulatorScore: row.regulator_score == null ? null : Number(row.regulator_score),
        color: row.color || 'other',
        programSig: boolValue(row.program_sig),
        regulatorSig: boolValue(row.regulator_sig),
        selectedByProgram: boolValue(row.selected_by_program),
        selectedByRegulator: boolValue(row.selected_by_regulator),
        loadingGeneCount: Number(row.loading_gene_count) || 0,
        regulatorGeneCount: Number(row.regulator_gene_count) || 0,
        loadingVisibleCount: Number(row.loading_visible_count) || 0,
        regulatorVisibleCount: Number(row.regulator_visible_count) || 0,
        representativeGo: row.representative_go || '',
        goEnrichmentP: row.go_enrichment_p || '',
        top10Pathways: row.top10_pathways || '',
    };
}

function buildSummary(records) {
    const programs = new Set();
    const traits = new Set();
    let programRoleRows = 0;
    let regulatorRoleRows = 0;
    let concordantRows = 0;
    let discordantRows = 0;

    records.forEach((row) => {
        if (row.program) programs.add(row.program);
        if (row.traitId) traits.add(row.traitId);
        if (row.role === 'program') programRoleRows += 1;
        if (row.role === 'regulator') regulatorRoleRows += 1;
        if (row.isConcordant) concordantRows += 1;
        if (row.isDiscordant) discordantRows += 1;
    });

    return {
        totalRows: records.length,
        totalPrograms: programs.size,
        totalTraits: traits.size,
        programRoleRows,
        regulatorRoleRows,
        concordantRows,
        discordantRows,
    };
}

function buildGeneGroups(records) {
    const map = new Map();
    records.forEach((row) => {
        const key = row.ensgId || row.geneSymbol || row.geneLabel;
        if (!key) return;
        if (!map.has(key)) {
            map.set(key, {
                geneSymbol: row.geneSymbol,
                ensgId: row.ensgId,
                geneLabel: row.geneLabel,
                chromosome: row.chromosome,
                beginPos: row.beginPos,
                endPos: row.endPos,
                location: row.location,
                geneType: row.geneType,
                programs: new Set(),
                traits: new Set(),
                programRoleRows: 0,
                regulatorRoleRows: 0,
            });
        }
        const item = map.get(key);
        if (!item.geneSymbol && row.geneSymbol) item.geneSymbol = row.geneSymbol;
        if (!item.ensgId && row.ensgId) item.ensgId = row.ensgId;
        if (!item.chromosome && row.chromosome) item.chromosome = row.chromosome;
        if (item.beginPos == null && row.beginPos != null) item.beginPos = row.beginPos;
        if (item.endPos == null && row.endPos != null) item.endPos = row.endPos;
        if (!item.location && row.location) item.location = row.location;
        if (!item.geneType && row.geneType) item.geneType = row.geneType;
        if (row.program) item.programs.add(row.program);
        if (row.traitId) item.traits.add(row.traitId);
        if (row.role === 'program') item.programRoleRows += 1;
        if (row.role === 'regulator') item.regulatorRoleRows += 1;
    });

    return [...map.values()].map((item) => ({
        geneSymbol: item.geneSymbol || '',
        ensgId: item.ensgId || '',
        geneLabel: item.geneLabel || item.geneSymbol || item.ensgId || '',
        chromosome: item.chromosome || '',
        beginPos: item.beginPos == null ? null : item.beginPos,
        endPos: item.endPos == null ? null : item.endPos,
        location: item.location || formatLocation(item.chromosome, item.beginPos, item.endPos),
        geneType: item.geneType || '',
        totalPrograms: item.programs.size,
        totalTraits: item.traits.size,
        roles: {
            program: item.programRoleRows,
            regulator: item.regulatorRoleRows,
        },
    })).sort((a, b) => (
        b.totalTraits - a.totalTraits
        || b.totalPrograms - a.totalPrograms
        || String(a.geneSymbol || a.ensgId).localeCompare(String(b.geneSymbol || b.ensgId))
    ));
}

async function getGenes({ page = 1, limit = 25, sortBy = 'totalTraits', order = 'DESC' } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const requestedLimit = Number(limit);
    const exportAll = requestedLimit === 0;
    const l = exportAll ? 0 : Math.max(1, Math.min(200, requestedLimit || 25));
    const offset = (p - 1) * l;
    const includeGeneInfo = await hasGeneInfoTable();
    const orderBySql = buildGeneListOrderBy(sortBy, order, includeGeneInfo);
    const geneInfoSelect = includeGeneInfo ? `
                MAX(gi.chromosome) AS chromosome,
                MAX(gi.begin_pos) AS begin_pos,
                MAX(gi.end_pos) AS end_pos,
                MAX(gi.gene_type) AS gene_type,` : `
                '' AS chromosome,
                NULL AS begin_pos,
                NULL AS end_pos,
                '' AS gene_type,`;
    const geneInfoJoin = includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : '';
    const whereSql = "WHERE COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, '')) IS NOT NULL";

    try {
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM (
                SELECT 1
                FROM gene_program_trait_edge gpte
                ${whereSql}
                GROUP BY gpte.gene_symbol, gpte.ensg_id
             ) gene_groups`,
        );

        const params = exportAll ? [] : [l, offset];
        const [rows] = await pool.query(
            `SELECT
                gpte.gene_symbol,
                gpte.ensg_id,
                ${geneInfoSelect}
                COUNT(*) AS total_rows,
                COUNT(DISTINCT gpte.program) AS total_programs,
                COUNT(DISTINCT gpte.trait_id) AS total_traits,
                SUM(gpte.role = 'program') AS program_role_rows,
                SUM(gpte.role = 'regulator') AS regulator_role_rows
             FROM gene_program_trait_edge gpte
             ${geneInfoJoin}
             ${whereSql}
             GROUP BY gpte.gene_symbol, gpte.ensg_id
             ${orderBySql}
             ${exportAll ? '' : 'LIMIT ? OFFSET ?'}`,
            params,
        );

        const genes = rows.map((row) => normalizeGeneSummary(row));
        return {
            genes,
            data: genes,
            totalCount: Number(total) || 0,
            page: p,
            limit: exportAll ? genes.length : l,
            totalPages: exportAll ? 1 : Math.ceil((Number(total) || 0) / l),
            sortBy: normalizeGeneListSortBy(sortBy),
            order: normalizeSortDirection(order),
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                genes: [],
                data: [],
                totalCount: 0,
                page: p,
                limit: exportAll ? 0 : l,
                totalPages: 0,
            });
        }
        throw err;
    }
}

async function searchGenes(query, limit = 20) {
    const q = normalizeGeneQuery(query);
    if (!q) return { query: q, totalGenes: 0, genes: [] };

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const exact = q.toUpperCase();
    const like = `%${q}%`;
    const includeGeneInfo = await hasGeneInfoTable();

    try {
        const [rows] = await pool.query(
            `SELECT
                gpte.gene_symbol,
                gpte.ensg_id,
                ${includeGeneInfo ? `
                MAX(gi.chromosome) AS chromosome,
                MAX(gi.begin_pos) AS begin_pos,
                MAX(gi.end_pos) AS end_pos,
                MAX(gi.gene_type) AS gene_type,` : ''}
                COUNT(*) AS total_rows,
                COUNT(DISTINCT program) AS total_programs,
                COUNT(DISTINCT trait_id) AS total_traits,
                SUM(role = 'program') AS program_role_rows,
                SUM(role = 'regulator') AS regulator_role_rows
             FROM gene_program_trait_edge gpte
             ${includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : ''}
             WHERE UPPER(gpte.gene_symbol) = ?
                OR UPPER(gpte.ensg_id) = ?
                OR gpte.gene_symbol LIKE ?
                OR gpte.ensg_id LIKE ?
             GROUP BY gene_symbol, ensg_id
             ORDER BY
                (UPPER(gpte.gene_symbol) = ?) DESC,
                (UPPER(gpte.ensg_id) = ?) DESC,
                total_traits DESC,
                total_programs DESC,
                gpte.gene_symbol ASC
             LIMIT ?`,
            [exact, exact, like, like, exact, exact, safeLimit],
        );

        return {
            query: q,
            totalGenes: rows.length,
            genes: rows.map((row) => normalizeGeneSummary(row)),
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) return emptyUnavailable({ query: q, totalGenes: 0, genes: [] });
        throw err;
    }
}

async function getRecommendedGenes(limit = 12) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));
    const includeGeneInfo = await hasGeneInfoTable();

    try {
        const [rows] = await pool.query(
            `SELECT
                gpte.gene_symbol,
                gpte.ensg_id,
                ${includeGeneInfo ? `
                MAX(gi.chromosome) AS chromosome,
                MAX(gi.begin_pos) AS begin_pos,
                MAX(gi.end_pos) AS end_pos,
                MAX(gi.gene_type) AS gene_type,` : ''}
                COUNT(*) AS total_rows,
                COUNT(DISTINCT program) AS total_programs,
                COUNT(DISTINCT trait_id) AS total_traits,
                SUM(role = 'program') AS program_role_rows,
                SUM(role = 'regulator') AS regulator_role_rows
             FROM gene_program_trait_edge gpte
             ${includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : ''}
             WHERE COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, '')) IS NOT NULL
             GROUP BY gpte.gene_symbol, gpte.ensg_id
             ORDER BY
                total_traits DESC,
                total_programs DESC,
                total_rows DESC,
                gpte.gene_symbol ASC
             LIMIT ?`,
            [safeLimit],
        );

        return {
            genes: rows.map((row) => normalizeGeneSummary(row)),
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) return emptyUnavailable({ genes: [] });
        throw err;
    }
}

async function getGenePrograms(geneId) {
    const q = normalizeGeneQuery(geneId);
    if (!q) return { gene: { geneSymbol: '', ensgId: '' }, summary: buildSummary([]), records: [] };

    const exact = q.toUpperCase();
    const includeGeneInfo = await hasGeneInfoTable();
    try {
        const [rows] = await pool.query(
            `SELECT
                gpte.*,
                ${includeGeneInfo ? `
                gi.chromosome,
                gi.begin_pos,
                gi.end_pos,
                gi.gene_type,
                gi.gene_name,
                gi.gene_id,
                gi.hgnc,
                gi.synonyms,
                gi.description,` : ''}
                tpe.program_score,
                tpe.regulator_score,
                tpe.color,
                tpe.program_sig,
                tpe.regulator_sig,
                tpe.selected_by_program,
                tpe.selected_by_regulator,
                tpe.loading_gene_count,
                tpe.regulator_gene_count,
                tpe.loading_visible_count,
                tpe.regulator_visible_count,
                COALESCE(fm.file_id, gpte.file_id) AS joined_file_id,
                fm.gwas_id,
                fm.trait_name,
                pi.curated_annotation,
                pi.representative_go,
                pi.go_enrichment_p,
                pi.top10_pathways
             FROM gene_program_trait_edge gpte
             LEFT JOIN trait_program_edge tpe
                ON BINARY tpe.trait_id = BINARY gpte.trait_id
                    AND BINARY tpe.program = BINARY gpte.program
             LEFT JOIN file_metadata fm
                ON fm.id = (
                    SELECT fm2.id
                    FROM file_metadata fm2
                    WHERE BINARY fm2.file_id = BINARY gpte.trait_id
                        OR BINARY fm2.gwas_id = BINARY gpte.trait_id
                        OR BINARY fm2.file_id = BINARY gpte.file_id
                    ORDER BY
                        (BINARY fm2.file_id = BINARY gpte.trait_id) DESC,
                        (BINARY fm2.gwas_id = BINARY gpte.trait_id) DESC,
                        (BINARY fm2.file_id = BINARY gpte.file_id) DESC,
                        fm2.id ASC
                    LIMIT 1
                )
             LEFT JOIN program_info pi
                ON BINARY pi.program = BINARY gpte.program
             ${includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : ''}
             WHERE UPPER(gpte.gene_symbol) = ? OR UPPER(gpte.ensg_id) = ?
             ORDER BY
                ABS(COALESCE(gpte.abs_gamma, 0)) DESC,
                ABS(COALESCE(gpte.membership_score, 0)) DESC,
                gpte.program ASC,
                gpte.trait_id ASC`,
            [exact, exact],
        );

        const records = rows.map((row) => normalizeRecord({
            ...row,
            file_id: row.joined_file_id || row.file_id,
        }));
        const first = records[0] || {};
        return {
            gene: {
                geneSymbol: first.geneSymbol || q,
                ensgId: first.ensgId || '',
                chromosome: first.chromosome || '',
                beginPos: first.beginPos == null ? null : first.beginPos,
                endPos: first.endPos == null ? null : first.endPos,
                location: first.location || '',
                geneType: first.geneType || '',
                geneName: first.geneName || '',
                geneId: first.geneId || '',
                hgnc: first.hgnc || '',
                synonyms: first.synonyms || '',
                description: first.description || '',
            },
            summary: buildSummary(records),
            genes: buildGeneGroups(records),
            records,
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                gene: { geneSymbol: q, ensgId: '' },
                summary: buildSummary([]),
                genes: [],
                records: [],
            });
        }
        throw err;
    }
}

async function getProgramTraits(programId) {
    const program = normalizeProgramId(programId);
    if (!program) {
        return {
            program: { id: '', annotation: '' },
            summary: { totalTraits: 0, selectedByProgram: 0, selectedByRegulator: 0, bothSelected: 0, totalGenes: 0 },
            traits: [],
        };
    }

    try {
        const [rows] = await pool.query(
            `SELECT
                tpe.*,
                fm.gwas_id,
                fm.trait_name,
                pi.curated_annotation
             FROM trait_program_edge tpe
             LEFT JOIN file_metadata fm
                ON fm.id = (
                    SELECT fm2.id
                    FROM file_metadata fm2
                    WHERE BINARY fm2.file_id = BINARY tpe.trait_id
                        OR BINARY fm2.gwas_id = BINARY tpe.trait_id
                        OR BINARY fm2.file_id = BINARY tpe.file_id
                    ORDER BY
                        (BINARY fm2.file_id = BINARY tpe.trait_id) DESC,
                        (BINARY fm2.gwas_id = BINARY tpe.trait_id) DESC,
                        (BINARY fm2.file_id = BINARY tpe.file_id) DESC,
                        fm2.id ASC
                    LIMIT 1
                )
             LEFT JOIN program_info pi
                ON BINARY pi.program = BINARY tpe.program
             WHERE tpe.program = ?
             ORDER BY
                (tpe.selected_by_program OR tpe.selected_by_regulator) DESC,
                ABS(COALESCE(tpe.program_score, 0)) + ABS(COALESCE(tpe.regulator_score, 0)) DESC,
                tpe.trait_id ASC`,
            [program],
        );
        const [geneRows] = rows.length
            ? await pool.query(
                `SELECT
                    trait_id,
                    COALESCE(NULLIF(gene_symbol, ''), ensg_id) AS gene_label,
                    MAX(GREATEST(COALESCE(abs_gamma, 0), ABS(COALESCE(membership_score, 0)))) AS score
                 FROM gene_program_trait_edge
                 WHERE program = ?
                 GROUP BY trait_id, COALESCE(NULLIF(gene_symbol, ''), ensg_id)
                 ORDER BY trait_id ASC, score DESC`,
                [program],
            )
            : [[]];
        const topGenesByTrait = new Map();
        geneRows.forEach((row) => {
            if (!row.trait_id || !row.gene_label) return;
            if (!topGenesByTrait.has(row.trait_id)) topGenesByTrait.set(row.trait_id, []);
            const genes = topGenesByTrait.get(row.trait_id);
            if (genes.length < 8) genes.push(row.gene_label);
        });

        const traits = rows.map((row) => ({
            traitId: row.trait_id,
            traitName: row.trait_name || row.trait_id,
            fileId: row.file_id,
            gwasId: row.gwas_id || '',
            program: row.program,
            programAnnotation: row.program_annotation || row.curated_annotation || '',
            programLabel: row.program_label || row.program,
            programScore: row.program_score == null ? null : Number(row.program_score),
            regulatorScore: row.regulator_score == null ? null : Number(row.regulator_score),
            color: row.color || 'other',
            programSig: boolValue(row.program_sig),
            regulatorSig: boolValue(row.regulator_sig),
            selectedByProgram: boolValue(row.selected_by_program),
            selectedByRegulator: boolValue(row.selected_by_regulator),
            loadingGeneCount: Number(row.loading_gene_count) || 0,
            regulatorGeneCount: Number(row.regulator_gene_count) || 0,
            loadingVisibleCount: Number(row.loading_visible_count) || 0,
            regulatorVisibleCount: Number(row.regulator_visible_count) || 0,
            totalGenes: (Number(row.loading_visible_count) || Number(row.loading_gene_count) || 0)
                + (Number(row.regulator_visible_count) || Number(row.regulator_gene_count) || 0),
            topGenes: topGenesByTrait.get(row.trait_id) || [],
        }));

        return {
            program: {
                id: program,
                annotation: traits.find((row) => row.programAnnotation)?.programAnnotation || '',
            },
            summary: {
                totalTraits: traits.length,
                selectedByProgram: traits.filter((row) => row.selectedByProgram).length,
                selectedByRegulator: traits.filter((row) => row.selectedByRegulator).length,
                bothSelected: traits.filter((row) => row.selectedByProgram && row.selectedByRegulator).length,
                totalGenes: traits.reduce((sum, row) => sum + row.totalGenes, 0),
            },
            traits,
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                program: { id: program, annotation: '' },
                summary: { totalTraits: 0, selectedByProgram: 0, selectedByRegulator: 0, bothSelected: 0, totalGenes: 0 },
                traits: [],
            });
        }
        throw err;
    }
}

module.exports = {
    getGenes,
    getRecommendedGenes,
    getGenePrograms,
    getProgramTraits,
    normalizeProgramId,
    searchGenes,
};
