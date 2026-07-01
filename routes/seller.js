const express = require("express");
const router = express.Router();
const { getMyPets } = require("../controllers/petController");
const { getMyProducts } = require("../controllers/productController");
const { getSellerOrders, updateOrderStatus, getSellerStats } = require("../controllers/orderController");
const { authenticate, isSeller } = require("../middleware/auth");

// Semua seller routes butuh auth seller
router.use(authenticate, isSeller);

// GET /api/seller/pets
router.get("/pets", getMyPets);

// GET /api/seller/products
router.get("/products", getMyProducts);

// GET /api/seller/stats
router.get("/stats", getSellerStats);

// GET /api/seller/orders
router.get("/orders", getSellerOrders);

// PUT /api/seller/orders/:id/status
router.put("/orders/:id/status", updateOrderStatus);

module.exports = router;
