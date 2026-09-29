import { describe, it, expect } from "vitest";
import {
  rrfFuse,
  similarity,
  dedup,
  hybridSearch,
  RRF_K,
} from "./fusion";

describe("similarity — Jaccard token", () => {
  it("identik → 1", () => {
    expect(similarity("hitung nilai x", "hitung nilai x")).toBe(1);
  });
  it("tanpa irisan → 0", () => {
    expect(similarity("apel jeruk", "meja kursi")).toBe(0);
  });
  it("sebagian → antara 0 & 1", () => {
    const s = similarity("hitung nilai x", "hitung nilai y");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it("kosong → 0", () => {
    expect(similarity("", "x")).toBe(0);
    expect(similarity(undefined, "x")).toBe(0);
  });
});

describe("rrfFuse — Reciprocal Rank Fusion", () => {
  it("menggabungkan & menaikkan dokumen yang muncul di banyak daftar", () => {
    const fused = rrfFuse([
      [{ id: "a" }, { id: "b" }],
      [{ id: "b" }, { id: "c" }],
    ]);
    // b muncul di kedua daftar → skor tertinggi.
    expect(fused[0].id).toBe("b");
    const ids = fused.map((f) => f.id);
    expect(ids).toContain("a");
    expect(ids).toContain("c");
  });

  it("skor mengikuti rumus 1/(k+rank+1)", () => {
    const fused = rrfFuse([[{ id: "x" }]]);
    expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 1), 10);
  });

  it("memakai `rank` eksplisit bila ada", () => {
    const fused = rrfFuse([[{ id: "x", rank: 5 }]]);
    expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 6), 10);
  });
});

describe("dedup — buang duplikat", () => {
  const lookup = (id: string) =>
    ({
      a: "hitung nilai x dari persamaan",
      b: "hitung nilai x dari persamaan", // identik dengan a
      c: "tentukan luas lingkaran",
      d: "hitung nilai x dari persamaa", // nyaris identik
    })[id];

  it("membuang duplikat praktis identik (≥0.98)", () => {
    const out = dedup(
      [
        { id: "a", score: 2 },
        { id: "b", score: 1 },
      ],
      lookup,
    );
    expect(out.map((o) => o.id)).toEqual(["a"]);
  });

  it("menyimpan yang berbeda", () => {
    const out = dedup(
      [
        { id: "a", score: 2 },
        { id: "c", score: 1 },
      ],
      lookup,
    );
    expect(out.map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("tidak membuang yang mirip tapi jauh (di bawah ambang)", () => {
    const out = dedup(
      [
        { id: "c", score: 2 },
        { id: "d", score: 1 },
      ],
      lookup,
    );
    expect(out).toHaveLength(2);
  });
});

describe("hybridSearch — pipeline", () => {
  it("menggabungkan dua sumber lalu dedup", () => {
    const texts: Record<string, string> = {
      a: "soal limit fungsi",
      b: "soal limit fungsi",
      c: "soal matriks",
    };
    const out = hybridSearch(
      [
        [{ id: "a" }, { id: "c" }],
        [{ id: "b" }, { id: "c" }],
      ],
      (id) => texts[id],
    );
    // c muncul di dua daftar (skor tinggi) & unik; a/b duplikat → salah satu dibuang.
    expect(out.map((o) => o.id)).toContain("c");
    expect(out).toHaveLength(2);
  });
});
