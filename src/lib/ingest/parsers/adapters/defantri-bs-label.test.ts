/**
 * Tes regresi: artikel PAS/SAS bergaya BENAR-SALAH berlabel (`$(B)$ Benar`)
 * harus dikenali sebagai BS, BUKAN dihitung sebagai soal PG.
 *
 * Latar: gerbang jalur PG sempat salah menghitung BS berlabel sebagai PG
 * (temuan 2026-10-06) → 4 artikel PAS/SAS menghasilkan selisih.
 */
import { describe, expect, it } from "vitest";
import { defantriAdapter } from "./defantri";

/** Grup BS berlabel seperti sumber PAS/SAS. */
function bsGroup(name: string, stmt: string): string {
  return `<li>${stmt}<div class="question">
    <label><input type="radio" name="${name}" value="correct">$(B)\\ \\text{Benar}$</label>
    <label><input type="radio" name="${name}" value="false">$(S)\\ \\text{Salah}$</label>
  </div></li>`;
}

/** Grup PG biasa (5 opsi berlabel). */
function pgGroup(name: string, stem: string): string {
  const opts = ["A", "B", "C", "D", "E"]
    .map(
      (l) =>
        `<label><input type="radio" name="${name}" value="${l === "C" ? "correct" : "false"}">$(${l})$ pilihan ${l}</label>`,
    )
    .join("");
  return `<blockquote>${stem}<div class="question">${opts}</div></blockquote>`;
}

function article(): string {
  const bs = [1, 2, 3, 4, 5].map((i) => bsGroup(`q${30 + i}`, `Pernyataan nomor ${i}.`)).join("");
  // BS berada dalam SATU `<ul>` (bentuk sumber: ul pernyataan = satu soal).
  return `<h4>Soal</h4>
    <ul>${bs}</ul>
    ${[1, 2, 3].map((i) => pgGroup(`q${i}`, `Soal PG nomor ${i}.`)).join("")}`;
}

describe("defantri: BS berlabel vs PG", () => {
  it("mengubah grup BS berlabel menjadi SATU matrix_grid (ul = satu soal, li = pernyataan)", () => {
    const r = defantriAdapter(article(), { source: "defantri" });
    const mg = r.items.filter((it) => it.type === "matrix_grid");
    expect(mg.length).toBe(1);
    // 5 `<li>` pernyataan di dalam `<ul>` itu.
    const rows = (mg[0]!.dataPayload as { rows?: unknown[] }).rows ?? [];
    expect(rows.length).toBe(5);
  });

  it("soal PG tetap terbaca sebagai single_choice (bukan terserap BS)", () => {
    const r = defantriAdapter(article(), { source: "defantri" });
    const pg = r.items.filter((it) => it.type === "single_choice");
    expect(pg.length).toBe(3);
    expect(pg.every((it) => it.options.length === 5)).toBe(true);
  });

  it("tak ada item stimulus pada artikel non-wacana", () => {
    const r = defantriAdapter(article(), { source: "defantri" });
    expect(r.items.some((it) => it.type === "stimulus")).toBe(false);
  });
});
