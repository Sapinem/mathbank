# Audit — M14 Kualitas Kode & Tes

> **Status:** ✅ selesai · **Tanggal:** 2026-09-30 · **Rujukan:** `docs/RENCANA-KUALITAS-M14.md`

Ringkasan: M14 menutup celah kualitas kode & tes pasca-MVP: satu aturan lint
penegak, tes yang menutup coverage, refactor modul besar, kenaikan ambang
coverage, dan keputusan menunda TypeScript 7.

---

## 1. Yang dikerjakan

| # | Item | Bukti |
|---|------|-------|
| A1 | Aturan lint CONSTRAINT #34 (`.select()` tanpa kolom di `src/app/api/**`) | `eslint.config.mjs`; diuji-coba menangkap pelanggaran |
| A2 | Tes `segment.ts` (67%→100%) | `src/lib/ingest/parsers/segment.test.ts` (8) |
| A3 | Tes `items.ts` (cabang belum tersentuh) | `src/lib/ingest/parsers/items.test.ts` (13) |
| A4 | Tes shell (`AppShell`, palette) | `src/components/layout/app-shell.test.tsx` (7) |
| B1 | Refactor `question-service.ts` 502 → 3 modul + barrel | `question-read/-write/-status.ts`; 148 DB test hijau |
| B2 | Ekstrak gerbang auth → modul murni | `src/lib/auth/origins.ts` + `origins.test.ts` (11) |
| C | Ambang coverage naik 85/75/85/85 → 90/80/88/92 | `vitest.config.mts` |
| D | TypeScript 7 ditunda | `docs/RENCANA-TS7.md` |

## 2. Hasil gerbang (bukti nyata)

- **Unit**: `46 files, 505 tests` pass — coverage **93.25 / 84.95 / 91.91 / 95.28**.
- **DB**: `13 files, 148 tests` pass (integrasi PostgreSQL nyata).
- **tsc**: 0 error. **lint**: 0 warning.
- **Build**: `pnpm check` hijau; produksi health 200.

## 3. Keputusan

- **D1** Kerjakan semua kecuali TS7. **D2** Refactor jadi 3 file (read/write/status).
  **D3** TS7 ditunda (risiko mayor). Lihat `docs/RENCANA-KUALITAS-M14.md`.

## § Catatan Verifikasi (CONSTRAINTS #44)

Diverifikasi 2026-09-30 terhadap kode & tes **nyata** (bukan klaim dokumen):

- ✅ `src/lib/services/question-read.ts` (180), `question-write.ts` (279),
  `question-status.ts` (76) ada; `question-service.ts` (30) = barrel re-export.
- ✅ `npx tsc --noEmit` → 0 error; `npx eslint` → 0 warning.
- ✅ `pnpm test:db` → **148 passed** (13 files); `pnpm check` → **505 unit**,
  coverage 93.25/84.95/91.91/95.28, build sukses.
- ✅ `eslint.config.mjs` memuat `no-restricted-syntax` khusus `src/app/api/**`;
  diuji-coba terhadap berkas pelanggaran → **tertangkap**.
- ✅ `src/lib/auth/origins.ts` + `origins.test.ts` (11 pass) ada; `server.ts`
  mengimpornya (perilaku identik).
- ✅ Ambang `vitest.config.mts` = 90/80/88/92 (naik dari 85/75/85/85).
- ✅ `docs/RENCANA-TS7.md` ada; TypeScript proyek masih **5.9.3** (TS7 belum).
- ✅ Pemindai rahasia: 460 berkas bersih; masih mendeteksi rahasia nyata di uji.
