import { describe, it, expect } from "vitest";
import {
  createQuestionSchema,
  listQuestionsQuerySchema,
  isOptionBased,
  OPTION_BASED_TYPES,
} from "./question";

describe("contracts/question", () => {
  const base = {
    questionType: "single_choice" as const,
    difficulty: 3,
    cognitiveLevel: "apply" as const,
    grade: "SMA-10",
    contentMarkdown: "Berapa $2+2$?",
  };

  it("terima soal minimal (default terisi)", () => {
    const r = createQuestionSchema.parse(base);
    expect(r.status).toBe("draft");
    expect(r.options).toEqual([]);
    expect(r.dataPayload).toEqual({});
    expect(r.answerKey).toEqual({});
  });

  it("tolak difficulty di luar 1–5", () => {
    expect(() => createQuestionSchema.parse({ ...base, difficulty: 6 })).toThrow();
    expect(() => createQuestionSchema.parse({ ...base, difficulty: 0 })).toThrow();
  });

  it("tolak tipe soal tak dikenal", () => {
    expect(() =>
      createQuestionSchema.parse({ ...base, questionType: "unknown" }),
    ).toThrow();
  });

  it("parse opsi dengan label & isCorrect", () => {
    const r = createQuestionSchema.parse({
      ...base,
      options: [
        { label: "A", contentMarkdown: "4", isCorrect: true },
        { label: "B", contentMarkdown: "5" },
      ],
    });
    expect(r.options).toHaveLength(2);
    expect(r.options[0].isCorrect).toBe(true);
    expect(r.options[1].isCorrect).toBe(false);
    expect(r.options[1].orderIndex).toBe(0);
  });

  it("isOptionBased mengenali 8 tipe beropsi", () => {
    expect(OPTION_BASED_TYPES).toHaveLength(8);
    expect(isOptionBased("single_choice")).toBe(true);
    expect(isOptionBased("essay")).toBe(false);
    expect(isOptionBased("stimulus")).toBe(false);
  });

  it("filter: paginasi default 20/0 + includeDeleted false", () => {
    const q = listQuestionsQuerySchema.parse({});
    expect(q.limit).toBe(20);
    expect(q.offset).toBe(0);
    expect(q.includeDeleted).toBe(false);
  });

  it("filter: coerce difficulty & flagged dari string", () => {
    const q = listQuestionsQuerySchema.parse({ difficulty: "4", flagged: "true" });
    // Multi-nilai: satu nilai pun dinormalkan jadi array (G1.4).
    expect(q.difficulty).toEqual([4]);
    expect(q.flagged).toBe(true);
  });

  it("filter multi-nilai: array, CSV, dan nilai tunggal → array", () => {
    expect(
      listQuestionsQuerySchema.parse({ difficulty: ["2", "3"] }).difficulty,
    ).toEqual([2, 3]);
    expect(
      listQuestionsQuerySchema.parse({ difficulty: "2,3" }).difficulty,
    ).toEqual([2, 3]);
    expect(
      listQuestionsQuerySchema.parse({ grade: ["SMA-10", "SMA-11"] }).grade,
    ).toEqual(["SMA-10", "SMA-11"]);
    expect(
      listQuestionsQuerySchema.parse({ questionType: "single_choice" }).questionType,
    ).toEqual(["single_choice"]);
  });

  it("filter kosong → undefined (bukan array kosong)", () => {
    const q = listQuestionsQuerySchema.parse({ difficulty: "", grade: [] });
    expect(q.difficulty).toBeUndefined();
    expect(q.grade).toBeUndefined();
  });

  it("filter: tolak limit > 100", () => {
    expect(() => listQuestionsQuerySchema.parse({ limit: "500" })).toThrow();
  });
});
