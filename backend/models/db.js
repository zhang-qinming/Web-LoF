const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'Admin',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'gwas',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 10,
    queueLimit: 0,
});

module.exports = pool;

