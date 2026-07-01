// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  if (process.env.NODE_ENV === "development") console.error(err.stack);

  // PostgreSQL unique violation
  if (err.code === "23505") {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || "field";
    return res.status(409).json({ success: false, message: `${field} sudah digunakan.` });
  }
  // PostgreSQL foreign key violation
  if (err.code === "23503") {
    return res.status(400).json({ success: false, message: "Referensi data tidak valid." });
  }
  // PostgreSQL check constraint
  if (err.code === "23514") {
    return res.status(400).json({ success: false, message: "Data tidak memenuhi constraint." });
  }
  // PostgreSQL not null
  if (err.code === "23502") {
    return res.status(400).json({ success: false, message: `Field '${err.column}' wajib diisi.` });
  }

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || "Terjadi kesalahan server.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// ─── 404 HANDLER ──────────────────────────────────────────────────────────────
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
};

// ─── VALIDATION HELPER ────────────────────────────────────────────────────────
const validate = (fields) => (req, res, next) => {
  const missing = fields.filter((f) => {
    const val = req.body[f];
    return val === undefined || val === null || val === "";
  });
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Field wajib tidak boleh kosong: ${missing.join(", ")}`,
    });
  }
  next();
};

// ─── PAGINATION HELPER ────────────────────────────────────────────────────────
const paginate = (req) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 12));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

const paginatedResponse = (res, { rows, total, page, limit }) => {
  return res.json({
    success: true,
    data: rows,
    pagination: {
      total: parseInt(total),
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

module.exports = { errorHandler, notFound, validate, paginate, paginatedResponse };
