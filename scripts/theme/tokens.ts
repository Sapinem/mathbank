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
const accent = hexToOklch(SOURCES.accent);

export type Mode = "light" | "dark";

export type TokenSet = Record<string, Oklch>;

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
    accent,
    "accent-fg": { l: 0.13, c: 0, h: 0 },
    border: { l: 0.269, c: 0, h: 0 },
  };
}

export function tokensFor(mode: Mode): TokenSet {
  return mode === "dark" ? darkTokens() : lightTokens();
}

export { primary, accent };
