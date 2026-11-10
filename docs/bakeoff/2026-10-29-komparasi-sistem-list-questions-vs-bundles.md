# Hasil Bake-Off: Evaluasi & Komparasi Sistem Listing Menu Questions vs Bundles di MathBank

> **Status:** Keputusan Arsitektur Resmi (Bake-Off Final)  
> **Tanggal:** 29 Oktober 2026  
> **Target Analisis:** Sistem Daftar Soal (`/questions` - `QuestionBankView`) vs Sistem Daftar Paket (`/bundles` - `BundleListView`)  
> **Koordinator:** Claude Code (Session Orchestrator)  
> **Penilai Independen:** Independent Architectural Judge Subagent  
> **Kandidat Independen:**
> - **Kandidat 1 (Baker A):** *The Deep Exploration Workbench (Model Questions)*
> - **Kandidat 2 (Baker B):** *The Executive Dashboard & High-Density Admin Grid (Model Bundles)*
> - **Kandidat 3 (Baker C):** *Unified MathBank "Omni-List" Standardized Engine (Sintesis Hybrid Pemenang)* 🏆

---

## 1. Ringkasan Eksekutif & Keputusan Akhir

Evaluasi arsitektur ini membedah dua implementasi sistem daftar (*listing systems*) utama di MathBank yang berevolusi secara terpisah untuk kebutuhan domain yang berbeda:
1. **Menu Bank Soal (`/questions`):** Menangani kurasi dan penelaahan butir soal atomik (volume besar: 11.889+ soal, relasi taksonomi M:N, pencarian vektor semantik HNSW 1024-dim, dan seleksi massal).
2. **Menu Paket Soal (`/bundles`):** Menangani agregasi dokumen naskah ujian dan bank sumber (volume menengah: 579+ paket, 11.800+ butir terhimpun, ringkasan pengayaan agregat, dan aksi cepat administratif).

### Putusan Yudisial & Koordinator
1. **Pemenang Mutlak (Fondasi Standar Masa Depan):** **Kandidat 3 (*Unified MathBank "Omni-List" Standardized Engine*)**.  
   Kandidat 3 menyintesis kekuatan ergonomi dari kedua sistem ke dalam satu standar terpadu: mengadopsi ketahanan status URL-driven, paginasi model workbench, dan seleksi massal dari **Questions**, dipadukan dengan efisiensi ringkasan agregat server-side (zero-waterfall ACT-04), pencarian debounced responsif, dan opsi tampilan tabel administratif padat dari **Bundles**.
2. **Kontribusi Unggulan dari Questions (Kandidat 1):**  
   - Kontrak URL 100% deterministik (*bookmarkable, shareable, stateless client*).
   - Filter berjenjang: *Quick Pills Filter Bar* untuk seleksi instan + *Slide-Over Sheet Drawer* untuk taksonomi multidimensi.
   - Paginasi adaptif Linear/IBM Carbon: pilihan limit (20/50/100 baris) dan lompat cepat (*jump to page*).
   - Bar aksi massal mengambang (*floating selection bar*) untuk operasi batch.
   - Algoritma `excerpt()` matematis yang aman KaTeX (mencegah pemotongan rumus di tengah delimiter).
3. **Kontribusi Unggulan dari Bundles (Kandidat 2):**  
   - Kartu metrik KPI di header yang dihitung paralel server-side dalam **1 roundtrip HTTP** (`Promise.all` ACT-04).
   - Mode tampilan tabel data padat (`<Table>`) dengan teks tabular-nums untuk pemindaian cepat.
   - Pencarian instan debounced (300 ms) yang mengeksekusi kueri tanpa mengharuskan tekan Enter.
   - Chip ringkasan pengayaan pedagogis (`BundleEnrichmentSummary`: rerata kesulitan & cakupan topik kurikulum).
   - Tombol aksi cepat per-baris/per-kartu (Cetak, Duplikat, Arsip).

---

## 2. Matriks Komparasi Menyeluruh: Questions vs Bundles

| Dimensi Evaluasi | **Menu Bank Soal (`/questions`)** | **Menu Paket Soal (`/bundles`)** | **Sintesis Terpadu (Kandidat 3 - Standar Baru)** 🏆 |
|---|---|---|---|
| **Karakteristik & Skala Data** | 11.889+ butir soal atomik; relasi kompleks (topik hierarkis, tag, event, sumber, jenjang). | 579+ paket naskah; mengagregasi 11.800+ butir; pengayaan agregat (enrichment). | Menangani skala entitas atomik (soal) maupun agregat (paket/event/koleksi) secara modular. |
| **Kontrak State & URL Routing** | **100% URL-Driven:** Semua filter, pencarian, mode tampilan, limit, dan halaman tercatat di query string URL (`readList`, `toggleValue`). | **Hybrid State:** `type` & `origin` di URL; pencarian, status, mode tampilan, dan halaman tersimpan di `useState` lokal. | **100% URL-Driven:** Seluruh parameter pencarian, filter, tab, view mode, dan paginasi sinkron penuh ke URL. |
| **Mesin Pencarian (Search Engine)** | Multi-modal: Pencarian teks biasa, similarity trigram (`pg_trgm`), dan pencarian semantik vektor HNSW (`<=>`). Dipicu via submit (Enter/tombol). | Pencarian teks judul dan casting tahun (`sqlCAST(year AS TEXT) ILIKE %q%`), otomatis ter-debounce 300 ms saat mengetik. | Pencarian teks ter-debounce 300 ms dengan sinkronisasi URL otomatis, dilengkapi toggle mode semantik vektor bila relevan. |
| **Paradigma Penyaringan (Filtering)** | Compound Filter Bar (pills filter aktif yang dapat dihapus per butir) + Slide-over Drawer untuk 8 dimensi taksonomi. | Top Stat Cards + Segmented Tabs (Semua, Ujian, Sumber) + Dropdown Select (Status, Asal). | **2-Tier Hybrid Filter:** Segmented Tabs/Pills untuk filter primer langsung di bilah atas + Slide-over Drawer untuk filter sekunder taksonomi mendalam. |
| **Mode Tampilan (Display Modes)** | 3 Mode: Compact List (`h-11`), Bento Grid, Masonry. Divalidasi `QuestionListSkeleton` anti-CLS. | 2 Mode: Bento Grid Cards (dengan chip enrichment) vs Dense Data Table (`<Table>` 10 kolom). | **Multi-Mode Fleksibel:** Mendukung Table View (standar desktop), Grid Bento Card (eksplorasi), dan Compact List/Masonry (ponsel/konten matematika). |
| **Aksi & Seleksi (Actions & Selection)** | **Seleksi Massal (Bulk):** Checkbox multi-soal dengan Floating Action Bar di bawah (Setujui, Tolak, Arsipkan, Tandai). | **Aksi Cepat per Item:** Tombol ikon di kartu/baris (Buka Naskah, Cetak PDF, Duplikat, Arsipkan). | **Dukungan Dwiarah:** Tombol aksi cepat individual pada baris/kartu + Floating Action Bar saat mode seleksi massal diaktifkan. |
| **Arsitektur Paginasi** | **Linear/IBM Carbon Workbench:** Pilihan baris (20, 50, 100), input lompat halaman, tombol First/Prev/Next/Last, jangkauan monospaced. | **Paginasi Sederhana:** Tetap 20 per halaman, tombol Sebelumnya & Berikutnya, indikator `hal. N / totalPages`. | **Workbench Standard:** Pilihan ukuran halaman (20/50/100), navigasi lompat cepat, dan navigasi keyboard ramah aksesibilitas. |
| **Performa Kueri Backend (L5)** | Single query Drizzle + Semi-join `EXISTS` untuk topik & tag (PERF-01); zero allocation array UUID di memori Node.js. | Single HTTP roundtrip dengan `Promise.all` (ACT-04): 4 kueri paralel (total, data halaman, agregat jenis, total butir). | Menggabungkan optimasi semi-join `EXISTS` untuk filter relasional dengan agregat amplop tunggal untuk statistik ringkas. |
| **Aksesibilitas & Standar WCAG** | Touch target $\ge 44$px pada floating bar dan paginasi; skeleton layout identik untuk zero layout shift (CLS). | Touch target $\ge 44$px pada seluruh tombol aksi per baris/kartu; tabel semantik HTML dengan header `th`/`td`. | 100% mematuhi batas mutu `CONSTRAINTS.md` (#6 bebas useMemo, #7 flex-col gap, #11 min-h-[44px], #28b penamaan). |

---

## 3. Evaluasi Mendalam Tiga Pendekatan Arsitektur

### Kandidat 1 (Baker A): Pure Workbench & Multi-Facet Exploration Engine (Model Questions)
- **Konsep:** Mengekspansi seluruh antarmuka daftar di MathBank agar seragam mengikuti model `/questions`.
- **Karakteristik Mekanis:**
  - 100% parameter tersimpan di URL. Tautan dapat dibagikan ke pengguna lain dan selalu mereproduksi hasil filter yang persis sama.
  - Menggunakan Slide-over Drawer untuk memuat puluhan opsi filter tanpa memadati halaman utama.
  - Seleksi massal bawaan dengan bar aksi mengambang di bawah layar.
  - KaTeX excerpting yang aman dari kerusakan rendering matematika.
- **Kelebihan:** Sangat kuat untuk repositori data berukuran masif dengan kebutuhan klasifikasi mendalam. Pengguna memiliki kontrol penuh terhadap ukuran halaman (20/50/100) dan navigasi lompat cepat.
- **Kelemahan:**
  - Terlalu berat (*overkill*) untuk menu administratif dengan filter sedikit seperti Bundles.
  - Membutuhkan 2 kali klik hanya untuk menyaring jenis/status (buka drawer $\to$ pilih $\to$ tutup).
  - Tidak menyajikan kartu metrik ringkasan di bagian atas.
  - Pencarian teks mengharuskan tekan tombol submit / Enter (tidak otomatis saat mengetik).

---

### Kandidat 2 (Baker B): Executive Dashboard & High-Density Admin Grid (Model Bundles)
- **Konsep:** Mengekspansi seluruh antarmuka daftar di MathBank agar seragam mengikuti model `/bundles`.
- **Karakteristik Mekanis:**
  - Menampilkan 4 kartu ringkasan KPI di bagian paling atas (Total Paket, Naskah Ujian, Bank Sumber, Butir Terhimpun) yang dihitung langsung oleh server.
  - Tab tersegmentasi horizontal di bilah atas untuk beralih instan antar sub-kategori utama (1 klik).
  - Pencarian judul ter-debounce 300 ms yang memperbarui daftar secara langsung saat pengguna mengetik.
  - Tampilan tabel data padat (`<Table>`) dengan kolom beranotasi chip pengayaan (`BundleEnrichmentSummary`).
  - Tombol aksi cepat individual (Cetak, Duplikat, Arsip) pada setiap baris.
- **Kelebihan:** Efisiensi pemindaian visual (*scannability*) sangat tinggi. Sangat intuitif untuk pengelola konten/admin yang ingin melihat ringkasan status dalam sekejap tanpa repot membuka drawer.
- **Kelemahan:**
  - **Kehilangan State saat Refresh:** Pencarian dan nomor halaman disimpan di state React lokal (`useState`), sehingga jika halaman di-refresh atau link disalin ke tab baru, status pencarian hilang dan kembali ke halaman 1.
  - **Paginasi Terkunci:** Ukuran halaman terkunci pada 20 item, tanpa opsi memilih 50 atau 100 item, dan tidak ada lompat cepat ke halaman tertentu.
  - **Ketiadaan Aksi Massal:** Tidak ada mekanisme untuk mencentang 10 paket sekaligus untuk diarsipkan atau disetujui bersamaan.

---

### Kandidat 3 (Baker C): Unified MathBank "Omni-List" Standardized Engine (Sintesis Pemenang) 🏆
- **Konsep:** Menggabungkan keunggulan terbaik dari Questions dan Bundles menjadi satu arsitektur standar (*design system*) komponen daftar di MathBank.
- **Struktur Tiga Lapisan Arsitektur Omni-List:**
  1. **Top Tier (Header & KPI Summary):** Mengadopsi pola Bundles berupa ringkasan metrik berbasis server (ACT-04) yang dihitung secara paralel tanpa roundtrip tambahan. Menampilkan konteks global instan bagi guru/admin.
  2. **Middle Tier (Hybrid 2-Level Filter & Live Search):**
     - *Level 1 (Quick Segment Tabs):* Tab horizontal untuk penyaringan tingkat tinggi paling sering dipakai (misal jenis paket atau status persetujuan soal).
     - *Level 2 (Compound Bar + Slide-over Drawer):* Input pencarian debounced 300 ms (otomatis sync ke URL) dipadukan dengan tombol laci filter untuk kriteria sekunder yang banyak (taksonomi topik, tag, grade, dll.).
     - Seluruh filter diserialisasi ke URL query params (`URLSearchParams`).
  3. **Bottom Tier (Responsive Content & Workbench Pagination):**
     - Opsi toggle multi-mode: Tabel Rinci (`<Table>` untuk desktop padat data) $\leftrightarrow$ Bento Grid / Masonry (untuk eksplorasi konten visual & rumus matematika).
     - Tombol aksi cepat per baris tetap ada, namun saat checkbox baris dicentang, Floating Action Bar otomatis muncul untuk aksi massal.
     - Paginasi menggunakan model IBM Carbon / Linear Workbench (pilihan limit 20/50/100, jangkauan data monospaced, dan lompat cepat).

---

## 4. Penilaian & Verifikasi Arsitektural

### 4.1 Penilaian Independen (*Architectural Judge Assessment*)
- **Skor Kandidat 1 (Questions Model):** 8.10 / 10
  *Catatan Juri:* Sangat matang dalam integritas URL dan manajemen seleksi massal, tetapi kurang ramah ringkasan eksekutif dan pencarian non-debounced terasa kaku.
- **Skor Kandidat 2 (Bundles Model):** 7.95 / 10
  *Catatan Juri:* Ergonomi visual kartu KPI dan tabel data sangat rapi, tetapi kelemahan state non-URL pada pencarian dan paginasi melanggar prinsip stateless client Next.js.
- **Skor Kandidat 3 (Sintesis Omni-List):** **9.45 / 10 (Pemenang Mutlak)**
  *Catatan Juri:* Memberikan solusi komprehensif tanpa kompromi. Memperbaiki kelemahan state di Bundles dengan mengadopsi URL sync dari Questions, serta menyuntikkan efisiensi KPI cards dan debounced search ke dalam Questions.

### 4.2 Verifikasi terhadap Batas Mutu Proyek (`CONSTRAINTS.md`)
1. **Aturan #6 (Dilarang useMemo/useCallback):** Seluruh derivasi filter, perhitungan jangkauan halaman, dan format label dieksekusi secara murni saat render tanpa memoization wrapper.
2. **Aturan #7 (Dilarang space-y-*):** Tata letak seluruh tier filter, tabel, dan paginasi menggunakan `flex flex-col gap-*`.
3. **Aturan #11 (Target Sentuh Minimal 44x44px):** Seluruh tombol aksi individual, chip paginasi, dan tombol floating bar memiliki `min-h-[44px] min-w-[44px]`.
4. **Aturan #22 (Validasi Boundary Zod):** Query parameter URL divalidasi oleh skema kontrak API (`listQuestionsQuerySchema` dan `listBundlesQuerySchema`).
5. **Aturan #28b (Penamaan Inggris, Teks Indonesia):** Semua identifier teknis, hook, dan properti berbahasa Inggris; seluruh teks antarmuka bagi guru berbahasa Indonesia.

---

## 5. Rekomendasi Rencana Aksi Refaktorisasi

Berdasarkan hasil perbandingan ini, langkah standardisasi sistem list MathBank direkomendasikan berjalan dalam 3 fase terarah:

1. **Fase 1: Peningkatan Menu Bundles (Mengadopsi Nilai Questions):**
   - Migrasikan `search`, `statusFilter`, dan `page` di `BundleListView` agar 100% tersimpan di URL search params (menghilangkan reset saat refresh).
   - Adopsi komponen paginasi Workbench (dukungan pilihan limit 20, 50, 100 baris dan lompat cepat).
2. **Fase 2: Peningkatan Menu Questions (Mengadopsi Nilai Bundles):**
   - Tambahkan 4 Stat Cards ringkas di bagian atas Bank Soal (Total Soal, Siap Pakai, Perlu Telaah, Terflag) yang dihitung paralel di server dalam amplop respons `GET /api/questions`.
   - Ubah input pencarian kata kunci soal agar otomatis ter-debounce 300 ms tanpa mewajibkan klik tombol cari / tekan Enter.
3. **Fase 3: Ekstraksi Komponen Dasar Bersama (*Design System Extraction*):**
   - Ekstrak komponen `ListWorkbenchPagination` yang dapat digunakan bersama oleh `questions`, `bundles`, `topics`, dan `sources`.
   - Ekstrak komponen `ListFloatingActionBar` untuk seleksi massal yang konsisten di seluruh entitas aplikasi.
