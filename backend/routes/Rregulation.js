const express = require('express');
const { createFileStore } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { parseTsvStream } = require('../lib/tsv');
const { trySendPrecomputedJson } = require('../lib/precomputedJson');

const router = express.Router();
const regulationStore = createFileStore(config.paths.regulationDataDir);

function parseProgramEntry(fileName) {
    const exact = String(fileName || '').match(/K(\d+)_program(\d+)_perturb_effects\.txt$/i);
    if (exact) {
        return {
            id: exact[2],
            rank: Number(exact[1]),
            file: fileName,
        };
    }

    const fallback = String(fileName || '').match(/program(\d+)/i);
    if (!fallback) return null;
    return {
        id: fallback[1],
        rank: Number.POSITIVE_INFINITY,
        file: fileName,
    };
}

async function listProgramFiles() {
    const exists = await regulationStore.exists(regulationStore.rootPath);
    if (!exists) return [];

    const bestByProgram = new Map();
    const files = (await regulationStore.list(regulationStore.rootPath))
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.txt'));

    files.forEach((entry) => {
        const parsed = parseProgramEntry(entry.name);
        if (!parsed) return;
        const current = bestByProgram.get(parsed.id);
        if (!current || parsed.rank > current.rank || (parsed.rank === current.rank && parsed.file.localeCompare(current.file) > 0)) {
            bestByProgram.set(parsed.id, parsed);
        }
    });

    return [...bestByProgram.values()].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
}

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
    const programs = await listProgramFiles();
    res.json({ programs });
}));

router.get('/api/regulation/:programId', asyncRoute(async (req, res) => {
    const safeProgramId = String(req.params.programId || '').trim();
    if (!/^\d+$/.test(safeProgramId)) {
        return res.status(400).json({ error: 'Invalid programId' });
    }

    const programs = await listProgramFiles();
    const match = programs.find((item) => item.id === safeProgramId);
    if (!match) return res.status(404).json({ error: 'Program not found' });

    const fileName = match.file;
    const sent = await trySendPrecomputedJson(req, res, {
        store: regulationStore,
        sourceFileName: fileName,
    });
    if (sent) return;

    const data = await parseTsvFromStore(fileName);
    if (!data) return res.status(404).json({ error: 'Failed to parse' });

    res.json({ data, fileName });
}));

module.exports = router;
