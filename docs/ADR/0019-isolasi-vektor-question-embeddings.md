# ADR-0019 — Isolasi Penyimpanan Vektor 1:1 (`question_embeddings`) & Partial HNSW Index

- **Status:** Diusulkan (Direncanakan untuk MathBank v2.0 Fase 1)
- **Tanggal:** 2026-10-07
- **Pengambil keputusan:** Principal Software Architect & Tim Pengembang
- **Terkait:** `docs/RENCANA-MATHBANK-V2.md` (§2.A),
  `docs/RENCANA-ADOPSI-ARSITEKTUR-MATHCORE-SOAL.md` (Poin 1),
  `docs/ADR/0002-arsitektur-berlapis-l1-l9.md`,
  `CONSTRAINTS.md` #42 (deduplikasi & ambang pencarian vektor)

## Konteks

Pada arsitektur MathBank v1.0, kolom `embedding vector(1024)` disimpan secara *in-row* langsung di dalam tabel utama `questions`. Vektor embedding 1024-dimensi bertipe *float* membutuhkan alokasi memori sekitar $4.1\text{ KB}$ per butir soal.

Dampak buruk arsitektur *in-row* ini terhadap performa dan skalabilitas:
1. **Cache Thrashing & Pembengkakan Buffer Pool:** Ukuran rata-rata baris pada tabel `questions` membengkak dari $\sim 280\text{ bytes}$ menjadi $\sim 4.5\text{ KB}$. Setiap operasi pembacaan umum di UI (pagination daftar soal, filter topik, audit log, rendering bundel naskah) memaksa PostgreSQL memuat seluruh *tuple* raksasa tersebut ke dalam *shared buffers* RAM, memboroskan kapasitas memori hingga $>90\%$.
2. **Indeks HNSW Global Tidak Efisien:** Indeks HNSW saat ini mengindeks seluruh baris soal, termasuk soal berstatus `draft`, soal yang di-karantina (`is_flagged = true`), soal yang telah di-*soft delete* (`deleted_at IS NOT NULL`), atau wacana stimulus yang tidak memiliki pertanyaan mandiri.
3. **Pelajaran dari Arsitektur `mathcore`:** Repositori saudara `mathcore` membuktikan bahwa pemisahan tabel data inti (*hot heap*) dan vektor (*cold vector storage*) 1:1 secara dramatis mempercepat query OLTP dan menurunkan latensi I/O secara signifikan.

## Keputusan

1. **Buat Tabel Terisolasi `question_embeddings` (Relasi 1:1):**
   ```sql
   CREATE TABLE question_embeddings (
     question_id uuid PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
     embedding   vector(1024) NOT NULL,
     model       varchar(50)  NOT NULL DEFAULT 'bge-m3',
     created_at  timestamptz  NOT NULL DEFAULT now(),
     updated_at  timestamptz  NOT NULL DEFAULT now()
   );
   ```
   - Menggunakan `question_id` sekaligus sebagai *Primary Key* dan *Foreign Key* dengan `ON DELETE CASCADE`.
   - Dilengkapi trigger pembaruan `updated_at`.
2. **Hapus Kolom `embedding` dari Tabel `questions`:**
   - Setelah proses backfill data vektor lama tuntas, kolom `questions.embedding` resmi di-*drop*.
3. **Terapkan Partial HNSW Index:**
   ```sql
   CREATE INDEX idx_question_embeddings_hnsw 
     ON question_embeddings USING hnsw (embedding vector_cosine_ops);
   ```
   - Query pencarian kemiripan semantik / RRF di-join secara kondisional hanya untuk soal aktif (`deleted_at IS NULL` dan `status = 'ready'`).
4. **Perbarui Layer Service & Repository:**
   - Seluruh mutasi vektor dipusatkan di `vector-service.ts` / `question-embedding-repository.ts`.
   - Query daftar soal (`listQuestions`) tidak lagi menyentuh data vektor sama sekali.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| **Pertahankan Kolom Vektor di Tabel `questions` (Status Quo)** | Menimbulkan pemborosan RAM PostgreSQL buffer pool secara masif ($>90\%$), memperlambat pagination dan scan tabel berulang kali. |
| **Migrasi ke Vector Database Eksternal (Pinecone / Upstash / Qdrant)** | Menambah kompleksitas operasional infrastruktur, biaya langganan cloud, latensi jaringan *cross-network*, dan memutus konsistensi transaksi ACID lokal PostgreSQL 18. Ekstensi `pgvector` lokal terbukti sangat kencang dan handal jika dipisahkan ke tabel tersendiri. |
| **Tabel Vektor dengan Auto-Increment / UUID PK Sendiri (Bukan 1:1)** | Berisiko menimbulkan anomali satu soal memiliki banyak baris embedding tanpa sengaja, serta menambah overhead indeks sekunder yang tidak diperlukan. Pola PK = FK 1:1 adalah bentuk paling bersih dan matematis. |

## Konsekuensi

**Positif:**
- **Penghematan RAM Ekstrem:** Baris tabel `questions` menyusut drastis ke $\sim 280\text{ bytes}$, scan sekuensial dan pagination ribuan soal berjalan instan tanpa membebani buffer pool.
- **Isolasi Domain:** Model embedding yang digunakan tercatat secara eksplisit (`model: 'bge-m3'`), memudahkan migrasi model atau re-embedding massal di masa depan tanpa mengunci (*table lock*) tabel transaksi `questions`.
- **Integritas Referensial Terjamin:** Relasi `ON DELETE CASCADE` menjamin tidak akan pernah ada *orphaned embeddings* saat soal dihapus permanen.

**Negatif / utang:**
- Membutuhkan migrasi dua tahap (*dual-step migration*): pembuatan tabel `question_embeddings`, penyalinan data lama, lalu penghapusan kolom `questions.embedding`.
- Query pencarian kemiripan teks membutuhkan `INNER JOIN question_embeddings` secara eksplisit pada query builder Drizzle ORM.

## Catatan

- Desain diadopsi langsung dari arsitektur teruji `mathcore` (`db/schema/embeddings.ts`).
- Skema dan migrasi dijadwalkan masuk pada rilis MathBank v2.0 Fase 1.
