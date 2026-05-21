const { config } = require('./config');

function getErrorMessage(err) {
    if (config.env === 'production' && (!err || !err.expose)) {
        return 'Internal server error';
    }
    return err?.message || 'Internal server error';
}

function sendError(res, err, fallbackStatus = 500) {
    const status = err?.status || err?.statusCode || fallbackStatus;
    res.status(status).json({ error: getErrorMessage(err) });
}

function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = {
    asyncRoute,
    sendError,
};
