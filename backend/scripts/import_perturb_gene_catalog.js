const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const zlib = require('zlib');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { config } = require('../lib/config');

const DEFAULT_GENE_INFO_PATH = '/gpfs/chencao/Temporary_Files/smt/program/GeneInfo_hg37.txt';
const DEFAULT_CACHE_DIR = path.join(__dirname, '..', 'data', 'perturb_gene_catalog');
const NCBI_GENE_INFO_URL = 'https://ftp.ncbi.nlm.nih.gov/gene/DATA/GENE_INFO/Mammalia/Homo_sapiens.gene_info.gz';
const NCBI_GFF_URL = 'https://ftp.ncbi.nlm.nih.gov/genomes/all/annotation_releases/9606/105.20220307/GCF_000001405.25_GRCh37.p13/GCF_000001405.25_GRCh37.p13_genomic.gff.gz';
const NCBI_ASSEMBLY_REPORT_URL = 'https://ftp.ncbi.nlm.nih.gov/genomes/all/annotation_releases/9606/105.20220307/GCF_000001405.25_GRCh37.p13/GCF_000001405.25_GRCh37.p13_assembly_report.txt';
const HGNC_URL = 'https://storage.googleapis.com/public-download-files/hgnc/tsv/tsv/hgnc_complete_set.txt';
const ENSEMBL_GRCH37_BASE = 'https://grch37.rest.ensembl.org';
const CURATED_SYMBOL_OVERRIDES = new Map([
    // Replogle Perturb-seq uses this GENCODE label for the gene now named ZZZ3.
    ['AC118549.1', 'ZZZ3'],
]);

function parseArgs(argv) {
    const args = {
        apply: false,
        geneInfoPath: DEFAULT_GENE_INFO_PATH,
        cacheDir: DEFAULT_CACHE_DIR,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--apply') args.apply = true;
        if (arg === '--dry-run') args.apply = false;
        if (arg === '--gene-info') {
            args.geneInfoPath = path.resolve(argv[index + 1]);
            index += 1;
        }
        if (arg === '--cache-dir') {
            args.cacheDir = path.resolve(argv[index + 1]);
            index += 1;
        }
    }

    return args;
}

function cleanText(value, fallback = '') {
    let text = String(value ?? '').trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
        text = text.slice(1, -1).replace(/""/g, '"').trim();
    }
    if (!text || ['-', 'NA', 'N/A', 'NULL', 'NONE', '.'].includes(text.toUpperCase())) {
        return fallback;
    }
    return text;
}

function normalizeSymbol(value) {
    return cleanText(value).toUpperCase();
}

function normalizeEnsembl(value) {
    return cleanText(value).toUpperCase().replace(/\.\d+$/, '');
}

function normalizeGeneType(value) {
    return cleanText(value).replace(/_/g, '-');
}

function splitList(value) {
    return cleanText(value)
        .split(/[|;,]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function addToMultiMap(map, key, value) {
    const normalizedKey = normalizeSymbol(key);
    if (!normalizedKey) return;
    if (!map.has(normalizedKey)) map.set(normalizedKey, []);
    map.get(normalizedKey).push(value);
}

function uniqueBy(rows, keyFn) {
    const unique = new Map();
    rows.forEach((row) => {
        const key = keyFn(row);
        if (key) unique.set(key, row);
    });
    return [...unique.values()];
}

function getUnique(map, key, keyFn = (row) => row) {
    const rows = uniqueBy(map.get(normalizeSymbol(key)) || [], keyFn);
    return rows.length === 1 ? rows[0] : null;
}

function parseTsvLine(headers, line) {
    const cells = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
        row[header] = cells[index] ?? '';
    });
    return row;
}

async function forEachLine(filePath, callback) {
    const fileStream = fs.createReadStream(filePath);
    const input = filePath.endsWith('.gz') ? fileStream.pipe(zlib.createGunzip()) : fileStream;
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let lineNumber = 0;
    for await (const line of lines) {
        lineNumber += 1;
        await callback(line, lineNumber);
    }
}

function request(url, redirects = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'TraitVista-gene-catalog/1.0',
                Accept: '*/*',
                'Content-Type': 'application/json',
            },
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
                res.resume();
                resolve(request(new URL(res.headers.location, url).toString(), redirects - 1));
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}: ${url}`));
                return;
            }
            resolve(res);
        });
        req.setTimeout(120000, () => req.destroy(new Error(`Request timed out: ${url}`)));
        req.on('error', reject);
    });
}

async function downloadFile(url, filePath) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.part`;
    const response = await request(url);
    const output = fs.createWriteStream(tempPath);

    await new Promise((resolve, reject) => {
        response.pipe(output);
        response.on('error', reject);
        output.on('error', reject);
        output.on('finish', resolve);
    });

    fs.renameSync(tempPath, filePath);
    return filePath;
}

async function fetchJson(url) {
    const response = await request(url);
    const chunks = [];
    for await (const chunk of response) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function loadPerturbGenes(rootDir) {
    const names = fs.readdirSync(rootDir)
        .filter((name) => /_perturb_effects\.txt$/i.test(name))
        .sort();
    if (!names.length) throw new Error(`No perturb effect files found in ${rootDir}`);

    const programSets = [];
    const testedPrograms = new Map();
    for (const name of names) {
        const genes = new Set();
        let headers = null;
        await forEachLine(path.join(rootDir, name), (line) => {
            if (!headers) {
                headers = line.split('\t');
                return;
            }
            if (!line.trim()) return;
            const row = parseTsvLine(headers, line);
            const gene = cleanText(row.GENE);
            if (!gene) return;
            genes.add(gene);
            testedPrograms.set(gene, (testedPrograms.get(gene) || 0) + 1);
        });
        programSets.push(genes);
    }

    const reference = programSets[0];
    const sameGeneSet = programSets.every((genes) => (
        genes.size === reference.size && [...genes].every((gene) => reference.has(gene))
    ));
    if (!sameGeneSet) throw new Error('Perturb-seq program files do not contain the same gene set');

    return {
        genes: [...reference].sort((a, b) => a.localeCompare(b)),
        testedPrograms,
        programCount: names.length,
    };
}

async function loadLocalGeneInfo(filePath) {
    const rows = [];
    let headers = null;
    await forEachLine(filePath, (line) => {
        if (!headers) {
            headers = line.replace(/^\uFEFF/, '').split('\t');
            return;
        }
        if (line.trim()) rows.push(parseTsvLine(headers, line));
    });
    return rows;
}

async function loadNcbiGeneInfo(filePath) {
    const rows = [];
    let headers = null;
    await forEachLine(filePath, (line) => {
        if (!headers) {
            headers = line.replace(/^#/, '').split('\t');
            return;
        }
        if (!line.trim()) return;
        const row = parseTsvLine(headers, line);
        if (row['#tax_id'] === '9606' || row.tax_id === '9606') rows.push(row);
    });
    return rows;
}

async function loadHgnc(filePath) {
    const rows = [];
    let headers = null;
    await forEachLine(filePath, (line) => {
        if (!headers) {
            headers = line.replace(/^\uFEFF/, '').split('\t');
            return;
        }
        if (line.trim()) rows.push(parseTsvLine(headers, line));
    });
    return rows;
}

async function loadAssemblyAccessions(filePath) {
    const accessions = new Map();
    await forEachLine(filePath, (line) => {
        if (!line || line.startsWith('#')) return;
        const cells = line.split('\t');
        const sequenceName = cells[0];
        const assignedMolecule = cleanText(cells[2], sequenceName);
        const genbank = cleanText(cells[4]);
        const refseq = cleanText(cells[6]);
        const chromosome = assignedMolecule === 'MT' ? 'MT' : assignedMolecule;
        if (sequenceName) accessions.set(sequenceName, chromosome);
        if (genbank) accessions.set(genbank, chromosome);
        if (refseq) accessions.set(refseq, chromosome);
    });
    return accessions;
}

function parseGffAttributes(value) {
    const attributes = {};
    String(value || '').split(';').forEach((part) => {
        const index = part.indexOf('=');
        if (index < 0) return;
        const key = part.slice(0, index);
        const rawValue = part.slice(index + 1);
        try {
            attributes[key] = decodeURIComponent(rawValue);
        } catch {
            attributes[key] = rawValue;
        }
    });
    return attributes;
}

async function loadNcbiGff(filePath, accessionMap) {
    const byGeneId = new Map();
    const bySymbol = new Map();
    await forEachLine(filePath, (line) => {
        if (!line || line.startsWith('#')) return;
        const cells = line.split('\t');
        if (cells.length < 9 || cells[2] !== 'gene') return;
        const attributes = parseGffAttributes(cells[8]);
        const geneIdMatch = cleanText(attributes.Dbxref).match(/(?:^|,)GeneID:(\d+)(?:,|$)/);
        const geneId = geneIdMatch?.[1] || '';
        const symbol = cleanText(attributes.gene || attributes.Name);
        const row = {
            chromosome: accessionMap.get(cells[0]) || cells[0],
            beginPos: Number(cells[3]),
            endPos: Number(cells[4]),
            geneId,
            symbol,
            geneType: normalizeGeneType(attributes.gene_biotype),
            description: cleanText(attributes.description),
        };
        if (geneId) byGeneId.set(geneId, row);
        if (symbol) addToMultiMap(bySymbol, symbol, row);
    });
    return { byGeneId, bySymbol };
}

function parseDbXref(value, prefix) {
    const normalizedPrefix = `${prefix.toUpperCase()}:`;
    const match = String(value || '').split('|')
        .map((item) => item.trim())
        .find((item) => item.toUpperCase().startsWith(normalizedPrefix));
    return match ? match.slice(match.indexOf(':') + 1).replace(/^HGNC:/i, '') : '';
}

function createIndexes({
    localRows,
    currentRows,
    ncbiRows,
    hgncRows,
    edgeRows,
}) {
    const indexes = {
        localBySymbol: new Map(),
        localByEnsembl: new Map(),
        localByGeneId: new Map(),
        currentBySymbol: new Map(),
        currentByEnsembl: new Map(),
        ncbiBySymbol: new Map(),
        ncbiByAlias: new Map(),
        ncbiByGeneId: new Map(),
        ncbiByEnsembl: new Map(),
        hgncBySymbol: new Map(),
        hgncByPrevious: new Map(),
        hgncByAlias: new Map(),
        hgncByEnsembl: new Map(),
        hgncByEntrez: new Map(),
        edgeBySymbol: new Map(),
    };

    localRows.forEach((row) => {
        addToMultiMap(indexes.localBySymbol, row.Symbol, row);
        const ensembl = normalizeEnsembl(row.Ensembl);
        if (ensembl) indexes.localByEnsembl.set(ensembl, row);
        const geneId = cleanText(row['Gene ID']);
        if (geneId) indexes.localByGeneId.set(geneId, row);
    });

    currentRows.forEach((row) => {
        addToMultiMap(indexes.currentBySymbol, row.symbol, row);
        const ensembl = normalizeEnsembl(row.ensembl);
        if (ensembl) indexes.currentByEnsembl.set(ensembl, row);
    });

    ncbiRows.forEach((row) => {
        addToMultiMap(indexes.ncbiBySymbol, row.Symbol, row);
        splitList(row.Synonyms).forEach((alias) => addToMultiMap(indexes.ncbiByAlias, alias, row));
        const geneId = cleanText(row.GeneID);
        if (geneId) indexes.ncbiByGeneId.set(geneId, row);
        const ensembl = normalizeEnsembl(parseDbXref(row.dbXrefs, 'Ensembl'));
        if (ensembl) indexes.ncbiByEnsembl.set(ensembl, row);
    });

    hgncRows.forEach((row) => {
        addToMultiMap(indexes.hgncBySymbol, row.symbol, row);
        splitList(row.prev_symbol).forEach((symbol) => addToMultiMap(indexes.hgncByPrevious, symbol, row));
        splitList(row.alias_symbol).forEach((symbol) => addToMultiMap(indexes.hgncByAlias, symbol, row));
        const ensembl = normalizeEnsembl(row.ensembl_gene_id);
        const entrez = cleanText(row.entrez_id);
        if (ensembl) indexes.hgncByEnsembl.set(ensembl, row);
        if (entrez) indexes.hgncByEntrez.set(entrez, row);
    });

    const edgeSets = new Map();
    edgeRows.forEach((row) => {
        const symbol = normalizeSymbol(row.gene_symbol);
        const ensembl = normalizeEnsembl(row.ensg_id);
        if (!symbol || !ensembl) return;
        if (!edgeSets.has(symbol)) edgeSets.set(symbol, new Set());
        edgeSets.get(symbol).add(ensembl);
    });
    edgeSets.forEach((ensemblIds, symbol) => {
        if (ensemblIds.size === 1) indexes.edgeBySymbol.set(symbol, [...ensemblIds][0]);
    });

    return indexes;
}

function localToCatalog(row, perturbSymbol, testedProgramCount, mappingStatus, annotationSource) {
    return {
        perturb_symbol: perturbSymbol,
        chromosome: cleanText(row.Chromosome ?? row.chromosome),
        begin_pos: Number(cleanText(row.Begin ?? row.begin_pos)) || null,
        end_pos: Number(cleanText(row.End ?? row.end_pos)) || null,
        symbol: cleanText(row.Symbol ?? row.symbol, perturbSymbol),
        gene_name: cleanText(row.Name ?? row.gene_name),
        gene_id: cleanText(row['Gene ID'] ?? row.gene_id),
        gene_type: normalizeGeneType(row['Gene Type'] ?? row.gene_type),
        synonyms: cleanText(row.Synonyms ?? row.synonyms),
        hgnc: cleanText(row.HGNC ?? row.hgnc).replace(/^HGNC:/i, ''),
        ensembl: normalizeEnsembl(row.Ensembl ?? row.ensembl) || null,
        description: cleanText(row.description ?? row.Description ?? row.gene_name),
        perturb_tested: 1,
        tested_program_count: testedProgramCount,
        mapping_status: mappingStatus,
        annotation_source: annotationSource,
    };
}

function ncbiToCatalog({
    ncbi,
    hgnc,
    gff,
    perturbSymbol,
    testedProgramCount,
    mappingStatus,
    annotationSource,
    ensemblOverride = '',
}) {
    const ensembl = normalizeEnsembl(
        ensemblOverride
        || parseDbXref(ncbi?.dbXrefs, 'Ensembl')
        || hgnc?.ensembl_gene_id,
    );
    const hgncId = cleanText(parseDbXref(ncbi?.dbXrefs, 'HGNC') || hgnc?.hgnc_id)
        .replace(/^HGNC:/i, '');
    const officialName = cleanText(
        ncbi?.Full_name_from_nomenclature_authority,
        cleanText(ncbi?.description, cleanText(hgnc?.name)),
    );

    return {
        perturb_symbol: perturbSymbol,
        chromosome: cleanText(gff?.chromosome, cleanText(ncbi?.chromosome)),
        begin_pos: Number.isFinite(gff?.beginPos) ? gff.beginPos : null,
        end_pos: Number.isFinite(gff?.endPos) ? gff.endPos : null,
        symbol: cleanText(ncbi?.Symbol, cleanText(hgnc?.symbol, perturbSymbol)),
        gene_name: officialName,
        gene_id: cleanText(ncbi?.GeneID, cleanText(hgnc?.entrez_id)),
        gene_type: normalizeGeneType(gff?.geneType || ncbi?.type_of_gene || hgnc?.locus_type),
        synonyms: cleanText(ncbi?.Synonyms, cleanText(hgnc?.alias_symbol)),
        hgnc: hgncId,
        ensembl: ensembl || null,
        description: cleanText(ncbi?.Other_designations, officialName),
        perturb_tested: 1,
        tested_program_count: testedProgramCount,
        mapping_status: mappingStatus,
        annotation_source: annotationSource,
    };
}

function mergeCatalogRows(primary, supplement) {
    const result = { ...primary };
    [
        'chromosome',
        'begin_pos',
        'end_pos',
        'symbol',
        'gene_name',
        'gene_id',
        'gene_type',
        'synonyms',
        'hgnc',
        'ensembl',
        'description',
    ].forEach((field) => {
        if (result[field] == null || result[field] === '') result[field] = supplement?.[field] ?? result[field];
    });
    return result;
}

function findHgnc(indexes, symbol) {
    return getUnique(indexes.hgncBySymbol, symbol, (row) => row.hgnc_id)
        || getUnique(indexes.hgncByPrevious, symbol, (row) => row.hgnc_id)
        || getUnique(indexes.hgncByAlias, symbol, (row) => row.hgnc_id)
        || null;
}

function findNcbiForHgnc(indexes, hgnc) {
    if (!hgnc) return null;
    const geneId = cleanText(hgnc.entrez_id);
    if (geneId && indexes.ncbiByGeneId.has(geneId)) return indexes.ncbiByGeneId.get(geneId);
    const ensembl = normalizeEnsembl(hgnc.ensembl_gene_id);
    if (ensembl && indexes.ncbiByEnsembl.has(ensembl)) return indexes.ncbiByEnsembl.get(ensembl);
    return getUnique(indexes.ncbiBySymbol, hgnc.symbol, (row) => row.GeneID);
}

function findGff(gffIndexes, ncbi, symbol) {
    const geneId = cleanText(ncbi?.GeneID);
    if (geneId && gffIndexes.byGeneId.has(geneId)) return gffIndexes.byGeneId.get(geneId);
    return getUnique(gffIndexes.bySymbol, symbol, (row) => `${row.chromosome}:${row.beginPos}:${row.endPos}`);
}

async function fetchEnsemblFallback(symbol) {
    const url = `${ENSEMBL_GRCH37_BASE}/lookup/symbol/homo_sapiens/${encodeURIComponent(symbol)}?expand=0`;
    try {
        const payload = await fetchJson(url);
        if (payload?.object_type !== 'Gene' || payload?.assembly_name !== 'GRCh37') return null;
        return {
            chromosome: cleanText(payload.seq_region_name),
            begin_pos: Number(payload.start) || null,
            end_pos: Number(payload.end) || null,
            symbol: cleanText(payload.display_name, symbol),
            gene_name: cleanText(payload.description).replace(/\s*\[Source:.*$/i, ''),
            gene_id: '',
            gene_type: normalizeGeneType(payload.biotype),
            synonyms: '',
            hgnc: '',
            ensembl: normalizeEnsembl(payload.id) || null,
            description: cleanText(payload.description).replace(/\s*\[Source:.*$/i, ''),
        };
    } catch {
        return null;
    }
}

function isCoreComplete(row) {
    return Boolean(
        row.chromosome
        && row.begin_pos != null
        && row.end_pos != null
        && row.symbol
        && row.gene_name
        && row.gene_id
        && row.gene_type
        && row.hgnc
        && row.ensembl
        && row.description,
    );
}

function createSummary(rows, expectedCount) {
    const missingColumns = {};
    [
        'chromosome',
        'begin_pos',
        'end_pos',
        'symbol',
        'gene_name',
        'gene_id',
        'gene_type',
        'synonyms',
        'hgnc',
        'ensembl',
        'description',
    ].forEach((column) => {
        missingColumns[column] = rows.filter((row) => row[column] == null || row[column] === '').length;
    });

    const statusCounts = {};
    const sourceCounts = {};
    const ensemblCounts = new Map();
    rows.forEach((row) => {
        statusCounts[row.mapping_status] = (statusCounts[row.mapping_status] || 0) + 1;
        sourceCounts[row.annotation_source] = (sourceCounts[row.annotation_source] || 0) + 1;
        if (row.ensembl) ensemblCounts.set(row.ensembl, (ensemblCounts.get(row.ensembl) || 0) + 1);
    });

    return {
        expectedCount,
        rowCount: rows.length,
        coreComplete: rows.filter(isCoreComplete).length,
        missingColumns,
        statusCounts,
        sourceCounts,
        duplicateEnsembl: [...ensemblCounts.entries()]
            .filter(([, count]) => count > 1)
            .map(([ensembl, count]) => ({ ensembl, count })),
        unresolved: rows.filter((row) => row.mapping_status === 'unresolved')
            .map((row) => row.perturb_symbol),
    };
}

function writeArtifacts(cacheDir, rows, summary) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(cacheDir, `perturb_gene_catalog_${stamp}.json`);
    const tsvPath = path.join(cacheDir, `perturb_gene_catalog_${stamp}.tsv`);
    const summaryPath = path.join(cacheDir, `perturb_gene_catalog_${stamp}.summary.json`);
    const columns = [
        'perturb_symbol',
        'chromosome',
        'begin_pos',
        'end_pos',
        'symbol',
        'gene_name',
        'gene_id',
        'gene_type',
        'synonyms',
        'hgnc',
        'ensembl',
        'description',
        'perturb_tested',
        'tested_program_count',
        'mapping_status',
        'annotation_source',
    ];
    const escapeTsv = (value) => String(value ?? '').replace(/[\t\r\n]+/g, ' ');

    fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    fs.writeFileSync(tsvPath, [
        columns.join('\t'),
        ...rows.map((row) => columns.map((column) => escapeTsv(row[column])).join('\t')),
    ].join('\n') + '\n');

    return { jsonPath, tsvPath, summaryPath };
}

function createPool() {
    return mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 2,
        dateStrings: true,
    });
}

async function applyCatalog(pool, rows) {
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const nextTable = `gene_info_hg37_matched_next_${stamp}`;
    const backupTable = `gene_info_hg37_matched_backup_${stamp}`;

    await pool.query(`
        CREATE TABLE \`${nextTable}\` (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            perturb_symbol VARCHAR(100) NOT NULL,
            chromosome VARCHAR(50) DEFAULT NULL,
            begin_pos BIGINT DEFAULT NULL,
            end_pos BIGINT DEFAULT NULL,
            symbol VARCHAR(100) DEFAULT NULL,
            gene_name VARCHAR(255) DEFAULT NULL,
            gene_id VARCHAR(50) DEFAULT NULL,
            gene_type VARCHAR(100) DEFAULT NULL,
            synonyms TEXT DEFAULT NULL,
            hgnc VARCHAR(50) DEFAULT NULL,
            ensembl VARCHAR(30) DEFAULT NULL,
            description TEXT DEFAULT NULL,
            perturb_tested BOOLEAN NOT NULL DEFAULT TRUE,
            tested_program_count INT UNSIGNED NOT NULL DEFAULT 0,
            mapping_status VARCHAR(50) NOT NULL,
            annotation_source VARCHAR(255) NOT NULL,
            imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_gih37m_perturb_symbol (perturb_symbol),
            INDEX idx_gih37m_symbol (symbol),
            INDEX idx_gih37m_ensembl (ensembl),
            INDEX idx_gih37m_gene_id (gene_id),
            INDEX idx_gih37m_gene_type (gene_type),
            INDEX idx_gih37m_hgnc (hgnc),
            INDEX idx_gih37m_chromosome (chromosome)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const columns = [
        'perturb_symbol',
        'chromosome',
        'begin_pos',
        'end_pos',
        'symbol',
        'gene_name',
        'gene_id',
        'gene_type',
        'synonyms',
        'hgnc',
        'ensembl',
        'description',
        'perturb_tested',
        'tested_program_count',
        'mapping_status',
        'annotation_source',
    ];

    for (let offset = 0; offset < rows.length; offset += 500) {
        const chunk = rows.slice(offset, offset + 500);
        const values = chunk.map((row) => columns.map((column) => row[column] ?? null));
        await pool.query(
            `INSERT INTO \`${nextTable}\` (${columns.join(', ')}) VALUES ?`,
            [values],
        );
    }

    const [[validation]] = await pool.query(
        `SELECT
            COUNT(*) AS total,
            COUNT(DISTINCT perturb_symbol) AS unique_symbols,
            SUM(perturb_tested = 1) AS tested
         FROM \`${nextTable}\``,
    );
    if (
        Number(validation.total) !== rows.length
        || Number(validation.unique_symbols) !== rows.length
        || Number(validation.tested) !== rows.length
    ) {
        await pool.query(`DROP TABLE \`${nextTable}\``);
        throw new Error(`Staging table validation failed: ${JSON.stringify(validation)}`);
    }

    await pool.query(
        `RENAME TABLE
            gene_info_hg37_matched TO \`${backupTable}\`,
            \`${nextTable}\` TO gene_info_hg37_matched`,
    );

    return { backupTable };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    fs.mkdirSync(args.cacheDir, { recursive: true });

    const files = {
        ncbiGeneInfo: path.join(args.cacheDir, 'Homo_sapiens.gene_info.gz'),
        ncbiGff: path.join(args.cacheDir, 'GCF_000001405.25_GRCh37.p13_genomic.gff.gz'),
        assemblyReport: path.join(args.cacheDir, 'GCF_000001405.25_GRCh37.p13_assembly_report.txt'),
        hgnc: path.join(args.cacheDir, 'hgnc_complete_set.txt'),
    };

    console.log('Downloading official annotation sources when not cached...');
    await Promise.all([
        downloadFile(NCBI_GENE_INFO_URL, files.ncbiGeneInfo),
        downloadFile(NCBI_GFF_URL, files.ncbiGff),
        downloadFile(NCBI_ASSEMBLY_REPORT_URL, files.assemblyReport),
        downloadFile(HGNC_URL, files.hgnc),
    ]);

    console.log('Loading Perturb-seq and annotation sources...');
    const pool = createPool();
    try {
        const [
            perturb,
            localRows,
            ncbiRows,
            hgncRows,
            accessionMap,
            [currentRows],
            [edgeRows],
        ] = await Promise.all([
            loadPerturbGenes(config.paths.regulationDataDir),
            loadLocalGeneInfo(args.geneInfoPath),
            loadNcbiGeneInfo(files.ncbiGeneInfo),
            loadHgnc(files.hgnc),
            loadAssemblyAccessions(files.assemblyReport),
            pool.query('SELECT * FROM gene_info_hg37_matched'),
            pool.query(`
                SELECT gene_symbol, ensg_id
                FROM gene_program_trait_edge
                WHERE gene_symbol IS NOT NULL AND gene_symbol <> ''
                    AND ensg_id IS NOT NULL AND ensg_id <> ''
                GROUP BY gene_symbol, ensg_id
            `),
        ]);
        const gffIndexes = await loadNcbiGff(files.ncbiGff, accessionMap);
        const indexes = createIndexes({
            localRows,
            currentRows,
            ncbiRows,
            hgncRows,
            edgeRows,
        });

        const catalogRows = [];
        for (const perturbSymbol of perturb.genes) {
            const testedProgramCount = perturb.testedPrograms.get(perturbSymbol) || 0;
            const symbolKey = normalizeSymbol(perturbSymbol);
            const authoritySymbol = CURATED_SYMBOL_OVERRIDES.get(perturbSymbol) || perturbSymbol;
            const localExact = getUnique(indexes.localBySymbol, perturbSymbol, (row) => normalizeEnsembl(row.Ensembl));
            const currentExact = getUnique(indexes.currentBySymbol, perturbSymbol, (row) => normalizeEnsembl(row.ensembl));
            const ncbiExact = getUnique(indexes.ncbiBySymbol, authoritySymbol, (row) => row.GeneID);
            const edgeEnsembl = indexes.edgeBySymbol.get(symbolKey) || '';
            const hgnc = findHgnc(indexes, authoritySymbol);

            let row = null;
            if (localExact) {
                row = localToCatalog(localExact, perturbSymbol, testedProgramCount, 'exact_symbol', 'GeneInfo_hg37');
            } else if (currentExact) {
                row = localToCatalog(currentExact, perturbSymbol, testedProgramCount, 'exact_symbol', 'existing_gene_info');
            } else if (edgeEnsembl && indexes.localByEnsembl.has(edgeEnsembl)) {
                row = localToCatalog(
                    indexes.localByEnsembl.get(edgeEnsembl),
                    perturbSymbol,
                    testedProgramCount,
                    'edge_ensembl',
                    'gene_program_trait_edge+GeneInfo_hg37',
                );
            } else if (edgeEnsembl && indexes.currentByEnsembl.has(edgeEnsembl)) {
                row = localToCatalog(
                    indexes.currentByEnsembl.get(edgeEnsembl),
                    perturbSymbol,
                    testedProgramCount,
                    'edge_ensembl',
                    'gene_program_trait_edge+existing_gene_info',
                );
            }

            let ncbi = ncbiExact;
            if (!ncbi && edgeEnsembl) ncbi = indexes.ncbiByEnsembl.get(edgeEnsembl) || null;
            if (!ncbi) ncbi = findNcbiForHgnc(indexes, hgnc);
            if (!ncbi && hgnc) {
                const aliasCandidate = getUnique(indexes.ncbiByAlias, perturbSymbol, (item) => item.GeneID);
                const hgncGeneId = cleanText(hgnc.entrez_id);
                if (aliasCandidate && aliasCandidate.GeneID === hgncGeneId) ncbi = aliasCandidate;
            }

            const canonicalSymbol = cleanText(ncbi?.Symbol, cleanText(hgnc?.symbol, perturbSymbol));
            const gff = findGff(gffIndexes, ncbi, canonicalSymbol);
            const ncbiCatalog = ncbiToCatalog({
                ncbi,
                hgnc,
                gff,
                perturbSymbol,
                testedProgramCount,
                mappingStatus: CURATED_SYMBOL_OVERRIDES.has(perturbSymbol)
                    ? 'curated_symbol_override'
                    : (ncbiExact ? 'exact_symbol' : (hgnc ? 'authority_mapping' : 'ncbi_mapping')),
                annotationSource: CURATED_SYMBOL_OVERRIDES.has(perturbSymbol)
                    ? 'curated_symbol_override+NCBI_GRCh37+NCBI_Gene+HGNC'
                    : 'NCBI_GRCh37+NCBI_Gene+HGNC',
                ensemblOverride: edgeEnsembl,
            });

            if (row) {
                row = mergeCatalogRows(row, ncbiCatalog);
            } else if (ncbi || hgnc || gff) {
                row = ncbiCatalog;
            }

            if (!row || !isCoreComplete(row)) {
                const ensemblFallback = await fetchEnsemblFallback(perturbSymbol);
                if (ensemblFallback) {
                    let fallbackRow = {
                        ...ensemblFallback,
                        perturb_symbol: perturbSymbol,
                        perturb_tested: 1,
                        tested_program_count: testedProgramCount,
                        mapping_status: row?.mapping_status || 'ensembl_grch37_fallback',
                        annotation_source: row
                            ? `${row.annotation_source}+Ensembl_GRCh37`
                            : 'Ensembl_GRCh37',
                    };
                    const fallbackEnsembl = normalizeEnsembl(ensemblFallback.ensembl);
                    const fallbackNcbi = indexes.ncbiByEnsembl.get(fallbackEnsembl) || null;
                    const fallbackHgnc = indexes.hgncByEnsembl.get(fallbackEnsembl) || null;
                    if (fallbackNcbi || fallbackHgnc) {
                        const fallbackGff = findGff(
                            gffIndexes,
                            fallbackNcbi,
                            fallbackNcbi?.Symbol || fallbackHgnc?.symbol || perturbSymbol,
                        );
                        const authorityRow = ncbiToCatalog({
                            ncbi: fallbackNcbi,
                            hgnc: fallbackHgnc,
                            gff: fallbackGff,
                            perturbSymbol,
                            testedProgramCount,
                            mappingStatus: fallbackRow.mapping_status,
                            annotationSource: 'NCBI_GRCh37+NCBI_Gene+HGNC+Ensembl_GRCh37',
                            ensemblOverride: fallbackEnsembl,
                        });
                        fallbackRow = mergeCatalogRows(fallbackRow, authorityRow);
                        fallbackRow.annotation_source = authorityRow.annotation_source;
                    }
                    row = row ? mergeCatalogRows(row, fallbackRow) : fallbackRow;
                }
            }

            if (!row) {
                row = {
                    perturb_symbol: perturbSymbol,
                    chromosome: '',
                    begin_pos: null,
                    end_pos: null,
                    symbol: perturbSymbol,
                    gene_name: '',
                    gene_id: '',
                    gene_type: '',
                    synonyms: '',
                    hgnc: '',
                    ensembl: null,
                    description: '',
                    perturb_tested: 1,
                    tested_program_count: testedProgramCount,
                    mapping_status: 'unresolved',
                    annotation_source: 'Perturb-seq',
                };
            } else if (!isCoreComplete(row)) {
                row.mapping_status = row.mapping_status === 'unresolved'
                    ? row.mapping_status
                    : `${row.mapping_status}_partial`;
            }

            catalogRows.push(row);
        }

        const summary = createSummary(catalogRows, perturb.genes.length);
        const artifacts = writeArtifacts(args.cacheDir, catalogRows, summary);
        console.log(JSON.stringify({ summary, artifacts }, null, 2));

        if (summary.rowCount !== perturb.genes.length) {
            throw new Error('Catalog row count does not match the Perturb-seq gene count');
        }

        if (args.apply) {
            const result = await applyCatalog(pool, catalogRows);
            console.log(JSON.stringify({ applied: true, ...result }, null, 2));
        } else {
            console.log('Dry run complete. Re-run with --apply after reviewing the summary.');
        }
    } finally {
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Perturb gene catalog import failed:', err.stack || err.message);
    process.exit(1);
});
