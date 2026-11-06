import { describe, it, expect } from "vitest";
import {
  createMathSegmentRegex,
  cleanMarkdownExcludingMath,
  excerpt,
  stripImages,
  flattenMathForList,
} from "./excerpt";

describe("excerpt (L4 Math Engine)", () => {
  describe("stripImages", () => {
    it("menghapus shortcode gambar {{img:...}}", () => {
      const input = "Perhatikan gambar {{img:grafik-1}} berikut.";
      expect(stripImages(input)).toBe("Perhatikan gambar  berikut.");
    });

    it("menghapus sintaks markdown ![]()", () => {
      const input = "Lihat diagram ![diagram](https://example.com/d.png) di bawah.";
      expect(stripImages(input)).toBe("Lihat diagram  di bawah.");
    });
  });

  describe("cleanMarkdownExcludingMath", () => {
    it("membersihkan markdown formatting di luar rumus tanpa merusak rumus", () => {
      const input = "# Judul Soal\n**Tentukan** nilai dari $x^2 + 1 = 0$ secara `tepat`.";
      const clean = cleanMarkdownExcludingMath(input);
      expect(clean).toContain("Judul Soal");
      expect(clean).toContain("Tentukan nilai dari $x^2 + 1 = 0$ secara tepat.");
      expect(clean).not.toContain("#");
      expect(clean).not.toContain("**");
      expect(clean).not.toContain("`");
    });
  });

  describe("excerpt", () => {
    it("tidak memotong teks pendek di bawah batas maksimum", () => {
      const text = "Tentukan nilai $x+y$.";
      expect(excerpt(text, 50)).toBe(text);
    });

    it("memotong teks panjang dengan elipsis", () => {
      const text = "Ini adalah soal matematika yang sangat panjang dan memerlukan pemecahan bertahap dengan kalkulus.";
      const res = excerpt(text, 30);
      expect(res.endsWith("…")).toBe(true);
      expect(res.length).toBeLessThanOrEqual(35);
    });

    it("tidak memotong di tengah delimiter rumus KaTeX", () => {
      const text = "Hitunglah nilai dari $\\int_0^1 x^2 dx$ dan laporkan hasilnya.";
      const res = excerpt(text, 35);
      // Rumus $\int_0^1 x^2 dx$ tidak boleh terbelah menjadi $\int_...
      if (res.includes("$")) {
        const matches = res.match(/\$/g) || [];
        expect(matches.length % 2).toBe(0);
      }
    });

    it("menyertakan rumus pertama utuh jika soal diawali rumus panjang", () => {
      const text = "$\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ tentukan determinan.";
      const res = excerpt(text, 20);
      expect(res.startsWith("$\\begin{pmatrix}")).toBe(true);
      expect(res.endsWith("…")).toBe(true);
    });
  });

  describe("flattenMathForList", () => {
    it("meratakan lingkungan matriks dan cases menjadi baris inline", () => {
      const input = "Matriks $\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ berikut.";
      const res = flattenMathForList(input);
      expect(res).not.toContain("\\begin{pmatrix}");
      expect(res).not.toContain("\\end{pmatrix}");
      expect(res).toContain(",\\; ");
    });

    it("membersihkan gambar sekaligus meratakan rumus", () => {
      const input = "Soal {{img:123}} dengan rumus $\\begin{cases} x=1 \\\\ y=2 \\end{cases}$.";
      const res = flattenMathForList(input);
      expect(res).not.toContain("{{img:123}}");
      expect(res).not.toContain("\\begin{cases}");
    });
  });

  describe("createMathSegmentRegex", () => {
    it("mendeteksi berbagai format delimiter matematika KaTeX", () => {
      const re = createMathSegmentRegex();
      const text = "Ada $a+b$, lalu $$x^2$$, dan \\[y=3\\].";
      const matches = [...text.matchAll(re)].map((m) => m[0]);
      expect(matches).toContain("$a+b$");
      expect(matches).toContain("$$x^2$$");
      expect(matches).toContain("\\[y=3\\]");
    });
  });
});
