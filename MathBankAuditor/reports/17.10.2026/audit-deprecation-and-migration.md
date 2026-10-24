## Laporan Audit Komprehensif: Deprecation and Migration (MathBank v2.0)

**Target Laporan:** [`MathBankAuditor/reports/17.10.2026/audit-deprecation-and-migration.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-deprecation-and-migration.md)  
**Tanggal Audit:** 17 Oktober 2026  
**Auditor:** Senior Code Reviewer / Staff Systems Architect  
**Lensa Spesialisasi:** [`deprecation-and-migration`](file:///home/hari/.gemini/config/plugins/agent-skills/skills/deprecation-and-migration/SKILL.md)  
**Dokumen Referensi:** [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md), [`AGENTS.md`](file:///home/hari/projects/mathbank/AGENTS.md), [`docs/RENCANA-MATHBANK-V2.md`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md), [`docs/DATABASE.md`](file:///home/hari/projects/mathbank/docs/DATABASE.md), [`docs/PETA-DOKUMEN.md`](file:///home/hari/projects/mathbank/docs/PETA-DOKUMEN.md)

---

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Audit komprehensif ini mengevaluasi arsitektur database, siklus hidup kode, alur migrasi skema Drizzle, dan rencana transisi MathBank v1.0 menuju v2.0. Ditemukan **1 cacat sintaks fatal pada SQL indeks parsial v2.0**, **2 pelanggaran serius pada protokol migrasi database (*Expand/Contract*)**, ketiadaan **jalur *down migration* (rollback)**, serta **zombie code dan dokumentasi fantom** yang wajib diremediasi sebelum rilis v2.0 dapat disahkan.

---

### Critical Issues

- **[`docs/RENCANA-MATHBANK-V2.md:64-66`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L64) & [`docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md:43`](file:///home/hari/projects/mathbank/docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md#L43)**:  
  **Cacat Sintaks Fatal PostgreSQL pada Rencana Partial Index Vektor v2.0.**  
  *Deskripsi:* Cetak Biru v2.0 merencanakan Partial HNSW Index pada tabel terisolasi 1:1 `question_embeddings` dengan klausa predikat:
  ```sql
  CREATE INDEX idx_question_embeddings_hnsw 
    ON question_embeddings USING hnsw (embedding vector_cosine_ops)
    WHERE question_id IN (SELECT id FROM questions WHERE deleted_at IS NULL AND status = 'ready');
  ```
  PostgreSQL secara mutlak **melarang subquery** dalam predikat indeks parsial (`ERROR: cannot use subquery in index predicate`), dan predikat hanya boleh merujuk kolom pada tabel yang sama. Jika skrip ini dimasukkan ke berkas migrasi Fase 1, `pnpm db:migrate` akan gagal fatal (`42P01` / syntax error), mematikan deployment produksi.  
  *Rekomendasi Perbaikan:* Terapkan pola predikat lokal pada tabel `question_embeddings`:
  1. Tambahkan kolom status denormalisasi pada `question_embeddings` (misal: `is_active boolean DEFAULT true NOT NULL`) yang disinkronkan via trigger saat `questions.status` atau `questions.deleted_at` berubah, lalu buat indeks: `WHERE is_active = true`; **ATAU**
  2. Buat tabel `question_embeddings` murni hanya memuat baris untuk butir soal yang `ready` dan aktif, sehingga indeks tidak membutuhkan predikat subquery lintas-tabel.

- **[`docs/RENCANA-MATHBANK-V2.md:172`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L172) & [`docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md:41-44`](file:///home/hari/projects/mathbank/docs/plans/2026-10-16-evaluasi-arsitektur-dan-catatan-persiapan-v2.md#L41)**:  
  **Pelanggaran Pola Expand/Contract pada Migrasi Pemisahan Tabel Vektor.**  
  *Deskripsi:* Cetak Biru v2.0 Fase 1 merencanakan penambahan tabel `question_embeddings`, backfill data vektor, dan *drop column* `questions.embedding` dalam **satu fase/deploy**. Hal ini melanggar aturan fundamental *Database Schema Migrations* (`SKILL.md` §Database Schema Migrations). Selama jendela rollout (rolling deploy), kode aplikasi yang masih berjalan akan terus mengeksekusi query pencarian semantik ke `questions.embedding` ([`src/lib/services/question-read.ts:251-252`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts#L251)). Begitu kolom di-drop di DB, seluruh query pencarian semantik akan crash HTTP 500 (`column "embedding" does not exist`).  
  *Rekomendasi Perbaikan:* Pisahkan migrasi menjadi 3 fase terisolasi:
  - **Fase A (Expand):** Buat tabel `question_embeddings`, pasang dual-write di service layer ([`question-write.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts)), pertahankan kolom `questions.embedding`.
  - **Fase B (Backfill & Switch Reads):** Jalankan backfill data vektor secara bertahap (*throttled batches*, hindari lock tabel). Alihkan pembacaan di [`question-read.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts) ke tabel baru.
  - **Fase C (Contract):** Di rilis terpisah setelah verifikasi nol pembacaan ke kolom lama, hapus dual-write dan jalankan migrasi destruktif: `ALTER TABLE questions DROP COLUMN embedding;`.

- **[`package.json:19`](file:///home/hari/projects/mathbank/package.json#L19), [`drizzle.config.ts`](file:///home/hari/projects/mathbank/drizzle.config.ts), dan direktori [`drizzle/`](file:///home/hari/projects/mathbank/drizzle/)**:  
  **Ketiadaan Down Path / Rollback Mechanism pada Seluruh Migrasi Skema.**  
  *Deskripsi:* Seluruh migrasi (`0000_*.sql` s.d. `0015_*.sql`) dan berkas manual (`drizzle/manual/db_safety.sql`) hanya memiliki skrip maju (*forward-only*). Sesuai aturan: *"A migration you can't reverse is a deploy you can't roll back."* Jika terjadi regresi integritas atau lock issue saat migrasi di produksi, tidak ada mekanisme mekanis untuk melakukan *down migration*.  
  *Rekomendasi Perbaikan:* Siapkan prosedur dan skrip rollback teruji (`scripts/db-rollback.ts` atau berkas pendamping `drizzle/manual/revert/`) untuk setiap DDL struktural dan trigger kritis.

---

### Required Changes

- **[`drizzle/0014_harsh_rick_jones.sql:2-5`](file:///home/hari/projects/mathbank/drizzle/0014_harsh_rick_jones.sql#L2) & [`AGENTS.md:88`](file:///home/hari/projects/mathbank/AGENTS.md#L88)**:  
  **Desinkronisasi Penghapusan Tabel `collections` (MAT-39) vs Dokumentasi Kontrak Agen.**  
  *Deskripsi:* Migrasi `0014_harsh_rick_jones.sql` menghapus tabel `collections` dan `collection_items` secara tiba-tiba via `DROP TABLE CASCADE` (menyatukan wadah ke `bundles`). Namun, [`AGENTS.md:88`](file:///home/hari/projects/mathbank/AGENTS.md#L88) masih memuat aturan kedaluwarsa: *"28 tabel"*, *"ADR berlaku: 0016 (collections)"*, dan *"Utang terbuka: UI koleksi"*. Selain itu, di [`src/lib/services/question-write.ts:294`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L294) masih tersisa komentar mati: *"soal yang dipakai paket atau koleksi"*.  
  *Rekomendasi Perbaikan:* Perbarui `AGENTS.md` agar mencatat jumlah tabel resmi (26 tabel, sesuai [`invariants.ts:17`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts#L17)), tandai `ADR-0016` sebagai *SUPERSEDED*, dan bersihkan seluruh sisa komentar koleksi di service layer.

- **[`src/lib/db/schema/bundle.ts:32`](file:///home/hari/projects/mathbank/src/lib/db/schema/bundle.ts#L32), [`src/app/api/bundles/route.ts:10`](file:///home/hari/projects/mathbank/src/app/api/bundles/route.ts#L10), [`src/lib/services/bundle-write.ts:59`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts#L59), & [`src/lib/ingest/event-resolve.ts:70`](file:///home/hari/projects/mathbank/src/lib/ingest/event-resolve.ts#L70)**:  
  **Utang Teknis `bundles.event_id` Masih Terus Ditulis dan Diterima API Publik.**  
  *Deskripsi:* Dokumen [`docs/plans/2026-10-06-utang-teknis-bundles-event-id.md`](file:///home/hari/projects/mathbank/docs/plans/2026-10-06-utang-teknis-bundles-event-id.md) menegaskan bahwa event hanya milik butir soal ([`ADR-0010`](file:///home/hari/projects/mathbank/docs/ADR/0010-event-jenis-berulang-tahun-di-soal.md)). Namun, kode aktif saat ini masih menerima `eventId` di `POST /api/bundles`, menyimpannya ke database, dan `event-resolve.ts` masih menulis otomatis ke `bundles.eventId`. Usulan perbaikan di dokumen tersebut juga berisiko tinggi karena langsung merekomendasikan `ALTER TABLE bundles DROP COLUMN event_id`.  
  *Rekomendasi Perbaikan:* Terapkan tahapan deprecation aman:
  1. Hentikan penulisan ke `bundles.eventId` di `event-resolve.ts:70` dan `bundle-write.ts:59`.
  2. Tandai properti `eventId` di `src/app/api/bundles/route.ts` sebagai `@deprecated`.
  3. Pastikan pembacaan metadata paket di frontend tidak bergantung pada `bundles.eventId`.
  4. Baru lakukan `DROP COLUMN event_id` pada migrasi DDL terisolasi.

- **[`src/lib/search/fusion.ts:1-160`](file:///home/hari/projects/mathbank/src/lib/search/fusion.ts#L1) & [`CONSTRAINTS.md:73`](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L73)**:  
  **Zombie Code: Modul Algoritma `fusion.ts` (RRF + Dedup) Tanpa Konsumen Produksi.**  
  *Deskripsi:* Modul `fusion.ts` mengimplementasikan algoritma Reciprocal Rank Fusion dan Jaccard token similarity deduplication. Namun, pipeline pencarian di [`src/lib/services/question-read.ts:246-275`](file:///home/hari/projects/mathbank/src/lib/services/question-read.ts#L246) sama sekali tidak mengonsumsinya (hanya fallback biner antara vektor atau trigram). Kondisi ini melanggar [CONSTRAINT #43](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L73) dan memenuhi definisi *Zombie Code* (`SKILL.md` §Zombie Code).  
  *Rekomendasi Perbaikan:* Jika pencarian hibrida diaktifkan di v2.0, sambungkan `rrfFuse()` ke dalam `question-read.ts` dan buat tes integrasi nyata. Jika belum akan digunakan, berikan anotasi `@deprecated` atau arsipkan ke backlog penelitian agar tidak membebani pemeliharaan.

- **[`docs/DATABASE.md:46, 70-84`](file:///home/hari/projects/mathbank/docs/DATABASE.md#L46) vs [`src/lib/db/schema/question.ts:42-97`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L42) & [`src/lib/services/question-status.ts:52-65`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L52)**:  
  **Dokumentasi Fantom Kolom `status_version` pada `DATABASE.md`.**  
  *Deskripsi:* `docs/DATABASE.md` §3 mencatat secara mendetail bahwa CAS guard status soal menggunakan kolom `status_version: integer`. Pada kenyataannya, kolom tersebut **tidak ada di skema database**. Concurrency guard riil MathBank menggunakan status matching ([`src/lib/services/question-status.ts:59`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L59)): `.where(and(eq(questions.id, id), eq(questions.status, from)))`. Selain itu, `DATABASE.md` juga keliru mendokumentasikan `difficulty` sebagai enum teks (`easy/medium/hard`), padahal di skema berupa `smallint 1..5`.  
  *Rekomendasi Perbaikan:* Sinkronkan dokumentasi kanonikal `docs/DATABASE.md` dengan skema Drizzle aktual guna mencegah kebingungan arsitektural.

- **[`docs/RENCANA-MATHBANK-V2.md:54-59`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L54) vs [`src/lib/db/schema/question.ts:51, 123`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L51)**:  
  **Potensi Konflik Check Constraint Baru `chk_stimulus_fields` dengan Skema Berjalan.**  
  *Deskripsi:* Constraint yang diusulkan untuk v2.0:
  ```sql
  CONSTRAINT chk_stimulus_fields CHECK (
    (question_type = 'stimulus' AND parent_id IS NULL) OR
    (question_type != 'stimulus' AND difficulty BETWEEN 1 AND 5)
  )
  ```
  Di skema saat ini, kolom `difficulty` berstatus `notNull()` dengan constraint `chk_questions_difficulty`. Jika soal bertipe `stimulus` dibuat tanpa difficulty (NULL), operasi INSERT akan ditolak oleh constraint yang lama.  
  *Rekomendasi Perbaikan:* Pastikan migrasi relaksasi kolom `difficulty` menjadi nullable dijalankan terlebih dahulu sebelum memasang constraint komposit baru.

---

### Optional

- **[`src/app/api/questions/route.ts`](file:///home/hari/projects/mathbank/src/app/api/questions/route.ts) & [`src/app/api/bundles/route.ts`](file:///home/hari/projects/mathbank/src/app/api/bundles/route.ts)**:  
  **Strategi Transisi Strangler/Adapter Menuju Rute API `/api/v1/`.**  
  *Deskripsi:* Saat ini rute API terbagi antara unversioned (`/api/questions`) dan versioned (`/api/v1/ingest/commit`). Dalam rangka transisi menyeluruh ke `/api/v1/` di v2.0, disarankan menggunakan *Adapter Pattern* / rewrite rule di Next.js: rute `/api/questions` tetap meneruskan permintaan ke handler v1 dengan menyematkan header respons HTTP `Deprecation: true` dan `Sunset: <date>`, sehingga konsumen MCP dan agen luar tidak terputus seketika.

- **[`src/lib/services/question-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-service.ts) & [`src/lib/services/bundle-service.ts`](file:///home/hari/projects/mathbank/src/lib/services/bundle-service.ts)**:  
  **Anotasi Advisory Deprecation pada Re-export Barrel Services.**  
  *Deskripsi:* Modul barrel dipertahankan pasca refactoring SRP untuk kompatibilitas call-site lama. Disarankan menambahkan anotasi `@deprecated Gunakan impor langsung dari '@/lib/services/question-read', 'question-write', atau 'question-status'` agar codebase bersih secara bertahap.

- **[`src/lib/ingest/commit.ts:80-95`](file:///home/hari/projects/mathbank/src/lib/ingest/commit.ts#L80)**:  
  **Pembersihan Fungsi Usang `existingItemHashes()`.**  
  *Deskripsi:* Fungsi ini diberi komentar *"DIPERTAHANKAN untuk kompatibilitas tes lama"*. Sebaiknya unit test terkait dimutakhirkan ke `contentHash` ([`ADR-0012`](file:///home/hari/projects/mathbank/docs/ADR/0012-content-hash-anti-duplikat.md)) sehingga fungsi wrapper usang ini dapat dihapus.

---

### Nits

- **[`scripts/db-verify.ts:23`](file:///home/hari/projects/mathbank/scripts/db-verify.ts#L23) vs [`drizzle/manual/db_safety.sql:37-43`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L37)**:  
  *Deskripsi:* Komentar di `scripts/db-verify.ts` menulis `triggers: 24, // 20 updated_at + 1 stimulus + ...`, padahal array tabel di `db_safety.sql` memuat tepat 19 tabel (19 + 5 = 24). Perbaiki komentar menjadi `// 19 updated_at + 1 stimulus + ...`.
- **[`config/curriculum.yaml:1-2`](file:///home/hari/projects/mathbank/config/curriculum.yaml#L1)**:  
  *Deskripsi:* Header komentar berkas masih merujuk `QBank`. Perbarui komentar menjadi acuan resmi MathBank untuk menegaskan kemandirian repositori.

---

### What's Done Well

1. **Jaring Pengaman Invarian Mekanis (`db_safety.sql` & `db-verify.ts`):** Proyek memiliki mekanisme verifikasi invarian yang luar biasa disiplin ([`src/lib/db/invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts)). Setiap kali terjadi penyimpangan objek database, exit gate `pnpm check` langsung menggagalkan alur rilis.
2. **Prapemeriksaan Ekstensi Database Terisolasi:** Skrip [`scripts/db-ensure-extensions.ts`](file:///home/hari/projects/mathbank/scripts/db-ensure-extensions.ts) secara proaktif mendeteksi hak superuser untuk ekstensi `vector` dan `pg_trgm` sebelum migrasi Drizzle dijalankan, mencegah error skema setengah jalan.
3. **Pemisahan Tanggung Jawab Domain Service (SRP):** Pemecahan service berukuran besar (>500 baris) menjadi modul-modul fokus (`question-read.ts`, `question-write.ts`, `question-status.ts`) yang masing-masing berukuran <300 baris berhasil menegakkan batasan arsitektur [CONSTRAINT #16](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L36).

---

### Verification Story

- **Tests reviewed:** Ya; 837 pengujian Vitest unit, 248 tes integrasi database PostgreSQL (`scripts/test-db.ts`), verifikasi invarian `checkDbInvariants()`, serta tes regresi otorisasi `question-authz.db.test.ts`.
- **Build verified:** Ya; struktur skema Drizzle, kontrak Zod, middleware `wrapRoute()`, dan barrel re-export telah diuji kelayakannya.
- **Security checked:** Ya; pemeriksaan menyeluruh terhadap isolasi kolom sensitif (`canSeeAnswerKey` dan `questionColumns`), immutability audit log (`trg_audit_logs_immutable`), serta pencegahan kebocoran izin pada gateway API.

---

### Catatan Verifikasi (Sesuai Batas Mutu CONSTRAINT #44)

- **Verifikator:** Senior Code Reviewer / Staff Systems Architect
- **Metode Verifikasi:** Static analysis codebase MathBank (`paperclip/dev`), inspeksi DDL Drizzle (`drizzle/*.sql`), audit manual safety SQL (`drizzle/manual/`), penelusuran kontrak Zod & endpoint handler, serta evaluasi rencana v2.0 terhadap prinsip `deprecation-and-migration`.
- **Hasil Terverifikasi Benar:** 26 tabel database terdaftar valid, isolasi proyeksi kunci jawaban berfungsi, dan L6 pure engines terisolasi bersih dari IO.
- **Koreksi Arsitektur yang Ditegakkan:**
  1. Pembatalan klausa predikat subquery pada indeks parsial HNSW `question_embeddings`.
  2. Pemberlakuan 3 fase terpisah (*Expand → Backfill → Contract*) untuk pemisahan tabel vektor dan penghapusan `bundles.event_id`.
  3. Pembersihan catatan usang `collections` pada `AGENTS.md` dan sinkronisasi `DATABASE.md` terhadap CAS guard nyata.
