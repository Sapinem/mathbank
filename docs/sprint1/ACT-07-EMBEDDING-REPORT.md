# ACT-07 — Laporan Akhir Batch Embedding BGE-M3

**Tiket:** MAT-133 (turunan MAT-125) · **Pemilik:** Salman (Backend & DB Architect)
**Project:** MathBank · **Branch:** `paperclip/dev`
**DB:** PostgreSQL 18 @ `localhost:5433/mathbank` (pgvector 0.8.6)
**Embedding service:** FastAPI BGE-M3 @ `http://127.0.0.1:3005` — `POST /v1/embeddings`, model `bge-m3`, dim 1024
**Runner:** `scripts/batch-embed-questions.ts` (resumable, idempoten, bulkhead pool `max: 3`, `AbortController` timeout, circuit breaker 5 batch gagal, batch 32)

---

## 1. Status: SELESAI — cakupan 100% soal aktif

```
total baris questions                 : 11.891
aktif (deleted_at IS NULL)            : 11.869
ter-embed (embedding NOT NULL)        : 11.869  → 100,0%
sisa aktif                            : 0
tanpa embedding (soft-deleted)        : 22  → sengaja dilewati (filter WHERE deleted_at IS NULL)
```

Provenance / integritas vektor:

| Pemeriksaan | Hasil |
| --- | --- |
| `embedding_model_name` terisi | 11.869 baris, seluruhnya `bge-m3` |
| `embedding_content_hash` terisi | 11.869 baris (100%) — dasar re-embed selektif bila konten berubah |
| `vector_dims(embedding)` | tepat **1** nilai unik = **1024** |
| baris menyimpang dari dim 1024 | **0** |

Query bukti:

```sql
SELECT count(*) total_active,
       count(embedding) embedded,
       count(*) - count(embedding) remaining,
       round(count(embedding)::numeric / count(*) * 100, 2) pct
FROM questions WHERE deleted_at IS NULL;
-- 11869 | 11869 | 0 | 100.00
```

## 2. DoD

| # | Butir DoD | Status |
| --- | --- | --- |
| 1 | 11.867 (kini 11.869) soal aktif punya vektor 1024-d | ✅ 11.869/11.869 |
| 2 | Indeks vektor HNSW valid, kueri similarity cepat | ✅ `indisvalid=t`, `indisready=t`, warm ~1 ms |
| 3 | Hasil & durasi tercatat di laporan | ✅ berkas ini + `docs/sprint1/SALMAN-PROGRESS.md` |

Gerbang otomatis (read-only): `./scripts/verify-sprint1-dod.sh`
→ **6 PASS · 0 FAIL · "SEMUA DoD TERPENUHI"**.

## 3. Indeks vektor

```
idx_questions_embedding_hnsw   hnsw (embedding vector_cosine_ops) m=16 ef_construction=64
                               ukuran 92 MB  (tabel heap 24 MB)
idx_questions_has_embedding    btree partial WHERE embedding IS NOT NULL
```

Latensi top-10 `ORDER BY embedding <=> $1` atas 11.869 kandidat:

| Kondisi | Waktu eksekusi |
| --- | --- |
| panggilan pertama, index cold (340 buffer read) | ~3.570 ms |
| hangat (3× berurutan) | **1,01 ms / 1,07 ms / 1,05 ms** |

Interpretasi: biaya satu-satunya adalah memuat 92 MB indeks ke `shared_buffers`
pada akses pertama setelah server restart. Setelah hangat, similarity search
~1 ms → tidak perlu layer cache tambahan di aplikasi.

## 4. Catatan operasional

- Runner aman dijalankan ulang kapan pun: `WHERE embedding IS NULL` membuatnya
  tidak pernah mengulang vektor yang sudah ada (idempoten & resumable).
- Soal baru otomatis tertangkap pada eksekusi berikutnya; pada heartbeat ini
  ada 2 soal baru (draft) yang langsung ter-embed dan menutup sisa ke 0.
- Bila konten soal berubah, bandingkan `embedding_content_hash` untuk memilih
  baris yang perlu di-embed ulang (tidak ada re-embed buta seluruh tabel).
- 22 baris tanpa embedding adalah baris soft-deleted — sesuai desain, bukan cacat.

## 5. Temuan samping (sudah diperbaiki): isolasi DB tes bocor

Ditemukan 2 baris `author_id = 'test-admin'` (`"Soal vyuh0kxen5"`,
`"Soal c3p4o0oojf8"`, draft, 2026-10-21 14:36 WIB) di DB **dev** — artefak tes
integrasi yang menulis ke database yang salah.

Akar masalah: 22 berkas `src/**/*.db.test.ts` memakai fallback berbahaya

```ts
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL; // ❌
```

sehingga `npx vitest --config vitest.db.config.mts` (jalur non-resmi) menyasar
DB dev dan pagar `if (!url) throw …` tak pernah aktif.

Perbaikan (backend-only, 22 berkas):

```ts
const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL
```

Bukti:

- Tanpa `TEST_DATABASE_URL` → `Error: TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).`
  dan jumlah baris DB dev tidak berubah (11.891 → 11.891).
- Jalur resmi `pnpm test:db` tetap hijau: `question-service.db.test.ts` 35/35 lulus.

Dua baris draft `test-admin` **tidak dihapus** (bukan wewenang saya); kandidat
soft-delete oleh pemilik data.
