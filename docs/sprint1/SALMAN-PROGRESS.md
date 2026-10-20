# Sprint 1 — Progress Salman (Backend / Data Enrichment)

Issue: **MAT-125** — ACT-07 Embedding + ACT-08 Media + ACT-11 Difficulty
Branch: `paperclip/dev` · Commit skrip: `b0c3dbf`
DB: PostgreSQL 18 @ `localhost:5433/mathbank` · BGE-M3: `http://127.0.0.1:3005`

Status ringkas:

| Task | Status | Bukti |
| --- | --- | --- |
| ACT-08 Relasi Media | ✅ **Selesai & terverifikasi** | `question_media` 1.639 baris · 100% referensi terpetakan |
| ACT-11 Distribusi Difficulty | ✅ **Selesai & terverifikasi** | 5 level terisi, sebaran 10/25/35/20/10 |
| ACT-07 Batch Embedding | 🟡 **Berjalan di background** | 138/11.889 (1,2%) saat dokumen ini ditulis |

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
laju ≈ 0,65–0,70 soal/dtk (service CPU-bound ~380% dari 8 core)
ETA ≈ 4,5 jam untuk 11.857 soal sisa
```

Angka live: `grep Embedded logs/embedding-$(date +%F).log | tail -1`.

### Pemantau & laporan akhir otomatis

`scripts/watch-embedding.sh` menemani runner: tiap 10 menit mencatat cakupan ke
`logs/embedding-watch-YYYY-MM-DD.log`, dan saat runner selesai menulis laporan
akhir `docs/sprint1/ACT-07-EMBEDDING-REPORT.md` (total/embedded/%/sisa/gagal).

```bash
INTERVAL=600 ./scripts/watch-embedding.sh   # jalankan di background
```

DoD akhir (`> 95% embedded`) **belum tercapai** dan tidak mungkin selesai dalam
satu heartbeat — ini pekerjaan background berjam-jam. Skrip bersifat resumable,
jadi heartbeat berikutnya cukup memverifikasi cakupan dan melanjutkan bila perlu.

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
