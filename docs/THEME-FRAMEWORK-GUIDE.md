# Theme Framework — Panduan Teknis

> Dokumen ini menjelaskan **cara kerja** mesin tema QBank (implementasi Fase A).
> Untuk keputusan desain (mengapa begini), lihat `DESIGN-THEME-FRAMEWORK.md`.
> Terakhir diperbarui: 2026-09-29 · Branch: `redesign/ui-linear`

---

## 1. Ringkasan

QBank memakai **mesin penghasil tema**, bukan token warna statis. Alurnya:

```
scripts/theme/sources.ts    →  3 WARNA SUMBER (yang diubah untuk ganti brand)
        │
        ▼  pnpm theme:build
scripts/theme/generate.ts   →  ekstrak hue/chroma, hitung lightness,
        │                       verifikasi kontras WCAG, beri peringatan
        ▼
src/styles/tokens/generated.css  →  token lengkap (2 mode: terang & gelap)
        │
        ▼  dipakai komponen
Tailwind:  bg-brand, text-accent, border-border-strong, dst
```

**Ganti brand = ubah `sources.ts` → jalankan `pnpm theme:build`.** Selesai.

---

## 2. Berkas

| Berkas | Peran |
|--------|-------|
| `scripts/theme/sources.ts` | **INPUT** — 2–3 warna sumber. Hanya ini yang diubah untuk ganti brand. |
| `scripts/theme/color-engine.ts` | Matematika warna: konversi OKLCH, skala, kontras WCAG. |
| `scripts/theme/generate.ts` | Generator: sumber → peran → verifikasi → CSS. |
| `src/styles/tokens/generated.css` | **OUTPUT** — JANGAN edit manual. Dihasilkan otomatis. |

---

## 3. Perintah

```bash
pnpm theme:build      # generate token dari sources.ts
```

Output konsol menampilkan: peringatan input, hasil verifikasi kontras, dan path file.
Exit code `1` bila ada pasangan kontras yang GAGAL.

---

## 4. Cara ganti brand

1. Buka `scripts/theme/sources.ts`.
2. Ubah 3 nilai:

```ts
export const MATHMYID: ThemeSources = {
  primary: '#0158CA',        // ← warna utama
  secondary: '#0158CA',      // ← hanya sumber hue bila neutralSecondary
  accent: '#D5AC1E',         // ← warna "perlu perhatian"
  neutralSecondary: true,    // true = secondary jadi grayscale
};
```

3. Jalankan `pnpm theme:build`.
4. Baca output — bila ada ❌, sesuaikan sumber atau nilai langkah di `generate.ts`.

---

## 5. Aturan yang dipegang mesin

| Aturan | Penjelasan |
|--------|------------|
| **Hue & chroma dari sumber, lightness dihitung** | Input cukup "warnanya apa"; kecerahan diatur sistem agar kontras aman. |
| **Verifikasi WCAG otomatis** | Teks ≥ 4.5:1, border fungsional ≥ 3:1. Gagal → exit 1. |
| **Peringatan Δhue < 20°** | Dua warna terlalu mirip → diberi peringatan (bukan auto-fix). |
| **Border dekoratif vs fungsional** | `border-default`/`subtle` sengaja tipis (hairline Linear); `border-strong` (input/kontrol) wajib terlihat. |
| **brand-fg bergantung mode** | Terang: putih (brand gelap). Gelap: gelap (brand terang). Dipilih agar lolos AA. |
| **Non-hex diteruskan** | `rgba(...)` (mis. overlay) dilewatkan tanpa konversi. |

---

## 6. Peran yang dihasilkan

**Surface:** `surface-base`, `surface-raised`, `surface-elevated`, `surface-input`, `surface-overlay`
**Text:** `text-primary`, `text-secondary`, `text-muted`, `text-disabled`
**Border:** `border-default`, `border-subtle`, `border-strong`
**Brand:** `brand`, `brand-hover`, `brand-subtle`, `brand-fg`
**Accent:** `accent`, `accent-hover`, `accent-subtle`, `accent-fg`
**Focus:** `focus-ring`

Semua tersedia sebagai `--color-<peran>` di CSS, dan otomatis menjadi kelas Tailwind
(`bg-surface-base`, `text-text-primary`, `border-border-strong`, …) via `@theme` di `globals.css`.

---

## 7. Status integrasi

| Langkah | Status |
|---------|--------|
| Mesin warna (color-engine) | ✅ selesai & teruji |
| Generator + verifikasi WCAG | ✅ selesai (10/10 lolos AA) |
| `generated.css` | ✅ dihasilkan |
| Wiring ke `globals.css` (`@theme`) | ✅ selesai |
| Default mode = sistem OS | ✅ selesai (`ThemeContext` + skrip anti-FOUC) |
| Token lama dihapus sebagai sumber | ✅ selesai (nama lama kini *dijembatani* dari tema baru) |
| Pindah komponen ke nama peran baru | ⏳ bertahap (per komponen saat dirombak) |

---

## 8. Arsitektur wiring (Fase A selesai)

```
scripts/theme/sources.ts  →  pnpm theme:build
        ▼
src/styles/tokens/generated.css
   :root { --qbank-<peran>: <oklch terang>; --color-<peran>: var(--qbank-<peran>); }
   [data-mode="dark"], .dark { --qbank-<peran>: <oklch gelap>; ... }
        ▼
src/app/globals.css
   @import "generated.css"       ← sumber kebenaran warna
   @theme inline { --color-surface-base: var(--qbank-surface-base); ... }   ← ke Tailwind
        ▼
Komponen: bg-brand, text-text-primary, border-border-strong, var(--color-brand)
```

**Dua nama per token:**
- `--qbank-<peran>` — nilai asli (OKLCH), dihitung mesin.
- `--color-<peran>` — alias ke `--qbank-<peran>`, agar kode yang memakai
  `var(--color-*)` langsung tetap bekerja.

**Mode:**
- `theme:build` menghasilkan blok `:root` (terang) dan `[data-mode="dark"], .dark` (gelap).
- Default aplikasi = **ikut OS** (`prefers-color-scheme`), diset di
  `src/context/ThemeContext.tsx` + skrip anti-FOUC di `src/app/layout.tsx`.
- Pemilih mode (Terang/Gelap/Ikut Sistem) di `src/components/layout/ThemeSelector.tsx`.

**Status (universal, tidak ikut brand):** `status-success/error/warning/info`
senantiasa hijau/merah/kuning/biru.

---

## 9. Catatan verifikasi

Saat membangun mesin, verifikasi kontras **menemukan 4 masalah desain nyata**
yang kemudian diperbaiki (bukti mesin bekerja, bukan sekadar formalitas):

1. Border fungsional terlalu tipis (1.71) → dinaikkan ke langkah netral 500 (3.34).
2. `brand-fg` otomatis memilih hitam → diset manual putih (terang) / gelap (gelap).
3. `brand` mode terang memakai langkah 500 (biru muda) → diganti 600 (biru brand).
4. `brand-fg` dipaku putih di kedua mode → gagal 2.59 di gelap → dibedakan per mode.

**Verifikasi Fase A (lanjutan):**
- `npm run build` → ✓ Compiled + TypeScript 0 error.
- `tsc --noEmit` → 0 error.
- Aplikasi dijalankan (`next dev`) → halaman login render benar; seluruh var
  (`--qbank-brand`, `--color-surface-base`, `--color-text-primary`, dst) resolve;
  mode default mengikuti OS (terdeteksi `light` di mesin uji).
- Suite test: 6 gagal (semua **timeout** karena beban paralel — lulus saat
  dijalankan terpisah; kategori sama dengan flaky LLM/ingest yang memang ditunda).

