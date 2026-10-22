# Checklist Cyber Attack — Backend Asrama Kepri

> Checklist audit keamanan untuk repo ini. Diisi **satu per satu** setelah dokumen dibuat:
> setiap item diverifikasi terhadap kode aktual (mencari bukti mitigasi + cara uji).
>
> - Implementasi: `app.ts`, `src/middleware/*`, `src/routes/*`, `src/services/*`, `src/lib/*`
> - Referensi API: [`docs/api.md`](./api.md) · Desain: [`docs/plan.md`](./plan.md)

## Stack

| Komponen    | Library                                | Catatan                                            |
| ----------- | -------------------------------------- | -------------------------------------------------- |
| HTTP        | Express 5 + `cors`                     | `app.use(cors())` default di `app.ts`              |
| Validasi    | zod                                    | semua controller; error → 400 `validation error`   |
| Auth token  | `jsonwebtoken` (JWT 24h, `JWT_SECRET`) | pemakaian di `src/middleware/auth.ts`              |
| Password    | `bcryptjs`                             | hash di `src/lib/password.ts`                      |
| Upload      | `multer` (memoryStorage, limit 10MB)   | `/me/payments/proof`, dokumen; sniff MIME manual   |
| DB          | Prisma 7 + `@prisma/adapter-pg` (PostgreSQL) | repositori memakai query prisma typed         |
| Email/OTP   | `nodemailer` + OTP stateless HMAC      | TTL 5 mnt, used-set anti-replay in-memory          |
| Rate limit  | `express-rate-limit`                   | saat ini hanya di route auth                       |

## Legend status

- `[x]` ✅ aman — mitigasi ada & terverifikasi di kode
- `~` ⚠️ sebagian — ada mitigasi tapi ada celah/tergantung config
- `[ ]` ❌ belum — belum ada mitigasi / belum dicek
- `–` ➖ N/A — tidak relevan untuk stack ini (beri alasan)

---

## 1. Authentication & Authorization

- [ ] Brute Force Attack — ✅ aman (rate limit 20/15mnt di auth)
- [x] Credential Stuffing — ✅ aman (limit per-IP + lockout per-akun 5 salah/15mnt)
- [ ] Broken Authentication — ✅ aman (bcrypt + emailVerified gate, pesan generik)
- [ ] JWT Token Forgery — ✅ aman (HS256 + secret required, menolak alg none)
- [x] JWT Token Theft / Replay Attack — ✅ aman (refresh token rotasi + revoke di DB, deteksi replay)
- [ ] Broken Access Control — ✅ aman (guard global + route-coverage test)
- [ ] IDOR — ✅ aman (ownership objek per-user + scope gedung)
- [ ] Privilege Escalation — ✅ aman (assign role gated `role.UPDATE`)
- [x] Session Hijacking — ✅ aman (Bearer tanpa cookie; access 1 jam + rotasi/deteksi replay)
- [ ] Mass Assignment — ✅ aman (zod parse eksplisit, tanpa req.body spread)

## 2. Database & Injection

- [x] SQL Injection — ✅ aman (repo penuh query Prisma typed + zod; dicek di seluruh kode)
- [ ] Blind SQL Injection — ✅ aman (tidak ada raw SQL; error DB tidak dikirim ke klien)
- [x] Second-Order SQL Injection — ✅ aman (data tersimpan hanya dipakai parameter typed)
- [x] NoSQL Injection — ➖ N/A (PostgreSQL)
- [x] ORM Misuse / Unsafe Raw Queries — ✅ aman (0 hook `$queryRaw`/`$executeRaw` di src)
- [x] Database Credential Leakage — ✅ aman (`.env` di-gitignore, tidak di-track; config `required()` boot)

## 3. API & HTTP Attacks

- [ ] Broken Object Level Authorization (BOLA)
- [ ] Broken Function Level Authorization (BFLA)
- [ ] API Rate Limit Bypass
- [ ] Denial of Service (DoS)
- [ ] Distributed Denial of Service (DDoS)
- [ ] HTTP Parameter Pollution
- [ ] Mass Assignment
- [ ] Improper Input Validation
- [ ] Unrestricted Resource Consumption
- [ ] API Enumeration

## 4. Web & Browser Attacks

- [ ] Cross-Site Scripting (XSS)
- [ ] Cross-Site Request Forgery (CSRF)
- [ ] CORS Misconfiguration
- [ ] Clickjacking
- [ ] Open Redirect
- [ ] Host Header Injection
- [ ] HTTP Request Smuggling
- [ ] Server-Side Request Forgery (SSRF)

## 5. File Upload & Storage

- [ ] Malicious File Upload
- [ ] MIME Type Spoofing
- [ ] Path Traversal
- [ ] Arbitrary File Read
- [ ] Arbitrary File Write
- [ ] Zip Bomb
- [ ] File Upload DoS
- [ ] Sensitive File Exposure

## 6. Password, Email & OTP

- [ ] Password Spraying
- [ ] Weak Password Hashing
- [ ] Password Reset Abuse
- [ ] OTP Brute Force
- [ ] OTP Replay Attack
- [ ] Email Bombing
- [ ] Email Spoofing
- [ ] Account Enumeration

## 7. Business Logic Attacks

- [ ] Payment Manipulation
- [ ] Price Tampering
- [ ] Coupon Abuse (_N/A — tidak ada kupon/diskon kupon_)
- [ ] Race Condition
- [ ] Replay Attack
- [ ] Duplicate Transaction
- [ ] Insufficient Transaction Authorization
- [ ] Workflow Bypass

## 8. Server & Infrastructure

- [ ] Remote Code Execution (RCE)
- [ ] Command Injection
- [ ] Directory Traversal
- [ ] Environment Variable Leakage
- [ ] Server-Side Information Disclosure
- [ ] Prototype Pollution
- [ ] Memory Exhaustion
- [ ] Dependency / Supply Chain Attack
- [ ] Misconfigured Reverse Proxy
- [ ] Secrets Exposure di Git

## 9. Logging & Monitoring

- [ ] Log Injection
- [ ] Sensitive Data in Logs
- [ ] Audit Log Tampering
- [ ] Security Event Detection Failure
- [ ] Error Stack Trace Leakage

## 10. Dependency ( stack: Express, Prisma+pg, jsonwebtoken, bcryptjs, multer, nodemailer)

- [ ] Vulnerability pada Express.js
- [ ] Vulnerability pada Prisma dan Prisma Client
- [ ] Vulnerability pada PostgreSQL driver (pg)
- [ ] Vulnerability pada jsonwebtoken
- [ ] Vulnerability pada bcryptjs
- [ ] Vulnerability pada multer
- [ ] Vulnerability pada nodemailer
- [ ] Vulnerability pada dependency transitif melalui npm

---

## Temuan awal (draft — akan diverifikasi satu per satu)

> Catatan cepat yang terlihat saat menyusun dokumen; belum dipastikan ke kode detail.

1. **Rate limit hanya di route auth** (`src/routes/auth/auth.ts`) — endpoint lain belum ada limiter → kaitan dgn DoS/API enumeration. *(diuji & ok untuk kategori auth; masih terbuka untuk kategori 3)*
2. **`app.use(cors())` default** — `Access-Control-Allow-Origin: *` (tanpa credentials); perlu dilihat dampaknya untuk API berbasis `Authorization` header.
3. **`express.json()` tanpa `limit`** — default 100kb Express, tapi perlu dikonfirmasi.
4. **Error 500 global**: `console.error(err)` lalu respons generic "internal server error" — stack trace tidak bocor ke klien ✅, tapi perlu cek error Prisma/raw SQL/Zod lain.
5. **Multer**: `memoryStorage` + `fileSize` 10MB; MIME divalidasi manual (sniff) — perlu cek semua endpoint upload & ekstensi/`originalName`.
6. **JWT**: signing & verify `jsonwebtoken` v9; ✅ cek selesai (kategori 1): alg pinning ok, secret wajib, TTL 1h + refresh/revocation.
7. **Audit & idempotency**: `AuditLog` immutable, `Payment.idempotencyKey`, partial unique (race) — titik kuat untuk kelas business logic race.
8. **Belum ada helmet / security headers** (clickjacking, XSS, dsb).

## Hasil per item

> Diisi saat pemeriksaan satu per satu (tambahkan baris per item: bukti kode + hasil uji + status).

### 1. Authentication & Authorization — dicek 2026-10-22

| Item | Status | Bukti implementasi | Uji langsung | Catatan |
| ---- | ------ | ------------------ | ------------ | ------- |
| Brute Force Attack | ✅ aman | `authLimiter` 20 req/15mnt/IP (express-rate-limit, `standardHeaders`) di register/login/request-otp/verify-otp (`src/routes/auth/auth.ts`) | 25× login password salah → 429 mulai percobaan ke-21, sisa 10x 429 | Recovery: retry `X-RateLimit-Reset` |
| Credential Stuffing | ✅ aman | Lockout per-akun di `createAuthService`: 5 failure/15 mnt per email → 429 (env `LOGIN_MAX_FAILURES`/`LOGIN_WINDOW_SECONDS`), counter reset saat login sukses | 5× salah lalu password benar → tetap 429; email lain tidak terkena; window tindih waktu | Dikombinasi dgn IP limiter → dua layer |
| Broken Authentication | ✅ aman | `signIn` → verifikasi bcrypt + gate `emailVerified` (403); OTP flow terpisah (`src/services/auth/service.ts`) | login password salah → 401 `Invalid email or password` | Pesan error tidak membocorkan field mana yang salah ✅ |
| JWT Token Forgery | ✅ aman | `jsonwebtoken` v9 HS256, secret wajib `required("JWT_SECRET")` (`src/lib/config.ts`, `src/lib/jwt.ts`) | token ngasal → 401; header `alg: none` dipaksa → 401 | `verify` default menolak `none`/matching-key confusion; kunci symmetrical |
| JWT Token Theft / Replay Attack | ✅ aman | Token akses JWT 1 jam (`AUTH_ACCESS_TTL_SECONDS`); refresh token opaque 30h (hash SHA-256 di tabel `RefreshToken`), rotasi saat `/auth/refresh`; **replay token revok → revokeAllForUser**; `/auth/logout` mencabut sesi | refresh → pasangan baru; replay lama → 401 & semua sesi mati; logout → refresh mati | `requireAuth` tetap verifikasi JWT per request (role dari DB) |
| Broken Access Control | ✅ aman | `route.ts` mount guard global: semua non-`PUBLIC_PATHS` lewat `requireAccess` (auth + load access), lalu `auditMutations` | — | Test mengunci: `routes.test.ts` "every non-public route declares a permission marker"; PUBLIC_PATHS hanya 5 endpoint |
| IDOR | ✅ aman | Ownership check di service: `getMyInvoice`/`getMySubmission` → `userId` beda = 403 (`src/services/billing/service.ts:349,438`); verify/reject admin → `assertBuildingAccess` scope gedung | warga lihat list admin = 200 tapi isi `[]` (scope `buildingId in []`); invoice orang lain = 403 | List `/payment-submissions` scoped per gedung; `resolveBuildingScope` default user = `[]` |
| Privilege Escalation | ✅ aman | Role hanya lewat `POST /rbac/assign` & delete user-role → `role.UPDATE` (admin); self-signup hard-code `CALON_PENGHUNI` (`src/container.ts:80`); roles dibaca dari DB tiap request (`resolveAccess`), bukan dari token | warga/calon dipanggil endpoint admin → 403; POST /rooms warga → 403 | Auto-grant role dari jabatan masih deferred (Fase 12) |
| Session Hijacking | ✅ aman | Tanpa cookie/session cookie (pure `Authorization: Bearer`) → XSS-cookie hijack tidak berlaku; access token TTL 1 jam (batas dampak token hilang), refresh rotasi + deteksi replay (kategori 2 fix) + logout mencabut sesi | access kedaluwarsa 1h → 401; session tidak bisa dua tempat pakai replay | Sisa risiko: token tercetak di klien — dimitigasi transport (HTTPS) & batas TTL 1 jam; tidak ada ganti-password endpoint, jadi tak ada revocation event yang hilang |
| Mass Assignment | ✅ aman | Semua controller `zodSchema.parse(req.body)` yang membentuk field eksplisit; tidak ada `...req.body` spread (checked auth, billing, me) | PATCH `/me/profile` tidak ada route → 404; tidak ada endpoint yang menerima raw body ke Prisma | Password/role/status tidak pernah di-set lewat sisi klien |

**Kesimpulan kategori 1**: **10/10 ✅** (3 temuan ⚠️ awal sudah ditambal: lockout per-akun, refresh token + deteksi replay, revocation logout).

### 2. Database & Injection — dicek 2026-10-22

| Item | Status | Bukti implementasi | Uji langsung | Catatan |
| ---- | ------ | ------------------ | ------------ | ------- |
| SQL Injection | ✅ aman | Seluruh akses data lewat repositori Prisma typed (`prisma.<model>.findMany/update/...`); input dikunci zod sebelum query; saran pencarian memakai `contains` parameter, bukan interpolasi string | — | `grep $queryRaw|$executeRaw` di src = **0 match** |
| Blind SQL Injection | ✅ aman | Permukaan sama dengan SQLi (tanpa raw SQL); error internal selalu generic "internal server error" (`app.ts`) tanpa detail DB | — | Respons tidak membocorkan waktu/error DB (coba: filter aneh pada `/rooms?search=`) |
| Second-Order SQL Injection | ✅ aman | Nilai yang tersimpan (email/nama/alamat) hanya dibaca kembali lewat query typed, tidak dieksekusi sebagai SQL | — | Satu-satunya string khusus = password (bcrypt, nil-only) |
| NoSQL Injection | ➖ N/A | PostgreSQL + Prisma (bukan Mongo) | — | — |
| ORM Misuse / Unsafe Raw Queries | ✅ aman | Tidak ada `$queryRaw`/`$executeRaw`/`*Unsafe` di `src/`. Partial unique (room/occupancy/invoice) dibuat lewat **migration SQL**, bukan runtime | — | Kalau raw query dibutuhkan (Prisma permission matrix), gunakan `$queryRaw` + tag template |
| Database Credential Leakage | ✅ aman | `DATABASE_URL` hanya di `.env` — `.gitignore` menutup `.env`, `git ls-files` hanya `.env.example`; `config.ts` `required()` gagal cepat bila kosong; trace `console.error` di-log server-side saja | — | Terminal dev tidak boleh di-share saat boot |
