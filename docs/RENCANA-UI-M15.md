# RENCANA — UI/UX Polish & Responsif Penuh (M15)

> **Status:** 🟡 dirancang · **Milestone:** M15 · **Dependensi:** M4 · **Tanggal:** 2026-09-30
> **Rujukan:** `docs/MILESTONE.md` §M15, `docs/A11Y.md`, `docs/RENCANA-UI.md`, `CONSTRAINTS.md`

---

## 1. Temuan Survei (2026-09-30)

Sebagian besar daftar M15 di `MILESTONE.md` **sudah selesai** dan teksnya basi:

| Item daftar | Kenyataan |
|---|---|
| Halaman login UI `/masuk` | **SUDAH ADA** di `/login` (rute berbeda dari teks) — form + pil demo + aria + role=alert |
| Skeleton/tempat kosong | **SUDAH ADA** `src/components/ui/states.tsx` (Empty/Loading/Error) + `skeleton.tsx` |
| Kontras warna | **SUDAH ADA** `pnpm theme:check` (16 pasang token × 2 mode, ambang WCAG 2.2 AA) |
| Landmark/skip-link/fokus | **SUDAH ADA** (app-shell, skip-link, header) |
| Mode gelap | **SUDAH ADA** (default ikut OS) |

**Gap NYATA** (yang dikerjakan M15):

1. ⛔ **Tidak ada error-boundary / 404 / global-error UI** — `src/app/error.tsx`,
   `not-found.tsx`, `global-error.tsx`, `loading.tsx` **tak ada**; Next memakai
   layar galat bawaan (mentah, tak bertema).
2. ⛔ **`prefers-reduced-motion` tidak dihormati** — tak ada animasi sadar-preferensi.
3. ⛔ **Tidak ada perkakas a11y** — `eslint-plugin-jsx-a11y` & axe belum ada.
4. 🟡 **Pintasan keyboard hanya ⌘K** — sisanya belum.
5. 🟡 **Audit responsif + mode gelap menyeluruh** belum terdokumentasi.

## 2. Yang dikerjakan

| # | Item | Rencana teknis |
|---|------|----------------|
| T1 | Error/404/global-error UI | `src/app/{error,not-found,global-error,loading}.tsx` + `(app)/error.tsx` — bertema, komponen `states.tsx`, tombol "Coba lagi"/"Ke dasbor" |
| T2 | Halaman 403 (Forbidden) | `src/app/forbidden/page.tsx` + komponen; arahkan dari `ForbiddenError` |
| T3 | `prefers-reduced-motion` | Blok `@media (prefers-reduced-motion: reduce)` global (matikan animasi/transisi) + util |
| T4 | a11y lint | `eslint-plugin-jsx-a11y` (dev-dep) + presets di `eslint.config.mjs`; perbaiki temuan |
| T5 | Pintasan keyboard | Tambah: `?` bantuan, `/` fokus cari, `g`+huruf navigasi (g d = dasbor) — via hook terpusat |
| T6 | Audit responsif & gelap | Skrip/audit manual; verifikasi breakpoint + mode gelap tiap halaman; catat di `A11Y.md` |
| T7 | axe-lite | Uji a11y runtime ringan (tanpa Playwright penuh) pada komponen kunci via jsdom bila memungkinkan |

## 3. Keputusan terkunci

- **D1** Kerjakan semua item nyata (T1–T7); daftar milestone yang sudah selesai ditandai.
- **D2** Tambah **`eslint-plugin-jsx-a11y`** (dev-dep ringan) sesuai `A11Y.md` §4.
- **D3** **Tidak** tambah `@axe-core/playwright` penuh (e2e browser sudah dipensiunkan
  sejak strategi tes M4) — a11y otomatis lewat lint + uji komponen.

## 4. Gerbang

- tsc 0, lint 0 (dgn jsx-a11y), unit + DB hijau, coverage ambang M14 (90/80/88/92).
- Verifikasi **live** halaman error/404 tak bocorkan stack trace di produksi.
- `theme:check` tetap lulus.
