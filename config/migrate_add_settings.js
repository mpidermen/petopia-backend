/**
 * Jalankan SEKALI untuk menambah tabel & kolom baru:
 *   node migrate_add_settings.js
 *
 * Letakkan file ini di petopia-backend/config/ lalu jalankan.
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

    // 1. Tabel app_settings — simpan konfigurasi platform
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Nilai default: fee admin 10%, ongkir flat Rp 15.000
    await client.query(`
      INSERT INTO app_settings (key, value) VALUES
        ('platform_fee_percent', '10'),
        ('shipping_cost',        '15000')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log("✅ Tabel app_settings dibuat + nilai default diisi");

    // 2. Tambah kolom ke tabel orders (skip jika sudah ada)
    const cols = [
      ["shipping_cost",   "NUMERIC(12,2) NOT NULL DEFAULT 0"],
      ["platform_fee",    "NUMERIC(12,2) NOT NULL DEFAULT 0"],
      ["seller_payout",   "NUMERIC(12,2) NOT NULL DEFAULT 0"],
    ];
    for (const [col, def] of cols) {
      await client.query(`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col} ${def};
      `);
    }
    console.log("✅ Kolom shipping_cost, platform_fee, seller_payout ditambahkan ke orders");

    await client.query("COMMIT");
    console.log("\n🎉 Migrasi settings selesai!");
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
