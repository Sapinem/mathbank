# ADR-0025: Pemisahan Status Arsip (FSM) dan Hapus Lunak (Soft Delete)

- **Status:** Diterima
- **Tanggal:** 2026-10-26
- **Pengusul:** Hari (Product Owner) & Claude
- **Konteks Terkait:** ADR-0002 (Arsitektur Berlapis L1–L9), ADR-0009 (Bundle Tunggal), CONSTRAINTS #46.

---

## Konteks

1. **Tumpang Tindih Konseptual di Sistem:**
   - Tabel `questions` dan `bundles` sama-sama memiliki kolom enum `status` (`draft`, `review`, `ready`, `archived`) dan kolom `deleted_at timestamptz`.
   - Terjadi inkonsistensi perlakuan antara Paket Soal (`bundles`) dan Butir Soal (`questions`):
     - Pada Paket Soal, fungsi `archiveBundle()` sebelumnya mengisi `deleted_at = NOW()` (soft-delete), sementara nilai kolom `status` tidak pernah diubah menjadi `'archived'`. Akibatnya paket terarsip lenyap dari query aktif (`WHERE deleted_at IS NULL`) dan opsi filter "Arsip" di antarmuka bahkan sengaja dihilangkan.
     - Pada Butir Soal, FSM memiliki transisi `status = 'archived'` (`deleted_at` tetap `NULL`). Teks modal konfirmasi di Bank Soal menyatakan: *"Soal yang diarsipkan akan disembunyikan dari daftar utama dan hanya bisa dilihat kembali melalui filter status 'Arsip'"*. Namun implementasi query `buildFilterFrom()` tanpa filter status tidak mengecualikan `status = 'archived'`, sehingga soal terarsip tetap bercampur di daftar utama ("Semua").
     - Pada penghapusan soal (`deleteQuestion`), sistem mengisi `deleted_at = NOW()` ("hapus lunak"), tetapi data yang di-soft-delete tidak memiliki antarmuka pemulihan (Recycle Bin), menyulitkan pemulihan bila terjadi salah hapus.
2. **Kebutuhan Domain Item Banking & Assessment (Standar Industri):**
   - Di ranah bank soal dan asesmen (Canvas LMS, Remindo, IMS QTI):
     - **Arsip (`archived`)** adalah status siklus hidup domain (*business lifecycle*). Butir soal atau naskah purna-tugas/historis (misal kurikulum lama atau soal yang dipensiunkan) **dilarang dimusnahkan** karena naskah ujian lampau tetap membutuhkan integritas referensi. Butir terarsip hanya disembunyikan dari pencarian aktif agar tidak dipilih saat merakit ujian baru, namun tetap dapat dicari di filter "Arsip".
     - **Hapus Lunak (`deleted_at`)** adalah mekanisme operasional (*trash/tombstone*) untuk membuang draf yang salah buat atau duplikat yang tidak diinginkan, menunggu retensi/pembersihan fisik (*hard delete*).

---

## Keputusan

1. **Pemisahan Tegas Antara Domain Lifecycle vs Mekanisme Operasional:**
   - **`status = 'archived'` (Arsip / Purna-Tugas):**
     - Mewakili entitas sah yang telah dipensiunkan dari operasional aktif.
     - Nilai `deleted_at` **tetap `NULL`**.
     - Rekam data dan relasi historis tetap utuh dan valid.
   - **`deleted_at IS NOT NULL` (Hapus Lunak / Tempat Sampah):**
     - Mewakili entitas yang dibuang oleh pengguna.
     - Tersembunyi dari seluruh alur kerja normal dan filter status (termasuk filter arsip).
2. **Perilaku Filter Kueri Bank Soal (`questions`):**
   - **Default (tanpa parameter `status`):** Menampilkan seluruh soal aktif (`WHERE deleted_at IS NULL AND status != 'archived'`). Soal berstatus `draft`, `review`, dan `ready` tetap tampil.
   - **Filter Status Eksplisit (`query.status`):**
     - Jika `status = 'archived'`, kueri mengembalikan hanya soal terarsip (`WHERE deleted_at IS NULL AND status = 'archived'`).
     - Jika `status = 'draft' | 'review' | 'ready'`, kueri menyaring status terkait persis seperti sebelumnya.
3. **Perilaku Paket Naskah Soal (`bundles`):**
   - Fungsi `archiveBundle(id, actor)` memperbarui `status = 'archived'` (bukan mengisi `deleted_at`).
   - Disediakan fungsi `deleteBundle(id, actor)` untuk hapus lunak (`deleted_at = NOW()`).
   - Pada `listBundles`:
     - Default atau `status === 'active'`: menyaring paket aktif (`WHERE deleted_at IS NULL AND status != 'archived'`).
     - `status === 'archived'`: menyaring paket yang diarsipkan (`WHERE deleted_at IS NULL AND status = 'archived'`).
   - Opsi filter status "Arsip" diaktifkan kembali pada komponen antarmuka `BundleListView`.
4. **Penegasan Restriksi Relasi Induk Aktif (Penyelarasan CONSTRAINTS #46):**
   - Restriksi penghapusan soal (`isQuestionUsedInBundles` dan `bundlesUsingQuestions`) hanya memperhitungkan paket naskah yang **aktif**, yaitu `bundles.deleted_at IS NULL AND bundles.status != 'archived'`.
   - Paket yang sudah diarsipkan tidak lagi menyandera butir soal di dalamnya, sehingga butir soal dapat dikelola secara independen.

---

## Konsekuensi

### Positif:
- **Janji UI Selaras dengan DB:** Keterangan *"soal diarsipkan disembunyikan dari daftar utama dan hanya muncul di filter Arsip"* kini bekerja secara nyata.
- **Integritas Naskah Sejarah Terjaga:** Naskah ujian lama yang diarsipkan tidak hilang dari sistem dan tetap bisa dibuka atau diduplikasi oleh guru untuk acuan tahun berikutnya.
- **Konsistensi Semantik:** Konsep `archived` pada Soal dan Paket memiliki arti seragam (status FSM domain), sedangkan `deleted_at` murni penanda hapus sementara.

### Hal yang Harus Dijaga:
- Setiap kueri pencarian default pada entitas yang memiliki status siklus hidup wajib membedakan kondisi `deleted_at IS NULL` (belum dihapus ke tong sampah) dengan `status != 'archived'` (sedang aktif).
