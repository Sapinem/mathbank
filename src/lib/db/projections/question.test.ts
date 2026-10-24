import { describe, it, expect } from "vitest";
import {
  questionColumns,
  projectOptions,
  projectAnswerKey,
  projectDataPayload,
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
      // ADR-0019: embedding* pindah ke tabel `question_embeddings` —
      // kolom ini sudah tidak ada di `questions`, jadi tak perlu dikecualikan.
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

describe("projectDataPayload — sanitasi aman data_payload (S3)", () => {
  it("membersihkan distractorRationale dan answer bila withAnswerKey false", () => {
    const raw = {
      options: [
        { id: "A", contentMarkdown: "1", distractorRationale: "Rasional rahasia" },
        { id: "B", contentMarkdown: "2" },
      ],
      rows: [
        { id: "r1", text: "Baris 1", answer: "Benar" },
        { id: "r2", text: "Baris 2", answer: "Salah" },
      ],
    };
    const projected = projectDataPayload(raw, { withAnswerKey: false });
    const opts = projected.options as Array<{ distractorRationale?: string; contentMarkdown: string }>;
    const rows = projected.rows as Array<{ answer?: string; text: string }>;
    expect(opts[0]!.distractorRationale).toBeUndefined();
    expect(opts[0]!.contentMarkdown).toBe("1");
    expect(rows[0]!.answer).toBeUndefined();
    expect(rows[0]!.text).toBe("Baris 1");
  });

  it("mempertahankan distractorRationale dan answer bila withAnswerKey true", () => {
    const raw = {
      options: [
        { id: "A", contentMarkdown: "1", distractorRationale: "Rasional rahasia" },
      ],
      rows: [
        { id: "r1", text: "Baris 1", answer: "Benar" },
      ],
    };
    const projected = projectDataPayload(raw, { withAnswerKey: true });
    const opts = projected.options as Array<{ distractorRationale?: string }>;
    const rows = projected.rows as Array<{ answer?: string }>;
    expect(opts[0]!.distractorRationale).toBe("Rasional rahasia");
    expect(rows[0]!.answer).toBe("Benar");
  });

  it("input null atau bukan objek mengembalikan objek kosong", () => {
    expect(projectDataPayload(null)).toEqual({});
    expect(projectDataPayload(undefined)).toEqual({});
    expect(projectDataPayload("string")).toEqual({});
  });
});
