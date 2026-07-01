/**
 * POST /api/upload/image
 * Upload satu file gambar (avatar / foto produk / foto hewan).
 * Field form-data: "image"
 */
const uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Tidak ada file yang diupload." });
  }
  const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  return res.status(201).json({
    success: true,
    message: "File berhasil diupload.",
    data: { url, filename: req.file.filename },
  });
};

module.exports = { uploadImage };
