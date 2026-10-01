import { describe, it, expect } from "vitest";
import { tokenizeMath } from "./math-content";

/**
 * Tokenisasi `{{img:<shortId>}}` di MathContent (G4.4).
 *
 * Yang dijaga: shortcode TIDAK boleh tertelan sebagai teks biasa maupun sebagai
 * rumus, dan rumus di sekitarnya tetap utuh.
 */
describe("tokenizeMath — shortcode gambar", () => {
  it("mengenali satu shortcode", () => {
    const t = tokenizeMath("Perhatikan: {{img:a7Kx9mP2}} berikut.");
    const imgs = t.filter((x) => x.kind === "img");
    expect(imgs.length).toBe(1);
    expect(imgs[0]).toMatchObject({ kind: "img", shortId: "a7Kx9mP2" });
  });

  it("mengenali beberapa shortcode", () => {
    const t = tokenizeMath("{{img:AAAAAAAA}} lalu {{img:BBBBBBBB}}");
    const ids = t.filter((x) => x.kind === "img").map((x) => (x as { shortId: string }).shortId);
    expect(ids).toEqual(["AAAAAAAA", "BBBBBBBB"]);
  });

  it("rumus di sekitar tetap utuh (tidak tertelan)", () => {
    const t = tokenizeMath("Nilai \\(x^2\\) pada {{img:a7Kx9mP2}} dan \\[y=2\\]");
    const math = t.filter((x) => x.kind === "math");
    const imgs = t.filter((x) => x.kind === "img");
    expect(math.length).toBe(2);
    expect(imgs.length).toBe(1);
    expect(math[0]).toMatchObject({ value: "x^2", display: false });
    expect(math[1]).toMatchObject({ value: "y=2", display: true });
  });

  it("shortcode tidak tertelan sebagai rumus", () => {
    // Tanpa pemisahan, `{{img:…}}` bisa dianggap teks rumus \\( \\) bila berdekatan.
    const t = tokenizeMath("\\(a\\){{img:ZZZZZZZZ}}");
    expect(t.some((x) => x.kind === "img")).toBe(true);
    expect(t.filter((x) => x.kind === "math").length).toBe(1);
  });

  it("tahan varian spasi", () => {
    const t = tokenizeMath("{{ img : a7Kx9mP2 }}");
    expect(t.some((x) => x.kind === "img")).toBe(true);
  });

  it("mengabaikan panjang short_id yang salah", () => {
    expect(tokenizeMath("{{img:abc}}").some((x) => x.kind === "img")).toBe(false);
    expect(tokenizeMath("{{img:a7Kx9mP2z}}").some((x) => x.kind === "img")).toBe(false);
  });

  it("teks tanpa shortcode tetap seperti semula", () => {
    const t = tokenizeMath("Biasa saja");
    expect(t).toEqual([{ kind: "text", value: "Biasa saja" }]);
  });

  it("teks di antara shortcode dipertahankan", () => {
    const t = tokenizeMath("A {{img:AAAAAAAA}} B");
    const texts = t.filter((x) => x.kind === "text").map((x) => (x as { value: string }).value);
    expect(texts.join("")).toContain("A ");
    expect(texts.join("")).toContain(" B");
  });
});
