const express = require("express");
const router = express.Router();
const { getPets, getPetById, createPet, updatePet, deletePet } = require("../controllers/petController");
const { authenticate, isSeller, isSellerOrAdmin } = require("../middleware/auth");

// GET  /api/pets         - public
router.get("/", getPets);

// GET  /api/pets/:id     - public
router.get("/:id", getPetById);

// POST /api/pets         - seller only
router.post("/", authenticate, isSeller, createPet);

// PUT  /api/pets/:id     - seller (own) / admin
router.put("/:id", authenticate, isSellerOrAdmin, updatePet);

// DELETE /api/pets/:id   - seller (own) / admin
router.delete("/:id", authenticate, isSellerOrAdmin, deletePet);

module.exports = router;
