const express = require("express");
const router = express.Router();
const { getProfile, updateProfile } = require("../controllers/userController");
const { authenticate } = require("../middleware/auth");

// Semua route users butuh auth
router.use(authenticate);

// GET  /api/users/profile
router.get("/profile", getProfile);

// PUT  /api/users/profile
router.put("/profile", updateProfile);

module.exports = router;
