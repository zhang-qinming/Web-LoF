const express = require('express');
const path = require('path');
const { createFileStore, buildHttpError } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { parsePositiveInt } = require('../lib/request');

const router = express.Router();
const dataStore = createFileStore(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

let searchIndexCache = null;
let searchIndexBuiltAt = 0;
let searchIndexPromise = null;

function resolveRelativePath(relPath = '') {
    const fullPath = dataStore.resolve(relPath);
    if (!fullPath) throw buildHttpError(403, 'Forbidden');
    return fullPath;
}

function toRelativePath(fullPath) {
    const normalizedRoot = dataStore.rootPath;
    if (fullPath === normalizedRoot) return '';

    const relative = fullPath.slice(normalizedRoot.length).replace(/^[\\/]+/, '');
    return relative.split(/[\\/]/).filter(Boolean).join('/');
}

function isoFromMtime(mtimeMs) {
    return mtimeMs ? new Date(mtimeMs).toISOString() : null;
}

function getArchiveEntryName(relPath, usedNames) {
    const normalized = (relPath || 'file')
        .split(/[\\/]/)
        .filter(Boolean)
        .join('/');

    if (!usedNames.has(normalized)) {
        usedNames.add(normalized);
        return normalized;
    }

    const ext = path.posix.extname(normalized);
    const base = ext ? normalized.slice(0, -ext.length) : normalized;
    let index = 2;
    let candidate = `${base} (${index})${ext}`;

    while (usedNames.has(candidate)) {
        index += 1;
        candidate = `${base} (${index})${ext}`;
    }

    usedNames.add(candidate);
    return candidate;
}

function getSearchRank(entry, query) {
    if (entry.nameLower === query) return 0;
    if (entry.nameLower.startsWith(query)) return 1;
    if (entry.pathLower.startsWith(query)) return 2;
    if (entry.nameLower.includes(query)) return 3;
    return 4;
}

async function createZipArchive(options) {
    const archiverModule = await import('archiver');
    const archiver = archiverModule.default || archiverModule;
    return archiver('zip', options);
}

async function estimateArchive(store, fullPath, counters = { entries: 0, bytes: 0 }) {
    const stat = await store.stat(fullPath);
    if (!stat) return counters;

    counters.entries += 1;
    if (counters.entries > config.data.maxArchiveEntries) {
        const err = new Error(`Archive contains too many entries; max is ${config.data.maxArchiveEntries}`);
        err.status = 413;
        err.expose = true;
        throw err;
    }

    if (stat.isFile) {
        counters.bytes += stat.size || 0;
        if (counters.bytes > config.data.maxArchiveBytes) {
            const err = new Error('Archive is too large to download through the API');
            err.status = 413;
            err.expose = true;
            throw err;
        }
        return counters;
    }

    if (stat.isDirectory) {
        const entries = await store.list(fullPath);
        for (const entry of entries) {
            await estimateArchive(store, store.pathImpl.join(fullPath, entry.name), counters);
        }
    }

    return counters;
}

async function buildSearchIndex() {
    const entries = [];

    async function scan(fullPath) {
        let dirEntries = [];
        try {
            dirEntries = await dataStore.list(fullPath);
        } catch (err) {
            return;
        }

        dirEntries.sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || a.name.localeCompare(b.name));

        for (const entry of dirEntries) {
            const childPath = dataStore.pathImpl.join(fullPath, entry.name);
            const relPath = toRelativePath(childPath);

            entries.push({
                name: entry.name,
                path: relPath,
                type: entry.type,
                size: entry.size || 0,
                depth: relPath ? relPath.split('/').length : 0,
                nameLower: entry.name.toLowerCase(),
                pathLower: relPath.toLowerCase(),
            });

            if (entry.type === 'dir') {
                await scan(childPath);
            }
        }
    }

    const rootStat = await dataStore.stat(dataStore.rootPath);
    if (!rootStat || !rootStat.isDirectory) return [];

    await scan(dataStore.rootPath);
    return entries;
}

async function getSearchIndex(forceRefresh = false) {
    const isFresh = searchIndexCache && (Date.now() - searchIndexBuiltAt) < config.data.searchIndexTtlMs;
    if (!forceRefresh && isFresh) return searchIndexCache;

    if (!searchIndexPromise) {
        searchIndexPromise = buildSearchIndex()
            .then((entries) => {
                searchIndexCache = entries;
                searchIndexBuiltAt = Date.now();
                return entries;
            })
            .finally(() => {
                searchIndexPromise = null;
            });
    }

    return searchIndexPromise;
}

router.get('/api/data/list', asyncRoute(async (req, res) => {
    const fullPath = resolveRelativePath(req.query.dir || '');
    const stat = await dataStore.stat(fullPath);
    if (!stat) return res.status(404).json({ error: 'Not found' });
    if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

    const searchQ = String(req.query.search || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    const entries = await dataStore.list(fullPath);
    const filteredEntries = entries.filter((entry) => !searchQ || entry.name.toLowerCase().includes(searchQ));
    filteredEntries.sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || a.name.localeCompare(b.name));

    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const total = filteredEntries.length;
    const pageEntries = filteredEntries.slice((page - 1) * limit, page * limit);
    const parentRel = req.query.dir ? String(req.query.dir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';

    const data = pageEntries.map((entry) => ({
        name: entry.name,
        type: entry.type,
        path: parentRel ? `${parentRel}/${entry.name}` : entry.name,
        size: entry.type === 'file' ? (entry.size || 0) : 0,
        mtime: isoFromMtime(entry.mtimeMs),
    }));

    res.json({ data, totalCount: total, page, totalPages: Math.ceil(total / limit) });
}));

router.get('/api/data/file-paths', asyncRoute(async (req, res) => {
    const fullPath = resolveRelativePath(req.query.dir || '');
    const stat = await dataStore.stat(fullPath);
    if (!stat) return res.status(404).json({ error: 'Not found' });
    if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

    const searchQ = String(req.query.search || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    const parentRel = req.query.dir ? String(req.query.dir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const files = (await dataStore.list(fullPath))
        .filter((entry) => entry.type === 'file' && (!searchQ || entry.name.toLowerCase().includes(searchQ)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => (parentRel ? `${parentRel}/${entry.name}` : entry.name));

    res.json({ paths: files, totalCount: files.length });
}));

router.get('/api/data/breadcrumb', asyncRoute(async (req, res) => {
    resolveRelativePath(req.query.dir || '');

    const parts = String(req.query.dir || '').split('/').filter(Boolean);
    const crumbs = [{ name: 'data', path: '' }];
    let acc = '';
    for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        crumbs.push({ name: part, path: acc });
    }
    res.json({ crumbs });
}));

router.get('/api/data/download', asyncRoute(async (req, res) => {
    const fullPath = resolveRelativePath(req.query.path || '');
    const stat = await dataStore.stat(fullPath);
    if (!stat) return res.status(404).send('Not found');
    if (stat.isFile && stat.size > config.data.maxDownloadFileBytes) {
        return res.status(413).json({ error: 'File is too large to download through the API' });
    }

    const baseName = dataStore.basename(fullPath);
    if (stat.isDirectory) {
        await estimateArchive(dataStore, fullPath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.zip"`);

        const archive = await createZipArchive({ zlib: { level: 6 } });
        archive.on('error', () => {
            if (!res.headersSent) res.status(500).end();
            else res.end();
        });
        archive.pipe(res);
        await dataStore.appendToArchive(archive, fullPath, baseName);
        await archive.finalize();
        return;
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`);
    const stream = await dataStore.createReadStream(fullPath);
    stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    stream.pipe(res);
}));

router.post('/api/data/download-batch', asyncRoute(async (req, res) => {
    const rawPaths = Array.isArray(req.body?.paths) ? req.body.paths : [];
    const uniquePaths = [...new Set(rawPaths.filter((item) => typeof item === 'string' && item.trim()))];
    if (uniquePaths.length === 0) return res.status(400).json({ error: 'No files selected' });
    if (uniquePaths.length > config.data.maxBatchDownloadItems) {
        return res.status(413).json({ error: `Too many files selected; max is ${config.data.maxBatchDownloadItems}` });
    }

    const zipBaseName = (typeof req.body?.filename === 'string' ? req.body.filename.trim() : '')
        .replace(/\.zip$/i, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 100) || 'data-selection';

    const resolvedItems = [];
    const archiveEstimate = { entries: 0, bytes: 0 };
    for (const relPath of uniquePaths) {
        const fullPath = resolveRelativePath(relPath);
        const stat = await dataStore.stat(fullPath);
        if (!stat) return res.status(404).json({ error: 'Not found' });
        if (stat.isFile && stat.size > config.data.maxDownloadFileBytes) {
            return res.status(413).json({ error: 'One selected file is too large to download through the API' });
        }
        await estimateArchive(dataStore, fullPath, archiveEstimate);
        resolvedItems.push({ relPath, fullPath, stat });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipBaseName}.zip"`);

    const archive = await createZipArchive({ zlib: { level: 6 } });
    archive.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    archive.pipe(res);

    const usedNames = new Set();
    for (const item of resolvedItems) {
        const entryName = getArchiveEntryName(item.relPath, usedNames);
        await dataStore.appendToArchive(archive, item.fullPath, entryName);
    }

    await archive.finalize();
}));

router.get('/api/data/search', asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    if (!q || q.length < 2) return res.json({ results: [], totalCount: 0, truncated: false });

    const limit = parsePositiveInt(req.query.limit, 60, 200);
    const forceRefresh = config.data.allowSearchRefresh && req.query.refresh === '1';
    const searchIndex = await getSearchIndex(forceRefresh);
    const matches = searchIndex.filter((entry) => entry.nameLower.includes(q) || entry.pathLower.includes(q));

    matches.sort((a, b) => (
        getSearchRank(a, q) - getSearchRank(b, q)
        || Number(b.type === 'file') - Number(a.type === 'file')
        || a.depth - b.depth
        || a.path.length - b.path.length
        || a.path.localeCompare(b.path)
    ));

    const results = matches.slice(0, limit).map(({ name, path: relPath, type, size }) => ({
        name,
        path: relPath,
        type,
        size,
    }));

    res.json({
        results,
        totalCount: matches.length,
        truncated: matches.length > limit,
    });
}));

module.exports = router;
