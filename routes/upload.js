const express = require("express");
const router = express.Router();
const { upload } = require("../middleware/upload");
const { uploadImage } = require("../controllers/uploadController");
const { authenticate } = require("../middleware/auth");

// Semua route upload butuh login (buyer/seller/admin boleh upload avatar;
// upload foto produk/hewan praktiknya dipakai seller, tapi tidak dibatasi di sini
// karena endpoint ini generik untuk semua jenis gambar termasuk avatar).
router.use(authenticate);

// POST /api/upload/image  (form-data, field "image")
router.post("/image", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || "Gagal mengupload file." });
    }
    next();
  });
}, uploadImage);

module.exports = router;
