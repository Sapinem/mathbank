# ADR-0013 — Pisah tabel `collections` vs `bundles` — **DIBATALKAN** (audit DB)

- **Status:** 🔴 **DIBATALKAN** (2026-10-01, hari yang sama) — migrasi & kode **direvert**;
  DB kembali ke **29 tabel / 26 trigger**
- **Status sebelumnya:** ✅ DITERIMA (2026-10-01) — dibatalkan setelah **audit seluruh DB**
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0009-*.md` (**kembali berlaku** — Opsi 2: satu tabel),
  `docs/DESAIN-SKEMA-BUNDLE-TERPISAH.md` (rancangan teknis, tetap sebagai rujukan),
  `docs/ADR/0012-*.md` (provenance per-butir `question_sources`),
  `docs/AUDIT-DB-2026-10-01.md` (hasil audit)

## Ringkasan

ADR ini semula memutuskan **memisah** `collections` + `collection_items` dari
`bundles` + `bundle_items`. Setelah diimplementasikan (skema, migrasi `0009`,
diterapkan ke DB), pemilik produk memerintahkan **audit seluruh tabel** sebelum
melanjutkan. Audit menemukan bahwa:

1. **`question_sources` sudah memuat seluruh kolom yang dibutuhkan "Koleksi"** —
   `source_id`, `source_type`, `title`, `url`, `year`, `grade`, `item_number`.
   Data nyata: **56 baris / 56 soal**, semuanya dari satu artikel (`mathcyber`).
   Artinya "Koleksi" (kumpulan soal dari satu sumber+artikel) **sudah terwakili**
   tanpa tabel baru — ia **query**, bukan entitas.
2. **`collections` menduplikasi informasi** yang sudah ada di `question_sources`
   (`year`, `grade`, judul) → risiko data tak sinkron + menambah tempat kelima
   penyimpanan `year`.
3. **DB sudah menanggung beban tabel kosong** — 9 tabel tanpa data berguna;
   menambah 2 tabel kosong lagi memperburuknya.
4. **Bentuk `collections` yang dibuat adalah ASUMSI, bukan keputusan** —
   kolomnya (`notes`, membuang `duration_minutes`/`status`) tidak pernah
   disepakati bersama.

Maka keputusan **dibatalkan**; kembali ke **Opsi 2** (satu tabel, ADR-0009 berlaku).

## Konteks (mengapa sempat dipisah)

`bundles` menampung dua konsep domain berbeda lewat `bundle_type`
(`source` | `exam` | `exercise`):

| | **Koleksi** (`source`) | **Latihan** (`exam`, `exercise`) |
|---|---|---|
| Hakikat | Arsip bahan mentah dari **sumber/buku/artikel web** | Rakitan kerja guru (naskah asesmen) |
| Pembeda | **source / provenance** | **owner** (pemilik) |
| Sifat | Statis (arsip historis) | Dinamis (living document) |
| Kepemilikan | **Institusional** (umum) | **Personal** (pembuatnya) |

**Bukti ketidakcocokan di skema** (verifikasi DB 2026-10-01):

```
Kolom                     dipakai `source`      dipakai `exam`/`exercise`
source_id/event_id/year        ✔                     ✘ (selalu NULL)
duration_minutes/status    ✘ (selalu NULL)               ✔
```

Kolom bergantian NULL = tanda dua konsep dipaksa satu tabel. **Ini tetap benar.**

## Riwayat keputusan (jejak lengkap)

1. **2 Sep** — "tahun menempel pada sumber, bukan soal" (spec
   `/home/hari/docs/superpowers/specs/2026-09-02-bank-soal-design.md`) → lahir
   konsep **Koleksi** (19 Sep: `/collections`, arsip naskah asli).
2. **1 Okt 06:32** — disepakati **Opsi 2**: *unified DB, 1 tabel, dipisah 100% di UI*
   (catatan resmi Mnemosyne; `AUDIT-KOMPARASI` §3.6 & §5).
3. **1 Okt 08:22** — ADR-0009 ditulis: "pisah tabel" **DITOLAK**, sejalan Opsi 2.
4. **1 Okt (siang)** — pemilik produk meninjau ulang → memilih **pisah tabel** →
   ADR-0013 ditulis (DITERIMA) + skema/migrasi `0009` dibuat & diterapkan.
5. **1 Okt (sore)** — pemilik produk meminta **audit seluruh tabel** →
   ditemukan temuan di atas → **ADR-0013 DIBATALKAN**, kode & DB direvert.

## Yang BENAR-BENAR perlu dikerjakan (dari Opsi 2 — belum tersentuh)

Pembatalan ini **tidak** membatalkan kebutuhan aslinya. Yang tetap perlu:

| # | Pekerjaan | Kenapa penting |
|---|---|---|
| 1 | **Tegakkan `createdById` (owner) di jalur bundle** | Sekarang `listBundles` tanpa filter pemilik & `bundle:manage` = `yes` untuk semua → **guru bisa menyentuh bundle guru lain** (cacat keamanan nyata) |
| 2 | **Pisahkan Koleksi vs Latihan di UI** | Sesuai Opsi 2: menu "Koleksi" (filter source/provenance) & "Latihan" (filter owner) — **tanpa** tabel baru |
| 3 | **`points` di `bundle_items`** | Ditunda (fase depan) |
| 4 | Izin: Koleksi read publik & tulis umum; Latihan `own` tapi **boleh dilihat** guru lain | Diputuskan pemilik produk (di bawah) |

### Perilaku & izin (keputusan pemilik produk — tetap berlaku)

| Tipe | Buat/Ubah/Hapus | Baca |
|---|---|---|
| **Koleksi** (`source`) | **umum** (semua guru/reviewer) | umum |
| **Latihan/Exam** | **`own`** — hanya pembuat | **boleh lihat punya orang lain**, tak boleh ubah |
| Admin | semua | semua |

> ⚠️ Izin ini **tidak bisa** dipasang di gerbang `permission` route
> (CONSTRAINTS #35: `own` tanpa `ownerId` selalu menolak). Wajib ditegakkan
> **di service** yang punya `ownerId` + `bundleType`.

## Alternatif yang ditolak (setelah audit)

| Alternatif | Kenapa ditolak |
|---|---|
| **Pisah tabel** (isi ADR ini semula) | Duplikasi `question_sources`; +2 tabel kosong; bentuk kolom = asumsi |
| **`collections` menyimpan `year`/`grade` sendiri** | `year` sudah ada di `question_sources`, `books`, `bundles`, `questions.event_year` → jadi tempat kelima |
| **Opsi 2 tanpa perubahan sama sekali** | Meninggalkan cacat izin owner (paling mendesak) |

## Konsekuensi pembatalan

- **DB:** tabel `collections` & `collection_items` **DIDROP** (keduanya kosong —
  nol data hilang). Migrasi `0009` dihapus; `_journal`, snapshot, skema,
  invarian, trigger `db_safety.sql` **direvert**.
- **Kembali ke 29 tabel / 26 trigger**; `pnpm db:verify` **hijau**.
- **Diverifikasi:** `pnpm db:migrate` di **DB kosong** menghasilkan skema penuh
  (29 tabel, 26 trigger) & `db:verify` hijau → CONSTRAINTS #24/#25 terpenuhi.
- `typecheck` bersih; tak ada sisa referensi `collection` di kode/migrasi.

## Catatan

- **ADR-0009 kembali berlaku** (statusnya dipulihkan dari
  "Digantikan oleh ADR-0013" → **Diterima sebagai Opsi 2**).
- **Pelajaran (audit dulu, kode kemudian):** migrasi diimplementasikan **sebelum**
  audit kegunaan tabel. Audit menemukan jawaban sudah tersedia di
  `question_sources`. **Aturan untuk ke depan: sebelum menambah tabel, buktikan
  bahwa informasi yang dibutuhkan TIDAK sudah ada di tabel yang ada.** Perintah
  audit-dulu ini datang dari pemilik produk.
- **Utang dokumentasi:** catatan keputusan "Opsi 2" ada di **Mnemosyne** & spec di
  `/home/hari/docs/superpowers/specs/` (**di luar repo git**) → wajib disalin ke repo.
