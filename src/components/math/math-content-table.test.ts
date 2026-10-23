import { describe, it, expect } from "vitest";
import { tokenizeMath, splitTableBlocks } from "@/lib/math/tokenize";

/**
 * Dukungan tabel markdown GFM (pipe table) di MathContent.
 *
 * Tabel harus dikenali sebagai token `table` (bukan teks mentah), termasuk:
 *  - bentuk dengan pipe pembuka/penutup (`| a | b |`) maupun tanpa (`a | b`),
 *  - penjajaran dari baris pemisah (`:--`, `:-:`, `--:`),
 *  - sel yang memuat rumus (`$...$`) — inti: tabel harus dideteksi SEBELUM rumus
 *    dipisah, agar sel tidak terpotong.
 */
describe("splitTableBlocks — deteksi blok tabel", () => {
  it("mengenali tabel dengan pipe pembuka & penutup", () => {
    const segs = splitTableBlocks(
      "Sebelum\n| A | B |\n| --- | --- |\n| 1 | 2 |\nSesudah",
    );
    const tables = segs.filter((s) => s.kind === "table");
    expect(tables).toHaveLength(1);
    if (tables[0]!.kind === "table") {
      expect(tables[0]!.token.header).toEqual(["A", "B"]);
      expect(tables[0]!.token.rows).toEqual([["1", "2"]]);
    }
  });

  it("mengenali tabel tanpa pipe pembuka/penutup", () => {
    const segs = splitTableBlocks("A | B\n--- | ---\n1 | 2");
    const tables = segs.filter((s) => s.kind === "table");
    expect(tables).toHaveLength(1);
  });

  it("membaca penjajaran kolom dari baris pemisah", () => {
    const segs = splitTableBlocks("| L | C | R |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |");
    const t = segs.find((s) => s.kind === "table");
    expect(t && t.kind === "table" ? t.token.align : null).toEqual(["left", "center", "right"]);
  });

  it("menerima beberapa baris data", () => {
    const segs = splitTableBlocks("| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
    const t = segs.find((s) => s.kind === "table");
    expect(t && t.kind === "table" ? t.token.rows : []).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("teks tanpa tabel → satu segmen teks", () => {
    const segs = splitTableBlocks("Halo $x$ dunia");
    expect(segs).toHaveLength(1);
    expect(segs[0]!.kind).toBe("text");
  });

  it("pipe tanpa baris pemisah BUKAN tabel (mis. nilai mutlak)", () => {
    const segs = splitTableBlocks("Nilai |x| adalah 3\ndan baris lain");
    expect(segs.every((s) => s.kind === "text")).toBe(true);
  });
});

describe("tokenizeMath — tabel dengan rumus di dalam sel", () => {
  it("menghasilkan token table (bukan teks mentah)", () => {
    const tokens = tokenizeMath("| Tinggi | Frek |\n| --- | --- |\n| 160 | 3 |");
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.kind).toBe("table");
  });

  it("sel boleh memuat rumus — tabel tetap utuh & rumus terjaga", () => {
    const tokens = tokenizeMath("| Nilai | Ket |\n| --- | --- |\n| $x^2$ | kuadrat |");
    const t = tokens.find((x) => x.kind === "table");
    expect(t).toBeDefined();
    if (t && t.kind === "table") {
      // Sel berisi rumus mentah yang nanti ditokenisasi ulang saat render.
      expect(t.rows[0]![0]).toBe("$x^2$");
      expect(t.rows[0]![1]).toBe("kuadrat");
    }
  });

  it("tabel di antara teks menghasilkan urutan teks → tabel → teks", () => {
    const tokens = tokenizeMath(
      "Data berikut:\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nSelesai.",
    );
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toContain("table");
    expect(kinds.indexOf("table")).toBeGreaterThan(0);
    expect(kinds.indexOf("table")).toBeLessThan(kinds.length - 1);
  });
});
