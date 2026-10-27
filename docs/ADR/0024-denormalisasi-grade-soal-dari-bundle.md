# ADR-0024: Denormalisasi Grade Soal dari Bundel & Pembersihan Kategori Non-Kelas

- **Status:** Diterima
- **Tanggal:** 2026-10-26
- **Pengusul:** Hari (Product Owner) & Claude
- **Konteks Terkait:** ADR-0010 (Event), ADR-0014 (Sumber menempel pada bundle), ADR-0017 (Acuan kurikulum ke DB), ADR-0020 (Event makro vs naskah).

---

## Konteks

1. **Kenyataan Kurikulum Matematika:**
   - Materi matematika tertentu secara sah diajarkan pada lebih dari satu jenjang. Contoh nyata: materi lingkaran (sudut pusat, sudut keliling, busur, juring) diajarkan di **Kelas 8 SMP** dan kembali diujikan serta diperdalam di **Kelas 11 SMA**.
   - Butir soal geometri lingkaran yang sama persis sah menjadi soal Kelas 8 maupun Kelas 11.
2. **Kelemahan Model Kolom Tunggal `questions.grade NOT NULL`:**
   - Sebelumnya, kolom `questions.grade` bersifat skalar tunggal dan `NOT NULL`. Akibatnya:
     - 7.064 butir soal hasil ingest web yang tidak diketahui jenjangnya terpaksa dilabeli string palsu `"umum"` demi memenuhi batasan `NOT NULL`.
     - Kategori peristiwa ujian (`"utbk"` dan `"mandiri"`) ikut dimasukkan ke dalam tabel master `grades`, padahal peristiwa seleksi sudah diatur lewat tabel `events` (ADR-0010/ADR-0020).
     - Soal tidak dapat melayani lebih dari satu jenjang kelas sekaligus.
3. **Wadah Naskah sebagai Sumber Asal (*Single Source of Truth*):**
   - Soal tidak lahir di ruang hampa; soal lahir atau dihimpun di dalam sebuah naskah/dokumen/paket soal (`bundles`), yang memiliki target kelas tertentu (`bundles.grade`).
   - Relasi keanggotaan naskah dimodelkan via `bundle_items` (Many-to-Many).
   - Hakikatnya, **kelas butir soal adalah denormalisasi agregat dari seluruh naskah aktif yang memuat butir soal tersebut**.

---

## Keputusan

1. **Master Jenjang Murni 12 Kelas Formal:**
   - Hapus entri `"utbk"`, `"mandiri"`, dan `"umum"` dari tabel `grades`. Master data `grades` murni berisi **12 baris: ID "1" s.d. "12"**.
   - Soal atau bundel seleksi masuk perguruan tinggi menggunakan tabel `events` (`event_id` menunjuk ke UTBK/SNBT), bukan kolom kelas.
2. **Representasi Jujur Soal Tanpa Jenjang:**
   - Butir soal yang belum dimasukkan ke naskah/bundel mana pun (atau bundelnya belum diketahui kelasnya) memiliki `grade = NULL` dan `grades = '{}'` (array kosong).
   - Tidak ada lagi label buatan `"umum"`.
3. **Model Denormalisasi Multi-Jenjang:**
   - Tambahkan kolom array native PostgreSQL `questions.grades varchar(20)[]` dengan default `ARRAY[]::varchar[]`.
   - Pasang index GIN pada `questions.grades` (`idx_questions_grades_gin`) untuk pencarian instan array overlap (`&&`).
   - Pertahankan `questions.grade` sebagai kolom nullable yang menyimpan jenjang primer/pertama demi kompatibilitas ke belakang.
4. **Trigger Otomatis di Database:**
   - Pasang trigger `trg_bundle_items_sync_grades` pada `bundle_items` (AFTER INSERT, DELETE, UPDATE).
   - Pasang trigger `trg_bundles_sync_grades` pada `bundles` (AFTER UPDATE OF grade, deleted_at).
   - Trigger secara otomatis menghitung ulang array `grades` dan nilai `grade` pada butir soal setiap kali terjadi penambahan/penghapusan keanggotaan naskah atau perubahan jenjang naskah.
5. **Kueri Filter Menggunakan Operator Array Overlap (`&&`):**
   - Filter `grade` di `filters-builder.ts` mencocokkan jenjang yang dicari terhadap array `questions.grades`.
   - Soal yang muncul di Kelas 8 dan Kelas 11 otomatis ditemukan oleh guru yang menyaring Kelas 8 maupun guru yang menyaring Kelas 11.

---

## Konsekuensi

### Positif:
- **Akurasi Pedagogis:** Guru SMP dan Guru SMA dapat menemukan butir soal yang sama persis tanpa perlu duplikasi data.
- **Data Bersih:** 7.000+ soal tanpa kelas tidak lagi mengotori pencarian berlabel "UMUM".
- **Performa:** Index GIN menjamin query filter `&&` tetap berada pada skala sub-milidetik (< 1ms).
- **Integritas Otomatis:** Perubahan naskah soal otomatis memperbarui profil jenjang butir soal tanpa intervensi manual.

### Netral / Penyesuaian:
- Skema DB bertambah 2 trigger (`trg_bundle_items_sync_grades` dan `trg_bundles_sync_grades`) dan 1 GIN index.
- Angka invarian `EXPECTED_INVARIANTS.triggers` di `schema-expectations.ts` dinaikkan dari 24 menjadi 26.
