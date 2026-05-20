const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const programModel = require('../models/Mprogram');
const router = express.Router();

const DATA_DIR = process.env.PROGRAM_DATA_DIR || path.join(__dirname, '..', 'data', 'program_regulator');
const BURDEN_VOLCANO_DIR = process.env.BURDEN_VOLCANO_DIR || path.join(__dirname, '..', 'data', 'burden_volcano');

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

// Program 注释信息（必须在 /:fileId 之前，否则 Express 把 /info 当成 :fileId）
router.get('/api/programs/info', async (req, res) => {
    try {
        const map = await programModel.getProgramInfo();
        res.json(map);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 列出可用的 Program TSV
router.get('/api/programs/list', (req, res) => {
    try {
        if (!fs.existsSync(DATA_DIR)) return res.json({ files: [] });
        const files = fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.tsv'))
            .map(f => f.replace('.tsv', ''));
        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 获取某个 trait 的 Program scatter 数据
router.get('/api/programs/:fileId', async (req, res) => {
    try {
        const filePath = path.join(DATA_DIR, `${req.params.fileId}.tsv`);
        const data = await parseTSV(filePath);
        if (!data) return res.status(404).json({ error: 'Not found' });
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/burden-volcano/:fileId', async (req, res) => {
    try {
        const filePath = path.join(BURDEN_VOLCANO_DIR, `${req.params.fileId}_hits.tsv`);
        const data = await parseTSV(filePath);
        if (!data) return res.status(404).json({ error: 'Not found' });
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
