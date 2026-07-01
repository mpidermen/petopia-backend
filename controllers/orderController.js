const { query, withTransaction } = require("../config/database");
const { paginate, paginatedResponse } = require("../middleware/errorHandler");
const { fetchSettings } = require("./settingsController");

/**
 * POST /api/orders  [Buyer]
 * Checkout dari cart atau langsung dari item
 */
const createOrder = async (req, res, next) => {
  try {
    const { shipping_address, shipping_city, shipping_postal, notes, payment_method, items } = req.body;
    if (!shipping_address) {
      return res.status(400).json({ success: false, message: "Alamat pengiriman wajib diisi." });
    }

    const result = await withTransaction(async (client) => {
      // Ambil items: dari body (checkout langsung) atau dari cart
      let orderItems = items;
      if (!orderItems || !orderItems.length) {
        // Ambil dari cart
        const cartRes = await client.query(
          `SELECT ci.*, p.price AS pet_price, p.stock AS pet_stock, p.seller_id AS pet_seller,
                  pr.price AS prod_price, pr.stock AS prod_stock, pr.seller_id AS prod_seller
           FROM cart c
           JOIN cart_items ci ON ci.cart_id = c.cart_id
           LEFT JOIN pets p      ON p.pet_id      = ci.pet_id
           LEFT JOIN products pr ON pr.product_id = ci.product_id
           WHERE c.buyer_id = $1`,
          [req.user.user_id]
        );
        if (!cartRes.rows.length) {
          throw Object.assign(new Error("Keranjang kosong."), { status: 400 });
        }
        orderItems = cartRes.rows.map(ci => ({
          item_type:  ci.item_type,
          pet_id:     ci.pet_id,
          product_id: ci.product_id,
          quantity:   ci.quantity,
          unit_price: ci.item_type === "pet" ? ci.pet_price : ci.prod_price,
          seller_id:  ci.item_type === "pet" ? ci.pet_seller : ci.prod_seller,
          stock:      ci.item_type === "pet" ? ci.pet_stock : ci.prod_stock,
        }));
      }

      // Hitung total & validasi stok
      let subtotal = 0;
      for (const item of orderItems) {
        if (!item.unit_price || !item.seller_id) {
          // Fetch price jika belum ada
          if (item.item_type === "pet") {
            const pr = await client.query(`SELECT price, stock, seller_id FROM pets WHERE pet_id = $1 AND is_active = TRUE`, [item.pet_id]);
            if (!pr.rows.length) throw Object.assign(new Error("Hewan tidak ditemukan."), { status: 404 });
            if (pr.rows[0].stock < item.quantity) throw Object.assign(new Error(`Stok hewan tidak cukup.`), { status: 400 });
            item.unit_price = pr.rows[0].price;
            item.seller_id  = pr.rows[0].seller_id;
          } else {
            const pr = await client.query(`SELECT price, stock, seller_id FROM products WHERE product_id = $1 AND is_active = TRUE`, [item.product_id]);
            if (!pr.rows.length) throw Object.assign(new Error("Produk tidak ditemukan."), { status: 404 });
            if (pr.rows[0].stock < item.quantity) throw Object.assign(new Error(`Stok produk tidak cukup.`), { status: 400 });
            item.unit_price = pr.rows[0].price;
            item.seller_id  = pr.rows[0].seller_id;
          }
        } else if (item.stock < item.quantity) {
          throw Object.assign(new Error(`Stok tidak cukup untuk item ${item.item_type}.`), { status: 400 });
        }
        subtotal += parseFloat(item.unit_price) * item.quantity;
      }

      // Ambil settings platform (fee & ongkir)
      const settings = await fetchSettings();
      const shippingCost  = parseFloat(settings.shipping_cost) || 0;
      const feePct        = parseFloat(settings.platform_fee_percent) || 0;
      const platformFee   = Math.round(subtotal * feePct / 100);
      const sellerPayout  = subtotal - platformFee; // yang seller terima
      const totalPrice    = subtotal + shippingCost; // yang buyer bayar

      // Buat order
      const orderRes = await client.query(
        `INSERT INTO orders (buyer_id, total_price, shipping_cost, platform_fee, seller_payout, shipping_address, shipping_city, shipping_postal, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [req.user.user_id, totalPrice, shippingCost, platformFee, sellerPayout, shipping_address, shipping_city||null, shipping_postal||null, notes||null]
      );
      const order = orderRes.rows[0];

      // Insert order_items & kurangi stok
      for (const item of orderItems) {
        await client.query(
          `INSERT INTO order_items (order_id, item_type, pet_id, product_id, seller_id, quantity, unit_price, subtotal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [order.order_id, item.item_type, item.pet_id||null, item.product_id||null, item.seller_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
        // Kurangi stok
        if (item.item_type === "pet") {
          await client.query(`UPDATE pets SET stock = stock - $1 WHERE pet_id = $2`, [item.quantity, item.pet_id]);
        } else {
          await client.query(`UPDATE products SET stock = stock - $1 WHERE product_id = $2`, [item.quantity, item.product_id]);
        }
      }

      // Buat payment record
      await client.query(
        `INSERT INTO payments (order_id, amount, method) VALUES ($1,$2,$3)`,
        [order.order_id, totalPrice, payment_method || "transfer"]
      );

      // Kosongkan cart
      await client.query(
        `DELETE FROM cart_items WHERE cart_id = (SELECT cart_id FROM cart WHERE buyer_id = $1)`,
        [req.user.user_id]
      );

      return order;
    });

    return res.status(201).json({ success: true, message: "Pesanan berhasil dibuat!", data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders  [Buyer - my orders]
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { status } = req.query;

    const params = [req.user.user_id];
    let statusClause = "";
    if (status) { statusClause = `AND o.status = $2`; params.push(status); }

    const countRes = await query(
      `SELECT COUNT(*) FROM orders o WHERE o.buyer_id = $1 ${statusClause}`, params
    );
    const dataRes = await query(
      `SELECT o.*,
              p.status AS payment_status, p.method AS payment_method,
              JSON_AGG(JSON_BUILD_OBJECT(
                'order_item_id', oi.order_item_id,
                'item_type', oi.item_type,
                'pet_id', oi.pet_id,
                'product_id', oi.product_id,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'subtotal', oi.subtotal,
                'name', CASE WHEN oi.item_type='pet' THEN pt.pet_name ELSE pr.product_name END,
                'image_url', CASE WHEN oi.item_type='pet' THEN pt.image_url ELSE pr.image_url END
              )) AS items
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.order_id
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN pets pt       ON pt.pet_id = oi.pet_id
       LEFT JOIN products pr   ON pr.product_id = oi.product_id
       WHERE o.buyer_id = $1 ${statusClause}
       GROUP BY o.order_id, p.status, p.method
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
 * GET /api/orders/:id  [Buyer own / Admin]
 */
const getOrderById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*,
              u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone,
              p.status AS payment_status, p.method AS payment_method, p.reference_no, p.paid_at,
              JSON_AGG(JSON_BUILD_OBJECT(
                'order_item_id', oi.order_item_id,
                'item_type', oi.item_type,
                'pet_id', oi.pet_id,
                'product_id', oi.product_id,
                'seller_id', oi.seller_id,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'subtotal', oi.subtotal,
                'name', CASE WHEN oi.item_type='pet' THEN pt.pet_name ELSE pr.product_name END,
                'image_url', CASE WHEN oi.item_type='pet' THEN pt.image_url ELSE pr.image_url END,
                'seller_name', s.name
              )) AS items
       FROM orders o
       JOIN users u ON u.user_id = o.buyer_id
       LEFT JOIN payments p ON p.order_id = o.order_id
       LEFT JOIN order_items oi ON oi.order_id = o.order_id
       LEFT JOIN pets pt     ON pt.pet_id = oi.pet_id
       LEFT JOIN products pr ON pr.product_id = oi.product_id
       LEFT JOIN users s     ON s.user_id = oi.seller_id
       WHERE o.order_id = $1
       GROUP BY o.order_id, u.name, u.email, u.phone, p.status, p.method, p.reference_no, p.paid_at`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    const order = result.rows[0];
    // Buyer hanya bisa lihat pesanan sendiri
    if (req.user.role === "buyer" && order.buyer_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    return res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/stats  [Seller]
 * Ringkasan keuntungan seller: omzet kotor & bersih (sudah dipotong fee platform)
 */
const getSellerStats = async (req, res, next) => {
  try {
    const settings = await fetchSettings();
    const feePct = parseFloat(settings.platform_fee_percent) || 0;

    const result = await query(
      `SELECT o.status, COALESCE(SUM(oi.subtotal),0) AS gross, COUNT(DISTINCT o.order_id) AS order_count
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE oi.seller_id = $1
       GROUP BY o.status`,
      [req.user.user_id]
    );

    const byStatus = {};
    let grossDelivered = 0;
    let grossOnGoing = 0; // pending + processing + shipped (belum cair, masih potensi)
    let totalOrders = 0;

    result.rows.forEach(r => {
      const gross = parseFloat(r.gross);
      const count = parseInt(r.order_count);
      byStatus[r.status] = { gross, orders: count };
      totalOrders += count;
      if (r.status === "delivered") grossDelivered += gross;
      else if (["pending", "processing", "shipped"].includes(r.status)) grossOnGoing += gross;
    });

    const netDelivered = Math.round(grossDelivered * (1 - feePct / 100));
    const netOnGoing   = Math.round(grossOnGoing * (1 - feePct / 100));

    return res.json({
      success: true,
      data: {
        fee_percent: feePct,
        gross_delivered: grossDelivered,
        net_delivered: netDelivered,       // keuntungan yang sudah cair (pesanan selesai)
        gross_on_going: grossOnGoing,
        net_on_going: netOnGoing,          // estimasi keuntungan pesanan yang masih berjalan
        total_orders: totalOrders,
        by_status: byStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/orders  [Seller]
 */
const getSellerOrders = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { status } = req.query;
    const params = [req.user.user_id];
    let statusClause = "";
    if (status) { statusClause = `AND o.status = $2`; params.push(status); }

    const countRes = await query(
      `SELECT COUNT(DISTINCT o.order_id) FROM orders o
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE oi.seller_id = $1 ${statusClause}`, params
    );
    const dataRes = await query(
      `SELECT o.order_id, o.status, o.total_price, o.created_at,
              o.shipping_address, o.shipping_city, o.shipping_postal, o.notes,
              u.name AS buyer_name, u.email AS buyer_email, u.phone AS buyer_phone,
              p.method AS payment_method,
              JSON_AGG(JSON_BUILD_OBJECT(
                'item_type', oi.item_type,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'subtotal', oi.subtotal,
                'name', CASE WHEN oi.item_type='pet' THEN pt.pet_name ELSE pr.product_name END
              )) AS items
       FROM orders o
       JOIN users u ON u.user_id = o.buyer_id
       JOIN order_items oi ON oi.order_id = o.order_id AND oi.seller_id = $1
       LEFT JOIN pets pt     ON pt.pet_id = oi.pet_id
       LEFT JOIN products pr ON pr.product_id = oi.product_id
       LEFT JOIN payments p ON p.order_id = o.order_id
       WHERE oi.seller_id = $1 ${statusClause}
       GROUP BY o.order_id, u.name, u.email, u.phone, p.method
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
 * PUT /api/seller/orders/:id/status  [Seller]
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status harus salah satu: ${validStatuses.join(", ")}` });
    }

    // Pastikan seller punya item di order ini
    const check = await query(
      `SELECT COUNT(*) FROM order_items WHERE order_id = $1 AND seller_id = $2`,
      [req.params.id, req.user.user_id]
    );
    if (!parseInt(check.rows[0].count)) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki item di pesanan ini." });
    }

    const result = await query(
      `UPDATE orders SET status = $1 WHERE order_id = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    return res.json({ success: true, message: "Status pesanan diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getMyOrders, getOrderById, getSellerOrders, getSellerStats, updateOrderStatus };