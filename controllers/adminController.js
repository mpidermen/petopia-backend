const { query } = require("../config/database");
const { paginate, paginatedResponse } = require("../middleware/errorHandler");
const { fetchSettings } = require("./settingsController");
/**
 * GET /api/admin/dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    const [users, pets, products, orders, revenue, recentOrders] = await Promise.all([
      query(`SELECT role, COUNT(*) AS count FROM users GROUP BY role`),
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) AS available FROM pets WHERE is_active = TRUE`),
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) AS available FROM products WHERE is_active = TRUE`),
      query(`SELECT status, COUNT(*) AS count FROM orders GROUP BY status`),
      query(`SELECT SUM(amount) AS total, SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) AS paid FROM payments`),
      query(
        `SELECT o.order_id, o.status, o.total_price, o.created_at, u.name AS buyer_name
         FROM orders o JOIN users u ON u.user_id = o.buyer_id
         ORDER BY o.created_at DESC LIMIT 10`
      ),
    ]);

    const userMap = {};
    users.rows.forEach(r => userMap[r.role] = parseInt(r.count));

    const orderMap = {};
    orders.rows.forEach(r => orderMap[r.status] = parseInt(r.count));

    return res.json({
      success: true,
      data: {
        users: {
          total: Object.values(userMap).reduce((a, b) => a + b, 0),
          buyers: userMap.buyer || 0,
          sellers: userMap.seller || 0,
          admins: userMap.admin || 0,
        },
        pets: {
          total: parseInt(pets.rows[0].total),
          available: parseInt(pets.rows[0].available),
        },
        products: {
          total: parseInt(products.rows[0].total),
          available: parseInt(products.rows[0].available),
        },
        orders: {
          total: Object.values(orderMap).reduce((a, b) => a + b, 0),
          ...orderMap,
        },
        revenue: {
          total: parseFloat(revenue.rows[0].total || 0),
          paid: parseFloat(revenue.rows[0].paid || 0),
        },
        recent_orders: recentOrders.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users
 */
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { role, search } = req.query;
    const params = [];
    const conditions = [];
    let idx = 1;

    if (role)   { conditions.push(`u.role = $${idx++}`);            params.push(role); }
    if (search) { conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`); idx++; params.push(`%${search}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
    const dataRes  = await query(
      `SELECT user_id, name, email, phone, role, avatar_url, is_active, created_at FROM users u ${where}
       ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
      [...params, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/users/:id  - update role / status
 */
const updateUser = async (req, res, next) => {
  try {
    const { role, is_active } = req.body;
    const validRoles = ["buyer", "seller", "admin"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role harus salah satu: ${validRoles.join(", ")}` });
    }
    const result = await query(
      `UPDATE users SET
        role      = COALESCE($1::user_role, role),
        is_active = COALESCE($2, is_active)
       WHERE user_id = $3
       RETURNING user_id, name, email, role, is_active`,
      [role || null, is_active ?? null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    return res.json({ success: true, message: "User diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/users/:id  - soft delete (nonaktifkan)
 */
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user.user_id) {
      return res.status(400).json({ success: false, message: "Tidak bisa menghapus akun sendiri." });
    }
    const result = await query(
      `UPDATE users SET is_active = FALSE WHERE user_id = $1 RETURNING user_id, name`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    return res.json({ success: true, message: "User berhasil dinonaktifkan." });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/orders
 */
const getOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { status } = req.query;
    const params = [];
    let statusClause = "";
    if (status) { statusClause = `WHERE o.status = $1`; params.push(status); }

    const countRes = await query(`SELECT COUNT(*) FROM orders o ${statusClause}`, params);
    const dataRes  = await query(
      `SELECT o.*, u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone,
              p.status AS payment_status, p.method AS payment_method
       FROM orders o
       JOIN users u ON u.user_id = o.buyer_id
       LEFT JOIN payments p ON p.order_id = o.order_id
       ${statusClause}
       ORDER BY o.created_at DESC
       LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status tidak valid.` });
    }
    const result = await query(
      `UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *`, [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    return res.json({ success: true, message: "Status pesanan diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/products  - semua produk dari seluruh seller (termasuk nonaktif)
 */
const getAllProducts = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { search, seller_id } = req.query;
    const conditions = ["p.is_active = TRUE"];
    const params = [];
    let idx = 1;

    if (search)    { conditions.push(`p.product_name ILIKE $${idx++}`); params.push(`%${search}%`); }
    if (seller_id) { conditions.push(`p.seller_id = $${idx++}`);        params.push(seller_id); }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countRes = await query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const dataRes = await query(
      `SELECT p.*, c.name AS category_name, c.icon AS category_icon, u.name AS seller_name
       FROM products p
       JOIN users u ON u.user_id = p.seller_id
       LEFT JOIN categories c ON c.category_id = p.category_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/pets  - semua hewan dari seluruh seller (termasuk nonaktif)
 */
const getAllPets = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { search, seller_id } = req.query;
    const conditions = ["p.is_active = TRUE"];
    const params = [];
    let idx = 1;

    if (search)    { conditions.push(`p.pet_name ILIKE $${idx++}`); params.push(`%${search}%`); }
    if (seller_id) { conditions.push(`p.seller_id = $${idx++}`);    params.push(seller_id); }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const countRes = await query(`SELECT COUNT(*) FROM pets p ${where}`, params);
    const dataRes = await query(
      `SELECT p.*, u.name AS seller_name
       FROM pets p
       JOIN users u ON u.user_id = p.seller_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/earnings
 * Keuntungan platform (fee yang terkumpul dari semua transaksi selesai)
 */
const getAdminEarnings = async (req, res, next) => {
  try {
    const settings = await fetchSettings();
    const feePct = parseFloat(settings.platform_fee_percent) || 0;
    const shippingCost = parseFloat(settings.shipping_cost) || 0;

    // Fee terkumpul per status pesanan
    const feeRes = await query(
      `SELECT o.status,
              COUNT(*)                   AS order_count,
              COALESCE(SUM(oi.subtotal), 0) AS gross_subtotal
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       GROUP BY o.status`
    );

    const byStatus = {};
    let totalFeeDelivered = 0;
    let totalFeeOnGoing = 0;
    let totalOrdersDelivered = 0;

    feeRes.rows.forEach(r => {
      const gross = parseFloat(r.gross_subtotal);
      const count = parseInt(r.order_count);
      const fee = Math.round(gross * feePct / 100);
      byStatus[r.status] = { order_count: count, gross_subtotal: gross, platform_fee: fee };
      if (r.status === "delivered") {
        totalFeeDelivered += fee;
        totalOrdersDelivered += count;
      } else if (["pending", "processing", "shipped"].includes(r.status)) {
        totalFeeOnGoing += fee;
      }
    });

    // Grafik bulanan (12 bulan terakhir) - fee dari pesanan selesai
    const monthlyRes = await query(
      `SELECT TO_CHAR(o.created_at, 'YYYY-MM') AS month,
              COUNT(DISTINCT o.order_id)          AS order_count,
              COALESCE(SUM(oi.subtotal), 0)        AS gross_subtotal
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE o.status = 'delivered'
         AND o.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
       ORDER BY TO_CHAR(o.created_at, 'YYYY-MM') ASC`
    );

    const monthly = monthlyRes.rows.map(r => ({
      month: r.month,
      order_count: parseInt(r.order_count),
      platform_fee: Math.round(parseFloat(r.gross_subtotal) * feePct / 100),
    }));

    return res.json({
      success: true,
      data: {
        fee_percent: feePct,
        shipping_cost: shippingCost,
        // Sudah cair: dari pesanan berstatus delivered
        total_fee_delivered: totalFeeDelivered,
        total_orders_delivered: totalOrdersDelivered,
        // Potensi: dari pesanan yang masih berjalan
        total_fee_on_going: totalFeeOnGoing,
        by_status: byStatus,
        monthly,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard, getUsers, updateUser, deleteUser, getOrders, updateOrderStatus,
  getAllProducts, getAllPets, getAdminEarnings,
};
