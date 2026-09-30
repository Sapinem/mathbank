# AUDIT MILESTONE 2 — AUTH & PERAN (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (95% Enterprise Ready)  
**Target:** Autentikasi (Better Auth), Multi-Role (5 Peran L1), Matriks Izin (75 Sel), Resolusi Aktor, Guard Otorisasi (`assertCan`), Pembungkus API (`wrapRoute`), serta Rate Limiting.

---

## 1. Ringkasan Arsitektur Auth (L1 & L4)

MathBank mengadopsi pendekatan **Hybrid Auth**:
1. **Autentikasi:** Dikelola oleh `Better Auth` (Session Cookies untuk manusia/UI, `apikey` plugin untuk mesin/agen/MCP).
2. **Otorisasi Domain:** Dikelola terpusat oleh MathBank via `user_roles` (Multi-Role), `PERMISSIONS` (Matriks 15 Izin × 5 Peran), dan `guards.ts` (Evaluasi Izin `yes` > `own` > `no`).
3. **API Wrapper (`wrapRoute`):** Deklaratif meng-encapsulate otorisasi, parsing body/query Zod, dan format error universal `{ error: { code, message } }`.

---

## 2. Matriks Target vs Realisasi M2

| Fitur / Komponen | Target Spesifikasi (L1/L4) | Realisasi Kode (`src/lib/auth/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Identitas Akun** | Better Auth (Email/Pass + Session 7 hari) | `auth` di `server.ts` dengan DB Drizzle Adapter (`auth.ts`) | ✅ Lulus |
| **Multi-Role Model** | 1 Akun bisa punya banyak peran di `user_roles` | `ROLES` = `['admin', 'teacher', 'reviewer', 'agent', 'machine']` | ✅ Lulus |
| **Matriks Izin** | Declarative Access Matrix (15×5 = 75 sel) | `PERMISSIONS` di `permissions.ts` (Dikelola terpusat) | ✅ Lulus |
| **Peringkat Akses** | Union izin multi-role: `yes` > `own` > `no` | `effectiveAccess(actor, permission)` di `guards.ts` | ✅ Lulus |
| **Izin Kepemilikan (`own`)** | Guru/Reviewer/Agen bisa edit/hapus milik sendiri | `can(actor, perm, { ownerId })` mencocokkan `actor.id` | ✅ Lulus |
| **Dua Jalur Akses** | Session Cookie (Manusia) + API Key (Mesin/MCP) | `resolveActor` mengecek Session ➔ Dev Bypass ➔ API Key | ✅ Lulus |
| **Pembungkus API (`wrapRoute`)** | 0 Boilerplate per route, 100% konsisten error format | `wrapRoute({ permission, query, body, handler })` | ✅ Lulus |
| **Rate Limiting (Auth)** | Anti Brute-force pada `/sign-in` & API Key | Better Auth DB storage rate-limit + `rate-limit.ts` | ✅ Lulus |

---

## 3. Hasil Pengujian Unit & Integrasi Auth

Seluruh pengujian unit Auth (`pnpm vitest run src/lib/auth`) lulus 100%:
* `permissions.test.ts` → **36 tests passed** (Ke-75 sel matriks izin & kepemilikan `own`).
* `actor.test.ts` → **12 tests passed** (Penggabungan multi-role).
* `guards.test.ts` → **10 tests passed** (`can()`, `assertCan()`, `ForbiddenError`).
* `resolve.test.ts` → **5 tests passed** (Fallback session ➔ dev bypass ➔ API key).

---

## 4. Rekomendasi Enterprise

1. **Dev Bypass Guardrail:** Pastikan flag `AUTH_DEV_BYPASS` dipaksa `false` di lingkungan Staging/UAT Enterprise.
2. **Isolasi `trustedOrigins`:** Di lingkungan produksi, batasi array `trustedOrigins` hanya untuk domain resmi (`APP_URL`) guna memblokir potensi serangan CORS/CSRF dari origin lokal.
3. **Guardrail `mustChangePassword`:** Tambahkan validasi pada `wrapRoute` untuk memblokir endpoint mutation jika akun baru/reset belum mengganti password sementara.
