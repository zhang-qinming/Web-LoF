const fs = require('fs');
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2');
const { PassThrough } = require('stream');
const { createFileStore, buildHttpError } = require('../lib/fileStore');
const { config } = require('../lib/config');
const pool = require('../models/db');
const metaModel = require('../models/Mmeta');
const {
    dataArchiveRoot,
    getArchiveFileName,
    statArchive,
    statPackageArchive,
    toArchiveResponse,
} = require('../lib/dataArchives');
const {
    getDataPackageDefinition,
    getDataPackageDefinitions,
    getDataPackageStatus,
} = require('../lib/dataPackages');
const { asyncRoute, throwIfAborted } = require('../lib/http');
const { normalizeIdentifier, normalizeSafeBaseName, parsePositiveInt } = require('../lib/request');
const { findVariantFile } = require('../lib/variantFiles');

const router = express.Router();
const dataStore = createFileStore(config.paths.dataDir);
const manhattanStore = createFileStore(config.paths.gwasManhattanDataDir);
const programStore = createFileStore(config.paths.programDataDir);
const traitProgramGenePanelStore = createFileStore(config.paths.traitProgramGenePanelDir);
const burdenVolcanoStore = createFileStore(config.paths.burdenVolcanoDir);
const posteriorVolcanoStore = createFileStore(config.paths.posteriorVolcanoDir);
const crossTraitMetaTraitsStore = createFileStore(path.join(config.paths.crossTraitHeatmapDir, 'meta', 'traits'));
const crossTraitEffectsStore = createFileStore(path.join(config.paths.crossTraitHeatmapDir, 'tables', 'effects'));
const crossTraitPrecomputedStore = createFileStore(config.paths.crossTraitPrecomputedDir);

const TRAIT_DOWNLOAD_MAX_ITEMS = 20;
const TRAIT_SEARCH_DEFAULT_LIMIT = 20;
const TRAIT_SEARCH_MAX_LIMIT = 50;
const TRAIT_DOWNLOAD_SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000;
const TRAIT_DOWNLOAD_SUMMARY_CACHE_MAX = 1000;
const VOLCANO_VARIANT_ALIASES = {
    full: ['full', 'fulltsv', 'all', 'allgene', 'allgenes', 'gene', 'genes'],
    hits: ['hits', 'hit', 'significant', 'sig'],
};
const PROGRAM_TRAIT_SCATTER_EDGE_COLUMNS = [
    'edge_key',
    'file_id',
    'trait_id',
    'program',
    'program_score',
    'regulator_score',
    'program_p',
    'regulator_p',
    'program_rank',
    'regulator_rank',
    'program_gamma',
    'regulator_beta',
    'enrichment_class',
    'source_file',
];
const GENE_PROGRAM_TRAIT_EDGE_COLUMNS = [
    'edge_key',
    'file_id',
    'trait_id',
    'program',
    'role',
    'side',
    'ensg_id',
    'gene_symbol',
    'gene_label',
    'program_label',
    'program_annotation',
    'post_mean',
    'abs_gamma',
    'gamma_sign',
    'membership_score',
    'rank_within_side',
    'program_trait_sign',
    'regulator_program_sign',
    'predicted_sign',
    'post_mean_sign',
    'is_concordant',
    'is_discordant',
    'display_bucket',
    'display_bucket_label',
    'has_overlap',
    'source_file',
];

let searchIndexCache = null;
let searchIndexBuiltAt = 0;
let searchIndexPromise = null;
const traitDownloadSummaryCache = new Map();
const batchDownloadTokens = new Map();
const BATCH_DOWNLOAD_TTL_MS = 5 * 60 * 1000;
let searchIndexStats = {
    status: 'idle',
    entries: 0,
    dirs: 0,
    startedAt: null,
    finishedAt: null,
    error: null,
};

function resolveRelativePath(relPath = '') {
    const fullPath = dataStore.resolve(relPath);
    if (!fullPath) throw buildHttpError(403, 'Forbidden');
    return fullPath;
}

function toRelativePath(fullPath) {
    const normalizedRoot = dataStore.rootPath;
    if (fullPath === normalizedRoot) return '';

    const relative = fullPath.slice(normalizedRoot.length).replace(/^[\\/]+/, '');
    return relative.split(/[\\/]/).filter(Boolean).join('/');
}

function isoFromMtime(mtimeMs) {
    return mtimeMs ? new Date(mtimeMs).toISOString() : null;
}

function encodeDownloadFilename(fileName) {
    const fallback = String(fileName || 'download')
        .replace(/[\\/\r\n"]/g, '_')
        .replace(/[^\x20-\x7E]/g, '_') || 'download';
    const encoded = encodeURIComponent(String(fileName || 'download'));
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function getArchiveEntryName(relPath, usedNames) {
    const normalized = (relPath || 'file')
        .split(/[\\/]/)
        .filter(Boolean)
        .join('/');

    if (!usedNames.has(normalized)) {
        usedNames.add(normalized);
        return normalized;
    }

    const ext = path.posix.extname(normalized);
    const base = ext ? normalized.slice(0, -ext.length) : normalized;
    let index = 2;
    let candidate = `${base} (${index})${ext}`;

    while (usedNames.has(candidate)) {
        index += 1;
        candidate = `${base} (${index})${ext}`;
    }

    usedNames.add(candidate);
    return candidate;
}

function normalizeRequestedPath(item) {
    if (typeof item !== 'string') return null;
    return item
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '');
}

function toPathList(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

async function getDataRootStat() {
    return dataStore.stat(dataStore.rootPath);
}

async function getDirectoryStatOrEmpty(dir = '') {
    const normalizedDir = String(dir || '').trim();
    const rootStat = await getDataRootStat();

    if (!rootStat || !rootStat.isDirectory) {
        if (!normalizedDir) {
            return {
                empty: true,
                fullPath: dataStore.rootPath,
                stat: null,
            };
        }
        return {
            empty: false,
            fullPath: dataStore.rootPath,
            stat: null,
        };
    }

    const fullPath = resolveRelativePath(normalizedDir);
    const stat = await dataStore.stat(fullPath);
    return {
        empty: false,
        fullPath,
        stat,
    };
}

function cleanupBatchDownloadTokens() {
    const now = Date.now();
    for (const [token, item] of batchDownloadTokens.entries()) {
        if (!item || item.expiresAt <= now) batchDownloadTokens.delete(token);
    }
}

function createBatchDownloadToken(payload) {
    cleanupBatchDownloadTokens();
    const token = crypto.randomBytes(18).toString('base64url');
    batchDownloadTokens.set(token, {
        ...payload,
        expiresAt: Date.now() + BATCH_DOWNLOAD_TTL_MS,
    });
    return token;
}

function getSearchRank(entry, query) {
    if (entry.nameLower === query) return 0;
    if (entry.nameLower.startsWith(query)) return 1;
    if (entry.pathLower.startsWith(query)) return 2;
    if (entry.nameLower.includes(query)) return 3;
    return 4;
}

function compareSearchEntries(a, b, query) {
    return (
        getSearchRank(a, query) - getSearchRank(b, query)
        || Number(b.type === 'file') - Number(a.type === 'file')
        || a.depth - b.depth
        || a.path.length - b.path.length
        || a.path.localeCompare(b.path)
    );
}

function insertLimitedSearchMatch(matches, entry, query, maxMatches) {
    if (!Number.isFinite(maxMatches) || maxMatches <= 0) return;

    let low = 0;
    let high = matches.length;
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (compareSearchEntries(entry, matches[mid], query) < 0) high = mid;
        else low = mid + 1;
    }

    if (low >= maxMatches) return;
    matches.splice(low, 0, entry);
    if (matches.length > maxMatches) matches.pop();
}

function findSearchMatches(searchIndex, query, maxMatches = Number.POSITIVE_INFINITY) {
    const useLimitedBuffer = Number.isFinite(maxMatches);
    const matches = [];
    let totalCount = 0;

    for (const entry of searchIndex) {
        if (!entry.nameLower.includes(query) && !entry.pathLower.includes(query)) continue;
        totalCount += 1;

        if (useLimitedBuffer) insertLimitedSearchMatch(matches, entry, query, maxMatches);
        else matches.push(entry);
    }

    if (!useLimitedBuffer) {
        matches.sort((a, b) => compareSearchEntries(a, b, query));
    }

    return { matches, totalCount };
}

async function createZipArchive(options) {
    const archiverModule = await import('archiver');
    const archiver = archiverModule.default || archiverModule;

    if (typeof archiver === 'function') {
        return archiver('zip', options);
    }

    if (typeof archiverModule.ZipArchive === 'function') {
        return new archiverModule.ZipArchive(options);
    }

    throw new Error('Unsupported archiver module shape');
}

function getZipArchiveOptions() {
    return {
        forceZip64: true,
        // Folder-level data downloads use the highest zlib compression by default.
        zlib: { level: config.data.archiveCompressionLevel },
    };
}

function getDbConnectionConfig() {
    const dbConfig = {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        database: config.db.database,
        dateStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
    };
    if (config.db.password) dbConfig.password = config.db.password;
    return dbConfig;
}

function escapeTsvValue(value) {
    if (value == null) return '';
    return String(value)
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function writeStreamLine(stream, line) {
    return new Promise((resolve, reject) => {
        if (stream.write(line)) {
            resolve();
            return;
        }
        stream.once('drain', resolve);
        stream.once('error', reject);
    });
}

async function getTableColumns(connection, tableName) {
    const [rows] = await connection.promise().query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [tableName],
    );
    return rows.map((row) => row.COLUMN_NAME);
}

async function appendTableTsvToArchive(archive, connection, definition, tableName, manifest, signal) {
    throwIfAborted(signal);
    const columns = await getTableColumns(connection, tableName);
    if (!columns.length) {
        manifest.skippedTables.push({ tableName, reason: 'missing table' });
        return;
    }

    const entryPath = `${definition.rootEntryName}/${tableName}.tsv`;
    const passThrough = new PassThrough();
    archive.append(passThrough, { name: entryPath });

    let rowCount = 0;
    let rowStream = null;
    try {
        await writeStreamLine(passThrough, `${columns.join('\t')}\n`);
        rowStream = connection
            .query(`SELECT * FROM ${mysql.escapeId(tableName)}`)
            .stream({ objectMode: true });

        signal?.addEventListener('abort', () => rowStream.destroy(), { once: true });

        await new Promise((resolve, reject) => {
            rowStream.on('data', async (row) => {
                rowStream.pause();
                try {
                    throwIfAborted(signal);
                    const line = columns.map((column) => escapeTsvValue(row[column])).join('\t');
                    await writeStreamLine(passThrough, `${line}\n`);
                    rowCount += 1;
                    rowStream.resume();
                } catch (err) {
                    rowStream.destroy(err);
                }
            });
            rowStream.on('error', reject);
            rowStream.on('end', resolve);
            passThrough.on('error', reject);
        });
        manifest.tables.push({ tableName, columns: columns.length, rows: rowCount });
    } catch (err) {
        manifest.skippedTables.push({ tableName, reason: err.message || 'export failed' });
        throw err;
    } finally {
        passThrough.end();
    }
}

async function streamDatabasePackage(res, definition, signal) {
    throwIfAborted(signal);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', encodeDownloadFilename(`${definition.id}.zip`));

    const archive = await createZipArchive(getZipArchiveOptions());
    const connection = mysql.createConnection(getDbConnectionConfig());
    const manifest = {
        generatedAt: new Date().toISOString(),
        database: config.db.database,
        packageId: definition.id,
        tables: [],
        skippedTables: [],
    };

    archive.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    archive.pipe(res);

    try {
        for (const tableName of definition.tables) {
            await appendTableTsvToArchive(archive, connection, definition, tableName, manifest, signal);
        }
        if (!manifest.tables.length) throw buildHttpError(404, 'No database tables were exported');
        archive.append(`${JSON.stringify(manifest, null, 2)}\n`, {
            name: `${definition.rootEntryName}/manifest.json`,
        });
        await archive.finalize();
    } finally {
        try {
            await connection.promise().end();
        } catch (err) {
            connection.destroy();
        }
    }
}

function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (match) => `\\${match}`);
}

function sanitizeArchiveSegment(value, fallback = 'trait') {
    return String(value || fallback)
        .trim()
        .replace(/[\\/\r\n"]/g, '_')
        .replace(/[^\w.-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || fallback;
}

function normalizeTraitCandidate(value) {
    const normalized = normalizeIdentifier(value, 255);
    return normalized || null;
}

function buildTraitCandidateIds(meta, requestedId) {
    return [...new Set([
        normalizeTraitCandidate(meta?.file_id),
        normalizeTraitCandidate(requestedId),
        normalizeTraitCandidate(meta?.gwas_id),
        normalizeTraitCandidate(meta?.burden_trait_id),
        normalizeTraitCandidate(meta?.burden_phenotype_id),
        normalizeTraitCandidate(meta?.ldsc_file_id),
        normalizeTraitCandidate(meta?.heritability_trait_id),
        normalizeTraitCandidate(meta?.heritability_lof_id),
    ].filter(Boolean))];
}

function safeFileCandidates(candidates) {
    return candidates
        .map((candidate) => normalizeSafeBaseName(candidate, 255))
        .filter(Boolean);
}

function getStoreRelativePath(store, fullPath) {
    const normalizedRoot = store.rootPath;
    return fullPath
        .slice(normalizedRoot.length)
        .replace(/^[\\/]+/, '')
        .split(/[\\/]/)
        .filter(Boolean)
        .join('/');
}

function addManifestMissing(manifest, key, reason = 'not_found') {
    manifest.missing.push({ key, reason });
}

async function addSourceFile(bundle, store, relativeName, archivePath, key, category) {
    const fullPath = store.resolve(relativeName);
    if (!fullPath) {
        addManifestMissing(bundle.manifest, key, 'invalid_path');
        return false;
    }

    const stat = await store.stat(fullPath);
    if (!stat || !stat.isFile) {
        addManifestMissing(bundle.manifest, key, 'not_found');
        return false;
    }
    if (stat.size > config.data.maxDownloadFileBytes) {
        addManifestMissing(bundle.manifest, key, 'too_large');
        return false;
    }

    const dedupeKey = `${store.rootPath}:${fullPath}`;
    if (bundle.sourceFileKeys.has(dedupeKey)) return true;
    bundle.sourceFileKeys.add(dedupeKey);

    bundle.sourceFiles.push({
        store,
        fullPath,
        archivePath,
        key,
        category,
        size: stat.size || 0,
        sourcePath: getStoreRelativePath(store, fullPath),
    });
    bundle.manifest.files.push({
        key,
        category,
        archivePath,
        sourcePath: getStoreRelativePath(store, fullPath),
        size: stat.size || 0,
    });
    return true;
}

async function addVariantSourceFile(bundle, store, candidates, variant, archiveDir, key, options = {}) {
    const safeCandidates = safeFileCandidates(candidates);
    if (!safeCandidates.length) {
        addManifestMissing(bundle.manifest, key, 'no_safe_candidate_id');
        return false;
    }

    const { fileName } = await findVariantFile(store, safeCandidates, variant, {
        suffix: '.tsv',
        aliases: options.aliases,
    });
    if (!fileName) {
        addManifestMissing(bundle.manifest, key, 'not_found');
        return false;
    }

    return addSourceFile(
        bundle,
        store,
        fileName,
        `${archiveDir}/${sanitizeArchiveSegment(path.posix.basename(fileName))}`,
        key,
        options.category || archiveDir,
    );
}

function normalizeSortOrder(value, fallback = 'asc') {
    return String(value || '').toLowerCase() === 'desc' ? 'desc' : fallback;
}

function compareTextValues(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

function compareNumberValues(a, b) {
    const left = Number(a);
    const right = Number(b);
    const leftValid = Number.isFinite(left);
    const rightValid = Number.isFinite(right);
    if (!leftValid && !rightValid) return 0;
    if (!leftValid) return 1;
    if (!rightValid) return -1;
    return left - right;
}

function compareDateValues(a, b) {
    const left = Date.parse(a || '');
    const right = Date.parse(b || '');
    return compareNumberValues(left, right);
}

function applySortOrder(result, order) {
    return order === 'desc' ? -result : result;
}

function compareDataEntries(a, b, sortBy, order) {
    let result = 0;
    if (sortBy === 'size') result = compareNumberValues(a.size, b.size);
    else if (sortBy === 'mtime') result = compareDateValues(a.mtime || a.mtimeMs, b.mtime || b.mtimeMs);
    else if (sortBy === 'type') result = compareTextValues(a.type, b.type);
    else result = Number(b.type === 'dir') - Number(a.type === 'dir') || compareTextValues(a.name, b.name);

    if (!result && sortBy !== 'type') result = compareTextValues(a.type, b.type);
    if (!result && sortBy !== 'name') result = compareTextValues(a.name, b.name);
    return applySortOrder(result, order);
}

function compareSearchResults(a, b, query, sortBy, order) {
    if (sortBy === 'relevance') {
        return compareSearchEntries(a, b, query);
    }

    let result = 0;
    if (sortBy === 'path') result = compareTextValues(a.path, b.path);
    else if (sortBy === 'size') result = compareNumberValues(a.size, b.size);
    else if (sortBy === 'type') result = compareTextValues(a.type, b.type);
    else result = compareTextValues(a.name, b.name);

    if (!result) result = compareTextValues(a.path, b.path);
    return applySortOrder(result, order);
}

function traitSearchOrderSql(sortBy, order) {
    const direction = order === 'desc' ? 'DESC' : 'ASC';
    const columns = {
        trait_name: 'fm.trait_name',
        trait: 'fm.trait_name',
        file_id: 'fm.file_id',
        ids: 'fm.file_id',
        gwas_id: 'fm.gwas_id',
        population: 'gm.population',
        study: 'gm.population',
        year: 'gm.year',
        sample_size: 'gm.sample_size',
        n_sig: 'gm.n_sig',
        n_variants: 'gm.n_variants',
    };
    const column = columns[sortBy] || columns.trait_name;
    return `${column} IS NULL ASC, ${column} ${direction}, fm.file_id ASC`;
}

async function addFirstExistingSourceFile(bundle, store, relativeNames, archiveDir, key, category) {
    for (const relativeName of relativeNames) {
        const fullPath = store.resolve(relativeName);
        if (!fullPath) continue;
        const stat = await store.stat(fullPath);
        if (stat?.isFile) {
            return addSourceFile(
                bundle,
                store,
                relativeName,
                `${archiveDir}/${sanitizeArchiveSegment(path.posix.basename(relativeName))}`,
                key,
                category,
            );
        }
    }
    addManifestMissing(bundle.manifest, key, 'not_found');
    return false;
}

async function addDirectCandidateFiles(bundle, store, candidates, buildRelativeName, archiveDir, keyPrefix, category) {
    const safeCandidates = safeFileCandidates(candidates);
    let found = false;
    for (const candidate of safeCandidates) {
        const relativeName = buildRelativeName(candidate);
        const added = await addSourceFile(
            bundle,
            store,
            relativeName,
            `${archiveDir}/${sanitizeArchiveSegment(path.posix.basename(relativeName))}`,
            `${keyPrefix}:${candidate}`,
            category,
        );
        found = found || added;
    }
    if (!found && !safeCandidates.length) addManifestMissing(bundle.manifest, keyPrefix, 'no_safe_candidate_id');
    return found;
}

function sqlPlaceholders(values) {
    return values.map(() => '?').join(', ');
}

async function queryTraitAssociations(candidates, { includeRows = true } = {}) {
    const safeCandidates = candidates.map((candidate) => normalizeTraitCandidate(candidate)).filter(Boolean);
    if (!safeCandidates.length) {
        return {
            programTraitScatter: { rows: [], count: 0 },
            geneProgramTrait: { rows: [], count: 0 },
        };
    }

    const placeholders = sqlPlaceholders(safeCandidates);
    const whereSql = `(file_id IN (${placeholders}) OR trait_id IN (${placeholders}))`;
    const params = [...safeCandidates, ...safeCandidates];

    if (!includeRows) {
        const [
            [[programTraitScatterRow]],
            [[geneProgramTraitRow]],
        ] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) AS count FROM program_trait_scatter_edge WHERE ${whereSql}`,
                params,
            ),
            pool.query(
                `SELECT COUNT(*) AS count FROM gene_program_trait_edge WHERE ${whereSql}`,
                params,
            ),
        ]);
        return {
            programTraitScatter: { rows: [], count: Number(programTraitScatterRow?.count) || 0 },
            geneProgramTrait: { rows: [], count: Number(geneProgramTraitRow?.count) || 0 },
        };
    }

    const [programTraitScatterRows] = await pool.query(
        `SELECT ${PROGRAM_TRAIT_SCATTER_EDGE_COLUMNS.join(', ')}
         FROM program_trait_scatter_edge
         WHERE ${whereSql}
         ORDER BY trait_id ASC, program ASC`,
        params,
    );
    const [geneProgramTraitRows] = await pool.query(
        `SELECT ${GENE_PROGRAM_TRAIT_EDGE_COLUMNS.join(', ')}
         FROM gene_program_trait_edge
         WHERE ${whereSql}
         ORDER BY trait_id ASC, program ASC, role ASC, gene_symbol ASC, ensg_id ASC`,
        params,
    );

    return {
        programTraitScatter: { rows: programTraitScatterRows, count: programTraitScatterRows.length },
        geneProgramTrait: { rows: geneProgramTraitRows, count: geneProgramTraitRows.length },
    };
}

function toTsv(rows, columns) {
    const escapeCell = (value) => {
        if (value == null) return '';
        return String(value)
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n/g, ' ')
            .replace(/\t/g, ' ');
    };

    return [
        columns.join('\t'),
        ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join('\t')),
    ].join('\n') + '\n';
}

async function getTraitSearchRows(query, page, limit, sortBy = 'trait_name', order = 'asc') {
    const searchText = String(query || '').trim().slice(0, config.data.maxSearchQueryLength);
    if (!searchText) {
        return { data: [], totalCount: 0, page, limit, totalPages: 1 };
    }

    const like = `%${escapeLike(searchText)}%`;
    const whereSql = `WHERE fm.trait_name IS NOT NULL
        AND fm.trait_name != ''
        AND (
            fm.trait_name LIKE ? ESCAPE '\\\\'
            OR fm.file_id LIKE ? ESCAPE '\\\\'
            OR fm.gwas_id LIKE ? ESCAPE '\\\\'
            OR gm.population LIKE ? ESCAPE '\\\\'
            OR gm.mesh_term LIKE ? ESCAPE '\\\\'
        )`;
    const params = [like, like, like, like, like];
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
        `SELECT fm.file_id, fm.gwas_id, fm.trait_name,
                gm.population, gm.year, gm.sample_size, gm.n_sig, gm.n_variants
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         ${whereSql}
         ORDER BY ${traitSearchOrderSql(sortBy, order)}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
    );
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM file_metadata fm
         LEFT JOIN gwas_meta gm ON gm.file_id = fm.file_id
         ${whereSql}`,
        params,
    );

    return {
        data: rows,
        totalCount: Number(total) || 0,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((Number(total) || 0) / limit)),
    };
}

async function resolveTraitDownloadBundle(traitId, { includeAssociationRows = true } = {}) {
    const requestedId = normalizeIdentifier(traitId, 255);
    if (!requestedId) throw buildHttpError(400, 'Invalid trait id');

    const meta = await metaModel.getTraitMeta(requestedId);
    if (!meta) throw buildHttpError(404, `Trait not found: ${requestedId}`);

    const candidates = buildTraitCandidateIds(meta, requestedId);
    const primaryId = normalizeTraitCandidate(meta.file_id) || requestedId;
    const bundle = {
        traitId: primaryId,
        traitName: meta.trait_name || primaryId,
        meta,
        candidates,
        sourceFiles: [],
        sourceFileKeys: new Set(),
        dynamicFiles: [],
        manifest: {
            generatedAt: new Date().toISOString(),
            requestedId,
            primaryId,
            traitName: meta.trait_name || primaryId,
            candidates,
            meta,
            files: [],
            dynamicFiles: [],
            missing: [],
            summary: {},
        },
    };

    const associationsPromise = queryTraitAssociations(candidates, { includeRows: includeAssociationRows });
    const fileTasks = [
        addVariantSourceFile(bundle, manhattanStore, candidates, 'hits', 'figures/manhattan', 'manhattan:hits'),
        addVariantSourceFile(bundle, manhattanStore, candidates, 'full', 'figures/manhattan', 'manhattan:full'),
        addVariantSourceFile(bundle, burdenVolcanoStore, candidates, 'hits', 'figures/volcano/burden', 'burden:hits', {
            aliases: VOLCANO_VARIANT_ALIASES,
        }),
        addVariantSourceFile(bundle, burdenVolcanoStore, candidates, 'full', 'figures/volcano/burden', 'burden:full', {
            aliases: VOLCANO_VARIANT_ALIASES,
        }),
        addVariantSourceFile(bundle, posteriorVolcanoStore, candidates, 'hits', 'figures/volcano/posterior', 'posterior:hits', {
            aliases: VOLCANO_VARIANT_ALIASES,
        }),
        addVariantSourceFile(bundle, posteriorVolcanoStore, candidates, 'full', 'figures/volcano/posterior', 'posterior:full', {
            aliases: VOLCANO_VARIANT_ALIASES,
        }),
    ];

    fileTasks.push(addDirectCandidateFiles(
        bundle,
        programStore,
        candidates,
        (candidate) => `${candidate}.tsv`,
        'figures/program',
        'program-scatter',
        'program-scatter',
    ));
    fileTasks.push(addDirectCandidateFiles(
        bundle,
        traitProgramGenePanelStore,
        candidates,
        (candidate) => `${candidate}_programs.tsv`,
        'figures/trait_program_gene_graph',
        'trait-program-gene:programs',
        'trait-program-gene',
    ));

    for (const candidate of safeFileCandidates(candidates)) {
        fileTasks.push(addFirstExistingSourceFile(
            bundle,
            traitProgramGenePanelStore,
            [`${candidate}_concordant_long.tsv`, `${candidate}_long.tsv`],
            'figures/trait_program_gene_graph',
            `trait-program-gene:long:${candidate}`,
            'trait-program-gene',
        ));
    }

    fileTasks.push(addDirectCandidateFiles(
        bundle,
        crossTraitMetaTraitsStore,
        candidates,
        (candidate) => `${candidate}.tsv`,
        'figures/cross_trait/meta',
        'cross-trait:meta',
        'cross-trait',
    ));
    fileTasks.push(addDirectCandidateFiles(
        bundle,
        crossTraitEffectsStore,
        candidates,
        (candidate) => `${candidate}.tsv`,
        'figures/cross_trait/effects',
        'cross-trait:effects',
        'cross-trait',
    ));
    fileTasks.push(addDirectCandidateFiles(
        bundle,
        crossTraitPrecomputedStore,
        candidates,
        (candidate) => `matrix/${candidate}.json.gz`,
        'figures/cross_trait/precomputed/matrix',
        'cross-trait:precomputed-matrix',
        'cross-trait',
    ));
    fileTasks.push(addDirectCandidateFiles(
        bundle,
        crossTraitPrecomputedStore,
        candidates,
        (candidate) => `correlation/${candidate}.spearman.json.gz`,
        'figures/cross_trait/precomputed/correlation',
        'cross-trait:precomputed-correlation',
        'cross-trait',
    ));

    const [, associations] = await Promise.all([
        Promise.all(fileTasks),
        associationsPromise,
    ]);
    if (includeAssociationRows) {
        bundle.dynamicFiles.push({
            archivePath: 'metadata/trait_meta.json',
            content: JSON.stringify(meta, null, 2) + '\n',
            size: Buffer.byteLength(JSON.stringify(meta, null, 2) + '\n'),
        });
        bundle.dynamicFiles.push({
            archivePath: 'associations/program_trait_scatter_edge.tsv',
            content: toTsv(associations.programTraitScatter.rows, PROGRAM_TRAIT_SCATTER_EDGE_COLUMNS),
            size: Buffer.byteLength(toTsv(associations.programTraitScatter.rows, PROGRAM_TRAIT_SCATTER_EDGE_COLUMNS)),
        });
        bundle.dynamicFiles.push({
            archivePath: 'associations/gene_program_trait_edge.tsv',
            content: toTsv(associations.geneProgramTrait.rows, GENE_PROGRAM_TRAIT_EDGE_COLUMNS),
            size: Buffer.byteLength(toTsv(associations.geneProgramTrait.rows, GENE_PROGRAM_TRAIT_EDGE_COLUMNS)),
        });
    }

    bundle.manifest.summary = {
        sourceFileCount: bundle.sourceFiles.length,
        sourceFileBytes: bundle.sourceFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        programTraitScatterAssociations: associations.programTraitScatter.count,
        geneProgramTraitAssociations: associations.geneProgramTrait.count,
    };
    bundle.manifest.dynamicFiles = [
        { key: 'metadata', archivePath: 'metadata/trait_meta.json' },
        {
            key: 'program_trait_scatter_edge',
            archivePath: 'associations/program_trait_scatter_edge.tsv',
            rowCount: associations.programTraitScatter.count,
        },
        {
            key: 'gene_program_trait_edge',
            archivePath: 'associations/gene_program_trait_edge.tsv',
            rowCount: associations.geneProgramTrait.count,
        },
    ];

    const manifestContent = JSON.stringify(bundle.manifest, null, 2) + '\n';
    if (includeAssociationRows) {
        bundle.dynamicFiles.unshift({
            archivePath: 'manifest.json',
            content: manifestContent,
            size: Buffer.byteLength(manifestContent),
        });
    }
    delete bundle.sourceFileKeys;
    return bundle;
}

function summarizeTraitBundle(bundle) {
    const categories = [...new Set(bundle.sourceFiles.map((file) => file.category))].sort();
    const associationCount = Number(bundle.manifest?.summary?.programTraitScatterAssociations || 0)
        + Number(bundle.manifest?.summary?.geneProgramTraitAssociations || 0);
    if (associationCount > 0) categories.push('associations');

    return {
        traitId: bundle.traitId,
        traitName: bundle.traitName,
        candidates: bundle.candidates,
        fileCount: bundle.sourceFiles.length,
        sourceFileBytes: bundle.sourceFiles.reduce((sum, file) => sum + (file.size || 0), 0),
        associationCount,
        availableTypes: [...new Set(categories)],
        missingCount: bundle.manifest?.missing?.length || 0,
        hasDownloadableData: bundle.sourceFiles.length > 0 || associationCount > 0,
    };
}

function getTraitDownloadSummaryCacheKey(row) {
    return normalizeTraitCandidate(row?.file_id) || normalizeTraitCandidate(row?.gwas_id) || '';
}

function pruneTraitDownloadSummaryCache(now = Date.now()) {
    if (traitDownloadSummaryCache.size <= TRAIT_DOWNLOAD_SUMMARY_CACHE_MAX) return;
    for (const [key, entry] of traitDownloadSummaryCache) {
        if (!entry?.promise && (!entry?.expiresAt || entry.expiresAt <= now)) {
            traitDownloadSummaryCache.delete(key);
        }
        if (traitDownloadSummaryCache.size <= TRAIT_DOWNLOAD_SUMMARY_CACHE_MAX) return;
    }

    for (const [key, entry] of traitDownloadSummaryCache) {
        if (!entry?.promise) traitDownloadSummaryCache.delete(key);
        if (traitDownloadSummaryCache.size <= TRAIT_DOWNLOAD_SUMMARY_CACHE_MAX) return;
    }
}

async function getTraitDownloadSummary(row) {
    const key = getTraitDownloadSummaryCacheKey(row);
    if (!key) throw buildHttpError(400, 'Invalid trait id');

    const now = Date.now();
    const cached = traitDownloadSummaryCache.get(key);
    if (cached?.value && cached.expiresAt > now) return cached.value;
    if (cached?.promise) return cached.promise;

    const promise = resolveTraitDownloadBundle(key, { includeAssociationRows: false })
        .then((bundle) => {
            const value = summarizeTraitBundle(bundle);
            traitDownloadSummaryCache.set(key, {
                value,
                expiresAt: Date.now() + TRAIT_DOWNLOAD_SUMMARY_CACHE_TTL_MS,
            });
            pruneTraitDownloadSummaryCache();
            return value;
        })
        .catch((err) => {
            traitDownloadSummaryCache.delete(key);
            throw err;
        });

    traitDownloadSummaryCache.set(key, { promise, expiresAt: now + TRAIT_DOWNLOAD_SUMMARY_CACHE_TTL_MS });
    return promise;
}

function estimateTraitBundles(bundles) {
    const estimate = { entries: 0, bytes: 0 };
    for (const bundle of bundles) {
        estimate.entries += bundle.sourceFiles.length + bundle.dynamicFiles.length;
        estimate.bytes += bundle.sourceFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        estimate.bytes += bundle.dynamicFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    }
    if (estimate.entries > config.data.maxArchiveEntries) {
        throw buildHttpError(413, `Archive contains too many entries; max is ${config.data.maxArchiveEntries}`);
    }
    if (estimate.bytes > config.data.maxArchiveBytes) {
        throw buildHttpError(413, 'Archive is too large to download through the API');
    }
    return estimate;
}

async function prepareTraitDownload(rawTraitIds, rawFilename) {
    const traitIds = [...new Set(toPathList(rawTraitIds)
        .map((item) => normalizeIdentifier(item, 255))
        .filter(Boolean))];
    if (!traitIds.length) throw buildHttpError(400, 'No traits selected');
    if (traitIds.length > TRAIT_DOWNLOAD_MAX_ITEMS) {
        throw buildHttpError(413, `Too many traits selected; max is ${TRAIT_DOWNLOAD_MAX_ITEMS}`);
    }

    const bundles = [];
    for (const traitId of traitIds) {
        bundles.push(await resolveTraitDownloadBundle(traitId, { includeAssociationRows: true }));
    }
    estimateTraitBundles(bundles);

    const defaultName = traitIds.length === 1
        ? `trait-data-${sanitizeArchiveSegment(bundles[0].traitId)}`
        : `trait-data-${traitIds.length}-traits`;
    const zipBaseName = (typeof rawFilename === 'string' ? rawFilename.trim() : '')
        .replace(/\.zip$/i, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 100) || defaultName;

    return {
        zipBaseName,
        bundles,
        summary: {
            traitCount: bundles.length,
            maxTraitCount: TRAIT_DOWNLOAD_MAX_ITEMS,
            traits: bundles.map(summarizeTraitBundle),
        },
    };
}

async function appendTraitBundleToArchive(archive, bundle, baseDir, usedNames) {
    for (const item of bundle.dynamicFiles) {
        const entryName = getArchiveEntryName(`${baseDir}/${item.archivePath}`, usedNames);
        archive.append(item.content, { name: entryName });
    }

    for (const item of bundle.sourceFiles) {
        const entryName = getArchiveEntryName(`${baseDir}/${item.archivePath}`, usedNames);
        await item.store.appendToArchive(archive, item.fullPath, entryName);
    }
}

async function streamTraitDownload(res, zipBaseName, bundles) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', encodeDownloadFilename(`${zipBaseName}.zip`));

    const archive = await createZipArchive(getZipArchiveOptions());
    archive.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    archive.pipe(res);

    const usedNames = new Set();
    for (let index = 0; index < bundles.length; index += 1) {
        const bundle = bundles[index];
        const baseDir = bundles.length === 1
            ? sanitizeArchiveSegment(bundle.traitId)
            : `${String(index + 1).padStart(2, '0')}_${sanitizeArchiveSegment(bundle.traitId)}`;
        await appendTraitBundleToArchive(archive, bundle, baseDir, usedNames);
    }

    await archive.finalize();
}

async function summarizeFolder(fullPath, relPath = '') {
    const stat = await dataStore.stat(fullPath);
    if (!stat || !stat.isDirectory) return null;

    let fileCount = 0;
    let folderCount = 0;
    let directFileBytes = 0;
    try {
        const entries = await dataStore.list(fullPath);
        for (const entry of entries) {
            if (entry.type === 'dir') folderCount += 1;
            else if (entry.type === 'file') {
                fileCount += 1;
                directFileBytes += entry.size || 0;
            }
        }
    } catch (err) {
        fileCount = 0;
        folderCount = 0;
        directFileBytes = 0;
    }

    const archiveStat = await statArchive(relPath);
    const downloadMode = archiveStat.exists ? 'archive' : null;

    return {
        name: relPath ? dataStore.basename(fullPath) : dataStore.basename(dataStore.rootPath) || 'data',
        path: relPath,
        type: 'dir',
        fileCount,
        folderCount,
        totalCount: fileCount + folderCount,
        directFileBytes,
        mtime: isoFromMtime(stat.mtimeMs),
        archive: toArchiveResponse(relPath, archiveStat),
        download: {
            available: Boolean(downloadMode),
            mode: downloadMode,
        },
    };
}

async function estimateArchive(store, fullPath, counters = { entries: 0, bytes: 0 }) {
    const stat = await store.stat(fullPath);
    if (!stat) return counters;

    counters.entries += 1;
    if (counters.entries > config.data.maxArchiveEntries) {
        const err = new Error(`Archive contains too many entries; max is ${config.data.maxArchiveEntries}`);
        err.status = 413;
        err.expose = true;
        throw err;
    }

    if (stat.isFile) {
        counters.bytes += stat.size || 0;
        if (counters.bytes > config.data.maxArchiveBytes) {
            const err = new Error('Archive is too large to download through the API');
            err.status = 413;
            err.expose = true;
            throw err;
        }
        return counters;
    }

    if (stat.isDirectory) {
        const entries = await store.list(fullPath);
        for (const entry of entries) {
            await estimateArchive(store, store.pathImpl.join(fullPath, entry.name), counters);
        }
    }

    return counters;
}

async function prepareBatchDownload(rawPaths, rawFilename) {
    const uniquePaths = [...new Set(
        rawPaths
            .map(normalizeRequestedPath)
            .filter((item) => item !== null),
    )];
    if (uniquePaths.length === 0) throw buildHttpError(400, 'No files selected');
    if (uniquePaths.length > config.data.maxBatchDownloadItems) {
        throw buildHttpError(413, `Too many files selected; max is ${config.data.maxBatchDownloadItems}`);
    }

    const zipBaseName = (typeof rawFilename === 'string' ? rawFilename.trim() : '')
        .replace(/\.zip$/i, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 100) || 'data-selection';

    const resolvedItems = [];
    const archiveEstimate = { entries: 0, bytes: 0 };
    for (const relPath of uniquePaths) {
        const fullPath = resolveRelativePath(relPath);
        const stat = await dataStore.stat(fullPath);
        if (!stat) throw buildHttpError(404, 'Not found');
        if (stat.isFile && stat.size > config.data.maxDownloadFileBytes) {
            throw buildHttpError(413, 'One selected file is too large to download through the API');
        }
        await estimateArchive(dataStore, fullPath, archiveEstimate);
        resolvedItems.push({
            relPath,
            archivePath: relPath || dataStore.basename(fullPath) || 'data',
            fullPath,
            stat,
        });
    }

    return { zipBaseName, resolvedItems };
}

async function streamBatchDownload(res, zipBaseName, resolvedItems) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', encodeDownloadFilename(`${zipBaseName}.zip`));

    const archive = await createZipArchive(getZipArchiveOptions());
    archive.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    archive.pipe(res);

    const usedNames = new Set();
    for (const item of resolvedItems) {
        const entryName = getArchiveEntryName(item.archivePath || item.relPath, usedNames);
        await dataStore.appendToArchive(archive, item.fullPath, entryName);
    }

    await archive.finalize();
}

async function buildSearchIndex() {
    const entries = [];
    searchIndexStats = {
        status: 'building',
        entries: 0,
        dirs: 0,
        startedAt: Date.now(),
        finishedAt: null,
        error: null,
    };

    async function scan(fullPath) {
        let dirEntries = [];
        try {
            dirEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });
            searchIndexStats.dirs += 1;
        } catch (err) {
            return;
        }

        dirEntries = dirEntries
            .filter((entry) => entry.isDirectory() || entry.isFile())
            .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));

        for (const entry of dirEntries) {
            const childPath = dataStore.pathImpl.join(fullPath, entry.name);
            const relPath = toRelativePath(childPath);
            const isDirectory = entry.isDirectory();

            entries.push({
                name: entry.name,
                path: relPath,
                type: isDirectory ? 'dir' : 'file',
                size: isDirectory ? 0 : null,
                depth: relPath ? relPath.split('/').length : 0,
                nameLower: entry.name.toLowerCase(),
                pathLower: relPath.toLowerCase(),
            });
            searchIndexStats.entries = entries.length;

            if (isDirectory) {
                await scan(childPath);
            }
        }
    }

    const rootStat = await dataStore.stat(dataStore.rootPath);
    if (!rootStat || !rootStat.isDirectory) {
        searchIndexStats = {
            ...searchIndexStats,
            status: 'ready',
            entries: 0,
            finishedAt: Date.now(),
            error: null,
        };
        return [];
    }

    try {
        await scan(dataStore.rootPath);
        searchIndexStats = {
            ...searchIndexStats,
            status: 'ready',
            entries: entries.length,
            finishedAt: Date.now(),
            error: null,
        };
    } catch (err) {
        searchIndexStats = {
            ...searchIndexStats,
            status: 'error',
            finishedAt: Date.now(),
            error: err.message || 'Failed to build search index',
        };
        throw err;
    }
    return entries;
}

async function getSearchIndex(forceRefresh = false) {
    const isFresh = searchIndexCache && (Date.now() - searchIndexBuiltAt) < config.data.searchIndexTtlMs;
    if (!forceRefresh && isFresh) return searchIndexCache;

    if (!searchIndexPromise) {
        searchIndexPromise = buildSearchIndex()
            .then((entries) => {
                searchIndexCache = entries;
                searchIndexBuiltAt = Date.now();
                return entries;
            })
            .finally(() => {
                searchIndexPromise = null;
            });
    }

    return searchIndexPromise;
}

router.get('/api/data/list', asyncRoute(async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const sortBy = ['name', 'size', 'type', 'mtime'].includes(String(req.query.sortBy || ''))
        ? String(req.query.sortBy)
        : 'name';
    const order = normalizeSortOrder(req.query.order, sortBy === 'size' || sortBy === 'mtime' ? 'desc' : 'asc');
    const dirInfo = await getDirectoryStatOrEmpty(req.query.dir || '');

    if (dirInfo.empty) {
        return res.json({ data: [], totalCount: 0, page, totalPages: 1 });
    }

    const { fullPath, stat } = dirInfo;
    if (!stat) return res.status(404).json({ error: 'Not found' });
    if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

    const searchQ = String(req.query.search || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    const entries = await dataStore.list(fullPath);
    const filteredEntries = entries.filter((entry) => !searchQ || entry.name.toLowerCase().includes(searchQ));
    filteredEntries.sort((a, b) => compareDataEntries(a, b, sortBy, order));

    const total = filteredEntries.length;
    const pageEntries = filteredEntries.slice((page - 1) * limit, page * limit);
    const parentRel = req.query.dir ? String(req.query.dir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';

    const data = pageEntries.map((entry) => ({
        name: entry.name,
        type: entry.type,
        path: parentRel ? `${parentRel}/${entry.name}` : entry.name,
        size: entry.type === 'file' ? (entry.size || 0) : 0,
        mtime: isoFromMtime(entry.mtimeMs),
    }));

    res.json({ data, totalCount: total, page, totalPages: Math.ceil(total / limit), sortBy, order });
}));

router.get('/api/data/status', asyncRoute(async (req, res) => {
    const rootStat = await getDataRootStat();
    res.json({
        root: dataStore.rootPath,
        archiveRoot: dataArchiveRoot,
        exists: Boolean(rootStat),
        isDirectory: Boolean(rootStat?.isDirectory),
        searchIndex: {
            ...searchIndexStats,
            cached: Boolean(searchIndexCache),
            cacheAgeMs: searchIndexBuiltAt ? Date.now() - searchIndexBuiltAt : null,
        },
    });
}));

router.get('/api/data/folders', asyncRoute(async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const parentRel = normalizeRequestedPath(req.query.dir || '') || '';
    const dirInfo = await getDirectoryStatOrEmpty(parentRel);

    if (dirInfo.empty) {
        return res.json({
            current: null,
            data: [],
            totalCount: 0,
            page,
            totalPages: 1,
        });
    }

    const { fullPath, stat } = dirInfo;
    if (!stat) return res.status(404).json({ error: 'Not found' });
    if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

    const searchQ = String(req.query.search || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    const entries = (await dataStore.list(fullPath))
        .filter((entry) => entry.type === 'dir' && (!searchQ || entry.name.toLowerCase().includes(searchQ)))
        .sort((a, b) => a.name.localeCompare(b.name));

    const downloadableEntries = [];
    for (const entry of entries) {
        const childRelPath = parentRel ? `${parentRel}/${entry.name}` : entry.name;
        const archiveStat = await statArchive(childRelPath);
        if (archiveStat.exists) {
            downloadableEntries.push(entry);
        }
    }

    const total = downloadableEntries.length;
    const pageEntries = downloadableEntries.slice((page - 1) * limit, page * limit);
    const data = (await Promise.all(pageEntries.map((entry) => {
        const childFullPath = dataStore.pathImpl.join(fullPath, entry.name);
        const childRelPath = parentRel ? `${parentRel}/${entry.name}` : entry.name;
        return summarizeFolder(childFullPath, childRelPath);
    }))).filter(Boolean);

    res.json({
        current: await summarizeFolder(fullPath, parentRel),
        data,
        totalCount: total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    });
}));

router.get('/api/data/packages', asyncRoute(async (req, res) => {
    const packages = await Promise.all(
        getDataPackageDefinitions().map((definition) => getDataPackageStatus(definition)),
    );

    res.json({
        archiveRoot: dataArchiveRoot,
        data: packages,
    });
}));

router.get('/api/data/packages/:packageId/download-info', asyncRoute(async (req, res) => {
    const packageId = String(req.params.packageId || '');
    const definition = getDataPackageDefinition(packageId);
    if (!definition) return res.status(404).json({ error: 'Package not found' });

    const archiveStat = await statPackageArchive(definition.id);
    if (!archiveStat.exists) {
        if (definition.type === 'database') {
            return res.json({
                id: definition.id,
                title: definition.title,
                type: definition.type,
                size: null,
                dynamic: true,
                tableCount: definition.tables.length,
            });
        }
        return res.status(404).json({
            error: 'Prepared package is missing. Run npm run prepare:data-archives in backend first.',
        });
    }

    res.json({
        id: definition.id,
        title: definition.title,
        type: definition.type,
        size: archiveStat.size || 0,
    });
}));

router.get('/api/data/packages/:packageId/download', asyncRoute(async (req, res) => {
    const { abortSignal: signal } = req;
    const packageId = String(req.params.packageId || '');
    const definition = getDataPackageDefinition(packageId);
    if (!definition) throw buildHttpError(404, 'Package not found');

    const archiveStat = await statPackageArchive(definition.id);
    if (!archiveStat.exists) {
        if (definition.type === 'database') {
            await streamDatabasePackage(res, definition, signal);
            return;
        }
        throw buildHttpError(404, 'Prepared package is missing. Run npm run prepare:data-archives in backend first.');
    }

    throwIfAborted(signal);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', encodeDownloadFilename(`${definition.id}.zip`));
    res.setHeader('Content-Length', archiveStat.size || 0);
    if (archiveStat.mtimeMs) res.setHeader('Last-Modified', new Date(archiveStat.mtimeMs).toUTCString());

    const stream = fs.createReadStream(archiveStat.path);
    stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    signal?.addEventListener('abort', () => stream.destroy(), { once: true });
    stream.pipe(res);
}));

router.get('/api/data/file-paths', asyncRoute(async (req, res) => {
    const dirInfo = await getDirectoryStatOrEmpty(req.query.dir || '');
    if (dirInfo.empty) return res.json({ paths: [], totalCount: 0 });

    const { fullPath, stat } = dirInfo;
    if (!stat) return res.status(404).json({ error: 'Not found' });
    if (!stat.isDirectory) return res.status(400).json({ error: 'Not a directory' });

    const searchQ = String(req.query.search || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    const parentRel = req.query.dir ? String(req.query.dir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '';
    const files = (await dataStore.list(fullPath))
        .filter((entry) => entry.type === 'file' && (!searchQ || entry.name.toLowerCase().includes(searchQ)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => (parentRel ? `${parentRel}/${entry.name}` : entry.name));

    res.json({ paths: files, totalCount: files.length });
}));

router.get('/api/data/breadcrumb', asyncRoute(async (req, res) => {
    resolveRelativePath(req.query.dir || '');

    const parts = String(req.query.dir || '').split('/').filter(Boolean);
    const crumbs = [{ name: 'data', path: '' }];
    let acc = '';
    for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        crumbs.push({ name: part, path: acc });
    }
    res.json({ crumbs });
}));

router.get('/api/data/download-info', asyncRoute(async (req, res) => {
    const requestedRelPath = normalizeRequestedPath(req.query.path || '') || '';
    const fullPath = resolveRelativePath(requestedRelPath);
    const stat = await dataStore.stat(fullPath);
    if (!stat) return res.status(404).json({ error: 'Not found' });
    if (stat.isFile && stat.size > config.data.maxDownloadFileBytes) {
        return res.status(413).json({ error: 'File is too large to download through the API' });
    }

    const baseName = dataStore.basename(fullPath);
    if (stat.isDirectory) {
        const archiveStat = await statArchive(requestedRelPath);
        if (!archiveStat.exists) {
            return res.status(404).json({
                error: 'Prepared archive is missing. Run npm run prepare:data-archives in backend first.',
            });
        }

        return res.json({
            name: getArchiveFileName(requestedRelPath),
            type: 'dir',
            size: archiveStat.size || 0,
            archive: toArchiveResponse(requestedRelPath, archiveStat),
        });
    }

    return res.json({
        name: baseName,
        type: stat.isDirectory ? 'dir' : 'file',
        size: stat.size || 0,
    });
}));

router.get('/api/data/download', asyncRoute(async (req, res) => {
    const { abortSignal: signal } = req;
    const requestedRelPath = normalizeRequestedPath(req.query.path || '') || '';
    const fullPath = resolveRelativePath(requestedRelPath);
    const stat = await dataStore.stat(fullPath);
    if (!stat) return res.status(404).send('Not found');
    if (stat.isFile && stat.size > config.data.maxDownloadFileBytes) {
        return res.status(413).json({ error: 'File is too large to download through the API' });
    }

    const baseName = dataStore.basename(fullPath);
    if (stat.isDirectory) {
        throwIfAborted(signal);
        const archiveStat = await statArchive(requestedRelPath);
        if (!archiveStat.exists) {
            throw buildHttpError(404, 'Prepared archive is missing. Run npm run prepare:data-archives in backend first.');
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', encodeDownloadFilename(getArchiveFileName(requestedRelPath)));
        res.setHeader('Content-Length', archiveStat.size || 0);
        if (archiveStat.mtimeMs) res.setHeader('Last-Modified', new Date(archiveStat.mtimeMs).toUTCString());

        const stream = fs.createReadStream(archiveStat.path);
        stream.on('error', () => {
            if (!res.headersSent) res.status(500).end();
            else res.end();
        });
        signal?.addEventListener('abort', () => stream.destroy(), { once: true });
        stream.pipe(res);
        return;
    }

    throwIfAborted(signal);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', encodeDownloadFilename(baseName));
    const stream = await dataStore.createReadStream(fullPath);
    stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    signal?.addEventListener('abort', () => stream.destroy(), { once: true });
    stream.pipe(res);
}));

router.post('/api/data/download-batch', asyncRoute(async (req, res) => {
    const rawPaths = toPathList(req.body?.paths);
    const { zipBaseName, resolvedItems } = await prepareBatchDownload(rawPaths, req.body?.filename);
    await streamBatchDownload(res, zipBaseName, resolvedItems);
}));

router.post('/api/data/download-batch/prepare', asyncRoute(async (req, res) => {
    const rawPaths = toPathList(req.body?.paths);
    const prepared = await prepareBatchDownload(rawPaths, req.body?.filename);
    const token = createBatchDownloadToken(prepared);
    res.json({
        token,
        url: `/api/data/download-batch/${encodeURIComponent(token)}`,
        expiresInMs: BATCH_DOWNLOAD_TTL_MS,
    });
}));

router.get('/api/data/download-batch/:token', asyncRoute(async (req, res) => {
    cleanupBatchDownloadTokens();
    const token = String(req.params.token || '');
    const prepared = batchDownloadTokens.get(token);
    if (!prepared) throw buildHttpError(404, 'Download token expired or not found');
    batchDownloadTokens.delete(token);
    await streamBatchDownload(res, prepared.zipBaseName, prepared.resolvedItems);
}));

router.get('/api/data/traits/search', asyncRoute(async (req, res) => {
    const q = String(req.query.q || req.query.query || '').trim();
    const limit = parsePositiveInt(req.query.limit, TRAIT_SEARCH_DEFAULT_LIMIT, TRAIT_SEARCH_MAX_LIMIT);
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const sortBy = String(req.query.sortBy || 'trait_name');
    const order = normalizeSortOrder(req.query.order, 'asc');
    const result = await getTraitSearchRows(q, page, limit, sortBy, order);
    const data = await Promise.all((result.data || []).map(async (row) => {
        try {
            return {
                ...row,
                download: await getTraitDownloadSummary(row),
            };
        } catch (err) {
            return {
                ...row,
                download: {
                    traitId: row.file_id || row.gwas_id || '',
                    traitName: row.trait_name || row.file_id || '',
                    candidates: [row.file_id, row.gwas_id].filter(Boolean),
                    fileCount: 0,
                    sourceFileBytes: 0,
                    associationCount: 0,
                    availableTypes: [],
                    missingCount: 0,
                    hasDownloadableData: false,
                    error: err?.message || 'Failed to resolve trait data',
                },
            };
        }
    }));

    res.json({
        ...result,
        query: q,
        sortBy,
        order,
        data,
        maxDownloadTraits: TRAIT_DOWNLOAD_MAX_ITEMS,
    });
}));

router.post('/api/data/traits/download/prepare', asyncRoute(async (req, res) => {
    const prepared = await prepareTraitDownload(req.body?.traitIds || req.body?.traitId, req.body?.filename);
    const token = createBatchDownloadToken({
        type: 'trait-data',
        zipBaseName: prepared.zipBaseName,
        bundles: prepared.bundles,
    });
    res.json({
        token,
        url: `/api/data/traits/download/${encodeURIComponent(token)}`,
        expiresInMs: BATCH_DOWNLOAD_TTL_MS,
        summary: prepared.summary,
    });
}));

router.get('/api/data/traits/download/:token', asyncRoute(async (req, res) => {
    cleanupBatchDownloadTokens();
    const token = String(req.params.token || '');
    const prepared = batchDownloadTokens.get(token);
    if (!prepared || prepared.type !== 'trait-data') {
        throw buildHttpError(404, 'Download token expired or not found');
    }
    batchDownloadTokens.delete(token);
    await streamTraitDownload(res, prepared.zipBaseName, prepared.bundles);
}));

router.get('/api/data/search', asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase().slice(0, config.data.maxSearchQueryLength);
    if (!q) return res.json({ results: [], totalCount: 0, truncated: false });

    const forceRefresh = config.data.allowSearchRefresh && req.query.refresh === '1';
    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const page = parsePositiveInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const sortBy = ['relevance', 'name', 'path', 'size', 'type'].includes(String(req.query.sortBy || ''))
        ? String(req.query.sortBy)
        : 'relevance';
    const order = normalizeSortOrder(req.query.order, sortBy === 'size' ? 'desc' : 'asc');
    const offset = (page - 1) * limit;
    const searchIndex = await getSearchIndex(forceRefresh);
    const { matches, totalCount } = findSearchMatches(
        searchIndex,
        q,
        sortBy === 'relevance' ? offset + limit : Number.POSITIVE_INFINITY,
    );
    if (sortBy !== 'relevance') {
        await Promise.all(matches.map(async (entry) => {
            if (entry.type !== 'file' || Number.isFinite(entry.size)) return;
            try {
                const stat = await dataStore.stat(resolveRelativePath(entry.path));
                entry.size = stat?.isFile ? (stat.size || 0) : 0;
            } catch (err) {
                entry.size = 0;
            }
        }));
        matches.sort((a, b) => compareSearchResults(a, b, q, sortBy, order));
    }
    const pagedMatches = matches.slice(offset, offset + limit);
    const results = await Promise.all(pagedMatches.map(async (entry) => {
        if (entry.type === 'file' && !Number.isFinite(entry.size)) {
            try {
                const stat = await dataStore.stat(resolveRelativePath(entry.path));
                entry.size = stat?.isFile ? (stat.size || 0) : 0;
            } catch (err) {
                entry.size = 0;
            }
        }

        return {
            name: entry.name,
            path: entry.path,
            type: entry.type,
            size: Number.isFinite(entry.size) ? entry.size : 0,
        };
    }));
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    res.json({
        results,
        totalCount,
        truncated: totalCount > (offset + results.length),
        page,
        limit,
        totalPages,
        sortBy,
        order,
    });
}));

module.exports = router;
