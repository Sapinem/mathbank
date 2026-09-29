/**
 * Utilitas warna tema MathBank — konversi hex → OKLCH, OKLCH → sRGB, dan
 * perhitungan kontras WCAG. Dipakai oleh `build.ts` (bangun token) dan
 * `check.ts` (verifikasi kontras aksesibilitas).
 *
 * Lihat RENCANA-UI.md §6 (sumber warna) dan A11Y.md (target WCAG 2.2 AA).
 */

export type Oklch = { l: number; c: number; h: number };
export type Rgb = { r: number; g: number; b: number }; // 0..1 linear? tidak — sRGB 0..1

// ── Warna sumber (satu sumber kebenaran) ──────────────────────
export const SOURCES = {
  primary: "#0158CA",
  accent: "#D5AC1E",
} as const;

// ── sRGB hex → OKLCH ──────────────────────────────────────────
export function hexToOklch(hex: string): Oklch {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const lin = (v: number) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const lr = lin(r);
  const lg = lin(g);
  const lb = lin(b);

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l1 = Math.cbrt(l_);
  const m1 = Math.cbrt(m_);
  const s1 = Math.cbrt(s_);

  const L = 0.2104542553 * l1 + 0.793617785 * m1 - 0.0040720468 * s1;
  const a = 1.9779984951 * l1 - 2.428592205 * m1 + 0.4505937099 * s1;
  const bb = 0.0259040371 * l1 + 0.7827717662 * m1 - 0.808675766 * s1;

  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

export function oklch(l: number, c: number, h: number): string {
  const round = (n: number, d = 3) => Number(n.toFixed(d));
  return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

// ── OKLCH → sRGB linear → sRGB ────────────────────────────────
export function oklchToRgb({ l: L, c: C, h: H }: Oklch): Rgb {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (v: number) =>
    v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    r: clamp(gamma(rLin)),
    g: clamp(gamma(gLin)),
    b: clamp(gamma(bLin)),
  };
}

// ── Luminansi relatif + rasio kontras WCAG ────────────────────
export function relativeLuminance(rgb: Rgb): number {
  const chan = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

/** Rasio kontras WCAG 2.x antara dua warna (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Hitung rasio kontras langsung dari dua token OKLCH. */
export function contrastOklch(fg: Oklch, bg: Oklch): number {
  return contrastRatio(oklchToRgb(fg), oklchToRgb(bg));
}

/** Ambang WCAG 2.2 AA untuk teks normal (4.5:1). */
export const AA_NORMAL = 4.5;
/** Ambang WCAG 2.2 AA untuk teks besar & komponen/grafis (3:1). */
export const AA_LARGE = 3;
