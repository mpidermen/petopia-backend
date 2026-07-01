const express = require("express");
const router = express.Router();
const { getCategories, createCategory } = require("../controllers/categoryController");
const { authenticate, isAdmin } = require("../middleware/auth");

// GET  /api/categories  - public
router.get("/", getCategories);

// POST /api/categories  - admin only
router.post("/", authenticate, isAdmin, createCategory);

module.exports = router;
