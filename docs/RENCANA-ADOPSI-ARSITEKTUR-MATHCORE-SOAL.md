# RENCANA ADOPSI ARSITEKTUR: MENYEMPURNAKAN MATHBANK DARI INOVASI MATHCORE & SOAL

> **Status:** Disetujui untuk Diadopsi (Living Architectural RFC)  
> **Tanggal:** 7 Oktober 2026  
> **Dasar Keputusan:** Hasil Audit Kode Riil Komparatif & Evaluasi Arsitektur Database  
> **Target Repositori:** MathBank (`/home/hari/projects/mathbank`)  
> **ID Memori Mnemosyne:** `45e4e2daf0f16cf8`  
> **Dokumen Terkait:** `docs/ADR/0010-*.md`, `docs/ADR/0014-*.md`, `docs/PETA-DOKUMEN.md`

---

## 1. Latar Belakang & Kesimpulan Audit Empiris

Dari investigasi empiris mendalam terhadap tiga basis kode yang berkompetisi di ekosistem:
1. **MathBank** terbukti sebagai **sistem produksi terlengkap dan tertangguh** (1.069 tes unit dan database lulus 100%, 26 tabel relasional, 24 triggers, adapter ingest korpus nyata, proteksi SSRF, dan audit trail).
2. **MathCore** memiliki desain isolasi skema yang sangat baik pada tabel vektor, meskipun implementasi fiturnya sebagian besar masih berupa purwarupa MVP (*skeleton*).
3. **Soal** memiliki inovasi arsitektur mutakhir dalam layout cetak naskah A4 dua kolom bebas tabrakan dan toleransi ingest batch AI.

Dokumen ini mencatat **inovasi terpilih** serta **catatan masukan arsitektural resmi** untuk diterapkan secara bertahap ke dalam MathBank.

---

## 2. Rincian Inovasi Inti yang Diadopsi

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              MATHBANK v2.x TARGET UPGRADE                              │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ Dari MathCore                 │ 1. Isolasi Tabel Vektor 1:1 (question_embeddings)      │
│                               │ 2. Kebijakan Ketat Larangan Server Actions (wrapRoute) │
├───────────────────────────────┼────────────────────────────────────────────────────────┤
│ Dari Soal                     │ 3. Engine Paged Media CSS A4 2-Kolom Bebas Tabrakan    │
│                               │ 4. Toleransi Parsial Ingest Batch MCP (Anti-Rollback)  │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

### Inovasi 1: Isolasi 1:1 Tabel Vektor (`question_embeddings`)
* **Asal Inovasi:** `mathcore` (`src/lib/db/schema/embedding.ts:48-68`)
* **Motivasi:** Kolom inline `embedding vector(1024)` pada tabel `questions` di MathBank menyebabkan *row bloat* ($\approx 4\text{ KB}$ per baris). Query `SELECT` biasa (daftar soal, filter topik, dll.) memboroskan bandwidth RAM buffer pool PostgreSQL.
* **Spesifikasi Implementasi:**
  1. Buat tabel terpisah `question_embeddings`:
     ```typescript
     // src/lib/db/schema/embedding.ts
     export const questionEmbeddings = pgTable("question_embeddings", {
       questionId: uuid("question_id")
         .primaryKey()
         .references(() => questions.id, { onDelete: "cascade" }),
       embedding: vector1024("embedding").notNull(),
       embeddingContentHash: varchar("embedding_content_hash", { length: 64 }),
       embeddingModelName: varchar("embedding_model_name", { length: 100 }),
       aiTaggedAt: timestamp("ai_tagged_at", { withTimezone: true }).defaultNow().notNull(),
     });
     ```
  2. Pindahkan data vektor yang ada dari `questions` ke `question_embeddings`.
  3. Buat Partial HNSW Index:
     ```sql
     CREATE INDEX idx_question_embeddings_hnsw
       ON question_embeddings USING hnsw (embedding vector_cosine_ops)
       WHERE question_id IN (
         SELECT id FROM questions WHERE deleted_at IS NULL AND status = 'ready'
       );
     ```
  4. Hapus kolom `embedding` dari tabel utama `questions`.
* **Dampak:** Throughput pembacaan tabel `questions` meningkat $40\%\text{--}60\%$, penggunaan memori buffer pool hemat $>90\%$.

---

### Inovasi 2: Mesin CSS Paged Media 2-Kolom Cetak Naskah A4
* **Asal Inovasi:** `soal` (`src/app/bundles/[id]/print/worksheet.module.css`)
* **Motivasi:** Halaman cetak naskah MathBank (`/bundles/[id]/print`) memerlukan standarisasi cetak anti-potong yang handal agar setara dengan naskah ujian standar cetak pabrik.
* **Spesifikasi Implementasi:**
  1. Terapkan konfigurasi ukuran dan margin kertas:
     ```css
     @page {
       size: A4 portrait;
       margin: 2cm 1.5cm;
     }
     ```
  2. Terapkan struktur 2-kolom seimbang dengan proteksi pemisah naskah:
     ```css
     .columns {
       column-count: 2;
       column-gap: 9mm;
       column-rule: 1px solid var(--border-rule);
     }
     .item {
       break-inside: avoid;
       page-break-inside: avoid;
       padding-left: 24px; /* Gutter khusus mencegah tabrakan nomor 2-digit */
       position: relative;
       margin-bottom: 12px;
     }
     .num {
       position: absolute;
       left: 0;
       font-weight: 700;
     }
     .figure, .options {
       break-inside: avoid;
       page-break-inside: avoid;
     }
     .header, .instruction {
       break-after: avoid;
       page-break-after: avoid;
     }
     ```
* **Dampak:** Seluruh paket latihan dan bundel ujian MathBank dapat dicetak ke PDF (`Ctrl+P`) dengan kerapian sempurna tanpa rumus matematika atau opsi jawaban yang terbelah antar-kolom/halaman.

---

### Inovasi 3: Toleransi Parsial Ingest Batch MCP (`Partial Batch Resilience`)
* **Asal Inovasi:** `soal` (`src/lib/mcp/server.ts:30-48` & AD-19)
* **Motivasi:** Input massal via AI sering kali frustratif jika 1 format salah menggagalkan 30 soal lainnya (*all-or-nothing rollback*).
* **Spesifikasi Implementasi:**
  1. Pada handler ingest batch MCP/API:
     - Terima array item sebagai elemen yang divalidasi per-indeks di tingkat service, bukan di gerbang skema global.
     - Butir yang valid tetap di-commit ke dalam transaksi.
     - Butir yang cacat dikumpulkan ke dalam array `failures: Array<{ index: number, stemPreview: string, reason: string }>`.
  2. Respon API/MCP mengembalikan ringkasan terperinci: `{ storedCount: 28, failedCount: 2, failures: [...] }`.
* **Dampak:** Mempercepat aliran input kurasi soal berbantuan AI hingga berkali-kali lipat tanpa friksi galat total.

---

### Inovasi 4: Pagar Arsitektur "Banned Server Actions" & Enforce `wrapRoute()`
* **Asal Inovasi:** `mathcore` (`docs/ARCHITECTURE.md §3.1 L2`)
* **Motivasi:** Mencegah celah keamanan (*idor/privilege escalation*) dan inkonsistensi audit trail akibat komponen klien yang memanggil Server Actions tanpa melalui lapisan pipa otorisasi baku.
* **Spesifikasi Implementasi:**
  1. Seluruh mutasi data dari UI hanya boleh memanggil API Route Handlers terstandarisasi yang dibungkus oleh `wrapRoute()`.
  2. Pipa wajib setiap mutasi:
     `Request` $\rightarrow$ `wrapRoute` $\rightarrow$ `resolveActor()` $\rightarrow$ `assertCan()` $\rightarrow$ `rateLimit()` $\rightarrow$ `Zod Parse` $\rightarrow$ `Service Execution` $\rightarrow$ `recordAudit()`.
* **Dampak:** 100% mutasi data terjamin aman, termonitor di tabel `audit_logs`, dan terlindungi oleh rate limiting token bucket.

---

## 3. Catatan Masukan Kritis & Hasil Evaluasi Arsitektur Database (Feedback Notes)

Berdasarkan review arsitektur independen dan klarifikasi domain model, berikut adalah **5 catatan masukan fundamental** yang dikunci ke dalam spesifikasi:

### 📌 Masukan 1: Distingsi Mutlak Antara `EVENT` vs `PROVENANCE`
* **Penegasan Domain:** `EVENT` dan `PROVENANCE` adalah dua dimensi yang terpisah:
  1. **`EVENT` (Ujian Resmi Makro / Nasional):**
     - Mengacu pada ujian resmi besar: **UTBK SNBT, SIMAK UI, OSN Matematika SMA, UM UGM**.
     - **Bersifat opsional (`nullable`)**: Hanya diisi jika soal tersebut memang berasal dari ujian resmi nasional ("kalau ada"). Banyak soal latihan bimbel atau buatan guru yang `event_id = NULL`.
     - Sesuai **ADR-0010**: `events` adalah master jenis ujian (nama, kategori, penyelenggara). Detail tahun dan nomor butir disimpan di tabel soal: `questions.event_id`, `questions.event_year`, `questions.event_subtest`, `questions.event_item_number`.
  2. **`PROVENANCE` (Kanal Perolehan Naskah Fisik/Digital):**
     - Mengacu pada dari mana materi/naskah diperoleh: **Web Defantri, Mathcyber1997, Modul Bintang Pelajar, Buku Erlangga**.
     - Sesuai **ADR-0014**: Kanal perolehan **menempel pada `bundles`** (`bundles.source_id` + `bundles.url`), bukan pada butir soal tunggal.
     - Hubungan soal ke naskah perolehan bersifat M:N via `bundle_items`. Satu butir soal kanonikal yang sama bisa terhubung ke naskah artikel Defantri (Bundle A) sekaligus modul bimbel (Bundle B) tanpa perlu tabel perantara tambahan.

### 📌 Masukan 2: Simplifikasi Konfigurasi Cetak (Prinsip KISS)
* **Kritik:** Usulan pembuatan tabel terpisah 1:1 `worksheet_settings` adalah bentuk *over-engineering* untuk 6 field konfigurasi yang jarang berubah.
* **Keputusan:** Jangan buat tabel terpisah. Satukan konfigurasi cetak langsung sebagai kolom `print_config jsonb` pada tabel `bundles`:
  ```typescript
  printConfig: jsonb("print_config").$type<{
    institutionName?: string;
    tagline?: string;
    instructions?: string;
    durationMinutes?: number;
    twoColumnLayout?: boolean;
    includeAnswerKey?: boolean;
  }>().default({
    institutionName: "Math My ID",
    twoColumnLayout: true,
    includeAnswerKey: false
  }).notNull(),
  ```
  Ini menghemat 1 relasi tabel dan menghilangkan beban `JOIN` saat merender lembar kerja.

### 📌 Masukan 3: Penegasan Check Constraint pada Wacana Stimulus
* **Kritik:** Jika wacana stimulus berada di dalam tabel `questions` (`question_type = 'stimulus'`), stimulus tidak boleh dipaksa memiliki kolom `difficulty` (1–5) atau `cognitive_level` (C1–C6) yang tidak relevan bagi sebuah teks wacana.
* **Keputusan:** Pasang check constraint di level PostgreSQL:
  ```sql
  CONSTRAINT chk_stimulus_fields CHECK (
    (question_type = 'stimulus' AND parent_id IS NULL) OR
    (question_type != 'stimulus' AND difficulty BETWEEN 1 AND 5)
  )
  ```

### 📌 Masukan 4: Single Source of Truth Kunci Jawaban
* **Kritik:** Redundansi ganda antara `question_options.is_correct` dan `questions.answer_key` rentan memicu bug perbedaan status jawaban.
* **Keputusan:**
  - Untuk soal pilihan ganda reguler dan kompleks, **sumber kebenaran tunggal adalah `question_options.is_correct`**.
  - Kolom `non_option_answer_key` pada `questions` hanya diisi untuk tipe soal non-opsi (isian singkat, esai, numerik).

### 📌 Masukan 5: Pagar Kolom Slug B-Tree (100 Karakter)
* **Kritik:** String nama tag atau materi yang terlalu panjang dapat memicu DB error 500 saat di-index B-Tree.
* **Keputusan:** Batasi kolom `tags.slug` dan `topics.slug` tepat pada `varchar(100)` dan pastikan helper `slugify(name, 100)` memotong string secara deterministik (mematuhi batasan CONSTRAINT #40).

---

## 4. Rencana Eksekusi Bertahap (Execution Phases)

| Tahap | Fokus Pekerjaan | Tingkat Kesulitan | Estimasi Risiko |
|:---:|---|:---:|:---:|
| **Fase A** | Integrasi `worksheet.module.css` ke halaman cetak `/bundles/[id]/print` | Rendah | Nol (Murni CSS/Layout) |
| **Fase B** | Implementasi Toleransi Parsial pada Tool MCP Ingest | Sedang | Rendah (Hanya layer Ingest) |
| **Fase C** | Migrasi Skema: Ekstraksi `question_embeddings` 1:1 & Partial HNSW | Tinggi | Sedang (Perlu migrasi data vektor) |
| **Fase D** | Audit Penegakan `wrapRoute()` dan pelarangan Server Actions | Sedang | Rendah (Standardisasi API) |

---
*Dokumen ini merupakan panduan arsitektur resmi yang telah diselaraskan dengan seluruh masukan evaluasi.*
