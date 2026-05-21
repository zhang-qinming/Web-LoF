const express = require('express');
const path = require('path');
const archiver = require('archiver');
const { createFileStore, buildHttpError } = require('../lib/fileStore');

const router = express.Router();
const dataStore = createFileStore(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

const SEARCH_INDEX_TTL_MS = 2 * 60 * 1000;
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
    const isFresh = searchIndexCache && (Date.now() - searchIndexBuiltAt) < SEARCH_INDEX_TTL_MS;
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

router.get('/api/data/list', async (req, res) => {
    try {
        const fullPath = resolveRelativePath(req.query.dir || '');
        const stat = await dataStore.stat(fullPath);
        if (!stat) return res.status(404).json({ error: 'Not found' });
        if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

        const searchQ = String(req.query.search || '').toLowerCase();
        const entries = await dataStore.list(fullPath);
        const filteredEntries = entries.filter((entry) => !searchQ || entry.name.toLowerCase().includes(searchQ));
        filteredEntries.sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || a.name.localeCompare(b.name));

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(5, parseInt(req.query.limit, 10) || 50));
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
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

router.get('/api/data/file-paths', async (req, res) => {
    try {
        const fullPath = resolveRelativePath(req.query.dir || '');
        const stat = await dataStore.stat(fullPath);
        if (!stat) return res.status(404).json({ error: 'Not found' });
        if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

        const searchQ = String(req.query.search || '').toLowerCase();
        const parentRel = req.query.dir ? String(req.query.dir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
        const files = (await dataStore.list(fullPath))
            .filter((entry) => entry.type === 'file' && (!searchQ || entry.name.toLowerCase().includes(searchQ)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((entry) => (parentRel ? `${parentRel}/${entry.name}` : entry.name));

        res.json({ paths: files, totalCount: files.length });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

router.get('/api/data/breadcrumb', async (req, res) => {
    try {
        resolveRelativePath(req.query.dir || '');

        const parts = String(req.query.dir || '').split('/').filter(Boolean);
        const crumbs = [{ name: 'data', path: '' }];
        let acc = '';
        for (const part of parts) {
            acc = acc ? `${acc}/${part}` : part;
            crumbs.push({ name: part, path: acc });
        }
        res.json({ crumbs });
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

router.get('/api/data/download', async (req, res) => {
    try {
        const fullPath = resolveRelativePath(req.query.path || '');
        const stat = await dataStore.stat(fullPath);
        if (!stat) return res.status(404).send('Not found');

        const baseName = dataStore.basename(fullPath);
        if (stat.isDirectory) {
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.zip"`);

            const archive = archiver('zip', { zlib: { level: 6 } });
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
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

router.post('/api/data/download-batch', async (req, res) => {
    try {
        const rawPaths = Array.isArray(req.body?.paths) ? req.body.paths : [];
        const uniquePaths = [...new Set(rawPaths.filter((item) => typeof item === 'string' && item.trim()))];
        if (uniquePaths.length === 0) return res.status(400).json({ error: 'No files selected' });

        const zipBaseName = (typeof req.body?.filename === 'string' ? req.body.filename.trim() : '')
            .replace(/\.zip$/i, '') || 'data-selection';

        const resolvedItems = [];
        for (const relPath of uniquePaths) {
            const fullPath = resolveRelativePath(relPath);
            const stat = await dataStore.stat(fullPath);
            if (!stat) return res.status(404).json({ error: 'Not found' });
            resolvedItems.push({ relPath, fullPath, stat });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipBaseName}.zip"`);

        const archive = archiver('zip', { zlib: { level: 6 } });
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
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

router.get('/api/data/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (!q || q.length < 2) return res.json({ results: [], totalCount: 0, truncated: false });

        const limit = Math.min(200, Math.max(10, parseInt(req.query.limit, 10) || 60));
        const searchIndex = await getSearchIndex(req.query.refresh === '1');
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
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

module.exports = router;
