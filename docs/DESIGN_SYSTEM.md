# DESIGN_SYSTEM.md — Sistem Desain, Aksesibilitas & Standar Tipografi Matematika

> **Status:** Kanonikal Hidup (*Living Document*)  
> **Terakhir Diperbarui:** 5 Oktober 2026 (Mandat Dewan Direksi MAT-38)  
> **Pemilik:** Ichsan (Lead Frontend & Design System Architect)  

---

## 1. Fondasi Tumpukan Antarmuka (UI Stack)

MathBank menggunakan arsitektur antarmuka modern dan aksesibel:
- **Base UI**: Headless primitive components resmi pengganti Radix UI.
- **Tailwind CSS v4**: Engine styling performa tinggi berbasis CSS native variables.
- **Lucide Icons**: Koleksi ikon SVG semantik berukuran terstandarisasi.
- **KaTeX**: Engine render matematika murni berbasis TeX.

---

## 2. Aturan Tata Letak & Larangan `space-y-*`

⚠️ **Aturan Mutlak:**
- **DILARANG KERAS** menggunakan utilitas margin runtuh seperti `space-y-*` atau `space-x-*`.
- **Gunakan Flexbox atau Grid dengan `gap-*`**:
  ```tsx
  // SALAH (Berpotensi rusak pada sub-grid dan print CSS):
  <div className="space-y-4">...</div>

  // BENAR:
  <div className="flex flex-col gap-4">...</div>
  ```

---

## 3. Standar Aksesibilitas WCAG 2.2 AA

1. **Target Sentuh Minimal 44px (Touch Targets)**:
   - Seluruh elemen interaktif (tombol, input, checkbox, tab, switch filter) wajib memiliki ukuran area klik/sentuh minimal `44px × 44px` pada seluruh viewport, khususnya mobile 360px.
   - Gunakan kelas pembantu utilitas `min-h-[44px] min-w-[44px]` atau wrapper padding adaptif.
2. **Kontras Warna**:
   - Rasio kontras teks terhadap latar belakang minimal `4.5:1` untuk teks normal dan `3:1` untuk teks tebal/besar pada mode Terang (*Light*) dan Gelap (*Dark*).
3. **Fokus Semantik**:
   - Indikator fokus terlihat jelas (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`).

---

## 4. Tipografi Matematika & Isolasi KaTeX

Formula matematika dirender murni via KaTeX tanpa dependensi eksternal yang lambat:
1. **Pencegahan Horizontal Overflow (Mobile 360px)**:
   - Setiap blok ekspresi matematika berukuran panjang wajib dibungkus dalam container berpengaman `overflow-x-auto`:
     ```tsx
     <div className="w-full overflow-x-auto py-1">
       <KaTeXBlock math={formula} />
     </div>
     ```
   - Verifikasi audit: `scrollWidth === clientWidth` pada kontainer induk halaman (tidak boleh ada horizontal scrollbar liar di body/root).
2. **Isolasi Rumus Inline (`.katex-inline`)**:
   - Rumus dalam kalimat dibatasi tinggi barisnya (*line-height*) agar tidak merusak ritme vertikal paragraf soal.

---

## 5. Standar Tata Letak Cetak Naskah A4 (`/bundles/[id]/print`)

Halaman cetak naskah ujian harus memenuhi standar dokumen fisik akademis resmi:
1. **Ukuran Halaman & Margin**:
   ```css
   @media print {
     @page {
       size: A4 portrait;
       margin: 15mm;
     }
     body {
       background: white !important;
       color: black !important;
     }
   }
   ```
2. **Anti-Pemotongan Butir Soal (Page Break Hygiene)**:
   - Setiap kartu/pembungkus butir soal wajib memiliki aturan:
     ```css
     break-inside: avoid;
     page-break-inside: avoid;
     ```
   - Soal tidak boleh terbelah dua di antara bagian bawah halaman dan bagian atas halaman berikutnya.
3. **Pemisahan Kunci Jawaban & Pembahasan**:
   - Bagian kunci dan pembahasan harus dicetak di lembar terpisah menggunakan `page-break-before: always;`.
