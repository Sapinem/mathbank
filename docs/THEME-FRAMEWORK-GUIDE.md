# Theme Framework — Panduan Teknis (MathBank)

> Dokumen ini menjelaskan **cara kerja** mesin tema **MathBank**.
> Untuk keputusan desain (mengapa begini), lihat `DESIGN-THEME-FRAMEWORK.md`.
> Terakhir diperbarui: 2026-09-29 (diselaraskan dengan kode nyata).

---

## 1. Ringkasan

MathBank memakai **mesin penghasil tema**, bukan token warna statis. Ganti merek cukup ubah **warna sumber** → `pnpm theme:build`. Alurnya:

```
scripts/theme/build.ts                 →  WARNA SUMBER (yang diubah untuk ganti brand)
        │
        ▼  pnpm theme:build
src/styles/tokens/generated.css        →  token OKLCH (2 mode: terang & gelap)
        │
        ▼  @import di src/app/globals.css  →  dipetakan ke token shadcn + @theme (Tailwind)
        ▼
Komponen: bg-brand?, var(--mb-*), token shadcn (--primary, --sidebar-*, …)
```

**Ganti brand = ubah warna sumber di `scripts/theme/build.ts` → jalankan `pnpm theme:build`. Selesai.**

---

## 2. Berkas

| Berkas | Peran |
|--------|-------|
| `scripts/theme/build.ts` | **INPUT + GENERATOR** — warna sumber → token OKLCH → CSS. Satu berkas. |
| `src/styles/tokens/generated.css` | **OUTPUT** — JANGAN edit manual. Dihasilkan otomatis. |
| `src/app/globals.css` | Memetakan `--mb-*` ke token shadcn (`--primary`, `--sidebar-*`, …) + `@theme inline` untuk Tailwind. |
| `src/components/providers/theme-provider.tsx` | `next-themes` provider — mode terang/gelap/sistem. |
| `src/components/layout/theme-toggle.tsx` | Pemilih mode (Terang · Gelap · Ikut Sistem). |

---

## 3. Perintah

```bash
pnpm theme:build      # generate token dari build.ts
```

Output: `src/styles/tokens/generated.css` + ringkasan nilai di konsol.

---

## 4. Cara ganti brand

1. Buka `scripts/theme/build.ts`.
2. Ubah `SOURCES`:

```ts
const SOURCES = {
  primary: "#0158CA",   // ← aksen utama (tombol, link, aktif)
  accent:  "#D5AC1E",   // ← emas, "perlu perhatian"
};
// secondary (netral) dibangkitkan mesin untuk latar/border/teks.
```

3. Jalankan `pnpm theme:build`.
4. `pnpm build` → pastikan 0 error.

---

## 5. Aturan yang dipegang

| Aturan | Penjelasan |
|--------|------------|
| **Hue & chroma dari sumber, lightness dihitung** | Cukup "warnanya apa"; kecerahan diatur mesin agar kontras aman. |
| **Status UNIVERSAL** | `--mb-success/error/warning/info` senantiasa hijau/merah/kuning/biru — **tak** ikut brand. |
| **brand-fg bergantung mode** | Terang: putih (brand gelap). Gelap: gelap (brand terang). Dipilih agar lolos AA. |
| **Siap = biru brand** | Status "siap" memakai warna brand; emas = "perlu perhatian". |

---

## 6. Token yang dihasilkan

Dua mode (terang `:root`, gelap `.dark`):

```
:root {
  --mb-brand:        oklch(...)   /* primer */
  --mb-brand-hover:  oklch(...)
  --mb-brand-fg:     oklch(...)   /* teks di atas brand */
  --mb-accent:       oklch(...)   /* emas */
  --mb-accent-fg:    oklch(...)
  --mb-success/error/warning/info: oklch(...)  /* UNIVERSAL */
}
.dark { /* versi gelap token yang sama */ }
```

Token brand dipakai lewat `var(--mb-*)` atau dipetakan ke var shadcn di `globals.css` (mis. `--primary: var(--mb-brand)`), sehingga komponen shadcn resmi otomatis ikut tema.

---

## 7. Mode terang/gelap

- Mesin menghasilkan **dua blok**: `:root` (terang) dan `.dark` (gelap).
- **Default aplikasi = ikut OS** (`prefers-color-scheme`) via `next-themes`:
  - Provider: `src/components/providers/theme-provider.tsx`.
  - Pemilih: `src/components/layout/theme-toggle.tsx`.
  - Anti-FOUC: skrip inline di `layout.tsx`.
- Diuji e2e: `e2e/theme.spec.ts`.

---

## 8. Verifikasi

Setelah `pnpm theme:build`:

1. Cek `src/styles/tokens/generated.css` terisi.
2. `tsc --noEmit` → 0 error; `pnpm build` → 0 error.
3. `next dev` → halaman render; var `--mb-*` resolve.
4. Uji toggle Terang/Gelap/Ikut Sistem (e2e `theme.spec.ts`).

Kontras WCAG dijaga saat membangun token (mis. `brand-fg` dipilih agar kontras cukup per mode).

---

## 9. Rujukan

- Keputusan desain: `DESIGN-THEME-FRAMEWORK.md`
- Rencana UI: `RENCANA-UI.md` §Tema
- Kode: `scripts/theme/build.ts`, `src/styles/tokens/generated.css`, `src/app/globals.css`
