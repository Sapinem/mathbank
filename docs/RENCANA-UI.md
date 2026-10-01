# RENCANA UI — MathBank

> **Dokumen ini menjawab:** *Bagaimana antarmuka MathBank — menu, halaman, alur, keputusan desain?*
> **Status:** 📝 Draft v1 — meratifikasi keputusan L2 + menuntaskan UI menggantung.
> **Basis:** L2 (DESAIN-PER-LAPISAN) + STATUS-UI-MENGGANTUNG + arah Linear/Vercel.

---

## 1. Prinsip

| Aspek | Keputusan |
|-------|-----------|
| **Gaya** | Linear/Vercel — gelap/terang, padat, presisi, border tipis, satu aksen |
| **Tema** | Kerangka generatif (3 warna sumber → seluruh UI); status warna **universal** |
| **Font** | Roboto Flex (UI) + Roboto Mono (kode/angka) |
| **Mode** | Gelap + Terang, **default ikut OS** (`prefers-color-scheme`) |
| **Layout** | **Sidebar kiri tetap**, **collapsible** |
| **Navigasi cepat** | Command palette (⌘K) |
| **Breadcrumb** | Konsisten di semua halaman |
| **"Buat Soal" di header** | **DIHAPUS** (jarang dipakai) |

---

## 2. Struktur Sidebar (3 grup)

```
┌─────────────────────────────┐
│  [M] MathBank        (⌘B)   │  ← logo + SidebarTrigger
├─────────────────────────────┤
│  KERJA                      │
│   ◻ Dasbor                  │  /
│   ◻ Bank Soal               │  /questions
│   ◻ Telaah          (badge)  │  /review
│   ◻ Paket Soal              │  /bundles
├─────────────────────────────┤
│  REFERENSI                  │
│   ◻ Topik                   │  /references/topics
│   ◻ Sumber & Asal           │  /references/sources
│   ◻ Event                   │  /references/events
│   ◻ Label                   │  /references/labels
│   ◻ Galeri Aset             │  /assets
├─────────────────────────────┤
│  SISTEM                     │
│   ◻ Ingest & Integrasi ¹    │  /system/ingest
│   ◻ TikZ Studio ²           │  /studio/tikz
│   ◻ Pengaturan              │  /system/settings
├─────────────────────────────┤
│  (avatar) Nama · Peran      │  ← SidebarFooter: UserMenu
└─────────────────────────────┘
```

> **Implementasi (diratifikasi):** memakai komponen **`sidebar` resmi shadcn**
> (`SidebarProvider` + `Sidebar/SidebarHeader/SidebarContent/SidebarGroup/
> SidebarMenu/SidebarFooter`), bukan komponen buatan sendiri. Keuntungan bawaan:
> collapse ke ikon (`collapsible="icon"`), drawer mobile, shortcut **⌘B/Ctrl+B**,
> persistensi **cookie** (SSR-friendly), aksesibilitas. Lihat `sidebar-07` di
> registry shadcn sebagai acuan pola.

¹ **Disembunyikan sampai M9** (fase lanjut). Menu kosong membingungkan → munculkan saat siap.

² **TikZ Studio ditunda** (butuh compiler TeX; lihat `RENCANA-G4-STUDIO-MEDIA.md`). Menu
disembunyikan sampai dibangun — halaman `/studio/tikz` tetap ada, tapi tak tampil di sidebar.

**Keputusan L2 yang ditegaskan:**
- **Referensi = link terpisah** di bawah judul grup (bukan accordion) → tiap halaman bookmarkable.
- **URL berprefix** (`/references/*`, `/studio/*`, `/system/*`) → terkelompok rapi.
  **Pengecualian (revisi 2026-10-01):** Galeri Aset jadi **`/assets`**, bukan `/studio/assets`.
  Grup "Studio" dihapus karena hanya berisi satu halaman aktif — TikZ Studio ditunda, jadi
  prefix `/studio/*` cuma menyisakan satu stub dan bukan lagi pengelompokan nyata. Bila TikZ
  dibangun kelak, `/studio/*` bisa dihidupkan lagi.
- Menu **sama** untuk semua peran (bedanya aksi, bukan menu) — konfirmasi L2.
- Badge "Telaah" = jumlah soal menunggu (dynamic).

---

## 3. Halaman (Peta)

### KERJA

**3.1 Dasbor `/`** — **informatif ("ramai")**
```
┌─ Sapaan + ringkasan cepat ──────────────────────┐
│ Selamat datang.  [Cari (⌘K)]                    │
├─────────────────────────────────────────────────┤
│ ▢ Stat: Total soal · Siap · Perlu telaah        │
│ ▢ Stat: Ditandai · Paket · Sumber               │
├─────────────────────────────────────────────────┤
│ Aktivitas terbaru (soal dibuat/diubah)          │
│ Distribusi: topik teratas · kesulitan · jenjang │
│ Antrean: soal perlu telaah (tautan)             │
└─────────────────────────────────────────────────┘
```

**3.2 Bank Soal `/questions`** — inti produk
- Daftar soal: **3 mode** (list padat / grid / masonry)
- Filter sidebar: topik, sumber, event, status, jenjang, kesulitan, Bloom, label
- Pencarian: teks (fuzzy) + semantik
- Aksi: lihat detail; bulk (pilih banyak)
- Turunan: `/questions/new`, `/questions/[id]`, `/questions/[id]/edit`

**3.3 Telaah `/review`** — kurasi (bertab)
```
TELAHAH
  [Perlu Telaah] [Ditandai] [Kategorisasi] [Semua]
   ↑ status='review'  ↑ flagged     ↑ tanpa topik
```
- **Perlu Telaah** — soal berstatus `review`, menunggu persetujuan (reviewer/admin → set `ready`)
- **Ditandai** — soal `is_flagged=true` (masalah kualitas)
- **Kategorisasi** — soal tanpa topik
- **Semua** — semua soal
- Aksi: setujui (`ready`), tolak (kembali `draft`), tandai/lepas tanda, sunting

**3.4 Paket Soal `/bundles`**
- Daftar paket; buat paket (`source_id`)
- Turunan: `/bundles/new`, `/bundles/[id]` (susun), `/bundles/[id]/edit`
- Di dalam: tambah soal dari bank (dengan pencarian), urutkan, section, nomor
- Ekspor (M8): cetak/PDF

### REFERENSI

**3.5 Topik `/references/topics`** — 3-level (Kategori›Topik›SubTopik), CRUD, pindah induk (anti-siklus)
**3.6 Sumber & Asal `/references/sources`** — pola B (buku/web/sekolah); CRUD + anak (books/institutions)
**3.7 Event `/references/events`** — UTBK/OSN/SBMPTN; CRUD + subtes
**3.8 Label `/references/labels`** — tags; CRUD

### REFERENSI (lanjutan)

**3.9 Galeri Aset `/assets`** — galeri media; unggah; tri-facet (gambar/svg/tikz)

### STUDIO (ditunda)

**3.10 TikZ Studio `/studio/tikz`** — editor TikZ → SVG. **Ditunda** — halaman stub, menu
disembunyikan. Bila dibangun, grup "Studio" dihidupkan kembali di sidebar.

### SISTEM

**3.11 Ingest & Integrasi `/system/ingest`** — **disembunyikan sampai M9**
```
Ingest & Integrasi (bertab):
  [Unggah]    unggah naskah (PDF/LaTeX) → antrean
  [Antrean]   status naskah (pending/processing/gagal)
  [Integrasi] API key, webhook, dokumentasi endpoint mesin
```

**3.12 Pengaturan `/system/settings`** — bertab
```
[Umum] [AI] [Pengguna] [Sistem]
```
- **Umum**: identitas, preferensi
- **AI**: base_url, api_key (terenkripsi), model, on/off — **9router di sini** (L9)
- **Pengguna**: kelola user & peran (multi-role)
- **Sistem**: backup, info DB

### AUTH

**3.13 Login `/login`**
**3.14 Ganti Password `/ganti-password`**

---

## 4. Keputusan Menggantung — TUNTAS ✅

| # | Isu | Keputusan |
|---|-----|-----------|
| 1 | Sidebar | Kiri, tetap, **collapsible** |
| 2 | Referensi | **Link terpisah** (bukan accordion) |
| 3 | URL Referensi | `/references/topics` dst |
| 4 | Nama "Telaah" | Bukan "Antrean Review" di URL |
| 5 | Dasbor | Informatif ("ramai") |
| 6 | **Flagged** | **Tab di "Telaah"** (pendekatan A) |
| 7 | Arti flagged | **Manual (reviewer) + otomatis (dedup)** — dua-duanya |
| 8 | Ingest menu | **Disembunyikan sampai M9** |
| 9 | Ingest isi | 3 tab: Unggah/Antrean/Integrasi |
| 10 | Menu per-peran | Sama untuk semua |

---

## 4b. Responsif (Sisipan — sebelum M4c)

> **Prinsip: "Kelola di desktop, lihat di mobile."**
> Guru **menyusun & mengelola** di desktop (editor, filter, paket — kerja berat).
> Di HP: **melihat & menelaah cepat** (baca soal, setujui/tolak, cek daftar).

**Target perangkat:** Desktop utama → tablet layak → **mobile "bisa dilihat & ditelaah"** (bukan dioptimalkan penuh).

### Breakpoint

| Breakpoint | Sidebar | Konten |
|------------|---------|--------|
| `< lg` (< 1024px) | **Drawer** (tombol ☰), overlay | 1 kolom, padding `px-4` |
| `≥ lg` | Tetap (collapsible) | Multi-kolom |

Dua breakpoint saja (`lg` sebagai batas) — cukup untuk target "mobile lihat".

### Aturan per-elemen

| Elemen | Mobile (`< lg`) | Desktop (`≥ lg`) |
|--------|-----------------|-------------------|
| **Sidebar** | Drawer + overlay (shadcn `Sheet`); tutup setelah pilih | Tetap, collapsible |
| **Header** | ☰ + judul halaman; breadcrumb dipangkas; cari jadi ikon; tema tetap | Breadcrumb penuh + cari + tema |
| **Filter (Bank Soal/Telaah)** | Tombol "Filter" → Sheet | Sidebar filter tetap |
| **Tabel** | Scroll horizontal (`overflow-x-auto`) | Penuh |
| **Grid dasbor** | 2 kolom | 6 kolom |
| **Tombol aksi** | Full-width di bawah konten | Sejajar kanan |
| **Command palette** | Tetap (⌘K / tombol cari) | Tetap |

### Bukan sasaran (sadar)

- **Editor soal**: **desktop-saja**. Di mobile → tampilkan catatan "Buka di layar besar untuk mengedit."
- **Penyusun paket**: sama, desktop-saja.
- **Drag & drop**: desktop-saja.

### Alasan

Bank soal = pekerjaan **presisi** (rumus, banyak opsi, filter kompleks) yang tak nyaman di HP.
Memaksakan mobile-first = biaya besar, manfaat kecil. Jadi: **desktop untuk kerja, mobile untuk lihat.**

➡️ **Rancangan responsif lengkap: `RENCANA-UI-MOBILE.md`** (matriks adaptasi, shell, pola layout, fase R1–R7).

---

## 5. Komponen Dasar

**Prinsip: komponen RESMI shadcn lebih dulu; kustom hanya bila shadcn tak punya.**
(Registry shadcn kini 61+ komponen; pakai `sidebar`, `breadcrumb`, `avatar`, dst.)

| Komponen | Untuk |
|----------|-------|
| **`sidebar`** (resmi) | Shell: SidebarProvider/Header/Content/Group/Menu/Footer/Trigger/Rail/Inset |
| **`breadcrumb`** (resmi) | Jejak navigasi di header |
| **`avatar`** (resmi) | Foto/inisial pengguna (footer sidebar) |
| `Button` | Aksi (varian: primary/secondary/ghost/danger) |
| `Badge` | Status, label, hitungan |
| `Card` | Wadah soal/bundles |
| `Dialog` / `Sheet` | Modal & drawer |
| `DropdownMenu` | Menu (pengguna, aksi baris) |
| `Collapsible` / `ScrollArea` / `Separator` / `Skeleton` | Struktur & keadaan |
| `Input` / `Textarea` / `Select` | Form |
| `Tabs` | Telaah, Pengaturan, Ingest |
| `Table` | Daftar (list padat) |
| `CommandMenu` (⌘K) | Navigasi cepat |
| `Toast` (sonner) | Notifikasi |
| `EmptyState` / `LoadingState` / `ErrorState` | Kondisi (kustom tipis) |

> **Selalu periksa registry shadcn dulu** (via MCP `search_items_in_registries`)
> sebelum membuat komponen sendiri.

---

## 6. Tema (M3)

**Mesin tema:** 3 warna sumber → OKLCH → token `--mb-<peran>`.

| Warna sumber | Nilai | Peran |
|--------------|-------|-------|
| Primer | `#0158CA` | Aksen utama (tombol, link, aktif) |
| Sekunder | netral | Latar, border, teks |
| Aksen | `#D5AC1E` | "Perlu perhatian" (emas) |

**Aturan penting:**
- **Warna status UNIVERSAL** (sukses=hijau, error=merah, warning=kuning, info=biru) — **tidak ikut brand.**
- **"Siap" = biru brand** (bukan hijau). Emas = "perlu perhatian".
- Ganti brand = ubah 3 warna → bangun ulang token.

**Mode:** gelap + terang, default ikut OS, tanpa flash (skrip di `<head>`).

---

## 7. Alur Kerja (Wireframe Alur)

```
LOGIN → DASBOR
          │
          ├─→ BANK SOAL ──→ [cari/filter] ──→ detail ──→ edit
          │                      │
          │                      └─→ pilih → +Paket
          │
          ├─→ TELAHAH ──→ [Perlu Telaah] ──→ setujui (ready)
          │              [Ditandai]     ──→ lepas tanda / sunting
          │
          ├─→ PAKET ──→ susun ──→ EKSPOR (cetak/PDF)  ← ALUR TUNTAS
          │
          └─→ REFERENSI / STUDIO / SISTEM
```

---

## 8. Fase Pengerjaan (M3+)

| Fase | Isi | Milestone |
|------|-----|-----------|
| **A** | Mesin tema (3 warna → OKLCH, WCAG) | M3 |
| **B** | Komponen dasar | M3 |
| **C** | Shell (sidebar, header, ⌘K) | M3 |
| **D** | Halaman (dasbor, bank soal, telaah, ...) | M4–M8 |

---

## 9. Rujukan

- Desain lapisan: `DESAIN-PER-LAPISAN-MATHBANK.md` (L2, L3)
- Status lama: `STATUS-UI-MENGGANTUNG.md`
- Tema: `DESIGN-THEME-FRAMEWORK.md`, `THEME-FRAMEWORK-GUIDE.md`
- Stack UI: `TUMPUKAN-TEKNOLOGI.md` (M3)

---

*Dokumen ini menuntaskan UI yang menggantung. Bila keputusan berubah, koreksi di sini dulu.*
