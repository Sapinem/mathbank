# RANCANGAN RESPONSIF — MathBank

> **Dokumen ini menjawab:** *Bagaimana seluruh antarmuka MathBank beradaptasi lintas ukuran layar — menyeluruh, konsisten, dan dapat dipelihara?*
>
> **Status:** 📐 Rancangan Acuan v2 (enterprise) — **mengikat** implementasi UI.
> **Basis:** `RENCANA-UI.md` §4b + Linear/Vercel + `DESIGN-THEME-FRAMEWORK.md`.
> **Prinsip induk:** **"Kelola di desktop, lihat di mobile."**

---

## DAFTAR ISI

0. [Ringkasan Eksekutif](#0-ringkasan-eksekutif)
1. [Filosofi & Prinsip](#1-filosofi--prinsip)
2. [Sasaran & Bukan-Sasaran](#2-sasaran--bukan-sasaran)
3. [Sistem Breakpoint](#3-sistem-breakpoint)
4. [Sistem Grid & Ruang](#4-sistem-grid--ruang)
5. [Matriks Adaptasi Lengkap](#5-matriks-adaptasi-lengkap)
6. [Shell & Navigasi](#6-shell--navigasi)
7. [Pola Layout Per-Halaman](#7-pola-layout-per-halaman)
8. [Komponen — Kontrak Responsif](#8-komponen--kontrak-responsif)
9. [Tipografi & Ikatan Tema](#9-tipografi--ikatan-tema)
10. [Aksesibilitas](#10-aksesibilitas)
11. [Performa](#11-performa)
12. [Tabel Konten & Rumus](#12-tabel-konten--rumus)
13. [Pengujian Responsif](#13-pengujian-responsif)
14. [Rencana Implementasi (Fase R)](#14-rencana-implementasi-fase-r)
15. [Tata Kelola & Konvensi Kode](#15-tata-kelola--konvensi-kode)
16. [Kriteria Selesai](#16-kriteria-selesai)
17. [Risiko & Mitigasi](#17-risiko--mitigasi)

---

## 0. RINGKASAN EKSEKUTIF

| Ukuran | Lebar | Layout | Sidebar | Kerja utama |
|--------|-------|--------|---------|-------------|
| **Desktop** | `≥ 1024px` (`lg`) | Penuh, multi-kolom | Tetap (collapsible) | **Semua** — editor, paket, kelola |
| **Tablet** | `640–1023px` | 1–2 kolom | Drawer | **Sebagian besar** — lihat + telaah |
| **Mobile** | `< 640px` | 1 kolom | Drawer | **Lihat + telaah** — editor ditunda |

**Tiga aturan emas:**
1. **Satu batas kunci** — `lg` (1024px): di bawahnya sidebar → drawer.
2. **Touch target ≥ 44×44px** — jangan pernah lebih kecil untuk kontrol utama.
3. **Jangan andalkan `hover:`** — pakai `active:` / `focus-visible:` untuk sentuh.

**Prinsip mengikat:** desktop = **kerja presisi**; mobile = **melihat & menelaah**.
Memaksakan paritas fitur penuh di mobile = biaya besar, manfaat kecil, pengalaman buruk.

---

## 1. FILOSOFI & PRINSIP

### 1.1 Filosofi Adaptasi

Antarmuka MathBank **bukan** "desktop yang diperkecil", melainkan **satu sistem** yang menjawab: *"Apa cara terbaik menyajikan informasi ini pada ruang tersedia?"*

| Tingkat | Pertanyaan | Contoh jawaban |
|---------|------------|----------------|
| **Konten** | Apa yang esensial? | Detail soal: konten + opsi (esensial); metadata lengkap (tersier) |
| **Konteks** | Sedang apa pengguna? | Di HP menemani siswa → telaah cepat, bukan menyusun |
| **Kapasitas** | Berapa ruang? | Sidebar 256px = 68% layar HP → harus jadi drawer |

### 1.2 Sepuluh Prinsip

| # | Prinsip | Arti praktis |
|---|---------|--------------|
| 1 | **Mobile-lihat, desktop-kelola** | Prioritaskan baca/telaah di HP; kerja berat di desktop |
| 2 | **Satu sistem, bukan dua** | Satu basis kode, satu komponen — beradaptasi, bukan bercabang |
| 3 | **Progresif, bukan terputus** | Turunkan/naikkan kapasitas halus, bukan fitur hilang mendadak |
| 4 | **Sentuh dulu** | Target ≥44px; aksi utama selalu terjangkau jempol |
| 5 | **Konten adalah raja** | Ruang sempit → buang hiasan, bukan konten |
| 6 | **Kejujuran** | Fitur desktop-saja → beri tahu ramah, jangan diam-diam rusak |
| 7 | **Aksesibilitas = bawaan** | Kontras, fokus, ARIA benar di semua ukuran |
| 8 | **Konsistensi lintas halaman** | Pola sama (daftar/detail/dasbor) di tiap modul |
| 9 | **Performa itu fitur** | Tak kirim CSS/JS yang tak dipakai; muat cepat |
| 10 | **Dapat diuji** | Tiap aturan punya kriteria selesai terukur |

### 1.3 Istilah yang Dihindari

| Hindari | Ganti | Alasan |
|---------|-------|--------|
| "mobile-first" | **"mobile-lihat"** | Kita tak mengoptimalkan kerja di HP |
| "responsive saja" | **"sistem adaptasi"** | Adaptasi = hierarki konten, bukan hanya lebar |
| "sembunyikan di HP" | **"tunda / ringkas / pindah pola"** | Konten penting jangan hilang tanpa jejak |

---

## 2. SASARAN & BUKAN-SASARAN

### 2.1 Sasaran (WAJIB enak di HP)

| Alur | Kriteria enak |
|------|---------------|
| **Lihat daftar soal** | Gulir mulus, kartu jelas, filter mudah dibuka |
| **Baca detail soal** | Rumus ter-render, opsi ketuk-able, tak ada gulir horizontal liar |
| **Telaah cepat** | Setujui/tolak/tandai ≤ 2 ketukan dari daftar |
| **Cek dasbor** | Angka kunci terlihat tanpa gulir |
| **Cari soal** | ⌘K / ikon 🔍 membuka pencarian < 1 detik |
| **Lihat paket** | Isi paket terbaca |

### 2.2 Bukan-Sasaran (desktop-saja — sadar & disengaja)

| Alur | Alasan | Perlakuan di HP |
|------|--------|-----------------|
| **Editor soal** | Rumus + 11 tipe + opsi = presisi | Pengalih "buka di layar besar" (read-only bila mungkin) |
| **Penyusun paket** | Urut/section/drag = presisi | Pengalih + lihat isi saja |
| **TikZ Studio** | Editor diagram = presisi | Pengalih |
| **Kelola referensi** | CRUD tabel kompleks | Pengalih + lihat daftar saja |
| **Unggah/ingest** | Berkas besar, antrean | Pengalih + lihat status antrean |

> **Aturan:** halaman bukan-sasaran **boleh dibuka** & **tidak boleh rusak** (tidak error/berantakan). Tampilkan pengalih ramah; tetap izinkan baca bila masuk akal.

---

## 3. SISTEM BREAKPOINT

### 3.1 Tabel Breakpoint

Mengikuti default Tailwind v4 (konsisten dengan ekosistem):

| Token | Lebar min | Nama MathBank | Peran |
|-------|-----------|---------------|-------|
| *(base)* | `0` | Mobile | Tampilan dasar (tanpa prefix) |
| `sm` | `640px` | Mobile besar | Penyesuaian minor (grid 2→3) |
| `md` | `768px` | Tablet potret | Grid mulai melebar |
| `lg` | `1024px` | **Desktop (batas kunci)** | Sidebar tetap; layout penuh |
| `xl` | `1280px` | Desktop lebar | Multi-kolom maksimal |
| `2xl` | `1536px` | Desktop sangat lebar | Batas lebar konten (bukan menambah kolom) |

### 3.2 Cara Pakai (Disiplin)

> **Gunakan sesedikit mungkin breakpoint.** Target "mobile-lihat" tak butuh 6 tingkat.

| Boleh pakai | Untuk apa |
|-------------|-----------|
| **base** (tanpa prefix) | Mobile — tulis gaya mobile dulu |
| `sm:` | Grid dasbor 2→3; penyesuaian kecil |
| **`lg:`** | **Batas kunci** — desktop penuh |
| `xl:` | Jarang — hanya grid lebar |

**Aturan keras:** jangan pakai `md:` kecuali benar-benar perlu. Kalau ragu, pakai `lg`.

### 3.3 Batas Lebar Konten (`2xl+`)

Di layar sangat lebar (`≥1536px`), **jangan** tambah kolom — **batasi lebar konten** agar baris teks nyaman dibaca:
```
2xl:max-w-[1400px] 2xl:mx-auto
```
Alasan: baris teks > ~90 karakter sulit dibaca.

---

## 4. SISTEM GRID & RUANG

### 4.1 Grid Kolom

| Konteks | Mobile | `sm` | `lg` | `xl` |
|---------|--------|------|------|------|
| **Dasbor stat** | `grid-cols-2` | `grid-cols-3` | `grid-cols-6` | `grid-cols-6` |
| **Kartu konten** | `grid-cols-1` | `grid-cols-1` | `grid-cols-3` | `grid-cols-3` |
| **Form** | `grid-cols-1` | `grid-cols-1` | `grid-cols-2` | `grid-cols-2` |
| **Daftar + filter** | 1 kolom (filter = sheet) | sama | `256px + 1fr` | sama |

### 4.2 Skala Ruang (Spacing)

| Zona | Mobile | Desktop |
|------|--------|---------|
| **Padding halaman** | `px-4` | `px-6` |
| **Padding kartu** | `p-3` | `p-4` / `p-5` |
| **Jarak antar-kartu** | `gap-3` | `gap-4` / `gap-6` |
| **Header tinggi** | `h-14` (56px) | `h-14` |
| **Ruang aman bawah (HP)** | `pb-[env(safe-area-inset-bottom)]` | — |

### 4.3 Target Sentuh

| Elemen | Ukuran min | Catatan |
|--------|------------|---------|
| Tombol/ikon aksi | **44×44px** | `size-11` di mobile bila perlu |
| Baris menu (drawer) | `py-2.5` (≥44px tinggi) | Jangan `py-1` |
| Link dalam teks | — | Boleh lebih kecil (bukan kontrol utama) |
| Checkbox/radio | 20×20px + area ketuk 44px | Perluas area dengan padding |

### 4.4 Skala-z (Z-index)

| Lapis | Nilai | Dipakai |
|-------|-------|---------|
| Konten | `0` | Normal |
| Sticky header | `sticky z-10` | Header dalam alur |
| Dropdown/popover | `z-50` (radix default) | Menu, select |
| Drawer/Sheet overlay | `z-50` | Navigasi mobile |
| Toast | `z-[100]` | Notifikasi |
| Command palette | `z-50` | ⌘K |

> Pakai kelas bawaan komponen shadcn; jangan bikin skala-z baru tanpa alasan.

---

## 5. MATRIKS ADAPTASI LENGKAP

**Inti dokumen.** Setiap elemen × 3 ukuran. Kolom "Implementasi" = contoh kelas.

| Elemen | Mobile `<640` | Tablet `640–1023` | Desktop `≥1024` | Implementasi |
|--------|---------------|-------------------|-----------------|--------------|
| **Sidebar** | Drawer | Drawer | Tetap, collapsible | `hidden lg:flex` + `MobileNav` |
| **Drawer** | Sheet kiri `w-64` | Sheet | — | `lg:hidden` |
| **Header tinggi** | 56px | 56px | 56px | `h-14` |
| **Hamburger** | Tampil | Tampil | Sembunyi | `lg:hidden` |
| **Breadcrumb** | Terakhir saja | Terakhir saja | Semua tingkat | `hidden sm:inline` (tengah) |
| **Kotak cari** | Ikon 🔍 | Kotak ringkas | Kotak + `⌘K` | `hidden sm:flex` |
| **Toggle tema** | Tampil | Tampil | Tampil | selalu |
| **Filter panel** | Sheet (tombol) | Sheet | Panel `w-64` | `hidden lg:block` |
| **Kartu soal** | Ringkas (3 badge) | 3 badge | 3 badge + metadata | `flex-wrap` |
| **Grid dasbor** | 2 kolom | 3 kolom | 6 kolom | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` |
| **Tabel** | Gulir-x | Gulir-x | Penuh | `overflow-x-auto` |
| **Tabs** | Gulir-x (chip) | Sejajar | Sejajar | `overflow-x-auto` |
| **Modal** | **Bottom sheet** | Tengah | Tengah | `Dialog` + varian mobile |
| **Menu (⋯)** | Bottom sheet | Dropdown | Dropdown | `DropdownMenu` |
| **Tombol aksi** | Full-width sticky | Sejajar kanan | Sejajar kanan | `w-full lg:w-auto` |
| **Paginasi** | "Muat lebih" | prev/next | prev/next | — |
| **Toast** | Atas-tengah | Kanan-bawah | Kanan-bawah | `sonner` posisi |
| **Form field** | 1 kolom | 1 kolom | 2 kolom | `grid-cols-1 lg:grid-cols-2` |
| **Editor soal** | Pengalih | Aktif (sempit) | Aktif | `useMediaQuery` |
| **Padding halaman** | `px-4` | `px-4` | `px-6` | `px-4 lg:px-6` |
| **Lebar maks konten** | penuh | penuh | `max-w-[1400px]` | `2xl:mx-auto` |

**Aturan pembacaan:** elemen yang tak tercantum → **default desktop-saja** (pengalih) atau **sama di semua ukuran**.

---

## 6. SHELL & NAVIGASI

### 6.1 Kerangka (Shell)

```
DESKTOP (≥1024)                      MOBILE (<1024)
┌──────┬──────────────────────┐      ┌──────────────────────┐
│      │ Header (breadcrumb)  │      │ ☰  Judul    🔍  ◐    │
│ Side ├──────────────────────┤      ├──────────────────────┤
│ bar  │                      │      │                      │
│ tetap│   Konten utama       │      │   Konten (1 kolom)   │
│      │                      │      │                      │
└──────┴──────────────────────┘      └──────────────────────┘
        (drawer tersembunyi)         drawer buka via ☰
```

### 6.2 Drawer Navigasi (Mobile/Tablet)

| Aspek | Aturan |
|-------|--------|
| **Pemicu** | Tombol ☰ di kiri header |
| **Bentuk** | `Sheet side="left"` `w-64` |
| **Overlay** | Gelap; klik = tutup |
| **Tutup otomatis** | Setelah pilih menu (via `onNavigate`) |
| **Tutup manual** | Tombol ✕, overlay, `Esc` |
| **Fokus** | Radix `Sheet` menangani focus-trap + kembalikan fokus |
| **Header drawer** | Logo + nama (Brand) |
| **Isi** | Sama persis dengan sidebar desktop (`SidebarNav`) |

### 6.3 Header Responsif

| Zona | Mobile | Desktop |
|------|--------|---------|
| Kiri | ☰ + judul halaman | Breadcrumb penuh |
| Kanan | 🔍 (ikon) + tema | Cari… ⌘K + tema |

- **Judul halaman mobile** = bagian breadcrumb terakhir (mis. "Bank Soal").
- **Command palette** tetap sama; dipicu tombol/kbd.

---

## 7. POLA LAYOUT PER-HALAMAN

Kita punya **4 pola kanonik**. Setiap halaman memakai salah satunya — konsistensi lintas modul.

### 7.1 Pola A — Daftar
**Dipakai:** Bank Soal · Telaah · Paket Soal · Referensi (daftar)

```
Mobile                     Desktop
┌───────────────────┐      ┌────────┬──────────────────┐
│ [Cari…        ]   │      │ Filter │ [Cari…] [+ Buat] │
│ [Filter▾][Urut▾]  │      │ panel  ├──────────────────┤
├───────────────────┤      │ 256px  │ Kartu soal        │
│ ┌───────────────┐ │      │        │ Kartu soal        │
│ │ kartu         │ │      │        │ Kartu soal        │
│ └───────────────┘ │      │        │ [paginasi]        │
│ [Muat lebih]      │      └────────┴──────────────────┘
└───────────────────┘
```

**Kunci adaptasi:**
- Filter: panel → **Sheet** (tombol "Filter" dengan badge jumlah aktif)
- Paginasi: prev/next → **"Muat lebih"** (atau gulir tak berujung)
- Kartu: metadata **ringkas** (maks 3 badge di mobile)
- Pencarian: selalu tampak (langsung di atas daftar)

### 7.2 Pola B — Detail
**Dipakai:** detail soal · detail paket · detail sumber

```
Mobile                     Desktop
┌───────────────────┐      ┌──────────────────────────┐
│ ← Kembali    ⋯    │      │ Breadcrumb       [aksi]  │
├───────────────────┤      ├──────────┬───────────────┤
│ Badge status       │      │ Konten   │ Panel samping │
│ Konten + rumus     │      │ utama    │ (metadata,    │
│ Opsi A B C D       │      │ + opsi   │  asal, topik) │
├───────────────────┤      │          │               │
│ Pembahasan         │      │          │ [aksi]        │
├───────────────────┤      └──────────┴───────────────┘
│ [Setujui][Tolak]   │ ← sticky
└───────────────────┘
```

**Kunci adaptasi:**
- App bar kontekstual: **← kembali** + **⋯** (menu sekunder → bottom sheet)
- Aksi utama: **sticky bar bawah** (mobile) → sejajar kanan (desktop)
- Metadata sekunder: di mobile → **lipat ke bawah** ("Detail lainnya ▾")

### 7.3 Pola C — Dasbor / Ringkasan
**Dipakai:** Dasbor

```
Mobile                     Desktop
┌──────────┬────────┐      ┌──┬──┬──┬──┬──┬──┐
│ Stat 1   │ Stat 2 │      │1 │2 │3 │4 │5 │6 │
├──────────┼────────┤      └──┴──┴──┴──┴──┴──┘
│ Stat 3   │ Stat 4 │      ┌────────────┬──────┐
├──────────┴────────┤      │ Aktivitas  │Antre │
│ Antrean (daftar)  │      └────────────┴──────┘
└───────────────────┘      ┌──────┬──────┬──────┐
                           │Dist 1│Dist 2│Dist 3│
                           └──────┴──────┴──────┘
```

### 7.4 Pola D — Desktop-saja
**Dipakai:** editor soal · penyusun paket · TikZ Studio

```
┌─────────────────────────┐
│        ┌────────┐       │
│        │  🖥️    │       │
│        └────────┘       │
│  Menyunting soal paling │
│  nyaman di layar besar. │
│  Buka di komputer untuk │
│  mengedit.              │
│  [ ← Kembali ]          │
└─────────────────────────┘
```

**Kunci adaptasi:**
- Deteksi: `useMediaQuery("(min-width: 1024px)")`
- Bila mobile → **Pengalih** (bukan error). Bila punya mode lihat → tampilkan **read-only**.
- Pesan ramah + jelas (bukan dead-end).

### 7.5 Peta Halaman → Pola

| Halaman | Pola | Editor/aksi di HP |
|---------|------|-------------------|
| Dasbor | **C** | — |
| Bank Soal | **A** | "Buat Soal" → pengalih |
| Detail Soal | **B** | Sunting → pengalih; telaah aktif |
| Bank Soal Baru/Edit | **D** | Pengalih |
| Telaah | **A** | Telaah aktif di HP |
| Paket Soal | **A** | Susun → pengalih |
| Detail Paket | **B** | Susun → pengalih |
| Referensi (Topik/Sumber/Event/Label) | **A** (+**D** untuk CRUD) | Lihat; kelola → pengalih |
| Galeri Aset | **A** | Lihat; unggah → pengalih |
| TikZ Studio | **D** | Pengalih |
| Ingest | **A** | Lihat antrean; unggah → pengalih |
| Pengaturan | **A** (tabs) | Lihat; edit sensitif → desktop |
| Login | Tengah (kartu) | Aktif |

---

## 8. KOMPONEN — KONTRAK RESPONSIF

Tiap komponen punya **kontrak**: perilakunya di tiap ukuran.

### 8.1 Navigasi

| Komponen | Kontrak |
|----------|---------|
| `Sidebar` | `hidden lg:flex`; collapsed `w-14`, expanded `w-60` |
| `MobileNav` | `lg:hidden`; Sheet `w-64`; tutup via `onNavigate` |
| `Header` | ☰ `lg:hidden`; kotak cari `hidden sm:flex`; ikon cari `sm:hidden` |
| `Breadcrumb` | Segmen tengah `hidden sm:inline` |
| `CommandPalette` | Sama di semua ukuran |

### 8.2 Layout

| Komponen | Kontrak |
|----------|---------|
| `PageHeader` | Aksi `w-full lg:w-auto`; judul tetap |
| `FilterPanel` | `hidden lg:block`; versi mobile = Sheet |
| `ActionBar` (sticky) | `sticky bottom-0 lg:static`; `w-full lg:w-auto` |
| `ContentContainer` | `px-4 lg:px-6`; `2xl:max-w-[1400px] 2xl:mx-auto` |

### 8.3 Data Display

| Komponen | Kontrak |
|----------|---------|
| `QuestionCard` | `flex-wrap`; badge ringkas di mobile |
| `Table` | bungkus `overflow-x-auto`; `min-w-*` bila perlu |
| `Tabs` | `overflow-x-auto` di mobile |
| `Badge` | sama; jaga ≥44px bila jadi tombol |
| `StatCard` | grid induk mengatur kolom |

### 8.4 Overlay

| Komponen | Kontrak |
|----------|---------|
| `Dialog` (Modal) | Desktop: tengah. Mobile: **bottom sheet** (`Sheet side="bottom"`) |
| `DropdownMenu` | Desktop: dropdown. Mobile: boleh tetap (kecil) atau bottom sheet (menu panjang) |
| `Sheet` | Mobile/tablet saja (`lg:hidden` untuk nav) |
| `Tooltip` | Desktop saja (HP tak punya hover) — sembunyikan di mobile |
| `Toast` (sonner) | Posisi: `sm:bottom-right`, base `top-center` |

### 8.5 Form & Input

| Komponen | Kontrak |
|----------|---------|
| `Input`/`Textarea` | `w-full`; font ≥16px di mobile (cegah zoom iOS) |
| `Select` | Sama; opsi ≥44px tinggi |
| `Button` | Aksi utama `w-full lg:w-auto`; ikon ≥44px area |
| `Checkbox`/`Radio` | Area ketuk 44px |

> **Catatan iOS:** input dengan `font-size < 16px` memicu auto-zoom → **selalu `text-base` (16px) minimal pada input mobile**.

---

## 9. TIPOGRAFI & IKATAN TEMA

### 9.1 Tipografi

| Peran | Font | Mobile | Desktop |
|-------|------|--------|---------|
| Body/UI | **Roboto Flex** | 14px (`text-sm`) dasar | 14px |
| Judul halaman | Roboto Flex | 18px (`text-lg`) | 20px (`text-xl`) |
| Angka/kode | **Roboto Mono** | — | `tabular-nums` untuk angka |

**Aturan:** **jangan perkecil font** di mobile demi ruang — lebih baik kurangi kolom/konten. Font kecil = tak terbaca = gagal.

### 9.2 Ikatan Tema (Token)

Responsif **tidak menyentuh** mesin tema (3 warna → OKLCH). Semua token `--mb-*` berlaku sama di semua ukuran:

| Token | Peran | Responsif? |
|-------|-------|------------|
| `--mb-brand` | Aksen | Tidak berubah |
| `--mb-accent` | Emas (perhatian) | Tidak berubah |
| `--mb-success/error/warning/info` | Status **universal** | Tidak berubah |

**Warna status tetap universal** (tak ikut brand), di semua ukuran & mode.

---

## 10. AKSESIBILITAS

### 10.1 Wajib di Semua Ukuran

| Aspek | Aturan |
|-------|--------|
| **Kontras** | Teks ≥ 4.5:1; elemen UI ≥ 3:1 (WCAG AA) |
| **Fokus terlihat** | `focus-visible:ring` pada semua kontrol interaktif |
| **Navigasi keyboard** | Semua aksi via Tab/Enter/Esc |
| **ARIA** | `aria-label` untuk tombol ikon (☰, 🔍, ◐); `aria-current="page"` untuk nav aktif |
| **Semantik** | `<nav>`, `<main>`, `<header>`; heading berurutan |

### 10.2 Khusus Sentuh

| Aspek | Aturan |
|-------|--------|
| **Target** | ≥44×44px |
| **Jarak antar-target** | ≥8px agar tak salah ketuk |
| **Gesture** | Jangan andalkan `hover`; jangan pakai hover untuk info penting |
| **Swipe** | Opsional, **selalu** sediakan alternatif tombol |
| **Orientation** | Dukung potret **dan** lanskap |

### 10.3 Uji Aksesibilitas

- Lighthouse aksesibilitas ≥ 95
- Tab-through tanpa "jebakan fokus"
- Zoom 200% → tak ada konten terpotong

---

## 11. PERFORMA

### 11.1 Prinsip

| Prinsip | Praktik |
|---------|---------|
| **CSS minimal** | Tailwind purges; hindari CSS kustom besar |
| **Ikuti preferensi OS** | `prefers-reduced-motion` → kurangi animasi |
| **Lazy** | Komponen berat (editor, tikz) → `dynamic import` |
| **Gambar** | `next/image` + `sizes` responsif |
| **Font** | `next/font` (sudah); `display: swap` |

### 11.2 Animasi & Gerak

| Aturan | Detail |
|--------|--------|
| **Transisi halus** | `transition-[width]`, `duration-200` (sidebar) |
| **Hormati reduced-motion** | `@media (prefers-reduced-motion: reduce)` → matikan transisi non-esensial |
| **Jangan animasi layout besar** | Cegah jank di HP kelas bawah |

### 11.3 Anggaran (Budget)

| Metrik | Target |
|--------|--------|
| CLS (layout shift) | < 0.1 |
| Interaksi (INP) | < 200ms |
| Muat awal (3G cepat) | < 3s |

---

## 12. TABEL KONTEN & RUMUS

### 12.1 Tabel Lebar (Data Padat)

| Aturan | Detail |
|--------|--------|
| **Bungkus** | `overflow-x-auto` + `rounded-md border` |
| **Petunjuk gulir** | Gradien tepi / teks "geser →" bila terpotong |
| **Kolom prioritas** | Kolom kunci tetap terlihat; lainnya boleh tergeser |
| **Alternatif** | Data sangat lebar → **kartu bertumpuk** di mobile |

### 12.2 Rumus (KaTeX)

| Aturan | Detail |
|--------|--------|
| **Rumus sebaris** | Ikut alir teks |
| **Rumus lebar** | `overflow-x-auto` pada pembungkus — bisa digeser, tak memecah layout |
| **Rumus display** | Bisa `block` + `overflow-x-auto` |
| **Fallback** | Bila render gagal → pesan, jangan crash |

> **Penting:** rumus matematika sering lebih lebar dari layar HP. `overflow-x-auto` pada `MathContent` mencegah gulir horizontal seluruh halaman.

---

## 13. PENGUJIAN RESPONSIF

### 13.1 Matriks Uji (Lebar × Halaman)

| Lebar | Perangkat wakil | Fokus |
|-------|-----------------|-------|
| **375px** | iPhone SE/12 mini | Batas bawah (paling ketat) |
| **768px** | iPad potret | Tablet (drawer) |
| **1280px** | Laptop | Desktop penuh |

Halaman diuji: Dasbor · Bank Soal · Detail Soal · Telaah · Paket · Referensi · Pengaturan · Login.

### 13.2 Daftar Periksa per Ukuran

**375px:**
- [ ] Tak ada gulir horizontal pada `<body>`
- [ ] Sidebar tersembunyi; ☰ bekerja
- [ ] Semua tombol ≥44px & terjangkau
- [ ] Rumus lebar bisa digeser (bukan memecah)
- [ ] Aksi utama terlihat tanpa gulir jauh

**768px:**
- [ ] Drawer bekerja; grid menyesuaikan
- [ ] Tabel bisa digeser

**1280px:**
- [ ] Tampilan **identik** dengan sebelum responsif (tak ada regresi)
- [ ] Sidebar tetap, breadcrumb penuh

### 13.3 Perkakas

| Alat | Guna |
|------|------|
| DevTools device mode | Simulasi cepat |
| Playwright (opsional) | Uji otomatis lintas lebar |
| Lighthouse (mobile) | Performa + aksesibilitas |

---

## 14. RENCANA IMPLEMENTASI (FASE R)

Sisipan **sebelum M4c**. Tiap langkah = satu perubahan teruji + commit.

| # | Tugas | Hasil | Uji |
|---|-------|-------|-----|
| **R1** | `MobileNav` (Sheet) + ☰ di header | Navigasi HP jalan | ☰ buka/tutup; tutup setelah pilih |
| **R2** | Header responsif (judul ringkas, cari ikon, breadcrumb pangkas) | Header tak meluber | 375px & 768px |
| **R3** | Bank Soal: filter → Sheet, paginasi → "Muat lebih" | Daftar HP enak | Filter dari HP |
| **R4** | Detail soal: app bar + aksi sticky + metadata lipat | Baca & telaah di HP | Telaah ≤2 ketuk |
| **R5** | Dasbor: grid 2→3→6 | Ringkasan HP | 375px |
| **R6** | `useMediaQuery` + komponen `DesktopOnly` (pengalih) | Editor aman di HP | Halaman D tampil ramah |
| **R7** | Audit kontras, touch target, reduced-motion; uji 375/768/1280 | Verifikasi menyeluruh | Daftar §13.2 |

**Perkiraan:** 1–2 sesi. **Tidak menyentuh arsitektur (L1–L9) atau skema DB.**

### 14.1 Definisi "Selesai" per Langkah
Selesai bila: (a) gate hijau (`tsc`/`lint`/`test`/`build`), (b) diuji di 375px & 1280px, (c) tak ada regresi desktop.

---

## 15. TATA KELOLA & KONVENSI KODE

### 15.1 Konvensi Kelas

| Situasi | Tulis |
|---------|-------|
| Mobile dulu | gaya tanpa prefix |
| Naikkan | `sm:` `lg:` |
| Sembunyikan | `hidden lg:flex` (bukan sebaliknya) |
| Lebar | `w-full lg:w-auto` |

**Urutan kelas:** layout → spacing → tipografi → warna → responsif (prefix terakhir). Prettier plugin Tailwind mengurutkan otomatis bila dipasang.

### 15.2 Komponen Adaptif — Satu Sumber

- **Jangan** bikin dua komponen (`XDesktop`, `XMobile`) bila bisa satu.
- **Deteksi JS** (`useMediaQuery`) hanya untuk kasus yang **tak bisa** CSS (mis. pengalih desktop-saja). Selebihnya **CSS murni** (lebih cepat, tanpa flicker).
- **Hindari** merender berbeda server vs klien tak sengaja (hydration mismatch).

### 15.3 Perubahan Aturan

- **Koreksi dokumen ini dulu**, baru kode. Dokumen = sumber kebenaran.
- Keputusan baru → catat di `RIWAYAT-KEPUTUSAN.md`.
- Hindari "kelas ajaib" sekali pakai — pola berulang → jadikan komponen.

### 15.4 Definition of Done (UI)

Benar di **desktop**, **tablet**, **mobile**; gate hijau; dokumentasi diperbarui; tanpa pelanggaran React Compiler (`useMemo`/`useCallback`).

---

## 16. KRITERIA SELESAI

Fase R dinyatakan selesai bila **semua** terpenuhi:

- [ ] Di **375px**: sidebar = drawer; header rapi; **tak ada gulir horizontal liar**
- [ ] Di **375px**: Bank Soal (daftar + filter + cari) nyaman
- [ ] Di **375px**: detail soal — rumus terbaca, opsi ketuk-able, aksi terjangkau
- [ ] Halaman **desktop-saja** menampilkan pengalih ramah (bukan rusak/error)
- [ ] Di **768px**: drawer + grid menyesuaikan
- [ ] Di **1280px**: **tampilan tak berubah** dari sekarang (nol regresi)
- [ ] Semua target sentuh ≥44px; kontras WCAG AA
- [ ] `prefers-reduced-motion` dihormati
- [ ] Gerbang mutu hijau: `tsc` 0 · `lint` 0 · `test` · `build` 0
- [ ] Dokumentasi diperbarui

---

## 17. RISIKO & MITIGASI

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| **Retrofit mahal** | UI berubah tiap milestone | Kerjakan Fase R **sekarang** (fondasi shell) |
| **Regresi desktop** | Fitur yang sudah jalan rusak | Uji 1280px tiap langkah; CSS murni (bukan ganti total) |
| **Rumus memecah layout** | Gulir-x seluruh halaman | `overflow-x-auto` pada `MathContent` (§12.2) |
| **Target sentuh kecil** | Salah ketuk | Disiplin 44px (§4.3); uji perangkat nyata |
| **Hydration mismatch** | Error klien | Utamakan CSS; JS deteksi hanya bila perlu (§15.2) |
| **Over-engineering** | Waktu habis | Target "mobile-lihat", bukan paritas (§2) |
| **Zoom iOS** | Layout melompat | Input ≥16px (§8.5) |

---

## LAMPIRAN A — Cheat Sheet

```
BATAS KUNCI : lg (1024px) — di bawah = drawer
MOBILE-LIHAT: kerja presisi tetap di desktop
SENTUH      : ≥44px, hover TIDAK dipakai
GRID        : 2 → sm:3 → lg:6
PADDING     : px-4 → lg:px-6
SIDEBAR     : hidden lg:flex
CARI        : kotak sm:flex ; ikon sm:hidden
RUMUS       : overflow-x-auto (WAJIB)
MODAL       : tengah → bottom sheet di HP
AKSI        : w-full lg:w-auto
PENGALIH    : halaman D (editor/paket/tikz)
```

## LAMPIRAN B — Peta Dokumen Terkait

| Dokumen | Isi |
|---------|-----|
| `RENCANA-UI.md` | Struktur menu, halaman, keputusan UI (§4b menautkan ke sini) |
| `DESIGN-THEME-FRAMEWORK.md` | Mesin tema (3 warna → OKLCH) |
| `TUMPUKAN-TEKNOLOGI.md` | Library UI (shadcn, cmdk, sonner, dst) |
| `RIWAYAT-KEPUTUSAN.md` | Kronologi keputusan |

---

*Dokumen enterprise ini **mengikat** implementasi UI. Bila ada perubahan, koreksi di sini dulu — baru di kode. Sejalan prinsip "Tulang + Daging": aturan dasar (tulang) di sini; penyempurnaan per-halaman (daging) saat digarap.*
