const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Folder penyimpanan file upload (disajikan secara statis lewat /uploads di app.js)
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const allowedTypes = /jpeg|jpg|png|webp|gif/;

const fileFilter = (req, file, cb) => {
  const extOk = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = allowedTypes.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  cb(new Error("Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // maks 5MB
});

module.exports = { upload, UPLOAD_DIR };
