const fs = require('fs');
const path = require('path');

const MAX_NEIGHBOR_FILE_BYTES = 64 * 1024 * 1024;

let cachedFile = null;
let pendingLoad = null;
let pendingKey = '';

function isMissingError(err) {
    return Boolean(err && (err.code === 'ENOENT' || err.code === 2));
}

function validatePayload(payload, filePath) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`Invalid Trait Effect neighbors JSON: ${filePath}`);
    }
    if (!payload.neighbors || typeof payload.neighbors !== 'object' || Array.isArray(payload.neighbors)) {
        throw new Error(`Trait Effect neighbors JSON is missing neighbors: ${filePath}`);
    }
    return payload;
}

async function loadTraitEffectNeighbors(filePath) {
    const resolvedPath = path.resolve(String(filePath));
    let stat;
    try {
        stat = await fs.promises.stat(resolvedPath);
    } catch (err) {
        if (isMissingError(err)) return null;
        throw err;
    }

    if (!stat.isFile()) return null;
    if (stat.size > MAX_NEIGHBOR_FILE_BYTES) {
        throw new Error(`Trait Effect neighbors JSON exceeds ${MAX_NEIGHBOR_FILE_BYTES} bytes`);
    }

    const cacheKey = `${resolvedPath}:${stat.size}:${stat.mtimeMs}`;
    if (cachedFile?.key === cacheKey) return cachedFile.payload;
    if (pendingLoad && pendingKey === cacheKey) return pendingLoad;

    pendingKey = cacheKey;
    pendingLoad = fs.promises.readFile(resolvedPath, 'utf8')
        .then((raw) => validatePayload(JSON.parse(raw), resolvedPath))
        .then((payload) => {
            cachedFile = { key: cacheKey, payload };
            return payload;
        })
        .finally(() => {
            pendingLoad = null;
            pendingKey = '';
        });

    return pendingLoad;
}

function normalizeNeighborRows(rows, limit) {
    if (!Array.isArray(rows)) return [];
    const normalized = [];
    const seen = new Set();

    for (const row of rows) {
        const targetId = String(row?.target_id || '').trim();
        const correlation = Number(row?.correlation);
        const sharedGenes = Number(row?.shared_genes);
        if (!targetId || seen.has(targetId) || !Number.isFinite(correlation)) continue;
        seen.add(targetId);
        normalized.push({
            target_id: targetId,
            correlation,
            shared_genes: Number.isFinite(sharedGenes) ? sharedGenes : null,
        });
        if (normalized.length >= limit) break;
    }

    return normalized;
}

async function getTraitEffectNeighbors(filePath, sourceIds, limit = 100) {
    const payload = await loadTraitEffectNeighbors(filePath);
    if (!payload) return null;

    const candidates = [...new Set(
        (sourceIds || []).map((value) => String(value || '').trim()).filter(Boolean),
    )];
    const sourceId = candidates.find((candidate) => Array.isArray(payload.neighbors[candidate]));
    if (!sourceId) {
        return {
            sourceId: candidates[0] || '',
            rows: [],
            metadata: {
                method: payload.method || null,
                topK: Number(payload.top_k) || null,
                minSharedGenes: Number(payload.min_shared_genes) || null,
                generatedAt: payload.generated_at || null,
            },
        };
    }

    return {
        sourceId,
        rows: normalizeNeighborRows(payload.neighbors[sourceId], limit),
        metadata: {
            method: payload.method || null,
            topK: Number(payload.top_k) || null,
            minSharedGenes: Number(payload.min_shared_genes) || null,
            generatedAt: payload.generated_at || null,
        },
    };
}

module.exports = {
    getTraitEffectNeighbors,
    loadTraitEffectNeighbors,
};
