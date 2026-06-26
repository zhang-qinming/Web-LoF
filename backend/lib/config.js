const path = require('path');

function parseInteger(value, fallback, { min = null, max = null } = {}) {
    const parsed = Number.parseInt(value, 10);
    let result = Number.isFinite(parsed) ? parsed : fallback;

    if (min != null) result = Math.max(min, result);
    if (max != null) result = Math.min(max, result);

    return result;
}

function parseBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseBytes(value, fallback) {
    if (value == null || value === '') return fallback;

    const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
    if (!match) return fallback;

    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) return fallback;

    const unit = (match[2] || 'b').toLowerCase();
    const multiplier = {
        b: 1,
        kb: 1024,
        mb: 1024 ** 2,
        gb: 1024 ** 3,
    }[unit];

    return Math.floor(amount * multiplier);
}

function parseStringList(value, fallback = []) {
    if (value == null || value === '') return fallback;
    const items = String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return items.length ? [...new Set(items)] : fallback;
}

const dataDir = process.env.DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs';
const dataArchiveDir = process.env.DATA_ARCHIVE_DIR || path.join(path.dirname(dataDir), `${path.basename(dataDir)}_archives`);
const crossTraitHeatmapDir = process.env.CROSS_TRAIT_HEATMAP_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/cross_trait_heatmap';
const crossTraitPrecomputedDir = process.env.CROSS_TRAIT_PRECOMPUTED_DIR || path.join(crossTraitHeatmapDir, 'precomputed', 'current');

const paths = {
    dataDir,
    dataArchiveDir,
    programDataDir: process.env.PROGRAM_DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/run_all/outputs/figures/cnmf/tables/program_regulator',
    traitProgramGenePanelDir: process.env.TRAIT_PROGRAM_GENE_PANEL_DIR || path.join(dataDir, 'trait_program_gene_model_5program_3regulator', 'tables'),
    regulationDataDir: process.env.REGULATION_DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/run_all/outputs/perturbseq/cnmf_genomewide/cNMF_regulation/K562GW',
    gwasManhattanDataDir: process.env.GWAS_MANHATTAN_DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/gwas_manhattan/tables',
    ldscDir: process.env.LDSC_DIR || process.env.HERITABILITY_DIR || path.join(dataDir, 'ldsc'),
    burdenVolcanoDir: process.env.BURDEN_VOLCANO_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/burden_volcano/tables',
    posteriorVolcanoDir: process.env.POSTERIOR_VOLCANO_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/posterior_volcano/tables',
    crossTraitHeatmapDir,
    traitEffectNeighborsFile: process.env.TRAIT_EFFECT_NEIGHBORS_FILE || path.join(crossTraitHeatmapDir, 'trait_effect_neighbors.json'),
    crossTraitPrecomputedDir,
};

const config = {
    env: process.env.NODE_ENV || 'development',
    server: {
        host: process.env.HOST || process.env.BACKEND_HOST || '127.0.0.1',
        port: parseInteger(process.env.PORT || process.env.BACKEND_PORT, 4000, { min: 1, max: 65535 }),
        corsOrigin: process.env.CORS_ORIGIN || '*',
        jsonLimit: process.env.JSON_BODY_LIMIT || '1mb',
        compressionThreshold: parseBytes(process.env.COMPRESSION_THRESHOLD, 1024),
        logRequestMetrics: parseBoolean(process.env.LOG_REQUEST_METRICS, true),
    },
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInteger(process.env.DB_PORT, 3306, { min: 1, max: 65535 }),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || undefined,
        database: process.env.DB_NAME || 'gwas',
        connectionLimit: parseInteger(process.env.DB_POOL_SIZE, 10, { min: 1, max: 100 }),
        queueLimit: parseInteger(process.env.DB_QUEUE_LIMIT, 0, { min: 0 }),
        connectTimeout: parseInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10000, { min: 1000 }),
    },
    query: {
        defaultPageLimit: parseInteger(process.env.DEFAULT_PAGE_LIMIT, 50, { min: 1, max: 5000 }),
        maxPageLimit: parseInteger(process.env.MAX_PAGE_LIMIT, 1000, { min: 1, max: 10000 }),
        maxGwasPageLimit: parseInteger(process.env.MAX_GWAS_PAGE_LIMIT, 5000, { min: 1, max: 50000 }),
        maxUnpagedGwasRows: parseInteger(process.env.MAX_UNPAGED_GWAS_ROWS, 200000, { min: 1000 }),
        maxChrFilterValues: parseInteger(process.env.MAX_CHR_FILTER_VALUES, 30, { min: 1, max: 200 }),
        maxRsIdLength: parseInteger(process.env.MAX_RSID_LENGTH, 100, { min: 10, max: 500 }),
    },
    paths,
    data: {
        searchIndexTtlMs: parseInteger(process.env.DATA_SEARCH_INDEX_TTL_MS, 120000, { min: 1000 }),
        allowSearchRefresh: parseBoolean(process.env.DATA_ALLOW_SEARCH_REFRESH, false),
        maxSearchQueryLength: parseInteger(process.env.DATA_MAX_SEARCH_QUERY_LENGTH, 120, { min: 2, max: 500 }),
        maxBatchDownloadItems: parseInteger(process.env.DATA_MAX_BATCH_DOWNLOAD_ITEMS, 100, { min: 1, max: 1000 }),
        maxDownloadFileBytes: parseBytes(process.env.DATA_MAX_DOWNLOAD_FILE_BYTES, 1024 ** 3),
        maxArchiveEntries: parseInteger(process.env.DATA_MAX_ARCHIVE_ENTRIES, 5000, { min: 1 }),
        maxArchiveBytes: parseBytes(process.env.DATA_MAX_ARCHIVE_BYTES, 2 * 1024 ** 3),
        archiveCompressionLevel: parseInteger(process.env.DATA_ARCHIVE_COMPRESSION_LEVEL, 9, { min: 0, max: 9 }),
        dbExportTables: parseStringList(process.env.DATA_EXPORT_DB_TABLES, [
            'file_id_mapping',
            'file_metadata',
            'gwas_meta',
            'lof_meta',
            'trait_ldsc',
            'program_info',
            'trait_program_edge',
            'gene_program_trait_edge',
            'gene_info_hg37_matched',
            'gene_summary',
        ]),
        maxTsvFileBytes: parseBytes(process.env.DATA_MAX_TSV_FILE_BYTES, 100 * 1024 ** 2),
        maxTsvRows: parseInteger(process.env.DATA_MAX_TSV_ROWS, 200000, { min: 1000 }),
        maxManhattanFileBytes: parseBytes(process.env.MANHATTAN_MAX_FILE_BYTES, 200 * 1024 ** 2),
        defaultManhattanMaxPoints: parseInteger(process.env.MANHATTAN_DEFAULT_MAX_POINTS, 30000, { min: 1000, max: 100000 }),
        maxManhattanMaxPoints: parseInteger(process.env.MANHATTAN_MAX_POINTS, 100000, { min: 1000, max: 250000 }),
        manhattanCacheMaxBytes: parseBytes(process.env.MANHATTAN_CACHE_MAX_BYTES, 64 * 1024 ** 2),
        manhattanCacheMaxEntries: parseInteger(process.env.MANHATTAN_CACHE_MAX_ENTRIES, 16, { min: 1, max: 100 }),
        precomputedChartJsonEnabled: parseBoolean(process.env.PRECOMPUTED_CHART_JSON_ENABLED, true),
        precomputedChartJsonSubdir: process.env.PRECOMPUTED_CHART_JSON_SUBDIR || 'json_precomputed',
        precomputedChartJsonStatTtlMs: parseInteger(process.env.PRECOMPUTED_CHART_JSON_STAT_TTL_MS, 60000, { min: 1000 }),
        maxCrossTraitPrecomputedFileBytes: parseBytes(process.env.CROSS_TRAIT_PRECOMPUTED_MAX_FILE_BYTES, 16 * 1024 ** 2),
        crossTraitPrecomputedCacheMaxEntries: parseInteger(process.env.CROSS_TRAIT_PRECOMPUTED_CACHE_MAX_ENTRIES, 128, { min: 1, max: 1000 }),
    },
};

module.exports = {
    config,
    parseBoolean,
    parseBytes,
    parseInteger,
    parseStringList,
};
