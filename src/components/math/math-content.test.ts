import { describe, it, expect, vi, beforeEach } from "vitest";
import { tokenizeMath } from "@/lib/math/tokenize";
import { renderMath, mathCacheSize, clearMathCache } from "./math-content";

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

describe("renderMath — anti-XSS pada fallback galat (audit MathBankAuditor)", () => {
  it("menghasilkan HTML KaTeX normal untuk rumus valid", () => {
    const html = renderMath("x^2", false);
    expect(html).toContain("katex");
  });

  it("meng-escape HTML saat KaTeX melempar error (cegah XSS)", async () => {
    // Paksa jalur `catch` dengan membuat katex melempar.
    const katex = await import("katex");
    const spy = vi
      .spyOn(katex.default, "renderToString")
      .mockImplementation(() => {
        throw new Error("boom");
      });
    const payload = '<img src=x onerror="alert(1)">';
    const html = renderMath(payload, false);
    // Inti keamanan: `value` TIDAK boleh tersuntik mentah. `<` & `>` harus
    // ter-escape, jadi tak ada elemen <img>/<script> yang bisa dieksekusi.
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&gt;");
    // Isi setelah pembungkus span = payload ter-escape (tanpa `<` mentah).
    const inner = html.replace(/^<span[^>]*>/, "").replace(/<\/span>$/, "");
    expect(inner).not.toContain("<");
    spy.mockRestore();
  });
});

describe("renderMath — cache LRU in-memory (PERF-02)", () => {
  beforeEach(() => clearMathCache());

  it("mengembalikan hasil identik dari cache tanpa kompilasi ulang", async () => {
    const katex = await import("katex");
    const spy = vi.spyOn(katex.default, "renderToString");
    const first = renderMath("x^2 + 1", false);
    const callsAfterFirst = spy.mock.calls.length;
    const second = renderMath("x^2 + 1", false);
    // Panggilan kedua harus dilayani cache (tidak memanggil KaTeX lagi).
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
    expect(second).toBe(first);
    spy.mockRestore();
  });

  it("membedakan kunci inline vs display untuk rumus yang sama", async () => {
    const katex = await import("katex");
    const spy = vi.spyOn(katex.default, "renderToString");
    renderMath("a+b", false);
    renderMath("a+b", true);
    // Dua mode = dua entri cache = dua kompilasi.
    expect(spy.mock.calls.length).toBe(2);
    spy.mockRestore();
  });

  it("menghitung entri cache yang tersimpan", () => {
    clearMathCache();
    renderMath("p", false);
    renderMath("q", false);
    expect(mathCacheSize()).toBe(2);
  });

  it("membatasi ukuran cache (eviction LRU)", () => {
    clearMathCache();
    // Melebihi kapasitas 2000 → entri tertua dibuang, ukuran tak tumbuh tanpa batas.
    for (let i = 0; i < 2100; i++) renderMath(`k_{${i}}`, false);
    expect(mathCacheSize()).toBeLessThanOrEqual(2000);
  });
});
