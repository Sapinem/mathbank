import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MathContent } from "./math-content";
import { renderMath } from "./math-content";

describe("KaTeX aksesibilitas (Fase 4 — MathML)", () => {
  it("renderMath menghasilkan elemen MathML dengan anotasi TeX", () => {
    const html = renderMath("x^2", false);
    expect(html).toContain("<math");
    expect(html).toContain("application/x-tex");
    expect(html).toContain("x^2");
    // Keluaran visual HTML tetap ada.
    expect(html).toContain("katex-html");
  });

  it("MathContent merender MathML untuk rumus inline dan display", () => {
    const { container } = render(
      <MathContent content={"Nilai $x^2$ dan $$\\frac{a}{b}$$ selesai."} />,
    );
    const maths = container.querySelectorAll("math");
    expect(maths.length).toBe(2);
    // Anotasi TeX hadir sehingga screen reader punya teks sumber rumus.
    expect(container.innerHTML).toContain("application/x-tex");
  });

  it("fallback galat tetap meng-escape (tidak ada MathML dari input mentah)", async () => {
    const katex = await import("katex");
    const spy = vi
      .spyOn(katex.default, "renderToString")
      .mockImplementation(() => {
        throw new Error("boom");
      });
    const html = renderMath('<img src=x onerror="alert(1)">', false);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    spy.mockRestore();
  });
});
