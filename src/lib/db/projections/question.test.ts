import { describe, it, expect } from "vitest";
import {
  questionColumns,
  projectOptions,
  projectAnswerKey,
  correctLabelsOf,
  canSeeAnswerKey,
} from "./question";
import type { Actor } from "@/lib/auth/actor";
import { questions } from "@/lib/db/schema/question";

function actor(roles: Actor["roles"], via: Actor["via"] = "session"): Actor {
  return { id: "u1", name: "Uji", roles, via };
}

describe("canSeeAnswerKey — gerbang kunci (S3)", () => {
  it("admin/teacher/reviewer boleh", () => {
    expect(canSeeAnswerKey(actor(["admin"]))).toBe(true);
    expect(canSeeAnswerKey(actor(["teacher"]))).toBe(true);
    expect(canSeeAnswerKey(actor(["reviewer"]))).toBe(true);
  });

  it("agent & machine TIDAK boleh", () => {
    expect(canSeeAnswerKey(actor(["agent"], "apikey"))).toBe(false);
    expect(canSeeAnswerKey(actor(["machine"], "apikey"))).toBe(false);
  });

  it("multi-peran: boleh bila SALAH SATU berwenang", () => {
    expect(canSeeAnswerKey(actor(["machine", "teacher"]))).toBe(true);
    expect(canSeeAnswerKey(actor(["agent", "machine"], "apikey"))).toBe(false);
  });
});

describe("questionColumns — proyeksi aman (S3)", () => {
  it("TANPA kunci: tak ada `answerKey`", () => {
    const cols = questionColumns();
    expect("answerKey" in cols).toBe(false);
  });

  it("DENGAN kunci: ada `answerKey`", () => {
    const cols = questionColumns({ withAnswerKey: true }) as Record<string, unknown>;
    expect(cols.answerKey).toBe(questions.answerKey);
  });

  it("field internal SELALU dikecualikan (tanpa & dengan kunci)", () => {
    for (const withAnswerKey of [false, true]) {
      const cols = questionColumns({ withAnswerKey }) as Record<string, unknown>;
      expect(cols.embedding).toBeUndefined();
      expect(cols.embeddingContentHash).toBeUndefined();
      expect(cols.embeddingModelName).toBeUndefined();
      expect(cols.aiTagged).toBeUndefined();
      expect(cols.aiTaggedAt).toBeUndefined();
    }
  });

  it("kolom wajib tetap ada (id, content, status, ...)", () => {
    const cols = questionColumns() as Record<string, unknown>;
    for (const k of ["id", "contentMarkdown", "status", "questionType", "grade"]) {
      expect(cols[k], `kolom ${k} harus ada`).toBeDefined();
    }
  });
});

describe("projectOptions — opsi dari JSONB (MAT-146, S3)", () => {
  const row = {
    id: "q-1",
    dataPayload: {
      type: "multiple_choice",
      options: [
        { id: "A", contentMarkdown: "1", distractorRationale: "Salah menjumlah suku sejenis pada langkah kedua." },
        { id: "B", contentMarkdown: "2" },
      ],
    },
    answerKey: { correctOptionIds: ["B"] },
  };

  it("TANPA kunci: isCorrect=false & rationale null", () => {
    const opts = projectOptions(row);
    expect(opts).toHaveLength(2);
    expect(opts.every((o) => o.isCorrect === false)).toBe(true);
    expect(opts.every((o) => o.distractorRationale === null)).toBe(true);
  });

  it("DENGAN kunci: isCorrect dari answer_key + rationale terbaca", () => {
    const opts = projectOptions(row, { withAnswerKey: true });
    expect(opts.find((o) => o.label === "B")?.isCorrect).toBe(true);
    expect(opts.find((o) => o.label === "A")?.isCorrect).toBe(false);
    expect(opts[0].distractorRationale).toContain("Salah menjumlah");
  });

  it("zero join: urutan & label mengikuti JSONB", () => {
    const opts = projectOptions(row, { withAnswerKey: true });
    expect(opts.map((o) => o.label)).toEqual(["A", "B"]);
    expect(opts.map((o) => o.orderIndex)).toEqual([0, 1]);
    expect(opts.every((o) => o.questionId === "q-1")).toBe(true);
  });

  it("payload tanpa opsi (matriks/esai) → array kosong", () => {
    expect(projectOptions({ id: "q-2", dataPayload: { rows: [] } })).toEqual([]);
    expect(projectOptions({ id: "q-3", dataPayload: {} })).toEqual([]);
  });
});

describe("projectAnswerKey — kanonik + mirror legacy (MAT-146)", () => {
  it("menurunkan `correct`/`explanation` dari bentuk kanonik", () => {
    const key = projectAnswerKey({
      correctOptionIds: ["c"],
      explanationMarkdown: "Pembahasan",
    });
    expect(key.correct).toEqual(["C"]);
    expect(key.explanation).toBe("Pembahasan");
    expect(key.correctOptionIds).toEqual(["c"]);
  });

  it("kunci kosong tetap {} (kontrak respons tak berubah)", () => {
    expect(projectAnswerKey({})).toEqual({});
    expect(projectAnswerKey(null)).toEqual({});
  });

  it("correctLabelsOf menerima string tunggal & array", () => {
    expect(correctLabelsOf({ correctOptionIds: "a" })).toEqual(["A"]);
    expect(correctLabelsOf({ correct: ["b", "d"] })).toEqual(["B", "D"]);
    expect(correctLabelsOf(undefined)).toEqual([]);
  });
});
