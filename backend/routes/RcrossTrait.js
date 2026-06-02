const express = require('express');
const pool = require('../models/db');
const { createFileStore, buildHttpError } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { normalizeIdentifier, normalizeSafeBaseNameList, parsePositiveInt } = require('../lib/request');
const { parseTsvStream } = require('../lib/tsv');

const router = express.Router();

const metaTraitsStore = createFileStore(`${config.paths.crossTraitHeatmapDir}/meta/traits`);
const effectsStore = createFileStore(`${config.paths.crossTraitHeatmapDir}/tables/effects`);

const DEFAULT_TOP_GENES = 30;
const MAX_TOP_GENES = 100;
const MAX_TARGET_IDS = 24;
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
        normalizeTraitId(fileId),
        normalizeTraitId(meta?.file_id),
        normalizeTraitId(meta?.gwas_id),
    ].filter(Boolean))];
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
        excludeSql = `AND fm.file_id NOT IN (${excluded.map(() => '?').join(', ')})`;
        params.push(...excluded);
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
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name
         FROM file_metadata fm
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

async function readTsvRows(store, fileName) {
    const fullPath = store.resolve(fileName);
    if (!fullPath) return null;

    const stat = await store.stat(fullPath);
    if (!stat || !stat.isFile) return null;
    if (stat.size > config.data.maxTsvFileBytes) {
        throw buildHttpError(413, 'TSV file is too large');
    }

    const stream = await store.createReadStream(fullPath);
    return parseTsvStream(stream, { maxRows: config.data.maxTsvRows });
}

async function readTraitMetaRow(traitId) {
    return readTsvRows(metaTraitsStore, `${traitId}.tsv`);
}

async function getEffectRows(traitId) {
    const safeTraitId = normalizeTraitId(traitId);
    if (!safeTraitId) return null;

    const cached = getFreshCache(effectRowsCache, safeTraitId, EFFECT_CACHE_TTL_MS);
    if (cached) return cached;

    const rows = await readTsvRows(effectsStore, `${safeTraitId}.tsv`);
    if (!rows) return null;
    setCache(effectRowsCache, safeTraitId, rows);
    return rows;
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

async function getAvailableTraitIds() {
    const [metaEntries, effectEntries] = await Promise.all([
        listStoreEntries(metaTraitsStore),
        listStoreEntries(effectsStore),
    ]);
    const ids = new Set();

    [metaEntries, effectEntries].forEach((entries) => {
        entries
            .filter((entry) => entry.type === 'file' && entry.name.endsWith('.tsv'))
            .map((entry) => entry.name.replace(/\.tsv$/i, ''))
            .filter(Boolean)
            .forEach((traitId) => ids.add(traitId));
    });

    return [...ids].sort((a, b) => a.localeCompare(b));
}

async function getRecommendedTargets(sourceTraitId) {
    const safeSourceId = normalizeTraitId(sourceTraitId);
    const cached = getFreshCache(recommendedTargetsCache, safeSourceId, TARGET_CACHE_TTL_MS);
    if (cached) return cached;

    const availableIds = await getAvailableTraitIds();
    const availableIdSet = new Set(availableIds);
    const recommendedIds = CURATED_RECOMMENDED_TARGET_IDS.filter(
        (traitId) => traitId !== safeSourceId && availableIdSet.has(traitId),
    );

    if (recommendedIds.length < MAX_TARGET_IDS) {
        availableIds.forEach((traitId) => {
            if (traitId === safeSourceId || recommendedIds.includes(traitId)) return;
            recommendedIds.push(traitId);
        });
    }

    const limitedIds = recommendedIds.slice(0, MAX_TARGET_IDS);
    const metaMap = await getTraitMetaMapByIds(limitedIds);
    const enriched = limitedIds.map((traitId) => {
        const meta = metaMap.get(traitId) || { file_id: traitId, gwas_id: traitId, trait_name: traitId };
        return {
            file_id: meta.file_id || traitId,
            gwas_id: meta.gwas_id || traitId,
            trait_name: meta.trait_name || meta.gwas_id || traitId,
        };
    });

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
    const fileId = normalizeTraitId(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const meta = await getTraitMetaById(fileId);
    const candidates = pickTraitIdCandidates(fileId, meta);
    let resolvedTraitId = '';
    let hasMeta = Boolean(meta);
    let hasEffects = false;

    for (const candidate of candidates) {
        const [metaRow, effectRows] = await Promise.all([
            readTraitMetaRow(candidate),
            getEffectRows(candidate),
        ]);
        if (!resolvedTraitId && (metaRow || effectRows)) resolvedTraitId = candidate;
        if (metaRow) hasMeta = true;
        if (effectRows) hasEffects = true;
        if (hasMeta && hasEffects) break;
    }

    res.json({
        fileId,
        resolvedTraitId: resolvedTraitId || candidates[0] || fileId,
        hasMeta,
        hasEffects,
        available: hasEffects,
    });
}));

router.get('/api/cross-trait/:fileId/targets', asyncRoute(async (req, res) => {
    const fileId = normalizeTraitId(req.params.fileId);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const meta = await getTraitMetaById(fileId);
    const candidates = pickTraitIdCandidates(fileId, meta);
    let resolvedSourceId = candidates[0] || fileId;
    for (const candidate of candidates) {
        const rows = await getEffectRows(candidate);
        if (!rows) continue;
        resolvedSourceId = candidate;
        break;
    }
    const targets = await getRecommendedTargets(resolvedSourceId);

    res.json({
        fileId,
        resolvedTraitId: resolvedSourceId,
        targets,
    });
}));

router.get('/api/cross-trait/:fileId/matrix', asyncRoute(async (req, res) => {
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
        sourceRows = await getEffectRows(candidate);
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
        const rows = await getEffectRows(targetId);
        if (!rows) {
            skippedTargets += 1;
            continue;
        }
        targetIndexes.push(buildEffectIndex(rows));
        const metaRow = targetMetaMap.get(targetId) || { file_id: targetId, gwas_id: targetId, trait_name: targetId };
        targetMetaRows.push({
            file_id: metaRow.file_id || targetId,
            gwas_id: metaRow.gwas_id || targetId,
            trait_name: metaRow.trait_name || metaRow.gwas_id || targetId,
        });
    }

    const matrix = topGeneRows.map((geneRow) => targetIndexes.map((index) => {
        const targetGene = index.get(geneRow.geneKey);
        return targetGene ? targetGene.postMean : null;
    }));

    const valueSummary = summarizeMatrix(matrix);
    const sourceTrait = {
        file_id: sourceMeta?.file_id || sourceTraitId,
        gwas_id: sourceMeta?.gwas_id || sourceTraitId,
        trait_name: sourceMeta?.trait_name || sourceMeta?.gwas_id || sourceTraitId,
    };

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

module.exports = router;
