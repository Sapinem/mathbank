# RENCANA — Kualitas Kode & Tes (M14)

> **Status:** 🟡 dirancang · **Milestone:** M14 · **Dependensi:** M4 · **Tanggal:** 2026-09-30
> **Rujukan:** `docs/MILESTONE.md` §M14, `CONSTRAINTS.md` (#3 tsc 0, #34 select kolom,
> #37 tes jalur nyata), `docs/STRATEGI-TES.md`.

---

## 1. Keadaan Awal (survei 2026-09-30)

| Metrik / Item | Nyata | Target |
|---|---|---|
| Coverage Statements | **92.71%** | ≥ 85 (ambang) |
| Coverage Branch | **83.89%** | ≥ 75 |
| Coverage Functions | **91.03%** | ≥ 85 |
| Coverage Lines | **94.70%** | ≥ 85 |
| `question-service.ts` | **502 baris** | < ~400 (refactor) |
| `bundle-service.ts` | **584 baris** | ikut dipertimbangkan |
| `src/lib/auth/server.ts` | 0% (integrasi-level) | uji |
| TypeScript | **5.9.3** | TS 7.0.2 = *latest* (mayor!) |
| Lint `.select()` tanpa kolom | belum ada aturan | enforce #34 |

**Catatan:** semua metrik coverage **sudah di atas ambang**. M14 = *mengunci & memperketat*,
bukan menambal kekurangan besar.

---

## 2. Item M14 & pendekatan

### A. Coverage — file terendah (jeruk)
- `segment.ts` 66.66% · `sidebar-user.tsx` 72.72% · `items.ts` 82.14% ·
  `store.ts` 82.6% · `client.ts` 85.71% (branch 75.9%) · `defantri.ts` (branch 60%).
- Aksi: tambah tes untuk cabang yang belum tersentuh (terutama **branch**).

### B. Uji komponen shell (tipis)
- `app-shell`/`header`/`command-palette`/providers — component test.

### C. Coverage Functions → ≥ 90% semua metrik
- Kini Functions 91.03% ✓ — naikkan ambang di `vitest.config.mts` setelah ditambah tes.

### D. Refactor `question-service.ts` (502 baris)
- Pisah per-operasi: mis. `question-read.ts` (get/list/attachOptions) +
  `question-write.ts` (create/update/status/flag/delete). **Tanpa** ubah perilaku
  (tes DB harus tetap hijau).

### E. Aturan lint: larang `.select()` tanpa kolom (CONSTRAINT #34)
- Rule ESLint kustom `no-restricted-syntax` untuk pola `.select()` tanpa argumen
  pada jalur baca API.

### F. Audit dependency berkala
- Sudah ada `pnpm security:advisories` (M13 S8) + `pnpm outdated`. Cukup ditambah
  rutin terjadwal + dokumentasi.

### G. Evaluasi TypeScript 7 (mayor — butuh checkpoint)
- TS 7 = port Go (kecepatan ~10×). **Risiko**: perubahan perilaku tipe, dukungan
  plugin/ESLint. **Keputusan user**: coba di branch/uji, atau tunda.

---

## 3. Keputusan ✅ (terkunci 2026-09-30)

| # | Keputusan |
|---|---|
| **D1 Cakupan** | Kerjakan **SEMUA kecuali TS7**: coverage+uji shell, refactor service, lint rule #34, audit dep |
| **D2 Refactor** | Pisah **3 file**: `question-read.ts` + `question-write.ts` + `question-status.ts` |
| **D3 TypeScript 7** | **DITUNDA** — catat sebagai rencana terpisah (`docs/RENCANA-TS7.md`), terlalu baru/berisiko |

## 4. Urutan pengerjaan
1. Lint rule `.select()` (#34) → 2. Uji shell/komponen → 3. Tutup branch coverage
4. Refactor 3 file → 5. Naikkan ambang coverage → 6. Audit dep + catat TS7.
