import { describe, it, expect } from "vitest";
import { normalizeMath } from "./clean";

describe("normalizeMath — `{}^\\!` (superscript tanpa argumen)", () => {
  it("`x \\lt {}^\\!\\log_{a}2` → superscript diberi argumen", () => {
    const out = normalizeMath("x \\lt {}^\\!\\log_{a}2").text;
    expect(out).not.toMatch(/\}\^\s*\\!/); // tidak boleh `}^\!` polos
    expect(out).toContain("\\log_{a}2");
  });

  it("`}^\\!` → `}^{\\!}`", () => {
    const out = normalizeMath("a}^\\!b").text;
    expect(out).toBe("a}^{\\!}b");
  });

  it("`{}^\\!` → `{}^{\\!}`", () => {
    const out = normalizeMath("{}^\\!x").text;
    expect(out).toBe("{}^{\\!}x");
  });

  it("superscript yang SUDAH benar tidak diubah", () => {
    expect(normalizeMath("{}^{\\!}x").text).toBe("{}^{\\!}x");
  });

  it("`x^2` biasa tidak terganggu", () => {
    expect(normalizeMath("x^2").text).toBe("x^2");
  });
});
