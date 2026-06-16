const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'data', 'gene_info_sync');
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const ENSEMBL_BASES = ['https://grch37.rest.ensembl.org', 'https://rest.ensembl.org'];
const FETCH_TIMEOUT_MS = 12000;
const REQUEST_DELAY_MS = 360;

function parseArgs(argv) {
    const args = {
        write: false,
        limit: 0,
        outputDir: DEFAULT_OUTPUT_DIR,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--write') args.write = true;
        if (arg === '--dry-run') args.write = false;
        if (arg === '--limit') {
            args.limit = Math.max(0, Number(argv[i + 1]) || 0);
            i += 1;
        }
        if (arg === '--out') {
            args.outputDir = path.resolve(argv[i + 1]);
            i += 1;
        }
    }

    return args;
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function stripSourceSuffix(value) {
    return String(value || '').replace(/\s*\[Source:.*?\]\s*$/i, '').trim();
}

function normalizeGeneType(value) {
    return String(value || '').trim().replace(/_/g, '-');
}

function parseHgnc(dbxrefs) {
    const text = Array.isArray(dbxrefs) ? dbxrefs.join('|') : String(dbxrefs || '');
    const match = text.match(/HGNC:(\d+)/i);
    return match ? `HGNC:${match[1]}` : '';
}

async function fetchJson(url, { retries = 2 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            if (response.ok) return response.json();
            if (response.status !== 429 && response.status < 500) return null;
        } catch (err) {
            if (attempt === retries) return null;
        } finally {
            clearTimeout(timer);
        }

        await sleep(REQUEST_DELAY_MS * (attempt + 2));
    }

    return null;
}

function normalizeNcbiSummary(summary, fallbackSymbol = '') {
    if (!summary) return null;

    return {
        symbol: summary.nomenclaturesymbol || summary.name || fallbackSymbol || '',
        geneName: summary.description || '',
        geneId: String(summary.uid || ''),
        synonyms: summary.otheraliases || '',
        hgnc: parseHgnc(summary.dbxrefs),
        description: summary.summary || summary.description || '',
        ncbiStatus: summary.status || '',
    };
}

function chooseNcbiSummary(summaries, gene) {
    const usable = summaries.filter((item) => item && item.uid);
    if (!usable.length) return null;

    const symbol = String(gene.gene_symbol || '').toUpperCase();
    return usable.find((item) => String(item.nomenclaturesymbol || item.name || '').toUpperCase() === symbol)
        || usable.find((item) => String(item.name || '').toUpperCase() === symbol)
        || usable[0];
}

async function fetchNcbiInfo(gene) {
    const symbol = String(gene.gene_symbol || '').trim();
    const ensembl = String(gene.ensg_id || '').trim();
    const terms = [];

    if (symbol) terms.push(`${symbol}[sym] AND Homo sapiens[orgn]`);
    if (ensembl) terms.push(`${ensembl}[All Fields] AND Homo sapiens[orgn]`);

    for (const term of terms) {
        const searchUrl = `${NCBI_BASE}/esearch.fcgi?db=gene&retmode=json&retmax=5&sort=relevance&term=${encodeURIComponent(term)}`;
        const searchPayload = await fetchJson(searchUrl);
        await sleep(REQUEST_DELAY_MS);

        const ids = searchPayload?.esearchresult?.idlist || [];
        if (!ids.length) continue;

        const summaryUrl = `${NCBI_BASE}/esummary.fcgi?db=gene&retmode=json&id=${encodeURIComponent(ids.join(','))}`;
        const summaryPayload = await fetchJson(summaryUrl);
        await sleep(REQUEST_DELAY_MS);

        const summaries = ids.map((id) => summaryPayload?.result?.[id]).filter(Boolean);
        const summary = chooseNcbiSummary(summaries, gene);
        const normalized = normalizeNcbiSummary(summary, symbol);
        if (normalized?.geneId) return normalized;
    }

    return null;
}

function normalizeEnsemblPayload(payload) {
    if (!payload || payload.object_type !== 'Gene') return null;

    return {
        symbol: payload.display_name || '',
        ensembl: payload.id || '',
        chromosome: payload.seq_region_name || '',
        beginPos: payload.start == null ? null : Number(payload.start),
        endPos: payload.end == null ? null : Number(payload.end),
        geneType: normalizeGeneType(payload.biotype),
        geneName: stripSourceSuffix(payload.description),
    };
}

async function fetchEnsemblInfo(gene) {
    const ensembl = String(gene.ensg_id || '').trim();
    if (!ensembl) return null;

    for (const baseUrl of ENSEMBL_BASES) {
        const endpoint = `${baseUrl}/lookup/id/${encodeURIComponent(ensembl)}?content-type=application/json`;
        const payload = await fetchJson(endpoint, { retries: 1 });
        await sleep(REQUEST_DELAY_MS);

        const normalized = normalizeEnsemblPayload(payload);
        if (normalized) return normalized;
    }

    return null;
}

function mergeGeneInfo(gene, ncbiInfo, ensemblInfo) {
    return {
        chromosome: ensemblInfo?.chromosome || '',
        begin_pos: Number.isFinite(ensemblInfo?.beginPos) ? Math.trunc(ensemblInfo.beginPos) : null,
        end_pos: Number.isFinite(ensemblInfo?.endPos) ? Math.trunc(ensemblInfo.endPos) : null,
        symbol: ncbiInfo?.symbol || ensemblInfo?.symbol || gene.gene_symbol || '',
        gene_name: ncbiInfo?.geneName || ensemblInfo?.geneName || '',
        gene_id: ncbiInfo?.geneId || '',
        gene_type: ensemblInfo?.geneType || '',
        synonyms: ncbiInfo?.synonyms || '',
        hgnc: ncbiInfo?.hgnc || '',
        ensembl: gene.ensg_id,
        description: ncbiInfo?.description || ensemblInfo?.geneName || '',
        ncbi_status: ncbiInfo?.ncbiStatus || '',
        source_gene_symbol: gene.gene_symbol || '',
    };
}

function isComplete(row) {
    return Boolean(
        row.ensembl
        && row.symbol
        && row.gene_name
        && row.gene_id
        && row.gene_type
        && row.chromosome
        && row.begin_pos != null
        && row.end_pos != null
        && row.description
    );
}

function toTsvValue(value) {
    return String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

function writeArtifacts(outputDir, rows, failures, missingGenes) {
    fs.mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(outputDir, `gene_info_sync_${stamp}.json`);
    const tsvPath = path.join(outputDir, `gene_info_sync_${stamp}.tsv`);

    const payload = {
        createdAt: new Date().toISOString(),
        totalMissing: missingGenes.length,
        totalFetched: rows.length,
        totalComplete: rows.filter(isComplete).length,
        totalFailures: failures.length,
        rows,
        failures,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

    const columns = [
        'ensembl',
        'source_gene_symbol',
        'symbol',
        'gene_name',
        'gene_id',
        'gene_type',
        'chromosome',
        'begin_pos',
        'end_pos',
        'hgnc',
        'synonyms',
        'description',
        'ncbi_status',
        'complete',
    ];
    const lines = [
        columns.join('\t'),
        ...rows.map((row) => columns.map((column) => (
            column === 'complete' ? (isComplete(row) ? '1' : '0') : toTsvValue(row[column])
        )).join('\t')),
    ];
    fs.writeFileSync(tsvPath, `${lines.join('\n')}\n`);

    return { jsonPath, tsvPath };
}

async function getMissingGenes(pool, limit) {
    const limitSql = limit ? 'LIMIT ?' : '';
    const params = limit ? [limit] : [];
    const [rows] = await pool.query(
        `SELECT g.gene_symbol, g.ensg_id, g.total_rows, g.total_traits
         FROM (
            SELECT gene_symbol, ensg_id, COUNT(*) AS total_rows, COUNT(DISTINCT trait_id) AS total_traits
            FROM gene_program_trait_edge
            WHERE COALESCE(NULLIF(gene_symbol, ''), NULLIF(ensg_id, '')) IS NOT NULL
            GROUP BY gene_symbol, ensg_id
         ) g
         LEFT JOIN gene_info_hg37_matched gi ON gi.ensembl = g.ensg_id
         WHERE gi.ensembl IS NULL
            OR gi.symbol IS NULL OR gi.symbol = ''
            OR gi.gene_name IS NULL OR gi.gene_name = ''
            OR gi.gene_id IS NULL OR gi.gene_id = ''
            OR gi.gene_type IS NULL OR gi.gene_type = ''
            OR gi.chromosome IS NULL OR gi.chromosome = ''
            OR gi.begin_pos IS NULL
            OR gi.end_pos IS NULL
            OR gi.description IS NULL OR gi.description = ''
         ORDER BY g.total_traits DESC, g.total_rows DESC, g.gene_symbol ASC
         ${limitSql}`,
        params,
    );
    return rows;
}

async function upsertGeneInfo(pool, rows) {
    const completeRows = rows.filter(isComplete);
    if (!completeRows.length) return 0;

    const values = completeRows.map((row) => [
        row.source_gene_symbol || row.symbol,
        row.chromosome,
        row.begin_pos,
        row.end_pos,
        row.symbol,
        row.gene_name,
        row.gene_id,
        row.gene_type,
        row.synonyms,
        row.hgnc,
        row.ensembl,
        row.description,
        true,
        60,
        'legacy_sync',
        'NCBI_EUtils+Ensembl_REST',
    ]);

    await pool.query(
        `INSERT INTO gene_info_hg37_matched
            (perturb_symbol, chromosome, begin_pos, end_pos, symbol, gene_name, gene_id, gene_type, synonyms, hgnc, ensembl, description,
             perturb_tested, tested_program_count, mapping_status, annotation_source)
         VALUES ?
         ON DUPLICATE KEY UPDATE
            chromosome = IF(chromosome IS NULL OR chromosome = '', VALUES(chromosome), chromosome),
            begin_pos = IF(begin_pos IS NULL, VALUES(begin_pos), begin_pos),
            end_pos = IF(end_pos IS NULL, VALUES(end_pos), end_pos),
            symbol = IF(symbol IS NULL OR symbol = '', VALUES(symbol), symbol),
            gene_name = IF(gene_name IS NULL OR gene_name = '', VALUES(gene_name), gene_name),
            gene_id = IF(gene_id IS NULL OR gene_id = '', VALUES(gene_id), gene_id),
            gene_type = IF(gene_type IS NULL OR gene_type = '', VALUES(gene_type), gene_type),
            synonyms = IF(synonyms IS NULL OR synonyms = '', VALUES(synonyms), synonyms),
            hgnc = IF(hgnc IS NULL OR hgnc = '', VALUES(hgnc), hgnc),
            ensembl = IF(ensembl IS NULL OR ensembl = '', VALUES(ensembl), ensembl),
            description = IF(description IS NULL OR description = '', VALUES(description), description)`,
        [values],
    );

    return completeRows.length;
}

function createPool() {
    const connectionConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 33306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'gwas',
        waitForConnections: true,
        connectionLimit: 3,
        dateStrings: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
    };
    if (process.env.DB_PASSWORD) connectionConfig.password = process.env.DB_PASSWORD;
    return mysql.createPool(connectionConfig);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const pool = createPool();

    try {
        const missingGenes = await getMissingGenes(pool, args.limit);
        const rows = [];
        const failures = [];

        console.log(`Missing/incomplete genes: ${missingGenes.length}`);

        for (let index = 0; index < missingGenes.length; index += 1) {
            const gene = missingGenes[index];
            const label = gene.gene_symbol || gene.ensg_id;

            const [initialNcbiInfo, ensemblInfo] = await Promise.all([
                fetchNcbiInfo(gene),
                fetchEnsemblInfo(gene),
            ]);
            let ncbiInfo = initialNcbiInfo;
            if (!ncbiInfo && ensemblInfo?.symbol && ensemblInfo.symbol !== gene.gene_symbol) {
                ncbiInfo = await fetchNcbiInfo({
                    ...gene,
                    gene_symbol: ensemblInfo.symbol,
                });
            }

            const row = mergeGeneInfo(gene, ncbiInfo, ensemblInfo);
            if (isComplete(row)) {
                rows.push(row);
            } else {
                rows.push(row);
                failures.push({
                    geneSymbol: gene.gene_symbol || '',
                    ensembl: gene.ensg_id || '',
                    hasNcbi: Boolean(ncbiInfo),
                    hasEnsembl: Boolean(ensemblInfo),
                    missing: {
                        symbol: !row.symbol,
                        geneName: !row.gene_name,
                        geneId: !row.gene_id,
                        geneType: !row.gene_type,
                        location: !(row.chromosome && row.begin_pos != null && row.end_pos != null),
                        description: !row.description,
                    },
                });
            }

            console.log(`${index + 1}/${missingGenes.length} ${label} ${isComplete(row) ? 'complete' : 'incomplete'}`);
        }

        const artifacts = writeArtifacts(args.outputDir, rows, failures, missingGenes);
        const inserted = args.write ? await upsertGeneInfo(pool, rows) : 0;

        console.log(JSON.stringify({
            write: args.write,
            missingGenes: missingGenes.length,
            fetchedRows: rows.length,
            completeRows: rows.filter(isComplete).length,
            failures: failures.length,
            insertedOrUpdated: inserted,
            artifacts,
        }, null, 2));
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
