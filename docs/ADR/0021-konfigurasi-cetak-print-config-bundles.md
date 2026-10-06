# ADR-0021 — Konfigurasi Cetak Naskah A4 via `bundles.print_config` (KISS) & Engine CSS Paged Media 2-Kolom

- **Status:** Diusulkan (Direncanakan untuk MathBank v2.0 Fase 1 & 2)
- **Tanggal:** 2026-10-07
- **Pengambil keputusan:** Principal Software Architect & Tim Pengembang
- **Terkait:** `docs/RENCANA-MATHBANK-V2.md` (§5),
  `docs/RENCANA-ADOPSI-ARSITEKTUR-MATHCORE-SOAL.md` (Poin 2),
  `docs/ADR/0009-bundle-pisah-koleksi-dan-latihan.md`

## Konteks

Salah satu luaran utama MathBank bagi guru di lapangan adalah pencetakan fisik naskah soal / lembar kerja siswa (*worksheet*) ke ukuran kertas standar A4. Pada MathBank v1.0, fungsi cetak menghadapi kendala teknis serius:
1. **Pemisahan Halaman Merusak Rumus Matematika:** Rumus KaTeX bertingkat (pecahan, matriks, integral) dan opsi jawaban Pilihan Ganda (A–E) sering terpotong di tengah-tengah batas halaman (*page break tear-off*).
2. **Tabrakan Nomor Soal Dua Digit:** Tidak adanya margin/gutter tetap membuat nomor soal dua digit (`10.` s.d. `99.`) menabrak teks stimulus atau batang soal.
3. **Format Layout Tidak Efisien:** Tampilan 1-kolom memboroskan kertas, sedangkan format 2-kolom koran standar sering tidak seimbang.
4. **Kebutuhan Pengaturan Cetak yang Fleksibel:** Setiap naskah ujian memerlukan kop nama institusi (*institutionName*), petunjuk pengerjaan (*instructions*), alokasi waktu, serta opsi menyertakan atau menyembunyikan kunci jawaban/pembahasan.

Dipertimbangkan apakah MathBank perlu membuat tabel relasional terpisah (misalnya `worksheet_settings` atau `print_templates`) untuk menampung konfigurasi cetak ini.

## Keputusan

1. **Prinsip KISS: Kolom `print_config JSONB` pada Tabel `bundles`:**
   - Menolak pembuatan tabel terpisah `worksheet_settings`.
   - Menambahkan kolom `print_config jsonb` pada tabel `bundles` dengan nilai *default*:
     ```typescript
     export interface BundlePrintConfig {
       institutionName?: string;
       tagline?: string;
       instructions?: string;
       durationMinutes?: number;
       twoColumnLayout?: boolean;   // default: true
       includeAnswerKey?: boolean;  // default: false
       fontSize?: "sm" | "base" | "lg"; // default: "base"
     }
     ```
   - Divalidasi secara ketat oleh skema Zod di level kontrak API (`bundlePrintConfigSchema`).
2. **Adopsi Engine CSS Paged Media 2-Kolom (Pelajaran dari `soal`):**
   - Rute cetak `/bundles/[id]/print` dilengkapi lembar gaya cetak mandiri:
     ```css
     @page {
       size: A4 portrait;
       margin: 20mm 15mm 20mm 15mm;
       @bottom-center {
         content: "Halaman " counter(page) " dari " counter(pages);
         font-size: 9pt;
       }
     }
     .print-columns {
       column-count: 2;
       column-gap: 9mm;
       column-rule: 1px solid #e2e8f0;
     }
     .print-item,
     .print-figure,
     .print-options {
       break-inside: avoid;
       page-break-inside: avoid;
     }
     .item-number-gutter {
       display: inline-block;
       width: 24px;
       font-weight: bold;
     }
     ```
   - Melindungi seluruh butir soal, diagram grafis, dan opsi A–E agar tidak terbelah antar-halaman.

## Alternatif yang Dipertimbangkan

| Alternatif | Kenapa ditolak |
|------------|----------------|
| **Tabel Terpisah `worksheet_settings` (1:1 ke `bundles`)** | Melanggar prinsip KISS (*Keep It Simple, Stupid*). Menambah overhead relasi 1:1, migrasi Drizzle ekstra, join query berlebih, dan risiko data orphaned tanpa ada kebutuhan variasi konfigurasi cetak berulang di luar siklus hidup bundle itu sendiri. |
| **Ekspor PDF via Headless Chrome / Puppeteer di Server Backend** | Sangat boros sumber daya komputasi server (CPU/RAM), lambat, dan rawan kehabisan memori (*OOM*) ketika puluhan guru mencetak bersamaan. CSS Paged Media native di browser klien menghasilkan vektor teks dan matematika tertajam dengan beban server 0%. |
| **Format Cetak 1-Kolom Sederhana Tanpa Paged Media CSS** | Menghabiskan 2× lebih banyak lembar kertas A4, layout terasa amatir, dan rumus KaTeX panjang kerap terpotong di tepi bawah kertas. |

## Konsekuensi

**Positif:**
- **Zero Table Overhead:** Skema database tetap ramping tanpa tabel tambahan; konfigurasi cetak tersimpan atomik bersama bundel terkait.
- **Kualitas Cetak Standar Percetakan:** Butir soal tertata rapi dalam 2 kolom A4, anti-potong (*no orphaned KaTeX formulas*), nomor soal rapi berkat gutter 24px, dan ramah cetak fisik.
- **Performa Instan:** Halaman cetak dirender langsung di peramban pengguna dan siap dicetak (*Ctrl+P*) atau disimpan ke PDF dengan ketajaman font vektor penuh.

**Negatif / utang:**
- Kolom bertipe JSONB tidak memiliki *type-safety* native di level PostgreSQL schema (meski dijamin 100% oleh Zod validator dan Drizzle `$type<BundlePrintConfig>()`).
- Browser lama non-Chromium/WebKit mungkin memiliki perbedaan minor dalam rendering `@page margin box`.

## Catatan

- Diadopsi langsung dari modul *Print Shop* yang terbukti stabil pada repositori `soal` (`apps/web/styles/print.css`).
- Konfigurasi default menyembunyikan kunci jawaban (`includeAnswerKey: false`) demi integritas ujian siswa.
