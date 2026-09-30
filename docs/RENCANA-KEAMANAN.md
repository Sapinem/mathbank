# RENCANA — Keamanan Lanjutan (M13)

> **Status:** 🟡 dirancang · **Milestone:** M13 · **Dependensi:** M4 · **Tanggal:** 2026-09-30
> **Rujukan:** `docs/KEAMANAN.md` (S1–S10), `CONSTRAINTS.md` §Keamanan #20–23,
> `docs/MILESTONE.md` §M13.

---

## 1. Keadaan Awal (hasil survei 2026-09-30)

| Item | Status nyata | Bukti |
|---|---|---|
| S1 Rate limit | ✅ Selesai | `src/lib/api/rate-limit.ts` + storage DB |
| S2 Header keamanan | ✅ Selesai (kecuali nonce) | `next.config.ts` |
| S3 Kunci jawaban | ✅ **Selesai** (termasuk paket) | `listBundleItems(id, actor)` + tes `bundle-service.db.test.ts:127` |
| S4 Verifikasi email | ❌ `requireEmailVerification: false` | `src/lib/auth/server.ts:56` |
| S5 Kebijakan sandi | ❌ Belum ada aturan kuat | `emailAndPassword` minim |
| S6 gitleaks | ❌ Belum ada CI/pre-commit | **tanpa `.github`**, **tanpa remote git** |
| S7 Audit akses baca | ❌ Audit hanya mutasi | `audit.ts` hanya create/update/delete/status/restore |
| S8 Advisory Better Auth | 🟠 Manual | `docs/RISET-BETTER-AUTH.md` |
| S9 CSP nonce/hash | ❌ Masih `'unsafe-inline'` | `next.config.ts:26` |
| S10 Role DB NOSUPERUSER | 🟡 Alat siap, belum dijalankan | `drizzle/manual/provision-prod.sql` |

### Temuan penting
- **Repo ini lokal** (tanpa `git remote`, tanpa `.github`) → CI berbasis GitHub **tak
  berlaku** tanpa keputusan hosting. Gitleaks harus lewat **pre-commit hook** lokal.
- **`KEAMANAN.md` basi** soal S3 (masih ditandai "⚠️ UTANG" padahal sudah tuntas).

---

## 2. Item M13 & pendekatan

### S4 — Verifikasi email
- Set `requireEmailVerification: true` + hook pengiriman email.
- **Butuh penyedia email** (SMTP / Resend / dll) → **dependency + kredensial baru**.
- Tanpa penyedia: opsi "dev mode" = tandai email `verified` otomatis untuk akun demo
  agar tak memblokir alur saat provider belum ada.

### S5 — Kebijakan kata sandi kuat
- Aturan panjang/kompleksitas + cek sandi umum (mis. daftar `password123`).
- Pesan jelas di UI `/change-password`.
- Bisa **tanpa dependency** (validator murni). Rotasi = kebijakan (peringatan umur sandi).

### S6 — Pencegahan rahasia ter-commit
- **pre-commit hook** lokal (tanpa CI): jalankan pemindai rahasia sebelum commit.
- Pilihan: `gitleaks` (binary eksternal, perlu unduh) **atau** skrip Node murni
  (regex pola rahasia: `sk-…`, `v1:…`, `postgres://user:REDACTED@`, dst).

### S7 — Audit akses baca
- Catat pembacaan **data sensitif** (mis. `getQuestionInternal`, lihat kunci,
  ekspor). Jangan catat setiap GET (bising!) → **hanya jalur sensitif**.
- Tambah `AuditAction` `"view"`/`"export"` + tabel tetap `audit_logs`.

### S8 — Pantau advisory Better Auth + bump terjadwal
- **Proses**, bukan kode: dokumentasikan jadwal cek `/` (mis. bulanan) +
  catat versi & advisory di `docs/RISET-BETTER-AUTH.md`.
- Bisa otomatiskan dengan skrip `pnpm audit:check` (pakai `pnpm outdated`).

### S9 — CSP nonce/hash (pengerasan S2)
- **Sulit di App Router Next 16**: butuh **middleware** yang menyuntik nonce per
  request + `next/script` dengan nonce. Tantangan: halaman statis & inline script RSC.
- Opsi: (a) penuh nonce via middleware; (b) hash untuk skrip inline statis;
  (c) tetap `'unsafe-inline'` untuk script, longgarkan hanya `style-src`.

### Redis (rate limit multi-instance)
- Infra tambahan (server Redis). Interface sudah siap-swap
  (`src/lib/api/rate-limit.ts`). **Hanya perlu bila >1 instance.**

### 2FA/TOTP (opsional admin)
- Better Auth punya plugin TOTP. Butuh UI enrol + verifikasi + recovery codes.

---

## 3. Keputusan ✅ (terkunci 2026-09-30)

| # | Keputusan |
|---|---|
| **D1 Cakupan** | **SEMUA 7 item** (S4–S9 + Redis + 2FA), tiap item pakai opsi **teringan** |
| **D2 S4 email** | Verifikasi email **ON**, **mode dev tanpa provider** (akun dipercaya) — tanpa dependency |
| **D3 S6** | **Skrip Node murni** (regex pola rahasia) — tanpa binary/dependency |
| **D4 S9 CSP** | **Hash** untuk script + longgarkan **hanya** `style-src` |

### Rencana opsi teringan per item
- **S5**: validator sandi murni (`password-policy.ts`) + pesan UI.
- **S7**: audit `view`/`export` **hanya** pada jalur sensitif (lihat kunci, ekspor).
- **S8**: skrip `pnpm security:advisories` (`pnpm outdated` + catatan manual).
- **Redis**: interface `RateLimitStore` (in-memory ⇄ Redis) — **implementasi Redis
  opsional**, aktif hanya bila `REDIS_URL` diset.
- **2FA**: plugin TOTP Better Auth + UI enrol/verify (opsional, admin).

## 4. Urutan pengerjaan
1. S5 (kebijakan sandi) → 2. S6 (pre-commit scan) → 3. S7 (audit baca) →
4. S8 (advisory) → 5. S9 (CSP hash) → 6. Redis (interface) → 7. 2FA → 8. S4 (email).
