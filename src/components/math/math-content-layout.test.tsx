import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MathContent } from "./math-content";

/**
 * Regresi MAT-47: setiap rumus inline TIDAK boleh menjadi wilayah gulir
 * horizontal tersendiri.
 *
 * Kejadian sebelumnya: tiap potongan rumus dibungkus
 * `inline-block … overflow-x-auto`, sehingga rumus pendek seperti `5` atau
 * `a≥b` pun menjadi kontainer gulir — pengguna melihat scrollbar kanan-kiri di
 * dalam kalimat dan rumus terpotong. Perbaikan: gulir hanya ditangani SATU KALI
 * di pembungkus konten; rumus inline mengalir sebagai elemen inline biasa.
 */
describe("MathContent — tata letak rumus inline (regresi scroll kanan-kiri)", () => {
  it("rumus inline TIDAK memakai overflow-x-auto (bukan kotak gulir per-rumus)", () => {
    const { container } = render(<MathContent content="Jika $x^2=9$ maka nilai $x$" />);
    const inlineMath = container.querySelectorAll(".katex-inline");
    expect(inlineMath.length).toBe(2);
    inlineMath.forEach((el) => {
      const cls = el.className;
      expect(cls).not.toContain("overflow-x-auto");
      expect(cls).not.toContain("overflow-x-scroll");
      // Elemen inline biasa — bukan kotak `inline-block` tersendiri.
      expect(cls).not.toContain("inline-block");
    });
  });

  it("pembungkus konten adalah SATU-SATUNYA kontainer gulir horizontal", () => {
    const { container } = render(<MathContent content="Nilai dari $2+2$ adalah $4$" />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.className).toContain("overflow-x-auto");
    expect(wrap.className).toContain("max-w-full");
    // Tidak ada kontainer gulir lain di dalamnya (rumus mengalir bebas).
    const innerScrollers = [...container.querySelectorAll("*")].filter(
      (el) =>
        el !== wrap &&
        (el.className?.toString() ?? "").match(/overflow-x-(auto|scroll)/),
    );
    expect(innerScrollers).toHaveLength(0);
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
