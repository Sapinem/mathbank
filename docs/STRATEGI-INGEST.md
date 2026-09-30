# STRATEGI INGEST — M9 (PDF → Bank Soal)

> **Status:** 📋 rencana (butuh persetujuan — menambah dependency) · **Milestone:** M9 (Fase 2) · **Tanggal:** 2026-09-30
> **Sifat:** keputusan arsitektural (CONSTRAINTS #2 — Zero Silent Assumptions). **Belum ada kode ditulis.**

---

## 1. Tujuan

Menutup alur **naskah → bank soal**: unggah PDF naskah/ujian → ekstrak teks →
pisahkan soal & stimulus → deteksi nomor + opsi → buat soal **draft** → antre telaah.

Pelengkap MVP: setelah M8 (ekspor cetak), M9 melengkapi arah **masuk** (import).

---

## 2. Keputusan yang Butuh Persetujuan

### 2.1 Library ekstraksi PDF

Riset 2026-09-30. Ekstraksi teks PDF di Node/Next memerlukan *render engine* PDF.js.

| Kandidat | Dep | Runtime | Layout (x/y/font) | OCR | Catatan |
|---|---|---|---|---|---|
| **`unpdf`** ⭐ | **0 (zero-dep)** | Node+edge+serverless | ✅ `extractTextItems` (x,y,fontSize,dir) | ❌ | unjs collective; bundel PDF.js **v5.6** serverless; aktif dipelihara; pengganti modern `pdf-parse` |
| `pdfjs-dist` langsung | ± besar | Node (butuh `canvas` utk worker) | ✅ | ❌ | resmi Mozilla, tapi lebih berat di Next; worker & `canvas` merepotkan |
| `pdf-parse` | 1 | Node | ❌ (teks saja) | ❌ | **tak dipelihara**; kelas lama |
| `pdf2json` | beberapa | Node | ✅ (AcroForm) | ❌ | untuk form; berat |
| OCR (tesseract.js / Unstructured) | besar | WASM/Python | — | ✅ | **berat**, untuk PDF hasil pindai; **di luar M9** |

**Rekomendasi: `unpdf`.**
- **Zero dependency** → sesuai CONSTRAINTS #5 ("install saat perlu").
- `extractTextItems` memberi **koordinat** (x/y/fontSize) → **wajib** untuk merekonstruksi
  urutan baca PDF berkolom (lihat §3).
- Satu paket kecil, API bersih, aktif dipelihara.

> **Catatan jujur:** ini **tetap menambah 1 dependency**. Karena #2 melarang menambah
> dependency tanpa persetujuan, keputusan ini **menunggu user**.

### 2.2 Cakupan PDF (batasan jujur)

| Jenis PDF | Status M9 |
|---|---|
| PDF **digital** (punya lapisan teks) | ✅ didukung |
| PDF **hasil pindai** (gambar saja, 0 item teks) | ❌ **tak didukung** → **dideteksi & diberi pesan jelas** ("perlu OCR, belum tersedia") |
| PDF **berkolom** (2 kolom) | ✅ rekonstruksi via Y-grouping |
| PDF dengan **rumus sebagai gambar** | ⚠️ rumus tak terekstrak sebagai teks → tetap gambar (catat) |

---

## 3. Masalah Inti: Urutan Baca

PDF.js mengembalikan teks dalam **urutan render**, bukan urutan baca. Halaman 2 kolom
bisa jadi: `Kol1-kata1 → Kol2-kata1 → Kol1-kata2 …` (berselang-seling).

**Solusi (algoritma murni, teruji):**
1. Ambil item berkoordinat (`extractTextItems`).
2. **Kelompokkan per baris** dengan toleransi Y (±3 pt).
3. Urutkan tiap baris dengan **X** (kiri→kanan); urutkan baris dengan **Y** (atas→bawah).
4. Deteksi kolom bila ada **celah X besar** yang konsisten (kandidat 2 kolom) → pecah.

Ini **fungsi murni** (L6) — paling rawan bug → **dipecah & teruji** (keputusan L6 #3).

---

## 4. Keputusan L6/L5 yang sudah terkunci

| # | Keputusan | Sumber |
|---|---|---|
| 1 | **Parser dipecah** jadi fungsi kecil teruji (bukan monolit 641 baris) | L6 #3 |
| 2 | **`extract.ts`** dinamai jujur (bukan `document-processor`); dikembangkan hanya saat perlu | L6 #5 |
| 3 | `ingest_queue` = **antrean FILE**, bukan hasil | T16 |
| 4 | Struktur: `ingest/parsers/` (unescape·clean·normalize·parseArticle) + `extract.ts` | L6 |

---

## 5. Ruang Lingkup Teknis M9

- [ ] **`ingest/extract.ts`** — bungkus `unpdf`: PDF → teks ber-layout (item koordinat)
- [ ] **`ingest/parsers/`** (fungsi murni teruji):
  - `lines.ts` — item → baris (Y-grouping) + urut X
  - `columns.ts` — deteksi & pisah kolom
  - `questions.ts` — deteksi **nomor soal** (1. / 1) / **Soal No. 1**), opsi (**A. B. C. D. E.**)
  - `stimulus.ts` — deteksi pembuka stimulus (narasi panjang sebelum soal bernomor)
  - `clean.ts` — unescape, normalisasi spasi/Unicode, buang header/footer berulang
- [ ] **`ingest/queue.ts`** — enqueue + retry + **idempotensi** (jangan proses 2× file sama)
- [ ] **`ingest/commit.ts`** — hasil parse → soal `draft` (transaksi; pakai `createQuestion`)
- [ ] **Endpoint `/api/v1/ingest/*`** (peran **`machine`**, L4): `POST /upload`, `GET /queue`, `POST /commit`
- [ ] **Halaman Ingest & Integrasi** (grup Sistem, aktifkan dari tersembunyi) — 3 tab: Unggah · Antrean · Integrasi
- [ ] **Deteksi PDF pindai** → status `failed` + pesan "perlu OCR"
- [ ] **Tes parser** dengan **fixture** (PDF digital, 1 & 2 kolom; JSON item koordinat)
- 📄 `STRATEGI-INGEST.md` (dokumen ini)

**Non-tujuan M9:** OCR PDF pindai · AI enrichment (M10) · MCP (M11).

---

## 6. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Variasi layout PDF (paling tak pasti) | Parser teruji + fixture; **kegagalan di-warn, bukan crash**; hasil tetap `draft` untuk ditinjau manusia |
| PDF pindai → teks kosong | Deteksi (item teks < ambang) → `failed` + pesan jelas |
| PDF besar → memory/timeout | Batas ukuran + jumlah halaman; timeout; proses sinkron (volume rendah) |
| Idempotensi (unggah dobel) | Hash konten (`sha256`) di `ingest_queue` → tolak duplikat |
| Rumus hilang dari teks | Catat sebagai batasan; stimulus/rumus tetap bisa disunting manual setelah import |

---

## 7. Prinsip yang dipatuhi
- **CONSTRAINTS #2** — keputusan library **disetujui user** dulu.
- **CONSTRAINTS #5** — `unpdf` **zero-dependency**; tak ada paket menganggur.
- **L6 #3/#5** — parser dipecah, `extract.ts` dinamai jujur.
- **T16** — `ingest_queue` = antrean file, bukan hasil.
- **CONSTRAINTS #33/#34** — rate limit + proyeksi kolom eksplisit pada endpoint.

---

## 8. Pertanyaan Terbuka (untuk user)

1. **Setujui `unpdf`** sebagai library ekstraksi PDF? (menambah 1 dependency)
2. **Cakupan**: cukup PDF **digital** (pindai ditolak dengan pesan)? Atau perlu OCR juga (jauh lebih berat, disarankan milestone terpisah)?
3. **Sumber unggah**: unggah **file** saja, atau juga **tempel teks** (paste)? (paste = jauh lebih mudah & andal, bisa jadi jalur pertama)

---

*Lihat juga: `docs/MILESTONE.md` §M9, `docs/DESAIN-PER-LAPISAN-MATHBANK.md` (L4/L6), `CONSTRAINTS.md`.*
