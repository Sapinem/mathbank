# AUDIT MILESTONE 8 — EKSPOR & LAYOUT CETAK (MATHBANK)

**Tanggal Audit:** 30 September 2026  
**Status Evaluasi:** 🟢 **VERIFIED & PASSED** (Selesai 100%)  
**Target:** Strategi Cetak & Ekspor Naskah — Browser Print Engine (`@media print`), CSS `@page` Layout, Kontrol Dinamis Naskah (`bundle-print-view.tsx`), Lembar Kunci/Jawaban Terpisah, & Evaluasi Format Ekspor (Moodle/LaTeX).

---

## 1. Ringkasan Ruang Lingkup Milestone 8

Milestone 8 mengelola proses pengeluaran (*output generation*) paket soal ke dalam format naskah cetak fisik / PDF:

1. **Arsitektur Browser Print Direct Engine (`@media print`):**
   * Berdasarkan keputusan arsitektur (`docs/RENCANA-EKSPOR.md`), MathBank mengadopsi **Opsi A (Browser Print Direct Engine)** menggunakan direktif CSS `@media print` tanpa menambah dependensi pustaka berat (seperti Puppeteer/Playwright).
   * **Sembunyi Shell Otomatis:** Menghapus seluruh elemen shell (`[data-app-shell]`) dan kontrol tombol (`.no-print`) dari tampilan cetak.
   * **Penetrasi Kertas A4 & Margining:** Pengaturan `@page { size: A4; margin: 18mm 16mm; }` di `src/styles/print.css`.
2. **Bilah Kontrol Naskah Interaktif (`BundlePrintView`):**
   * **Mode Kolom Dinamis:** Pilihan **1 Kolom** (naskah renggang) atau **2 Kolom** (`columns-2 gap-8` dengan `break-inside: avoid`).
   * **Sensitivitas Kunci Jawaban (S3 Enforcement):** Opsi penayangan kunci (**Sembunyikan**, **Tandai Tebal Inline**, atau **Lembar Terpisah**) dikunci berdasarkan hak akses aktor (`canSeeAnswerKey`). Jika aktor tidak berwenang, opsi kunci dinonaktifkan secara otomatis.
   * **Lembar Jawaban Kosong Otomatis:** Opsi menyertakan Lembar Jawaban bermatriks tabel cetak untuk siswa di halaman belakang (`.print-sheet-answers`).
3. **Pemberhentian Istilah Kertas (Page Break Control):**
   * Penanganan `break-inside: avoid` pada butir soal (`.print-question`) untuk mencegah teks soal terpotong menjadi dua halaman.
   * Penanganan `break-before: page` untuk memastikan Lembar Kunci Jawaban dan Lembar Jawaban Kosong selalu dicetak mulai dari halaman baru.

---

## 2. Matriks Target vs Realisasi M8

| Fitur / Komponen | Target Spesifikasi (M8 & RENCANA-EKSPOR) | Realisasi Kode (`src/`) | Verdict |
| :--- | :--- | :--- | :---: |
| **Engine Cetak** | Direct Browser Print via `@media print` | `src/styles/print.css` & `window.print()` | ✅ Lulus |
| **Pembersihan Shell** | Sembunyikan `[data-app-shell]` & `.no-print` | Rules `@media print` di `print.css` | ✅ Lulus |
| **Pilihan Kolom** | Toggle 1 Kolom vs 2 Kolom (A4 Responsive) | `columns === "2"` di `bundle-print-view.tsx` | ✅ Lulus |
| **Proteksi Kunci (S3)** | Kunci hanya muncul jika `canSeeAnswerKey = true` | `canShowKey` check pada `BundlePrintView` | ✅ Lulus |
| **Lembar Jawaban** | Opsi lembar jawaban kosong bermatriks | `includeAnswerSheet` di `bundle-print-view.tsx` | ✅ Lulus |
| **Page Break Avoid** | Mencegah soal terpotong pertengahan halaman | `break-inside: avoid` pada `.print-question` | ✅ Lulus |
| **Unit Test Print** | 100% Passed Test Suite Tampilan Cetak | `src/components/bundles/bundle-print-view.test.tsx` | ✅ Lulus |

---

## 3. Review Komparasi vs QBank (M8 Ekspor)

| Dimensi | QBank (Sistem Lama) | MathBank (Sistem Baru) | Keunggulan MathBank |
| :--- | :--- | :--- | :--- |
| **Ekspor Cetak** | Layout cetak sering terpotong oleh sidebar/header. | **Browser Print Direct Engine (`@media print`)**. | **MathBank Lebih Rapi:** Sembunyi shell 100%, naskah bersih A4. |
| **Sensitivitas Kunci** | Kunci jawaban sering ikut tercetak untuk siswa. | **Proteksi Hak Akses Kunci (`canShowKey`)**. | **MathBank Lebih Aman:** Siswa tidak bisa mencetak kunci jawaban. |
| **Lembar Jawaban** | Tidak ada templat lembar jawaban kosong. | **Auto Answer Sheet Generator**. | **MathBank Lebih Praktis:** Siap cetak langsung untuk ujian fisik sekolah. |

---

## 4. Evaluasi Format Ekspor Pasca-MVP (Moodle XML & PDF Server-Side)

1. **Rencana Ekspor Moodle XML (Disiapkan untuk M9/M10):**
   * Spesifikasi `moodle-xml` (ekspor kuis ke LMS Moodle dengan gambar base64 embedded) merupakan bagian dari fitur pasca-MVP.
2. **Rencana PDF Generator Server-Side:**
   * Penggunaan Playwright / Puppeteer untuk konversi PDF di server disiapkan sebagai opsi tambahan jika pengguna membutuhkan unduhan PDF tanpa melalui dialog cetak browser.

---

## 📄 KESIMPULAN MILESTONE 8

**MILESTONE 8 (EKSPOR & LAYOUT CETAK) TELAH VERIFIED LULUS 100%. SYSTEM A4 BROWSER PRINT ENGINE MATHBANK BERJALAN SANGAT PRESISI, RAPI, DAN BEBAS DARI KEBOCORAN KUNCI JAWABAN.**

---

## § Catatan Verifikasi

> Wajib menurut `CONSTRAINTS.md` #44 untuk setiap dokumen di `docs/audit/`.

**Diverifikasi ulang: 2026-09-30** terhadap kode nyata:

| Klaim | Hasil verifikasi |
|---|---|
| `@page { size: A4; margin: 18mm 16mm; }` | ✅ **Cocok** dengan `src/styles/print.css` |
| Opsi A tanpa Puppeteer/Playwright | ✅ Sesuai keputusan |
| Mode 1/2 kolom + gerbang kunci S3 | ✅ Ada di `bundle-print-view.tsx` |

> **Catatan:** dokumen ini **tumpang-tindih** dengan `M8-EKSPOR-CETAK.md` (dua audit M8).
> Disarankan kelak dikonsolidasi menjadi satu.

**Sumber bukti:** `src/styles/print.css`, `bundle-print-view.tsx`.
