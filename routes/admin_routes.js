const express = require("express");
const router = express.Router();
const {
  getDashboard, getUsers, updateUser, deleteUser,
  getOrders, updateOrderStatus, getAllProducts, getAllPets, getAdminEarnings,
} = require("../controllers/adminController");
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { authenticate, isAdmin } = require("../middleware/auth");

router.use(authenticate, isAdmin);

router.get("/dashboard",          getDashboard);
router.get("/earnings",           getAdminEarnings);
router.get("/users",              getUsers);
router.put("/users/:id",          updateUser);
router.delete("/users/:id",       deleteUser);
router.get("/orders",             getOrders);
router.put("/orders/:id/status",  updateOrderStatus);
router.get("/products",           getAllProducts);
router.get("/pets",               getAllPets);

// ─── Settings ───────────────────────────────────────────────────
router.get("/settings",           getSettings);
router.put("/settings",           updateSettings);

module.exports = router;
