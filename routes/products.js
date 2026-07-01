const express = require("express");
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require("../controllers/productController");
const { authenticate, isSeller, isSellerOrAdmin } = require("../middleware/auth");

// GET  /api/products       - public
router.get("/", getProducts);

// GET  /api/products/:id   - public
router.get("/:id", getProductById);

// POST /api/products       - seller only
router.post("/", authenticate, isSeller, createProduct);

// PUT  /api/products/:id   - seller (own) / admin
router.put("/:id", authenticate, isSellerOrAdmin, updateProduct);

// DELETE /api/products/:id - seller (own) / admin
router.delete("/:id", authenticate, isSellerOrAdmin, deleteProduct);

module.exports = router;
