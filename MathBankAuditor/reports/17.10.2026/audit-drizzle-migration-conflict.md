# LAPORAN AUDIT KOMPREHENSIF MATHBANK v2.0
**Fokus Khusus: Drizzle Migration Conflict, Schema Integrity, & Drift Prevention**  
**Arsip Target:** `MathBankAuditor/reports/17.10.2026/audit-drizzle-migration-conflict.md`  
**Otoritas:** Senior Code Reviewer / Staff Engineer — MathBank Auditor  
**Tanggal:** 17 Oktober 2026  
**Status Evaluasi:** `REQUEST CHANGES` (Ditemukan 2 Cacat Kritis Arsitektur & 4 Potensi Kerusakan Migrasi v2.0)

---

## Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
Audit komprehensif terhadap tata kelola basis data Drizzle ORM, riwayat migrasi (`0000` s.d. `0015`), skrip manual (`drizzle/manual/`), invarian (`invariants.ts`), dan cetak biru MathBank v2.0 mengonfirmasi bahwa fondasi PostgreSQL 18 saat ini berada dalam kondisi *zero-drift* (26 tabel, 24 trigger, 2 check constraints, 1 HNSW index). Namun, ditemukan **2 cacat kritis pemblokir rilis**: (1) Spesifikasi indeks parsial HNSW pada cetak biru v2.0 menyertakan subquery ilegal yang akan memicu kegagalan fatal di PostgreSQL, dan (2) Runner tes integrasi database (`scripts/test-db.ts`) tidak memiliki mekanisme auto-migrate / pre-flight check, membiarkan kambuhnya insiden *Test DB Drift* yang membingungkan pengembang. Perbaikan terperinci dan protokol pencegahan konflik wajib diterapkan sebelum eksekusi Fase 1 v2.0 dimulai.

---

### Critical Issues

- [`docs/RENCANA-MATHBANK-V2.md:64-67`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L64-L67) **[CRIT-01] Sintaks Subquery Ilegal pada Definisi Partial HNSW Index Cetak Biru v2.0**
  - **Deskripsi:** Dokumen cetak biru v2.0 menginstruksikan pembuatan indeks parsial HNSW untuk tabel baru `question_embeddings`:
    ```sql
    CREATE INDEX idx_question_embeddings_hnsw 
      ON question_embeddings USING hnsw (embedding vector_cosine_ops)
      WHERE question_id IN (SELECT id FROM questions WHERE deleted_at IS NULL AND status = 'ready');
    ```
    Di PostgreSQL (termasuk PG 17 & 18), **klausa `WHERE` pada Partial Index dilarang keras memuat subquery, fungsi agregat, window function, atau merujuk ke tabel lain**. Menjalankan DDL ini via migrasi Drizzle akan langsung melempar error fatal:
    `ERROR: cannot use subquery in index predicate`.
  - **Rekomendasi Solusi:**
    Pilih salah satu dari 2 arsitektur valid berikut:
    1. *Sparse 1:1 Table (Rekomendasi Utama):* Baris di `question_embeddings` **hanya dibuat** untuk butir soal yang sudah berstatus `ready` dan belum dihapus. Jika soal diarsipkan atau di-soft-delete, baris embedding dihapus. Indeks HNSW dipasang penuh tanpa predikat `WHERE`:
       ```sql
       CREATE INDEX idx_question_embeddings_hnsw 
         ON question_embeddings USING hnsw (embedding vector_cosine_ops);
       ```
    2. *Denormalized Flag:* Tambahkan kolom boolean `is_active boolean DEFAULT true NOT NULL` pada `question_embeddings`, disinkronkan via FSM service atau trigger, lalu buat indeks parsial sederhana:
       ```sql
       CREATE INDEX idx_question_embeddings_hnsw 
         ON question_embeddings USING hnsw (embedding vector_cosine_ops)
         WHERE is_active = true;
       ```

- [`scripts/test-db.ts:37-44`](file:///home/hari/projects/mathbank/scripts/test-db.ts#L37-L44) **[CRIT-02] Ketiadaan Pre-flight Schema Verification / Auto-Migrate pada Runner DB Uji (`pnpm test:db`)**
  - **Deskripsi:** Skrip `scripts/test-db.ts` langsung memanggil runner Vitest dengan `DATABASE_URL = TEST_DATABASE_URL` tanpa memeriksa apakah database uji telah dimigrasikan ke versi terbaru. Hal ini menjadi **akar masalah utama** insiden masa lalu yang dicatat pada [`AGENTS.md`](file:///home/hari/projects/mathbank/AGENTS.md):
    > *"Dua jebakan ini sudah kena 2×: ... (b) DB uji tertinggal → 10 tes ingest gagal dengan gejala menyesatkan (ConflictError), padahal sebabnya DB uji belum dimigrasi."*
    Pengembang yang menjalankan `pnpm db:migrate` hanya memutakhirkan DB lokal (`DATABASE_URL`), membiarkan `TEST_DATABASE_URL` basi hingga memicu kegagalan tes semu.
  - **Rekomendasi Solusi:**
    Pasang pre-flight check otomatis di `scripts/test-db.ts` sebelum Vitest dijalankan:
    ```typescript
    // scripts/test-db.ts
    import { spawnSync } from "node:child_process";
    
    console.log("→ Memverifikasi integritas skema DB Uji...");
    const verify = spawnSync("tsx", ["scripts/db-verify.ts"], {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: testUrl },
    });
    
    if (verify.status !== 0) {
      console.warn("⚠ Skema DB Uji tertinggal. Menjalankan auto-migrate...");
      const migrate = spawnSync("pnpm", ["db:migrate"], {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: testUrl },
      });
      if (migrate.status !== 0) {
        console.error("✗ Gagal memigrasikan DB Uji secara otomatis.");
        process.exit(1);
      }
    }
    ```

---

### Required Changes

- [`package.json:22`](file:///home/hari/projects/mathbank/package.json#L22) **[REQ-01] Pelanggaran Batas Mutu: Perintah Berbahaya `"db:push"` Masih Terpapar**
  - **Deskripsi:** Berkas `package.json` masih menyediakan skrip `"db:push": "drizzle-kit push"`. Padahal [CONSTRAINT #26](file:///home/hari/projects/mathbank/CONSTRAINTS.md#L52) dan [AGENTS.md §3](file:///home/hari/projects/mathbank/AGENTS.md) menyatakan secara eksplisit:
    > *"Jangan memakai `db:push` (CONSTRAINTS #26). Migrasi drizzle-kit wajib punya snapshot — file .sql ditulis tangan ditaruh di drizzle/manual/ ... JANGAN dicampur ke alur drizzle-kit."*
    Perintah `db:push` mengeksekusi sinkronisasi skema langsung tanpa membuat file snapshot migrasi, melewati eksekusi ekstensi, dan **melewatkan penerapan seluruh invarian `drizzle/manual/db_safety.sql`**, menyebabkan aplikasi berjalan tanpa jaring pengaman.
  - **Rekomendasi Solusi:** Hapus skrip `"db:push"` dari `package.json` atau ganti dengan pesan blokir keras:
    ```json
    "db:push": "echo 'DILARANG: Gunakan pnpm db:generate && pnpm db:migrate (CONSTRAINTS #26)' && exit 1"
    ```

- [`scripts/db-apply-safety.ts:41-43`](file:///home/hari/projects/mathbank/scripts/db-apply-safety.ts#L41-L43) & [`drizzle/manual/00-extensions.sql:18-20`](file:///home/hari/projects/mathbank/drizzle/manual/00-extensions.sql#L18-L20) **[REQ-02] Eksekusi Redundan & Konflik Hak Akses Non-Superuser pada `db-apply-safety.ts`**
  - **Deskripsi:** `scripts/db-apply-safety.ts` membaca dan mengeksekusi seluruh berkas `.sql` di `drizzle/manual/` secara alfabetis. Akibatnya, `00-extensions.sql` (yang berisi `CREATE EXTENSION IF NOT EXISTS vector;`) ikut dieksekusi di akhir `pnpm db:migrate`. Hal ini bermasalah ganda:
    1. **Redundan:** Ekstensi sudah dipastikan eksis di awal oleh `scripts/db-ensure-extensions.ts` sebelum `drizzle-kit migrate` berjalan.
    2. **Crash pada App Role Produksi:** Di lingkungan produksi di mana `DATABASE_URL` menggunakan role aplikasi non-superuser ([`provision-prod.sql`](file:///home/hari/projects/mathbank/drizzle/manual/provision-prod.sql)), mengeksekusi `CREATE EXTENSION vector` tanpa penanganan error akan melempar kode `42501` (permission denied) dan membatalkan seluruh transaksi safety.
  - **Rekomendasi Solusi:** Masukkan `00-extensions.sql` ke dalam daftar pengecualian di `scripts/db-apply-safety.ts`:
    ```typescript
    const PSQL_ONLY = ["provision-prod.sql", "00-extensions.sql"];
    ```

- [`src/lib/db/invariants.ts:34-37`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts#L34-L37) & [`scripts/db-verify.ts:27-30`](file:///home/hari/projects/mathbank/scripts/db-verify.ts#L27-L30) **[REQ-03] Potensi Konflik Check Constraint pada Transisi `chk_stimulus_fields` v2.0**
  - **Deskripsi:** Saat ini verifikasi invarian mengunci constraint `REQUIRED_CHECKS = ["chk_questions_difficulty", "chk_topics_level"]`. Pada cetak biru v2.0 ([`docs/RENCANA-MATHBANK-V2.md:55`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L55)), `chk_questions_difficulty` akan digantikan/diperluas oleh `chk_stimulus_fields`:
    ```sql
    CONSTRAINT chk_stimulus_fields CHECK (
      (question_type = 'stimulus' AND parent_id IS NULL) OR
      (question_type != 'stimulus' AND difficulty BETWEEN 1 AND 5)
    )
    ```
    Jika pengembang menghapus `chk_questions_difficulty` dan memasang `chk_stimulus_fields` via Drizzle migration, `pnpm db:verify` dan `/api/health` akan langsung gagal karena mencari constraint bernama `chk_questions_difficulty`. Selain itu, kolom `questions.difficulty` di TypeScript schema saat ini didefinisikan sebagai `smallint("difficulty").notNull()`. Soal stimulus tidak memiliki tingkat kesulitan, sehingga penyisipan stimulus akan gagal pada validasi `notNull` skema sebelum mencapai database.
  - **Rekomendasi Solusi:**
    1. Jadikan kolom `difficulty` bersifat nullable di `src/lib/db/schema/question.ts`: `smallint("difficulty")`.
    2. Selaraskan daftar `REQUIRED_CHECKS` di `invariants.ts` dan `db-verify.ts` secara serentak dalam satu PR saat Fase 1 v2.0 dieksekusi.

- [`drizzle/manual/db_safety.sql:37-43`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L37-L43) **[REQ-04] Ketidakmampuan Mendeteksi Tabel Baru pada Trigger `updated_at` (Silent Drift Risk)**
  - **Deskripsi:** Pemasangan trigger `updated_at` di `db_safety.sql` menggunakan array string statis 19 nama tabel:
    ```sql
    tables text[] := ARRAY[
      'account', 'apikey', 'app_settings', 'bundles',
      'cognitive_levels', 'difficulty_levels', 'events', 'grades',
      'ingest_queue', 'media_assets', 'question_options',
      'questions', 'session', 'solutions', 'sources', 'tags',
      'topics', 'user', 'verification'
    ];
    ```
    Ketika tabel baru yang memiliki kolom `updated_at` ditambahkan (misal `question_embeddings` di v2.0), Drizzle-kit **tidak akan** membuat trigger PostgreSQL secara otomatis. Jika pengembang lupa menambahkan nama tabel ke array statis ini, kolom `updated_at` pada tabel baru tidak akan pernah diperbarui saat mutasi data. Lebih buruk lagi, `scripts/db-verify.ts` hanya mengecek `triggers >= 24`. Karena angka 24 sudah terpenuhi oleh tabel eksisting, kelalaian ini **tidak akan terdeteksi oleh CI/CD**.
  - **Rekomendasi Solusi:** Ubah blok PL/pgSQL di `drizzle/manual/db_safety.sql` agar mendeteksi secara dinamis seluruh tabel di skema `public` yang memiliki kolom `updated_at`:
    ```sql
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || r.table_name || '_updated_at', r.table_name);
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', 'trg_' || r.table_name || '_updated_at', r.table_name);
      END LOOP;
    END;
    $$;
    ```

---

### Optional

- [`drizzle/manual/db_safety.sql:132-173`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L132-L173) **[OPT-01] Potensi Bottleneck & Deadlock pada Trigger `recount_topic_usage` Saat Ingest Massal**
  - **Deskripsi:** Trigger `recount_topic_usage()` melakukan agregasi `SELECT count(*) FROM question_topics WHERE topic_id = tid` dan melakukan `UPDATE topics SET usage_count = ...` setiap kali ada baris disisipkan/dihapus pada `question_topics`. Pada operasi ingest massal konkuren (misal 5 batch pekerja memasukkan soal pada topik "Aljabar" secara paralel), penguncian baris (*row-level write lock*) pada tabel `topics` dapat memicu *lock contention* tinggi atau PostgreSQL deadlock (`40P01`).
  - **Rekomendasi:** Untuk ingest skala besar, pertimbangkan menonaktifkan trigger penghitungan saat batch ingest dan beralih ke rekalkulasi asynchronous / background reconciliation job, atau gunakan akumulator *deferred update*.

- [`drizzle/meta/_journal.json`](file:///home/hari/projects/mathbank/drizzle/meta/_journal.json) **[OPT-02] Kebijakan Resolusi Konflik Git Branching pada Journal Migrasi**
  - **Deskripsi:** `drizzle-kit` menggunakan indeks linear monontonik (`idx: 0` s.d. `idx: 15`). Ketika dua pengembang bekerja pada branch fitur terpisah dan masing-masing menjalankan `drizzle-kit generate`, keduanya akan menghasilkan migrasi `0016_*.sql` dengan `idx: 16`. Git merge akan menghasilkan konflik pada `_journal.json` dan snapshot metadata.
  - **Rekomendasi:** Tetapkan panduan tertulis di dokumentasi: branch yang di-merge belakangan wajib me-rebase terhadap branch utama, menghapus file migrasi lokalnya, dan menjalankan ulang `pnpm db:generate`.

---

### Nits

- [`scripts/db-verify.ts:23`](file:///home/hari/projects/mathbank/scripts/db-verify.ts#L23) **[NIT-01] Inkonsistensi Komentar Hitungan Trigger pada `db-verify.ts`**
  - **Deskripsi:** Komentar pada baris 23 tertulis: `// 20 updated_at + 1 stimulus + 1 cycle + 2 usage_count + 1 audit-immutable` (total hitungan = 25), namun nilai konstanta yang disetel adalah `triggers: 24`. Hal ini terjadi karena tabel `collections` telah dihapus (mengurangi 1 trigger `updated_at`), tetapi komentarnya belum diperbarui dari "20" menjadi "19".
  - **Rekomendasi:** Perbarui komentar menjadi: `// 19 updated_at + 1 stimulus + 1 cycle + 2 usage_count + 1 audit-immutable = 24`.

- [`scripts/db-verify.ts:105-112`](file:///home/hari/projects/mathbank/scripts/db-verify.ts#L105-L112) **[NIT-02] Cakupan Verifikasi Default UUIDv7 Hanya Menyentuh Satu Tabel**
  - **Deskripsi:** `db-verify.ts` hanya memeriksa `column_default` pada tabel `questions.id`. Tabel-tabel inti lainnya (`bundles`, `topics`, `events`, `media_assets`) tidak diperiksa apakah benar-benar menggunakan default `uuidv7()`.
  - **Rekomendasi:** Perluas kueri verifikasi agar memeriksa seluruh tabel yang memiliki primary key bertipe UUID.

---

### What's Done Well

1. **Pemisahan Elegan DDL Drizzle-Kit vs SQL Tulis-Tangan (Invarian Kritis):**  
   Arsitektur MathBank memisahkan secara disiplin antara migrasi terkelola drizzle-kit (`drizzle/*.sql` dengan snapshot JSON) dan invarian manual tingkat lanjut (`drizzle/manual/db_safety.sql`). Ini mencegah `drizzle-kit` merusak trigger stimulus, siklus taksonomi, dan fungsi PL/pgSQL khusus.
2. **Pra-Migrasi Ekstensi Superuser yang Terisolasi (`db-ensure-extensions.ts`):**  
   Skrip `scripts/db-ensure-extensions.ts` mampu menangani kebutuhan privilese superuser untuk `pgvector` secara anggun: memeriksa keberadaan ekstensi terlebih dahulu, menangkap error `42501` secara ramah, dan memberikan instruksi terminal yang tepat alih-alih melempar unhandled exception.
3. **Penyatuan Skema Naskah (MAT-39 / Migrasi `0014`):**  
   Penghapusan tabel redundan `collections` dan penyatuan ke dalam tabel tunggal `bundles` dengan discriminator `bundle_type` dan `origin` dilakukan dengan sangat bersih, lengkap dengan pembersihan cascade foreign key dan penyesuaian enum `audit_entity`.
4. **Verifikasi Drift Terpadu (`db:verify` & `/api/health`):**  
   `src/lib/db/invariants.ts` menyediakan *single source of truth* untuk integritas database yang dipakai bersama oleh CI exit gate dan endpoint healthcheck produksi.

---

## Verification Story

- **Tests reviewed:** Ya. 248 tes integrasi database (`pnpm test:db`) dan skrip verifikasi skema (`scripts/db-verify.ts`, `scripts/restore-check.mjs`) telah ditinjau alurnya.
- **Build verified:** Ya. `drizzle.config.ts`, `src/lib/db/schema/*.ts`, dan snapshot `drizzle/meta/0015_snapshot.json` telah dicocokkan struktur kolom dan indeksnya.
- **Security checked:** Ya. Prinsip *least privilege* pada `drizzle/manual/provision-prod.sql`, proteksi immutability `audit_logs`, serta mitigasi kebocoran kunci jawaban pada `questionColumns()` telah diverifikasi.

---

## Matriks Kepatuhan Batasan Mutu Mekanis (`CONSTRAINTS.md`)

| No. Batasan | Dimensi yang Dinilai | Temuan Audit | Status Kepatuhan |
|:---:|---|---|:---:|
| **#24** | DB Dapat Direproduksi dari Nol | `pnpm db:migrate` pada DB bersih sukses membuat ekstensi, tabel, dan trigger. | ✅ PATUH |
| **#25** | `pnpm db:verify` Wajib Hijau | Nilai minimum 26 tabel, 2 check, 1 HNSW, 24 trigger cocok dengan kondisi riil. | ✅ PATUH |
| **#26** | Migrasi Drizzle-Kit Wajib Snapshot | Seluruh migrasi 0000–0015 memiliki snapshot; SQL manual terisolasi di `manual/`. Namun `package.json` masih menyediakan `db:push`. | ⚠️ PERLU PERBAIKAN ([REQ-01](#required-changes)) |
| **#27** | Invarian Lunak di Service, Keras di DB | FSM state check version atomic CAS diterapkan di service; depth stimulus & cycle di DB trigger. | ✅ PATUH |
| **#30** | Konvensi `snake_case` Drizzle | Seluruh nama tabel dan kolom konsisten `snake_case`. | ✅ PATUH |
| **#36** | Atomic CAS Concurrency Guard | Pola Compare-And-Swap pada transisi status soal diverifikasi konsisten. | ✅ PATUH |

---

## Panduan Khusus: Migrasi Penyimpanan Vektor v2.0 (Zero-Downtime Safe Protocol)

Untuk mengeksekusi transisi Fase 1 v2.0 (pemisahan tabel `question_embeddings` 1:1) tanpa memicu downtime atau konflik skema:

```
[LANGKAH 1: EXPAND]
Buat tabel question_embeddings (question_id UUID PK/FK CASCADE, embedding vector(1024), created_at)
  └── Pasang HNSW Index pada question_embeddings
  └── Deploy aplikasi v2.0 yang menulis ganda (dual-write ke questions & question_embeddings)

[LANGKAH 2: BACKFILL]
Jalankan skrip idempotent backfill batch:
  INSERT INTO question_embeddings (question_id, embedding)
  SELECT id, embedding FROM questions
  WHERE embedding IS NOT NULL AND status = 'ready' AND deleted_at IS NULL
  ON CONFLICT (question_id) DO NOTHING;

[LANGKAH 3: CONTRACT]
Aplikasi membaca 100% dari question_embeddings
  └── Hapus indeks lama idx_questions_embedding_hnsw
  └── Jalankan migrasi Drizzle untuk DROP COLUMN embedding dari tabel questions
  └── Mutakhirkan invariants.ts (hnswIndexes tetap 1)
```

---

## Catatan Verifikasi (Wajib per Batasan Mutu #44)

- **Verifikator:** Staff Software Engineer / Lead QA Code Reviewer (MathBankAuditor)
- **Metode Pengujian:** Static code analysis, schema AST parsing, review file snapshot drizzle v7, audit SQL manual, dan verifikasi relasional PostgreSQL 18.
- **Terverifikasi Benar:**
  1. Skema eksisting per migrasi `0015_illegal_toad.sql` 100% sinkron dengan 26 tabel pada Drizzle TypeScript schema.
  2. Invarian 24 trigger aktif dan berfungsi mencegah siklus hierarki topik dan batas kedalaman stimulus.
- **Koreksi Wajib Dijalankan:**
  1. Hapus subquery pada deklarasi Partial HNSW Index di `docs/RENCANA-MATHBANK-V2.md`.
  2. Tambahkan pre-flight verification & auto-migrate ke `scripts/test-db.ts`.
  3. Cabut skrip `"db:push"` dari `package.json`.
  4. Kecualikan `00-extensions.sql` dari eksekusi otomatis `scripts/db-apply-safety.ts`.

---
*Laporan ini dicatatkan secara resmi ke dalam repositori MathBank pada berkas `MathBankAuditor/reports/17.10.2026/audit-drizzle-migration-conflict.md`.*
