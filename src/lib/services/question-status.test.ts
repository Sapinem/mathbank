import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **MAT-150** — kontrak rilis ditegakkan di jalur FSM (transisi status).
 *
 * Uji unit (tanpa DB): `db.update` dan pembacaan soal di-mock, sehingga yang
 * diuji murni urutan + keputusan: FSM → izin → gerbang pedagogis → UPDATE CAS.
 */

const db = vi.hoisted(() => {
  const returning = vi.fn();
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { returning, where, set, update };
});

vi.mock("@/lib/db", () => ({ db: { update: db.update } }));
vi.mock("./audit", () => ({ recordAudit: vi.fn(async () => undefined) }));
vi.mock("./question-read", () => ({
  getQuestionInternal: vi.fn(),
  getQuestion: vi.fn(async () => ({ id: "q-1", status: "ready" })),
}));

import { changeQuestionStatus } from "./question-status";
import { getQuestionInternal } from "./question-read";
import { QuestionPayloadValidationError } from "@/lib/contracts/question";
import { ConflictError } from "@/lib/auth/guards";
import { InvalidTransitionError } from "@/lib/fsm/question-fsm";
import type { Actor } from "@/lib/auth/actor";

const admin: Actor = { id: "u-admin", name: "Admin", roles: ["admin"], via: "session" };
const mockedInternal = vi.mocked(getQuestionInternal);

const RATIONALE =
  "Siswa lupa mengalikan dengan ½ pada rumus Sn sehingga memperoleh 30, bukan 20.";

/** Payload PG kanonik; `withRationale: false` meniru draft yang belum lengkap. */
function mcPayload(withRationale: boolean) {
  return {
    type: "multiple_choice",
    shuffleOptions: true,
    options: [
      {
        id: "A",
        contentMarkdown: "20",
        ...(withRationale ? { distractorRationale: RATIONALE } : {}),
      },
      { id: "B", contentMarkdown: "30" },
      {
        id: "C",
        contentMarkdown: "40",
        ...(withRationale ? { distractorRationale: RATIONALE } : {}),
      },
    ],
  };
}

function draftRow(
  dataPayload: Record<string, unknown>,
  answerKey: Record<string, unknown>,
  status: "draft" | "review" = "review",
) {
  return {
    id: "q-1",
    status,
    questionType: "single_choice",
    dataPayload,
    answerKey,
    authorId: "u-admin",
    lastReviewedAt: null,
    options: [],
  } as unknown as Awaited<ReturnType<typeof getQuestionInternal>>;
}

const baseAnswerKey = {
  correctOptionIds: ["B"],
  explanationMarkdown: "Sn = n/2 (2a + (n-1)b) = 20.",
};

describe("changeQuestionStatus — gerbang rilis MAT-150", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.returning.mockResolvedValue([{ id: "q-1" }]);
  });

  it("(a) soal review tanpa distractorRationale → ready ditolak 422, tanpa UPDATE", async () => {
    mockedInternal.mockResolvedValue(draftRow(mcPayload(false), baseAnswerKey));

    const err = await changeQuestionStatus("q-1", "ready", admin).catch((e) => e);

    expect(err).toBeInstanceOf(QuestionPayloadValidationError);
    expect(err.httpStatus).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.issues.length).toBeGreaterThan(0);
    expect(String(err.message)).toMatch(/kontrak pedagogis/i);
    // Gerbang berjalan SEBELUM UPDATE CAS.
    expect(db.update).not.toHaveBeenCalled();
  });

  it("(a2) esai tanpa scoringRubric → ready ditolak 422", async () => {
    mockedInternal.mockResolvedValue(
      draftRow(
        {
          type: "essay",
          rubricGuidelines: "Langkah 1 (2 poin): memisahkan variabel; Langkah 2 (3 poin): substitusi.",
        },
        { explanationMarkdown: "Jawaban: 12." },
      ),
    );

    const err = await changeQuestionStatus("q-1", "ready", admin).catch((e) => e);

    expect(err).toBeInstanceOf(QuestionPayloadValidationError);
    expect(err.httpStatus).toBe(422);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("(a3) draft tanpa explanationMarkdown → ready ditolak 422", async () => {
    mockedInternal.mockResolvedValue(
      draftRow(mcPayload(true), { correctOptionIds: ["B"] }),
    );

    const err = await changeQuestionStatus("q-1", "ready", admin).catch((e) => e);

    expect(err).toBeInstanceOf(QuestionPayloadValidationError);
    expect(err.httpStatus).toBe(422);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("(b) draft lengkap → ready sukses (UPDATE CAS dijalankan sekali)", async () => {
    mockedInternal.mockResolvedValue(draftRow(mcPayload(true), baseAnswerKey));

    const updated = await changeQuestionStatus("q-1", "ready", admin);

    expect(updated).toMatchObject({ id: "q-1" });
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready" }),
    );
  });

  it("(c) kalah balapan CAS (0 baris) → 409 ConflictError", async () => {
    mockedInternal.mockResolvedValue(draftRow(mcPayload(true), baseAnswerKey));
    db.returning.mockResolvedValue([]);

    const err = await changeQuestionStatus("q-1", "ready", admin).catch((e) => e);

    expect(err).toBeInstanceOf(ConflictError);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("baris warisan tanpa data_payload.type tetap dinilai (type diturunkan dari question_type)", async () => {
    const legacy = mcPayload(false);
    delete (legacy as { type?: string }).type;
    mockedInternal.mockResolvedValue(draftRow(legacy, baseAnswerKey));

    const err = await changeQuestionStatus("q-1", "ready", admin).catch((e) => e);

    expect(err).toBeInstanceOf(QuestionPayloadValidationError);
    expect(err.httpStatus).toBe(422);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("transisi non-ready tidak menjalankan kontrak rilis", async () => {
    mockedInternal.mockResolvedValue(draftRow(mcPayload(false), baseAnswerKey));

    await changeQuestionStatus("q-1", "draft", admin);

    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it("urutan: FSM lebih dulu — draft → ready ditolak FSM, bukan gerbang", async () => {
    mockedInternal.mockResolvedValue(draftRow(mcPayload(false), baseAnswerKey, "draft"));

    const err = await changeQuestionStatus("q-1", "ready", admin).catch((e) => e);

    expect(err).toBeInstanceOf(InvalidTransitionError);
    expect(db.update).not.toHaveBeenCalled();
  });
});
