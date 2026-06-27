require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { config } = require('../lib/config');

const K_VALUE = 60;
const BATCH_SIZE = 1000;
const COLUMNS = [
    'edge_key',
    'program',
    'gene_symbol',
    'ensg_id',
    'role',
    'score',
    'rank_value',
    'direction',
    'source_dataset',
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

function cleanText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function truncateText(value, maxLength, fallback = '') {
    const text = cleanText(value, fallback);
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function stripBom(value = '') {
    return String(value).replace(/^\uFEFF/, '');
}

function toNumber(value) {
    if (value == null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function directionFromScore(score) {
    if (!Number.isFinite(score) || score === 0) return '';
    return score > 0 ? 'positive' : 'negative';
}

function normalizeHeader(value) {
    return String(value || '').trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeProgram(value) {
    const text = cleanText(value);
    const match = text.match(/^P?(\d+)$/i) || text.match(/program[_\s.-]*(\d+)$/i);
    return match ? `P${Number(match[1])}` : text;
}

function programFromText(value) {
    const text = cleanText(value);
    if (!text) return '';
    const direct = text.match(/^P?(\d+)$/i);
    if (direct) return `P${Number(direct[1])}`;
    const match = text.match(/(?:^|[^a-z0-9])(?:program|prog|topic|module|factor|p)[_\s.-]*(\d+)(?:$|[^a-z0-9])/i);
    return match ? `P${Number(match[1])}` : '';
}

function findHeader(headers, candidates) {
    const normalizedCandidates = new Set(candidates.map(normalizeHeader));
    return headers.find((header) => normalizedCandidates.has(normalizeHeader(header))) || '';
}

function findGeneIndexHeader(headers, programColumns = []) {
    const explicit = findHeader(headers, [
        'gene',
        'GENE',
        'gene_symbol',
        'symbol',
        'gene_name',
        'feature',
        'index',
        'rownames',
        'rowname',
        'unnamed_0',
        'Unnamed: 0',
    ]);
    if (explicit) return explicit;
    const programSet = new Set(programColumns);
    return headers.find((header, index) => index === 0 && !programSet.has(header)) || '';
}

function listFilesRecursive(rootPath, maxDepth = 6) {
    const fullRoot = path.resolve(rootPath);
    if (!fs.existsSync(fullRoot)) throw new Error(`Directory not found: ${fullRoot}`);
    const files = [];

    function walk(dir, depth) {
        if (depth > maxDepth) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath, depth + 1);
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    }

    if (fs.statSync(fullRoot).isFile()) return [fullRoot];
    walk(fullRoot, 0);
    return files.sort((a, b) => a.localeCompare(b));
}

function looksLikeK60(filePath) {
    const text = filePath.replace(/\\/g, '/');
    return new RegExp(`(^|[^0-9])K[_\\s.-]*${K_VALUE}([^0-9]|$)`, 'i').test(text)
        || new RegExp(`(^|[^0-9])k${K_VALUE}([^0-9]|$)`, 'i').test(text)
        || new RegExp(`(^|[^0-9])${K_VALUE}[_\\s.-]*program`, 'i').test(text);
}

function findCnmfGeneSpectraFile(rootDir) {
    const files = listFilesRecursive(rootDir)
        .filter((filePath) => /\.(txt|tsv|csv)$/i.test(filePath));
    const spectraCandidates = files.filter((filePath) => /gene[_\s.-]*spectra[_\s.-]*score/i.test(path.basename(filePath)));
    const k60Candidates = spectraCandidates.filter(looksLikeK60);
    if (!k60Candidates.length) {
        const err = new Error(`No K${K_VALUE} gene_spectra_score file found in ${rootDir}`);
        err.details = {
            searchedFiles: files.length,
            geneSpectraScoreCandidates: spectraCandidates.slice(0, 30).map((filePath) => path.relative(rootDir, filePath)),
        };
        throw err;
    }
    return k60Candidates[0];
}

async function parseDelimitedFile(filePath) {
    const rows = [];
    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let headers = null;
    let delimiter = '\t';

    for await (const line of rl) {
        if (!headers) {
            delimiter = line.includes('\t') ? '\t' : ',';
            headers = line.split(delimiter).map((header) => stripBom(header).trim());
            continue;
        }
        if (!line.trim()) continue;
        const cells = line.split(delimiter);
        const row = {};
        headers.forEach((header, index) => {
            row[header] = (cells[index] || '').trim();
        });
        rows.push(row);
    }

    return { headers: headers || [], rows };
}

function makeProgramGeneRecord({ program, geneSymbol, ensgId, score, sourceFile }) {
    const geneKey = ensgId || geneSymbol;
    if (!program || !geneKey || score == null) return null;
    return {
        edge_key: `cNMF_all.gene_spectra_score|${program}|program_gene|${geneKey}`,
        program: truncateText(program, 100),
        gene_symbol: truncateText(geneSymbol, 100),
        ensg_id: truncateText(ensgId, 30),
        role: 'program_gene',
        score,
        rank_value: null,
        direction: directionFromScore(score),
        source_dataset: 'cNMF_all.gene_spectra_score',
        source_file: truncateText(sourceFile, 255),
    };
}

function parseCnmfMembership(payload, sourceFile) {
    const { headers, rows } = payload;
    const programCol = findHeader(headers, ['program', 'topic', 'module', 'component', 'factor']);
    const ensgCol = findHeader(headers, ['ensg', 'ensg_id', 'ensembl', 'ensembl_id']);
    const scoreCol = findHeader(headers, ['gene_spectra_score', 'spectra_score', 'score', 'loading', 'weight', 'value']);
    const programColumns = headers.filter((header) => programFromText(header));
    const geneCol = findGeneIndexHeader(headers, programColumns);
    const records = [];

    if (programCol && scoreCol && (geneCol || ensgCol)) {
        rows.forEach((row) => {
            const program = normalizeProgram(row[programCol]);
            const geneSymbol = geneCol ? cleanText(row[geneCol]) : '';
            const ensgId = ensgCol ? cleanText(row[ensgCol]) : '';
            const score = toNumber(row[scoreCol]);
            const record = makeProgramGeneRecord({ program, geneSymbol, ensgId, score, sourceFile });
            if (record) records.push(record);
        });
        return records;
    }

    if ((geneCol || ensgCol) && programColumns.length) {
        rows.forEach((row) => {
            const geneSymbol = geneCol ? cleanText(row[geneCol]) : '';
            const ensgId = ensgCol ? cleanText(row[ensgCol]) : '';
            programColumns.forEach((header) => {
                const program = programFromText(header);
                const score = toNumber(row[header]);
                const record = makeProgramGeneRecord({ program, geneSymbol, ensgId, score, sourceFile });
                if (record) records.push(record);
            });
        });
        return records;
    }

    if (programCol && !geneCol && !scoreCol) {
        const geneHeaders = headers.filter((header) => header !== programCol);
        rows.forEach((row) => {
            const program = normalizeProgram(row[programCol]);
            geneHeaders.forEach((header) => {
                const score = toNumber(row[header]);
                const record = makeProgramGeneRecord({ program, geneSymbol: header, ensgId: '', score, sourceFile });
                if (record) records.push(record);
            });
        });
        return records;
    }

    const firstHeader = headers[0];
    const matrixGeneHeaders = headers.slice(1).filter((header) => cleanText(header));
    if (firstHeader != null && matrixGeneHeaders.length) {
        rows.forEach((row) => {
            const program = normalizeProgram(row[firstHeader]);
            if (!program) return;
            matrixGeneHeaders.forEach((header) => {
                const geneId = cleanText(header);
                const score = toNumber(row[header]);
                const record = makeProgramGeneRecord({
                    program,
                    geneSymbol: /^ENSG\d+/i.test(geneId) ? '' : geneId,
                    ensgId: /^ENSG\d+/i.test(geneId) ? geneId : '',
                    score,
                    sourceFile,
                });
                if (record) records.push(record);
            });
        });
        if (records.length) return records;
    }

    const err = new Error(`Unsupported cNMF gene_spectra_score shape: ${sourceFile}`);
    err.details = { headers };
    throw err;
}

function rankProgramGeneRecords(records) {
    const byKey = new Map();
    records.forEach((record) => {
        const key = `${record.program}|${record.role}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(record);
    });
    byKey.forEach((items) => {
        items
            .sort((a, b) => Math.abs(b.score || 0) - Math.abs(a.score || 0)
                || String(a.gene_symbol || a.ensg_id).localeCompare(String(b.gene_symbol || b.ensg_id)))
            .forEach((record, index) => {
                record.rank_value = index + 1;
            });
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
        const currentScore = Math.abs(Number(current.score) || 0);
        const nextScore = Math.abs(Number(record.score) || 0);
        if (nextScore > currentScore) map.set(record.edge_key, record);
    });
    return [...map.values()];
}

function listRegulationFiles(rootDir) {
    if (!fs.existsSync(rootDir)) throw new Error(`Regulation directory not found: ${rootDir}`);
    const files = listFilesRecursive(rootDir, 3)
        .filter((filePath) => /\.txt$/i.test(filePath))
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
    const k60Files = files.filter((filePath) => /K60_program\d+_perturb_effects\.txt$/i.test(path.basename(filePath)));
    if (!k60Files.length) {
        const err = new Error(`No K${K_VALUE}_program*_perturb_effects.txt files found in ${rootDir}`);
        err.details = {
            perturbEffectCandidates: files
                .filter((filePath) => /program\d+_perturb_effects\.txt$/i.test(path.basename(filePath)))
                .slice(0, 30)
                .map((filePath) => path.basename(filePath)),
        };
        throw err;
    }
    return k60Files;
}

function makeRegulatorRecord({ program, geneSymbol, ensgId, score, rankValue, sourceFile }) {
    const geneKey = ensgId || geneSymbol;
    if (!program || !geneKey || score == null) return null;
    return {
        edge_key: `cNMF_regulation.K562GW|${program}|regulator|${geneKey}`,
        program: truncateText(program, 100),
        gene_symbol: truncateText(geneSymbol, 100),
        ensg_id: truncateText(ensgId, 30),
        role: 'regulator',
        score,
        rank_value: rankValue,
        direction: directionFromScore(score),
        source_dataset: 'cNMF_regulation.K562GW',
        source_file: truncateText(sourceFile, 255),
    };
}

async function parseRegulationFile(filePath) {
    const fileName = path.basename(filePath);
    const match = fileName.match(/K60_program(\d+)_perturb_effects\.txt$/i);
    const program = match ? `P${Number(match[1])}` : '';
    const payload = await parseDelimitedFile(filePath);
    const geneCol = findHeader(payload.headers, ['GENE', 'gene', 'gene_symbol', 'symbol']);
    const ensgCol = findHeader(payload.headers, ['ensg', 'ensg_id', 'ensembl', 'ensembl_id']);
    const scoreCol = findHeader(payload.headers, ['lm_es', 'effect_size', 'score', 'beta']);
    const pCol = findHeader(payload.headers, ['lm_p', 'p', 'p_value', 'pvalue']);

    if (!program || !geneCol || !scoreCol) {
        const err = new Error(`Missing required regulation columns in ${fileName}`);
        err.details = { headers: payload.headers };
        throw err;
    }

    const rows = payload.rows.map((row) => ({
        geneSymbol: cleanText(row[geneCol]),
        ensgId: ensgCol ? cleanText(row[ensgCol]) : '',
        score: toNumber(row[scoreCol]),
        pValue: pCol ? toNumber(row[pCol]) : null,
    })).filter((row) => (row.geneSymbol || row.ensgId) && row.score != null);

    rows.sort((a, b) => {
        const aP = a.pValue == null ? Number.POSITIVE_INFINITY : a.pValue;
        const bP = b.pValue == null ? Number.POSITIVE_INFINITY : b.pValue;
        return aP - bP || Math.abs(b.score || 0) - Math.abs(a.score || 0)
            || String(a.geneSymbol || a.ensgId).localeCompare(String(b.geneSymbol || b.ensgId));
    });

    return rows.map((row, index) => makeRegulatorRecord({
        program,
        geneSymbol: row.geneSymbol,
        ensgId: row.ensgId,
        score: row.score,
        rankValue: index + 1,
        sourceFile: fileName,
    })).filter(Boolean);
}

async function collectRecords(cnmfAllDir, regulationDir) {
    const membershipFile = findCnmfGeneSpectraFile(cnmfAllDir);
    const membershipPayload = await parseDelimitedFile(membershipFile);
    const membershipRecords = dedupeByEdgeKey(parseCnmfMembership(membershipPayload, path.basename(membershipFile)));
    rankProgramGeneRecords(membershipRecords);

    const regulationFiles = listRegulationFiles(regulationDir);
    const regulatorRecords = [];
    const failedRegulationFiles = [];
    for (const filePath of regulationFiles) {
        try {
            regulatorRecords.push(...await parseRegulationFile(filePath));
        } catch (err) {
            failedRegulationFiles.push({ file: path.basename(filePath), message: err.message, details: err.details || null });
        }
    }

    return {
        membershipFile,
        regulationFiles,
        membershipRecords,
        regulatorRecords: dedupeByEdgeKey(regulatorRecords),
        failedRegulationFiles,
        records: dedupeByEdgeKey([...membershipRecords, ...regulatorRecords]),
    };
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
            `INSERT INTO program_gene_role_edge (${COLUMNS.join(', ')}) VALUES ?`,
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
        await connection.query('DELETE FROM program_gene_role_edge');
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

function printSummary(payload, cnmfAllDir, regulationDir, dryRun) {
    const programs = new Set(payload.records.map((record) => record.program));
    const genes = new Set(payload.records.map((record) => record.ensg_id || record.gene_symbol));
    console.log(JSON.stringify({
        mode: dryRun ? 'dry-run' : 'import',
        cnmfAllDir,
        regulationDir,
        membershipFile: path.basename(payload.membershipFile),
        regulationFiles: payload.regulationFiles.length,
        failedRegulationFiles: payload.failedRegulationFiles.length,
        programs: programs.size,
        genes: genes.size,
        programGeneRows: payload.membershipRecords.length,
        regulatorRows: payload.regulatorRecords.length,
        programGeneRoleEdges: payload.records.length,
        failed: payload.failedRegulationFiles.slice(0, 20),
    }, null, 2));
}

async function main() {
    const dryRun = hasFlag('--dry-run');
    const cnmfAllDir = path.resolve(getArg('--cnmf-all-dir', config.paths.cnmfAllDir));
    const regulationDir = path.resolve(getArg('--regulation-dir', config.paths.regulationDataDir));
    const payload = await collectRecords(cnmfAllDir, regulationDir);
    printSummary(payload, cnmfAllDir, regulationDir, dryRun);

    if (!dryRun) {
        await importRecords(payload.records);
        console.log('Program gene role index import completed.');
    }
}

main().catch((err) => {
    console.error('Import failed:', err.message);
    if (err.details) console.error(JSON.stringify(err.details, null, 2));
    process.exit(1);
});
