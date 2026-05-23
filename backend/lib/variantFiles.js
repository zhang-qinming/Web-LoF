const DEFAULT_TTL_MS = 60000;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_FILES = 100000;
const DEFAULT_ALIASES = {
    full: ['full', 'fulltsv', 'all', 'allloci', 'allvariant', 'allvariants', 'allgene', 'allgenes'],
    hits: ['hits', 'hit', 'significant', 'sig'],
};

const INDEX_CACHE = new WeakMap();

function normalizeToken(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitNameParts(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\.tsv$/i, '')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

function getAliases(variant, aliases = {}) {
    return aliases[variant] || DEFAULT_ALIASES[variant] || [variant];
}

function fileMatchesVariant(fileName, variant, aliases) {
    const parts = splitNameParts(fileName);
    const compact = parts.join('');

    return getAliases(variant, aliases).some((alias) => {
        const normalized = normalizeToken(alias);
        if (!normalized) return false;
        if (parts.includes(normalized)) return true;
        return normalized.length > 3 && compact.includes(normalized);
    });
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function buildDirectCandidates(fileIds, variant, suffix, aliases) {
    const names = [];
    const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
    const variantAliases = getAliases(variant, aliases);

    for (const id of ids) {
        const cleanId = String(id || '').trim();
        if (!cleanId) continue;

        for (const alias of variantAliases) {
            names.push(`${cleanId}_${alias}${suffix}`);
            names.push(`${cleanId}.${alias}${suffix}`);
            names.push(`${cleanId}-${alias}${suffix}`);
        }
    }

    return uniqueValues(names);
}

async function collectTsvEntries(store, fullPath, prefix, depth, options, out) {
    if (out.length >= options.maxFiles) return out;

    let entries = [];
    try {
        entries = await store.list(fullPath);
    } catch (_err) {
        return out;
    }

    for (const entry of entries) {
        if (out.length >= options.maxFiles) break;

        const relativeName = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.type === 'file' && /\.tsv$/i.test(entry.name)) {
            out.push({ ...entry, name: relativeName });
            continue;
        }

        if (entry.type === 'dir' && depth < options.maxDepth) {
            const childPath = store.pathImpl.join(fullPath, entry.name);
            await collectTsvEntries(store, childPath, relativeName, depth + 1, options, out);
        }
    }

    return out;
}

async function getTsvIndex(store, options) {
    const now = Date.now();
    const cached = INDEX_CACHE.get(store);
    if (cached?.entries?.length && now - cached.mtime < options.ttlMs) {
        return cached.entries;
    }

    const exists = await store.exists(store.rootPath);
    if (!exists) return [];

    const entries = await collectTsvEntries(store, store.rootPath, '', 0, options, []);
    INDEX_CACHE.set(store, { mtime: now, entries });
    return entries;
}

function sortCandidates(candidates, fileIds) {
    const ids = (Array.isArray(fileIds) ? fileIds : [fileIds])
        .map((id) => String(id || '').toLowerCase())
        .filter(Boolean);

    return candidates.sort((a, b) => {
        const aBase = a.name.split(/[\\/]/).pop().toLowerCase();
        const bBase = b.name.split(/[\\/]/).pop().toLowerCase();
        const aExact = ids.some((id) => aBase.startsWith(`${id}_`) || aBase.startsWith(`${id}.`) || aBase.startsWith(`${id}-`)) ? 0 : 1;
        const bExact = ids.some((id) => bBase.startsWith(`${id}_`) || bBase.startsWith(`${id}.`) || bBase.startsWith(`${id}-`)) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
}

async function findVariantFile(store, fileIds, variant, {
    suffix = '.tsv',
    aliases = DEFAULT_ALIASES,
    ttlMs = DEFAULT_TTL_MS,
    maxDepth = DEFAULT_MAX_DEPTH,
    maxFiles = DEFAULT_MAX_FILES,
} = {}) {
    const ids = Array.isArray(fileIds) ? fileIds : [fileIds];

    for (const relativeName of buildDirectCandidates(ids, variant, suffix, aliases)) {
        const fullPath = store.resolve(relativeName);
        if (!fullPath) continue;

        const stat = await store.stat(fullPath);
        if (stat?.isFile) return { filePath: fullPath, fileName: relativeName };
    }

    const indexOptions = { ttlMs, maxDepth, maxFiles };
    const entries = await getTsvIndex(store, indexOptions);
    const idTokens = ids.map(normalizeToken).filter(Boolean);
    const candidates = sortCandidates(entries
        .filter((entry) => {
            const nameToken = normalizeToken(entry.name.replace(/\.tsv$/i, ''));
            return fileMatchesVariant(entry.name, variant, aliases)
                && idTokens.some((idToken) => nameToken.includes(idToken));
        }), ids);

    for (const entry of candidates) {
        const filePath = store.resolve(entry.name);
        if (!filePath) continue;

        const stat = await store.stat(filePath);
        if (stat?.isFile) return { filePath, fileName: entry.name };
    }

    return { filePath: null, fileName: null };
}

module.exports = {
    findVariantFile,
};
