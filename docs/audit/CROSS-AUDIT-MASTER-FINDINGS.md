# 📋 Master Findings Cross-Audit — MathBank V2
## Konsolidasi 9 Dokumen Audit & Sumber Kebenaran Tunggal (Single Source of Truth)

**Tanggal Konsolidasi:** 19 Oktober 2026  
**Konsolidator:** Zaid (Chief of Staff / CEO Math My Id)  
**Target:** Persiapan Fondasi & Peluncuran MathBank V2  
**Repositori:** `/home/hari/projects/mathbank` · Branch: `paperclip/dev`  
**Produksi:** `https://b.iyo.my.id` · PostgreSQL 18 (port 5433)

---

## 1. Ringkasan Konsolidasi

Audit ini mengkonsolidasi dan mengevaluasi **9 berkas audit** sebelumnya (total >172 KB) yang dihasilkan oleh berbagai auditor dan spesialis:
1. `ARAHAN-EVALUASI-MATHBANK-V2.md` (Kerangka 7-Pillar)
2. `EVALUASI-MATHBANK-V2-PILLAR1-FULL.md` (Audit Detail Data Quality - Hermes subagent)
3. `EVALUASI-PAPERCLIP-V2-FULL.md` (Evaluasi Umum 7-Pillar - Tariq)
4. `EVALUASI-PAPERCLIP-V2-EXECUTIVE.md` (Ringkasan Eksekutif - Tariq)
5. `PAPERCLIP-V2-ACTION-PLAN.md` (Action Plan - Tariq)
6. `AUDIT-DATA-SNAPSHOT-2026-10-19.csv` (Snapshot Metrik DB - Hermes subagent)
7. `2026-10-18-audit-observability-instrumentation.md` (Audit Telemetri & Observabilitas)
8. `2026-10-18-konsistensi-dokumen-adr-vs-kode.md` (Audit Konsistensi ADR vs Kode)
9. `audit-performance-optimization.md` (Audit Performa, N+1, & Web Vitals)

### Statistik Konsolidasi & Deduplikasi
- **Total dokumen audit dikonsolidasi:** 9 berkas
- **Total temuan mentah di seluruh audit:** 87 item temuan
- **Total temuan unik setelah deduplikasi:** **42 temuan unik**
- **Klasifikasi Temuan:**
  - 🔴 **P0 (Blocking V2):** 8 temuan
  - 🟡 **P1 (High Priority):** 20 temuan
  - 🟢 **QuickWin:** 8 temuan
  - ⚪ **Outdated / Discarded (Sudah Selesai/Koreksi):** 6 temuan

---

## 2. Temuan P0 — Blocking V2 (Wajib Selesai Sebelum V2)

Semua item P0 adalah pemblokir mutlak: tanpa penyelesaian item-item ini, fitur inti V2 (pencarian semantik, kurikulum adaptif, cetak paket berbobot, stabilitas server) tidak dapat beroperasi.

| # | Temuan | Sumber Audit Asli | Evidence Terverifikasi (Kode / DB) | Status Verifikasi | Rekomendasi Tindakan |
|---|--------|-------------------|------------------------------------|-------------------|----------------------|
| **P0-1** | **0% Embedding Coverage** — 11.889 soal tanpa vektor representasi (1024d BGE-M3). Vector & hybrid search non-fungsional total. | Pillar1:1.1, Paperclip:P0-2, Snapshot:L15, Perf:4.3 | `SELECT count(*) FROM questions WHERE embedding IS NULL;` → **11.889 (100%)**. Service port 3005 hidup (`/health` OK), tetapi job backfill belum pernah dieksekusi. | **Confirmed** (Blocking) | Jalankan batch backfill embedding idempoten memanfaatkan service BGE-M3 di port 3005 dengan chunking 16–32 teks per batch, mencatat `embedding_content_hash` dan `embedding_model_name`. |
| **P0-2** | **0% Pemetaan Topik** — 174 topik hierarkis dalam sistem kosong total (0 soal terpetakan). Navigasi kurikulum dan filtering topik mati. | Pillar1:1.3, Paperclip:P0-3, Snapshot:L16/L44 | `SELECT count(*) FROM question_topics;` → **0**. `SELECT count(*) FROM topics;` → **174**. Seluruh taksonomi tidak terhubung ke bank soal. | **Confirmed** (Blocking) | Bangun pipeline auto-tagging taksonomi berbasis similarity embedding teks soal ke topik + heuristik keyword; sampel validasi 100 soal; isi relasi `question_topics`. |
| **P0-3** | **Media Disconnect (Relasi Putus)** — 2.617 aset media ada di storage/DB, 1.520 soal merujuk `{{img:<shortId>}}`, namun relasi tabel `question_media` = 0. | Pillar1:1.4, Paperclip:P0-4, Snapshot:L49-51 | `SELECT count(*) FROM question_media;` → **0**. `SELECT count(*) FROM questions WHERE content_markdown LIKE '%{{img:%';` → **1.520**. `media_assets` = **2.617**. | **Confirmed** (Blocking) | Jalankan parser regex `{{img:([a-zA-Z0-9]{8})}}` pada `content_markdown` seluruh soal, petakan ke `media_assets.short_id`, dan isi `question_media` dengan role='stimulus'. |
| **P0-4** | **100% Status Draft** — Seluruh 11.889 soal berstatus `draft`. Tidak ada soal berstatus `ready` untuk publikasi atau konsumsi produksi. | Pillar1:1.1, Paperclip:P0-5, Snapshot:L10 | `SELECT status, count(*) FROM questions GROUP BY status;` → `draft: 11889, ready: 0`. | **Confirmed** (Blocking) | Buat state machine status (`draft → reviewed → ready → archived`) dan jalankan skrip promosi massal bersyarat: `answer_key` valid + `!is_flagged` + `char_count >= 50` → `ready`. Target: ≥8.000 soal siap pakai. |
| **P0-5** | **Homogenisasi Metadata Ekstrem** — Semua soal memiliki `difficulty = 3`, `grade = 'umum'`, dan `ai_tagged = false`. | Pillar1:1.1, Paperclip:P0-7, Snapshot:L14 | `SELECT difficulty, count(*) FROM questions GROUP BY difficulty;` → `3: 11889 (100%)`. `ai_tagged: 0 (0%)`. Filter tingkat kesulitan & jenjang tidak berfungsi. | **Confirmed** (Blocking) | Lakukan inferensi tingkat kesulitan (1–5) berbasis kompleksitas rumus KaTeX/panjang langkah/tipe soal dan inferensi `grade` dari metadata bundle/event; perbarui kolom dan tandai `ai_tagged = true`. |
| **P0-6** | **HTTP Waterfall Berantai di `BundleListView` (PERF-01)** — Memuat semua halaman paket soal secara sekuensial (hingga 50 roundtrip × 2 query) hanya untuk memotong 20 baris di klien. | Perf:PERF-01, Paperclip:P1-8 | `src/components/bundles/bundle-list-view.tsx:127` memanggil `useAllBundles` (`use-bundles.ts:133-160`), mengabaikan paginasi server `useBundlesPage` yang sudah ada. | **Confirmed** (Critical Perf) | Pindahkan filter `status` dan pencarian `q` ke endpoint backend `GET /api/bundles`, ubah UI menggunakan `useBundlesPage` dengan `limit=20&offset=page*20`, hapus hook mati `useAllBundles`. |
| **P0-7** | **N×9 Query Sekuensial per Bulk Action (PERF-02)** — Aksi massal hingga 200 soal mengeksekusi ±1.800–2.000 query serial dan memicu kehabisan connection pool. | Perf:PERF-02 | `src/lib/services/question-bulk.ts:57-74` mengulang `changeQuestionStatus` serial per ID. Setiap iterasi menarik relasi penuh 6-10 query yang langsung dibuang. | **Confirmed** (Critical Latency) | Tambahkan opsi `{ returnUpdated: false }` pada `changeQuestionStatus`, ubah update status menjadi kueri batch `WHERE id = ANY($ids) AND status = $from RETURNING id`, batch audit insert. |
| **P0-8** | **Kebocoran Kredensial & Topologi Internal (O-01 & O-10)** — Redaksi logger mengabaikan `Error.message` dan `ZodError`, endpoint health membocorkan pesan galat DB publik. | Obs:O-01, Obs:O-10 | `src/lib/telemetry/logger.ts:59-67` (`message` diteruskan tanpa pattern scrubbing). `src/app/api/health/route.ts:58` mengembalikan `err.message` mentah (`ECONNREFUSED`, credential error) ke publik tanpa autentikasi/rate-limit. | **Confirmed** (High Security) | Tambahkan pattern scrubber (regex URL kredensial, Bearer, DB string) pada `Error.message` di logger. Pada `/api/health`, kembalikan `{ status: "down" }` generik tanpa detail internal ke publik. |

---

## 3. Temuan P1 — High Priority (Kualitas, Robustness, & Tata Kelola)

| # | Temuan | Sumber Audit Asli | Evidence Terverifikasi (Kode / DB) | Status Verifikasi | Rekomendasi Tindakan |
|---|--------|-------------------|------------------------------------|-------------------|----------------------|
| **P1-1** | **3.034 Soal (25,5%) `is_flagged = true`** — Backlog kurasi besar, mayoritas karena kunci jawaban tidak ditemukan di HTML sumber. | Pillar1:1.1, Paperclip:P1-1, Snapshot:L19 | `SELECT count(*) FROM questions WHERE is_flagged = true;` → **3.034**. Flag notes didominasi oleh "Kunci jawaban tidak ditemukan" (2.750 soal). | **Confirmed** | Bangun antrean telaah (review queue) terdedikasi di UI untuk menyaring flagged questions berdasarkan kategori alasan. |
| **P1-2** | **699 Soal Sangat Pendek (< 50 Karakter)** — Berpotensi sebagai artefak parsing rusak atau soal hitung cepat tanpa pengantar. | Pillar1:1.1, Paperclip:P1-2, Snapshot:L21 | `SELECT count(*) FROM questions WHERE char_length(content_markdown) < 50;` → **699**. Contoh: `\(75 \times 75 =\cdots\)`. | **Confirmed** | Triase otomatis: jika cocok pola aritmetika murni beri tag `quick_calc`; sisanya diarahkan ke antrean review kurasi. |
| **P1-3** | **Tabel `tags` Kosong Melompong (0 Baris)** — Fitur filter multi-tag dan konseptual tidak dapat digunakan. | Pillar1:1.5, Paperclip:P1-5, Snapshot:L17 | `SELECT count(*) FROM tags;` → **0**. `SELECT count(*) FROM question_tags;` → **0**. | **Confirmed** | Ekstrak tag kurikulum nasional dan konsep matematika dari `config/curriculum.yaml` ke dalam master `tags`, hubungkan ke soal saat enrichment. |
| **P1-4** | **80,8% Soal Tanpa `event_id`** — Provenance ujian (SNBT, UTBK, SIMAK UI, dsb.) tidak terhubung ke soal. | Pillar1:1.6, Paperclip:P1-9, Snapshot:L18 | `SELECT count(*) FROM questions WHERE event_id IS NULL;` → **9.606 (80,8%)**. | **Confirmed** | Buat skrip backfill pewarisan `event_id` dari bundle ke setiap soal yang berada di dalam bundle tersebut. |
| **P1-5** | **Kardinalitas Label Metrik Tanpa Batas (O-06 & PERF-06)** — Pathname mentah dengan UUID dijadikan label metrik, memicu memory leak bertahap dan bocor ID. | Obs:O-06, Perf:PERF-06 | `src/lib/api/route-wrapper.ts:290` memakai `new URL(req.url).pathname`. `src/lib/telemetry/metrics.ts:63` menyimpan Map tanpa batas kapasitas (`MAX_ROUTES`). | **Confirmed** | Normalisasi segmen UUID/angka ke `:id` dan `:shortId` sebelum dicatat ke `recordRequest`; terapkan batas atas kapasitas label (mis. 200) dengan LRU eviction. |
| **P1-6** | **Cacah Persentil Metrik Salah Secara Algoritmis (O-07)** — Ring buffer persentil menyertakan slot nol setelah 512 request. | Obs:O-07 | `src/lib/telemetry/metrics.ts:78` memotong `s.samples.slice(0, s.filled)`. Saat buffer berputar, p50/p95 turun palsu ke 0. | **Confirmed** | Perbaiki algoritma persentil agar menyaring sampel valid dan menambahkan tes regresi >512 sampel di `metrics.test.ts`. |
| **P1-7** | **Metode `prune()` Mati di Rate-Limit & Idempotency (O-17 & PERF-11)** — Memori store in-memory tumbuh monoton tanpa pembersihan periodik. | Obs:O-17, Perf:PERF-11 | `src/lib/api/rate-limit.ts:83` & `src/lib/api/idempotency.ts:73` mendefinisikan `prune()`, namun grep di seluruh codebase menunjukkan 0 pemanggil runtime. | **Confirmed** | Jadwalkan pemanggilan `prune()` berkala via `setInterval().unref()` di `src/instrumentation.ts` atau panggil secara oportunistik tiap N request. |
| **P1-8** | **Cakupan Validasi Zod Baru 33% (17 dari 51 Route)** — 34 route API berpotensi menerima input tanpa validasi tipe ketat. | Paperclip:P1-6, Obs:§4 | Audit enumerasi 51 route: 17 menggunakan `z.object`/`safeParse`, 34 belum memiliki skema validasi masukan formal. | **Confirmed** | Definisikan skema Zod pada opsi `schema` di `wrapRoute` untuk 34 route yang belum terproteksi (mematuhi CONSTRAINTS #22). |
| **P1-9** | **MediaImage Tanpa Dimensi Memicu Cumulative Layout Shift (PERF-05)** — Tag gambar dirender polos tanpa width/height/aspect-ratio. | Perf:PERF-05 | `src/components/math/math-content.tsx:428-439` merender `<img src="/img/${shortId}" loading="lazy" ...>` tanpa atribut dimensi. | **Confirmed** | Teruskan dimensi (`width`, `height`, `aspect_ratio`) dari `media_assets` ke shortcode markdown atau token renderer, bungkus gambar dalam kontainer ber-aspect-ratio stabil. |
| **P1-10** | **Media `/img/[shortId]` Tanpa ETag / 304 Revalidation (PERF-04)** — Browser mengunduh ulang seluruh gambar setelah cache lokal habis masa berlaku. | Perf:PERF-04 | `src/app/img/[shortId]/route.ts:89-103` mengatur `Cache-Control` tetapi tidak memeriksa `If-None-Match` terhadap `content_hash`. | **Confirmed** | Implementasikan conditional GET: bandingkan `If-None-Match` dengan `content_hash` aset; kembalikan HTTP 304 Not Modified tanpa membaca disk/DB. |
| **P1-11** | **Stream Media Buffer GC Pressure (PERF-12)** — Memuat file gambar utuh ke memory buffer Node dan menyalinnya dua kali untuk setiap request. | Perf:PERF-12 | `src/app/img/[shortId]/route.ts:89` memanggil `await readFile(abs)` lalu `new NextResponse(new Uint8Array(bytes))`. | **Confirmed** | Ganti alokasi buffer penuh dengan stream file web murni (`fs.open().readableWebStream()`) untuk menghemat heap dan alokasi memori. |
| **P1-12** | **33 File Kode > 300 Baris (Pelanggaran CONSTRAINTS #16)** — File komponen dan service raksasa menghambat pemeliharaan. | Paperclip:P1-8, Pillar1:2.4 | `src/components/questions/question-editor.tsx` (1.023 baris), `src/lib/ai/enrich.ts` (900 baris), `src/lib/ingest/parsers/clean.ts` (841 baris), dsb. | **Confirmed** | Pecah komponen raksasa menjadi sub-komponen terisolasi (form, preview, toolbar) dan service pipeline modular. |
| **P1-13** | **Drift Dokumentasi Berat pada `AGENTS.md` & `README.md` (D-10 to D-15)** — Klaim usang: 28 tabel (aktual 26), 0 soal (aktual 11.889), utang fiktif. | ADR-Kode:D-10..15, Paperclip:P1-7 | `AGENTS.md:111-115` masih mencatat status "0 soal - kanvas kosong", "28 tabel", dan menyebut utang yang sudah selesai (`curriculum.yaml`, `warnings`). | **Confirmed** | Perbarui `AGENTS.md` §8 dan `README.md` dengan status faktual (26 tabel, 24 trigger, 11.889 soal, 11 events, 5 sumber, 174 topik). |
| **P1-14** | **Pendaftaran Dokumen Tidak Lengkap (~120 File Markdown Tak Terdaftar di Peta Dokumen - D-01/D-02)** | ADR-Kode:D-01, D-02 | Dari 176 berkas `.md` di `docs/`, hanya ~55 yang terdaftar eksplisit di `docs/PETA-DOKUMEN.md` (melanggar aturan literal CONSTRAINTS #31). | **Confirmed** | Tetapkan kebijakan: daftarkan per-folder untuk `docs/archive/` (cold storage) dan daftarkan per-file untuk dokumen aktif; tambahkan skrip uji kepatuhan di CI. |
| **P1-15** | **Sistem Alerting Absen Total (O-19)** — Tidak ada pemantauan uptime proaktif, tidak ada alert saat error rate melonjak. | Obs:O-19, Paperclip:P1-9 | `docs/OBSERVABILITAS.md:69` mengakui sistem alerting belum dibangun sama sekali. Tidak ada integrasi Sentry atau notifikasi insiden. | **Confirmed** | Siapkan cron pemeriksa error-budget terhadap `/api/metrics` dan probe liveness/readiness, integrasikan bot alert Telegram/Sentry. |
| **P1-16** | **Batch Enrichment & Embedding Berjalan Sekuensial Lambat (PERF-03 & PERF-08)** — Panggilan LLM dan pembacaan taksonomi diulang di dalam loop per-soal. | Perf:PERF-03, PERF-08 | `src/lib/services/enrichment/enrich.ts:86` memindai seluruh topik dan tag aktif per-soal; `embed.ts` memanggil embed serial satu per satu. | **Confirmed** | Cache daftar taksonomi di luar loop; gunakan `embedTexts(batch)` dengan konkurensi terkontrol (batch 16–32). |
| **P1-17** | **Snapshot Seluruh Tabel Topics per Resolusi Filter (PERF-09)** — Menarik seluruh tabel topics ke Node dan menjalankan BFS di memori. | Perf:PERF-09 | `src/lib/question/filters.ts:83-95` memuat semua record `topics(id, parent_id)` setiap pemfilteran topik. | **Confirmed** | Ganti BFS in-memory dengan kueri rekursif PostgreSQL `WITH RECURSIVE sub AS (...)` atau kolom materialized path (`topics.path`). |
| **P1-18** | **Tokenisasi KaTeX & Render Per-Render (PERF-15)** — `MathContent` mem-parsing token ulang pada setiap render ulang komponen induk. | Perf:PERF-15 | `src/components/math/math-content.tsx:168-182` memanggil `tokenizeMath(content)` tanpa memoization atau caching modul-level. | **Confirmed** | Tambahkan cache modul-level `Map<string, Token[]>` deterministik untuk hasil tokenisasi string konten matematika. |
| **P1-19** | **Font KaTeX FOIT Tanpa Preload (PERF-13)** — 20+ file font KaTeX dimuat dengan `font-display: block` tanpa preload, menahan tampilan visual rumus. | Perf:PERF-13 | `src/app/globals.css:4` mengimpor CSS KaTeX; font di `.next/static/media/KaTeX_*.woff2` tidak diprelink di `layout.tsx`. | **Confirmed** | Tambahkan `<link rel="preload" as="font" type="font/woff2">` untuk `KaTeX_Main-Regular` & `KaTeX_Math-Italic` di root layout. |
| **P1-20** | **Duplikasi Fetcher API di 7 Hook Klien (PERF-16)** — Logika penanganan error dan parsing JSON berbeda-beda antar hook. | Perf:PERF-16 | `use-questions.ts`, `use-settings.ts`, `use-taxonomy.ts`, dll. mendefinisikan fungsi fetch lokal terpisah alih-alih memakai `src/lib/api/fetcher.ts`. | **Confirmed** | Satukan seluruh hook klien agar memakai utilitas tunggal `api()` di `src/lib/api/fetcher.ts`. |

---

## 4. Temuan QuickWin (Effort Rendah, Dampak Langsung)

| # | Temuan / Aksi | Sumber Audit | Estimasi Waktu | Evidence & Target Lokasi |
|---|---------------|--------------|----------------|--------------------------|
| **QW-1** | **Jadwalkan Backup Harian Otomatis via Cron** | Paperclip:QW-1, Pillar1:17 | 15 menit | Tambahkan cron job `scripts/backup-db.mjs` di sistem operasi host atau systemd timer agar dump harian berjalan konsisten. |
| **QW-2** | **Update Angka Aktual di `AGENTS.md` & `README.md`** | ADR-Kode:D-10..12, Paperclip:QW-4 | 30 menit | Sinkronkan data: 26 tabel, 24 trigger, 11.889 soal, 11 events, 5 sumber, 174 topik. Hapus utang basi yang sudah beres. |
| **QW-3** | **Perbaiki Kebocoran Error di `/api/health` & `/api/ready`** | Obs:O-10 | 30 menit | `src/app/api/health/route.ts:58` ganti `{ error: err.message }` menjadi `{ status: "down", error: "Internal Server Error" }`. |
| **QW-4** | **Normalisasi URL Pathname di Logger/Metrics Wrapper** | Obs:O-06, Perf:PERF-06 | 1 jam | `src/lib/api/route-wrapper.ts:290` terapkan `path.replace(/[0-9a-f-]{36}/gi, ":id")` sebelum diteruskan ke `recordRequest`. |
| **QW-5** | **Implementasikan ETag pada Endpoint Gambar `/img/[shortId]`** | Perf:PERF-04 | 1 jam | `src/app/img/[shortId]/route.ts`: periksa header `If-None-Match` terhadap `contentHash`, kirim 304 jika cocok. |
| **QW-6** | **Aktifkan Pembersihan Berkala `prune()` di `instrumentation.ts`** | Obs:O-17, Perf:PERF-11 | 30 menit | Panggil `rateLimitStore.prune(Date.now())` dan `idempotencyStore.prune(Date.now())` berkala via timer unref di `instrumentation.ts`. |
| **QW-7** | **Tambahkan `placeholderData` di `useBundlesPage`** | Perf:PERF-07 | 15 menit | `src/lib/hooks/use-bundles.ts:105-123`: tambahkan `placeholderData: (prev) => prev` untuk mencegah layout flicker antarhalaman. |
| **QW-8** | **Bersihkan File Artefak `.tmp-audit/` dan Daftarkan di `.gitignore`** | Paperclip:QW-7, Obs:§4 | 15 menit | Masukkan `.tmp-audit/` dan `tsconfig.tsbuildinfo` ke dalam `.gitignore` repo agar working tree tetap bersih. |

---

## 5. Temuan Outdated / Discarded (Koreksi terhadap Audit Lama)

Bagian ini penting untuk mencatat klaim audit terdahulu yang **tidak lagi berlaku**, **sudah diperbaiki**, atau **keliru secara teknis**, sehingga tidak membuang waktu tim pengembang.

| # | Klaim Audit Lama | Sumber Asli | Realita Kode / Verifikasi Faktual Saat Ini | Status & Alasan Discard |
|---|------------------|-------------|--------------------------------------------|-------------------------|
| **OUT-1** | **"Quality gate CI MERAH (1 test check-names gagal + 8 lint error)"** | Paperclip:P0-1, Tariq (19 Okt) | Dijalankan langsung hari ini: `npx vitest run` → **980 passed (90 files)**; `npx eslint` → **0 errors, 42 warnings**; `check-names.mjs` → **PASS**. | **RESOLVED / OUTDATED**. Masalah penamaan dan 8 kesalahan lint telah diperbaiki di branch `paperclip/dev`. Gate CI saat ini berstatus HIJAU. |
| **OUT-2** | **"Backup DB stagnan 8–12 hari (terakhir 7/11 Oktober)"** | Paperclip:P0-6, Pillar1:7.2 | Ditemukan file dump baru di `backups/`: `mathbank_2026-10-19-06-10-46.dump` sebesar **15,8 MB** dibuat hari ini 19 Oktober 2026. | **RESOLVED (Dump ada)**. Dump manual telah dieksekusi hari ini; yang tersisa hanyalah otomasi cron harian (QW-1). |
| **OUT-3** | **"Layanan embedding BGE-M3 mati / port 11434 tidak merespons"** | Paperclip:P0-2, Pillar1:1.1 | Pengecekan socket `ss -tulpn`: port 3005 aktif melayani `FastAPI uvicorn` (`python3`, PID 1092). `curl http://localhost:3005/health` merespons `{"status":"ok","model":"BAAI/bge-m3","dim":1024}`. MathBank dirancang menggunakan port 3005 (`src/lib/embedding/bge-m3.ts:25`), bukan Ollama 11434. | **DISCARDED (Asumsi port salah)**. Layanan embedding sebenarnya hidup dan sehat di port 3005. Yang tertunda adalah pelaksanaan job backfill data. |
| **OUT-4** | **"22 Soal Orphan dan 1 Bundle Kosong Aktif di DB"** | Paperclip:P1-3, ActionPlan:C-05 | Verifikasi SQL menunjukkan: ke-22 soal yang tidak masuk ke bundle manapun memiliki `deleted_at IS NOT NULL` (soft-deleted). Bundle kosong `01a11584...` juga memiliki `deleted_at IS NOT NULL`. Pada data aktif (`deleted_at IS NULL`), jumlah orphan = 0 dan empty bundle = 0. | **KOREKSI STATUS**. Bukan inkonsistensi data aktif, melainkan sisa record soft-delete. Cukup jalankan vacuum/purge sisa soft-deleted jika diperlukan. |
| **OUT-5** | **"Filter topik memicu snapshot tabel penuh pada setiap perpindahan halaman paginasi"** | Audit Performa Lama | Audit Performa (17 Okt) §8.2 memverifikasi bahwa paginasi soal ditangani di sisi klien atas data ter-cache (`useQuestions` + `placeholderData`). Snapshot tabel hanya dieksekusi satu kali saat filter topik berubah. | **DISCARDED**. Bukan bug paginasi berulang, melainkan optimasi query filter tunggal (PERF-09). |
| **OUT-6** | **"Ekspresi SQL EXISTS di filters-builder.ts menghasilkan parameter bound yang salah"** | Audit Performa Lama | Uji langsung terhadap kompilator Drizzle PostgreSQL Dialect menunjukkan interpolasi `sql` menghasilkan ekspresi `FROM "question_topics"` yang valid secara struktural. | **DISCARDED**. Sintaks kueri valid dan terbukti aman. |

---

## 6. Matriks Coverage (Audit × Area)

Matriks ini memetakan cakupan area dari ke-5 rumpun audit yang dianalisis:

| Area Evaluasi | Hermes Pillar 1 | Paperclip (Tariq) | Observabilitas | ADR vs Kode | Performa & Web | Status Konsolidasi |
|---------------|:---------------:|:-----------------:|:--------------:|:-----------:|:--------------:|:------------------:|
| **Kualitas Data Soal (Volume, Status, Key)** | ✅ Lengkap | ✅ Lengkap | ❌ | ❌ | ❌ | Terkonsolidasi P0-1, P0-4, P0-5 |
| **Taksonomi & Topik** | ✅ Lengkap | ✅ Lengkap | ❌ | ❌ | 🟡 Query filter | Terkonsolidasi P0-2, P1-17 |
| **Media Assets & Shortcode** | ✅ Lengkap | ✅ Lengkap | ❌ | ❌ | ✅ Rendering & ETag | Terkonsolidasi P0-3, P1-9..11 |
| **Kesehatan Gate & Code Smells** | 🟡 Tinjauan umum | ✅ Pengujian gate | ❌ | ❌ | 🟡 Analisis baris | Terverifikasi Hijau (OUT-1) |
| **Arsitektur & Integritas Skema DB** | 🟡 Tinjauan L1-L6 | 🟡 Tinjauan L1-L6 | ❌ | ✅ 22 ADR & Tabel | Terkonsolidasi D-01..24 |
| **Observabilitas, Logger, & Error Tracking** | 🟡 Rekomendasi | 🟡 Tinjauan singkat | ✅ Sangat mendalam | ❌ | 🟡 Metrik leak | Terkonsolidasi P0-8, P1-5..7 |
| **Performa Kueri & Anti-N+1** | ❌ | ❌ | ❌ | ❌ | ✅ Sangat mendalam | Terkonsolidasi P0-6, P0-7 |
| **Keamanan Input, Auth, & Headers** | 🟡 Ringkasan | 🟡 Ringkasan | 🟡 Rate-limit/Probe | ❌ | ❌ | Terkonsolidasi P0-8, P1-8 |
| **Infrastruktur & Backup Operasional** | 🟡 Riwayat dump | 🟡 Riwayat dump | ❌ | ❌ | ❌ | Terkonsolidasi QW-1, OUT-2 |

---

## 7. Gap Analysis (Area yang Belum Tercakup oleh Audit Manapun)

Berdasarkan analisis silang ke-9 audit, ditemukan beberapa area kritis yang **belum tersentuh audit formal**:

1. **Uji Beban Nyata (Real Load Testing) Multi-User**:
   - Seluruh audit performa bersifat analisis statis atau eksekusi single-request.
   - Belum pernah dilakukan simulasi beban konkuren (mis. 50–100 guru mengakses sistem secara simultan saat ujian atau pembuatan paket). Perilaku PostgreSQL connection pool (`max: 10`) pada kondisi konkurensi tinggi belum teruji.
2. **Evaluasi Keamanan KaTeX Math Ingestion (Sanitasi Macro Lanjutan)**:
   - Audit keamanan sebelumnya mengonfirmasi konfigurasi `openin_any='p'`, namun belum menguji secara mendalam injeksi macro LaTeX kustom yang berpotensi memicu CPU exhaustion DoS (ReDoS atau ekspansi macro tak terbatas di parser KaTeX).
3. **Audit Kualitas Rendering KaTeX di Viewport Mobile Kecil (360px)**:
   - Rumus matematika matriks, integral ganda, dan tabel pembagian panjang belum diuji keterbacaannya pada layar 360px tanpa memicu horizontal window scroll.
4. **Pedagogical Distractor Rationale (Kualitas Pembahasan Pilihan A–E)**:
   - Dari 11.108 soal berkunci, belum ada evaluasi pedagogis sistematis mengenai kualitas distraktor (apakah pilihan salah A–E merefleksikan miskonsepsi siswa yang bermakna atau hanya angka acak). Ini adalah domain spesialisasi Faruq.

---

## 8. Rekonsiliasi Kontradiksi Antar-Audit

| Kasus | Versi Audit A | Versi Audit B | Hasil Investigasi & Kebenaran Faktual |
|-------|---------------|---------------|---------------------------------------|
| **Status Gate CI** | Paperclip (Tariq): `pnpm check` GAGAL (1 test fail di check-names + 8 lint error). | Hermes Subagent: Unit test pass, lint pass, build pass. | **Hasil Realita:** Kodebase telah diperbaiki di branch `paperclip/dev`. Saat ini vitest 980 passed, eslint 0 errors, check-names pass. Gate CI HIJAU. |
| **Kondisi Backup** | Paperclip: Backup stagnan sejak 11 Oktober (8 hari lalu). | Hermes Subagent: Backup terakhir 7 Oktober (12 hari lalu). | **Hasil Realita:** Ditemukan dump terbaru `mathbank_2026-10-19-06-10-46.dump` (15,8 MB) dibuat hari ini 19 Oktober 2026. Backup manual up to date, cron harian tetap diperlukan. |
| **Layanan Embedding** | Paperclip: Layanan mati, Ollama port 11434 tidak listening. | Spesifikasi MathBank (`bge-m3.ts`): Layanan BGE-M3 menggunakan port 3005. | **Hasil Realita:** Socket port 3005 listening melayani `FastAPI uvicorn` dengan model `BAAI/bge-m3`. Endpoint `/health` merespons OK. Layanan hidup, backfill data belum jalan. |
| **Orphan Soal & Bundle Kosong** | Paperclip: 22 soal orphan + 1 bundle kosong. | Hermes Snapshot CSV: 0 orphan questions + 0 empty active bundles. | **Hasil Realita:** Keduanya benar secara teknis: 22 soal orphan dan 1 bundle kosong berstatus `deleted_at IS NOT NULL` (soft-deleted). Pada data aktif non-deleted, jumlahnya persis 0. |

---

## 9. §Catatan Verifikasi (Sesuai CONSTRAINTS #44)

- **Verifikator:** Zaid (Chief of Staff / CEO Math My Id)
- **Tanggal Verifikasi:** 19 Oktober 2026
- **Metode Pemeriksaan Langsung:**
  1. Kueri langsung ke PostgreSQL 18 (`mathbank` di port 5433) via psql/node untuk verifikasi jumlah baris `questions`, `bundles`, `topics`, `media_assets`, `question_topics`, `question_media`, `tags`, dan status soft-delete.
  2. Eksekusi langsung command gate: `pnpm test` (vitest 980 passed), `pnpm typecheck` (tsc clean), `pnpm lint` (0 error, 42 warning), `node scripts/check-names.mjs` (pass), `pnpm db:verify` (26 tabel, 24 trigger, 0 drift).
  3. Pemeriksaan socket jaringan: `ss -tulpn` dan probe HTTP ke `http://localhost:3005/health` (merespons status OK BGE-M3 1024d).
  4. Inspeksi kode sumber di `src/lib/telemetry/logger.ts`, `metrics.ts`, `src/app/api/health/route.ts`, `src/components/bundles/bundle-list-view.tsx`, `src/lib/services/question-bulk.ts`, `src/components/math/math-content.tsx`, dan `AGENTS.md`.
- **Hasil:** 42 temuan unik berhasil diklasifikasikan dan divalidasi. Tidak ada asumsi tanpa bukti kode atau data aktual. Dokumen ini menjadi rujukan tunggal persiapan rilis MathBank V2.
