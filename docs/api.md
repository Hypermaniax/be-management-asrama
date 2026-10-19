# API Reference — Backend Asrama Mahasiswa Kepri (Yogyakarta)

Dokumentasi seluruh endpoint HTTP yang tersedia, izin yang dibutuhkan, dan **tujuan** masing-masing endpoint.

- Sumber: `src/routes/**`, `src/controller/**`, `src/validations/**`, `src/middleware/permission.ts`, [`plan.md`](./plan.md), [`erd.md`](./erd.md).
- Total: **140 endpoint** pada **22 modul** (di bawah prefix `/api`) + `GET /api/health`.
- Sifat: **dokumentasi manual**. Bila menambah/mengubah route, perbarui file ini.

---

## 1. Konvensi umum

| Aspek           | Keterangan                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL        | `http://localhost:8080/api` (dev)                                                                                                      |
| Format          | JSON (`Content-Type: application/json`), kecuali upload (multipart) & ekspor laporan (CSV)                                             |
| Autentikasi     | `Authorization: Bearer <JWT>` (masa berlaku 24 jam)                                                                                    |
| Envelope sukses | `{ "status": "<pesan>", "data": <objek/array> }`                                                                                       |
| Envelope error  | `AppError` → `{ "status": "<pesan>" }` · Zod → `{ "status": "validation error", "errors": [...] }` · 404 → `{ "status": "not found" }` |
| Izin            | Tiap route non-publik dijaga `requirePermission(resource, action)`; **default-deny**                                                   |
| SUPER_ADMIN     | Melewati semua pemeriksaan izin & scope gedung                                                                                         |
| Scope gedung    | `UserRole.buildingId` (null = semua gedung). Endpoint ber-scope memakai `resolveBuildingScope`                                         |
| Soft delete     | Semua tabel mutable; yang **immutable**: `LedgerEntry`, `PaymentAllocation`, `ElectionVote`, `ElectionResult`, `AuditLog`              |
| Uang            | Integer IDR (tanpa desimal)                                                                                                            |
| Idempotensi     | Operasi keuangan (bayar, pengeluaran, pemasukan, reversal) memakai `idempotencyKey`                                                    |
| Rate limit auth | 20 request / 15 menit / IP pada `/auth/register`, `/auth/login`, `/auth/request-otp`, `/auth/verify-otp`                               |

**Kode status umum**: `200` sukses · `201` dibuat · `400` validasi/permintaan salah · `401` belum login · `403` tidak punya izin/scope · `404` tidak ditemukan · `409` konflik (duplikat/keadaan) · `500` kesalahan server.

**Autentikasi ringkas**:

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "admin@gmail.com", "password": "Sewdaq123" }
```

```json
{
  "status": "login okay",
  "data": {
    "user": { "id": "…", "email": "admin@gmail.com" },
    "token": "eyJhbGci…"
  }
}
```

---

## 2. Ringkasan modul

| Modul                               | Prefix               | Jml | Menu terkait                       |
| ----------------------------------- | -------------------- | --- | ---------------------------------- |
| [Auth](#3-auth)                     | `/auth`              | 5   | –                                  |
| [RBAC](#4-rbac)                     | `/rbac`              | 9   | `system.*`                         |
| [Gedung](#5-gedung)                 | `/buildings`         | 4   | `master.building`                  |
| [Kamar](#6-kamar)                   | `/rooms`             | 4   | `master.room`                      |
| [Aturan Biaya](#7-aturan-biaya)     | `/fee-rules`         | 3   | `master.feeRule`                   |
| [Fasilitas](#8-fasilitas)           | `/facilities`        | 6   | `master.roomFacility`              |
| [Fasilitas Umum](#9-fasilitas-umum) | `/public-facilities` | 7   | `master.publicFacility`            |
| [Penghuni](#10-penghuni)            | `/residents`         | 7   | `resident.*`                       |
| [Dokumen](#11-dokumen)              | `/documents`         | 8   | `resident.document`, `me.document` |
| [Penempatan](#12-penempatan)        | `/occupancies`       | 3   | `resident.occupancy`               |
| [Tagihan](#13-tagihan)              | `/invoices`          | 4   | `finance.invoice`                  |
| [Pembayaran](#14-pembayaran)        | `/payments`          | 3   | `finance.payment`                  |
| [Akun Kas](#15-akun-kas)            | `/cash-accounts`     | 7   | `finance.cash`                     |
| [Kategori](#16-kategori)            | `/categories`        | 4   | `master.category`                  |
| [Pengeluaran](#17-pengeluaran)      | `/expenses`          | 3   | `finance.expense`                  |
| [Buku Kas](#18-buku-kas)            | `/ledger`            | 3   | `finance.cash`                     |
| [Kegiatan](#19-kegiatan)            | `/events`            | 21  | `event.*`                          |
| [Pemilihan](#20-pemilihan)          | `/elections`         | 15  | `election.*`                       |
| [Organisasi](#21-organisasi)        | `/organization`      | 14  | `organization.*`                   |
| [Laporan](#22-laporan)              | `/reports`           | 6   | `finance.report`                   |
| [Audit](#23-audit)                  | `/audit-logs`        | 2   | `system.audit`                     |
| [File](#24-file)                    | `/files`             | 1   | –                                  |
| [Health](#25-health)                | `/health`            | 1   | –                                  |

---

## 3. Auth

Registrasi, verifikasi OTP, dan sesi. **Semua publik** kecuali `/auth/me`.

| Method | Path                | Izin | Tujuan                                                                     |
| ------ | ------------------- | ---- | -------------------------------------------------------------------------- |
| POST   | `/auth/register`    | –    | Daftar akun baru (email + password), beri role `CALON_PENGHUNI`, kirim OTP |
| POST   | `/auth/verify-otp`  | –    | Verifikasi OTP → tandai `emailVerified` + kembalikan JWT                   |
| POST   | `/auth/request-otp` | –    | Kirim ulang OTP ke email                                                   |
| POST   | `/auth/login`       | –    | Login → JWT (wajib `emailVerified`)                                        |
| GET    | `/auth/me`          | auth | Profil ringkas user yang sedang login (`id`, `email`)                      |

**Body `POST /auth/register`** — `{ email: string(email), password: string(min 8) }`
**Body `POST /auth/verify-otp`** — `{ email: string, otp: string(6 digit) }`
**Body `POST /auth/request-otp`** — `{ email: string }`
**Body `POST /auth/login`** — `{ email: string, password: string }`

**OTP stateless**: kode = `HMAC_SHA256(OTP_SECRET ?? JWT_SECRET, "<email>:<timeStep>")` → 6 digit, TTL 300 detik (grace 1 langkah sebelumnya), anti-replay in-memory. Di dev tanpa SMTP, kode dicetak ke console (`[mailer:dev] OTP for …`).

```json
// POST /api/auth/verify-otp → 200
{
  "status": "otp verified",
  "data": {
    "verified": true,
    "user": { "id": "…", "email": "…" },
    "token": "eyJhbGci…"
  }
}
```

---

## 4. RBAC

Kelola role, permission, menu, dan penugasan role ke user (dengan scope gedung).

| Method | Path                          | Izin          | Tujuan                                                         |
| ------ | ----------------------------- | ------------- | -------------------------------------------------------------- |
| GET    | `/rbac/roles`                 | `role.READ`   | Daftar role                                                    |
| POST   | `/rbac/roles`                 | `role.CREATE` | Buat role                                                      |
| PATCH  | `/rbac/roles/:id`             | `role.UPDATE` | Ubah role (nama, deskripsi, aktif)                             |
| DELETE | `/rbac/roles/:id`             | `role.DELETE` | Nonaktifkan (soft delete) role                                 |
| PUT    | `/rbac/roles/:id/permissions` | `role.UPDATE` | Tetapkan daftar permission ke role                             |
| PUT    | `/rbac/roles/:id/menus`       | `role.UPDATE` | Tetapkan daftar menu ke role                                   |
| POST   | `/rbac/assign`                | `role.UPDATE` | Beri role ke user (opsional `buildingId` scope)                |
| DELETE | `/rbac/user-roles/:id`        | `role.UPDATE` | Cabut penugasan role dari user                                 |
| GET    | `/rbac/me`                    | auth (self)   | Akses efektif user login: roles, permissions, menus, buildings |

**Body `POST /rbac/roles`** — `{ code, name, description? }`
**Body `PUT /rbac/roles/:id/permissions`** — `{ permissionIds: string[] }`
**Body `PUT /rbac/roles/:id/menus`** — `{ menuIds: string[] }`
**Body `POST /rbac/assign`** — `{ userId, roleId, buildingId? (null = semua gedung) }`

```json
// GET /api/rbac/me → 200
{
  "status": "ok",
  "data": {
    "roles": ["ADMIN_GEDUNG"],
    "permissions": ["room.CREATE", "…"],
    "buildings": ["<g1-id>"],
    "isSuperAdmin": false,
    "menus": ["dashboard", "…"]
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

**Body `POST /buildings`** — `{ code, name, gender: "MALE"|"FEMALE", address }`

---

## 6. Kamar

Master kamar per gedung (ber-scope gedung).

| Method | Path         | Izin          | Tujuan                                                     |
| ------ | ------------ | ------------- | ---------------------------------------------------------- |
| POST   | `/rooms`     | `room.CREATE` | Buat kamar (`buildingId`, `number`, `capacity`, `status?`) |
| GET    | `/rooms`     | `room.READ`   | Daftar kamar (sesuai scope)                                |
| PATCH  | `/rooms/:id` | `room.UPDATE` | Ubah nomor/kapasitas/status                                |
| DELETE | `/rooms/:id` | `room.DELETE` | Nonaktifkan kamar                                          |

**Body `POST /rooms`** — `{ buildingId, number, capacity: int>0, status?: "ACTIVE"|"MAINTENANCE" }`

---

## 7. Aturan Biaya

Aturan iuran bulanan per gedung (dipakai saat penempatan & generate tagihan). Ber-scope gedung.

| Method | Path             | Izin             | Tujuan                                                    |
| ------ | ---------------- | ---------------- | --------------------------------------------------------- |
| POST   | `/fee-rules`     | `feeRule.CREATE` | Buat aturan biaya (`dueDayOfMonth`, `defaultMonthlyRate`) |
| GET    | `/fee-rules`     | `feeRule.READ`   | Daftar aturan biaya                                       |
| DELETE | `/fee-rules/:id` | `feeRule.DELETE` | Nonaktifkan aturan biaya                                  |

**Body `POST /fee-rules`** — `{ buildingId, dueDayOfMonth: 1..28, defaultMonthlyRate: int≥0, effectiveFrom: date }`

---

## 8. Fasilitas

Master fasilitas. `ROOM` = fasilitas kamar (jumlah), `PUBLIC` = fasilitas umum (`ASSIGNED` ber-slot / `SHARED`).

| Method | Path                        | Izin              | Tujuan                                               |
| ------ | --------------------------- | ----------------- | ---------------------------------------------------- |
| POST   | `/facilities`               | `facility.CREATE` | Buat fasilitas                                       |
| GET    | `/facilities?scope=`        | `facility.READ`   | Daftar fasilitas (`scope` opsional: `ROOM`/`PUBLIC`) |
| GET    | `/facilities/rooms/:roomId` | `facility.READ`   | Daftar fasilitas yang terpasang di sebuah kamar      |
| PUT    | `/facilities/rooms/:roomId` | `facility.UPDATE` | Setel daftar fasilitas kamar (jumlah per fasilitas)  |
| PATCH  | `/facilities/:id`           | `facility.UPDATE` | Ubah fasilitas                                       |
| DELETE | `/facilities/:id`           | `facility.DELETE` | Nonaktifkan fasilitas                                |

**Body `POST /facilities`** — `{ code, name, scope: "ROOM"|"PUBLIC", usageMode: "ASSIGNED"|"SHARED", category: "FURNITURE"|"SANITARY"|"APPLIANCE"|"OTHER" }`
**Body `PUT /facilities/rooms/:roomId`** — `{ items: [{ facilityId, quantity: int>0, note? }] }`

---

## 9. Fasilitas Umum

Instance fasilitas umum per gedung (mis. KM No. 3) + penugasan slot ke penghuni. Ber-scope gedung.

| Method | Path                                           | Izin              | Tujuan                                        |
| ------ | ---------------------------------------------- | ----------------- | --------------------------------------------- |
| POST   | `/public-facilities`                           | `facility.CREATE` | Buat fasilitas umum (mis. KM + nomor)         |
| GET    | `/public-facilities`                           | `facility.READ`   | Daftar fasilitas umum                         |
| PATCH  | `/public-facilities/:id`                       | `facility.UPDATE` | Ubah nomor/kapasitas/status/catatan           |
| DELETE | `/public-facilities/:id`                       | `facility.DELETE` | Nonaktifkan fasilitas umum                    |
| POST   | `/public-facilities/:id/assign`                | `facility.CREATE` | Tugaskan slot (`slotLabel`) ke penghuni       |
| GET    | `/public-facilities/:id/assignments`           | `facility.READ`   | Daftar penugasan pada fasilitas umum tersebut |
| DELETE | `/public-facilities/assignments/:assignmentId` | `facility.DELETE` | Lepaskan penugasan slot                       |

**Body `POST /public-facilities`** — `{ buildingId, facilityId, number?, capacity?, note? }` (wajib `number` untuk fasilitas `ASSIGNED`)
**Body `POST /public-facilities/:id/assign`** — `{ userId, slotLabel }`

---

## 10. Penghuni

Manajemen data penghuni & siklus hidup (submit → approve/reject → checkout). Ber-scope gedung.

| Method | Path                             | Izin           | Tujuan                                                                       |
| ------ | -------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| GET    | `/residents?buildingId=&status=` | `user.READ`    | Daftar penghuni per gedung (filter status opsional)                          |
| GET    | `/residents/:id`                 | `user.READ`    | Detail satu penghuni                                                         |
| PATCH  | `/residents/:id/profile`         | `user.UPDATE`  | Ubah profil (nama, telepon, gender, KTP, wali, alamat, gedung)               |
| POST   | `/residents/:id/submit`          | `user.UPDATE`  | Submit pendaftaran (set profil + status PENDING + `submittedAt`)             |
| POST   | `/residents/:id/approve`         | `user.APPROVE` | Terima: status ACTIVE + **beri role `PENGHUNI`** (+ set gedung bila dikirim) |
| POST   | `/residents/:id/reject`          | `user.APPROVE` | Tolak: status REJECTED + alasan                                              |
| POST   | `/residents/:id/checkout`        | `user.UPDATE`  | Checkout: status CHECKOUT                                                    |

**Query `GET /residents`** — `buildingId` (wajib), `status?` (`PENDING|ACTIVE|REJECTED|CHECKOUT|INACTIVE`)
**Body `PATCH /residents/:id/profile`** — `{ name?, phone?, buildingId?, nationalId?, gender?("MALE"|"FEMALE"), guardianName?, guardianPhone?, address? }`
**Body `POST /residents/:id/approve`** — `{ buildingId? }`
**Body `POST /residents/:id/reject`** — `{ reason }`

> Catatan: `approve` otomatis memberi role `PENGHUNI` (idempoten); `CALON_PENGHUNI` tetap dipertahankan untuk akses dokumen.

---

## 11. Dokumen

Jenis dokumen dinamis, permintaan, upload, dan verifikasi. Ber-scope gedung.

| Method | Path                           | Izin              | Tujuan                                                   |
| ------ | ------------------------------ | ----------------- | -------------------------------------------------------- |
| POST   | `/documents/types`             | `document.CREATE` | Buat jenis dokumen (mime diizinkan, ukuran maks, wajib?) |
| GET    | `/documents/types?buildingId=` | `document.READ`   | Daftar jenis dokumen per gedung                          |
| GET    | `/documents/required`          | `document.READ`   | Daftar dokumen wajib yang belum lengkap untuk user login |
| GET    | `/documents?userId=`           | `document.READ`   | Daftar dokumen milik seorang user                        |
| POST   | `/documents/request`           | `document.CREATE` | Minta user mengunggah jenis dokumen tertentu             |
| POST   | `/documents/upload`            | `document.CREATE` | Unggah berkas (multipart, field `file`) → `fileId`       |
| POST   | `/documents/:id/verify`        | `document.VERIFY` | Verifikasi dokumen                                       |
| POST   | `/documents/:id/reject`        | `document.VERIFY` | Tolak dokumen + alasan                                   |

**Body `POST /documents/types`** — `{ buildingId, code, name, isRequiredByDefault?, allowedMimeTypes: string[], maxSizeBytes, sortOrder? }`
**Body `POST /documents/request`** — `{ userId, documentTypeId }`
**Body `POST /documents/upload`** (multipart) — `documentTypeId` + file `file` (maks 10 MB)
**Body `POST /documents/:id/reject`** — `{ reason }`

```json
// POST /api/documents/upload → 201 (mengembalikan DocumentSubmission)
{
  "status": "document uploaded",
  "data": {
    "id": "…",
    "userId": "…",
    "documentTypeId": "…",
    "status": "UPLOADED",
    "fileId": "…",
    "version": 1
  }
}
```

---

## 12. Penempatan

Penempatan kamar (`Occupancy`) + checkout. Ber-scope gedung.

| Method | Path                        | Izin               | Tujuan                                                                |
| ------ | --------------------------- | ------------------ | --------------------------------------------------------------------- |
| POST   | `/occupancies`              | `occupancy.CREATE` | Tempatkan penghuni ke kamar (cek kapasitas + kecocokan gender gedung) |
| GET    | `/occupancies`              | `occupancy.READ`   | Daftar penempatan                                                     |
| POST   | `/occupancies/:id/checkout` | `occupancy.UPDATE` | Akhiri penempatan + bebaskan slot fasilitas                           |

**Body `POST /occupancies`** — `{ userId, roomId, bedLabel? }`

> Syarat: kamar `ACTIVE`, penghuni `ACTIVE`, gender cocok dengan gedung, kamar belum penuh, penghuni belum punya penempatan aktif, dan ada aturan biaya aktif.

---

## 13. Tagihan

Generate & kelola tagihan bulanan (`Invoice`). Ber-scope gedung.

| Method | Path                 | Izin             | Tujuan                                                     |
| ------ | -------------------- | ---------------- | ---------------------------------------------------------- |
| POST   | `/invoices/generate` | `invoice.CREATE` | Generate tagihan bulanan untuk semua penghuni aktif gedung |
| GET    | `/invoices`          | `invoice.READ`   | Daftar tagihan (filter gedung/status/tahun/bulan)          |
| GET    | `/invoices/:id`      | `invoice.READ`   | Detail tagihan (termasuk `lines` & `allocations`)          |
| POST   | `/invoices/:id/void` | `invoice.UPDATE` | Batalkan tagihan (gagal bila sudah ada pembayaran)         |

**Body `POST /invoices/generate`** — `{ buildingId, year, month: 1..12 }`
**Query `GET /invoices`** — `buildingId?`, `status?` (`ISSUED|PARTIAL|PAID|OVERDUE|VOID`), `year?`, `month?`

> `totalAmount = baseAmount − discountAmount`; `paidAmount` = jumlah alokasi pembayaran; status: `PAID · PARTIAL · ISSUED · OVERDUE · VOID`.

---

## 14. Pembayaran

Catat pembayaran & alokasikan ke tagihan (FIFO bila `allocations` tidak dikirim). Otomatis mencatat `LedgerEntry` IN ke kas gedung. Ber-scope gedung.

| Method | Path                | Izin             | Tujuan                                    |
| ------ | ------------------- | ---------------- | ----------------------------------------- |
| POST   | `/payments`         | `payment.CREATE` | Catat pembayaran + alokasi + ledger masuk |
| GET    | `/payments?userId=` | `payment.READ`   | Daftar pembayaran (filter user opsional)  |
| GET    | `/payments/:id`     | `payment.READ`   | Detail pembayaran                         |

**Body `POST /payments`**

```json
{
  "userId": "<uuid>",
  "amount": 350000,
  "method": "CASH",
  "cashAccountId": "<uuid, opsional>",
  "referenceNo": "opsional",
  "proofFileId": "<uuid, opsional>",
  "idempotencyKey": "pay-2026-10-001",
  "note": "opsional",
  "allocations": [{ "invoiceId": "<uuid>", "amount": 350000 }]
}
```

`method`: `CASH | TRANSFER | QRIS`. Bila `allocations` kosong → alokasi otomatis ke tagihan outstanding tertua.

---

## 15. Akun Kas

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

**Body `POST /cash-accounts`** — `{ buildingId, name, type?: "CASH"|"BANK", openingBalance?: int }`

---

## 16. Kategori

Kategori kas (pemasukan/pengeluaran) per gedung. Ber-scope gedung.

| Method | Path                | Izin              | Tujuan                                  |
| ------ | ------------------- | ----------------- | --------------------------------------- |
| POST   | `/categories`       | `category.CREATE` | Buat kategori (`kind`: INCOME/EXPENSE)  |
| GET    | `/categories?kind=` | `category.READ`   | Daftar kategori (filter jenis opsional) |
| PATCH  | `/categories/:id`   | `category.UPDATE` | Ubah nama/jenis                         |
| DELETE | `/categories/:id`   | `category.DELETE` | Nonaktifkan kategori                    |

**Body `POST /categories`** — `{ buildingId, name, kind: "INCOME"|"EXPENSE" }`

---

## 17. Pengeluaran

Catat pengeluaran (kas keluar) + ledger OUT. Memakai izin resource `cash`. Ber-scope gedung.

| Method | Path            | Izin          | Tujuan                                    |
| ------ | --------------- | ------------- | ----------------------------------------- |
| POST   | `/expenses`     | `cash.CREATE` | Catat pengeluaran (wajib `receiptFileId`) |
| GET    | `/expenses`     | `cash.READ`   | Daftar pengeluaran                        |
| GET    | `/expenses/:id` | `cash.READ`   | Detail pengeluaran                        |

**Body `POST /expenses`**

```json
{
  "categoryId": "<uuid>",
  "amount": 250000,
  "occurredAt": "2026-10-19T00:00:00.000Z",
  "receiptFileId": "<uuid>",
  "cashAccountId": "<uuid, opsional>",
  "vendor": "opsional",
  "description": "opsional",
  "eventId": "<uuid, opsional>",
  "idempotencyKey": "exp-2026-10-001"
}
```

---

## 18. Buku Kas

Buku besar (`LedgerEntry`, **append-only**). Pemasukan manual & reversal. Ber-scope gedung.

| Method | Path                     | Izin          | Tujuan                                         |
| ------ | ------------------------ | ------------- | ---------------------------------------------- |
| GET    | `/ledger?cashAccountId=` | `cash.READ`   | Daftar entri buku besar (filter akun opsional) |
| POST   | `/ledger/income`         | `cash.CREATE` | Catat pemasukan manual (source `ADJUSTMENT`)   |
| POST   | `/ledger/:id/reversal`   | `cash.UPDATE` | Balik (reverse) sebuah entri (sekali saja)     |

**Body `POST /ledger/income`** — `{ categoryId, amount: int>0, idempotencyKey, occurredAt?, cashAccountId?, description? }`
**Body `POST /ledger/:id/reversal`** — `{ reason }`

---

## 19. Kegiatan

Manajemen kegiatan (`Event`), sesi/agenda, panitia, absensi, anggaran, dan lampiran/LPJ. Ber-scope gedung.

| Method | Path                                     | Izin           | Tujuan                                                 |
| ------ | ---------------------------------------- | -------------- | ------------------------------------------------------ |
| POST   | `/events`                                | `event.CREATE` | Buat kegiatan (rutin/besar, scope ASRAMA/GEDUNG)       |
| GET    | `/events?status=&category=`              | `event.READ`   | Daftar kegiatan (non-privileged hanya yang `isPublic`) |
| GET    | `/events/:id`                            | `event.READ`   | Detail kegiatan (+ sesi/panitia/lampiran)              |
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

**Body `POST /events`** — `{ title, description?, category?("RUTIN"|"BESAR"), isAdHoc?, scope?("ASRAMA"|"GEDUNG"), buildingId?, startAt, endAt?, location?, budgetAmount?, isPublic?, recurrence?("NONE"|"WEEKLY"|"MONTHLY") }`
**Body `POST /events/:id/sessions`** — `{ scheduledAt, title?, startAt?, endAt?, location?, note? }`
**Body `POST /events/:id/sessions/generate`** — `{ dates: date[] }`
**Body `POST /events/:id/committees`** — `{ userId, eventRole, positionId? }`
**Body `PUT /events/sessions/:sessionId/attendance`** — `{ records: [{ userId, status: "HADIR"|"IZIN"|"TIDAK", checkedInAt?, note? }] }`
**Body `POST /events/:id/expenses`** — sama dengan body `/expenses` (tanpa `eventId`, otomatis dari path)
**Body `POST /events/:id/attachments`** — `{ fileId, kind: "PROPOSAL"|"NOTULEN"|"LPJ"|"FOTO"|"OTHER", note? }`

> `scope` default `ASRAMA` (kecuali ada `buildingId` → `GEDUNG`). `recurrence=NONE` membuat 1 sesi otomatis. Untuk kegiatan `GEDUNG`, kategori pengeluaran harus milik gedung kegiatan.

---

## 20. Pemilihan

Pemilihan ketua: kandidat, eligible role, voting (1 warga 1 suara), hasil, finalisasi ke jabatan. Ber-scope gedung.

| Method | Path                                     | Izin              | Tujuan                                                                    |
| ------ | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| POST   | `/elections`                             | `election.CREATE` | Buat pemilihan (opsional `periodId`, `buildingId`)                        |
| GET    | `/elections?status=`                     | `election.READ`   | Daftar pemilihan                                                          |
| GET    | `/elections/:id`                         | `election.READ`   | Detail pemilihan (+ kandidat/eligible)                                    |
| PATCH  | `/elections/:id`                         | `election.UPDATE` | Ubah pemilihan                                                            |
| DELETE | `/elections/:id`                         | `election.DELETE` | Hapus pemilihan                                                           |
| PUT    | `/elections/:id/eligible-roles`          | `election.UPDATE` | Setel role pemilih (default `PENGHUNI`)                                   |
| POST   | `/elections/:id/open`                    | `election.UPDATE` | Buka pemilihan (maks 1 OPEN per scope)                                    |
| POST   | `/elections/:id/close`                   | `election.UPDATE` | Tutup + hitung & simpan hasil (transaksional)                             |
| POST   | `/elections/:id/cancel`                  | `election.UPDATE` | Batalkan pemilihan                                                        |
| GET    | `/elections/:id/candidates`              | `election.READ`   | Daftar kandidat                                                           |
| POST   | `/elections/:id/candidates`              | `election.UPDATE` | Tambah kandidat (harus warga aktif)                                       |
| DELETE | `/elections/:id/candidates/:candidateId` | `election.UPDATE` | Hapus kandidat                                                            |
| POST   | `/elections/:id/vote`                    | `election.READ`   | Beri suara (1 user 1 suara; `candidateId: null` = abstain bila diizinkan) |
| GET    | `/elections/:id/result`                  | `election.READ`   | Hasil (hanya setelah CLOSED/DONE)                                         |
| POST   | `/elections/:id/finalize`                | `election.UPDATE` | Tetapkan pemenang ke jabatan (butuh `periodId`)                           |

**Body `POST /elections`** — `{ code, title, description?, periodId?, buildingId?, startAt, endAt, allowAbstain?, eligibleRoleIds? }`
**Body `PUT /elections/:id/eligible-roles`** — `{ roleIds: string[] }`
**Body `POST /elections/:id/candidates`** — `{ userId, orderNo?, vision?, mission? }`
**Body `POST /elections/:id/vote`** — `{ candidateId? }`
**Body `POST /elections/:id/finalize`** — `{ positionId, candidateId? }` (tanpa `candidateId` → pemenang rank 1; seri wajib sebutkan)

```json
// GET /api/elections/:id/result → 200
{
  "status": "ok",
  "data": [
    { "candidateId": "…", "votes": 1, "percentage": 100, "rank": 1 },
    { "candidateId": null, "votes": 0, "percentage": 0, "rank": 2 }
  ]
}
```

---

## 21. Organisasi

Periode kepengurusan, jabatan, penugasan pengurus, dan struktur. Ber-scope gedung.

| Method | Path                                 | Izin              | Tujuan                                           |
| ------ | ------------------------------------ | ----------------- | ------------------------------------------------ |
| POST   | `/organization/periods`              | `period.CREATE`   | Buat periode kepengurusan                        |
| GET    | `/organization/periods`              | `period.READ`     | Daftar periode                                   |
| GET    | `/organization/periods/:id`          | `period.READ`     | Detail periode                                   |
| PATCH  | `/organization/periods/:id`          | `period.UPDATE`   | Ubah periode                                     |
| POST   | `/organization/periods/:id/activate` | `period.UPDATE`   | Aktifkan periode (periode aktif tunggal)         |
| POST   | `/organization/positions`            | `position.CREATE` | Buat jabatan (opsional `buildingId`, `roleId`)   |
| GET    | `/organization/positions`            | `position.READ`   | Daftar jabatan                                   |
| GET    | `/organization/positions/:id`        | `position.READ`   | Detail jabatan                                   |
| PATCH  | `/organization/positions/:id`        | `position.UPDATE` | Ubah jabatan                                     |
| DELETE | `/organization/positions/:id`        | `position.DELETE` | Nonaktifkan jabatan                              |
| POST   | `/organization/assignments`          | `position.CREATE` | Tugaskan pengurus (user + jabatan + periode)     |
| GET    | `/organization/assignments?userId=`  | `position.READ`   | Daftar penugasan seorang user                    |
| DELETE | `/organization/assignments/:id`      | `position.UPDATE` | Akhiri penugasan                                 |
| GET    | `/organization/structure?periodId=`  | `position.READ`   | Struktur organisasi periode (jabatan + pemegang) |

**Body `POST /organization/periods`** — `{ code, name, startDate, endDate, decreeNumber? }`
**Body `POST /organization/positions`** — `{ code, name, level?, buildingId?, roleId?, description? }`
**Body `POST /organization/assignments`** — `{ periodId, positionId, userId, buildingId?, startDate, decreeNumber? }`

> Jabatan `code` unik per gedung (`COALESCE(buildingId,'')`). Penugasan = **struktur saja**; akses tetap bersumber dari `UserRole` (lihat [Lampiran C](#lampiran-c--catatan-alur-bisnis)).

---

## 22. Laporan

Laporan turunan (read-only) dari data transaksional. Ber-scope gedung.

| Method | Path                                               | Izin            | Tujuan                                                          |
| ------ | -------------------------------------------------- | --------------- | --------------------------------------------------------------- |
| GET    | `/reports/arrears?buildingId=&year=&month=`        | `report.READ`   | Daftar tunggakan (`outstanding = total − paid`) + total         |
| GET    | `/reports/arrears/export`                          | `report.EXPORT` | Unduh tunggakan sebagai CSV                                     |
| GET    | `/reports/cash-balances?buildingId=`               | `report.READ`   | Saldo per akun kas (`opening + in − out`) + total               |
| GET    | `/reports/income-vs-expense?buildingId=&from=&to=` | `report.READ`   | Pemasukan vs pengeluaran + net + rincian kategori               |
| GET    | `/reports/income-vs-expense/export`                | `report.EXPORT` | Unduh pemasukan vs pengeluaran sebagai CSV                      |
| GET    | `/reports/events/:eventId/budget`                  | `report.READ`   | Anggaran vs realisasi kegiatan (+ `usagePercent`, `overBudget`) |

```json
// GET /api/reports/events/:eventId/budget → 200
{
  "status": "ok",
  "data": {
    "eventId": "…",
    "title": "…",
    "budgetAmount": 500000,
    "realizedAmount": 300000,
    "remaining": 200000,
    "usagePercent": 60,
    "expenseCount": 1,
    "overBudget": false
  }
}
```

> Ekspor mengembalikan `text/csv` (header `Content-Disposition: attachment`), bukan JSON.

---

## 23. Audit

Jejak audit (**immutable**). Otomatis diisi middleware untuk **semua mutasi sukses** oleh `SUPER_ADMIN`/`ADMIN_GEDUNG`, plus log manual kaya (`before`/`after`) untuk RBAC & keuangan.

| Method | Path                                                   | Izin         | Tujuan                                        |
| ------ | ------------------------------------------------------ | ------------ | --------------------------------------------- |
| GET    | `/audit-logs?entity=&entityId=&actorId=&action=&take=` | `audit.READ` | Daftar jejak audit (filter + `take` maks 500) |
| GET    | `/audit-logs/:id`                                      | `audit.READ` | Detail satu jejak audit                       |

**Field jejak**: `actorId`, `action`, `entity`, `entityId`, `path`, `before?`, `after?`, `ip?`, `createdAt`.

---

## 24. File

| Method | Path         | Izin            | Tujuan                                                          |
| ------ | ------------ | --------------- | --------------------------------------------------------------- |
| GET    | `/files/:id` | `document.READ` | Unduh berkas berdasarkan `fileId` (mengembalikan berkas mentah) |

---

## 25. Health

| Method | Path      | Izin | Tujuan             |
| ------ | --------- | ---- | ------------------ |
| GET    | `/health` | –    | Cek status layanan |

```json
{ "status": "health is okay" }
```

---

## Lampiran A — Matriks izin (resource × action)

Izin = `resource` + `action`. `SUPER_ADMIN` memiliki **semua**. Kolom menunjukkan action yang **dipakai route** (bukan seluruh kombinasi yang tersedia).

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
| `payment`    |   ✓    |  ✓   |        |        |         |        |        |
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

| Code             | Deskripsi      | Izin utama (ringkas)                                                                                                                                                           | Scope        |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| `SUPER_ADMIN`    | Admin Master   | **Semua izin** + semua menu                                                                                                                                                    | semua gedung |
| `ADMIN_GEDUNG`   | Admin Gedung   | `building.READ`; `room/feeRule/facility/occupancy/invoice/payment/cash/position/event/election` CRUD; `document.READ+VERIFY`; `report.READ+EXPORT`; `user.READ`; `period.READ` | gedungnya    |
| `PENGHUNI`       | Warga          | `invoice.READ`, `payment.READ`, `document.CREATE+READ`, `event.READ`, `election.READ`                                                                                          | –            |
| `CALON_PENGHUNI` | Calon penghuni | `document.CREATE+READ`                                                                                                                                                         | –            |

> `BENDAHARA` & `PENGURUS` **belum di-seed** (jabatan yang menunjuk ke role ini akan `roleId = null`).

### Menu per role

- **SUPER_ADMIN**: seluruh 46 baris menu.
- **ADMIN_GEDUNG**: semua menu kecuali `system.*` dan `me.invoice/me.document/me.attendance/me.election`.
- **PENGHUNI**: `dashboard`, `event.list`, `event.session`, `event.attendance`, `election.list`, `election.result`, `me.profile`, `me.invoice`, `me.document`, `me.attendance`, `me.election`.
- **CALON_PENGHUNI**: `dashboard`, `me.profile`, `me.document`.

### Akun demo (password `Sewdaq123`)

| Email              | Role             | Catatan                                                  |
| ------------------ | ---------------- | -------------------------------------------------------- |
| `admin@gmail.com`  | `SUPER_ADMIN`    | Akses penuh                                              |
| `gedung@gmail.com` | `ADMIN_GEDUNG`   | Tanpa scope gedung by default → tulis ber-scope akan 403 |
| `warga@gmail.com`  | `PENGHUNI`       | Gender & penempatan belum diatur default                 |
| `calon@gmail.com`  | `CALON_PENGHUNI` | Untuk uji pendaftaran                                    |

> Bootstrap admin produksi via `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`. OTP dev dicetak ke console.

---

## Lampiran C — Catatan alur bisnis

1. **Pendaftaran → penghuni**: register → verify OTP (role `CALON_PENGHUNI`) → admin `submit`/`profile` → `approve` (status ACTIVE + role `PENGHUNI`) → penempatan kamar → assign KM.
2. **Keuangan**: `POST /invoices/generate` (ISSUED) → `POST /payments` (alokasi → PARTIAL/PAID) → `LedgerEntry` IN ke akun kas gedung → `POST /expenses` (ledger OUT) → laporan (tunggakan, saldo, pemasukan vs pengeluaran).
3. **Kegiatan**: buat Event → sesi/agenda (atau `generate`) → absensi → `POST /events/:id/expenses` (realisasi anggaran) → lampiran/LPJ.
4. **Pemilihan**: buat → eligible roles → kandidat → `open` → `vote` (1 warga 1 suara) → `close` (hitung hasil) → `result` → `finalize` ke jabatan (mis. `KETUA`).
5. **Organisasi**: buat periode → jabatan (menunjuk `roleId`) → penugasan pengurus → `structure`. Penugasan = **struktur saja**; akses pengurus tetap dari `UserRole` (bukan otomatis dari jabatan).
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
