# QUESTION-BANK-REDESIGN.md — Arsitektur & Catatan Perombakan Bank Soal (`/questions`)

> **Status:** ✅ Selesai & Terverifikasi (2026-10-01)  
> **Ruang Lingkup:** Rute `/questions`, komponen `QuestionBankView`, `QuestionFilterBar`, `QuestionFilterDrawer`, dan `QuestionCard`.  
> **Dokumen Terkait:** [`docs/DESIGN-QUESTION-VIEW-MODES.md`](../DESIGN-QUESTION-VIEW-MODES.md), [`docs/redesign-ui/APP-SHELL-EVALUATION.md`](APP-SHELL-EVALUATION.md), [`docs/CONSTRAINTS.md`](../CONSTRAINTS.md).

---

## 1. Latar Belakang & Masalah Desain Sebelumnya

Sebelum perombakan di branch `redesign-ui`, halaman Bank Soal (`/questions`) mengalami masalah arsitektur antarmuka:
1. **Double Sidebar Statis:**
   - Halaman memuat dua sidebar vertikal sekaligus: `AppSidebar` utama di kiri (~220px) dan filter vertikal permanen di dalam kanvas (`aside w-64` / 256px).
   - Pada resolusi laptop 1366–1440px, ruang horizontal kanvas soal terpotong hampir 500px, menyebabkan kartu soal terhimpit sempit dan rumus matematika KaTeX panjang terpotong.
2. **Ketiadaan Mode Tampilan Adaptif:**
   - Komponen `QuestionCard` hanya berformat baris list (`border-b border-border`). Saat mode diubah ke `grid` atau `masonry`, butir soal tampil mengambang canggung tanpa bingkai kartu mandiri (*self-contained card*).
3. **Kepadatan Teks Verbal di Bagian Header:**
   - Header butir soal memuat label verbal panjang bertumpuk (*"Kelas 11 SMA"*, *"C4 · Penalaran"*, *"●●●○○ Lv.3"*) yang memakan ruang vertikal berharga dan mengaburkan esensi naskah soal.

---

## 2. Arsitektur Solusi Baru

### 2.1 Compound Horizontal Filter Bar (`QuestionFilterBar`)
Berkas: [`src/components/questions/question-filter-bar.tsx`](../../src/components/questions/question-filter-bar.tsx)
- Menghilangkan `aside w-64` permanen sehingga kanvas kartu soal mendapatkan **100% lebar penuh**.
- Menyediakan toolbar terpadu di atas daftar soal yang memuat:
  - Tombol trigger filter on-demand (`aria-label="Buka filter"`) dengan badge jumlah filter aktif.
  - Form pencarian instan soal (`placeholder="Cari soal…"`, `aria-label="Cari soal"`).
  - Chip tags aktif interaktif yang dapat di-dismiss (`×`) satu per satu.
  - Tombol `Reset ({activeCount})` yang muncul dinamis saat ada filter aktif.
  - `ViewModeToggle` untuk beralih instan antar mode `list`, `grid`, dan `masonry`.
  - Tombol aksi primer `+ Buat Soal`.

### 2.2 Slide-Over Filter Drawer On-Demand (`QuestionFilterDrawer`)
Berkas: [`src/components/questions/question-filter-drawer.tsx`](../../src/components/questions/question-filter-drawer.tsx)
- Berbasis komponen drawer/sheet non-modal yang meluncur halus dari sisi kiri (lebar 340px) hanya ketika tombol filter diklik.
- Menata kelompok filter berdasarkan frekuensi pemakaian guru:
  1. **Topik Pokok (Paling Atas & Utama):** Dilengkapi input pencarian cepat instan (`aria-label="Cari topik"`) dan daftar topik terfilter dengan indikator centang.
  2. **Jenjang Kelas:** Dikelompokkan secara rapi untuk SMA (10, 11, 12), SMP (7, 8, 9), dan toggle collapsible untuk SD (1–6).
  3. **Bloom (C1–C6) & Tingkat Kesulitan (Lv. 1–5):** Disusun berdampingan secara horizontal (*side-by-side*) hemat ruang.
  4. **Sumber Bank Soal:** Dropdown pilihan sumber/institusi.
  5. **Status Alur Soal:** Dirampingkan menjadi segmented pill 1-baris di bagian bawah (`Semua`, `Siap`, `Draf`, `Telaah`).
- Tombol aksi `Reset` dan `Terapkan` di kaki drawer.

### 2.3 Adaptif 3 View Modes pada `QuestionCard`
Berkas: [`src/components/questions/question-card.tsx`](../../src/components/questions/question-card.tsx)
- **Mode List (Linear Issue Style):** Baris kompak satu baris dengan kolom terstruktur (ID `#2401`, status dot, taxonomy chips, KaTeX excerpt, dan tipe soal).
- **Mode Grid (Symmetric Bento Card):**
  - Kartu mandiri dengan `rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs`.
  - Batang soal dengan `line-clamp-3` dan opsi jawaban tersusun dalam kisi 2-kolom ringkas.
- **Mode Masonry (Dynamic Column Flow):**
  - Layout kolom dinamis tanpa pemotongan teks (`line-clamp` nonaktif), kartu bernapas alami mengikuti panjang stimulus dan rumus matematika.
  - Tetap menerapkan `overflow-x-auto` pada pembungkus KaTeX (CONSTRAINTS #12).

---

## 3. Verifikasi Mutu & Kepatuhan Batasan

| Aspek / Batasan | Standar | Hasil Verifikasi | Status |
| :--- | :--- | :--- | :---: |
| **Penamaan Bahasa Inggris** | CONSTRAINTS #28b | `pnpm lint:names` exit 0 | ✅ Lulus |
| **Type Safety** | TypeScript `strict: true` | `pnpm typecheck` exit 0 (0 error) | ✅ Lulus |
| **Lint & A11y** | ESLint + React Compiler | `pnpm lint` exit 0 (0 error, 0 warning) | ✅ Lulus |
| **React Compiler Rule** | CONSTRAINTS #6 | Tanpa manual `useMemo` / `useCallback` | ✅ Lulus |
| **Styling Conventions** | CONSTRAINTS #7 & #8 | Tanpa `space-y-*`, tanpa manual `z-index` | ✅ Lulus |
| **KaTeX Math Overflow** | CONSTRAINTS #12 | MathContent dibungkus `overflow-x-auto` | ✅ Lulus |
| **Unit & Integration Tests** | Vitest (63 test files) | 623/623 tests lulus 100% | ✅ Lulus |
| **Test Coverage** | CONSTRAINTS #44 | Stmts 91.62%, Branch 82.88%, Funcs 90.65%, Lines 93.44% | ✅ Lulus |
| **Production Build** | Next.js 16 (Turbopack) | `pnpm build` exit 0 (46/46 pages generated) | ✅ Lulus |
