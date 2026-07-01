require("dotenv").config();
const app  = require("./app");
const { pool } = require("./config/database");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Test DB connection
    const client = await pool.connect();
    await client.query("SELECT NOW()");
    client.release();
    console.log("✅ Database connection OK");

    const server = app.listen(PORT, () => {
      console.log("═══════════════════════════════════════════════");
      console.log("  🐾  PETOPIA BACKEND SERVER");
      console.log("═══════════════════════════════════════════════");
      console.log(`  Environment : ${process.env.NODE_ENV || "development"}`);
      console.log(`  Server      : http://localhost:${PORT}`);
      console.log(`  API Base    : http://localhost:${PORT}/api`);
      console.log(`  Database    : ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
      console.log("═══════════════════════════════════════════════");
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[${signal}] Graceful shutdown...`);
      server.close(async () => {
        await pool.end();
        console.log("✅ Server and DB pool closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));

    // Unhandled rejections
    process.on("unhandledRejection", (err) => {
      console.error("❌ Unhandled Rejection:", err.message);
      shutdown("unhandledRejection");
    });

  } catch (err) {
    console.error("❌ Gagal menghubungkan ke database:", err.message);
    console.error("   Pastikan PostgreSQL berjalan dan konfigurasi .env sudah benar.");
    process.exit(1);
  }
};

startServer();
