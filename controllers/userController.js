const bcrypt = require("bcryptjs");
const { query } = require("../config/database");

/**
 * GET /api/users/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT user_id, name, email, phone, role, avatar_url, address, city, postal_code, is_active, created_at, updated_at
       FROM users WHERE user_id = $1`,
      [req.user.user_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar_url, address, city, postal_code, password, new_password } = req.body;
    const userId = req.user.user_id;

    // Jika ganti password
    if (new_password) {
      if (!password) {
        return res.status(400).json({ success: false, message: "Password lama wajib diisi." });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: "Password baru minimal 6 karakter." });
      }
      const userRes = await query(`SELECT password FROM users WHERE user_id = $1`, [userId]);
      const isMatch = await bcrypt.compare(password, userRes.rows[0].password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "Password lama salah." });
      }
      const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashed = await bcrypt.hash(new_password, rounds);
      await query(`UPDATE users SET password = $1 WHERE user_id = $2`, [hashed, userId]);
    }

    const result = await query(
      `UPDATE users SET
        name        = COALESCE(NULLIF($1,''), name),
        phone       = COALESCE(NULLIF($2,''), phone),
        avatar_url  = COALESCE(NULLIF($3,''), avatar_url),
        address     = COALESCE($4, address),
        city        = COALESCE($5, city),
        postal_code = COALESCE($6, postal_code)
       WHERE user_id = $7
       RETURNING user_id, name, email, phone, role, avatar_url, address, city, postal_code, updated_at`,
      [name || null, phone || null, avatar_url || null, address ?? null, city ?? null, postal_code ?? null, userId]
    );
    return res.json({ success: true, message: "Profil berhasil diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };