# RENCANA UI — Responsif (Adaptasi Layar)

> **Dokumen ini menjawab:** *Bagaimana MathBank beradaptasi dari layar besar ke kecil?*
> **Status:** 📝 Rancangan v1 — dasar implementasi.
> **Basis:** `RENCANA-UI.md` §4b + arah Linear/Vercel.
> **Prinsip induk:** **"Kelola di desktop, lihat di mobile."**

---

## 0. Ringkasan Satu Halaman

| Ukuran | Layout | Sidebar | Kerja utama |
|--------|--------|---------|-------------|
| **Desktop** `≥1024` | Penuh, multi-kolom | Tetap (collapsible) | **Semua** (editor, paket, kelola) |
| **Tablet** `640–1023` | 1–2 kolom | Drawer | **Sebagian besar** (lihat + telaah) |
| **Mobile** `<640` | 1 kolom | Drawer | **Lihat + telaah** (editor ditunda) |

**Satu batas kunci:** `lg` (1024px) — di bawahnya sidebar jadi drawer.
**Dua penyesuaian wajib:** touch target ≥44px, jangan andalkan `hover:`.

---

## 1. Matriks Adaptasi (elemen × ukuran)

Ini **inti** rancangan — tiap elemen, di tiap ukuran:

| Elemen | Desktop `≥1024` | Tablet `640–1023` | Mobile `<640` |
|--------|-----------------|-------------------|---------------|
| **Sidebar** | Tetap, collapsible (`w-60`/`w-14`) | Drawer | Drawer |
| **Header** | Breadcrumb penuh + kotak cari "Cari… ⌘K" | ☰ + judul + ikon 🔍 | ☰ + judul + ikon 🔍 |
| **Breadcrumb** | Semua tingkat | Semua tingkat | **Hanya tingkat terakhir** |
| **Cari** | Kotak dengan teks + kbd | Kotak ringkas | **Ikon saja** |
| **Command palette** | ⌘K | ⌘K / ketuk 🔍 | Ketuk 🔍 |
| **Filter (Bank Soal/Telaah)** | Panel kiri 256px | Sheet | Sheet |
| **Kartu soal** | 3 kolom metadata sebaris | 3 kolom sebaris | **Ringkas** (maks 3 badge) |
| **Grid dasbor** | 6 kolom | 3 kolom | **2 kolom** |
| **Tabel** | Penuh | Gulir-x | Gulir-x |
| **Tabs** | Sejajar | Sejajar | **Gulir-x (chip)** |
| **Modal** | Tengah | Tengah | **Bottom sheet** |
| **Menu (⋯)** | Dropdown | Dropdown | **Bottom sheet** |
| **Tombol aksi** | Sejajar kanan | Sejajar kanan | **Full-width, sticky bawah** |
| **Paginasi** | Angka + prev/next | Prev/next | **"Muat lebih"** |
| **Toast** | Pojok kanan-bawah | Kanan-bawah | **Atas-tengah, lebar** |
| **Form input** | 2 kolom | 1–2 kolom | **1 kolom** |
| **Editor soal** | **Aktif** | Bisa (sempit) | **Pengalih desktop-saja** |
| **Padding halaman** | `px-6` | `px-4` | `px-4` |

Catatan: **Tablet ≈ desktop untuk fitur** (bisa kerja), **mobile = lihat** (editor ditunda). Perbedaan utama tablet↔desktop = sidebar (drawer vs tetap).

---

## 2. Sasaran & Bukan-Sasaran

### ✅ Sasaran (yang HARUS enak di HP)
| Alur | Kenapa |
|------|--------|
| **Lihat daftar soal** | Cek isi bank dari mana saja |
| **Baca detail soal** | Rumus, opsi, pembahasan terbaca jelas |
| **Telaah cepat** | Setujui/tolak/tandai soal saat tak di depan laptop |
| **Cek dasbor** | Ringkasan angka & antrean |
| **Cari soal** | Temukan soal cepat |
| **Lihat paket** | Cek isi paket |

### ❌ Bukan sasaran (sadar — desktop-saja)
| Alur | Alasan |
|------|--------|
| **Editor soal** | Rumus + 11 tipe + banyak opsi = presisi; di HP menyiksa |
| **Penyusun paket** | Drag/urut/section = presisi |
| **TikZ Studio** | Editor diagram = presisi |
| **Kelola referensi** | CRUD kompleks = desktop |
| **Unggah/ingest** | Berkas besar = desktop |

> Halaman bukan-sasaran tetap **bisa dibuka** & **tak rusak** — cukup tampilkan catatan ramah: *"Penyuntingan paling nyaman di layar besar."*

---

## 3. Breakpoint & Target

| Nama | Lebar | Perilaku |
|------|-------|----------|
| **Mobile** | `< 640px` (`sm`) | 1 kolom, sidebar→drawer, aksi di bawah |
| **Tablet** | `640–1023px` | 1–2 kolom, sidebar→drawer |
| **Desktop** | `≥ 1024px` (`lg`) | Layout penuh, sidebar tetap |

**Batas kunci:** `lg` = pergantian sidebar tetap ⇄ drawer.
**Touch target minimum:** 44×44px (Apple HIG) — semua tombol/link perlu cukup besar.

---

## 4. Kerangka (Shell) di Mobile

```
┌─────────────────────────────────┐
│ ☰   Bank Soal          🔍  ◐   │  ← header 56px (fixed)
├─────────────────────────────────┤
│                                 │
│  [konten halaman]               │  ← scroll vertikal
│                                 │
│                                 │
├─────────────────────────────────┤
│         (FAB bila perlu)        │  ← aksi mengambang
└─────────────────────────────────┘
```

**Header mobile:**
- **☰** kiri → buka drawer navigasi
- **Judul halaman** (breadcrumb dipangkas jadi bagian terakhir saja)
- **🔍** ikon cari (bukan kotak) → buka command palette
- **◐** toggle tema

**Drawer navigasi (Sheet dari kiri):**
```
┌──────────────────┐
│ ∑ MathBank    ✕ │
├──────────────────┤
│ KERJA            │
│  Dasbor          │
│  Bank Soal       │
│  Telaah     (3)  │
│  Paket Soal      │
│ REFERENSI        │
│  Topik …         │
│ STUDIO           │
│  …               │
│ SISTEM           │
│  Pengaturan      │
└──────────────────┘
```
- Lebar `w-64` (256px), overlay gelap di belakang
- Tutup otomatis **setelah memilih menu**
- Bisa ditutup: tombol ✕, klik overlay, tombol Esc

---

## 5. Pola Layout Mobile

### 4.1 Pola A — "Daftar" (Bank Soal, Telaah, Paket)
```
┌─────────────────────────┐
│ [Cari soal…        ]    │  ← cari selalu tampak
│ [Filter ▾] [Urut ▾]     │  ← chip filter (bukan sidebar)
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Siap · PG · SMA-11  │ │  ← kartu soal
│ │ Berapa $2+2$? …     │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Draf · Uraian …     │ │
│ └─────────────────────┘ │
│         ⋮               │  ← muat lebih (infinite/paginasi)
└─────────────────────────┘
```
- **Filter sidebar → Sheet** (tombol "Filter" membuka)
- **Kartu** penuh lebar, padding `p-3`
- **Paginasi → "Muat lebih"** atau gulir tak berujung
- Badge tetap, tapi **ringkas** (maks 3 badge; sisanya di detail)

### 4.2 Pola B — "Detail" (soal, paket)
```
┌─────────────────────────┐
│ ← Kembali       ⋯       │  ← app bar kontekstual
├─────────────────────────┤
│ Siap · PG · SMA-11      │
│ · Sedang                │
├─────────────────────────┤
│ Berapa hasil dari       │
│ $2^3 + 3^2$?            │  ← rumus di-render penuh
│                         │
│ A. 12                   │
│ B. 15                   │
│ C. 17  ✓                │  ← jawaban benar ditandai
│ D. 19                   │
├─────────────────────────┤
│ Pembahasan              │
│ …                       │
├─────────────────────────┤
│ [Setujui] [Tolak]       │  ← aksi utama (full-width)
└─────────────────────────┘
```
- **App bar kontekstual**: ← kembali + ⋯ (menu: sunting, tandai, hapus)
- Aksi utama **sticky di bawah** (selalu terjangkau)
- Menu sekunder masuk **bottom sheet** (⋯)

### 4.3 Pola C — "Dasbor"
```
┌─────────────────────────┐
│ Selamat datang          │
├────────────┬────────────┤
│ Total Soal │ Siap       │  ← 2 kolom kartu
│ 14         │ 6          │
├────────────┼────────────┤
│ Perlu Telaah│ Ditandai  │
│ 2          │ 1          │
├────────────┴────────────┤
│ Antrean Kurasi          │
│  Perlu telaah     2  →  │
│  Tanpa topik      0  →  │
├─────────────────────────┤
│ Aktivitas Terbaru       │
│  …                      │
└─────────────────────────┘
```
- Statistik: **2 kolom** (dari 6 di desktop)
- Kartu bertumpuk vertikal
- Tautan & antrean jadi daftar ketuk

### 4.4 Pola D — "Desktop-saja" (editor, paket susun, tikz)
```
┌─────────────────────────┐
│ ∑  MathBank             │
├─────────────────────────┤
│        ┌───────┐        │
│        │  🖥️   │        │
│        └───────┘        │
│                         │
│  Penyuntingan soal      │
│  paling nyaman di       │
│  layar besar.           │
│                         │
│  Buka MathBank di       │
│  komputer untuk         │
│  mengedit.              │
│                         │
│  [← Kembali]            │
└─────────────────────────┘
```
- Deteksi: `useMediaQuery('(min-width: 1024px)')`
- Bila mobile → tampilkan **pengalih ramah** (bukan error/crash)
- Tetap izinkan **lihat** (read-only) bila masuk akal

---

## 6. Tema & Sentuhan (Detail)

| Aspek | Aturan |
|-------|--------|
| **Padding halaman** | `px-4` (dari `px-6` desktop) |
| **Tinggi baris** | Sedikit lebih longgar (kenyamanan jempol) |
| **Touch target** | ≥ 44×44px |
| **Font** | Tetap Roboto Flex; ukuran tak diperkecil |
| **Rumus (KaTeX)** | Diberi `overflow-x-auto` — rumus lebar bisa digeser |
| **Tabrakan hover** | Jangan andalkan `hover:` (HP tak punya) — pakai `active:` |
| **Safe area** | Hormati notch: `env(safe-area-inset-*)` |

---

## 7. Rencana Implementasi (Fase R)

Sisipan sebelum **M4c**. Urutan:

| # | Tugas | Hasil |
|---|-------|-------|
| R1 | `MobileNav` (Sheet) + tombol ☰ di header | Navigasi HP jalan |
| R2 | Header responsif (judul ringkas, cari ikon) | Header tak meluber |
| R3 | Bank Soal: filter → Sheet, paginasi → "Muat lebih" | Daftar HP enak |
| R4 | Detail soal: app bar + aksi sticky | Baca & telaah di HP |
| R5 | Dasbor: grid 2 kolom | Ringkasan HP |
| R6 | `useMediaQuery` + pengalih "desktop-saja" | Editor aman di HP |
| R7 | Uji di lebar 375px & 768px | Verifikasi |

**Perkiraan:** 1 sesi (~2–4 jam). Tidak menyentuh arsitektur (L1–L9).

---

## 8. Kriteria Selesai

- [ ] Di 375px: sidebar jadi drawer, header rapi, tak ada gulir horizontal liar
- [ ] Bank Soal: daftar + filter + cari nyaman di 375px
- [ ] Detail soal: rumus terbaca, opsi ketuk-able, aksi terjangkau
- [ ] Halaman desktop-saja menampilkan pengalih ramah (bukan rusak)
- [ ] Di desktop (≥1024px): **tampilan tak berubah** dari sekarang
- [ ] Gerbang mutu tetap hijau

---

## 9. Catatan

- Rancangan ini **ringkas & dapat diuji** — bukan spekulasi 300 baris. Detail per-halaman menyusul saat digarap.
- Bila keputusan berubah, **koreksi di sini dulu**, baru di kode.
- Sejalan prinsip **"Tulang + Daging"**: aturan dasar (tulang) di sini; penyempurnaan (daging) saat implementasi.