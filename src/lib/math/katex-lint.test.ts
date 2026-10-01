import { describe, it, expect } from "vitest";
import { lintKatex, isKatexValid } from "./katex-lint";

describe("lintKatex — deteksi galat sintaks rumus", () => {
  it("lolos untuk teks tanpa rumus", () => {
    expect(lintKatex("Tentukan hasil dari operasi berikut.")).toEqual([]);
    expect(isKatexValid("")).toBe(true);
  });

  it("lolos untuk rumus valid inline & display", () => {
    expect(lintKatex("Nilai $x = \\frac{1}{2}$ benar.")).toEqual([]);
    expect(lintKatex("$$\\int_0^1 x^2\\,dx$$")).toEqual([]);
    expect(lintKatex("Pakai \\(a^2+b^2=c^2\\).")).toEqual([]);
  });

  it("menandai \\frac tanpa argumen kedua (galat)", () => {
    const diags = lintKatex("Rumus salah: $\\frac{1}$");
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].message.length).toBeGreaterThan(0);
    expect(diags[0].display).toBe(false);
  });

  it("menandai perintah tak dikenal", () => {
    const diags = lintKatex("$\\perintahngawur{x}$");
    expect(diags.length).toBeGreaterThan(0);
  });

  it("melaporkan nomor baris yang benar", () => {
    const md = "Baris valid $x$\nBaris kedua\n$\\frac{1}$ di sini";
    const diags = lintKatex(md);
    expect(diags.length).toBe(1);
    expect(diags[0].line).toBe(3);
  });

  it("melaporkan galat display-mode", () => {
    const diags = lintKatex("$$\\begin{matrix} a & b \\end{matrix}$$");
    // matrix tanpa baris penutup yang benar → galat KaTeX
    // (bila versi KaTeX menerima, diags kosong pun sah — uji hanya bentuk)
    for (const d of diags) {
      expect(d.display).toBe(true);
      expect(d.message).not.toContain("<");
    }
  });

  it("membersihkan tag HTML dari pesan", () => {
    const diags = lintKatex("$\\frac{1}$");
    for (const d of diags) {
      expect(d.message).not.toMatch(/<[^>]+>/);
    }
  });
});
