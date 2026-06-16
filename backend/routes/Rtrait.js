const express = require('express');
const { createFileStore, buildHttpError } = require('../lib/fileStore');
const { ByteLruCache } = require('../lib/byteLruCache');
const { config } = require('../lib/config');
const { asyncRoute, throwIfAborted } = require('../lib/http');
const { normalizeSafeBaseNameList, parsePositiveInt } = require('../lib/request');
const { forEachTsvRow } = require('../lib/tsv');
const { findVariantFile } = require('../lib/variantFiles');

const router = express.Router();

const manhattanStore = createFileStore(config.paths.gwasManhattanDataDir);
const TSV_CACHE = new ByteLruCache({
    maxBytes: config.data.manhattanCacheMaxBytes,
    maxEntries: config.data.manhattanCacheMaxEntries,
});
const chromosomeCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function normalizeTraitFileId(traitName) {
    const cleaned = String(traitName || '').trim();
    return /^[A-Za-z0-9._-]+$/.test(cleaned) ? cleaned : null;
}

function parseOptionalNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseNonNegativeNumber(value) {
    const parsed = parseOptionalNumber(value);
    return parsed != null && parsed >= 0 ? parsed : null;
}

function normalizeFilterList(value, { maxItems = 50, maxLength = 120 } = {}) {
    const values = Array.isArray(value) ? value : [value];
    const normalized = [];

    for (const item of values) {
        String(item || '')
            .split(',')
            .map((part) => part.trim())
            .filter((part) => part && part.length <= maxLength)
            .forEach((part) => {
                if (normalized.length < maxItems && !normalized.includes(part)) {
                    normalized.push(part);
                }
            });
    }

    return normalized;
}

function normalizeChromosome(value) {
    return String(value || '').trim().replace(/^chr/i, '').toUpperCase();
}

function parseManhattanReadOptions(query, variant) {
    return {
        rowLimit: variant === 'full'
            ? null
            : parsePositiveInt(query.maxPoints, config.data.maxTsvRows, config.data.maxTsvRows),
        sample: false,
        chromosomes: normalizeFilterList(query.chr, { maxItems: 30, maxLength: 8 })
            .map(normalizeChromosome)
            .filter(Boolean),
        minLogP: parseNonNegativeNumber(query.minLogP),
        programs: normalizeFilterList(query.program),
        genesets: normalizeFilterList(query.geneset),
    };
}

function createSeededRandom(seedValue) {
    let seed = 2166136261;
    const text = String(seedValue || '');
    for (let index = 0; index < text.length; index += 1) {
        seed ^= text.charCodeAt(index);
        seed = Math.imul(seed, 16777619);
    }

    return () => {
        seed += 0x6D2B79F5;
        let value = seed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function matchesManhattanFilters(row, options) {
    if (
        options.chromosomes.length > 0
        && !options.chromosomes.includes(normalizeChromosome(row.chr))
    ) {
        return false;
    }
    if (options.minLogP != null && (row.logp == null || row.logp < options.minLogP)) {
        return false;
    }
    if (
        options.programs.length > 0
        && !row.programs.some((program) => options.programs.includes(program))
    ) {
        return false;
    }
    if (
        options.genesets.length > 0
        && !row.genesets.some((geneset) => options.genesets.includes(geneset))
    ) {
        return false;
    }
    return true;
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

async function readDelimitedTsv(fullPath, options, { signal = null } = {}) {
    throwIfAborted(signal);
    const stat = await manhattanStore.stat(fullPath);
    if (!stat || !stat.isFile) return { rows: [], truncated: false, fileSize: 0 };
    if (stat.size > config.data.maxManhattanFileBytes) {
        throw buildHttpError(413, 'Manhattan TSV file is too large to load through the API');
    }

    const cacheKey = JSON.stringify([fullPath, stat.mtimeMs, options]);
    const cached = TSV_CACHE.get(cacheKey);
    if (cached) return cached;

    throwIfAborted(signal);
    const stream = await manhattanStore.createReadStream(fullPath);
    const rows = [];
    let filteredRowCount = 0;
    const random = createSeededRandom(cacheKey);
    const iteration = await forEachTsvRow(stream, (rawRow) => {
        const row = toTsvRow(rawRow);
        if (!row.chr || row.bp == null || row.p == null) return;
        if (!matchesManhattanFilters(row, options)) return;

        filteredRowCount += 1;
        if (options.rowLimit == null || rows.length < options.rowLimit) {
            rows.push(row);
            return;
        }

        const replacementIndex = Math.floor(random() * filteredRowCount);
        if (replacementIndex < options.rowLimit) {
            rows[replacementIndex] = row;
        }
    }, { signal });
    throwIfAborted(signal);
    const truncated = options.rowLimit != null && filteredRowCount > options.rowLimit;
    rows.sort((a, b) => (
        chromosomeCollator.compare(normalizeChromosome(a.chr), normalizeChromosome(b.chr))
        || a.bp - b.bp
        || String(a.snp || '').localeCompare(String(b.snp || ''))
    ));
    const result = {
        rows,
        truncated,
        rowLimit: options.rowLimit,
        fileSize: stat.size,
        sampling: truncated && options.sample ? 'reservoir' : (truncated ? 'bounded' : 'all'),
        sourceRowCount: iteration.rowCount,
        filteredRowCount,
        filters: {
            chromosomes: options.chromosomes,
            minLogP: options.minLogP,
            programs: options.programs,
            genesets: options.genesets,
        },
    };

    TSV_CACHE.set(cacheKey, result);
    return result;
}

async function getManhattanRows(fileIds, variant = 'hits', { readRows = true, readOptions = null, signal = null } = {}) {
    throwIfAborted(signal);
    const { filePath, fileName } = await findVariantFile(manhattanStore, fileIds, variant);
    if (filePath) {
        throwIfAborted(signal);
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
                filteredRowCount: null,
                filters: null,
            };
        }

        const result = await readDelimitedTsv(filePath, readOptions, { signal });
        return { filePath, fileName, exists: true, ...result };
    }

    return {
        filePath: null,
        fileName: null,
        rows: [],
        exists: false,
        truncated: false,
        rowLimit: null,
        fileSize: 0,
        sampling: null,
        sourceRowCount: null,
        filteredRowCount: null,
        filters: null,
    };
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
    const { abortSignal: signal } = req;
    const fileId = normalizeTraitFileId(req.params.traitName);
    if (!fileId) return res.status(400).json({ error: 'Invalid traitName' });

    const variant = req.query.variant === 'full' ? 'full' : 'hits';
    const lookupIds = [fileId, ...normalizeSafeBaseNameList(req.query.aliasId)];
    const readOptions = parseManhattanReadOptions(req.query, variant);
    const current = await getManhattanRows(lookupIds, variant, { readOptions, signal });
    const fallback = variant === 'full'
        ? await getManhattanRows(lookupIds, 'hits', {
            signal,
            readOptions: {
                ...readOptions,
                rowLimit: config.data.maxTsvRows,
                sample: false,
            },
        })
        : null;
    const hitsResult = variant === 'hits' ? current : fallback || await getManhattanRows(lookupIds, 'hits', { signal });
    const fullResult = variant === 'full' ? current : await getManhattanRows(lookupIds, 'full', { readRows: false, signal });
    const effectiveRows = current.exists
        ? mergeManhattanRows(current.rows, variant === 'full' ? (fallback?.rows || []) : [])
        : (fallback?.rows || []);
    const usingFallback = !current.exists && variant === 'full' && Boolean(fallback?.exists);

    throwIfAborted(signal);
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
        filteredRowCount: current.exists ? current.filteredRowCount : (fallback?.filteredRowCount || null),
        returnedRowCount: effectiveRows.length,
        filters: current.exists ? current.filters : (fallback?.filters || null),
        data: effectiveRows,
        summary: buildManhattanSummary(effectiveRows),
        notes: {
            distance_to_gene: '0 means the variant falls within the gene body; hundreds to thousands of bp is usually near; tens of thousands of bp or more is relatively distal.',
            variant: 'Use variant=hits for significant loci. Full mode applies server-side filters and returns all matching rows unless blocked by file-size limits.',
        },
    });
}));

module.exports = router;
