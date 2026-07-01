const { query } = require("../config/database");
const { paginate, paginatedResponse } = require("../middleware/errorHandler");

/**
 * POST /api/reviews  [Buyer]
 */
const createReview = async (req, res, next) => {
  try {
    const { item_type, pet_id, product_id, order_id, rating, comment } = req.body;

    if (!item_type || !["pet", "product"].includes(item_type)) {
      return res.status(400).json({ success: false, message: "item_type harus 'pet' atau 'product'." });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating harus antara 1–5." });
    }
    if (!order_id) {
      return res.status(400).json({ success: false, message: "order_id wajib diisi." });
    }
    if (item_type === "pet" && !pet_id)         return res.status(400).json({ success: false, message: "pet_id wajib diisi." });
    if (item_type === "product" && !product_id) return res.status(400).json({ success: false, message: "product_id wajib diisi." });

    // Validasi: buyer harus punya order yang sudah delivered untuk item ini
    const orderCheck = await query(
      `SELECT o.order_id FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.order_id = $1 AND o.buyer_id = $2 AND o.status = 'delivered'
         AND oi.item_type = $3
         AND ($4::uuid IS NULL OR oi.pet_id = $4)
         AND ($5::uuid IS NULL OR oi.product_id = $5)`,
      [order_id, req.user.user_id, item_type, pet_id || null, product_id || null]
    );
    if (!orderCheck.rows.length) {
      return res.status(403).json({ success: false, message: "Anda hanya bisa review item dari pesanan yang sudah selesai." });
    }

    // Cek duplikat: satu ulasan per item PER ORDER
    // (item yang sama di order berbeda boleh diulas masing-masing)
    const dupCheck = await query(
      `SELECT review_id FROM reviews
       WHERE reviewer_id = $1 AND order_id = $2 AND item_type = $3
         AND ($4::uuid IS NULL OR pet_id = $4)
         AND ($5::uuid IS NULL OR product_id = $5)`,
      [req.user.user_id, order_id, item_type, pet_id || null, product_id || null]
    );
    if (dupCheck.rows.length) {
      return res.status(409).json({ success: false, message: "Anda sudah memberikan ulasan untuk item ini." });
    }

    const result = await query(
      `INSERT INTO reviews (reviewer_id, order_id, item_type, pet_id, product_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.user_id, order_id, item_type, pet_id || null, product_id || null, rating, comment || null]
    );

    return res.status(201).json({ success: true, message: "Ulasan berhasil dikirim.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/mine  [Buyer]
 * Return set key "order:<order_id>:pet:<pet_id>" atau "order:<order_id>:product:<product_id>"
 * sehingga item yang sama di order berbeda tidak saling memblokir.
 */
const getMyReviews = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT item_type, pet_id, product_id, order_id
       FROM reviews
       WHERE reviewer_id = $1`,
      [req.user.user_id]
    );
    const reviewed = result.rows.map(r =>
      r.item_type === "pet"
        ? `order:${r.order_id}:pet:${r.pet_id}`
        : `order:${r.order_id}:product:${r.product_id}`
    );
    return res.json({ success: true, data: reviewed });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/product/:id  [Public]
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { id } = req.params;

    const countRes = await query(`SELECT COUNT(*) FROM reviews WHERE product_id = $1`, [id]);
    const dataRes  = await query(
      `SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar
       FROM reviews r
       JOIN users u ON u.user_id = r.reviewer_id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );
    const avgRes = await query(
      `SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS total FROM reviews WHERE product_id = $1`, [id]
    );

    return res.json({
      success: true,
      data: dataRes.rows,
      summary: { avg_rating: avgRes.rows[0].avg_rating, total: parseInt(avgRes.rows[0].total) },
      pagination: { total: parseInt(countRes.rows[0].count), page, limit, totalPages: Math.ceil(countRes.rows[0].count / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reviews/pet/:id  [Public]
 */
const getPetReviews = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { id } = req.params;

    const countRes = await query(`SELECT COUNT(*) FROM reviews WHERE pet_id = $1`, [id]);
    const dataRes  = await query(
      `SELECT r.*, u.name AS reviewer_name, u.avatar_url AS reviewer_avatar
       FROM reviews r
       JOIN users u ON u.user_id = r.reviewer_id
       WHERE r.pet_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );
    const avgRes = await query(
      `SELECT ROUND(AVG(rating),1) AS avg_rating, COUNT(*) AS total FROM reviews WHERE pet_id = $1`, [id]
    );

    return res.json({
      success: true,
      data: dataRes.rows,
      summary: { avg_rating: avgRes.rows[0].avg_rating, total: parseInt(avgRes.rows[0].total) },
      pagination: { total: parseInt(countRes.rows[0].count), page, limit, totalPages: Math.ceil(countRes.rows[0].count / limit) },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createReview, getProductReviews, getPetReviews, getMyReviews };