require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2');
const { config } = require('../lib/config');
const {
    dataArchiveRoot,
    getArchivePath,
    getPackageArchivePath,
    normalizeArchiveRelPath,
    statPackageArchive,
    statArchive,
} = require('../lib/dataArchives');
const { getDataPackageDefinitions } = require('../lib/dataPackages');

function parseArgs(argv) {
    const envJobs = Number.parseInt(process.env.DATA_ARCHIVE_JOBS || '', 10);
    const options = {
        depth: Number.POSITIVE_INFINITY,
        dryRun: false,
        force: false,
        includeRoot: false,
        jobs: Number.isFinite(envJobs) && envJobs >= 1 ? envJobs : 1,
        skipDb: false,
        skipFolderArchives: false,
        skipPackages: false,
    };

    for (const arg of argv) {
        if (arg === '--dry-run') options.dryRun = true;
        else if (arg === '--force') options.force = true;
        else if (arg === '--include-root') options.includeRoot = true;
        else if (arg === '--skip-db') options.skipDb = true;
        else if (arg === '--skip-folder-archives') options.skipFolderArchives = true;
        else if (arg === '--skip-packages') options.skipPackages = true;
        else if (arg === '--top-level') options.depth = 1;
        else if (arg.startsWith('--jobs=')) {
            const parsed = Number.parseInt(arg.slice('--jobs='.length), 10);
            if (Number.isFinite(parsed) && parsed >= 1) options.jobs = parsed;
        }
        else if (arg.startsWith('--depth=')) {
            const parsed = Number.parseInt(arg.slice('--depth='.length), 10);
            if (Number.isFinite(parsed) && parsed >= 1) options.depth = parsed;
        }
    }

    return options;
}

async function mapWithConcurrency(items, concurrency, worker) {
    if (!items.length) return [];

    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    async function runWorker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await worker(items[index], index);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
}

function addResultsToCounts(counts, results) {
    for (const result of results) {
        counts[result.status] = (counts[result.status] || 0) + 1;
    }
}
function toRelativePath(fullPath, rootPath) {
    return path.relative(rootPath, fullPath).split(path.sep).filter(Boolean).join('/');
}

function isSameOrInside(parentPath, childPath) {
    const parent = path.resolve(parentPath);
    const child = path.resolve(childPath);
    return child === parent || child.startsWith(`${parent}${path.sep}`);
}

async function getArchiver() {
    const archiverModule = await import('archiver');
    const archiver = archiverModule.default || archiverModule;
    if (typeof archiver === 'function') return archiver;
    if (typeof archiverModule.ZipArchive === 'function') {
        return (format, options) => {
            if (format !== 'zip') throw new Error(`Unsupported archive format: ${format}`);
            return new archiverModule.ZipArchive(options);
        };
    }
    throw new Error('Unsupported archiver module shape');
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

async function scanDirectory(fullPath, rootPath, depth = 0) {
    const stat = await fs.promises.stat(fullPath);
    const relPath = normalizeArchiveRelPath(toRelativePath(fullPath, rootPath));
    const node = {
        fullPath,
        relPath,
        depth,
        newestMtimeMs: stat.mtimeMs || 0,
        children: [],
    };

    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
    for (const entry of entries) {
        const childPath = path.join(fullPath, entry.name);
        if (entry.isDirectory()) {
            const child = await scanDirectory(childPath, rootPath, depth + 1);
            node.children.push(child);
            node.newestMtimeMs = Math.max(node.newestMtimeMs, child.newestMtimeMs);
        } else if (entry.isFile()) {
            try {
                const childStat = await fs.promises.stat(childPath);
                node.newestMtimeMs = Math.max(node.newestMtimeMs, childStat.mtimeMs || 0);
            } catch (err) {
                // Ignore files that disappear while archives are being prepared.
            }
        }
    }

    return node;
}

function collectArchiveTargets(node, options, targets = []) {
    if ((node.relPath || options.includeRoot) && node.depth <= options.depth) {
        targets.push(node);
    }

    for (const child of node.children) {
        collectArchiveTargets(child, options, targets);
    }

    return targets;
}

async function writeDirectoryArchive({ sourcePath, archivePath, rootEntryName }, archiver) {
    await fs.promises.mkdir(path.dirname(archivePath), { recursive: true });
    const tempPath = `${archivePath}.tmp-${process.pid}-${Date.now()}`;
    const output = fs.createWriteStream(tempPath);
    const archive = archiver('zip', {
        forceZip64: true,
        zlib: { level: config.data.archiveCompressionLevel },
    });

    await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourcePath, rootEntryName);
        const finalizeResult = archive.finalize();
        if (finalizeResult && typeof finalizeResult.catch === 'function') {
            finalizeResult.catch(reject);
        }
    }).catch(async (err) => {
        try {
            await fs.promises.unlink(tempPath);
        } catch (unlinkErr) {
            // Ignore cleanup failure; the original archive is left untouched.
        }
        throw err;
    });

    await fs.promises.rename(tempPath, archivePath);
}

async function createArchive(target, archiver, options) {
    const archivePath = getArchivePath(target.relPath);
    const archiveStat = await statArchive(target.relPath);
    const isFresh = archiveStat.exists && archiveStat.mtimeMs >= target.newestMtimeMs;

    if (!options.force && isFresh) {
        console.log(`[skip] ${target.relPath || '.'} -> ${archivePath}`);
        return { status: 'skipped' };
    }

    console.log(`[zip] ${target.relPath || '.'} -> ${archivePath}`);
    if (options.dryRun) return { status: 'planned' };

    await writeDirectoryArchive({
        sourcePath: target.fullPath,
        archivePath,
        rootEntryName: path.basename(target.fullPath),
    }, archiver);
    return { status: 'created' };
}

async function createDirectoryPackage(definition, archiver, options) {
    const sourcePath = path.resolve(definition.sourcePath);
    let sourceStat = null;
    try {
        sourceStat = await fs.promises.stat(sourcePath);
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            console.log(`[missing] package ${definition.id}: ${sourcePath}`);
            return { status: 'missing' };
        }
        throw err;
    }
    if (!sourceStat.isDirectory()) {
        console.log(`[missing] package ${definition.id}: not a directory ${sourcePath}`);
        return { status: 'missing' };
    }

    const sourceNode = await scanDirectory(sourcePath, sourcePath, 0);
    const archivePath = getPackageArchivePath(definition.id);
    const archiveStat = await statPackageArchive(definition.id);
    const isFresh = archiveStat.exists && archiveStat.mtimeMs >= sourceNode.newestMtimeMs;

    if (!options.force && isFresh) {
        console.log(`[skip] package ${definition.id} -> ${archivePath}`);
        return { status: 'skipped' };
    }

    console.log(`[zip] package ${definition.id} -> ${archivePath}`);
    if (options.dryRun) return { status: 'planned' };

    await writeDirectoryArchive({
        sourcePath,
        archivePath,
        rootEntryName: definition.rootEntryName,
    }, archiver);
    return { status: 'created' };
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

async function exportTableToTsv(connection, tableName, outputFile) {
    const columns = await getTableColumns(connection, tableName);
    if (!columns.length) return null;

    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    const out = fs.createWriteStream(outputFile, { encoding: 'utf8' });
    const finishPromise = new Promise((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
    });
    let rowCount = 0;

    try {
        await writeStreamLine(out, `${columns.join('\t')}\n`);
        const rowStream = connection
            .query(`SELECT * FROM ${mysql.escapeId(tableName)}`)
            .stream({ objectMode: true });

        await new Promise((resolve, reject) => {
            rowStream.on('data', async (row) => {
                rowStream.pause();
                try {
                    const line = columns.map((column) => escapeTsvValue(row[column])).join('\t');
                    await writeStreamLine(out, `${line}\n`);
                    rowCount += 1;
                    rowStream.resume();
                } catch (err) {
                    rowStream.destroy(err);
                }
            });
            rowStream.on('error', reject);
            rowStream.on('end', resolve);
            out.on('error', reject);
        });
    } finally {
        out.end();
    }

    await finishPromise;

    return { tableName, columns: columns.length, rows: rowCount };
}

async function createDatabasePackage(definition, archiver, options) {
    const archivePath = getPackageArchivePath(definition.id);
    console.log(`[zip-db] package ${definition.id} -> ${archivePath}`);
    if (options.dryRun) return { status: 'planned' };

    const tempDir = path.join(dataArchiveRoot, `.tmp-${definition.id}-${process.pid}-${Date.now()}`);
    const connection = mysql.createConnection(getDbConnectionConfig());
    const manifest = {
        generatedAt: new Date().toISOString(),
        database: config.db.database,
        tables: [],
        skippedTables: [],
    };

    try {
        await fs.promises.mkdir(tempDir, { recursive: true });
        for (const tableName of definition.tables) {
            try {
                const exported = await exportTableToTsv(
                    connection,
                    tableName,
                    path.join(tempDir, `${tableName}.tsv`),
                );
                if (exported) {
                    manifest.tables.push(exported);
                    console.log(`[db] exported ${tableName} rows=${exported.rows}`);
                } else {
                    manifest.skippedTables.push({ tableName, reason: 'missing table' });
                    console.log(`[db] missing ${tableName}`);
                }
            } catch (err) {
                manifest.skippedTables.push({ tableName, reason: err.message || 'export failed' });
                console.log(`[db] failed ${tableName}: ${err.message || err}`);
            }
        }

        await fs.promises.writeFile(
            path.join(tempDir, 'manifest.json'),
            `${JSON.stringify(manifest, null, 2)}\n`,
        );

        if (manifest.tables.length === 0) {
            throw new Error('No database tables were exported; database package was not created.');
        }

        await writeDirectoryArchive({
            sourcePath: tempDir,
            archivePath,
            rootEntryName: definition.rootEntryName,
        }, archiver);
    } finally {
        try {
            await connection.promise().end();
        } catch (err) {
            connection.destroy();
        }
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }

    return { status: 'created' };
}

async function createDataPackages(archiver, options) {
    const counts = { created: 0, skipped: 0, planned: 0, missing: 0 };
    const definitions = getDataPackageDefinitions();
    const directoryDefinitions = definitions.filter((definition) => definition.type !== 'database');
    const databaseDefinitions = definitions.filter((definition) => definition.type === 'database');

    const directoryResults = await mapWithConcurrency(
        directoryDefinitions,
        options.jobs,
        (definition) => createDirectoryPackage(definition, archiver, options),
    );
    addResultsToCounts(counts, directoryResults);

    for (const definition of databaseDefinitions) {
        if (options.skipDb) {
            console.log(`[skip] package ${definition.id}: --skip-db`);
            counts.skipped += 1;
            continue;
        }
        // Database exports stay serial so parallel archive jobs do not multiply
        // full-table scans against MySQL.
        const result = await createDatabasePackage(definition, archiver, options);
        counts[result.status] = (counts[result.status] || 0) + 1;
    }

    return counts;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const dataRoot = path.resolve(config.paths.dataDir);

    console.log(`DATA_DIR=${dataRoot}`);
    console.log(`DATA_ARCHIVE_DIR=${dataArchiveRoot}`);
    console.log(`compressionLevel=${config.data.archiveCompressionLevel}`);
    console.log(`depth=${Number.isFinite(options.depth) ? options.depth : 'all'}`);
    console.log(`jobs=${options.jobs}`);

    if (isSameOrInside(dataRoot, dataArchiveRoot)) {
        throw new Error('DATA_ARCHIVE_DIR must be outside DATA_DIR; use a sibling directory such as outputs_archives.');
    }

    await fs.promises.mkdir(dataArchiveRoot, { recursive: true });
    const archiver = await getArchiver();
    const counts = { created: 0, skipped: 0, planned: 0 };

    if (!options.skipFolderArchives) {
        const rootStat = await fs.promises.stat(dataRoot);
        if (!rootStat.isDirectory()) {
            throw new Error(`DATA_DIR is not a directory: ${dataRoot}`);
        }

        const rootNode = await scanDirectory(dataRoot, dataRoot, 0);
        const targets = collectArchiveTargets(rootNode, options)
            .filter((target) => target.relPath || options.includeRoot)
            .sort((a, b) => a.relPath.localeCompare(b.relPath));

        console.log(`folderArchives=${targets.length}`);
        const results = await mapWithConcurrency(
            targets,
            options.jobs,
            (target) => createArchive(target, archiver, options),
        );
        addResultsToCounts(counts, results);
    }

    if (!options.skipPackages) {
        const packageCounts = await createDataPackages(archiver, options);
        for (const [key, value] of Object.entries(packageCounts)) {
            counts[key] = (counts[key] || 0) + value;
        }
    }

    console.log(`done created=${counts.created || 0} skipped=${counts.skipped || 0} planned=${counts.planned || 0} missing=${counts.missing || 0}`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
