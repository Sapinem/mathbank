import { describe, it, expect } from "vitest";
import { repairAdaptive, katexErrorCount } from "./katex-repair";

describe("repairAdaptive — perbaikan spesifik yang dipicu saat error", () => {
  it("teks TANPA error dikembalikan apa adanya (tak diubah)", () => {
    const t = "nilai \\(x^2\\) dan \\(10\\) orang";
    const r = repairAdaptive(t);
    expect(r.text).toBe(t);
    expect(r.applied).toEqual([]);
  });

  it("`\\[` bersarang dalam align → diperbaiki, error turun", () => {
    const t =
      "\\[\\begin{align}\n\\[\\begin{pmatrix} a \\end{pmatrix}\\] \\cdot x &= 1\n\\end{align}\\]";
    const before = katexErrorCount(t);
    expect(before).toBeGreaterThan(0);
    const r = repairAdaptive(t);
    expect(r.after).toBeLessThan(before);
  });

  it("`$=\\[\\begin{bmatrix}…\\]` (dolar menganggur) → tak menaikkan error", () => {
    const t = "$=\\[\n\\begin{bmatrix} 0 & 0 \\end{bmatrix}\\]";
    const r = repairAdaptive(t);
    expect(r.after).toBeLessThanOrEqual(r.before);
  });

  it("`\\text{_}` → tidak menaikkan error", () => {
    const t = "\\text{_} & \\text{(1)}";
    const r = repairAdaptive(t);
    expect(r.after).toBeLessThanOrEqual(r.before);
  });

  it("perbaikan TIDAK PERNAH menaikkan error (invariant)", () => {
    const contoh = [
      "\\[\\begin{align}\n\\[\\begin{pmatrix} a \\end{pmatrix}\\] &= 1\n\\end{align}\\]",
      "$=\\[\\begin{bmatrix} 0 \\end{bmatrix}\\]",
      "\\text{_}",
      "\\begin{array} \\\\ AXBYC \\end{array}",
      "\\dfrac{1}{3} pi r^{2} t",
      "\\dfrac{1}{3} left(\\dfrac{22}{7} \\right)",
    ];
    for (const t of contoh) {
      const r = repairAdaptive(t);
      expect(r.after).toBeLessThanOrEqual(r.before);
    }
  });

  it("idempoten: jalankan 2x hasil sama", () => {
    const t = "\\text{_}";
    const a = repairAdaptive(t).text;
    const b = repairAdaptive(a).text;
    expect(b).toBe(a);
  });
});
