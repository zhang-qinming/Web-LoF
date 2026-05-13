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

router.get('/api/data/search', async (req, res) => {
    try {
        const q = (req.query.q || '').toLowerCase();
        if (!q || q.length < 2) return res.json({ results: [] });

        const results = [];
        
        async function scan(dir, base) {
            try {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const e of entries) {
                    const rel = base ? `${base}/${e.name}` : e.name;
                    if (e.name.toLowerCase().includes(q)) {
                        let size = 0;
                        if (e.isFile()) {
                            try {
                                const stat = await fs.promises.stat(path.join(dir, e.name));
                                size = stat.size;
                            } catch (err) {}
                        }
                        results.push({
                            name: e.name,
                            path: rel,
                            type: e.isDirectory() ? 'dir' : 'file',
                            size,
                        });
                    }
                    if (e.isDirectory() && results.length < 100) {
                        await scan(path.join(dir, e.name), rel);
                    }
                }
            } catch (err) {
                // Ignore permission or access errors during recursive scan
            }
        }
        
        try {
            await fs.promises.access(DATA_DIR);
            await scan(DATA_DIR, '');
        } catch (err) {
            // DATA_DIR doesn't exist
        }
        
        res.json({ results: results.slice(0, 50) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
