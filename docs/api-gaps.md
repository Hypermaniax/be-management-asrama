# Gap API vs Halaman FE — Backend Asrama Kepri

> Audit kekurangan kontrak API untuk halaman FE yang sudah dibangun.
> Setiap item **diverifikasi satu per satu ke kode BE** (`src/routes`, `src/controller`, `src/services`)
> — status hanya diubah setelah dicek, bukan dari laporan FE saja.
>
> Sumber analisis awal: laporan FE repo (halaman yang sudah approve di Fase 12 + blockers).
> Referensi API: [`docs/api.md`](./api.md) · Plan: [`docs/plan.md`](./plan.md) · Fase BE: [`docs/phases.md`](./phases.md)

## Legend status

- `[x]` ✅ kadung — sudah ada di BE (ditulis bukti endpoint + contoh uji)
- `~` ⚠️ keputusan — bisa jalan dengan kontrak sekarang; tambahan opsional (perlu keputusan produk)
- `[ ]` ❌ gap asli — tidak ada di BE; harus ditambah
- `–` ➖ N/A — klaim salah / tidak berlaku (beri bukti)
- ⏳ ⬜ belum dicek — menunggu verifikasi

## Urutan pengecekan

1. Verifikasi endpoint sasaran di `src/routes/*` + controller (baca kode).
2. Uji HTTP (login pakai akun demo `Sewdaq123`) bila butuh konfirmasi bentuk respons.
3. Tentukan: ✅ kadung / ❌ gap asli / ⚠️ keputusan (mis. pagination = keputusan lingkup).
4. Item diterima masuk BE → tulis kontrak final di [`docs/api.md`](./api.md) + changelog plan.md.

---

## Ringkasan kebutuhan (draft dari laporan FE)

1. ~~`GET /rbac/permissions`~~ ✅ (#1 — changelog plan.md #40)
2. ~~`GET /rbac/roles/:id/permissions|menus`~~ ✅ (#1 — changelog plan.md #40)
3. `GET /users?buildingId=&status=&q=` + `GET /users/:id/roles` (#2)
4. `GET /me/profile` (lengkap) + `PATCH /me/profile` (nama/telepon/alamat; ganti password?) (#3)
5. `POST /files` upload umum (#4)
6. (Keputusan) pagination `?page=&take=&sort=` di semua list (#5) — server-side bukan client-side
7. (Keputusan) `GET /dashboard/stats` (#6)
8. (Keputusan) filter per-user di `/invoices`, `?invoiceId=` di `/payments` (#7)
9. (Keputusan) `GET /events/:id?include=relations` (#8)
10. (Keputusan) `GET /rbac/user-roles?userId=` (#9)
11. (Keputusan) drill-down param di `/reports` (#10)
12. (Keputusan) `POST /auth/register` menerima profil awal (#11)
13. (Verifikasi) duplikat assignment `POST /rbac/assign` → 409? (#12)
14. (Verifikasi) `myVote` di `GET /elections/:id` (#13)
15. (Keputusan) filter server-side `/events?buildingId=&q=` (#14)

---

## Kritikal (fitur setengah jalan / workaround rapuh)

| # | Halaman FE | Kebutuhan API | Status | Kontrak yang disarankan | Catatan plan |
| - | ---------- | ------------- | ------ | ----------------------- | ------------ |
| 1 | System → Role detail (set permission + menu) | Direktori permission + state saat ini | ✅ kadung | `GET /rbac/permissions` (140 `{id, code, resource, action}`), `GET /rbac/menus` (47), `GET /rbac/roles/:id/permissions`, `GET /rbac/roles/:id/menus` — semua live | changelog plan.md **#40**; izin `role.READ` |
| 2 | System → Menu (editor menu per role) | Daftar menu dengan id | ✅ kadung | `GET /rbac/menus` di atas | sama |
| 3 | System → Pengguna | Daftar user + role per user | ⬜ belum dicek | `GET /users?buildingId=&status=&q=` (izin `user.READ`) & `GET /users/:id/roles` | Fase 12 FE; BE punya `resident.READ` tapi user = tabel terpisah |
| 4 | Akun Saya → Profil | Profil diri sendiri + PUT | ⬜ belum dicek | `GET /me/profile` `PATCH /me/profile` (nama, telepon, alamat, gender, guard) | Fase 12 blocker; `UserProfileInput` sudah ada di `userRepository` |
| 5 | Dokumen / Lampiran umum | Upload file umum | ⬜ belum dicek | `POST /files` (multipart, multer) + izin (siapa?) | `File` model & `storage` sudah ada; hanya Bukti pembayaran yang antre upload |

## Sedang (jalan tapi terbatas/inefisien)

| # | Halaman FE | Kebutuhan API | Status | Kontrak yang disarankan | Catatan plan |
| - | ---------- | ------------- | ------ | ----------------------- | ------------ |
| 6 | Semua halaman daftar | Pagination/sorting server-side | ⬜ belum dicek | `?page=&pageSize=&sort=&order=` di semua GET list | audit max 500; halaman lain belum ketat limit — cek saat verifikasi |
| 7 | Dashboard | Agregat khusus | ⬜ belum dicek | `GET /dashboard/stats` | bisa disusun dari 6 endpoint modul; tambahan bagus bila FE butuh 1 request |
| 8 | Finance → Invoices / Payments | Filter per warga | ⬜ belum dicek | `GET /invoices?userId=` & `GET /payments?invoiceId=` | FE matriks sudah kelola per warga |
| 9 | Kegiatan → Event detail | Detail dengan relasi sekali telepon | ⬜ belum dicek | `GET /events/:id?include=sessions,committee,attendance,budget,expenses` | cek `eventService`: detail sudah include apa |
| 10 | Role per user (scope gedung) | Daftar role per user | ⬜ belum dicek | `GET /rbac/user-roles?userId=` | rekonstruksi dari audit layak tapi tidak nyaman |
| 11 | Laporan export | Drill-down param | ⬜ belum dicek | `GET /reports/cash?cashAccountId=&from=&to=` dll | low prioritas |

## Kecil (kualitas data / UX)

| # | Halaman FE | Kebutuhan API | Status | Kontrak yang disarankan | Catatan plan |
| - | ---------- | ------------- | ------ | ----------------------- | ------------ |
| 12 | Registrasi | Profil awal saat daftar | ⬜ belum dicek | `signUpSchema` bunga `name?/phone?/gender?/guardianPhone?` | membuat review admin tidak perlu patch dulu |
| 13 | Users → Kelola role | Duplicate assignment = 409? | ⬜ belum dicek | verifikasi `userRoleRepository.assign` + partial unique | kember: double assignment scope sama |
| 14 | Kegiatan → Sesi | Filter server-side events | ⬜ belum dicek | `GET /events?buildingId=&q=` | FE memilah client-side |
| 15 | Pemilihan | Status survey diri sendiri | ⬜ belum dicek | `GET /elections/:id` → `myVote` (siapa yang polling buat diri sendiri) | key `fossa/Vote` immutable; data ada di `ElectionVote` (immutable) |

---

## Wayar jahat penting (dari analisis FE)

- `POST /me/payments/proof` dipakai sempit untuk upload generik — hack rapuh (butuh `payment.CREATE`).
- Audit entity=userRole dipakai buat rekonstruksi role user — ~500 entri, tidak lengkap.
- Dashboard di-FE susun 6+ request; tak ada endpoint menyatukan.
- `GET /audit-logs/:id` tidak include relasi `actor` (detail pakai baris daftar).

## Hasil verifikasi per item

> Diisi setelah pemeriksaan satu per satu (bukti kode + alasan status).
