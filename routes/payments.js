const express = require("express");
const router = express.Router();
const { getPayment, updatePayment, getPaymentByOrder } = require("../controllers/paymentController");
const { authenticate, isAdmin } = require("../middleware/auth");

router.use(authenticate);

// GET /api/payments/order/:orderId  - cek payment berdasarkan order
router.get("/order/:orderId", getPaymentByOrder);

// GET /api/payments/:id
router.get("/:id", getPayment);

// PUT /api/payments/:id  - update status (admin / payment gateway webhook)
router.put("/:id", isAdmin, updatePayment);

module.exports = router;
