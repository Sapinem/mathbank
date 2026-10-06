# Temuan: Variasi Layout Soal Defantri & Utang Adapter

> **Status:** Temuan audit (belum diperbaiki) · **Tanggal:** 2026-10-06 · **Milik:** M9 ingest
> **Sumber bukti:** korpus lokal `~/projects/qbank/data/corpora/defantri` (274 artikel beradio)

## Ringkasan

Saat menguji 5 artikel, ditemukan bahwa **variasi layout soal defantri jauh lebih
banyak** dari yang ditangani adapter saat ini. Satu perbaikan cepat (mis. memecah
per urutan radio) **menimbulkan regresi besar** (1.383 soal ter-skip karena stem
kosong) sehingga **dibatalkan** demi keamanan. Dokumen ini mencatat variasi &
langkah berikutnya yang terukur.

## Klasifikasi 274 artikel (hasil hitung langsung)

| Pola | Jumlah artikel | Ditangani adapter? |
|---|---|---|
| Standar `qN` + opsi A–E | mayoritas | ✅ ya |
| **`qN` BENAR–SALAH** (2 radio/grup, teks Benar/Salah) | **70** | ❌ **tidak** |
| **Nama `qN` TERDUPLIKASI** di blok terpisah | **19** | ⚠️ sebagian (label-ulang-A) |
| **Radio generik** (`name="radio"`) | **6** | ❌ tidak |
| `qXNN` benar–salah | **1** | ❌ tidak |

**Total 274 artikel** (angka kategori saling tumpang tindih).

## Bukti konkret: artikel Limit Fungsi Aljabar (81–119)

- Judul menyatakan **39 soal** (81–119).
- Sumber: 40 grup radio — **q94 dipakai 2×** (terpisah oleh q93 di tengah),
  + **3 grup `qX01/02/03`** = soal benar-salah 3 pernyataan.
- Adapter sekarang menghasilkan **38 soal** (kurang 1).
- Yang hilang: (a) soal ke-2 dari `q94` (opsi −16,−4,4,16,32) tidak terambil
  karena nama q94 terpecah; (b) soal benar-salah dipaksa jadi `single_choice`.

## Kenapa perbaikan cepat GAGAL (jangan ulangi)

Percobaan: ganti segmentasi "per-nama unik" → "per-urutan kemunculan radio"
(`bundleQnGroups`). Akibat:
- Total soal korpus **10.365 → 9.251** (**1.383 soal ter-skip**, stem kosong).
- Sebab: `start` grup diambil dari pembuka `<blockquote>`/`<h4>` terdekat, yang
  untuk soal benar-salah / nama berulang **bukan** pembuka miliknya → stem salah
  → dibuang `commitItems` (`skipped`).
- **Perubahan dibatalkan** (`git checkout`). Adapter kembali ke versi stabil.

## Langkah berikutnya (disarankan, terukur)

1. **Tipe `matrix_grid` untuk benar-salah `qN`** (dampak terbesar: 70 artikel).
   Deteksi grup = 2 radio dengan teks Benar/Salah; stem = pembuka grup;
   `dataPayload = { labels:["Benar","Salah"], rows:[{text,answer}] }`
   (contoh sudah ada di `pusmendik-dayaserap`). **TDD + gerbang korpus** tiap langkah.
2. **Nama `qN` terduplikasi** (19 artikel): pecah per blok `<blockquote>`
   **dengan stem dari pembuka yang benar** (bukan `lastIndexOf` mentah).
3. **Radio generik** (6 artikel): lanjutkan pendekatan `segmentGenericRadioBlocks`
   yang sudah **teruji** pada `2015-10-...` (1 artikel), perluas ke pola lain.
4. **Gerbang:** setiap perubahan **wajib** lolos `audit-defantri-corpus.ts`
   (total soal tak boleh turun; `skipped` tak boleh naik; opsi >6 = 0).

## Prinsip yang ditegakkan

- **Jangan menambal buta** — satu perbaikan cepat menimbulkan regresi 1.383 soal.
- **Ukur lintas korpus** setiap langkah, bukan hanya 1–5 artikel uji.
- **Lebih baik tak mengubah** daripada mengubah dengan hasil lebih buruk.
