# ADR-0015 — Gabung `books` & `institutions` ke dalam `sources`

- **Status:** ✅ **DITERAPKAN** (2026-10-01) — migrasi `0009`, DB 29 → 27 tabel, 24 trigger
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

### Kolom yang ditambahkan ke `sources` (4 kolom)

| Kolom | Tipe | Untuk `kind` | Asal |
|---|---|---|---|
| `publisher` | varchar(255) | `book` | `books.publisher` |
| `author` | varchar(255) | `book` | `books.author` |
| `book_year` | smallint | `book` | `books.year` |
| `city` | varchar(100) | `school` | `institutions.city` |

→ **`sources` 8 → 12 kolom.**

### Enum `source_kind`: buang `competition` (keputusan pemilik produk)

**"Lomba tidak perlu masuk source."** UTBK / OSN / SIMAK UI adalah **event**
(jenis ujian), bukan tempat menyalin — sesuai persepsi yang disepakati di
ADR-0014 (`defantri` = sumber, `UTBK` = event). Nilai `competition` **dibuang**
dari enum `source_kind`; jenis ujian diwujudkan di tabel **`events`**.

- Data terdampak: **1 baris** `sources` "OSN Matematika SMA" (`kind='competition'`)
  — **0 soal memakainya** → **dihapus** (data mati; dibuat baru di `events` bila perlu).
- `source_kind` final: **`book` | `website` | `school`** (3 nilai).

### Kolom yang SENGAJA TIDAK dibawa (keputusan pemilik produk)

| Kolom | Alasan dibuang |
|---|---|
| `books.isbn`, `institutions.npsn` | **"Terlalu teknis"** — kode registrasi yang tak dipakai siapa pun; bila nanti perlu, tambah belakangan |
| `institutions.province` | **Cukup `city`** (keputusan pemilik produk: "sekolah label kota aja udah") |
| `institutions.address`, `institutions.level` | Tak dibutuhkan; `level` (SMA/SMP/SD) dapat diturunkan dari `label` |
| `institutions.usage_count` | **Tak pernah berfungsi** (tak ada trigger). Sudah digantikan hitungan `questionCount` di query |
| `books.id`, `institutions.id`, `*_source_id` | Tak berguna bila 1:1 — `sources.id` sudah jadi kunci |

### Strategi pengisian: per-`kind`, sisanya NULL

| Kolom | `website` | `book` | `school` |
|---|---|---|---|
| `label`, `slug` | ✅ | ✅ | ✅ |
| `url` | ✅ | — | — |
| `publisher`, `author`, `book_year` | — | ✅ | — |
| `city` | — | — | ✅ |

**Aturan:** isi hanya yang relevan dengan `kind`. **NULL bukan cacat** — artinya
"tidak berlaku untuk jenis ini" (pola sama dengan `sources.url`).

**Jalur pengisian:**
1. **UI `/references/sources`** — form **dinamis per `kind`**: pilih `Buku` →
   muncul Penerbit/Penulis/Tahun; pilih `Sekolah` → muncul Kota.
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
| **Pertahankan `competition` di `sources`** | UTBK/OSN itu **event**, bukan tempat menyalin — mencampurnya mengulang kebingungan yang ADR-0014 selesaikan |

## Konsekuensi

- **Tabel: 29 → 27** (hapus `books`, `institutions`).
  Setelah **ADR-0014** (hapus `question_sources`) → **26 tabel**.
- `sources`: **+4 kolom** (`publisher`, `author`, `book_year`, `city`).
- **Enum `source_kind`: 4 → 3 nilai** (`competition` dibuang) — enum alteration
  di PostgreSQL; **1 baris** "OSN Matematika SMA" dihapus lebih dulu (0 soal).
- `invariants.ts` + `scripts/db-verify.ts`: `tables` diperbarui; trigger
  `updated_at` untuk `books`/`institutions` **dihapus** dari `db_safety.sql`.
- **Kode:** hapus `books`/`institutions` dari `schema/source.ts` (+relasi, tipe);
  buang `"competition"` dari `SourceKind` (`taxonomy-service.ts`), dua Zod enum
  (`api/sources/route.ts`, `api/sources/[id]/route.ts`), & `KIND_LABELS`
  (`sources-view.tsx`); `taxonomy-service.ts` — buang `leftJoin(institutions)`,
  `usageCount` murni dari `questionCount`; `sources-view.tsx` — form dinamis per `kind`.
- **Migrasi data:** kedua tabel **0 baris** → tak ada data hilang; cukup `DROP`.
  Satu baris `sources` kind=`competition` dihapus (0 soal memakainya).

## Catatan

- **⚠️ JEBAKAN (kena saat penerapan): `db_safety.sql` & DB uji.**
  1. `db_safety.sql` masih memasang trigger `updated_at` ke `books`/`institutions`
     yang sudah di-`DROP` → `db:migrate` gagal (`42P01`). Daftar tabel
     **wajib** disesuaikan setiap kali tabel dibuang.
  2. **`TEST_DATABASE_URL` (DB uji) tertinggal skema lama.** Kode sudah memakai
     kolom baru, tapi DB uji belum dimigrasi → `INSERT` gagal, dan karena
     `resolveSourceId` **menelan error** (`catch`), gejalanya menyesatkan:
     10 tes `ingest` gagal dengan `ConflictError` yang **bukan penyebabnya**.
     **Jalankan `db:migrate` + `db:verify` pada DB uji, bukan hanya DB utama.**
     Pelajaran tambahan: `catch` yang menelan error asli **mahal** — pertahankan
     `cause` saat membungkus error.
- **NPSN & `province` bisa ditambahkan kelak** bila terbukti perlu (NPSN = kode
  resmi Kemendikbud, bisa mengisi kota otomatis). Dicatat sebagai kemungkinan
  fitur masa depan, bukan kebutuhan sekarang — pemilik produk memilih
  **"yang penting jelas aja dulu"**.
- **Pola `kind` + kolom opsional ini konsisten** dengan `sources.url` yang sudah
  ada sejak awal — bukan pendekatan baru.
- **`events` kini satu-satunya rumah untuk jenis ujian.** Menghapus `competition`
  dari `sources` **menambah** kebutuhan mengisi `events` (UTBK, OSN, SIMAK UI) —
  dicatat sebagai pekerjaan lanjutan, bukan diabaikan.
