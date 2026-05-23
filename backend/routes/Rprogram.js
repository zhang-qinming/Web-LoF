const express = require('express');
const programModel = require('../models/Mprogram');
const { createFileStore } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { normalizeSafeBaseName, normalizeSafeBaseNameList } = require('../lib/request');
const { parseTsvStream } = require('../lib/tsv');
const { findVariantFile } = require('../lib/variantFiles');

const router = express.Router();

const programStore = createFileStore(config.paths.programDataDir);
const burdenVolcanoStore = createFileStore(config.paths.burdenVolcanoDir);

async function parseTsvFromStore(store, relativeName) {
    const fullPath = store.resolve(relativeName);
    if (!fullPath) return null;

    const stat = await store.stat(fullPath);
    if (!stat || !stat.isFile) return null;
    if (stat.size > config.data.maxTsvFileBytes) {
        const err = new Error('TSV file is too large');
        err.status = 413;
        err.expose = true;
        throw err;
    }

    const stream = await store.createReadStream(fullPath);
    return parseTsvStream(stream, { maxRows: config.data.maxTsvRows });
}

async function getTsvVariant(store, fileIds, variant, suffix) {
    const { fileName } = await findVariantFile(store, fileIds, variant, { suffix });
    if (fileName) {
        const data = await parseTsvFromStore(store, fileName);
        return { exists: true, data: data || [], fileName };
    }

    return { exists: false, data: [], fileName: null };
}

function summarizeBurdenRows(rows) {
    let positive = 0;
    let negative = 0;
    let annotatedProgram = 0;
    let annotatedGeneset = 0;

    for (const row of rows) {
        const beta = Number(row.beta);
        if (Number.isFinite(beta)) {
            if (beta >= 0) positive += 1;
            else negative += 1;
        }
        if (String(row.program || '').trim()) annotatedProgram += 1;
        if (String(row.geneset || '').trim()) annotatedGeneset += 1;
    }

    return {
        totalRows: rows.length,
        positive,
        negative,
        annotatedProgram,
        annotatedGeneset,
    };
}

router.get('/api/programs/info', asyncRoute(async (req, res) => {
    const map = await programModel.getProgramInfo();
    res.json(map);
}));

router.get('/api/programs/list', asyncRoute(async (req, res) => {
    const exists = await programStore.exists(programStore.rootPath);
    if (!exists) return res.json({ files: [] });

    const files = (await programStore.list(programStore.rootPath))
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.tsv'))
        .map((entry) => entry.name.replace(/\.tsv$/i, ''));

    res.json({ files });
}));

router.get('/api/programs/:fileId', asyncRoute(async (req, res) => {
    const safeFileId = normalizeSafeBaseName(req.params.fileId);
    if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

    const data = await parseTsvFromStore(programStore, `${safeFileId}.tsv`);
    if (!data) return res.status(404).json({ error: 'Not found' });

    res.json({ data });
}));

router.get('/api/burden-volcano/:fileId', asyncRoute(async (req, res) => {
    const safeFileId = normalizeSafeBaseName(req.params.fileId);
    if (!safeFileId) return res.status(400).json({ error: 'Invalid fileId' });

    const variant = req.query.variant === 'full' ? 'full' : 'hits';
    const lookupIds = [safeFileId, ...normalizeSafeBaseNameList(req.query.aliasId)];
    const current = await getTsvVariant(burdenVolcanoStore, lookupIds, variant, '.tsv');
    const fallback = variant === 'full'
        ? await getTsvVariant(burdenVolcanoStore, lookupIds, 'hits', '.tsv')
        : null;
    const hitsResult = variant === 'hits'
        ? current
        : fallback || await getTsvVariant(burdenVolcanoStore, lookupIds, 'hits', '.tsv');
    const fullResult = variant === 'full'
        ? current
        : await getTsvVariant(burdenVolcanoStore, lookupIds, 'full', '.tsv');
    const effective = current.exists ? current : (fallback || current);
    const usingFallback = !current.exists && variant === 'full' && Boolean(fallback?.exists);

    if (!effective.exists) return res.status(404).json({ error: 'Not found' });

    res.json({
        fileId: safeFileId,
        variant,
        requestedVariant: variant,
        resolvedVariant: current.exists ? variant : (usingFallback ? 'hits' : variant),
        fallbackUsed: usingFallback,
        fileName: effective.fileName,
        availableVariants: {
            hits: hitsResult.exists,
            full: fullResult.exists,
        },
        hasData: effective.data.length > 0,
        data: effective.data,
        summary: summarizeBurdenRows(effective.data),
    });
}));

module.exports = router;
