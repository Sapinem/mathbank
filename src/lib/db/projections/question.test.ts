import { describe, it, expect } from "vitest";
import {
  questionColumns,
  optionColumns,
  canSeeAnswerKey,
} from "./question";
import type { Actor } from "@/lib/auth/actor";
import { questions } from "@/lib/db/schema/question";
import { questionOptions } from "@/lib/db/schema/question";

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

describe("optionColumns — kunci opsi (S3)", () => {
  it("TANPA kunci: tak ada isCorrect/distractorRationale", () => {
    const cols = optionColumns() as Record<string, unknown>;
    expect(cols.isCorrect).toBeUndefined();
    expect(cols.distractorRationale).toBeUndefined();
  });

  it("DENGAN kunci: ada isCorrect & distractorRationale", () => {
    const cols = optionColumns({ withAnswerKey: true }) as Record<string, unknown>;
    expect(cols.isCorrect).toBe(questionOptions.isCorrect);
    expect(cols.distractorRationale).toBe(questionOptions.distractorRationale);
  });
});
