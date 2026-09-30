# RENCANA-SOAL.md — Tipe Soal & Skema Kunci

> **Status:** ✅ berlaku (dibuat saat M4c, 2026-09-30).
> **Sumber kebenaran kode:** `src/lib/contracts/question.ts` (+ `QUESTION_TYPE_LABELS`
> di `src/lib/display/labels.ts`). Dokumen ini menjelaskan **mengapa** & bagaimana
> tiap tipe dipetakan ke `content_markdown` / `options` / `answer_key` / `data_payload`.

## 11 Tipe Soal

| # | Tipe | Label UI | Bentuk | Kunci |
|---|------|----------|--------|-------|
| 1 | `stimulus` | Stimulus | Bacaan/kasus induk (tanpa opsi) | — (parent untuk anak) |
| 2 | `single_choice` | Pilihan Ganda | `content` + opsi A–E | `answer_key.correct = ["A"]` |
| 3 | `assertion_reason` | Sebab-Akibat | opsi 5 pola (A–E baku) | `answer_key.correct` |
| 4 | `combination_1234` | Kombinasi 1-2-3-4 | pernyataan + opsi kombinasi | `answer_key.correct` |
| 5 | `quantitative_pq` | Kuantitatif P-Q | dua besaran P & Q + opsi relasi | `answer_key.correct` |
| 6 | `data_sufficiency` | Kecukupan Data | pernyataan (1),(2) + opsi | `answer_key.correct` |
| 7 | `multiple_choice_checkbox` | PG Kompleks | opsi A–E | `answer_key.correct = ["A","C"]` (multi) |
| 8 | `matrix_grid` | Matriks B-S | pernyataan × kolom B/S | `answer_key.correct` + `data_payload` |
| 9 | `matching` | Menjodohkan | dua kolom pasangan | `answer_key.correct` + `data_payload` |
| 10 | `short_answer` | Isian Singkat | `content` saja | `answer_key.text` |
| 11 | `essay` | Uraian | `content` saja | `answer_key.text` (rambu penilaian) |

## Aturan (dari kontrak)

- **Opsi-based** (tipe 2–9): memakai `options[]` (label, content, isCorrect,
  `distractor_rationale`, orderIndex). `isCorrect` = bagian kunci → hanya terlihat
  viewer berwenang (`canSeeAnswerKey`).
- **Teks** (tipe 10–11): tanpa opsi; kunci di `answer_key.text`.
- **`data_payload`** — saat ini `{}` default; dipakai penuh oleh UI interaktif
  (`matrix_grid`, `matching`) di iterasi lanjutan.
- **`answer_key.explanation`** — pembahasan opsional, tampil setelah dijawab.
- **`stimulus`** — jadi induk; anak ditautkan via `parent_id` (DB menjamin depth ≤1).

## Yang BELUM (lanjutan M4c/M6)

- UI interaktif khusus `matrix_grid`/`matching` (saat ini diperlakukan seperti opsi
  biasa — cukup untuk data, belum ada grid/jodoh visual).
- Tambah/hapus/urutkan opsi secara dinamis (kini tetap tetap A–E).
- Tabel `solutions` terpisah (multi-penulis, `author_type`) — kini pembahasan di
  `answer_key.explanation`.

## Editor (M4c)

`src/components/questions/question-editor.tsx` — satu komponen untuk semua tipe
(berbagi ~90% field; beda hanya kunci-opsi vs kunci-teks). Halaman:
`/questions/new` (buat) & `/questions/[id]` (detail + sunting). **Desktop-saja**
(`DesktopOnly`) untuk menyunting; daftar tetap enak di HP.
