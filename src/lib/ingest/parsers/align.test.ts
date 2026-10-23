import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — environment TELANJANG (tanpa `$`)", () => {
  it("`\\begin{align}…\\end{align}` tanpa dolar → display `\\[…\\]`", () => {
    const t = "sebagai berikut:\n\\begin{align}\nx &= 1 \\\\\ny &= 2\n\\end{align}\nlalu";
    const out = normalizeMath(t).text;
    expect(out).toContain("\\[");
    expect(out).toContain("\\begin{align}");
    expect(out).not.toContain("\\(");
  });

  it("`\\begin{align}` telanjang TIDAK jadi inline `\\(` (KaTeX: align only display)", () => {
    const out = normalizeMath("\\begin{align}a&=b\\end{align}").text;
    expect(out).not.toMatch(/\\\(.*\\begin\{align\}/);
  });

  it("`\\begin{pmatrix}` telanjang juga dibungkus display", () => {
    const out = normalizeMath("\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}").text;
    expect(out).toContain("\\[");
    expect(out).not.toContain("\\(");
  });

  it("`\\begin{array}` telanjang juga", () => {
    const out = normalizeMath("\\begin{array}{c}1\\\\2\\end{array}").text;
    expect(out).toContain("\\[");
  });

  it("yang SUDAH ber-`$…$` tetap → display (tak dobel-bungkus)", () => {
    const out = normalizeMath("$\\begin{align}a&=b\\end{align}$").text;
    expect(out).toContain("\\[");
    expect(out).toContain("\\begin{align}");
    // tidak boleh ada `\[\begin{align}…\end{align}\]` dobel
    expect((out.match(/\\\[/g) ?? []).length).toBe(1);
  });

  it("teks biasa tanpa environment tidak terganggu", () => {
    expect(normalizeMath("nilai $x^2$ dan $10$ orang").text).toBe("nilai \\(x^2\\) dan \\(10\\) orang");
  });
});
