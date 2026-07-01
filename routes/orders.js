const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus,
} = require("../controllers/orderController");
const { authenticate, isBuyer, isSeller } = require("../middleware/auth");

// ─── BUYER ────────────────────────────────────────────────────────────────────
// POST /api/orders          - buat pesanan (checkout)
router.post("/", authenticate, isBuyer, createOrder);

// GET  /api/orders          - riwayat pesanan buyer
router.get("/", authenticate, isBuyer, getMyOrders);

// GET  /api/orders/:id      - detail pesanan (buyer own / admin via adminController)
router.get("/:id", authenticate, getOrderById);

// ─── SELLER ───────────────────────────────────────────────────────────────────
// GET  /api/seller/orders                   - lihat pesanan masuk seller
// PUT  /api/seller/orders/:id/status        - update status pesanan
// (didaftarkan di routes/seller.js)

module.exports = router;
