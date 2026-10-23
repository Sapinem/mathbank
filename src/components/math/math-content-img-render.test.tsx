import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MathContent } from "./math-content";

/**
 * ACT-17 sempat memaksa SEMUA gambar ke 400x300 (rasio 4:3) karena
 * `{{img:shortId}}` tidak pernah membawa dimensi. Akibatnya gambar potret
 * gepeng dan gambar kecil di-upscale. Kontraknya sekarang: dimensi hanya
 * dipasang bila sumber benar-benar memberikannya.
 */
describe("MediaImage — dimensi", () => {
  it("tanpa dimensi sumber: tidak memaksa width/height/aspect-ratio", () => {
    const { container } = render(<MathContent content="Lihat {{img:a7Kx9mP2}} di bawah." />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("width")).toBeNull();
    expect(img!.getAttribute("height")).toBeNull();
    expect(img!.getAttribute("style")).toBeNull();
  });

  it("tetap memakai src /img/{shortId} dan alt yang bisa dibaca", () => {
    const { container } = render(<MathContent content="{{img:a7Kx9mP2}}" />);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/img/a7Kx9mP2");
    expect(img.getAttribute("alt")).toContain("a7Kx9mP2");
  });
});
