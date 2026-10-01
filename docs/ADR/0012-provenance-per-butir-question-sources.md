# ADR-0012 — Provenance per-butir: tabel `question_sources` (multi-sumber, anti-duplikat)

- **Status:** ⚪ **DIGANTIKAN SEBAGIAN oleh [ADR-0014](0014-sumber-menempel-pada-bundle.md)** (2026-10-01)
  — tabel `question_sources` **dihapus**; sumber menempel pada **bundle**.
  Prinsip **dedup `contentHash`** tetap berlaku (kini via `bundle_items`).
- **Status sebelumnya:** ✅ DITERIMA (2026-10-01) — dieksekusi T1–T8
- **Tanggal:** 2026-10-01
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0010-*.md`, QBank `master:src/lib/db/schema/sources.ts` (`question_sources`),
  QBank `master:src/app/api/questions/[id]/sources/route.ts` (`QuestionService.addSource`),
  QBank commits `df10d00`/`fc39b5c` (rename `question_appearances` → `question_sources`),
  `src/lib/ingest/{commit.ts,queue.ts,hash.ts}`, `src/lib/db/schema/question.ts`

## Konteks

**Kebutuhan pemilik produk:** relasi soal↔sumber = **many-to-many**. Saat menambahkan soal yang
**isinya sama persis**, **jangan** buat soal baru di `questions` — cukup **tambahkan sumber di sisi soal**
(soal yang sudah ada). Ini mencegah duplikat soal.

Temuan (terverifikasi ke kode/sumber primer):

1. **`ingest_queue` sudah menyimpan `title` (judul artikel) + `source_url`** — tapi **`commitItems()`
   membuang keduanya** saat commit ke `questions` (jejak provenance terputus) → **cacat nyata**.
2. `questions.source_id` = **FK tunggal** → 1 soal = maks 1 sumber (tak mendukung many-to-many).
3. **Dedup sekarang SALAH arah**: `itemHash(source, stem)` = `sha256(source + "\0" + stem)` →
   memasukkan `source` ke hash → **soal identik dari sumber berbeda dianggap beda → duplikat dibuat**.
   Juga `existingItemHashes(sourceId)` hanya memindai **dalam satu sumber** (bukan global).
4. **QBank `master` pilihan final**: tabel **`question_sources`** (dulu `question_appearances` →
   di-rename `df10d00`/`fc39b5c`), dengan endpoint **`POST /api/questions/[id]/sources`**
   (`QuestionService.addSource(id, body)`) = *"tambahkan sumber ke soal"*, UI menyebutnya **"Riwayat"**.

## Keputusan

1. **Buat tabel `question_sources`** — provenance **per-butir**, **many-to-many** (`question_id` TANPA UNIQUE),
   dengan **`UNIQUE (question_id, source_id)`** untuk mencegah baris sumber ganda.
2. **Dedup soal berbasis KONTEN: `stem + OPSI`** (keputusan pemilik produk; opsi **menentukan** identitas).
   `contentHash(stem, options)` — **TANPA `source`**, normalisasi spasi; opsi dibandingkan
   **sebagai himpunan teks** (label/urutan diabaikan — tahan opsi teracak).
3. **Perilaku upsert**: soal ada (contentHash sama) → **tambahkan `question_sources`** (jangan buat soal);
   belum ada → buat soal + `question_sources`.
4. **Perbaiki `commitItems()`**: teruskan `title`/`source_url`/`accessed_at` dari antrean → `question_sources`.

### DDL

```sql
CREATE TABLE question_sources (
  id             uuid PRIMARY KEY DEFAULT uuidv7(),
  question_id    uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_id      uuid REFERENCES sources(id) ON DELETE SET NULL,
  source_type    source_kind NOT NULL DEFAULT 'website',  -- pakai enum yg ADA
  title          varchar(255),          -- ⭐ judul artikel/web (BARU vs QBank)
  url            text,                  -- URL sumber
  accessed_at    timestamptz,           -- ⭐ waktu akses (BARU vs QBank)
  publisher      varchar(255),
  author         varchar(255),
  year           smallint,
  grade          varchar(20),
  item_number    varchar(50),
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- cegah baris sumber ganda utk soal yang sama (bila source_id terisi)
  UNIQUE (question_id, source_id)
);
CREATE INDEX idx_question_sources_question ON question_sources (question_id);
CREATE INDEX idx_question_sources_source   ON question_sources (source_id);
CREATE INDEX idx_question_sources_type     ON question_sources (source_type);
```

### Dedup (anti-duplikat)

```ts
// hash.ts — BARU
export function contentHash(stem: string, options: string[]): string {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const opts = options.map(norm).sort();           // himpunan (label/urutan diabaikan)
  return sha256(`${norm(stem)}\u0000${opts.join("\u0001")}`);
}
```
- `itemHash(source, stem)` **LAMA** → **diganti** oleh `contentHash` (tanpa `source`).
- `existingItemHashes(sourceId)` → diganti **`findQuestionByContentHash(hash)`** (pencarian **global**).
- Simpan hash di kolom baru **`questions.content_hash`** (varchar 64, **unique partial** untuk status
  non-deleted) → pencarian & jaminan anti-duplikat di tingkat DB.

## Alasan

1. **Many-to-many** (diputuskan) → `question_sources`, bukan kolom di `questions`.
2. **Provenance milik butir** (1 artikel → N soal; 1 website → N artikel).
3. **Anti-duplikat** harus terjadi di **dua lapis**: logika (`contentHash` global) + DB (unique `content_hash`).
4. **Cermin QBank** (`question_sources` + `addSource`), disesuaikan (tambah `title`/`accessed_at`).

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| Kolom di `questions` | Hanya 1 sumber/soal |
| Dedup `stem` saja (tanpa opsi) | **Ditolak pemilik produk**: soal dengan opsi beda = soal berbeda |
| Dedup `stem+opsi+kunci` | Lebih ketat dari yang dipilih; risiko taksa (kunci sering kosong di draft) |
| `itemHash(source, stem)` (sekarang) | **SALAH**: source di hash → memicu duplikat lintas-sumber |

## Konsekuensi

- **+1 tabel** (28 → **29**) + **+1 kolom** `questions.content_hash` → perbarui
  `EXPECTED_INVARIANTS.tables` di `src/lib/db/invariants.ts` **dan** `scripts/db-verify.ts`.
- Migrasi drizzle-kit (snapshot wajib) — expand-only, tak destruktif.
- Perbaiki `commitItems()` (title/url/accessed_at + upsert).
- **Data lama (prod: 14 soal)** mungkin sudah duplikat lintas-sumber → **skrip migrasi dedup** (tinjau terpisah).
- Perbarui projection/contract + UI ("Riwayat"/asal-usul).

## Catatan

- `questions.source_id` (FK tunggal) **dipertahankan** (kompatibilitas); `question_sources` menambah dimensi.
- Rencana eksekusi: `docs/RENCANA-QUESTION-SOURCES.md` (T1–T8).

## Tambahan (2026-10-01) — Dedup DUA-TINGKAT & menutup CONSTRAINTS #43

Keputusan pemilik produk: **contentHash exact (auto-gabung) + sambungkan dedup near berbasis embedding**
(memanfaatkan alat yang **sudah ada**, jangan bikin baru) → sekaligus **menutup utang #43**
(`fusion.ts`/RRF+dedup tanpa konsumen produksi).

### Fakta terverifikasi

| Alat | Ada | Konsumen produksi | Fungsi |
|---|---|---|---|
| `contentHash` (stem+opsi, tanpa source) | ✅ (ADR ini) | ingest (`commitItems`) | **Exact** — konten sama |
| `fusion.ts` `dedup()` (Jaccard: exact 0.98 / near 0.85 + penalaran) | ✅ | ❌ **hanya tes** (#43) | **Near** teks |
| Embedding `bge-m3` (`<=>` HNSW) | ✅ | ✅ (pencarian semantik) | **Near** semantik |
| Embedding saat **ingest** | — | ❌ **tak dihitung** | — |

### Desain dedup dua-tingkat (benar menurut #42) — **tempat berbeda**

Karena `near (0.85) < exact (0.98)`, syarat `s ≥ exact` **disubsumsi** `s ≥ near` → zona near
harus punya **diskriminator** (kalau tidak, salah satu ambang jadi logika mati — pelanggaran #42).

| Tingkat | Tempat | Aksi | Alat |
|---|---|---|---|
| **1. Exact** (`contentHash` sama) | **ingest** (`commit.ts`) | **auto-gabung**: tambah `question_sources` ke soal lama | hash (murah, tanpa vektor) |
| **2. Near** (0.85 ≤ s < 0.98) | **enrichment** (`embedQuestions`) | **JANGAN auto-gabung**; tandai (`is_flagged`) bila **penalaran sama**; bila beda → pertahankan keduanya (#42) | `findNearDuplicates` (vektor `<=>`) |

> **Keputusan pemilik produk (2026-10-01):** near-dedup di **enrichment**, **BUKAN** di ingest —
> agar **ingest tetap cepat** (dedup vektor berat). Ingat: embedding **belum** dihitung saat ingest.

**Implementasi near** memakai vektor (HNSW `<=>`) + ambang `DEDUP_EXACT`/`DEDUP_NEAR` dari
`fusion.ts` (menutup #43). Soal tanpa embedding → near dilewati (exact tetap jalan di ingest = *graceful*).

### Dampak & konsumen (#43)

- `fusion.ts` (ambang `DEDUP_EXACT`/`DEDUP_NEAR`) **kini dipakai jalur produksi** (`enrichment-service`) → **menutup #43**.
- `embedQuestions` mengembalikan `nearFlagged` (jumlah soal ditandai mirip).
- Tes: exact (auto-gabung, ingest), near+penalaran sama (flag), near+penalaran beda (dua soal dipertahankan),
  jauh (dua soal) — **menutup #42** dengan kasus batas eksplisit.
