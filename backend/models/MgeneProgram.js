const pool = require('./db');

const TABLE_MISSING_CODES = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);
const GENE_INFO_TABLE = 'gene_info_hg37_matched';
const GENE_SUMMARY_TABLE = 'gene_summary';
const GENE_SUMMARY_CACHE_TTL_MS = 60 * 60 * 1000;
const PREFIX_FALLBACK_BLOCKLIST = new Set(['EN', 'ENS', 'ENSG']);
let geneInfoTableAvailablePromise = null;
let geneSummaryTableAvailablePromise = null;
let geneSummaryCache = null;
let geneSummaryCachePromise = null;

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

async function hasGeneSummaryTable() {
    if (!geneSummaryTableAvailablePromise) {
        geneSummaryTableAvailablePromise = pool.query(
            `SELECT 1
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
            LIMIT 1`,
            [GENE_SUMMARY_TABLE],
        )
            .then(([rows]) => {
                const available = rows.length > 0;
                if (!available) geneSummaryTableAvailablePromise = null;
                return available;
            })
            .catch((err) => {
                geneSummaryTableAvailablePromise = null;
                throw err;
            });
    }
    return geneSummaryTableAvailablePromise;
}

function normalizeGeneQuery(value) {
    const text = String(value || '').trim();
    return text ? text.slice(0, 120) : '';
}

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
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

function normalizeGeneSummary(row) {
    const beginPos = toNullableNumber(row.begin_pos);
    const endPos = toNullableNumber(row.end_pos);
    return {
        geneSymbol: row.gene_symbol || '',
        ensgId: row.ensg_id || '',
        geneLabel: row.gene_label || row.gene_symbol || row.ensg_id || '',
        geneName: row.gene_name || '',
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

function buildGeneSummaryOrderBy(sortBy, order) {
    const key = normalizeGeneListSortBy(sortBy);
    const direction = normalizeSortDirection(order);
    const tieBreakers = [
        "COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, ''), gene_key, '') ASC",
        'ensg_id ASC',
    ];

    if (key === 'geneSymbol') {
        return `ORDER BY COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, ''), gene_key, '') ${direction}, ${tieBreakers.join(', ')}`;
    }

    if (key === 'ensgId') {
        return `ORDER BY COALESCE(NULLIF(ensg_id, ''), NULLIF(gene_symbol, ''), gene_key, '') ${direction}, ${tieBreakers.join(', ')}`;
    }

    if (key === 'geneType') {
        return `ORDER BY COALESCE(gene_type, '') ${direction}, ${tieBreakers.join(', ')}`;
    }

    if (key === 'location') {
        const chrExpr = "UPPER(REPLACE(REPLACE(COALESCE(chromosome, ''), 'chr', ''), 'CHR', ''))";
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
            COALESCE(begin_pos, 9223372036854775807) ${direction},
            COALESCE(end_pos, 9223372036854775807) ${direction},
            ${tieBreakers.join(', ')}`;
    }

    if (key === 'totalPrograms') {
        return `ORDER BY total_programs ${direction}, total_traits DESC, ${tieBreakers.join(', ')}`;
    }

    return `ORDER BY total_traits ${direction}, total_programs DESC, total_rows DESC, ${tieBreakers.join(', ')}`;
}

function compareText(a, b) {
    return String(a || '').localeCompare(String(b || ''), undefined, {
        sensitivity: 'base',
        numeric: true,
    });
}

function chromosomeSortRank(value) {
    const chr = String(value || '').trim().replace(/^chr/i, '');
    if (!chr) return { group: 3, value: Number.POSITIVE_INFINITY, text: '' };
    if (/^\d+$/.test(chr)) return { group: 0, value: Number(chr), text: chr };
    if (chr === 'X') return { group: 1, value: 23, text: chr };
    if (chr === 'Y') return { group: 1, value: 24, text: chr };
    if (chr === 'M' || chr === 'MT') return { group: 1, value: 25, text: chr };
    return { group: 2, value: Number.POSITIVE_INFINITY, text: chr };
}

function compareNullableNumber(a, b) {
    const left = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY;
    const right = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY;
    return left - right;
}

function compareLocation(a, b) {
    const left = chromosomeSortRank(a?.chromosome);
    const right = chromosomeSortRank(b?.chromosome);

    if (left.group !== right.group) return left.group - right.group;
    if (left.value !== right.value) return left.value - right.value;
    if (left.text !== right.text) return compareText(left.text, right.text);

    const beginDiff = compareNullableNumber(a?.beginPos, b?.beginPos);
    if (beginDiff) return beginDiff;

    return compareNullableNumber(a?.endPos, b?.endPos);
}

function compareGeneSummaryRows(a, b, sortBy, order) {
    const key = normalizeGeneListSortBy(sortBy);
    const direction = normalizeSortDirection(order) === 'ASC' ? 1 : -1;
    let result = 0;

    if (key === 'geneSymbol') result = compareText(a?.geneSymbol || a?.geneLabel || a?.ensgId, b?.geneSymbol || b?.geneLabel || b?.ensgId);
    if (key === 'ensgId') result = compareText(a?.ensgId || a?.geneSymbol, b?.ensgId || b?.geneSymbol);
    if (key === 'geneType') result = compareText(a?.geneType, b?.geneType);
    if (key === 'location') result = compareLocation(a, b);
    if (key === 'totalPrograms') result = (Number(a?.totalPrograms) || 0) - (Number(b?.totalPrograms) || 0);
    if (key === 'totalTraits') result = (Number(a?.totalTraits) || 0) - (Number(b?.totalTraits) || 0);

    if (result) return result * direction;

    if (key === 'totalPrograms') {
        result = (Number(b?.totalTraits) || 0) - (Number(a?.totalTraits) || 0);
        if (result) return result;
    }

    if (key === 'totalTraits') {
        result = (Number(b?.totalPrograms) || 0) - (Number(a?.totalPrograms) || 0);
        if (result) return result;
        result = (Number(b?.totalRows) || 0) - (Number(a?.totalRows) || 0);
        if (result) return result;
    }

    result = compareText(a?.geneSymbol || a?.ensgId || a?.geneLabel, b?.geneSymbol || b?.ensgId || b?.geneLabel);
    if (result) return result;
    return compareText(a?.ensgId, b?.ensgId);
}

function geneMatchesSearch(gene, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;

    return [
        gene?.geneSymbol,
        gene?.ensgId,
        gene?.geneLabel,
    ].some((value) => String(value || '').toLowerCase().includes(q));
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

function normalizeGeneRecordSortBy(value) {
    const sortBy = String(value || '').trim();
    return [
        'traitName',
        'program',
        'programAnnotation',
        'role',
        'direction',
        'postMean',
        'absGamma',
        'membershipScore',
        'concordance',
    ].includes(sortBy) ? sortBy : 'absGamma';
}

function buildGeneRecordOrderBy(sortBy, order) {
    const key = normalizeGeneRecordSortBy(sortBy);
    const direction = normalizeSortDirection(order);
    const tieBreakers = 'gpte.program ASC, gpte.trait_id ASC, gpte.role ASC';
    const expressions = {
        traitName: 'COALESCE(fm_trait.trait_name, fm_gwas.trait_name, fm_file.trait_name, gpte.trait_id)',
        program: 'gpte.program',
        programAnnotation: "COALESCE(pi.curated_annotation, gpte.program_annotation, '')",
        role: 'gpte.role',
        direction: "COALESCE(gpte.predicted_sign, gpte.gamma_sign, gpte.post_mean_sign, '')",
        postMean: 'COALESCE(gpte.post_mean, 0)',
        absGamma: 'ABS(COALESCE(gpte.abs_gamma, 0))',
        membershipScore: 'ABS(COALESCE(gpte.membership_score, 0))',
        concordance: '(gpte.is_concordant + gpte.is_discordant)',
    };

    const expression = expressions[key] || expressions.absGamma;
    const secondary = key === 'absGamma'
        ? ', ABS(COALESCE(gpte.membership_score, 0)) DESC'
        : ', ABS(COALESCE(gpte.abs_gamma, 0)) DESC';
    return `ORDER BY ${expression} ${direction}${secondary}, ${tieBreakers}`;
}

function normalizeProgramAggregate(row, fallbackGeneLabel = '') {
    const roles = String(row.roles || '').split(',').filter(Boolean);
    const signs = String(row.signs || '').split(',').filter((value) => value && value !== '-');
    const roleLabel = roles
        .map((role) => {
            const value = String(role || '').trim().toLowerCase();
            if (value === 'program' || value === 'loading') return 'program';
            if (value === 'regulator') return 'regulator';
            return value;
        })
        .filter(Boolean)
        .join(' + ') || '-';
    let signLabel = '-';
    if (signs.length === 1) signLabel = signs[0];
    if (signs.length > 1) signLabel = 'mixed';
    const geneDirection = roleLabel === '-' ? signLabel : (signLabel === '-' ? roleLabel : `${roleLabel} / ${signLabel}`);
    const programGeneCountSort = Number(row.program_gene_count) || 0;

    return {
        geneLabel: row.gene_label || fallbackGeneLabel || row.gene_symbol || row.ensg_id || '',
        geneSymbol: row.gene_symbol || '',
        ensgId: row.ensg_id || '',
        program: row.program || '',
        programAnnotation: row.program_annotation || row.curated_annotation || '-',
        programGoLabel: row.representative_go || row.top10_pathways || '-',
        goEnrichmentP: row.go_enrichment_p || '',
        geneDirection,
        programGeneCountLabel: programGeneCountSort ? `${programGeneCountSort.toLocaleString()} genes` : '-',
        programGeneCountSort,
        totalTraits: Number(row.total_traits) || 0,
    };
}

function parseDistinctList(value) {
    return [...new Set(String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item && item !== '-'))];
}

function formatProgramGeneDirection(row) {
    const roles = parseDistinctList(row.roles);
    const programSigns = parseDistinctList(row.program_signs);
    const regulatorSigns = parseDistinctList(row.regulator_signs);

    const parts = [];
    if (roles.includes('program')) {
        parts.push(`program${programSigns.length ? ` ${programSigns.length > 1 ? 'mixed' : programSigns[0]}` : ''}`);
    }
    if (roles.includes('regulator')) {
        parts.push(`regulator${regulatorSigns.length ? ` ${regulatorSigns.length > 1 ? 'mixed' : regulatorSigns[0]}` : ''}`);
    }

    return parts.join(' / ') || '-';
}

function normalizeProgramGeneRow(row) {
    const beginPos = toNullableNumber(row.begin_pos);
    const endPos = toNullableNumber(row.end_pos);
    const value = Number(row.value);

    return {
        geneSymbol: row.gene_symbol || row.symbol || '',
        ensgId: row.ensg_id || '',
        geneLabel: row.gene_symbol || row.symbol || row.ensg_id || '',
        chromosome: row.chromosome || '',
        beginPos,
        endPos,
        location: formatLocation(row.chromosome, beginPos, endPos),
        geneType: row.gene_type || '',
        direction: formatProgramGeneDirection(row),
        value: Number.isFinite(value) ? value : null,
        roles: parseDistinctList(row.roles),
        totalTraits: Number(row.total_traits) || 0,
        rankWithinSide: row.rank_within_side == null ? null : Number(row.rank_within_side),
    };
}

function normalizeSummaryRow(row) {
    return {
        totalRows: Number(row?.total_rows) || 0,
        totalPrograms: Number(row?.total_programs) || 0,
        totalTraits: Number(row?.total_traits) || 0,
        programRoleRows: Number(row?.program_role_rows) || 0,
        regulatorRoleRows: Number(row?.regulator_role_rows) || 0,
        concordantRows: Number(row?.concordant_rows) || 0,
        discordantRows: Number(row?.discordant_rows) || 0,
    };
}

function normalizeGeneFromRow(row, fallbackLabel = '') {
    const record = normalizeRecord(row || {});
    return {
        geneSymbol: record.geneSymbol || fallbackLabel,
        ensgId: record.ensgId || '',
        chromosome: record.chromosome || '',
        beginPos: record.beginPos == null ? null : record.beginPos,
        endPos: record.endPos == null ? null : record.endPos,
        location: record.location || '',
        geneType: record.geneType || '',
        geneName: record.geneName || '',
        geneId: record.geneId || '',
        hgnc: record.hgnc || '',
        synonyms: record.synonyms || '',
        description: record.description || '',
        externalSources: [],
    };
}

function buildGeneInfoSelect(includeGeneInfo) {
    return includeGeneInfo ? `
                gi.chromosome,
                gi.begin_pos,
                gi.end_pos,
                gi.gene_type,
                gi.gene_name,
                gi.gene_id,
                gi.hgnc,
                gi.synonyms,
                gi.description,` : `
                '' AS chromosome,
                NULL AS begin_pos,
                NULL AS end_pos,
                '' AS gene_type,
                '' AS gene_name,
                '' AS gene_id,
                '' AS hgnc,
                '' AS synonyms,
                '' AS description,`;
}

function buildGeneInfoJoin(includeGeneInfo) {
    return includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : '';
}

function buildGeneOverviewPayload(gene, summary, programs, query) {
    return {
        query,
        gene,
        summary,
        genes: gene?.geneSymbol || gene?.ensgId ? [{
            geneSymbol: gene.geneSymbol || '',
            ensgId: gene.ensgId || '',
            geneLabel: gene.geneSymbol || gene.ensgId || query,
            chromosome: gene.chromosome || '',
            beginPos: gene.beginPos == null ? null : gene.beginPos,
            endPos: gene.endPos == null ? null : gene.endPos,
            location: gene.location || formatLocation(gene.chromosome, gene.beginPos, gene.endPos),
            geneType: gene.geneType || '',
            totalPrograms: summary.totalPrograms,
            totalTraits: summary.totalTraits,
            roles: {
                program: summary.programRoleRows,
                regulator: summary.regulatorRoleRows,
            },
        }] : [],
        programs,
    };
}

async function getGeneSummaryCache(includeGeneInfo) {
    const now = Date.now();
    if (
        geneSummaryCache
        && geneSummaryCache.includeGeneInfo === includeGeneInfo
        && now - geneSummaryCache.createdAt < GENE_SUMMARY_CACHE_TTL_MS
    ) {
        return geneSummaryCache;
    }

    if (geneSummaryCachePromise) return geneSummaryCachePromise;

    const geneInfoSelect = includeGeneInfo ? `
                MAX(gi.chromosome) AS chromosome,
                MAX(gi.begin_pos) AS begin_pos,
                MAX(gi.end_pos) AS end_pos,
                MAX(gi.gene_name) AS gene_name,
                MAX(gi.gene_type) AS gene_type,` : `
                '' AS chromosome,
                NULL AS begin_pos,
                NULL AS end_pos,
                '' AS gene_name,
                '' AS gene_type,`;
    const geneInfoJoin = includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON gi.ensembl = gpte.ensg_id` : '';

    geneSummaryCachePromise = (async () => {
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
             WHERE COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, '')) IS NOT NULL
             GROUP BY gpte.gene_symbol, gpte.ensg_id`,
        );

        geneSummaryCache = {
            includeGeneInfo,
            createdAt: Date.now(),
            genes: rows.map((row) => normalizeGeneSummary(row)),
        };
        geneSummaryCachePromise = null;
        return geneSummaryCache;
    })().catch((err) => {
        geneSummaryCachePromise = null;
        throw err;
    });

    return geneSummaryCachePromise;
}

async function getGeneSummaryMaxTotals() {
    const [[row]] = await pool.query(
        `SELECT
            COALESCE(MAX(total_programs), 0) AS total_programs,
            COALESCE(MAX(total_traits), 0) AS total_traits
         FROM ${GENE_SUMMARY_TABLE}`,
    );

    return {
        totalPrograms: Number(row?.total_programs) || 0,
        totalTraits: Number(row?.total_traits) || 0,
    };
}

async function hasGeneSummaryRows() {
    if (!(await hasGeneSummaryTable())) return false;
    const [[row]] = await pool.query(
        `SELECT 1 AS has_rows
         FROM ${GENE_SUMMARY_TABLE}
         LIMIT 1`,
    );
    return Boolean(row?.has_rows);
}

async function getGenesFromSummaryTable({
    page,
    limit,
    exportAll,
    offset,
    sortBy,
    order,
    searchText,
}) {
    const where = [];
    const params = [];

    if (searchText) {
        const like = `%${escapeLike(searchText)}%`;
        where.push(`(
            gene_symbol LIKE ? ESCAPE '\\\\'
            OR ensg_id LIKE ? ESCAPE '\\\\'
            OR gene_label LIKE ? ESCAPE '\\\\'
        )`);
        params.push(like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = buildGeneSummaryOrderBy(sortBy, order);
    const limitSql = exportAll ? '' : 'LIMIT ? OFFSET ?';
    const limitParams = exportAll ? [] : [limit, offset];

    const [rows] = await pool.query(
        `SELECT
            gene_symbol,
            ensg_id,
            gene_label,
            chromosome,
            begin_pos,
            end_pos,
            gene_name,
            gene_type,
            total_rows,
            total_programs,
            total_traits,
            program_role_rows,
            regulator_role_rows
         FROM ${GENE_SUMMARY_TABLE}
         ${whereSql}
         ${orderBy}
         ${limitSql}`,
        [...params, ...limitParams],
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM ${GENE_SUMMARY_TABLE}
         ${whereSql}`,
        params,
    );

    const [maxTotals] = await Promise.all([getGeneSummaryMaxTotals()]);
    const genes = rows.map((row) => normalizeGeneSummary(row));
    const totalCount = Number(total) || 0;

    return {
        genes,
        data: genes,
        totalCount,
        maxTotals,
        page,
        limit: exportAll ? genes.length : limit,
        totalPages: exportAll ? 1 : Math.ceil(totalCount / limit),
        sortBy: normalizeGeneListSortBy(sortBy),
        order: normalizeSortDirection(order),
        search: searchText,
        source: GENE_SUMMARY_TABLE,
    };
}

async function getGenes({ page = 1, limit = 25, sortBy = 'totalTraits', order = 'DESC', search = '' } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const requestedLimit = Number(limit);
    const exportAll = requestedLimit === 0;
    const l = exportAll ? 0 : Math.max(1, Math.min(200, requestedLimit || 25));
    const offset = exportAll ? 0 : (p - 1) * l;
    const searchText = normalizeGeneQuery(search);

    try {
        if (await hasGeneSummaryRows()) {
            const summaryResult = await getGenesFromSummaryTable({
                page: p,
                limit: l,
                exportAll,
                offset,
                sortBy,
                order,
                searchText,
            });
            if (summaryResult.totalCount > 0 || searchText) return summaryResult;
        }

        const includeGeneInfo = await hasGeneInfoTable();
        const cache = await getGeneSummaryCache(includeGeneInfo);
        const filteredGenes = searchText
            ? cache.genes.filter((gene) => geneMatchesSearch(gene, searchText))
            : cache.genes;
        const sortedGenes = [...filteredGenes].sort((a, b) => compareGeneSummaryRows(a, b, sortBy, order));
        const genes = exportAll ? sortedGenes : sortedGenes.slice(offset, offset + l);
        const total = sortedGenes.length;
        const maxTotals = cache.genes.reduce((acc, gene) => ({
            totalPrograms: Math.max(acc.totalPrograms, Number(gene.totalPrograms) || 0),
            totalTraits: Math.max(acc.totalTraits, Number(gene.totalTraits) || 0),
        }), { totalPrograms: 0, totalTraits: 0 });

        return {
            genes,
            data: genes,
            totalCount: Number(total) || 0,
            maxTotals,
            page: p,
            limit: exportAll ? genes.length : l,
            totalPages: exportAll ? 1 : Math.ceil((Number(total) || 0) / l),
            sortBy: normalizeGeneListSortBy(sortBy),
            order: normalizeSortDirection(order),
            search: searchText,
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                genes: [],
                data: [],
                totalCount: 0,
                maxTotals: { totalPrograms: 0, totalTraits: 0 },
                page: p,
                limit: exportAll ? 0 : l,
                totalPages: 0,
                search: searchText,
            });
        }
        throw err;
    }
}

async function searchGenes(query, limit = 20) {
    const q = normalizeGeneQuery(query);
    if (!q) return { query: q, totalGenes: 0, genes: [] };

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const prefixLike = `${escapeLike(q)}%`;

    try {
        if (await hasGeneSummaryRows()) {
            const [exactRows] = await pool.query(
                `SELECT
                    gene_symbol,
                    ensg_id,
                    gene_label,
                    chromosome,
                    begin_pos,
                    end_pos,
                    gene_name,
                    gene_type,
                    total_rows,
                    total_programs,
                    total_traits,
                    program_role_rows,
                    regulator_role_rows
                 FROM ${GENE_SUMMARY_TABLE}
                 WHERE gene_symbol = ?
                    OR ensg_id = ?
                    OR gene_label = ?
                 ORDER BY
                    (gene_symbol = ?) DESC,
                    (ensg_id = ?) DESC,
                    (gene_label = ?) DESC,
                    total_traits DESC,
                    total_programs DESC,
                    COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, ''), gene_key, '') ASC
                 LIMIT ?`,
                [q, q, q, q, q, q, safeLimit],
            );

            if (exactRows.length) {
                return {
                    query: q,
                    totalGenes: exactRows.length,
                    genes: exactRows.map((row) => normalizeGeneSummary(row)),
                    source: GENE_SUMMARY_TABLE,
                };
            }

            if (PREFIX_FALLBACK_BLOCKLIST.has(q.toUpperCase())) {
                return {
                    query: q,
                    totalGenes: 0,
                    genes: [],
                    prefixFallbackSkipped: true,
                    source: GENE_SUMMARY_TABLE,
                };
            }

            const [prefixRows] = await pool.query(
                `SELECT
                    gene_symbol,
                    ensg_id,
                    gene_label,
                    chromosome,
                    begin_pos,
                    end_pos,
                    gene_name,
                    gene_type,
                    total_rows,
                    total_programs,
                    total_traits,
                    program_role_rows,
                    regulator_role_rows
                 FROM ${GENE_SUMMARY_TABLE}
                 WHERE gene_symbol LIKE ? ESCAPE '\\\\'
                    OR ensg_id LIKE ? ESCAPE '\\\\'
                    OR gene_label LIKE ? ESCAPE '\\\\'
                 ORDER BY
                    total_traits DESC,
                    total_programs DESC,
                    COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, ''), gene_key, '') ASC
                 LIMIT ?`,
                [prefixLike, prefixLike, prefixLike, safeLimit],
            );

            return {
                query: q,
                totalGenes: prefixRows.length,
                genes: prefixRows.map((row) => normalizeGeneSummary(row)),
                source: GENE_SUMMARY_TABLE,
            };
        }

        const includeGeneInfo = await hasGeneInfoTable();
        const geneInfoSelect = includeGeneInfo ? `
                MAX(gi.chromosome) AS chromosome,
                MAX(gi.begin_pos) AS begin_pos,
                MAX(gi.end_pos) AS end_pos,
                MAX(gi.gene_name) AS gene_name,
                MAX(gi.gene_type) AS gene_type,` : '';
        const geneInfoJoin = includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON gi.ensembl = gpte.ensg_id` : '';

        const [exactRows] = await pool.query(
            `SELECT
                gpte.gene_symbol,
                gpte.ensg_id,
                ${geneInfoSelect}
                COUNT(*) AS total_rows,
                COUNT(DISTINCT program) AS total_programs,
                COUNT(DISTINCT trait_id) AS total_traits,
                SUM(role = 'program') AS program_role_rows,
                SUM(role = 'regulator') AS regulator_role_rows
             FROM gene_program_trait_edge gpte
             ${geneInfoJoin}
             WHERE gpte.gene_symbol = ?
                OR gpte.ensg_id = ?
             GROUP BY gene_symbol, ensg_id
             ORDER BY
                (gpte.gene_symbol = ?) DESC,
                (gpte.ensg_id = ?) DESC,
                total_traits DESC,
                total_programs DESC,
                gpte.gene_symbol ASC
             LIMIT ?`,
            [q, q, q, q, safeLimit],
        );

        if (exactRows.length) {
            return {
                query: q,
                totalGenes: exactRows.length,
                genes: exactRows.map((row) => normalizeGeneSummary(row)),
            };
        }

        if (PREFIX_FALLBACK_BLOCKLIST.has(q.toUpperCase())) {
            return {
                query: q,
                totalGenes: 0,
                genes: [],
                prefixFallbackSkipped: true,
            };
        }

        const [prefixRows] = await pool.query(
            `SELECT
                gpte.gene_symbol,
                gpte.ensg_id,
                ${geneInfoSelect}
                COUNT(*) AS total_rows,
                COUNT(DISTINCT program) AS total_programs,
                COUNT(DISTINCT trait_id) AS total_traits,
                SUM(role = 'program') AS program_role_rows,
                SUM(role = 'regulator') AS regulator_role_rows
             FROM gene_program_trait_edge gpte
             ${geneInfoJoin}
             WHERE gpte.gene_symbol LIKE ? ESCAPE '\\\\'
                OR gpte.ensg_id LIKE ? ESCAPE '\\\\'
             GROUP BY gene_symbol, ensg_id
             ORDER BY
                total_traits DESC,
                total_programs DESC,
                gpte.gene_symbol ASC
             LIMIT ?`,
            [prefixLike, prefixLike, safeLimit],
        );

        return {
            query: q,
            totalGenes: prefixRows.length,
            genes: prefixRows.map((row) => normalizeGeneSummary(row)),
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) return emptyUnavailable({ query: q, totalGenes: 0, genes: [] });
        throw err;
    }
}

async function getRecommendedGenes(limit = 12) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 12));

    try {
        if (await hasGeneSummaryTable()) {
            const [rows] = await pool.query(
                `SELECT
                    gene_symbol,
                    ensg_id,
                    gene_label,
                    chromosome,
                    begin_pos,
                    end_pos,
                    gene_name,
                    gene_type,
                    total_rows,
                    total_programs,
                    total_traits,
                    program_role_rows,
                    regulator_role_rows
                 FROM ${GENE_SUMMARY_TABLE}
                 ORDER BY total_traits DESC,
                    total_programs DESC,
                    total_rows DESC,
                    COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, ''), gene_key, '') ASC
                 LIMIT ?`,
                [safeLimit],
            );

            if (rows.length) {
                return {
                    genes: rows.map((row) => normalizeGeneSummary(row)),
                    source: GENE_SUMMARY_TABLE,
                };
            }
        }

        const includeGeneInfo = await hasGeneInfoTable();
        const cache = await getGeneSummaryCache(includeGeneInfo);
        const genes = [...cache.genes]
            .sort((a, b) => compareGeneSummaryRows(a, b, 'totalTraits', 'DESC'))
            .slice(0, safeLimit);

        return {
            genes,
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) return emptyUnavailable({ genes: [] });
        throw err;
    }
}

async function getGeneOverview(geneId) {
    const q = normalizeGeneQuery(geneId);
    if (!q) {
        return {
            query: '',
            gene: { geneSymbol: '', ensgId: '' },
            summary: buildSummary([]),
            genes: [],
            programs: [],
        };
    }

    const includeGeneInfo = await hasGeneInfoTable();
    const whereSql = 'WHERE gpte.gene_symbol = ? OR gpte.ensg_id = ?';
    const whereParams = [q, q];
    const geneInfoSelect = buildGeneInfoSelect(includeGeneInfo);
    const geneInfoJoin = buildGeneInfoJoin(includeGeneInfo);

    try {
        const summaryQuery = pool.query(
            `SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT gpte.program) AS total_programs,
                COUNT(DISTINCT gpte.trait_id) AS total_traits,
                SUM(gpte.role = 'program') AS program_role_rows,
                SUM(gpte.role = 'regulator') AS regulator_role_rows,
                SUM(gpte.is_concordant = 1) AS concordant_rows,
                SUM(gpte.is_discordant = 1) AS discordant_rows
             FROM gene_program_trait_edge gpte
             ${whereSql}`,
            whereParams,
        );

        const geneQuery = pool.query(
            `SELECT
                gpte.gene_symbol,
                gpte.ensg_id,
                gpte.gene_label,
                ${geneInfoSelect}
                NULL AS trait_id,
                NULL AS file_id,
                NULL AS program,
                NULL AS role
             FROM gene_program_trait_edge gpte
             ${geneInfoJoin}
             ${whereSql}
             ORDER BY
                (gpte.gene_symbol = ?) DESC,
                (gpte.ensg_id = ?) DESC,
                gpte.gene_symbol ASC,
                gpte.ensg_id ASC
             LIMIT 1`,
            [...whereParams, q, q],
        );

        const programRowsQuery = pool.query(
            `SELECT
                MAX(gpte.gene_symbol) AS gene_symbol,
                MAX(gpte.ensg_id) AS ensg_id,
                MAX(COALESCE(NULLIF(gpte.gene_label, ''), NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, ''))) AS gene_label,
                gpte.program,
                MAX(gpte.program_annotation) AS program_annotation,
                MAX(pi.curated_annotation) AS curated_annotation,
                MAX(pi.representative_go) AS representative_go,
                MAX(pi.go_enrichment_p) AS go_enrichment_p,
                MAX(pi.top10_pathways) AS top10_pathways,
                GROUP_CONCAT(DISTINCT gpte.role SEPARATOR ',') AS roles,
                GROUP_CONCAT(DISTINCT COALESCE(NULLIF(gpte.predicted_sign, ''), NULLIF(gpte.gamma_sign, ''), NULLIF(gpte.post_mean_sign, ''), '-') SEPARATOR ',') AS signs,
                MAX(COALESCE(pgc.program_gene_count, 0)) AS program_gene_count,
                COUNT(DISTINCT gpte.trait_id) AS total_traits
             FROM gene_program_trait_edge gpte
             LEFT JOIN program_info pi
                ON BINARY pi.program = BINARY gpte.program
             LEFT JOIN (
                SELECT
                    program,
                    COUNT(DISTINCT COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, ''))) AS program_gene_count
                FROM gene_program_trait_edge
                GROUP BY program
             ) pgc
                ON BINARY pgc.program = BINARY gpte.program
             ${whereSql}
             GROUP BY gpte.program
             ORDER BY
                total_traits DESC,
                program_gene_count DESC,
                gpte.program ASC`,
            whereParams,
        );

        const [
            [[summaryRow]],
            [geneRows],
            [programRows],
        ] = await Promise.all([summaryQuery, geneQuery, programRowsQuery]);

        const gene = normalizeGeneFromRow(geneRows[0], q);
        const summary = normalizeSummaryRow(summaryRow);
        const programs = programRows.map((row) => normalizeProgramAggregate(row, gene.geneSymbol || gene.ensgId || q));

        return buildGeneOverviewPayload(gene, summary, programs, q);
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                query: q,
                gene: { geneSymbol: q, ensgId: '' },
                summary: buildSummary([]),
                genes: [],
                programs: [],
            });
        }
        throw err;
    }
}

async function getGeneProgramRecords(geneId, {
    page = 1,
    limit = 50,
    sortBy = 'absGamma',
    order = 'DESC',
} = {}) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(250, Number(limit) || 50));
    const offset = (p - 1) * l;
    const q = normalizeGeneQuery(geneId);
    const normalizedSortBy = normalizeGeneRecordSortBy(sortBy);
    const normalizedOrder = normalizeSortDirection(order);

    if (!q) {
        return {
            query: '',
            records: [],
            recordPage: {
                page: p,
                limit: l,
                totalCount: 0,
                totalPages: 1,
                sortBy: normalizedSortBy,
                order: normalizedOrder,
            },
        };
    }

    const includeGeneInfo = await hasGeneInfoTable();
    const whereSql = 'WHERE gpte.gene_symbol = ? OR gpte.ensg_id = ?';
    const whereParams = [q, q];
    const orderBySql = buildGeneRecordOrderBy(sortBy, order);
    const geneInfoSelect = buildGeneInfoSelect(includeGeneInfo);
    const geneInfoJoin = buildGeneInfoJoin(includeGeneInfo);

    try {
        const countQuery = pool.query(
            `SELECT COUNT(*) AS total_rows
             FROM gene_program_trait_edge gpte
             ${whereSql}`,
            whereParams,
        );

        const recordsQuery = pool.query(
            `SELECT
                gpte.*,
                ${geneInfoSelect}
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
                COALESCE(fm_trait.file_id, fm_gwas.file_id, fm_file.file_id, gpte.file_id) AS joined_file_id,
                COALESCE(fm_trait.gwas_id, fm_gwas.gwas_id, fm_file.gwas_id, '') AS gwas_id,
                COALESCE(fm_trait.trait_name, fm_gwas.trait_name, fm_file.trait_name, '') AS trait_name,
                pi.curated_annotation,
                pi.representative_go,
                pi.go_enrichment_p,
                pi.top10_pathways
             FROM gene_program_trait_edge gpte
             LEFT JOIN trait_program_edge tpe
                ON BINARY tpe.trait_id = BINARY gpte.trait_id
                    AND BINARY tpe.program = BINARY gpte.program
             LEFT JOIN file_metadata fm_trait
                ON BINARY fm_trait.file_id = BINARY gpte.trait_id
             LEFT JOIN file_metadata fm_gwas
                ON BINARY fm_gwas.gwas_id = BINARY gpte.trait_id
             LEFT JOIN file_metadata fm_file
                ON BINARY fm_file.file_id = BINARY gpte.file_id
             LEFT JOIN program_info pi
                ON BINARY pi.program = BINARY gpte.program
             ${geneInfoJoin}
             ${whereSql}
             ${orderBySql}
             LIMIT ? OFFSET ?`,
            [...whereParams, l, offset],
        );

        const [
            [[countRow]],
            [rows],
        ] = await Promise.all([countQuery, recordsQuery]);

        const records = rows.map((row) => normalizeRecord({
            ...row,
            file_id: row.joined_file_id || row.file_id,
        }));
        const totalCount = Number(countRow?.total_rows) || 0;

        return {
            query: q,
            records,
            recordPage: {
                page: p,
                limit: l,
                totalCount,
                totalPages: Math.max(1, Math.ceil(totalCount / l)),
                sortBy: normalizedSortBy,
                order: normalizedOrder,
            },
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                query: q,
                records: [],
                recordPage: {
                    page: p,
                    limit: l,
                    totalCount: 0,
                    totalPages: 1,
                    sortBy: normalizedSortBy,
                    order: normalizedOrder,
                },
            });
        }
        throw err;
    }
}

async function getGenePrograms(geneId, options = {}) {
    const [overview, recordPayload] = await Promise.all([
        getGeneOverview(geneId),
        getGeneProgramRecords(geneId, options),
    ]);

    if (overview?.unavailable || recordPayload?.unavailable) {
        return emptyUnavailable({
            query: overview?.query || recordPayload?.query || normalizeGeneQuery(geneId),
            gene: overview?.gene || { geneSymbol: normalizeGeneQuery(geneId), ensgId: '' },
            summary: overview?.summary || buildSummary([]),
            genes: overview?.genes || [],
            programs: overview?.programs || [],
            records: recordPayload?.records || [],
            recordPage: recordPayload?.recordPage || {
                page: Math.max(1, Number(options?.page) || 1),
                limit: Math.max(1, Math.min(250, Number(options?.limit) || 50)),
                totalCount: 0,
                totalPages: 1,
                sortBy: normalizeGeneRecordSortBy(options?.sortBy),
                order: normalizeSortDirection(options?.order),
            },
        });
    }

    return {
        ...overview,
        records: recordPayload.records,
        recordPage: recordPayload.recordPage,
    };
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
                COALESCE(fm_trait.file_id, fm_gwas.file_id, fm_file.file_id, tpe.file_id) AS joined_file_id,
                COALESCE(fm_trait.gwas_id, fm_gwas.gwas_id, fm_file.gwas_id, '') AS gwas_id,
                COALESCE(fm_trait.trait_name, fm_gwas.trait_name, fm_file.trait_name, '') AS trait_name,
                pi.curated_annotation
             FROM trait_program_edge tpe
             LEFT JOIN file_metadata fm_trait
                ON BINARY fm_trait.file_id = BINARY tpe.trait_id
             LEFT JOIN file_metadata fm_gwas
                ON BINARY fm_gwas.gwas_id = BINARY tpe.trait_id
             LEFT JOIN file_metadata fm_file
                ON BINARY fm_file.file_id = BINARY tpe.file_id
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
                    gene_label,
                    score
                 FROM (
                    SELECT
                        ranked.*,
                        ROW_NUMBER() OVER (PARTITION BY ranked.trait_id ORDER BY ranked.score DESC, ranked.gene_label ASC) AS row_num
                    FROM (
                        SELECT
                            trait_id,
                            COALESCE(NULLIF(gene_symbol, ''), ensg_id) AS gene_label,
                            MAX(GREATEST(COALESCE(abs_gamma, 0), ABS(COALESCE(membership_score, 0)))) AS score
                         FROM gene_program_trait_edge
                         WHERE program = ?
                         GROUP BY trait_id, COALESCE(NULLIF(gene_symbol, ''), ensg_id)
                    ) ranked
                 ) top_ranked
                 WHERE row_num <= 8
                 ORDER BY trait_id ASC, row_num ASC`,
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
            fileId: row.joined_file_id || row.file_id,
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

async function getProgramGenes(programId) {
    const program = normalizeProgramId(programId);
    if (!program) {
        return {
            program: { id: '', annotation: '' },
            genes: [],
            summary: { totalGenes: 0 },
        };
    }

    const includeGeneInfo = await hasGeneInfoTable();
    const geneInfoSelect = includeGeneInfo ? `
                MAX(gi.symbol) AS symbol,
                MAX(gi.chromosome) AS chromosome,
                MAX(gi.begin_pos) AS begin_pos,
                MAX(gi.end_pos) AS end_pos,
                MAX(gi.gene_type) AS gene_type,` : `
                '' AS symbol,
                '' AS chromosome,
                NULL AS begin_pos,
                NULL AS end_pos,
                '' AS gene_type,`;
    const geneInfoJoin = includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : '';

    try {
        const [rows] = await pool.query(
            `SELECT
                MAX(gpte.gene_symbol) AS gene_symbol,
                MAX(gpte.ensg_id) AS ensg_id,
                ${geneInfoSelect}
                GROUP_CONCAT(DISTINCT gpte.role SEPARATOR ',') AS roles,
                GROUP_CONCAT(DISTINCT CASE
                    WHEN gpte.role = 'program' THEN COALESCE(NULLIF(gpte.gamma_sign, ''), NULLIF(gpte.predicted_sign, ''), NULLIF(gpte.post_mean_sign, ''), '-')
                    ELSE NULL
                END SEPARATOR ',') AS program_signs,
                GROUP_CONCAT(DISTINCT CASE
                    WHEN gpte.role = 'regulator' THEN COALESCE(NULLIF(gpte.regulator_program_sign, ''), NULLIF(gpte.predicted_sign, ''), NULLIF(gpte.post_mean_sign, ''), NULLIF(gpte.gamma_sign, ''), '-')
                    ELSE NULL
                END SEPARATOR ',') AS regulator_signs,
                MAX(GREATEST(
                    ABS(COALESCE(gpte.membership_score, 0)),
                    ABS(COALESCE(gpte.abs_gamma, 0)),
                    ABS(COALESCE(gpte.post_mean, 0))
                )) AS value,
                MIN(gpte.rank_within_side) AS rank_within_side,
                COUNT(DISTINCT gpte.trait_id) AS total_traits
             FROM gene_program_trait_edge gpte
             ${geneInfoJoin}
             WHERE gpte.program = ?
                AND COALESCE(NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_label, '')) IS NOT NULL
             GROUP BY COALESCE(NULLIF(gpte.ensg_id, ''), NULLIF(gpte.gene_symbol, ''), NULLIF(gpte.gene_label, ''))
             ORDER BY
                value DESC,
                MIN(gpte.rank_within_side) ASC,
                COALESCE(NULLIF(MAX(gpte.gene_symbol), ''), NULLIF(MAX(gpte.ensg_id), '')) ASC`,
            [program],
        );

        const [programRows] = await pool.query(
            `SELECT
                program,
                curated_annotation,
                representative_go,
                go_enrichment_p
             FROM program_info
             WHERE program = ?
             LIMIT 1`,
            [program],
        ).catch((err) => {
            if (isMissingIndexTableError(err)) return [[]];
            throw err;
        });

        const genes = rows.map((row) => normalizeProgramGeneRow(row));
        const programInfo = programRows[0] || {};

        return {
            program: {
                id: program,
                annotation: programInfo.curated_annotation || '',
                representativeGo: programInfo.representative_go || '',
                goEnrichmentP: programInfo.go_enrichment_p || '',
            },
            genes,
            summary: {
                totalGenes: genes.length,
                maxTraitSupport: genes.reduce((max, gene) => Math.max(max, Number(gene.totalTraits) || 0), 0),
            },
        };
    } catch (err) {
        if (isMissingIndexTableError(err)) {
            return emptyUnavailable({
                program: { id: program, annotation: '' },
                genes: [],
                summary: { totalGenes: 0 },
            });
        }
        throw err;
    }
}

async function warmGeneSummaryCache() {
    try {
        const includeGeneInfo = await hasGeneInfoTable();
        await getGeneSummaryCache(includeGeneInfo);
    } catch (err) {
        if (!isMissingIndexTableError(err)) {
            console.warn(`Gene summary cache warmup failed: ${err.message}`);
        }
    }
}

module.exports = {
    getGenes,
    getGeneOverview,
    getGeneProgramRecords,
    getRecommendedGenes,
    getGenePrograms,
    getProgramGenes,
    getProgramTraits,
    normalizeProgramId,
    searchGenes,
    warmGeneSummaryCache,
};
