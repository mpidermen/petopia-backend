require("dotenv").config();
const { pool } = require("./database");

const dropAll = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("🗑️  Menghapus semua tabel...");

    await client.query(`
      DROP TABLE IF EXISTS reviews      CASCADE;
      DROP TABLE IF EXISTS payments     CASCADE;
      DROP TABLE IF EXISTS order_items  CASCADE;
      DROP TABLE IF EXISTS orders       CASCADE;
      DROP TABLE IF EXISTS cart_items   CASCADE;
      DROP TABLE IF EXISTS cart         CASCADE;
      DROP TABLE IF EXISTS products     CASCADE;
      DROP TABLE IF EXISTS pets         CASCADE;
      DROP TABLE IF EXISTS categories   CASCADE;
      DROP TABLE IF EXISTS users        CASCADE;
    `);

    await client.query(`
      DROP TYPE IF EXISTS user_role       CASCADE;
      DROP TYPE IF EXISTS order_status    CASCADE;
      DROP TYPE IF EXISTS payment_status  CASCADE;
      DROP TYPE IF EXISTS payment_method  CASCADE;
      DROP TYPE IF EXISTS pet_gender      CASCADE;
    `);

    await client.query(`
      DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
    `);

    await client.query("COMMIT");
    console.log("✅ Semua tabel & type berhasil dihapus.");
    console.log("   Sekarang jalankan: npm run db:migrate\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Gagal:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

dropAll();
