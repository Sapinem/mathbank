# PETA-DOKUMEN.md — Indeks Kanonikal & Tata Kelola Dokumen MathBank

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 23 Oktober 2026 (registrasi `docs/sprint0/`, `docs/verification/`, `docs/architecture/`, AXIOM, ARAHAN-SLUG, dan 14 berkas `docs/plans/`; lihat §4)  
> **Otoritas:** Zaid (Chief of Staff / Lead Orchestrator) & Dewan Direksi Math My Id  

---

## 1. Kebijakan Tegas Cold-Storage Historis (`docs/archive/`)

⚠️ **ATURAN MUTLAK BAGI SELURUH AGEN (Zaid, Salman, Ichsan, Faruq, Bilal, Hamzah):**
1. Seluruh dokumen yang berada di dalam folder `docs/archive/` berstatus **COLD-STORAGE HISTORIS**.
2. Seluruh agen **DILARANG KERAS** menggunakan, mengutip, atau memperlakukan berkas di dalam `docs/archive/` sebagai acuan kerja aktif, aturan sistem, ataupun panduan arsitektur berjalan.
3. Dokumen di dalam `docs/archive/` hanya boleh diakses apabila Dewan Direksi (Board) secara eksplisit meminta audit atau rekonstruksi sejarah masa lalu.
4. Satu-satunya acuan kerja sah dan mengikat adalah **Dokumen Kanonikal Hidup (*Living Documents*)** yang tercantum pada Bagian 2 di bawah ini serta berkas aturan proyek (`AGENTS.md`, `CLAUDE.md`).

---

## 2. Peta Dokumen Kanonikal Hidup (*Living Documents*)

Berikut adalah 5 pilar dokumen kanonikal resmi yang merefleksikan kondisi nyata codebase MathBank (`paperclip/dev`):

| Dokumen | Domain Utama | Penanggung Jawab | Deskripsi Singkat |
|---|---|:---:|---|
| **`docs/ARCHITECTURE.md`** | Arsitektur Sistem | Salman | Arsitektur Next.js 16 App Router, modularitas L5 (SRP), isolasi pure engine L6, dan singleton connection pool. |
| **`docs/DATABASE.md`** | Basis Data & Skema | Salman | Skema PostgreSQL terpadu (`bundles`), Drizzle ORM, indeks performa (`question_type`, FK), dan transisi FSM atomic CAS guard. |
| **`docs/DESIGN_SYSTEM.md`** | Antarmuka & UX | Ichsan | Base UI headless primitives, Tailwind CSS v4, aturan anti-`space-y-*`, WCAG 2.2 AA (target sentuh 44px), isolasi KaTeX, dan standar print A4. |
| **`docs/PEDAGOGY.md`** | Mutu Pedagogis | Faruq | Standar 31 kaidah Haladyna, analisis miskonsepsi (distractor rationale A–E), rubrik analitik esai terukur, dan taksonomi kognitif Bloom/DOK. |
| **`docs/PETA-DOKUMEN.md`** | Tata Kelola Dokumen | Zaid | Peta indeks kanonikal aktif dan kebijakan operasional arsip. |

---

## 3. Struktur Direktori Arsip Cold-Storage (`docs/archive/`)

Seluruh artefak perencanaan dan catatan audit terdahulu telah direlokasi ke direktori berikut:

- `docs/archive/rencana/`: Seluruh dokumen rencana kerja historis (`RENCANA-*.md`).
- `docs/archive/audit/`: Seluruh dokumen catatan audit dan verifikasi masa lalu (`AUDIT-*.md`, `VERIFIKASI-AUDIT-*.md`, dan catatan per milestone M1–M16).
- `docs/archive/evaluasi/`: Dokumen evaluasi arsitektural dan studi banding terdahulu (`EVALUASI-*.md`, `REVIEW-*.md`, `CATATAN-*.md`).
- `docs/archive/historis/`: Riset pustaka lama, catatan integrasi Better-Auth awal, proposal lama, dan log progres otonom.

---

## 4. Dokumen Pendukung Spesifik Domain

Dokumen berikut melengkapi pilar kanonikal utama untuk kebutuhan operasional spesifik:
- `docs/ADR/`: *Architectural Decision Records* (catatan keputusan arsitektural resmi yang masih berlaku).
- `docs/PRD.md`: *Product Requirements Document* tingkat tinggi MathBank.
- `docs/RUNBOOK.md`: Panduan operasional deployment, maintenance, dan disaster recovery server.
- `docs/BACKUP-RECOVERY.md`: Strategi backup (cron harian 02:00, retensi 7 harian + arsip mingguan 30 hari), RPO/RTO, dan uji restore wajib.
- `docs/RESTORE-RUNBOOK.md`: **Prosedur pemulihan langkah-demi-langkah** (perintah + ekspektasi keluaran) untuk insiden, termasuk cara menimpa DB produksi dengan aman, tabel nilai invarian yang harus cocok, troubleshooting, dan riwayat drill restore (ACT-07 / MAT-124).
- `docs/KEAMANAN.md`: Protokol mitigasi kerentanan (anti-SSRF, sanitasi input KaTeX, auth guard).
- `docs/AXIOM-VS-MATHBANK-COMPARISON.md`: 📋 **Komparasi Arsitektur Axiom vs MathBank** — pembanding skema `questions`/solutions/taxonomy/bundles/media, kapabilitas eksklusif MathBank, dan batas integrasi lintas repo (Axiom ≠ MathBank).
- `docs/architecture/QUESTION_PAYLOAD_DECISION.md`: 📋 **Keputusan Penyimpanan Soal Dinamis** — single table + hybrid JSONB (`data_payload`/`answer_key`), alasan tidak memakai tabel opsi terpisah.
- `MathBankAuditor/reports/`: Laporan audit skill-based (di luar `docs/`; tetap wajib terdaftar — CONSTRAINTS #31).
  - `MathBankAuditor/reports/2026-10-18/audit-react-19-actions-and-optimistic-ui.md`: 🔴 **Audit React 19 Actions & Optimistic UI (skill `react-19-actions-and-optimistic-ui`)** — 20 temuan (R-01..R-20). Temuan HIGH: R-01 anti-double-submit **Idempotency-Key tidak pernah dikirim klien** padahal server sudah mendukung; R-02 drag reorder paket **tanpa** optimistic update (`setQueryData`); R-04 `setState` saat render di `BundleBuilder` (risiko lost update `instructions`); R-10 form login/ganti-sandi tanpa `<form>`/`type="submit"`. Mencatat bahwa §1 skill (React Compiler) **tidak berlaku** (compiler tak terpasang) dan §2/§3 (Server Actions) **dilarang ADR-0022** — sehingga 0 penggunaan `useActionState`/`useOptimistic` dinilai sebagai konflik kontrak yang sah, bukan cacat. `pnpm typecheck` lulus; `pnpm lint` gagal (7 error **di `scripts/dev/**`**, bukan `src/**`). §Catatan Verifikasi ada.
  - `MathBankAuditor/reports/2026-10-17/audit-security-and-hardening.md`: 🔴 **Audit Keamanan v2 (skill `security-and-hardening`)** — 6 HIGH (SEC-01 `question:flag` tanpa `ownerId`; SEC-02 spoof `X-Forwarded-For`; SEC-03 SSRF TLS *relaxed*; SEC-04 traversal `corpus://`; SEC-05 root ekspor GitSync; SEC-06 SSRF `ai.base_url`) + 9 MEDIUM + 7 LOW; §Catatan Verifikasi ada; bukti eksekusi di `src/lib/security/audit-2026-10-17.proof.test.ts`. **Menggantikan** `MathBankAuditor/reports/17.10.2026/audit-security-and-hardening.md`.
  - `MathBankAuditor/reports/17.10.2026/audit-security-and-hardening.md`: ⚠️ **DIGANTIKAN** (17.10.2026) oleh laporan 2026-10-17 — memuat 0 CRITICAL/2 HIGH tanpa bukti eksekusi dan melewatkan 4 temuan HIGH.
- `docs/audit/`: Catatan audit aktif (wajib §Catatan Verifikasi — CONSTRAINTS #44).
  - `docs/audit/2026-10-18-konsistensi-dokumen-adr-vs-kode.md`: ⚠️ **Audit Konsistensi Dokumen & ADR vs Kode** — 24 klaim diperiksa (registrasi #31, ADR vs skema, §Catatan Verifikasi #44, AGENTS §8); 5 area drift (PETA-DOKUMEN ~120 berkas tak terdaftar; AGENTS §8: 28→26 tabel, 0→11.889 soal, 5→11 event, ADR-0016 sudah digantikan; DATABASE.md kolom fiktif; ADR-0020 `bundles.event_id` masih ada; laporan auditor tanpa §Catatan Verifikasi); §Catatan Verifikasi ada.
  - `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md`: 🔴 **Evaluasi Menyeluruh 7 Pilar MathBank V2** (MAT-114) — skor total **6,2/10 (MODERATE)**; Pilar 1 Data Quality **3,5 CRITICAL**. Temuan P0: 0% embedding (11.889 soal), 0% pemetaan topik (174 topik), 2.617 media orphan, backup stagnan 8 hari. Memuat snapshot metrik DB terverifikasi (26 tabel, 24 trigger, 11.889 soal, 579 bundle, 174 topik, 2.617 media), asesmen **6 lapisan** arsitektur (L1–L6), drift dokumentasi (AGENTS §8, README), dan dashboard kualitas data. Ringkasan: `EVALUASI-PAPERCLIP-V2-EXECUTIVE.md`; rencana aksi: `PAPERCLIP-V2-ACTION-PLAN.md`; data mentah: `AUDIT-DATA-SNAPSHOT-2026-10-19.csv`.
  - `docs/audit/EVALUASI-MATHBANK-V2-PILLAR1-FULL.md`: 🔴 **Pilar 1 — Data Quality (mendalam)** — bukti query per metrik (status, kunci, pembahasan, LaTeX, duplikasi, media, topik) untuk 11.889 soal.
  - `docs/audit/ARAHAN-EVALUASI-MATHBANK-V2.md`: 📋 **Arahan Evaluasi** — lingkup 7 pilar, format bukti, dan definisi severity yang dipakai seluruh laporan evaluasi V2.
  - `docs/audit/ARAHAN-KE-PAPERCLIP-SEGERA-JALAN.md`: ⚡ **Arahan ke Paperclip — Segera Jalan MathBank V2** (Task Directive No. 01/2026) — instruks langsung mulai eksekusi **HARI INI 19 Okt** dengan timeline kompresi **4 minggu → 7 hari** (target V2-ready 26 Okt 2026, bukan 16 Nov); matriks 22 ACT vs 3 keputusan CEO (15 ACT tanpa CEO); checklist malam 19 Okt 6 task (commit audit, rapikan working tree 30 file, bersihkan 42 warning ESLint, siapkan kanal #mathbank-v2, kirim arahan CEO, mulai ACT-01/02/03); jadwal 8 hari Day 1–8 dengan standup 3× sehari (09.00/13.00/17.00); tim 4 orang paralel (Salman/Ichsan/Bilal/Faruq); eskalasi 4 jam bukan 24 jam; 9 indikator Definition of Done.
  - `docs/audit/CROSS-AUDIT-MASTER-FINDINGS.md`: 📋 **Master Findings Konsolidasi** — sumber kebenaran tunggal hasil deduplikasi 9 audit (87 temuan mentah → 42 unik: 8 P0 + 20 P1 + 8 QuickWin + 6 Outdated); matriks coverage audit×area; gap analysis 4 area tak tercakup (load test, KaTeX macro injection, rendering mobile 360px, distractor pedagogis); rekonsiliasi 4 kontradiksi antar-audit; §Catatan Verifikasi ada.
  - `docs/audit/CROSS-AUDIT-EXECUTIVE-SUMMARY.md`: 🎯 **Ringkasan Eksekutif Cross-Audit V2** — skor kesehatan tertimbang **6,0/10** per pilar (Pillar 1 Data 3,2 KRITIS); top 5 blocker P0 (embedding 0%, topik 0%, media 0%, draft 100%, PERF waterfall+bulk); estimasi 4 minggu remediasi; 3 keputusan strategis menunggu persetujuan CEO.
  - `docs/audit/CROSS-AUDIT-ACTION-PLAN-V2.md`: 🗺️ **Action Plan Terkonsolidasi V2** — dependency graph 4 sprint (Sprint 0→3) + backlog P2 pasca-rilis; 22 ACT detail (ID/aksi/PIC/effort/deps/DoD); Definition of Done V2 (9 indikator terukur: `pnpm check` hijau, ≥8.000 ready, embedding ≥99%, topik ≥95%, media ≥1.500, p95 ≤300ms, CLS ≤0,05, 0 kebocoran, 51/51 Zod, backup harian).
  - `docs/audit/ARAHAN-CROSS-AUDIT-KONSOLIDASI-V2.md`: 📋 **Arahan Konsolidasi Cross-Audit** (MAT-114 revisi) — instruksi ke Paperclip/Tariq untuk **bukan evaluasi dari awal** melainkan ingest 9 audit existing, cross-reference, validasi evidence, dan hasilkan 3 output terkonsolidasi (master findings + executive summary + action plan); success criteria & 7 aturan penting.
  - `docs/audit/ARAHAN-SLUG-REMOVAL-2TAHAP.md`: 📋 **Pertimbangan Penghapusan Slug (MAT-125)** — usulan 2 tahap: soft deprecation (nullable) lalu hard removal. **Status 2026-10-23:** Tahap A sudah dieksekusi (`topics.slug`/`tags.slug` nullable, MAT-131A; unique index dipertahankan), Tahap B (drop kolom) belum; keputusan CEO masih kosong.
  - `docs/audit/audit-performance-optimization.md`: ⚠️ **Audit Performa & Optimasi v2 (skill `performance-optimization`)** — 2 CRITICAL (PERF-01 waterfall `useAllBundles`; PERF-02 ±10 query/soal pada aksi massal), 5 HIGH (ETag media, dimensi gambar/CLS, telemetri high-cardinality, batch enrichment/embedding sekuensial, heap gambar), + MEDIUM/LOW; §8.2 mengoreksi 5 klaim audit performa sebelumnya lewat bukti `PgDialect` & alur kode.
  - `docs/audit/2026-10-18-audit-observability-instrumentation.md`: ⚠️ **Audit Observability & Instrumentation** — skill `observability-and-instrumentation` **tak tersedia** sehingga baseline = `OBSERVABILITAS.md`/`SLA-SLO.md`/`KONTRAK-API.md`/`KEAMANAN.md`; 20 temuan (redaksi kunci-saja bocor di `Error.message`, galat pra-access-log hilang, label metrik path mentah tanpa batas, `percentile()` salah ≥512 sampel, `/api/health` bocor `err.message` publik, `prune()` mati); menautkan `SEC-02` sebagai temuan lama; §Catatan Verifikasi ada.
- **`docs/SNAPSHOT-METRIK-2026-10-21.md`**: 📊 **Snapshot Metrik DB Terverifikasi (2026-10-21)** — angka acuan resmi untuk `AGENTS.md` §8, `README.md` §Metrik Database, dan koreksi snapshot 2026-10-19 di `docs/audit/EVALUASI-PAPERCLIP-V2-FULL.md`. Memuat query `psql`/`db:verify` yang dapat direproduksi per baris metrik (26 tabel · 24 trigger · 86 index · 11.889 soal · 579 bundle · 174 topik · 2.617 media · 17 tag · 5 sumber · 11 event · 11.867 embedding), tabel delta vs 2026-10-19 (embedding 0→11.867, `question_topics` 0→14.442, `question_media` 0→1.639, index 87→86), daftar drift dokumentasi, prosedur penerapan patch `AGENTS.md`, dan §Catatan Verifikasi (termasuk batas: `pnpm test`/`lint` penuh tidak dijalankan, health `:3005` timeout). Pemilik: Tariq (MAT-116).
- `docs/plans/`: *Implementation Plans* terstruktur untuk perbaikan audit dan fitur baru.
  - `docs/plans/2026-10-06-verifikasi-ingest-defantri.md`: Catatan Verifikasi uji coba ingest defantri via API M9 (5 percobaan) — mencatat kesesuaian data tersimpan vs sumber, idempotensi, dan 1 temuan cacat layout `name="radio"`.
  - `docs/plans/2026-10-06-temuan-variasi-layout-defantri.md`: Temuan audit variasi layout soal defantri (70 artikel benar-salah `qN`, 19 nama duplikat, 6 radio generik) + alasan perbaikan cepat dibatalkan (regresi 1.383 soal) & langkah berikutnya.
  - `docs/plans/2026-10-06-benar-salah-qn-defantri-belum-selesai.md`: Percobaan prioritas 1 (benar-salah `qN` → `matrix_grid`) **dibatalkan** karena regresi korpus 10.365→9.191; berisi klasifikasi 5 kelompok artikel, 2 akar masalah terverifikasi (stem di luar `<blockquote>`, `<ul>` bercampur), dan utang teknis.
  - `docs/plans/2026-10-06-perbaikan-jalur-pg-defantri.md`: **2 bug jalur PG diperbaiki** (`<!--more-->` mengalahkan pembuka soal; stem "pembuka bersama" di luar blok radio). Hasil: gerbang PG **214/214 cocok**, korpus **10.365 → 10.592** (+227), 0 artikel tanpa soal.
  - `docs/plans/2026-10-06-gerbang-mapel-matematika-defantri.md`: **Gerbang mapel** (hanya matematika diproses; non-matematika ditandai `skipped` dari judul+URL) + perbaikan bug opsi `\\)` nyasar (LaTeX tak seimbang). Hasil: 200 masuk/74 skip, 262/262 soal uji cocok, `latex-rusak` 0.
  - `docs/plans/2026-10-06-temuan-event-dan-wacana-defantri.md`: **Event backfill** (5 event baru → 10; `questions.event_id` 0→1.325, `event_year`→455) + temuan **wacana/stimulus** (1 artikel, kriteria deteksi: tiap sub-soal menunjuk radio berbeda).
  - `docs/plans/2026-10-06-utang-teknis-bundles-event-id.md`: ⏳ **UTANG TEKNIS** — `bundles.event_id` harus **dihapus**; `event_id` hanya milik **soal** (ADR-0010). Berisi bukti (112 soal dipakai lintas paket; 91 "beda event" semuanya wajar) & rencana migrasi.
  - `docs/plans/2026-10-07-catatan-remediasi-review-v2.md`: ⏳ **Catatan Remediasi Review Kode v2.0** — Rekomendasi perbaikan 7 cacat hasil audit (ESLint dev scripts, sterilisasi event PAS/TO, KaTeX delimiter regex, noScroll matrix grid, gutter cetak 24px, metrik commit API, kop dinamis).
  - `docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md`: ⏳ **Evaluasi Arsitektur & Catatan Persiapan v2.0** — Evaluasi menyeluruh L1–L9, isolasi buffer pool vektor 1:1, toleransi parsial ingest MCP, mitigasi SSRF DNS rebinding, standardisasi cetak A4 2-kolom, dan checklist persiapan v2.0.
  - `docs/plans/2026-10-19-sinkronisasi-metrik-agents-readme.md`: ✅ **Sinkronisasi Metrik DB & Dokumentasi Arsitektur (MAT-116)** — metode verifikasi angka (db:verify + psql), tabel drift yang ditutup, **teks final §8/§9 `AGENTS.md`** (disetujui `1fe757d9`; penerapan tertahan gerbang berkas terlindungi — lihat `docs/plans/mat-116-agents-md-8-9.patch`, patch git siap terap yang sudah lolos `git apply --check`), dan status integrasi embedding `:3005`. **Revisi 4 (2026-10-21):** angka disegarkan dari DB (embedding **11.867/11.889**, topik **8.468 soal**, media **1.639 tautan**, index **86**), patch `mat-116-agents-md-8-9.patch` **diregenerasi** & lolos `git apply --check`; `AGENTS.md` masih tertahan gerbang berkas terlindungi — bukti di `docs/SNAPSHOT-METRIK-2026-10-21.md`.
  - `docs/plans/2026-10-06-ingest-m4thlab.md`: ✅ **Ingest Sumber m4thlab** — hasil ingest + metrik per sumber.
  - `docs/plans/2026-10-06-ingest-mathcyber.md`: ✅ **Ingest Sumber mathcyber** — hasil ingest + metrik.
  - `docs/plans/2026-10-06-ingest-mandiri.md`: ✅ **Ingest Mandiri** — jalur ingest tanpa server/build.
  - `docs/plans/2026-10-06-spesifikasi-parser-defantri.md`: 📋 **Spesifikasi Parser defantri** — acuan wajib dari pemilik (contoh HTML nyata + aturan parsing).
  - `docs/plans/2026-10-06-metodologi-cek-katex.md`: ⚠️ **Metodologi cek KaTeX** — koreksi metode deteksi (regex tebakan vs parse nyata).
  - `docs/plans/2026-10-06-temuan-dolar-bertumpuk.md`: ⚠️ **Temuan `$…$$`** — sengaja tidak diperbaiki (prinsip presisi).
  - `docs/plans/2026-10-06-temuan-katex-bersarang.md`: ⚠️ **Temuan KaTeX bersarang** — sebagian diperbaiki, sisa dibiarkan.
  - `docs/plans/2026-10-06-temuan-kunci-mathcyber.md`: ⚠️ **Temuan kunci mathcyber** — kunci ada di sumber, tidak diisi otomatis (presisi).
  - `docs/plans/2026-10-06-temuan-mcma-belum-didukung.md`: ⏳ **Temuan MCMA** — `multiple_choice_checkbox` teridentifikasi, belum ditangani.
  - `docs/plans/2026-10-06-temuan-event-tidak-terisi.md`: ✅ **Temuan event tidak terisi** — diperbaiki (backfill `event_id`).
  - `docs/plans/2026-10-06-temuan-pembahasan-defantri.md`: ✅ **Temuan pembahasan defantri** — bug pembahasan benar-salah diperbaiki.
  - `docs/plans/2026-10-08-rencana-konsolidasi-bank-soal-ce.md`: 📋 **Rencana Konsolidasi Bank Soal (compound-engineering loop)** — diagnosa 3 lapis masalah lintas 15 folder proyek.
  - `docs/plans/perbaikan-manual-mathcyber.md`: ⚠️ **Daftar perbaikan manual mathcyber** — ekspresi KaTeX yang perlu koreksi tangan.
  - `docs/plans/mathcyber-clean.json`: 📦 **Artefak data** — hasil pembersihan mathcyber (input skrip, bukan dokumen naratif).
- **`docs/RENCANA-ADOPSI-ARSITEKTUR-MATHCORE-SOAL.md`**: 📋 **Rencana Adopsi Arsitektur** — 5 inovasi unggul dari MathCore (isolasi tabel vektor 1:1, banned Server Actions) dan Soal (silsilah multi-kemunculan AD-13, paged media CSS A4 2-kolom, toleransi parsial ingest MCP) untuk menyempurnakan MathBank.
- **`docs/RENCANA-MATHBANK-V2.md`**: 🚀 **Cetak Biru Strategis MathBank v2.0** — Usulan komprehensif v2.0 mencakup pemisahan Hot/Cold storage, partial HNSW index, pemisahan mutlak event vs provenance, publishing paged media CSS 2-kolom, 4 fase roadmap migrasi, dan agenda remediasi hasil audit.

- `docs/sprint0/`: Laporan Sprint 0 (MAT-118/119/120) — bukti pelaksanaan ACT-01..ACT-05.
  - `docs/sprint0/SALMAN-PROGRESS.md`: ✅ ACT-01/02/03/05 (backup harian, scrubbing logger & health leak, label metrik, bulk update status).
  - `docs/sprint0/ICHSAN-PROGRESS.md`: ✅ ACT-04 (hapus HTTP waterfall `BundleListView`).
  - `docs/sprint0/FARUQ-GRADE-PLAN.md`: 📋 Rencana mapping grade SD/SMP/SMA.
  - `docs/sprint0/FARUQ-DIFFICULTY-PLAN.md`: 📋 Rencana distribusi difficulty 1–5.
  - `docs/sprint0/FARUQ-FLAGGED-ANALYSIS.md`: 📋 Analisis distribusi soal terflag.
  - `docs/sprint0/FARUQ-SAMPLE-REVIEW.md`: 📋 Review sampel kualitas soal.
  - `docs/sprint0/FARUQ-SHORT-QUESTIONS.md`: 📋 Analisis soal <50 karakter.
- `docs/verification/`: Verifikasi independen (bukan audit — §Catatan Verifikasi #44 hanya wajib untuk `docs/audit/`).
  - `docs/verification/MAT-148-independent-verification-hafiz.md`: ✅ Verifikasi independen MAT-148.
  - `docs/verification/MAT-148-jsonb-ui-verification.md`: ✅ Verifikasi UI JSONB (editor, kartu, detail).
  - `docs/verification/MAT-154-integration-verification.md`: ✅ Verifikasi integrasi (build, hidrasi, multi-viewport, 5 tipe).

