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

  // ── Zona "near" (0.85–0.98): duplikat HANYA bila penalaran SAMA ──
  // "hitung nilai x dari persamaan" (5 token) vs "…persamaan lengkap" (6 token)
  // → 5/6 ≈ 0.833 < 0.85. Pakai varian 6 vs 7 token agar ≈0.857 (di zona near).
  const nearLookup = (id: string) =>
    ({
      p: "hitung nilai x dari persamaan kuadrat berikut",
      q: "hitung nilai x dari persamaan kuadrat berikut ini",
    })[id];

  it("zona near + penalaran SAMA → dibuang", () => {
    const s = similarity(nearLookup("p"), nearLookup("q"));
    expect(s).toBeGreaterThanOrEqual(0.85);
    expect(s).toBeLessThan(0.98);
    const out = dedup(
      [
        { id: "p", score: 2 },
        { id: "q", score: 1 },
      ],
      nearLookup,
      { lookupReasoning: () => "x=2" },
    );
    expect(out.map((o) => o.id)).toEqual(["p"]);
  });

  it("zona near + penalaran BEDA → keduanya DIPERTAHANKAN", () => {
    const reasons: Record<string, string> = { p: "x=2", q: "x=-3" };
    const out = dedup(
      [
        { id: "p", score: 2 },
        { id: "q", score: 1 },
      ],
      nearLookup,
      { lookupReasoning: (id) => reasons[id] },
    );
    expect(out.map((o) => o.id)).toEqual(["p", "q"]);
  });

  it("zona near + keduanya tanpa penalaran → dibuang (dianggap sama)", () => {
    const out = dedup(
      [
        { id: "p", score: 2 },
        { id: "q", score: 1 },
      ],
      nearLookup,
    );
    expect(out.map((o) => o.id)).toEqual(["p"]);
  });

  it("≥ exact tetap duplikat walau penalaran BEDA", () => {
    const reasons: Record<string, string> = { a: "x=1", b: "x=9" };
    const out = dedup(
      [
        { id: "a", score: 2 },
        { id: "b", score: 1 },
      ],
      lookup, // a & b identik → similarity 1 ≥ exact
      { lookupReasoning: (id) => reasons[id] },
    );
    expect(out.map((o) => o.id)).toEqual(["a"]);
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

  it("meneruskan lookupReasoning (near + beda penalaran → tetap dua)", () => {
    const texts: Record<string, string> = {
      a: "hitung nilai x dari persamaan kuadrat berikut",
      b: "hitung nilai x dari persamaan kuadrat berikut ini",
    };
    const reasons: Record<string, string> = { a: "x=1", b: "x=2" };
    const out = hybridSearch([[{ id: "a" }, { id: "b" }]], (id) => texts[id], {
      lookupReasoning: (id) => reasons[id],
    });
    expect(out.map((o) => o.id)).toEqual(["a", "b"]);
  });
});
