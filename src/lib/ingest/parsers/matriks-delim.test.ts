import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";
import { repairAdaptive, katexErrorCount } from "./katex-repair";

/**
 * BUG NYATA artikel matriks defantri (`2013 06 Matematika Sma Matriks`).
 * Sumber menulis delimiter campur: `$…$` di dalamnya ada `\begin{matrix}`,
 * `$$` di tengah display, `\]\[` berdempet, `\\]` dobel-backslash, dsb.
 *
 * Prinsip: perbaikan di `clean.ts` harus MENGHASILKAN bentuk yang benar;
 * sisanya ditangani `repairAdaptive` (dipicu hanya saat KaTeX mengeluh).
 */
describe("matriks defantri — delimiter campur", () => {
  it("`$X=\\left ( \\begin{matrix}…$` → DISPLAY, bukan inline ber-`\\[`", () => {
    const out = normalizeMath("$X=\\left ( \\begin{matrix} 2008 & 2009 \\\\ x & y \\end{matrix} \\right )$ sama").text;
    expect(out).not.toMatch(/\\\([^)]*\\\[/); // tak ada `\[` di dalam `\(`
    expect(katexErrorCount(out)).toBe(0);
  });

  it("`$…\\begin{bmatrix}…\\end{bmatrix}$` → display `\\[…\\]`", () => {
    const out = normalizeMath("$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$").text;
    expect(out).toContain("\\[");
    expect(katexErrorCount(out)).toBe(0);
  });

  it("repairAdaptive: `\\]$$=\\begin{…}` (cacat sumber) → bersih", () => {
    const t = "\\[\\begin{bmatrix}1\\end{bmatrix}$$=\\begin{bmatrix}2\\end{bmatrix}\\] lanjut";
    const r = repairAdaptive(t);
    expect(r.after).toBeLessThanOrEqual(r.before);
  });

  it("repairAdaptive: `\\left\\{\\[\\begin{matrix}…\\\\right.` (multi-baris) → bersih", () => {
    const t =
      "\\(|x|=\\left\\{\\[\\begin{matrix}\n\nx,\\ \\text{untuk}\\ x\\geq 0 \\\\\nx,\\ \\text{untuk}\\ x \\lt 0\n\n\\end{matrix}\\]\\right.\\)";
    expect(katexErrorCount(t)).toBeGreaterThan(0);
    expect(repairAdaptive(t).after).toBe(0);
  });

  it("repairAdaptive: `\\end{align}\\]\\\\]` (dobel-backslash) → bersih", () => {
    const t = "\\[\\begin{align}\nx &= 1\n\\end{align}\\]\\\\]";
    const r = repairAdaptive(t);
    expect(r.after).toBeLessThanOrEqual(r.before);
  });

  it("INVARIANT: repairAdaptive tak pernah menaikkan galat", () => {
    const contoh = [
      "\\[\\begin{bmatrix}1\\end{bmatrix}$$=\\begin{bmatrix}2\\end{bmatrix}\\]",
      "\\(|x|=\\left\\{\\[\\begin{matrix}\n\nx\n\n\\end{matrix}\\]\\right.\\)",
      "\\[\\end{align}\\]\\\\]",
      "\\[\\begin{align}\nA^{2} &=\\begin{pmatrix}3 & -2\\\\4 & -1\\end{pmatrix} \\(x\\) \\end{align}\\]",
    ];
    for (const t of contoh) {
      const r = repairAdaptive(t);
      expect(r.after).toBeLessThanOrEqual(r.before);
    }
  });
});
