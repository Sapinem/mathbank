# ADR-0015 — Gabung `books` & `institutions` ke dalam `sources`

- **Status:** ✅ **DITERIMA** (2026-10-01)
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0014-sumber-menempel-pada-bundle.md` (sumber = bundle),
  `docs/AUDIT-DB-2026-10-01.md` (temuan tabel nganggur),
  `docs/ARSITEKTUR-DAN-ALUR-MATHBANK.md`,
  `CONSTRAINTS.md` #27 (invarian lunak di service)

## Konteks

`books` & `institutions` dirancang sejak migrasi `0000` sebagai **anak 1-ke-1**
dari `sources`:

```
sources: "Buku Paket Matematika Kelas XI"
   └─ books: isbn, publisher, author, year      (UNIQUE source_id)

sources: "Ujian Sekolah SMAN 1"
   └─ institutions: npsn, level, city, province, address   (UNIQUE source_id)
```

**Fakta terverifikasi (2026-10-01):**

| Cek | `books` | `institutions` |
|---|---|---|
| Baris | **0** | **0** |
| Konsumen kode | **NOL** | 1 `leftJoin` (kontribusi nol) |
| `usage_count` berfungsi? | — | ❌ **tak ada trigger**, selalu 0 |
| Sumber ber-kind terkait | 2 (`kind='book'`) | 1 (`kind='school'`) |

Karena relasinya **selalu 1:1**, tabel terpisah **tidak memberi manfaat** —
hanya menambah tabel, JOIN, dan tempat yang bisa tak sinkron. Pola yang sudah
terbukti di proyek ini: **`sources.url`** terisi hanya untuk `kind='website'`,
NULL untuk jenis lain — **tanpa** tabel terpisah.

## Keputusan

**Gabung kolom berguna ke `sources`; hapus `books` & `institutions`.**

### Kolom yang ditambahkan ke `sources` (5 kolom)

| Kolom | Tipe | Untuk `kind` | Asal |
|---|---|---|---|
| `publisher` | varchar(255) | `book` | `books.publisher` |
| `author` | varchar(255) | `book` | `books.author` |
| `book_year` | smallint | `book` | `books.year` |
| `city` | varchar(100) | `school` | `institutions.city` |
| `province` | varchar(100) | `school` | `institutions.province` |

→ **`sources` 8 → 13 kolom.**

### Kolom yang SENGAJA TIDAK dibawa (keputusan pemilik produk)

| Kolom | Alasan dibuang |
|---|---|
| `books.isbn`, `institutions.npsn` | **"Terlalu teknis"** — kode registrasi yang tak dipakai siapa pun; bila nanti perlu, tambah belakangan |
| `institutions.address`, `institutions.level` | Tak dibutuhkan; `level` (SMA/SMP/SD) dapat diturunkan dari `label` |
| `institutions.usage_count` | **Tak pernah berfungsi** (tak ada trigger). Sudah digantikan hitungan `questionCount` di query |
| `books.id`, `institutions.id`, `*_source_id` | Tak berguna bila 1:1 — `sources.id` sudah jadi kunci |

### Strategi pengisian: per-`kind`, sisanya NULL

| Kolom | `website` | `book` | `school` | `competition` |
|---|---|---|---|---|
| `label`, `slug` | ✅ | ✅ | ✅ | ✅ |
| `url` | ✅ | — | — | — |
| `publisher`, `author`, `book_year` | — | ✅ | — | — |
| `city`, `province` | — | — | ✅ | — |

**Aturan:** isi hanya yang relevan dengan `kind`. **NULL bukan cacat** — artinya
"tidak berlaku untuk jenis ini" (pola sama dengan `sources.url`).

**Jalur pengisian:**
1. **UI `/references/sources`** — form **dinamis per `kind`**: pilih `Buku` →
   muncul Penerbit/Penulis/Tahun; pilih `Sekolah` → muncul Kota/Provinsi.
   (Pola sama dengan form per-tipe di editor soal — konsisten.)
2. **Ingest** — `kind='website'` + `label` + `slug` + `url` (tak berubah).
3. **Seed** — sesuai data contoh.

### Tanpa CHECK keras

Tidak ada constraint "kind=book wajib punya publisher". Sesuai **#27**
(invarian lunak), biarkan longgar — input tak merepotkan, dan data boleh
dilengkapi bertahap.

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Pertahankan `books`/`institutions`** | 0 baris, 0 konsumen, relasi 1:1 → tabel tanpa manfaat |
| **Bawa `isbn`/`npsn`** | Terlalu teknis (keputusan pemilik produk); tak ada konsumen |
| **Bawa `address`/`level`** | Tak dibutuhkan saat ini; `level` bisa diturunkan |
| **Tabel JSON `metadata`** | Menghilangkan type-safety; sulit difilter (mis. "sekolah di Jakarta") |

## Konsekuensi

- **Tabel: 29 → 27** (hapus `books`, `institutions`).
  Setelah **ADR-0014** (hapus `question_sources`) → **26 tabel**.
- `sources`: **+5 kolom**.
- `invariants.ts` + `scripts/db-verify.ts`: `tables` diperbarui; trigger
  `updated_at` untuk `books`/`institutions` **dihapus** dari `db_safety.sql`.
- **Kode:** hapus `books`/`institutions` dari `schema/source.ts` (+relasi, tipe);
  `taxonomy-service.ts` — buang `leftJoin(institutions)`, `usageCount` murni dari
  `questionCount`; `sources-view.tsx` — form dinamis per `kind`.
- **Migrasi data:** kedua tabel **0 baris** → **tidak ada data hilang**; cukup
  `DROP` (tak perlu pemindahan).

## Catatan

- **NPSN bisa ditambahkan otomatis kelak** — ia kode resmi Kemendikbud, dapat
  diambil dari API publik untuk mengisi kota/provinsi. Dicatat sebagai
  kemungkinan fitur masa depan, bukan kebutuhan sekarang.
- **Pola `kind` + kolom opsional ini konsisten** dengan `sources.url` yang sudah
  ada sejak awal — bukan pendekatan baru.
