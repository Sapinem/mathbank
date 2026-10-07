import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MathContent } from "./math-content";

/**
 * Kontrak tata letak MathContent (regresi "scroll kanan-kiri"):
 *
 *  - TIDAK ADA kontainer gulir di dalam MathContent. Baik pembungkus konten
 *    (stem/pembahasan) maupun rumus inline mengalir & membungkus.
 *  - Alasan: `overflow-x-auto` pada elemen `inline-block` membuat rentang gulir
 *    palsu ~2px akibat pembulatan sub-pixel KaTeX, dan pada blok panjang seperti
 *    PEMBAHASAN membuat seluruh blok bisa di-drag kanan-kiri. `no-scrollbar`
 *    hanya menyembunyikan scrollbar — gulirnya tetap ada.
 *  - Rumus panjang ditangani di rumus DISPLAY (`.katex-display`, globals.css).
 */
describe("MathContent — tata letak rumus inline (regresi scroll kanan-kiri)", () => {
  it("rumus inline mengalir tanpa kotak gulir sendiri", () => {
    const { container } = render(<MathContent content="Jika $x^2=9$ maka nilai $x$" />);
    const inlineMath = container.querySelectorAll(".katex-inline");
    expect(inlineMath.length).toBe(2);
    inlineMath.forEach((el) => {
      const cls = el.className;
      expect(cls).not.toContain("overflow-x-auto");
      expect(cls).not.toContain("overflow-x-scroll");
      expect(cls).not.toContain("overflow-auto");
      expect(cls).toContain("max-w-full");
    });
  });

  it("pembungkus konten BUKAN kontainer gulir horizontal", () => {
    const { container } = render(<MathContent content="Nilai dari $2+2$ adalah $4$" />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain("max-w-full");
    expect(wrap.className).not.toContain("overflow-x-auto");
    expect(wrap.className).not.toContain("overflow-x-scroll");
    expect(wrap.className).not.toContain("overflow-auto");
  });

  it("tidak ada elemen bergulir horizontal di dalam konten", () => {
    const { container } = render(<MathContent content="Nilai dari $2+2$ adalah $4$" />);
    const scrollers = [...container.querySelectorAll("*")].filter(
      (el) => (el.className?.toString() ?? "").match(/overflow-x-(auto|scroll)/),
    );
    expect(scrollers).toHaveLength(0);
  });

  it("pembahasan multi-baris tidak membuat pembungkus menggulir", () => {
    const sol = "Langkah 1: $a+b$.\nLangkah 2: hasil $c$.\n$d=e$ selesai.";
    const { container } = render(<MathContent content={sol} />);
    const wrap = container.firstElementChild as HTMLElement;
    const cs = getComputedStyle(wrap);
    expect(cs.overflowX).not.toBe("auto");
    expect(cs.overflowX).not.toBe("scroll");
  });

  it("noScroll → pembungkus memotong (overflow-hidden), bukan menggulir", () => {
    const { container } = render(<MathContent content="Soal $x+1$ panjang" noScroll />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain("overflow-hidden");
    expect(wrap.className).not.toContain("overflow-x-auto");
  });

  it("rumus display tidak dibungkus pembungkus inline tambahan", () => {
    const { container } = render(<MathContent content="$$\\frac{a}{b}$$" />);
    // Hasil KaTeX displayMode sudah punya .katex-display; tidak ada .katex-inline.
    expect(container.querySelectorAll(".katex-inline")).toHaveLength(0);
  });
});
