const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const router = express.Router();

const DATA_DIR = process.env.REGULATION_DATA_DIR || path.join(__dirname, '..', 'data', 'cNMF_regulation');

async function parseTSV(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const rows = [];
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
    });
    let header = true;
    let headers = [];
    for await (const line of rl) {
        const cols = line.split('\t');
        if (header) {
            headers = cols.map(c => c.trim().replace(/^﻿/, ''));
            header = false;
            continue;
        }
        const row = {};
        headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
        rows.push(row);
    }
    return rows;
}

// List available programs
router.get('/api/regulation/list', (req, res) => {
    try {
        if (!fs.existsSync(DATA_DIR)) return res.json({ programs: [] });
        const programs = fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.txt'))
            .map(f => {
                const match = f.match(/program(\d+)/);
                return { id: match ? match[1] : f, file: f };
            })
            .sort((a, b) => parseInt(a.id) - parseInt(b.id));
        res.json({ programs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get gene-level perturbation data for a program
router.get('/api/regulation/:programId', async (req, res) => {
    try {
        // 精确匹配 program{N}_ 或 program{N}.  — 避免 program1 匹配到 program10
        const regex = new RegExp(`program${req.params.programId}[_.]`);
        const files = fs.readdirSync(DATA_DIR).filter(f => regex.test(f));
        if (files.length === 0) return res.status(404).json({ error: 'Program not found' });
        const fileName = files[0];
        const filePath = path.join(DATA_DIR, fileName);
        const data = await parseTSV(filePath);
        if (!data) return res.status(404).json({ error: 'Failed to parse' });
        res.json({ data, fileName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
