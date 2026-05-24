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

const paths = {
    dataDir: process.env.DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs',
    programDataDir: process.env.PROGRAM_DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/run_all/outputs/figures/cnmf/tables/program_regulator',
    regulationDataDir: process.env.REGULATION_DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/run_all/outputs/perturbseq/cnmf_genomewide/cNMF_regulation/K562GW',
    gwasManhattanDataDir: process.env.GWAS_MANHATTAN_DATA_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/gwas_manhattan/tables',
    burdenVolcanoDir: process.env.BURDEN_VOLCANO_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/burden_volcano/tables',
    posteriorVolcanoDir: process.env.POSTERIOR_VOLCANO_DIR || '/gpfs/chencao/qinminzhang/workflow/catalog_lof/figure_all/outputs/posterior_volcano/tables',
};

const config = {
    env: process.env.NODE_ENV || 'development',
    server: {
        host: process.env.HOST || process.env.BACKEND_HOST || '127.0.0.1',
        port: parseInteger(process.env.PORT || process.env.BACKEND_PORT, 4000, { min: 1, max: 65535 }),
        corsOrigin: process.env.CORS_ORIGIN || '*',
        jsonLimit: process.env.JSON_BODY_LIMIT || '1mb',
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
        maxTsvFileBytes: parseBytes(process.env.DATA_MAX_TSV_FILE_BYTES, 100 * 1024 ** 2),
        maxTsvRows: parseInteger(process.env.DATA_MAX_TSV_ROWS, 200000, { min: 1000 }),
        maxManhattanFileBytes: parseBytes(process.env.MANHATTAN_MAX_FILE_BYTES, 200 * 1024 ** 2),
        maxManhattanRows: parseInteger(process.env.MANHATTAN_MAX_ROWS, 500000, { min: 1000 }),
    },
};

module.exports = {
    config,
    parseBoolean,
    parseBytes,
    parseInteger,
};
