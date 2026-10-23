import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — env display di dalam inline `\\(…\\)` → jadikan display", () => {
  it("`\\(\\begin{align}…\\end{align}\\)` → `\\[…\\]`", () => {
    const t = "teks \\(\\begin{align}\nx &= 1\n\\end{align}\\) selesai";
    const out = normalizeMath(t).text;
    expect(out).toContain("\\[");
    expect(out).toContain("\\begin{align}");
    expect(out).not.toMatch(/\\\([^)]*\\begin\{align\}/);
  });

  it("`\\(\\begin{aligned}…\\)` juga → display", () => {
    const out = normalizeMath("\\(\\begin{aligned}a&=b\\end{aligned}\\)").text;
    expect(out).not.toMatch(/\\\([^)]*\\begin\{aligned\}/);
  });

  it("`\\(\\begin{split}…\\)` juga → display", () => {
    const out = normalizeMath("\\(\\begin{split}a&=b\\end{split}\\)").text;
    expect(out).not.toMatch(/\\\([^)]*\\begin\{split\}/);
  });

  it("inline BIASA tetap inline", () => {
    expect(normalizeMath("\\(x^2\\)").text).toBe("\\(x^2\\)");
  });

  it("display `\\[…\\]` yang sah tetap", () => {
    expect(normalizeMath("\\[a=b\\]").text).toBe("\\[a=b\\]");
  });
});
