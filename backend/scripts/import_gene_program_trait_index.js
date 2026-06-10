require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { once } = require('events');
const mysql = require('mysql2/promise');
const { config } = require('../lib/config');
const { REFRESH_GENE_SUMMARY_SQL, refreshGeneSummary } = require('./lib/geneSummary');

const BATCH_SIZE = 1000;

const GENE_COLUMNS = [
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

const PROGRAM_COLUMNS = [
    'edge_key',
    'file_id',
    'trait_id',
    'program',
    'program_label',
    'program_annotation',
    'program_trait_sign',
    'color',
    'program_score',
    'regulator_score',
    'program_sig',
    'regulator_sig',
    'selected_by_program',
    'selected_by_regulator',
    'loading_gene_count',
    'regulator_gene_count',
    'loading_visible_count',
    'regulator_visible_count',
    'has_overlap',
    'empty_reason',
    'source_file',
];

function hasFlag(flag) {
    return process.argv.includes(flag);
}

function getArg(name, fallback = null) {
    const prefix = `${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : fallback;
}

function stripBom(value = '') {
    return String(value).replace(/^\uFEFF/, '');
}

function cleanText(value, fallback = null) {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function truncateText(value, maxLength, fallback = null) {
    const text = cleanText(value, fallback);
    return text && text.length > maxLength ? text.slice(0, maxLength) : text;
}

function toNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toInt(value) {
    const num = toNumber(value);
    return Number.isFinite(num) ? Math.trunc(num) : null;
}

function toBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeProgram(value) {
    const text = cleanText(value, '');
    const match = text.match(/^P?(\d+)$/i);
    return match ? `P${Number(match[1])}` : text;
}

function roleFromSide(value) {
    const side = cleanText(value, '').toLowerCase();
    if (side === 'program_loading') return 'program';
    if (side === 'regulator') return 'regulator';
    return null;
}

async function parseTsvFile(filePath) {
    const rows = [];
    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let headers = null;

    for await (const line of rl) {
        if (!headers) {
            headers = line.split('\t').map((header) => stripBom(header).trim());
            continue;
        }

        if (!line.trim()) continue;
        const cells = line.split('\t');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = (cells[index] || '').trim();
        });
        rows.push(row);
    }

    return rows;
}

function parseTsvText(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t').map((header) => stripBom(header).trim());
    return lines.slice(1).map((line) => {
        const cells = line.split('\t');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = (cells[index] || '').trim();
        });
        return row;
    });
}

function pairFromFileNames(names, toPath = (name) => name) {
    const programFiles = new Map();
    const geneFiles = new Map();

    names.forEach((name) => {
        const baseName = path.basename(name);
        const programMatch = baseName.match(/^(.+)_programs\.tsv$/i);
        if (programMatch) {
            programFiles.set(programMatch[1], { name: baseName, sourcePath: toPath(name) });
            return;
        }

        const geneMatch = baseName.match(/^(.+)_long\.tsv$/i);
        if (geneMatch) geneFiles.set(geneMatch[1], { name: baseName, sourcePath: toPath(name) });
    });

    const allIds = [...new Set([...programFiles.keys(), ...geneFiles.keys()])].sort();
    return allIds.map((fileId) => ({
        fileId,
        programFile: programFiles.get(fileId)?.name || null,
        geneFile: geneFiles.get(fileId)?.name || null,
        programPath: programFiles.get(fileId)?.sourcePath || null,
        genePath: geneFiles.get(fileId)?.sourcePath || null,
    }));
}

async function listPanelFilePairs(rootDir) {
    const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
    return pairFromFileNames(
        entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
        (name) => path.join(rootDir, name),
    );
}

function normalizeApiBase(apiBase) {
    return String(apiBase || '').trim().replace(/\/+$/g, '');
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    return res.json();
}

async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    return res.text();
}

async function listPanelFilePairsFromApi(apiBase) {
    const base = normalizeApiBase(apiBase);
    const params = new URLSearchParams({
        dir: 'trait_program_gene_panel/tables',
        search: '.tsv',
    });
    const payload = await fetchJson(`${base}/api/data/file-paths?${params.toString()}`);
    return pairFromFileNames(payload.paths || [], (relPath) => relPath);
}

async function parseTsvFromApi(apiBase, relPath) {
    const base = normalizeApiBase(apiBase);
    const params = new URLSearchParams({ path: relPath });
    const text = await fetchText(`${base}/api/data/download?${params.toString()}`);
    return parseTsvText(text);
}

function programRowToRecord(row, fileId, sourceFile) {
    const program = normalizeProgram(row.Program);
    const traitId = cleanText(row.trait_id, fileId);
    if (!program || !traitId) return null;

    return {
        edge_key: `${traitId}|${program}`,
        file_id: truncateText(fileId, 100),
        trait_id: truncateText(traitId, 100),
        program: truncateText(program, 100),
        program_label: truncateText(row.program_label, 300, program),
        program_annotation: truncateText(row.program_annotation, 500),
        program_trait_sign: truncateText(row.program_trait_sign, 50),
        color: truncateText(row.color, 50, 'other'),
        program_score: toNumber(row.program_score),
        regulator_score: toNumber(row.regulator_score),
        program_sig: toBoolean(row.program_sig),
        regulator_sig: toBoolean(row.regulator_sig),
        selected_by_program: toBoolean(row.selected_by_program),
        selected_by_regulator: toBoolean(row.selected_by_regulator),
        loading_gene_count: toInt(row.loading_gene_count) || 0,
        regulator_gene_count: toInt(row.regulator_gene_count) || 0,
        loading_visible_count: 0,
        regulator_visible_count: 0,
        has_overlap: row.has_overlap == null ? true : toBoolean(row.has_overlap, true),
        empty_reason: truncateText(row.empty_reason, 500),
        source_file: truncateText(sourceFile, 255),
    };
}

function geneRowToRecord(row, fileId, sourceFile) {
    const role = roleFromSide(row.side);
    const program = normalizeProgram(row.Program);
    const traitId = cleanText(row.trait_id, fileId);
    const ensg = cleanText(row.ensg);
    const gene = cleanText(row.gene);
    if (!role || !program || !traitId || (!ensg && !gene)) return null;

    const keyGene = ensg || gene;
    return {
        edge_key: `${traitId}|${program}|${role}|${keyGene}`,
        file_id: truncateText(fileId, 100),
        trait_id: truncateText(traitId, 100),
        program: truncateText(program, 100),
        role,
        side: truncateText(row.side, 50),
        ensg_id: truncateText(ensg, 30),
        gene_symbol: truncateText(gene, 100),
        gene_label: truncateText(row.gene_label, 120, gene || ensg),
        program_label: truncateText(row.program_label, 300, program),
        program_annotation: truncateText(row.program_annotation, 500),
        post_mean: toNumber(row.post_mean),
        abs_gamma: toNumber(row.abs_gamma),
        gamma_sign: truncateText(row.gamma_sign, 50),
        membership_score: toNumber(row.membership_score),
        rank_within_side: toInt(row.rank_within_side),
        program_trait_sign: truncateText(row.program_trait_sign, 50),
        regulator_program_sign: truncateText(row.regulator_program_sign, 50),
        predicted_sign: truncateText(row.predicted_sign, 50),
        post_mean_sign: truncateText(row.post_mean_sign, 50),
        is_concordant: toBoolean(row.is_concordant),
        is_discordant: toBoolean(row.is_discordant),
        display_bucket: truncateText(row.display_bucket, 100),
        display_bucket_label: truncateText(row.display_bucket_label, 200),
        has_overlap: row.has_overlap == null ? true : toBoolean(row.has_overlap, true),
        source_file: truncateText(sourceFile, 255),
    };
}

function mergeVisibleCounts(programRecords, geneRecords) {
    const byKey = new Map(programRecords.map((record) => [record.edge_key, record]));
    geneRecords.forEach((gene) => {
        const program = byKey.get(`${gene.trait_id}|${gene.program}`);
        if (!program || !gene.has_overlap) return;
        if (gene.role === 'program') program.loading_visible_count += 1;
        if (gene.role === 'regulator') program.regulator_visible_count += 1;
    });
}

async function collectRecords(rootDir, { source = 'auto', apiBase = null } = {}) {
    let pairs = [];
    let sourceMode = source;

    if (source !== 'api') {
        try {
            pairs = await listPanelFilePairs(rootDir);
            sourceMode = 'local';
        } catch (err) {
            if (source === 'local' || err.code !== 'ENOENT') throw err;
        }
    }

    if (!pairs.length && source !== 'local') {
        pairs = await listPanelFilePairsFromApi(apiBase);
        sourceMode = 'api';
    }

    const programMap = new Map();
    const geneMap = new Map();
    const missing = [];
    const failed = [];

    for (const pair of pairs) {
        if (!pair.programFile || !pair.geneFile) {
            missing.push(pair);
            continue;
        }

        try {
            const programRows = sourceMode === 'api'
                ? await parseTsvFromApi(apiBase, pair.programPath)
                : await parseTsvFile(pair.programPath || path.join(rootDir, pair.programFile));
            const geneRows = sourceMode === 'api'
                ? await parseTsvFromApi(apiBase, pair.genePath)
                : await parseTsvFile(pair.genePath || path.join(rootDir, pair.geneFile));
            const programRecords = programRows
                .map((row) => programRowToRecord(row, pair.fileId, pair.programFile))
                .filter(Boolean);
            const geneRecords = geneRows
                .map((row) => geneRowToRecord(row, pair.fileId, pair.geneFile))
                .filter(Boolean);

            mergeVisibleCounts(programRecords, geneRecords);
            programRecords.forEach((record) => programMap.set(record.edge_key, record));
            geneRecords.forEach((record) => geneMap.set(record.edge_key, record));
        } catch (err) {
            failed.push({ fileId: pair.fileId, message: err.message });
        }
    }

    return {
        sourceMode,
        pairs,
        programRecords: [...programMap.values()],
        geneRecords: [...geneMap.values()],
        missing,
        failed,
    };
}

function chunkRows(rows, size) {
    const chunks = [];
    for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
    return chunks;
}

function quoteIdentifier(value) {
    return `\`${String(value).replace(/`/g, '``')}\``;
}

function quoteSqlString(value) {
    return `'${String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\0/g, '\\0')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\x1a/g, '\\Z')
        .replace(/'/g, "''")}'`;
}

function sqlValue(value) {
    if (value == null) return 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    return quoteSqlString(value);
}

async function writeStream(stream, value) {
    if (!stream.write(value)) await once(stream, 'drain');
}

async function writeInsertSql(stream, table, columns, records) {
    const columnList = columns.map(quoteIdentifier).join(', ');
    for (const chunk of chunkRows(records, BATCH_SIZE)) {
        const values = chunk.map((record) => (
            `(${columns.map((column) => sqlValue(record[column])).join(', ')})`
        ));
        await writeStream(
            stream,
            `INSERT INTO ${quoteIdentifier(table)} (${columnList}) VALUES\n${values.join(',\n')};\n`,
        );
    }
}

async function emitImportSql(records, stream = process.stdout) {
    await writeStream(stream, 'SET NAMES utf8mb4;\n');
    await writeStream(stream, 'SET autocommit = 0;\n');
    await writeStream(stream, 'START TRANSACTION;\n');
    await writeStream(stream, 'DELETE FROM `gene_program_trait_edge`;\n');
    await writeStream(stream, 'DELETE FROM `trait_program_edge`;\n');
    await writeInsertSql(stream, 'trait_program_edge', PROGRAM_COLUMNS, records.programRecords);
    await writeInsertSql(stream, 'gene_program_trait_edge', GENE_COLUMNS, records.geneRecords);
    await writeStream(stream, REFRESH_GENE_SUMMARY_SQL.trimStart());
    await writeStream(stream, 'COMMIT;\n');
}

async function insertRows(connection, table, columns, records) {
    for (const chunk of chunkRows(records, BATCH_SIZE)) {
        const values = chunk.map((record) => columns.map((column) => record[column] ?? null));
        await connection.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`,
            [values],
        );
    }
}

async function importRecords(records) {
    const pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 1,
    });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM gene_program_trait_edge');
        await connection.query('DELETE FROM trait_program_edge');
        await insertRows(connection, 'trait_program_edge', PROGRAM_COLUMNS, records.programRecords);
        await insertRows(connection, 'gene_program_trait_edge', GENE_COLUMNS, records.geneRecords);
        await refreshGeneSummary(connection);
        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
        await pool.end();
    }
}

function printSummary(records, rootDir, dryRun, apiBase, stream = process.stdout) {
    const traitIds = new Set(records.programRecords.map((record) => record.trait_id));
    const programs = new Set(records.programRecords.map((record) => record.program));
    const genes = new Set(records.geneRecords.map((record) => record.ensg_id || record.gene_symbol));

    stream.write(`${JSON.stringify({
        mode: dryRun ? 'dry-run' : 'import',
        source: records.sourceMode,
        rootDir,
        apiBase: records.sourceMode === 'api' ? normalizeApiBase(apiBase) : null,
        filePairs: records.pairs.length,
        completePairs: records.pairs.length - records.missing.length,
        missingPairs: records.missing.length,
        failedFiles: records.failed.length,
        traits: traitIds.size,
        programs: programs.size,
        genes: genes.size,
        traitProgramEdges: records.programRecords.length,
        geneProgramTraitEdges: records.geneRecords.length,
        missing: records.missing.slice(0, 20),
        failed: records.failed.slice(0, 20),
    }, null, 2)}\n`);
}

async function main() {
    const dryRun = hasFlag('--dry-run');
    const emitSql = hasFlag('--emit-sql');
    const source = getArg('--source', 'auto');
    const apiBase = getArg('--api-base', process.env.DATA_API_BASE || 'http://localhost:4000');
    const rootDir = path.resolve(getArg('--dir', config.paths.traitProgramGenePanelDir));
    const records = await collectRecords(rootDir, { source, apiBase });
    printSummary(records, rootDir, dryRun, apiBase, emitSql ? process.stderr : process.stdout);

    if (emitSql && !dryRun) {
        await emitImportSql(records);
    } else if (!dryRun) {
        await importRecords(records);
        console.log('Gene/program/trait index import completed.');
    }
}

main().catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
});
