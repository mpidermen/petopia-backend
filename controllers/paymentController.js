const { query } = require("../config/database");

/**
 * GET /api/payments/:id  [Buyer own / Admin]
 */
const getPayment = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pm.*, o.buyer_id, o.total_price, o.status AS order_status
       FROM payments pm
       JOIN orders o ON o.order_id = pm.order_id
       WHERE pm.payment_id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Data pembayaran tidak ditemukan." });
    }
    const payment = result.rows[0];
    if (req.user.role === "buyer" && payment.buyer_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    return res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/payments/:id  [Admin / sistem pembayaran]
 * Update status pembayaran
 */
const updatePayment = async (req, res, next) => {
  try {
    const { status, reference_no } = req.body;
    const validStatuses = ["unpaid", "paid", "failed", "refunded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status harus salah satu: ${validStatuses.join(", ")}` });
    }

    const paid_at = status === "paid" ? new Date() : null;

    const result = await query(
      `UPDATE payments
       SET status = $1, reference_no = COALESCE($2, reference_no), paid_at = $3
       WHERE payment_id = $4 RETURNING *`,
      [status, reference_no || null, paid_at, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Pembayaran tidak ditemukan." });
    }

    // Jika paid, ubah status order ke processing
    if (status === "paid") {
      await query(
        `UPDATE orders SET status = 'processing'
         WHERE order_id = $1 AND status = 'pending'`,
        [result.rows[0].order_id]
      );
    }

    return res.json({ success: true, message: "Status pembayaran diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/payments/order/:orderId  [Buyer own / Admin]
 */
const getPaymentByOrder = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pm.*, o.buyer_id FROM payments pm
       JOIN orders o ON o.order_id = pm.order_id
       WHERE pm.order_id = $1`,
      [req.params.orderId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Data pembayaran tidak ditemukan." });
    }
    const payment = result.rows[0];
    if (req.user.role === "buyer" && payment.buyer_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    return res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayment, updatePayment, getPaymentByOrder };
