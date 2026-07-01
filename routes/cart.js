const express = require("express");
const router = express.Router();
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require("../controllers/cartController");
const { authenticate, isBuyer } = require("../middleware/auth");

// Semua cart routes butuh auth buyer
router.use(authenticate, isBuyer);

// GET    /api/cart              - lihat isi cart
router.get("/", getCart);

// POST   /api/cart              - tambah item ke cart
router.post("/", addToCart);

// PUT    /api/cart/:itemId      - update quantity
router.put("/:itemId", updateCartItem);

// DELETE /api/cart              - kosongkan semua cart
router.delete("/", clearCart);

// DELETE /api/cart/:itemId      - hapus satu item
router.delete("/:itemId", removeFromCart);

module.exports = router;
