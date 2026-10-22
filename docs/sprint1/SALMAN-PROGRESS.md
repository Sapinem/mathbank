# Sprint 1 — Progress Salman (Backend / Data Enrichment)

Issue: **MAT-125** — ACT-07 Embedding + ACT-08 Media + ACT-11 Difficulty
Branch: `paperclip/dev` · Commit skrip: `b0c3dbf`
DB: PostgreSQL 18 @ `localhost:5433/mathbank` · BGE-M3: `http://127.0.0.1:3005`

Status ringkas:

| Task | Status | Bukti |
| --- | --- | --- |
| ACT-08 Relasi Media | ✅ **Selesai & terverifikasi** | `question_media` 1.639 baris · 100% referensi terpetakan |
| ACT-11 Distribusi Difficulty | ✅ **Selesai & terverifikasi** | 5 level terisi, sebaran 10/25/35/20/10 |
| ACT-07 Batch Embedding | ✅ **Selesai & terverifikasi** | 11.869/11.869 soal aktif (100,0%) · 0 sisa · HNSW 92 MB sehat |

---

## ACT-08 — Rekonstruksi Relasi Media

**Skrip:** `scripts/rebuild-media-relations.ts` (dry-run default, `--apply` untuk menulis)

### Temuan penting: format referensi bukan `{{img:filename.ext}}`

Issue menyebut referensi berbentuk `{{img:filename.ext}}` dan meminta pencocokan
berdasarkan nama berkas. **Data aktual tidak begitu.** Semua 1.660 referensi
berbentuk shortcode 8 karakter:

```
{{img:h9JnjukZ}}   {{img:hNKTMUJX}}   {{img:RMuYxkFl}}
```

Itu adalah `media_assets.short_id` (lihat `chk_media_assets_short_id`:
`^[0-9A-Za-z]{8}$`). `original_image_path` justru berupa path ber-hash
(`2b/2b30ce03…jpg`) sehingga **tidak mungkin** dicocokkan lewat nama berkas.
Pencocokan kanonik = `short_id`; path/basename hanya dipertahankan sebagai
fallback untuk data lama.

### Hasil

```
media_assets                       : 2.617 baris
questions dengan {{img:...}}       : 1.506 (dari 1.520; 14 sudah soft-deleted)
Total referensi {{img:...}}        : 1.646
Referensi terpetakan               : 1.646 (100,0%)
Referensi orphan                   : 0
Baris question_media (insert)      : 1.639
Soal tercakup                      : 1.506
Media unik terpakai                : 1.412
```

Verifikasi SQL:

```sql
SELECT count(*) rows, count(DISTINCT question_id) q, count(DISTINCT media_id) m
FROM question_media;
-- 1639 | 1506 | 1412
```

> **Koreksi kueri DoD issue:** `media_assets` tidak punya kolom `filename`
> (kolomnya `original_image_path` / `svg_path` / `short_id`). Kueri sampel
> `SELECT qm.question_id, m.filename …` akan gagal. Versi yang benar:

```sql
SELECT qm.question_id, m.short_id, m.title, qm.role, qm.order_index
FROM question_media qm JOIN media_assets m ON qm.media_id = m.id
ORDER BY qm.question_id, qm.order_index LIMIT 8;
-- 01a1155c-6904-… | QAGwtVfi | Gambar Soal | content | 0
-- 01a1155c-6939-… | j5zccT41 | Gambar Soal | content | 0
```

Uji cakupan ulang (dihitung independen dari `content_markdown`, bukan dari tabel
`question_media`):

```sql
WITH refs AS (
  SELECT q.id question_id,
         (regexp_matches(q.content_markdown,'\{\{img:([A-Za-z0-9_.-]+)\}\}','g'))[1] ref
  FROM questions q WHERE q.content_markdown LIKE '%{{img:%' AND q.deleted_at IS NULL
), uniq AS (SELECT DISTINCT question_id, ref FROM refs)
SELECT count(*) total_refs,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM media_assets m JOIN question_media qm ON qm.media_id = m.id
         WHERE m.short_id = uniq.ref AND qm.question_id = uniq.question_id)) mapped_refs
FROM uniq;
-- 1639 | 1639  → 100,00%
```

**DoD:** `question_media > 0` ✅ · ≥ 80% referensi terpetakan ✅ (100%) ·
idempotent ✅ (dijalankan ulang 3×: delta 0 baris).

Catatan: 1.639 baris < 1.646 referensi karena satu soal bisa menyebut media
yang sama dua kali; UNIQUE `(question_id, media_id, role, order_index)` membuat
duplikat itu satu baris.

---

## ACT-11 — Distribusi Difficulty

**Skrip:** `scripts/distribute-difficulty.ts` (dry-run default, `--apply` menulis)

### Pendekatan dua tahap

1. **Skor heuristik kontinu (≈0–100)** sesuai `docs/sprint0/FARUQ-DIFFICULTY-PLAN.md`:
   panjang konten, kerapatan LaTeX, perintah LaTeX lanjut (`\int`, `\lim`,
   `\sum`, matriks) vs dasar (`\frac`, `\sqrt`), kata kunci domain
   (olimpiade/UTBK/prosedural dasar), panjang pembahasan, tipe soal
   (essay/matrix grid), jumlah opsi, dan provenance subtes.
2. **Kalibrasi kuantil** ke target Faruq 10/25/35/20/10.

Kenapa tidak skor mentah langsung dipetakan ke level? Karena ambang absolut akan
mendegenerasi (mis. 90% soal jatuh di D3 — persis masalah awal). Kuantil
mempertahankan **urutan** kesulitan yang bermakna sekaligus memaksa sebaran sehat.

### Hasil

```
difficulty |    n |  pct | avg_len (karakter)
-----------+------+------+-------------------
         1 | 1187 | 10.0 |  65
         2 | 2967 | 25.0 | 123
         3 | 4153 | 35.0 | 186
         4 | 2373 | 20.0 | 234
         5 | 1187 | 10.0 | 344
```

Total tetap **11.867** soal aktif (11.889 − 22 soft-deleted) → tidak ada baris hilang.

Bukti monotonisitas (sampel):

- **D1:** `Kubus yang panjang seluruh rusuknya \(72\) cm mempunyai luas permukaan adalah...`
- **D5:** `Diketahui \(f'(x) = x^{3}(x - a)^{2}(x - b)\) dengan \(0 \lt a \lt b\). Pernyataan yang BENAR...`

Panjang rata-rata naik monoton D1→D5 (65→344 karakter) dan isi sampel konsisten
dengan rubrik Faruq (D1 = aritmetika/geometri dasar; D5 = analisis multi-langkah).

**DoD:** tidak lagi 100% di level 3 ✅ · minimal 3 level terisi ✅ (5 level) ·
total tetap ✅.

### Pagar keselamatan

Kalibrasi kuantil **tidak idempotent** secara alami: run kedua hanya melihat sisa
baris D3 (35%) lalu memecahnya ke semua level → sebaran rusak bertahap. Karena itu
skrip menolak jalan bila sudah ada baris `difficulty <> 3`; `--force` diperlukan
untuk mengulang dari nol secara sadar.

---

## ACT-07 — Batch Embedding BGE-M3

**Skrip:** `scripts/batch-embed-questions.ts`

### Koreksi kontrak API

Issue menyebut `POST /embed` dengan body `{ texts: [...] }`. Service aktual
(FastAPI, OpenAI-compatible) adalah:

```
POST /v1/embeddings
{ "model": "bge-m3", "input": ["teks 1", "teks 2"] }
→ { "data": [ { "embedding": [1024 float], "index": 0 }, ... ] }
```

`GET /health` → `{"status":"ok","model":"BAAI/bge-m3","dim":1024}`.

### Ukuran batch: 32, bukan 50

Instruksi meminta 50. Pengukuran pada mesin ini (CPU, 8 core):

| batch | waktu/soal |
| --- | --- |
| 10 | ~0,45–0,55 s |
| 25 | ~0,50–0,67 s |
| 50 | ~1,7 s |

Batch 50 lebih lambat karena padding ke sekuens terpanjang dalam batch.
Default dipakai **32** (tetap < 50 sesuai batas instruksi) — bisa diubah `--batch`.

### Jaminan operasional (Nygard / Release It!)

- **Resumable / idempotent** — selalu `WHERE embedding IS NULL`; mati kapan pun,
  jalankan ulang melanjutkan.
- **Bulkhead** — pool `max: 3`, terpisah dari pool aplikasi (cegah `53300`).
- **Timeout wajib** — `BGE_M3_TIMEOUT_MS` (default 180 dtk) via `AbortController`.
- **Circuit breaker** — 5 batch gagal beruntun → berhenti (service mati) alih-alih
  menembak 200 request sia-sia.
- **Fail-soft** — batch gagal dipecah, dicoba per soal; soal buruk dicatat ke
  `logs/embedding-errors-YYYY-MM-DD.log`, loop lanjut.
- **Validasi dimensi** — vektor ≠ 1024 ditolak sebelum menyimpan (kolom `vector(1024)`).
- **Single runner** — PID file `/tmp/mathbank-embed.pid`.
- **Audit trail** — `embedding_content_hash` (sha256 konten) + `embedding_model_name`
  disimpan, sehingga re-embed selektif saat konten berubah.

### Cara menjalankan / memantau

```bash
cd /home/hari/projects/mathbank
nohup pnpm tsx scripts/batch-embed-questions.ts >> logs/embedding-$(date +%F).log 2>&1 &
echo $! > /tmp/mathbank-embed.pid

tail -f logs/embedding-$(date +%F).log      # progres
cat /tmp/mathbank-embed.pid                 # PID aktif

psql "$DATABASE_URL" -c "
  SELECT count(*) total, count(embedding) embedded,
         round(count(embedding)::numeric/count(*)*100,1) pct
  FROM questions;"
```

### Progres saat ini

```
total=11.867 (aktif)  batch=32  delay=100ms  pool DB max=3
laju ≈ 0,65–0,95 soal/dtk (makin cepat seiring batch makin padat;
service CPU-bound ~380% dari 8 core)
```

Snapshot heartbeat terakhir (2026-10-20 14:53 WIB): **4.266 / 11.867 (35,9%)**,
runner PID aktif sejak 13:40 (etime 1j 12m). Angka live:
`grep Embedded logs/embedding-$(date +%F).log | tail -1`.

### Verifikasi kualitas embedding (bukan sekadar "kolom terisi")

Cek integritas yang sudah lolos pada 4.170 vektor pertama:

| Pemeriksaan | Hasil |
| --- | --- |
| Dimensi vektor | `vector_dims = 1024` untuk **semua** baris ✅ |
| Provenance model | `embedding_model_name = 'bge-m3'` terisi 100% ✅ |
| Provenance hash | `embedding_content_hash` terisi 100% (memungkinkan re-embed selektif saat konten berubah) ✅ |
| Vektor duplikat | 4.146 unik / 4.170 (24 duplikat wajar — soal pendek yang identik) ✅ |
| Indeks ANN | `idx_questions_embedding_hnsw` (hnsw, `vector_cosine_ops`, m=16, ef_construction=64) siap ✅ |

Uji semantik (probe "Perhatikan balok… panjang diagonal ruang DF"):

```
neighbour                                          cos_sim
"Perhatikan gambar di bawah ini! … Panjang EF"      0,767
"Banyak diagonal ruang balok adalah…"               0,747
"Perhatikan gambar! … Jika DE:DA=2:5, maka EF"      0,725
```

Tetangga terdekat semuanya soal balok/diagonal — embedding **bermakna**, bukan
sekadar noise. Retrieval Sprint 2 (soal serupa / duplikat) sudah bisa diuji.

### Pemantau & laporan akhir otomatis

`scripts/watch-embedding.sh` menemani runner: tiap 5 menit mencatat cakupan ke
`logs/embedding-watch-YYYY-MM-DD.log`, dan saat runner selesai menulis laporan
akhir `docs/sprint1/ACT-07-EMBEDDING-REPORT.md` (total/embedded/%/sisa/gagal,
plus angka kueri DoD yang menghitung seluruh baris).

Guard anti-loop-abadi: bila runner mati tetapi cakupan mentok < 95% (mis. ada
soal yang selalu gagal), watcher tetap menulis laporan setelah 3 cek berturut-
turut tanpa kemajuan lalu keluar — tidak menggantung tanpa sinyal.

**Self-wake:** saat runner selesai, watcher juga mem-POST komentar laporan akhir
ke tiket MAT-125 (`resume: true`) lewat Paperclip API, sehingga tiket bangun
sendiri tanpa perlu polling manual. Kredensial run-scoped dibaca dari
`~/.config/mathbank/paperclip-notify.env` (mode `600`, di luar repo, tidak
pernah di-commit). Bila berkas itu tidak ada atau token kedaluwarsa, notifikasi
dilewati dan hanya dicatat di log — laporan berkas tetap menjadi bukti.
Plumbing sudah diuji: POST ke issue-id palsu → `404 {"error":"Issue not found"}`
(artinya auth & bentuk payload benar, bukan 401).

```bash
setsid nohup env INTERVAL=300 ./scripts/watch-embedding.sh \
  >> logs/embedding-watch-$(date +%F).log 2>&1 < /dev/null &
```

DoD akhir (`> 95% embedded`) **belum tercapai** dan tidak mungkin selesai dalam
satu heartbeat — ini pekerjaan background berjam-jam. Skrip bersifat resumable,
jadi heartbeat berikutnya cukup memverifikasi cakupan dan menutup tiket.

Snapshot 14:56 WIB: 4.394 ter-embed, sisa **7.473**, laju 0,97 soal/dtk →
ETA ≈ 2,2 jam (sekitar 17:10 WIB).

### Verifikasi cepat (satu perintah)

`scripts/verify-sprint1-dod.sh` mengecek ketiga DoD sekaligus, read-only, dan
mengembalikan exit code 1 selama masih ada yang belum terpenuhi:

```bash
./scripts/verify-sprint1-dod.sh
# ACT-08  PASS question_media=1639 · referensi 1639/1639 (100.0%)
# ACT-11  PASS 5 level · total 11889 · D3=35.1%
# ACT-07  FAIL embedded=4394/11889 (37.0%)  <-- target >95%, masih berjalan
```

Cakupan referensi media sengaja dihitung ulang dari `content_markdown`, bukan
dari `question_media`, supaya tidak sirkular (tidak "lulus" hanya karena tabel
yang kita isi memang berisi).

---

## ACT-07 — Hasil Akhir (tiket MAT-133)

Runner batch embedding **selesai**: cakupan soal aktif **100%**.

```
total baris questions                 : 11.891
aktif (deleted_at IS NULL)            : 11.869
ter-embed (embedding NOT NULL)        : 11.869  (100,0%)
sisa aktif                            : 0
baris tanpa embedding (soft-deleted)  : 22  (sengaja dilewati: WHERE deleted_at IS NULL)
provenance embedding_model_name       : 11.869 baris 'bge-m3'
provenance embedding_content_hash     : 11.869 baris (100%)
dimensi vektor                        : tepat 1 nilai unik = 1024, 0 baris menyimpang
```

Verifikasi terotomasi (read-only): `./scripts/verify-sprint1-dod.sh` →
**6 PASS · 0 FAIL · "SEMUA DoD TERPENUHI"** (ACT-08, ACT-11, ACT-07).

Indeks vektor:

```
idx_questions_embedding_hnsw  hnsw (embedding vector_cosine_ops) m=16 ef_construction=64
                              indisvalid=t, indisready=t, ukuran 92 MB (tabel 24 MB)
idx_questions_has_embedding   btree partial WHERE embedding IS NOT NULL
```

Latensi similarity (top-10, `ORDER BY embedding <=> $1`, 11.869 kandidat):

| Kondisi | Waktu |
| --- | --- |
| panggilan pertama (index cold, 340 page read) | ~3.570 ms |
| hangat, 3 pengukuran berurutan | **1,01 / 1,07 / 1,05 ms** |

Catatan operasional: biaya besar hanya di pembacaan pertama (92 MB indeks belum
masuk `shared_buffers`). Setelah hangat, kueri similarity ~1 ms sehingga tidak
perlu caching tambahan di layer aplikasi.

Laporan rinci: `docs/sprint1/ACT-07-EMBEDDING-REPORT.md`.

### Temuan samping: tes integrasi bisa menulis ke DB dev (diperbaiki)

Dua soal `author_id = 'test-admin'` berisi `"Soal vyuh0kxen5"` / `"Soal c3p4o0oojf8"`
(draft, dibuat 2026-10-21 14:36 WIB) ditemukan di DB **dev** — artefak tes
integrasi yang lolos ke database yang salah. Akar masalah: 22 berkas
`*.db.test.ts` memakai

```ts
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL; // fallback berbahaya
```

sehingga menjalankan Vitest langsung (tanpa `pnpm test:db`) menyasar DB dev.
Pagar `if (!url) throw …` jadi tidak berguna karena `DATABASE_URL` selalu terisi.
Fallback dihapus di seluruh 22 berkas → tes kini **gagal cepat** tanpa
`TEST_DATABASE_URL` (dibuktikan: `Error: TEST_DATABASE_URL wajib untuk tes
integrasi (DB uji)` dan jumlah baris DB dev tidak berubah 11.891 → 11.891).
Jalur resmi `pnpm test:db` tetap hijau (35/35 tes `question-service.db.test.ts`).
Dua baris draft `test-admin` dibiarkan (tidak dihapus) — bukan milik saya untuk
dihapus; kandidat soft-delete oleh pemilik data.

---

## Catatan lintas-tim

- **Ichsan (frontend):** `question_media` sekarang terisi, jadi komponen gambar
  soal bisa langsung query relasi ini. Kolom urutan = `order_index`, `role = 'content'`.
  Placeholder di konten tetap `{{img:<short_id>}}` — frontend bisa memetakan
  `short_id → media_assets.id` lalu ke URL berkas, atau pakai `question_media`
  langsung (lebih murah, tanpa parse).
- **Faruq (pedagogy):** sebaran difficulty mengikuti target 10/25/35/20/10 dari
  `FARUQ-DIFFICULTY-PLAN.md`. Sampel D1/D5 sudah dicek manual dan konsisten.
  Kalau kurator ingin koreksi per-soal, cukup UPDATE `difficulty`; skrip tidak
  akan menimpanya (pagar `difficulty = 3`).
