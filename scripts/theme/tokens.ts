/**
 * Definisi token tema MathBank — satu sumber kebenaran.
 *
 * Dipakai oleh `build.ts` (tulis CSS) dan `check.ts` (verifikasi WCAG).
 * Sumber warna (lihat RENCANA-UI.md §6):
 *   primary #0158CA → aksen utama; accent #D5AC1E → "perlu perhatian" (emas).
 * Status UNIVERSAL (tak ikut brand) — lihat DESAIN-PER-LAPISAN.
 */
import { SOURCES, hexToOklch, type Oklch } from "@/lib/theme/color";

const primary = hexToOklch(SOURCES.primary);
const accentSource = hexToOklch(SOURCES.accent);

/**
 * Aksen (emas) untuk **mode terang** — digelapkan dari sumber `#D5AC1E` (L≈0.76)
 * agar lolos AA saat dipakai sebagai TEKS/ikon (`text-gold`). Sumber emas terang
 * (2.16:1) tak layak jadi teks. Badge pakai `gold/15` (opacity rendah) → tetap
 * lembut. Mode gelap pakai emas terang (kontras tinggi di latar gelap).
 * Lihat T-M3-3 (docs/VERIFIKASI-AUDIT-M3.md).
 */
const accent = { ...accentSource, l: 0.548 };

export { accentSource };

export type Mode = "light" | "dark";

export type TokenSet = Record<string, Oklch>;

/**
 * Warna STATUS — universal (tak ikut brand), lihat DESAIN-PER-LAPISAN.
 *
 * **Penting (T-M3-3):** nilai ini dulunya hardcoded di `build.ts` → **luput**
 * dari `theme:check`. Kini tinggal di sini (sumber kebenaran tunggal) agar
 * `build.ts` (tulis CSS) & `check.ts` (verifikasi WCAG) memakai angka yang SAMA.
 *
 * Nilai terang dipilih agar ≥4.5:1 di latar putih (AA teks normal, WCAG 2.2);
 * nilai gelap ≥4.5:1 di `bg`/`card` gelap. Diuji di `theme:check`.
 */
export const STATUS_TOKENS = {
  light: {
    success: { l: 0.53, c: 0.15, h: 150 },
    warning: { l: 0.548, c: 0.15, h: 85 },
    error: { l: 0.577, c: 0.245, h: 27.325 },
    info: { l: 0.548, c: 0.15, h: 250 },
  },
  dark: {
    success: { l: 0.602, c: 0.15, h: 150 },
    warning: { l: 0.62, c: 0.15, h: 85 },
    error: { l: 0.648, c: 0.191, h: 22.216 },
    info: { l: 0.618, c: 0.15, h: 250 },
  },
} as const satisfies Record<Mode, Record<string, Oklch>>;

/** Token terang (`.light` / `:root`). */
export function lightTokens(): TokenSet {
  return {
    bg: { l: 1, c: 0, h: 0 },
    fg: { l: 0.145, c: 0, h: 0 },
    "muted-fg": { l: 0.556, c: 0, h: 0 },
    card: { l: 1, c: 0, h: 0 },
    "card-fg": { l: 0.145, c: 0, h: 0 },
    brand: primary,
    "brand-fg": { l: 0.985, c: 0, h: 0 },
    accent,
    "accent-fg": { l: 0.205, c: 0, h: 0 },
    border: { l: 0.922, c: 0, h: 0 },
    ...STATUS_TOKENS.light,
  };
}

/** Token gelap (`.dark`). */
export function darkTokens(): TokenSet {
  return {
    bg: { l: 0.145, c: 0, h: 0 },
    fg: { l: 0.985, c: 0, h: 0 },
    "muted-fg": { l: 0.708, c: 0, h: 0 },
    card: { l: 0.205, c: 0, h: 0 },
    "card-fg": { l: 0.985, c: 0, h: 0 },
    brand: {
      l: Math.min(primary.l + 0.14, 0.78),
      c: Math.min(primary.c + 0.02, 0.2),
      h: primary.h,
    },
    "brand-fg": { l: 0.13, c: 0, h: 0 },
    accent: accentSource,
    // Badge `bg-gold/15` di mode gelap = latar GELAP → teks harus TERANG.
    // Sebelumnya 0.13 (gelap di atas gelap) → 1.27:1 (GAGAL). Kini ~0.985.
    "accent-fg": { l: 0.985, c: 0, h: 0 },
    border: { l: 0.269, c: 0, h: 0 },
    ...STATUS_TOKENS.dark,
  };
}

export function tokensFor(mode: Mode): TokenSet {
  return mode === "dark" ? darkTokens() : lightTokens();
}

export { primary, accent };
