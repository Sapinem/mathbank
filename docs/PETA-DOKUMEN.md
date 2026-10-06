# PETA-DOKUMEN.md — Indeks Kanonikal & Tata Kelola Dokumen MathBank

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38)  
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
- `docs/KEAMANAN.md`: Protokol mitigasi kerentanan (anti-SSRF, sanitasi input KaTeX, auth guard).
- `docs/plans/`: *Implementation Plans* terstruktur untuk perbaikan audit dan fitur baru.
  - `docs/plans/2026-10-06-verifikasi-ingest-defantri.md`: Catatan Verifikasi uji coba ingest defantri via API M9 (5 percobaan) — mencatat kesesuaian data tersimpan vs sumber, idempotensi, dan 1 temuan cacat layout `name="radio"`.
  - `docs/plans/2026-10-06-temuan-variasi-layout-defantri.md`: Temuan audit variasi layout soal defantri (70 artikel benar-salah `qN`, 19 nama duplikat, 6 radio generik) + alasan perbaikan cepat dibatalkan (regresi 1.383 soal) & langkah berikutnya.
  - `docs/plans/2026-10-06-benar-salah-qn-defantri-belum-selesai.md`: Percobaan prioritas 1 (benar-salah `qN` → `matrix_grid`) **dibatalkan** karena regresi korpus 10.365→9.191; berisi klasifikasi 5 kelompok artikel, 2 akar masalah terverifikasi (stem di luar `<blockquote>`, `<ul>` bercampur), dan utang teknis.
  - `docs/plans/2026-10-06-perbaikan-jalur-pg-defantri.md`: **2 bug jalur PG diperbaiki** (`<!--more-->` mengalahkan pembuka soal; stem "pembuka bersama" di luar blok radio). Hasil: gerbang PG **214/214 cocok**, korpus **10.365 → 10.592** (+227), 0 artikel tanpa soal.
  - `docs/plans/2026-10-06-gerbang-mapel-matematika-defantri.md`: **Gerbang mapel** (hanya matematika diproses; non-matematika ditandai `skipped` dari judul+URL) + perbaikan bug opsi `\\)` nyasar (LaTeX tak seimbang). Hasil: 200 masuk/74 skip, 262/262 soal uji cocok, `latex-rusak` 0.
  - `docs/plans/2026-10-06-temuan-event-dan-wacana-defantri.md`: **Event backfill** (5 event baru → 10; `questions.event_id` 0→1.325, `event_year`→455) + temuan **wacana/stimulus** (1 artikel, kriteria deteksi: tiap sub-soal menunjuk radio berbeda).
  - `docs/plans/2026-10-06-utang-teknis-bundles-event-id.md`: ⏳ **UTANG TEKNIS** — `bundles.event_id` harus **dihapus**; `event_id` hanya milik **soal** (ADR-0010). Berisi bukti (112 soal dipakai lintas paket; 91 "beda event" semuanya wajar) & rencana migrasi.
  - `docs/plans/2026-10-07-catatan-remediasi-review-v2.md`: ⏳ **Catatan Remediasi Review Kode v2.0** — Rekomendasi perbaikan 7 cacat hasil audit (ESLint dev scripts, sterilisasi event PAS/TO, KaTeX delimiter regex, noScroll matrix grid, gutter cetak 24px, metrik commit API, kop dinamis).
- **`docs/RENCANA-ADOPSI-ARSITEKTUR-MATHCORE-SOAL.md`**: 📋 **Rencana Adopsi Arsitektur** — 5 inovasi unggul dari MathCore (isolasi tabel vektor 1:1, banned Server Actions) dan Soal (silsilah multi-kemunculan AD-13, paged media CSS A4 2-kolom, toleransi parsial ingest MCP) untuk menyempurnakan MathBank.
- **`docs/RENCANA-MATHBANK-V2.md`**: 🚀 **Cetak Biru Strategis MathBank v2.0** — Usulan komprehensif v2.0 mencakup pemisahan Hot/Cold storage, partial HNSW index, pemisahan mutlak event vs provenance, publishing paged media CSS 2-kolom, 4 fase roadmap migrasi, dan agenda remediasi hasil audit.

