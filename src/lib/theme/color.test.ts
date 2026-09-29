import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  contrastOklch,
  hexToOklch,
  oklchToRgb,
  relativeLuminance,
} from "./color";

/**
 * Tes logika warna tema — memverifikasi matematika WCAG terhadap nilai rujukan
 * yang diketahui, sehingga klaim "kontras terverifikasi mesin" (A11Y.md)
 * benar-benar terjaga.
 */
describe("konversi warna", () => {
  it("hitam → luminansi 0, putih → luminansi 1", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBeCloseTo(1, 5);
  });

  it("putih↔hitam = rasio kontras maksimum 21:1", () => {
    const white = { r: 1, g: 1, b: 1 };
    const black = { r: 0, g: 0, b: 0 };
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
  });

  it("warna identik = rasio 1:1", () => {
    const c = { r: 0.5, g: 0.5, b: 0.5 };
    expect(contrastRatio(c, c)).toBeCloseTo(1, 5);
  });

  it("rasio kontras simetris (urutan argumen tak berpengaruh)", () => {
    const a = { r: 0.1, g: 0.2, b: 0.3 };
    const b = { r: 0.9, g: 0.8, b: 0.7 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("hexToOklch(#0158CA) menghasilkan biru brand (L~0.49)", () => {
    const o = hexToOklch("#0158CA");
    expect(o.l).toBeCloseTo(0.491, 2);
    expect(o.c).toBeGreaterThan(0.15);
  });

  it("oklchToRgb merupakan kebalikan kasar hexToOklch", () => {
    const hex = "#D5AC1E";
    const rgb = oklchToRgb(hexToOklch(hex));
    expect(rgb.r * 255).toBeCloseTo(0xd5, -0.5);
    expect(rgb.g * 255).toBeCloseTo(0xac, -0.5);
    expect(rgb.b * 255).toBeCloseTo(0x1e, -0.5);
  });

  it("oklchToRgb menjepit nilai ke rentang [0,1] (warna di luar gamut)", () => {
    const rgb = oklchToRgb({ l: 0.9, c: 0.4, h: 140 });
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(1);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(1);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(1);
  });

  it("contrastOklch = hitam/putih ≈ 21", () => {
    const white = { l: 1, c: 0, h: 0 };
    const black = { l: 0, c: 0, h: 0 };
    expect(contrastOklch(white, black)).toBeCloseTo(21, 0);
  });
});
