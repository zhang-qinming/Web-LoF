const express = require('express');
const path = require('path');
const gwasModel = require('../models/MgetGwasByTrait');
const { createFileStore } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { parsePageOptions } = require('../lib/request');
const { stripUtf8Bom } = require('../lib/tsv');

const router = express.Router();

const manhattanStore = createFileStore(process.env.GWAS_MANHATTAN_DATA_DIR || path.join(__dirname, '..', 'data', 'gwas_manhattan'));
const TSV_CACHE = new Map();

function normalizeTraitFileId(traitName) {
    const cleaned = String(traitName || '').trim();
    return /^[A-Za-z0-9._-]+$/.test(cleaned) ? cleaned : null;
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function buildVariantFileNames(fileId, variant) {
    const base = String(fileId || '').replace(/\.tsv$/i, '');
    const withoutVariant = base.replace(/_(hits|full)$/i, '');
    const suffix = variant === 'full' ? '_full.tsv' : '_hits.tsv';

    return uniqueValues([
        `${withoutVariant}${suffix}`,
        `${base}${suffix}`,
        `${base}.tsv`,
    ]);
}

function normalizeTraitName(traitName) {
    const cleaned = String(traitName || '').trim();
    return cleaned && cleaned.length <= 500 ? cleaned : null;
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

async function readDelimitedTsv(fullPath) {
    const stat = await manhattanStore.stat(fullPath);
    if (!stat || !stat.isFile) return [];
    if (stat.size > config.data.maxManhattanFileBytes) {
        const err = new Error('Manhattan TSV file is too large');
        err.status = 413;
        err.expose = true;
        throw err;
    }

    const cached = TSV_CACHE.get(fullPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.rows;

    const raw = await manhattanStore.readFile(fullPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) {
        TSV_CACHE.set(fullPath, { mtimeMs: stat.mtimeMs, rows: [] });
        return [];
    }

    const headers = lines[0].split('\t').map((header) => stripUtf8Bom(header));
    const rows = lines.slice(1, config.data.maxManhattanRows + 1).map((line) => {
        const cols = line.split('\t');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = cols[index] ?? '';
        });
        return toTsvRow(row);
    }).filter((row) => row.chr && row.bp != null && row.p != null);

    TSV_CACHE.set(fullPath, { mtimeMs: stat.mtimeMs, rows });
    return rows;
}

async function getManhattanRows(fileId, variant = 'hits') {
    const candidates = buildVariantFileNames(fileId, variant);

    for (const fileName of candidates) {
        const filePath = manhattanStore.resolve(fileName);
        if (!filePath) continue;

        const stat = await manhattanStore.stat(filePath);
        if (!stat || !stat.isFile) continue;

        const rows = await readDelimitedTsv(filePath);
        return { filePath, fileName, rows, exists: true, candidates };
    }

    return { filePath: null, fileName: null, rows: [], exists: false, candidates };
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
    const rawLimit = Number(query.limit);
    if (Number.isFinite(rawLimit) && rawLimit < 1) {
        return {
            page: 1,
            limit: -1,
            sortBy: query.sortBy || 'CHR',
            order: query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
        };
    }

    return parsePageOptions(query, {
        defaultLimit: 50,
        maxLimit: config.query.maxGwasPageLimit,
        defaultSortBy: 'CHR',
    });
}

router.get('/api/trait/:traitName', asyncRoute(async (req, res) => {
    const traitName = normalizeTraitName(req.params.traitName);
    if (!traitName) return res.status(400).json({ error: 'Invalid traitName' });

    const result = await gwasModel.getGwasDataByTrait(traitName, parseOptions(req.query));
    res.json(result);
}));

router.get('/api/trait/allgwas/:traitName', asyncRoute(async (req, res) => {
    const traitName = normalizeTraitName(req.params.traitName);
    if (!traitName) return res.status(400).json({ error: 'Invalid traitName' });

    const result = await gwasModel.getGwasDataByTrait(traitName);
    res.json(result);
}));

router.get('/api/trait/filtergwas/:traitName', asyncRoute(async (req, res) => {
    const traitName = normalizeTraitName(req.params.traitName);
    if (!traitName) return res.status(400).json({ error: 'Invalid traitName' });

    const { 'CHR[]': CHR, CHR: CHRValue, BP_start, BP_end, P_min, P_max, rsID } = req.query;
    const result = await gwasModel.getFilteredGwasDataByTrait(
        traitName,
        { CHR: CHR || CHRValue, BP_start, BP_end, P_min, P_max, rsID },
        parseOptions(req.query)
    );
    res.json(result);
}));

router.get('/api/trait/manhattan/:traitName', asyncRoute(async (req, res) => {
    const fileId = normalizeTraitFileId(req.params.traitName);
    if (!fileId) return res.status(400).json({ error: 'Invalid traitName' });

    const variant = req.query.variant === 'full' ? 'full' : 'hits';
    const current = await getManhattanRows(fileId, variant);
    const fallback = variant === 'full' ? await getManhattanRows(fileId, 'hits') : null;
    const hitsResult = variant === 'hits' ? current : fallback || await getManhattanRows(fileId, 'hits');
    const fullResult = variant === 'full' ? current : await getManhattanRows(fileId, 'full');
    const effectiveRows = current.exists ? current.rows : (fallback?.rows || []);
    const usingFallback = !current.exists && variant === 'full' && Boolean(fallback?.exists);

    res.json({
        fileId,
        variant,
        requestedVariant: variant,
        resolvedVariant: current.exists ? variant : (usingFallback ? 'hits' : variant),
        fallbackUsed: usingFallback,
        fileName: current.exists ? current.fileName : (fallback?.fileName || null),
        availableVariants: {
            hits: hitsResult.exists,
            full: fullResult.exists,
        },
        debug: {
            root: manhattanStore.rootPath,
            hitsCandidates: hitsResult.candidates || [],
            fullCandidates: fullResult.candidates || [],
        },
        hasData: effectiveRows.length > 0,
        data: effectiveRows,
        summary: buildManhattanSummary(effectiveRows),
        notes: {
            distance_to_gene: '0 means the variant falls within the gene body; hundreds to thousands of bp is usually near; tens of thousands of bp or more is relatively distal.',
            variant: 'Use variant=hits for significant loci or variant=full for all loci when a full TSV is available.',
        },
    });
}));

module.exports = router;
