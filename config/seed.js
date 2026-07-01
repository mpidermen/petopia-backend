require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("./database");

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("🌱 Memulai seeding database (clean install)...\n");

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const adminPass = await bcrypt.hash("Admin123!", rounds);

    // ─── ADMIN (satu-satunya akun default) ─────────────────────────
    await client.query(
      `INSERT INTO users (name, email, password, phone, role, avatar_url)
       VALUES ('Admin Petopia', 'admin@petopia.com', $1, '081100000001', 'admin',
               'https://api.dicebear.com/7.x/avataaars/svg?seed=admin')
       ON CONFLICT (email) DO NOTHING;`,
      [adminPass]
    );
    console.log("✅ Akun admin default dibuat (atau sudah ada).");

    // ─── CATEGORIES (taksonomi dasar, bukan data demo produk) ──────
    await client.query(`
      INSERT INTO categories (name, icon, description) VALUES
        ('Makanan',    '🍖', 'Makanan dan camilan hewan peliharaan'),
        ('Kandang',    '🏠', 'Kandang, aquarium, dan tempat tinggal'),
        ('Grooming',   '✂️', 'Perawatan dan kebersihan hewan'),
        ('Mainan',     '🎾', 'Mainan dan aksesoris bermain'),
        ('Kesehatan',  '💊', 'Vitamin, obat, dan suplemen'),
        ('Aksesoris',  '🎀', 'Aksesoris dan perlengkapan lain')
      ON CONFLICT (name) DO NOTHING;
    `);
    const catCount = await client.query(`SELECT COUNT(*) FROM categories`);
    console.log(`✅ Categories: ${catCount.rows[0].count} rows`);

    // Tidak ada seller, buyer, pets, products, orders, cart, atau data
    // dummy lain yang dibuat. Seluruh data tersebut harus dibuat oleh
    // pengguna sendiri melalui register / form tambah produk-hewan.

    await client.query("COMMIT");
    console.log("\n🎉 Seeding selesai! Database bersih siap digunakan.");
    console.log("\n📋 Akun Admin Default:");
    console.log("   Email    : admin@petopia.com");
    console.log("   Password : Admin123!");
    console.log("\nTidak ada akun buyer/seller atau produk/hewan demo.");
    console.log("Buyer & seller harus mendaftar sendiri melalui halaman register.\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding gagal:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
