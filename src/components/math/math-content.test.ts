import { describe, it, expect } from "vitest";
import { tokenizeMath } from "./math-content";

describe("tokenizeMath", () => {
  it("mengenali $...$ (inline)", () => {
    const t = tokenizeMath("Nilai $x^2$ adalah");
    expect(t).toEqual([
      { kind: "text", value: "Nilai " },
      { kind: "math", value: "x^2", display: false },
      { kind: "text", value: " adalah" },
    ]);
  });

  it("mengenali $$...$$ (display)", () => {
    const t = tokenizeMath("$$\\frac{a}{b}$$");
    expect(t).toEqual([{ kind: "math", value: "\\frac{a}{b}", display: true }]);
  });

  it("mengenali \\(...\\) (inline, gaya baru)", () => {
    const t = tokenizeMath("Hasil \\(2+2\\) adalah");
    expect(t).toEqual([
      { kind: "text", value: "Hasil " },
      { kind: "math", value: "2+2", display: false },
      { kind: "text", value: " adalah" },
    ]);
  });

  it("mengenali \\[...\\] (display, gaya baru)", () => {
    const t = tokenizeMath("\\[x = \\frac{-b}{2a}\\]");
    expect(t[0]).toEqual({ kind: "math", value: "x = \\frac{-b}{2a}", display: true });
  });

  it("teks tanpa rumus → satu token teks", () => {
    expect(tokenizeMath("Tanpa rumus")).toEqual([
      { kind: "text", value: "Tanpa rumus" },
    ]);
  });

  it("campuran beberapa rumus", () => {
    const t = tokenizeMath("$a$ dan $b$");
    expect(t.filter((x) => x.kind === "math")).toHaveLength(2);
  });
});
