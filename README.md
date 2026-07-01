# 🐾 Petopia Backend API

Backend REST API untuk marketplace hewan peliharaan **Petopia**, dibangun dengan Node.js, Express.js, dan PostgreSQL.

---

## 📋 Tech Stack

| Teknologi | Versi | Kegunaan |
|-----------|-------|----------|
| Node.js   | ≥18.x | Runtime  |
| Express.js | ^4.19 | Web framework |
| PostgreSQL | ≥14   | Database |
| JWT       | ^9.0  | Autentikasi |
| bcryptjs  | ^2.4  | Hash password |
| pg        | ^8.12 | PostgreSQL client |
| helmet    | ^7.1  | Security headers |
| cors      | ^2.8  | Cross-Origin |
| morgan    | ^1.10 | HTTP logging |

---

## 🚀 Cara Menjalankan

### 1. Prasyarat

Pastikan sudah terinstall:
- **Node.js** v18 atau lebih baru → [nodejs.org](https://nodejs.org)
- **PostgreSQL** v14 atau lebih baru → [postgresql.org](https://www.postgresql.org/download/)

---

### 2. Setup Project

```bash
# Clone / extract project
cd petopia-backend

# Install dependencies
npm install
```

---

### 3. Setup Database PostgreSQL

#### Buka psql atau pgAdmin, lalu buat database:

```sql
CREATE DATABASE petopia_db;
```

Atau via terminal:
```bash
psql -U postgres -c "CREATE DATABASE petopia_db;"
```

---

### 4. Konfigurasi Environment

```bash
# Salin file .env.example menjadi .env
cp .env.example .env
```

Buka `.env` dan sesuaikan:

```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=petopia_db
DB_USER=postgres
DB_PASSWORD=password_postgresql_kamu

JWT_SECRET=petopia_rahasia_panjang_minimal_32_karakter
JWT_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
BCRYPT_ROUNDS=12
```

---

### 5. Migrasi Database (Buat Tabel)

```bash
npm run db:migrate
```

Output yang diharapkan:
```
🚀 Memulai migrasi database...
✅ Enum types dibuat
✅ Tabel users dibuat
✅ Tabel categories dibuat
✅ Tabel pets dibuat
✅ Tabel products dibuat
✅ Tabel cart & cart_items dibuat
✅ Tabel orders & order_items dibuat
✅ Tabel payments dibuat
✅ Tabel reviews dibuat
✅ Triggers updated_at dibuat
🎉 Migrasi selesai!
```

---

### 6. Seed Data (Data Awal)

```bash
npm run db:seed
```

Akan membuat akun demo:

| Role   | Email                 | Password     |
|--------|-----------------------|--------------|
| Admin  | admin@petopia.id      | admin123     |
| Seller | seller@gmail.com      | password123  |
| Seller | paradise@gmail.com    | password123  |
| Buyer  | budi@gmail.com        | password123  |
| Buyer  | siti@gmail.com        | password123  |

---

### 7. Jalankan Server

```bash
# Mode development (auto-restart)
npm run dev

# Mode production
npm start
```

Server berjalan di: **http://localhost:5000**

---

## 📁 Struktur Folder

```
petopia-backend/
├── config/
│   ├── database.js        ← Koneksi PostgreSQL (pool)
│   ├── migrate.js         ← Script buat semua tabel
│   └── seed.js            ← Script data awal
├── controllers/
│   ├── authController.js      ← Register, Login, Me
│   ├── userController.js      ← Profile
│   ├── categoryController.js  ← Kategori produk
│   ├── petController.js       ← CRUD hewan
│   ├── productController.js   ← CRUD produk
│   ├── cartController.js      ← Keranjang belanja
│   ├── orderController.js     ← Pesanan & checkout
│   ├── paymentController.js   ← Pembayaran
│   ├── reviewController.js    ← Ulasan
│   └── adminController.js     ← Dashboard admin
├── middleware/
│   ├── auth.js            ← JWT verify + role guard
│   └── errorHandler.js    ← Error handler & helpers
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── categories.js
│   ├── pets.js
│   ├── products.js
│   ├── cart.js
│   ├── orders.js
│   ├── seller.js
│   ├── payments.js
│   ├── reviews.js
│   └── admin.js
├── app.js                 ← Express setup & middleware
├── server.js              ← Entry point & graceful shutdown
├── .env.example
├── .gitignore
└── package.json
```

---

## 🗄️ Skema Database

```
users          → user_id (UUID), name, email, password, phone, role, avatar_url, is_active
categories     → category_id (serial), name, icon, description
pets           → pet_id (UUID), seller_id, pet_name, species, breed, age_month, gender, price, stock, image_url
products       → product_id (UUID), seller_id, category_id, product_name, description, price, stock, image_url
cart           → cart_id (UUID), buyer_id (1-to-1 with users)
cart_items     → item_id, cart_id, item_type (pet|product), pet_id, product_id, quantity
orders         → order_id (UUID), buyer_id, status, total_price, shipping_address
order_items    → order_item_id, order_id, item_type, pet_id, product_id, seller_id, quantity, unit_price, subtotal (generated)
payments       → payment_id (UUID), order_id, amount, method, status, reference_no, paid_at
reviews        → review_id (UUID), reviewer_id, order_id, item_type, pet_id, product_id, rating, comment
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register       Daftar akun baru
POST   /api/auth/login          Login
GET    /api/auth/me             Info user saat ini (🔒)
```

### Users
```
GET    /api/users/profile       Lihat profil (🔒)
PUT    /api/users/profile       Update profil (🔒)
```

### Categories
```
GET    /api/categories          Semua kategori (public)
POST   /api/categories          Buat kategori (🔒 Admin)
```

### Pets (Hewan)
```
GET    /api/pets                List hewan (public) ?species=&search=&min_price=&sort=
GET    /api/pets/:id            Detail hewan (public)
POST   /api/pets                Tambah hewan (🔒 Seller)
PUT    /api/pets/:id            Edit hewan (🔒 Seller/Admin)
DELETE /api/pets/:id            Hapus hewan (🔒 Seller/Admin)
```

### Products (Produk)
```
GET    /api/products            List produk (public) ?category_id=&search=&sort=
GET    /api/products/:id        Detail produk (public)
POST   /api/products            Tambah produk (🔒 Seller)
PUT    /api/products/:id        Edit produk (🔒 Seller/Admin)
DELETE /api/products/:id        Hapus produk (🔒 Seller/Admin)
```

### Cart (Keranjang)
```
GET    /api/cart                Lihat keranjang (🔒 Buyer)
POST   /api/cart                Tambah item (🔒 Buyer)
PUT    /api/cart/:itemId        Update quantity (🔒 Buyer)
DELETE /api/cart/:itemId        Hapus satu item (🔒 Buyer)
DELETE /api/cart                Kosongkan keranjang (🔒 Buyer)
```

### Orders (Pesanan)
```
POST   /api/orders              Checkout / buat pesanan (🔒 Buyer)
GET    /api/orders              Riwayat pesanan buyer (🔒 Buyer)
GET    /api/orders/:id          Detail pesanan (🔒 Buyer/Admin)
```

### Seller
```
GET    /api/seller/pets                  Hewan milik seller (🔒 Seller)
GET    /api/seller/products              Produk milik seller (🔒 Seller)
GET    /api/seller/orders                Pesanan masuk (🔒 Seller)
PUT    /api/seller/orders/:id/status     Update status pesanan (🔒 Seller)
```

### Payments (Pembayaran)
```
GET    /api/payments/:id            Detail pembayaran (🔒)
GET    /api/payments/order/:orderId  Pembayaran by order (🔒)
PUT    /api/payments/:id            Update status bayar (🔒 Admin)
```

### Reviews (Ulasan)
```
POST   /api/reviews                  Buat ulasan (🔒 Buyer)
GET    /api/reviews/product/:id      Ulasan produk (public)
GET    /api/reviews/pet/:id          Ulasan hewan (public)
```

### Admin
```
GET    /api/admin/dashboard          Statistik platform (🔒 Admin)
GET    /api/admin/users              Semua user (🔒 Admin)
PUT    /api/admin/users/:id          Update role/status user (🔒 Admin)
DELETE /api/admin/users/:id          Nonaktifkan user (🔒 Admin)
GET    /api/admin/orders             Semua pesanan (🔒 Admin)
PUT    /api/admin/orders/:id/status  Update status pesanan (🔒 Admin)
```

---

## 🔐 Autentikasi

Gunakan **Bearer Token** di header:

```
Authorization: Bearer <token_dari_login>
```

---

## 📬 Contoh Request

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "secret123",
    "phone": "08123456789",
    "role": "buyer"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "budi@gmail.com", "password": "password123"}'
```

### Get Pets (dengan filter)
```bash
curl "http://localhost:5000/api/pets?species=Kucing&sort=price_asc&page=1&limit=8"
```

### Tambah ke Cart
```bash
curl -X POST http://localhost:5000/api/cart \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"item_type": "pet", "pet_id": "<uuid>", "quantity": 1}'
```

### Checkout
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_address": "Jl. Merpati No. 10",
    "shipping_city": "Jakarta",
    "shipping_postal": "12345",
    "payment_method": "transfer"
  }'
```

---

## ⚠️ Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `ECONNREFUSED` | PostgreSQL belum jalan. Jalankan service PostgreSQL. |
| `password authentication failed` | Cek `DB_USER` dan `DB_PASSWORD` di `.env` |
| `database does not exist` | Buat database: `CREATE DATABASE petopia_db;` |
| `relation does not exist` | Jalankan migrasi dulu: `npm run db:migrate` |
| `TokenExpiredError` | Login ulang untuk mendapatkan token baru |
| Port 5000 sudah dipakai | Ganti `PORT=5001` di `.env` |

---

## 🔗 Integrasi dengan Frontend

Di file `.env` frontend Petopia, ubah:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 📄 Lisensi

MIT © Petopia Team
