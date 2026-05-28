const express = require('express');
const geneProgramModel = require('../models/MgeneProgram');
const { asyncRoute } = require('../lib/http');
const { normalizeIdentifier, parsePositiveInt } = require('../lib/request');

const router = express.Router();

router.get('/api/genes/search', asyncRoute(async (req, res) => {
    const query = normalizeIdentifier(req.query.q || req.query.query, 120);
    if (!query) return res.json({ query: '', totalGenes: 0, genes: [] });

    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const result = await geneProgramModel.searchGenes(query, limit);
    res.json(result);
}));

router.get('/api/genes/recommended', asyncRoute(async (req, res) => {
    const limit = parsePositiveInt(req.query.limit, 12, 50);
    const result = await geneProgramModel.getRecommendedGenes(limit);
    res.json(result);
}));

router.get('/api/genes/:geneId/programs', asyncRoute(async (req, res) => {
    const geneId = normalizeIdentifier(req.params.geneId, 120);
    if (!geneId) return res.status(400).json({ error: 'Invalid geneId' });

    const result = await geneProgramModel.getGenePrograms(geneId);
    res.json(result);
}));

module.exports = router;
