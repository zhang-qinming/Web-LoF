const pool = require('./db');

const TABLE_MISSING_CODES = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR']);
const GENE_INFO_TABLE = 'gene_info_hg37_matched';
const EXTERNAL_GENE_INFO_TTL_MS = 24 * 60 * 60 * 1000;
const EXTERNAL_FETCH_TIMEOUT_MS = 4500;
const GENE_SUMMARY_CACHE_TTL_MS = 60 * 60 * 1000;
const ENSEMBL_REST_BASES = ['https://grch37.rest.ensembl.org', 'https://rest.ensembl.org'];
const externalGeneInfoCache = new Map();
let geneInfoTableAvailablePromise = null;
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

function normalizeChromosomeLabel(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.includes('_') || text.includes('.')) return text;
    if (/^chr/i.test(text)) return `chr${text.replace(/^chr/i, '')}`;
    return `chr${text}`;
}

function normalizeGeneType(value) {
    return String(value || '').trim().replace(/_/g, '-');
}

function formatLocation(chromosome, beginPos, endPos) {
    const chr = normalizeChromosomeLabel(chromosome);
    const begin = Number.isFinite(beginPos) ? Math.trunc(beginPos) : null;
    const end = Number.isFinite(endPos) ? Math.trunc(endPos) : null;

    if (!chr) return '';
    if (begin == null || end == null) return chr;
    return `${chr}:${begin}-${end}`;
}

function stripSourceSuffix(value) {
    return String(value || '').replace(/\s*\[Source:.*?\]\s*$/i, '').trim();
}

async function fetchJsonWithTimeout(url, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function normalizeEnsemblPayload(payload) {
    if (!payload || payload.object_type !== 'Gene') return null;
    const beginPos = toNullableNumber(payload.start);
    const endPos = toNullableNumber(payload.end);
    return {
        geneSymbol: payload.display_name || '',
        ensgId: payload.id || '',
        chromosome: payload.seq_region_name || '',
        beginPos,
        endPos,
        location: formatLocation(payload.seq_region_name, beginPos, endPos),
        geneType: normalizeGeneType(payload.biotype),
        geneName: stripSourceSuffix(payload.description),
        description: stripSourceSuffix(payload.description),
        externalSources: ['Ensembl'],
    };
}

async function fetchEnsemblGeneInfo(query) {
    const q = normalizeGeneQuery(query);
    if (!q) return null;
    const isEnsemblId = /^ENSG\d+/i.test(q);

    for (const baseUrl of ENSEMBL_REST_BASES) {
        const endpoint = isEnsemblId
            ? `${baseUrl}/lookup/id/${encodeURIComponent(q)}?content-type=application/json`
            : `${baseUrl}/lookup/symbol/homo_sapiens/${encodeURIComponent(q)}?content-type=application/json`;
        const payload = await fetchJsonWithTimeout(endpoint);
        const normalized = normalizeEnsemblPayload(payload);
        if (normalized) return normalized;
    }

    return null;
}

function normalizeNcbiGeneSummary(summary, uid) {
    if (!summary) return null;
    const genomic = Array.isArray(summary.genomicinfo) ? summary.genomicinfo[0] : null;
    const beginPos = genomic ? toNullableNumber(Math.min(Number(genomic.chrstart), Number(genomic.chrstop))) : null;
    const endPos = genomic ? toNullableNumber(Math.max(Number(genomic.chrstart), Number(genomic.chrstop))) : null;
    const chromosome = summary.chromosome || genomic?.chraccver || '';

    return {
        geneSymbol: summary.nomenclaturesymbol || summary.name || '',
        geneName: summary.description || '',
        geneId: String(summary.uid || uid || ''),
        chromosome,
        beginPos,
        endPos,
        location: chromosome ? formatLocation(chromosome, beginPos, endPos) : (summary.maplocation || ''),
        synonyms: summary.otheraliases || '',
        description: summary.summary || summary.description || '',
        externalSources: ['NCBI'],
    };
}

async function fetchNcbiGeneInfo(query) {
    const q = normalizeGeneQuery(query);
    if (!q) return null;
    const term = /^ENSG\d+/i.test(q)
        ? `${q}[All Fields] AND Homo sapiens[orgn]`
        : `${q}[sym] AND Homo sapiens[orgn]`;
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=gene&retmode=json&retmax=1&sort=relevance&term=${encodeURIComponent(term)}`;
    const searchPayload = await fetchJsonWithTimeout(searchUrl);
    const uid = searchPayload?.esearchresult?.idlist?.[0];
    if (!uid) return null;

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&retmode=json&id=${encodeURIComponent(uid)}`;
    const summaryPayload = await fetchJsonWithTimeout(summaryUrl);
    return normalizeNcbiGeneSummary(summaryPayload?.result?.[uid], uid);
}

function mergeGeneInfo(baseGene, externalInfo) {
    if (!externalInfo) return baseGene;
    const sources = [
        ...(Array.isArray(baseGene.externalSources) ? baseGene.externalSources : []),
        ...(Array.isArray(externalInfo.externalSources) ? externalInfo.externalSources : []),
    ];

    return {
        ...baseGene,
        geneSymbol: baseGene.geneSymbol || externalInfo.geneSymbol || '',
        ensgId: baseGene.ensgId || externalInfo.ensgId || '',
        chromosome: baseGene.chromosome || externalInfo.chromosome || '',
        beginPos: baseGene.beginPos == null ? externalInfo.beginPos ?? null : baseGene.beginPos,
        endPos: baseGene.endPos == null ? externalInfo.endPos ?? null : baseGene.endPos,
        location: baseGene.location || externalInfo.location || '',
        geneType: baseGene.geneType || externalInfo.geneType || '',
        geneName: baseGene.geneName || externalInfo.geneName || '',
        geneId: baseGene.geneId || externalInfo.geneId || '',
        hgnc: baseGene.hgnc || externalInfo.hgnc || '',
        synonyms: baseGene.synonyms || externalInfo.synonyms || '',
        description: baseGene.description || externalInfo.description || '',
        externalSources: [...new Set(sources)],
    };
}

function needsExternalGeneInfo(gene) {
    return !gene.ensgId || !gene.geneName || !gene.location || !gene.geneType || !gene.description;
}

async function getExternalGeneInfo(query) {
    const q = normalizeGeneQuery(query);
    if (!q) return null;

    const key = q.toUpperCase();
    const cached = externalGeneInfoCache.get(key);
    if (cached && Date.now() - cached.createdAt < EXTERNAL_GENE_INFO_TTL_MS) {
        return cached.value;
    }

    const [ensemblResult, ncbiResult] = await Promise.allSettled([
        fetchEnsemblGeneInfo(q),
        fetchNcbiGeneInfo(q),
    ]);
    const ensemblInfo = ensemblResult.status === 'fulfilled' ? ensemblResult.value : null;
    let ncbiInfo = ncbiResult.status === 'fulfilled' ? ncbiResult.value : null;

    if (!ncbiInfo && ensemblInfo?.geneSymbol && ensemblInfo.geneSymbol.toUpperCase() !== key) {
        ncbiInfo = await fetchNcbiGeneInfo(ensemblInfo.geneSymbol);
    }

    const merged = mergeGeneInfo(mergeGeneInfo({}, ensemblInfo), ncbiInfo);
    const value = Object.keys(merged).length ? merged : null;
    externalGeneInfoCache.set(key, { createdAt: Date.now(), value });
    return value;
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
        .map((role) => (role === 'program' ? 'loading' : 'regulator'))
        .join(' + ') || '-';
    let signLabel = '-';
    if (signs.length === 1) signLabel = signs[0];
    if (signs.length > 1) signLabel = 'mixed';
    const geneDirection = roleLabel === '-' ? signLabel : (signLabel === '-' ? roleLabel : `${roleLabel} / ${signLabel}`);
    const programGeneCountSort = (Number(row.loading_gene_count) || 0) + (Number(row.regulator_gene_count) || 0);

    return {
        geneLabel: row.gene_label || fallbackGeneLabel || row.gene_symbol || row.ensg_id || '',
        geneSymbol: row.gene_symbol || '',
        ensgId: row.ensg_id || '',
        program: row.program || '',
        programAnnotation: row.program_annotation || row.curated_annotation || '-',
        programGoLabel: row.representative_go || row.top10_pathways || '-',
        goEnrichmentP: row.go_enrichment_p || '',
        geneDirection,
        programGeneCountLabel: programGeneCountSort ? programGeneCountSort.toLocaleString() : '-',
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
                MAX(gi.gene_type) AS gene_type,` : `
                '' AS chromosome,
                NULL AS begin_pos,
                NULL AS end_pos,
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

async function getGenes({ page = 1, limit = 25, sortBy = 'totalTraits', order = 'DESC' } = {}) {
    const p = Math.max(1, Number(page) || 1);
    const requestedLimit = Number(limit);
    const exportAll = requestedLimit === 0;
    const l = exportAll ? 0 : Math.max(1, Math.min(200, requestedLimit || 25));
    const offset = exportAll ? 0 : (p - 1) * l;
    const includeGeneInfo = await hasGeneInfoTable();

    try {
        const cache = await getGeneSummaryCache(includeGeneInfo);
        const sortedGenes = [...cache.genes].sort((a, b) => compareGeneSummaryRows(a, b, sortBy, order));
        const genes = exportAll ? sortedGenes : sortedGenes.slice(offset, offset + l);
        const total = sortedGenes.length;

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
                ON gi.ensembl = gpte.ensg_id` : ''}
             WHERE gpte.gene_symbol = ?
                OR gpte.ensg_id = ?
                OR gpte.gene_symbol LIKE ?
                OR gpte.ensg_id LIKE ?
             GROUP BY gene_symbol, ensg_id
             ORDER BY
                (gpte.gene_symbol = ?) DESC,
                (gpte.ensg_id = ?) DESC,
                total_traits DESC,
                total_programs DESC,
                gpte.gene_symbol ASC
             LIMIT ?`,
            [q, q, like, like, q, q, safeLimit],
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

async function getGenePrograms(geneId, {
    page = 1,
    limit = 50,
    sortBy = 'absGamma',
    order = 'DESC',
} = {}) {
    const q = normalizeGeneQuery(geneId);
    if (!q) return { gene: { geneSymbol: '', ensgId: '' }, summary: buildSummary([]), records: [] };

    const p = Math.max(1, Number(page) || 1);
    const l = Math.max(1, Math.min(250, Number(limit) || 50));
    const offset = (p - 1) * l;
    const includeGeneInfo = await hasGeneInfoTable();
    const whereSql = 'WHERE gpte.gene_symbol = ? OR gpte.ensg_id = ?';
    const whereParams = [q, q];
    const orderBySql = buildGeneRecordOrderBy(sortBy, order);
    const normalizedSortBy = normalizeGeneRecordSortBy(sortBy);
    const normalizedOrder = normalizeSortDirection(order);
    const geneInfoSelect = includeGeneInfo ? `
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
    const geneInfoJoin = includeGeneInfo ? `LEFT JOIN ${GENE_INFO_TABLE} gi
                ON BINARY gi.ensembl = BINARY gpte.ensg_id` : '';

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
                MAX(COALESCE(tpe.loading_gene_count, 0)) AS loading_gene_count,
                MAX(COALESCE(tpe.regulator_gene_count, 0)) AS regulator_gene_count,
                COUNT(DISTINCT gpte.trait_id) AS total_traits
             FROM gene_program_trait_edge gpte
             LEFT JOIN trait_program_edge tpe
                ON BINARY tpe.trait_id = BINARY gpte.trait_id
                    AND BINARY tpe.program = BINARY gpte.program
             LEFT JOIN program_info pi
                ON BINARY pi.program = BINARY gpte.program
             ${whereSql}
             GROUP BY gpte.program
             ORDER BY
                total_traits DESC,
                (MAX(COALESCE(tpe.loading_gene_count, 0)) + MAX(COALESCE(tpe.regulator_gene_count, 0))) DESC,
                gpte.program ASC`,
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
            [[summaryRow]],
            [geneRows],
            [programRows],
            [rows],
        ] = await Promise.all([summaryQuery, geneQuery, programRowsQuery, recordsQuery]);

        const records = rows.map((row) => normalizeRecord({
            ...row,
            file_id: row.joined_file_id || row.file_id,
        }));
        const gene = normalizeGeneFromRow(geneRows[0], q);
        const summary = normalizeSummaryRow(summaryRow);
        const programs = programRows.map((row) => normalizeProgramAggregate(row, gene.geneSymbol || gene.ensgId || q));

        let enrichedGene = gene;
        if (needsExternalGeneInfo(gene)) {
            enrichedGene = mergeGeneInfo(gene, await getExternalGeneInfo(q));
        }

        return {
            gene: enrichedGene,
            summary,
            genes: enrichedGene?.geneSymbol || enrichedGene?.ensgId ? [{
                geneSymbol: enrichedGene.geneSymbol || '',
                ensgId: enrichedGene.ensgId || '',
                geneLabel: enrichedGene.geneSymbol || enrichedGene.ensgId || q,
                chromosome: enrichedGene.chromosome || '',
                beginPos: enrichedGene.beginPos == null ? null : enrichedGene.beginPos,
                endPos: enrichedGene.endPos == null ? null : enrichedGene.endPos,
                location: enrichedGene.location || formatLocation(enrichedGene.chromosome, enrichedGene.beginPos, enrichedGene.endPos),
                geneType: enrichedGene.geneType || '',
                totalPrograms: summary.totalPrograms,
                totalTraits: summary.totalTraits,
                roles: {
                    program: summary.programRoleRows,
                    regulator: summary.regulatorRoleRows,
                },
            }] : [],
            programs,
            records,
            recordPage: {
                page: p,
                limit: l,
                totalCount: summary.totalRows,
                totalPages: Math.max(1, Math.ceil(summary.totalRows / l)),
                sortBy: normalizedSortBy,
                order: normalizedOrder,
            },
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
    getRecommendedGenes,
    getGenePrograms,
    getProgramGenes,
    getProgramTraits,
    normalizeProgramId,
    searchGenes,
    warmGeneSummaryCache,
};
