const express = require('express');
const router = express.Router();
const gwasModel = require('../models/MgetGwasByTrait');
const fs = require('fs');
const path = require('path');

const MANHATTAN_DATA_DIR = process.env.GWAS_MANHATTAN_DATA_DIR || path.join(__dirname, '..', 'data', 'gwas_manhattan');
const TSV_CACHE = new Map();

function normalizeTraitFileId(traitName) {
    return String(traitName || '').trim();
}

function parseOptionalNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function distanceBucket(distance) {
    if (distance == null) return 'unknown';
    const absDistance = Math.abs(distance);
    if (absDistance === 0) return 'in_gene';
    if (absDistance <= 5000) return 'near';
    if (absDistance <= 50000) return 'moderate';
    return 'distal';
}

function parseDelimitedValues(value) {
    return String(value || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean);
}

function toTsvRow(row) {
    const chr = String(row.chr || '').trim();
    const bp = parseOptionalNumber(row.bp);
    const p = parseOptionalNumber(row.p);
    const logp = parseOptionalNumber(row.logp);
    const distanceToGene = parseOptionalNumber(row.distance_to_gene);
    const programs = parseDelimitedValues(row.program);
    const genesets = parseDelimitedValues(row.geneset);

    return {
        chr,
        bp,
        snp: String(row.snp || '').trim(),
        p,
        logp: logp != null ? logp : (p && p > 0 ? -Math.log10(p) : null),
        nearestGene: String(row.nearest_gene || '').trim(),
        distanceToGene,
        distanceBucket: distanceBucket(distanceToGene),
        program: String(row.program || '').trim(),
        programs,
        geneset: String(row.geneset || '').trim(),
        genesets,
        primaryProgram: programs[0] || '',
        primaryGeneset: genesets[0] || '',
        hasProgram: programs.length > 0,
        hasGeneset: genesets.length > 0,
    };
}

async function readDelimitedTsv(filePath) {
    const stat = await fs.promises.stat(filePath);
    const cached = TSV_CACHE.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.rows;

    const raw = await fs.promises.readFile(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
        TSV_CACHE.set(filePath, { mtimeMs: stat.mtimeMs, rows: [] });
        return [];
    }

    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map((line) => {
        const cols = line.split('\t');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = cols[index] ?? '';
        });
        return toTsvRow(row);
    }).filter((row) => row.chr && row.bp != null && row.p != null);

    TSV_CACHE.set(filePath, { mtimeMs: stat.mtimeMs, rows });
    return rows;
}

async function getManhattanRows(fileId, variant = 'hits') {
    const suffix = variant === 'full' ? '_full.tsv' : '_hits.tsv';
    const filePath = path.join(MANHATTAN_DATA_DIR, `${fileId}${suffix}`);
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        const rows = await readDelimitedTsv(filePath);
        return { filePath, rows, exists: true };
    } catch {
        return { filePath, rows: [], exists: false };
    }
}

function collectTopCounts(rows, key) {
    const counts = new Map();
    for (const row of rows) {
        const values = key === 'programs' ? row.programs : row.genesets;
        values.forEach((value) => {
            counts.set(value, (counts.get(value) || 0) + 1);
        });
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count }));
}

function buildManhattanSummary(rows) {
    const withProgram = rows.filter((row) => row.hasProgram).length;
    const withGeneset = rows.filter((row) => row.hasGeneset).length;
    const inGene = rows.filter((row) => row.distanceBucket === 'in_gene').length;
    const nearGene = rows.filter((row) => row.distanceBucket === 'near').length;
    const moderateGene = rows.filter((row) => row.distanceBucket === 'moderate').length;
    const distalGene = rows.filter((row) => row.distanceBucket === 'distal').length;
    const topPrograms = collectTopCounts(rows, 'programs').slice(0, 20);
    const topGenesets = collectTopCounts(rows, 'genesets').slice(0, 20);

    return {
        totalRows: rows.length,
        withProgram,
        withGeneset,
        withoutProgram: rows.length - withProgram,
        withoutGeneset: rows.length - withGeneset,
        distanceBuckets: {
            in_gene: inGene,
            near: nearGene,
            moderate: moderateGene,
            distal: distalGene,
            unknown: rows.length - inGene - nearGene - moderateGene - distalGene,
        },
        topPrograms,
        topGenesets,
    };
}

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

router.get('/api/trait/manhattan/:traitName', async (req, res) => {
    try {
        const fileId = normalizeTraitFileId(req.params.traitName);
        const variant = req.query.variant === 'full' ? 'full' : 'hits';
        const { rows, exists } = await getManhattanRows(fileId, variant);
        const fallback = variant === 'full' ? await getManhattanRows(fileId, 'hits') : null;
        const effectiveRows = exists ? rows : (fallback?.rows || []);
        const usingFallback = !exists && variant === 'full' && (fallback?.exists || false);

        const availableVariants = {
            hits: (await getManhattanRows(fileId, 'hits')).exists,
            full: variant === 'full' ? exists : (await getManhattanRows(fileId, 'full')).exists,
        };

        res.json({
            fileId,
            variant,
            requestedVariant: variant,
            resolvedVariant: exists ? variant : (usingFallback ? 'hits' : variant),
            fallbackUsed: usingFallback,
            availableVariants,
            hasData: effectiveRows.length > 0,
            data: effectiveRows,
            summary: buildManhattanSummary(effectiveRows),
            notes: {
                distance_to_gene: '0 means the variant falls within the gene body; hundreds to thousands of bp is usually near; tens of thousands of bp or more is relatively distal.',
                fullVariantPlaceholder: 'When full-variant TSVs are added later, request variant=full to render all loci.',
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
