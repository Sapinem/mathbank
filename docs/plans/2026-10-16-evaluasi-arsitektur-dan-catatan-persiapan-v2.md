# CATATAN EVALUASI ARSITEKTUR & PERSIAPAN MATHBANK v2.0
### *Comprehensive Architectural Evaluation & Transition Readiness Protocol*

> **Status:** ⏳ Direncanakan untuk Eksekusi Tim Pengembang (MathBank v2.0)  
> **Tanggal:** 16 Oktober 2026  
> **Otoritas:** Principal Software Architect & QA Code Reviewer  
> **Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
> **Dokumen Terkait:** `docs/RENCANA-MATHBANK-V2.md`, `docs/plans/2026-10-07-catatan-remediasi-review-v2.md`, `docs/AXIOM-VS-MATHBANK-COMPARISON.md`, `CONSTRAINTS.md`, `docs/PETA-DOKUMEN.md`

---

## 1. Konteks & Tujuan Dokumen

Dokumen ini disusun sebagai kelanjutan resmi dari Cetak Biru Strategis v2.0 (`docs/RENCANA-MATHBANK-V2.md`) dan melengkapi Catatan Remediasi Review Kode sebelumnya (`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`). **Catatan pada dokumen ini tidak menimpa catatan-catatan sebelumnya**, melainkan menambahkan hasil evaluasi menyeluruh arsitektur sistem dari sudut pandang integritas database, pipeline ingestion, isolasi keamanan, dan kesiapan operasional rilis v2.0.

---

## 2. Ringkasan Hasil Evaluasi Arsitektur Berlapis (L1–L9)

Pemeriksaan mendalam terhadap basis kode aktif (`paperclip/dev`) mengonfirmasi bahwa arsitektur berlapis L1–L9 telah diterapkan dengan disiplin tinggi:

1. **L1 (Otorisasi & Pengguna):** Model hak akses formal (`permissions.ts`) dengan 5 peran (`admin`, `teacher`, `reviewer`, `agent`, `machine`) dan aljabar union terkuat (`yes` > `own` > `no`) berfungsi deterministik tanpa dependensi DB. Pagar keras `AUTH_DEV_BYPASS` non-produksi terpasang dengan baik.
2. **L2 (Presentasi & UI):** Komponen mobile-first patuh WCAG 2.2 AA (kontras tema teruji 34/34), rumus matematika dibungkus kontainer pelindung `overflow-x-auto` (`MathContent`), dan antarmuka bersih dari gaya generic AI.
3. **L3 (State Klien):** URL query parameters berfungsi penuh sebagai *Single Source of Truth* via React Query. Larangan manual `useMemo`/`useCallback` (CONSTRAINT #6) dipatuhi.
4. **L4 (API Gateway):** Seluruh route handler mutasi telah dibungkus middleware `wrapRoute()` dengan penegakan envelope seragam (`{ data }` / `{ error }`), otorisasi terpusat, dan pembatas laju token bucket.
5. **L5 (Domain Services):** Modularitas SRP berjalan konsisten (<300 baris/file) tanpa abstraksi repositori berlebih, inisiatif transaksi database diatur di lapisan ini.
6. **L6 (Pure Engines):** Mesin murni seperti FSM soal (`question-fsm.ts`), linter KaTeX (`katex-lint.ts`), dan fusi pencarian RRF (`fusion.ts`) terisolasi dari database dan jaringan sehingga dapat diuji cepat secara deterministik.
7. **L7 (Akses Data):** Drizzle ORM dengan skema `snake_case` dan proyeksi kolom eksplisit (`questionColumns()`) berhasil mencegah kebocoran kunci jawaban (`answer_key`) dan kolom berat ke pengguna tidak berwenang.
8. **L8 (Basis Data):** PostgreSQL 18 dengan 26 tabel, 24 triggers integritas, UUIDv7 native clustering, dan indeks HNSW terverifikasi *Zero-Drift* melalui `pnpm db:verify`.
9. **L9 (Layanan Luar & MCP):** Integrasi AI/9router dinamis via `app_settings` (tanpa hardcode), model embedding Ollama bge-m3 1024-dim, dan endpoint `/api/mcp` untuk agen AI.

---

## 3. Catatan Evaluasi & Risiko Teknis Persiapan v2.0

Berikut adalah inventarisasi isu arsitektur dan risiko teknis yang dicatatkan untuk persiapan eksekusi v2.0:

### A. Penyempurnaan Basis Data & Alokasi RAM (Fase 1 v2.0)
- **Problem:** Kolom `embedding vector(1024)` saat ini tersimpan inline pada tabel `questions`. Akibatnya ukuran baris rata-rata membengkak ($\approx 4.5\text{ KB}$), yang menghabiskan memori buffer pool RAM PostgreSQL saat query paginasi atau filter non-vektor dijalankan.
- **Tindakan Persiapan v2.0:**
  1. Buat tabel terpisah `question_embeddings` 1:1 (`question_id` sebagai PK & FK `CASCADE`).
  2. Pindahkan data vektor via migrasi bertahap (*backfill*).
  3. Pasang Partial HNSW Index hanya untuk soal aktif (`WHERE status = 'ready' AND deleted_at IS NULL`).
  4. Hapus kolom `embedding` dari tabel `questions` (menghemat buffer pool RAM hingga $>90\%$).

### B. Ketahanan Ingest Massal & Toleransi Parsial (Fase 2 v2.0)
- **Problem:** Pada proses ingest batch naskah soal (misal 30 soal per artikel/file via MCP `file_problems`), kegagalan validasi KaTeX atau batas skema pada 1 soal dapat menggagalkan seluruh naskah (*all-or-nothing rollback*).
- **Tindakan Persiapan v2.0:**
  1. Terapkan validasi dan penyimpanan toleran parsial per-indeks di `src/lib/ingest/service.ts`.
  2. Soal yang valid (misal 28 soal) langsung tersimpan ke database dalam status draf.
  3. Soal bermasalah (misal 2 soal) diisolasi dengan payload laporan terperinci: `{ stored: 28, failed: 2, failures: [{ index: 4, reason: "KaTeX unclosed delimiter" }] }`.

### C. Keamanan Sanitasi URL & Anti-SSRF Media (Fase 3 v2.0)
- **Problem:** Pemeriksaan alamat IP pada `src/lib/ingest/media/fetch.ts` rentan terhadap bypass DNS Rebinding dan follow-redirects otomatis ke endpoint metadata internal Cloud (`169.254.169.254`).
- **Tindakan Persiapan v2.0:**
  1. Terapkan resolusi DNS manual sebelum membuka soket koneksi (`dns.lookup`).
  2. Kunci opsi HTTP fetch ke `redirect: 'manual'` untuk mencegah lompatan URL tak terverifikasi.
  3. Validasi skema URL yang diizinkan hanya `http:`, `https:`, dan `corpus:` (untuk gambar lokal terverifikasi).

### D. Pembersihan Skrip Dev & Penegakan Konvensi Penamaan (CONSTRAINT #28b & #2)
- **Problem:** Direktori `scripts/dev/` memuat skrip investigasi sementara berbahasa Indonesia yang memicu kegagalan pada tes `src/lib/telemetry/check-names.test.ts`.
- **Tindakan Persiapan v2.0:**
  1. Rename skrip investigasi yang masih aktif ke bahasa Inggris (misal: `search-broken-katex.ts`, `audit-package-source.ts`).
  2. Hapus skrip investigasi sekali-pakai yang sudah tidak relevan.
  3. Daftarkan folder scratch developer ke `globalIgnores` pada ESLint agar exit gate `pnpm check` lulus mutlak tanpa hambatan.

### E. Standardisasi Cetak Naskah A4 2-Kolom (Publishing Engine)
- **Problem:** Pencetakan naskah soal nomor 2-digit (`10.` s.d. `99.`) pada layout 2-kolom berpotensi menabrak batas naskah bila gutter penomoran tidak distandarisasi.
- **Tindakan Persiapan v2.0:**
  1. Patenkan `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css`.
  2. Hubungkan kop lembaga secara dinamis dari `bundles.print_config` (`institutionName`, `tagline`, `instructions`).
  3. Pertahankan isolasi proteksi pemotongan halaman (`break-inside: avoid; page-break-inside: avoid;`) untuk rumus dan blok opsi.

---

## 4. Matriks Checklist Kesiapan Eksekusi v2.0

| Domain | Item Pemeriksaan | Target Mutu / Batasan | Status Kesiapan |
|---|---|---|:---:|
| **Storage** | Pemisahan Tabel `question_embeddings` 1:1 | Tabel baru + partial HNSW index + drop kolom inline | 📋 Siap di Fase 1 |
| **Storage** | Penegakan `chk_stimulus_fields` | Check constraint wacana stimulus tanpa parent | 📋 Siap di Fase 1 |
| **Storage** | Drop Utang Kolom `bundles.event_id` | Event murni milik butir soal (ADR-0020) | 📋 Siap di Fase 1 |
| **Ingest** | Toleransi Parsial Ingest MCP | Soal sehat tersimpan, soal rusak dilaporkan per indeks | 📋 Siap di Fase 2 |
| **Ingest** | Vektorisasi Tabel Markdown GFM | Tabel teks di-render Markdown, bukan gambar | 📋 Siap di Fase 2 |
| **Publishing** | CSS Paged Media A4 2-Kolom | Anti-potong rumus, gutter 24px, toggle kunci terpisah | 📋 Siap di Fase 2 |
| **Security** | Anti-SSRF DNS Rebinding pada `fetch.ts` | Manual redirect + pre-connection DNS check | 📋 Siap di Fase 3 |
| **Security** | Zero Server Actions untuk Mutasi | 100% mutasi data via Route Handler + `wrapRoute` | 📋 Siap di Fase 3 |
| **Quality** | Exit Gate CI/CD `pnpm check` | Typecheck 0 error, Lint 0 error, Test coverage $\ge 85\%$ | 📋 Siap di Fase 4 |
| **Quality** | Zero Schema Drift `pnpm db:verify` | Seluruh tabel, trigger, check, dan index sesuai skema | 📋 Siap di Fase 4 |

---

## 5. Hubungan dengan Catatan Remediasi Terdahulu

Catatan persiapan ini bersinergi secara langsung dengan:
1. **Catatan Remediasi Review Kode 7 Oktober 2026 (`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`):**
   - 7 temuan review kode (ESLint CI dev scripts, sterilisasi event PAS/TO, perbaikan regex delimiter KaTeX, noScroll MatrixGrid, gutter 24px cetak A4, metrik kegagalan ingest commit API, kop dinamis `printConfig`) tetap menjadi agenda remediasi aktif.
2. **Cetak Biru Strategis v2.0 (`docs/RENCANA-MATHBANK-V2.md`):**
   - 4 pilar arsitektur v2.0 (Intake Cepat, Data Terisolasi, Enrichment AI KaTeX Murni, dan Publishing Paged Media) tetap menjadi tujuan akhir evolusi platform.
