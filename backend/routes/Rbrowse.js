const express = require('express');
const router = express.Router();
const metaModel = require('../models/Mmeta');
const { asyncRoute } = require('../lib/http');
const { normalizeIdentifier, parsePageOptions } = require('../lib/request');

router.get('/api/browse', asyncRoute(async (req, res) => {
    const result = await metaModel.getTraits(parsePageOptions(req.query, {
        defaultLimit: 20,
        defaultSortBy: 'trait_name',
    }));
    res.json(result);
}));

router.get('/api/meta/:fileId', asyncRoute(async (req, res) => {
    const fileId = normalizeIdentifier(req.params.fileId, 255);
    if (!fileId) return res.status(400).json({ error: 'Invalid fileId' });

    const meta = await metaModel.getTraitMeta(fileId);
    if (!meta) return res.status(404).json({ error: 'Not found' });
    res.json(meta);
}));

module.exports = router;
