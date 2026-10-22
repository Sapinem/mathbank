import { describe, it, expect } from "vitest";
import {
  buildQuestionPayload,
  MISSING_EXPLANATION_PLACEHOLDER,
  MISSING_RUBRIC_PLACEHOLDER,
  type ParsedItem,
} from "../types";
import { answerKeySchema, questionDataPayloadSchema } from "@/lib/validations/question-payload";
import { defantriAdapter } from "./defantri";
import { m4thlabAdapter } from "./m4thlab";
import { mathcyberAdapter } from "./mathcyber";

/**
 * MAT-147 — kontrak `ParsedItem` → `data_payload` + `answer_key` kanonik.
 *
 * Membuktikan bahwa keluaran adapter dapat diterjemahkan **tanpa DB** menjadi
 * bentuk yang langsung lolos `questionDataPayloadSchema` / `answerKeySchema`
 * (Single Table + Hybrid JSONB, MAT-144/MAT-146), dan bahwa pelanggaran skema
 * terdeteksi sebagai penolakan — bukan crash.
 */

function baseItem(over: Partial<ParsedItem> = {}): ParsedItem {
  return {
    type: "single_choice",
    stem: "Berapa $1+1$?",
    options: [
      { label: "A", text: "1", isCorrect: false },
      { label: "B", text: "2", isCorrect: true },
    ],
    correct: ["B"],
    explanation: "Karena $1+1=2$, jawabannya B.",
    warnings: [],
    ref: { index: 1 },
    ...over,
  };
}

/** Payload harus lolos kedua skema; mengembalikan hasil parse untuk diperiksa. */
function expectSchemaValid(item: ParsedItem) {
  const built = buildQuestionPayload(item);
  const data = questionDataPayloadSchema.safeParse(built.dataPayload);
  expect(data.success, JSON.stringify(data.error?.issues)).toBe(true);
  const key = answerKeySchema.safeParse(built.answerKey);
  expect(key.success, JSON.stringify(key.error?.issues)).toBe(true);
  return { built, dataPayload: data.data, answerKey: key.data };
}

describe("buildQuestionPayload — pilihan ganda", () => {
  it("opsi pindah ke data_payload.options; kunci jadi correctOptionIds", () => {
    const { dataPayload, answerKey } = expectSchemaValid(baseItem());
    expect(dataPayload).toMatchObject({ type: "multiple_choice", shuffleOptions: true });
    if (dataPayload.type !== "multiple_choice") throw new Error("tipe salah");
    expect(dataPayload.options.map((o) => o.id)).toEqual(["A", "B"]);
    expect(dataPayload.options[0]!.contentMarkdown).toBe("1");
    expect(answerKey.correctOptionIds).toBe("B");
    expect(answerKey.explanationMarkdown).toContain("1+1=2");
  });

  it("label opsi dinormalkan ke huruf besar & kunci di luar opsi dibuang", () => {
    const { dataPayload, answerKey } = expectSchemaValid(
      baseItem({
        options: [
          { label: "a", text: "1", isCorrect: false },
          { label: "b", text: "2", isCorrect: true },
        ],
        correct: ["B", "Z"], // "Z" tak ada di opsi → dibuang, bukan ditebak
      }),
    );
    if (dataPayload.type !== "multiple_choice") throw new Error("tipe salah");
    expect(dataPayload.options.map((o) => o.id)).toEqual(["A", "B"]);
    expect(answerKey.correctOptionIds).toBe("B");
  });

  it("pg kompleks → complex_multiple_choice dengan kunci array", () => {
    const { dataPayload, answerKey } = expectSchemaValid(
      baseItem({
        type: "multiple_choice_checkbox",
        options: [
          { label: "A", text: "2", isCorrect: true },
          { label: "B", text: "3", isCorrect: false },
          { label: "C", text: "5", isCorrect: true },
        ],
        correct: ["A", "C"],
      }),
    );
    expect(dataPayload.type).toBe("complex_multiple_choice");
    expect(answerKey.correctOptionIds).toEqual(["A", "C"]);
  });

  it("tanpa pembahasan → placeholder eksplisit + peringatan (bukan mengarang)", () => {
    const built = buildQuestionPayload(baseItem({ explanation: undefined }));
    expect(built.answerKey.explanationMarkdown).toBe(MISSING_EXPLANATION_PLACEHOLDER);
    expect(built.warnings.join(" ")).toContain("Pembahasan kosong");
    expect(answerKeySchema.safeParse(built.answerKey).success).toBe(true);
  });
});

describe("buildQuestionPayload — matriks", () => {
  it("labels+rows → columns+statements+matrixAnswers", () => {
    const { dataPayload, answerKey } = expectSchemaValid(
      baseItem({
        type: "matrix_grid",
        options: [],
        correct: [],
        dataPayload: {
          labels: ["Benar", "Salah"],
          rows: [
            { text: "2 bilangan prima.", answer: "Benar" },
            { text: "4 bilangan prima.", answer: "Salah" },
          ],
        },
      }),
    );
    expect(dataPayload).toMatchObject({
      type: "matrix",
      columns: ["Benar", "Salah"],
      statements: [
        { id: "s1", contentMarkdown: "2 bilangan prima." },
        { id: "s2", contentMarkdown: "4 bilangan prima." },
      ],
    });
    expect(answerKey.matrixAnswers).toEqual({ s1: "Benar", s2: "Salah" });
  });

  it("kunci kosong di sumber → matrixAnswers absen (tak menebak)", () => {
    const { dataPayload, answerKey } = expectSchemaValid(
      baseItem({
        type: "matrix_grid",
        options: [],
        correct: [],
        dataPayload: {
          labels: ["Benar", "Salah"],
          rows: [{ text: "2 bilangan prima.", answer: null }],
        },
      }),
    );
    expect(dataPayload.type).toBe("matrix");
    expect(answerKey.matrixAnswers).toBeUndefined();
  });

  it("kolom < 2 → ditolak skema (bukan crash)", () => {
    const built = buildQuestionPayload(
      baseItem({
        type: "matrix_grid",
        options: [],
        correct: [],
        dataPayload: { labels: ["Benar"], rows: [{ text: "x", answer: "Benar" }] },
      }),
    );
    const parsed = questionDataPayloadSchema.safeParse(built.dataPayload);
    expect(parsed.success).toBe(false);
  });
});

describe("buildQuestionPayload — isian & esai", () => {
  it("esai tanpa rubrik → rubricGuidelines placeholder (≥20 char) & valid", () => {
    const { dataPayload, built } = expectSchemaValid(
      baseItem({ type: "essay", options: [], correct: [] }),
    );
    expect(dataPayload.type).toBe("essay");
    if (dataPayload.type !== "essay") throw new Error("tipe salah");
    expect(dataPayload.rubricGuidelines).toBe(MISSING_RUBRIC_PLACEHOLDER);
    expect(built.warnings.join(" ")).toContain("Rubrik penilaian kosong");
  });
});

describe("buildQuestionPayload — kontainer stimulus", () => {
  it("stimulus: data_payload tanpa `type`, answer_key kosong", () => {
    const built = buildQuestionPayload(
      baseItem({ type: "stimulus", options: [], correct: [], explanation: undefined }),
    );
    expect(built.dataPayload.type).toBeUndefined();
    expect(built.answerKey).toEqual({});
    expect(built.warnings).toEqual([]);
  });
});

describe("buildQuestionPayload — pelanggaran skema terdeteksi", () => {
  it("frasa 'semua jawaban di atas benar' (Haladyna 5) ditolak", () => {
    const built = buildQuestionPayload(
      baseItem({
        options: [
          { label: "A", text: "1", isCorrect: false },
          { label: "B", text: "Semua jawaban di atas benar", isCorrect: true },
        ],
      }),
    );
    expect(questionDataPayloadSchema.safeParse(built.dataPayload).success).toBe(false);
  });

  it("opsi < 2 (Haladyna 2) ditolak", () => {
    const built = buildQuestionPayload(
      baseItem({ options: [{ label: "A", text: "1", isCorrect: true }] }),
    );
    expect(questionDataPayloadSchema.safeParse(built.dataPayload).success).toBe(false);
  });
});

describe("adapter nyata → payload kanonik (end-to-end, tanpa DB)", () => {
  const DEFANTRI_OK = `
<h4>1. Soal OSN-K</h4>
<blockquote>Perhatikan gambar!<br>
<div class="question">
<label><div class="box white"><input type="radio" name="q1" value="correct">$(A)$ 13 cm</div></label>
<label><div class="box white"><input type="radio" name="q1" value="corect">$(B)$ 15 cm</div></label>
<label><div class="box white"><input type="radio" name="q1" value="corect">$(C)$ 21 cm</div></label>
<label><div class="box white"><input type="radio" name="q1" value="corect">$(D)$ 27 cm</div></label>
</div></blockquote>`;

  const M4THLAB_OK = `
<div class="contoh-soal">
  <div class="cs-header">Contoh Soal 1</div>
  <div class="cs-body">
    <div class="cs-teks">Faktorisasi dari $x^2+7x+12$ adalah ....</div>
    <div class="cs-opsi">
      <div class="cs-opt" onclick="pilihJawaban(this, true)">
        <span class="cs-marker">A</span><span class="cs-opt-text">$(x+3)(x+4)$</span></div>
      <div class="cs-opt" onclick="pilihJawaban(this, false)">
        <span class="cs-marker">B</span><span class="cs-opt-text">$(x+2)(x+6)$</span></div>
      <div class="cs-opt" onclick="pilihJawaban(this, false)">
        <span class="cs-marker">C</span><span class="cs-opt-text">$(x-3)(x-4)$</span></div>
      <div class="cs-opt" onclick="pilihJawaban(this, false)">
        <span class="cs-marker">D</span><span class="cs-opt-text">$(x-2)(x-6)$</span></div>
    </div>
    <div class="cs-toggle-pem">Lihat Pembahasan</div>
    <div class="cs-pembahasan"><div class="cs-pem-body">Cari dua bilangan yang berjumlah 7.</div></div>
  </div>
</div>`;

  const MATHCYBER_OL = `
<h2><span>Soal Nomor 1</span></h2>
<p>Tentukan nilai dari $2+3$.</p>
<ol style="list-style-type: upper-alpha"><li>$4$</li><li>$5$</li><li>$6$</li><li>$7$</li></ol>
<div class="sp-wrap"><div class="sp-head">Pembahasan</div>
<div class="sp-body">Hasilnya $5$. (Jawaban B)</div></div>`;

  it.each([
    ["defantri", () => defantriAdapter(DEFANTRI_OK, { source: "defantri" })],
    ["m4thlab", () => m4thlabAdapter(M4THLAB_OK, { source: "m4thlab" })],
    ["mathcyber", () => mathcyberAdapter(MATHCYBER_OL, { source: "mathcyber" })],
  ])("%s: seluruh butir menghasilkan payload valid", (_name, run) => {
    const seg = run();
    expect(seg.items.length).toBeGreaterThan(0);
    for (const item of seg.items) {
      expectSchemaValid(item);
    }
  });
});
