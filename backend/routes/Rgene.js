const express = require('express');
const geneProgramModel = require('../models/MgeneProgram');
const semanticRelationsModel = require('../models/MsemanticRelations');
const { asyncRoute } = require('../lib/http');
const { normalizeIdentifier, parsePositiveInt } = require('../lib/request');

const router = express.Router();

router.get('/api/genes', asyncRoute(async (req, res) => {
    const rawLimit = String(req.query.limit ?? '').trim();
    const limit = rawLimit === '0' ? 0 : parsePositiveInt(req.query.limit, 25, 200);
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const sortBy = normalizeIdentifier(req.query.sortBy || 'totalTraits', 50) || 'totalTraits';
    const order = String(req.query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const search = normalizeIdentifier(req.query.search || req.query.q, 120) || '';

    const result = await geneProgramModel.getGenes({ page, limit, sortBy, order, search });
    res.json(result);
}));

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

    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, 250);
    const sortBy = normalizeIdentifier(req.query.sortBy || 'absGamma', 50) || 'absGamma';
    const order = String(req.query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const result = await geneProgramModel.getGenePrograms(geneId, { page, limit, sortBy, order });
    res.json(result);
}));

router.get('/api/genes/:geneId/program-roles', asyncRoute(async (req, res) => {
    const geneId = normalizeIdentifier(req.params.geneId, 120);
    if (!geneId) return res.status(400).json({ error: 'Invalid geneId' });

    const result = await semanticRelationsModel.getGeneProgramRoles(geneId);
    res.json(result);
}));

router.get('/api/genes/:geneId/overview', asyncRoute(async (req, res) => {
    const geneId = normalizeIdentifier(req.params.geneId, 120);
    if (!geneId) return res.status(400).json({ error: 'Invalid geneId' });

    const result = await geneProgramModel.getGeneOverview(geneId);
    res.json(result);
}));

router.get('/api/genes/:geneId/records', asyncRoute(async (req, res) => {
    const geneId = normalizeIdentifier(req.params.geneId, 120);
    if (!geneId) return res.status(400).json({ error: 'Invalid geneId' });

    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, 250);
    const sortBy = normalizeIdentifier(req.query.sortBy || 'absGamma', 50) || 'absGamma';
    const order = String(req.query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const result = await geneProgramModel.getGeneProgramRecords(geneId, { page, limit, sortBy, order });
    res.json(result);
}));

router.get('/api/genes/:geneId/association-traits', asyncRoute(async (req, res) => {
    const geneId = normalizeIdentifier(req.params.geneId, 120);
    if (!geneId) return res.status(400).json({ error: 'Invalid geneId' });

    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, 250);
    const sortBy = normalizeIdentifier(req.query.sortBy || 'trait', 50) || 'trait';
    const order = String(req.query.order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const result = await semanticRelationsModel.getGeneAssociationTraits(geneId, { page, limit, sortBy, order });
    res.json(result);
}));

module.exports = router;
