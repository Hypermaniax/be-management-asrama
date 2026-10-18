# Rencana Fase (Detail) — Backend Asrama Mahasiswa Kepri (Yogyakarta) + RBAC + Kas + Organisasi + Kegiatan

Legenda: `[ ]` belum · `[x]` selesai. Dokumen ini dibuat **detail dan kecil-kecil** supaya tiap langkah mudah dikerjakan & diverifikasi. Diturunkan dari [`plan.md`](./plan.md) → [`erd.md`](./erd.md) (ubah plan dulu bila ada perubahan).

Konteks: **Asrama Mahasiswa Kepulauan Riau di Yogyakarta**, **2 gedung terpisah** (gender, keuangan, aturan masing-masing); ada **struktur kepengurusan** & **kegiatan** (rutin/besar); **tanpa denda**; **tanpa OAuth**.

---

## Pola modul (dipakai semua fase)

Setiap fitur ditulis berurutan dengan pola yang sama (layered + manual DI):

1. **Skema** — tambah model di `prisma/schema.prisma` → `npm run db:migrate -- --name <nama>`.
2. **Repository** — `src/repositories/<modul>.ts`: object `xRepository` + `type XRepository`.
3. **Service** — `src/services/<modul>/service.ts`: `createXService({ deps })` + `type XService`.
4. **Validations** — `src/validations/<modul>.ts`: skema zod.
5. **Controller** — `src/controller/<modul>.ts`: ambil service dari `container.ts`.
6. **Routes** — `src/routes/<modul>/<modul>.ts`: router + middleware (**wajib `requirePermission(resource, action)` tiap route**, kecuali publik), mount di `src/routes/route.ts`.
7. **Container** — rakit dependency di `src/container.ts`.
8. **Test** — `src/services/<modul>/service.test.ts` (fake deps).
9. **Verifikasi** — `npm run typecheck && npm test`.

Aturan umum: `asyncHandler` untuk semua handler, error via `AppError`, semua query filter `deletedAt: null`, semua input divalidasi zod.

---

## FASE 0 — Bersihkan legacy ✅

- [x] Hapus OAuth: model `Account`, `src/repositories/accounts.ts`, dep `google-auth-library`
- [x] Hapus marketplace lama: model `Venue`, enum `PriceUnit`, `VenueStatus`
- [x] Migrasi `remove_oauth_and_marketplace`

**Verifikasi:** `npm run typecheck && npm test` → lolos.

---

## FASE 1 — RBAC

**Tujuan:** fondasi hak akses (role, permission, menu, scope gedung).

### 1.1 Skema ✅

- [x] Tambah enum `PermissionAction { CREATE READ UPDATE DELETE APPROVE VERIFY EXPORT }`
- [x] Model `Role` (`code @unique`, `name`, `description?`, `isSystem`, `isActive`, `deletedAt?`) + relasi `permissions`, `menus`, `users`
- [x] Model `Permission` (`code @unique`, `resource`, `action`, `@@unique([resource, action])`)
- [x] Model `RolePermission` (`@@id([roleId, permissionId])`, onDelete Cascade)
- [x] Model `Menu` (`parentId?`, `code @unique`, `name`, `path`, `icon?`, `sortOrder`, `isActive`, `deletedAt?`) + self-relation `MenuTree` + `@@index([parentId])`
- [x] Model `RoleMenu` (`@@id([roleId, menuId])`)
- [x] Model `UserRole` (`userId`, `roleId`, `buildingId?`, `deletedAt?`, `@@unique([userId, roleId, buildingId])`)
- [x] **Hapus** `enum Role { USER OWNER ADMIN }` dan `User.role`
- [x] Migrasi `add_rbac_drop_user_role` (dibuat via `prisma migrate diff` + `migrate deploy` karena CLI non-interaktif)
- [x] Verifikasi: `npm run typecheck` ✅

### 1.2 Repository ✅

- [x] `src/repositories/roles.ts` → `roleRepository` (`create`, `findByCode`, `findById`, `list`, `update`, `softDelete`)
- [x] `src/repositories/permissions.ts` → `permissionRepository` (`create`, `findByCode`, `list`, `upsertByResourceAction`)
- [x] `src/repositories/menus.ts` → `menuRepository` (`create`, `findByCode`, `list`, `update`, `softDelete`)
- [x] `src/repositories/userRoles.ts` → `userRoleRepository` (`assign`, `remove`, `listByUser`, `listByUserWithPermissions`)
- [x] `src/repositories/rolePermissions.ts` → `replaceForRole(roleId, permissionIds)`
- [x] `src/repositories/roleMenus.ts` → `replaceForRole(roleId, menuIds)`
- [x] Verifikasi: `npm run typecheck` ✅

### 1.3 Service ✅

- [x] `src/services/rbac/service.ts` → `createRbacService({ roles, permissions, menus, userRoles, rolePermissions, roleMenus })`:
  - `createRole`, `updateRole`, `softDeleteRole` (tolak bila `isSystem`)
  - `setRolePermissions`, `setRoleMenus`
  - `assignRoleToUser({ userId, roleId, buildingId? })`, `revokeRole(userRoleId)`
  - `resolveAccess(userId)` → `{ roles, permissions: Set<code>, menus: tree, buildings: Set<id>, isSuperAdmin }`
- [x] Verifikasi: `npm run typecheck` ✅

### 1.4 Middleware (enforcement) ✅

- [x] `src/middleware/permission.ts`:
  - `loadAccess` → `req.access` dari `resolveAccess(user.id)`
  - `requireAccess` (komposisi `requireAuth` + `loadAccess`)
  - `requirePermission(resource, action)` — 403 bila tak ada izin (**bypass** `isSuperAdmin`)
  - `requireRole(code)` — 403 bila role tak dimiliki
  - `crud(resource)` — auto-map action dari HTTP method
  - penanda `handler.permission` (dipakai test coverage route)
- [x] `src/middleware/buildingScope.ts`: `resolveBuildingScope` + `assertBuildingAccess`
- [x] **Guard global** di `src/routes/route.ts`: semua `/api/*` wajib auth+access, **kecuali whitelist** (`/health`, `/auth/register`, `/auth/login`, `/auth/request-otp`, `/auth/verify-otp`)
- [x] Verifikasi: `npm run typecheck` ✅

### 1.5 Seed ✅

- [x] `prisma/seed.ts` (orchestrator) + `prisma/seeders/` (idempotent, upsert):
  - [x] `seeders/permissionSeeder.ts` → `seedPermissions()` — 18 resource × 7 action = **126** (→ **140** setelah resource `feeRule`/`category` ditambah di Fase 4)
  - [x] `seeders/menuSeeder.ts` → `seedMenus()` — tree **46 baris** (9 root + 37 anak) sesuai `plan.md` §6
  - [x] `seeders/roleSeeder.ts` → `seedRoles()` — 4 role default + map `RolePermission` (171) & `RoleMenu` (96)
  - [x] `seeders/userSeeder.ts` → `seedUsers()` — bootstrap super admin (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; default dev `admin@kepri.local`)
- [x] Script `"db:seed": "prisma db seed"` + `migrations.seed` di `prisma7.config.ts`
- [x] Verifikasi: `npm run db:seed` ✅ (46 menu, 126 permission, 4 role, 1 user)

### 1.6 HTTP ✅

- [x] `src/validations/rbac.ts`: `createRoleSchema`, `updateRoleSchema`, `setPermissionsSchema`, `setMenusSchema`, `assignRoleSchema`
- [x] `src/controller/rbac.ts`: `createRole`, `listRoles`, `updateRole`, `deleteRole`, `setPermissions`, `setMenus`, `assignRole`, `revokeRole`, `myAccess`
- [x] `src/routes/rbac/rbac.ts`: tiap route di balik `requirePermission("role", ...)` (`/me` cukup auth)
- [x] Mount `/rbac` + guard global di `src/routes/route.ts`
- [x] Wiring `rbacService` di `src/container.ts`
- [x] Endpoint: `POST/GET /api/rbac/roles`, `PATCH/DELETE /api/rbac/roles/:id`, `PUT /api/rbac/roles/:id/permissions`, `PUT /api/rbac/roles/:id/menus`, `POST /api/rbac/assign`, `DELETE /api/rbac/user-roles/:id`, `GET /api/rbac/me`
- [x] Verifikasi: `curl` (register → verify OTP → assign `SUPER_ADMIN` → `/rbac/me` = 9 menu root, 126 permission) ✅

### 1.7 Test ✅

- [x] `src/services/rbac/service.test.ts`: duplikat code 409, tolak hapus `isSystem` 400, `resolveAccess` gabung multi-role, flag `SUPER_ADMIN` + buang menu nonaktif
- [x] `src/middleware/permission.test.ts`: 403 tanpa izin, lolos dengan izin, `SUPER_ADMIN` bypass
- [x] **Test coverage route** (`src/routes/routes.test.ts`): gagal bila route non-publik (di luar `SELF_PATHS` = `/auth/me`, `/rbac/me`) tanpa penanda permission
- [x] Verifikasi: `npm test` → **11/11 lolos** ✅

---

## FASE 2 — Building ✅

**Tujuan:** 2 gedung terpisah.

- [x] Skema: enum `Gender { MALE FEMALE }`; model `Building { id, code @unique, name, gender, address, isActive @default(true), createdAt, updatedAt, deletedAt? }`
- [x] Migrasi `add_building` (`20261017123431_add_building`)
- [x] `src/repositories/buildings.ts`: `create`, `findById`, `findByCode`, `list`, `update`, `softDelete`
- [x] `src/services/building/service.ts`: `createBuilding`, `updateBuilding`, `softDeleteBuilding`, `list`
- [x] `src/validations/building.ts`: `buildingSchema`, `updateBuildingSchema`
- [x] `src/controller/building.ts` + `src/routes/building/building.ts` (izin `building.*` via `crud("building")`), mount `/api/buildings`
- [x] Seed: `G1` (Gedung Putra/MALE), `G2` (Gedung Putri/FEMALE) → `prisma/seeders/buildingSeeder.ts`
- [x] Test: `src/services/building/service.test.ts` (duplikat 409, 404, pass-through)
- [x] Verifikasi: `typecheck` ✅, `npm test` **22/22** ✅, `db:seed` ✅, `curl` CRUD (create 201, list 200, update 200, duplikat 409, delete 200, PENGHUNI 403, tanpa token 401) ✅

---

## FASE 3 — Room ✅

**Tujuan:** kamar + kapasitas. **Harga bukan di kamar** — semua kamar dalam 1 gedung sama; putra ≠ putri (harga per gedung diatur `FeeRule`, Fase 4).

- [x] Skema: enum `RoomStatus { ACTIVE MAINTENANCE }`; model `Room { id, buildingId, number, capacity, status @default(ACTIVE), createdAt, updatedAt, deletedAt? }` + back-relation `Building.rooms`
  - index `[buildingId]`, index `[deletedAt]`; **partial unique `[buildingId, number] WHERE deletedAt IS NULL`** (via SQL mentah di migrasi, karena Prisma tak dukung partial unique)
- [x] Migrasi `add_room` (`20261018070944_add_room`) + `remove_room_monthly_rate` (`20261018080000_remove_room_monthly_rate`) — kolom `monthlyRate` dihapus (harga pindah ke `FeeRule`)
- [x] `src/repositories/rooms.ts`: `create`, `findById`, `findByNumber`, `findByBuilding`, `list(buildingIds?)`, `update`, `softDelete`
  - `countActiveOccupants(roomId)` **ditunda ke Fase 9** (butuh model `Occupancy`)
- [x] `src/services/room/service.ts`: validasi `capacity > 0`, anti-dobel nomor per gedung, cek gedung ada
- [x] `src/validations/room.ts`, `src/controller/room.ts`, `src/routes/room/room.ts` (izin `room.*` via `crud("room")` + `resolveBuildingScope`), mount `/api/rooms`
- [x] Seed: `prisma/seeders/roomSeeder.ts` (G1 101–103, G2 201–203)
- [x] Test: `src/services/room/service.test.ts` (duplikat 409, gedung 404, capacity ≤ 0 → 400, update/delete 404)
- [x] Verifikasi: `typecheck` ✅, `npm test` **28/28** ✅, `db:seed` ✅ (6 kamar), `curl` CRUD ✅
  - create 201, list 200, update 200, duplikat 409, delete 200, tanpa token 401, `PENGHUNI` 403
  - **scope**: admin gedung G1 create di G1 201 / di G2 403, list hanya gedungnya
  - **partial unique**: nomor yang di-soft-delete bisa dipakai ulang (create 201)

---

## FASE 4 — FeeRule ✅

**Tujuan:** aturan tagihan per gedung (tanpa denda). `defaultMonthlyRate` = **harga kamar per gedung** (semua kamar 1 gedung sama; putra ≠ putri).

- [x] Skema: model `FeeRule { id, buildingId, dueDayOfMonth, defaultMonthlyRate, effectiveFrom, createdAt, deletedAt? }`, index `[buildingId, effectiveFrom]` + back-relation `Building.feeRules`
- [x] Permission: tambah resource **`feeRule`** & **`category`** ke `permissionSeeder` (18→**20 resource × 7 = 140**) + `ADMIN_GEDUNG` dapat `feeRule.*`
- [x] Migrasi `add_fee_rule` (`20261018090000_add_fee_rule`)
- [x] `src/repositories/feeRules.ts`: `create`, `findById`, `findByBuilding`, `findActiveForBuilding(buildingId, at)`, `list(buildingIds?)`, `softDelete`
- [x] `src/services/feeRule/service.ts`: validasi `dueDayOfMonth` 1–28, `defaultMonthlyRate >= 0`, gedung ada, `getFeeRule`, `softDeleteFeeRule`
- [x] `src/validations/feeRule.ts`, `src/controller/feeRule.ts`, `src/routes/feeRule/feeRule.ts` (izin `feeRule.*` via `crud("feeRule")` + `resolveBuildingScope`), mount `/api/fee-rules`
- [x] Seed: `prisma/seeders/feeRuleSeeder.ts` (G1 350.000, G2 400.000; `dueDayOfMonth` 10)
- [x] Test: `src/services/feeRule/service.test.ts` (dueDay 29 → 400, rate < 0 → 400, gedung 404, get 404, pass-through)
- [x] Verifikasi: `typecheck` ✅, `npm test` **33/33** ✅, `db:seed` ✅ (140 permission, 2 fee rule), `curl` ✅
  - create 201, dueDay 31 → 400, list 200, delete 200, tanpa token 401, `PENGHUNI` 403
  - **scope**: admin gedung G1 create di G1 201 / di G2 403, list hanya gedungnya

---

## FASE 5 — Facility + RoomFacility ✅

**Tujuan:** katalog fasilitas + fasilitas kamar.

- [x] Skema:
  - enum `FacilityScope { ROOM PUBLIC }`, `FacilityUsage { ASSIGNED SHARED }`, `FacilityCategory { FURNITURE SANITARY APPLIANCE OTHER }`
  - model `Facility { id, code @unique, name, scope, usageMode, category, isActive, createdAt, updatedAt, deletedAt? }`
  - model `RoomFacility { id, roomId, facilityId, quantity, note?, createdAt, updatedAt, deletedAt? }`, `@@unique([roomId, facilityId])` + back-relation `Room.roomFacilities`
- [x] Migrasi `add_facility_roomfacility` (`20261018100000_add_facility_roomfacility`)
- [x] `src/repositories/facilities.ts`, `src/repositories/roomFacilities.ts` (`replaceForRoom` = hard-delete + createMany, karena tabel mapping)
- [x] `src/services/facility/service.ts`: `createFacility` (anti-dobel code), `setRoomFacilities(roomId, items)` (validasi `scope=ROOM`, `quantity > 0`), `updateFacility`, `softDeleteFacility`
- [x] `src/validations/facility.ts`, `src/controller/facility.ts`, `src/routes/facility/facility.ts` (izin `facility.*` via `crud("facility")`), mount `/api/facilities` (+ `/rooms/:roomId`)
- [x] Seed `Facility`: MEJA, KASUR, LEMARI (ROOM); KM, PARKIR, DAPUR, OLAHRAGA (PUBLIC) → `prisma/seeders/facilitySeeder.ts`
- [x] Test: `src/services/facility/service.test.ts` (code 409, room 404, non-ROOM 400, quantity ≤ 0 400, pass-through)
- [x] Verifikasi: `typecheck` ✅, `npm test` **39/39** ✅, `db:seed` ✅ (7 facility), `curl` ✅
  - create 201, duplikat 409, list 200, set/list room facilities 200, PUBLIC facility di kamar → 400, tanpa token 401, `PENGHUNI` 403, delete 200

---

## FASE 6 — PublicFacility + Assignment ✅

**Tujuan:** fasilitas umum ber-nomor + penugasan penghuni (KM No. + slot).

- [x] Skema:
  - enum `PublicFacStatus { ACTIVE MAINTENANCE }`
  - model `PublicFacility { id, buildingId, facilityId, number?, capacity?, status @default(ACTIVE), note?, createdAt, updatedAt, deletedAt? }` + back-relation `Building.publicFacilities`, `Facility.publicFacilities`
  - model `PublicFacilityAssignment { id, publicFacilityId, userId, facilityId, slotLabel, assignedAt, createdAt, deletedAt? }` + back-relation `User.publicFacilityAssignments`, `Facility.publicFacilityAssignments`
  - **partial unique** (SQL mentah): `PublicFacility[buildingId, facilityId, number]`, `Assignment[publicFacilityId, slotLabel]`, `Assignment[userId, facilityId]` — semua `WHERE deletedAt IS NULL`
- [x] Migrasi `add_public_facility` (`20261018110000_add_public_facility`)
- [x] `src/repositories/publicFacilities.ts`, `src/repositories/publicFacilityAssignments.ts`
- [x] `src/services/publicFacility/service.ts`:
  - `createPublicFacility` (ASSIGNED wajib `number`; anti-dobel nomor per gedung+fasilitas)
  - `assign(publicFacilityId, userId, slotLabel)` — hanya ASSIGNED; tolak slot terisi (409) & user sudah punya tipe (409)
  - `release(assignmentId)`, `listAssignments`, `getAssignment`, `getPublicFacility`
- [x] `src/validations/publicFacility.ts`, `src/controller/publicFacility.ts`, `src/routes/publicFacility/publicFacility.ts` (izin `facility.*` via `crud("facility")` + `resolveBuildingScope`), mount `/api/public-facilities`
- [x] Test: `src/services/publicFacility/service.test.ts` (ASSIGNED tanpa nomor 400, gedung 404, non-ASSIGNED 400, slot bentrok 409, 1 user 1 tipe 409, getAssignment 404)
- [x] Verifikasi: `typecheck` ✅, `npm test` **47/47** ✅, `curl` ✅
  - create 201, assign 201, slot terisi 409, user punya tipe 409, list assignments 200, release 200, re-assign 201 (partial unique), tanpa token 401, `PENGHUNI` 403, scope gedung lain 403

---

## FASE 7 — User lifecycle ✅

**Tujuan:** perluas `User` untuk penghuni + approval.

- [x] Skema — tambah ke `User`: `buildingId?`, `nationalId?`, `gender?`, `guardianName?`, `guardianPhone?`, `address?`, enum `UserStatus { PENDING ACTIVE REJECTED CHECKOUT INACTIVE }`, `status @default(PENDING)`, `submittedAt?`, `reviewedById?`, `reviewedAt?`, `rejectionReason?`, `updatedAt @updatedAt`, `deletedAt?` + back-relation `Building.users`, self-relation `reviewedBy`/`reviewedUsers`
  - `nationalId` **partial unik** (SQL mentah); index `[buildingId, status]`
- [x] Migrasi `add_user_lifecycle` (`20261018120000_add_user_lifecycle`) — `updatedAt` diberi default lalu drop; **backfill user lama → `ACTIVE`**
- [x] Update `src/repositories/users.ts`: field baru + `updateProfile`, `setStatus`, `listByBuilding`, `softDelete`; `findByEmail`/`findById` filter `deletedAt`
- [x] `src/services/resident/service.ts`: `submitApplication` (PENDING), `approve` (PENDING→ACTIVE), `reject` (PENDING→REJECTED), `checkout` (ACTIVE→CHECKOUT), `updateProfile`, `getResident`
- [x] Update `src/services/auth/service.ts`: registrasi set `status=PENDING` + `assignResidentRole` (role `CALON_PENGHUNI`) di-wire dari `container.ts`
- [x] `src/validations/resident.ts`, `src/controller/resident.ts`, `src/routes/resident/resident.ts` (izin `user.READ/UPDATE/APPROVE`), mount `/api/residents`
- [x] Test: `src/services/resident/service.test.ts` (transisi status: approve/reject non-PENDING 400, checkout non-ACTIVE 400, pass-through)
- [x] Verifikasi: `typecheck` ✅, `npm test` **53/53** ✅, `db:seed` ✅, `curl` ✅
  - register → status PENDING; approve → ACTIVE; approve ulang 400; list ACTIVE; checkout; reject setelah checkout 400; tanpa token 401; `PENGHUNI` approve 403

---

## FASE 8 — Dokumen & Storage ✅

**Tujuan:** dokumen dinamis (KTP PDF, KTM, dll).

- [x] Skema:
  - model `File { id, storageKey @unique, originalName, mimeType, sizeBytes, checksum, uploadedById, createdAt, deletedAt? }`
  - model `DocumentType { id, buildingId, code, name, isRequiredByDefault, isActive, allowedMimeTypes String[], maxSizeBytes, sortOrder, createdAt, updatedAt, deletedAt? }`, **partial unik `[buildingId, code]`** (SQL mentah)
  - enum `DocStatus { REQUESTED UPLOADED VERIFIED REJECTED }`
  - model `DocumentSubmission { id, userId, documentTypeId, status @default(REQUESTED), fileId?, requestedById?, reviewedById?, reviewedAt?, rejectionReason?, note?, version @default(1), createdAt, updatedAt, deletedAt? }`, `@@unique([userId, documentTypeId, version])`
- [x] Migrasi `add_documents` (`20261018130000_add_documents`)
- [x] `src/lib/storage.ts`: seam `local` (`put`, `getStream`, `delete`), env `STORAGE_DRIVER`/`STORAGE_DIR`; `src/lib/fileType.ts` (deteksi magic-byte PDF/PNG/JPEG)
- [x] `src/repositories/files.ts`, `src/repositories/documentTypes.ts`, `src/repositories/documents.ts`
- [x] `src/services/document/service.ts`:
  - `requestDocument(userId, documentTypeId)` (minta KTM ad-hoc; tak menimpa VERIFIED)
  - `upload(userId, documentTypeId, file)` — validasi MIME + ukuran + **magic-byte**, simpan `File`, set `UPLOADED`
  - `verify(submissionId, adminId)`, `reject(submissionId, adminId, reason)`
  - `listRequired(userId)` (auto REQUESTED dari `isRequiredByDefault` per gedung user)
- [x] `src/controller/document.ts` + `src/routes/document/document.ts` (multer memory, `crud("document")` + `requirePermission("document","VERIFY")`), `src/routes/file/file.ts` → `GET /api/files/:id` (ber-auth)
- [x] Seed `DocumentType` contoh: KTP & KTM per gedung (PDF/JPG/PNG ≤ 2 MB) → `prisma/seeders/documentTypeSeeder.ts`
- [x] Test: `src/services/document/service.test.ts` (mime kosong 400, duplikat 409, mime/size/content 400, verify non-UPLOADED 400, upload PDF valid)
- [x] Verifikasi: `typecheck` ✅, `npm test` **60/60** ✅, `db:seed` ✅ (4 doc type), `curl` ✅
  - list types 200, required auto-REQUESTED, upload PDF 201, content mismatch 400, verify 200, download 200, tanpa token 401, `PENGHUNI` verify 403

---

## FASE 9 — Occupancy ✅

**Tujuan:** penempatan kamar.

- [x] Skema: enum `OccupancyStatus { ACTIVE ENDED }`; model `Occupancy { id, userId, roomId, bedLabel?, monthlyRateSnapshot, startDate @db.Date, endDate? @db.Date, status @default(ACTIVE), createdAt, updatedAt, deletedAt? }`
  - partial unik `[userId] WHERE status='ACTIVE' AND deletedAt IS NULL` (SQL mentah); index `[roomId, status]`
- [x] Migrasi `add_occupancy` (`20261018140000_add_occupancy`)
- [x] `src/repositories/occupancies.ts`: `create`, `findById` (+`room`), `findActiveByUser`, `listActiveByRoom`, `countActive(roomId)`, `end`, `list(buildingIds?)`
  - `countActiveOccupants(roomId)` di `src/repositories/rooms.ts` (ditunda dari Fase 3)
  - `listAssignedByUser(userId)` di `src/repositories/publicFacilityAssignments.ts` (bebas slot KM)
- [x] `src/services/occupancy/service.ts`:
  - `place(userId, roomId, bedLabel?)` — room `ACTIVE` (409), user ada + `ACTIVE` (409), gender gedung vs user (409), kapasitas penuh (409), 1 occupancy aktif/user (409), snapshot `monthlyRateSnapshot` dari `FeeRule` aktif (409 kalau tak ada)
  - `checkout(id)` — hanya `ACTIVE` (409); set `endDate`+`ENDED`; bebaskan `PublicFacilityAssignment` ber-`usageMode ASSIGNED`
- [x] Validasi gender: gedung `MALE` hanya penghuni `MALE` (dan sebaliknya)
- [x] `src/validations/occupancy.ts`, `src/controller/occupancy.ts`, `src/routes/occupancy/occupancy.ts` (`crud("occupancy")` + `POST /:id/checkout` izin `occupancy.UPDATE` + `resolveBuildingScope`), mount `/api/occupancies`
- [x] Test: `src/services/occupancy/service.test.ts` (room 404/MAINTENANCE 409, user non-ACTIVE 409, gender null 400, mismatch 409, penuh 409, sudah aktif 409, tanpa fee rule 409, snapshot sukses, checkout 404/non-ACTIVE 409, bebaskan assignment)
- [x] Verifikasi: `typecheck` ✅, `npm test` **72/72** ✅, `db:seed` ✅, `curl` ✅
  - place 201 (snapshot 350000), place ulang 409, checkout 200, checkout ulang 409, gender mismatch 409, kapasitas penuh 409, list 200, scope admin gedung place 403

---

## FASE 10 — Billing ✅

**Tujuan:** tagihan bulanan + pembayaran/cicilan.

- [x] Skema: enum `InvoiceStatus { ISSUED PARTIAL PAID OVERDUE VOID }`, `InvoiceLineKind { RENT DISCOUNT EVENT OTHER }`, `PaymentMethod { CASH TRANSFER QRIS }`; model `Invoice`, `InvoiceLine`, `Payment`, `PaymentAllocation` (lihat `erd.md`)
  - `Invoice` **partial unik `[userId, periodYear, periodMonth] WHERE deletedAt IS NULL`** (SQL mentah — boleh regenerate setelah soft delete); index `[buildingId, status]`
  - `Payment.idempotencyKey @unique`; `PaymentAllocation @@unique([paymentId, invoiceId])`
  - `Payment.cashAccountId` **scalar nullable tanpa relasi** (relasi `CashAccount` menyusul di Fase 11); `PaymentAllocation` **immutable** (tanpa `deletedAt`)
- [x] Migrasi `add_billing` (`20261018150000_add_billing`)
- [x] `src/lib/billing.ts`: `computeInvoice({ base, discount })` (tolak diskon > base), `deriveStatus(total, paid, dueDate, now?)` (PAID/PARTIAL/ISSUED/OVERDUE), `allocate(paymentAmount, invoices[])` (cicilan oldest-first + sisa)
- [x] `src/repositories/invoices.ts`, `src/repositories/payments.ts` (transaksional: payment + allocations + update invoice), `src/repositories/allocations.ts`; `occupancies.listActiveByBuilding`
- [x] `src/services/billing/service.ts`:
  - `generateMonthly({ buildingId, year, month })` — dari `Occupancy` aktif; `baseAmount` = **snapshot `monthlyRateSnapshot`** (Fase 9); `dueDate` dari `FeeRule.dueDayOfMonth`; **idempotent** (skip periode yang sudah ada)
  - `recordPayment({ userId, amount, method, cashAccountId?, allocations?, idempotencyKey })` — idempotent by key; alokasi eksplisit atau otomatis (`allocate`); update `paidAmount` + `status`
  - `voidInvoice(id)` — tolak jika sudah `VOID` atau `paidAmount > 0`
- [x] `src/validations/billing.ts`, `src/controller/invoice.ts`, `src/controller/payment.ts`, `src/routes/invoice/invoice.ts` (izin `invoice.*`), `src/routes/payment/payment.ts` (`crud("payment")`), mount `/api/invoices`, `/api/payments`
- [x] Test: `src/lib/billing.test.ts` (hitung uang, diskon, deriveStatus, alokasi cicilan/leftover) + `src/services/billing/service.test.ts` (month invalid 400, gedung 404, tanpa fee rule 409, snapshot, skip periode, idempotency, alokasi otomatis, alokasi invalid 400, void 404/409/ok)
- [x] Verifikasi: `typecheck` ✅, `npm test` **96/96** ✅, `db:seed` ✅, `curl` ✅
  - place → generate 201 (idempotent 0), invoice base 350000, bayar 201 (allocated), idempotency key → id sama, invoice PAID, void paid 409, void unpaid 200, scope admin gedung generate 403

---

## FASE 11 — Kas ✅

**Tujuan:** buku kas append-only.

- [x] Skema: enum `CategoryKind`, `LedgerDirection`, `LedgerSource`, `CashAccountType`; model `CashAccount`, `Category`, `Expense`, `LedgerEntry` (lihat `erd.md`)
  - `LedgerEntry` **tanpa** `deletedAt` (immutable); `idempotencyKey @unique`; index `[cashAccountId, occurredAt]`
  - `CashAccount` **satu per gedung** — partial unik `[buildingId] WHERE deletedAt IS NULL` (SQL mentah)
  - `Category` **per gedung** — partial unik `[buildingId, name] WHERE deletedAt IS NULL`; `Expense.idempotencyKey @unique`; `receiptFileId` **wajib**
- [x] Migrasi `add_cash` (`20261018160000_add_cash`) + relasi `Payment.cashAccountId` → `CashAccount`
- [x] `src/lib/ledger.ts`: `computeBalance(openingBalance, entries)`, `buildReversal(entry, reason)` (murni)
- [x] `src/repositories/{cashAccounts,categories,expenses,ledger}.ts` (+ `Db`/`runTransaction` di `lib/prisma.ts`; repo bisa terima tx client)
- [x] `src/services/cash/service.ts`:
  - `createCashAccount`, `updateCashAccount`, `deleteCashAccount` (tolak bila ada entri), `getCashAccount`, `getBalance`
  - `createCategory`/`updateCategory`/`deleteCategory`/`getCategory`
  - `recordExpense` (→ LedgerEntry OUT, atomik), `recordManualIncome` (→ IN, `sourceType ADJUSTMENT`), `reverseLedgerEntry` (**wajib alasan**), `getLedger`/`listExpenses`
- [x] **Integrasi atomik**: `billing.recordPayment` → satu `$transaction` (Payment + Allocation + Invoice + `LedgerEntry IN`); auto-resolve akun kas & kategori "Iuran" gedung (fallback kategori INCOME pertama); tak ada akun/kategori → 409
- [x] `src/validations/cash.ts`, `src/controller/{cashAccount,category,expense,ledger}.ts`, `src/routes/{cashAccount,category,expense,ledger}/*.ts` (izin `cash.*` & `category.*`), mount `/api/cash-accounts`, `/api/categories`, `/api/expenses`, `/api/ledger`
- [x] Seed: `cashAccountSeeder` (1 akun/gedung), `categorySeeder` (INCOME: Iuran, Bantuan Pemerintah, Donasi; EXPENSE: Listrik, Air, Perbaikan, Konsumsi, Transport, ATK, Kebersihan)
- [x] Test: `src/lib/ledger.test.ts` (saldo, reversal) + `src/services/cash/service.test.ts` (akun, expense, pemasukan manual, reversal 404/409/ok, saldo); `billing/service.test.ts` diperbarui (409 tanpa kas + posting ledger IN)
- [x] Verifikasi: `typecheck` ✅, `npm test` **116/116** ✅, `db:seed` ✅, `curl` ✅
  - bayar → saldo +350000 (ledger IN), expense (wajib bukti) → saldo −50000, pemasukan manual → +100000, reversal (wajib alasan) → +50000, reversal ganda 409, tanpa bukti 400, scope admin 403, akun ganda 409

---

## FASE 12 — Organisasi (Periode, Jabatan, Penugasan) ✅

**Tujuan:** struktur kepengurusan; tiap jabatan punya akses lewat `roleId`.

> **Keputusan (Fase 12):** penugasan **struktur saja** — `assignPosition` **tidak** menyentuh `UserRole` (auto-grant akses ditunda sampai role `BENDAHARA`/`PENGURUS` ada). `Position.code` unik **per gedung** (asrama-wide = scope `''`). `endAssignment` = `isActive=false` + `endDate` + soft delete (boleh ditugaskan ulang). `ADMIN_GEDUNG` boleh CRUD jabatan **dalam scope gedungnya**; `period` tetap READ-only untuk `ADMIN_GEDUNG`.

### 12.1 Skema

- [x] Model `Period { id, code @unique, name, startDate, endDate, decreeNumber?, isActive @default(false), createdAt, updatedAt, deletedAt? }` — hanya 1 periode aktif (enforce di service via transaksi)
- [x] Model `Position { id, code, name, level @default(0), buildingId?, roleId?, description?, isActive @default(true), createdAt, updatedAt, deletedAt? }`
  - `buildingId` null = asrama-wide; `roleId` null = tanpa akses khusus; index `[buildingId]`
  - **partial unik** `COALESCE(buildingId,'') + code WHERE deletedAt IS NULL` (SQL mentah)
- [x] Model `PositionAssignment { id, periodId, positionId, userId, buildingId?, startDate, endDate?, isActive @default(true), decreeNumber?, createdAt, updatedAt, deletedAt? }`
  - **partial unik** `[periodId, positionId, userId] WHERE deletedAt IS NULL`; index `[userId]`, `[buildingId]`
- [x] Migrasi `add_organization` (`20261018170000_add_organization`) + raw partial uniques
- [x] Verifikasi: `npm run typecheck` ✅

### 12.2 Repository

- [x] `src/repositories/periods.ts`: `create`, `findById`, `findByCode`, `list`, `findActive`, `activate` (transaksional), `update`, `softDelete` + type
- [x] `src/repositories/positions.ts`: `create`, `findById`, `findByCode(code, buildingId)`, `list(buildingIds?)`, `listByBuilding`, `update`, `softDelete` + type
- [x] `src/repositories/positionAssignments.ts`: `create`, `findById`, `findActiveByUser`, `listByUser`, `listByPeriod`, `listByPosition`, `end` + type
- [x] Verifikasi: `npm run typecheck` ✅

### 12.3 Service

- [x] `src/services/organization/service.ts` → `createOrganizationService({ periods, positions, positionAssignments, roles, buildings, users, transaction })`:
  - `createPeriod`, `updatePeriod` (validasi rentang tanggal), `activatePeriod` (nonaktifkan periode lain dalam transaksi), `listPeriods`, `getPeriod`
  - `createPosition` (validasi `roleId`/`buildingId` ada bila diisi, cek kode duplikat per scope), `updatePosition`, `softDeletePosition`, `listPositions`, `getPosition`
  - `assignPosition` (building scope otomatis dari `position.buildingId`; tolak duplikat aktif), `endAssignment`, `getAssignment`, `listAssignmentsByUser`
  - `getStructure(periodId, buildingIds?)` → jabatan + pemegangnya
- [x] Verifikasi: `npm run typecheck` ✅

### 12.4 HTTP

- [x] `src/validations/organization.ts`: `periodSchema`, `updatePeriodSchema`, `positionSchema`, `updatePositionSchema`, `assignPositionSchema`, `listAssignmentQuerySchema`, `structureQuerySchema`
- [x] `src/controller/organization.ts` + `src/routes/organization/organization.ts` (izin `period.*`, `position.*`, `resolveBuildingScope` + `assertBuildingAccess`)
- [x] Mount `mount("/organization", organizationRouter)` di `src/routes/route.ts`
- [x] Endpoint: `POST|GET /api/organization/periods`, `GET|PATCH /api/organization/periods/:id`, `POST /api/organization/periods/:id/activate`, `POST|GET /api/organization/positions`, `GET|PATCH|DELETE /api/organization/positions/:id`, `POST|GET /api/organization/assignments`, `DELETE /api/organization/assignments/:id`, `GET /api/organization/structure`
- [x] Wiring `organizationService` di `src/container.ts`
- [x] Verifikasi: `curl` ✅

### 12.5 Seed

- [x] `positionSeeder`: KETUA, WAKIL_KETUA, SEKRETARIS, BENDAHARA, KOOR_ACARA, KOOR_KEBERSIHAN, KOOR_PERLENGKAPAN (asrama-wide) + KOOR_GEDUNG ×2 (G1, G2) = **9 jabatan**; `roleId` di-resolve by code (`PENGURUS`/`BENDAHARA` belum di-seed → `null`)
- [x] `roleSeeder`: `ADMIN_GEDUNG.position = [CREATE, READ, UPDATE, DELETE]` (total permission tetap **140**)
- [x] Verifikasi: `npm run db:seed` ✅

### 12.6 Test

- [x] `src/services/organization/service.test.ts`: periode (kode unik, rentang tanggal, aktivasi), jabatan (role 404, kode duplikat 409), penugasan (scope dari jabatan, duplikat 409, user 404, end), struktur
- [x] Verifikasi: `npm test` **127/127** ✅; smoke `curl` **18/18** ✅

---

## FASE 13 — Kegiatan (Event, Panitia, Absensi, Anggaran, LPJ) ✅

**Tujuan:** kegiatan rutin (mis. yasinan) & besar (mis. Hari Jadi Kepri) + absensi & anggaran.

> **Keputusan (Fase 13):** `createEvent` meng-resolve scope (default `ASRAMA`; `GEDUNG` bila ada `buildingId`), `category` default `RUTIN`; **auto-buat 1 sesi bila `recurrence=NONE`**, kegiatan berulang mengisi sesi via `generateSessions(dates[])`. `recordEventExpense` **mendelegasikan ke `cash.recordExpense`** (idempotency + posting `LedgerEntry` + kas), bukan menulis `Expense` langsung; untuk `scope=GEDUNG`, kategori pengeluaran wajib segedung. **Visibilitas**: user tanpa `event.UPDATE` hanya melihat event `isPublic=true` + absensi diri sendiri. Partial unik `WHERE deletedAt IS NULL` untuk sesi/panitia/absensi (boleh dibuat ulang setelah soft delete).

### 13.1 Skema

- [x] Enum `EventCategory { RUTIN BESAR }`, `EventScope { ASRAMA GEDUNG }`, `EventStatus { PLANNED ONGOING DONE CANCELLED }`, `EventRecurrence { NONE WEEKLY MONTHLY }`, `AttendanceStatus { HADIR IZIN TIDAK }`, `EventAttachmentKind { PROPOSAL NOTULEN LPJ FOTO OTHER }`
- [x] Model `Event { id, title, description?, category, isAdHoc @default(false), scope, buildingId?, startAt, endAt?, location?, budgetAmount?, status @default(PLANNED), isPublic @default(false), recurrence @default(NONE), createdById, createdAt, updatedAt, deletedAt? }`
  - index `[buildingId, startAt]`, `[status]`; `buildingId` wajib bila `scope=GEDUNG` (validasi service)
  - **dadakan**: `createEvent` minimal `title` + `startAt`; `category` default `RUTIN`; panitia/sesi/anggaran opsional
- [x] Model `EventSession` — partial unik `[eventId, scheduledAt] WHERE deletedAt IS NULL`
- [x] Model `EventCommittee` — partial unik `[eventId, userId] WHERE deletedAt IS NULL`
- [x] Model `EventAttendance { status @default(TIDAK) }` — partial unik `[sessionId, userId] WHERE deletedAt IS NULL`
- [x] Model `EventAttachment`
- [x] `Expense.eventId?` → **relasi** FK ke `Event` (sebelumnya scalar) + `Event.expenses[]`
- [x] Migrasi `add_event` (`20261018180000_add_event`) + raw partial uniques
- [x] Verifikasi: `npm run typecheck` ✅

### 13.2 Repository

- [x] `src/repositories/events.ts`: `create`, `findById`, `list(buildingIds?, filters)`, `listByBuilding`, `update`, `softDelete`, `setStatus` + type
- [x] `src/repositories/eventSessions.ts`: `create`, `findById`, `findBySchedule`, `listByEvent`, `softDelete` + type
- [x] `src/repositories/eventCommittees.ts`: `add`, `findById`, `findByUser`, `listByEvent`, `listByUser`, `remove` + type
- [x] `src/repositories/eventAttendances.ts`: `create`, `findBySessionUser`, `update`, `listBySession`, `listByUser`, `listByEvent` + type
- [x] `src/repositories/eventAttachments.ts`: `attach`, `findById`, `listByEvent`, `remove` + type
- [x] Verifikasi: `npm run typecheck` ✅

### 13.3 Service

- [x] `src/services/event/service.ts` → `createEventService({ events, sessions, committees, attendances, attachments, buildings, users, positions, files, cash })`:
  - `createEvent` — resolve scope + auto-sesi bila `recurrence=NONE`
  - `updateEvent`, `changeStatus`, `deleteEvent`, `getEvent`, `listEvents`, `getEventDetail` (sessions + committees + attachments + ringkasan absensi)
  - `generateSessions(eventId, dates[])`, `addSession`, `deleteSession`, `listSessions`
  - `addCommittee`, `removeCommittee`, `listCommittees`, `listMyCommittees`
  - `setAttendance(sessionId, records)`, `listSessionAttendance`, `listMyAttendance`
  - `recordEventExpense(eventId, {...})` → delegasi `cash.recordExpense` dengan `eventId`
  - `attachDocument`, `removeAttachment`, `listAttachments`
- [x] Verifikasi: `npm run typecheck` ✅

### 13.4 HTTP

- [x] `src/validations/event.ts`: `eventSchema`, `updateEventSchema`, `statusSchema`, `sessionSchema`, `generateSessionsSchema`, `committeeSchema`, `attendanceSchema`, `attachmentSchema`, `listEventQuerySchema`
- [x] `src/controller/event.ts` + `src/routes/event/event.ts` (izin `event.*`, scope gedung, visibilitas `isPublic`)
- [x] Mount `mount("/events", eventRouter)` di `src/routes/route.ts`
- [x] Endpoint: `POST|GET /api/events`, `GET|PATCH|DELETE /api/events/:id`, `POST /api/events/:id/status`, `POST|GET /api/events/:id/sessions`, `POST /api/events/:id/sessions/generate`, `DELETE /api/events/sessions/:sessionId`, `PUT|GET /api/events/sessions/:sessionId/attendance`, `POST|GET /api/events/:id/committees`, `DELETE /api/events/committees/:committeeId`, `POST /api/events/:id/expenses`, `POST|GET /api/events/:id/attachments`, `DELETE /api/events/attachments/:attachmentId`, `GET /api/events/me/committees`, `GET /api/events/me/attendance`
- [x] Wiring `eventService` di `src/container.ts`
- [x] Izin `PENGHUNI`: lihat `isPublic` + absensi/panitia diri sendiri
- [x] Verifikasi: `curl` ✅

### 13.5 Test

- [x] `src/services/event/service.test.ts`: sesi otomatis, absensi per user (create/update), expense terhubung ke kas, scope gedung vs asrama
- [x] Verifikasi: `npm test` **139/139** ✅; smoke `curl` **22/22** ✅

---

## FASE 14 — Pemilihan Ketua Asrama

**Tujuan:** pemilihan ketua oleh warga; pemilih ditentukan **by role**; hasil direkam & tampil setelah `CLOSED`; pemenang disahkan jadi ketua.

### 14.1 Skema

- [ ] Enum `ElectionStatus { DRAFT SCHEDULED OPEN CLOSED DONE CANCELLED }`
- [ ] Model `Election { id, code @unique, title, description?, periodId?, buildingId?, startAt, endAt, status @default(DRAFT), allowAbstain @default(true), createdById, createdAt, updatedAt, deletedAt? }`
  - index `[status]`; `buildingId` null = asrama-wide
- [ ] Model `ElectionEligibleRole { electionId, roleId }` — `@@id([electionId, roleId])` (**by role**, default seed `PENGHUNI`)
- [ ] Model `ElectionCandidate { id, electionId, userId, orderNo @default(0), vision?, mission?, createdAt, updatedAt, deletedAt? }`
  - `@@unique([electionId, userId])`
- [ ] Model `ElectionVote { id, electionId, voterId, candidateId?, castAt @default(now()), createdAt }`
  - `@@unique([electionId, voterId])` — **1 warga 1 suara**; `candidateId` null = abstain
  - **immutable** (tanpa `deletedAt`)
- [ ] Model `ElectionResult { id, electionId, candidateId?, votes, percentage, rank, recordedAt @default(now()) }`
  - `@@unique([electionId, candidateId])`; **immutable** (diisi saat `CLOSED`)
- [ ] Migrasi `npm run db:migrate -- --name add_election`
- [ ] Verifikasi: `npm run typecheck`

### 14.2 Repository

- [ ] `src/repositories/elections.ts`: `create`, `findById`, `list`, `setStatus`, `softDelete` + type
- [ ] `src/repositories/electionEligibleRoles.ts`: `setForElection(electionId, roleIds)`, `listByElection` + type
- [ ] `src/repositories/electionCandidates.ts`: `add`, `listByElection`, `remove` + type
- [ ] `src/repositories/electionVotes.ts`: `cast`, `findByVoter`, `countByCandidate`, `listByElection` + type
- [ ] `src/repositories/electionResults.ts`: `saveMany(electionId, rows)`, `listByElection` + type
- [ ] Verifikasi: `npm run typecheck`

### 14.3 Service

- [ ] `src/services/election/service.ts` → `createElectionService({ elections, eligibleRoles, candidates, votes, results, users, userRoles, occupancies, positionAssignments })`:
  - `createElection(data, eligibleRoleIds?)`, `openElection(id)`, `closeElection(id)`
  - `setEligibleRoles(electionId, roleIds)`
  - `addCandidate(electionId, userId, { vision, mission })` — validasi user **warga aktif** (`PENGHUNI` + `Occupancy` aktif)
  - `isEligibleVoter(electionId, userId)` — cek **role eligible** (`ElectionEligibleRole`) **dan** `Occupancy` **aktif**
  - `castVote(electionId, voterId, candidateId?)` — hanya saat `OPEN`; wajib eligible; tolak double vote; validasi `allowAbstain`
  - `tally(electionId)` — hasil per kandidat + abstain (dihitung dari `ElectionVote`)
  - `publishResult(electionId)` — saat `CLOSED`: hitung & simpan `ElectionResult` (votes, %, rank); hasil hanya bisa dibaca setelah `CLOSED`
  - `finalize(electionId, { candidateId?, positionId })` — sahkan pemenang (atau tetapkan langsung) → buat `PositionAssignment` jabatan `KETUA`; status → `DONE`
- [ ] Verifikasi: `npm run typecheck`

### 14.4 HTTP

- [ ] `src/validations/election.ts`: `electionSchema`, `eligibleRoleSchema`, `candidateSchema`, `voteSchema`, `finalizeSchema`
- [ ] `src/controller/election.ts` + `src/routes/election/election.ts` (izin `election.*`; `PENGHUNI` boleh lihat + voting)
- [ ] Mount `router.use("/elections", electionRouter)` di `src/routes/route.ts`
- [ ] Endpoint: `POST|GET /api/elections`, `GET|PATCH /api/elections/:id`, `PUT /api/elections/:id/eligible-roles`, `POST /api/elections/:id/open`, `POST /api/elections/:id/close`, `POST|GET /api/elections/:id/candidates`, `DELETE /api/elections/:id/candidates/:candidateId`, `POST /api/elections/:id/vote`, `GET /api/elections/:id/result` (hanya `CLOSED`), `POST /api/elections/:id/finalize`
- [ ] Wiring `electionService` di `src/container.ts`
- [ ] Verifikasi: `curl`

### 14.5 Test

- [ ] `src/services/election/service.test.ts`: 1 warga 1 suara; voter non-role / tanpa `Occupancy` aktif ditolak; kandidat boleh memilih; hasil **403/404 saat `OPEN`** dan tampil saat `CLOSED`; `publishResult` menyimpan `ElectionResult`; `finalize` membuat jabatan `KETUA`
- [ ] Verifikasi: `npm test`

---

## FASE 15 — Audit

**Tujuan:** jejak perubahan.

- [ ] Skema: model `AuditLog { id, actorId, action, entity, entityId, before Json?, after Json?, ip?, createdAt }`, index `[entity, entityId]`
- [ ] Migrasi `--name add_audit_log`
- [ ] `src/repositories/audit.ts`: `record(...)`, `list(...)`
- [ ] `src/middleware/audit.ts`: helper `audit(actor, action, entity, before, after)`
- [ ] Panggil dari service keuangan & RBAC
- [ ] controller, route (izin `audit.read`)
- [ ] Verifikasi: perubahan tercatat

---

## FASE 16 — Laporan

- [ ] `src/services/report/service.ts`:
  - `arrears(buildingId, year, month)` → daftar belum bayar/tunggakan
  - `cashBalance(buildingId)` → saldo per akun
  - `incomeVsExpense(buildingId, from, to)`
  - `eventBudgetRealization(eventId)` → anggaran vs realisasi kegiatan
- [ ] controller + routes (izin `report.read`, `report.export`)
- [ ] Verifikasi: angka cocok dengan data

---

## FASE 17 — Integrasi & Test menyeluruh

- [ ] Test alur end-to-end: daftar → OTP → approve → penempatan → assign KM → tagihan → bayar → kas → kegiatan (absensi + anggaran) → pemilihan → laporan
- [ ] Test RBAC: permission & scope gedung
- [ ] Test organisasi: jabatan → role → akses
- [ ] Test pemilihan: 1 warga 1 suara + finalize ke jabatan KETUA
- [ ] Update `docs/erd.md` bila ada perubahan skema
- [ ] Verifikasi: `npm run typecheck && npm test`

---

## FASE 18 — Email Queue + OTP Stateless

**Tujuan:** kirim email OTP tanpa memblokir request & tanpa tabel OTP (hemat hit DB).

### 18.1 Skema
- [x] Hapus model `OtpCode` di `prisma/schema.prisma`
- [x] Migrasi `drop_otpcode`
- [x] Verifikasi: `npm run typecheck`

### 18.2 Lib
- [x] `src/lib/otp.ts` — `generateOtp(secret, email, step, digits)` (HMAC-SHA256 + dynamic truncation RFC 4226) + `safeEqual` (`timingSafeEqual`)
- [x] `src/lib/emailQueue.ts` — `createEmailQueue({ concurrency, onError })` (in-memory: `enqueue`, `size`)
- [x] `src/lib/config.ts` — `otpSecret` (`OTP_SECRET` ?? `JWT_SECRET`), `otpTtlSeconds` (`OTP_TTL_SECONDS` ?? 300)
- [x] Verifikasi: `npm run typecheck`

### 18.3 Service OTP (stateless)
- [x] Tulis ulang `src/services/otp/service.ts` — deps `{ secret, ttlSeconds, send, now? }`:
  - `issue(email)` → hitung kode step sekarang → `send` (queue)
  - `verify(email, code)` → cek step sekarang & sebelumnya (`safeEqual`) + **used-set in-memory** (anti-replay, TTL window)
- [x] Hapus `src/repositories/otp.ts`
- [x] `src/services/auth/service.ts` — `verifyOTP` pakai `otp.verify`
- [x] `src/container.ts` — buang `otpRepository`; wiring `createEmailQueue` → `send`
- [x] Verifikasi: `npm run typecheck`

### 18.4 Test
- [x] `src/services/otp/service.test.ts`: terima kode step sekarang; tolak kode salah; tolak kode > 1 step (expired); tolak replay (used-set)
- [x] `src/services/auth/service.test.ts`: fake `consume` → `verify`
- [x] Verifikasi: `npm test` (18/18 lulus)

### 18.5 Docs/Env
- [x] `.env.example` — `OTP_SECRET`, `OTP_TTL_SECONDS`, catatan provider email (Gmail SMTP default; console/Mailpit/Resend alternatif)
- [x] Sinkron `plan.md` & `erd.md`
- [x] Verifikasi: `npm run typecheck && npm test`
- [x] Smoke end-to-end: register → OTP stateless → verify (200 + token) → login (200)
- [x] Uji kirim nyata via Gmail SMTP (smtp.gmail.com:587 + App Password) → ke alamat eksternal berhasil
