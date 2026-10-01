# RENCANA G2 — Editor Soal (Form Dinamis, Stimulus, Autosave, KaTeX Linter)

- **Tanggal:** 2026-10-01
- **Gelombang:** G2 (dari `REVIEW-MASUKAN-AUDIT-QBANK.md`)
- **Masukan:** #15 (form per tipe) · #21 (pemilih stimulus) · #16 (autosave) · #20 (KaTeX linter) · #8-helper (rubrik di editor)
- **Alasan digabung:** semua menyentuh `question-editor.tsx` → satu klaster koheren.

## Kondisi nyata (terverifikasi)

| Aspek | Kenyataan |
|---|---|
| Editor | 1 komponen; `usesOptions` (8 tipe opsi) vs `isText` (2 tipe teks); `dataPayload` **selalu `{}`** saat submit. |
| `data_payload` baku | **ADA** di dokumen (§Data Payload): `matrix_grid {columns, rows[]}`, `matching {left[], right[]}`. |
| Stimulus | `PublicQuestion.parent` (G1) → tapi editor **tak** punya UI tautkan induk. `ListQuestionsQuery` punya `questionType` (array). |
| Autosave | tidak ada (localStorage) |
| KaTeX linter | tidak ada; `MathContent` punya `escapeHtml` fallback (klien). |
| Rubrik | `lib/display/rubrics.ts` (G1) — siap dipakai helper editor. |
| Pola QBank | `StimulusParentSelect.tsx`, `DynamicQuestionTypeFields.tsx`, `useEditorAutosave.ts`, `katex-linter-service.ts`. |

## Rincian pekerjaan

### G2.1 — Form dinamis per tipe (#15)
- `matrix_grid`: editor baris/kolom (label baris + 2 kolom B/S) → `dataPayload = {columns, rows}`.
- `matching`: dua daftar (kiri/kanan) → `dataPayload = {left, right}`.
- Tipe lain (assertion_reason, combination_1234, quantitative_pq, data_sufficiency, PG kompleks):
  **cukup label panduan** (petunjuk isi kunci A–E baku) — bukan form baru (hindari YAGNI;
  struktur memang `content_markdown` + opsi A–E).
- **File:** `question-editor.tsx` (+ subkomponen `MatrixGridFields`, `MatchingFields`).

### G2.2 — Pemilih wacana stimulus induk (#21)
- `useStimulusParents()` → `GET /api/questions?questionType=stimulus&limit=100` (sudah didukung).
- Combobox pilih induk → set `parentId`.
- **Perubahan contract (BUTUH PERSETUJUAN):** `createQuestionSchema`/`updateQuestionSchema`
  tambah `parentId?: string | null`; `createQuestion`/`updateQuestion` service simpan.

### G2.3 — Autosave draf (`localStorage`) (#16)
- Hook `useEditorAutosave(key, value, onRestore)` — debounce 5 s ke `localStorage`.
- Banner pemulihan ("Ditemukan draf … Pulihkan/Buang").
- **File baru:** `src/lib/hooks/use-editor-autosave.ts` (pakai `useEffect`+`useRef`, **bukan** `useMemo`/`useCallback` — #6).

### G2.4 — KaTeX linter pre-save (#20)
- `src/lib/math/katex-lint.ts` — ekstrak `$…$`/`$$…$$`/`\(…\)`/`\[…\]`, uji ke `katex.renderToString`
  (KaTeX **sudah** dipakai `math-content`), kumpulkan error + nomor "baris".
- Dipakai: (a) peringatan inline di editor sebelum simpan; (b) opsi tandai-flag saat submit.
- **File baru:** `src/lib/math/katex-lint.ts` + integrasi editor.

### G2.5 — Helper rubrik di editor (#8-helper)
- Di samping dropdown Kesulitan & Level Kognitif: tampilkan deskripsi rubrik (`rubrics.ts`).

## Butuh keputusan
1. **Contract `parentId`** di create/update input (G2.2) — **ternyata SUDAH ada** di
   `createQuestionSchema` + service (`question-write.ts`); cukup UI. ✅
2. KaTeX linter: **peringatkan** (tidak blokir) — **disetujui pemilik**. ✅

## Status — ✅ SELESAI (2026-10-01)
- G2.1 ✅ form matrix_grid/matching · G2.2 ✅ pemilih stimulus · G2.3 ✅ autosave
- G2.4 ✅ KaTeX linter (peringatan) · G2.5 ✅ petunjuk rubrik
- Tes: **572 unit** (+22) & **166 db** (+1); `pnpm check` EXIT 0.

## Yang TIDAK dikerjakan (hindari tambal-sulam)
- Media picker / AssetPicker (#14) → G4 Studio Media.
- Multi-solusi/quick tip (#13) → G5.
- Form khusus tipe seleksi selain matrix/matching → ditunda (schema tak butuh).
