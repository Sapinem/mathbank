/**
 * Mesin tema MathBank — 3 warna sumber → token OKLCH.
 *
 * Sumber (lihat RENCANA-UI.md §6):
 *   primary   #0158CA  → aksen utama (tombol, link, aktif)
 *   accent    #D5AC1E  → "perlu perhatian" (emas)
 *   secondary (netral) → latar, border, teks
 *
 * Menghasilkan src/styles/tokens/generated.css.
 * Jalankan: pnpm theme:build
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

// ── Warna sumber ──────────────────────────────────────────────
const SOURCES = {
  primary: "#0158CA",
  accent: "#D5AC1E",
};

// ── Konversi sRGB hex → OKLCH ─────────────────────────────────
function hexToOklch(hex: string): { l: number; c: number; h: number } {
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

function oklch(l: number, c: number, h: number): string {
  const round = (n: number, d = 3) => Number(n.toFixed(d));
  return `oklch(${round(l)} ${round(c)} ${round(h)})`;
}

// ── Bangun token ──────────────────────────────────────────────
const primary = hexToOklch(SOURCES.primary);
const accent = hexToOklch(SOURCES.accent);

const css = `/* GENERATED — jangan sunting manual. Jalankan: pnpm theme:build */
/* Sumber: primary ${SOURCES.primary}, accent ${SOURCES.accent} */

:root {
  /* Brand — primer */
  --mb-brand: ${oklch(primary.l, primary.c, primary.h)};
  --mb-brand-hover: ${oklch(primary.l - 0.06, primary.c, primary.h)};
  --mb-brand-fg: ${oklch(0.985, 0, 0)};

  /* Brand — aksen (emas, "perlu perhatian") */
  --mb-accent: ${oklch(accent.l, accent.c, accent.h)};
  --mb-accent-fg: ${oklch(0.205, 0, 0)};

  /* Status — UNIVERSAL (tak ikut brand) */
  --mb-success: oklch(0.6 0.15 150);
  --mb-error: oklch(0.577 0.245 27.325);
  --mb-warning: oklch(0.75 0.15 85);
  --mb-info: oklch(0.6 0.15 250);
}

.dark {
  --mb-brand: ${oklch(Math.min(primary.l + 0.14, 0.78), Math.min(primary.c + 0.02, 0.2), primary.h)};
  --mb-brand-hover: ${oklch(Math.min(primary.l + 0.2, 0.85), Math.min(primary.c + 0.02, 0.2), primary.h)};
  --mb-brand-fg: ${oklch(0.13, 0, 0)};

  --mb-accent: ${oklch(accent.l, accent.c, accent.h)};
  --mb-accent-fg: ${oklch(0.13, 0, 0)};

  --mb-success: oklch(0.7 0.15 150);
  --mb-error: oklch(0.704 0.191 22.216);
  --mb-warning: oklch(0.8 0.15 85);
  --mb-info: oklch(0.7 0.15 250);
}
`;

const outPath = resolve("src/styles/tokens/generated.css");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, css);
console.log(`✓ Token tema ditulis: ${outPath}`);
console.log(`  primary = ${oklch(primary.l, primary.c, primary.h)}`);
console.log(`  accent  = ${oklch(accent.l, accent.c, accent.h)}`);
