/**
 * Jalankan SEKALI untuk menambah kolom alamat tersimpan ke tabel users:
 *   node migrate_add_address.js
 *
 * Letakkan file ini di petopia-backend/config/ lalu jalankan dari folder config/:
 *   cd petopia-backend/config && node migrate_add_address.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "petopia_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Tambah kolom alamat tersimpan ke tabel users (skip jika sudah ada)
    const cols = [
      ["address",     "TEXT"],
      ["city",        "VARCHAR(100)"],
      ["postal_code", "VARCHAR(10)"],
    ];
    for (const [col, def] of cols) {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col} ${def};
      `);
    }
    console.log("✅ Kolom address, city, postal_code ditambahkan ke users");

    await client.query("COMMIT");
    console.log("\n🎉 Migrasi alamat selesai!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Gagal:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
