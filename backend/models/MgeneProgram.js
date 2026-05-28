const pool = require('./db');

const TABLE_MISSING_CODES = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);

function isMissingIndexTableError(err) {
    return TABLE_MISSING_CODES.has(err?.code);
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

function normalizeRecord(row) {
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
                programs: new Set(),
                traits: new Set(),
                programRoleRows: 0,
                regulatorRoleRows: 0,
            });
        }
        const item = map.get(key);
        if (!item.geneSymbol && row.geneSymbol) item.geneSymbol = row.geneSymbol;
        if (!item.ensgId && row.ensgId) item.ensgId = row.ensgId;
        if (row.program) item.programs.add(row.program);
        if (row.traitId) item.traits.add(row.traitId);
        if (row.role === 'program') item.programRoleRows += 1;
        if (row.role === 'regulator') item.regulatorRoleRows += 1;
    });

    return [...map.values()].map((item) => ({
        geneSymbol: item.geneSymbol || '',
        ensgId: item.ensgId || '',
        geneLabel: item.geneLabel || item.geneSymbol || item.ensgId || '',
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

async function searchGenes(query, limit = 20) {
    const q = normalizeGeneQuery(query);
    if (!q) return { query: q, totalGenes: 0, genes: [] };

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const exact = q.toUpperCase();
    const like = `%${q}%`;

    try {
        const [rows] = await pool.query(
            `SELECT
                gene_symbol, ensg_id,
                COUNT(*) AS total_rows,
                COUNT(DISTINCT program) AS total_programs,
                COUNT(DISTINCT trait_id) AS total_traits,
                SUM(role = 'program') AS program_role_rows,
                SUM(role = 'regulator') AS regulator_role_rows
             FROM gene_program_trait_edge
             WHERE UPPER(gene_symbol) = ?
                OR UPPER(ensg_id) = ?
                OR gene_symbol LIKE ?
                OR ensg_id LIKE ?
             GROUP BY gene_symbol, ensg_id
             ORDER BY
                (UPPER(gene_symbol) = ?) DESC,
                (UPPER(ensg_id) = ?) DESC,
                total_traits DESC,
                total_programs DESC,
                gene_symbol ASC
             LIMIT ?`,
            [exact, exact, like, like, exact, exact, safeLimit],
        );

        return {
            query: q,
            totalGenes: rows.length,
            genes: rows.map((row) => ({
                geneSymbol: row.gene_symbol || '',
                ensgId: row.ensg_id || '',
                geneLabel: row.gene_symbol || row.ensg_id || '',
                totalPrograms: Number(row.total_programs) || 0,
                totalTraits: Number(row.total_traits) || 0,
                totalRows: Number(row.total_rows) || 0,
                roles: {
                    program: Number(row.program_role_rows) || 0,
                    regulator: Number(row.regulator_role_rows) || 0,
                },
            })),
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) return emptyUnavailable({ query: q, totalGenes: 0, genes: [] });
        throw err;
    }
}

async function getGenePrograms(geneId) {
    const q = normalizeGeneQuery(geneId);
    if (!q) return { gene: { geneSymbol: '', ensgId: '' }, summary: buildSummary([]), records: [] };

    const exact = q.toUpperCase();
    try {
        const [rows] = await pool.query(
            `SELECT
                gpte.*,
                tpe.program_score,
                tpe.regulator_score,
                tpe.color,
                tpe.program_sig,
                tpe.regulator_sig,
                tpe.selected_by_program,
                tpe.selected_by_regulator,
                COALESCE(fm.file_id, gpte.file_id) AS joined_file_id,
                fm.gwas_id,
                fm.trait_name,
                pi.curated_annotation
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
    getGenePrograms,
    getProgramTraits,
    normalizeProgramId,
    searchGenes,
};
