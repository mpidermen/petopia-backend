const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/database");

/**
 * Generate JWT token
 */
const signToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    // Validasi
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "name, email, dan password wajib diisi." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password minimal 6 karakter." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Format email tidak valid." });
    }

    // Cek email duplikat
    const exists = await query(`SELECT user_id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (exists.rows.length) {
      return res.status(409).json({ success: false, message: "Email sudah terdaftar." });
    }

    // Role hanya buyer atau seller (admin dibuat manual)
    const allowedRoles = ["buyer", "seller"];
    const userRole = allowedRoles.includes(role) ? role : "buyer";

    // Seller baru butuh persetujuan admin dulu sebelum bisa berjualan/login
    const isActive = userRole !== "seller";

    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, rounds);

    const result = await query(
      `INSERT INTO users (name, email, password, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, name, email, phone, role, avatar_url, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), hashedPassword, phone || null, userRole, isActive]
    );

    const user = result.rows[0];

    // Jika buyer, buat cart otomatis
    if (user.role === "buyer") {
      await query(`INSERT INTO cart (buyer_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.user_id]);
    }

    // Seller baru: jangan langsung berikan token, harus menunggu admin approve dulu
    if (user.role === "seller" && !user.is_active) {
      return res.status(201).json({
        success: true,
        pending: true,
        message: "Registrasi berhasil! Akun seller Anda sedang menunggu persetujuan admin. Anda bisa login setelah disetujui.",
        data: { user },
      });
    }

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil!",
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email dan password wajib diisi." });
    }

    const result = await query(
      `SELECT user_id, name, email, password, phone, role, avatar_url, address, city, postal_code, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      return res.status(401).json({ success: false, message: "Email atau password salah." });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      const msg = user.role === "seller"
        ? "Akun seller Anda belum disetujui admin. Silakan tunggu verifikasi terlebih dahulu."
        : "Akun Anda telah dinonaktifkan.";
      return res.status(403).json({ success: false, message: msg });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Email atau password salah." });
    }

    const { password: _, ...safeUser } = user;
    const token = signToken(safeUser);

    return res.json({
      success: true,
      message: "Login berhasil!",
      data: { user: safeUser, token },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const me = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT user_id, name, email, phone, role, avatar_url, address, city, postal_code, created_at FROM users WHERE user_id = $1`,
      [req.user.user_id]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, me };