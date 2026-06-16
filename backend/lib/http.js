const { config } = require('./config');

function getErrorMessage(err) {
    if (config.env === 'production' && (!err || !err.expose)) {
        return 'Internal server error';
    }
    return err?.message || 'Internal server error';
}

function sendError(res, err, fallbackStatus = 500) {
    if (isRequestAbortError(err) || res.destroyed) return;
    const status = err?.status || err?.statusCode || fallbackStatus;
    res.status(status).json({ error: getErrorMessage(err) });
}

function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

function chunkByteLength(chunk, encoding) {
    if (chunk == null) return 0;
    if (Buffer.isBuffer(chunk)) return chunk.length;
    if (ArrayBuffer.isView(chunk)) return chunk.byteLength;
    return Buffer.byteLength(String(chunk), encoding || 'utf8');
}

function createRequestAbortError() {
    const err = new Error('Request aborted');
    err.name = 'AbortError';
    err.code = 'REQUEST_ABORTED';
    err.status = 499;
    err.expose = false;
    err.isRequestAbort = true;
    return err;
}

function isRequestAbortError(err) {
    return Boolean(
        err
        && (
            err.isRequestAbort
            || err.name === 'AbortError'
            || err.code === 'REQUEST_ABORTED'
            || err.code === 'ABORT_ERR'
        )
    );
}

function throwIfAborted(signal) {
    if (signal?.aborted) throw createRequestAbortError();
}

function requestAbortSignal(req, res, next) {
    const controller = new AbortController();
    const abort = () => {
        req.requestAborted = true;
        if (!controller.signal.aborted) controller.abort(createRequestAbortError());
    };

    req.on('aborted', abort);
    res.on('close', () => {
        if (!res.writableEnded) abort();
    });

    req.abortSignal = controller.signal;
    req.throwIfAborted = () => throwIfAborted(controller.signal);
    return next();
}

function requestMetrics(req, res, next) {
    if (!config.server.logRequestMetrics) return next();

    const startedAt = process.hrtime.bigint();
    let responseBytes = 0;
    let logged = false;
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function writeWithMetrics(chunk, encoding, callback) {
        responseBytes += chunkByteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
        return Reflect.apply(originalWrite, this, [chunk, encoding, callback]);
    };
    res.end = function endWithMetrics(chunk, encoding, callback) {
        responseBytes += chunkByteLength(chunk, typeof encoding === 'string' ? encoding : undefined);
        return Reflect.apply(originalEnd, this, [chunk, encoding, callback]);
    };

    const logMetrics = (aborted = false) => {
        if (logged) return;
        logged = true;
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        console.log(JSON.stringify({
            type: 'http_request',
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(1)),
            responseBytes,
            contentEncoding: res.getHeader('Content-Encoding') || null,
            aborted: Boolean(aborted || req.aborted || req.requestAborted || req.abortSignal?.aborted),
        }));
    };

    res.on('finish', () => logMetrics(false));
    res.on('close', () => logMetrics(!res.writableEnded));

    return next();
}

module.exports = {
    asyncRoute,
    createRequestAbortError,
    isRequestAbortError,
    requestMetrics,
    requestAbortSignal,
    sendError,
    throwIfAborted,
};
