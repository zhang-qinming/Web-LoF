const express = require('express');
const path = require('path');
const { createFileStore } = require('../lib/fileStore');
const { parseTsvStream } = require('../lib/tsv');

const router = express.Router();
const regulationStore = createFileStore(process.env.REGULATION_DATA_DIR || path.join(__dirname, '..', 'data', 'cNMF_regulation'));

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function parseTsvFromStore(relativeName) {
    const fullPath = regulationStore.resolve(relativeName);
    if (!fullPath) return null;

    const stat = await regulationStore.stat(fullPath);
    if (!stat || !stat.isFile) return null;

    const stream = await regulationStore.createReadStream(fullPath);
    return parseTsvStream(stream);
}

router.get('/api/regulation/list', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/regulation/:programId', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
