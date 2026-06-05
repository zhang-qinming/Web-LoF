const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const GO_OBO_URL = 'https://purl.obolibrary.org/obo/go/go-basic.obo';
const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'data', 'go_sync');
const FETCH_TIMEOUT_MS = 60000;
const MANUAL_GO_NAME_MAPPINGS = {
    HALLMARK_G2M_CHECKPOINT: 'G2/M transition of mitotic cell cycle',
    HALLMARK_UNFOLDED_PROTEIN_RESPONSE: 'response to unfolded protein',
    HALLMARK_HEME_METABOLISM: 'heme metabolic process',
    HALLMARK_TNFA_SIGNALING_VIA_NFKB: 'tumor necrosis factor-mediated signaling pathway',
};

function parseArgs(argv) {
    const args = {
        write: false,
        outputDir: DEFAULT_OUTPUT_DIR,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--write') args.write = true;
        if (arg === '--dry-run') args.write = false;
        if (arg === '--out') {
            args.outputDir = path.resolve(argv[i + 1]);
            i += 1;
        }
    }

    return args;
}

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function extractGoAccession(value) {
    const match = String(value || '').match(/GO[:_]\d+/i);
    return match ? match[0].replace('_', ':').toUpperCase() : '';
}

async function fetchText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'text/plain' },
        });
        if (!response.ok) throw new Error(`GO download failed: ${response.status} ${response.statusText}`);
        return await response.text();
    } finally {
        clearTimeout(timer);
    }
}

function parseGoObo(text) {
    const byId = new Map();
    const byName = new Map();

    String(text || '').split(/\n\[Term\]\s*\n/).forEach((block) => {
        const id = block.match(/^id:\s*(GO:\d+)/m)?.[1] || '';
        const name = block.match(/^name:\s*(.+)$/m)?.[1]?.trim() || '';
        const namespace = block.match(/^namespace:\s*(.+)$/m)?.[1]?.trim() || '';
        const obsolete = /^is_obsolete:\s*true$/m.test(block);
        if (!id || !name || obsolete) return;

        const term = { accession: id, name, ontology: namespace };
        byId.set(id, term);
        byName.set(normalizeKey(name), term);
    });

    return { byId, byName };
}

function resolveProgramGo(value, ontology) {
    const text = String(value || '').trim();
    if (!text || text.toLowerCase() === 'none') return null;

    const manualName = MANUAL_GO_NAME_MAPPINGS[text.toUpperCase()];
    if (manualName && ontology.byName.has(normalizeKey(manualName))) {
        return ontology.byName.get(normalizeKey(manualName));
    }

    const accession = extractGoAccession(text);
    if (accession && ontology.byId.has(accession)) return ontology.byId.get(accession);

    const direct = ontology.byName.get(normalizeKey(text));
    if (direct) return direct;

    const cleaned = text
        .replace(/^GO[:_]\d+\s*[-:]\s*/i, '')
        .replace(/\s*\(GO[:_]\d+\)\s*$/i, '')
        .trim();
    return ontology.byName.get(normalizeKey(cleaned)) || null;
}

async function ensureColumns(connection) {
    const [columns] = await connection.query(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'program_info'
            AND COLUMN_NAME IN ('go_term', 'go_accession', 'go_ontology')`,
    );
    const existing = new Set(columns.map((row) => row.COLUMN_NAME));

    if (!existing.has('go_term')) {
        await connection.query('ALTER TABLE program_info ADD COLUMN go_term VARCHAR(500) DEFAULT NULL AFTER representative_go');
    }
    if (!existing.has('go_accession')) {
        await connection.query('ALTER TABLE program_info ADD COLUMN go_accession VARCHAR(20) DEFAULT NULL AFTER go_term');
    }
    if (!existing.has('go_ontology')) {
        await connection.query('ALTER TABLE program_info ADD COLUMN go_ontology VARCHAR(100) DEFAULT NULL AFTER go_accession');
    }
}

function getDbConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 33306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gwas',
        charset: 'utf8mb4',
        multipleStatements: false,
    };
}

function writeReports(outputDir, rows) {
    fs.mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(outputDir, `program_go_metadata_${stamp}.json`);
    const tsvPath = path.join(outputDir, `program_go_metadata_${stamp}.tsv`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
        tsvPath,
        [
            'program\trepresentative_go\tgo_term\tgo_accession\tgo_ontology\tmatched',
            ...rows.map((row) => [
                row.program,
                row.representative_go || '',
                row.go_term || '',
                row.go_accession || '',
                row.go_ontology || '',
                row.matched ? 'yes' : 'no',
            ].map((value) => String(value).replace(/\t/g, ' ')).join('\t')),
        ].join('\n') + '\n',
        'utf8',
    );

    return { jsonPath, tsvPath };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const oboText = await fetchText(GO_OBO_URL);
    const ontology = parseGoObo(oboText);
    const connection = await mysql.createConnection(getDbConfig());

    try {
        if (args.write) await ensureColumns(connection);

        const [programs] = await connection.query(
            `SELECT program, representative_go
             FROM program_info
             ORDER BY CAST(SUBSTRING(program, 2) AS UNSIGNED)`,
        );
        const rows = programs.map((program) => {
            const term = resolveProgramGo(program.representative_go, ontology);
            return {
                program: program.program,
                representative_go: program.representative_go || '',
                go_term: term?.name || '',
                go_accession: term?.accession || '',
                go_ontology: term?.ontology || '',
                matched: Boolean(term),
            };
        });

        if (args.write && rows.length) {
            await connection.beginTransaction();
            try {
                for (const row of rows) {
                    await connection.query(
                        `UPDATE program_info
                         SET go_term = NULLIF(?, ''),
                             go_accession = NULLIF(?, ''),
                             go_ontology = NULLIF(?, '')
                         WHERE program = ?`,
                        [row.go_term, row.go_accession, row.go_ontology, row.program],
                    );
                }
                await connection.commit();
            } catch (err) {
                await connection.rollback();
                throw err;
            }
        }

        const reportPaths = writeReports(args.outputDir, rows);
        const matched = rows.filter((row) => row.matched).length;
        const unmatched = rows.length - matched;
        console.log(JSON.stringify({
            mode: args.write ? 'write' : 'dry-run',
            programs: rows.length,
            matched,
            unmatched,
            reportPaths,
        }, null, 2));
    } finally {
        await connection.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
