# API Reference — Backend Asrama Mahasiswa Kepri (Yogyakarta)

Dokumentasi seluruh endpoint HTTP: izin yang dibutuhkan, tujuan, input, dan **contoh respons**.

- Sumber: `src/routes/**`, `src/controller/**`, `src/validations/**`, `src/repositories/**`, `src/middleware/permission.ts`, [`plan.md`](./plan.md), [`erd.md`](./erd.md).
- Total: **148 endpoint** pada **24 modul** (di bawah prefix `/api`) + `GET /api/health`.
- Sifat: **dokumentasi manual**. Bila menambah/mengubah route, perbarui file ini.

> **Catatan contoh:** nilai `id`/`code`/waktu disederhanakan (`bld-1`, `usr-1`, `2026-10-19T…`) demi keterbacaan; di sistem sebenarnya berupa UUID/ISO-8601. Objek `User` selalu **tanpa field `password`** (lihat [Lampiran E](#lampiran-e--bentuk-objek-user-publik)).

---

## 1. Konvensi umum

| Aspek           | Keterangan                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Base URL        | `http://localhost:8080/api` (dev)                                                              |
| Format          | JSON, kecuali upload (multipart) & ekspor laporan (CSV)                                        |
| Autentikasi     | `Authorization: Bearer <JWT>` (masa berlaku 24 jam)                                            |
| Envelope sukses | `{ "status": "<pesan>", "data": <objek/array> }`                                               |
| Envelope error  | `AppError` → `{ "status": "<pesan>" }` · Zod → `{ "status": "validation error", "errors": [...] }` · 404 → `{ "status": "not found" }` |
| Izin            | Tiap route non-publik dijaga `requirePermission(resource, action)`; **default-deny**           |
| SUPER_ADMIN     | Melewati semua pemeriksaan izin & scope gedung                                                 |
| Scope gedung    | `UserRole.buildingId` (null = semua gedung). Endpoint ber-scope memakai `resolveBuildingScope` |
| Soft delete     | Semua tabel mutable; yang **immutable**: `LedgerEntry`, `PaymentAllocation`, `ElectionVote`, `ElectionResult`, `AuditLog` |
| Uang            | Integer IDR (tanpa desimal)                                                                    |
| Idempotensi     | Operasi keuangan memakai `idempotencyKey`                                                       |
| Rate limit auth | 20 request / 15 menit / IP pada `/auth/{register,login,request-otp,verify-otp}`                 |

**Kode status umum**: `200` sukses · `201` dibuat · `400` validasi/permintaan salah · `401` belum login · `403` tidak punya izin/scope · `404` tidak ditemukan · `409` konflik · `500` kesalahan server.

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@gmail.com", "password": "Sewdaq123" }
```

```json
{
  "status": "login okay",
  "data": {
    "user": { "id": "usr-1", "email": "admin@gmail.com" },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
  }
}
```

---

## 2. Ringkasan modul

| Modul                  | Prefix                  | Jml | Menu terkait              |
| ---------------------- | ----------------------- | --- | ------------------------- |
| [Auth](#3-auth)        | `/auth`                 | 5   | –                         |
| [RBAC](#4-rbac)        | `/rbac`                 | 9   | `system.*`                |
| [Gedung](#5-gedung)    | `/buildings`            | 4   | `master.building`         |
| [Kamar](#6-kamar)      | `/rooms`                | 4   | `master.room`             |
| [Aturan Biaya](#7-aturan-biaya) | `/fee-rules`   | 3   | `master.feeRule`          |
| [Fasilitas](#8-fasilitas) | `/facilities`        | 6   | `master.roomFacility`     |
| [Fasilitas Umum](#9-fasilitas-umum) | `/public-facilities` | 7 | `master.publicFacility`   |
| [Penghuni](#10-penghuni) | `/residents`          | 7   | `resident.*`              |
| [Dokumen](#11-dokumen) | `/documents`            | 8   | `resident.document`, `me.document` |
| [Penempatan](#12-penempatan) | `/occupancies`    | 3   | `resident.occupancy`      |
| [Tagihan](#13-tagihan) | `/invoices`             | 4   | `finance.invoice`         |
| [Pembayaran](#14-pembayaran) | `/payments`       | 3   | `finance.payment`         |
| [Pembayaran Mandiri](#15-pembayaran-mandiri-warga) | `/me` | 6 | `me.invoice`, `me.payment` |
| [Verifikasi Pembayaran](#16-verifikasi-pembayaran) | `/payment-submissions` | 3 | `finance.payment` |
| [Akun Kas](#17-akun-kas) | `/cash-accounts`      | 7   | `finance.cash`            |
| [Kategori](#18-kategori) | `/categories`         | 4   | `master.category`         |
| [Pengeluaran](#19-pengeluaran) | `/expenses`     | 3   | `finance.expense`         |
| [Buku Kas](#20-buku-kas) | `/ledger`             | 3   | `finance.cash`            |
| [Kegiatan](#21-kegiatan) | `/events`             | 21  | `event.*`                 |
| [Pemilihan](#22-pemilihan) | `/elections`         | 15  | `election.*`              |
| [Organisasi](#23-organisasi) | `/organization`    | 14  | `organization.*`          |
| [Laporan](#24-laporan) | `/reports`              | 6   | `finance.report`          |
| [Audit](#25-audit)     | `/audit-logs`           | 2   | `system.audit`            |
| [File](#26-file)       | `/files`                | 1   | –                         |
| [Health](#27-health)   | `/health`               | 1   | –                         |

---

## 3. Auth

Registrasi, verifikasi OTP, dan sesi. **Semua publik** kecuali `/auth/me`.

| Method | Path                | Izin | Tujuan                                                                 |
| ------ | ------------------- | ---- | ---------------------------------------------------------------------- |
| POST   | `/auth/register`    | –    | Daftar akun baru (email + password), beri role `CALON_PENGHUNI`, kirim OTP |
| POST   | `/auth/verify-otp`  | –    | Verifikasi OTP → tandai `emailVerified` + kembalikan JWT               |
| POST   | `/auth/request-otp` | –    | Kirim ulang OTP ke email                                               |
| POST   | `/auth/login`       | –    | Login → JWT (wajib `emailVerified`)                                    |
| GET    | `/auth/me`          | auth | Profil ringkas user yang sedang login (`id`, `email`)                  |

**Body**: `register` `{ email, password(min 8) }` · `verify-otp` `{ email, otp(6) }` · `request-otp` `{ email }` · `login` `{ email, password }`

**Contoh respons**

```json
// POST /api/auth/register → 201
{ "status": "register okay, check your email for otp", "data": { "user": { "id": "usr-9", "email": "calon@gmail.com" } } }
```

```json
// POST /api/auth/verify-otp → 200
{ "status": "otp verified", "data": { "verified": true, "user": { "id": "usr-9", "email": "calon@gmail.com" }, "token": "eyJhbGci…" } }
```

```json
// POST /api/auth/request-otp → 200
{ "status": "otp sent", "data": { "sent": true } }
```

```json
// POST /api/auth/login → 200
{ "status": "login okay", "data": { "user": { "id": "usr-1", "email": "admin@gmail.com" }, "token": "eyJhbGci…" } }
```

```json
// GET /api/auth/me → 200
{ "status": "me okay", "data": { "id": "usr-1", "email": "admin@gmail.com" } }
```

---

## 4. RBAC

Kelola role, permission, menu, dan penugasan role ke user (dengan scope gedung).

| Method | Path                          | Izin          | Tujuan                                              |
| ------ | ----------------------------- | ------------- | --------------------------------------------------- |
| GET    | `/rbac/roles`                 | `role.READ`   | Daftar role                                         |
| POST   | `/rbac/roles`                 | `role.CREATE` | Buat role                                           |
| PATCH  | `/rbac/roles/:id`             | `role.UPDATE` | Ubah role (nama, deskripsi, aktif)                  |
| DELETE | `/rbac/roles/:id`             | `role.DELETE` | Nonaktifkan (soft delete) role                      |
| PUT    | `/rbac/roles/:id/permissions` | `role.UPDATE` | Tetapkan daftar permission ke role                  |
| PUT    | `/rbac/roles/:id/menus`       | `role.UPDATE` | Tetapkan daftar menu ke role                        |
| POST   | `/rbac/assign`                | `role.UPDATE` | Beri role ke user (opsional `buildingId` scope)     |
| DELETE | `/rbac/user-roles/:id`        | `role.UPDATE` | Cabut penugasan role dari user                      |
| GET    | `/rbac/me`                    | auth (self)   | Akses efektif user login: roles, permissions, menus, buildings |

**Body**: `roles` `{ code, name, description? }` · `permissions` `{ permissionIds[] }` · `menus` `{ menuIds[] }` · `assign` `{ userId, roleId, buildingId? }`

**Contoh respons**

```json
// GET /api/rbac/roles → 200
{
  "status": "ok",
  "data": [
    { "id": "role-1", "code": "ADMIN_GEDUNG", "name": "Admin Gedung", "description": null, "isSystem": false, "isActive": true, "createdAt": "2026-10-16T21:27:39.629Z", "updatedAt": "2026-10-18T23:21:19.062Z", "deletedAt": null }
  ]
}
```

```json
// POST /api/rbac/roles → 201
{ "status": "role created", "data": { "id": "role-5", "code": "BENDAHARA", "name": "Bendahara", "description": null, "isSystem": false, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// PATCH /api/rbac/roles/:id → 200
{ "status": "role updated", "data": { "id": "role-5", "code": "BENDAHARA", "name": "Bendahara Asrama", "description": null, "isSystem": false, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/rbac/roles/:id → 200
{ "status": "role deleted" }
```

```json
// PUT /api/rbac/roles/:id/permissions → 200
{ "status": "permissions set", "data": { "roleId": "role-5", "count": 12 } }
```

```json
// PUT /api/rbac/roles/:id/menus → 200
{ "status": "menus set", "data": { "roleId": "role-5", "count": 8 } }
```

```json
// POST /api/rbac/assign → 201
{ "status": "role assigned", "data": { "id": "urole-1", "userId": "usr-2", "roleId": "role-1", "buildingId": "bld-1", "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/rbac/user-roles/:id → 200
{ "status": "role revoked" }
```

```json
// GET /api/rbac/me → 200
{
  "status": "ok",
  "data": {
    "roles": ["ADMIN_GEDUNG"],
    "permissions": ["room.CREATE", "room.READ", "room.UPDATE", "room.DELETE", "invoice.READ"],
    "buildings": ["bld-1"],
    "isSuperAdmin": false,
    "menus": [
      { "id": "menu-1", "code": "dashboard", "name": "Dashboard", "path": "/dashboard", "icon": null, "sortOrder": 1, "children": [] }
    ]
  }
}
```

---

## 5. Gedung

Master gedung (tenant). `Building.gender` menentukan gender penghuni yang boleh ditempatkan.

| Method | Path             | Izin              | Tujuan                                    |
| ------ | ---------------- | ----------------- | ----------------------------------------- |
| POST   | `/buildings`     | `building.CREATE` | Buat gedung                               |
| GET    | `/buildings`     | `building.READ`   | Daftar gedung                             |
| PATCH  | `/buildings/:id` | `building.UPDATE` | Ubah gedung (nama, gender, alamat, aktif) |
| DELETE | `/buildings/:id` | `building.DELETE` | Nonaktifkan gedung                        |

**Body `POST`**: `{ code, name, gender: "MALE"|"FEMALE", address }`

**Contoh respons**

```json
// POST /api/buildings → 201
{ "status": "building created", "data": { "id": "bld-1", "code": "G1", "name": "Gedung Putra", "gender": "MALE", "address": "Yogyakarta", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/buildings → 200
{
  "status": "ok",
  "data": [
    { "id": "bld-1", "code": "G1", "name": "Gedung Putra", "gender": "MALE", "address": "Yogyakarta", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null },
    { "id": "bld-2", "code": "G2", "name": "Gedung Putri", "gender": "FEMALE", "address": "Yogyakarta", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null }
  ]
}
```

```json
// PATCH /api/buildings/:id → 200
{ "status": "building updated", "data": { "id": "bld-1", "code": "G1", "name": "Gedung Putra", "gender": "MALE", "address": "Yogyakarta", "isActive": false, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/buildings/:id → 200
{ "status": "building deleted" }
```

---

## 6. Kamar

Master kamar per gedung (ber-scope gedung).

| Method | Path         | Izin          | Tujuan                          |
| ------ | ------------ | ------------- | ------------------------------- |
| POST   | `/rooms`     | `room.CREATE` | Buat kamar                      |
| GET    | `/rooms`     | `room.READ`   | Daftar kamar (sesuai scope)     |
| PATCH  | `/rooms/:id` | `room.UPDATE` | Ubah nomor/kapasitas/status     |
| DELETE | `/rooms/:id` | `room.DELETE` | Nonaktifkan kamar               |

**Body `POST`**: `{ buildingId, number, capacity: int>0, status?: "ACTIVE"|"MAINTENANCE" }`

**Contoh respons**

```json
// POST /api/rooms → 201
{ "status": "room created", "data": { "id": "room-1", "buildingId": "bld-1", "number": "101", "capacity": 4, "status": "ACTIVE", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/rooms → 200
{ "status": "ok", "data": [ { "id": "room-1", "buildingId": "bld-1", "number": "101", "capacity": 4, "status": "ACTIVE", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } ] }
```

```json
// PATCH /api/rooms/:id → 200
{ "status": "room updated", "data": { "id": "room-1", "buildingId": "bld-1", "number": "101", "capacity": 5, "status": "ACTIVE", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/rooms/:id → 200
{ "status": "room deleted" }
```

---

## 7. Aturan Biaya

Aturan iuran bulanan per gedung. Ber-scope gedung.

| Method | Path             | Izin             | Tujuan                       |
| ------ | ---------------- | ---------------- | ---------------------------- |
| POST   | `/fee-rules`     | `feeRule.CREATE` | Buat aturan biaya            |
| GET    | `/fee-rules`     | `feeRule.READ`   | Daftar aturan biaya          |
| DELETE | `/fee-rules/:id` | `feeRule.DELETE` | Nonaktifkan aturan biaya     |

**Body `POST`**: `{ buildingId, dueDayOfMonth: 1..28, defaultMonthlyRate: int≥0, effectiveFrom: date }`

**Contoh respons**

```json
// POST /api/fee-rules → 201
{ "status": "fee rule created", "data": { "id": "fee-1", "buildingId": "bld-1", "dueDayOfMonth": 10, "defaultMonthlyRate": 350000, "effectiveFrom": "2025-01-01T00:00:00.000Z", "createdAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/fee-rules → 200
{ "status": "ok", "data": [ { "id": "fee-1", "buildingId": "bld-1", "dueDayOfMonth": 10, "defaultMonthlyRate": 350000, "effectiveFrom": "2025-01-01T00:00:00.000Z", "createdAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } ] }
```

```json
// DELETE /api/fee-rules/:id → 200
{ "status": "fee rule deleted" }
```

---

## 8. Fasilitas

Master fasilitas. `ROOM` = fasilitas kamar (jumlah), `PUBLIC` = fasilitas umum.

| Method | Path                        | Izin              | Tujuan                                               |
| ------ | --------------------------- | ----------------- | ---------------------------------------------------- |
| POST   | `/facilities`               | `facility.CREATE` | Buat fasilitas                                       |
| GET    | `/facilities?scope=`        | `facility.READ`   | Daftar fasilitas (`scope?`: `ROOM`/`PUBLIC`)         |
| GET    | `/facilities/rooms/:roomId` | `facility.READ`   | Daftar fasilitas terpasang di sebuah kamar           |
| PUT    | `/facilities/rooms/:roomId` | `facility.UPDATE` | Setel daftar fasilitas kamar (jumlah per fasilitas)  |
| PATCH  | `/facilities/:id`           | `facility.UPDATE` | Ubah fasilitas                                       |
| DELETE | `/facilities/:id`           | `facility.DELETE` | Nonaktifkan fasilitas                                |

**Body `POST`**: `{ code, name, scope: "ROOM"|"PUBLIC", usageMode: "ASSIGNED"|"SHARED", category }`
**Body `PUT /rooms/:roomId`**: `{ items: [{ facilityId, quantity: int>0, note? }] }`

**Contoh respons**

```json
// POST /api/facilities → 201
{ "status": "facility created", "data": { "id": "fac-1", "code": "KASUR", "name": "Kasur", "scope": "ROOM", "usageMode": "SHARED", "category": "FURNITURE", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/facilities → 200
{ "status": "ok", "data": [ { "id": "fac-1", "code": "KASUR", "name": "Kasur", "scope": "ROOM", "usageMode": "SHARED", "category": "FURNITURE", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } ] }
```

```json
// GET /api/facilities/rooms/:roomId → 200
{
  "status": "ok",
  "data": [
    { "id": "rf-1", "roomId": "room-1", "facilityId": "fac-1", "quantity": 4, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "facility": { "id": "fac-1", "code": "KASUR", "name": "Kasur", "scope": "ROOM", "usageMode": "SHARED", "category": "FURNITURE", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } }
  ]
}
```

```json
// PUT /api/facilities/rooms/:roomId → 200
{ "status": "room facilities set", "data": [ { "id": "rf-1", "roomId": "room-1", "facilityId": "fac-1", "quantity": 4, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "facility": { "id": "fac-1", "code": "KASUR", "name": "Kasur", "scope": "ROOM", "usageMode": "SHARED", "category": "FURNITURE", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } } ] }
```

```json
// PATCH /api/facilities/:id → 200
{ "status": "facility updated", "data": { "id": "fac-1", "code": "KASUR", "name": "Kasur Busa", "scope": "ROOM", "usageMode": "SHARED", "category": "FURNITURE", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/facilities/:id → 200
{ "status": "facility deleted" }
```

---

## 9. Fasilitas Umum

Instance fasilitas umum per gedung (mis. KM No. 3) + penugasan slot. Ber-scope gedung.

| Method | Path                                           | Izin              | Tujuan                                        |
| ------ | ---------------------------------------------- | ----------------- | --------------------------------------------- |
| POST   | `/public-facilities`                           | `facility.CREATE` | Buat fasilitas umum (mis. KM + nomor)         |
| GET    | `/public-facilities`                           | `facility.READ`   | Daftar fasilitas umum                         |
| PATCH  | `/public-facilities/:id`                       | `facility.UPDATE` | Ubah nomor/kapasitas/status/catatan           |
| DELETE | `/public-facilities/:id`                       | `facility.DELETE` | Nonaktifkan fasilitas umum                    |
| POST   | `/public-facilities/:id/assign`                | `facility.CREATE` | Tugaskan slot (`slotLabel`) ke penghuni       |
| GET    | `/public-facilities/:id/assignments`           | `facility.READ`   | Daftar penugasan pada fasilitas umum tersebut |
| DELETE | `/public-facilities/assignments/:assignmentId` | `facility.DELETE` | Lepaskan penugasan slot                       |

**Body `POST`**: `{ buildingId, facilityId, number?, capacity?, note? }` (wajib `number` untuk `ASSIGNED`)
**Body `POST /:id/assign`**: `{ userId, slotLabel }`

**Contoh respons**

```json
// POST /api/public-facilities → 201
{ "status": "public facility created", "data": { "id": "pf-1", "buildingId": "bld-1", "facilityId": "fac-km", "number": "KM-01", "capacity": null, "status": "ACTIVE", "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/public-facilities → 200
{
  "status": "ok",
  "data": [
    { "id": "pf-1", "buildingId": "bld-1", "facilityId": "fac-km", "number": "KM-01", "capacity": null, "status": "ACTIVE", "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "facility": { "id": "fac-km", "code": "KM", "name": "Kamar Mandi", "scope": "PUBLIC", "usageMode": "ASSIGNED", "category": "SANITARY", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } }
  ]
}
```

```json
// PATCH /api/public-facilities/:id → 200
{ "status": "public facility updated", "data": { "id": "pf-1", "buildingId": "bld-1", "facilityId": "fac-km", "number": "KM-01", "capacity": 4, "status": "MAINTENANCE", "note": "renovasi", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/public-facilities/:id → 200
{ "status": "public facility deleted" }
```

```json
// POST /api/public-facilities/:id/assign → 201
{ "status": "assigned", "data": { "id": "pfa-1", "publicFacilityId": "pf-1", "userId": "usr-2", "facilityId": "fac-km", "slotLabel": "A", "assignedAt": "2026-10-19T02:00:00.000Z", "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/public-facilities/:id/assignments → 200
{
  "status": "ok",
  "data": [
    { "id": "pfa-1", "publicFacilityId": "pf-1", "userId": "usr-2", "facilityId": "fac-km", "slotLabel": "A", "assignedAt": "2026-10-19T02:00:00.000Z", "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } }
  ]
}
```

```json
// DELETE /api/public-facilities/assignments/:assignmentId → 200
{ "status": "released" }
```

---

## 10. Penghuni

Manajemen data penghuni & siklus hidup (submit → approve/reject → checkout). Ber-scope gedung.

| Method | Path                             | Izin           | Tujuan                                                       |
| ------ | -------------------------------- | -------------- | ------------------------------------------------------------ |
| GET    | `/residents?buildingId=&status=` | `user.READ`    | Daftar penghuni per gedung (filter status opsional)          |
| GET    | `/residents/:id`                 | `user.READ`    | Detail satu penghuni                                          |
| PATCH  | `/residents/:id/profile`         | `user.UPDATE`  | Ubah profil (nama, telepon, gender, KTP, wali, alamat, gedung) |
| POST   | `/residents/:id/submit`          | `user.UPDATE`  | Submit pendaftaran (set profil + PENDING + `submittedAt`)     |
| POST   | `/residents/:id/approve`         | `user.APPROVE` | Terima: ACTIVE + **beri role `PENGHUNI`** (+ set gedung)      |
| POST   | `/residents/:id/reject`          | `user.APPROVE` | Tolak: REJECTED + alasan                                      |
| POST   | `/residents/:id/checkout`        | `user.UPDATE`  | Checkout: status CHECKOUT                                     |

**Query `GET /residents`**: `buildingId` (wajib), `status?`
**Body**: `profile` `{ name?, phone?, buildingId?, nationalId?, gender?, guardianName?, guardianPhone?, address? }` · `approve` `{ buildingId? }` · `reject` `{ reason }`

**Contoh respons** (objek `User` tanpa `password`)

```json
// GET /api/residents?buildingId=bld-1 → 200
{
  "status": "ok",
  "data": [
    { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null }
  ]
}
```

```json
// GET /api/residents/:id → 200
{ "status": "ok", "data": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } }
```

```json
// PATCH /api/residents/:id/profile → 200
{ "status": "profile updated", "data": { "id": "usr-2", "email": "warga@gmail.com", "name": "Budi", "phone": "0812…", "emailVerified": true, "buildingId": "bld-1", "nationalId": "34…", "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": "Yogyakarta", "status": "PENDING", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// POST /api/residents/:id/submit → 200
{ "status": "application submitted", "data": { "id": "usr-2", "email": "warga@gmail.com", "name": "Budi", "phone": "0812…", "emailVerified": true, "buildingId": "bld-1", "nationalId": "34…", "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": "Yogyakarta", "status": "PENDING", "submittedAt": "2026-10-19T02:05:00.000Z", "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// POST /api/residents/:id/approve → 200
{ "status": "resident approved", "data": { "id": "usr-2", "email": "warga@gmail.com", "name": "Budi", "phone": "0812…", "emailVerified": true, "buildingId": "bld-1", "nationalId": "34…", "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": "Yogyakarta", "status": "ACTIVE", "submittedAt": "2026-10-19T02:05:00.000Z", "reviewedById": "usr-1", "reviewedAt": "2026-10-19T02:06:00.000Z", "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-19T02:06:00.000Z", "deletedAt": null } }
```

```json
// POST /api/residents/:id/reject → 200
{ "status": "resident rejected", "data": { "id": "usr-2", "email": "warga@gmail.com", "name": "Budi", "phone": "0812…", "emailVerified": true, "buildingId": "bld-1", "nationalId": "34…", "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": "Yogyakarta", "status": "REJECTED", "submittedAt": "2026-10-19T02:05:00.000Z", "reviewedById": "usr-1", "reviewedAt": "2026-10-19T02:06:00.000Z", "rejectionReason": "KTP tidak jelas", "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-19T02:06:00.000Z", "deletedAt": null } }
```

```json
// POST /api/residents/:id/checkout → 200
{ "status": "resident checked out", "data": { "id": "usr-2", "email": "warga@gmail.com", "name": "Budi", "phone": "0812…", "emailVerified": true, "buildingId": "bld-1", "nationalId": "34…", "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": "Yogyakarta", "status": "CHECKOUT", "submittedAt": "2026-10-19T02:05:00.000Z", "reviewedById": "usr-1", "reviewedAt": "2026-10-19T02:06:00.000Z", "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-19T02:07:00.000Z", "deletedAt": null } }
```

---

## 11. Dokumen

Jenis dokumen dinamis, permintaan, upload, dan verifikasi. Ber-scope gedung.

| Method | Path                           | Izin              | Tujuan                                                   |
| ------ | ------------------------------ | ----------------- | -------------------------------------------------------- |
| POST   | `/documents/types`             | `document.CREATE` | Buat jenis dokumen (mime diizinkan, ukuran maks, wajib?) |
| GET    | `/documents/types?buildingId=` | `document.READ`   | Daftar jenis dokumen per gedung                          |
| GET    | `/documents/required`          | `document.READ`   | Dokumen wajib yang belum lengkap untuk user login        |
| GET    | `/documents?userId=`           | `document.READ`   | Daftar dokumen milik seorang user                        |
| POST   | `/documents/request`           | `document.CREATE` | Minta user mengunggah jenis dokumen tertentu             |
| POST   | `/documents/upload`            | `document.CREATE` | Unggah berkas (multipart, field `file`)                  |
| POST   | `/documents/:id/verify`        | `document.VERIFY` | Verifikasi dokumen                                       |
| POST   | `/documents/:id/reject`        | `document.VERIFY` | Tolak dokumen + alasan                                   |

**Body `POST /types`**: `{ buildingId, code, name, isRequiredByDefault?, allowedMimeTypes[], maxSizeBytes, sortOrder? }`
**Body `POST /request`**: `{ userId, documentTypeId }` · **Body `POST /upload`** (multipart): `documentTypeId` + file `file` (maks 10 MB) · **Body `POST /:id/reject`**: `{ reason }`

**Contoh respons**

```json
// POST /api/documents/types → 201
{ "status": "document type created", "data": { "id": "dtype-1", "buildingId": "bld-1", "code": "KTP", "name": "KTP", "isRequiredByDefault": true, "isActive": true, "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 5242880, "sortOrder": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/documents/types?buildingId=bld-1 → 200
{ "status": "ok", "data": [ { "id": "dtype-1", "buildingId": "bld-1", "code": "KTP", "name": "KTP", "isRequiredByDefault": true, "isActive": true, "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 5242880, "sortOrder": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } ] }
```

```json
// GET /api/documents/required → 200
{
  "status": "ok",
  "data": [
    {
      "documentType": { "id": "dtype-1", "buildingId": "bld-1", "code": "KTP", "name": "KTP", "isRequiredByDefault": true, "isActive": true, "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 5242880, "sortOrder": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null },
      "submission": { "id": "doc-1", "userId": "usr-2", "documentTypeId": "dtype-1", "status": "REQUESTED", "fileId": null, "requestedById": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "note": null, "version": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null }
    }
  ]
}
```

```json
// GET /api/documents?userId=usr-2 → 200
{
  "status": "ok",
  "data": [
    { "id": "doc-1", "userId": "usr-2", "documentTypeId": "dtype-1", "status": "UPLOADED", "fileId": "file-1", "requestedById": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "note": null, "version": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "documentType": { "id": "dtype-1", "buildingId": "bld-1", "code": "KTP", "name": "KTP", "isRequiredByDefault": true, "isActive": true, "allowedMimeTypes": ["application/pdf"], "maxSizeBytes": 5242880, "sortOrder": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null }, "file": { "id": "file-1", "storageKey": "2026-10-19/uuid-ktp.pdf", "originalName": "ktp.pdf", "mimeType": "application/pdf", "sizeBytes": 12345, "checksum": "abc123…", "uploadedById": "usr-2", "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
  ]
}
```

```json
// POST /api/documents/request → 201
{ "status": "document requested", "data": { "id": "doc-1", "userId": "usr-2", "documentTypeId": "dtype-1", "status": "REQUESTED", "fileId": null, "requestedById": "usr-1", "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "note": null, "version": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/documents/upload → 201
{ "status": "document uploaded", "data": { "id": "doc-1", "userId": "usr-2", "documentTypeId": "dtype-1", "status": "UPLOADED", "fileId": "file-1", "requestedById": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "note": null, "version": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/documents/:id/verify → 200
{ "status": "document verified", "data": { "id": "doc-1", "userId": "usr-2", "documentTypeId": "dtype-1", "status": "VERIFIED", "fileId": "file-1", "requestedById": null, "reviewedById": "usr-1", "reviewedAt": "2026-10-19T02:05:00.000Z", "rejectionReason": null, "note": null, "version": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// POST /api/documents/:id/reject → 200
{ "status": "document rejected", "data": { "id": "doc-1", "userId": "usr-2", "documentTypeId": "dtype-1", "status": "REJECTED", "fileId": "file-1", "requestedById": null, "reviewedById": "usr-1", "reviewedAt": "2026-10-19T02:05:00.000Z", "rejectionReason": "tidak terbaca", "note": null, "version": 1, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

---

## 12. Penempatan

Penempatan kamar (`Occupancy`) + checkout. Ber-scope gedung.

| Method | Path                        | Izin               | Tujuan                                                               |
| ------ | --------------------------- | ------------------ | -------------------------------------------------------------------- |
| POST   | `/occupancies`              | `occupancy.CREATE` | Tempatkan penghuni ke kamar (cek kapasitas + kecocokan gender gedung) |
| GET    | `/occupancies`              | `occupancy.READ`   | Daftar penempatan                                                    |
| POST   | `/occupancies/:id/checkout` | `occupancy.UPDATE` | Akhiri penempatan + bebaskan slot fasilitas                          |

**Body `POST`**: `{ userId, roomId, bedLabel? }`

**Contoh respons**

```json
// POST /api/occupancies → 201
{ "status": "occupancy created", "data": { "id": "occ-1", "userId": "usr-2", "roomId": "room-1", "bedLabel": "A", "monthlyRateSnapshot": 350000, "startDate": "2026-10-19T00:00:00.000Z", "endDate": null, "status": "ACTIVE", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/occupancies → 200
{
  "status": "ok",
  "data": [
    {
      "id": "occ-1", "userId": "usr-2", "roomId": "room-1", "bedLabel": "A", "monthlyRateSnapshot": 350000, "startDate": "2026-10-19T00:00:00.000Z", "endDate": null, "status": "ACTIVE", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null,
      "room": { "id": "room-1", "buildingId": "bld-1", "number": "101", "capacity": 4, "status": "ACTIVE", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null },
      "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null }
    }
  ]
}
```

```json
// POST /api/occupancies/:id/checkout → 200
{ "status": "occupancy ended", "data": { "id": "occ-1", "userId": "usr-2", "roomId": "room-1", "bedLabel": "A", "monthlyRateSnapshot": 350000, "startDate": "2026-10-19T00:00:00.000Z", "endDate": "2026-11-19T00:00:00.000Z", "status": "ENDED", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-11-19T02:00:00.000Z", "deletedAt": null } }
```

---

## 13. Tagihan

Generate & kelola tagihan bulanan (`Invoice`). Ber-scope gedung.

| Method | Path                 | Izin             | Tujuan                                                     |
| ------ | -------------------- | ---------------- | ---------------------------------------------------------- |
| POST   | `/invoices/generate` | `invoice.CREATE` | Generate tagihan bulanan untuk semua penghuni aktif gedung |
| GET    | `/invoices`          | `invoice.READ`   | Daftar tagihan (filter gedung/status/tahun/bulan)          |
| GET    | `/invoices/:id`      | `invoice.READ`   | Detail tagihan (termasuk `lines` & `allocations`)          |
| POST   | `/invoices/:id/void` | `invoice.UPDATE` | Batalkan tagihan (gagal bila sudah ada pembayaran)         |

**Body `POST /generate`**: `{ buildingId, year, month: 1..12 }`
**Query `GET /invoices`**: `buildingId?`, `status?` (`ISSUED|PARTIAL|PAID|OVERDUE|VOID`), `year?`, `month?`

**Contoh respons**

```json
// POST /api/invoices/generate → 201
{
  "status": "invoices generated",
  "data": [
    { "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "occupancyId": "occ-1", "periodYear": 2026, "periodMonth": 11, "dueDate": "2026-11-10T00:00:00.000Z", "baseAmount": 350000, "discountAmount": 0, "totalAmount": 350000, "paidAmount": 0, "status": "ISSUED", "createdById": "usr-1", "issuedAt": "2026-10-18T22:25:12.851Z", "createdAt": "2026-10-18T22:25:12.851Z", "updatedAt": "2026-10-18T22:25:12.851Z", "deletedAt": null, "lines": [ { "id": "line-1", "invoiceId": "inv-1", "kind": "RENT", "description": "Sewa kamar 11/2026", "amount": 350000, "createdAt": "2026-10-18T22:25:12.851Z" } ] }
  ]
}
```

```json
// GET /api/invoices → 200
{
  "status": "ok",
  "data": [
    { "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "occupancyId": "occ-1", "periodYear": 2026, "periodMonth": 11, "dueDate": "2026-11-10T00:00:00.000Z", "baseAmount": 350000, "discountAmount": 0, "totalAmount": 350000, "paidAmount": 0, "status": "ISSUED", "createdById": "usr-1", "issuedAt": "2026-10-18T22:25:12.851Z", "createdAt": "2026-10-18T22:25:12.851Z", "updatedAt": "2026-10-18T22:25:12.851Z", "deletedAt": null, "lines": [ { "id": "line-1", "invoiceId": "inv-1", "kind": "RENT", "description": "Sewa kamar 11/2026", "amount": 350000, "createdAt": "2026-10-18T22:25:12.851Z" } ] }
  ]
}
```

```json
// GET /api/invoices/:id → 200
{
  "status": "ok",
  "data": {
    "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "occupancyId": "occ-1", "periodYear": 2026, "periodMonth": 11, "dueDate": "2026-11-10T00:00:00.000Z", "baseAmount": 350000, "discountAmount": 0, "totalAmount": 350000, "paidAmount": 0, "status": "ISSUED", "createdById": "usr-1", "issuedAt": "2026-10-18T22:25:12.851Z", "createdAt": "2026-10-18T22:25:12.851Z", "updatedAt": "2026-10-18T22:25:12.851Z", "deletedAt": null,
    "lines": [ { "id": "line-1", "invoiceId": "inv-1", "kind": "RENT", "description": "Sewa kamar 11/2026", "amount": 350000, "createdAt": "2026-10-18T22:25:12.851Z" } ],
    "allocations": []
  }
}
```

```json
// POST /api/invoices/:id/void → 200
{ "status": "invoice void", "data": { "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "occupancyId": "occ-1", "periodYear": 2026, "periodMonth": 11, "dueDate": "2026-11-10T00:00:00.000Z", "baseAmount": 350000, "discountAmount": 0, "totalAmount": 350000, "paidAmount": 0, "status": "VOID", "createdById": "usr-1", "issuedAt": "2026-10-18T22:25:12.851Z", "createdAt": "2026-10-18T22:25:12.851Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

---

## 14. Pembayaran

Catat pembayaran & alokasikan ke tagihan (FIFO bila `allocations` tidak dikirim). Otomatis mencatat `LedgerEntry` IN ke kas gedung. Ber-scope gedung.

| Method | Path                | Izin             | Tujuan                                    |
| ------ | ------------------- | ---------------- | ----------------------------------------- |
| POST   | `/payments`         | `payment.APPROVE` | Catat pembayaran langsung (admin/bendahara) + alokasi + ledger masuk |
| GET    | `/payments?userId=` | `payment.READ`   | Daftar pembayaran (filter user opsional)  |
| GET    | `/payments/:id`     | `payment.READ`   | Detail pembayaran (pemilik atau admin ber-scope) |

**Body `POST`**

```json
{
  "userId": "usr-2",
  "amount": 350000,
  "method": "CASH",
  "cashAccountId": "acc-1",
  "referenceNo": null,
  "proofFileId": null,
  "idempotencyKey": "pay-2026-10-001",
  "note": null,
  "allocations": [{ "invoiceId": "inv-1", "amount": 350000 }]
}
```

`method`: `CASH | TRANSFER | QRIS`. Bila `allocations` kosong → alokasi otomatis ke tagihan outstanding tertua.

**Contoh respons**

```json
// POST /api/payments → 201
{
  "status": "payment recorded",
  "data": {
    "id": "pay-1", "code": "PAY-4E175C71AB30", "userId": "usr-2", "amount": 350000, "method": "CASH", "cashAccountId": "acc-1", "referenceNo": null, "proofFileId": null, "idempotencyKey": "pay-2026-10-001", "paidAt": "2026-10-19T06:36:58.676Z", "receivedById": "usr-1", "note": null, "createdAt": "2026-10-19T06:36:58.676Z", "updatedAt": "2026-10-19T06:36:58.676Z", "deletedAt": null,
    "allocations": [ { "id": "alloc-1", "paymentId": "pay-1", "invoiceId": "inv-1", "amount": 350000, "createdAt": "2026-10-19T06:36:58.676Z" } ]
  }
}
```

```json
// GET /api/payments → 200
{
  "status": "ok",
  "data": [
    { "id": "pay-1", "code": "PAY-4E175C71AB30", "userId": "usr-2", "amount": 350000, "method": "CASH", "cashAccountId": "acc-1", "referenceNo": null, "proofFileId": null, "idempotencyKey": "pay-2026-10-001", "paidAt": "2026-10-19T06:36:58.676Z", "receivedById": "usr-1", "note": null, "createdAt": "2026-10-19T06:36:58.676Z", "updatedAt": "2026-10-19T06:36:58.676Z", "deletedAt": null, "allocations": [ { "id": "alloc-1", "paymentId": "pay-1", "invoiceId": "inv-1", "amount": 350000, "createdAt": "2026-10-19T06:36:58.676Z" } ] }
  ]
}
```

```json
// GET /api/payments/:id → 200
{
  "status": "ok",
  "data": { "id": "pay-1", "code": "PAY-4E175C71AB30", "userId": "usr-2", "amount": 350000, "method": "CASH", "cashAccountId": "acc-1", "referenceNo": null, "proofFileId": null, "idempotencyKey": "pay-2026-10-001", "paidAt": "2026-10-19T06:36:58.676Z", "receivedById": "usr-1", "note": null, "createdAt": "2026-10-19T06:36:58.676Z", "updatedAt": "2026-10-19T06:36:58.676Z", "deletedAt": null, "allocations": [ { "id": "alloc-1", "paymentId": "pay-1", "invoiceId": "inv-1", "amount": 350000, "createdAt": "2026-10-19T06:36:58.676Z" } ] }
}
```

---

## 15. Pembayaran Mandiri Warga

Warga melihat tagihannya sendiri dan mengajukan pembayaran **transfer/QRIS** dengan bukti. Pengajuan berstatus `PENDING` dan **belum** mengubah tagihan/kas sampai diverifikasi admin ([§16](#16-verifikasi-pembayaran)). `userId` selalu diambil dari JWT.

| Method | Path                  | Izin             | Tujuan                                                              |
| ------ | --------------------- | ---------------- | ------------------------------------------------------------------- |
| GET    | `/me/invoices`        | `invoice.READ`   | Tagihan milik sendiri (filter `status`, `year`, `month`)            |
| GET    | `/me/invoices/:id`    | `invoice.READ`   | Detail tagihan sendiri (403 bila bukan miliknya)                    |
| POST   | `/me/payments/proof`  | `payment.CREATE` | Upload bukti bayar (multipart `file`, ≤10MB, PDF/PNG/JPEG)          |
| POST   | `/me/payments`        | `payment.CREATE` | Ajukan pembayaran untuk **satu** tagihan (`PENDING`)                |
| GET    | `/me/payments`        | `payment.READ`   | Daftar pengajuan pembayaran sendiri (filter `status`)               |
| GET    | `/me/payments/:id`    | `payment.READ`   | Detail pengajuan sendiri (403 bila bukan miliknya)                  |

**Aturan pengajuan**

- `amount` **wajib** sama dengan `totalAmount − paidAmount` tagihan (bayar penuh per bulan, bukan cicil).
- Tagihan harus outstanding (`ISSUED`, `PARTIAL`, `OVERDUE`); satu pengajuan = satu bulan tagihan (boleh tunggakan lama).
- `method` hanya `TRANSFER` atau `QRIS`; `proofFileId` **wajib** dan harus file milik pengaju.
- Hanya boleh ada **1 pengajuan `PENDING` per tagihan** (409 bila dobel). Setelah `REJECTED`, warga boleh mengajukan ulang.
- `CASH` tidak lewat endpoint ini — admin mencatatnya di [`POST /payments`](#14-pembayaran).

**Body `POST /me/payments`**

```json
{
  "invoiceId": "inv-1",
  "amount": 350000,
  "method": "TRANSFER",
  "proofFileId": "file-9",
  "referenceNo": "TRX-2026-10-001",
  "note": "Transfer BCA"
}
```

**Query `GET /me/invoices`**: `status?`, `year?`, `month?` · **Query `GET /me/payments`**: `status?` (`PENDING|VERIFIED|REJECTED`)

**Contoh respons**

```json
// GET /api/me/invoices → 200
{
  "status": "ok",
  "data": [
    {
      "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "occupancyId": "occ-1", "periodYear": 2026, "periodMonth": 10, "dueDate": "2026-10-10T00:00:00.000Z", "baseAmount": 350000, "discountAmount": 0, "totalAmount": 350000, "paidAmount": 0, "status": "OVERDUE", "createdById": "usr-1", "issuedAt": "2026-10-18T22:25:12.851Z", "createdAt": "2026-10-18T22:25:12.851Z", "updatedAt": "2026-10-18T22:25:12.851Z", "deletedAt": null,
      "lines": [ { "id": "line-1", "invoiceId": "inv-1", "kind": "RENT", "description": "Sewa kamar 10/2026", "amount": 350000, "createdAt": "2026-10-18T22:25:12.851Z" } ],
      "submissions": [ { "id": "sub-1", "code": "SUB-1A2B3C4D5E6F", "status": "PENDING", "amount": 350000, "createdAt": "2026-10-21T03:00:00.000Z" } ]
    }
  ]
}
```

```json
// POST /api/me/payments/proof → 201 (multipart: file)
{
  "status": "payment proof uploaded",
  "data": { "id": "file-9", "storageKey": "2026-10-21/uuid-bukti.pdf", "originalName": "bukti.pdf", "mimeType": "application/pdf", "sizeBytes": 18342, "checksum": "9f2c…", "uploadedById": "usr-2", "createdAt": "2026-10-21T03:01:00.000Z", "deletedAt": null }
}
```

```json
// POST /api/me/payments → 201
{
  "status": "payment submitted",
  "data": {
    "id": "sub-1", "code": "SUB-1A2B3C4D5E6F", "userId": "usr-2", "invoiceId": "inv-1", "amount": 350000, "method": "TRANSFER", "referenceNo": "TRX-2026-10-001", "proofFileId": "file-9", "note": "Transfer BCA", "status": "PENDING", "reviewNote": null, "reviewedById": null, "reviewedAt": null, "paymentId": null, "createdAt": "2026-10-21T03:02:00.000Z", "updatedAt": "2026-10-21T03:02:00.000Z", "deletedAt": null,
    "invoice": { "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "periodYear": 2026, "periodMonth": 10, "dueDate": "2026-10-10T00:00:00.000Z", "totalAmount": 350000, "paidAmount": 0, "status": "OVERDUE" },
    "proofFile": { "id": "file-9", "originalName": "bukti.pdf", "mimeType": "application/pdf", "sizeBytes": 18342 }
  }
}
```

---

## 16. Verifikasi Pembayaran

Admin/bendahara memeriksa bukti pengajuan. **Verifikasi atomik**: membuat `Payment` + `PaymentAllocation` + update `Invoice` + `LedgerEntry IN` + status `VERIFIED`. **Reject** hanya mengubah status (kas/tagihan tidak tersentuh). Ber-scope gedung (via `Invoice.buildingId`).

| Method | Path                             | Izin               | Tujuan                                                             |
| ------ | -------------------------------- | ------------------ | ------------------------------------------------------------------ |
| GET    | `/payment-submissions`           | `payment.READ`     | Daftar pengajuan (filter `status`, `userId`)                       |
| POST   | `/payment-submissions/:id/verify`| `payment.APPROVE`  | Verifikasi → `Payment` + alokasi + ledger IN → invoice `PAID`      |
| POST   | `/payment-submissions/:id/reject`| `payment.APPROVE`  | Tolak pengajuan + alasan (warga dapat mengajukan ulang)            |

**Body `verify`**: `{ cashAccountId? }` — opsional; default akun kas gedung tagihan.
**Body `reject`**: `{ reason }` (wajib, ≤255).

**Perilaku**

- Hanya `PENDING` yang bisa diverifikasi/ditolak (409 bila bukan).
- Verifikasi mengecek ulang sisa tagihan; bila nominal pengajuan tidak lagi sama → 409.
- Idempoten: verifikasi ulang pengajuan `VERIFIED` mengembalikan `payment` yang sama tanpa membuat pembayaran baru.
- `idempotencyKey` pembayaran = `submission:<id>` (unik).

**Contoh respons**

```json
// GET /api/payment-submissions?status=PENDING → 200
{
  "status": "ok",
  "data": [
    {
      "id": "sub-1", "code": "SUB-1A2B3C4D5E6F", "userId": "usr-2", "invoiceId": "inv-1", "amount": 350000, "method": "TRANSFER", "referenceNo": "TRX-2026-10-001", "proofFileId": "file-9", "note": "Transfer BCA", "status": "PENDING", "reviewNote": null, "reviewedById": null, "reviewedAt": null, "paymentId": null, "createdAt": "2026-10-21T03:02:00.000Z", "updatedAt": "2026-10-21T03:02:00.000Z", "deletedAt": null,
      "invoice": { "id": "inv-1", "code": "INV-0F8ED5ACEC92", "buildingId": "bld-1", "userId": "usr-2", "periodYear": 2026, "periodMonth": 10, "dueDate": "2026-10-10T00:00:00.000Z", "totalAmount": 350000, "paidAmount": 0, "status": "OVERDUE" },
      "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null }
    }
  ]
}
```

```json
// POST /api/payment-submissions/sub-1/verify → 200
{
  "status": "payment submission verified",
  "data": {
    "submission": { "id": "sub-1", "code": "SUB-1A2B3C4D5E6F", "status": "VERIFIED", "reviewedById": "usr-1", "reviewedAt": "2026-10-21T03:05:00.000Z", "paymentId": "pay-2" },
    "payment": { "id": "pay-2", "code": "PAY-9C8B7A6D5E4F", "userId": "usr-2", "amount": 350000, "method": "TRANSFER", "cashAccountId": "acc-1", "referenceNo": "TRX-2026-10-001", "proofFileId": "file-9", "idempotencyKey": "submission:sub-1", "paidAt": "2026-10-21T03:05:00.000Z", "receivedById": "usr-1", "note": "Transfer BCA", "allocations": [ { "id": "alloc-2", "paymentId": "pay-2", "invoiceId": "inv-1", "amount": 350000, "createdAt": "2026-10-21T03:05:00.000Z" } ] }
  }
}
```

```json
// POST /api/payment-submissions/sub-2/reject → 200
{ "status": "payment submission rejected", "data": { "id": "sub-2", "status": "REJECTED", "reviewNote": "Bukti buram, mohon unggah ulang", "reviewedById": "usr-1", "reviewedAt": "2026-10-21T03:06:00.000Z" } }
```

---

## 17. Akun Kas

Akun kas/bank per gedung (satu per gedung). Ber-scope gedung.

| Method | Path                         | Izin          | Tujuan                                       |
| ------ | ---------------------------- | ------------- | -------------------------------------------- |
| POST   | `/cash-accounts`             | `cash.CREATE` | Buat akun kas gedung (maks 1 per gedung)     |
| GET    | `/cash-accounts`             | `cash.READ`   | Daftar akun kas                              |
| GET    | `/cash-accounts/:id`         | `cash.READ`   | Detail akun kas                              |
| PATCH  | `/cash-accounts/:id`         | `cash.UPDATE` | Ubah nama/tipe/saldo awal                    |
| DELETE | `/cash-accounts/:id`         | `cash.DELETE` | Hapus akun kas (gagal bila sudah ada mutasi) |
| GET    | `/cash-accounts/:id/balance` | `cash.READ`   | Saldo: `openingBalance + totalIn − totalOut` |
| GET    | `/cash-accounts/:id/ledger`  | `cash.READ`   | Buku besar akun tersebut                     |

**Body `POST`**: `{ buildingId, name, type?: "CASH"|"BANK", openingBalance?: int }`

**Contoh respons**

```json
// POST /api/cash-accounts → 201
{ "status": "cash account created", "data": { "id": "acc-1", "buildingId": "bld-1", "name": "Kas Tunai G1", "type": "CASH", "openingBalance": 0, "createdAt": "2026-10-18T22:24:22.439Z", "updatedAt": "2026-10-18T22:24:22.439Z", "deletedAt": null } }
```

```json
// GET /api/cash-accounts → 200
{ "status": "ok", "data": [ { "id": "acc-1", "buildingId": "bld-1", "name": "Kas Tunai G1", "type": "CASH", "openingBalance": 0, "createdAt": "2026-10-18T22:24:22.439Z", "updatedAt": "2026-10-18T22:24:22.439Z", "deletedAt": null } ] }
```

```json
// GET /api/cash-accounts/:id → 200
{ "status": "ok", "data": { "id": "acc-1", "buildingId": "bld-1", "name": "Kas Tunai G1", "type": "CASH", "openingBalance": 0, "createdAt": "2026-10-18T22:24:22.439Z", "updatedAt": "2026-10-18T22:24:22.439Z", "deletedAt": null } }
```

```json
// PATCH /api/cash-accounts/:id → 200
{ "status": "cash account updated", "data": { "id": "acc-1", "buildingId": "bld-1", "name": "Kas Utama G1", "type": "BANK", "openingBalance": 100000, "createdAt": "2026-10-18T22:24:22.439Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/cash-accounts/:id → 200
{ "status": "cash account deleted" }
```

```json
// GET /api/cash-accounts/:id/balance → 200
{ "status": "ok", "data": { "cashAccountId": "acc-1", "openingBalance": 0, "totalIn": 350000, "totalOut": 250000, "balance": 100000 } }
```

```json
// GET /api/cash-accounts/:id/ledger → 200
{
  "status": "ok",
  "data": [
    { "id": "led-1", "cashAccountId": "acc-1", "direction": "IN", "amount": 350000, "categoryId": "cat-1", "sourceType": "PAYMENT", "sourceId": "pay-1", "idempotencyKey": "payment:pay-1", "occurredAt": "2026-10-19T06:36:58.676Z", "description": "Pembayaran PAY-4E175C71AB30", "createdById": "usr-1", "createdAt": "2026-10-19T06:36:58.676Z" }
  ]
}
```

---

## 18. Kategori

Kategori kas (pemasukan/pengeluaran) per gedung. Ber-scope gedung.

| Method | Path                | Izin              | Tujuan                                  |
| ------ | ------------------- | ----------------- | --------------------------------------- |
| POST   | `/categories`       | `category.CREATE` | Buat kategori (`kind`: INCOME/EXPENSE)  |
| GET    | `/categories?kind=` | `category.READ`   | Daftar kategori (filter jenis opsional) |
| PATCH  | `/categories/:id`   | `category.UPDATE` | Ubah nama/jenis                         |
| DELETE | `/categories/:id`   | `category.DELETE` | Nonaktifkan kategori                    |

**Body `POST`**: `{ buildingId, name, kind: "INCOME"|"EXPENSE" }`

**Contoh respons**

```json
// POST /api/categories → 201
{ "status": "category created", "data": { "id": "cat-1", "buildingId": "bld-1", "name": "Iuran", "kind": "INCOME", "createdAt": "2026-10-18T22:24:22.470Z", "updatedAt": "2026-10-18T22:24:22.470Z", "deletedAt": null } }
```

```json
// GET /api/categories → 200
{ "status": "ok", "data": [ { "id": "cat-1", "buildingId": "bld-1", "name": "Iuran", "kind": "INCOME", "createdAt": "2026-10-18T22:24:22.470Z", "updatedAt": "2026-10-18T22:24:22.470Z", "deletedAt": null } ] }
```

```json
// PATCH /api/categories/:id → 200
{ "status": "category updated", "data": { "id": "cat-1", "buildingId": "bld-1", "name": "Iuran Bulanan", "kind": "INCOME", "createdAt": "2026-10-18T22:24:22.470Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/categories/:id → 200
{ "status": "category deleted" }
```

---

## 19. Pengeluaran

Catat pengeluaran (kas keluar) + ledger OUT. Memakai izin resource `cash`. Ber-scope gedung.

| Method | Path            | Izin          | Tujuan                                    |
| ------ | --------------- | ------------- | ----------------------------------------- |
| POST   | `/expenses`     | `cash.CREATE` | Catat pengeluaran (wajib `receiptFileId`) |
| GET    | `/expenses`     | `cash.READ`   | Daftar pengeluaran                        |
| GET    | `/expenses/:id` | `cash.READ`   | Detail pengeluaran                        |

**Body `POST`**

```json
{
  "categoryId": "cat-2",
  "amount": 250000,
  "occurredAt": "2026-10-19T00:00:00.000Z",
  "receiptFileId": "file-2",
  "cashAccountId": "acc-1",
  "vendor": "Toko Listrik",
  "description": "Bayar listrik",
  "eventId": null,
  "idempotencyKey": "exp-2026-10-001"
}
```

**Contoh respons**

```json
// POST /api/expenses → 201
{ "status": "expense recorded", "data": { "id": "exp-1", "cashAccountId": "acc-1", "categoryId": "cat-2", "amount": 250000, "occurredAt": "2026-10-19T00:00:00.000Z", "vendor": "Toko Listrik", "description": "Bayar listrik", "receiptFileId": "file-2", "eventId": null, "createdById": "usr-1", "idempotencyKey": "exp-2026-10-001", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/expenses → 200
{ "status": "ok", "data": [ { "id": "exp-1", "cashAccountId": "acc-1", "categoryId": "cat-2", "amount": 250000, "occurredAt": "2026-10-19T00:00:00.000Z", "vendor": "Toko Listrik", "description": "Bayar listrik", "receiptFileId": "file-2", "eventId": null, "createdById": "usr-1", "idempotencyKey": "exp-2026-10-001", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } ] }
```

```json
// GET /api/expenses/:id → 200
{ "status": "ok", "data": { "id": "exp-1", "cashAccountId": "acc-1", "categoryId": "cat-2", "amount": 250000, "occurredAt": "2026-10-19T00:00:00.000Z", "vendor": "Toko Listrik", "description": "Bayar listrik", "receiptFileId": "file-2", "eventId": null, "createdById": "usr-1", "idempotencyKey": "exp-2026-10-001", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

---

## 20. Buku Kas

Buku besar (`LedgerEntry`, **append-only**). Pemasukan manual & reversal. Ber-scope gedung.

| Method | Path                     | Izin          | Tujuan                                         |
| ------ | ------------------------ | ------------- | ---------------------------------------------- |
| GET    | `/ledger?cashAccountId=` | `cash.READ`   | Daftar entri buku besar (filter akun opsional) |
| POST   | `/ledger/income`         | `cash.CREATE` | Catat pemasukan manual (source `ADJUSTMENT`)   |
| POST   | `/ledger/:id/reversal`   | `cash.UPDATE` | Balik (reverse) sebuah entri (sekali saja)     |

**Body `income`**: `{ categoryId, amount: int>0, idempotencyKey, occurredAt?, cashAccountId?, description? }` · **Body `reversal`**: `{ reason }`

**Contoh respons**

```json
// GET /api/ledger → 200
{
  "status": "ok",
  "data": [
    { "id": "led-1", "cashAccountId": "acc-1", "direction": "IN", "amount": 1000000, "categoryId": "cat-1", "sourceType": "ADJUSTMENT", "sourceId": null, "idempotencyKey": "inc-2026-10-001", "occurredAt": "2026-10-19T02:00:00.000Z", "description": "Donasi", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z" }
  ]
}
```

```json
// POST /api/ledger/income → 201
{ "status": "income recorded", "data": { "id": "led-2", "cashAccountId": "acc-1", "direction": "IN", "amount": 1000000, "categoryId": "cat-1", "sourceType": "ADJUSTMENT", "sourceId": null, "idempotencyKey": "inc-2026-10-001", "occurredAt": "2026-10-19T02:00:00.000Z", "description": "Donasi", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z" } }
```

```json
// POST /api/ledger/:id/reversal → 200
{ "status": "entry reversed", "data": { "id": "led-3", "cashAccountId": "acc-1", "direction": "OUT", "amount": 1000000, "categoryId": "cat-1", "sourceType": "REVERSAL", "sourceId": "led-2", "idempotencyKey": "reversal:led-2", "occurredAt": "2026-10-19T02:05:00.000Z", "description": "Reversal: Donasi", "createdById": "usr-1", "createdAt": "2026-10-19T02:05:00.000Z" } }
```

---

## 21. Kegiatan

Manajemen kegiatan (`Event`), sesi/agenda, panitia, absensi, anggaran, dan lampiran/LPJ. Ber-scope gedung.

| Method | Path                                     | Izin           | Tujuan                                                 |
| ------ | ---------------------------------------- | -------------- | ------------------------------------------------------ |
| POST   | `/events`                                | `event.CREATE` | Buat kegiatan (rutin/besar, scope ASRAMA/GEDUNG)       |
| GET    | `/events?status=&category=`              | `event.READ`   | Daftar kegiatan (non-privileged hanya yang `isPublic`) |
| GET    | `/events/:id`                            | `event.READ`   | Detail kegiatan (+ sesi/panitia/lampiran/ringkasan absensi) |
| PATCH  | `/events/:id`                            | `event.UPDATE` | Ubah kegiatan                                          |
| DELETE | `/events/:id`                            | `event.DELETE` | Hapus kegiatan                                         |
| POST   | `/events/:id/status`                     | `event.UPDATE` | Ubah status (PLANNED/ONGOING/DONE/CANCELLED)           |
| POST   | `/events/:id/sessions`                   | `event.UPDATE` | Tambah satu sesi/agenda                                |
| POST   | `/events/:id/sessions/generate`          | `event.UPDATE` | Generate sesi berulang dari daftar tanggal             |
| GET    | `/events/:id/sessions`                   | `event.READ`   | Daftar sesi kegiatan                                   |
| DELETE | `/events/sessions/:sessionId`            | `event.UPDATE` | Hapus sesi                                             |
| GET    | `/events/sessions/:sessionId/attendance` | `event.READ`   | Daftar absensi sesi                                    |
| PUT    | `/events/sessions/:sessionId/attendance` | `event.UPDATE` | Setel absensi sesi (upsert per user)                   |
| POST   | `/events/:id/committees`                 | `event.UPDATE` | Tambah panitia                                         |
| GET    | `/events/:id/committees`                 | `event.READ`   | Daftar panitia                                         |
| DELETE | `/events/committees/:committeeId`        | `event.UPDATE` | Hapus panitia                                          |
| POST   | `/events/:id/expenses`                   | `event.UPDATE` | Catat pengeluaran kegiatan (anggaran realisasi)        |
| POST   | `/events/:id/attachments`                | `event.UPDATE` | Tambah lampiran (proposal/notulen/LPJ/foto)            |
| GET    | `/events/:id/attachments`                | `event.READ`   | Daftar lampiran kegiatan                               |
| DELETE | `/events/attachments/:attachmentId`      | `event.UPDATE` | Hapus lampiran                                         |
| GET    | `/events/me/committees`                  | `event.READ`   | Kepanitiaan saya                                       |
| GET    | `/events/me/attendance`                  | `event.READ`   | Absensi saya                                           |

**Body**: `create` `{ title, description?, category?, isAdHoc?, scope?, buildingId?, startAt, endAt?, location?, budgetAmount?, isPublic?, recurrence? }` · `session` `{ scheduledAt, title?, startAt?, endAt?, location?, note? }` · `generate` `{ dates[] }` · `committee` `{ userId, eventRole, positionId? }` · `attendance` `{ records: [{ userId, status, checkedInAt?, note? }] }` · `expenses` = body `/expenses` tanpa `eventId` · `attachment` `{ fileId, kind, note? }`

**Contoh respons**

```json
// POST /api/events → 201
{ "status": "event created", "data": { "id": "evt-1", "title": "Yasinan Rutin", "description": null, "category": "RUTIN", "isAdHoc": false, "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": "Aula", "budgetAmount": 500000, "status": "PLANNED", "isPublic": true, "recurrence": "NONE", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/events → 200
{
  "status": "ok",
  "data": [
    { "id": "evt-1", "title": "Yasinan Rutin", "description": null, "category": "RUTIN", "isAdHoc": false, "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": "Aula", "budgetAmount": 500000, "status": "PLANNED", "isPublic": true, "recurrence": "NONE", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "building": { "id": "bld-1", "code": "G1", "name": "Gedung Putra", "gender": "MALE", "address": "Yogyakarta", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } }
  ]
}
```

```json
// GET /api/events/:id → 200
{
  "status": "ok",
  "data": {
    "id": "evt-1", "title": "Yasinan Rutin", "description": null, "category": "RUTIN", "isAdHoc": false, "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": "Aula", "budgetAmount": 500000, "status": "PLANNED", "isPublic": true, "recurrence": "NONE", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null,
    "building": { "id": "bld-1", "code": "G1", "name": "Gedung Putra", "gender": "MALE", "address": "Yogyakarta", "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null },
    "sessions": [ { "id": "ses-1", "eventId": "evt-1", "title": "Yasinan Rutin", "scheduledAt": "2026-11-01T10:00:00.000Z", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": null, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } ],
    "committees": [],
    "attachments": [],
    "attendanceSummary": { "HADIR": 0, "IZIN": 0, "TIDAK": 0 }
  }
}
```

```json
// PATCH /api/events/:id → 200
{ "status": "event updated", "data": { "id": "evt-1", "title": "Yasinan Rutin (revisi)", "description": null, "category": "RUTIN", "isAdHoc": false, "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": "Aula", "budgetAmount": 600000, "status": "PLANNED", "isPublic": true, "recurrence": "NONE", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/events/:id → 200
{ "status": "event deleted" }
```

```json
// POST /api/events/:id/status → 200
{ "status": "event status updated", "data": { "id": "evt-1", "title": "Yasinan Rutin", "description": null, "category": "RUTIN", "isAdHoc": false, "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": "Aula", "budgetAmount": 500000, "status": "DONE", "isPublic": true, "recurrence": "NONE", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:06:00.000Z", "deletedAt": null } }
```

```json
// POST /api/events/:id/sessions → 201
{ "status": "session created", "data": { "id": "ses-2", "eventId": "evt-1", "title": null, "scheduledAt": "2026-11-08T10:00:00.000Z", "startAt": null, "endAt": null, "location": null, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/events/:id/sessions/generate → 201
{ "status": "sessions generated", "data": [ { "id": "ses-3", "eventId": "evt-1", "title": null, "scheduledAt": "2026-11-15T10:00:00.000Z", "startAt": null, "endAt": null, "location": null, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } ] }
```

```json
// GET /api/events/:id/sessions → 200
{ "status": "ok", "data": [ { "id": "ses-1", "eventId": "evt-1", "title": "Yasinan Rutin", "scheduledAt": "2026-11-01T10:00:00.000Z", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": null, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } ] }
```

```json
// DELETE /api/events/sessions/:sessionId → 200
{ "status": "session deleted" }
```

```json
// GET /api/events/sessions/:sessionId/attendance → 200
{ "status": "ok", "data": [ { "id": "att-1", "sessionId": "ses-1", "userId": "usr-2", "status": "HADIR", "checkedInAt": "2026-11-01T10:02:00.000Z", "note": null, "createdAt": "2026-11-01T10:02:00.000Z", "updatedAt": "2026-11-01T10:02:00.000Z", "deletedAt": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } } ] }
```

```json
// PUT /api/events/sessions/:sessionId/attendance → 200
{ "status": "attendance saved", "data": [ { "id": "att-1", "sessionId": "ses-1", "userId": "usr-2", "status": "HADIR", "checkedInAt": "2026-11-01T10:02:00.000Z", "note": null, "createdAt": "2026-11-01T10:02:00.000Z", "updatedAt": "2026-11-01T10:02:00.000Z", "deletedAt": null } ] }
```

```json
// POST /api/events/:id/committees → 201
{ "status": "committee added", "data": { "id": "cmt-1", "eventId": "evt-1", "userId": "usr-2", "eventRole": "Koordinator Acara", "positionId": null, "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/events/:id/committees → 200
{ "status": "ok", "data": [ { "id": "cmt-1", "eventId": "evt-1", "userId": "usr-2", "eventRole": "Koordinator Acara", "positionId": null, "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null }, "position": null } ] }
```

```json
// DELETE /api/events/committees/:committeeId → 200
{ "status": "committee removed" }
```

```json
// POST /api/events/:id/expenses → 201
{ "status": "event expense recorded", "data": { "id": "exp-3", "cashAccountId": "acc-1", "categoryId": "cat-2", "amount": 300000, "occurredAt": "2026-11-01T00:00:00.000Z", "vendor": null, "description": null, "receiptFileId": "file-3", "eventId": "evt-1", "createdById": "usr-1", "idempotencyKey": "evt-exp-2026-10-001", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/events/:id/attachments → 201
{ "status": "attachment added", "data": { "id": "atc-1", "eventId": "evt-1", "fileId": "file-4", "kind": "PROPOSAL", "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/events/:id/attachments → 200
{ "status": "ok", "data": [ { "id": "atc-1", "eventId": "evt-1", "fileId": "file-4", "kind": "PROPOSAL", "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "file": { "id": "file-4", "storageKey": "2026-10-19/uuid-proposal.pdf", "originalName": "proposal.pdf", "mimeType": "application/pdf", "sizeBytes": 20480, "checksum": "def456…", "uploadedById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } } ] }
```

```json
// DELETE /api/events/attachments/:attachmentId → 200
{ "status": "attachment removed" }
```

```json
// GET /api/events/me/committees → 200
{ "status": "ok", "data": [ { "id": "cmt-1", "eventId": "evt-1", "userId": "usr-2", "eventRole": "Koordinator Acara", "positionId": null, "createdAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "event": { "id": "evt-1", "title": "Yasinan Rutin", "description": null, "category": "RUTIN", "isAdHoc": false, "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": "Aula", "budgetAmount": 500000, "status": "PLANNED", "isPublic": true, "recurrence": "NONE", "createdById": "usr-1", "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } } ] }
```

```json
// GET /api/events/me/attendance → 200
{ "status": "ok", "data": [ { "id": "att-1", "sessionId": "ses-1", "userId": "usr-2", "status": "HADIR", "checkedInAt": "2026-11-01T10:02:00.000Z", "note": null, "createdAt": "2026-11-01T10:02:00.000Z", "updatedAt": "2026-11-01T10:02:00.000Z", "deletedAt": null, "session": { "id": "ses-1", "eventId": "evt-1", "title": "Yasinan Rutin", "scheduledAt": "2026-11-01T10:00:00.000Z", "startAt": "2026-11-01T10:00:00.000Z", "endAt": null, "location": null, "note": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "event": { "id": "evt-1", "title": "Yasinan Rutin", "category": "RUTIN", "scope": "GEDUNG", "buildingId": "bld-1", "startAt": "2026-11-01T10:00:00.000Z", "status": "PLANNED", "isPublic": true, "recurrence": "NONE" } } } ] }
```

> `scope` default `ASRAMA` (kecuali ada `buildingId` → `GEDUNG`). `recurrence=NONE` membuat 1 sesi otomatis. Untuk kegiatan `GEDUNG`, kategori pengeluaran harus milik gedung kegiatan.

---

## 22. Pemilihan

Pemilihan ketua: kandidat, eligible role, voting (1 warga 1 suara), hasil, finalisasi ke jabatan. Ber-scope gedung.

| Method | Path                                     | Izin              | Tujuan                                             |
| ------ | ---------------------------------------- | ----------------- | -------------------------------------------------- |
| POST   | `/elections`                             | `election.CREATE` | Buat pemilihan (opsional `periodId`, `buildingId`) |
| GET    | `/elections?status=`                     | `election.READ`   | Daftar pemilihan                                    |
| GET    | `/elections/:id`                         | `election.READ`   | Detail pemilihan (+ eligibleRoles, candidates)      |
| PATCH  | `/elections/:id`                         | `election.UPDATE` | Ubah pemilihan                                      |
| DELETE | `/elections/:id`                         | `election.DELETE` | Hapus pemilihan                                     |
| PUT    | `/elections/:id/eligible-roles`          | `election.UPDATE` | Setel role pemilih (default `PENGHUNI`)             |
| POST   | `/elections/:id/open`                    | `election.UPDATE` | Buka pemilihan (maks 1 OPEN per scope)              |
| POST   | `/elections/:id/close`                   | `election.UPDATE` | Tutup + hitung & simpan hasil (transaksional)       |
| POST   | `/elections/:id/cancel`                  | `election.UPDATE` | Batalkan pemilihan                                  |
| GET    | `/elections/:id/candidates`              | `election.READ`   | Daftar kandidat                                     |
| POST   | `/elections/:id/candidates`              | `election.UPDATE` | Tambah kandidat (harus warga aktif)                 |
| DELETE | `/elections/:id/candidates/:candidateId` | `election.UPDATE` | Hapus kandidat                                      |
| POST   | `/elections/:id/vote`                    | `election.READ`   | Beri suara (1 user 1 suara; `candidateId: null` = abstain) |
| GET    | `/elections/:id/result`                  | `election.READ`   | Hasil (hanya setelah CLOSED/DONE)                   |
| POST   | `/elections/:id/finalize`                | `election.UPDATE` | Tetapkan pemenang ke jabatan (butuh `periodId`)     |

**Body**: `create` `{ code, title, description?, periodId?, buildingId?, startAt, endAt, allowAbstain?, eligibleRoleIds? }` · `eligible-roles` `{ roleIds[] }` · `candidate` `{ userId, orderNo?, vision?, mission? }` · `vote` `{ candidateId? }` · `finalize` `{ positionId, candidateId? }`

**Contoh respons**

```json
// POST /api/elections → 201
{ "status": "election created", "data": { "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "DRAFT", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-08-01T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/elections → 200
{
  "status": "ok",
  "data": [
    { "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "OPEN", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-09-01T08:00:00.000Z", "deletedAt": null, "period": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null }, "building": null }
  ]
}
```

```json
// GET /api/elections/:id → 200
{
  "status": "ok",
  "data": {
    "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "OPEN", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-09-01T08:00:00.000Z", "deletedAt": null,
    "period": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null },
    "building": null,
    "eligibleRoles": [ { "electionId": "el-1", "roleId": "role-penghuni", "role": { "id": "role-penghuni", "code": "PENGHUNI", "name": "Warga", "description": null, "isSystem": false, "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } } ],
    "candidates": [ { "id": "cand-1", "electionId": "el-1", "userId": "usr-2", "orderNo": 1, "vision": "Asrama nyaman", "mission": null, "createdAt": "2026-08-02T02:00:00.000Z", "updatedAt": "2026-08-02T02:00:00.000Z", "deletedAt": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } } ]
  }
}
```

```json
// PATCH /api/elections/:id → 200
{ "status": "election updated", "data": { "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026 (revisi)", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "DRAFT", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-08-02T02:00:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/elections/:id → 200
{ "status": "election deleted" }
```

```json
// PUT /api/elections/:id/eligible-roles → 200
{ "status": "eligible roles updated", "data": [ { "electionId": "el-1", "roleId": "role-penghuni", "role": { "id": "role-penghuni", "code": "PENGHUNI", "name": "Warga", "description": null, "isSystem": false, "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z", "deletedAt": null } } ] }
```

```json
// POST /api/elections/:id/open → 200
{ "status": "election opened", "data": { "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "OPEN", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-09-01T08:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/elections/:id/close → 200
{ "status": "election closed", "data": { "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "CLOSED", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-09-07T20:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/elections/:id/cancel → 200
{ "status": "election cancelled", "data": { "id": "el-1", "code": "KETUA-2026", "title": "Pemilihan Ketua 2026", "description": null, "periodId": "per-1", "buildingId": null, "startAt": "2026-09-01T08:00:00.000Z", "endAt": "2026-09-07T20:00:00.000Z", "status": "CANCELLED", "allowAbstain": true, "createdById": "usr-1", "createdAt": "2026-08-01T02:00:00.000Z", "updatedAt": "2026-09-07T20:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/elections/:id/candidates → 200
{ "status": "ok", "data": [ { "id": "cand-1", "electionId": "el-1", "userId": "usr-2", "orderNo": 1, "vision": "Asrama nyaman", "mission": null, "createdAt": "2026-08-02T02:00:00.000Z", "updatedAt": "2026-08-02T02:00:00.000Z", "deletedAt": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } } ] }
```

```json
// POST /api/elections/:id/candidates → 201
{ "status": "candidate added", "data": { "id": "cand-1", "electionId": "el-1", "userId": "usr-2", "orderNo": 1, "vision": "Asrama nyaman", "mission": null, "createdAt": "2026-08-02T02:00:00.000Z", "updatedAt": "2026-08-02T02:00:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/elections/:id/candidates/:candidateId → 200
{ "status": "candidate removed" }
```

```json
// POST /api/elections/:id/vote → 201
{ "status": "vote cast", "data": { "id": "vote-1", "electionId": "el-1", "voterId": "usr-2", "candidateId": "cand-1", "castAt": "2026-09-02T02:00:00.000Z", "createdAt": "2026-09-02T02:00:00.000Z" } }
```

```json
// GET /api/elections/:id/result → 200
{
  "status": "ok",
  "data": [
    { "id": "res-1", "electionId": "el-1", "candidateId": "cand-1", "votes": 1, "percentage": 100, "rank": 1, "recordedAt": "2026-09-07T20:00:00.000Z", "candidate": { "id": "cand-1", "electionId": "el-1", "userId": "usr-2", "orderNo": 1, "vision": "Asrama nyaman", "mission": null, "createdAt": "2026-08-02T02:00:00.000Z", "updatedAt": "2026-08-02T02:00:00.000Z", "deletedAt": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } } },
    { "id": "res-2", "electionId": "el-1", "candidateId": null, "votes": 0, "percentage": 0, "rank": 2, "recordedAt": "2026-09-07T20:00:00.000Z", "candidate": null }
  ]
}
```

```json
// POST /api/elections/:id/finalize → 200
{ "status": "election finalized", "data": { "id": "asg-1", "periodId": "per-1", "positionId": "pos-ketua", "userId": "usr-2", "buildingId": null, "startDate": "2026-09-08T00:00:00.000Z", "endDate": null, "isActive": true, "decreeNumber": null, "createdAt": "2026-09-08T02:00:00.000Z", "updatedAt": "2026-09-08T02:00:00.000Z", "deletedAt": null } }
```

---

## 23. Organisasi

Periode kepengurusan, jabatan, penugasan pengurus, dan struktur. Ber-scope gedung.

| Method | Path                                | Izin              | Tujuan                                         |
| ------ | ----------------------------------- | ----------------- | ---------------------------------------------- |
| POST   | `/organization/periods`             | `period.CREATE`   | Buat periode kepengurusan                      |
| GET    | `/organization/periods`             | `period.READ`     | Daftar periode                                 |
| GET    | `/organization/periods/:id`         | `period.READ`     | Detail periode                                 |
| PATCH  | `/organization/periods/:id`         | `period.UPDATE`   | Ubah periode                                   |
| POST   | `/organization/periods/:id/activate`| `period.UPDATE`   | Aktifkan periode (periode aktif tunggal)       |
| POST   | `/organization/positions`           | `position.CREATE` | Buat jabatan (opsional `buildingId`, `roleId`) |
| GET    | `/organization/positions`           | `position.READ`   | Daftar jabatan                                 |
| GET    | `/organization/positions/:id`       | `position.READ`   | Detail jabatan                                 |
| PATCH  | `/organization/positions/:id`       | `position.UPDATE` | Ubah jabatan                                   |
| DELETE | `/organization/positions/:id`       | `position.DELETE` | Nonaktifkan jabatan                            |
| POST   | `/organization/assignments`         | `position.CREATE` | Tugaskan pengurus (user + jabatan + periode)   |
| GET    | `/organization/assignments?userId=` | `position.READ`   | Daftar penugasan seorang user                  |
| DELETE | `/organization/assignments/:id`     | `position.UPDATE` | Akhiri penugasan                               |
| GET    | `/organization/structure?periodId=` | `position.READ`   | Struktur organisasi periode (jabatan + pemegang) |

**Body**: `period` `{ code, name, startDate, endDate, decreeNumber? }` · `position` `{ code, name, level?, buildingId?, roleId?, description? }` · `assignment` `{ periodId, positionId, userId, buildingId?, startDate, decreeNumber? }`

**Contoh respons**

```json
// POST /api/organization/periods → 201
{ "status": "period created", "data": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": false, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/organization/periods → 200
{ "status": "ok", "data": [ { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null } ] }
```

```json
// GET /api/organization/periods/:id → 200
{ "status": "ok", "data": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// PATCH /api/organization/periods/:id → 200
{ "status": "period updated", "data": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026 (revisi)", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": "SK-01", "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-09-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/organization/periods/:id/activate → 200
{ "status": "period activated", "data": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-09-01T00:00:00.000Z", "deletedAt": null } }
```

```json
// POST /api/organization/positions → 201
{ "status": "position created", "data": { "id": "pos-1", "code": "KETUA", "name": "Ketua", "level": 1, "buildingId": null, "roleId": null, "description": null, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/organization/positions → 200
{ "status": "ok", "data": [ { "id": "pos-1", "code": "KETUA", "name": "Ketua", "level": 1, "buildingId": null, "roleId": null, "description": null, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "role": null } ] }
```

```json
// GET /api/organization/positions/:id → 200
{ "status": "ok", "data": { "id": "pos-1", "code": "KETUA", "name": "Ketua", "level": 1, "buildingId": null, "roleId": null, "description": null, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "role": null } }
```

```json
// PATCH /api/organization/positions/:id → 200
{ "status": "position updated", "data": { "id": "pos-1", "code": "KETUA", "name": "Ketua Umum", "level": 1, "buildingId": null, "roleId": null, "description": null, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:05:00.000Z", "deletedAt": null } }
```

```json
// DELETE /api/organization/positions/:id → 200
{ "status": "position deleted" }
```

```json
// POST /api/organization/assignments → 201
{ "status": "position assigned", "data": { "id": "asg-1", "periodId": "per-1", "positionId": "pos-1", "userId": "usr-2", "buildingId": null, "startDate": "2026-02-01T00:00:00.000Z", "endDate": null, "isActive": true, "decreeNumber": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null } }
```

```json
// GET /api/organization/assignments?userId=usr-2 → 200
{ "status": "ok", "data": [ { "id": "asg-1", "periodId": "per-1", "positionId": "pos-1", "userId": "usr-2", "buildingId": null, "startDate": "2026-02-01T00:00:00.000Z", "endDate": null, "isActive": true, "decreeNumber": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "position": { "id": "pos-1", "code": "KETUA", "name": "Ketua", "level": 1, "buildingId": null, "roleId": null, "description": null, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null }, "period": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null } } ] }
```

```json
// DELETE /api/organization/assignments/:id → 200
{ "status": "position assignment ended", "data": { "id": "asg-1", "periodId": "per-1", "positionId": "pos-1", "userId": "usr-2", "buildingId": null, "startDate": "2026-02-01T00:00:00.000Z", "endDate": "2026-10-19T00:00:00.000Z", "isActive": false, "decreeNumber": null, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:10:00.000Z", "deletedAt": "2026-10-19T02:10:00.000Z" } }
```

```json
// GET /api/organization/structure?periodId=per-1 → 200
{
  "status": "ok",
  "data": {
    "period": { "id": "per-1", "code": "2025-2026", "name": "Kepengurusan 2025/2026", "startDate": "2025-09-01T00:00:00.000Z", "endDate": "2026-08-31T00:00:00.000Z", "decreeNumber": null, "isActive": true, "createdAt": "2025-08-01T00:00:00.000Z", "updatedAt": "2025-08-01T00:00:00.000Z", "deletedAt": null },
    "positions": [
      {
        "id": "pos-1", "code": "KETUA", "name": "Ketua", "level": 1, "buildingId": null, "roleId": null, "description": null, "isActive": true, "createdAt": "2026-10-19T02:00:00.000Z", "updatedAt": "2026-10-19T02:00:00.000Z", "deletedAt": null, "role": null,
        "holders": [
          { "assignmentId": "asg-1", "userId": "usr-2", "buildingId": null, "startDate": "2026-02-01T00:00:00.000Z", "endDate": null, "decreeNumber": null, "user": { "id": "usr-2", "email": "warga@gmail.com", "name": "Warga", "phone": null, "emailVerified": true, "buildingId": "bld-1", "nationalId": null, "gender": "MALE", "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-17T10:22:26.009Z", "updatedAt": "2026-10-18T23:21:19.529Z", "deletedAt": null } }
        ]
      }
    ]
  }
}
```

> Jabatan `code` unik per gedung (`COALESCE(buildingId,'')`). Penugasan = **struktur saja**; akses tetap dari `UserRole`.

---

## 24. Laporan

Laporan turunan (read-only) dari data transaksional. Ber-scope gedung.

| Method | Path                                              | Izin            | Tujuan                                                          |
| ------ | ------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| GET    | `/reports/arrears?buildingId=&year=&month=`       | `report.READ`   | Daftar tunggakan (`outstanding = total − paid`) + total         |
| GET    | `/reports/arrears/export`                         | `report.EXPORT` | Unduh tunggakan sebagai CSV                                     |
| GET    | `/reports/cash-balances?buildingId=`              | `report.READ`   | Saldo per akun kas (`opening + in − out`) + total               |
| GET    | `/reports/income-vs-expense?buildingId=&from=&to=`| `report.READ`   | Pemasukan vs pengeluaran + net + rincian kategori               |
| GET    | `/reports/income-vs-expense/export`               | `report.EXPORT` | Unduh pemasukan vs pengeluaran sebagai CSV                      |
| GET    | `/reports/events/:eventId/budget`                 | `report.READ`   | Anggaran vs realisasi kegiatan (+ `usagePercent`, `overBudget`) |

**Contoh respons**

```json
// GET /api/reports/arrears?buildingId=bld-1&year=2026&month=10 → 200
{
  "status": "ok",
  "data": {
    "year": 2026, "month": 10, "count": 1, "totalOutstanding": 150000,
    "items": [
      { "invoiceId": "inv-1", "code": "INV-AB12CD34EF56", "userId": "usr-2", "userName": "Budi", "buildingId": "bld-1", "buildingName": "Gedung Putra", "periodYear": 2026, "periodMonth": 10, "dueDate": "2026-10-10T00:00:00.000Z", "totalAmount": 350000, "paidAmount": 200000, "outstanding": 150000, "status": "PARTIAL" }
    ]
  }
}
```

```json
// GET /api/reports/cash-balances?buildingId=bld-1 → 200
{
  "status": "ok",
  "data": {
    "count": 1, "totalBalance": 100000,
    "items": [
      { "cashAccountId": "acc-1", "name": "Kas Tunai G1", "type": "CASH", "buildingId": "bld-1", "buildingName": "Gedung Putra", "openingBalance": 0, "totalIn": 350000, "totalOut": 250000, "balance": 100000 }
    ]
  }
}
```

```json
// GET /api/reports/income-vs-expense?buildingId=bld-1&from=2026-10-01&to=2026-10-31 → 200
{
  "status": "ok",
  "data": {
    "from": "2026-10-01T00:00:00.000Z", "to": "2026-10-31T00:00:00.000Z",
    "income": 350000, "expense": 250000, "net": 100000,
    "items": [
      { "categoryId": "cat-1", "categoryName": "Iuran", "direction": "IN", "total": 350000 },
      { "categoryId": "cat-2", "categoryName": "Listrik", "direction": "OUT", "total": 250000 }
    ]
  }
}
```

```json
// GET /api/reports/events/:eventId/budget → 200
{ "status": "ok", "data": { "eventId": "evt-1", "title": "Yasinan Rutin", "status": "PLANNED", "buildingId": "bld-1", "buildingName": "Gedung Putra", "budgetAmount": 500000, "realizedAmount": 300000, "remaining": 200000, "usagePercent": 60, "expenseCount": 1, "overBudget": false } }
```

```csv
// GET /api/reports/arrears/export?buildingId=bld-1 → 200 (text/csv)
Kode,Nama,Gedung,Periode,Jatuh Tempo,Total,Dibayar,Tunggakan,Status
INV-AB12CD34EF56,Budi,Gedung Putra,2026-10,2026-10-10T00:00:00.000Z,350000,200000,150000,PARTIAL
```

```csv
// GET /api/reports/income-vs-expense/export?buildingId=bld-1 → 200 (text/csv)
Kategori,Arah,Total
Iuran,IN,350000
Listrik,OUT,250000
```

> `from`/`to` bernilai `null` bila tidak dikirim. `budgetAmount`/`remaining` bernilai `null` bila kegiatan belum punya anggaran; `usagePercent` `null` bila anggaran 0/null. Ekspor mengembalikan `text/csv` (header `Content-Disposition: attachment`), bukan JSON.

---

## 25. Audit

Jejak audit (**immutable**). Otomatis diisi middleware untuk **semua mutasi sukses** oleh `SUPER_ADMIN`/`ADMIN_GEDUNG`, plus log manual kaya (`before`/`after`) untuk RBAC & keuangan.

| Method | Path                                                   | Izin         | Tujuan                                        |
| ------ | ------------------------------------------------------ | ------------ | --------------------------------------------- |
| GET    | `/audit-logs?entity=&entityId=&actorId=&action=&take=` | `audit.READ` | Daftar jejak audit (filter + `take` maks 500) |
| GET    | `/audit-logs/:id`                                      | `audit.READ` | Detail satu jejak audit                       |

**Field jejak**: `actorId`, `action`, `entity`, `entityId`, `path`, `before?`, `after?`, `ip?`, `createdAt`; relasi `actor` (User publik).

**Contoh respons**

```json
// GET /api/audit-logs?entity=room → 200
{
  "status": "ok",
  "data": [
    {
      "id": "audit-1", "actorId": "usr-1", "action": "CREATE", "entity": "room", "entityId": "room-1", "path": "/api/rooms", "before": null,
      "after": { "id": "room-1", "buildingId": "bld-1", "number": "101", "capacity": 4, "status": "ACTIVE" },
      "ip": "::1", "createdAt": "2026-10-19T02:00:00.000Z",
      "actor": { "id": "usr-1", "email": "admin@gmail.com", "name": "Admin Master", "phone": null, "emailVerified": true, "buildingId": null, "nationalId": null, "gender": null, "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-16T21:27:39.000Z", "updatedAt": "2026-10-16T21:27:39.000Z", "deletedAt": null }
    }
  ]
}
```

```json
// GET /api/audit-logs/:id → 200
{
  "status": "ok",
  "data": { "id": "audit-1", "actorId": "usr-1", "action": "CREATE", "entity": "room", "entityId": "room-1", "path": "/api/rooms", "before": null, "after": { "id": "room-1", "buildingId": "bld-1", "number": "101", "capacity": 4, "status": "ACTIVE" }, "ip": "::1", "createdAt": "2026-10-19T02:00:00.000Z", "actor": { "id": "usr-1", "email": "admin@gmail.com", "name": "Admin Master", "phone": null, "emailVerified": true, "buildingId": null, "nationalId": null, "gender": null, "guardianName": null, "guardianPhone": null, "address": null, "status": "ACTIVE", "submittedAt": null, "reviewedById": null, "reviewedAt": null, "rejectionReason": null, "createdAt": "2026-10-16T21:27:39.000Z", "updatedAt": "2026-10-16T21:27:39.000Z", "deletedAt": null } }
}
```

---

## 26. File

| Method | Path         | Izin            | Tujuan                                                       |
| ------ | ------------ | --------------- | ------------------------------------------------------------ |
| GET    | `/files/:id` | `document.READ` | Unduh berkas berdasarkan `fileId` (mengembalikan berkas mentah) |

**Contoh respons**: bukan JSON — server membalas isi berkas dengan header:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="ktp.pdf"
```

Bila `fileId` tidak ditemukan → `404 { "status": "File not found" }`.

---

## 27. Health

| Method | Path      | Izin | Tujuan             |
| ------ | --------- | ---- | ------------------ |
| GET    | `/health` | –    | Cek status layanan |

```json
// GET /api/health → 200
{ "status": "health is okay" }
```

---

## Lampiran A — Matriks izin (resource × action)

Izin = `resource` + `action`. `SUPER_ADMIN` memiliki **semua**. Kolom menunjukkan action yang **dipakai route**.

| Resource     | CREATE | READ | UPDATE | DELETE | APPROVE | VERIFY | EXPORT |
| ------------ | :----: | :--: | :----: | :----: | :-----: | :----: | :----: |
| `user`       |        |  ✓   |   ✓    |        |    ✓    |        |        |
| `role`       |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `permission` |        |      |        |        |         |        |        |
| `menu`       |        |      |        |        |         |        |        |
| `building`   |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `room`       |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `feeRule`    |   ✓    |  ✓   |        |   ✓    |         |        |        |
| `facility`   |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `occupancy`  |   ✓    |  ✓   |   ✓    |        |         |        |        |
| `document`   |   ✓    |  ✓   |        |        |         |   ✓    |        |
| `invoice`    |   ✓    |  ✓   |   ✓    |        |         |        |        |
| `payment`    |   ✓    |  ✓   |        |        |    ✓    |        |        |
| `cash`       |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `category`   |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `report`     |        |  ✓   |        |        |         |        |   ✓    |
| `audit`      |        |  ✓   |        |        |         |        |        |
| `position`   |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `period`     |   ✓    |  ✓   |   ✓    |        |         |        |        |
| `event`      |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |
| `election`   |   ✓    |  ✓   |   ✓    |   ✓    |         |        |        |

> `permission` & `menu` tidak punya route langsung — dikelola lewat penetapan ke role (`PUT /rbac/roles/:id/permissions|menus`).

---

## Lampiran B — Role default, menu, & akun demo

### Role default (seed)

| Code             | Deskripsi       | Izin utama (ringkas)                                                                                     | Scope        |
| ---------------- | --------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| `SUPER_ADMIN`    | Admin Master    | **Semua izin** + semua menu                                                                              | semua gedung |
| `ADMIN_GEDUNG`   | Admin Gedung    | `building.READ`; `room/feeRule/facility/occupancy/invoice/payment/cash/position/event/election` CRUD; `payment.APPROVE`; `document.READ+VERIFY`; `report.READ+EXPORT`; `user.READ`; `period.READ` | gedungnya    |
| `PENGHUNI`       | Warga           | `invoice.READ`, `payment.READ+CREATE`, `document.CREATE+READ`, `event.READ`, `election.READ`             | –            |
| `CALON_PENGHUNI` | Calon penghuni  | `document.CREATE+READ`                                                                                    | –            |

> `BENDAHARA` & `PENGURUS` **belum di-seed** (jabatan yang menunjuk role ini akan `roleId = null`).

### Menu per role

- **SUPER_ADMIN**: seluruh 47 baris menu.
- **ADMIN_GEDUNG**: semua menu kecuali `system.*` dan `me.invoice/me.payment/me.document/me.attendance/me.election`.
- **PENGHUNI**: `dashboard`, `event.list`, `event.session`, `event.attendance`, `election.list`, `election.result`, `me.profile`, `me.invoice`, `me.payment`, `me.document`, `me.attendance`, `me.election`.
- **CALON_PENGHUNI**: `dashboard`, `me.profile`, `me.document`.

### Akun demo (password `Sewdaq123`)

| Email               | Role             | Catatan                                                  |
| ------------------- | ---------------- | -------------------------------------------------------- |
| `admin@gmail.com`   | `SUPER_ADMIN`    | Akses penuh                                              |
| `gedung@gmail.com`  | `ADMIN_GEDUNG`   | Tanpa scope gedung by default → tulis ber-scope akan 403 |
| `warga@gmail.com`   | `PENGHUNI`       | Gender & penempatan belum diatur default                 |
| `calon@gmail.com`   | `CALON_PENGHUNI` | Untuk uji pendaftaran                                    |

> Bootstrap admin produksi via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. OTP dev dicetak ke console.

---

## Lampiran C — Catatan alur bisnis

1. **Pendaftaran → penghuni**: register → verify OTP (role `CALON_PENGHUNI`) → admin `submit`/`profile` → `approve` (ACTIVE + role `PENGHUNI`) → penempatan kamar → assign KM.
2. **Keuangan**: `POST /invoices/generate` (ISSUED) → **[warga]** `POST /me/payments/proof` + `POST /me/payments` (PENDING) → **[admin]** `POST /payment-submissions/:id/verify` (Payment + alokasi + ledger IN → PARTIAL/PAID) atau `reject` (warga ajukan ulang). Admin juga bisa mencatat langsung `POST /payments` (mis. CASH) → `POST /expenses` (ledger OUT) → laporan.
3. **Kegiatan**: buat Event → sesi/agenda (atau `generate`) → absensi → `POST /events/:id/expenses` (realisasi anggaran) → lampiran/LPJ.
4. **Pemilihan**: buat → eligible roles → kandidat → `open` → `vote` (1 warga 1 suara) → `close` (hitung hasil) → `result` → `finalize` ke jabatan (mis. `KETUA`).
5. **Organisasi**: buat periode → jabatan (menunjuk `roleId`) → penugasan pengurus → `structure`. Penugasan = **struktur saja**; akses pengurus tetap dari `UserRole`.
6. **Audit**: semua mutasi sukses oleh admin otomatis tercatat; RBAC & keuangan punya log kaya `before`/`after`.

---

## Lampiran D — Referensi enum

| Enum                  | Nilai                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `UserStatus`          | `PENDING`, `ACTIVE`, `REJECTED`, `CHECKOUT`, `INACTIVE`               |
| `PermissionAction`    | `CREATE`, `READ`, `UPDATE`, `DELETE`, `APPROVE`, `VERIFY`, `EXPORT`   |
| `Gender`              | `MALE`, `FEMALE`                                                      |
| `RoomStatus`          | `ACTIVE`, `MAINTENANCE`                                               |
| `OccupancyStatus`     | `ACTIVE`, `ENDED`                                                     |
| `FacilityScope`       | `ROOM`, `PUBLIC`                                                      |
| `FacilityUsage`       | `ASSIGNED`, `SHARED`                                                  |
| `FacilityCategory`    | `FURNITURE`, `SANITARY`, `APPLIANCE`, `OTHER`                         |
| `PublicFacStatus`     | `ACTIVE`, `MAINTENANCE`                                               |
| `DocStatus`           | `REQUESTED`, `UPLOADED`, `VERIFIED`, `REJECTED`                       |
| `InvoiceStatus`       | `ISSUED`, `PARTIAL`, `PAID`, `OVERDUE`, `VOID`                        |
| `InvoiceLineKind`     | `RENT`, `DISCOUNT`, `EVENT`, `OTHER`                                  |
| `PaymentMethod`       | `CASH`, `TRANSFER`, `QRIS`                                            |
| `PaymentSubmissionStatus` | `PENDING`, `VERIFIED`, `REJECTED`                                 |
| `CashAccountType`     | `CASH`, `BANK`                                                        |
| `CategoryKind`        | `INCOME`, `EXPENSE`                                                   |
| `LedgerDirection`     | `IN`, `OUT`                                                           |
| `LedgerSource`        | `PAYMENT`, `EXPENSE`, `ADJUSTMENT`, `TRANSFER`, `OPENING`, `REVERSAL` |
| `EventCategory`       | `RUTIN`, `BESAR`                                                      |
| `EventScope`          | `ASRAMA`, `GEDUNG`                                                    |
| `EventStatus`         | `PLANNED`, `ONGOING`, `DONE`, `CANCELLED`                             |
| `EventRecurrence`     | `NONE`, `WEEKLY`, `MONTHLY`                                           |
| `AttendanceStatus`    | `HADIR`, `IZIN`, `TIDAK`                                              |
| `EventAttachmentKind` | `PROPOSAL`, `NOTULEN`, `LPJ`, `FOTO`, `OTHER`                         |
| `ElectionStatus`      | `DRAFT`, `SCHEDULED`, `OPEN`, `CLOSED`, `DONE`, `CANCELLED`           |

---

## Lampiran E — Bentuk objek User (publik)

Semua endpoint yang mengembalikan `user`/`actor` memakai bentuk ini — **tanpa `password`**.

```json
{
  "id": "usr-2",
  "email": "warga@gmail.com",
  "name": "Warga",
  "phone": null,
  "emailVerified": true,
  "buildingId": "bld-1",
  "nationalId": null,
  "gender": "MALE",
  "guardianName": null,
  "guardianPhone": null,
  "address": null,
  "status": "ACTIVE",
  "submittedAt": null,
  "reviewedById": null,
  "reviewedAt": null,
  "rejectionReason": null,
  "createdAt": "2026-10-17T10:22:26.009Z",
  "updatedAt": "2026-10-18T23:21:19.529Z",
  "deletedAt": null
}
```