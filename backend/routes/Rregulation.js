const express = require('express');
const { createFileStore } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { parseTsvStream } = require('../lib/tsv');

const router = express.Router();
const regulationStore = createFileStore(config.paths.regulationDataDir);

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function parseTsvFromStore(relativeName) {
    const fullPath = regulationStore.resolve(relativeName);
    if (!fullPath) return null;

    const stat = await regulationStore.stat(fullPath);
    if (!stat || !stat.isFile) return null;
    if (stat.size > config.data.maxTsvFileBytes) {
        const err = new Error('TSV file is too large');
        err.status = 413;
        err.expose = true;
        throw err;
    }

    const stream = await regulationStore.createReadStream(fullPath);
    return parseTsvStream(stream, { maxRows: config.data.maxTsvRows });
}

router.get('/api/regulation/list', asyncRoute(async (req, res) => {
    const exists = await regulationStore.exists(regulationStore.rootPath);
    if (!exists) return res.json({ programs: [] });

    const programs = (await regulationStore.list(regulationStore.rootPath))
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.txt'))
        .map((entry) => {
            const match = entry.name.match(/program(\d+)/i);
            return { id: match ? match[1] : entry.name, file: entry.name };
        })
        .sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));

    res.json({ programs });
}));

router.get('/api/regulation/:programId', asyncRoute(async (req, res) => {
    const safeProgramId = String(req.params.programId || '').trim();
    if (!/^\d+$/.test(safeProgramId)) {
        return res.status(400).json({ error: 'Invalid programId' });
    }

    const regex = new RegExp(`program${escapeRegex(safeProgramId)}[_.]`, 'i');
    const files = (await regulationStore.list(regulationStore.rootPath))
        .filter((entry) => entry.type === 'file' && regex.test(entry.name));

    if (files.length === 0) return res.status(404).json({ error: 'Program not found' });

    const fileName = files[0].name;
    const data = await parseTsvFromStore(fileName);
    if (!data) return res.status(404).json({ error: 'Failed to parse' });

    res.json({ data, fileName });
}));

module.exports = router;
