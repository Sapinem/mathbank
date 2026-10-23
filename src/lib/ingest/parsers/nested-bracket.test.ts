import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — `\\[`/`\\]` BERSARANG di dalam inline `\\(…\\)`", () => {
  it("inline berisi `\\[` → ditangani oleh repairAdaptive (bukan aturan tetap)", () => {
    // Aturan tetapnya DIPINDAH ke katex-repair.ts agar tidak merusak display sah.
    // Di sini cukup pastikan TIDAK merusak: `\(…\)` biasa tetap utuh.
    const out = normalizeMath("\\(a+b\\)").text;
    expect(out).toBe("\\(a+b\\)");
  });

  it("`\\(` … `\\[` … `\\)` yang seharusnya DISPLAY tetap jadi `\\[…\\]`", () => {
    const out = normalizeMath("$\\begin{array}{c} x \\end{array}$").text;
    expect(out).toContain("\\[");
  });

  it("inline berisi `\\]` → dibuang", () => {
    const out = normalizeMath("\\(a+\\[b\\]\\)").text;
    expect(out).not.toMatch(/\\\]/);
  });

  it("display `\\[…\\]` yang SAH tidak terganggu", () => {
    const out = normalizeMath("\\[x^2+1\\]").text;
    expect(out).toContain("\\[");
    expect(out).toContain("\\]");
  });

  it("`\\[` BUKAN bersarang (di luar inline) tetap display", () => {
    const out = normalizeMath("teks \\[a=b\\] akhir").text;
    expect(out).toContain("\\[a=b\\]");
  });
});
