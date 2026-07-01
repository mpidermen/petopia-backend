const { query } = require("../config/database");
const { paginate, paginatedResponse } = require("../middleware/errorHandler");

/**
 * GET /api/products
 */
const getProducts = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { category_id, seller_id, search, min_price, max_price, sort } = req.query;

    const conditions = ["p.is_active = TRUE"];
    const params = [];
    let idx = 1;

    if (category_id) { conditions.push(`p.category_id = $${idx++}`);       params.push(category_id); }
    if (seller_id)   { conditions.push(`p.seller_id = $${idx++}`);          params.push(seller_id); }
    if (search)      { conditions.push(`p.product_name ILIKE $${idx++}`);   params.push(`%${search}%`); }
    if (min_price)   { conditions.push(`p.price >= $${idx++}`);             params.push(min_price); }
    if (max_price)   { conditions.push(`p.price <= $${idx++}`);             params.push(max_price); }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const sortMap = { "price_asc": "p.price ASC", "price_desc": "p.price DESC", "newest": "p.created_at DESC", "rating": "avg_rating DESC NULLS LAST" };
    const orderBy = sortMap[sort] || "p.created_at DESC";

    const countRes = await query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const dataRes  = await query(
      `SELECT
         p.*,
         c.name AS category_name,
         c.icon AS category_icon,
         u.name AS seller_name,
         ROUND(AVG(r.rating),1) AS avg_rating,
         COUNT(DISTINCT r.review_id) AS review_count
       FROM products p
       JOIN users u ON u.user_id = p.seller_id
       LEFT JOIN categories c ON c.category_id = p.category_id
       LEFT JOIN reviews r ON r.product_id = p.product_id
       ${where}
       GROUP BY p.product_id, c.name, c.icon, u.name
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         p.*,
         c.name AS category_name, c.icon AS category_icon,
         u.name AS seller_name, u.avatar_url AS seller_avatar, u.phone AS seller_phone,
         ROUND(AVG(r.rating),1) AS avg_rating,
         COUNT(DISTINCT r.review_id) AS review_count
       FROM products p
       JOIN users u ON u.user_id = p.seller_id
       LEFT JOIN categories c ON c.category_id = p.category_id
       LEFT JOIN reviews r ON r.product_id = p.product_id
       WHERE p.product_id = $1 AND p.is_active = TRUE
       GROUP BY p.product_id, c.name, c.icon, u.name, u.avatar_url, u.phone`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products  [Seller]
 */
const createProduct = async (req, res, next) => {
  try {
    const { product_name, category_id, description, price, stock, image_url } = req.body;
    if (!product_name || !price) {
      return res.status(400).json({ success: false, message: "product_name dan price wajib diisi." });
    }
    const result = await query(
      `INSERT INTO products (seller_id, category_id, product_name, description, price, stock, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.user_id, category_id||null, product_name, description||null, price, stock||0, image_url||null]
    );
    return res.status(201).json({ success: true, message: "Produk berhasil ditambahkan.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/products/:id  [Seller own / Admin]
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prod = await query(`SELECT seller_id FROM products WHERE product_id = $1`, [id]);
    if (!prod.rows.length) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    if (req.user.role !== "admin" && prod.rows[0].seller_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    const { product_name, category_id, description, price, stock, image_url, is_active } = req.body;
    const result = await query(
      `UPDATE products SET
        product_name = COALESCE($1, product_name),
        category_id  = COALESCE($2, category_id),
        description  = COALESCE($3, description),
        price        = COALESCE($4, price),
        stock        = COALESCE($5, stock),
        image_url    = COALESCE($6, image_url),
        is_active    = COALESCE($7, is_active)
       WHERE product_id = $8 RETURNING *`,
      [product_name||null, category_id||null, description||null, price||null, stock||null, image_url||null, is_active??null, id]
    );
    return res.json({ success: true, message: "Produk berhasil diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/products/:id  [Seller own / Admin] - soft delete
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prod = await query(`SELECT seller_id FROM products WHERE product_id = $1`, [id]);
    if (!prod.rows.length) return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    if (req.user.role !== "admin" && prod.rows[0].seller_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    await query(`UPDATE products SET is_active = FALSE WHERE product_id = $1`, [id]);
    return res.json({ success: true, message: "Produk berhasil dihapus." });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/products  [Seller own]
 */
const getMyProducts = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const countRes = await query(`SELECT COUNT(*) FROM products WHERE seller_id = $1 AND is_active = TRUE`, [req.user.user_id]);
    const dataRes  = await query(
      `SELECT p.*, c.name AS category_name, c.icon AS category_icon,
              ROUND(AVG(r.rating),1) AS avg_rating, COUNT(DISTINCT r.review_id) AS review_count
      FROM products p
      LEFT JOIN categories c ON c.category_id = p.category_id
      LEFT JOIN reviews r ON r.product_id = p.product_id
      WHERE p.seller_id = $1 AND p.is_active = TRUE
      GROUP BY p.product_id, c.name, c.icon
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.user.user_id, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getMyProducts };
