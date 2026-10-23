/**
 * Tes deteksi WACANA defantri (`defantri-wacana.ts`).
 *
 * Kasus diambil dari korpus nyata:
 *   - `2024-09-soal-penalaran-matematika` → wacana asli (5 sub-soal, radio beda)
 *   - 4 artikel lain → false positive (penomoran persamaan / radio sama)
 */
import { describe, expect, it } from "vitest";
import { detectWacana, extractWacanaBefore, stripSubNumber } from "./defantri-wacana";

/** Bangun HTML ringkas bergaya sumber. */
function buildArticle(opts: {
  wacana: string;
  subs: { n: number; radio: string; text: string }[];
}): string {
  const blocks = opts.subs
    .map(
      (s) =>
        `<blockquote>$\\left( ${s.n} \\right).$ ${s.text}\n` +
        `<div class="question"><label><input type="radio" name="${s.radio}" value="A">A</label></div>` +
        `</blockquote>`,
    )
    .join("\n");
  return `<p>${opts.wacana}</p>\n${blocks}`;
}

const WACANA_ASLI =
  "Calon Guru belajar matematika dasar dari Soal Penalaran Matematika UTBK SNBT. " +
  "Sebuah gergaji mesin mempunyai komponen utama berupa batang penggerak dan roda penggerak. " +
  "Diketahui panjang batang penggerak adalah 500 mm dan jari-jari roda penggerak adalah 100 mm.";

describe("stripSubNumber", () => {
  it("membuang penanda nomor di depan stem (bentuk nyata sumber)", () => {
    const stem = "\\(\\left( 1 \\right).\\) Jika pada saat gergaji mesin bekerja \\(\\theta = 0^{\\circ}\\)";
    expect(stripSubNumber(stem).startsWith("Jika pada saat gergaji")).toBe(true);
  });

  it("membuang varian tanpa titik & dengan spasi", () => {
    expect(stripSubNumber("\\(\\left( 12 \\right)\\) Soal berikutnya")).toBe("Soal berikutnya");
    expect(stripSubNumber("\\(\\left( 3 \\right).\\)   Soal")).toBe("Soal");
  });

  it("membuang bentuk ringkas \\((4)\\)", () => {
    expect(stripSubNumber("\\((4)\\) Soal keempat")).toBe("Soal keempat");
  });

  it("TIDAK menyentuh nomor di tengah stem", () => {
    const stem = "Diberikan \\(\\left( 1 \\right)\\) sebagai notasi, tentukan nilai.";
    expect(stripSubNumber(stem)).toBe(stem);
  });

  it("tidak mengubah stem yang tak berpenanda", () => {
    expect(stripSubNumber("Hitung nilai \\(x\\).")).toBe("Hitung nilai \\(x\\).");
  });
});

describe("detectWacana", () => {
  it("mendeteksi wacana asli (5 sub-soal, tiap nomor radio berbeda)", () => {
    const html = buildArticle({
      wacana: WACANA_ASLI,
      subs: [1, 2, 3, 4, 5].map((n) => ({
        n,
        radio: `q${n}`,
        text: `Jika pada saat gergaji mesin bekerja, maka jarak titik ke-${n} adalah ...`,
      })),
    });
    const w = detectWacana(html);
    expect(w).not.toBeNull();
    expect(w!.subs).toHaveLength(5);
    expect(w!.subs.map((s) => s.radio)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
    expect(w!.wacana).toContain("gergaji mesin");
  });

  it("MENOLAK penomoran persamaan (radio sama) — temuan korpus", () => {
    // `\cdots \left( 1 \right)` … `\left( 2 \right)` menunjuk radio yang SAMA.
    const html = `
      <p>${WACANA_ASLI}</p>
      <p>Dari hasil di atas kita peroleh $\\cdots \\left( 1 \\right)$ dan seterusnya
      $\\cdots \\left( 2 \\right)$ sehingga selesai.</p>
      <blockquote>Soal asli.<div class="question">
        <input type="radio" name="q17" value="A">A</label></div></blockquote>`;
    expect(detectWacana(html)).toBeNull();
  });

  it("MENOLAK bila penanda tanpa radio", () => {
    const html = `
      <p>${WACANA_ASLI}</p>
      <p>Kita tulis $\\left( 1 \\right)$ lalu $\\left( 2 \\right)$ sebagai penomoran.</p>`;
    expect(detectWacana(html)).toBeNull();
  });

  it("MENOLAK rangkaian yang mulai dari nomor selain 1", () => {
    const html = buildArticle({
      wacana: WACANA_ASLI,
      subs: [
        { n: 2, radio: "q2", text: "soal dua" },
        { n: 3, radio: "q3", text: "soal tiga" },
      ],
    });
    expect(detectWacana(html)).toBeNull();
  });

  it("MENOLAK bila hanya 1 sub-soal", () => {
    const html = buildArticle({
      wacana: WACANA_ASLI,
      subs: [{ n: 1, radio: "q1", text: "soal satu" }],
    });
    expect(detectWacana(html)).toBeNull();
  });

  it("mengabaikan sub-soal sisipan bernomor lompat (tetap ambil yang berurutan)", () => {
    const html = buildArticle({
      wacana: WACANA_ASLI,
      subs: [
        { n: 1, radio: "q1", text: "satu" },
        { n: 2, radio: "q2", text: "dua" },
        { n: 7, radio: "q7", text: "lompat" },
      ],
    });
    const w = detectWacana(html);
    expect(w).not.toBeNull();
    expect(w!.subs.map((s) => s.n)).toEqual([1, 2]);
  });
});

describe("extractWacanaBefore", () => {
  it("mengambil paragraf prosa sebelum penanda pertama", () => {
    const html = `<p>Paragraf pendek.</p><p>${WACANA_ASLI}</p><blockquote>$\\left( 1 \\right).$ soal</blockquote>`;
    const idx = html.indexOf("\\left( 1 \\right)");
    const w = extractWacanaBefore(html, idx);
    expect(w.text).toContain("gergaji mesin");
    expect(w.text).not.toContain("Paragraf pendek");
  });

  it("mengembalikan kosong bila tak ada paragraf prosa", () => {
    const html = `<nav>menu</nav><blockquote>$\\left( 1 \\right).$ soal</blockquote>`;
    const idx = html.indexOf("\\left( 1 \\right)");
    expect(extractWacanaBefore(html, idx).text).toBe("");
  });
});
