import { describe, expect, it } from "vitest";
import { perbaikanKhususMathcyber } from "./mathcyber-khusus";

/**
 * Modul ini menulis-ulang teks soal secara DESTRUKTIF (regex). Tanpa invariant,
 * satu pola baru bisa merusak ribuan butir tanpa ketahuan — karena hasilnya
 * tetap "teks", bukan error. Kontrak yang diuji:
 *   1. Teks tanpa pola yang disasar → identik (tidak menyentuh apa pun).
 *   2. Idempoten — menjalankan dua kali = sekali (pipeline bisa mengulang).
 *   3. Tiap pola hanya membuang sasarannya, bukan isi soal.
 */
const CONTOH = [
  "Tentukan nilai $x$ dari persamaan $x^2-4=0$.",
  "Hitunglah \\(\\frac{1}{2} + \\frac{1}{3}\\).",
  "$$\\int_0^1 x\\,dx = \\frac{1}{2}$$",
  "Tanpa matematika sama sekali.",
  "a <span class=\"katex\">b</span> c",
  "nilai }$ x",
  "\\(lihat tabel\\) berikut",
];

describe("perbaikanKhususMathcyber — invariant", () => {
  it("idempoten pada setiap contoh", () => {
    for (const s of CONTOH) {
      const sekali = perbaikanKhususMathcyber(s);
      expect(perbaikanKhususMathcyber(sekali)).toBe(sekali);
    }
  });

  it("teks normal dilewatkan apa adanya", () => {
    const normal = "Tentukan nilai $x$ dari persamaan $x^2-4=0$.";
    expect(perbaikanKhususMathcyber(normal)).toBe(normal);
    expect(perbaikanKhususMathcyber("Tanpa matematika sama sekali.")).toBe(
      "Tanpa matematika sama sekali.",
    );
  });

  it("display $$…$$ tidak dianggap dolar nyasar", () => {
    const display = "$$x^2$$";
    expect(perbaikanKhususMathcyber(display)).toBe(display);
  });

  it("span bocor dibuang, isi soal tetap", () => {
    const out = perbaikanKhususMathcyber('a <span class="katex">b</span> c');
    expect(out).not.toContain("<span");
    expect(out).toContain("a");
    expect(out).toContain("b");
    expect(out).toContain("c");
  });

  it("dolar nyasar tunggal dibuang", () => {
    expect(perbaikanKhususMathcyber("nilai }$ x")).toBe("nilai } x");
  });

  it("pembungkus pemisah inline dibuka, isinya utuh", () => {
    expect(perbaikanKhususMathcyber("\\(lihat tabel\\) berikut")).toBe(
      "lihat tabel berikut",
    );
  });
});
