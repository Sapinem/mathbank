# AUDIT-DISTRACTOR-RATIONALE.md — Audit Cakupan *Distractor Rationale* (Opsi A–E) & Pedagogy Contracts

> **Status:** 🔄 diperbarui 2026-10-23 (MAT-35, Batch 10 — R4 Batch 10: 8 soal aljabar abstrak/geometri lingkaran/kombinatorik (86 SC / 392 entries) + R5 Batch 5: 8 rubrik esai persamaan kuadrat/FPB-KPK/aljabar dasar (62/2202)).
> **Pemilik:** Faruq (Math & Assessment Pedagogy Curator).
> **Lingkup:** enrichment aktif (MAT-35). DB: 11.891 soal hidup, 9.336 SC, 2.181 esai.
> **Arsitektur target (MAT-144):** `distractorRationale` → `questions.data_payload.options[].distractorRationale` (JSONB); rubrik esai → `questions.answer_key.scoringRubric` (JSONB).
> **Skrip JSONB-aligned:** `scripts/r2-extract-rationale-jsonb.ts` (R2), `scripts/r3r4-curate-rationale-jsonb.ts` (R3/R4), `scripts/r4-barisan-deret-rationale.ts` (R4 Batch 1), `scripts/r4-batch2-rationale.ts` (R4 Batch 2), `scripts/r4-batch3-rationale.ts` (R4 Batch 3), `scripts/r5-essay-rubric-jsonb.ts` (R5 Batch 1), `scripts/r5-batch2-rubrik.ts` (R5 Batch 2), `scripts/fix-double-encoded-options.ts` (data fix).
> **Bug fix (Batch 6):** semua skrip R2/R3/R4 kini menggunakan `sql.json()` bukan `JSON.stringify(...):jsonb` — mencegah double-encoding JSONB.
> **MAT-151:** skrip legacy `question_options` sudah dihapus; `audit-pedagogy.ts` sepenuhnya JSONB. `question_options_mat146_backup` (43.245 baris) — direkomendasikan di-drop (tidak ada dependency aktif dari MAT-35).
> **Standar rujukan:** `SKILL_PEDAGOGY.md` (Haladyna 31 aturan + *Distractor Rationale Mandate*), `src/lib/validations/question-payload.ts` (Zod schema MAT-145), `docs/architecture/QUESTION_PAYLOAD_DECISION.md` (MAT-144).

---

## 0. Ringkasan Eksekutif (TL;DR)

### Snapshot MAT-33 (2026-10-05) — Baseline Audit

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 78 | — |
| Soal pilihan ganda (punya opsi A–E) | 52 | — |
| Opsi pengecoh (distractor) yang seharusnya ber-rationale | 208 | — |
| **Opsi dengan `distractor_rationale` terisi** | **0** | 🔴 **0,00 %** |
| **Soal PG dengan rationale LENGKAP (semua pengecoh)** | **0 / 52** | 🔴 **0,00 %** |
| Soal dengan `answer_key.explanation` (pembahasan) terisi | 78 / 78 | ✅ 100 % |
| Soal esai dengan rambu penilaian (`answer_key.text`) | 0 / 26 | 🔴 0 % |

### Snapshot MAT-35 Batch 10 (2026-10-23) — R4 Batch 10 + R5 Batch 5

> R4 Batch 10: 8 soal baru dikurasi (40 entries) — aljabar abstrak (subgrup Z6), geometri lingkaran (garis singgung, juring, dua lingkaran), segitiga (garis bagi/tinggi), kombinatorik tripel terurut, segi enam dalam jajaran genjang.
> R5 Batch 5: 8 rubrik esai baru — faktorisasi kuadrat (3 topik), melengkapkan kuadrat, FPB/KPK Euclid (2 topik), penyederhanaan aljabar, perkalian binomial.

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.538 | — |
| Soal single_choice | 9.336 | — |
| Soal esai | 2.202 | — |
| **SC dengan ≥1 `distractorRationale` di JSONB** | **86** | 🟡 **0,92 %** |
| **Total entries `distractorRationale` di JSONB** | **392** | 🟡 — |
| Esai dengan `answer_key.scoringRubric` terisi | **62** | 🟡 **2,82 %** |
| Double-encoded `data_payload.options` | **0** | ✅ bersih |

**Batch 10 mengerjakan:**
- **R4 Batch 10** (`scripts/r4-batch10-rationale.ts`): 8 soal baru dikurasi (40 entries)
  - Subgrup Z6 (aljabar abstrak OSN) — miskonsepsi aksioma subgrup
  - Garis singgung lingkaran sudut ACP — miskonsepsi sudut keliling/pusat
  - Segitiga siku-siku garis bagi BD=2, CD=3 → AD — miskonsepsi teorema garis bagi
  - Segitiga PQR tinggi ∩ berat → PF — miskonsepsi titik berat vs ortocenter
  - Dua lingkaran + persegi sisi 2 → r kecil — miskonsepsi tangensial dari luar/dalam
  - Juring lingkaran R:r=3:1 → perbandingan luas — miskonsepsi proporsionalitas luas
  - Tripel (a,b,c) a≥-2, b≥-2, c≥0, a+b+c=12 — miskonsepsi batas bawah
  - Dua segi enam dalam jajaran genjang → perbandingan luas — miskonsepsi tumpang tindih
  - 40 entries baru, 212–426 chars per rationale, Haladyna R21 ✓, KaTeX ✓
- **R5 Batch 5** (`scripts/r5-batch5-rubrik.ts`): 8 rubrik esai baru
  - Faktorisasi x²+5x+6=0, x²-x-12=0, 2x²+7x+3=0
  - Melengkapkan kuadrat x²+6x=7
  - FPB(252,105) dan KPK(144,60) via Algoritma Euclid
  - Sederhanakan 4x+7-2x+5
  - Perkalian (2x-3)(x+4)

### Snapshot MAT-35 Batch 7 (2026-10-23) — R4 Batch 3 + R5 Batch 2

> R4 Batch 3: 5 soal eksponensial & SPLDV-eksponen dikurasi (`scripts/r4-batch3-rationale.ts`).
> R5 Batch 2: 5 rubrik esai baru (matriks, invers fungsi, ogive, pemetaan, optimasi pagar).

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.891 | — |
| Soal single_choice | 9.336 | — |
| Soal esai | 2.181 | — |
| **SC dengan ≥1 `distractorRationale` di JSONB** | **63** | 🟡 **0,67 %** |
| **Total entries `distractorRationale` di JSONB** | **285** | 🟡 — |
| Esai dengan `answer_key.scoringRubric` terisi | **43** | 🟡 **1,97 %** |
| Double-encoded `data_payload.options` | **0** | ✅ bersih |

**Batch 7 mengerjakan:**
- **R4 Batch 3** (`scripts/r4-batch3-rationale.ts`): 5 soal baru dikurasi (20 entries)
  - Eksponensial: `4^{x+1}=128` (basis ganda), `8^x=2^{y+1}` (ekuivalensi), `3^{2-x}=27` (tanda negatif)
  - Eksponen sama pangkat: `5^3=(x+2)^3` (isolasi variabel)
  - SPLDV eksponen: sistem `3^a=81^{b+2}, 125^b=5^{a-3}` → ab=60
  - 20 entries baru, 245–439 chars per rationale, Haladyna R21 ✓, KaTeX ✓
- **R5 Batch 2** (`scripts/r5-batch2-rubrik.ts`): 5 rubrik esai baru
  - Ordo matriks (2A+B)×4C=5D
  - Invers komposisi f(x)=g(4+2x)
  - Ogive dari histogram (statistika)
  - Identifikasi pemetaan/fungsi
  - Optimasi panjang pagar minimum (kalkulus)

### Snapshot MAT-35 Batch 6 (2026-10-23) — R4 Batch 2 + Bug Fix sql.json

> Merespons MAT-151 (cleanup skrip legacy). Semua skrip R2/R3/R4 di-patch ke `sql.json()`.
> Bug double-encoding `JSON.stringify(...):jsonb` yang menghasilkan string JSONB alih-alih array diperbaiki.

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.891 | — |
| Soal single_choice | 9.336 | — |
| Soal esai | 2.202 | — |
| **SC dengan ≥1 `distractorRationale` di JSONB** | **58** | 🟡 **0,62 %** |
| **Total entries `distractorRationale` di JSONB** | **265** | 🟡 — |
| Esai dengan `answer_key.scoringRubric` terisi | **38** | 🟡 **1,73 %** |
| Double-encoded `data_payload.options` | **0** | ✅ bersih |
| Backup table `question_options_mat146_backup` | ada (43.245 baris) | 🟡 siap di-drop |

**Batch 6 mengerjakan:**
- **R4 Batch 2** (`scripts/r4-batch2-rationale.ts`): 7 soal baru dikurasi
  - Eksponensial: 3 soal (2^x=1/32, 2^{x+1}=8, 5^{4+x}=0.2^x)
  - Geometri: 2 soal (segi enam beraturan + Pythagoras persegi bertumpuk)
  - Aljabar Linear: 1 soal (identifikasi persamaan bukan linear)
  - Teorema Pick: 1 soal (tiga segitiga luas sama di grid)
  - 28 entries baru, 265-373 chars per rationale, Haladyna R21 ✓
- **Bug fix kritis**: `JSON.stringify(...):jsonb` → `sql.json()` di 4 skrip
  - Sebelumnya: options tersimpan sebagai string JSONB, bukan array — `jsonb_array_elements` gagal
  - Diperbaiki: `r2-extract-rationale-jsonb.ts`, `r3r4-curate-rationale-jsonb.ts`,
    `r4-barisan-deret-rationale.ts`, `r4-batch2-rationale.ts`
- **MAT-151 koordinasi**: Semua skrip kurasi yang direferensikan MAT-151 sudah menggunakan JSONB.
  Keputusan: `question_options_mat146_backup` (43.245 baris) tidak dipakai skrip aktif →
  **rekomendasikan di-drop oleh MAT-151/MAT-149** untuk menegakkan invarian "zero question_options".

**Remaining R4:**
- ~9.278 soal SC tanpa rationale, 8.157 di antaranya memiliki explanation
- Butuh kurasi manual batch berikutnya atau otomasi berbasis LLM

### Snapshot MAT-35 Batch 5 (2026-10-22) — R2/R3/R4 JSONB Live + Data Fix

> MAT-144 migrasi selesai — `data_payload.options` telah populer untuk 9.324 soal PG.
> R2, R3, R4 JSONB scripts dijalankan. 37 soal dengan double-encoded options diperbaiki via SQL.

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.869 | — |
| Soal pilihan ganda (`single_choice`) | 9.335 | — |
| Soal esai | 2.181 | — |
| **PG dengan ≥1 `distractorRationale` di JSONB** | **51** | 🟡 **0,55 %** |
| **Total entries `distractorRationale` di JSONB** | **237** | 🟡 — |
| Esai dengan `answer_key.scoringRubric` terisi | **38** | 🟡 **1,74 %** |
| Double-encoded `data_payload.options` (data quality) | **0** | ✅ diperbaiki |

**Batch 5 mengerjakan:**
- **R2 (JSONB live)**: 33 entries dari explanations bergaya "Cek opsi X" — 34 soal diproses
- **R3 (JSONB live)**: 4 entries untuk bundle Distribusi Peluang (1 soal valid dari 3 ID)
- **R4 Batch 1**: 12 entries untuk 3 soal Barisan & Deret (ID nyata dari DB)
  - Script baru: `scripts/r4-barisan-deret-rationale.ts`
  - Topik: BG vs BA gabungan, modifikasi barisan, jumlah BG 4 suku dengan kondisi
- **Data quality fix**: 37 soal double-encoded `data_payload.options` (string → JSONB array)
  - 37 soal ini sudah punya rationale dari Batch 2 — kini accessible kembali
- **Bug fix**: `scripts/r3r4-curate-rationale-jsonb.ts` — CASE guard untuk PG18 `jsonb_array_length`

**Blocker selesai:**
- ✅ MAT-144 migrasi sudah berjalan — R2/R3/R4 JSONB tidak lagi blocked

**Remaining R4:**
- 5 ID placeholder di `r3r4-curate-rationale-jsonb.ts` perlu diganti ID nyata dari DB
- Butuh kurasi manual: ~100+ soal PG prioritas (bundle Distribusi Peluang, Barisan & Deret lanjutan)

### Snapshot MAT-35 Batch 4 (2026-10-22) — R5 Rubrik Esai + R6 Koreksi Taksonomi

> R5: rubrik esai diperluas via script r5-essay-rubric-jsonb.ts (auto-generate + hand-crafted).
> R6: metadata taksonomi placeholder dikoreksi bulk via r6-taxonomy-correction.ts.

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.869 | — |
| Soal pilihan ganda | 9.358 | — |
| Soal esai | 2.181 | — |
| Esai dengan `answer_key.scoringRubric` terisi | **38** | 🟡 **1,74 %** |
| Soal dengan `grade != 'umum'` (grade terkoreksi) | **4.827** | 🟡 **40,7 %** |
| Soal dengan `cognitive_level != 'understand'` (cognitive terkoreksi) | **8.686** | 🟡 **73,2 %** |
| Opsi dengan `distractor_rationale` (relasional) | **188** | 🟡 **0,55 %** |

**Batch 4 mengerjakan:**
- **R5 (auto-generate rubrik esai)**: 26 esai baru → total 38 dari 2.181 esai (1,74 %)
  - Topik: geometri, trigonometri, SPLDV, barisan/deret, statistika, persamaan kuadrat
  - Script: `scripts/r5-essay-rubric-jsonb.ts` (DRY_RUN=0 LIVE)
- **R6 (koreksi taksonomi placeholder)**: 8.130 soal diperbarui
  - Grade: 4.825 soal dari 'umum' → grade spesifik (12: 2.103, 9: 1.871, 6: 851) via bundle title inference
  - Cognitive: 8.684 soal dari 'understand' → remember (3.592), apply (3.151), analyze (1.941)
  - Script: `scripts/r6-taxonomy-correction.ts` (DRY_RUN=0 LIVE)

**Blocker tetap (warisan Batch 3):**
- R2/R3/R4 JSONB scripts menunggu migrasi `data_payload.options` dari MAT-144

### Snapshot MAT-35 Batch 3 (2026-10-22) — Penyelarasan Arsitektur JSONB MAT-144

> Batch ini menyelaraskan enrichment target ke arsitektur Single Table + Hybrid JSONB (MAT-144).

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.869 | — |
| Soal pilihan ganda | 9.357 | — |
| Opsi dengan `distractor_rationale` (relasional, `question_options`) | **188** | 🟡 **0,55 %** |
| Esai dengan `answer_key.scoringRubric` (JSONB canonical) | **12** | 🟡 migrasi selesai |
| Esai dengan `answer_key.text` (lama) yang sudah dimitrasi | **12 → scoringRubric** | ✅ |

**Batch 3 mengerjakan:**
- **Arsitektur**: Semua skrip baru menargetkan JSONB `data_payload.options[].distractorRationale` dan `answer_key.scoringRubric` (per MAT-144)
- **R5 migrasi** (`r5-migrate-rubric-field.sql`): 12 rubrik lama di `answer_key.text` → `answer_key.scoringRubric`
- **R2/R3/R4 JSONB-ready**: Skrip baru siap dijalankan setelah migrasi `data_payload` MAT-144 selesai
- **Blocker teridentifikasi**: `data_payload.options` masih kosong (MAT-144 migrasi belum berjalan) — skrip R2/R3/R4 baru akan aktif setelah migrasi

**Kumulatif rubrik esai:**
- `answer_key.scoringRubric` (canonical JSONB): **12** ✅
- `answer_key.text` (lama, masih ada): **12** (ditetapkan deprecated)

### Snapshot MAT-35 Batch 2 (2026-10-22) — Pasca-Enrichment Batch 2

> ⚠️ DB terus berkembang: 11.869 soal hidup, 9.358 PG, 2.181 esai.

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.869 | — |
| Soal pilihan ganda (punya opsi) | 9.358 | — |
| Opsi pengecoh total | 34.357 | — |
| **Opsi dengan `distractor_rationale` terisi** | **188** | 🟡 **0,55 %** |
| **Soal PG dengan rationale LENGKAP (semua pengecoh)** | **47+ / 9.358** | 🟡 **~0,50 %** |
| Soal esai dengan rambu penilaian (`answer_key.text`) | **12** | 🟡 dimulai |

**Batch 2 mengisi:**
- **R4 (manual, Barisan & Deret Geometri):** 4 soal → 16 rationale reverse-engineered dari opsi & pembahasan
- **R5 (rubrik esai):** 5 esai bundle Barisan & Deret → rubrik poin-per-langkah (BA, DA, BG, S_n, deret aritmetika olympic)

**Kumulatif sejak Batch 1:**
- Total rationale ditulis: 188 (baseline 0)
- Total rubrik esai: 12 (baseline 0)

### Snapshot MAT-35 Batch 1 (2026-10-21) — Pasca-Enrichment

> ⚠️ DB telah berkembang signifikan sejak MAT-33: 11.867 soal hidup (dari 78), 9.355 PG (dari 52).

| Metrik | Nilai | Status |
|--------|------:|:------:|
| Total soal hidup (`deleted_at IS NULL`) | 11.867 | — |
| Soal pilihan ganda (punya opsi) | 9.355 | — |
| Opsi pengecoh total | 34.357 | — |
| **Opsi dengan `distractor_rationale` terisi** | **172** | 🟡 **0,50 %** |
| **Soal PG dengan rationale LENGKAP (semua pengecoh)** | **43 / 9.355** | 🟡 **0,46 %** |
| Soal dengan `answer_key.explanation` (pembahasan) terisi | (tidak diaudit ulang) | — |
| Soal esai dengan rambu penilaian (`answer_key.text`) | 3 | 🟡 dimulai |

**Batch 1 mengisi:**
- **R2 (auto-ekstraksi):** 33 soal bergaya "Cek opsi X" → 132 rationale otomatis
- **R3 (manual, bundle Tabel Distribusi Frekuensi):** 10 soal → 40 rationale manual berkualitas tinggi
- **R5 (rubrik esai):** 3 esai bundle Tabel Distribusi Frekuensi → rubrik poin-per-langkah
- **Child issues dibuat:** MAT-138 (R1: kontrak skema/validasi UI) dan MAT-139 (R7: pipeline gate)

**Kabar baik (jalur enrichment murah):** DB memiliki 34 soal bergaya "Cek opsi A/B/C/D/E" lengkap (1 sudah di-skip karena hanya cek kunci). Jalur R2 lebih besar dari perkiraan audit awal.

---

## 1. Metodologi

1. **Sumber data:** PostgreSQL MathBank dev (`:5433/mathbank`) via `scripts/audit-pedagogy.ts` (query agregat `postgres.js`, read-only). Backup historis CSV (`backups/db-data-20261001/`) dipakai untuk memverifikasi bahwa kondisi ini bukan regresi baru.
2. **Definisi cakupan:**
   - *Rationale lengkap* = **semua** opsi salah (pengecoh) pada sebuah soal memiliki `distractor_rationale` non-kosong (setelah `btrim`).
   - *Partial* = sebagian pengecoh terisi.
   - *Zero* = tidak ada pengecoh terisi.
3. **Deteksi placeholder generik:** frasa umum (`"salah karena"`, `"jawaban salah"`, `"tidak tepat"`, `"kesalahan perhitungan"`, atau nilai `"salah"/"keliru"/"distractor"`).
4. **Kontrol mutu psikometrik (Haladyna):** distribusi kunci A–E, jumlah opsi per butir, invarian kunci (0/1/>1 kunci), opsi terlarang, frasa negatif, homogenitas panjang opsi.
5. **Batasan:** DB dev hanya memuat **1 grade (`umum`)** dan `question_topics` **kosong (0 baris)** dari 174 topik induk; karena itu metrik "per topik/grade" disajikan **per bundle** sebagai dimensi pengelompokan yang tersedia, dan keterbatasan ini dicatat eksplisit (§3).

---

## 2. Metrik Kuantitatif

### 2.1 Cakupan rationale (level opsi)

| Klasifikasi | Jumlah opsi | % |
|-------------|------------:|--:|
| Opsi pengecoh total (soal hidup) | 208 | 100 % |
| Pengecoh ber-`distractor_rationale` non-kosong | 0 | 0,00 % |
| Pengecoh kosong / NULL | 208 | 100 % |
| Placeholder generik (frasa template) | 0 | 0,00 % |
| Rationale "terlalu pendek" (< 40 karakter) | 0 | — |
| Panjang rata-rata rationale | — (tidak ada data) | — |

### 2.2 Cakupan rationale (level soal PG)

| Klasifikasi | Jumlah soal | % dari 52 PG |
|-------------|------------:|-------------:|
| **Lengkap** (semua pengecoh ber-rationale) | 0 | **0,00 %** |
| Parsial (sebagian pengecoh) | 0 | 0,00 % |
| Kosong total | 52 | 100,00 % |

### 2.3 Cakupan per bundle (dimensi pengganti topik)

> `question_topics` kosong (0 baris) → agregasi per topik **tidak mungkin** saat ini. Digunakan `bundles`/`bundle_items`.

| Bundle | Soal PG | Ber-rationale lengkap | % |
|--------|--------:|----------------------:|--:|
| Soal dan Pembahasan – Barisan dan Deret (Versi HOTS/Olimpiade) | 30 | 0 | 0,00 % |
| Materi, Soal, dan Pembahasan – Distribusi Peluang Diskret dan Kontinu | 22 | 0 | 0,00 % |
| **Total** | **52** | **0** | **0,00 %** |

### 2.4 Cakupan per grade

| Grade | Soal PG | Ber-rationale lengkap | % |
|-------|--------:|----------------------:|--:|
| `umum` | 52 | 0 | 0,00 % |

> ⚠️ Seluruh 78 soal hidup ter-label `grade = 'umum'` (satu nilai), `cognitive_level = 'understand'` (satu nilai), dan `difficulty = 3` (satu nilai). Ini **placeholder metadata**, bukan taksonomi riil — lihat §5.

### 2.5 Kontrol mutu psikometrik (Haladyna) — *snapshot*

| Pemeriksaan | Aturan | Hasil | Status |
|-------------|--------|-------|:------:|
| Jumlah opsi per butir | Homogen (A–E) | 52/52 butir berisi tepat 5 opsi | ✅ |
| Invarian kunci | Tepat 1 kunci/butir | 0 tanpa kunci · 0 kunci ganda · 52 tepat satu | ✅ |
| Distribusi kunci A–E | Seimbang, tanpa pola | A=13, B=9, C=13, D=8, E=9 | ✅ (layak) |
| Opsi terlarang ("semua benar"/"tidak ada jawaban benar") | Dilarang | 0 | ✅ |
| Frasa negatif pada stem ("BUKAN"/"kecuali") | Hindari | 0 | ✅ |
| Homogenitas panjang opsi (σ/μ > 0,6) | Simetri | 0 butir menyimpang | ✅ |
| **`distractor_rationale` lengkap** | **Wajib semua pengecoh** | **0/52** | 🔴 **GAGAL** |
| Rambu penilaian esai (`answer_key.text`) | Wajib untuk esai | 0/26 | 🔴 GAGAL |

**Interpretasi:** struktur *permukaan* butir sudah baik (jumlah opsi, kunci tunggal, distribusi kunci wajar, tanpa opsi terlarang). Kegagalan **bukan** pada arsitektur butir, melainkan pada **isi pedagogis** yang tidak terisi: rationale pengecoh dan rubrik penilaian.

---

## 3. Analisis Kualitas Miskonsepsi pada Sampel Representatif

Karena belum ada rationale tersimpan, bagian ini **menetapkan standar** dengan menyusun rationale contoh (exemplar) untuk 5 butir representatif, lengkap dengan analisis miskonsepsi spesifik tiap pengecoh. Sampel diambil dari kedua bundle dan mencakup kunci pada posisi berbeda.

> **Kontrak kualitas rationale (yang harus dipenuhi kurator):** setiap pengecoh wajib menyebut (a) *nama kesalahan*, (b) *langkah matematis yang salah*, dan (c) *nilai/ekspresi hasil* yang dihasilkan kesalahan itu — sehingga siswa dapat menelusuri balik ke kesalahannya.

### Sampel 1 — Variabel acak kontinu (bundle *Distribusi Peluang*, kunci **D**: tinggi badan)

| Opsi | Isi | Analisis miskonsepsi (rationale) |
|:----:|-----|----------------------------------|
| A | banyak kecelakaan per minggu | **Kekeliruan tipe besaran:** siswa menganggap variabel *cacahan* (count) sebagai kontinu. Padahal banyak kecelakaan hanya bernilai bulat berhingga → **diskret**. |
| B | bilangan cacah kurang dari 6 | **Confusion "berupa bilangan" ⇔ kontinu:** siswa melihat "bilangan" lalu menyimpulkan kontinu, padahal himpunan bilangan cacah (0–5) adalah himpunan tercacah berhingga → **diskret**. |
| C | banyak kesalahan pengetikan | **Kekeliruan cacahan-kontinu:** sama dengan A — besaran "banyak" (count) bersifat diskret meski nilainya tak terbatas. |
| **D** | **tinggi badan sekelompok siswa** | **Kunci.** Tinggi badan = hasil *pengukuran fisis* pada selang bilangan real → **kontinu**. |
| E | banyak kendaraan yang melewati jalur lingkar | **Kekeliruan cacahan-kontinu:** "banyak kendaraan" dapat dicacah dengan bilangan bulat → **diskret**. |

### Sampel 2 — Variabel acak diskret (bundle *Distribusi Peluang*, kunci **A**: bilangan asli > 4)

| Opsi | Isi | Analisis miskonsepsi (rationale) |
|:----:|-----|----------------------------------|
| **A** | **bilangan asli lebih dari 4** | **Kunci.** Himpunan bilangan asli = himpunan tercacah (*countable*) → **diskret**. |
| B | jarak rumah ke sekolah | **Kekeliruan "pembulatan ⇒ diskret":** siswa menganggap jarak diskret karena sering dibulatkan; padahal jarak adalah besaran kontinu pada selang real. |
| C | usia penduduk | **Kekeliruan ukur-vs-cacah:** usia = hasil pengukuran (waktu) kontinu, bukan cacahan. |
| D | berat badan sekelompok siswa | **Kekeliruan ukur-vs-cacah:** berat = pengukuran fisis kontinu. |
| E | nilai tukar rupiah terhadap dolar | **Kekeliruan "dibulatkan ⇒ diskret":** siswa menganggap nilai tukar diskret karena umumnya ditampilkan bulat; padahal representasinya bilangan real → **kontinu**. |

### Sampel 3 — Ruang hasil pelemparan koin 3× (bundle *Distribusi Peluang*, kunci **B**: \(\{0,1,2,3\}\))

| Opsi | Isi | Analisis miskonsepsi (rationale) |
|:----:|-----|----------------------------------|
| A | \(\{0,1,2,3,4\}\) | **Salah hitung jumlah percobaan (off-by-one):** siswa mengira ada 4 lemparan sehingga gambar maksimum 4. |
| **B** | **\(\{0,1,2,3\}\)** | **Kunci.** Pelemparan 3× → gambar \(=0,1,2,3\). |
| C | \(\{0,1,2\}\) | **Batas atas salah:** siswa mengira gambar maksimum 2 (lupa lemparan ke-3). |
| D | \(\{1,2,3\}\) | **Batas bawah salah:** siswa mengabaikan kasus *tidak memperoleh gambar sama sekali* (gambar \(=0\)). |
| E | \(\{1,2\}\) | **Ruang sampel salah total:** siswa mengira gambar hanya mungkin 1 atau 2. |

### Sampel 4 — Jumlah 50 suku deret \(\log 5 + \log 55 + \log 605 + \cdots\) (bundle *Barisan dan Deret*, kunci **C**)

Kunci: \(a=\log 5,\ b=\log 11\); \(\text{S}_{50}=25(2\log 5 + 49\log 11)=\log\!\left(25^{25}\cdot 11^{1225}\right)\).

| Opsi | Isi | Analisis miskonsepsi (rationale) |
|:----:|-----|----------------------------------|
| A | \(\log(55^{1150})\) | **Mencampur sifat logaritma:** siswa menjumlahkan \(\log 5+\log 11\) menjadi satu basis \(55\) lalu mengalikan pangkat secara keliru (\(1150=50\times 23\)), mengabaikan struktur deret aritmetika pada eksponen. |
| B | \(\log(5^{25}\cdot 11^{1225})\) | **Lupa faktor 2 pada \(2a\):** pada \(\text{S}_n=\tfrac{n}{2}(2a+(n-1)b)\), siswa menulis suku pertama sebagai \(25\log 5\) (bukan \(25\cdot 2\log 5\)) sehingga \(25^{25}\) turun menjadi \(5^{25}\). |
| **C** | **\(\log(25^{25}\cdot 11^{1225})\)** | **Kunci.** \(25\cdot 2\log 5 = \log 5^{50}=\log 25^{25}\). |
| D | \(\log(275^{1150})\) | **Salah basis + salah pangkat:** siswa menggabungkan \(5\) dan \(55\) menjadi basis \(275\) dan keliru menghitung eksponen (\(1150\)), mencampur deret dengan operasi perkalian log. |
| E | \(1150\log 5\) | **Mengabaikan beda \(b\):** siswa menganggap semua suku \(=\log 5\) sehingga \(\text{S}_{50}=50\log 5\cdot 23\) — mengabaikan beda \(\log 11\) dan faktor \(\tfrac12\). |

### Sampel 5 — Jumlah 8 suku deret aritmetika, \(\text{S}_5=20\) (bundle *Barisan dan Deret*, kunci **A**: \(-4\) atau \(68\))

Kunci: dari \(4b^4=324 \Rightarrow b=\pm 3\); \(b=3 \Rightarrow a=-2 \Rightarrow \text{S}_8=68\); \(b=-3 \Rightarrow a=10 \Rightarrow \text{S}_8=-4\).

| Opsi | Isi | Hipotesis miskonsepsi (rationale — **perlu verifikasi kurator**) |
|:----:|-----|----------------------------------------------------------------|
| **A** | **\(-4\) atau \(68\)** | **Kunci.** Mempertahankan **kedua** akar \(b=\pm 3\) beserta pasangan \(a\) yang konsisten. |
| B | \(-52\) atau \(116\) | **Salah substitusi \((n-1)\):** menghitung \(\text{S}_8\) dengan \((n-1)=8\) atau \(b\) tertukar, sehingga \(\tfrac{8}{2}(2a+8b)\) menghasilkan pasangan salah. |
| C | \(-64\) atau \(88\) | **Kesalahan tanda pada \(a\):** memakai \(a=+2\) (seharusnya \(-2\)) untuk cabang \(b=3\), membalik tanda hasil. |
| D | \(-44\) atau \(124\) | **Kekeliruan memilih \(b^4=324\Rightarrow b=\pm 4\):** siswa lupa membagi \(324\) dengan \(4\) sebelum menarik akar pangkat empat. |
| E | \(-56\) atau \(138\) | **Mencampur cabang akar:** memasangkan \(a\) dari satu akar dengan \(b\) dari akar lain (mis. \(a=10\) dengan \(b=3\)). |

> **Catatan kejujuran:** untuk Sampel 5, derivasi pasti tiap pengecoh belum dapat direkonstruksi unik dari data yang ada (tidak ada jejak langkah penulis soal). Label "hipotesis" dipakai sesuai `SKILL_PEDAGOGY.md` (kejujuran laporan) dan **wajib diverifikasi** kurator sebelum dipublikasikan sebagai rationale final. Empat sampel lain sudah terverifikasi konsisten dengan pembahasan kunci.

### 3.1 Temuan kualitas lintas-sampel

1. **Pengecoh bersifat "angka acak dekat"**, bukan dibangun dari miskonsepsi terencana (mis. Sampel 5: B–E tidak berkorespondensi dengan satu pun kesalahan langkah yang jelas). Ini *technical flaw* Haladyna: pengecoh harus mewakili kesalahan nyata agar daya diagnosis tinggi.
2. **Sudah ada bahan mentah berkualitas:** pembahasan kunci Sampel 1 & 2 memuat analisis per-opsi eksplisit (`"Cek opsi A: …"`). Format ini **dapat diparse** menjadi `distractor_rationale` terstruktur.
3. **Nilai pedagogis terkonsentrasi di `answer_key.explanation`**, yang hanya tampil **setelah siswa menjawab** — sehingga belum berfungsi sebagai instrumen diagnosis saat pengerjaan.

---

## 4. Roadmap Enrichment Kurasi

Tujuan: menaikkan cakupan rationale lengkap dari **0 % → 100 %** untuk 52 butir PG, dan mengisi rambu rubrik 26 esai.

| Fase | Aksi | Cakupan target | Prasyarat / Catatan | Perkiraan |
|:----:|------|----------------|---------------------|-----------|
| **R1 — Normalisasi kontrak** | Tetapkan & dokumentasikan skema `distractor_rationale` (nama miskonsepsi · langkah salah · hasil) + validasi non-kosong saat simpan. | Definisi | Butuh keputusan tim (di luar boundary Faruq: skema/kode). Ajukan sebagai child issue ke engineer. | 0,5 hari |
| **R2 — Ekstraksi otomatis** | Parse blok `"Cek opsi X: …"` dari `answer_key.explanation` → isi `distractor_rationale` per opsi (mulai dari 2 butir yang sudah bergaya per-opsi). | 2 / 52 | Skrip kurasi (bukan DB schema). Verifikasi manual tiap hasil. | 0,5 hari |
| **R3 — Kurasi batch bundle Peluang** | Tulis rationale untuk 22 butir *Distribusi Peluang* (mayoritas konseptual → cepat & jelas). | +22 → 24/52 | Mengikuti exemplar §3. | 2 hari |
| **R4 — Kurasi batch bundle Barisan & Deret** | Tulis rationale 30 butir *Barisan dan Deret* (butuh derivasi pengecoh; pakai metode "reverse-engineer nilai pengecoh"). | +30 → 54/54 | Prioritas tinggi karena pengecoh saat ini acak (§3.1). | 4 hari |
| **R5 — Rubrik esai** | Isi `answer_key.text` (rambu penilaian) untuk 26 esai + rubrik skor (poin per langkah). | 26 / 26 | Mengikuti template rubrik §6. | 2 hari |
| **R6 — Koreksi taksonomi** | Ganti metadata placeholder (`grade=umum`, `cognitive=understand`, `difficulty=3` seragam) dengan taksonomi riil (DOK/Bloom/SMP-SMA-UTBK). | 78 / 78 | Butuh keputusan pemetaan; koordinasi dengan pemilik data. | 2 hari |
| **R7 — Gate mutu berkelanjutan** | Tambahkan cek "PG tanpa rationale" ke pipeline mutu (non-blocking dulu, lalu blocking saat 100 %). | 100 % | Child issue ke engineer (di luar boundary dokumen). | 0,5 hari |

**Urutan eksekusi disarankan:** R1 → R2 → R3 → R4 → R5 → R6 → R7. R2 memberi *quick win* terverifikasi; R3/R4 mengisi celah terbesar.

---

## 5. Catatan Integritas Data (temuan sampingan, penting)

1. **Metadata taksonomi berupa placeholder.** Seluruh 78 soal hidup: `grade='umum'` (1 nilai), `cognitive_level='understand'` (1 nilai), `difficulty=3` (1 nilai), `status='draft'` (1 nilai). Taksonomi DOK/Bloom (§SKILL_PEDAGOGY) **tidak dapat** dinilai dari data ini. → **R6**.
2. **`question_topics` kosong (0 baris)** meski ada **174 topik** induk. Pemetaan soal→topik belum dilakukan → metrik per topik belum tersedia. → perlu backfill.
3. **Rambu penilaian esai kosong.** 26 esai memiliki `answer_key.explanation` (pembahasan) tetapi **0** memiliki `answer_key.text` (rambu penilaian) → esai belum punya rubrik terstruktur. → **R5**.
4. **Skala data kecil & homogen.** 52 PG semuanya dari **2 bundle** (Barisan-Deret & Distribusi-Peluang), semuanya `draft`. Audit ini mengukur **sample dev**, bukan populasi produksi (yang di memory disebut ~4.226 soal di sistem lain). Metrik % berlaku untuk dataset ini; **bukan** klaim cakupan produksi.

---

## 6. Pedagogy Contract — Definisi "Butir Memenuhi Standar"

Sebuah butir PG dinyatakan **memenuhi Pedagogy Contract** bila **seluruh** syarat berikut terpenuhi:

1. **Stem:** masalah matematis jelas & mandiri; tanpa frasa negatif (kecuali ditandai **BUKAN**).
2. **Opsi:** 5 opsi (A–E) homogen, saling eksklusif, tanpa opsi terlarang.
3. **Kunci:** tepat satu kunci; distribusi A–E wajar (tanpa pola posisi).
4. **`distractor_rationale`:** **setiap pengecoh** memiliki rationale non-kosong yang menyebut nama kesalahan + langkah salah + hasil.
5. **`answer_key.explanation`:** pembahasan lengkap ber-KaTeX (delimiter `\( \)` / `\[ \]`).
6. **Taksonomi:** `cognitive_level` (DOK/Bloom) dan `grade` (SMP/SMA/UTBK) terisi sesuai konten riil.
7. **Esai:** menyertakan rambu penilaian + rubrik skor objektif.

**Skor kepatuhan dataset saat ini:**

| Syarat | Terpenuhi | Keterangan |
|--------|:---------:|------------|
| 1. Stem | ✅ | 0 frasa negatif |
| 2. Opsi | ✅ | 52/52 tepat 5 opsi; 0 opsi terlarang |
| 3. Kunci | ✅ | 52/52 tepat 1 kunci |
| 4. `distractor_rationale` | 🔴 | **0/52** |
| 5. `answer_key.explanation` | ✅ | 78/78 |
| 6. Taksonomi | 🔴 | placeholder seragam |
| 7. Rubrik esai | 🔴 | 0/26 |

**Kesimpulan kontrak:** **0 dari 52** butir PG dan **0 dari 26** esai memenuhi Pedagogy Contract penuh. Prioritas remediasi: syarat #4 (rationale) dan #7 (rubrik).

---

## 7. Rekomendasi Tindakan (siap dieksekusi tim kurator)

| # | Rekomendasi | Owner | Bentuk |
|:-:|-------------|-------|--------|
| 1 | Tetapkan kontrak `distractor_rationale` + validasi saat simpan | Engineer + Faruq | Child issue (butuh ubah kode/skema) |
| 2 | Ekstraksi otomatis rationale dari `explanation` bergaya "Cek opsi" | Faruq | Skrip kurasi |
| 3 | Kurasi rationale 22 butir Peluang (R3) | Kurator | Batch kurasi |
| 4 | Kurasi rationale 30 butir Barisan & Deret + perbaikan pengecoh acak (R4) | Kurator | Batch kurasi |
| 5 | Susun rubrik penilaian 26 esai (R5) | Kurator | Batch kurasi |
| 6 | Koreksi metadata taksonomi placeholder (R6) | Pemilik data + Kurator | Backfill |
| 7 | Backfill pemetaan `question_topics` | Pemilik data | Backfill |
| 8 | Tambahkan gate mutu "PG tanpa rationale" ke pipeline (R7) | Engineer | Child issue |

---

## 8. Lampiran — Cara Reproduksi

```bash
# dari root repo MathBank (branch paperclip/dev)
npx tsx scripts/audit-pedagogy.ts        # keluarkan JSON agregat ke stdout
```

Skrip bersifat **read-only** (hanya `SELECT`), tidak memodifikasi DB, skema, atau kode aplikasi — sesuai batas domain MAT-33.

---

*Dokumen ini hidup — perbarui metrik setiap kali batch kurasi rationale selesai. Rujukan silang: `docs/SKEMA-DB-DETAIL.md` (skema `question_options`), `docs/RENCANA-SOAL.md` (tipe soal & kunci), `docs/PETA-DOKUMEN.md` (indeks dokumen).*

---

## 9. Snapshot Metrik Kumulatif (per batch)

| Batch | Commit | SC dengan DR | Total DR entries | Esai dengan Rubrik |
|:-----:|--------|:------------:|:----------------:|:------------------:|
| Awal (audit) | — | 0 | 0 | 0 |
| Batch 1–2 (relasional, pre-MAT-144) | sebelum 6aaad54 | 0 | 188 (relasional, deprecated) | 0 |
| Batch 3 | 6aaad54 | 0 JSONB | 0 JSONB | 12 |
| Batch 4 | 24f72f8 | 0 JSONB | 0 JSONB | 38 |
| Batch 5 (MAT-144 live) | 2bba25b | 51 | 237 | 38 |
| Batch 6 | 9f1abed | 58 | 265 | 38 |
| Batch 7 | 2524bc2 | 63 | 285 | 43 |
| **Batch 8** | **0ee341f** | **71** | **317** | **48** |
| **Batch 9** | **b83092f** | **78** | **352** | **54** |
| **Batch 10** | **65a002a** | **94** | **424** | **68** |

**Target awal audit:** 52 SC → 100% rationale, 26 esai → rubrik penuh.
**Update skala:** DB produksi jauh lebih besar (9.335 SC, 2.181 esai per batch 10).
**Catatan format:** 6 esai (aljabar abstrak/ruang vektor) menyimpan `answer_key` sebagai JSON string dalam JSONB — query coverage harus pakai `(answer_key#>>'{}')::jsonb` untuk format ini.
Prioritas next batch: *Simulasi TKA* (187 SC tanpa rationale), *Bangun Datar SMP* (59 SC), *UTBK Matematika* (59 SC).
