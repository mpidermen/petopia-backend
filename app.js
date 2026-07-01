require("dotenv").config();
const path    = require("path");
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const { errorHandler, notFound } = require("./middleware/errorHandler");

// Routes
const authRoutes       = require("./routes/auth");
const userRoutes       = require("./routes/users");
const categoryRoutes   = require("./routes/categories");
const petRoutes        = require("./routes/pets");
const productRoutes    = require("./routes/products");
const cartRoutes       = require("./routes/cart");
const orderRoutes      = require("./routes/orders");
const sellerRoutes     = require("./routes/seller");
const paymentRoutes    = require("./routes/payments");
const reviewRoutes     = require("./routes/reviews");
const adminRoutes      = require("./routes/admin_routes");
const uploadRoutes     = require("./routes/upload");

// Public settings route (tidak butuh auth, untuk buyer lihat ongkir dll)
const { getSettings }  = require("./controllers/settingsController");

const app = express();

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
// crossOriginResourcePolicy dilonggarkan supaya file di /uploads bisa dimuat
// dari origin frontend yang berbeda (mis. localhost:5173 -> localhost:5000).
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── REQUEST PARSING ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── FILE UPLOAD STATIC FOLDER ────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── LOGGING ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🐾 Petopia API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    docs: `${req.protocol}://${req.get("host")}/api`,
  });
});

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Petopia REST API v1.0",
    endpoints: {
      auth:       "/api/auth",
      users:      "/api/users",
      categories: "/api/categories",
      pets:       "/api/pets",
      products:   "/api/products",
      cart:       "/api/cart",
      orders:     "/api/orders",
      seller:     "/api/seller",
      payments:   "/api/payments",
      reviews:    "/api/reviews",
      admin:      "/api/admin",
      upload:     "/api/upload",
    },
  });
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoutes);
app.use("/api/users",      userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/pets",       petRoutes);
app.use("/api/products",   productRoutes);
app.use("/api/cart",       cartRoutes);
app.use("/api/orders",     orderRoutes);
app.use("/api/seller",     sellerRoutes);
app.use("/api/payments",   paymentRoutes);
app.use("/api/reviews",    reviewRoutes);
app.use("/api/admin",      adminRoutes);
app.use("/api/upload",     uploadRoutes);
app.get("/api/settings",   getSettings);   // public: ongkir & fee untuk buyer

// ─── ERROR HANDLERS ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
