# STRATEGI INGEST — M9: Parsing Korpus (mathcyber · m4thlab · defantri)

> **Status:** 📋 rencana (butuh persetujuan) · **Milestone:** M9 (Fase 2) · **Tanggal:** 2026-09-30
> **Perubahan arah:** M9 **BUKAN** PDF. Fokus: **parsing korpus HTML** yang sudah dicrawl
> (mathcyber, m4thlab, defantri, pusmendik). Keputusan pemilik produk 2026-09-30.

---

## 1. Tujuan

Membangun **aturan global** untuk mengolah korpus (HTML artikel hasil crawl) menjadi
**soal draft** di MathBank, beserta **endpoint**-nya — menggantikan skrip ad-hoc
per-sumber di QBank menjadi satu mesin yang:

- **satu jalur** untuk semua sumber (adapter per-sumber di dalamnya),
- **teruji** (fungsi murni, fixture),
- **idempoten** (ulang impor tak menggandakan),
- **aman** (hanya buat `draft`; manusia menelaah).

---

## 2. Bahan Baku yang Dipelajari (2026-09-30)

Lokasi: **`~/projects/qbank/data/corpora/`** (proyek lama).

| Sumber | File | Ukuran | Bentuk | Penanda soal |
|---|---|---|---|---|
| **mathcyber** | 407 | 25 MB | HTML artikel | `Problem Number` / `Soal Nomor` + `sp-wrap`/`sp-head`/`sp-body` (pembahasan) |
| **m4thlab** | 249 | 8.2 MB | HTML terstruktur | `class="contoh-soal"` · `cs-header` · `cs-opt` (+`pilihJawaban(this,true/false)`) · `cs-pem-body` |
| **defantri** | 414 | 24 MB | HTML blog (prosa) | umumnya **bukan soal** (`Pembahasan` sesekali) |
| **pusmendik_tka** | 8 | 1.6 MB | JSON terstruktur | (bentuk khusus — perlu dipelajari) |
| **pusmendik_dayaserap** | 4 | 352 KB | JSON terstruktur | (bentuk khusus — perlu dipelajari) |

**Bentuk file seragam:** `{ url, slug, title, crawledAt, imageCount, rawHtml }`
(+ m4thlab menambah `type/level/grade`). **Manifest** per-sumber: `data/corpora/<src>_manifest.json`
(`articles[]` dengan `status/imported_questions_count`).

### 2.1 Temuan penting (hasil pemeriksaan langsung)

1. **Tiap sumber punya penanda berbeda** → butuh **adapter per-sumber**, bukan satu regex.
2. **Bahasa campur**: mathcyber kadang **Inggris** (`Problem Number` — IMSO/Beaver), lainnya
   **Indonesia** (`Soal Nomor`) → penanda harus **dua bahasa**.
3. **Banyak file bukan soal** (artikel murni, 0 penanda) → **lewati dengan sopan** (`skipped`).
4. **Logika lama sudah ada** di QBank: `src/lib/ingest/corpus-parser.ts` (290 baris,
   `parseRawArticleHtml` + `parseSingleItem`). **Ini "aturan global" yang diminta** — tapi
   menumpuk dalam monolit (disebut **641 baris** di desain).
5. **Desain MathBank melarang monolit** (L6 #3): *"Parser dipecah jadi fungsi kecil teruji"*.

---

## 3. Aturan Global (usulan — inti M9)

Jalur: **`HTML mentah → bersihkan → segmen per-soal → bedah soal → normalisasi → draft`**

```
rawHtml
  │
  ├─(1) cleanHtmlBasic     : buang <script>/<style>/iklan, entitas → unicode, img → markdown
  ├─(2) pilih adapter      : mathcyber | m4thlab | defantri | pusmendik  (deteksi otomatis)
  ├─(3) segmentasi         : pisah artikel → blok per-soal (penanda sumber)
  ├─(4) bedah soal         : stem · opsi A–E · kunci · pembahasan
  ├─(5) normalisasi math   : $…$ → \(…\), $$…$$ → \[…\], perbaiki LaTeX rusak
  ├─(6) klasifikasi        : single_choice (≥2 opsi) | essay (tanpa opsi)
  └─(7) tandai "perlu dicek": opsi<5, kunci tak ketemu, dst → isFlagged (tetap draft)
```

### 3.1 Adapter per-sumber

| Sumber | Segmentasi | Opsi | Kunci | Pembahasan |
|---|---|---|---|---|
| **mathcyber** | `<h_>… (Soal Nomor\|Problem Number) N …</h_>`; pisah MC vs `Bagian Uraian`/`Essay Section` | baris `A. … B. …` atau radio | `(Jawaban X)` / `option X` | blok `sp-wrap`/`sp-head`/`sp-body` |
| **m4thlab** | `class="contoh-soal"` → `cs-header` (+nomor) | `cs-opt` + `pilihJawaban(this,true/false)` | `true` → kunci | `cs-pem-body` |
| **defantri** | `<h_>/<b>/<p> N. …` | radio `<input value=…>` atau `A. …` | radio `correct` | blok `Pembahasan` |
| **pusmendik** | (JSON — perlu dipelajari lebih dalam) | — | — | — |

### 3.2 Aturan mutu (menuai pengalaman QBank)

- **Opsi < 5 → `isFlagged`** (tetap draft + catatan) — bukan dibuang.
- **Kunci tak terdeteksi** → `isFlagged` + catatan; **jangan menebak** sebagai A.
- **0 penanda soal** → status `skipped` (artikel murni), bukan error.
- **Pembahasan dipisah** dari stem (potong di penanda pembahasan).
- **Gambar** → tautan markdown `![Gambar](url)` + catat di `mediaManifest`.
- **Idempotensi**: hash `sha256(url + rawHtml)`; impor ulang → **perbarui**, bukan gandakan.

---

## 4. Ruang Lingkup Teknis M9

### 4.1 Lapisan murni (L6 — teruji)
- `ingest/parsers/clean.ts` — `cleanHtmlBasic`, `normalizeMathBasic` (dari QBank, ditulis ulang)
- `ingest/parsers/segment.ts` — pisah artikel → blok soal (per-adapter)
- `ingest/parsers/items.ts` — bedah blok → `{ stem, options, answerKey, explanation }`
- `ingest/parsers/adapters/{mathcyber,m4thlab,defantri}.ts` — penanda per-sumber
- Semua **fungsi murni** (string → objek) → mudah diuji + fixture

### 4.2 Lapisan DB (L5)
- `ingest/queue.ts` — enqueue artikel + status (`pending→processing→done|failed|skipped`) + retry
- `ingest/commit.ts` — hasil parse → soal `draft` (lewat `createQuestion`, transaksi) + sumber + pembahasan
- **Sumber korpus** didaftarkan ke `sources` (mis. "MathCyber1997", "m4th-lab.net")

### 4.3 Endpoint (L4) — **dua wajah**
| Endpoint | Auth | Untuk |
|---|---|---|
| `POST /api/ingest/upload` | **machine** | Kirim artikel (JSON `{url,title,rawHtml,source}`) → antrean |
| `GET /api/ingest/queue` | session | Lihat antrean (UI) |
| `POST /api/ingest/commit` | **machine** | Proses antrean → soal draft |
| `GET /api/ingest/sources` | session | Daftar sumber korpus |

### 4.4 Halaman Ingest & Integrasi (aktifkan dari tersembunyi)
3 tab: **Unggah** (tempel/unggah HTML/JSON) · **Antrean** (status + retry) · **Integrasi** (sumber + machine key).

### 4.5 Tes
Fixture: potongan kecil tiap sumber (mathcyber MC+essay, m4thlab, defantri) — uji
segmentasi, deteksi opsi/kunci, normalisasi, dan **"lewati artikel murni"**.

**Non-tujuan M9:** PDF (ditunda) · OCR · AI tagging (M10) · crawl situs (sudah ada di QBank).

---

## 5. Keputusan yang Butuh Persetujuan

1. **Sumber korpus disalin ke MathBank?** — data ada di `~/projects/qbank/data/corpora/`
   (~58 MB). Opsi: (a) salin ke `~/projects/mathbank/data/corpora/`, (b) baca dari lokasi
   QBank, (c) impor lewat endpoint saja (tanpa file lokal).
2. **Adapter otomatis atau eksplisit?** — deteksi sumber dari `url`/penanda (otomatis) vs
   parameternya disebut saat impor (eksplisit). **Usul: otomatis dengan fallback eksplisit.**
3. **Cakupan awal**: mulai **mathcyber + m4thlab** dulu (paling terstruktur), defantri & pusmendik menyusul?

---

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Variasi HTML antar artikel | Adapter teruji + fixture; gagal → `failed` dengan pesan, bukan crash |
| Bahasa campur (ID/EN) | Penanda dua bahasa di tiap adapter |
| Banyak artikel bukan soal | Deteksi 0 penanda → `skipped` |
| Duplikat saat impor ulang | Hash konten `sha256` + `UNIQUE` |
| Rumus rusak/tak standar | `normalizeMathBasic` + `isFlagged` bila mencurigakan |

---

## 7. Prinsip yang Dipatuhi
- **L6 #3** — parser **dipecah** jadi fungsi kecil teruji (bukan monolit `corpus-parser`).
- **L6 #5** — `extract.ts`/`parsers/` dinamai jujur sesuai isi.
- **T16** — `ingest_queue` = antrean **file/artikel**, bukan hasil.
- **CONSTRAINTS #2** — keputusan (sumber, cakupan) **disetujui user** dulu.
- **CONSTRAINTS #33/#34** — rate limit + proyeksi kolom eksplisit.
- Semua hasil = **draft** (manusia menelaah) — tak ada `ready` otomatis dari ingest.

---

*Lihat juga: `docs/MILESTONE.md` §M9, `docs/DESAIN-PER-LAPISAN-MATHBANK.md` (L4/L5/L6),
`CONSTRAINTS.md`, `~/projects/qbank/src/lib/ingest/corpus-parser.ts` (rujukan logika lama).*
