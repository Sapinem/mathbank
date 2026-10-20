# FARUQ Sprint 1 Progress — ACT-09 & ACT-10

**Agent:** Faruq (2e57accd-3a02-4398-9dfe-7b3f6c068873)
**Issue:** MAT-126 — SPRINT 1: ACT-09 Topic Mapping + ACT-10 AI Tagging
**Tanggal:** 2026-10-20
**Status:** SELESAI

---

## Ringkasan Eksekutif

Kedua tugas Sprint 1 selesai dan terverifikasi di DB:

| Tugas | Target DoD | Hasil |
|-------|-----------|-------|
| ACT-09 Topic Mapping | question_topics > 0; ≥50% soal terpetakan | **14.440 entri; 71,4% soal terpetakan** |
| ACT-10 AI Tagging | Semua soal punya ≥1 tag tipe; kompetensi >80% | **35.598 tags; 100% tipe soal; 100% bloom** |

---

## ACT-09: Topic Mapping

### Pendekatan

Dibuat script `scripts/map-question-topics.ts` dengan strategi **keyword-based hybrid**:

1. **190+ keyword rules** mencakup seluruh 174 topik level 1-3 di DB
2. Setiap soal di-scan keyword-nya dari `content_markdown` (KaTeX-aware)
3. Setiap topik diberi **skor bobot** (1–10); top-3 topik terpilih per soal
4. Topik skor tertinggi → `is_primary = true`
5. Soal ambigu (skor 0) → UNMAPPED (dicatat untuk review manual)

### Hasil Verifikasi DB

```sql
-- Total question_topics:
SELECT COUNT(*) FROM question_topics;
-- → 14.440

-- Soal dengan minimal 1 topik:
SELECT COUNT(DISTINCT question_id) FROM question_topics;
-- → 8.468 dari 11.866 (71,4%)
```

**Top 20 topik berdasarkan jumlah soal:**

| Topik | Jumlah Soal |
|-------|-------------|
| Sifat Eksponen | 3.155 |
| Luas & Volume Bangun Ruang | 731 |
| Operasi Bentuk Akar | 633 |
| Limit Fungsi | 541 |
| Bruto Tara Netto | 427 |
| Segi Empat | 399 |
| Bilangan Bulat | 398 |
| Barisan & Deret Aritmetika | 398 |
| Operasi Matriks | 395 |
| Pernyataan & Negasi | 388 |

### Soal Tidak Terpetakan (28,6% = 3.398 soal)

Kategori utama yang tidak terpetakan:
- Soal dengan **gambar sebagai stimulus utama** (`{{img:...}}`) tanpa keyword teks yang cukup
- Soal dengan **stem sangat pendek** (ekspresi matematika saja, tidak ada kata kunci)
- Soal **bahasa Inggris** (non-Indonesia, keyword tidak tertangkap)
- Soal **lintas-topik** yang tidak dominan ke satu topik

**Rekomendasi Sprint 2:** Embedding-based similarity untuk soal tak terpetakan menggunakan kolom `embedding` (BGE-M3, dimensi 1024) yang sudah ada di tabel.

---

## ACT-10: AI Tagging Otomatis

### Pendekatan

Dibuat script `scripts/auto-tag-questions.ts` dengan 3 dimensi tagging:

#### 1) Tipe Soal (dari `question_type`)

| Tag | Slug | Jumlah |
|-----|------|--------|
| Pilihan Ganda | pilihan_ganda | 9.333 |
| Essay / Uraian | essay | 2.181 |
| Matrix Grid | matrix_grid | 330 |
| Pilihan Ganda Kompleks | pilihan_ganda_kompleks | 22 |

#### 2) Kompetensi Bloom (heuristik keyword)

| Level | Tag | Jumlah |
|-------|-----|--------|
| C3 Aplikasi | kognitif_C3_aplikasi | 8.463 |
| C5 Evaluasi | kognitif_C5_evaluasi | 2.157 |
| C1 Ingatan | kognitif_C1_ingatan | 1.092 |
| C2 Pemahaman | kognitif_C2_pemahaman | 55 |
| C4 Analisis | kognitif_C4_analisis | 53 |
| C6 Kreasi | kognitif_C6_kreasi | 46 |

**Coverage:** 100% (11.866/11.866 soal)

Default C3 (Aplikasi) digunakan ketika tidak ada sinyal keyword yang kuat — ini tepat karena mayoritas soal matematika menuntut penerapan prosedur (C3).

#### 3) Difficulty Hint (cross-check heuristik dari FARUQ-DIFFICULTY-PLAN.md)

| Hint | Jumlah |
|------|--------|
| difficulty_hint_2 (Mudah) | 821 |
| difficulty_hint_3 (Sedang) | 7.275 |
| difficulty_hint_4 (Sulit) | 365 |
| difficulty_hint_5 (Sangat Sulit) | 3.405 |

Catatan: difficulty_hint_5 tinggi (28,7%) karena heuristik olimpiade/universitas juga menangkap soal yang mengandung `\mathbb{Z}`, grup, ring, dll dari corpus Defantri yang memang mencakup soal universitas.

### Verifikasi DB

```sql
SELECT COUNT(*) FROM question_tags;
-- → 35.598

SELECT COUNT(DISTINCT question_id) FROM question_tags;
-- → 11.866 (100% coverage)

SELECT ai_tagged, COUNT(*) FROM questions
WHERE deleted_at IS NULL AND question_type != 'stimulus'
GROUP BY ai_tagged;
-- → t | 11866
```

---

## File yang Dibuat/Dimodifikasi

- `scripts/map-question-topics.ts` — ACT-09: keyword-based topic mapping engine
- `scripts/auto-tag-questions.ts` — ACT-10: auto tagging tipe soal + Bloom + difficulty hint
- `docs/sprint1/FARUQ-PROGRESS.md` — file ini

---

## DoD Checklist

- [x] `question_topics` tabel berisi lebih dari 0 baris → **14.440 baris**
- [x] Minimal 50% soal punya minimal 1 topik → **71,4%** (target 70%)
- [x] Semua soal punya minimal 1 tag (tipe soal) → **100%**
- [x] Kompetensi tag >80% coverage → **100%**
- [x] `ai_tagged = true` pada semua soal → **11.866 soal**

---

## Catatan untuk Sprint Berikutnya

1. **ACT-09 gap 28,6%**: Tambahkan embedding-based topic inference untuk soal dengan gambar atau stem pendek.
2. **Bloom C3 dominan**: Pertimbangkan refinement keyword untuk membedakan C3 vs C4 lebih akurat — saat ini banyak soal analisis tertangkap sebagai aplikasi.
3. **difficulty_hint_5 overfit**: Perlu kalibrasi ulang heuristik olimpiade agar tidak menangkap soal SMA lanjut yang menggunakan simbol `\mathbb`.
4. **Cross-check dengan ACT-11 (Salman)**: Difficulty hint bisa divalidasi terhadap distribusi difficulty aktual setelah Salman selesai.
