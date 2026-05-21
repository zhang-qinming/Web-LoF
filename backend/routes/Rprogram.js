const express = require('express');
const path = require('path');
const programModel = require('../models/Mprogram');
const { createFileStore } = require('../lib/fileStore');
const { parseTsvStream } = require('../lib/tsv');

const router = express.Router();

const programStore = createFileStore(process.env.PROGRAM_DATA_DIR || path.join(__dirname, '..', 'data', 'program_regulator'));
const burdenVolcanoStore = createFileStore(process.env.BURDEN_VOLCANO_DIR || path.join(__dirname, '..', 'data', 'burden_volcano'));

function sanitizeBaseName(value) {
    const cleaned = String(value || '').trim();
    return /^[A-Za-z0-9._-]+$/.test(cleaned) ? cleaned : null;
}

async function parseTsvFromStore(store, relativeName) {
    const fullPath = store.resolve(relativeName);
    if (!fullPath) return null;

    const stat = await store.stat(fullPath);
    if (!stat || !stat.isFile) return null;

    const stream = await store.createReadStream(fullPath);
    return parseTsvStream(stream);
}

router.get('/api/programs/info', async (req, res) => {
    try {
        const map = await programModel.getProgramInfo();
        res.json(map);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/programs/list', async (req, res) => {
    try {
        const exists = await programStore.exists(programStore.rootPath);
        if (!exists) return res.json({ files: [] });

        const files = (await programStore.list(programStore.rootPath))
            .filter((entry) => entry.type === 'file' && entry.name.endsWith('.tsv'))
            .map((entry) => entry.name.replace(/\.tsv$/i, ''));

        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/programs/:fileId', async (req, res) => {
    try {
        const safeFileId = sanitizeBaseName(req.params.fileId);
        if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

        const data = await parseTsvFromStore(programStore, `${safeFileId}.tsv`);
        if (!data) return res.status(404).json({ error: 'Not found' });

        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/burden-volcano/:fileId', async (req, res) => {
    try {
        const safeFileId = sanitizeBaseName(req.params.fileId);
        if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

        const data = await parseTsvFromStore(burdenVolcanoStore, `${safeFileId}_hits.tsv`);
        if (!data) return res.status(404).json({ error: 'Not found' });

        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
