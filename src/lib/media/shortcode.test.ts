import { describe, it, expect } from "vitest";
import {
  mediaShortcode,
  hasImageShortcode,
  extractShortIds,
  normalizeShortcodes,
  mediaUrl,
  stripShortcodes,
  parseImageShortcode,
} from "./shortcode";

describe("mediaShortcode", () => {
  it("membangun shortcode kanonik", () => {
    expect(mediaShortcode("a7Kx9mP2")).toBe("{{img:a7Kx9mP2}}");
  });

  it("membangun shortcode dengan modifier ukuran", () => {
    expect(mediaShortcode("a7Kx9mP2", "sm")).toBe("{{img:a7Kx9mP2|sm}}");
    expect(mediaShortcode("a7Kx9mP2", "full")).toBe("{{img:a7Kx9mP2|full}}");
  });

  it("menolak short_id tak sah", () => {
    expect(() => mediaShortcode("abc")).toThrow(/tidak sah/);
    expect(() => mediaShortcode("a7Kx9m-2")).toThrow(/tidak sah/);
    expect(() => mediaShortcode("")).toThrow(/tidak sah/);
  });
});

describe("parseImageShortcode", () => {
  it("mengurai shortcode tanpa modifier", () => {
    expect(parseImageShortcode("{{img:a7Kx9mP2}}")).toEqual({ shortId: "a7Kx9mP2" });
  });

  it("mengurai shortcode dengan modifier", () => {
    expect(parseImageShortcode("{{img:a7Kx9mP2|sm}}")).toEqual({ shortId: "a7Kx9mP2", size: "sm" });
    expect(parseImageShortcode("{{ img : a7Kx9mP2 | full }}")).toEqual({ shortId: "a7Kx9mP2", size: "full" });
  });

  it("menolak teks bukan shortcode atau modifier tidak sah", () => {
    expect(parseImageShortcode("{{img:a7Kx9mP2|xl}}")).toBeNull();
    expect(parseImageShortcode("bukan shortcode")).toBeNull();
  });
});

describe("hasImageShortcode", () => {
  it("mendeteksi ada/tidak", () => {
    expect(hasImageShortcode("lihat {{img:a7Kx9mP2}} ya")).toBe(true);
    expect(hasImageShortcode("lihat {{img:a7Kx9mP2|sm}} ya")).toBe(true);
    expect(hasImageShortcode("tanpa gambar")).toBe(false);
    expect(hasImageShortcode("")).toBe(false);
  });

  it("tahan spasi varian", () => {
    expect(hasImageShortcode("{{ img : a7Kx9mP2 }}")).toBe(true);
    expect(hasImageShortcode("{{ img : a7Kx9mP2 | md }}")).toBe(true);
  });
});

describe("extractShortIds", () => {
  it("mengambil semua, urut, tanpa duplikat", () => {
    const text = "{{img:a7Kx9mP2}} lalu {{img:ZZZZZZZZ|lg}} dan {{img:a7Kx9mP2|sm}}";
    expect(extractShortIds(text)).toEqual(["a7Kx9mP2", "ZZZZZZZZ"]);
  });

  it("kosong bila tak ada", () => {
    expect(extractShortIds("biasa saja")).toEqual([]);
  });

  it("mengabaikan panjang salah", () => {
    expect(extractShortIds("{{img:abc}} {{img:a7Kx9mP2z}}")).toEqual([]);
  });
});

describe("normalizeShortcodes", () => {
  it("merapikan varian spasi jadi kanonik", () => {
    expect(normalizeShortcodes("{{ img : a7Kx9mP2 }}")).toBe("{{img:a7Kx9mP2}}");
    expect(normalizeShortcodes("{{img:  a7Kx9mP2}}")).toBe("{{img:a7Kx9mP2}}");
    expect(normalizeShortcodes("{{ img : a7Kx9mP2 | sm }}")).toBe("{{img:a7Kx9mP2|sm}}");
  });

  it("tak mengubah yang sudah kanonik", () => {
    expect(normalizeShortcodes("{{img:a7Kx9mP2}}")).toBe("{{img:a7Kx9mP2}}");
    expect(normalizeShortcodes("{{img:a7Kx9mP2|full}}")).toBe("{{img:a7Kx9mP2|full}}");
  });

  it("idempoten", () => {
    const once = normalizeShortcodes("{{ img : a7Kx9mP2 | lg }}");
    expect(normalizeShortcodes(once)).toBe(once);
  });

  it("tak menyentuh teks lain", () => {
    expect(normalizeShortcodes("rumus \\(x^2\\) aman")).toBe("rumus \\(x^2\\) aman");
  });
});

describe("mediaUrl", () => {
  it("membangun URL penyajian", () => {
    expect(mediaUrl("a7Kx9mP2")).toBe("/img/a7Kx9mP2");
  });
});

describe("stripShortcodes", () => {
  it("membuang shortcode (untuk ekspor teks polos)", () => {
    expect(stripShortcodes("lihat {{img:a7Kx9mP2}} ya")).toBe("lihat  ya");
    expect(stripShortcodes("lihat {{img:a7Kx9mP2|sm}} ya")).toBe("lihat  ya");
  });

  it("bisa diganti placeholder", () => {
    expect(stripShortcodes("{{img:a7Kx9mP2}}", "[gambar]")).toBe("[gambar]");
    expect(stripShortcodes("{{img:a7Kx9mP2|full}}", "[gambar]")).toBe("[gambar]");
  });
});
