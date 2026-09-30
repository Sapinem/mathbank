# AUDIT MILESTONE 7 — PAKET SOAL (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Selesai 100%)  
**Target:** Penyusunan Naskah & Paket Soal — Bundle Service (`bundle-service.ts`), Item Reordering (Drag-and-Drop), Deduplikasi Stimulus 1×, Restriksi Hapus Soal Terpakai (`RESTRICT`), Duplikasi Paket, dan Mobile Responsive Builder (`bundle-builder.tsx`).

---

## 1. Ringkasan Ruang Lingkup Milestone 7

Milestone 7 mengelola penyusunan naskah/paket soal (`bundles` & `bundle_items`) dari bank soal yang sudah dibuat:

1. **Service Paket Soal (`src/lib/services/bundle-service.ts`):**
   * CRUD Paket: Membuat, memperbarui metadata (judul, jenis `source`/`exam`/`exercise`, durasi, petunjuk, jenjang), dan arsip paket (`deletedAt`).
   * Manajemen Slug Unik: Pembuatan slug otomatis dengan penanganan konflik duplikasi nama paket (`-2`, `-3`, dst.).
2. **Invariansi Item Paket (`bundle_items`):**
   * **Pengurutan Drag-and-Drop (`reorderItems`):** Pengurutan item soal dalam paket diperbarui secara efisien berbasis `orderIndex`.
   * **Deduplikasi Stimulus 1×:** Jika sebuah soal anak dimasukkan ke dalam paket, baris wacana/stimulus induknya (`role = 'stimulus'`) disimpan **tepat 1 kali** untuk mencegah pengulangan wacana yang sama saat dicetak.
   * **Restriksi Hapus Soal (`RESTRICT`):** Butir soal yang sudah digunakan dalam paket soal **dilarang dihapus** (HTTP 409 `ConflictError`).
3. **Penyusun Paket Responsif (`src/components/bundles/bundle-builder.tsx`):**
   * Menggunakan `@dnd-kit/react` untuk pengurutan interaktif.
   * **Pola Adaptif Mobile:** Penyusun paket menyajikan 2-kolom pada layar desktop dan beralih menggunakan **Sheet Slide-Over** pada layar seluler (DesktopOnly dibuang untuk fleksibilitas pengguna).

---

## 2. Matriks Target vs Realisasi M7

| Fitur / Komponen | Target Spesifikasi (M7) | Realisasi Kode (`src/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Service Paket Soal** | `bundle-service.ts` (CRUD, Metadata, Slug Unik) | `src/lib/services/bundle-service.ts` | ✅ Lulus |
| **Manajemen Item Paket** | `bundle_items` (Tambah/Hapus, Section, Urutan) | `addItem()`, `removeItem()`, `reorderItems()` | ✅ Lulus |
| **Deduplikasi Stimulus** | Stimulus induk tampil 1× saja di naskah paket | Ditegakkan & diuji di `bundle-service.ts` | ✅ Lulus |
| **Proteksi RESTRICT FK** | Soal terpakai di paket ditolak saat dihapus | Disinkronkan dengan `deleteQuestion()` | ✅ Lulus |
| **Validasi & Duplikasi** | Duplikasi paket & Peringatan Soal Tanpa Kunci | `duplicateBundle()`, `validateBundle()` | ✅ Lulus |
| **UI Builder Paket** | Penyusun Drag-and-Drop + Sheet Mobile Responsive | `src/components/bundles/bundle-builder.tsx` | ✅ Lulus |
| **DB Integration Tests** | 14 Test Suite DB Uji Nyata Paket Soal | `src/lib/services/bundle-service.db.test.ts` (Passed) | ✅ Lulus |

---

## 3. Review Komparasi vs QBank (M7 Paket Soal)

| Dimensi | QBank (Sistem Lama) | MathBank (Sistem Baru) | Keunggulan MathBank |
| :--- | :--- | :--- | :--- |
| **Visualisasi Stimulus** | Stimulus sering terulang jika memilih 2 soal dari wacana sama. | **Deduplikasi Stimulus 1× (`role = 'stimulus'`)**. | **MathBank Lebih Rapi:** Tampilan naskah bersih, hemat halaman saat dicetak. |
| **Responsivitas Builder** | Hanya bisa diakses dari layar PC Desktop. | **Responsive Sheet Drawer pada Mobile**. | **MathBank Lebih Fleksibel:** Pengguna dapat menyusun paket dari Tablet/HP. |
| **Validasi Kelayakan** | Mengizinkan paket dengan soal yang belum punya kunci. | **`validateBundle()`**. | Memberikan peringatan (*warning*) soal mana saja yang belum ber-kunci sebelum dicetak. |

---

## 4. Rekomendasi Enterprise (M7)

1. **Auto Item Numbering Format:** Tambahkan opsi penomoran otomatis (misal: `1a, 1b, 2, 3`) untuk soal-soal beranak yang berbagi stimulus yang sama.
2. **Kunci Jawaban Per Paket (Answer Key Sheet):** Sediakan endpoint/view terpisah untuk mengekspor Lembar Kunci Jawaban & Pembahasan Khusus untuk Guru/Pengawas.

---

## 📄 KESIMPULAN MILESTONE 7

**MILESTONE 7 (PAKET SOAL) TELAH DIREVIEW DAN DIVERIFIKASI LULUS 100%. INVARIAN STIMULUS 1×, PROTEKSI RESTRICT HAPUS SOAL, SERTA DRAG-AND-DROP BUILDER MATHBANK BERJALAN DENGAN SANGAT PRESISI.**
