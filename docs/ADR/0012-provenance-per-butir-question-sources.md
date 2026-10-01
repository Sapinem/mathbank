# ADR-0012 — Provenance per-butir: tabel `question_sources` (multi-sumber)

- **Status:** 🟡 Diusulkan (menunggu persetujuan eksekusi skema)
- **Tanggal:** 2026-10-01
- **Pengambil keputusan:** Pemilik produk (prinsip disetujui: **1 soal boleh >1 sumber**)
- **Terkait:** `docs/ADR/0010-*.md`, QBank `master:src/lib/db/schema/sources.ts` (`question_sources`),
  `src/lib/ingest/{commit.ts,queue.ts}`, `src/lib/db/schema/question.ts`

## Konteks

Soal perlu menyimpan **provenance** (asal-usul) yang kaya: sumber perolehan (`source_id`),
**judul artikel web**, **URL**, **waktu akses**, detail publikasi. Audit menemukan:

1. **`ingest_queue` SUDAH menyimpan `title` (judul artikel) + `source_url` + `raw_format`** —
   tapi **`commitItems()` membuang keduanya** saat commit ke `questions` (jejak provenance terputus).
2. `questions` hanya punya `source_id` (**FK tunggal**) → **1 soal = maks 1 sumber**.
3. `sources` (master) = identitas penyelenggara/penerbit (dipakai ulang), **bukan** milik judul/URL butir.
4. QBank `master` memodelkan ini dengan tabel **`question_sources`** (per-butir, `questionId` **tanpa** UNIQUE →
   multi-sumber), berisi: `source_type`, `institution_or_school`, `school_id`, `grade`, `year`,
   `event_name`, `item_number`, `publisher`, `book_title`, `author`, **`url`**, `notes`, `source_id`.

## Keputusan

**Buat tabel `question_sources`** (provenance **per-butir**, mendukung **>1 sumber per soal**).
Tambah kolom **`accessed_at`** (waktu akses) dan **`title`** (judul artikel) yang tidak ada di QBank
tapi dibutuhkan (kebutuhan pemilik produk).

### DDL usulan

```sql
CREATE TABLE question_sources (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  question_id    uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_id      uuid REFERENCES sources(id) ON DELETE SET NULL,   -- master (opsional)
  source_type    source_kind NOT NULL DEFAULT 'website',           -- pakai enum yg ADA
  title          varchar(255),          -- ⭐ judul artikel/web (BARU vs QBank)
  url            text,                  -- URL sumber
  accessed_at    timestamptz,           -- ⭐ waktu akses (BARU vs QBank)
  publisher      varchar(255),
  author         varchar(255),
  year           smallint,
  grade          varchar(20),
  item_number    varchar(50),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_sources_question ON question_sources (question_id);
CREATE INDEX idx_question_sources_source   ON question_sources (source_id);
CREATE INDEX idx_question_sources_type     ON question_sources (source_type);
-- TANPA unique(question_id, source_id) → 1 soal boleh >1 sumber (sesuai keputusan).
```

- **Pakai enum `source_kind`** yang sudah ada (book/website/school/competition) — **tak** buat enum baru.
- **`ON DELETE CASCADE`** dari `questions` (provenance ikut soal); `source_id` **SET NULL**.

## Alasan

1. **1 soal boleh >1 sumber** (diputuskan) → butuh tabel, bukan kolom di `questions`.
2. **Provenance milik butir**, bukan `sources` master (1 artikel → N soal; 1 website → N artikel).
3. **Menutup cacat nyata**: `commitItems` boleh menyimpan `title`+`url`+`accessed_at` dari antrean.
4. **Cermin QBank** (pola `question_sources`), disesuaikan (tambah `title`/`accessed_at`; pakai enum yang ada).

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Kolom di `questions`** (`source_title`,`source_url`,`source_accessed_at`) | Hanya 1 sumber/soal; tak mendukung multi-sumber yang diputuskan |
| **`sources` → `publications`** | `sources` = master dipakai ulang; artikel terlalu banyak untuk jadi master |
| **Enum baru `source_type`** | Redundan — `source_kind` sudah ada & cukup |

## Konsekuensi

- **+1 tabel** (28 → **29**) → wajib perbarui `EXPECTED_INVARIANTS.tables` di
  `src/lib/db/invariants.ts` **dan** `scripts/db-verify.ts`; perbarui `SKEMA-DB-DETAIL.md` + `KAMUS-DATA.md`.
- Migrasi drizzle-kit (wajib snapshot) — expand-only, **tak destruktif**.
- Perbaiki `commitItems()`: teruskan `title`, `source_url`, `accessed_at` dari antrean → `question_sources`.
- Perbarui projection/contract (`src/lib/db/projections/question.ts`, `src/lib/contracts/question.ts`).
- Idempotensi ingest: `itemHash` tetap; provenance tak memengaruhi dedup.
- **`questions.sourceId` (FK tunggal) DIPERTAHANKAN** untuk kompatibilitas; `question_sources` menambah
  dimensi (dapat menjadi sumber utama kelak). Tidak ada penghapusan kolom di ADR ini.

## Catatan

- **Waktu akses (`accessed_at`)**: idealnya diisi saat ingest (waktu pengambilan), disimpan per-butir.
- **Belum dieksekusi** — menunggu persetujuan. Rencana eksekusi ditulis terpisah.
