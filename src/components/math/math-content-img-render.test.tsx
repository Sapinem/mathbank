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

  it("merender diagram default sebagai blok rata-tengah tanpa border kaku", () => {
    const { container } = render(<MathContent content="{{img:a7Kx9mP2}}" />);
    const wrap = container.querySelector('[data-slot="media-image"]')!;
    expect(wrap).not.toBeNull();
    expect(wrap.getAttribute("data-size")).toBe("md");
    expect(wrap.className).toContain("block");
    expect(wrap.className).toContain("text-center");

    const img = wrap.querySelector("img")!;
    expect(img.className).not.toContain("border");
    expect(img.className).not.toContain("rounded");
  });

  it("merender modifier sm sebagai elemen inline-block", () => {
    const { container } = render(<MathContent content="{{img:a7Kx9mP2|sm}}" />);
    const wrap = container.querySelector('[data-slot="media-image"]')!;
    expect(wrap.getAttribute("data-size")).toBe("sm");
    expect(wrap.className).toContain("inline-block");
  });

  it("memasang atribut width, height, dan aspectRatio bila disediakan di mediaLookup", () => {
    const lookup = {
      a7Kx9mP2: { width: 640, height: 480 },
    };
    const { container } = render(
      <MathContent content="{{img:a7Kx9mP2}}" mediaLookup={lookup} />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("width")).toBe("640");
    expect(img.getAttribute("height")).toBe("480");
    expect(img.style.aspectRatio).toBe("640 / 480");
  });
});
