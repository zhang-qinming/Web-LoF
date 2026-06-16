const express = require('express');
const pool = require('../models/db');
const { createFileStore, buildHttpError } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute, throwIfAborted } = require('../lib/http');
const { normalizeIdentifier, normalizeSafeBaseNameList, parsePositiveInt } = require('../lib/request');
const { parseTsvStream } = require('../lib/tsv');
const {
    DEFAULT_MIN_SHARED_GENES,
    buildCorrelationMatrix,
    buildEffectProfile,
} = require('../lib/correlation');
const { getTraitEffectNeighbors } = require('../lib/traitEffectNeighbors');

const router = express.Router();

const metaTraitsStore = createFileStore(`${config.paths.crossTraitHeatmapDir}/meta/traits`);
const effectsStore = createFileStore(`${config.paths.crossTraitHeatmapDir}/tables/effects`);

const DEFAULT_TOP_GENES = 25;
const MAX_TOP_GENES = 100;
const MAX_TARGET_IDS = 100;
const RECOMMENDED_TARGET_LIMIT = 100;
const MIN_RECOMMENDED_SHARED_GENES = 1000;
const SIGNIFICANT_TARGET_CANDIDATE_LIMIT = 200;
const DEFAULT_SEARCH_LIMIT = 12;
const MAX_SEARCH_LIMIT = 30;
const EFFECT_CACHE_TTL_MS = 2 * 60 * 1000;
const TARGET_CACHE_TTL_MS = 5 * 60 * 1000;
const CURATED_RECOMMENDED_TARGET_IDS = [
    'GCST90081632', // hypertension
    'GCST90081711', // type 2 diabetes
    'GCST90083719', // type 1 diabetes
    'GCST90081644', // myocardial infarction
    'GCST90084022', // stroke
    'GCST90083752', // hypercholesterolemia
    'GCST90083750', // overweight and obesity
    'GCST90083786', // schizophrenia
    'GCST90083805', // Alzheimer's disease
    'GCST90083803', // Parkinson's disease
    'GCST90084127', // asthma
    'GCST90081860', // rheumatoid arthritis
    'GCST90082286', // smoking status
    'GCST90081543', // coffee consumed
    'GCST90083791', // major depressive disorder
    'GCST90084570', // chronic kidney disease
    'GCST90081868', // atrial fibrillation
    'GCST90081732', // migraine
];

const effectRowsCache = new Map();
const effectIndexCache = new Map();
const effectProfileCache = new Map();
const recommendedTargetsCache = new Map();

function isMissingStoreError(err) {
    return Boolean(
        err
        && (
            err.code === 'ENOENT'
            || err.code === 2
            || /no such file/i.test(err.message || '')
            || /does not exist/i.test(err.message || '')
        )
    );
}

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeSearch(value) {
    const cleaned = String(value || '').trim();
    return cleaned ? cleaned.slice(0, 200) : '';
}

function normalizeTraitId(value) {
    return normalizeIdentifier(value, 255);
}

function pickTraitIdCandidates(fileId, meta) {
    return [...new Set([
        normalizeTraitId(meta?.file_id),
        normalizeTraitId(fileId),
        normalizeTraitId(meta?.gwas_id),
    ].filter(Boolean))];
}

function buildTraitOption(meta, fallbackId) {
    const fileId = normalizeTraitId(meta?.file_id) || normalizeTraitId(fallbackId);
    const gwasId = normalizeTraitId(meta?.gwas_id) || fileId;
    const traitName = String(meta?.trait_name || '').replace(/^["'\s]+|["'\s]+$/g, '');
    return {
        file_id: fileId,
        gwas_id: gwasId,
        trait_name: traitName || fileId || gwasId || '',
        n_sig: toFiniteNumber(meta?.n_sig),
        sample_size: toFiniteNumber(meta?.sample_size),
        selection_rank: toFiniteNumber(meta?.selection_rank),
        selection_basis: meta?.selection_basis || null,
        correlation: toFiniteNumber(meta?.correlation),
        shared_genes: toFiniteNumber(meta?.shared_genes),
    };
}

function getFreshCache(cache, key, ttlMs) {
    const cached = cache.get(key);
    if (!cached) return null;
    if ((Date.now() - cached.at) > ttlMs) {
        cache.delete(key);
        return null;
    }
    return cached.value;
}

function setCache(cache, key, value) {
    cache.set(key, { at: Date.now(), value });
}

async function listStoreEntries(store) {
    try {
        return await store.list(store.rootPath);
    } catch (err) {
        if (isMissingStoreError(err)) return [];
        throw err;
    }
}

async function getTraitMetaById(traitId) {
    const safeTraitId = normalizeTraitId(traitId);
    if (!safeTraitId) return null;

    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name
         FROM file_metadata fm
         WHERE fm.file_id = ? OR fm.gwas_id = ?
         LIMIT 1`,
        [safeTraitId, safeTraitId],
    );
    return rows[0] || null;
}

async function searchTraits(query, limit = DEFAULT_SEARCH_LIMIT, excludeIds = []) {
    const searchText = normalizeSearch(query);
    if (!searchText) return [];

    const like = `%${escapeLike(searchText)}%`;
    const params = [like, like, like];
    const excluded = [...new Set(excludeIds.filter(Boolean))];
    let excludeSql = '';
    if (excluded.length > 0) {
        const placeholders = excluded.map(() => '?').join(', ');
        excludeSql = `AND fm.file_id NOT IN (${placeholders})
           AND (fm.gwas_id IS NULL OR fm.gwas_id NOT IN (${placeholders}))`;
        params.push(...excluded, ...excluded);
    }
    params.push(limit);

    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name
         FROM file_metadata fm
         WHERE fm.trait_name IS NOT NULL
           AND fm.trait_name != ''
           AND (
               fm.trait_name LIKE ? ESCAPE '\\\\'
               OR fm.file_id LIKE ? ESCAPE '\\\\'
               OR fm.gwas_id LIKE ? ESCAPE '\\\\'
           )
           ${excludeSql}
         ORDER BY fm.trait_name ASC
         LIMIT ?`,
        params,
    );

    return rows;
}

async function getTraitMetaMapByIds(ids) {
    const safeIds = [...new Set(ids.map((item) => normalizeTraitId(item)).filter(Boolean))];
    if (!safeIds.length) return new Map();

    const placeholders = safeIds.map(() => '?').join(', ');
    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.n_sig, gm.sample_size
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         WHERE fm.file_id IN (${placeholders}) OR fm.gwas_id IN (${placeholders})`,
        [...safeIds, ...safeIds],
    );

    const map = new Map();
    rows.forEach((row) => {
        if (row.file_id) map.set(row.file_id, row);
        if (row.gwas_id) map.set(row.gwas_id, row);
    });
    return map;
}

async function readTsvRows(store, fileName, { signal = null } = {}) {
    throwIfAborted(signal);
    const fullPath = store.resolve(fileName);
    if (!fullPath) return null;

    const stat = await store.stat(fullPath);
    if (!stat || !stat.isFile) return null;
    if (stat.size > config.data.maxTsvFileBytes) {
        throw buildHttpError(413, 'TSV file is too large');
    }

    throwIfAborted(signal);
    const stream = await store.createReadStream(fullPath);
    return parseTsvStream(stream, { maxRows: config.data.maxTsvRows, signal });
}

async function readTraitMetaRow(traitId, options = {}) {
    return readTsvRows(metaTraitsStore, `${traitId}.tsv`, options);
}

async function getEffectRows(traitId, { signal = null } = {}) {
    throwIfAborted(signal);
    const safeTraitId = normalizeTraitId(traitId);
    if (!safeTraitId) return null;

    const cached = getFreshCache(effectRowsCache, safeTraitId, EFFECT_CACHE_TTL_MS);
    if (cached) return cached;

    const rows = await readTsvRows(effectsStore, `${safeTraitId}.tsv`, { signal });
    if (!rows) return null;
    throwIfAborted(signal);
    setCache(effectRowsCache, safeTraitId, rows);
    return rows;
}

async function getEffectIndex(traitId, { signal = null } = {}) {
    throwIfAborted(signal);
    const safeTraitId = normalizeTraitId(traitId);
    if (!safeTraitId) return null;

    const cached = getFreshCache(effectIndexCache, safeTraitId, EFFECT_CACHE_TTL_MS);
    if (cached) return cached;

    const rows = await getEffectRows(safeTraitId, { signal });
    if (!rows) return null;
    throwIfAborted(signal);
    const index = buildEffectIndex(rows);
    setCache(effectIndexCache, safeTraitId, index);
    return index;
}

async function getCachedEffectProfile(traitId, { signal = null } = {}) {
    throwIfAborted(signal);
    const safeTraitId = normalizeTraitId(traitId);
    if (!safeTraitId) return null;

    const cached = getFreshCache(effectProfileCache, safeTraitId, EFFECT_CACHE_TTL_MS);
    if (cached) return cached;

    const rows = await getEffectRows(safeTraitId, { signal });
    if (!rows) return null;
    const profile = buildEffectProfile(rows, { signal });
    setCache(effectProfileCache, safeTraitId, profile);
    return profile;
}

function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toGeneKey(row) {
    const gene = String(row.gene || '').trim();
    const ensg = String(row.ensg || '').trim();
    return gene || ensg || null;
}

function buildEffectIndex(rows) {
    const index = new Map();
    rows.forEach((row) => {
        const key = toGeneKey(row);
        if (!key || index.has(key)) return;
        index.set(key, {
            ensg: String(row.ensg || '').trim(),
            gene: String(row.gene || '').trim(),
            postMean: toFiniteNumber(row.post_mean),
        });
    });
    return index;
}

function buildTopGenes(rows, limit) {
    return rows
        .map((row) => ({
            ensg: String(row.ensg || '').trim(),
            gene: String(row.gene || '').trim(),
            sourcePostMean: toFiniteNumber(row.post_mean),
            geneKey: toGeneKey(row),
        }))
        .filter((row) => row.geneKey && row.sourcePostMean != null)
        .sort((a, b) => Math.abs(b.sourcePostMean) - Math.abs(a.sourcePostMean))
        .slice(0, limit);
}

function summarizeMatrix(matrix) {
    let missingCells = 0;
    let min = null;
    let max = null;

    matrix.forEach((row) => {
        row.forEach((value) => {
            if (value == null) {
                missingCells += 1;
                return;
            }
            min = min == null ? value : Math.min(min, value);
            max = max == null ? value : Math.max(max, value);
        });
    });

    return {
        missingCells,
        valueRange: { min, max },
    };
}

async function getAvailableEffectTraitIds() {
    const effectEntries = await listStoreEntries(effectsStore);
    return effectEntries
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.tsv'))
        .map((entry) => entry.name.replace(/\.tsv$/i, ''))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
}

async function getSignificantTraitCandidates(limit = SIGNIFICANT_TARGET_CANDIDATE_LIMIT) {
    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.n_sig, gm.sample_size, gm.qc_score
         FROM file_metadata fm
         JOIN gwas_meta gm ON gm.file_id = fm.file_id
         WHERE gm.n_sig IS NOT NULL
         ORDER BY gm.n_sig DESC, gm.qc_score DESC, gm.sample_size DESC, fm.file_id ASC
         LIMIT ?`,
        [limit],
    );
    return rows;
}

async function getRecommendedTargets(sourceTraitId, { signal = null } = {}) {
    throwIfAborted(signal);
    const safeSourceId = normalizeTraitId(sourceTraitId);
    const cached = getFreshCache(recommendedTargetsCache, safeSourceId, TARGET_CACHE_TTL_MS);
    if (cached) return cached;

    const availableIds = await getAvailableEffectTraitIds();
    throwIfAborted(signal);
    const availableIdSet = new Set(availableIds);
    const sourceMetaMap = await getTraitMetaMapByIds([safeSourceId]);
    const sourceMeta = sourceMetaMap.get(safeSourceId);
    const sourceIds = new Set(pickTraitIdCandidates(safeSourceId, sourceMeta));
    let neighborResult = null;
    try {
        neighborResult = await getTraitEffectNeighbors(
            config.paths.traitEffectNeighborsFile,
            [...sourceIds],
            RECOMMENDED_TARGET_LIMIT,
        );
    } catch (err) {
        console.warn(`Failed to load Trait Effect neighbors: ${err.message}`);
    }

    const recommendedIds = [];
    const recommendedMeta = new Map();

    const addAvailableId = (traitId, meta = null, selectionBasis = null) => {
        const candidates = pickTraitIdCandidates(traitId, meta);
        const availableId = candidates.find((candidate) => availableIdSet.has(candidate));
        if (!availableId || sourceIds.has(availableId) || recommendedIds.includes(availableId)) return;
        recommendedIds.push(availableId);
        recommendedMeta.set(availableId, {
            ...(meta || {}),
            selection_rank: recommendedIds.length,
            selection_basis: selectionBasis,
        });
    };

    (neighborResult?.rows || []).forEach((row, index) => {
        if (index % 100 === 0) throwIfAborted(signal);
        if (recommendedIds.length >= RECOMMENDED_TARGET_LIMIT) return;
        if ((row.shared_genes || 0) < MIN_RECOMMENDED_SHARED_GENES) return;
        addAvailableId(row.target_id, {
            correlation: row.correlation,
            shared_genes: row.shared_genes,
        }, 'trait_effect_similarity');
    });

    if (recommendedIds.length < RECOMMENDED_TARGET_LIMIT) {
        const significantCandidates = await getSignificantTraitCandidates();
        significantCandidates.forEach((row, index) => {
            if (index % 100 === 0) throwIfAborted(signal);
            if (recommendedIds.length >= RECOMMENDED_TARGET_LIMIT) return;
            addAvailableId(row.file_id || row.gwas_id, row, 'gwas_significant_loci_fallback');
        });
    }

    if (recommendedIds.length < RECOMMENDED_TARGET_LIMIT) {
        const curatedMetaMap = await getTraitMetaMapByIds(CURATED_RECOMMENDED_TARGET_IDS);
        CURATED_RECOMMENDED_TARGET_IDS.forEach((traitId, index) => {
            if (index % 100 === 0) throwIfAborted(signal);
            if (recommendedIds.length >= RECOMMENDED_TARGET_LIMIT) return;
            addAvailableId(traitId, curatedMetaMap.get(traitId), 'curated_fallback');
        });
    }

    if (recommendedIds.length < RECOMMENDED_TARGET_LIMIT) {
        availableIds.forEach((traitId, index) => {
            if (index % 100 === 0) throwIfAborted(signal);
            if (recommendedIds.length >= RECOMMENDED_TARGET_LIMIT) return;
            addAvailableId(traitId, null, 'available_fallback');
        });
    }

    const limitedIds = recommendedIds.slice(0, RECOMMENDED_TARGET_LIMIT);
    throwIfAborted(signal);
    const metaMap = await getTraitMetaMapByIds(limitedIds);
    const enriched = limitedIds.map((traitId) => buildTraitOption(
        {
            ...(metaMap.get(traitId) || {}),
            ...(recommendedMeta.get(traitId) || {}),
        },
        traitId,
    ));

    setCache(recommendedTargetsCache, safeSourceId, enriched);
    return enriched;
}

router.get('/api/cross-trait/search', asyncRoute(async (req, res) => {
    const q = normalizeSearch(req.query.q || req.query.query);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const excludeIds = normalizeSafeBaseNameList(req.query.excludeId);

    if (!q) {
        return res.json({ query: '', totalTraits: 0, traits: [] });
    }

    const rows = await searchTraits(q, limit, excludeIds);
    res.json({ query: q, totalTraits: rows.length, traits: rows });
}));

router.get('/api/cross-trait/:fileId/status', asyncRoute(async (req, res) => {
    const { abortSignal: signal } = req;
    const fileId = normalizeTraitId(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const meta = await getTraitMetaById(fileId);
    const candidates = pickTraitIdCandidates(fileId, meta);
    let resolvedTraitId = '';
    let hasMeta = Boolean(meta);
    let hasEffects = false;

    for (const candidate of candidates) {
        throwIfAborted(signal);
        const [metaRow, effectRows] = await Promise.all([
            readTraitMetaRow(candidate, { signal }),
            getEffectRows(candidate, { signal }),
        ]);
        if (!resolvedTraitId && (metaRow || effectRows)) resolvedTraitId = candidate;
        if (metaRow) hasMeta = true;
        if (effectRows) hasEffects = true;
        if (hasMeta && hasEffects) break;
    }

    throwIfAborted(signal);
    res.json({
        fileId,
        resolvedTraitId: resolvedTraitId || candidates[0] || fileId,
        hasMeta,
        hasEffects,
        available: hasEffects,
    });
}));

router.get('/api/cross-trait/:fileId/targets', asyncRoute(async (req, res) => {
    const { abortSignal: signal } = req;
    const fileId = normalizeTraitId(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const meta = await getTraitMetaById(fileId);
    const candidates = pickTraitIdCandidates(fileId, meta);
    let resolvedSourceId = candidates[0] || fileId;
    for (const candidate of candidates) {
        throwIfAborted(signal);
        const rows = await getEffectRows(candidate, { signal });
        if (!rows) continue;
        resolvedSourceId = candidate;
        break;
    }
    throwIfAborted(signal);
    const targets = await getRecommendedTargets(resolvedSourceId, { signal });
    const similarityTargetCount = targets.filter(
        (target) => target.selection_basis === 'trait_effect_similarity',
    ).length;

    throwIfAborted(signal);
    res.json({
        fileId,
        resolvedTraitId: resolvedSourceId,
        targets,
        recommendation: {
            primaryBasis: similarityTargetCount > 0
                ? 'trait_effect_similarity'
                : targets[0]?.selection_basis || null,
            similarityTargetCount,
            fallbackTargetCount: targets.length - similarityTargetCount,
            returnedTargetCount: targets.length,
            minimumSharedGenes: MIN_RECOMMENDED_SHARED_GENES,
        },
    });
}));

router.get('/api/cross-trait/:fileId/matrix', asyncRoute(async (req, res) => {
    const { abortSignal: signal } = req;
    const fileId = normalizeTraitId(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const topGenes = Math.min(parsePositiveInt(req.query.topGenes, DEFAULT_TOP_GENES, MAX_TOP_GENES), MAX_TOP_GENES);
    const targetIds = normalizeSafeBaseNameList(req.query.targetIds).slice(0, MAX_TARGET_IDS);

    if (!targetIds.length) {
        return res.json({
            sourceTrait: null,
            targets: [],
            genes: [],
            matrix: [],
            summary: {
                topGenes,
                targetCount: 0,
                skippedTargets: 0,
                missingCells: 0,
                valueRange: { min: null, max: null },
            },
        });
    }

    const sourceMeta = await getTraitMetaById(fileId);
    const sourceCandidates = pickTraitIdCandidates(fileId, sourceMeta);
    let sourceTraitId = sourceCandidates[0] || fileId;
    let sourceRows = null;
    for (const candidate of sourceCandidates) {
        throwIfAborted(signal);
        sourceRows = await getEffectRows(candidate, { signal });
        if (sourceRows) {
            sourceTraitId = candidate;
            break;
        }
    }

    if (!sourceRows) return res.status(404).json({ error: 'Cross-trait heatmap data not found' });

    const topGeneRows = buildTopGenes(sourceRows, topGenes);
    const targetMetaMap = await getTraitMetaMapByIds(targetIds);
    const targetMetaRows = [];
    const targetIndexes = [];
    let skippedTargets = 0;

    for (const targetId of targetIds) {
        throwIfAborted(signal);
        const metaRow = targetMetaMap.get(targetId);
        const candidates = pickTraitIdCandidates(targetId, metaRow);
        let targetIndex = null;
        let resolvedTargetId = candidates[0] || targetId;

        for (const candidate of candidates) {
            throwIfAborted(signal);
            targetIndex = await getEffectIndex(candidate, { signal });
            if (targetIndex) {
                resolvedTargetId = candidate;
                break;
            }
        }

        if (!targetIndex) {
            skippedTargets += 1;
            continue;
        }
        targetIndexes.push(targetIndex);
        targetMetaRows.push(buildTraitOption(targetMetaMap.get(resolvedTargetId) || metaRow, resolvedTargetId));
    }

    const matrix = topGeneRows.map((geneRow) => targetIndexes.map((index) => {
        throwIfAborted(signal);
        const targetGene = index.get(geneRow.geneKey);
        return targetGene ? targetGene.postMean : null;
    }));

    const valueSummary = summarizeMatrix(matrix);
    const sourceTrait = buildTraitOption(sourceMeta, sourceTraitId);

    throwIfAborted(signal);
    res.json({
        sourceTrait,
        targets: targetMetaRows,
        genes: topGeneRows.map(({ geneKey, ...row }) => row),
        matrix,
        summary: {
            topGenes: topGeneRows.length,
            targetCount: targetMetaRows.length,
            skippedTargets,
            ...valueSummary,
        },
    });
}));

router.get('/api/cross-trait/:fileId/correlation', asyncRoute(async (req, res) => {
    const { abortSignal: signal } = req;
    const fileId = normalizeTraitId(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const method = String(req.query.method || 'spearman').trim().toLowerCase();
    if (!['pearson', 'spearman'].includes(method)) {
        return res.status(400).json({ error: 'Correlation method must be pearson or spearman' });
    }

    const targetIds = normalizeSafeBaseNameList(req.query.targetIds).slice(0, MAX_TARGET_IDS);
    const sourceMeta = await getTraitMetaById(fileId);
    const sourceCandidates = pickTraitIdCandidates(fileId, sourceMeta);
    let sourceTraitId = sourceCandidates[0] || fileId;
    let sourceRows = null;
    let sourceProfile = null;

    for (const candidate of sourceCandidates) {
        throwIfAborted(signal);
        sourceRows = await getEffectRows(candidate, { signal });
        if (!sourceRows) continue;
        sourceTraitId = candidate;
        sourceProfile = await getCachedEffectProfile(candidate, { signal });
        break;
    }

    if (!sourceRows) return res.status(404).json({ error: 'Trait effect data not found' });

    const targetMetaMap = await getTraitMetaMapByIds(targetIds);
    const sourceIdentity = new Set(pickTraitIdCandidates(sourceTraitId, sourceMeta));
    sourceIdentity.add(sourceTraitId);

    const targetRequests = targetIds.map((targetId) => {
        const metaRow = targetMetaMap.get(targetId);
        const candidates = pickTraitIdCandidates(targetId, metaRow);
        return { targetId, metaRow, candidates };
    }).filter(({ candidates }) => !candidates.some((candidate) => sourceIdentity.has(candidate)));

    const loadedTargets = await Promise.all(targetRequests.map(async ({ metaRow, candidates }) => {
        for (const candidate of candidates) {
            throwIfAborted(signal);
            const profile = await getCachedEffectProfile(candidate, { signal });
            if (!profile) continue;
            return {
                resolvedTraitId: candidate,
                meta: metaRow,
                profile,
            };
        }
        return null;
    }));

    const entries = [{
        resolvedTraitId: sourceTraitId,
        meta: sourceMeta,
        profile: sourceProfile || buildEffectProfile(sourceRows, { signal }),
    }];
    const seenIds = new Set(sourceIdentity);

    loadedTargets.forEach((entry) => {
        if (!entry || entries.length >= MAX_TARGET_IDS) return;
        const option = buildTraitOption(entry.meta, entry.resolvedTraitId);
        const identities = [entry.resolvedTraitId, option.file_id, option.gwas_id].filter(Boolean);
        if (identities.some((identity) => seenIds.has(identity))) return;
        identities.forEach((identity) => seenIds.add(identity));
        entries.push(entry);
    });

    const traits = entries.map((entry) => buildTraitOption(entry.meta, entry.resolvedTraitId));
    const profiles = entries.map((entry) => entry.profile);
    const correlation = buildCorrelationMatrix(profiles, method, DEFAULT_MIN_SHARED_GENES, { signal });
    const geneCounts = profiles.map((profile) => profile.geneCount);

    throwIfAborted(signal);
    res.json({
        sourceTrait: traits[0],
        traits,
        matrix: correlation.matrix,
        sharedGeneCounts: correlation.sharedGeneCounts,
        summary: {
            method,
            minSharedGenes: DEFAULT_MIN_SHARED_GENES,
            traitCount: traits.length,
            requestedTraitCount: targetRequests.length + 1,
            skippedTraits: Math.max(0, targetRequests.length - (traits.length - 1)),
            profileGeneRange: {
                min: geneCounts.length ? Math.min(...geneCounts) : null,
                max: geneCounts.length ? Math.max(...geneCounts) : null,
            },
            ...correlation.summary,
        },
    });
}));

module.exports = router;
