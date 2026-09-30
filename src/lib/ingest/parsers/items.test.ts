import { describe, it, expect } from "vitest";
import { finalizeItem, labelFor, mergeResults } from "./items";

/**
 * Tes aturan mutu item (M9) — fokus cabang yang belum tersentuh:
 * labelFor fallback, opsi<2, opsi 2–3, kunci tak cocok, dataPayload, merge.
 */

describe("labelFor", () => {
  it("0→A, 1→B, …", () => {
    expect(labelFor(0)).toBe("A");
    expect(labelFor(1)).toBe("B");
    expect(labelFor(7)).toBe("H");
  });

  it("di luar A–H → pakai angka (index+1)", () => {
    expect(labelFor(8)).toBe("9");
    expect(labelFor(20)).toBe("21");
  });
});

describe("finalizeItem", () => {
  const ref = { index: 0 };

  it("≥2 opsi → single_choice; label otomatis bila kosong", () => {
    const it = finalizeItem("Berapa $1+1$?", [{ text: "1" }, { text: "2" }], [], undefined, ref);
    expect(it.type).toBe("single_choice");
    expect(it.options.map((o) => o.label)).toEqual(["A", "B"]);
  });

  it("< 2 opsi → essay (opsi dibuang)", () => {
    const it = finalizeItem("Jelaskan.", [{ text: "uraian" }], [], undefined, ref);
    expect(it.type).toBe("essay");
    expect(it.options).toEqual([]);
  });

  it("opsi kosong (hampa) disaring", () => {
    const it = finalizeItem("Pilih.", [{ text: "A" }, { text: "   " }, { text: "C" }], [], undefined, ref);
    expect(it.options).toHaveLength(2);
  });

  it("2–3 opsi → peringatan 'opsi hanya N'", () => {
    const it = finalizeItem("Pilih.", [{ text: "1" }, { text: "2" }], [], undefined, ref);
    expect(it.warnings.join(" ")).toMatch(/opsi hanya 2/i);
  });

  it("1 opsi → warning essay + tipe essay", () => {
    const it = finalizeItem("Pilih.", [{ text: "satu" }], [], undefined, ref);
    expect(it.warnings.join(" ")).toMatch(/1 opsi/i);
  });

  it("kunci cocok → isCorrect ditandai", () => {
    const it = finalizeItem(
      "Pilih.",
      [{ text: "1" }, { text: "2" }],
      ["b"],
      undefined,
      ref,
    );
    expect(it.correct).toEqual(["B"]);
    expect(it.options.find((o) => o.label === "B")?.isCorrect).toBe(true);
  });

  it("kunci TAK cocok → kosong + peringatan (jangan menebak)", () => {
    const it = finalizeItem("Pilih.", [{ text: "1" }, { text: "2" }], ["Z"], undefined, ref);
    expect(it.correct).toEqual([]);
    expect(it.warnings.join(" ")).toMatch(/kunci jawaban tidak ditemukan/i);
  });

  it("type dipaksa via opts (mis. matrix_grid) + dataPayload disertakan", () => {
    const it = finalizeItem("Matriks.", [], [], undefined, ref, [], {
      type: "matrix_grid",
      dataPayload: { rows: 2, cols: 2 },
    });
    expect(it.type).toBe("matrix_grid");
    expect(it.dataPayload).toEqual({ rows: 2, cols: 2 });
  });

  it("explanation terisi → ikut; kosong → undefined", () => {
    const a = finalizeItem("S.", [{ text: "1" }, { text: "2" }], [], "  alas  ", ref);
    expect(a.explanation).toBe("alas");
    const b = finalizeItem("S.", [{ text: "1" }, { text: "2" }], [], "   ", ref);
    expect(b.explanation).toBeUndefined();
  });
});

describe("mergeResults", () => {
  it("menggabungkan items, menjumlah skipped, menyatukan warnings", () => {
    const r = mergeResults([
      { items: [{ stem: "a" } as never], skipped: 1, warnings: ["w1"] },
      { items: [{ stem: "b" } as never, { stem: "c" } as never], skipped: 2, warnings: ["w2"] },
    ]);
    expect(r.items).toHaveLength(3);
    expect(r.skipped).toBe(3);
    expect(r.warnings).toEqual(["w1", "w2"]);
  });

  it("daftar kosong → hasil kosong", () => {
    expect(mergeResults([])).toEqual({ items: [], skipped: 0, warnings: [] });
  });
});
