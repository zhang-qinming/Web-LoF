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

router.get('/api/data/list', (req, res) => {
    try {
        const full = safePath(req.query.dir || '');
        if (!full) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(full)) return res.status(404).json({ error: 'Not found' });

        const entries = fs.readdirSync(full, { withFileTypes: true });
        const items = [];
        for (const e of entries) {
            const stat = fs.statSync(path.join(full, e.name));
            items.push({
                name: e.name,
                type: e.isDirectory() ? 'dir' : 'file',
                path: req.query.dir ? `${req.query.dir}/${e.name}` : e.name,
                size: e.isFile() ? stat.size : 0,
                mtime: stat.mtime.toISOString(),
            });
        }
        items.sort((a, b) => (b.type === 'dir') - (a.type === 'dir') || a.name.localeCompare(b.name));

        const p = Math.max(1, parseInt(req.query.page) || 1);
        const l = Math.min(200, Math.max(5, parseInt(req.query.limit) || 50));
        const total = items.length;
        const data = items.slice((p - 1) * l, p * l);

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
            archive.on('error', () => { res.status(500).end(); });
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

module.exports = router;
