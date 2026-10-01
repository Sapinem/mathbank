# ADR-0009 — Pisah `collections` (Koleksi/Arsip) dari `bundles` (Latihan/Naskah)

- **Status:** 🟡 Diusulkan (menunggu persetujuan pemilik produk)
- **Tanggal:** 2026-10-01
- **Pengambil keputusan:** Pemilik produk
- **Terkait:** `docs/audit/…`, `MathBankAuditor/reports/AUDIT-KOMPARASI-FITUR-DAN-UIUX-MATHBANK-VS-QBANK.md` §3.6,
  QBank `docs/PRD-SYSTEM-ARCHITECTURE.md` §5 (Collections) & §8 (Exams), `CONSTRAINTS.md #16/#35`

## Konteks

Saat ini **satu tabel `bundles`** (+`bundle_items`) menampung tiga varian (`bundle_type`:
`source` | `exam` | `exercise`). Model ini **mencampur dua konsep domain** yang berbeda hakikat:

- **Koleksi / Arsip Naskah** (QBank PRD §5, `/collections`): mengelompokkan soal berdasarkan
  asal-usul (Penyelenggara, Tahun, Jenjang, Tipe Evaluasi). Menampung N soal + **ringkasan
  materi & sebaran kognitif otomatis**. **Statis** (arsip). **Tanpa** urutan kaku, durasi,
  instruksi, atau bobot skor. Kepemilikan **institusional/publik**.
- **Latihan / Naskah Ujian** (QBank PRD §8, `/exams`): **merakit** naskah dari soal terpilih.
  Punya **urutan kaku** (`order_index`), durasi, instruksi, kop resmi, dual-mode cetak (guru/siswa),
  ekspor Moodle. **Dinamis** (living document). Kepemilikan **personal guru**. (Pembobotan
  `points` = fitur fase depan, QBank pun masih *deferred*.)

**Contoh nyata (dari pemilik produk):** *"satu paket latihan dari SMA Labschool"*, *"satu artikel
soal aljabar dari mathcyber"*, *"soal tryout 1 Inten"* → masing-masing = **satu Koleksi** berisi N soal.
Ini **bukan** metadata sumber biasa — ia menampung & meringkas butir soal.

## Fakta terverifikasi (2026-10-01)

1. **QBank pun memisah** menjadi dua tabel + dua rute: `collections` (+`questionSources.collectionId`)
   dan `examPackages` (+`examItems` dengan `orderIndex`, `points`). Ini konfirmasi sumber primer.
2. `bundles` di MathBank **self-contained** — hanya `bundle_items` yang FK ke `bundles`.
3. `bundle_type` di MathBank saat ini **label pasif** — tak ada perilaku yang membedakan tipe.
4. `bundles.createdById` **ditulis tapi TIDAK ditegakkan** (`listBundles` tanpa filter pemilik;
   izin `bundle:manage` = broadcast) → **cacat perilaku** (guru bisa menyentuh bundle guru lain).
5. Produksi: **1 bundle (`exam`); nol `source`.**
6. Dampak pemisahan: **18 berkas** menyentuh `bundles`/`bundle-service` (terkendali).

## Keputusan

**Pisahkan menjadi dua entitas:**

| Entitas baru | Menggantikan | Sifat |
|---|---|---|
| **`collections`** + `collection_items` | peran `bundle_type='source'` | Arsip statis; institusional; ringkasan materi/kognitif otomatis; **tanpa** urutan/durasi/points |
| **`bundles`** + `bundle_items` | peran `bundle_type IN ('exam','exercise')` | Naskah rakitan; personal (own); urutan, durasi, instruksi, cetak, Moodle |

Rasional: **dua perilaku + dua set kolom yang tumbuh berbeda** (sesuai visi pemilik produk &
preseden QBank). Memisah sekarang (1 bundle, 0 koleksi) lebih murah daripada nanti setelah kolom
tipe-spesifik menumpuk sebagai `NULL` di satu tabel.

## Rencana Eksekusi (setelah disetujui)

1. **ADR diterima** → catat di `RIWAYAT-KEPUTUSAN.md` + `PETA-DOKUMEN.md`.
2. **Migrasi skema (expand, non-destruktif)**: buat `collections`/`collection_items`;
   pindahkan data `bundle_type='source'` (saat ini nol → mudah); siapkan migrasi `contract`
   (hapus `source` dari `bundle_type` enum) pada deploy terpisah. Wajib: snapshot drizzle-kit +
   `pnpm db:verify` hijau + uji restore (`MIGRASI-ZERO-DOWNTIME.md`).
3. **Service/API**: `collection-service.ts` + `/api/collections/*`; sesuaikan `bundle-service.ts`.
4. **Perilaku**: tegakkan `createdById` (own) untuk `bundles`; `collections` = publik/institusional.
   (Perbaiki cacat #4 apa pun keputusannya.)
5. **UI**: `/collections` (katalog arsip + ringkasan) & `/bundles` (workspace latihan).
6. **Tes**: route-per-peran (#37) + integrasi DB + `pnpm check` hijau.
7. **Dokumen**: `SKEMA-DB-DETAIL.md`, `KAMUS-DATA.md`, `MILESTONE.md`, audit baru dengan §Catatan Verifikasi.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|---|---|
| **Tetap satu tabel `bundles`** (kode sekarang) | Mencampur dua perilaku & kolom berbeda; `source`-bundle tak punya urutan/durasi sementara `exam` butuh — `NULL` menumpuk |
| **`collections` = view dari `sources`+`questions`** | Salah: `sources` hanya metadata penyelenggara; tak menyimpan daftar soal terkurasi maupun ringkasan materi/kognitif |
| **Pisah DB + perilaku per-tipe (satu tabel)** | Menegakkan perilaku tanpa memecah skema; murah, tapi **tak mengakomodasi visi kolom yang tumbuh berbeda** |

## Konsekuensi

**Positif:**
- Skema eksplisit: tiap entitas punya kolom & perilaku sesuai domainnya.
- Menghapus ambiguitas `bundle_type` yang membingungkan (label pasif).
- Menutup celah: arsip institusional vs naskah personal jelas terpisah izin & kepemilikannya.

**Negatif / biaya:**
- +2 tabel baru; 18 berkas disentuh; migrasi (expand→contract) berisiko → wajib backup + uji.
- Selama fitur Koleksi belum dipakai (0 baris), tabel `collections` awalnya kosong.
- Kerja UI baru (`/collections`).

## Catatan

- **`points` (bobot skor) BUKAN bagian ADR ini** — ditunda (QBank pun menunda). Tambahkan nanti
  bila ada kebutuhan nyata.
- Cacat **`createdById` tak ditegakkan** harus diperbaiki **apa pun** keputusan tabel ini.
- Ini **belum dieksekusi.** Menunggu persetujuan pemilik produk.
