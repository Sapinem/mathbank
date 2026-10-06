# ADR-0016 — Tambah `collections` sebagai konsep berdampingan (arsip naskah publik)

- **Status:** 🔴 **DIGANTIKAN OLEH ADR-0018** (2026-10-05, MAT-39) — Dihapus kembali via migrasi `0014` karena 0 baris pemakaian di produksi dan fungsinya disatukan ke `bundles.origin` (DB 28 → 26 tabel).
- **Pengambil keputusan:** Pemilik produk & Software Architect
- **Terkait:** `docs/ADR/0018-drop-collections-origin-discriminator.md` (**pengganti resmi**),
  `docs/ADR/0013-*.md` (**sebagian dilanjutkan** — lihat §"Kenapa 0013
  dulu dibatalkan, dan kenapa alasan itu tak berlaku lagi"),
  `docs/ADR/0009-*.md` (**tetap berlaku** untuk `bundles` — tak diubah),
  `docs/DESAIN-SKEMA-BUNDLE-TERPISAH.md` (rancangan teknis),
  `docs/ADR/0014-*.md` (**sebab langsung** — `question_sources` dihapus),
  `CONSTRAINTS.md` #19 (tak ada kode mati)

## Konteks

### Kenapa ADR-0013 dulu dibatalkan

ADR-0013 memutuskan **memisah** `collections` dari `bundles`, lalu **dibatalkan
hari yang sama** setelah audit. Alasan pembatalannya, dikutip dari ADR-0013:

> *"**`question_sources` sudah memuat seluruh kolom yang dibutuhkan 'Koleksi'** —
> `source_id`, `source_type`, `title`, `url`, `year`, `grade`, `item_number`.
> Artinya 'Koleksi' … **sudah terwakili** tanpa tabel baru — ia **query**,
> bukan entitas."*

Jadi keputusan itu bergantung **sepenuhnya** pada keberadaan `question_sources`.

### Kenapa alasan itu tak berlaku lagi

**`question_sources` SUDAH DIHAPUS** oleh **ADR-0014** (sumber menempel pada
bundle). Tabel yang dijadikan dasar pembatalan **tidak ada lagi**:

```
1 Okt siang : ADR-0013 DITERIMA   → pisah tabel
1 Okt sore  : audit → DIBATALKAN  ← alasan: "question_sources sudah jadi Koleksi"
2 Okt       : ADR-0014 → question_sources DIHAPUS
              ↑ dasar pembatalan ADR-0013 ikut hilang
2 Okt       : ADR-0016 → koleksi tidak punya wadah sama sekali
```

Setelah ADR-0014, "Koleksi" **tidak lagi punya wujud** di skema:
- `question_sources` (yang dulu mewakilinya) — **dihapus**
- `bundles` + `bundle_items` — memuat **naskah**, tapi **bertipe** (source/exam/
  exercise) dan punya `status`/`created_by_id`/`duration_minutes` → itu **artefak
  kerja guru**, bukan arsip institusional
- `sources` — hanya **master data sumber** (label, url, kota) — **bukan**
  kumpulan soal

Maka kebutuhan aslinya **kembali hidup**: arsip soal yang **statis, publik, tanpa
pemilik personal**.

### Dua konsep yang beda hakikat

| | **Koleksi** | **Bundle** (naskah) |
|---|---|---|
| Hakikat | Arsip bahan dari sumber | Rakitan kerja guru |
| Pembeda | **source / provenance** | **owner** (pemilik) |
| Sifat | Statis (historis) | Dinamis (living document) |
| Kepemilikan | **Institusional** (publik) | **Personal** (pembuatnya) |
| Siap cetak/ekspor | ✘ | ✔ |
| Status kurasi | ✘ | ✔ |

## Keputusan

| # | Aksi |
|---|---|
| 1 | **Tambah tabel `collections` + `collection_items`** (M:N ke `questions`) |
| 2 | **`bundles` TIDAK DISENTUH** — `bundle_type` tetap `source`\|`exam`\|`exercise`; ADR-0009 tetap berlaku |
| 3 | **Izin:** `collections` **publik** (semua boleh lihat, guru/reviewer boleh ubah); `bundles` tetap **`own`** |
| 4 | **Tambah permission `collection:view` & `collection:manage`** |
| 5 | **Tanpa UI** untuk sekarang — skema + service + izin dulu |
| 6 | `collections` **tanpa `created_by_id`** — publik/institusional (bila perlu audit, pakai `audit_logs`) |

### Bentuk tabel

```sql
CREATE TABLE collections (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  title        varchar(255) NOT NULL,
  slug         varchar(255) NOT NULL,
  source_id    uuid REFERENCES sources(id) ON DELETE SET NULL,  -- penyeleggara/penerbit
  event_id     uuid REFERENCES events(id)  ON DELETE SET NULL,  -- konteks ujian asli
  year         smallint,                                        -- tahun naskah
  grade        varchar(20),                                     -- jenjang/kelas
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collections_slug ON collections (slug);
CREATE INDEX idx_collections_source_id  ON collections (source_id);
CREATE INDEX idx_collections_event_id   ON collections (event_id);

CREATE TABLE collection_items (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES questions(id)   ON DELETE RESTRICT,
  order_index   integer NOT NULL DEFAULT 1,   -- tampilan saja, bukan nomor ujian
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, question_id)
);
```

**Perbedaan dari rancangan awal** (`DESAIN-SKEMA-BUNDLE-TERPISAH.md` §3.1):
kolom **`acquisition` DIBUANG** — `source_id` sudah menyatakan asalnya, jadi
`acquisition` (teks bebas) berpotensi **duplikat** → melanggar CONSTRAINT #19.

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Tak ada `collections`** (status quo) | Koleksi **tak punya wadah** setelah `question_sources` dihapus; kebutuhan aslinya hilang |
| **`collections` = metadata sumber saja** (tanpa `collection_items`) | Bukan arsip **soal** — `sources` sudah jadi master data sumber |
| **Pakai `bundles.bundle_type='source'` sebagai Koleksi** | Kolom bergantian NULL (masalah asli ADR-0013 tetap ada); `bundles` punya `status`/`created_by_id` (milik konsep personal) |
| **Sekalian buang `bundle_type`** | **Diputuskan pemilik produk: JANGAN** — bentuk belum jelas, jangan diputuskan sebelum ada pola pemakaian (pelajaran ADR-0013) |
| **Sekalian bangun UI** | Skema + service dulu; UI setelah bentuknya terbukti |

## Konsekuensi

### Skema
- **26 → 28 tabel** (`collections`, `collection_items`).
- Trigger `updated_at`: **24 → 25** (`collections` saja — `collection_items`
  tanpa `updated_at`, ia baris penghubung).
- `bundles`: **tak berubah** (0 kolom disentuh).
- `invariants.ts` + `scripts/db-verify.ts`: `tables` & `triggers` diperbarui.

### Izin
- Permission baru: **`collection:view`**, **`collection:manage`**.
- Pemetaan peran: `view` → semua peran; `manage` → guru, penelaah, admin
  (pola sama dengan `bundle:manage`).
- Berbeda dari `bundles` (**`own`**), `collections` **`yes`** untuk semua guru —
  jadi **bisa** dipasang di gerbang `permission` route (tak perlu service,
  karena tak ada `ownerId` — CONSTRAINTS #35 tak berlaku di sini).

### Service
- `collection-service.ts`: `listCollections`, `getCollection`, `createCollection`,
  `updateCollection`, `deleteCollection`, `addItem`, `removeItem`, `reorderItems`.
- Pola mengikuti `bundle-service.ts` (yang sudah teruji).

### Risiko dicatat
- **Menambah 2 tabel kosong** — risiko yang dulu dikritik ADR-0013. **Mitigasi:**
  kali ini `question_sources` **sudah tidak ada**, jadi `collections` **tidak
  menduplikasi** apa pun; dan ia **satu-satunya** wadah Koleksi.
- **Bila ternyata tak dipakai**, ia bisa dibuang **tanpa menyentuh `bundles`**
  (berbeda dari ADR-0013 yang merombak).
- **Bertentangan dengan QBank final** (`master` menyatukan `collections`+`exams`
  → `question_bundles`). Diterima sadar: **MathBank ≠ QBank**, dan kebutuhan
  arsip publik MathBank berbeda.

## Catatan penerapan (2026-10-02)

- **Enum audit ikut berubah:** `audit_entity` + nilai `collection`. Ini titik
  yang mudah terlewat — `recordAudit` **menolak** `entityType` di luar enum,
  jadi tabel `audit_logs` akan gagal mencatat tanpa perubahan ini.
- **Izin & tes DIKUNCI:** `permissions.test.ts` memverifikasi **seluruh matriks**
  secara exhaustive sehingga sel baru **wajib** dideklarasikan — perubahan izin
  tak bisa lolos diam-diam. Itu **penjaga yang bekerja** (typecheck gagal saat
  pertama ditambah).
- **`CONSTRAINTS #19` ditegakkan pada diri sendiri:** dua fungsi yang semula
  kutulis (`collectionsFilterFragment`, `countCollectionItems`) **dibuang**
  karena tak dipakai; begitu pula tipe `_CollectionSelfRef`.
- **13 tes** mengunci invarian pembeda dari `bundles`: **publik** (guru lain
  boleh kelola), **idempoten** (tambah soal sama 2×), **RESTRICT** (soal
  terarsip tak bisa dihapus), **CASCADE** (hapus koleksi tak menghapus soal),
  dan **M:N** (satu soal di banyak koleksi).
- **Pelajaran ADR-0015 diterapkan:** `db_safety.sql` **dan DB uji**
  dimigrasikan **bersamaan** — jebakan yang dulu kena dua kali kini dihindari.

## Catatan

- **Melanjutkan ADR-0013, bukan menyalinnya.** ADR-0013 memisah dengan
  **memindahkan `source` keluar dari `bundles`** (merombak). ADR ini
  **menambah tabel baru** dan **membiarkan `bundles` utuh** — jauh lebih kecil
  risikonya.
- **Pelajaran yang diterapkan:** bentuk diputuskan **bersama pemilik produk**
  sebelum kode ditulis (4 pertanyaan dijawab eksplisit), bukan diasumsikan —
  inilah kesalahan yang membuat ADR-0013 dibatalkan (poin 4 di ADR-0013:
  *"bentuk `collections` yang dibuat adalah ASUMSI"*).
- **Jejak keputusan dijaga:** ADR-0013 **tidak ditimpa**; ADR ini mencatat
  hubungannya secara eksplisit.
