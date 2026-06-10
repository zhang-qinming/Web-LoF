require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const { config } = require('../lib/config');
const { refreshGeneSummary } = require('./lib/geneSummary');

async function main() {
    const pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 1,
    });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await refreshGeneSummary(connection);
        await connection.commit();

        const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM gene_summary');
        console.log(`Refreshed gene_summary with ${count} rows.`);
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Failed to refresh gene_summary:', err.message);
    process.exit(1);
});
