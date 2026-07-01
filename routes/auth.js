const express = require("express");
const router = express.Router();
const { register, login, me } = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/me
router.get("/me", authenticate, me);

module.exports = router;
