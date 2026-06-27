require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { config } = require('../lib/config');

const BATCH_SIZE = 1000;
const COLUMNS = [
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

function cleanText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function truncateText(value, maxLength, fallback = '') {
    const text = cleanText(value, fallback);
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function toNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function normalizeProgram(value) {
    const text = cleanText(value);
    const match = text.match(/^P?(\d+)$/i);
    return match ? `P${Number(match[1])}` : text;
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

function listScatterFiles(rootDir) {
    if (!fs.existsSync(rootDir)) throw new Error(`Program scatter directory not found: ${rootDir}`);
    return fs.readdirSync(rootDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.tsv$/i.test(entry.name))
        .map((entry) => path.join(rootDir, entry.name))
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function rankByAbs(rows, valueKey, rankKey) {
    [...rows]
        .filter((row) => row[valueKey] != null)
        .sort((a, b) => Math.abs(b[valueKey]) - Math.abs(a[valueKey]))
        .forEach((row, index) => {
            row[rankKey] = index + 1;
        });
}

function dedupeByEdgeKey(records) {
    const map = new Map();
    records.forEach((record) => {
        if (!record.edge_key) return;
        if (!map.has(record.edge_key)) {
            map.set(record.edge_key, record);
            return;
        }
        const current = map.get(record.edge_key);
        const currentScore = Math.abs(Number(current.program_score) || 0) + Math.abs(Number(current.regulator_score) || 0);
        const nextScore = Math.abs(Number(record.program_score) || 0) + Math.abs(Number(record.regulator_score) || 0);
        if (nextScore > currentScore) map.set(record.edge_key, record);
    });
    return [...map.values()];
}

async function collectRecords(rootDir) {
    const files = listScatterFiles(rootDir);
    const records = [];
    const failed = [];

    for (const filePath of files) {
        const fileName = path.basename(filePath);
        const fileId = fileName.replace(/\.tsv$/i, '');
        try {
            const rows = (await parseTsvFile(filePath)).map((row) => {
                const program = normalizeProgram(row.Program || row.program);
                const traitId = cleanText(row.trait_id, fileId);
                return {
                    edge_key: `${fileId}|${traitId}|${program}`,
                    file_id: truncateText(fileId, 100),
                    trait_id: truncateText(traitId, 100),
                    program: truncateText(program, 100),
                    program_score: toNumber(row.program_score),
                    regulator_score: toNumber(row.regulator_score),
                    program_p: toNumber(row.MEANgamma_top100_shet_adjusted_P ?? row.program_p ?? row.P),
                    regulator_p: toNumber(row.P_withShet ?? row.regulator_p ?? row.regulator_model_p),
                    program_rank: null,
                    regulator_rank: null,
                    program_gamma: toNumber(row.MEANgamma_top100 ?? row.program_gamma ?? row.meanG),
                    regulator_beta: toNumber(row.beta_withShet ?? row.regulator_beta ?? row.regulator_model_coef),
                    enrichment_class: truncateText(row.color || row.enrichment_class, 50, 'other'),
                    source_file: truncateText(fileName, 255),
                };
            }).filter((row) => row.program && row.trait_id);

            rankByAbs(rows, 'program_score', 'program_rank');
            rankByAbs(rows, 'regulator_score', 'regulator_rank');
            records.push(...rows);
        } catch (err) {
            failed.push({ file: fileName, message: err.message });
        }
    }

    return { files, records: dedupeByEdgeKey(records), failed };
}

function chunkRows(rows, size) {
    const chunks = [];
    for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
    return chunks;
}

async function insertRows(connection, records) {
    for (const chunk of chunkRows(records, BATCH_SIZE)) {
        const values = chunk.map((record) => COLUMNS.map((column) => record[column] ?? null));
        await connection.query(
            `INSERT INTO program_trait_scatter_edge (${COLUMNS.join(', ')}) VALUES ?`,
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
        await connection.query('DELETE FROM program_trait_scatter_edge');
        await insertRows(connection, records);
        await connection.commit();
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
        await pool.end();
    }
}

function printSummary(payload, rootDir, dryRun) {
    const traits = new Set(payload.records.map((record) => record.trait_id));
    const programs = new Set(payload.records.map((record) => record.program));
    console.log(JSON.stringify({
        mode: dryRun ? 'dry-run' : 'import',
        rootDir,
        files: payload.files.length,
        failedFiles: payload.failed.length,
        traits: traits.size,
        programs: programs.size,
        programTraitScatterEdges: payload.records.length,
        failed: payload.failed.slice(0, 20),
    }, null, 2));
}

async function main() {
    const dryRun = hasFlag('--dry-run');
    const rootDir = path.resolve(getArg('--dir', config.paths.programDataDir));
    const payload = await collectRecords(rootDir);
    printSummary(payload, rootDir, dryRun);

    if (!dryRun) {
        await importRecords(payload.records);
        console.log('Program trait scatter index import completed.');
    }
}

main().catch((err) => {
    console.error('Import failed:', err.message);
    if (err.details) console.error(JSON.stringify(err.details, null, 2));
    process.exit(1);
});
