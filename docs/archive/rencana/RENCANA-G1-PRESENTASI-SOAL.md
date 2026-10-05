# RENCANA G1 — Presentasi Soal (Pedagogis Inti)

- **Tanggal:** 2026-10-01
- **Gelombang:** G1 (dari `REVIEW-MASUKAN-AUDIT-QBANK.md`)
- **Masukan yang digabung:** #10 (stimulus induk) · #8 (badge C1–C6 + rubrik) · #4 (level kognitif di kartu) · #6 (panel filter multi-select)
- **Alasan digabung:** semua menyentuh **presentasi/kartu soal** (`question-card.tsx`, `question-detail-view.tsx`, `question-bank-view.tsx`) → satu klaster koheren.

---

## Kondisi nyata saat ini (terverifikasi)

| Aspek | Kenyataan kode |
|---|---|
| `QuestionCard` | Menampilkan: Status, Tipe, Grade, Difficulty (teks `· Sedang`). **Tidak ada** `cognitiveLevel`. |
| `QuestionDetailView` | **Sudah** menampilkan `COGNITIVE_LABELS[cognitiveLevel]` (baris 135-137) — jadi gap hanya di **kartu**. |
| Stimulus (`parent_id`) | Ada di schema; `PublicQuestion` **tidak** menyertakan `parent` → kartu/detail **tak bisa** render wacana induk. |
| Panel filter | 5 `<Select>` tunggal (Status, Tipe, Kesulitan, Topik, Sumber) — **tak ada** multi-select, **tak ada** combobox cari topik. |
| `COGNITIVE_LABELS` | Sudah ada (`labels.ts:24-31`): "C1 · Mengingat" dst. |

---

## Rincian pekerjaan

### G1.1 — Badge kognitif di kartu (#4 + #8)
- Tambah badge mikro `C4` (atau "C4 · Analisis") di baris metadata `QuestionCard`, warna semantik per level.
- Difficulty: ganti teks `· Sedang` → indikator intuitif (mis. `Lv.3` + dot meter `●●●○○`), tetap ada `aria-label` utuh.
- **File:** `question-card.tsx`, `labels.ts` (+`COGNITIVE_CLASS`, `difficultyDots()`).

### G1.2 — Popover rubrik pedagogis (#8)
- Komponen `RubricPopover` (Base UI Popover): hover/tap badge kognitif & kesulitan → deskripsi operasional (rubrik C1–C6 & Level 1–5, dari audit §3.7).
- Dipasang di kartu **dan** detail.
- **File baru:** `src/components/questions/rubric-popover.tsx` + `src/lib/display/rubrics.ts` (teks rubrik, dari audit §3.7.2).

### G1.3 — Render wacana stimulus induk (#10)
- **Perubahan contract (BUTUH PERSETUJUAN — AGENTS.md §2):** `PublicQuestion` tambah `parent?: { id, contentMarkdown }`.
- `getQuestion`: bila `parentId` ada, ambil `contentMarkdown` induk (proyeksi kolom eksplisit, #34).
- `listQuestions`: untuk kartu, ambil cuplikan induk (opsional; agar tak N+1 → 1 query `inArray`).
- Komponen `StimulusCard` (kotak berbingkai aksen "Wacana Stimulus (Induk)").
- Dipasang di: `QuestionCard`, `QuestionDetailView`, `telaah-view.tsx`.
- **File:** `question-read.ts` (+parent), `question-card.tsx`, `question-detail-view.tsx`, `telaah-view.tsx`, `src/components/questions/stimulus-card.tsx` (baru).

### G1.4 — Panel filter multi-select + combobox topik (#6, tanpa pill)
- **Perubahan contract (BUTUH PERSETUJUAN):** `listQuestionsQuerySchema` — `difficulty`, `grade`, `topicId`, `questionType` → terima **daftar** (mis. `difficulty: number[]`), atau pertahankan tunggal + tambah `*List` baru? → **pilih: array** (lebih bersih), pertahankan backward-compat via `z.preprocess`.
- Service `listQuestions`: filter `inArray` (bukan `eq`).
- UI: ganti `<Select>` tunggal → **grup checkbox** (Jenjang SD/SMP/SMA, Kesulitan 1–5, Tipe Soal) + **combobox cari topik** (`Command`/Base UI Combobox).
- **Tetap tanpa pill** di area konten.
- **File:** `contracts/question.ts`, `question-read.ts`, `question-bank-view.tsx`, `src/components/ui/multi-select.tsx` (baru, bila perlu).

---

## Yang TIDAK dikerjakan di G1 (sengaja, hindari tambal-sulam)
- 3 mode view berbeda (List padat/Grid/Masonry) → **G-vista** terpisah (bobot besar).
- Bulk action bar → **G3**.
- Kolom `points` bundle → ditunda (ADR-0009).

---

## Butuh persetujuan (AGENTS.md §2 — perubahan contract)
1. `PublicQuestion.parent?: { id, contentMarkdown }` (G1.3).
2. `listQuestionsQuerySchema`: `difficulty`/`grade`/`topicId`/`questionType` → **array** (multi-nilai) (G1.4).

---

## Urutan eksekusi usulan
1. G1.1 (badge) — mandiri, cepat, tes mudah.
2. G1.2 (popover rubrik) — pakai G1.1.
3. G1.3 (stimulus) — butuh perubahan contract.
4. G1.4 (filter multi) — butuh perubahan contract + UI lebih besar.
