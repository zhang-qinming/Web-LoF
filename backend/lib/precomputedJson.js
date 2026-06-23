const path = require('path');
const { config } = require('./config');

const READY_FILE_NAME = '_api_v2.ready';
const readyCache = new Map();
const resolutionCache = new Map();

function getAcceptedEncoding(req) {
    if (typeof req.acceptsEncodings !== 'function') return false;
    const encoding = req.acceptsEncodings('br', 'gzip');
    return encoding === 'br' || encoding === 'gzip' ? encoding : null;
}

async function getStoreFileStat(store, relativeName) {
    const fullPath = store.resolve(relativeName);
    if (!fullPath) return null;
    const stat = await store.stat(fullPath);
    return stat?.isFile ? { fullPath, stat } : null;
}

async function hasReadyMarker(store) {
    const cacheKey = store.rootPath;
    const cached = readyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const readyFileName = path.join(
        config.data.precomputedChartJsonSubdir,
        READY_FILE_NAME,
    );
    const value = Boolean(await getStoreFileStat(store, readyFileName));
    readyCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + config.data.precomputedChartJsonStatTtlMs,
    });
    return value;
}

async function resolvePrecomputedJson(store, sourceFileName, freshnessFileNames, encoding) {
    const cacheKey = JSON.stringify([
        store.rootPath,
        sourceFileName,
        freshnessFileNames,
        encoding,
    ]);
    const cached = resolutionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const sourceBaseName = path.basename(sourceFileName, path.extname(sourceFileName));
    const compressedFileName = path.join(
        config.data.precomputedChartJsonSubdir,
        `${sourceBaseName}.json.${encoding === 'br' ? 'br' : 'gz'}`,
    );
    const [ready, source, compressed, ...dependencies] = await Promise.all([
        hasReadyMarker(store),
        getStoreFileStat(store, sourceFileName),
        getStoreFileStat(store, compressedFileName),
        ...freshnessFileNames.map((fileName) => getStoreFileStat(store, fileName)),
    ]);

    let value = null;
    if (
        ready
        && source
        && compressed
        && compressed.stat.size > 0
        && dependencies.every(Boolean)
    ) {
        const newestSourceMtime = Math.max(
            source.stat.mtimeMs || 0,
            ...dependencies.map((dependency) => dependency.stat.mtimeMs || 0),
        );
        if ((compressed.stat.mtimeMs || 0) >= newestSourceMtime) {
            value = compressed;
        }
    }

    resolutionCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + config.data.precomputedChartJsonStatTtlMs,
    });
    return value;
}

async function trySendPrecomputedJson(req, res, {
    store,
    sourceFileName,
    freshnessFileNames = [],
}) {
    const encoding = getAcceptedEncoding(req);
    if (!config.data.precomputedChartJsonEnabled || !encoding) {
        return false;
    }

    const compressed = await resolvePrecomputedJson(
        store,
        sourceFileName,
        freshnessFileNames,
        encoding,
    );
    if (!compressed) return false;

    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Length', compressed.stat.size);
    if (compressed.stat.mtimeMs) {
        res.setHeader('Last-Modified', new Date(compressed.stat.mtimeMs).toUTCString());
    }
    res.vary('Accept-Encoding');

    const stream = await store.createReadStream(compressed.fullPath);
    const abort = () => stream.destroy();
    req.abortSignal?.addEventListener('abort', abort, { once: true });
    stream.on('close', () => {
        req.abortSignal?.removeEventListener('abort', abort);
    });
    stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else if (!res.destroyed) res.destroy();
    });
    stream.pipe(res);
    return true;
}

module.exports = {
    getAcceptedEncoding,
    trySendPrecomputedJson,
};
