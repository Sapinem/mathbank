# Snapshot Metrik DB — 2026-10-24

> **Dihasilkan otomatis** oleh `scripts/snapshot-metrics.ts` (`pnpm metrics:snapshot`).
> Jangan menyunting angka di sini — jalankan ulang skripnya.
> Sumber angka: DB pada `DATABASE_URL` saat skrip dijalankan. Setiap baris punya query asalnya (§5).

## 1. Ringkasan

| Aspek | Nilai |
|---|---|
| Skema | **27 tabel** · **24 trigger** · 3 CHECK · **84 index** (1 HNSW) |
| Soal | **11.869** — 100,0% `draft`, **0 `ready`**, 33 soft-deleted, 96,8% ber-`answer_key`, 25,4% `is_flagged` |
| Bundle | **577 aktif** · 2 arsip · 12.344 butir · rata-rata 21,4 butir/paket |
| Topik | **252** · 8.468 soal terpetakan (14.442 tautan — 71,3%) |
| Media | **2.617** aset · 1.639 tautan menjangkau 1.506 soal (12,7%) |
| Tag | **16** · 35.600 tautan (11.868 soal) |
| Provenance | **9 sumber** · **11 event** · 19,2% soal ber-`event_id` |
| Vektor | **11.869 embedding** (100,0%) · `vector(1024)` |

## 2. Kelengkapan pedagogis (gerbang rilis)

Angka ini yang menentukan berapa soal yang **boleh** keluar ke siswa — bukan jumlah soal tersimpan.

| Ukuran | Nilai | Arti |
|---|---|---|
| Soal pilihan ganda | 9.349 | punya `data_payload.options` array |
| Punya `distractorRationale` | **104** (1,1% dari PG) | syarat kontrak rilis |
| Punya `answer_key.rubric` | **0** | syarat soal esai |
| Status `ready` | **0** | satu-satunya status yang boleh dipakai siswa |

## 3. Invarian skema

| Invarian | Aktual | Minimum | Status |
|---|---|---|---|
| `tables` | 27 | 26 | ✓ |
| `checkConstraints` | 3 | 2 | ✓ |
| `hnswIndexes` | 1 | 1 | ✓ |
| `triggers` | 24 | 24 | ✓ |

✓ Semua invarian memenuhi minimum. Selisih **di atas** minimum (mis. jumlah tabel lebih banyak) tidak otomatis sehat — periksa §4.

Sumber angka minimum: `src/lib/db/schema-expectations.ts` — sama dengan `pnpm db:verify`.

## 4. Objek di luar harapan

⚠️ `question_options_mat146_backup` — tabel sisa migrasi, bukan bagian skema. Perlu keputusan pemilik: arsipkan isinya lalu DROP.

## 5. Query sumber (reproduksi)

```sql
-- skema
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
  (SELECT count(*) FROM pg_constraint
    WHERE contype='c' AND connamespace='public'::regnamespace) AS checks,
  (SELECT count(*) FROM pg_indexes WHERE schemaname='public') AS indexes,
  (SELECT count(*) FROM pg_indexes WHERE indexdef ILIKE '%hnsw%') AS hnsw,
  (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers;

-- soal
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS aktif,
  count(*) FILTER (WHERE deleted_at IS NULL AND status='draft') AS draft,
  count(*) FILTER (WHERE deleted_at IS NULL AND status='review') AS review,
  count(*) FILTER (WHERE deleted_at IS NULL AND status='ready') AS ready,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted,
  count(*) FILTER (WHERE deleted_at IS NULL AND answer_key <> '{}'::jsonb) AS ber_kunci,
  count(*) FILTER (WHERE deleted_at IS NULL AND is_flagged) AS ditandai,
  count(*) FILTER (WHERE deleted_at IS NULL AND event_id IS NOT NULL) AS ber_event
 FROM questions;

-- kelengkapan pedagogis
SELECT
  count(*) FILTER (WHERE jsonb_typeof(data_payload->'options')='array') AS soal_pg,
  count(*) FILTER (WHERE (SELECT count(*) FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(data_payload->'options')='array'
           THEN data_payload->'options' ELSE '[]'::jsonb END) o
      WHERE o ? 'distractorRationale') > 0) AS ber_distraktor,
  count(*) FILTER (WHERE answer_key ? 'rubric') AS ber_rubrik
 FROM questions WHERE deleted_at IS NULL;

-- keterhubungan
SELECT
  (SELECT count(*) FROM question_topics) AS tautan_topik,
  (SELECT count(DISTINCT question_id) FROM question_topics) AS soal_bertopik,
  (SELECT count(*) FROM question_media) AS tautan_media,
  (SELECT count(DISTINCT question_id) FROM question_media) AS soal_bermedia,
  (SELECT count(*) FROM question_tags) AS tautan_tag,
  (SELECT count(DISTINCT question_id) FROM question_tags) AS soal_bertag,
  (SELECT count(*) FROM question_embeddings) AS embedding,
  (SELECT count(*) FROM topics) AS topik,
  (SELECT count(*) FROM media_assets) AS aset_media,
  (SELECT count(*) FROM tags) AS tag,
  (SELECT count(*) FROM sources) AS sumber,
  (SELECT count(*) FROM events) AS event;

-- bundle
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS aktif,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS arsip,
  (SELECT count(*) FROM bundle_items) AS butir,
  (SELECT round(avg(c)::numeric,1) FROM (
     SELECT count(*) c FROM bundle_items GROUP BY bundle_id) x) AS rata_butir
 FROM bundles;

-- dimensi vektor
SELECT vector_dims(embedding) AS dim FROM question_embeddings LIMIT 1;

-- tabel sisa migrasi
SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
    AND table_name LIKE '%\_backup' ESCAPE '\'
  ORDER BY 1;
```

Reproduksi cepat: `pnpm metrics:snapshot` (menulis ulang berkas ini) atau `pnpm db:verify` untuk invarian saja.
