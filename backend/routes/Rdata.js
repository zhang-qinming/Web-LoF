const express = require('express');
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');
const router = express.Router();

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

function safePath(subPath) {
    // 归一化：去掉所有 .. 和 . 段，防路径穿越
    const clean = subPath
        .split(/[\\/]/)
        .filter(s => s && s !== '.' && s !== '..')
        .join(path.sep);

    const resolved = path.resolve(DATA_DIR, clean);
    // 确保解析后的绝对路径在 DATA_DIR 内
    if (!resolved.startsWith(DATA_DIR + path.sep) && resolved !== DATA_DIR) {
        return null;
    }
    return resolved;
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

const SEARCH_INDEX_TTL_MS = 2 * 60 * 1000;
let searchIndexCache = null;
let searchIndexBuiltAt = 0;
let searchIndexPromise = null;

function getSearchRank(entry, query) {
    if (entry.nameLower === query) return 0;
    if (entry.nameLower.startsWith(query)) return 1;
    if (entry.pathLower.startsWith(query)) return 2;
    if (entry.nameLower.includes(query)) return 3;
    return 4;
}

async function buildSearchIndex() {
    const entries = [];

    async function scan(dir, base) {
        let dirEntries = [];
        try {
            dirEntries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (err) {
            return;
        }

        dirEntries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

        for (const entry of dirEntries) {
            if (!entry.isDirectory() && !entry.isFile()) continue;

            const relPath = base ? `${base}/${entry.name}` : entry.name;
            const fullPath = path.join(dir, entry.name);
            let size = 0;

            if (entry.isFile()) {
                try {
                    const stat = await fs.promises.stat(fullPath);
                    size = stat.size;
                } catch (err) {
                    size = 0;
                }
            }

            entries.push({
                name: entry.name,
                path: relPath,
                type: entry.isDirectory() ? 'dir' : 'file',
                size,
                depth: relPath.split('/').length,
                nameLower: entry.name.toLowerCase(),
                pathLower: relPath.toLowerCase(),
            });

            if (entry.isDirectory()) {
                await scan(fullPath, relPath);
            }
        }
    }

    try {
        await fs.promises.access(DATA_DIR);
        await scan(DATA_DIR, '');
    } catch (err) {
        return [];
    }

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
        const full = safePath(req.query.dir || '');
        if (!full) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });

        const entries = await fs.promises.readdir(full, { withFileTypes: true });
        const searchQ = (req.query.search || '').toLowerCase();
        const filteredEntries = entries.filter((e) => !searchQ || e.name.toLowerCase().includes(searchQ));
        filteredEntries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

        const p = Math.max(1, parseInt(req.query.page) || 1);
        const l = Math.min(200, Math.max(5, parseInt(req.query.limit) || 50));
        const total = filteredEntries.length;
        const pageEntries = filteredEntries.slice((p - 1) * l, p * l);
        const data = await Promise.all(pageEntries.map(async (e) => {
            const stat = await fs.promises.stat(path.join(full, e.name));
            return {
                name: e.name,
                type: e.isDirectory() ? 'dir' : 'file',
                path: req.query.dir ? `${req.query.dir}/${e.name}` : e.name,
                size: e.isFile() ? stat.size : 0,
                mtime: stat.mtime.toISOString(),
            };
        }));

        res.json({ data, totalCount: total, page: p, totalPages: Math.ceil(total / l) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/data/file-paths', async (req, res) => {
    try {
        const full = safePath(req.query.dir || '');
        if (!full) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });

        const entries = await fs.promises.readdir(full, { withFileTypes: true });
        const searchQ = (req.query.search || '').toLowerCase();
        const files = entries
            .filter((entry) => entry.isFile() && (!searchQ || entry.name.toLowerCase().includes(searchQ)))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((entry) => (req.query.dir ? `${req.query.dir}/${entry.name}` : entry.name));

        res.json({ paths: files, totalCount: files.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/data/breadcrumb', (req, res) => {
    try {
        const full = safePath(req.query.dir || '');
        if (!full) return res.status(403).json({ error: 'Forbidden' });

        const parts = (req.query.dir || '').split('/').filter(Boolean);
        const crumbs = [{ name: 'data', path: '' }];
        let acc = '';
        for (const p of parts) {
            acc = acc ? `${acc}/${p}` : p;
            crumbs.push({ name: p, path: acc });
        }
        res.json({ crumbs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/data/download', (req, res) => {
    try {
        const fp = safePath(req.query.path || '');
        if (!fp) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(fp)) return res.status(404).send('Not found');

        // 文件夹 → zip
        if (fs.statSync(fp).isDirectory()) {
            const dirName = path.basename(fp);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${dirName}.zip"`);
            const archive = new ZipArchive({ zlib: { level: 6 } });
            archive.on('error', () => { 
                if (!res.headersSent) res.status(500).end(); 
            });
            archive.pipe(res);
            archive.directory(fp, dirName);
            archive.finalize();
            return;
        }

        res.download(fp);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/data/download-batch', async (req, res) => {
    try {
        const rawPaths = Array.isArray(req.body?.paths) ? req.body.paths : [];
        const uniquePaths = [...new Set(rawPaths.filter((item) => typeof item === 'string' && item.trim()))];
        if (uniquePaths.length === 0) return res.status(400).json({ error: 'No files selected' });

        const zipBaseName = (typeof req.body?.filename === 'string' ? req.body.filename.trim() : '')
            .replace(/\.zip$/i, '') || 'data-selection';

        const resolvedItems = await Promise.all(uniquePaths.map(async (relPath) => {
            const fullPath = safePath(relPath);
            if (!fullPath) {
                const err = new Error('Forbidden');
                err.status = 403;
                throw err;
            }

            let stat;
            try {
                stat = await fs.promises.stat(fullPath);
            } catch (err) {
                const notFound = new Error('Not found');
                notFound.status = 404;
                throw notFound;
            }

            return { relPath, fullPath, stat };
        }));

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipBaseName}.zip"`);

        const archive = new ZipArchive({ zlib: { level: 6 } });
        archive.on('error', () => {
            if (!res.headersSent) res.status(500).end();
            else res.end();
        });
        archive.pipe(res);

        const usedNames = new Set();
        for (const item of resolvedItems) {
            const entryName = getArchiveEntryName(item.relPath, usedNames);
            if (item.stat.isDirectory()) archive.directory(item.fullPath, entryName);
            else archive.file(item.fullPath, { name: entryName });
        }

        archive.finalize();
    } catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message });
    }
});

router.get('/api/data/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (!q || q.length < 2) return res.json({ results: [] });

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
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
