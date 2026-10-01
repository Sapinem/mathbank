# ADR-0013 — Pisah tabel: `collections` (arsip sumber) vs `bundles` (naskah rakitan)

- **Status:** ✅ **DITERIMA** (2026-10-01) — **menggantikan keputusan "Opsi 2" di ADR-0009**
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/ADR/0009-bundle-pisah-koleksi-dan-latihan.md` (digantikan),
  `docs/DESAIN-SKEMA-BUNDLE-TERPISAH.md` (rancangan teknis),
  `docs/ADR/0012-provenance-per-butir-question-sources.md` (source/provenance),
  `CONSTRAINTS.md` #46 (RESTRICT hanya hitung induk aktif)

## Konteks

`bundles` menampung **dua konsep domain berbeda** dalam satu tabel, dibedakan
kolom `bundle_type` (`source` | `exam` | `exercise`):

| | **Koleksi** (`source`) | **Latihan** (`exam`, `exercise`) |
|---|---|---|
| Hakikat | Arsip bahan mentah dari **sumber/buku/artikel web** | Rakitan kerja guru (naskah asesmen) |
| Pembeda | **source / provenance** | **owner** (pemilik) |
| Sifat | Statis (arsip historis) | Dinamis (living document) |
| Kepemilikan | **Institusional** (umum) | **Personal** (pembuatnya) |

**Bukti ketidakcocokan di skema** (verifikasi DB 2026-10-01):

```
Kolom                dipakai `source`   dipakai `exam`/`exercise`
source_id/event_id/year   ✔                   ✘ (selalu NULL)
duration_minutes/instructions/status   ✘ (selalu NULL)   ✔
```

Kolom-kolom bergantian NULL = tanda dua konsep dipaksa satu tabel.

**Riwayat keputusan:**
1. **2 Sep** — konsep "tahun menempel pada sumber, bukan soal" (spec
   `/home/hari/docs/superpowers/specs/2026-09-02-bank-soal-design.md`);
   lahir konsep **Koleksi** (19 Sep: `/collections`, arsip naskah asli).
2. **1 Okt 06:32** — disepakati **Opsi 2**: *unified DB, 1 tabel, dipisah 100% di UI*
   (catatan resmi di Mnemosyne; `AUDIT-KOMPARASI` §3.6 & §5). Alasan saat itu:
   menjaga stabilitas **28 tabel & 26 trigger**.
3. **1 Okt 08:22** — ADR-0009 ditulis dengan status **DITOLAK** untuk "pisah tabel",
   sejalan dengan Opsi 2.
4. **1 Okt (sekarang)** — pemilik produk **meninjau ulang** dan memilih **pisah tabel**.

## Keputusan

**Pisah menjadi dua pasang tabel** (menyimpang sadar dari Opsi 2):

| Tabel | Peran |
|---|---|
| `collections` + `collection_items` | Koleksi — arsip sumber, **read publik**, berbasis `source_id`/`event_id`/`year` |
| `bundles` + `bundle_items` | Latihan/Exam — naskah rakitan, **`own`** (pembuatnya), berbasis `created_by_id` |

### Perilaku & izin (diputuskan pemilik produk)

| Tipe | Buat/Ubah/Hapus | Baca |
|---|---|---|
| **Koleksi** | **umum** (semua guru/reviewer) | umum |
| **Latihan/Exam** | **`own`** — hanya pembuat | **boleh lihat punya orang lain**, tak boleh ubah |
| Admin | semua | semua |

### Relasi soal (diputuskan pemilik produk)

**Satu soal boleh berada di banyak Koleksi DAN banyak Latihan sekaligus** —
bebas, tanpa batas, tanpa eksklusivitas. Konsisten dengan model provenance
per-butir ADR-0012 ("1 soal : banyak kemunculan").
Konsekuensi: relasi `RESTRICT` (cegah hapus soal) **wajib dicek ke DUA tabel**.

### `points`

**Ditunda** (keputusan pemilik produk) — tidak ikut migrasi ini, agar fokus.
Dicatat sebagai utang; kolom tetap direncanakan di item kedua tabel.

## Alternatif yang Ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| **Opsi 2 (1 tabel + pisah UI saja)** | Perilaku beda akhirnya tetap harus di-encode lewat `bundle_type` di banyak tempat; kolom NULL bergantian tetap ada; izin per-tipe jadi bercabang di service yang sama |
| **`collections` saja, `bundles` dibuang** | Latihan punya atribut sendiri (durasi, instruksi, status) yang tak relevan untuk arsip |
| **Tetap 1 tabel, tanpa perubahan apa pun** | Meninggalkan cacat izin (`own` tak ditegakkan) & perilaku pasif `bundle_type` |

## Konsekuensi

### Skema & migrasi
- **+2 tabel** (`collections`, `collection_items`) → **29 → 31 tabel**.
- Trigger `updated_at` untuk `collections` → **31 → 32 trigger**.
- `invariants.ts` + `scripts/db-verify.ts` (saat ini: `tables: 29`) **wajib diperbarui**.
- Migrasi drizzle-kit + snapshot; `pnpm db:migrate` di DB kosong **wajib** menghasilkan
  skema penuh (CONSTRAINTS #24) & `pnpm db:verify` hijau (#25).
- Item di kedua tabel **memakai enum `bundle_item_role`** yang sudah ada (tanpa enum baru).

### Integritas data (paling berisiko)
- `collection_items.question_id` → `questions.id` **ON DELETE RESTRICT**.
- **`isQuestionUsedInBundles` & `bundlesUsingQuestions` (`question-write.ts`) WAJIB
  memeriksa DUA tabel** — jika tidak, muncul **dead-end baru**: soal terkunci
  koleksi yang tak terdeteksi (kelas bug CONSTRAINTS #46).
- `duplicate`/`moodle-export`/`stats` harus memutuskan tabel mana yang dihitung.

### Cakupan perubahan — **32 berkas** (terhitung, bukan 18)
Termasuk: 7 API route, 5 halaman, 6 komponen (+`nav-config`), 3 service
(`bundle-service`, `moodle-export-service`, `question-write`), 2 hook,
skema, `stats`, dan **9 berkas tes**.

### UI
- Sidebar: **"Koleksi"** (baru) + **"Latihan"** (dari "Paket Soal").

## Catatan

- **ADR-0009 tetap disimpan** (tidak dihapus) sesuai aturan "jangan hapus ADR lama —
  tandai Digantikan oleh" (#32). Statusnya diubah menjadi *"Digantikan oleh ADR-0013"*.
- **Risiko dicatat jujur:** Opsi 2 dipilih demi stabilitas jumlah tabel. Keputusan ini
  membatalkannya secara sadar. Bila kompleksitas terbukti lebih mahal dari manfaat
  setelah implementasi, ADR ini dapat ditinjau kembali — tetapi **tidak** boleh
  setengah jalan (sebagian route baca tabel lama, sebagian tabel baru).
- **Utang dokumentasi:** catatan keputusan "Opsi 2" ada di **Mnemosyne** & spec di
  `/home/hari/docs/superpowers/specs/` (**di luar repo git**). Wajib disalin ke repo
  agar tidak bergantung pada memori eksternal.
