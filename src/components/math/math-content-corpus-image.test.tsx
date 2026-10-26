import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { tokenizeMath } from "@/lib/math/tokenize";
import { MathContent } from "./math-content";

/**
 * Fallback rendering untuk markdown gambar `corpus://` yang lolos dari ingest.
 *
 * Akar masalah: tokenizer tidak pernah menangani sintaks `![alt](url)` —
 * hanya shortcode `{{img:…}}` — sementara `applyMedia` membiarkan URL
 * sumber apa adanya bila unduhannya gagal. Akibatnya markdown corpus
 * tampil mentah ke pengguna di daftar, detail, dan cetak (semuanya lewat
 * MathContent). Yang dijaga di sini: `corpus://` TIDAK PERNAH tampil
 * mentah, URL tidak ditebak, rumus KaTeX sah tetap dirender, dan gambar
 * non-corpus tidak diubah perilakunya.
 */
describe("tokenizeMath — markdown gambar corpus://", () => {
  it("mengubah markdown corpus lengkap menjadi token unavailableImage", () => {
    const t = tokenizeMath(
      "Pilih ![\\frac{3}{20}](corpus://pusmendik_tka/Simulasi TKA-img-1.png) yang benar.",
    );
    expect(t.some((x) => x.kind === "unavailableImage")).toBe(true);
    expect(t.filter((x) => x.kind === "text").map((x) => (x as { value: string }).value).join("")).not.toContain(
      "corpus://",
    );
    const img = t.find((x) => x.kind === "unavailableImage") as { alt: string };
    expect(img.alt).toBe("\\frac{3}{20}");
  });

  it("alt kosong dan alt generik tetap menjadi token placeholder", () => {
    const empty = tokenizeMath("Lihat ![](corpus://pusmendik_tka/a-img-1.png) di atas.");
    expect(empty.find((x) => x.kind === "unavailableImage")).toMatchObject({ alt: "" });
    const generic = tokenizeMath("Lihat ![Gambar](corpus://pusmendik_tka/a-img-1.png) di atas.");
    expect(generic.find((x) => x.kind === "unavailableImage")).toMatchObject({ alt: "Gambar" });
  });

  it("bentuk terpotong di akhir string (kasus excerpt) tetap tertangkap", () => {
    const t = tokenizeMath("Soal ![Gambar](corpus://pusmendik_tka/Simulasi TKA-img-1");
    expect(t.some((x) => x.kind === "unavailableImage")).toBe(true);
    expect(t.filter((x) => x.kind === "text").map((x) => (x as { value: string }).value).join("")).not.toContain(
      "corpus://",
    );
  });

  it("rumus KaTeX sah di sekitarnya tetap dirender sebagai rumus", () => {
    const t = tokenizeMath("Nilai $x^2$ dan ![Gambar](corpus://pusmendik_tka/a-img-1.png) berikut.");
    expect(t.filter((x) => x.kind === "math")).toMatchObject([{ value: "x^2", display: false }]);
    expect(t.some((x) => x.kind === "unavailableImage")).toBe(true);
  });

  it("shortcode tetap dikenali di samping markdown corpus", () => {
    const t = tokenizeMath("{{img:a7Kx9mP2}} dan ![Gambar](corpus://pusmendik_tka/a-img-1.png)");
    expect(t.some((x) => x.kind === "img")).toBe(true);
    expect(t.some((x) => x.kind === "unavailableImage")).toBe(true);
  });

  it("gambar markdown non-corpus TIDAK diubah (perilaku lama dipertahankan)", () => {
    const t = tokenizeMath("Lihat ![Gambar](https://example.com/a.png) di atas.");
    expect(t.some((x) => x.kind === "unavailableImage")).toBe(false);
    expect(t.filter((x) => x.kind === "text").map((x) => (x as { value: string }).value).join("")).toContain(
      "https://example.com/a.png",
    );
  });
});

describe("MathContent — placeholder gambar corpus://", () => {
  it("tidak menampilkan sintaks markdown maupun corpus://, hanya placeholder", () => {
    const { container } = render(
      <MathContent content="Pilih ![\frac{3}{20}](corpus://pusmendik_tka/Simulasi TKA-img-1.png) yang benar." />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("corpus://");
    expect(text).not.toContain("![");
    expect(text).toContain("gambar tidak tersedia");
    expect(text).toContain("Pilih");
    expect(text).toContain("yang benar.");
  });

  it("alt generik menjadi placeholder generik tanpa URL", () => {
    const { container } = render(
      <MathContent content="Lihat ![Gambar](corpus://pusmendik_tka/a-img-1.png) di atas." />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("corpus://");
    expect(text).toContain("[gambar tidak tersedia]");
  });

  it("rumus KaTeX sah tetap dirender di samping placeholder", () => {
    const { container } = render(
      <MathContent content="Nilai $x^2$ dan ![Gambar](corpus://pusmendik_tka/a-img-1.png) berikut." />,
    );
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent ?? "").toContain("gambar tidak tersedia");
  });
});
