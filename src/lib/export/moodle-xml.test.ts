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
