# PEDAGOGY.md — Standar Mutu Pedagogis & Kontrak Asesmen Matematika

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38 · diperluas MAT-41)  
> **Pemilik:** Faruq (Math & Assessment Pedagogy Curator)  
> **Rujukan kode (satu sumber kebenaran):** [`src/lib/ai/enrich.ts`](../src/lib/ai/enrich.ts) · [`src/lib/contracts/question.ts`](../src/lib/contracts/question.ts) · [`src/lib/services/enrichment-service.ts`](../src/lib/services/enrichment-service.ts)  
> **Audit terkait:** [`docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md`](pedagogy/AUDIT-DISTRACTOR-RATIONALE.md)

---

## 0. Ringkasan Eksekutif — Pedagogy Contract

MathBank menegakkan **Pedagogy Contract** — seperangkat syarat yang membuat butir soal layak disebut bermutu tinggi:

| # | Syarat | Ditegakkan oleh |
|:-:|--------|-----------------|
| 1 | **31 kaidah Haladyna** | §3 (panduan) + audit psikometrik |
| 2 | **Distractor Rationale A–E** (miskonsepsi konkret) | `validateDistractorRationales()` |
| 3 | **Rubrik esai** berjenjang & terukur | `validateRubric()` + `rubricSchema` |
| 4 | **KaTeX murni** (tanpa galat sintaks / macro terlarang) | `validateKatexContract()` |
| 5 | **Taksonomi kognitif & kurikulum** (Bloom C1–C6 / DOK 1–4) | `pedagogyMetaSchema` + §4 |

**Kontrak kualitas rationale:** setiap pengecoh wajib menyebut **(a) nama kesalahan**, **(b) langkah matematis yang salah**, dan **(c) nilai/ekspresi hasil** kesalahan itu — agar siswa dapat menelusuri balik ke kesalahannya.

---

## 1. Visi & Standar Mutu Math My Id

Math My Id berprinsip bahwa asesmen bukan sekadar alat penskoran pasif, melainkan instrumen diagnostik pembelajaran (*learning by doing*). Soal berkualitas tinggi harus mampu mengidentifikasi secara presisi letak miskonsepsi pemikiran siswa saat memilih jawaban keliru.

---

## 2. Mandat Analisis Pengecoh (*Distractor Rationale Mandate*)

⚠️ **Aturan Mutlak:** Pada setiap butir soal pilihan ganda (opsi A–E), seluruh opsi pengecoh (opsi yang salah) **WAJIB** memiliki `distractor_rationale` yang terisi secara substantif.

### 2.1 Kriteria rationale yang sah

1. **Analisis miskonsepsi nyata** — menjelaskan kekeliruan konsep matematis yang mendasari munculnya angka/jawaban tersebut.
   - *Salah*: "Jawaban salah karena nilainya tidak sesuai." (placeholder generik → **DITOLAK**).
   - *Benar*: "Siswa keliru menerapkan sifat distributif perkalian terhadap penjumlahan, yaitu menghitung \\(2(x+3)\\) menjadi \\(2x+3\\) alih-alih \\(2x+6\\)." (**DITERIMA**).
2. **Panjang minimal** — ≥ 40 karakter deskripsi analitik (`MIN_RATIONALE_LENGTH`).
3. **Penyelarasan pembahasan** — koheren dengan langkah pada `answer_key.explanation`.

### 2.2 Format wajib (tiga unsur)

`Nama kesalahan — langkah salah → hasil.` Bahasa Indonesia; rumus pakai KaTeX murni.

### 2.3 Katalog miskonsepsi matematis umum

| Kategori | Contoh konkret | Contoh rationale |
|----------|----------------|------------------|
| **Sign error** | \\(-(2x-3)=-2x-3\\) | "Siswa lupa mendistribusikan tanda negatif ke seluruh suku dalam kurung sehingga tanda suku kedua ikut menjadi negatif." |
| **Order of operations** | \\(2+3\\times4=20\\) | "Siswa mengerjakan penjumlahan sebelum perkalian sehingga menjumlahkan \\(2+3\\) lebih dulu." |
| **Formula confusion** | pakai \\(P(n,r)\\) untuk kombinasi | "Siswa menganggap urutan penting sehingga memakai permutasi alih-alih kombinasi." |
| **Incomplete procedure** | berhenti di \\(x\\) padahal diminta \\(2x+1\\) | "Siswa berhenti setelah memperoleh \\(x\\) dan lupa mensubstitusi ke bentuk yang diminta." |
| **Unit/scale slip** | lupa konversi cm→m | "Siswa mencampur satuan sehingga hasil akhir berskala \\(10^2\\) terlalu besar." |
| **Off-by-one** | ruang hasil \\(\\{0,\\dots,4\\}\\) untuk 3 lemparan | "Siswa mengira jumlah percobaan 4 sehingga batas atas gambar terlalu besar satu." |
| **Cacahan vs ukuran** | "banyak kecelakaan" dianggap kontinu | "Siswa keliru menganggap besaran cacahan (count) sebagai besaran kontinu." |
| **Boundary error** | mengabaikan kasus \\(=0\\) | "Siswa mengabaikan kasus batas bawah (nilai 0) saat menyusun ruang hasil." |

### 2.4 Kontrak kode (penegakan otomatis)

`validateDistractorRationales(options)` menolak rationale dengan kode:

| Kode | Arti | Ambang |
|------|------|--------|
| `missing` | pengecoh tanpa rationale | kosong/NULL |
| `too_short` | terlalu pendek | `< 40` char |
| `placeholder` | frasa generik terlarang | `PLACEHOLDER_RATIONALE_PHRASES` |
| `no_reasoning` | tanpa penanda penalaran | `REASONING_MARKERS` |
| `duplicate` | identik dengan pengecoh lain | normalisasi spasi sama |

**Frasa terlarang:** "salah karena", "jawaban salah", "tidak tepat", "kesalahan perhitungan", "kurang teliti", "distractor", "pengecoh", dst.
**Penanda penalaran:** "karena", "sehingga", "menganggap", "keliru", "lupa", "tertukar", "seharusnya", "padahal", dst.

### 2.5 Pipeline penerapan (MAT-41)

Saat `fields` memuat `"distractorRationale"`: AI hanya menerima **opsi salah**; `normalizeProposal()` membersihkan peta `label → rationale` (A–E, ≤1200 char); service menulis `distractor_rationale` **hanya ke opsi `is_correct=false`** — **kunci tidak pernah disentuh**; `evaluatePedagogyContract()` melaporkan sisa pelanggaran.

> **Prinsip kejujuran:** bila derivasi pengecoh tak dapat direkonstruksi unik, tandai *hipotesis* & verifikasi kurator sebelum publikasi (lihat audit §3, Sampel 5).

---

## 3. 31 Kaidah Haladyna (Item-Writing Rules)

Seluruh authoring & kurasi soal pilihan ganda wajib mematuhi kaidah Thomas M. Haladyna. Kaidah dipisah ke **batang soal**, **opsi**, dan **perilaku kunci**.

### 3.1 Batang Soal (Stem) — 10 kaidah

| # | Kaidah | Larangan/Praktik |
|:-:|--------|------------------|
| 1 | **Masalah pasti di batang** | Batang memuat masalah matematis utuh & mandiri; siswa paham pertanyaan sebelum membaca opsi. |
| 2 | **Hindari kata berlebihan** | Buang basa-basi non-matematis, kecuali soal pemodelan kontekstual autentik (PISA/AKM). |
| 3 | **Hindari kalimat negatif** | Hindari "mana yang **BUKAN**"/"kecuali". Bila tak terhindarkan, kata negatif **ditebalkan & dikapitalisasi**. |
| 4 | **Hindari petunjuk tak sengaja** | Jangan menyisipkan kata yang sama dengan kunci (*clue* verbal). |
| 5 | **Materi homogen** | Semua butir dalam satu set mengukur domain yang sama. |
| 6 | **Tingkat bahasa sesuai** | Kosakata & struktur kalimat setara jenjang (Fase D/E/F). |
| 7 | **Panjang batang ringkas** | Satu gagasan utama per butir; pecah soal multi-konsep menjadi stimulus + anak soal. |
| 8 | **Format jelas** | Tak ada ambiguitas "hitunglah"/"tentukan"; satuan & pembulatan eksplisit. |
| 9 | **Data lengkap** | Semua bilangan/konstanta yang diperlukan tersedia di batang. |
| 10 | **Tanpa informasi tak relevan** | Pengecoh informasi hanya untuk soal penalaran tingkat tinggi yang sah. |

### 3.2 Opsi Jawaban A–E — 12 kaidah

| # | Kaidah | Larangan/Praktik |
|:-:|--------|------------------|
| 11 | **Homogenitas kategori** | Semua 5 opsi satu kategori logis-matematis (semua pecahan, semua interval, dst.). |
| 12 | **Simetri gramatikal & struktural** | Opsi ± sama panjang & format. |
| 13 | **Eksklusif mutual** | Opsi tak boleh tumpang tindih (A: \\(x>5\\), B: \\(x\\ge5\\) → terlarang). |
| 14 | **DILARANG "semua jawaban benar"** | — |
| 15 | **DILARANG "tidak ada jawaban yang benar"** | — |
| 16 | **Pengecoh plausible** | Setiap pengecoh = hasil kesalahan nyata, bukan angka acak (§2). |
| 17 | **Tanpa pengulangan kata kunci** | Kata kunci di batang tidak diulang identik di semua opsi. |
| 18 | **Variasi posisi kunci** | Kunci tersebar A–E tanpa pola posisi (§3.3). |
| 19 | **Hindari opsi bergantung opsi** | "Semua pernyataan di atas" juga terlarang. |
| 20 | **Panjang opsi serupa** | Opsi terpanjang jangan selalu menjadi kunci. |
| 21 | **Nilai opsi berbeda** | Tak ada dua opsi bernilai matematis sama (mis. \\(\\frac12\\) dan \\(0{,}5\\)). |
| 22 | **Urutan logis/kuantitatif** | Opsi numerik terurut naik/turun. |

### 3.3 Perilaku Kunci & Analisis Butir — 9 kaidah

| # | Kaidah | Larangan/Praktik |
|:-:|--------|------------------|
| 23 | **Tepat satu kunci** | Tiap butir tepat 1 kunci (tipe checkbox: ≥1 sesuai kontrak). |
| 24 | **Distribusi kunci seimbang** | Kunci A–E ± merata (deviasi < 10% dari N/5). |
| 25 | **Jumlah opsi homogen** | 5 opsi (A–E) untuk PG biasa; konsisten dalam satu set. |
| 26 | **Daya beda** | Butir membedakan siswa paham vs tidak. |
| 27 | **Tingkat kesulitan terkendali** | `difficulty` 1–5 mencerminkan p-value empiris, bukan tebakan. |
| 28 | **Pengecoh berfungsi** | Tiap pengecoh ditarik ≥1 siswa pada uji coba. |
| 29 | **Tanpa bias** | Bahasa/nama netral (tanpa stereotip). |
| 30 | **Revisi berbasis data** | Butir lemah direvisi/dibuang berdasarkan analisis butir. |
| 31 | **Dokumentasi rationale** | Setiap butir PG menyertakan **distractor rationale** tiap pengecoh (§2). |

> **Penegakan kode:** kaidah **14, 15, 22, 23, 24, 31** diperiksa otomatis oleh audit psikometrik (`scripts/audit-pedagogy.ts`) + `validateDistractorRationales()`. Kaidah lain bersifat editorial kurator & diperiksa saat review.

---

## 4. Standar Rubrik Penilaian Esai Analitik (*Analytic Rubrics*)

Untuk butir `essay` / `short_answer` — **wajib** rubrik objektif & reproducible.

### 4.1 Skema (`answer_key.rubric`)

```jsonc
{
  "answer_key": {
    "text": "…jawaban ideal…",
    "explanation": "…pembahasan ber-KaTeX…",
    "rubric": {
      "totalPoints": 5,
      "criteria": [
        { "id": "langkah-1", "description": "Menuliskan model persamaan yang benar", "points": 3 },
        { "id": "langkah-2", "description": "Menyelesaikan & menafsirkan hasil", "points": 2 }
      ]
    }
  }
}
```

### 4.2 Aturan (`validateRubric()`)

| Kode | Syarat |
|------|--------|
| `empty` | minimal **1 kriteria** |
| `criterion_description` | deskripsi ≥ 10 char (langkah matematis konkret) |
| `criterion_points` | poin > 0 |
| `total_mismatch` | `totalPoints` = jumlah poin kriteria |

### 4.3 Prinsip & bobot skor

1. **Satu kriteria = satu langkah** yang dapat diamati.
2. **Bobot terdistribusi**: skor pemahaman konsep/formula awal (mis. 1), substitusi & manipulasi aljabar (mis. 2), ketelitian komputasi & kesimpulan bersatuan (mis. 1).
3. **Berjenjang**: poin parsial untuk langkah benar sebagian (*method marks*).
4. **Objektif**: dua penilai berbeda → skor sama untuk jawaban sama.
5. **Total konsisten**: `totalPoints` = jumlah poin.

---

## 5. Validasi Sintaksis Formula KaTeX

Sebelum soal disetujui (`ready`), `validateKatexContract()` menegakkan:

| Kode | Deteksi | Contoh |
|------|---------|--------|
| `syntax` | galat parse KaTeX | `\frac{1}` (argumen kurang) |
| `unbalanced_braces` | kurung `{}` tak seimbang | `\frac{1}{2` |
| `empty_frac` | `\frac` pembilang/penyebut kosong | `\frac{}{2}`, `\frac{3}{}` |
| `forbidden_macro` | macro terlarang | `\input`, `\href`, `\def`, `\htmlClass` |

**Macro terlarang** (`FORBIDDEN_MACROS`): I/O file (`\input`, `\include`, `\write`), definisi makro (`\def`, `\newcommand`, `\edef`), hyperlink/gambar (`\href`, `\url`, `\includegraphics`), ekstensi HTML KaTeX (`\htmlClass`, `\htmlStyle`, `\htmlData`).

### 5.1 Delimiter kanonik (murni)

- **Inline:** `\( ... \)` · **Blok (display):** `\[ ... \]`.
- Data lama `$...$` / `$$...$$` dinormalisasi otomatis saat lint; konten **baru** wajib delimiter murni.

> **Mengapa macro-level, bukan hanya `trust:false`?** `trust:false` mencegah *render* berbahaya tetapi tetap **menyimpan** teks berbahaya. MathBank menolak sejak validasi → bank soal bersih secara portabilitas (Moodle/GitSync/PDF).

### 5.2 Disiplin tabel & TikZ

- **Jangan** pakai gambar scan untuk tabel numerik — konversi ke **Markdown pipe table** atau **HTML `<table>`** semantik dengan KaTeX dalam sel.
- Matriks pakai environment KaTeX (`matrix`, `pmatrix`, `cases`, `aligned`).
- Geometri/grafik: TikZ koordinat standar, hanya pustaka `pgf/tikz` (headless SVG).

---

## 6. Taksonomi Kognitif & Pemetaan Kurikulum

### 6.1 Webb's DOK × Bloom

| DOK | Bloom | Deskripsi | Contoh |
|:---:|:-----:|-----------|--------|
| **1** | C1–C2 | Recall & reproduction | Sebutkan rumus, aritmetika sederhana |
| **2** | C3 | Skills & concepts | Prosedur multi-langkah rutin, grafik linear/kuadrat |
| **3** | C4–C5 | Strategic thinking | Pemodelan non-rutin, pembuktian, sintesis (SNBT Penalaran) |
| **4** | C6 | Extended thinking | Perumusan masalah terbuka, sintesis lintas domain |

### 6.2 Fase kurikulum nasional

| Fase | Jenjang | Materi inti |
|------|---------|-------------|
| **D** | SMP 7–9 | Aljabar dasar, Teorema Pythagoras, peluang dasar, statistik deskriptif |
| **E/F** | SMA 10–12 | Eksponen & logaritma, vektor, trigonometri, kalkulus diferensial & integral |
| **SNBT/UTBK** | — | Pengetahuan Kuantitatif & Penalaran Matematika |

### 6.3 Metadata (`pedagogyMetaSchema`)

```jsonc
{
  "pedagogyMeta": {
    "dokLevel": 3,
    "bloomLevel": "C4",
    "haladynaCompliant": true,
    "rationaleCoverage": 1.0
  }
}
```

- `bloomLevel` diturunkan dari `cognitiveLevel` (remember→C1 … create→C6).
- `rationaleCoverage` = rasio pengecoh ber-rationale (0–1); target **1,0** untuk publikasi.

---

## 7. Kontrak & Penegakan di Kode

| Lapisan | Berkas | Peran |
|---------|--------|-------|
| Validator murni (L6) | `src/lib/ai/enrich.ts` | `validateKatexContract`, `validateDistractorRationales`, `validateRubric`, `evaluatePedagogyContract` |
| Kontrak Zod (L9) | `src/lib/contracts/question.ts` | `rubricSchema`, `pedagogyMetaSchema`, `optionInputSchema.distractorRationale` |
| Orkestrasi (L5) | `src/lib/services/enrichment-service.ts` | menerapkan rationale/rubrik + laporan `pedagogy` |
| Kontrak API | `src/lib/contracts/ai.ts` | `enrichFieldSchema` |

### 7.1 Alur enrichment pedagogi

```
POST /api/ai/enrich  { questionId, fields:["distractorRationale","rubric"] }
   → enrichQuestion()
       → prompt hanya memuat opsi SALAH
       → normalizeProposal() (peta A–E, rubrik tervalidasi)
       → tulis rationale ke opsi is_correct=false  (KUNCI UTUH)
       → tulis rubrik ke answer_key.rubric
       → evaluatePedagogyContract() → laporan { katex, rationale, rubric }
       → audit (diffPayload.pedagogy)
```

### 7.2 Target kepatuhan

| Syarat | Alat ukur | Target |
|--------|-----------|:------:|
| KaTeX bersih | `validateKatexContract` | 100% |
| Rationale pengecoh lengkap | `isDistractorRationaleComplete` | 100% |
| Rubrik esai | `validateRubric` | 100% |
| Distribusi kunci seimbang | `scripts/audit-pedagogy.ts` | deviasi < 10% |

---

## 8. Tanya-Jawab & Jebakan Umum

1. **"Rationale satu kalimat cukup?"** — Boleh, asalkan memuat tiga unsur & lolos `validateDistractorRationales`; < 40 char ditolak.
2. **"Boleh rationale sama untuk semua pengecoh?"** — Tidak (`duplicate` ditolak).
3. **"Kunci diisi rationale?"** — Tidak perlu; validator hanya memeriksa opsi salah.
4. **"Esai tanpa rubrik?"** — Ditolak (`requiresRubric`).
5. **"Pakai `\href`?"** — Dilarang (`forbidden_macro`).
6. **"Data lama `$...$`?"** — Dinormalisasi saat lint; konten baru wajib `\( \)`.

---

## 9. Rujukan Silang

| Dokumen | Kaitan |
|---------|--------|
| `docs/pedagogy/AUDIT-DISTRACTOR-RATIONALE.md` | Baseline cakupan rationale & exemplar kurasi |
| `docs/SKEMA-DB-DETAIL.md` | Skema `question_options.distractor_rationale` & `answer_key` |
| `docs/KONTRAK-API.md` | Kontrak endpoint `/api/ai/enrich` |
| `docs/RENCANA-ENRICHMENT.md` | Rencana pipeline enrichment |
| `docs/PETA-DOKUMEN.md` | Indeks dokumen |
| `SKILL_PEDAGOGY.md` | Instruksi kurator (skill) |

---

*Dokumen hidup — perbarui saat kaidah Haladyna, kontrak kode, atau pemetaan kurikulum berubah. Setiap perubahan wajib disertai pembaruan test (`src/lib/ai/enrich.test.ts`).*
