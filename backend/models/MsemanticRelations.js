const pool = require('./db');
const geneProgramModel = require('./MgeneProgram');
const { parseNullableNumber } = require('../lib/numbers');

const TABLE_MISSING_CODES = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);
const PROGRAM_GENE_ROLE_TABLE = 'program_gene_role_edge';
const PROGRAM_TRAIT_SCATTER_TABLE = 'program_trait_scatter_edge';
const GENE_INFO_TABLE = 'gene_info_hg37_matched';

function isMissingTableError(err) {
    return TABLE_MISSING_CODES.has(err?.code);
}

function emptyUnavailable(payload = {}) {
    return {
        unavailable: true,
        reason: 'Semantic relation SQL indexes are not available. Run schema migration and the new import scripts first.',
        ...payload,
    };
}

function normalizeProgramId(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/^P?(\d+)$/i);
    return match ? `P${Number(match[1])}` : text.slice(0, 100);
}

function normalizeGeneQuery(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0, 120) : '';
}

function normalizeChromosomeLabel(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.includes('_') || text.includes('.')) return text;
    if (/^chr/i.test(text)) return `chr${text.replace(/^chr/i, '')}`;
    return `chr${text}`;
}

function formatLocation(chromosome, beginPos, endPos) {
    const chr = normalizeChromosomeLabel(chromosome);
    const begin = Number.isFinite(beginPos) ? Math.trunc(beginPos) : null;
    const end = Number.isFinite(endPos) ? Math.trunc(endPos) : null;
    if (!chr) return '';
    if (begin == null || end == null) return chr;
    return `${chr}:${begin}-${end}`;
}

function roleLabel(role) {
    if (role === 'program_gene') return 'program_gene';
    if (role === 'regulator') return 'regulator';
    return String(role || '');
}

function normalizeGeneRoleRow(row) {
    const beginPos = parseNullableNumber(row.begin_pos);
    const endPos = parseNullableNumber(row.end_pos);
    const score = parseNullableNumber(row.score);
    const rankValue = row.rank_value == null ? null : Number(row.rank_value);

    return {
        program: row.program || '',
        gene_symbol: row.gene_symbol || row.symbol || row.perturb_symbol || '',
        ensg_id: row.ensg_id || row.ensembl || '',
        role: roleLabel(row.role),
        score,
        rank: Number.isFinite(rankValue) ? rankValue : null,
        direction: row.direction || '',
        source_dataset: row.source_dataset || '',
        source_file: row.source_file || '',
        chromosome: row.chromosome || '',
        begin_pos: beginPos,
        end_pos: endPos,
        location: formatLocation(row.chromosome, beginPos, endPos),
        gene_type: row.gene_type || '',
        gene_name: row.gene_name || '',
    };
}

function summarizeGeneRoles(rows) {
    const programs = new Set();
    const genes = new Set();
    let programGeneRows = 0;
    let regulatorRows = 0;

    rows.forEach((row) => {
        if (row.program) programs.add(row.program);
        if (row.ensg_id || row.gene_symbol) genes.add(row.ensg_id || row.gene_symbol);
        if (row.role === 'program_gene') programGeneRows += 1;
        if (row.role === 'regulator') regulatorRows += 1;
    });

    return {
        totalRows: rows.length,
        totalPrograms: programs.size,
        totalGenes: genes.size,
        programGeneRows,
        regulatorRows,
    };
}

function normalizeScatterTraitRow(row) {
    const programScore = parseNullableNumber(row.program_score);
    const regulatorScore = parseNullableNumber(row.regulator_score);
    const programP = parseNullableNumber(row.program_p);
    const regulatorP = parseNullableNumber(row.regulator_p);
    const programGamma = parseNullableNumber(row.program_gamma);
    const regulatorBeta = parseNullableNumber(row.regulator_beta);

    return {
        trait: row.trait_name || row.trait_id || '',
        trait_id: row.trait_id || '',
        file_id: row.joined_file_id || row.file_id || '',
        gwas_id: row.gwas_id || '',
        program: row.program || '',
        program_score: programScore,
        regulator_score: regulatorScore,
        program_p: programP,
        regulator_p: regulatorP,
        program_rank: row.program_rank == null ? null : Number(row.program_rank),
        regulator_rank: row.regulator_rank == null ? null : Number(row.regulator_rank),
        program_gamma: programGamma,
        regulator_beta: regulatorBeta,
        enrichment_class: row.enrichment_class || 'other',
        source_file: row.source_file || '',
    };
}

function normalizeAssociationRecord(row) {
    const direction = row.predictedSign || row.gammaSign || row.postMeanSign || '';
    let concordance = 'unknown';
    if (row.isConcordant) concordance = 'concordant';
    else if (row.isDiscordant) concordance = 'discordant';

    return {
        trait: row.traitName || row.traitId || '',
        trait_id: row.traitId || '',
        file_id: row.fileId || '',
        gwas_id: row.gwasId || '',
        program: row.program || '',
        role: row.role || '',
        direction,
        post_mean: row.postMean,
        abs_gamma: row.absGamma,
        membership_score: row.membershipScore,
        concordance,
        gene_symbol: row.geneSymbol || '',
        ensg_id: row.ensgId || '',
    };
}

function normalizeAssociationSortBy(value) {
    const sortBy = String(value || '').trim();
    const aliases = {
        trait: 'trait',
        traitName: 'trait',
        program: 'program',
        role: 'role',
        direction: 'direction',
        post_mean: 'post_mean',
        postMean: 'post_mean',
        abs_gamma: 'abs_gamma',
        absGamma: 'abs_gamma',
        membership_score: 'membership_score',
        membershipScore: 'membership_score',
        concordance: 'concordance',
    };
    return aliases[sortBy] || 'abs_gamma';
}

function toLegacyAssociationSortBy(value) {
    const sortBy = normalizeAssociationSortBy(value);
    const legacy = {
        trait: 'traitName',
        post_mean: 'postMean',
        abs_gamma: 'absGamma',
        membership_score: 'membershipScore',
    };
    return legacy[sortBy] || sortBy;
}

async function getGeneCatalogCandidates(query) {
    const q = normalizeGeneQuery(query);
    if (!q) return [];
    try {
        const [rows] = await pool.query(
            `SELECT perturb_symbol, symbol, ensembl
             FROM ${GENE_INFO_TABLE}
             WHERE perturb_symbol = ? OR symbol = ? OR ensembl = ?
             LIMIT 5`,
            [q, q, q],
        );
        return [...new Set([
            q,
            ...rows.flatMap((row) => [row.perturb_symbol, row.symbol, row.ensembl]),
        ].map((value) => String(value || '').trim()).filter(Boolean))];
    } catch (err) {
        if (isMissingTableError(err)) return [q];
        throw err;
    }
}

async function getProgramGeneRoles(programId) {
    const program = normalizeProgramId(programId);
    if (!program) return { program: { id: '', annotation: '' }, roles: [], summary: summarizeGeneRoles([]) };

    try {
        const [rows] = await pool.query(
            `SELECT
                pgre.*,
                COALESCE(gi_ensg.symbol, gi_symbol.symbol, pgre.gene_symbol) AS symbol,
                COALESCE(gi_ensg.perturb_symbol, gi_symbol.perturb_symbol, pgre.gene_symbol) AS perturb_symbol,
                COALESCE(gi_ensg.ensembl, gi_symbol.ensembl, pgre.ensg_id) AS ensembl,
                COALESCE(gi_ensg.chromosome, gi_symbol.chromosome) AS chromosome,
                COALESCE(gi_ensg.begin_pos, gi_symbol.begin_pos) AS begin_pos,
                COALESCE(gi_ensg.end_pos, gi_symbol.end_pos) AS end_pos,
                COALESCE(gi_ensg.gene_type, gi_symbol.gene_type) AS gene_type,
                COALESCE(gi_ensg.gene_name, gi_symbol.gene_name) AS gene_name
             FROM ${PROGRAM_GENE_ROLE_TABLE} pgre
             LEFT JOIN ${GENE_INFO_TABLE} gi_ensg
                ON BINARY gi_ensg.ensembl = BINARY pgre.ensg_id
             LEFT JOIN ${GENE_INFO_TABLE} gi_symbol
                ON BINARY gi_symbol.perturb_symbol = BINARY pgre.gene_symbol
             WHERE pgre.program = ?
             ORDER BY
                FIELD(pgre.role, 'program_gene', 'regulator') ASC,
                pgre.rank_value IS NULL ASC,
                pgre.rank_value ASC,
                ABS(COALESCE(pgre.score, 0)) DESC,
                COALESCE(NULLIF(pgre.gene_symbol, ''), NULLIF(pgre.ensg_id, '')) ASC`,
            [program],
        );
        const roles = rows.map((row) => normalizeGeneRoleRow(row));
        return {
            program: { id: program },
            roles,
            genes: roles,
            summary: summarizeGeneRoles(roles),
        };
    } catch (err) {
        if (isMissingTableError(err)) {
            return emptyUnavailable({ program: { id: program }, roles: [], genes: [], summary: summarizeGeneRoles([]) });
        }
        throw err;
    }
}

async function getGeneProgramRoles(geneId) {
    const query = normalizeGeneQuery(geneId);
    if (!query) {
        return { query: '', programs: [], roles: [], summary: summarizeGeneRoles([]) };
    }

    try {
        const candidates = await getGeneCatalogCandidates(query);
        const placeholders = candidates.map(() => '?').join(', ');
        const params = [...candidates, ...candidates];
        const [rows] = await pool.query(
            `SELECT
                pgre.*,
                pi.curated_annotation,
                pi.representative_go,
                pi.go_enrichment_p
             FROM ${PROGRAM_GENE_ROLE_TABLE} pgre
             LEFT JOIN program_info pi
                ON BINARY pi.program = BINARY pgre.program
             WHERE pgre.gene_symbol IN (${placeholders})
                OR pgre.ensg_id IN (${placeholders})
             ORDER BY
                FIELD(pgre.role, 'program_gene', 'regulator') ASC,
                pgre.rank_value IS NULL ASC,
                pgre.rank_value ASC,
                ABS(COALESCE(pgre.score, 0)) DESC,
                pgre.program ASC`,
            params,
        );
        const roles = rows.map((row) => ({
            ...normalizeGeneRoleRow(row),
            program_annotation: row.curated_annotation || '',
            representative_go: row.representative_go || '',
            go_enrichment_p: row.go_enrichment_p || '',
        }));
        return {
            query,
            programs: roles,
            roles,
            summary: summarizeGeneRoles(roles),
        };
    } catch (err) {
        if (isMissingTableError(err)) {
            return emptyUnavailable({ query, programs: [], roles: [], summary: summarizeGeneRoles([]) });
        }
        throw err;
    }
}

async function getProgramScatterTraits(programId) {
    const program = normalizeProgramId(programId);
    if (!program) {
        return {
            program: { id: '' },
            summary: { totalTraits: 0 },
            traits: [],
        };
    }

    try {
        const [rows] = await pool.query(
            `SELECT
                ptse.*,
                COALESCE(fm_trait.file_id, fm_gwas.file_id, fm_file.file_id, ptse.file_id) AS joined_file_id,
                COALESCE(fm_trait.gwas_id, fm_gwas.gwas_id, fm_file.gwas_id, '') AS gwas_id,
                COALESCE(fm_trait.trait_name, fm_gwas.trait_name, fm_file.trait_name, '') AS trait_name
             FROM ${PROGRAM_TRAIT_SCATTER_TABLE} ptse
             LEFT JOIN file_metadata fm_trait
                ON BINARY fm_trait.file_id = BINARY ptse.trait_id
             LEFT JOIN file_metadata fm_gwas
                ON BINARY fm_gwas.gwas_id = BINARY ptse.trait_id
             LEFT JOIN file_metadata fm_file
                ON BINARY fm_file.file_id = BINARY ptse.file_id
             WHERE ptse.program = ?
             ORDER BY
                ABS(COALESCE(ptse.program_score, 0)) + ABS(COALESCE(ptse.regulator_score, 0)) DESC,
                ptse.program_rank IS NULL ASC,
                ptse.program_rank ASC,
                ptse.trait_id ASC`,
            [program],
        );
        const traits = rows.map((row) => normalizeScatterTraitRow(row));
        const programSelected = traits.filter((row) => row.enrichment_class === 'program_enriched' || row.enrichment_class === 'both_enriched').length;
        const regulatorSelected = traits.filter((row) => row.enrichment_class === 'regulator_enriched' || row.enrichment_class === 'both_enriched').length;
        const bothSelected = traits.filter((row) => row.enrichment_class === 'both_enriched').length;
        return {
            program: { id: program },
            summary: {
                totalTraits: traits.length,
                selectedByProgram: programSelected,
                selectedByRegulator: regulatorSelected,
                bothSelected,
            },
            traits,
        };
    } catch (err) {
        if (isMissingTableError(err)) {
            return emptyUnavailable({ program: { id: program }, summary: { totalTraits: 0 }, traits: [] });
        }
        throw err;
    }
}

async function getGeneAssociationTraits(geneId, options = {}) {
    const sourceSortBy = normalizeAssociationSortBy(options.sortBy || 'trait');
    const payload = await geneProgramModel.getGeneProgramRecords(geneId, {
        ...options,
        sortBy: toLegacyAssociationSortBy(sourceSortBy),
    });
    if (payload?.unavailable) return payload;
    return {
        query: payload.query,
        records: (payload.records || []).map((row) => normalizeAssociationRecord(row)),
        recordPage: {
            ...(payload.recordPage || {}),
            sortBy: sourceSortBy,
        },
    };
}

module.exports = {
    getGeneAssociationTraits,
    getGeneProgramRoles,
    getProgramGeneRoles,
    getProgramScatterTraits,
    normalizeProgramId,
};
