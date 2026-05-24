require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { config } = require('./lib/config');
const { sendError } = require('./lib/http');
const browse = require('./routes/Rbrowse');
const trait = require('./routes/Rtrait');
const program = require('./routes/Rprogram');
const regulation = require('./routes/Rregulation');
const dataRoute = require('./routes/Rdata');

const app = express();

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
app.use(dataRoute);

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    return sendError(res, err);
});

const { host, port } = config.server;
app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
});
