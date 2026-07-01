const { query } = require("../config/database");

/**
 * GET /api/categories
 */
const getCategories = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, COUNT(p.product_id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.category_id AND p.is_active = TRUE
       GROUP BY c.category_id
       ORDER BY c.category_id`
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/categories  [Admin only]
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, icon, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Nama kategori wajib diisi." });

    const result = await query(
      `INSERT INTO categories (name, icon, description) VALUES ($1,$2,$3)
       RETURNING *`,
      [name.trim(), icon || null, description || null]
    );
    return res.status(201).json({ success: true, message: "Kategori berhasil dibuat.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCategories, createCategory };
