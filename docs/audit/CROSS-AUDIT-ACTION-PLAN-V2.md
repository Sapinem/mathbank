# 🗺️ Action Plan Terkonsolidasi — MathBank V2
## Rencana Aksi Sprint Menuju Kesiapan Rilis Produksi V2

**Tanggal Penyusunan:** 19 Oktober 2026  
**Penanggung Jawab Program:** Zaid (Chief of Staff / CEO Math My Id)  
**Basis Konsolidasi:** Master Findings dari 9 Berkas Audit Teknis  
**Repositori:** `/home/hari/projects/mathbank` · Branch: `paperclip/dev`  
**Legenda Prioritas:** 🔴 **P0 (Blocking V2)** · 🟡 **P1 (High Priority)** · 🟢 **QuickWin**

---

## 1. Ikhtisar Alur Kerja & Ketergantungan (Dependency Graph)

Rencana aksi dirancang untuk menghindari bottleneck dan konflik berkas antar-spesialis:

```
[SPRINT 0: Stabilisasi & Performa]
  A-01 Otomasi Backup Cron (Salman) ───────────────────────────────────► [Semua Sprint Aman]
  A-02 Redaksi Logger & Patch Health Leak (Salman) ────────────────────► [Keamanan Terjaga]
  A-03 Normalisasi Label Metrik & Prune In-Memory (Salman)
  A-04 Eliminasi Waterfall BundleListView (Ichsan) ────────────────────► [UI /bundles Cepat]
  A-05 Optimasi Bulk CAS Update (Salman)
  A-06 Sinkronisasi AGENTS.md & Peta Dokumen (Bilal)

[SPRINT 1: Data Enrichment & Linking] (Blocked by Sprint 0)
  B-01 Batch Backfill Embedding BGE-M3 (Salman) ───────────────────────► B-03 Classifier Topik
  B-02 Parser & Backfill question_media (Salman) ──────────────────────► C-05 MediaImage CLS Fix
  B-03 Backfill question_topics & Master Tags (Salman + Faruq) ────────► C-01 Promosi Ready
  B-04 Pewarisan event_id ke Soal (Salman)

[SPRINT 2: Kualitas Soal & Refactor UI] (Blocked by Sprint 1)
  C-01 Kebijakan & Promosi Massal draft → ready (Salman + Faruq) ─────► [V2 Ready Corpus]
  C-02 Triase 3.034 Flagged & 699 Soal Pendek (Faruq)
  C-03 Inferensi Difficulty 1–5 & Grade (Faruq + Salman)
  C-04 Pecah question-editor.tsx & File Raksasa (Ichsan)
  C-05 MediaImage Aspect Ratio & ETag/304 (Ichsan + Salman)

[SPRINT 3: Validasi, Caching, & Rilis] (Blocked by Sprint 2)
  D-01 Zod Schema pada 34 Route API (Salman)
  D-02 Cache Modul Tokenisasi KaTeX & Font Preload (Ichsan)
  D-03 Konsolidasi Fetcher Klien & PlaceholderData (Ichsan)
  D-04 Alerting Sinyal & End-to-End Audit Sign-Off (Zaid) ─────────────► [V2 RELEASE PRODUCTION]
```

---

## 2. SPRINT 0 — Stabilisasi, Quick Wins, & Performa Kritis (Minggu 1)

> **Tujuan:** Menghilangkan celah keamanan/kebocoran data, mengamankan cadangan data otomatis, dan membereskan 2 bottleneck performa utama sebelum proses backfill masif dimulai.

| # | Aksi Rinci | Prioritas | Estimasi | Ketergantungan | Rekomendasi Assignee | Definition of Done (DoD) |
|---|------------|:---------:|:--------:|:--------------:|:--------------------:|--------------------------|
| **ACT-01** | **Jadwalkan Backup Harian Otomatis**<br>Pasang cron job / systemd timer untuk menjalankan `scripts/backup-db.mjs` setiap pukul 02.00 WIB dengan retensi 7 hari lokal dan 30 hari arsip. | 🟢 QuickWin | 2 jam | Tidak ada | **Salman** (Backend) | Cron aktif di host; log rotasi cadangan terkonfirmasi; file dump terbuat otomatis. |
| **ACT-02** | **Scrubbing Pesan Error Logger (O-01) & Health Probe Leak (O-10)**<br>- `src/lib/telemetry/logger.ts`: tambahkan pattern scrubber (regex URL, password, token) pada `Error.message` dan `ZodError`.<br>- `src/app/api/health/route.ts`: hapus kembalian `err.message` mentah ke publik; kembalikan pesan generik. | 🔴 P0 | 4 jam | Tidak ada | **Salman** (Backend) | Unit test `logger.test.ts` memverifikasi secret dalam Error teredaksi; `/api/health` merespons 503 tanpa pesan DB saat DB mati. |
| **ACT-03** | **Normalisasi Label Metrik (O-06) & Jadwal `prune()` (O-17)**<br>- `src/lib/api/route-wrapper.ts`: normalisasi UUID/ID dinamis menjadi `:id` sebelum `recordRequest`.<br>- Terapkan batas `MAX_ROUTES = 200` pada `metrics.ts`.<br>- Jadwalkan `rateLimit.prune()` dan `idempotency.prune()` di `instrumentation.ts`. | 🔴 P0 | 4 jam | Tidak ada | **Salman** (Backend) | 100 request dengan UUID berbeda hanya menghasilkan 1 key label di `/api/metrics`; memory store tidak bocor. |
| **ACT-04** | **Eliminasi HTTP Waterfall di `BundleListView` (PERF-01)**<br>- Pindahkan parameter `status` dan `q` ke backend `GET /api/bundles`.<br>- Ubah `BundleListView` memakai `useBundlesPage` (`limit=20&offset=page*20`).<br>- Hapus hook mati `useAllBundles`. | 🔴 P0 | 1 hari | Tidak ada | **Ichsan** (Frontend) | Halaman `/bundles` hanya melakukan 1 request HTTP (20 item); tidak ada loop sekuensial; `useAllBundles` dihapus. |
| **ACT-05** | **Optimasi Kueri Massal Update Status Soal (PERF-02)**<br>- Tambahkan opsi `{ returnUpdated: false }` pada `changeQuestionStatus`.<br>- Ganti loop serial di `bulkQuestionAction` dengan kueri set PostgreSQL: `UPDATE questions ... WHERE id = ANY($ids) RETURNING id`. | 🔴 P0 | 1 hari | Tidak ada | **Salman** (Backend) | Aksi massal 200 soal selesai dalam <300 ms dengan ≤3 kueri DB (bukan 1.800 kueri). |
| **ACT-06** | **Sinkronisasi Dokumentasi Inti (`AGENTS.md`, `README.md`, Peta Dokumen)**<br>Perbarui status faktual proyek: 26 tabel, 24 trigger, 11.889 soal, 11 event, 5 sumber, 174 topik. Hapus utang basi yang sudah selesai. | 🟢 QuickWin | 2 jam | Tidak ada | **Bilal** (Docs) | Angka di `AGENTS.md` §8 dan `README.md` cocok 100% dengan hasil `pnpm db:verify` dan query DB nyata. |

**Quality Gate Sprint 0:** Zero leak pada logger/health + `/bundles` paginasi server + dump DB otomatis terverifikasi.

---

## 3. SPRINT 1 — Data Enrichment & Linking Inti (Minggu 2)

> **Tujuan:** Menghidupkan lapisan data mati. Menghubungkan seluruh 11.889 soal ke embedding BGE-M3, taksonomi topik, dan aset gambar.

| # | Aksi Rinci | Prioritas | Estimasi | Ketergantungan | Rekomendasi Assignee | Definition of Done (DoD) |
|---|------------|:---------:|:--------:|:--------------:|:--------------------:|--------------------------|
| **ACT-07** | **Batch Backfill Embedding BGE-M3 11.889 Soal (P0-1)**<br>Jalankan skrip worker idempoten yang memanggil endpoint `http://localhost:3005/v1/embeddings` secara batch (16–32 soal per batch), simpan vektor 1024d, catat `embedding_content_hash`, dan lewati baris yang sudah terisi. | 🔴 P0 | 2 hari | ACT-01 | **Salman** (Backend) | `SELECT count(*) FROM questions WHERE embedding IS NOT NULL;` mencapai **≥ 11.850 (≥99,5%)**; query HNSW aktif. |
| **ACT-08** | **Penyambungan Relasi Media `question_media` (P0-3)**<br>Ekstrak shortId dari markdown soal (`{{img:<shortId>}}`), cari kecocokan di `media_assets.short_id`, dan buat baris di tabel `question_media(question_id, media_id, role='stimulus')`. | 🔴 P0 | 4 jam | Tidak ada | **Salman** (Backend) | `SELECT count(*) FROM question_media;` mencapai **≥ 1.500 baris**; log shortId yang tidak ditemukan tercatat rapi. |
| **ACT-09** | **Klasifikasi & Pemetaan Taksonomi Topik (P0-2)**<br>Gunakan kemiripan cosine similarity antara embedding soal dengan representasi teks 174 topik (ditambah aturan kata kunci kurikulum) untuk memetakan soal ke `question_topics`. | 🔴 P0 | 3 hari | ACT-07 | **Salman** (Backend) + **Faruq** (Pedagogy) | Minimal 95% soal memiliki ≥1 topik; 174 topik memiliki soal; sampel 100 soal diaudit manual oleh Faruq dengan akurasi ≥90%. |
| **ACT-10** | **Inisialisasi Master Tags dari Kurikulum (P1-3)**<br>Ekstrak konsep inti matematika dari `config/curriculum.yaml` ke tabel `tags`. Tautkan tag yang relevan ke soal saat proses klasifikasi topik. | 🟡 P1 | 1 hari | ACT-09 | **Salman** (Backend) | Minimal 50 master tags tersimpan di tabel `tags` dan terhubung ke tabel `question_tags`. |
| **ACT-11** | **Backfill Pewarisan `event_id` ke Soal (P1-4)**<br>Bagi soal yang belum memiliki `event_id`, wariskan `event_id` dari paket induk (`bundles.event_id` / metadata sumber) tempat soal tersebut berada. | 🟡 P1 | 1 hari | Tidak ada | **Salman** (Backend) | Cakupan soal ber-`event_id` meningkat dari 19,2% menjadi ≥85%. |

**Quality Gate Sprint 1:** Dashboard kualitas data menunjukkan Embedding ≥99%, Topik ≥95%, dan Media ≥1.500 tautan.

---

## 4. SPRINT 2 — Kualitas Data, Kurasi Soal, & Refactor UI (Minggu 3)

> **Tujuan:** Mengubah korpus dari status "draft mentah" menjadi "soal siap pakai", menangani backlog flagged questions, dan merapikan komponen frontend yang melanggar batas arsitektur.

| # | Aksi Rinci | Prioritas | Estimasi | Ketergantungan | Rekomendasi Assignee | Definition of Done (DoD) |
|---|------------|:---------:|:--------:|:--------------:|:--------------------:|--------------------------|
| **ACT-12** | **Aturan & Promosi Massal `draft → ready` (P0-4)**<br>Buat prosedur promosi otomatis berbasis syarat ketat: kunci jawaban valid (`correct` / `explanation` ada) + `!is_flagged` + `char_length >= 50` + lolos linter KaTeX. Catat log perubahan status di `audit_logs`. | 🔴 P0 | 2 hari | ACT-07, ACT-09 | **Salman** (Backend) + **Faruq** (Review) | Minimal 8.000 soal berhasil dipromosikan ke status `ready`; transisi tercatat di audit trail. |
| **ACT-13** | **Triase & Segmentasi 3.034 Flagged Questions (P1-1)**<br>Kelompokkan alasan flag pada `flag_notes`: kunci hilang (2.750), format tabel/grid (22), tanpa stimulus (200+). Buat filter antrean telaah di UI editor agar penelaah dapat mengurasi per kategori. | 🟡 P1 | 2 hari | ACT-12 | **Faruq** (Pedagogy) | Flagged questions tersegmentasi berdasarkan kategori solusi; backlog telaah terstruktur. |
| **ACT-14** | **Triase 699 Soal Sangat Pendek (P1-2)**<br>Jalankan skrip filter: soal hitung cepat valid (aritmetika murni) diberi tag `quick_calc` dan dipromosikan; soal yang terpotong/rusak ditandai untuk kurasi ulang. | 🟡 P1 | 1 hari | ACT-12 | **Faruq** (Pedagogy) | Seluruh 699 soal pendek telah terklasifikasi (tidak ada yang mengambang tanpa penanda). |
| **ACT-15** | **Inferensi Variasi Difficulty (1–5) & Grade (P0-5)**<br>Implementasikan heuristik terstruktur (panjang ekspresi matematika, kedalaman rumus KaTeX, tipe soal) untuk membagi tingkat kesulitan dari angka seragam 3 menjadi sebaran normal 1–5. Isi jenjang kelas dari metadata bundle/kurikulum. | 🔴 P0 | 2 hari | ACT-09 | **Faruq** (Pedagogy) + **Salman** (Backend) | Kolom `difficulty` terdistribusi (Level 1–5); kolom `grade` terisi sesuai jenjang SD/SMP/SMA; `ai_tagged = true`. |
| **ACT-16** | **Pecah File Raksasa `question-editor.tsx` (P1-12)**<br>Pecah file 1.023 baris menjadi komponen terpisah: `QuestionEditorForm`, `QuestionEditorPreview`, `QuestionEditorToolbar`, dan `QuestionTypeFields` (mematuhi CONSTRAINTS #16: <300 baris). | 🟡 P1 | 2 hari | Tidak ada | **Ichsan** (Frontend) | `question-editor.tsx` dan modul turunannya masing-masing berukuran <300 baris; seluruh fungsi editor tetap lulus uji interaksi. |
| **ACT-17** | **Pencegahan CLS Gambar `MediaImage` & ETag 304 (P1-9, P1-10)**<br>- `src/components/math/math-content.tsx`: teruskan dimensi gambar ke kontainer `aspectRatio`.<br>- `src/app/img/[shortId]/route.ts`: tambahkan pengecekan ETag `If-None-Match` terhadap `contentHash`. | 🟡 P1 | 1 hari | ACT-08 | **Ichsan** (Frontend) + **Salman** (Backend) | Tidak ada layout shift (CLS = 0) saat gambar termuat; request berulang menghasilkan HTTP 304 Not Modified. |

**Quality Gate Sprint 2:** Minimal 8.000 soal berstatus `ready` + 0 file editor >300 baris + CLS stabil.

---

## 5. SPRINT 3 — Pengerasan Keamanan, Caching, & Validasi Rilis V2 (Minggu 4)

> **Tujuan:** Pengerasan menyeluruh (kontrak API, caching tingkat lanjut, observabilitas) dan pelaksanaan simulasi audit pra-rilis.

| # | Aksi Rinci | Prioritas | Estimasi | Ketergantungan | Rekomendasi Assignee | Definition of Done (DoD) |
|---|------------|:---------:|:--------:|:--------------:|:--------------------:|--------------------------|
| **ACT-18** | **Penerapan Skema Zod pada 34 Route API Tersisa (P1-8)**<br>Tambahkan definisi skema Zod pada parameter `schema` di `wrapRoute` untuk seluruh endpoint yang saat ini belum memvalidasi payload masukan (mematuhi CONSTRAINTS #22). | 🟡 P1 | 2 hari | Tidak ada | **Salman** (Backend) | 51 dari 51 route API terdaftar memiliki kontrak Zod valid; request dengan payload salah ditolak dengan error 400 terstandar. |
| **ACT-19** | **Cache Modul Tokenisasi KaTeX & Preload Font (P1-18, P1-19)**<br>- Tambahkan cache modul-level `Map<string, Token[]>` pada `tokenizeMath` di `math-content.tsx`.<br>- Tambahkan `<link rel="preload">` untuk font KaTeX utama di `src/app/layout.tsx`. | 🟡 P1 | 1 hari | Tidak ada | **Ichsan** (Frontend) | Parsing token tidak berulang saat kartu soal di-re-render; teks rumus muncul seketika tanpa font-flicker (FOIT). |
| **ACT-20** | **Satukan Utilitas Fetcher Klien & PlaceholderData (P1-20, QW-7)**<br>Ganti pemanggilan fetch kustom di 7 hook (`use-questions`, `use-settings`, dsb.) dengan utilitas tunggal `api()` di `src/lib/api/fetcher.ts`; pastikan `placeholderData` terpasang di semua query paginasi. | 🟡 P1 | 1 hari | Tidak ada | **Ichsan** (Frontend) | Standarisasi pesan error HTTP di seluruh UI klien; perpindahan halaman tabel mulus tanpa layar berkedip kosong. |
| **ACT-21** | **Setup Sistem Pemantauan Sinyal & Alerting Minimal (P1-15)**<br>Buat script pengawas error-budget yang memeriksa rasio kesalahan pada `/api/metrics` secara periodik via cron/systemd dan mengirim notifikasi jika error rate >1% atau server down. | 🟡 P1 | 1 hari | ACT-03 | **Salman** (Backend) | Alert terkirim otomatis saat disimulasikan galat beruntun. |
| **ACT-22** | **End-to-End Mechanical Audit & CEO Sign-Off**<br>Lakukan pengujian mekanis penuh sesuai `SKILL_ORCHESTRATOR.md`: verifikasi multi-viewport (360px, 768px, 1280px), DOM KaTeX counter, kueri database connection pool leak, dan validasi fungsional menyeluruh. | 🔴 P0 | 1 hari | Semua ACT | **Zaid** (CEO / Lead) | Seluruh 5 poin quality gate terpenuhi; laporan sign-off resmi V2 diterbitkan. |

**Quality Gate Sprint 3:** 51/51 route Zod valid + p95 API ≤ 300 ms + sign-off CEO resmi PASS.

---

## 6. Backlog Berkelanjutan (P2 — Pasca Peluncuran V2)

Item-item berikut bernilai positif tetapi tidak memblokir peluncuran V2 dan dijadwalkan setelah V2 beroperasi stabil:

| # | Inisiatif | Estimasi Effort | Penanggung Jawab | Catatan Strategis |
|---|-----------|:---------------:|:----------------:|-------------------|
| **P2-01** | **Migrasi Data Historis qbank (ETL)** | 2 Sprint | Salman | Migrasi 84 akun guru dan 373 koleksi dari database port 5432 lama ke skema MathBank baru secara bertahap. |
| **P2-02** | **Containerisasi Mandiri Layanan BGE-M3** | 3 hari | Salman | Membungkus FastAPI BGE-M3 ke dalam container Docker Compose terdedikasi lengkap dengan healthcheck restart policy. |
| **P2-03** | **Benchmark Beban Konkuren Multi-User** | 2 hari | Salman + Zaid | Uji beban kbench/autocannon untuk 100 concurrent users menguji ketahanan connection pool PostgreSQL (`max: 10`). |
| **P2-04** | **Evaluasi Mendalam Distraktor Pedagogis A–E** | Berkelanjutan | Faruq | Mengaudit kualitas opsi salah pada 11.108 soal untuk memastikan nilai edukatif miskonsepsi siswa. |
| **P2-05** | **Uji Restore Cadangan Database Bulanan** | 1 jam / bulan | Salman | Menjadwalkan pengujian restore berkala otomatis pada instance staging untuk menguji ketahanan Disaster Recovery (RTO/RPO). |

---

## 7. Rangkuman Metrik Sukses V2 (Definition of Done MathBank V2-Ready)

MathBank V2 dinyatakan **SELESAI dan SIAP PRODUKSI** apabila memenuhi indikator terukur berikut:

1. **Kesehatan Gate:** `pnpm check` (tsc, eslint, vitest) HIJAU 100% tanpa kompromi.
2. **Kesiapan Korpus:**
   - Total soal: ≥ 11.850.
   - Status `ready`: ≥ 8.000 soal siap pakai (≥67% dari total korpus).
   - Embedding coverage: ≥ 99% terisi vektor 1024d.
   - Taksonomi mapping: ≥ 95% soal terpetakan ke topik kurikulum.
   - Relasi media: ≥ 1.500 aset tersambung di `question_media`.
3. **Performa Web:**
   - Latensi pencarian & filter API p95 ≤ 300 ms.
   - Paginasi `/bundles` server-side (1 request HTTP per view, 0 waterfall loop).
   - Cumulative Layout Shift (CLS) pada soal bergambar ≤ 0.05.
4. **Keamanan & Kestabilan:**
   - 0 kebocoran kredensial/stack pada logger dan endpoint publik `/api/health`.
   - 51/51 route mutasi terproteksi validasi Zod.
   - Cadangan database terjadwal harian otomatis.


---

## § Catatan Verifikasi

- **Verifikator:** CodeBuddy (agen), 2026-10-23.
- **Metode:** hitung ID ACT di dokumen ini (22 unik: ACT-01..ACT-22), cek struktur 4 sprint + backlog, dan bandingkan Definition of Done §7 dengan kondisi repo/DB 2026-10-23.
- **Terverifikasi benar:** 22 ACT lengkap dengan DoD; ketergantungan utama konsisten (ACT-07 butuh ACT-01); Sprint 0 ACT-01..ACT-05 sudah dilaporkan selesai di `docs/sprint0/SALMAN-PROGRESS.md` & `ICHSAN-PROGRESS.md`.
- **Koreksi status DoD §7:** "embedding ≥99%" **tercapai** (99,8%); "media ≥1.500" tercapai bila dihitung per soal (1.506 soal; 1.639 tautan); "≥8.000 ready" **belum** (0 ready, 100% draft); "topik ≥95%" **belum** (71,2%); "51/51 route Zod" **tidak diverifikasi ulang** di sini — 38/51 route mengimpor Zod langsung, sisanya lewat kontrak bersama, jadi angka itu belum boleh dikutip sebagai bukti.
- **Status:** ⚠️ rencana ini turunan master findings; bila angka berubah, perbarui `docs/SNAPSHOT-METRIK-*.md` lebih dulu.
