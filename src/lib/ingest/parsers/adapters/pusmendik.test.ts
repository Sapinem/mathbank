import { describe, it, expect } from "vitest";
import { segmentJson, segmentArticle } from "../segment";
import { pusmendikDayaserapAdapter } from "./pusmendik-dayaserap";
import { pusmendikTkaAdapter } from "./pusmendik-tka";

// ── Fixture: dayaserap (JSON terstruktur) ──────────────────
const DAYASERAP = {
  questions: [
    {
      question_data: {
        nomor_soal: 1,
        kode_soal: "K1",
        pertanyaan: "<p>Berapa $2+3$?</p>",
        tipe_soal: "Pilihan Ganda",
        pilihan: [
          { key: "A", text: "<p>4</p>" },
          { key: "B", text: "<p>5</p>" },
        ],
        kunci_jawaban: [],
        pembahasan: "<p>Jumlahnya 5.</p>",
      },
    },
    {
      question_data: {
        nomor_soal: 2,
        tipe_soal: "Pilihan Ganda Kompleks - MCMA",
        pertanyaan: "<p>Pilih yang benar</p>",
        pilihan: [
          { key: "A", text: "<p>satu</p>" },
          { key: "B", text: "<p>dua</p>" },
          { key: "C", text: "<p>tiga</p>" },
        ],
        kunci_jawaban: null,
      },
    },
    {
      question_data: {
        nomor_soal: 3,
        tipe_soal: "Pilihan Ganda Kompleks - Kategori",
        pertanyaan: "<p>Tentukan Benar/Salah</p>",
        pernyataan: [
          { id: 1, text: "<p>2+2=4</p>", jawaban: "" },
          { id: 2, text: "<p>2+2=5</p>", jawaban: "" },
        ],
        labels_query: [
          { order_soal: 1, description: "Benar" },
          { order_soal: 2, description: "Salah" },
        ],
      },
    },
  ],
};

describe("adapter pusmendik_dayaserap (JSON)", () => {
  it("memetakan 3 tipe: PG → single_choice, MCMA → checkbox, Kategori → matrix_grid", () => {
    const r = segmentJson(DAYASERAP, { source: "pusmendik_dayaserap" });
    expect(r.items).toHaveLength(3);
    expect(r.items[0]!.type).toBe("single_choice");
    expect(r.items[1]!.type).toBe("multiple_choice_checkbox");
    expect(r.items[2]!.type).toBe("matrix_grid");
  });

  it("KUNCI selalu kosong (sumber tak punya) + catatan", () => {
    const r = segmentJson(DAYASERAP, { source: "pusmendik_dayaserap" });
    expect(r.items[0]!.correct).toEqual([]);
    expect(r.items[0]!.warnings.some((w) => w.includes("Kunci"))).toBe(true);
  });

  it("matrix_grid membawa dataPayload {labels, rows}", () => {
    const it = segmentJson(DAYASERAP, { source: "pusmendik_dayaserap" }).items[2]!;
    const p = it.dataPayload as { labels: string[]; rows: { text: string; answer: string | null }[] };
    expect(p.labels).toEqual(["Benar", "Salah"]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]!.answer).toBeNull();
  });

  it("kunci_jawaban sebagai array dihormati bila ada", () => {
    const d = {
      questions: [{
        question_data: {
          pertanyaan: "<p>x</p>", tipe_soal: "Pilihan Ganda",
          pilihan: [{ key: "A", text: "a" }, { key: "B", text: "b" }],
          kunci_jawaban: ["B"],
        },
      }],
    };
    const it = segmentJson(d, { source: "pusmendik_dayaserap" }).items[0]!;
    expect(it.correct).toEqual(["B"]);
    expect(it.options[1]!.isCorrect).toBe(true);
  });

  it("bukan JSON dayaserap → kosong + catatan", () => {
    const r = pusmendikDayaserapAdapter({ foo: 1 }, { source: "pusmendik_dayaserap" });
    expect(r.items).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

// ── Fixture: tka (HTML) ────────────────────────────────────
const TKA = `
<div class="soal-soal row" id="soal-no-1">
  <div class="col-lg-6 cont-soal"><p>&nbsp;</p></div>
  <div class="col-lg-6 isi-soal">
    <p><img src="/tka/cbt_images/SOAL.png" data-latex="2+3"></p>
    <!-- PG -->
    <table><tr>
      <td><div class="radio icheck-primary"><input pil="a" name="pilihan1" type="radio"></div></td>
      <td><p><img src="/tka/cbt_images/OPT_A.png"></p></td>
    </tr><tr>
      <td><div class="radio icheck-primary"><input pil="b" name="pilihan1" type="radio"></div></td>
      <td><p><img src="/tka/cbt_images/OPT_B.png"></p></td>
    </tr></table>
  </div>
</div>`;

describe("adapter pusmendik_tka (HTML)", () => {
  it("stem = gambar soal; opsi dari <td> setelah radio (huruf dari pil)", () => {
    const r = segmentArticle(TKA, { source: "pusmendik_tka", url: "https://pusmendik.kemendikdasmen.go.id/tka/" });
    expect(r.items).toHaveLength(1);
    const it = r.items[0]!;
    expect(it.type).toBe("single_choice");
    expect(it.stem).toContain("SOAL.png");
    expect(it.options.map((o) => o.label)).toEqual(["A", "B"]);
    expect(it.options[0]!.text).toContain("OPT_A.png");
    expect(it.options[1]!.text).toContain("OPT_B.png");
  });

  it("KUNCI kosong + catatan (TKA tanpa kunci di HTML)", () => {
    const it = segmentArticle(TKA, { source: "pusmendik_tka" }).items[0]!;
    expect(it.correct).toEqual([]);
    expect(it.warnings.some((w) => w.includes("kunci"))).toBe(true);
  });

  it("bukan halaman TKA → kosong + catatan", () => {
    const r = pusmendikTkaAdapter("<p>artikel</p>", { source: "pusmendik_tka" });
    expect(r.items).toHaveLength(0);
  });
});
