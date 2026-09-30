# RENCANA — Ekspor Moodle (M12)

> **Status:** 🟡 dirancang · **Milestone:** M12 · **Dependensi:** M8 · **Tanggal:** 2026-09-30
> **Rujukan:** `docs/RENCANA-EKSPOR.md` (M8 cetak/PDF), dokumentasi Moodle XML resmi.

---

## 1. Tujuan

Menambah **jalur ekspor kedua**: paket soal → **Moodle XML** → diimpor ke bank soal
Moodle (quiz). Berbeda dari M8 (cetak/PDF untuk kertas), M12 menghasilkan berkas
**terstruktur** agar soal bisa dipakai di LMS.

---

## 2. Format Moodle XML (riset 2025-11-25 dari sumber resmi)

Struktur dasar (dari `question/format/xml`, Moodle 4.x/5.x):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="category">
    <category><text>$course$/top/…</text></category>
  </question>
  <question type="multichoice">
    <name><text>Soal 1</text></name>
    <questiontext format="html"><text><![CDATA[…]]></text></questiontext>
    <generalfeedback format="html"><text>…</text></generalfeedback>
    <defaultgrade>1.0000000</defaultgrade>
    <penalty>0.3333333</penalty>
    <single>true</single>
    <shuffleanswers>true</shuffleanswers>
    <answer fraction="100" format="html"><text>A</text><feedback format="html"><text>…</text></feedback></answer>
    <answer fraction="0"   format="html"><text>B</text></answer>
    …
  </question>
</quiz>
```

**Tipe Moodle yang dipakai** (pemetaan dari tipe soal MathBank):

| MathBank | Moodle XML | Catatan |
|---|---|---|
| `single_choice` | `multichoice` `single=true` | 1 benar |
| `multiple_choice_checkbox` | `multichoice` `single=false` | ≥1 benar |
| `assertion_reason`, `combination_1234`, `quantitative_pq`, `data_sufficiency` | `multichoice` `single=true` | opsi = pilihan siap-pakai |
| `short_answer` | `shortanswer` | jawaban teks, `fraction=100` |
| `essay` | `essay` | `generalfeedback` = pembahasan |
| `matrix_grid`, `matching` | **⚠️ belum dipetakan** (butuh keputusan) | lihat §4 |
| `stimulus` | `description` (course-level) atau **disisipkan per-item** | lihat §4 per-item |

**Kaidah:** setiap `<question>` diakhiri `&lt;!-- ... --&gt;`? Tidak. Yang penting:
`fraction` **persen** (100 = benar, 0 = salah), `<single>` hanya untuk multichoice.

---

## 3. Keputusan ✅ (terkunci 2026-09-30)

| # | Keputusan | Akibat implementasi |
|---|---|---|
| **D1** | **Stimulus INLINE per-item** (A) | Teks stimulus disisipkan ke `<questiontext>` tiap soal anak; anak mandiri |
| **D2** | **Lewati + laporkan** (B) **+ catatan dev** | `matrix_grid`/`matching` **tidak diekspor**; masuk `skipped[]` + TODO perbaikan nanti |
| **D3** | **LaTeX mentah** (C) | Tak perlu render KaTeX server-side; `$…$` ditulis apa adanya (berharap filter TeX/MathJax Moodle) |
| **D4** | **Semua item** (A) | Soal tanpa kunci tetap diekspor (peringatan di ringkasan) |

### Keputusan yang dibutuhkan (arsip)

### D1 — Stimulus: per-item vs kategori

Soal **stimulus** (wacana/bacaan dengan soal anak) tidak punya padanan langsung di
Moodle. Dua pendekatan:

| Opsi | Cara | Kelebihan | Kekurangan |
|---|---|---|---|
| **A. Per-item (INLINE)** | Teks stimulus **disisipkan ke `<questiontext>`** setiap soal anak | Mandiri; tak ada soal yatim; sesuai M8 ("tiap soal bawa bacaannya sendiri") | Teks stimulus **terduplikasi** di tiap soal anak |
| **B. Category + description** | Stimulus jadi `description` di kategori; anak-anak setelahnya | Mirip struktur asal | Bergantung cara guru menampilkan; rapuh lintas versi Moodle |

> Rencana MILESTONE menyebut **"per-item: tiap soal bawa bacaannya sendiri"** →
> mengarah ke **A**. Tetap dikonfirmasi.

### D2 — Tipe kompleks (`matrix_grid`, `matching`)

| Opsi | Cara |
|---|---|
| **A. Petakan ke `multichoice`** | matrix/matching → pilihan ganda (kehilangan struktur interaktif, tapi **selalu bisa diimpor**) |
| **B. Lewati + laporan** | soal tipe ini **dilewati**, dilaporkan di ringkasan ekspor (jujur, tak menyesatkan) |
| **C. Ekspor mentah** | tulis sebagai teks polos non-interaktif |

### D3 — Rumus (LaTeX/KaTeX)

| Opsi | Cara |
|---|---|
| **A. KaTeX → HTML** (disarankan) | Render rumus jadi HTML+CSS KaTeX di dalam `<text format="html">`; tambah `<link>`? Moodle tak punya CSS KaTeX → rumus bisa *tampil pincang* tanpa stylesheet |
| **B. KaTeX → MathML** | `<math>` native di dalam HTML; Moodle & MathJax/modern browser bisa render |
| **C. Biarkan LaTeX mentah** (`$…$`) | Paling sederhana; **hanya tampil bila Moodle pakai filter TeX/MathJax** |

### D4 — Cakupan item yang diekspor

| Opsi | Cara |
|---|---|
| **A. Semua item paket** | termasuk yang belum punya kunci (Moodle boleh) |
| **B. Tolak bila ada soal tanpa kunci** | sesuai `validateBundle` — lebih aman untuk ujian |

---

## 4. Arsitektur (usulan)

```
src/lib/export/
  moodle-xml.ts     — bangun XML dari item paket (PURE, tanpa DB)
  moodle-map.ts     — pemetaan tipe MathBank → tipe Moodle
  xml-escape.ts     — escape XML/atribut & CDATA yang aman
  content-html.ts   — Markdown+LaTeX → HTML (pakai ulang logika MathContent)
src/app/api/bundles/[id]/export/moodle/route.ts — GET → unduh .xml
```

- **Fungsi murni** (`moodle-xml.ts`, `xml-escape.ts`) → **100% unit-testable** tanpa DB.
- Route tipis: ambil item (`listBundleItems`) → `buildMoodleXml` → kembalikan
  `Response` dengan `Content-Type: application/xml` + `Content-Disposition: attachment`.
- **Izin**: `bundle:manage` untuk membaca paket; **kunci jawaban** hanya bila
  `canSeeAnswerKey(actor)` (soal tanpa kunci → `fraction` tak diketahui → ditangani
  sesuai D4).

## 5. UI

- Tombol **"Ekspor Moodle (.xml)"** di halaman detail paket + halaman ekspor.
- Ringkasan sebelum unduh: jumlah soal, tipe yang dilewati (bila D2=B), peringatan
  soal tanpa kunci.

## 6. Langkah (M12-a…d)

| Tahap | Isi | Gate |
|---|---|---|
| **M12-a** | `xml-escape.ts` + `content-html.ts` (murni) | tes unit |
| **M12-b** | `moodle-map.ts` + `moodle-xml.ts` (murni) | tes unit (snapshot XML) |
| **M12-c** | Route `GET /api/bundles/[id]/export/moodle` | tes DB |
| **M12-d** | UI tombol + ringkasan; dokumen | tes + `pnpm check` |

## 7. Catatan Verifikasi

*(Diisi saat implementasi.)*

---

## 8. REVISI — Skema GitSync (keputusan user 2026-09-30)

User memutuskan **Moodle memakai skema `qbank_gitsync`** (maths/moodle-qbank_gitsync),
bukan impor satu berkas. Konsekuensi desain berubah:

### 8.1 Bentuk berkas GitSync (terverifikasi dari repo resmi)

- **Satu berkas = satu soal.** Tiap file `.xml` berisi `<quiz>` dengan **satu**
  `<question>` (persis struktur yang sudah kita bangun, tapi per-soal).
- **Struktur folder = pohon kategori**: `top/<Kategori>/<Subkategori>/<NamaSoal>.xml`.
  Nama folder = nama kategori yang disanitasi.
- Sub-direktori (di bawah `top`) boleh punya **`gitsync_category.xml`** (info kategori).
- **Manifest** `instancename_contextlevel_contextname_question_manifest.json` ada di
  samping `.git` — **dibuat oleh CLI GitSync saat impor**, **bukan** oleh kita.
  Kita cukup menyediakan **folder soal** yang valid; GitSync yang menghubungkan.
- Nama file soal: disanitasi dari nama soal; dipakai GitSync sebagai penanda.

### 8.2 Yang berubah pada rencana

| Aspek | Semula (1 berkas) | **GitSync (revisi)** |
|---|---|---|
| Keluaran | satu `.xml` per paket | **ZIP** berisi **banyak `.xml`** (1 per soal) + struktur folder |
| Endpoint | `…/export/moodle` | `…/export/moodle` → `application/zip` |
| Kategori | `<question type="category">` di depan | **folder** (`top/…`) + `gitsync_category.xml` |
| Manifest | — | **tidak dibuat** (milik CLI GitSync) |
| `buildMoodleXml` | tetap dipakai, **per soal** | + fungsi `buildQuestionFile()` (satu soal) |

### 8.3 Tetap berlaku

D1 (stimulus inline), D2 (lewati + lapor), D3 (`\( \)` / `\[ \]`),
**D4 (tolak bila ada soal tanpa kunci)** — semua tetap.

### 8.4 Struktur ZIP (usulan)

```
top/
  <Nama Paket>/                     ← kategori tingkat-1 (dari judul paket)
    gitsync_category.xml
    Soal-1.xml
    Soal-2.xml
    ...
```

> **✅ D5 (2026-09-30): kategori = TOPIK soal.** Folder = `top/<Topik>/<Subtopik>/`.
> Soal tanpa topik → folder **`Tanpa Topik`**.

### 8.5 ZIP — keputusan ✅

**D6 (2026-09-30): TANPA dependency** — tulis ZIP sendiri memakai `node:zlib`
(`deflateRawSync`). Format ZIP "store"/"deflate" cukup sederhana: local file header +
data + central directory + end-of-central-directory + CRC32 (dihitung sendiri).
Tujuan: patuh CONSTRAINTS #5 (install hanya bila perlu).

---
