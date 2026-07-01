const { query, withTransaction } = require("../config/database");

/**
 * Helper: get or create cart untuk buyer
 */
const getOrCreateCart = async (buyerId) => {
  let cartRes = await query(`SELECT cart_id FROM cart WHERE buyer_id = $1`, [buyerId]);
  if (!cartRes.rows.length) {
    cartRes = await query(`INSERT INTO cart (buyer_id) VALUES ($1) RETURNING cart_id`, [buyerId]);
  }
  return cartRes.rows[0].cart_id;
};

/**
 * GET /api/cart
 */
const getCart = async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.user_id);

    const items = await query(
      `SELECT
         ci.item_id, ci.item_type, ci.quantity,
         ci.pet_id, ci.product_id,
         CASE
           WHEN ci.item_type = 'pet'     THEN p.pet_name
           WHEN ci.item_type = 'product' THEN pr.product_name
         END AS name,
         CASE
           WHEN ci.item_type = 'pet'     THEN p.price
           WHEN ci.item_type = 'product' THEN pr.price
         END AS price,
         CASE
           WHEN ci.item_type = 'pet'     THEN p.image_url
           WHEN ci.item_type = 'product' THEN pr.image_url
         END AS image_url,
         CASE
           WHEN ci.item_type = 'pet'     THEN p.stock
           WHEN ci.item_type = 'product' THEN pr.stock
         END AS stock,
         CASE
           WHEN ci.item_type = 'pet'     THEN p.seller_id
           WHEN ci.item_type = 'product' THEN pr.seller_id
         END AS seller_id
       FROM cart_items ci
       LEFT JOIN pets     p  ON p.pet_id       = ci.pet_id
       LEFT JOIN products pr ON pr.product_id  = ci.product_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at`,
      [cartId]
    );

    const total = items.rows.reduce((s, i) => s + parseFloat(i.price || 0) * i.quantity, 0);

    return res.json({
      success: true,
      data: { cart_id: cartId, items: items.rows, total_price: total, item_count: items.rows.length },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/cart
 * body: { item_type, pet_id | product_id, quantity }
 */
const addToCart = async (req, res, next) => {
  try {
    const { item_type, pet_id, product_id, quantity = 1 } = req.body;

    if (!item_type || !["pet", "product"].includes(item_type)) {
      return res.status(400).json({ success: false, message: "item_type harus 'pet' atau 'product'." });
    }
    if (item_type === "pet" && !pet_id) {
      return res.status(400).json({ success: false, message: "pet_id wajib diisi." });
    }
    if (item_type === "product" && !product_id) {
      return res.status(400).json({ success: false, message: "product_id wajib diisi." });
    }

    // Validasi stok
    if (item_type === "pet") {
      const petRes = await query(`SELECT stock, is_active FROM pets WHERE pet_id = $1`, [pet_id]);
      if (!petRes.rows.length || !petRes.rows[0].is_active) {
        return res.status(404).json({ success: false, message: "Hewan tidak ditemukan." });
      }
      if (petRes.rows[0].stock < quantity) {
        return res.status(400).json({ success: false, message: `Stok hewan hanya tersisa ${petRes.rows[0].stock}.` });
      }
    } else {
      const prodRes = await query(`SELECT stock, is_active FROM products WHERE product_id = $1`, [product_id]);
      if (!prodRes.rows.length || !prodRes.rows[0].is_active) {
        return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
      }
      if (prodRes.rows[0].stock < quantity) {
        return res.status(400).json({ success: false, message: `Stok produk hanya tersisa ${prodRes.rows[0].stock}.` });
      }
    }

    const cartId = await getOrCreateCart(req.user.user_id);

    // Cek apakah item sudah ada di cart
    const existsRes = await query(
      `SELECT item_id, quantity FROM cart_items
       WHERE cart_id = $1 AND item_type = $2
         AND ($3::uuid IS NULL OR pet_id = $3)
         AND ($4::uuid IS NULL OR product_id = $4)`,
      [cartId, item_type, pet_id || null, product_id || null]
    );

    let result;
    if (existsRes.rows.length) {
      // Update quantity
      result = await query(
        `UPDATE cart_items SET quantity = quantity + $1 WHERE item_id = $2 RETURNING *`,
        [quantity, existsRes.rows[0].item_id]
      );
    } else {
      result = await query(
        `INSERT INTO cart_items (cart_id, item_type, pet_id, product_id, quantity)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [cartId, item_type, pet_id || null, product_id || null, quantity]
      );
    }

    return res.status(201).json({ success: true, message: "Item ditambahkan ke keranjang.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/cart/:itemId  - update quantity
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity harus >= 1." });
    }
    const cartId = await getOrCreateCart(req.user.user_id);
    const result = await query(
      `UPDATE cart_items SET quantity = $1 WHERE item_id = $2 AND cart_id = $3 RETURNING *`,
      [quantity, req.params.itemId, cartId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Item tidak ditemukan di keranjang." });
    }
    return res.json({ success: true, message: "Quantity diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/cart/:itemId
 */
const removeFromCart = async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.user_id);
    const result = await query(
      `DELETE FROM cart_items WHERE item_id = $1 AND cart_id = $2 RETURNING item_id`,
      [req.params.itemId, cartId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Item tidak ditemukan." });
    }
    return res.json({ success: true, message: "Item dihapus dari keranjang." });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/cart  - clear all cart
 */
const clearCart = async (req, res, next) => {
  try {
    const cartId = await getOrCreateCart(req.user.user_id);
    await query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
    return res.json({ success: true, message: "Keranjang berhasil dikosongkan." });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
