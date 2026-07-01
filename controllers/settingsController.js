const { query } = require("../config/database");

/**
 * GET /api/admin/settings
 * Return semua setting sebagai object { platform_fee_percent, shipping_cost }
 */
const getSettings = async (req, res, next) => {
  try {
    const result = await query(`SELECT key, value FROM app_settings`);
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = parseFloat(r.value); });
    return res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/settings
 * Body: { platform_fee_percent?: number, shipping_cost?: number }
 */
const updateSettings = async (req, res, next) => {
  try {
    const { platform_fee_percent, shipping_cost } = req.body;

    if (platform_fee_percent !== undefined) {
      const fee = parseFloat(platform_fee_percent);
      if (isNaN(fee) || fee < 0 || fee > 100) {
        return res.status(400).json({ success: false, message: "Fee platform harus antara 0–100%." });
      }
      await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('platform_fee_percent', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [fee.toString()]
      );
    }

    if (shipping_cost !== undefined) {
      const cost = parseFloat(shipping_cost);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({ success: false, message: "Ongkir tidak boleh negatif." });
      }
      await query(
        `INSERT INTO app_settings (key, value, updated_at) VALUES ('shipping_cost', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [cost.toString()]
      );
    }

    // Return settings terbaru
    const result = await query(`SELECT key, value FROM app_settings`);
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = parseFloat(r.value); });

    return res.json({ success: true, message: "Pengaturan berhasil disimpan.", data: settings });
  } catch (err) {
    next(err);
  }
};

/**
 * Helper: ambil settings sebagai object (dipakai oleh orderController)
 */
const fetchSettings = async () => {
  const defaults = { platform_fee_percent: 10, shipping_cost: 15000 };
  try {
    const result = await query(`SELECT key, value FROM app_settings`);
    result.rows.forEach(r => { defaults[r.key] = parseFloat(r.value); });
  } catch {
    // tabel belum ada (DB lama) — pakai default, jalankan migrate_add_settings.js
  }
  return defaults;
};

module.exports = { getSettings, updateSettings, fetchSettings };
