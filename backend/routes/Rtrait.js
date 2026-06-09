const express = require('express');
const { createFileStore, buildHttpError } = require('../lib/fileStore');
const { config } = require('../lib/config');
const { asyncRoute } = require('../lib/http');
const { normalizeSafeBaseNameList } = require('../lib/request');
const { parseTsvStream } = require('../lib/tsv');
const { findVariantFile } = require('../lib/variantFiles');

const router = express.Router();

const manhattanStore = createFileStore(config.paths.gwasManhattanDataDir);
const TSV_CACHE = new Map();

function normalizeTraitFileId(traitName) {
    const cleaned = String(traitName || '').trim();
    return /^[A-Za-z0-9._-]+$/.test(cleaned) ? cleaned : null;
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
    if (!stat || !stat.isFile) return { rows: [], truncated: false, fileSize: 0 };
    if (stat.size > config.data.maxManhattanFileBytes) {
        throw buildHttpError(413, 'Manhattan TSV file is too large to load through the API');
    }

    const cacheKey = `${fullPath}:all`;
    const cached = TSV_CACHE.get(cacheKey);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.result;

    const stream = await manhattanStore.createReadStream(fullPath);
    const rawRows = await parseTsvStream(stream);
    const rows = rawRows
        .map(toTsvRow)
        .filter((row) => row.chr && row.bp != null && row.p != null);
    const result = {
        rows,
        truncated: false,
        rowLimit: null,
        fileSize: stat.size,
        sampling: 'all',
        sourceRowCount: rawRows.length,
    };

    TSV_CACHE.set(cacheKey, { mtimeMs: stat.mtimeMs, result });
    return result;
}

async function getManhattanRows(fileIds, variant = 'hits', { readRows = true } = {}) {
    const { filePath, fileName } = await findVariantFile(manhattanStore, fileIds, variant);
    if (filePath) {
        if (!readRows) {
            const stat = await manhattanStore.stat(filePath);
            return {
                filePath,
                fileName,
                rows: [],
                exists: true,
                truncated: false,
                rowLimit: null,
                fileSize: (stat && stat.size) || 0,
                sampling: null,
                sourceRowCount: null,
            };
        }

        const result = await readDelimitedTsv(filePath);
        return { filePath, fileName, exists: true, ...result };
    }

    return { filePath: null, fileName: null, rows: [], exists: false, truncated: false, rowLimit: null, fileSize: 0, sampling: null, sourceRowCount: null };
}

function mergeManhattanRows(rows, hitRows) {
    if (!hitRows.length) return rows;

    const merged = [];
    const seen = new Set();
    const addRow = (row) => {
        const key = `${row.chr}:${row.bp}:${row.snp || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(row);
    };

    hitRows.forEach(addRow);
    rows.forEach(addRow);
    return merged;
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

router.get('/api/trait/manhattan/:traitName', asyncRoute(async (req, res) => {
    const fileId = normalizeTraitFileId(req.params.traitName);
    if (!fileId) return res.status(400).json({ error: 'Invalid traitName' });

    const variant = req.query.variant === 'full' ? 'full' : 'hits';
    const lookupIds = [fileId, ...normalizeSafeBaseNameList(req.query.aliasId)];
    const current = await getManhattanRows(lookupIds, variant);
    const fallback = variant === 'full' ? await getManhattanRows(lookupIds, 'hits') : null;
    const hitsResult = variant === 'hits' ? current : fallback || await getManhattanRows(lookupIds, 'hits');
    const fullResult = variant === 'full' ? current : await getManhattanRows(lookupIds, 'full', { readRows: false });
    const effectiveRows = current.exists
        ? mergeManhattanRows(current.rows, variant === 'full' ? (fallback?.rows || []) : [])
        : (fallback?.rows || []);
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
        hasData: effectiveRows.length > 0,
        truncated: Boolean(current.exists ? current.truncated : fallback?.truncated),
        rowLimit: current.exists ? current.rowLimit : (fallback?.rowLimit || null),
        fileSize: current.exists ? current.fileSize : (fallback?.fileSize || 0),
        sampling: current.exists ? current.sampling : (fallback?.sampling || null),
        sourceRowCount: current.exists ? current.sourceRowCount : (fallback?.sourceRowCount || null),
        data: effectiveRows,
        summary: buildManhattanSummary(effectiveRows),
        notes: {
            distance_to_gene: '0 means the variant falls within the gene body; hundreds to thousands of bp is usually near; tens of thousands of bp or more is relatively distal.',
            variant: 'Use variant=hits for significant loci or variant=full for all loci when a full TSV is available.',
        },
    });
}));

module.exports = router;
