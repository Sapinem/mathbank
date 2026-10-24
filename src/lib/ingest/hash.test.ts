import { describe, it, expect } from "vitest";
import {
  sha256,
  normalizeText,
  normalizeMathDelimiters,
  articleHash,
  contentHash,
} from "./hash";

describe("hash — normalisasi KaTeX & konten", () => {
  it("sha256 menghasilkan hash heksadesimal 64 karakter", () => {
    const h = sha256("test");
    expect(h).toHaveLength(64);
    expect(h).toBe(sha256("  test  ")); // otomatis trim
  });

  it("normalizeText merapikan whitespace biasa dan menjaga kompatibilitas hash DB", () => {
    expect(normalizeText("  halo   dunia \n baru  ")).toBe("halo dunia baru");
    // Menjaga rumus tetap stabil tanpa mutasi delimiter otomatis
    expect(normalizeText("Nilai $x^2 + 1$")).toBe("Nilai $x^2 + 1$");
  });

  it("normalizeMathDelimiters: $ -> \\( dan $$ -> \\[ (CONSTRAINT #29)", () => {
    expect(normalizeMathDelimiters("$x^2+1$")).toBe("\\(x^2 + 1\\)");
    expect(normalizeMathDelimiters("$$E=mc^2$$")).toBe("\\[E = mc^2\\]");
  });

  it("normalizeMathDelimiters: ekuivalensi penulisan inline math", () => {
    const v1 = normalizeMathDelimiters("$x + 1$");
    const v2 = normalizeMathDelimiters("\\(x+1\\)");
    const v3 = normalizeMathDelimiters("\\( x + 1 \\)");
    expect(v1).toBe(v2);
    expect(v2).toBe(v3);
    expect(v1).toBe("\\(x + 1\\)");
  });

  it("normalizeMathDelimiters: ekuivalensi operator persamaan", () => {
    const v1 = normalizeMathDelimiters("$f(x) = 2x$");
    const v2 = normalizeMathDelimiters("\\(f(x)=2x\\)");
    expect(v1).toBe(v2);
    expect(v1).toBe("\\(f(x) = 2x\\)");
  });

  it("normalizeMathDelimiters: ekuivalensi display math", () => {
    const d1 = normalizeMathDelimiters("$$\\int_0^1 x dx$$");
    const d2 = normalizeMathDelimiters("\\[ \\int_0^1 x dx \\]");
    expect(d1).toBe(d2);
    expect(d1).toBe("\\[\\int_0^1 x dx\\]");
  });

  it("normalizeMathDelimiters: melindungi notasi ilmiah eksponensial (misal 1e-5, 2.5e+3)", () => {
    expect(normalizeMathDelimiters("$1e-5$")).toBe("\\(1e-5\\)");
    expect(normalizeMathDelimiters("$2.5e+3$")).toBe("\\(2.5e+3\\)");
    expect(normalizeMathDelimiters("$x = 1e-5 + 2$")).toBe("\\(x = 1e-5 + 2\\)");
  });

  it("contentHash: menghasilkan hash deterministik berbasis stem dan opsi", () => {
    const h1 = contentHash("Berapa nilai $x+1$?", ["1", "2"]);
    const h2 = contentHash("  Berapa  nilai $x+1$?  ", ["1", "2"]);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("contentHash: urutan opsi diabaikan (tahan opsi teracak)", () => {
    const h1 = contentHash("Soal 1", ["Pilihan A", "Pilihan B"]);
    const h2 = contentHash("Soal 1", ["Pilihan B", "Pilihan A"]);
    expect(h1).toBe(h2);
  });

  it("articleHash: hash konten mentah", () => {
    expect(articleHash("konten artikel")).toHaveLength(64);
  });
});
