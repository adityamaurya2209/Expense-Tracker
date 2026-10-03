/* =====================================================
   DATABASE (TiDB Cloud / MySQL)
===================================================== */

const mysql = require("mysql2/promise");


function buildPool() {

    const url = process.env.DATABASE_URL;

    if (!url) {
        throw new Error(
            "DATABASE_URL is not set. See .env.example."
        );
    }

    // TiDB Cloud Serverless requires TLS. Set DB_SSL=false
    // only when pointing at a plain local MySQL server.
    const useSsl =
        process.env.DB_SSL !== "false";

    return mysql.createPool({
        uri: url,
        ssl: useSsl
            ? {
                minVersion: "TLSv1.2",
                rejectUnauthorized: true
            }
            : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true,
        decimalNumbers: true
    });

}


const pool = buildPool();


async function initSchema() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
            user_id BIGINT NOT NULL,
            id BIGINT NOT NULL,
            type VARCHAR(10) NOT NULL,
            amount DECIMAL(14, 2) NOT NULL,
            category VARCHAR(100) NOT NULL,
            date DATE NOT NULL,
            description VARCHAR(500) NOT NULL DEFAULT '',
            PRIMARY KEY (user_id, id),
            KEY idx_user_date (user_id, date)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id BIGINT PRIMARY KEY,
            monthly_budget DECIMAL(14, 2) NOT NULL DEFAULT 0,
            savings_goal DECIMAL(14, 2) NOT NULL DEFAULT 0,
            custom_categories JSON
        )
    `);

}


module.exports = {
    pool,
    initSchema
};
