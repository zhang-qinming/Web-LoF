const mysql = require('mysql2/promise');

async function createDatabase() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT, 10) || 33306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        waitForConnections: true,
        connectionLimit: 1,
    });

    try {
        await pool.query('CREATE DATABASE IF NOT EXISTS gwas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        console.log('Database "gwas" created or already exists.');
    } catch (err) {
        console.error('Failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

createDatabase();
