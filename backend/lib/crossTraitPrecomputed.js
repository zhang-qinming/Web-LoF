const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { config } = require('./config');
const { isRequestAbortError, throwIfAborted } = require('./http');

const gunzip = promisify(zlib.gunzip);
const SAFE_FILE_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

const payloadCache = new Map();
let manifestCache = null;

function isMissingError(err) {
    return Boolean(err && (err.code === 'ENOENT' || err.code === 2));
}

function isSafeFileId(value) {
    const text = String(value || '').trim();
    return text && SAFE_FILE_ID_PATTERN.test(text) ? text : null;
}

function isWithinRoot(fullPath) {
    const root = path.resolve(config.paths.crossTraitPrecomputedDir);
    const target = path.resolve(fullPath);
    return target === root || target.startsWith(`${root}${path.sep}`);
}

function resolvePayloadPath(kind, sourceId) {
    const safeSourceId = isSafeFileId(sourceId);
    if (!safeSourceId) return null;

    const fileName = kind === 'correlation'
        ? `${safeSourceId}.spearman.json.gz`
        : `${safeSourceId}.json.gz`;
    const fullPath = path.resolve(config.paths.crossTraitPrecomputedDir, kind, fileName);
    return isWithinRoot(fullPath) ? fullPath : null;
}

function normalizeFiniteNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

function summarizeCorrelationMatrix(matrix, sharedGeneCounts) {
    let validPairCount = 0;
    let missingPairCount = 0;
    let minCorrelation = null;
    let maxCorrelation = null;
    let minShared = null;
    let maxShared = null;

    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
        for (let colIndex = rowIndex + 1; colIndex < matrix.length; colIndex += 1) {
            const shared = normalizeFiniteNumber(sharedGeneCounts?.[rowIndex]?.[colIndex]);
            if (shared != null) {
                minShared = minShared == null ? shared : Math.min(minShared, shared);
                maxShared = maxShared == null ? shared : Math.max(maxShared, shared);
            }

            const value = normalizeFiniteNumber(matrix?.[rowIndex]?.[colIndex]);
            if (value == null) {
                missingPairCount += 1;
                continue;
            }

            validPairCount += 1;
            minCorrelation = minCorrelation == null ? value : Math.min(minCorrelation, value);
            maxCorrelation = maxCorrelation == null ? value : Math.max(maxCorrelation, value);
        }
    }

    return {
        validPairCount,
        missingPairCount,
        correlationRange: { min: minCorrelation, max: maxCorrelation },
        sharedGeneRange: { min: minShared, max: maxShared },
    };
}

function rememberPayload(cacheKey, value) {
    if (payloadCache.has(cacheKey)) payloadCache.delete(cacheKey);
    payloadCache.set(cacheKey, value);

    const maxEntries = config.data.crossTraitPrecomputedCacheMaxEntries;
    while (payloadCache.size > maxEntries) {
        const oldestKey = payloadCache.keys().next().value;
        payloadCache.delete(oldestKey);
    }
}

async function statFile(fullPath) {
    try {
        const stat = await fs.promises.stat(fullPath);
        return stat.isFile() ? stat : null;
    } catch (err) {
        if (isMissingError(err)) return null;
        throw err;
    }
}

async function readGzipJson(fullPath, { signal = null } = {}) {
    throwIfAborted(signal);
    const stat = await statFile(fullPath);
    if (!stat) return null;
    if (stat.size > config.data.maxCrossTraitPrecomputedFileBytes) {
        const err = new Error('Cross-trait precomputed file is too large');
        err.status = 413;
        err.expose = true;
        throw err;
    }

    const cacheKey = `${fullPath}:${stat.size}:${stat.mtimeMs}`;
    const cached = payloadCache.get(cacheKey);
    if (cached) {
        payloadCache.delete(cacheKey);
        payloadCache.set(cacheKey, cached);
        return cached;
    }

    throwIfAborted(signal);
    const compressed = await fs.promises.readFile(fullPath);
    throwIfAborted(signal);
    const raw = await gunzip(compressed);
    throwIfAborted(signal);
    const payload = JSON.parse(raw.toString('utf8'));
    rememberPayload(cacheKey, payload);
    return payload;
}

async function getPrecomputedManifest({ signal = null } = {}) {
    throwIfAborted(signal);
    const fullPath = path.resolve(config.paths.crossTraitPrecomputedDir, 'manifest.json');
    if (!isWithinRoot(fullPath)) return null;

    const stat = await statFile(fullPath);
    if (!stat) return null;

    const cacheKey = `${fullPath}:${stat.size}:${stat.mtimeMs}`;
    if (manifestCache?.key === cacheKey) return manifestCache.payload;

    throwIfAborted(signal);
    const payload = JSON.parse(await fs.promises.readFile(fullPath, 'utf8'));
    manifestCache = { key: cacheKey, payload };
    return payload;
}

async function readSourcePayload(kind, sourceIds, { signal = null } = {}) {
    let manifest = null;
    try {
        manifest = await getPrecomputedManifest({ signal });
    } catch (err) {
        if (isRequestAbortError(err)) throw err;
        console.warn(`Failed to load Cross-trait precomputed manifest: ${err.message}`);
        return null;
    }
    if (!manifest) return null;

    for (const sourceId of sourceIds || []) {
        throwIfAborted(signal);
        const fullPath = resolvePayloadPath(kind, sourceId);
        if (!fullPath) continue;
        let payload = null;
        try {
            payload = await readGzipJson(fullPath, { signal });
        } catch (err) {
            if (isRequestAbortError(err)) throw err;
            console.warn(`Failed to load Cross-trait precomputed ${kind} payload for ${sourceId}: ${err.message}`);
            return null;
        }
        if (payload) return { sourceId: payload.sourceId || sourceId, payload };
    }
    return null;
}

function recordTraitId(record) {
    return String(
        record?.trait_id
        || record?.target_id
        || record?.file_id
        || record?.gwas_id
        || '',
    ).trim();
}

function buildRecordIndex(records = []) {
    const index = new Map();
    records.forEach((record, position) => {
        [
            record?.trait_id,
            record?.target_id,
            record?.file_id,
            record?.gwas_id,
        ].forEach((value) => {
            const id = String(value || '').trim();
            if (id && !index.has(id)) index.set(id, position);
        });
    });
    return index;
}

function normalizeMatrixValue(value) {
    const number = normalizeFiniteNumber(value);
    return number == null ? null : number;
}

async function getPrecomputedCrossTraitMatrix(sourceIds, { targetIds = [], topGenes, signal = null } = {}) {
    const loaded = await readSourcePayload('matrix', sourceIds, { signal });
    if (!loaded) return null;

    const { payload } = loaded;
    if (!Array.isArray(payload.targets) || !Array.isArray(payload.genes) || !Array.isArray(payload.matrix)) {
        return null;
    }

    const targetIndex = buildRecordIndex(payload.targets);
    const selectedTargetIndexes = [];
    for (const targetId of targetIds) {
        const index = targetIndex.get(String(targetId || '').trim());
        if (index == null) return null;
        if (!selectedTargetIndexes.includes(index)) selectedTargetIndexes.push(index);
    }

    const requestedTopGenes = Number.isFinite(Number(topGenes)) ? Number(topGenes) : payload.genes.length;
    const geneCount = Math.min(Math.max(0, requestedTopGenes), payload.genes.length, payload.matrix.length);
    const genes = payload.genes.slice(0, geneCount);
    const matrix = payload.matrix.slice(0, geneCount).map((row) => (
        selectedTargetIndexes.map((targetIndexValue) => normalizeMatrixValue(row?.[targetIndexValue]))
    ));
    const targets = selectedTargetIndexes.map((index) => payload.targets[index]);
    const valueSummary = summarizeMatrix(matrix);

    return {
        sourceId: payload.sourceId || loaded.sourceId,
        targets,
        genes,
        matrix,
        summary: {
            topGenes: genes.length,
            targetCount: targets.length,
            skippedTargets: 0,
            ...valueSummary,
            precomputed: true,
            generatedAt: payload.generatedAt || payload.generated_at || null,
        },
    };
}

async function getPrecomputedTraitCorrelation(sourceIds, {
    targetIds = [],
    method = 'spearman',
    signal = null,
} = {}) {
    if (String(method || '').toLowerCase() !== 'spearman') return null;

    const loaded = await readSourcePayload('correlation', sourceIds, { signal });
    if (!loaded) return null;

    const { payload } = loaded;
    if (!Array.isArray(payload.traits) || !Array.isArray(payload.matrix) || !Array.isArray(payload.sharedGeneCounts)) {
        return null;
    }

    const traitIndex = buildRecordIndex(payload.traits);
    const sourceIndex = traitIndex.get(String(payload.sourceId || loaded.sourceId || '').trim());
    if (sourceIndex == null) return null;

    const selectedTraitIndexes = [sourceIndex];
    for (const targetId of targetIds) {
        const index = traitIndex.get(String(targetId || '').trim());
        if (index == null) return null;
        if (!selectedTraitIndexes.includes(index)) selectedTraitIndexes.push(index);
    }

    const traits = selectedTraitIndexes.map((index) => payload.traits[index]);
    const matrix = selectedTraitIndexes.map((rowIndex) => (
        selectedTraitIndexes.map((colIndex) => normalizeMatrixValue(payload.matrix?.[rowIndex]?.[colIndex]))
    ));
    const sharedGeneCounts = selectedTraitIndexes.map((rowIndex) => (
        selectedTraitIndexes.map((colIndex) => {
            const value = normalizeFiniteNumber(payload.sharedGeneCounts?.[rowIndex]?.[colIndex]);
            return value == null ? 0 : value;
        })
    ));
    const geneCounts = traits
        .map((trait) => normalizeFiniteNumber(trait?.valid_gene_count))
        .filter((value) => value != null);
    const correlationSummary = summarizeCorrelationMatrix(matrix, sharedGeneCounts);

    return {
        sourceId: payload.sourceId || loaded.sourceId,
        traits,
        matrix,
        sharedGeneCounts,
        summary: {
            method: 'spearman',
            minSharedGenes: normalizeFiniteNumber(payload.minSharedGenes || payload.min_shared_genes),
            traitCount: traits.length,
            requestedTraitCount: targetIds.length + 1,
            skippedTraits: Math.max(0, targetIds.length - (traits.length - 1)),
            profileGeneRange: {
                min: geneCounts.length ? Math.min(...geneCounts) : null,
                max: geneCounts.length ? Math.max(...geneCounts) : null,
            },
            ...correlationSummary,
            precomputed: true,
            generatedAt: payload.generatedAt || payload.generated_at || null,
        },
    };
}

module.exports = {
    getPrecomputedCrossTraitMatrix,
    getPrecomputedManifest,
    getPrecomputedTraitCorrelation,
    recordTraitId,
};
