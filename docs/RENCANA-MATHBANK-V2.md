# RENCANA STRATEGIS & CETAK BIRU MATHBANK v2.0
### *The Absolute Zenith Mathematical Assessment & Question Bank Platform*

> **Status:** Disetujui & Resmi (*Living Architecture Blueprint*)  
> **Tanggal:** 7 Oktober 2026  
> **Otoritas:** Principal Software Architect & Dewan Direksi Math My Id  
> **Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
> **ID Memori Mnemosyne:** `9f2b8417c8a63490`  
> **Dokumen Terkait:** `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/PETA-DOKUMEN.md`, `docs/RENCANA-ADOPSI-ARSITEKTUR-MATHCORE-SOAL.md`

---

## 1. Visi, Filosofi & Bounded Contexts v2.0

MathBank v2.0 dibangun untuk menyelesaikan **dikotomi terbesar dalam platform edukasi matematika**:  
*"Platform generasi terdahulu terhambat karena dibangun hanya sebagai Editor Web yang berat, padahal kebutuhan operasional di lapangan adalah Pengumpulan Cepat (Capture), Pengayaan Pedagogis Otomatis (Enrichment), dan Percetakan Naskah Siap Uji (Print)."*

### 4 Pilar Filosofi MathBank v2.0:
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PETA ALUR MATHBANK v2.0                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. INTAKE CEPAT    │ Ingest Korpus Massal (Web Scraper) + AI MCP Fast-Capture (Tutor)  │
│ 2. DATA TERISOLASI │ Skema Hot/Cold Heap (Vektor Terpisah) + Silsilah M:N              │
│ 3. ENRICHMENT AI   │ KaTeX Murni + Distractor Rationale A–E + Rubrik Esai Terukur      │
│ 4. PUBLISHING      │ Mesin Cetak A4 2-Kolom Anti-Potong + Ekspor Moodle XML v4/v5      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arsitektur Data & Basis Data v2.0 (The Zenith Schema)

Perubahan pada level basis data PostgreSQL 18 berfokus pada **efisiensi memori, integritas relasional, dan penghapusan redundansi**:

```
 [EVENT RESMI MAKRO]                         [KANAL PROVENANCE / SUMBER]
      events                                            sources
        │ (1:N opsional)                                   │ (1:N)
        ▼                                                  ▼
    questions ◄─── (M:N via bundle_items) ───────────── bundles (ada printConfig JSONB)
    ├── (1:N) ──► question_options (A-E + pedagogi)
    ├── (1:N) ──► solutions (rubrik esai / pembahasan)
    ├── (1:1) ──► question_embeddings (vektor terisolasi)
    ├── (M:N) ──► topics (Materialized Path: "aljabar.fungsi")
    └── (M:N) ──► tags (Folksonomi mikrokonsep <=100 char)
```

### A. Core Item: Pemisahan Hot/Cold Storage
1. **Rampingkan Tabel `questions` ($\sim 280\text{ bytes}$ per baris):**
   - Kolom `embedding vector(1024)` **dihapus** dari tabel `questions`.
   - Menampung wacana stimulus via `parent_id` (self-referential FK `onDelete: restrict`).
   - Diproteksi Check Constraint wacana stimulus:
     ```sql
     CONSTRAINT chk_stimulus_fields CHECK (
       (question_type = 'stimulus' AND parent_id IS NULL) OR
       (question_type != 'stimulus' AND difficulty BETWEEN 1 AND 5)
     )
     ```
2. **Isolasi 1:1 `question_embeddings` (Adopsi MathCore):**
   - `question_id` bertindak sebagai Primary Key dan Foreign Key `CASCADE`.
   - Dilengkapi **Partial HNSW Index**:
     ```sql
     CREATE INDEX idx_question_embeddings_hnsw 
       ON question_embeddings USING hnsw (embedding vector_cosine_ops)
       WHERE question_id IN (SELECT id FROM questions WHERE deleted_at IS NULL AND status = 'ready');
     ```
   - **Dampak Teknis:** Scan data umum dan pagination di UI menghemat memori RAM buffer pool PostgreSQL hingga **$>90\%$**.
3. **Single Source of Truth Kunci Jawaban:**
   - Untuk Pilihan Ganda (Tunggal & Kompleks), kunci jawaban murni bersumber dari `question_options.is_correct`.
   - Kolom `non_option_answer_key` pada `questions` hanya diisi untuk tipe non-PG (isian singkat, esai, numerik).
   - `distractor_rationale` melekat di setiap baris opsi salah A–E untuk merekam analisis miskonsepsi nyata siswa.

### B. Pemisahan Tegas Event Makro vs Provenance Naskah
1. **`events` (Hanya Ujian Resmi Makro / Nasional):**
   - UTBK SNBT, SIMAK UI, OSN Matematika SMA, UM UGM.
   - Sifatnya melekat pada identitas butir soal (`questions.event_id`, *nullable* / kalau ada).
2. **`sources` & `bundles` (Kanal Provenance Perolehan):**
   - Web Defantri, Mathcyber1997, Modul Bimbel, Buku Erlangga.
   - Melekat pada naskah (`bundles.source_id` + `bundles.url`).
   - Relasi M:N via `bundle_items`: satu soal yang sama dapat terlacak di artikel Defantri dan modul bimbel tanpa menduplikasi data butir soal.

### C. Navigasi Topik Cepat: Materialized Path (`topics.path`)
- Tabel `topics` menggunakan kolom `path: varchar(500)` (misal: `"aljabar.persamaan.kuadrat"`).
- Query seluruh sub-topik materi diselesaikan instan via `WHERE path LIKE 'aljabar.%'` **tanpa Recursive CTE** yang berat.

---

## 3. Backend, API Gateway & Keamanan v2.0

### A. Pipa Tunggal API Gateway (`wrapRoute`)
Menghapus seluruh route handler telanjang dan menggantinya dengan pipa seragam di seluruh `/api/v1/`:
```
Client Request ──► proxy.ts ──► wrapRoute()
                                  ├─ 1. resolveActor(headers/session)
                                  ├─ 2. assertCan(actor, permission)   [403 jika ditolak]
                                  ├─ 3. checkRateLimit(tokenBucket)     [429 jika meluap]
                                  ├─ 4. Zod Body/Query Validation      [400 jika cacat]
                                  ├─ 5. Domain Service Execution       [L5 SRP]
                                  ├─ 6. recordAudit(actor, action)     [Append-only log]
                                  └─ 7. Output Envelope: { data } | { error }
```

### B. Kebijakan Ketat "Zero Server Actions" untuk Mutasi
- Melarang penggunaan Next.js Server Actions (`"use server"`) untuk mutasi data sensitif guna menutup celah *bypass* otorisasi dan audit trail.
- Seluruh mutasi dari UI wajib mengonsumsi Route Handlers terstandarisasi melalui React Query.

### C. Hardening Keamanan Terintegrasi:
1. **Anti-SSRF DNS Rebinding (Media Ingest):** Pengecekan resolusi DNS sebelum koneksi (`dns.lookup`) dan penanganan `redirect: 'manual'` di `src/lib/ingest/media/fetch.ts`.
2. **Strict No-AnswerKey Projection:** API publik menyembunyikan opsi `is_correct`, kunci jawaban, dan embedding jika aktor bukan `teacher`, `reviewer`, atau `admin`.

---

## 4. Pipeline Ingest & AI Enrichment v2.0 (Resilient Ingestion)

### A. Toleransi Parsial Ingest Batch MCP (Adopsi Soal / AD-19)
- Saat meng-ingest naskah berisi 30 butir soal via AI/MCP:
  - Format soal divalidasi per-indeks di Service Layer.
  - **28 soal valid langsung tersimpan ke database.**
  - **2 soal bermasalah diisolasi** dan dilaporkan secara presisi:
    `{ stored: 28, failed: 2, failures: [{ index: 4, reason: "KaTeX unclosed delimiter" }] }`.
  - Mengakhiri frustrasi *all-or-nothing rollback* saat kurasi massal.

### B. Standardisasi KaTeX Murni & Vektorisasi Tabel:
- Normalisasi naskah matematika 100% menggunakan delimiter standar KaTeX `\(...\)` dan `\[...\]`.
- Gambar tabel yang berisi teks murni diubah menjadi tabel Markdown pipe atau KaTeX array agar dapat diindeks oleh pencarian semantik teks.

---

## 5. Mesin Penerbitan Cetak A4 v2.0 (The Print Shop Engine)

### A. Integrasi Paged Media CSS 2-Kolom (Adopsi Soal)
Mengadopsi lembar gaya cetak mandiri ke rute `/bundles/[id]/print`:
* **Margin Presisi:** `@page { size: A4 portrait; margin: 2cm 1.5cm; }`.
* **Proteksi Anti-Potong:** `.item`, `.figure`, dan `.options` dilindungi `break-inside: avoid; page-break-inside: avoid;`.
* **Gutter 24px Nomor 2-Digit:** Menghindari angka nomor soal `"10."` sampai `"99."` menabrak naskah soal.
* **Kolom Seimbang:** `.columns { column-count: 2; column-gap: 9mm; column-rule: 1px solid var(--border-rule); }`.

### B. Konfigurasi Cetak Terpadu (`bundles.print_config`)
Tanpa perlu tabel terpisah (Prinsip KISS), setiap bundel memiliki metadata cetak mandiri:
```typescript
printConfig: {
  institutionName: "SMA Labschool Rawamangun",
  tagline: "Penilaian Akhir Semester Ganjil 2026/2027",
  instructions: "Pilihlah salah satu jawaban yang paling tepat. Waktu pengerjaan: 90 menit.",
  durationMinutes: 90,
  twoColumnLayout: true,
  includeAnswerKey: false
}
```

---

## 6. Frontend & UI/UX Architecture v2.0

* **Framework:** Next.js 16 (App Router, Turbopack, `proxy.ts`, `"use cache"` + tag invalidation).
* **React 19 Runtime:** React Compiler aktif secara stabil (melarang penulisan manual `useMemo` dan `useCallback`).
* **Design System:** Base UI headless primitives + Tailwind CSS v4 (`@theme` tokens) + shadcn.
* **Aksesibilitas & Ergonomi (WCAG 2.2 AA):**
  - Target sentuh minimal **44px** pada mobile.
  - Rumus KaTeX panjang wajib dibungkus kontainer `overflow-x-auto` agar tidak merusak layout layar ponsel.
  - Banned `space-y-*` (wajib menggunakan Flex/Grid gap).

---

## 7. Roadmap Eksekusi Transisi (Phase-by-Phase Roadmap)

### 🗓️ Jadwal Rinci 4 Fase Eksekusi:

| Fase | Target Milestone | Ruang Lingkup Pekerjaan | Estimasi Risiko |
|:---:|---|---|:---:|
| **Fase 1** | **Database Storage & Schema Refactor** | • Buat tabel `question_embeddings` 1:1 + partial HNSW index.<br>• Backfill vektor & drop kolom `questions.embedding`.<br>• Tambah `print_config` JSONB di `bundles`.<br>• Drop utang kolom `bundles.event_id`.<br>• Pasang constraint `chk_stimulus_fields`. | Sedang (Perlu migrasi data vektor aman) |
| **Fase 2** | **Publishing & Resilient Ingestion** | • Cangkokkan CSS Paged Media 2-kolom ke `/bundles/[id]/print`.<br>• Terapkan toleransi parsial per-indeks pada MCP tool `file_problems`.<br>• Normalisasi gutter 24px nomor soal 2-digit. | Rendah (Murni layer print & ingest) |
| **Fase 3** | **API Hardening & wrapRoute** | • Audit seluruh endpoint mutasi ke pipa `wrapRoute()`.<br>• Enforce kebijakan *Banned Server Actions* pada seluruh UI form.<br>• Verifikasi strict no-answerkey projection pada user publik. | Rendah (Standardisasi kontrak API) |
| **Fase 4** | **Exit Gate Verification & Launch v2.0** | • Verifikasi 46 Batasan Mutu Mekanis (`CONSTRAINTS.md`).<br>• Uji `pnpm check` (Typecheck 0, Lint 0, Test Coverage $\ge 90\%$).<br>• Uji `pnpm test:db` (Zero schema drift via `db:verify`). | Rendah (Quality Gate mutlak) |

---

## 8. Ringkasan Nilai Tambah MathBank v2.0

| Metrik Evaluasi | MathBank v1.0 (Saat Ini) | MathBank v2.0 (Target) |
|---|---|---|
| **Ukuran Baris Tabel Soal** | $\approx 4.5\text{ KB}$ | $\approx 280\text{ bytes}$ (**Hemat $93\%$ RAM**) |
| **Pencarian Sub-Topik Materi** | Recursive CTE lambat | *Materialized Path* ($<2\text{ ms}$) |
| **Cetak Naskah Ujian A4** | Sering potong rumus/nomor tabrak | Standar Paged Media 2-kolom anti-potong |
| **Ingest Massal Berbantuan AI** | Gagal total jika 1 soal cacat | **Toleransi Parsial** (soal sehat tetap tersimpan) |
| **Keamanan Mutasi Data** | Campuran Route & Actions | **100% Terlindungi `wrapRoute` + Audit Trail** |

---

## 9. Catatan Evaluasi Review Kode & Agenda Remediasi Cacat Menuju v2.0

Berdasarkan tinjauan kode komprehensif (*AI-Powered Multi-Axis Code Review*) per 7 Oktober 2026, teridentifikasi 7 catatan perbaikan riil yang dimasukkan ke dalam agenda implementasi v2.0 (detail teknis lengkap di [`docs/plans/2026-10-07-catatan-remediasi-review-v2.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-07-catatan-remediasi-review-v2.md)):

1. **[CRITICAL] Pemulihan Exit Gate Linter CI (`scripts/dev/`):** Perbaiki 3 error sintaks (`require` vs ESM) dan variabel mati di `scripts/dev/` serta tambahkan `"scripts/dev/**"` ke `globalIgnores` pada `eslint.config.mjs` agar `pnpm check` kembali lolos 100% (CONSTRAINT #2).
2. **[HIGH] Sterilisasi Domain Event (ADR-0010, ADR-0020):** Cabut `"PAS-SAS"` dan `"Try Out"` dari `scripts/seed-events.ts`. Event dikhususkan untuk ujian resmi makro/nasional (UTBK/OSN/SBMPTN); penilaian sekolah dihimpun dalam `bundles`.
3. **[HIGH] Perbaikan Regex Delimiter KaTeX (`clean.ts`):** Ganti karakter kelas `[^)]+?` pada `stripTags` menjadi lazy non-greedy `\\\((?:(?!\\\))[\s\S])+?\\\)` agar rumus matematika ber-tanda kurung (seperti `\(f(x) < 3\)`) tidak kehilangan simbol `<` akibat terhapus sebagai tag HTML.
4. **[MEDIUM] Pemulihan Scroll Rumus Benar-Salah (CONSTRAINT #12):** Hapus `noScroll` pada `MatrixGridView` agar ekspresi matematika lebar di pernyataan Benar-Salah dapat digulir horizontal di perangkat mobile.
5. **[MEDIUM] Standardisasi Gutter 24px Nomor Soal Cetak A4:** Selaraskan `padding-left: 24px;` pada kelas `.item` di `src/styles/print.css` agar nomor 2-digit (`10.` s.d. `99.`) tidak menabrak naskah soal.
6. **[MEDIUM] Pemisahan Metrik Gagal pada API Ingest Commit:** Pisahkan metrik `failedQuestions` (butir soal ditolak DB) dan `failedArticles` (antrean artikel gagal total) pada respons `/api/v1/ingest/commit`.
7. **[LOW] Integrasi Dinamis Kop Cetak `printConfig`:** Sambungkan kop cetak di `bundle-print-view.tsx` dengan konfigurasi `bundle.printConfig.institutionName` dan `tagline` (ADR-0021).

---
*Cetak biru v2.0 ini merupakan acuan resmi bagi arsitek dan tim pengembang MathBank.*
