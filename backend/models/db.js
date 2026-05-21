const mysql = require('mysql2/promise');
const { config: appConfig } = require('../lib/config');

const config = {
    host: appConfig.db.host,
    port: appConfig.db.port,
    user: appConfig.db.user,
    database: appConfig.db.database,
    waitForConnections: true,
    connectionLimit: appConfig.db.connectionLimit,
    queueLimit: appConfig.db.queueLimit,
    connectTimeout: appConfig.db.connectTimeout,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
};

if (appConfig.db.password) config.password = appConfig.db.password;

const pool = mysql.createPool(config);

module.exports = pool;

