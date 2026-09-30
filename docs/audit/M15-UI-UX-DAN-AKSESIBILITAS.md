# Audit — M15 UI/UX Polish & Aksesibilitas

> **Status:** ✅ selesai · **Tanggal:** 2026-09-30 · **Rujukan:** `docs/RENCANA-UI-M15.md`

Ringkasan: M15 menutup celah UI/UX pasca-MVP — halaman galat/404/403 bertema,
dukungan `prefers-reduced-motion`, lint & uji a11y otomatis, dan pintasan
keyboard lengkap. Sebagian item daftar milestone ternyata sudah selesai (teks
basi) dan dikonfirmasi ulang.

---

## 1. Temuan survei (koreksi teks milestone)

| Daftar milestone | Kenyataan |
|---|---|
| "Halaman login UI `/masuk`" | Sudah ada di **`/login`** (rute beda) — dikonfirmasi |
| "Skeleton/tempat kosong" | Sudah ada `states.tsx` (Empty/Loading/Error) + `skeleton.tsx` |
| "Pola D (`DesktopOnly`) diterapkan" | `DesktopOnly` **sudah DIHAPUS** (keputusan user sebelumnya) |
| "Audit kontras" | Sudah dijaga `pnpm theme:check` (34 pasangan × 2 mode) |

## 2. Yang dikerjakan

| # | Item | Bukti |
|---|------|-------|
| T1 | Error/404/global-error/loading bertema | `src/app/{not-found,global-error}.tsx`, `(app)/{error,loading}.tsx` |
| T2 | Halaman 403 | `src/app/forbidden/page.tsx` + `layout/page-state.tsx` |
| T3 | `prefers-reduced-motion` | `globals.css` |
| T4 | Lint a11y | `eslint-plugin-jsx-a11y` 6.10.2 + perbaikan 7 error |
| T5 | Pintasan keyboard | `use-keyboard-shortcuts.ts`, `shortcuts-help.tsx` |
| T6 | Audit responsif & gelap | Tanpa elemen lebar tetap; `theme:check` 34/34 |
| T7 | axe-lite | `a11y.test.tsx` (axe-core 4.13.0, jsdom) |

## 3. Verifikasi LIVE (produksi lokal)

- `GET /forbidden` → 200, UI bertema (ikon perisai, "403", judul, 2 tombol).
- `GET /tidak-ada-halaman` → **404** + UI bertema (bukan bawaan Next.js).
- Mode gelap: heading kontras ~16:1, body ≥7:1 (terverifikasi visual).
- CSS terlayani memuat `prefers-reduced-motion` + `@font-face` (CSS sehat).
- `curl /api/health` → 200; smoke produksi **7/7**.

## 4. Keputusan

- **D1** Kerjakan semua item nyata. **D2** Tambah `eslint-plugin-jsx-a11y`.
- **D3** **Tidak** pakai `@axe-core/playwright` (e2e browser dipensiunkan M4) —
  pakai axe-core di jsdom (axe-lite). Lihat `docs/RENCANA-UI-M15.md` §3.

## § Catatan Verifikasi (CONSTRAINTS #44)

Diverifikasi 2026-09-30 terhadap kode & tes **nyata**:

- ✅ `src/app/not-found.tsx`, `global-error.tsx`, `forbidden/page.tsx`,
  `(app)/error.tsx`, `(app)/loading.tsx` ada; `page-state.tsx` + `use-keyboard-shortcuts.ts`
  + `shortcuts-help.tsx` ada.
- ✅ `npx tsc --noEmit` → 0; `npx eslint src/` → 0 (dgn jsx-a11y aktif — 7 error
  nyata sudah diperbaiki).
- ✅ `pnpm check` → **515 unit**, cov 92.99/84.99/90.67/94.87, build sukses;
  `pnpm test:db` → **148 passed**; `pnpm theme:check` → **34/34 lulus**.
- ✅ **axe-core terbukti bekerja**: uji-sanity `image-alt` tertangkap (bukan no-op).
- ✅ Verifikasi LIVE: `/forbidden` 200 & bertema; 404 bertema; CSS memuat
  `prefers-reduced-motion`; smoke 7/7.
- ⚠️ **Catatan**: uji **perangkat HP nyata** + audit **Lighthouse** belum
  dijalankan (butuh device/CI) — tercatat sebagai **utang** di `MILESTONE.md`,
  `A11Y.md` §6, dan `CHANGELOG.md`.
- ⚠️ **Catatan flakiness**: `question-service.db.test.ts` (mode semantic fallback)
  sempat gagal sekali lalu lulus 2× ulang — flaky akibat timing Ollama, **bukan**
  regresi M15. Tercatat sebagai utang tes.
