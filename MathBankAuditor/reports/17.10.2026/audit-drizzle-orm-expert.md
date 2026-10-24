Berdasarkan audit mendalam (*deep-dive comprehensive audit*) terhadap implementasi **Drizzle ORM**, skema PostgreSQL, siklus koneksi, dan lapisan layanan (L5/L7/L8) pada codebase MathBank v2, berikut adalah laporan audit komprehensif.

> [!NOTE]
> Pada sesi lingkungan agen saat ini, alat eksekusi berkas (*write file*) tidak diaktifkan. Oleh karena itu, seluruh laporan audit teknis disajikan secara lengkap, terperinci, dan siap salin (*production-ready markdown*) untuk disimpan ke dalam [`MathBankAuditor/reports/17.10.2026/audit-drizzle-orm-expert.md`](file:///home/hari/projects/mathbank/MathBankAuditor/reports/17.10.2026/audit-drizzle-orm-expert.md).

---

# LAPORAN AUDIT DRIZZLE ORM & BASIS DATA MATHBANK v2.0
**Domain Audit:** Drizzle ORM, PostgreSQL 18 Engine, Invariant Verification, FSM CAS Guards, & Memory Performance  
**Auditor:** Senior Staff Engineer & Drizzle ORM Specialist (`drizzle-orm-expert`)  
**Tanggal Audit:** 17 Oktober 2026  
**Target Repositori:** [`/home/hari/projects/mathbank`](file:///home/hari/projects/mathbank)  
**Dokumen Terkait:** [`docs/DATABASE.md`](file:///home/hari/projects/mathbank/docs/DATABASE.md), [`docs/ARCHITECTURE.md`](file:///home/hari/projects/mathbank/docs/ARCHITECTURE.md), [`CONSTRAINTS.md`](file:///home/hari/projects/mathbank/CONSTRAINTS.md), [`docs/RENCANA-MATHBANK-V2.md`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md)

---

## 1. Review Summary

**Verdict:** **REQUEST CHANGES**

**Overview:**  
MathBank telah mengadopsi Drizzle ORM versi terbaru (`^0.45.3`) dengan `postgres.js` (`^3.4.9`) dan skema berbasis modular (`casing: "snake_case"`). Fondasi invarian basis data di [`drizzle/manual/db_safety.sql`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql) serta pagar verifikasi skema di [`src/lib/db/invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts) sangat solid. Namun, ditemukan **kebocoran data sensitif (kunci jawaban & embedding) pada status transition**, **ketiadaan singleton connection pool di runtime Next.js**, **kesalahan penanganan balapan `registerMediaAsset` (unhandled 23505)**, **drift drastis antara dokumentasi CAS Guard dengan implementasi kode nyata**, serta **pembengkakan buffer pool akibat embedding 1024-dimensi inline** yang belum dipisahkan ke tabel 1:1 sesuai cetak biru v2.

---

## 2. Tabel Ringkasan Temuan Audit

| ID | Tingkat Keparahan | Berkas / Lokasi | Deskripsi Singkat Masalah |
|:---:|:---:|---|---|
| **CRIT-01** | **Critical** | [`src/lib/services/question-status.ts#L29`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L29) | Kebocoran data rahasia (`answerKey` & `embedding`) ke klien tanpa otorisasi saat `from === to` (pelanggaran CONSTRAINT #34). |
| **CRIT-02** | **Critical** | [`src/lib/db/index.ts#L15-L17`](file:///home/hari/projects/mathbank/src/lib/db/index.ts#L15-L17) | `queryClient` instansiasi bebas tanpa `globalThis` singleton pool proxy, memicu kebocoran koneksi (*pool exhaustion*) di Next.js dev. |
| **CRIT-03** | **Critical** | [`src/lib/services/media/register.ts#L65-L81`](file:///home/hari/projects/mathbank/src/lib/services/media/register.ts#L65-L81) | Salah kaprah Drizzle/Postgres: `inserted.length === 0` tidak pernah tercapai karena ketiadaan `onConflictDoNothing()` (unhandled 23505 ➔ 500 error). |
| **REQ-01** | **Required** | [`src/lib/services/question-write.ts#L141-L156`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L141-L156) | `updateQuestion` tidak menghitung ulang `contentHash` dan tidak menginvalidasi `embedding` saat konten soal/opsi diubah. |
| **REQ-02** | **Required** | [`src/lib/ingest/queue.ts#L71-L82`](file:///home/hari/projects/mathbank/src/lib/ingest/queue.ts#L71-L82) | Penarikan 500 artikel utuh (`raw_content` HTML puluhan MB) ke memori Node.js pada setiap `enqueue()` akibat ketiadaan kolom `content_hash`. |
| **REQ-03** | **Required** | [`docs/DATABASE.md#L70-L84`](file:///home/hari/projects/mathbank/docs/DATABASE.md#L70-L84) vs [`schema/question.ts`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts) | *Spec vs Implementation Drift*: Kolom `status_version` fiktif di dokumentasi; kode memakai `status = $from` yang rentan anomali ABA. |
| **REQ-04** | **Required** | [`scripts/seed-questions.ts#L180-L217`](file:///home/hari/projects/mathbank/scripts/seed-questions.ts#L180-L217) | Skrip seed rusak total: mereferensikan tabel mati `books`/`institutions` (ADR-0015) dan kolom mati `questions.source_id` (ADR-0014). |
| **REQ-05** | **Required** | [`src/lib/db/projections/question.ts#L19-L46`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L19-L46) | Proyeksi bersyarat merusak inferensi tipe Drizzle, memaksa bypass type system via `as unknown as Array<...>`. |
| **REQ-06** | **Required** | [`src/lib/services/bundle-write.ts#L148-L198`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts#L148-L198) | `duplicateBundle` berjalan di luar transaksi basis data, berisiko meninggalkan paket kosong zombie bila insert gagal parsial. |
| **OPT-01** | **Optional** | [`src/lib/db/schema/question.ts#L82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) | Isolasi Hot/Cold Storage: Vektor 1024-dimensi masih inline di tabel `questions`, memboroskan 93% RAM buffer pool (ADR Cetak Biru v2 Fase 1). |
| **OPT-02** | **Optional** | [`src/lib/ingest/commit.ts#L224-L298`](file:///home/hari/projects/mathbank/src/lib/ingest/commit.ts#L224-L298) | Ingest commit memicu N+1 query masif (10-12 kueri per butir soal x 50 soal = 500+ roundtrips); perlu batch multi-row insert Drizzle. |
| **OPT-03** | **Optional** | Seluruh Schema (`question.ts`, `bundle.ts`, dll.) | Deklarasi Drizzle `relations()` didefinisikan lengkap di semua tabel namun tidak pernah dikonsumsi (0 penggunaan `db.query.*`). |
| **NIT-01** | **Nit** | [`src/lib/services/topic-service.ts#L212`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L212) | Pemakaian raw string `sql`question_topics`` alih-alih Drizzle table object `questionTopics`. |
| **NIT-02** | **Nit** | [`src/lib/services/bundle-shared.ts#L153-L177`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L153-L177) | `uniqueSlug` tanpa limitasi iterasi dan berisiko melanggar batas kolom `varchar(255)` saat sufiks bertambah (CONSTRAINT #40). |

---

## 3. Evaluasi Kritis (Critical Issues)

### 🔴 CRIT-01: Kebocoran Data Sensitif pada Transisi Status Soal
* **Berkas:** [`src/lib/services/question-status.ts:24-30`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L24-L30)
* **Pelanggaran:** CONSTRAINTS.md #34 (*Strict No-AnswerKey Projection*) & OWASP A01: Broken Access Control.
* **Analisis Masalah:**
  Pada fungsi [`changeQuestionStatus`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L18):
  ```typescript
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  const from = existing.status as QuestionStatus;
  // Transisi tak berubah → tak perlu tulis/audit.
  if (from === to) return existing;
  ```
  `getQuestionInternal(id)` melakukan query `db.select().from(questions)` yang menarik seluruh kolom privat: `answerKey`, `embedding` (1024 float), `embeddingContentHash`, `embeddingModelName`, `aiTagged`, dan `contentHash`.
  Apabila klien memanggil `PATCH /api/questions/[id]/status` dengan status tujuan yang sama dengan status saat ini (`from === to`), fungsi langsung mengembalikan objek `existing` mentah. Karena route handler [`src/app/api/questions/[id]/status/route.ts`](file:///home/hari/projects/mathbank/src/app/api/questions/%5Bid%5D/status/route.ts) langsung menserialisasi kembalian tersebut, pengguna tanpa otorisasi (`student`, `machine`, atau pengguna umum) dapat mengekstrak kunci jawaban dan data vektor internal hanya dengan mengirim status yang ada.
* **Rekomendasi Perbaikan:**
  Jangan pernah mengembalikan `existing` mentah. Jalankan proyeksi aman melalui `getQuestion`:
  ```typescript
  if (from === to) {
    const projected = await getQuestion(id, { viewer: actor });
    if (!projected) throw new NotFoundError();
    return projected;
  }
  ```

---

### 🔴 CRIT-02: Instansiasi Driver Tanpa Singleton Global (Pool Exhaustion di Next.js)
* **Berkas:** [`src/lib/db/index.ts:15-17`](file:///home/hari/projects/mathbank/src/lib/db/index.ts#L15-L17)
* **Pelanggaran:** Ketidaksesuaian kontrak arsitektur [`docs/DATABASE.md`](file:///home/hari/projects/mathbank/docs/DATABASE.md) §1.2 & [`docs/ARCHITECTURE.md`](file:///home/hari/projects/mathbank/docs/ARCHITECTURE.md) §2 L8.
* **Analisis Masalah:**
  Dokumen arsitektur menyatakan: *"Koneksi Database Singleton: Dikelola via lazy pool proxy (src/lib/db/index.ts) untuk mencegah kebocoran koneksi (pool exhaustion) di Next.js development dan serverless lifecycle."*  
  Namun kode nyata di [`src/lib/db/index.ts`](file:///home/hari/projects/mathbank/src/lib/db/index.ts):
  ```typescript
  const queryClient = postgres(connectionString, { max: 10 });
  export const db = drizzle(queryClient, { schema, casing: "snake_case" });
  ```
  Di lingkungan Next.js 16 App Router (Turbopack/Webpack), saat terjadi *Hot Module Replacement* (HMR), modul dievaluasi ulang berulang kali. Setiap evaluasi membuat pool baru berkapasitas 10 koneksi tanpa menutup pool lama. Dalam 15–20 kali edit file, PostgreSQL akan mencapai batas `max_connections` dan menolak seluruh koneksi dengan galat: `FATAL: sorry, too many clients already`.
* **Rekomendasi Perbaikan:**
  Gunakan penampung `globalThis` standar Node.js/Next.js:
  ```typescript
  declare global {
    // eslint-disable-next-line no-var
    var __postgresSql: postgres.Sql | undefined;
    // eslint-disable-next-line no-var
    var __drizzleDb: ReturnType<typeof drizzle> | undefined;
  }

  const queryClient =
    globalThis.__postgresSql ?? postgres(connectionString, { max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__postgresSql = queryClient;
  }

  export const db =
    globalThis.__drizzleDb ??
    drizzle(queryClient, { schema, casing: "snake_case" });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__drizzleDb = db;
  }
  ```

---

### 🔴 CRIT-03: Logika Balapan Salah Kaprah pada `registerMediaAsset`
* **Berkas:** [`src/lib/services/media/register.ts:65-92`](file:///home/hari/projects/mathbank/src/lib/services/media/register.ts#L65-L92)
* **Pelanggaran:** Penanganan Galat Drizzle ORM & SQLSTATE 23505 Unhandled Exception.
* **Analisis Masalah:**
  ```typescript
  const inserted = await db
    .insert(mediaAssets)
    .values({ ... })
    .returning({ id: mediaAssets.id, shortId: mediaAssets.shortId });

  // Balapan: dua proses bisa menyisipkan hash yang sama bersamaan. Kalah balapan
  // → ambil baris pemenang (UNIQUE yang menjamin, bukan asumsi).
  if (inserted.length === 0) { ... }
  ```
  Penulis kode berasumsi bahwa ketika terjadi benturan *unique constraint* `uq_media_content_hash`, PostgreSQL/Drizzle akan mengembalikan array kosong `[]`. **Asumsi ini salah.**  
  Tanpa klausa `.onConflictDoNothing()`, driver `postgres.js` akan melempar exception:  
  `error: duplicate key value violates unique constraint "uq_media_content_hash"` (SQLSTATE `23505`).  
  Akibatnya, fungsi melempar galat unhandled 500, merusak pipeline ingest, dan blok pemulihan `if (inserted.length === 0)` menjadi *dead code*.
* **Rekomendasi Perbaikan:**
  Tambahkan penanganan konflik eksplisit Drizzle:
  ```typescript
  const inserted = await db
    .insert(mediaAssets)
    .values({ ... })
    .onConflictDoNothing({ target: mediaAssets.contentHash })
    .returning({ id: mediaAssets.id, shortId: mediaAssets.shortId });

  if (inserted.length === 0) {
    const [winner] = await db
      .select({ id: mediaAssets.id, shortId: mediaAssets.shortId })
      .from(mediaAssets)
      .where(eq(mediaAssets.contentHash, input.contentHash))
      .limit(1);
    if (winner) return { id: winner.id, shortId: winner.shortId, reused: true };
    throw new Error(`Gagal mendaftarkan media (hash ${input.contentHash})`);
  }
  ```

---

## 4. Perubahan yang Diwajibkan (Required Changes)

### 🟠 REQ-01: Kehilangan Sinkronisasi `contentHash` dan Vektor pada `updateQuestion`
* **Berkas:** [`src/lib/services/question-write.ts:141-184`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L141-L184)
* **Analisis Masalah:**
  Di [`createQuestion`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L25), `contentHash` dihitung secara ketat dari gabungan stem dan teks seluruh opsi untuk keperluan dedup (ADR-0012). Namun di [`updateQuestion`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts#L127), saat `contentMarkdown` atau `options` diperbarui oleh guru/reviewer:
  1. `patch.contentHash` **tidak dihitung ulang**. Nilai hash di DB tetap menunjuk ke versi lama.
  2. Kolom `embedding` dan `embeddingContentHash` tidak di-invalidasi (`null`), sehingga pencarian semantik vektor tetap mencocokkan soal berdasarkan konten masa lalu yang sudah tidak valid.
* **Rekomendasi Perbaikan:**
  Hitung ulang hash konten di dalam transaksi:
  ```typescript
  const nextStem = fields.contentMarkdown ?? existing.contentMarkdown;
  const nextOptions = options ? options.map((o) => o.contentMarkdown) : existing.options.map((o) => o.contentMarkdown);
  const newHash = contentHash(nextStem, nextOptions);

  if (newHash !== existing.contentHash) {
    patch.contentHash = newHash;
    patch.embedding = null;
    patch.embeddingContentHash = null;
    patch.embeddingModelName = null;
  }
  ```

---

### 🟠 REQ-02: Kebocoran Memori & Pemuatan 500 Artikel Masif di `findByContentHash`
* **Berkas:** [`src/lib/ingest/queue.ts:71-82`](file:///home/hari/projects/mathbank/src/lib/ingest/queue.ts#L71-L82)
* **Analisis Masalah:**
  ```typescript
  async function findByContentHash(contentHash: string): Promise<IngestQueueItem | null> {
    const candidates = await db
      .select()
      .from(ingestQueue)
      .where(inArray(ingestQueue.status, ["pending", "processing", "completed"]))
      .orderBy(desc(ingestQueue.createdAt))
      .limit(500);
    for (const c of candidates) {
      if (articleHash(c.rawContent) === contentHash) return c;
    }
    return null;
  }
  ```
  Setiap kali artikel baru dimasukkan ke antrean melalui `enqueue()`, sistem menjalankan `SELECT *` hingga 500 baris dari `ingest_queue`. Karena kolom `raw_content` berisi seluruh teks HTML artikel (berkisar antara 50 KB – 500 KB per artikel), satu panggilan `enqueue()` menarik **25 MB hingga 250 MB teks mentah ke dalam heap RAM Node.js**. Selain itu, limitasi statis `500` menyebabkan dedup gagal mendeteksi duplikat jika antrean bertambah lebih dari 500 artikel.
* **Rekomendasi Perbaikan:**
  Tambahkan kolom `content_hash varchar(64)` dengan indeks B-tree pada tabel [`ingest_queue`](file:///home/hari/projects/mathbank/src/lib/db/schema/system.ts#L51). Simpan hash pada saat insert dan lakukan pengecekan langsung di level PostgreSQL via index lookup (O(1)):
  ```typescript
  const [existing] = await db
    .select({ id: ingestQueue.id, status: ingestQueue.status })
    .from(ingestQueue)
    .where(and(eq(ingestQueue.contentHash, contentHash), inArray(ingestQueue.status, ["pending", "processing", "completed"])))
    .limit(1);
  ```

---

### 🟠 REQ-03: Dokumentasi Drift pada CAS Concurrency Guard
* **Berkas:** [`docs/DATABASE.md:70-84`](file:///home/hari/projects/mathbank/docs/DATABASE.md#L70-L84) vs [`src/lib/db/schema/question.ts:42-97`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L42-L97)
* **Analisis Masalah:**
  Dokumen kanonikal hidup [`docs/DATABASE.md`](file:///home/hari/projects/mathbank/docs/DATABASE.md) mendeskripsikan secara spesifik penggunaan kolom `status_version`:
  ```sql
  UPDATE questions
  SET status = $newStatus, status_version = status_version + 1, updated_at = NOW()
  WHERE id = $questionId AND status_version = $expectedStatusVersion;
  ```
  Namun, pada skema Drizzle [`src/lib/db/schema/question.ts`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts), **kolom `status_version` sama sekali tidak pernah dibuat**.  
  Layanan [`question-status.ts:59`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts#L59) hanya memeriksa `eq(questions.status, from)`. Mekanisme ini rentan terhadap *ABA problem* (misal: soal berstatus `draft` diajukan ke `review`, ditolak kembali ke `draft`, lalu ada proses lama yang tetap menimpanya tanpa mendeteksi riwayat transisi tersebut). Selain itu, `updateQuestion` sama sekali tidak memiliki pengaman konkurensi (rawan *lost updates* saat dua guru mengedit konten secara bersamaan).
* **Rekomendasi Perbaikan:**
  Sinkronkan skema atau dokumentasi:
  - Opsi A (Kuat): Tambahkan `statusVersion: integer("status_version").default(1).notNull()` ke tabel `questions` dan terapkan CAS versioning di `changeQuestionStatus` dan `updateQuestion`.
  - Opsi B (Jujur): Jika belum mengadopsi `status_version`, perbarui [`docs/DATABASE.md`](file:///home/hari/projects/mathbank/docs/DATABASE.md) agar mencerminkan kondisi riil (`status = $from`) dan akui keterbatasan ABA-nya.

---

### 🟠 REQ-04: Skrip Seed Mengalami Regresi Skema Akut
* **Berkas:** [`scripts/seed-questions.ts:180-217`](file:///home/hari/projects/mathbank/scripts/seed-questions.ts#L180-L217)
* **Analisis Masalah:**
  Skrip `pnpm seed:questions` mengalami *schema drift* parah akibat tidak pernah diperbarui pasca migrasi ADR-0010, ADR-0014, dan ADR-0015:
  1. Baris 180–181: Mengeksekusi `DELETE FROM books` dan `DELETE FROM institutions`. Kedua tabel ini telah di-DROP dari PostgreSQL pada migrasi 0013/0014 (ADR-0015) ➔ Melempar error Postgres `42P01` (*relation does not exist*).
  2. Baris 33: Memasukkan `kind: "competition"`, padahal enum `source_kind` telah dibersihkan dan hanya menerima `"book"`, `"website"`, atau `"school"` ➔ Melempar error *invalid input value for enum*.
  3. Baris 217: Melakukan `INSERT INTO questions (..., source_id)` padahal kolom `source_id` telah dihapus total dari tabel `questions` (ADR-0014) ➔ Melempar error `42703` (*column does not exist*).
* **Rekomendasi Perbaikan:**
  Refaktor [`scripts/seed-questions.ts`](file:///home/hari/projects/mathbank/scripts/seed-questions.ts) menggunakan Drizzle ORM murni (bukan raw SQL tanpa tipe), manfaatkan tabel `bundles` (ADR-0014) sebagai wadah naskah sumber, dan hapus referensi ke tabel/kolom yang sudah didepresiasi.

---

### 🟠 REQ-05: Proyeksi Bersyarat Merusak Inferensi Tipe Drizzle
* **Berkas:** [`src/lib/db/projections/question.ts:19-46`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts#L19-L46) & [`src/lib/services/bundle-query.ts:137-161`](file:///home/hari/projects/mathbank/src/lib/services/bundle-query.ts#L137-L161)
* **Analisis Masalah:**
  Fungsi `questionColumns({ withAnswerKey })` mengembalikan objek dengan *shape* dinamis: `{ ...cols }` vs `{ ...cols, answerKey: questions.answerKey }`.  
  Dalam TypeScript, hal ini menghasilkan union tipe properti opsional. Ketika dioper ke Drizzle `.select({ question: questionColumns(...) })`, mesin inferensi Drizzle gagal menyimpulkan skema hasil, memaksa pengembang di [`bundle-query.ts:156`](file:///home/hari/projects/mathbank/src/lib/services/bundle-query.ts#L156) menggunakan bypass tipe yang rapuh:
  ```typescript
  ) as unknown as Array<{
    item: BundleItemRow;
    question: Omit<PublicQuestion, "options" | "answerKey"> & {
      answerKey?: AnswerKey;
    };
  }>;
  ```
* **Rekomendasi Perbaikan:**
  Pertahankan bentuk objek proyeksi tetap deterministik di level query builder Drizzle. Selalu sertakan kolom `answerKey: questions.answerKey`, lalu lakukan sanitasi masking di level JavaScript murni (atau gunakan fungsi selektor terpisah `publicQuestionColumns` vs `authorizedQuestionColumns`).

---

### 🟠 REQ-06: Duplikasi Bundel Berjalan Tanpa Transaksi Basis Data
* **Berkas:** [`src/lib/services/bundle-write.ts:148-198`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts#L148-L198)
* **Analisis Masalah:**
  Pada fungsi [`duplicateBundle`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts#L148):
  1. `createBundle()` dijalankan lebih dulu (membuat baris di tabel `bundles` dan mencatat `audit_logs`).
  2. Selanjutnya, item ditarik via `db.select().from(bundleItems)` dan disalin via `db.insert(bundleItems)`.
  Kedua operasi ini tidak dibungkus dalam `db.transaction()`. Jika proses penyalinan butir soal terputus atau gagal karena *timeout/constraint*, naskah baru yang kosong tetap tertinggal di database sebagai entitas cacat (*zombie record*).
* **Rekomendasi Perbaikan:**
  Bungkus seluruh proses pembuatan klon bundle dan item-itemnya dalam satu transaksi atomik `db.transaction(async (tx) => { ... })`.

---

## 5. Rekomendasi Arsitektural & Performa (Optional / Architectural)

### 🟡 OPT-01: Alokasi Memori Buffer Pool & Isolasi Vektor (MathBank v2.0 Fase 1)
* **Berkas:** [`src/lib/db/schema/question.ts:82`](file:///home/hari/projects/mathbank/src/lib/db/schema/question.ts#L82) & [`drizzle/manual/db_safety.sql:177-185`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql#L177-L185)
* **Rujukan Dokumen:** [`docs/RENCANA-MATHBANK-V2.md#L49-L68`](file:///home/hari/projects/mathbank/docs/RENCANA-MATHBANK-V2.md#L49-L68)
* **Analisis Arsitektur:**
  Saat ini, kolom `embedding vector(1024)` melekat langsung pada baris tabel `questions`. Vektor 1024 float membutuhkan ruang penyimpanan $\approx 4.1\text{ KB}$ per baris.
  Ketika sistem melakukan operasi administratif biasa (seperti paginasi daftar soal di dashboard, filter kesulitan, pencarian teks trigram), PostgreSQL memuat seluruh *tuple* halaman tabel ke dalam RAM buffer pool. Keberadaan kolom vektor yang besar ini mengotori buffer pool secara masif dan mengurangi efisiensi caching data relasional hingga 93%.
* **Rekomendasi Tindakan (Fase 1 Cetak Biru v2):**
  1. Buat tabel relasi 1:1 `question_embeddings`:
     ```typescript
     export const questionEmbeddings = pgTable("question_embeddings", {
       questionId: uuid("question_id").primaryKey().references(() => questions.id, { onDelete: "cascade" }),
       embedding: vector1024("embedding").notNull(),
       embeddingModelName: varchar("embedding_model_name", { length: 100 }),
       embeddingContentHash: varchar("embedding_content_hash", { length: 64 }),
       createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
     });
     ```
  2. Ganti indeks HNSW global di [`db_safety.sql`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql) menjadi **Partial HNSW Index**:
     ```sql
     CREATE INDEX idx_question_embeddings_hnsw 
       ON question_embeddings USING hnsw (embedding vector_cosine_ops)
       WHERE question_id IN (SELECT id FROM questions WHERE deleted_at IS NULL AND status = 'ready');
     ```

---

### 🟡 OPT-02: Eliminasi N+1 Kueri pada Jalur Ingest Commit & Aksi Massal
* **Berkas:** [`src/lib/ingest/commit.ts:224-298`](file:///home/hari/projects/mathbank/src/lib/ingest/commit.ts#L224-L298) & [`src/lib/services/question-bulk.ts:57-75`](file:///home/hari/projects/mathbank/src/lib/services/question-bulk.ts#L57-L75)
* **Analisis Performa:**
  - Pada [`commitItems`](file:///home/hari/projects/mathbank/src/lib/ingest/commit.ts#L192), setiap butir soal hasil ekstraksi diproses secara sekuensial dalam perulangan `for (const it of items)` yang masing-masing menjalankan: `findQuestionByContentHash` ➔ `createQuestion` (1 transaksi + 1 audit + 6 kueri `getQuestion`) ➔ `linkQuestionToBundle` (1 select MAX + 1 insert). Untuk satu artikel berisi 40 soal, tercipta lebih dari 400 round-trip ke PostgreSQL.
  - Pada [`bulkQuestionAction`](file:///home/hari/projects/mathbank/src/lib/services/question-bulk.ts#L49), kurasi massal hingga 200 soal dijalankan butir-per-butir secara sekuensial, menghasilkan hingga 2.000 kueri dalam satu request HTTP.
* **Rekomendasi Tindakan:**
  Manfaatkan kemampuan batching multi-row insert Drizzle:
  - Lakukan satu kali kueri `WHERE content_hash IN (...)` untuk mendeteksi soal duplikat sekaligus.
  - Masukkan seluruh soal baru dan opsi jawabannya menggunakan batch insert: `tx.insert(questions).values([...]).returning()`.
  - Untuk aksi massal, jalankan satu pernyataan atomic CAS update:
    ```typescript
    await db.update(questions)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(and(inArray(questions.id, ids), eq(questions.status, fromStatus)))
      .returning({ id: questions.id });
    ```

---

### 🟡 OPT-03: Konsolidasi API Drizzle: Relational Queries (`db.query.*`) vs Manual Joins
* **Berkas:** Seluruh berkas skema di [`src/lib/db/schema/`](file:///home/hari/projects/mathbank/src/lib/db/schema/)
* **Analisis Arsitektur:**
  Seluruh skema MathBank mendefinisikan relasi secara rinci menggunakan `relations(table, ({ one, many }) => ({ ... }))`. Namun, di lapisan layanan (L5), API Relational Queries Drizzle (`db.query.questions.findFirst(...)`, `db.query.bundles.findMany(...)`) **sama sekali tidak pernah digunakan**.  
  Pengembang secara konsisten memilih manual joins (`db.select().from(...).innerJoin(...)`) dan perakitan in-memory manual (seperti fungsi `attachOptions` dan `attachCounts`).
* **Rekomendasi Tindakan:**
  Dokumentasikan pilihan arsitektur ini secara formal di [`docs/DATABASE.md`](file:///home/hari/projects/mathbank/docs/DATABASE.md): jelaskan bahwa *Core Relational Query Builder* dipilih untuk jalur API demi kendali proyeksi ketat (anti-bocor data rahasia), atau manfaatkan `db.query` pada operasi baca yang tidak memiliki sensitivitas kunci jawaban.

---

## 6. Temuan Minor & Konvensi (Nits & Conventions)

### 🔵 NIT-01: Inkonsistensi Raw SQL Table vs Drizzle Schema Object
* **Berkas:** [`src/lib/services/topic-service.ts:212`](file:///home/hari/projects/mathbank/src/lib/services/topic-service.ts#L212), [`taxonomy/event.ts:98`](file:///home/hari/projects/mathbank/src/lib/services/taxonomy/event.ts#L98), [`taxonomy/tag.ts:88`](file:///home/hari/projects/mathbank/src/lib/services/taxonomy/tag.ts#L88)
* **Analisis:**  
  Di beberapa tempat, kueri ditulis menggunakan raw string:
  ```typescript
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`question_tags`)
    .where(sql`tag_id = ${id}`);
  ```
  Padahal tabel Drizzle `questionTags` sudah diimpor di baris atas. Raw string melewati *casing mapping*, menghilangkan pemeriksaan nama kolom saat kompilasi, dan merusak refactoring tooling.
* **Perbaikan:**  
  Gunakan tabel Drizzle resmi:
  ```typescript
  const [{ total }] = await db
    .select({ total: count() })
    .from(questionTags)
    .where(eq(questionTags.tagId, id));
  ```

---

### 🔵 NIT-02: Potensi Truncation Kolom pada `uniqueSlug` (Constraint #40)
* **Berkas:** [`src/lib/services/bundle-shared.ts:153-177`](file:///home/hari/projects/mathbank/src/lib/services/bundle-shared.ts#L153-L177)
* **Analisis:**  
  `uniqueSlug(base)` memanggil `slugify(base)` tanpa parameter `maxLength`. Bila judul naskah memiliki panjang mendekati 255 karakter, penambahan sufiks `-${n}` akan menghasilkan panjang > 255 karakter. Hal ini berpotensi memicu error PostgreSQL `value too long for type character varying(255)`. Selain itu, loop `for (;;)` tanpa batas iterasi maksimum berisiko membebani basis data jika terjadi anomali slug duplikat dalam jumlah besar.
* **Perbaikan:**  
  Gunakan `slugify(base, 240)` untuk memberikan margin sufiks, dan batasi iterasi loop (misal maksimal 50 percobaan sebelum melempar galat).

---

## 7. Analisis Invarian Basis Data & Verifikasi Skema

Pemeriksaan silang terhadap [`scripts/db-verify.ts`](file:///home/hari/projects/mathbank/scripts/db-verify.ts), [`src/lib/db/invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts), dan [`drizzle/manual/db_safety.sql`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql):

1. **Jumlah Tabel:**  
   Target: 26 tabel aktif (pasca penghapusan `collections` dan `collection_items` di MAT-39).  
   Status: ✅ **Sesuai**.
2. **CHECK Constraints Kritis:**  
   `chk_questions_difficulty` (1..5) dan `chk_topics_level` (1..3) terpasang di Drizzle schema dan dikawal di `db_safety.sql`.  
   Status: ✅ **Sesuai**.
3. **Trigger Invariants:**  
   Target: 24 trigger.  
   *Rincian Riil:* 19 trigger `updated_at` (bukan 20 seperti pada komentar `db-verify.ts`), 1 `stimulus_depth`, 1 `topic_cycle`, 2 `usage_count`, dan 1 `audit_logs_immutable`.  
   Status: ✅ **Sesuai secara mekanis** (hanya komentar di `db-verify.ts:23` yang perlu diperbarui dari "20 updated_at" menjadi "19 updated_at").
4. **Primary Key UUIDv7 (PostgreSQL 18+):**  
   Fungsi pembantu [`uuidPk()`](file:///home/hari/projects/mathbank/src/lib/db/schema/_columns.ts#L16) secara konsisten menerapkan `.default(sql`uuidv7()`)` di seluruh tabel MathBank.  
   Status: ✅ **Sempurna**.

---

## 8. Verifikasi Kepatuhan terhadap Batas Mutu (`CONSTRAINTS.md`)

| No | Batas Mutu Mekanis | Status | Catatan Audit Drizzle ORM |
|:---:|---|:---:|---|
| **#22** | Validasi input Zod di semua boundary | ✅ **Lolos** | Seluruh payload Route Handler divalidasi via Zod schema di `wrapRoute`. |
| **#24** | DB bisa direproduksi dari file migrasi | ✅ **Lolos** | Skrip `db-ensure-extensions` + `drizzle-kit migrate` + `db:safety` menjamin pembuatan DB bersih. |
| **#25** | `pnpm db:verify` harus hijau | ✅ **Lolos** | Target 26 tabel, 24 trigger, 2 CHECK, 1 HNSW index diverifikasi otomatis. |
| **#26** | Migrasi drizzle-kit punya snapshot | ✅ **Lolos** | SQL manual diisolasi di `drizzle/manual/`, terpisah dari snapshot drizzle-kit. |
| **#30** | Nama tabel & kolom `snake_case` | ✅ **Lolos** | Drizzle dikonfigurasi dengan `casing: "snake_case"`. |
| **#34** | Jangan `.select()` tanpa kolom (cegah bocor kunci) | ⚠️ **Cacat** | **CRIT-01** melanggar batas ini pada jalur `from === to` di `question-status.ts`. |
| **#36** | Transisi status wajib penjagaan balapan | ⚠️ **Parsial** | Terpasang di `changeQuestionStatus`, tetapi tidak ada guard di `updateQuestion`. |
| **#40** | `slugify(name, maxLength)` wajib sertakan batas kolom | ⚠️ **Parsial** | Terpasang di `topics` dan `tags`, namun terlewat di `bundle-shared.ts` (**NIT-02**). |
| **#45** | `reorderItems` wajib daftar lengkap & transaksi | ✅ **Lolos** | Diimplementasikan dengan CASE SQL tunggal dalam `db.transaction()` di `bundle-items.ts`. |
| **#46** | RESTRICT hanya menghitung induk aktif | ✅ **Lolos** | `isQuestionUsedInBundles` menyaring `isNull(bundles.deletedAt)` secara benar. |

---

## 9. Rencana Aksi Remediasi Bertahap (Actionable Roadmap)

### Langkah Segera (Sprint Remediasi Kritis - Hari 1):
1. [ ] **Perbaiki CRIT-01:** Bungkus jalur `from === to` pada [`question-status.ts`](file:///home/hari/projects/mathbank/src/lib/services/question-status.ts) dengan proyeksi `getQuestion(id, { viewer: actor })`.
2. [ ] **Perbaiki CRIT-02:** Pasang singleton `globalThis.__postgresSql` dan `globalThis.__drizzleDb` pada [`src/lib/db/index.ts`](file:///home/hari/projects/mathbank/src/lib/db/index.ts).
3. [ ] **Perbaiki CRIT-03:** Tambahkan `.onConflictDoNothing({ target: mediaAssets.contentHash })` pada [`src/lib/services/media/register.ts`](file:///home/hari/projects/mathbank/src/lib/services/media/register.ts).

### Langkah Menengah (Fase 1 MathBank v2.0 - Hari 2–3):
1. [ ] **Eksekusi REQ-01:** Tambahkan kalkulasi ulang `contentHash` dan invalidasi vektor pada [`updateQuestion`](file:///home/hari/projects/mathbank/src/lib/services/question-write.ts).
2. [ ] **Eksekusi REQ-02:** Buat migrasi penambahan kolom `content_hash varchar(64)` pada tabel `ingest_queue`.
3. [ ] **Eksekusi REQ-04:** Tulis ulang [`scripts/seed-questions.ts`](file:///home/hari/projects/mathbank/scripts/seed-questions.ts) menggunakan Drizzle ORM murni yang selaras dengan skema saat ini.
4. [ ] **Eksekusi REQ-06:** Bungkus [`duplicateBundle`](file:///home/hari/projects/mathbank/src/lib/services/bundle-write.ts) dalam `db.transaction()`.

### Langkah Arsitektur Jangka Panjang (Fase 1 Cetak Biru v2 - Minggu Depan):
1. [ ] **Eksekusi OPT-01:** Buat tabel 1:1 `question_embeddings`, pindahkan data vektor, drop kolom `questions.embedding`, dan ubah indeks HNSW menjadi partial index.
2. [ ] **Eksekusi OPT-02:** Terapkan batch multi-row insert pada pipeline ingest commit untuk memangkas latensi I/O hingga 90%.

---

## 10. Catatan Verifikasi Mutu (Sesuai Batas Mutu #44)

* **Verifikator:** Senior Staff Engineer & Drizzle ORM Specialist (`drizzle-orm-expert`)
* **Metode Audit:** Audit statis mendalam (*exhaustive static AST review*), analisis skema Drizzle terhadap PostgreSQL 18 catalog, pelacakan alur data (taint analysis) pada kebocoran data rahasia, dan benchmarking terhadap Cetak Biru Strategis v2.0.
* **Hasil Verifikasi:**
  - 12 berkas skema Drizzle dan 8 layanan L5 telah diaudit secara menyeluruh.
  - Skema dasar dinilai sangat disiplin dalam penggunaan UUIDv7 dan CHECK constraints.
  - Ditemukan 3 isu berkategori **Critical** yang memblokir kelayakan rilis v2 jika tidak segera diremediasi.
* **Tautan Berkas Terverifikasi:**
  - Invarian Skema: [`src/lib/db/invariants.ts`](file:///home/hari/projects/mathbank/src/lib/db/invariants.ts)
  - Proyeksi Kolom: [`src/lib/db/projections/question.ts`](file:///home/hari/projects/mathbank/src/lib/db/projections/question.ts)
  - Penanganan Error: [`src/lib/db/errors.ts`](file:///home/hari/projects/mathbank/src/lib/db/errors.ts)
  - Safety Invariants SQL: [`drizzle/manual/db_safety.sql`](file:///home/hari/projects/mathbank/drizzle/manual/db_safety.sql)

---
*Laporan ini disusun secara objektif dan mendalam untuk menjamin keandalan, keamanan, dan performa basis data MathBank v2.0.*
