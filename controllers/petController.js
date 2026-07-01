const { query } = require("../config/database");
const { paginate, paginatedResponse } = require("../middleware/errorHandler");

/**
 * GET /api/pets
 * Query params: species, breed, gender, min_price, max_price, search, seller_id, page, limit, sort
 */
const getPets = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const { species, breed, gender, min_price, max_price, search, seller_id, sort } = req.query;

    const conditions = ["p.is_active = TRUE"];
    const params = [];
    let idx = 1;

    if (species)    { conditions.push(`p.species ILIKE $${idx++}`);    params.push(`%${species}%`); }
    if (breed)      { conditions.push(`p.breed ILIKE $${idx++}`);      params.push(`%${breed}%`); }
    if (gender)     { conditions.push(`p.gender = $${idx++}`);         params.push(gender); }
    if (min_price)  { conditions.push(`p.price >= $${idx++}`);         params.push(min_price); }
    if (max_price)  { conditions.push(`p.price <= $${idx++}`);         params.push(max_price); }
    if (seller_id)  { conditions.push(`p.seller_id = $${idx++}`);      params.push(seller_id); }
    if (search)     { conditions.push(`p.pet_name ILIKE $${idx++}`);   params.push(`%${search}%`); }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const sortMap = {
      "price_asc":  "p.price ASC",
      "price_desc": "p.price DESC",
      "newest":     "p.created_at DESC",
      "rating":     "avg_rating DESC NULLS LAST",
    };
    const orderBy = sortMap[sort] || "p.created_at DESC";

    const countRes = await query(`SELECT COUNT(*) FROM pets p ${where}`, params);
    const total = countRes.rows[0].count;

    const dataRes = await query(
      `SELECT
         p.*,
         u.name AS seller_name,
         ROUND(AVG(r.rating), 1) AS avg_rating,
         COUNT(DISTINCT r.review_id) AS review_count
       FROM pets p
       JOIN users u ON u.user_id = p.seller_id
       LEFT JOIN reviews r ON r.pet_id = p.pet_id
       ${where}
       GROUP BY p.pet_id, u.name
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return paginatedResponse(res, { rows: dataRes.rows, total, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pets/:id
 */
const getPetById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         p.*,
         u.name AS seller_name,
         u.avatar_url AS seller_avatar,
         u.phone AS seller_phone,
         ROUND(AVG(r.rating), 1) AS avg_rating,
         COUNT(DISTINCT r.review_id) AS review_count
       FROM pets p
       JOIN users u ON u.user_id = p.seller_id
       LEFT JOIN reviews r ON r.pet_id = p.pet_id
       WHERE p.pet_id = $1 AND p.is_active = TRUE
       GROUP BY p.pet_id, u.name, u.avatar_url, u.phone`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Hewan tidak ditemukan." });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pets  [Seller only]
 */
const createPet = async (req, res, next) => {
  try {
    const { pet_name, species, breed, age_month, gender, price, stock, image_url, description } = req.body;
    if (!pet_name || !species || !gender || !price) {
      return res.status(400).json({ success: false, message: "pet_name, species, gender, price wajib diisi." });
    }
    if (!["Jantan", "Betina"].includes(gender)) {
      return res.status(400).json({ success: false, message: "Gender harus 'Jantan' atau 'Betina'." });
    }

    const result = await query(
      `INSERT INTO pets (seller_id, pet_name, species, breed, age_month, gender, price, stock, image_url, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.user_id, pet_name, species, breed || null, age_month || 0, gender, price, stock || 0, image_url || null, description || null]
    );
    return res.status(201).json({ success: true, message: "Hewan berhasil ditambahkan.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/pets/:id  [Seller own pet / Admin]
 */
const updatePet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pet = await query(`SELECT seller_id FROM pets WHERE pet_id = $1`, [id]);
    if (!pet.rows.length) {
      return res.status(404).json({ success: false, message: "Hewan tidak ditemukan." });
    }
    if (req.user.role !== "admin" && pet.rows[0].seller_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki akses ke hewan ini." });
    }

    const { pet_name, species, breed, age_month, gender, price, stock, image_url, description, is_active } = req.body;
    const result = await query(
      `UPDATE pets SET
        pet_name    = COALESCE($1, pet_name),
        species     = COALESCE($2, species),
        breed       = COALESCE($3, breed),
        age_month   = COALESCE($4, age_month),
        gender      = COALESCE($5::pet_gender, gender),
        price       = COALESCE($6, price),
        stock       = COALESCE($7, stock),
        image_url   = COALESCE($8, image_url),
        description = COALESCE($9, description),
        is_active   = COALESCE($10, is_active)
       WHERE pet_id = $11 RETURNING *`,
      [pet_name||null, species||null, breed||null, age_month||null, gender||null, price||null, stock||null, image_url||null, description||null, is_active??null, id]
    );
    return res.json({ success: true, message: "Hewan berhasil diperbarui.", data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/pets/:id  [Seller own pet / Admin] - soft delete
 */
const deletePet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pet = await query(`SELECT seller_id FROM pets WHERE pet_id = $1`, [id]);
    if (!pet.rows.length) {
      return res.status(404).json({ success: false, message: "Hewan tidak ditemukan." });
    }
    if (req.user.role !== "admin" && pet.rows[0].seller_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Akses ditolak." });
    }
    await query(`UPDATE pets SET is_active = FALSE WHERE pet_id = $1`, [id]);
    return res.json({ success: true, message: "Hewan berhasil dihapus." });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/seller/pets  [Seller own pets]
 */
const getMyPets = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req);
    const countRes = await query(`SELECT COUNT(*) FROM pets WHERE seller_id = $1 AND is_active = TRUE`, [req.user.user_id]);
    const dataRes  = await query(
      `SELECT p.*, ROUND(AVG(r.rating),1) AS avg_rating, COUNT(DISTINCT r.review_id) AS review_count
      FROM pets p
      LEFT JOIN reviews r ON r.pet_id = p.pet_id
      WHERE p.seller_id = $1 AND p.is_active = TRUE
      GROUP BY p.pet_id
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3`,
      [req.user.user_id, limit, offset]
    );
    return paginatedResponse(res, { rows: dataRes.rows, total: countRes.rows[0].count, page, limit });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPets, getPetById, createPet, updatePet, deletePet, getMyPets };
