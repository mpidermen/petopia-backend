const express = require("express");
const router = express.Router();
const { createReview, getProductReviews, getPetReviews, getMyReviews } = require("../controllers/reviewController");
const { authenticate, isBuyer } = require("../middleware/auth");

// GET /api/reviews/product/:id  - public
router.get("/product/:id", getProductReviews);

// GET /api/reviews/pet/:id      - public
router.get("/pet/:id", getPetReviews);

// GET /api/reviews/mine         - buyer: set item yang sudah diulas
router.get("/mine", authenticate, isBuyer, getMyReviews);

// POST /api/reviews             - buyer only
router.post("/", authenticate, isBuyer, createReview);

module.exports = router;