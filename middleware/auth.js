const jwt = require("jsonwebtoken");
const { query } = require("../config/database");

/**
 * Verifikasi JWT token dari Authorization header
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan. Silakan login terlebih dahulu.",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Token sudah kadaluarsa. Silakan login ulang." });
      }
      return res.status(401).json({ success: false, message: "Token tidak valid." });
    }

    // Ambil user terbaru dari DB (validasi user masih aktif)
    const result = await query(
      `SELECT user_id, name, email, role, is_active FROM users WHERE user_id = $1`,
      [decoded.user_id]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, message: "Akun tidak ditemukan atau nonaktif." });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based access control
 * @param  {...string} roles - Role yang diizinkan
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Tidak terautentikasi." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Hanya ${roles.join(" / ")} yang diizinkan.`,
      });
    }
    next();
  };
};

// Shorthand role guards
const isBuyer  = authorize("buyer");
const isSeller = authorize("seller");
const isAdmin  = authorize("admin");
const isSellerOrAdmin = authorize("seller", "admin");

module.exports = { authenticate, authorize, isBuyer, isSeller, isAdmin, isSellerOrAdmin };
