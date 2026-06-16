require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const { config } = require('./lib/config');
const { requestAbortSignal, requestMetrics, sendError } = require('./lib/http');
const browse = require('./routes/Rbrowse');
const trait = require('./routes/Rtrait');
const program = require('./routes/Rprogram');
const regulation = require('./routes/Rregulation');
const gene = require('./routes/Rgene');
const dataRoute = require('./routes/Rdata');
const crossTrait = require('./routes/RcrossTrait');
const geneProgramModel = require('./models/MgeneProgram');

const app = express();

app.use(requestAbortSignal);
app.use(requestMetrics);
app.use(compression({ threshold: config.server.compressionThreshold }));
app.use(cors({
    origin: config.server.corsOrigin === '*' ? true : config.server.corsOrigin,
    exposedHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
}));
app.use(express.json({ limit: config.server.jsonLimit }));
app.use(express.urlencoded({ extended: false, limit: config.server.jsonLimit }));

app.use(browse);
app.use(trait);
app.use(program);
app.use(regulation);
app.use(gene);
app.use(dataRoute);
app.use(crossTrait);

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    return sendError(res, err);
});

const { host, port } = config.server;
app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
    geneProgramModel.warmGeneSummaryCache();
});
