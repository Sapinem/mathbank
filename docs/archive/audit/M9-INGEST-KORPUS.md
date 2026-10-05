# AUDIT MILESTONE 9 — INGEST KORPUS (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED (100% Selesai)**  
**Target:** Mesin Ingest Korpus Otomatis — Parser HTML/JSON, Unduh Media Deduplikasi, Antrean Idempotensi, Transaksi Commit `draft`, & API Engine (`/api/v1/ingest/*`).

---

## 1. Ringkasan & Ruang Lingkup Milestone 9

Milestone 9 adalah mesin pengolah data korpus masif (*Corpus Data Ingest Engine*) yang memproses hasil *crawling* **5 sumber** (**Pusmendik-TKA**, **Pusmendik-DayaSerap**, **Mathcyber**, **M4thlab**, **Defantri**) sebanyak **21.245 soal** ke dalam Bank Soal MathBank. Mesin ingest mengolah **5 sumber** (mathcyber, m4thlab, defantri, pusmendik_tka, pusmendik_dayaserap).

### Arsitektur 2-Fase Ingest Protocol:
1. **Fase Deterministik Non-AI (Fast Draft Import):**
   * Pengestrakan HTML/JSON murni menjadi batang naskah, opsi A–E, dan kunci jawaban.
   * Disimpan ke basis data dengan status `draft`, `is_flagged: false`, `categoryId: null`, `tags: []`, dan **melewati komputasi vektor embedding**.
   * Format rumpang atau opsi ambigu otomatis dikarantina dengan `is_flagged: true` + `flag_notes`.
2. **Fase AI Pedagogical Enrichment (M10):**
   * Inferensi tingkat lanjut untuk pembuatan *distractor rationale*, *rubric* esai, penetapan taksonomi topik, dan vektor embedding.

---

## 2. Matriks Target vs Realisasi M9

| Fitur / Komponen | Target Spesifikasi (M9) | Realisasi Kode (`src/lib/ingest/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Pembersih Naskah Murni** | `clean.ts` (HTML Unescape, KaTeX Fix, Tag Strip) | `src/lib/ingest/parsers/clean.ts` | ✅ Lulus |
| **Segmentasi & Adapter Modular** | Parser terpisah per-sumber korpus (4 adapter) | `src/lib/ingest/parsers/adapters/` | ✅ Lulus |
| **Media Downloader & Hash Dedup** | Resolution parser (`srcset > src`) + Hash SHA-256 | `src/lib/ingest/media/` | ✅ Lulus |
| **Antrean & Idempotensi Status** | `queue.ts` (Hash konten + status idempotent) | `src/lib/ingest/queue.ts` | ✅ Lulus |
| **Transaksi Commit `draft`** | Commit atomik `db.transaction` ke soal status `draft` | `src/lib/ingest/commit.ts` | ✅ Lulus |
| **Endpoint REST API Engine** | 3 REST API terautentikasi (`machine` role L1) | `/api/v1/ingest/upload`, `/queue`, `/commit` | ✅ Lulus |
| **Integritas Pengujian DB** | Uji unit (77) + integrasi DB (22) | `ingest.db.test.ts` & `ingest-api.db.test.ts` | ✅ Lulus |

---

## 3. Rincian Implementasi Komponen Utama M9

### A. Parser Terisolasi & Multi-Adapter Korpus (`parsers/adapters/`)
* **Pusmendik Adapter (`pusmendik-tka.ts` & `pusmendik-dayaserap.ts`):** Mengolah 299 soal (Format JSON & HTML) lengkap dengan pinning TLS dan penangan tipe soal kuantitatif.
* **Mathcyber Adapter (`mathcyber.ts`):** Mengolah 7.643 soal berbasis artikel blog matematika.
* **M4thlab Adapter (`m4thlab.ts`):** Mengolah 2.938 soal dengan penanganan wacana stimulus.
* **Defantri Adapter (`defantri.ts`):** Mengolah 10.365 soal beserta pemetaan gambar diagram.

### B. Pengunduh Media & Deduplikasi SHA-256 (`ingest/media/`)
* **Penanganan Resolusi Terbaik:** Fungsi `resolve-url.ts` memilah atribut `srcset` untuk memilih gambar dengan resolusi tertinggi sebelum diunduh.
* **Storage Deduplication:** Gambar yang diunduh dihitung hash SHA-256-nya. Jika gambar yang sama digunakan di 10 soal berbeda, file fisiknya di disk hanya disimpan **tepat 1 kali**.

### C. Proteksi Idempotensi Konten (`queue.ts` & `hash.ts`)
* Setiap artikel korpus dihitung hash SHA-256 uniknya.
* Percobaan meng-ingest artikel yang sama berkali-kali akan diabaikan secara aman (`status: 'skipped'`), mencegah duplikasi soal di basis data.

### D. Engine REST API V1 (`/api/v1/ingest/*`)
* `/api/v1/ingest/upload` ➔ Menerima dokumen HTML/JSON korpus.
* `/api/v1/ingest/queue` ➔ Memantau status antrean pemrosesan.
* `/api/v1/ingest/commit` ➔ Mengeksekusi penulisan atomik ke tabel `questions` berstatus `draft`.

---

## 4. Hasil Pengujian Teknis M9

Seluruh suite pengujian ingest dieksekusi secara otomatis dan **100% Lulus**:
* `clean.test.ts` ➔ **32 Tests Passed** (Pembersihan HTML & sintaks KaTeX).
* `adapters.test.ts` & `pusmendik.test.ts` ➔ **13 Tests Passed** (Segmentasi & ekstraksi opsi A–E).
* `media.test.ts` & `media-io.test.ts` ➔ **14 Tests Passed** (Resolution parsing, Mime Type validation, SHA-256 hash dedup).
* `ingest.db.test.ts` (13) & `ingest-api.db.test.ts` (9) ➔ **22 DB Integration Tests Passed** (Commit atomik & idempotensi API).
* **Total unit ingest:** **77/77 Lulus** (terverifikasi ulang 2026-09-30 via `npx vitest run src/lib/ingest/`).

---

## 5. Review Komparasi vs QBank (M9 Ingest)

| Dimensi | QBank (Sistem Lama) | MathBank (Sistem Baru) | Keunggulan MathBank |
| :--- | :--- | :--- | :--- |
| **Arsitektur Ingest** | Monolitik tunggal, rawan crash saat file korpus besar. | **Modular Pipeline (Clean ➔ Segment ➔ Media ➔ Commit)**. | **MathBank Lebih Stabil:** Pemrosesan terisolasi per-langkah. |
| **Penanganan Gambar** | Gambar diunduh berulang kali membuahkan file duplikat. | **SHA-256 Deduplication Storage**. | **MathBank Lebih Hemat Disk:** 1 gambar identik disimpan 1x. |
| **Idempotensi Batch** | Re-upload artikel menyebabkan soal duplikat di DB. | **Content Hash Queue (`status: skipped`)**. | **MathBank Lebih Aman:** Bebas dari duplikasi naskah. |

---

## 📄 KESIMPULAN MILESTONE 9

**MILESTONE 9 (INGEST KORPUS) TELAH VERIFIED LULUS 100%. MESIN INGEST MATHBANK MAMPUS MEMPROSES 21.245 SOAL DARI 4 KORPUS UTAMA SECARA DETERMINISTIK, CEPAT, DAN AMAN.**

---

## § Catatan Verifikasi

> Wajib menurut `CONSTRAINTS.md` #44 untuk setiap dokumen di `docs/audit/`.

**Diverifikasi ulang: 2026-09-30** terhadap kode & tes nyata:

| Klaim | Hasil verifikasi |
|---|---|
| Semua berkas (`clean.ts`, `queue.ts`, `commit.ts`, `media/`, 3 route `/api/v1/ingest/*`) | ✅ **Ada** di disk |
| 4 adapter (`mathcyber`, `m4thlab`, `defantri`, `pusmendik-tka`, `pusmendik-dayaserap`) | ✅ **Ada** (5 berkas adapter) |
| 77 unit test ingest | ✅ **77 Lulus** (`vitest run src/lib/ingest/`) |
| "18 DB integration tests" | ⚠️ **Koreksi → 22** (`ingest.db.test.ts` 13 + `ingest-api.db.test.ts` 9) |
| "4 korpus" | ⚠️ **Koreksi → 5 sumber** (pusmendik dipecah TKA + DayaSerap) |
| 21.245 soal | ✅ Sesuai hasil ingest M9 (5 sumber) |

**Catatan penting:** DB **produksi** saat ini hanya memuat **16 soal** aktif — data 21.245
hasil M9 tidak berada di DB produksi (di-ingest ke DB uji/kerja terpisah dan tidak
dipertahankan). Angka 21.245 menggambarkan **kapabilitas** mesin ingest, bukan isi prod.

**Sumber bukti:** `npx vitest run src/lib/ingest/` (77 lulus), `pnpm test:db` (22 tes ingest lulus).
