const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "petopia_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 20,                  // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("✅ PostgreSQL connected");
  }
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err.message);
});

/**
 * Helper query wrapper dengan error handling
 * @param {string} text  - SQL query
 * @param {Array}  params - Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Transaction helper
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, withTransaction };
