const express = require('express');
const router = express.Router();
const traitModel = require('../models/MgetTrait');

router.get('/api/browse', async (req, res) => {
    try {
        const { page, limit, sortBy, order } = req.query;
        const result = await traitModel.getAllTraitsInfo({
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            sortBy: sortBy || 'Trait',
            order: order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
