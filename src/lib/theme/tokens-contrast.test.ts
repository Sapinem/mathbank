import { describe, it, expect } from "vitest";
import { contrastOklch, oklchToRgb, relativeLuminance, contrastRatio, type Oklch } from "./color";
import { STATUS_TOKENS, tokensFor } from "../../../scripts/theme/tokens";

/**
 * Tes regresi token tema (T-M3-3) — memastikan warna STATUS yang dipakai
 * sebagai TEKS (jawaban benar, stok) memenuhi WCAG 2.2 AA (≥4.5:1) di kedua mode.
 *
 * Latar: bg/kartu mode terkait. Ini menutup celah `theme:check` yang dulu
 * (sebelum M3 diperbaiki) hanya memeriksa 10 token dasar, BUKAN warna status.
 */
const AA_NORMAL = 4.5;
const MODES = ["light", "dark"] as const;

describe("token tema — kontras warna status (AA)", () => {
  for (const mode of MODES) {
    const t = tokensFor(mode);
    for (const [name, color] of Object.entries(STATUS_TOKENS[mode])) {
      it(`${name} (${mode}) ≥ ${AA_NORMAL} di latar & kartu`, () => {
        expect(contrastOklch(color as Oklch, t.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
        expect(contrastOklch(color as Oklch, t.card)).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
    it(`aksen (emas) sebagai teks (${mode}) ≥ ${AA_NORMAL}`, () => {
      expect(contrastOklch(t.accent, t.bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});

describe("badge emas — text-gold-fg di atas bg-gold/15", () => {
  it("kontras tinggi (badge sungguhan, bukan pasangan teoretis)", () => {
    for (const mode of MODES) {
      const t = tokensFor(mode);
      const base = mode === "light" ? { r: 1, g: 1, b: 1 } : oklchToRgb(t.bg);
      const gold = oklchToRgb(t.accent);
      // bg-gold/15 = accent 15% di atas latar
      const blended = {
        r: 0.15 * gold.r + 0.85 * base.r,
        g: 0.15 * gold.g + 0.85 * base.g,
        b: 0.15 * gold.b + 0.85 * base.b,
      };
      const fg = oklchToRgb(t["accent-fg"]);
      const ratio = contrastRatio(fg, blended);
      expect(relativeLuminance(blended)).toBeGreaterThan(0);
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });
});
