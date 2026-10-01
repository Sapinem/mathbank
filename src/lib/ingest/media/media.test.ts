import { describe, it, expect } from "vitest";
import { absolutize } from "./resolve-url";
import { extForMime, relativePath } from "./store";
import { hashBytes } from "./fetch";
import { collectUrls, replaceUrl, applyMedia, type MediaCache } from "./ingest-media";
import { bestImageSrc } from "../parsers/clean";

describe("absolutize", () => {
  it("URL absolut tetap", () => {
    expect(absolutize("https://a.com/x.png")).toBe("https://a.com/x.png");
  });
  it("protokol-relatif → https", () => {
    expect(absolutize("//cdn.a.com/x.png")).toBe("https://cdn.a.com/x.png");
  });
  it("relatif + baseUrl → absolut", () => {
    expect(absolutize("/uploads/x.png", "https://mathcyber1997.com/art/")).toBe(
      "https://mathcyber1997.com/uploads/x.png",
    );
  });
  it("relatif tanpa baseUrl → undefined", () => {
    expect(absolutize("/uploads/x.png")).toBeUndefined();
  });
  it("data-URI dibiarkan", () => {
    expect(absolutize("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
});

describe("bestImageSrc (clean.ts)", () => {
  it("PENTING: srcset diprioritaskan di atas src (mathcyber src 404)", () => {
    const tag = `<img loading="lazy" src="/uploads/mathcyber/x/img_1.png" srcset="/uploads/mathcyber/x/img_1.png 450w, https://mathcyber1997.com/wp-content/uploads/2021/06/OGMSMA25-768x299.png 768w, https://mathcyber1997.com/wp-content/uploads/2021/06/OGMSMA25.png 1200w">`;
    expect(bestImageSrc(tag)).toBe("https://mathcyber1997.com/wp-content/uploads/2021/06/OGMSMA25.png");
  });
  it("tanpa srcset → src", () => {
    expect(bestImageSrc(`<img src="https://a.com/x.png">`)).toBe("https://a.com/x.png");
  });
  it("lazy-load data-src bila tak ada srcset", () => {
    expect(bestImageSrc(`<img data-src="https://a.com/lazy.png" src="placeholder.gif">`)).toBe(
      "https://a.com/lazy.png",
    );
  });
});

describe("store: path & ekstensi", () => {
  it("ekstensi per mime", () => {
    expect(extForMime("image/png")).toBe(".png");
    expect(extForMime("image/jpeg")).toBe(".jpg");
    expect(extForMime("image/svg+xml")).toBe(".svg");
    expect(extForMime("application/pdf")).toBe(".bin");
  });
  it("sharding 2 huruf + nama hash", () => {
    const rel = relativePath("abcdef1234", "image/png");
    expect(rel).toBe("ab/abcdef1234.png");
  });
});

describe("hashBytes", () => {
  it("sha256 deterministik", () => {
    const a = hashBytes(new Uint8Array([1, 2, 3]));
    const b = hashBytes(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("collectUrls & applyMedia", () => {
  const md = "Lihat ![gambar](https://a.com/x.png) dan ![lain](https://a.com/y.png)";
  it("kumpulkan URL markdown", () => {
    const urls = collectUrls(md, undefined, "content");
    expect(urls.map((u) => u.url)).toEqual(["https://a.com/x.png", "https://a.com/y.png"]);
    expect(urls[0]!.role).toBe("content");
  });
  it("tag <img> mentah → absolutisasi", () => {
    const urls = collectUrls(`<img src="https://a.com/z.png">`, undefined, "option");
    expect(urls[0]!.url).toBe("https://a.com/z.png");
  });
  it("applyMedia ganti yang berhasil saja (jadi shortcode)", () => {
    const cache: MediaCache = new Map();
    cache.set("https://a.com/x.png", {
      sourceUrl: "https://a.com/x.png",
      shortId: "a7Kx9mP2",
      shortcode: "{{img:a7Kx9mP2}}",
      role: "content",
      ok: true,
    });
    cache.set("https://a.com/y.png", {
      sourceUrl: "https://a.com/y.png", role: "content", ok: false, error: "HTTP 404",
    });
    const out = applyMedia(md, cache);
    expect(out).toContain("{{img:a7Kx9mP2}}");
    expect(out).not.toContain("https://a.com/x.png");
    expect(out).toContain("https://a.com/y.png"); // gagal → tetap URL sumber
    expect(replaceUrl("a.b.a", "a", "X")).toBe("X.b.X");
  });
});
