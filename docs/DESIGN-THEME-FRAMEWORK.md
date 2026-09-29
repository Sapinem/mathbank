# DESIGN & THEME FRAMEWORK — QBank v1.0.0

> **Status:** 📝 DRAF KONTRAK — menunggu persetujuan sebelum implementasi.
> **Arah visual:** Linear / Vercel — gelap-padat-presisi, garis hairline, satu aksen dominan.
> **Sifat:** Rombak total. Desain lama = referensi saja, bukan kendala.
> **Font:** Roboto Flex (UI) + Roboto Mono (rumus/ID/kode).
> **Mode:** Gelap + Terang, **default mengikuti sistem OS** (`prefers-color-scheme`).

---

## 1. FILOSOFI

Framework ini bukan "tema QBank". Ini **mesin penghasil tema**:

> **Input:** 3 warna sumber (`primary`, `secondary`, `accent`) — warna, *bukan* logo.
> **Proses:** Sistem mengekstrak hue/chroma, menghitung lightness sendiri, memverifikasi kontras WCAG.
> **Output:** Skala warna lengkap + ~22 peran warna (surface, text, border, brand, status) untuk **dua mode** (gelap & terang), siap dipakai Tailwind v4.

**Ganti 3 warna sumber → seluruh UI menyesuaikan otomatis, tetap terkontrol & kontras-aman.**

Prinsip:
1. **Konsistensi #1** — satu sistem, satu aksen dominan.
2. **Calm density** — informasi 80%, dekorasi 20%. Hirarki dari tipografi & spasi, bukan warna.
3. **Constraint-based, bukan judgment** — tidak ada penilaian subjektif/LLM. Kualitas dijamin **rumus WCAG**, bukan opini.
4. **Aksen terbatas** — `accent` hanya untuk "perlu perhatian"; bukan pemain setara.
5. **Status universal** — hijau/merah/kuning/biru-info TIDAK ikut berubah saat ganti brand.

---

## 2. ARSITEKTUR TOKEN (4 lapis)

```
┌─ LAPIS 0 · SOURCE COLORS ─────────────────────────────┐
│  --src-primary:   #2563EB   (dari logo MathMyID)      │
│  --src-secondary: <pilihan>                           │
│  --src-accent:    <pilihan>                           │
│  HANYA 3 nilai ini yang diubah untuk ganti brand.     │
└────────────────────────┬──────────────────────────────┘
                         │  (script generate, build-time)
                         ▼
┌─ LAPIS 1 · GENERATED SCALE (OKLCH) ───────────────────┐
│  primary-50 … primary-950   (lightness dihitung)      │
│  secondary-50 … 950                                   │
│  accent-50 … 950                                      │
│  netral-0 … 1000  (abu-abu, dari hue sumber, chroma↓) │
└────────────────────────┬──────────────────────────────┘
                         │  (dipetakan, build-time)
                         ▼
┌─ LAPIS 2 · SEMANTIC ROLES (per mode) ─────────────────┐
│  surface-base/raised/elevated/overlay                 │
│  text-primary/secondary/muted/disabled/on-brand       │
│  border-default/subtle/strong/focus                   │
│  brand / brand-hover / brand-subtle                   │
│  status: success/error/warning/info (+ -soft, -text)  │
└────────────────────────┬──────────────────────────────┘
                         │  (dipakai langsung)
                         ▼
┌─ LAPIS 3 · KOMPONEN ──────────────────────────────────┐
│  button, input, card, badge, table-row, modal, …      │
│  (via Tailwind: bg-brand, text-brand, border-brand)   │
└───────────────────────────────────────────────────────┘

Runtime layer (di atas Lapis 1, tanpa generate ulang):
  hover/subtle/border interaktif = color-mix() dari peran Lapis 2.
```

---

## 3. ATURAN GENERATE WARNA (inti framework)

### 3.1 Input
Setiap sumber: **1 nilai warna** (hex/oklch). Contoh: `#2563EB`.

### 3.2 Ekstraksi
Dari input, sistem mengambil **identitas warna** saja:
- `H` (hue) — dipakai apa adanya (agar warna tetap "itu")
- `C` (chroma) — di-*clamp* ke rentang gamut yang aman untuk sRGB
- `L` (lightness) — **DIBUANG**, akan dihitung ulang

> Analogi: input bilang *"warnanya kuning"*, bukan *"seterang ini"*. Kecerahan diatur sistem.

### 3.3 Generate skala
Bangun 11 langkah (50,100,…,900,950) dengan **lightness terjadwal tetap**, hue tetap, chroma disesuaikan per langkah (chroma cenderung turun di ujung terang/gelap agar tidak "kotor").

```
Langkah   50   100  200  300  400  500  600  700  800  900  950
Lightness .97  .94  .88  .80  .70  .60  .52  .44  .36  .28  .20
```
*(nilai pasti ditentukan saat implementasi; tabel ini ilustrasi konsep)*

### 3.4 Jaminan kontras (WCAG — pengganti "penilai")
Setelah skala jadi, sistem **memverifikasi** pasangan warna yang akan dipakai:

| Pasangan | Ambang wajib |
|----------|--------------|
| `text-primary` di `surface-base` | ≥ 4.5:1 |
| `text-secondary` di `surface-base` | ≥ 4.5:1 |
| teks di atas `brand` (on-brand) | ≥ 4.5:1 |
| `border-default` vs `surface-base` | ≥ 3:1 |
| ikon/besar (non-teks) | ≥ 3:1 |

Kalau gagal → sistem **geser lightness langkah tersebut** sampai lolos. **Tanpa LLM, tanpa opini** — murni rumus.

### 3.5 Penyesuaian per mode
- **Mode gelap:** `surface-base` = near-black (dari netral), langkah brand yang dipakai = 400–500 (lebih cerah).
- **Mode terang:** `surface-base` = putih/off-white, langkah brand = 600–700 (lebih gelap).
- Keduanya dari **sumber yang sama**; lightness dipilih agar kontras aman di masing-masing mode.

---

## 4. PERAN WARNA (Semantic Roles)

| Grup | Peran | Sumber |
|------|-------|--------|
| **Surface** | `surface-base`, `-raised`, `-elevated`, `-overlay`, `-input` | netral |
| **Text** | `text-primary`, `-secondary`, `-muted`, `-disabled`, `-on-brand` | netral + cek kontras |
| **Border** | `border-default`, `-subtle`, `-strong`, `-focus` | netral / brand |
| **Brand** | `brand`, `brand-hover`, `brand-subtle`, `brand-muted` | **primary** |
| **Secondary** | `secondary`, `secondary-hover` (pemakaian sangat terbatas) | **secondary** |
| **Accent** | `accent`, `accent-hover`, `accent-soft` | **accent** |
| **Status** | `success`, `error`, `warning`, `info` (+ `-soft`, `-text`, `-on`) | **universal, tetap** |
| **Domain** | `difficulty-1..5`, `question-type-*` | turunan/aksen terbatas |

### Aturan pemakaian (disiplin)
- **`brand`** = navigasi aktif, CTA utama, link, focus ring. **Satu warna aksen di layar.**
- **`secondary`** = struktur/pendukung yang tenang. **Tidak boleh bersaing** dengan brand.
- **`accent`** = HANYA penanda "perlu perhatian" (mis. badge review pending, highlight). **Maksimal 1–2 tempat per layar.**
- **`status`** = makna (sukses/gagal/peringatan), bukan dekorasi.

---

## 5. DETEKSI INPUT BERMASALAH (tanpa LLM)

Rumus kontras menjamin **keterbacaan**. Untuk hal yang tak bisa dijamin rumus, sistem **memberi peringatan** (deteksi berbasis angka, bukan AI):

| Kondisi | Ambang | Aksi sistem |
|---------|--------|-------------|
| primary vs secondary terlalu mirip | Δhue < 20° **dan** Δchroma kecil | ⚠️ Peringatan: "Primary & secondary nyaris sama" |
| accent vs primary terlalu mirip | Δhue < 20° | ⚠️ Peringatan |
| Warna di luar gamut sRGB | konversi gagal | Clamp otomatis + catatan |

Sistem **tidak memperbaiki sendiri** dan **tidak menilai "jelek"** — hanya **memberi tanda**. Keputusan tetap milik manusia.

---

## 6. TIPOGRAFI

| Peran | Font | Ukuran/Berat (usulan) |
|-------|------|----------------------|
| Display/judul | Roboto Flex | 20–24px, wght 500–600 |
| Body | Roboto Flex | 14–15px, wght 400 |
| Meta/label | Roboto Flex | 12–13px, wght 400–500 |
| Mono (rumus/ID) | Roboto Mono | 12–13px |

- `font-feature-settings: "tnum"` di semua angka yang berjajar (tabel, metrik, ID).
- Hirarki dibawa oleh **ukuran & berat**, bukan warna.
- 3–4 ukuran saja, maksimal 2 berat. (ala Linear)

---

## 7. SPACING · RADIUS · MOTION

| Aspek | Nilai (usulan, gaya Linear) |
|-------|-----------------------------|
| Grid dasar | 4px |
| Radius kartu/panel | 8px (`rounded-lg`) |
| Radius modal/drawer | 12px (`rounded-xl`) |
| Radius pill/chip | 999px |
| Tinggi baris tabel | 36–40px |
| Tinggi kontrol (input/button) | 32px |
| Border | 1px hairline (default), sebagian translucent |
| Bayangan | minimal — pemisah utama = garis, bukan shadow |
| Motion | 100–200ms, `ease-out`, tanpa bounce |
| Reduced-motion | dihormati (`prefers-reduced-motion`) |

---

## 8. CAKUPAN & TIDAK DIUBAH

**Dirombak (tampilan):** semua token warna, komponen UI dasar, sidebar, header, semua halaman.

**TIDAK diubah (logika):** KaTeX rendering, API routes, service layer, FSM, auth, search, skema database, font (Roboto Flex tetap).

---

## 9. STATUS TOKEN LAMA

Token lama (tema `mathmyid`/`ocean`/`purple`, dua sistem `--color-base-*` vs `--color-bg-*`) **diabaikan** — dianggap tidak ada. Framework dibangun bersih. **(Sesuai keputusan: rombak total, lama = referensi saja.)**

---

## 10. RENCANA EKSEKUSI (setelah dokumen ini disetujui)

```
FASE A — Mesin Tema
  A1. Tulis skema input warna sumber (primary/secondary/accent)
  A2. Buat generator: source → skala OKLCH + verifikasi WCAG
  A3. Petakan ke ~22 peran warna × 2 mode (gelap/terang)
  A4. Default mode = sistem OS; mekanisme tunggal (data-mode)

FASE B — Komponen Dasar
  B1. Button, Input, Select, Checkbox, Switch
  B2. Card, Badge, Status pill, Tag
  B3. Tabel/List row, Tooltip, Popover, Dropdown, Modal
  B4. Skeleton, Empty state, Toast

FASE C — App Shell
  C1. Sidebar 5 domain (collapsible → icon-rail 64px)
  C2. Header (breadcrumb + ⌘K + theme toggle + avatar)

FASE D — Halaman (review tiap halaman)
  D1 Bank Soal · D2 Paket & Naskah · D3 Review Queue · D4 Editor
  D5 Sumber/Kategori/Tags · D6 Dasbor · D7 Assets/TikZ/Ingest/Settings

FASE E — Polish
  E1 Skeleton & empty state seragam · E2 Shortcut cheatsheet, focus ring
  E3 Audit kontras AA kedua mode (otomatis)
```

---

## 11. PALET QBank (FINAL — diputuskan bersama)

Warna sumber dari **logo MathMyID asli** (M biru + W gold):

| Input | Nilai | Asal | Peran |
|-------|-------|------|-------|
| `primary` | `#0158CA` (gradien `#0158CA`→`#096CDF`) | biru huruf "M" + lingkaran | brand: nav, CTA, link, fokus |
| `secondary` | **netral/grayscale** (dari hue primer, chroma ~0) | pilihan desain | struktur: surface, border, text |
| `accent` | `#D5AC1E` (rentang `#A37105`→`#F0CB2B`) | gold huruf "W" | "perlu perhatian": badge review, highlight |

**Alasan pemilihan (terverifikasi):**
- Biru `#0158CA` (hue 214°) vs gold `#D5AC1E` (hue 47°) → jarak **167° ≈ komplementer** → harmonis secara alami.
- `secondary` = **netral**, bukan warna ke-3. Alasan: (1) konsistensi #1 (pola Linear/Vercel = 1 warna brand + grayscale); (2) warna ke-3 dengan hue dekat primary (mis. navy) **tak bisa dibedakan**; (3) warna ke-3 tanpa peran nyata = **dekorasi** yang merusak konsistensi.
- Framework **tetap menerima 3 input** (generik untuk brand lain); untuk QBank `secondary` diisi netral.
- Opsi cyan-teal (hue ~189°) **ditolak**: peran yang tersedia (status info, progress) sudah terisi brand/status → akan bersaing.

**Catatan:** file `public/brand/mathmyid-logo.svg` di repo hanya versi biru (tanpa gold) — perlu diperbarui agar gold tampil di UI. *(menunggu keputusan)*

---

## 12. YANG MASIH PERLU DIISI (saat implementasi)

- Nilai lightness persis per langkah skala (ditentukan saat membangun generator).
- Konfirmasi ambang deteksi (Δhue 20°) bisa disetel.
