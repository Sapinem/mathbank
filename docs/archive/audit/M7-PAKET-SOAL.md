# AUDIT MILESTONE 7 — PAKET SOAL (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Selesai 100%) — ⚠️ **DIVERIFIKASI ULANG 2026-09-30 + DIPERBAIKI: T-M7-2 (reorder parsial) & T-M7-3 (RESTRICT abadi setelah arsip); klaim stimulus (T-M7-1) dikoreksi** (lihat §Catatan Verifikasi)  
**Target:** Penyusunan Naskah & Paket Soal — Bundle Service (`bundle-service.ts`), Item Reordering (Drag-and-Drop), Deduplikasi Stimulus 1×, Restriksi Hapus Soal Terpakai (`RESTRICT`), Duplikasi Paket, dan Mobile Responsive Builder (`bundle-builder.tsx`).

---

## 1. Ringkasan Ruang Lingkup Milestone 7

Milestone 7 mengelola penyusunan naskah/paket soal (`bundles` & `bundle_items`) dari bank soal yang sudah dibuat:

1. **Service Paket Soal (`src/lib/services/bundle-service.ts`):**
   * CRUD Paket: Membuat, memperbarui metadata (judul, jenis `source`/`exam`/`exercise`, durasi, petunjuk, jenjang), dan arsip paket (`deletedAt`).
   * Manajemen Slug Unik: Pembuatan slug otomatis dengan penanganan konflik duplikasi nama paket (`-2`, `-3`, dst.).
2. **Invariansi Item Paket (`bundle_items`):**
   * **Pengurutan Drag-and-Drop (`reorderItems`):** Pengurutan item soal dalam paket diperbarui secara efisien berbasis `orderIndex`.
   * **Deduplikasi Stimulus 1×:** Baris wacana/stimulus (`role = 'stimulus'`) **paling banyak muncul 1 kali** dalam paket — ditegakkan oleh constraint `UNIQUE(bundle_id, question_id)` + konvensi `role`. *(Koreksi verifikasi 2026-09-30: TIDAK ada otomasi "memasukkan soal anak otomatis menambah stimulus induk" — pemanggil yang menyertakan `role:'stimulus'`.)*
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
| **Deduplikasi Stimulus** | Stimulus induk tampil 1× saja di naskah paket | `role='stimulus'` + `UNIQUE(bundle_id,question_id)` (bukan otomasi) | ✅ Lulus (klaim dikoreksi) |
| **Proteksi RESTRICT FK** | Soal terpakai di paket ditolak saat dihapus | `isQuestionUsedInBundles()` (hanya paket AKTIF) | ✅ Lulus (T-M7-3 diperbaiki) |
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

> ⚠️ **Kesimpulan di atas ditulis auditor awal.** Verifikasi ulang (2026-09-30) menemukan
> **2 bug nyata** (T-M7-2 reorder parsial, T-M7-3 RESTRICT abadi setelah arsip) — **keduanya
> sudah diperbaiki** — dan **1 klaim berlebihan** (T-M7-1 stimulus). Lihat §Catatan Verifikasi.

---

## 📝 CATATAN VERIFIKASI (2026-09-30)

**Verifikator:** agen pembangun (MathBank) · **Metode:** cek kode + uji HTTP lewat-route per peran.

**Status: ✅ TERVERIFIKASI + DIPERBAIKI.** Struktur & fitur inti nyata: CRUD, slug unik,
RESTRICT, duplikasi paket, validasi (14→**18** tes DB). Temuan:
- **T-M7-1 (klaim berlebihan):** "Deduplikasi Stimulus 1×" **bukan otomasi** — hanya efek
  `UNIQUE` + konvensi `role`. Dikoreksi di §1.2.
- **T-M7-2 (BUG):** `reorderItems` menerima daftar **parsial** → terbukti live
  `orderIndex` jadi **`[1,1,2,2]`** (bentrok). Diperbaiki: wajib daftar **lengkap**,
  tolak duplikat, + **transaksi**.
- **T-M7-3 (BUG):** RESTRICT **tak sadar arsip** → terbukti live, setelah paket diarsip
  hapus soal **tetap 409** (dead-end, soal mustahil dihapus). Diperbaiki: RESTRICT hanya
  paket **AKTIF**; enforcement nyata ada di `question-service` (dipakai `isQuestionUsedInBundles`).

Pelajaran → `CONSTRAINTS.md` #45–46. Detail: `docs/VERIFIKASI-AUDIT-M7.md`.
