const express = require('express');
const router = express.Router();
const gwasModel = require('../models/MgetGwasByTrait');

function parseOptions(query) {
    return {
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 50,
        sortBy: query.sortBy || 'CHR',
        order: query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    };
}

router.get('/api/trait/:traitName', async (req, res) => {
    try {
        const result = await gwasModel.getGwasDataByTrait(req.params.traitName, parseOptions(req.query));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/trait/allgwas/:traitName', async (req, res) => {
    try {
        const result = await gwasModel.getGwasDataByTrait(req.params.traitName);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/trait/filtergwas/:traitName', async (req, res) => {
    try {
        const { 'CHR[]': CHR, BP_start, BP_end, P_min, P_max, rsID } = req.query;
        const result = await gwasModel.getFilteredGwasDataByTrait(
            req.params.traitName,
            { CHR, BP_start, BP_end, P_min, P_max, rsID },
            parseOptions(req.query)
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
