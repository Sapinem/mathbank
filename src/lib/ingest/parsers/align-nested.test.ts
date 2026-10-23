import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — `\\[`/`\\]` bersarang DI DALAM `align` (perbaikan spesifik)", () => {
  it("`\\begin{align} \\[\\begin{pmatrix}…\\] \\end{align}` → `\\[` dalam dibuang", () => {
    const t =
      "\\[\\begin{align}\n\\[\\begin{pmatrix} a & b \\\\ b & a \\end{pmatrix}\\] \\cdot \\[\\begin{pmatrix} c \\end{pmatrix}\\] &= X\n\\end{align}\\]";
    const out = normalizeMath(t).text;
    // `\[` dalam align harus hilang (sebelum `\end{align}`)
    const alignBody = out.slice(out.indexOf("\\begin{align}"), out.indexOf("\\end{align}"));
    expect(alignBody).not.toContain("\\[");
    expect(alignBody).not.toContain("\\]");
    // display terluar tetap
    expect(out).toContain("\\[");
    expect(out).toContain("\\end{align}");
  });

  it("`pmatrix` di dalam align tanpa `\\[` TIDAK diubah", () => {
    const t = "\\[\\begin{align}\nA &= \\begin{pmatrix} 1 & 2 \\end{pmatrix}\n\\end{align}\\]";
    const out = normalizeMath(t).text;
    expect(out).toContain("\\begin{pmatrix}");
  });

  it("display `\\[…\\]` biasa tanpa align TIDAK diubah", () => {
    const out = normalizeMath("\\[x^2+1\\]").text;
    expect(out).toBe("\\[x^2+1\\]");
  });

  it("inline `\\(…\\)` biasa TIDAK diubah", () => {
    expect(normalizeMath("\\(a+b\\)").text).toBe("\\(a+b\\)");
  });
});
