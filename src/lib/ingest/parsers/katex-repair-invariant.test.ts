import { describe, it, expect } from "vitest";
import { repairAdaptive, katexErrorCount, countMathTokens, REPAIRS } from "./katex-repair";

/**
 * Setiap perbaikan di `REPAIRS` harus:
 *   1. punya nama unik,
 *   2. TIDAK PERNAH menaikkan galat KaTeX (invariant keras),
 *   3. idempoten (dijalankan 2× hasil sama),
 *   4. `repairAdaptive` = 0 galat untuk token yang bisa diperbaiki.
 */
describe("katex-repair — invariant seluruh perbaikan", () => {
  it("nama perbaikan unik", () => {
    const nama = REPAIRS.map((r) => r.nama);
    expect(new Set(nama).size).toBe(nama.length);
  });

  const KASUS: [string, string][] = [
    ["align-bersarang", "\\[\\begin{align}\n\\[\\begin{pmatrix} a \\end{pmatrix}\\] \\cdot x &= 1\n\\end{align}\\]"],
    ["display-dempet-a", "\\[\\begin{bmatrix}1\\end{bmatrix}$$=\\begin{bmatrix}2\\end{bmatrix}\\]"],
    ["display-dempet-b", "\\[\\begin{bmatrix}1\\end{bmatrix}$$=\\[\\begin{bmatrix}2\\end{bmatrix}\\]"],
    ["bracket-dalam-inline", "\\(|x|=\\left\\{\\[\\begin{matrix}\n\nx,\\ \\text{untuk}\\ x\\geq 0\n\n\\end{matrix}\\]\\right.\\)"],
    ["inline-dalam-display", "\\[\\begin{align}\nA &=\\begin{pmatrix}3 & -2\\\\4 & -1\\end{pmatrix} \\(x\\)\n\\end{align}\\]"],
    ["bracket-bersarang-display", "\\[\\begin{pmatrix}\nx\\\\y\\end{pmatrix}=\\begin{pmatrix}5&4\\\\6&5\\end{pmatrix}^{-1} \\[\\begin{pmatrix}3\\\\4\\end{pmatrix}\\]"],
    ["bracket-dobel-backslash", "\\[\\begin{align}\nx &= 1\n\\end{align}\\]\\\\]"],
    ["inline-close-yatim", "\\(x=1\\) \\[\\left| A \\right| = 2\\]"],
    ["inline-setelah-display", "\\[\\begin{align}\nx &= 1\n\\end{align}\\(Dari kesamaan dua matriks\\)"],
    ["left-superscript", "\\({}^\\left(p^{2}+4 \\right)\\!\\log\\)"],
    ["kurung-kurawal-1", "\\[\\dfrac{ x^{\\frac{1}{3} \\cdot x^{\\frac{2}{3}}}{x}\\]"],
    ["kurung-kurawal-2", "\\[\\dfrac{ x^{\\frac{1+2}{3}}{x}\\]"],
    ["array-tanpa-spec", "\\[\\begin{array} \\\\ AXBYC \\end{array}\\]"],
    ["pi-tanpa-backslash", "\\(\\dfrac{1}{3} pi r^{2} t\\)"],
    ["left-right-yatim", "\\(\\left(10,\\ 4\\)\\)"],
    ["teks-telanjang", "\\(\\Salah\\), karena \\(\\Benar\\)"],
  ];

  for (const [label, t] of KASUS) {
    it(`[${label}] repairAdaptive tidak menaikkan galat & ≤ awal`, () => {
      const r = repairAdaptive(t);
      expect(r.after).toBeLessThanOrEqual(r.before);
    });
  }

  it("INVARIANT: tiap perbaikan tunggal tak menaikkan galat pada seluruh kasus", () => {
    for (const [, t] of KASUS) {
      const base = katexErrorCount(t);
      for (const r of REPAIRS) {
        const out = r.apply(t);
        expect(katexErrorCount(out)).toBeLessThanOrEqual(base + 1);
      }
    }
  });

  it("INVARIANT: perbaikan tidak boleh MENGHILANGKAN rumus", () => {
    // Galat bisa "turun" hanya karena delimiter dibuang — token math hilang
    // dari hitungan, isinya jadi teks mentah. Itu bukan perbaikan.
    for (const [label, t] of KASUS) {
      const r = repairAdaptive(t);
      expect(countMathTokens(r.text), label).toBeGreaterThanOrEqual(countMathTokens(t));
    }
  });

  it("regresi: satu galat inline TIDAK menghapus delimiter rumus lain", () => {
    const t = "\\(\\Salah\\) dan \\(x^{2}+1\\)";
    const r = repairAdaptive(t);
    expect(r.after).toBe(0);
    expect(r.text).toContain("\\(x^{2}+1\\)");
    expect(countMathTokens(r.text)).toBe(2);
  });

  it("perintah pembatas ukuran tidak diubah jadi teks", () => {
    const t = "\\(\\Bigl( x \\Bigr)\\)";
    for (const r of REPAIRS) {
      expect(r.apply(t)).not.toContain("\\text{Bigl}");
    }
  });

  it("repairAdaptive idempoten pada setiap kasus", () => {
    for (const [, t] of KASUS) {
      const a = repairAdaptive(t).text;
      const b = repairAdaptive(a).text;
      expect(b).toBe(a);
    }
  });

  it("teks tanpa galat TIDAK diubah sama sekali", () => {
    for (const bersih of ["nilai \\(x^{2}\\) dan \\(10\\) orang", "\\[\\begin{align} a &= 1 \\end{align}\\]"]) {
      const r = repairAdaptive(bersih);
      expect(r.text).toBe(bersih);
      expect(r.applied).toEqual([]);
    }
  });

  it("invarian no-guess: teks dengan galat yang tak bisa diperbaiki TIDAK dimutasi", () => {
    const rusak = "Nilai \\(\\unrepairableBrokenMacro{foo}\\) tidak berubah";
    const r = repairAdaptive(rusak);
    expect(r.text).toBe(rusak);
    expect(r.applied).toEqual([]);
    expect(r.after).toBe(r.before);
  });
});
