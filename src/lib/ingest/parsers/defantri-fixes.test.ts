import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — cacat sintaks umum defantri", () => {
  it("`\\)` YATIM (tanpa `\\(` pembuka) dibuang", () => {
    const out = normalizeMath("akhir rumus\\)\\therefore$ Pilihan yang sesuai adalah \\((C)\\)").text;
    expect(out).not.toMatch(/^\\\)/m); // tak ada `\)` tanpa pembuka
    expect(out).toContain("\\therefore");
  });

  it("`\\begin{array}` TANPA kolom-spec diberi `{c}`", () => {
    const out = normalizeMath("\\begin{array} \\\\ AXBYC \\end{array}").text;
    expect(out).toMatch(/\\begin\{array\}\{c\}/);
  });

  it("`\\begin{array}{cc}` yang BENAR tidak diberi spec tambahan", () => {
    const out = normalizeMath("\\begin{array}{cc} a & b \\end{array}").text;
    expect(out).toContain("\\begin{array}{cc}");
    expect(out).not.toContain("{c}{cc}");
  });
});
