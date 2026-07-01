require("dotenv").config();
const { pool } = require("./database");

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("🚀 Memulai migrasi database...\n");

    // ─── EXTENSIONS ──────────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // ─── ENUM TYPES ───────────────────────────────────────────────
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'failed', 'refunded');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('transfer', 'ewallet', 'cod');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE pet_gender AS ENUM ('Jantan', 'Betina');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log("✅ Enum types dibuat");

    // ─── USERS ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        phone       VARCHAR(20),
        role        user_role NOT NULL DEFAULT 'buyer',
        avatar_url  TEXT,
        is_active   BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;
    `);
    console.log("✅ Tabel users dibuat");

    // ─── CATEGORIES ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id   SERIAL PRIMARY KEY,
        name          VARCHAR(100) NOT NULL UNIQUE,
        icon          VARCHAR(10),
        description   TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Tabel categories dibuat");

    // ─── PETS ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS pets (
        pet_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        seller_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        pet_name    VARCHAR(150) NOT NULL,
        species     VARCHAR(50) NOT NULL,
        breed       VARCHAR(100),
        age_month   INTEGER DEFAULT 0 CHECK (age_month >= 0),
        gender      pet_gender NOT NULL,
        price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
        stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        image_url   TEXT,
        description TEXT,
        is_active   BOOLEAN DEFAULT TRUE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pets_seller_id ON pets(seller_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pets_species ON pets(species);
    `);
    console.log("✅ Tabel pets dibuat");

    // ─── PRODUCTS ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        seller_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        category_id   INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
        product_name  VARCHAR(200) NOT NULL,
        description   TEXT,
        price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
        stock         INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        image_url     TEXT,
        is_active     BOOLEAN DEFAULT TRUE,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
    `);
    console.log("✅ Tabel products dibuat");

    // ─── CART ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart (
        cart_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        buyer_id    UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        item_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cart_id     UUID NOT NULL REFERENCES cart(cart_id) ON DELETE CASCADE,
        item_type   VARCHAR(10) NOT NULL CHECK (item_type IN ('pet','product')),
        pet_id      UUID REFERENCES pets(pet_id) ON DELETE CASCADE,
        product_id  UUID REFERENCES products(product_id) ON DELETE CASCADE,
        quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT chk_cart_item_ref CHECK (
          (item_type = 'pet'     AND pet_id IS NOT NULL AND product_id IS NULL) OR
          (item_type = 'product' AND product_id IS NOT NULL AND pet_id IS NULL)
        )
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
    `);
    console.log("✅ Tabel cart & cart_items dibuat");

    // ─── ORDERS ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        order_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        buyer_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        status            order_status NOT NULL DEFAULT 'pending',
        total_price       NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
        shipping_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
        platform_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
        seller_payout     NUMERIC(12,2) NOT NULL DEFAULT 0,
        shipping_address  TEXT NOT NULL,
        shipping_city     TEXT,
        shipping_postal   VARCHAR(20),
        notes             TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
    console.log("✅ Tabel orders dibuat");

    // ─── APP SETTINGS (fee platform & ongkir) ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO app_settings (key, value) VALUES
        ('platform_fee_percent', '10'),
        ('shipping_cost',        '15000')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log("✅ Tabel app_settings dibuat + nilai default diisi");

    // ─── ORDER ITEMS ──────────────────────────────────────────────
    // PENTING: subtotal dihitung via kolom biasa (bukan GENERATED),
    // agar kompatibel dengan semua versi PostgreSQL
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        order_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id      UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        item_type     VARCHAR(10) NOT NULL CHECK (item_type IN ('pet','product')),
        pet_id        UUID REFERENCES pets(pet_id) ON DELETE SET NULL,
        product_id    UUID REFERENCES products(product_id) ON DELETE SET NULL,
        seller_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
        quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        unit_price    NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
        subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);
    `);
    console.log("✅ Tabel order_items dibuat");

    // ─── PAYMENTS ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        payment_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id        UUID NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
        amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
        method          payment_method NOT NULL DEFAULT 'transfer',
        status          payment_status NOT NULL DEFAULT 'unpaid',
        reference_no    VARCHAR(100),
        paid_at         TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Tabel payments dibuat");

    // ─── REVIEWS ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        review_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reviewer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        order_id    UUID REFERENCES orders(order_id) ON DELETE SET NULL,
        item_type   VARCHAR(10) NOT NULL CHECK (item_type IN ('pet','product')),
        pet_id      UUID REFERENCES pets(pet_id) ON DELETE CASCADE,
        product_id  UUID REFERENCES products(product_id) ON DELETE CASCADE,
        rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment     TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT chk_review_item_ref CHECK (
          (item_type = 'pet'     AND pet_id IS NOT NULL) OR
          (item_type = 'product' AND product_id IS NOT NULL)
        )
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_pet_id ON reviews(pet_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
    `);
    console.log("✅ Tabel reviews dibuat");

    // ─── TRIGGER updated_at ───────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const triggerTables = ["users", "pets", "products", "cart", "orders", "payments"];
    for (const tbl of triggerTables) {
      await client.query(`
        DROP TRIGGER IF EXISTS trg_${tbl}_updated_at ON ${tbl};
      `);
      await client.query(`
        CREATE TRIGGER trg_${tbl}_updated_at
          BEFORE UPDATE ON ${tbl}
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);
    }
    console.log("✅ Triggers updated_at dibuat");

    await client.query("COMMIT");
    console.log("\n🎉 Migrasi selesai! Semua tabel berhasil dibuat.");
    console.log("\nSelanjutnya jalankan: npm run db:seed\n");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migrasi gagal:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables();