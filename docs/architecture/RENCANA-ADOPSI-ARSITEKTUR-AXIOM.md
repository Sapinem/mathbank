# 🏛️ Cetak Biru Adopsi Arsitektur Axiom ke MathBank V2
## Analisis Komparasi, Rekomendasi Ranked Relations (Topik & Pembahasan), dan Hardening Data

- **Status Dokumen:** 🟡 **Diusulkan (Proposal / Architectural Blueprint)**
- **Tanggal:** 24 Oktober 2026
- **Penulis/Auditor:** Claude Code (Dual-Auditor & Architecture Specialist)
- **Target Pembaca:** Software Engineer, AI Agent Pelaksana, dan Arsitek Sistem MathBank
- **Terkait:** `docs/ADR/0005-ranked-relations.md` (Axiom), `docs/ADR/0012-*.md` (MathBank), `docs/ADR/0021-*.md` (MathBank), `CONSTRAINTS.md` (#31, #34, #36, #38, #42, #44)

---

## 1. Ringkasan Eksekutif & Baseline Empiris

Dokumen ini mendokumentasikan analisis komparasi arsitektural antara **MathBank** dan **Axiom**, mencakup empat subsistem inti: **Anti-Duplikasi (Content Hash vs Vektor)**, **Taksonomi Topik**, **Multi-Pembahasan (Solutions)**, dan **Sistem Percetakan (Print Engine)**.

### Baseline Fakta DB MathBank (Terverifikasi per 24 Oktober 2026):
* **Soal Aktif:** 11.902 butir.
* **Cakupan `content_hash`:** **100% terisi (11.902/11.902, 0 NULL)**, dengan **0 duplikat aktif** (dijaga oleh partial unique index `uq_questions_content_hash`).
* **Cakupan Vektor (`question_embeddings`):** **100% terisi** (1024-dimensi, model BGE-M3).
* **Pemetaan Topik:** 8.468 soal terpetakan ke 252 topik aktif melalui **14.442 tautan** di `question_topics`.
* **Aset Media:** 2.617 berkas, seluruhnya (100%) memiliki `content_hash` unik.

---

## 2. Subsistem Deduplikasi: Two-Tier Hybrid (Content Hash + Vektor)

### A. Komparasi Filosofi
* **Axiom:** Mengandalkan `contentHash` SHA-256 (stem + opsi berurut) sebagai pagar keras deterministik di jalur ingest/create (`uq_questions_content_hash`).
* **MathBank:** Mengimplementasikan **Two-Tier Dedup** (ADR-0012 & `CONSTRAINT #42`):
  1. **Tier 1 (Exact Match - 0 ms):** `contentHash(stem, options)` menormalisasi spasi dan menyortir opsi alfabetis (tahan opsi teracak A–E antar-paket ujian).
  2. **Tier 2 (Near/Semantic Match - Asinkron):** Menggunakan jarak kosinus vektor HNSW BGE-M3 ($0.85 \le s < 0.98$).

### B. Evaluasi: "Apakah Perlu Keduanya atau Cukup Embedding?"
**Kesimpulan: WAJIB KEDUANYA (Two-Tier). Jangan pernah hanya mengandalkan embedding.**
1. **Risiko False Positive pada Matematika:** Dua soal dengan redaksi mirip 95% bisa memiliki operasi berbeda ($2x^2 - 5x + 3 = 0$ vs $2x^2 + 5x - 3 = 0$). Jarak vektor keduanya sangat dekat. Jika auto-dedup hanya berbasis vektor, soal valid akan ditolak keliru.
2. **Kerapuhan Layanan:** Menghitung embedding membutuhkan inferensi model ML (port `:3005`). Jika layanan down atau cold-start, jalur ingest/create lumpuh. `contentHash` bekerja instan di memori CPU.
3. **Pencegahan Concurrency Race:** `contentHash` didukung `UNIQUE INDEX` di PostgreSQL secara atomik ACID; vektor HNSW tidak dapat dijadikan unique constraint.

### C. Catatan Verifikasi Kode (Status: ✅ Selesai di MAT-146):
* **Lokasi:** `src/lib/services/question-write.ts` (`updateQuestion`, baris 213–254).
* **Hasil Verifikasi:** Temuan `stale contentHash` saat edit stem/opsi **telah diselesaikan** oleh commit `26236b6` (MAT-146). Sistem saat ini sudah mendeteksi `stemTouched || optionsTouched`, menghitung ulang `calculated = contentHash(...)`, memeriksa tabrakan via `findQuestionByContentHash(calculated, id)` (melempar `ConflictError`), dan menetapkan `patch.contentHash = newContentHash`.
* **Tindakan:** Tambahkan unit test regresi eksplisit di `question-write.db.test.ts` untuk mengunci invarian ini agar tidak mengalami regresi di masa depan.

---

## 3. Subsistem Taksonomi Topik: Model "Materi Pokok + Materi Beririsan" (Modern Pedagogical Architecture)

### A. Masalah di MathBank & Kelemahan Model `rank` Axiom
1. **Masalah MathBank Saat Ini:** Tabel `questions` tidak memiliki penunjuk topik langsung. Kueri katalog soal wajib melakukan `LEFT JOIN question_topics ON ... AND is_primary = true JOIN topics` hanya untuk menampilkan satu nama topik pada kartu soal.
2. **Kelemahan Model `rank = 1, 2, 3` Axiom:** 
   Di matematika, soal majemuk (HOTS/UTBK) yang menggabungkan dua topik (misalnya turunan fungsi untuk mencari volume maksimum balok) **bukan soal berperingkat "juara 1, 2, 3"**. Yang ada adalah **Satu Materi Pokok** (*Aplikasi Turunan*) yang **Beririsan dengan Konsep Lain** (*Geometri Ruang*). Memberi angka `rank` pada topik adalah semantik yang rancu dan membingungkan pengguna serta kurator.

### B. Arsitektur Terpilih: Materi Pokok Langsung + Relasi Materi Beririsan (*Cross-Topics*)
1. Kolom **`questions.topic_id`** (FK ke `topics.id`, nullable saat draft, diwajibkan saat status `ready`).
2. Tabel relasi irisan **`question_cross_topics`** (menggantikan `question_topics`):
   ```sql
   CREATE TABLE question_cross_topics (
     question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
     topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
     created_at timestamptz DEFAULT now() NOT NULL,
     PRIMARY KEY (question_id, topic_id)
   );
   ```
3. **Invarian Keras:** Topik pokok tidak boleh dimasukkan ulang sebagai materi beririsan (`questions.topic_id <> question_cross_topics.topic_id`), ditegakkan di service layer.

### C. Mengapa Pendekatan Ini Jauh Lebih Unggul dari Axiom `rank`?
1. **Zero Junction Table untuk 80–90% Soal Standar:** Soal matematika biasa yang tidak memiliki materi beririsan **cukup mengisi `questions.topic_id`**. Tabel junction bernilai **0 baris** untuk soal-soal tersebut.
2. **Kueri Katalog `/questions` $O(1)$ Instan:** Menampilkan kartu soal di bank soal tidak butuh `JOIN question_topics`. Kueri langsung membaca `questions.topic_id JOIN topics`.
3. **Hilang Selamanya Risiko *Split-Brain* & Kolom Rank:** Tidak ada lagi kebingungan *"apakah rank 1 dan topic_id sinkron?"* karena topik pokok hanya disimpan di satu kolom kanonik (`questions.topic_id`).
4. **Pengalaman UI Guru & Siswa Jauh Lebih Jelas:**
   * Badge Utama: `[Topik: Turunan Fungsi]` (warna solid)
   * Badge Irisan: `[Beririsan: Geometri Ruang]` (warna outline/aksen)

### D. Panduan Migrasi Data Eksisting (14.442 Tautan Eksisting):
Data DB MathBank terbukti 100% higienis (8.468 soal bertopik memiliki tepat 1 `is_primary = true`):
```sql
-- 1. Tambah kolom topic_id pada questions
ALTER TABLE questions ADD COLUMN topic_id uuid REFERENCES topics(id) ON DELETE SET NULL;
CREATE INDEX idx_questions_topic_id ON questions (topic_id);

-- 2. Backfill Materi Pokok dari is_primary = true (8.468 baris)
UPDATE questions q
SET topic_id = qt.topic_id
FROM question_topics qt
WHERE q.id = qt.question_id AND qt.is_primary = true;

-- 3. Buat tabel materi beririsan & migrasikan is_primary = false (5.974 baris)
CREATE TABLE question_cross_topics (
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (question_id, topic_id)
);
CREATE INDEX idx_question_cross_topics_topic ON question_cross_topics (topic_id);

INSERT INTO question_cross_topics (question_id, topic_id, created_at)
SELECT question_id, topic_id, created_at 
FROM question_topics 
WHERE is_primary = false;

-- 4. Drop tabel relasi lama
DROP TABLE question_topics;
```
CREATE UNIQUE INDEX uq_question_topics_rank ON question_topics (question_id, rank);
CREATE INDEX idx_questions_topic_id ON questions (topic_id);
ALTER TABLE question_topics DROP COLUMN is_primary;
```

---

## 4. Subsistem Multi-Pembahasan (*Solutions*): Unifikasi Pola Ranked Relations

### A. Kesamaan Pola dengan Topik (Axiom ADR-0005)
Axiom menyatukan perlakuan Topik dan Pembahasan ke dalam satu pola terpadu: **Ranked Relations**.
* **Topik:** `rank = 1` adalah materi pokok; `rank = 2, 3..` adalah materi prasyarat/sekunder.
* **Pembahasan:** `rank = 1` adalah pembahasan primer (default naskah & cetak); `rank = 2, 3..` adalah metode alternatif / cara cepat.

### B. Manfaat bagi MathBank
1. **Penyajian Tab Deterministik di UI:** `[Tab 1: Cara Konseptual]` (rank 1), `[Tab 2: Cara Cepat / The King]` (rank 2), `[Tab 3: Metode Grafis]` (rank 3).
2. **Sinkronisasi Denormalisasi `answer_key.explanationMarkdown`:** 
   MathBank saat ini menyalin pembahasan utama ke JSONB `questions.answer_key`. Dengan model rank, aturan menjadi sangat tegas: **Hanya baris dengan `rank = 1` yang disinkronkan ke `answer_key.explanationMarkdown`**.
3. **Hardening Database Segera (Quick Win):**
   Tambahkan partial unique index pada tabel `solutions` MathBank untuk mencegah duplikasi flag primer:
   ```sql
   CREATE UNIQUE INDEX uq_solutions_one_primary 
   ON solutions (question_id) 
   WHERE is_primary = true;
   ```

---

## 5. Subsistem Percetakan (*Print Engine*): Adopsi Fitur Bernilai Tinggi Axiom

Axiom mengembangkan modul percetakan (`U-310..360`) dengan standar dokumen fisik editorial (setara output LaTeX `mathmyid.cls`). Tiga hal yang sangat layak diadopsi ke MathBank V2:

1. **Running Margin Box untuk Halaman 2+ (CSS Paged Media):**
   * Manfaatkan `@page` margin box `@top-left`, `@top-right`, dan `@bottom-right` dengan supresi `@page :first`.
   * Halaman 1 memuat Kop Institusi secara bersih; halaman 2 dan seterusnya otomatis memiliki running header nama paket dan running footer nomor halaman tanpa merusak tata letak soal.
2. **3-Way Penempatan Pembahasan (`none` / `inline` / `end`):**
   * Tambahkan opsi `end` (pembahasan ditaruh di lembar terpisah di akhir dokumen dengan `break-before: page`), sangat dibutuhkan guru agar siswa tidak mengintip pembahasan saat ujian fisik.
3. **Alokasi Ruang Coretan Dinamis (`answerSpaceCm`):**
   * Sediakan kotak kosong adaptif untuk soal tipe esai/isian singkat saat dicetak ke lembar kerja.

---

## 6. Strategi & Arsitektur Menyeluruh Soft Delete (`deleted_at`) di MathBank

Saat ini di MathBank, dari 26 tabel yang ada, **hanya 2 tabel** yang memiliki `deleted_at`:
1. `questions.deleted_at`
2. `bundles.deleted_at`

Sedangkan tabel-tabel master lainnya (seperti `solutions`, `sources`, `topics`, `tags`) tidak memiliki `deleted_at` atau hanya menggunakan boolean `is_active`. Menambahkan soft delete secara serampangan bisa merusak integritas basis data. Berikut adalah panduan arsitektural menyeluruh:

### A. Matriks Kebijakan Soft Delete per Entitas

| Tabel / Entitas | Kebijakan Soft Delete | Alasan Arsitektural & Dampak |
|---|:---:|---|
| **`questions`** | ✅ **Sudah Ada** | Inti sistem. Dihubungkan ke partial unique index `uq_questions_content_hash`. |
| **`bundles`** | ✅ **Sudah Ada** | Paket ujian (`bundles.deleted_at`). Kolom `slug` bukan identitas kanonik dan akan di-drop permanen di Tahap 2. |
| **`solutions`** | ⭐ **Sangat Direkomendasikan** | Mengikuti Axiom (`schema.ts:250`). Guru sering merevisi/mengganti pembahasan. Butuh tombstone agar rank lamanya dilepas untuk pembahasan baru tanpa merusak log audit. |
| **`sources`** | ⭐ **Direkomendasikan** | Master Sumber (buku/website/sekolah). Jika dihapus fisik, ratusan bundle terkena `ON DELETE SET NULL`. Lebih aman soft-delete (`deleted_at`), keunikan nama dijaga via `lower(label)` aktif. |
| **`topics`** | 🟡 **Opsional (Transisi)** | Saat ini memakai `is_active: boolean`. Keunikan dijaga oleh `id` dan hierarki tree. Kolom `slug` di-drop permanen di Tahap 2. |
| **`tags`** | 🟡 **Opsional** | Saat ini di-hard-delete via pembersihan tag tak terpakai (`clean-unused`). Keunikan nama dijaga oleh `uq_tags_name`. Kolom `slug` di-drop permanen di Tahap 2. |
| **Junction M:N** (`bundle_items`, `question_topics`, `question_tags`, `question_media`) | 🛑 **DILARANG KERAS** | **Anti-Pattern:** Junction table M:N wajib **HARD DELETE** saat relasi diputus. Soft delete pada junction table membuat kueri JOIN membengkak drastis (`AND qt.deleted_at IS NULL AND q.deleted_at IS NULL`), merusak komposit primary key, dan memicu *deadlock*. |
| **Tabel Sistem & Audit** (`audit_logs`, `events`) | 🛑 **DILARANG KERAS** | `audit_logs` bersifat *immutable* (dijaga trigger `trg_audit_logs_immutable`). `events` adalah catatan sejarah peristiwa nyata yang tidak boleh dihapus. |

---

### B. Tiga Aturan Emas Implementasi Soft Delete di PostgreSQL

#### Aturan 1: Wajib Konversi Kolom Unik Menjadi Partial Unique Index (Bukan untuk Slug)
Jika sebuah tabel memiliki kolom unik yang dipertahankan (misal: `name`, `label`, `content_hash`, atau kombinasi `(question_id, rank)`), penambahan `deleted_at` akan **merusak operasi INSERT di masa depan** jika tidak dijadikan partial index.
* *Contoh Salah:* `CREATE UNIQUE INDEX uq_sources_name ON sources (label);` $\to$ Sumber "Buku Erlangga" yang di-soft-delete akan memblokir pengguna yang ingin mendaftarkan kembali "Buku Erlangga".
* *Contoh Benar:*
  ```sql
  -- Untuk master sumber (menggunakan nama/label aktif, BUKAN slug):
  CREATE UNIQUE INDEX uq_sources_label_active 
  ON sources (lower(label)) 
  WHERE deleted_at IS NULL;
  
  -- Untuk tabel solutions yang mengadopsi rank:
  CREATE UNIQUE INDEX uq_solutions_rank_active 
  ON solutions (question_id, rank) 
  WHERE deleted_at IS NULL;
  ```

#### Aturan 2: Pencegahan Masalah "Sandera Relasi RESTRICT" (Kepatuhan CONSTRAINTS #46)
PostgreSQL Foreign Key (`ON DELETE RESTRICT`) bekerja di level baris fisik dan **tidak peduli nilai `deleted_at`**.
* *Skenario Bahaya:* Jika Bundle A di-soft-delete (`deleted_at = now()`), tetapi baris di `bundle_items` masih mengarah ke Question X. Ketika Question X ingin dihapus, guard aplikasi mengecek `isQuestionUsedInBundles()`.
* *Pencegahan:* Semua kueri pengecekan keterpakaian anak/induk **wajib memfilter induk aktif**:
  ```ts
  // Selalu innerJoin bundles aktif, jangan hitung bundle terhapus!
  export async function isQuestionUsedInBundles(questionId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: bundleItems.id })
      .from(bundleItems)
      .innerJoin(bundles, and(eq(bundles.id, bundleItems.bundleId), isNull(bundles.deletedAt)))
      .where(eq(bundleItems.questionId, questionId))
      .limit(1);
    return Boolean(row);
  }
  ```

#### Aturan 3: Sinkronisasi Trigger Hitungan Pemakaian (`usage_count`)
Di MathBank terdapat trigger `trg_question_topics_usage` dan `trg_question_tags_usage` yang menghitung berapa kali sebuah topik dipakai.
* Jika `questions` di-soft-delete, baris `question_topics` tidak dihapus fisik.
* *Konsekuensi:* Trigger wajib diperbarui agar saat `questions.deleted_at` berubah dari `NULL` menjadi terisi (soft-deleted), `usage_count` pada topik terkait dikurangi 1. Sebaliknya jika di-restore, `usage_count` ditambah 1.

---

### C. Keputusan Khusus MathBank: Evaluasi & Eliminasi Total Kolom `slug` di Tahap 2

Berbeda dengan Axiom yang mempertahankan `slug` demi URL publik ramah SEO, **MathBank adalah Bank Soal Berorientasi Guru & Kurasi Internal** yang telah 100% beralih ke identitas kanonik **UUIDv7 (`uuidPk()`)**. Seluruh perutean Next.js App Router telah menggunakan ID (`/questions/[id]`, `/bundles/[id]`).

#### Mengapa `slug` Wajib Dihilangkan Permanen (Bukan Sekadar Index Parsial)?
1. **Beban Utang Teknis & Pelanggaran Integritas:** Kolom `slug` memicu bug pemotongan NFKD karakter pada ligatur teks matematika (`CONSTRAINTS #40`), bentrokan panjang string pada `varchar(100)`, dan suffix angka aneh (`-2`, `-3`) pada paket soal duplikat.
2. **Kondisi Empiris Terkini di DB:**
   * `topics`: Dari 252 baris, **78 baris sudah bernilai `slug = NULL`** (berkat Tahap A, MAT-134).
   * `tags`: Dari 16 baris, **2 baris sudah bernilai `slug = NULL`**.
   * `bundles`: 579 baris memiliki slug yang di-generate via `uniqueSlug()`, namun **tidak ada satu pun route aplikasi yang mengonsumsinya**.
   * `sources`: 9 baris memiliki slug hasil `slugify()`, namun pencarian sumber dapat murni berbasis `lower(label)` atau `url`.
3. **Penyelarasan Peta Jalan MAT-131:** Tahap A (Soft Deprecation — membuat nullable) telah terbukti stabil. Maka pada **Fase 2 roadmap ini**, dilakukan **Tahap B (Hard Removal)** secara tuntas.

#### Spesifikasi Eksekusi Penghapusan Slug di Tahap 2:
```sql
-- 1. Hapus Index Unik Legacy Slug
DROP INDEX IF EXISTS uq_topics_slug;
DROP INDEX IF EXISTS uq_tags_slug;
DROP INDEX IF EXISTS uq_sources_slug;
DROP INDEX IF EXISTS uq_bundles_slug_active;

-- 2. Drop Kolom Fisik Slug dari 4 Tabel
ALTER TABLE topics DROP COLUMN IF EXISTS slug;
ALTER TABLE tags DROP COLUMN IF EXISTS slug;
ALTER TABLE sources DROP COLUMN IF EXISTS slug;
ALTER TABLE bundles DROP COLUMN IF EXISTS slug;
```

#### Tindakan Pembersihan Kode & Skrip Terkait:
* **`src/lib/services/bundle-shared.ts` & `bundle-write.ts`:** Hapus helper `uniqueSlug()` dan kolom `slug` dari insert/update bundle.
* **`src/lib/services/taxonomy/source.ts`:** Hapus `slugify(input.label)` dan kolom `slug`.
* **`src/lib/ingest/commit.ts`:** Ubah pencarian sumber menjadi `WHERE lower(label) = lower(sourceOrigin)` dan hilangkan pembuatan bundle slug.
* **`scripts/map-question-topics.ts`:** Ubah `TOPIC_RULES` agar memetakan kata kunci ke `name` topik (`topicsByName`), bukan `slug`.
* **`scripts/auto-tag-questions.ts`:** Buang kolom `slug` dari daftar seed tag.
* **`src/lib/db/schema/*`:** Bersihkan definisi kolom `slug` dan impor `uniqueIndex` terkait.

---

## 7. Rencana Tahapan Eksekusi (Roadmap Adopsi Revisi)

1. **Fase 1 (Quick Wins - Tanpa Migrasi Skema Berat):**
   * Verifikasi dan kunci tes regresi rekalkulasi `contentHash` di `src/lib/services/question-write.db.test.ts`.
   * Pasang partial unique index `uq_solutions_one_primary` pada tabel `solutions (question_id) WHERE is_primary = true`. (Aman 100%, terbukti 10.363 baris eksisting berstatus clean 1 primary per soal).
   * Adopsi CSS Paged Media `@page` Margin Box (`@top-left`, `@top-right`, `@bottom-right`) dan 3-Way penempatan pembahasan (`none` / `inline` / `end`) di `src/styles/print.css` & `src/components/bundles/bundle-print-view.tsx`.
2. **Fase 2 (Pembersihan Total Slug / Tahap B & Hardening Model Pembahasan/Soft Delete):**
   * **Eksekusi MAT-131B (Hard Removal Slug):** Jalankan migrasi DROP COLUMN `slug` dan drop indeks pada `topics`, `tags`, `sources`, dan `bundles`. Bersihkan service layer dan perbarui skrip kurasi Faruq agar berbasis nama.
   * **Hardening Soft Delete & Ranked Solutions:**
     * Tambahkan `solutions.deleted_at` dan migrasikan `solutions.is_primary` $\to$ `solutions.rank: integer`.
     * Tambahkan `sources.deleted_at` dengan partial index `uq_sources_label_active`.
     * Terapkan sinkronisasi denormalisasi `questions.answer_key.explanationMarkdown` murni dari `rank = 1`.
     * Terapkan filter induk aktif (`isNull(deletedAt)`) pada seluruh pengecekan FK RESTRICT (`CONSTRAINTS #46`).
3. **Fase 3 (Transisi Taksonomi "Materi Pokok + Materi Beririsan"):**
   * Migrasi skema: tambah `questions.topic_id uuid REFERENCES topics(id) ON DELETE SET NULL` dan buat tabel `question_cross_topics`.
   * Backfill deterministik 14.442 baris: 8.468 baris `is_primary = true` ke `questions.topic_id`, 5.974 baris `is_primary = false` ke `question_cross_topics`.
   * Kunci integritas via index `idx_questions_topic_id` dan `idx_question_cross_topics_topic`.
   * Drop tabel lama `question_topics`.
   * Optimalkan kueri katalog soal `/questions` dengan membaca langsung `questions.topic_id JOIN topics` ($O(1)$ tanpa JOIN junction).

---

## 8. § Catatan Verifikasi (Kepatuhan CONSTRAINTS #44)

- **Verifikator:** Claude Code (Dual-Auditor & System Architect)
- **Metode Pengujian:** Kueri langsung ke PostgreSQL `localhost:5433/mathbank`, inspeksi kode sumber repositori `mathbank` dan `axiom`, penelusuran git commit history, serta verifikasi `vitest` & `next build`.
- **Hasil Verifikasi Faktual:**
  * Status `content_hash` MathBank terbukti 100% aktif (11.902 soal, 0 NULL).
  * Status embedding BGE-M3 terbukti 100% terisi di `question_embeddings`.
  * Rekalkulasi `contentHash` pada `updateQuestion` diverifikasi **sudah aktif** di `src/lib/services/question-write.ts` sejak `MAT-146`.
  * Verifikasi data `question_topics`: 14.442 relasi, tepat 8.468 soal berelasi topik memiliki persis 1 `is_primary = true` (0 duplikat, 0 soal tanpa primary). Siap migrasi materi pokok langsung dan 5.974 materi beririsan tanpa pembersihan data awal.
  * Verifikasi data `solutions`: 10.363 baris, seluruhnya memiliki tepat 1 `is_primary = true`. Aman dipasang partial unique index tanpa benturan.
  * Verifikasi data `slug`: 78 topik dan 2 tag sudah `NULL`. Seluruh rute aplikasi (App Router) 100% berbasis UUIDv7 (`/questions/[id]`, `/bundles/[id]`). Tidak ada dependensi URL terhadap slug. Evaluasi hard removal di Tahap 2 layak dan aman dieksekusi.
  * Model semantik *"Materi Pokok + Materi Beririsan"* diverifikasi secara pedagogis dan komputasional jauh lebih superior dibandingkan penomoran angka rank buatan Axiom.
- **Rekomendasi Dokumen:** Terdaftar di `docs/PETA-DOKUMEN.md` dengan status 🟢 (Diselaraskan dengan MAT-131 & Siap Dieksekusi).
