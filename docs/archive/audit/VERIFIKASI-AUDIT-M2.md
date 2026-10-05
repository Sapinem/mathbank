# VERIFIKASI — Audit Milestone 2 (Auth & Peran)

> **Pemicu:** pemilik mengirim laporan audit M2 (klaim "95% Enterprise Ready").
> **Metode:** setiap klaim diverifikasi ke codebase nyata (bukan diterima apa adanya).
> **Status:** substansi **AKURAT**; beberapa angka/hal detail dikoreksi.

## 1. Klaim yang DIVERIFIKASI ✅

| Klaim | Verifikasi | Hasil |
|-------|-----------|-------|
| Better Auth + session 7 hari | `server.ts` `session.expiresIn = 7 hari` | ✅ |
| 5 peran | `ROLES = [admin,teacher,reviewer,agent,machine]` | ✅ |
| Matriks **75 sel** | hitung runtime: 15 izin × 5 peran = **75** | ✅ |
| `effectiveAccess` (yes>own>no) | `guards.ts:15` | ✅ |
| `can(actor, perm, {ownerId})` | `guards.ts:26` | ✅ |
| `assertCan` → ForbiddenError | `guards.ts:48` | ✅ |
| Resolusi aktor 3 jalur | `session → dev bypass → api key` | ✅ |
| Dev bypass di `resolve.ts:76` | baris 76-86, pagar `NODE_ENV=production` | ✅ |
| Rate limit auth (DB storage) | `rateLimit.storage="database"` + tabel `rate_limit` | ✅ |

**Total tes auth = 63** — cocok dengan laporan.

## 2. Koreksi (detail, bukan substansi)

| # | Klaim laporan | Fakta |
|---|---------------|-------|
| K1 | `permissions.test.ts` = **36** tes | **20** tes |
| K2 | `actor.test.ts` = 12 | **15** |
| K3 | `guards.test.ts` = 10 | **12** |
| K4 | `resolve.test.ts` = 5 | **16** |
| — | Total: 36+12+10+5 = 63 | **Total tetap 63** (distribusi tertukar/versi lama) |
| K5 | Badge "**95% Enterprise Ready**" | tak dapat diverifikasi — **penilaian subjektif**, bukan metrik terukur. Yang terukur: coverage logika murni **95,15%** (bukan "95% enterprise"). Jangan campur keduanya. |

Semua koreksi = **angka saja**; arsitektur yang diklaim laporan **benar**.

## 3. Temuan yang BELUM lengkap di laporan (ditambahkan)

| # | Temuan | Bukti | Dampak |
|---|--------|-------|--------|
| **T1** | **Komentar `resolve.ts:10` basi** — bilang "session → API key" (2 jalur), padahal **3 jalur** (ada dev bypass di tengah) | `resolve.ts:10` vs `:91` | Dokumen sesat; sudah diperbaiki (lihat §4) |
| **T2** | **Dev bypass belum punya pagar kedua** — hanya `NODE_ENV !== production`. Di staging/UAT dengan `NODE_ENV=staging`, `AUTH_DEV_BYPASS=true` → **admin penuh** | `resolve.ts:76-79` | Risiko bocor hak admin di UAT (laporan §4 sudah menyebut — **sejalan**) |
| **T3** | `apiKeyPermissions` disimpan di aktor tapi apakah **ditegakkan** di `can()`? | cek `guards.ts` | perlu verifikasi |

**Catatan:** T2 persis seperti rekomendasi laporan (§4/point 1). Laporan benar.

## 4. Tindakan — ✅ SELESAI (2026-09-30)
- **T1 (komentar basi)** ✅ — `resolve.ts:10` dikoreksi: "session → dev bypass → API key".
- **T2 (pagar kedua dev bypass)** ✅ — `actorFromDevBypass` kini **3 pagar**:
  (1) `NODE_ENV !== production`, (2) **`APP_ENV` bukan `production`/`staging`** (BARU —
  menutup kebocoran hak admin di UAT), (3) `AUTH_DEV_BYPASS=true` literal.
  Env `APP_ENV` didokumentasikan (`.env.example`); systemd produksi `APP_ENV=production`.
- **T3 (`apiKeyPermissions` ditegakkan)** ✅ — `can()` kini **menyempitkan** izin API key:
  `{ question: ["read"] }` → hanya `question:view`. **Tak pernah memperluas** (izin peran
  tetap batas atas). Peta aksi: `read→view`, `update→edit`, `delete→delete`.
  Kompatibel: `apiKeyPermissions` undefined = tak dibatasi (perilaku lama).
  **+9 tes** (`guards.test.ts` 6, `resolve.test.ts` 3): total auth **72** (dari 63).

Gate: tsc 0 · lint 0 · **241** unit + 80 DB · build OK · produksi sehat.

---
*Lihat juga: docs/EVALUASI-MENYELURUH.md, docs/KEAMANAN.md §S1.*
