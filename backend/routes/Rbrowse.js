const express = require('express');
const router = express.Router();
const metaModel = require('../models/Mmeta');

router.get('/api/browse', async (req, res) => {
    try {
        const { page, limit, sortBy, order } = req.query;
        const result = await metaModel.getTraits({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            sortBy: sortBy || 'trait_name',
            order: order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/meta/:fileId', async (req, res) => {
    try {
        const meta = await metaModel.getTraitMeta(req.params.fileId);
        if (!meta) return res.status(404).json({ error: 'Not found' });
        res.json(meta);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
