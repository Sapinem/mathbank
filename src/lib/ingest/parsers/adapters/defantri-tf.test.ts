/**
 * Tes adapter defantri — BENAR-SALAH (`matrix_grid`).
 *
 * Bentuk sumber (terverifikasi di 3+ artikel TKA):
 *   <h4>2. Soal …</h4>
 *   <blockquote>…stem… (termasuk <ul> info)…
 *     <ul>                                   ← UL PERNYATAAN = satu soal
 *       <li>pernyataan 1 <div class="question">radio q201 (Benar/Salah)</div></li>
 *       <li>pernyataan 2 <div class="question">radio q202 …</div></li>
 *       <li>pernyataan 3 <div class="question">radio q203 …</div></li>
 *     </ul>
 *   </blockquote>
 */
import { describe, expect, it } from "vitest";
import { defantriAdapter } from "./defantri";

const BS_SOAL = `<h4>2. Soal TO TKA Matematika SMP/MTs</h4>
<blockquote>Dalam sebuah game, pemain menembak papan angka $1..9$.
Berdasarkan informasi di atas, tentukan apakah setiap pernyataan berikut Benar atau Salah.
<ul>
<li>Jika menembak angka $7$, poinnya $400$.<div class="question"><div style="left">
<button><label><input type="radio" name="q201" value="correct">$\\text{Benar}$</label></button>
<button><label><input type="radio" name="q201" value="corect">$\\text{Salah}$</label></button>
</div></div></li>
<li>Pemain tidak akan pernah dapat poin ganjil.<div class="question"><div style="left">
<button><label><input type="radio" name="q202" value="corect">$\\text{Benar}$</label></button>
<button><label><input type="radio" name="q202" value="correct">$\\text{Salah}$</label></button>
</div></div></li>
<li>Menembak angka $5$ memberi $300$ poin.<div class="question"><div style="left">
<button><label><input type="radio" name="q203" value="correct">$\\text{Benar}$</label></button>
<button><label><input type="radio" name="q203" value="corect">$\\text{Salah}$</label></button>
</div></div></li>
</ul></blockquote>`;

describe("benar-salah → matrix_grid", () => {
  it("satu <ul> pernyataan → SATU soal matrix_grid (bukan 3 soal)", () => {
    const r = defantriAdapter(BS_SOAL, { source: "defantri" });
    expect(r.items).toHaveLength(1);
    const it = r.items[0]!;
    expect(it.type).toBe("matrix_grid");
    expect(it.stem).toContain("Benar atau Salah");
    expect(it.options).toHaveLength(0);
  });

  it("rows berisi 3 pernyataan + kunci Benar/Salah/null", () => {
    const it = defantriAdapter(BS_SOAL, { source: "defantri" }).items[0]!;
    const dp = it.dataPayload as {
      labels: string[];
      rows: { text: string; answer: string | null }[];
    };
    expect(dp.labels).toEqual(["Benar", "Salah"]);
    expect(dp.rows).toHaveLength(3);
    expect(dp.rows[0]!.text).toContain("menembak angka");
    expect(dp.rows[0]!.answer).toBe("Benar"); // q201 Benar=correct
    expect(dp.rows[1]!.answer).toBe("Salah"); // q202 Salah=correct
    expect(dp.rows[2]!.answer).toBe("Benar"); // q203 Benar=correct
  });

  it("BS + PG dalam satu artikel → terpisah benar", () => {
    const html = `${BS_SOAL}
      <h4>3. Soal PG</h4><blockquote>Berapa $1+1$?<div class="question">
        <label><input type="radio" name="q3" value="correct">$(A)$ 2</label>
        <label><input type="radio" name="q3" value="corect">$(B)$ 3</label>
      </div></blockquote>`;
    const r = defantriAdapter(html, { source: "defantri" });
    expect(r.items).toHaveLength(2);
    expect(r.items[0]!.type).toBe("matrix_grid");
    expect(r.items[1]!.type).toBe("single_choice");
    expect(r.items[1]!.correct).toEqual(["A"]);
  });

  it("grup BS 2 opsi 'True'/'False' (bhs. Inggris) juga dikenali", () => {
    const html = `<h4>1. Soal</h4><blockquote>Decide True or False.
      <ul><li>The sum is $4$.<div class="question">
        <label><input type="radio" name="q101" value="correct">$\\text{True}$</label>
        <label><input type="radio" name="q101" value="corect">$\\text{False}$</label>
      </div></li></ul></blockquote>`;
    const it = defantriAdapter(html, { source: "defantri" }).items[0]!;
    expect(it.type).toBe("matrix_grid");
    const dp = it.dataPayload as { rows: { answer: string | null }[] };
    expect(dp.rows[0]!.answer).toBe("Benar");
  });

  it("soal BS tanpa kunci → tetap masuk, ditandai perlu telaah", () => {
    const html = `<blockquote>Tentukan Benar atau Salah.
      <ul><li>Pernyataan tanpa kunci.<div class="question">
        <label><input type="radio" name="q101" value="corect">Benar</label>
        <label><input type="radio" name="q101" value="corect">Salah</label>
      </div></li></ul></blockquote>`;
    const r = defantriAdapter(html, { source: "defantri" });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.warnings.join(" ")).toMatch(/telaah|kunci/i);
  });
});
