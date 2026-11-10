# Panduan Sistem Tema Cetak Naskah (Print Themes)

> **Status:** Resmi & Kanonikal (Publishing Engine V2)  
> **Terakhir Diperbarui:** 2026-11-05  
> **Modul Kode:** `src/lib/print/themes/`  
> **Terkait:** `docs/DESIGN_SYSTEM.md`, `docs/ADR/0021-konfigurasi-cetak-print-config-bundles.md`, `CONSTRAINTS.md` (#6, #7, #22, #28b)

---

## 1. Ikhtisar Arsitektur

MathBank menyediakan sistem tema cetak naskah soal A4 modular berbasis berkas kode di dalam repositori (`src/lib/print/themes/`). Setiap tema bertanggung jawab mendefinisikan identitas dan bingkai luar naskah cetak tanpa merusak stabilitas rumus matematika.

### Pemisahan Tanggung Jawab (Separation of Concerns)

| Komponen | Dikelola Oleh | Tanggung Jawab |
|---|---|---|
| **Bingkai & Identitas** | **Tema Aktif** (`src/lib/print/themes/*`) | Kop Halaman 1, Running Header Halaman 2+, Running Footer, Seksi Penutup Tambahan, dan Hook Kontrol Opsi Kustom. |
| **Publishing Engine Soal** | **Engine Inti MathBank** (`BundlePrintView`) | Tata letak butir soal KaTeX, diagram gambar, opsi A–E, stimulus, ruang coretan siswa, lembar jawaban, proteksi `break-inside: avoid`, dan engine 2-kolom CSS Paged Media. |

> ⚠️ **Aturan Emas:** Tema **tidak boleh** mengubah perenderan butir soal KaTeX atau CSS pemutusan halaman cetak agar rumus matematika bertingkat (integral, matriks, pecahan) tidak terpotong antar-halaman.

---

## 2. Struktur Direktori Tema

Setiap tema ditempatkan dalam subdirektori mandiri (*self-contained directory*) di dalam `src/lib/print/themes/<theme-id>/`:

```text
src/lib/print/themes/
├── types.ts                   # Kontrak antarmuka TypeScript (PrintTheme, dll.)
├── registry.ts                # Registri terpusat tema & fungsi helper fallback
├── registry.test.ts           # Pengujian registri tema
├── math-my-id/                # Tema Bawaan 1: Standar MathBank
│   ├── index.tsx              # Metadata tema & ekspor PrintTheme
│   ├── kop.tsx                # Komponen kop Math My ID (membungkus BundlePrintKop)
│   ├── assets/                # Aset grafis tema lokal (SVG/vektor)
│   └── index.test.tsx         # Pengujian render komponen tema
└── formal-exam/               # Tema Bawaan 2: Ujian Formal Sekolah/Madrasah
    ├── index.tsx              # Metadata tema & ekspor PrintTheme
    ├── kop.tsx                # Kop resmi dinas/madrasah dengan kolom nomor peserta (.print-kop .print-header)
    ├── header.tsx             # Running header formal halaman 2+ (tanpa sosmed Math My ID)
    ├── footer.tsx             # Running footer formal dinas dengan nomor halaman
    ├── options.tsx            # Hook formulir kontrol opsi kustom drawer
    ├── assets/                # Ornamen garis ganda dinas / SVG lokal
    └── index.test.tsx         # Pengujian render & interaksi opsi tema
```

---

## 3. Kontrak Antarmuka (`PrintTheme`)

Setiap tema wajib mengimplementasikan antarmuka `PrintTheme` yang didefinisikan pada `src/lib/print/themes/types.ts`:

```typescript
export interface PrintTheme {
  /** ID unik tema (kebab-case, nama direktori bahasa Inggris, misal: "formal-exam"). */
  id: string;

  /** Nama tampilan tema untuk dropdown antarmuka pengguna (bahasa Indonesia). */
  name: string;

  /** Deskripsi ringkas peruntukan tema untuk penjelasan di bawah dropdown. */
  description: string;

  /** Komponen kop resmi halaman pertama naskah. */
  Kop: ComponentType<ThemeKopProps>;

  /** Komponen running header halaman 2+ (opsional, default memakai BundlePrintHeader). */
  Header?: ComponentType<ThemeHeaderProps>;

  /** Komponen running footer (opsional, default memakai BundlePrintFooter). */
  Footer?: ComponentType<ThemeFooterProps>;

  /** Komponen seksi penutup tambahan di akhir naskah (opsional). */
  ExtraSection?: ComponentType<ThemeExtraSectionProps>;

  /** Hook perender kontrol formulir kustom di Drawer Pengaturan (opsional). */
  renderOptions?: (props: ThemeOptionsRenderProps) => ReactNode;

  /** Nilai baku opsi kustom tema. */
  defaultOptions?: Record<string, unknown>;
}
```

---

## 4. Hook Opsi Dinamis di Drawer (`renderOptions`)

Jika tema membutuhkan konfigurasi khusus dari guru (misalnya: sakelar kolom tanda tangan, pilihan tipe ujian PAS/ASAJ, atau gaya garis kop), tema dapat mengekspor fungsi `renderOptions`.

### Cara Kerja Hook Drawer

1. Pengguna memilih tema di dropdown drawer pengaturan cetak.
2. Drawer mendeteksi properti `activeTheme.renderOptions`.
3. Jika tersedia, drawer otomatis merender kontrol form tersebut di bawah seksi "Pilihan Tema Cetak" (`data-slot="theme-options-slot"`).
4. Ketika pengguna mengubah kontrol, callback `onChange(key, value)` dipanggil.
5. Nilai opsi disimpan terisolasi di dalam `bundle.printConfig.themeOptions[activeThemeId]`.

---

## 5. Aturan Desain & Mutu Pembuatan Tema

Saat membuat atau memperbarui tema, patuhi seluruh kontrak mutu MathBank berikut:

1. **Penamaan Berkas & Direktori Wajib Inggris (CONSTRAINTS #28b):**
   - Nama folder: `src/lib/print/themes/<theme-id>/` (contoh valid: `formal-exam`, `compact-worksheet`, `olympiad-sheet`). Dilarang menggunakan kata Indonesia seperti `ujian`, `soal`, `cetak`.
   - Teks antarmuka pengguna (`name`, `description`, label kontrol) **wajib bahasa Indonesia**.
2. **Target Sentuh Ramah Aksesibilitas (WCAG 2.2 AA):**
   - Seluruh tombol dan kontrol input yang dirender di drawer **wajib memiliki `min-h-[44px]` dan `min-w-[44px]`** untuk target sentuh jari.
3. **Aturan Tata Letak Anti-`space-y-*` (CONSTRAINTS #7):**
   - Dilarang keras menggunakan utility `space-y-*` atau `space-x-*`.
   - Wajib menggunakan flexbox modern: `flex flex-col gap-*` atau `flex items-center gap-*`.
4. **Keamanan Tanpa `useMemo`/`useCallback` (CONSTRAINTS #6):**
   - Hindari membungkus logika komponen tema dengan `useMemo` atau `useCallback`.
5. **Dukungan Pencetakan Fisik (*Print Color Adjust*):**
   - Komponen kop atau ornamen yang menggunakan latar warna/border wajib menyertakan:
     ```css
     print-color-adjust: exact;
     -webkit-print-color-adjust: exact;
     ```
   - Warna teks utama di naskah cetak wajib menggunakan warna hitam pekat (`text-black` atau `#111111`) demi kontras cetak printer monokrom/laser.
6. **Wajib Kelas `.print-kop` dan `.print-header` pada Elemen Kop:**
   - Elemen root kop wajib menyertakan kelas `print-kop` dan `print-header`:
     ```tsx
     <header className="formal-exam-kop print-kop print-header relative w-full bg-white text-black pb-2 mb-4 select-none">
     ```
   - Kelas `print-header` mencegah kop terhapus oleh aturan pembersih shell (`header:not(.print-header)`).
   - Kelas `print-kop` menjamin kop otomatis ditarik ke margin atas (`margin-top: -1.3cm !important`) dengan `z-index: 20` agar menutupi running header di halaman 1 dan tidak bertabrakan dengan butir soal.

---

## 6. Cara Mendaftarkan Tema Baru

1. Buat folder baru: `src/lib/print/themes/<new-theme-name>/`.
2. Buat berkas `kop.tsx`, `options.tsx` (jika ada opsi kustom), dan `index.tsx`.
3. Buat pengujian komponen: `index.test.tsx` (memverifikasi render dan perubahan opsi).
4. Daftarkan tema di `src/lib/print/themes/registry.ts`:
   ```typescript
   import { myNewTheme } from "./my-new-theme";

   // Daftarkan ke registri terpusat
   registerPrintTheme(myNewTheme);
   ```
5. Jalankan gerbang mutu untuk memvalidasi:
   ```bash
   pnpm lint:names && pnpm typecheck && pnpm test src/lib/print/themes/
   ```

Tema baru akan langsung muncul otomatis di dropdown drawer pengaturan cetak dan siap digunakan oleh guru.

---

## 7. Persistensi & Kompatibilitas Naskah Lama

- Konfigurasi tema disimpan di kolom JSONB `bundles.print_config` (`themeId` dan `themeOptions`).
- **Naskah Lama (Zero Regression):** Jika paket soal lama belum memiliki `themeId`, sistem secara otomatis mengembalikan tema default `math-my-id`, sehingga naskah lama tetap tampil 100% identik tanpa perubahan visual.
- **Isolasi Antar-Tema:** Beralih tema di drawer tidak akan menghapus opsi tema sebelumnya karena seluruh pengaturan disimpan terpisah per ID tema di dalam `themeOptions: { [themeId]: { ... } }`.
