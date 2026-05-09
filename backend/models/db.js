const mysql = require('mysql2/promise');

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'gwas',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 10,
    queueLimit: 0,
};

if (process.env.DB_PASSWORD) config.password = process.env.DB_PASSWORD;

const pool = mysql.createPool(config);

module.exports = pool;

