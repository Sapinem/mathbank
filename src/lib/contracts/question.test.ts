import { describe, it, expect } from "vitest";
import {
  createQuestionSchema,
  listQuestionsQuerySchema,
  listQuestionsMcpInputShape,
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

  it("filter boolean eksplisit: 'false' TIDAK boleh menjadi true", () => {
    expect(listQuestionsQuerySchema.parse({ includeDeleted: "false" }).includeDeleted).toBe(false);
    expect(listQuestionsQuerySchema.parse({ includeDeleted: "0" }).includeDeleted).toBe(false);
    expect(listQuestionsQuerySchema.parse({ flagged: "false" }).flagged).toBe(false);
    expect(listQuestionsQuerySchema.parse({ flagged: "0" }).flagged).toBe(false);
  });

  it("filter boolean menerima true/1", () => {
    expect(listQuestionsQuerySchema.parse({ includeDeleted: "true" }).includeDeleted).toBe(true);
    expect(listQuestionsQuerySchema.parse({ flagged: "1" }).flagged).toBe(true);
  });

  it("filter boolean menolak nilai tak dikenal (bukan ditebak)", () => {
    expect(() => listQuestionsQuerySchema.parse({ includeDeleted: "yes" })).toThrow();
  });

  it("filter boolean menerima boolean bertipe (jalur MCP/service)", () => {
    // Tool MCP mengirim boolean asli, bukan string query.
    expect(listQuestionsQuerySchema.parse({ flagged: true }).flagged).toBe(true);
    expect(listQuestionsQuerySchema.parse({ flagged: false }).flagged).toBe(false);
    expect(listQuestionsQuerySchema.parse({ includeDeleted: true }).includeDeleted).toBe(true);
    // Argumen khas search_questions (mode & paginasi sudah bertipe).
    const mcpArgs = { flagged: true, mode: "text" as const, limit: 20, offset: 0 };
    expect(listQuestionsQuerySchema.parse(mcpArgs).flagged).toBe(true);
  });

  it("bentuk MCP search_questions = kunci REST minus includeDeleted", () => {
    const rest = Object.keys(listQuestionsQuerySchema.shape).sort();
    const mcp = Object.keys(listQuestionsMcpInputShape).sort();
    expect(mcp).toEqual(rest.filter((k) => k !== "includeDeleted"));
  });

  it("bentuk MCP: nilai tunggal & daftar sama-sama diterima skema REST", () => {
    const single = listQuestionsQuerySchema.parse({ questionType: "essay", difficulty: 3 });
    expect(single.questionType).toEqual(["essay"]);
    expect(single.difficulty).toEqual([3]);
    const list = listQuestionsQuerySchema.parse({
      questionType: ["essay", "short_answer"],
      difficulty: [2, 3],
    });
    expect(list.questionType).toEqual(["essay", "short_answer"]);
    expect(list.difficulty).toEqual([2, 3]);
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

// ── MAT-146 · Gerbang Tulis Wajib ────────────────────────────────────────────
import {
  enforceQuestionWriteGate,
  normalizeQuestionWritePayload,
  QuestionPayloadValidationError,
} from "./question";

describe("enforceQuestionWriteGate — MAT-146", () => {
  const opts = (labels: string[], correct: string[]) =>
    labels.map((label, i) => ({
      label,
      contentMarkdown: `isi ${label}`,
      isCorrect: correct.includes(label),
      orderIndex: i,
    }));

  it("menormalkan opsi relasional → data_payload.options + correctOptionIds", () => {
    const r = enforceQuestionWriteGate({
      questionType: "single_choice",
      dataPayload: {},
      answerKey: {},
      options: opts(["A", "B", "C"], ["B"]),
    });
    expect(r.dataPayload.type).toBe("multiple_choice");
    expect(r.dataPayload.options).toEqual([
      { id: "A", contentMarkdown: "isi A" },
      { id: "B", contentMarkdown: "isi B" },
      { id: "C", contentMarkdown: "isi C" },
    ]);
    expect(r.answerKey.correctOptionIds).toEqual(["B"]);
    // mirror legacy tetap ada (dedup + ekspor Moodle)
    expect(r.answerKey.correct).toEqual(["B"]);
  });

  it("checkbox → complex_multiple_choice", () => {
    const r = enforceQuestionWriteGate({
      questionType: "multiple_choice_checkbox",
      dataPayload: {},
      answerKey: {},
      options: opts(["A", "B", "C"], ["A", "C"]),
    });
    expect(r.dataPayload.type).toBe("complex_multiple_choice");
    expect(r.answerKey.correctOptionIds).toEqual(["A", "C"]);
  });

  it("menolak < 2 opsi (Haladyna Rule 2) dengan 422 + issues", () => {
    try {
      enforceQuestionWriteGate({
        questionType: "single_choice",
        dataPayload: {},
        answerKey: {},
        options: opts(["A"], ["A"]),
      });
      throw new Error("seharusnya melempar");
    } catch (e) {
      expect(e).toBeInstanceOf(QuestionPayloadValidationError);
      const err = e as QuestionPayloadValidationError;
      expect(err.httpStatus).toBe(422);
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.message).toMatch(/Minimal 2 opsi/);
    }
  });

  it("menolak frasa terlarang 'semua di atas' (Haladyna Rule 5)", () => {
    expect(() =>
      enforceQuestionWriteGate({
        questionType: "single_choice",
        dataPayload: {},
        answerKey: {},
        options: [
          { label: "A", contentMarkdown: "1", isCorrect: true, orderIndex: 0 },
          {
            label: "B",
            contentMarkdown: "Semua jawaban di atas benar",
            isCorrect: false,
            orderIndex: 1,
          },
        ],
      }),
    ).toThrow(QuestionPayloadValidationError);
  });

  it("envelope: answer_key bertipe salah ditolak", () => {
    expect(() =>
      enforceQuestionWriteGate({
        questionType: "single_choice",
        dataPayload: {},
        answerKey: { correctOptionIds: 42 },
      }),
    ).toThrow(QuestionPayloadValidationError);
  });

  it("draft tanpa opsi & tanpa kunci tetap boleh (jalur legacy/ingest)", () => {
    const r = enforceQuestionWriteGate({
      questionType: "essay",
      dataPayload: {},
      answerKey: {},
    });
    expect(r.dataPayload).toEqual({});
    expect(r.answerKey).toEqual({});
  });

  it("status ready memicu kontrak rilis (distractor rationale wajib)", () => {
    expect(() =>
      enforceQuestionWriteGate({
        questionType: "single_choice",
        dataPayload: {},
        answerKey: {},
        options: opts(["A", "B"], ["A"]),
        status: "ready",
      }),
    ).toThrow(/kontrak pedagogis/i);
  });

  it("normalisasi eksplisit: correct string → array, explanation ⇄ explanationMarkdown", () => {
    const r = normalizeQuestionWritePayload({
      questionType: "single_choice",
      dataPayload: {},
      answerKey: { correct: "A", explanation: "Pembahasan" },
    });
    expect(r.answerKey.correct).toEqual(["A"]);
    expect(r.answerKey.correctOptionIds).toEqual(["A"]);
    expect(r.answerKey.explanationMarkdown).toBe("Pembahasan");
    expect(r.answerKey.explanation).toBe("Pembahasan");
  });

  it("esai dengan rubric terstruktur otomatis men-generate scoringRubric dan lolos rilis ready", () => {
    const r = enforceQuestionWriteGate({
      questionType: "essay",
      dataPayload: {},
      answerKey: {
        explanationMarkdown: "Pembahasan langkah-langkah penyelesaian",
        rubric: {
          totalPoints: 10,
          criteria: [
            { description: "Menuliskan model persamaan diferensial", points: 4 },
            { description: "Menyelesaikan integral faktor integrasi", points: 6 },
          ],
        },
      },
      status: "ready",
    });
    expect(r.answerKey.rubric).toBeDefined();
    expect(r.answerKey.scoringRubric).toContain("Langkah 1 (4 poin)");
    expect(r.dataPayload.rubricGuidelines).toBeDefined();
  });

  // ── Regresi: mirror legacy tidak boleh memblokir rilis (MAT-146) ──────────
  // `answerKeySchema` bersifat `.strict()`; normalisasi selalu menambah mirror
  // `correct` + `explanation`. Sebelum perbaikan, SETIAP soal gagal dirilis
  // dengan "Unrecognized keys: correct, explanation".
  const rationale = (label: string) =>
    `Siswa salah menerapkan langkah pada opsi ${label} sehingga memperoleh nilai keliru 5 bukan 4.`;

  it("status ready LOLOS bila pengecoh ber-rationale (mirror legacy disaring)", () => {
    const r = enforceQuestionWriteGate({
      questionType: "single_choice",
      dataPayload: {
        type: "multiple_choice",
        options: [
          { id: "A", contentMarkdown: "4" },
          { id: "B", contentMarkdown: "5", distractorRationale: rationale("B") },
        ],
      },
      answerKey: { correctOptionIds: ["A"], explanationMarkdown: "Pembahasan." },
      status: "ready",
    });
    expect(r.answerKey.correctOptionIds).toEqual(["A"]);
    // mirror legacy tetap tersimpan untuk ekspor/dedup
    expect(r.answerKey.correct).toEqual(["A"]);
    expect(r.answerKey.explanation).toBe("Pembahasan.");
  });

  it("status ready menolak pengecoh tanpa rationale dengan pesan rationale (bukan unrecognized keys)", () => {
    let issues: { path: (string | number)[]; message: string }[] = [];
    try {
      enforceQuestionWriteGate({
        questionType: "single_choice",
        dataPayload: {
          type: "multiple_choice",
          options: [
            { id: "A", contentMarkdown: "4" },
            { id: "B", contentMarkdown: "5" },
          ],
        },
        answerKey: { correctOptionIds: ["A"], explanationMarkdown: "Pembahasan." },
        status: "ready",
      });
    } catch (e) {
      issues = (e as { issues?: typeof issues }).issues ?? [];
    }
    expect(issues.some((i) => /distractorRationale/i.test(i.message))).toBe(true);
    expect(issues.some((i) => /Unrecognized key/i.test(i.message))).toBe(false);
  });

  it("status ready menolak esai tanpa scoringRubric", () => {
    expect(() =>
      enforceQuestionWriteGate({
        questionType: "essay",
        dataPayload: {
          type: "essay",
          rubricGuidelines:
            "Langkah 1 memisahkan variabel, langkah 2 menerapkan aturan rantai, langkah 3 jawaban akhir.",
        },
        answerKey: { explanationMarkdown: "Pembahasan." },
        status: "ready",
      }),
    ).toThrow(/rubrik|scoringRubric/i);
  });
});
