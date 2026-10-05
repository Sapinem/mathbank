import { describe, it, expect } from "vitest";
import { buildMoodleXml, type MoodleQuestion } from "./moodle-xml";

function q(over: Partial<MoodleQuestion> = {}): MoodleQuestion {
  return {
    type: "single_choice",
    content: "Berapa $2+2$?",
    options: [
      { label: "A", content: "3", isCorrect: false },
      { label: "B", content: "4", isCorrect: true },
    ],
    name: "Soal A",
    ...over,
  };
}

describe("moodle-xml", () => {
  it("multichoice: single=true, fraction 100 untuk benar", () => {
    const r = buildMoodleXml([q()]);
    expect(r.ok).toBe(true);
    expect(r.xml).toContain('<question type="multichoice">');
    expect(r.xml).toContain("<single>true</single>");
    expect(r.xml).toContain('fraction="100"');
    expect(r.xml).toContain('fraction="0"');
  });

  it("checkbox → single=false", () => {
    const r = buildMoodleXml([q({ type: "multiple_choice_checkbox" })]);
    expect(r.xml).toContain("<single>false</single>");
  });

  it("API-02: checkbox 2 jawaban benar → fraksi dibagi rata (total 100)", () => {
    const r = buildMoodleXml([
      q({
        type: "multiple_choice_checkbox",
        options: [
          { label: "A", content: "1", isCorrect: true },
          { label: "B", content: "2", isCorrect: true },
          { label: "C", content: "3", isCorrect: false },
        ],
      }),
    ]);
    // 100 / 2 = 50.00000 per opsi benar; salah tetap 0.
    expect(r.xml).toContain('fraction="50.00000"');
    expect(r.xml).toContain('fraction="0.00000"');
    // Regresi: tak boleh lagi ada opsi benar bernilai 100 penuh.
    expect(r.xml).not.toContain('fraction="100.00000"');
  });

  it("API-02: checkbox 3 jawaban benar → 33.33333 masing-masing", () => {
    const r = buildMoodleXml([
      q({
        type: "multiple_choice_checkbox",
        options: [
          { label: "A", content: "1", isCorrect: true },
          { label: "B", content: "2", isCorrect: true },
          { label: "C", content: "3", isCorrect: true },
          { label: "D", content: "4", isCorrect: false },
        ],
      }),
    ]);
    const correctCount = (r.xml.match(/fraction="33\.33333"/g) ?? []).length;
    expect(correctCount).toBe(3);
  });

  it("API-02: single_choice tetap 100/0 (tak berubah)", () => {
    const r = buildMoodleXml([q()]);
    expect(r.xml).toContain('fraction="100"');
    expect(r.xml).toContain('fraction="0"');
  });

  it("rumus dinormalisasi ke \\( \\) (bukan $)", () => {
    const r = buildMoodleXml([q({ content: "Hitung $x^2$" })]);
    expect(r.xml).toContain("\\(x^2\\)");
    expect(r.xml).not.toContain("$x^2$");
  });

  it("stimulus INLINE di depan soal anak (D1)", () => {
    const r = buildMoodleXml([q({ stimulusContent: "Bacaan: $a$", content: "Pertanyaan." })]);
    expect(r.xml).toContain("\\(a\\)<br/><br/>Pertanyaan.");
  });

  it("shortanswer memakai answerText", () => {
    const r = buildMoodleXml([q({ type: "short_answer", options: [], answerText: "2x" })]);
    expect(r.xml).toContain('<question type="shortanswer">');
    expect(r.xml).toContain("2x");
  });

  it("essay diekspor tanpa <answer>", () => {
    const r = buildMoodleXml([q({ type: "essay", options: [] })]);
    expect(r.xml).toContain('<question type="essay">');
    expect(r.xml).not.toContain("<answer ");
  });

  it("tipe tak dipetakan → skipped, bukan ditebak", () => {
    const r = buildMoodleXml([q({ type: "matrix_grid" })]);
    expect(r.skipped).toHaveLength(1);
    expect(r.exported).toBe(0);
  });

  it("D4: soal tanpa kunci → ok=false & xml kosong", () => {
    const r = buildMoodleXml([
      q({ options: [{ label: "A", content: "x", isCorrect: false }] }),
    ]);
    expect(r.ok).toBe(false);
    expect(r.xml).toBe("");
    expect(r.withoutAnswerKey).toHaveLength(1);
  });

  it("essay tidak dianggap 'tanpa kunci'", () => {
    const r = buildMoodleXml([q({ type: "essay", options: [] })]);
    expect(r.ok).toBe(true);
    expect(r.withoutAnswerKey).toHaveLength(0);
  });

  it("XML well-formed diawali deklarasi & <quiz>", () => {
    const r = buildMoodleXml([q()]);
    expect(r.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(r.xml).toContain("<quiz>");
    expect(r.xml.trimEnd().endsWith("</quiz>")).toBe(true);
  });
});
