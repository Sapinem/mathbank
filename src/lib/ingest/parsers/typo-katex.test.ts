import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — typo KaTeX umum sumber", () => {
  it("`pi` tanpa backslash → `\\pi` (setelah angka/spasi)", () => {
    const out = normalizeMath("\\dfrac{1}{3} pi r^{2} t").text;
    expect(out).toContain("\\pi r^{2}");
    expect(out).not.toMatch(/[^\\]pi\b/); // tak ada `pi` tanpa backslash
  });

  it("`pi` yang SUDAH `\\pi` tidak diubah", () => {
    expect(normalizeMath("\\pi r^{2}").text).toBe("\\pi r^{2}");
  });

  it("`\\text{_}` → `\\text{\\_}` (underscore di-escape)", () => {
    const out = normalizeMath("\\text{_} & \\text{(1)}").text;
    expect(out).toContain("\\text{\\_}");
  });

  it("`\\text{abc}` biasa tidak terganggu", () => {
    expect(normalizeMath("\\text{abc}").text).toBe("\\text{abc}");
  });
});
