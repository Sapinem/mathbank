import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";
import {
  createQuestion,
  getQuestion,
  updateQuestion,
  changeQuestionStatus,
  setQuestionFlag,
  deleteQuestion,
  listQuestions,
} from "./question-service";
import { NotFoundError } from "@/lib/auth/guards";
import { NotReadyError } from "@/lib/fsm/question-fsm";

/**
 * Tes INTEGRASI service soal (L5 ↔ L8) — DB uji nyata (lihat STRATEGI-TES §5).
 *
 * Menguji perilaku lintas-lapisan yang TAK bisa diuji unit:
 * - transaksi (soal + opsi + topik/label)
 * - invarian DB (stimulus depth, difficulty, siklus)
 * - guard FSM + kesiapan (`ready` wajib answer_key) via service
 * - audit tercatat
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");

const sql = postgres(url, { max: 4 });

const teacher: Actor = {
  id: "test-teacher",
  name: "Guru Uji",
  roles: ["teacher"],
  via: "session",
};
const admin: Actor = {
  id: "test-admin",
  name: "Admin Uji",
  roles: ["admin"],
  via: "session",
};

/** Bentuk input minimal yang valid. */
function baseInput(over: Record<string, unknown> = {}) {
  return {
    questionType: "single_choice" as const,
    difficulty: 3,
    cognitiveLevel: "remember" as const,
    grade: "g1",
    contentMarkdown: "Berapa $1+1$?",
    dataPayload: {},
    answerKey: {},
    status: "draft" as const,
    childOrder: 0,
    options: [],
    topicIds: [],
    tagIds: [],
    ...over,
  };
}

/** Bersihkan data soal + audit antar-tes. */
async function cleanAll() {
  await sql`DELETE FROM question_options`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM audit_logs`;
}

beforeAll(async () => {
  // Pastikan terhubung.
  await sql`SELECT 1`;
});

beforeEach(cleanAll);

afterAll(async () => {
  await cleanAll();
  await sql.end();
});

describe("createQuestion", () => {
  it("membuat soal + opsi dalam satu transaksi", async () => {
    const q = await createQuestion(
      baseInput({
        options: [
          { label: "A", contentMarkdown: "1", isCorrect: true, orderIndex: 0 },
          { label: "B", contentMarkdown: "2", isCorrect: false, orderIndex: 1 },
        ],
      }),
      teacher,
    );
    expect(q.id).toBeTruthy();
    expect(q.options).toHaveLength(2);
    expect(q.options.find((o) => o.isCorrect)?.label).toBe("A");
    expect(q.status).toBe("draft");
  });

  it("mencatat audit 'create'", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const rows = await sql`SELECT action FROM audit_logs WHERE entity_id = ${q.id}`;
    expect(rows.map((r) => r.action)).toContain("create");
  });

  it("soal BOLEH dibuat TANPA answer_key (draft)", async () => {
    const q = await createQuestion(baseInput({ answerKey: {} }), teacher);
    expect(q.answerKey).toEqual({});
  });

  it("menolak stimulus dengan parentId", async () => {
    await expect(
      createQuestion(
        baseInput({ questionType: "stimulus", parentId: crypto.randomUUID() }),
        teacher,
      ),
    ).rejects.toThrow();
  });

  it("menolak anak dengan parentId yang bukan stimulus", async () => {
    const plain = await createQuestion(baseInput(), teacher);
    await expect(
      createQuestion(baseInput({ parentId: plain.id }), teacher),
    ).rejects.toThrow();
  });

  it("menerima anak dengan parent stimulus (depth 1)", async () => {
    const stim = await createQuestion(
      baseInput({ questionType: "stimulus", contentMarkdown: "Bacaan..." }),
      teacher,
    );
    const child = await createQuestion(
      baseInput({ parentId: stim.id }),
      teacher,
    );
    expect(child.parentId).toBe(stim.id);
  });

  it("menolak difficulty di luar 1–5 (invarian DB)", async () => {
    await expect(
      createQuestion(baseInput({ difficulty: 9 }), teacher),
    ).rejects.toThrow();
  });
});

describe("getQuestion & listQuestions", () => {
  it("getQuestion null bila tak ada", async () => {
    expect(await getQuestion(crypto.randomUUID())).toBeNull();
  });

  it("listQuestions mengembalikan item + total", async () => {
    await createQuestion(baseInput({ contentMarkdown: "Soal A" }), teacher);
    await createQuestion(baseInput({ contentMarkdown: "Soal B" }), teacher);
    const res = await listQuestions({ includeDeleted: false, limit: 10, offset: 0 });
    expect(res.total).toBeGreaterThanOrEqual(2);
    expect(res.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe("updateQuestion", () => {
  it("memperbarui field parsial", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const upd = await updateQuestion(
      q.id,
      { contentMarkdown: "Diubah", difficulty: 5 },
      teacher,
    );
    expect(upd.contentMarkdown).toBe("Diubah");
    expect(upd.difficulty).toBe(5);
  });

  it("mengganti opsi bila dikirim", async () => {
    const q = await createQuestion(
      baseInput({
        options: [{ label: "A", contentMarkdown: "x", isCorrect: true, orderIndex: 0 }],
      }),
      teacher,
    );
    const upd = await updateQuestion(
      q.id,
      {
        options: [
          { label: "A", contentMarkdown: "y", isCorrect: false, orderIndex: 0 },
          { label: "B", contentMarkdown: "z", isCorrect: true, orderIndex: 1 },
        ],
      },
      teacher,
    );
    expect(upd.options).toHaveLength(2);
  });

  it("NotFoundError untuk id tak ada", async () => {
    await expect(
      updateQuestion(crypto.randomUUID(), { difficulty: 2 }, teacher),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("changeQuestionStatus — FSM + kesiapan", () => {
  it("draft → review berhasil (tanpa answer_key)", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const upd = await changeQuestionStatus(q.id, "review", admin);
    expect(upd.status).toBe("review");
  });

  it("review → ready TANPA answer_key DITOLAK (NotReadyError)", async () => {
    const q = await createQuestion(baseInput(), admin);
    await changeQuestionStatus(q.id, "review", admin);
    await expect(
      changeQuestionStatus(q.id, "ready", admin),
    ).rejects.toThrow(NotReadyError);
  });

  it("review → ready DENGAN answer_key BERHASIL", async () => {
    const q = await createQuestion(
      baseInput({ answerKey: { correct: "A" } }),
      admin,
    );
    await changeQuestionStatus(q.id, "review", admin);
    const upd = await changeQuestionStatus(q.id, "ready", admin);
    expect(upd.status).toBe("ready");
    expect(upd.lastReviewedAt).toBeTruthy();
  });

  it("stimulus bisa ready walau answer_key kosong", async () => {
    const q = await createQuestion(
      baseInput({ questionType: "stimulus" }),
      admin,
    );
    await changeQuestionStatus(q.id, "review", admin);
    const upd = await changeQuestionStatus(q.id, "ready", admin);
    expect(upd.status).toBe("ready");
  });

  it("transisi tak sah (draft → ready) ditolak FSM", async () => {
    const q = await createQuestion(baseInput({ answerKey: { correct: "A" } }), admin);
    await expect(
      changeQuestionStatus(q.id, "ready", admin),
    ).rejects.toThrow();
  });

  it("mencatat audit status_change", async () => {
    const q = await createQuestion(baseInput(), admin);
    await changeQuestionStatus(q.id, "review", admin);
    const rows = await sql`SELECT action FROM audit_logs
      WHERE entity_id = ${q.id} AND action = 'status_change'`;
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

describe("setQuestionFlag & deleteQuestion", () => {
  it("menandai soal bermasalah", async () => {
    const q = await createQuestion(baseInput(), teacher);
    const upd = await setQuestionFlag(q.id, true, "perlu cek", admin);
    expect(upd.isFlagged).toBe(true);
    expect(upd.flagNotes).toBe("perlu cek");
  });

  it("teacher TAK boleh menandai (izin flag = kurasi)", async () => {
    const q = await createQuestion(baseInput(), teacher);
    await expect(
      setQuestionFlag(q.id, true, "x", teacher),
    ).rejects.toThrow();
  });

  it("deleteQuestion men-soft-delete (tak lagi di getQuestion)", async () => {
    const q = await createQuestion(baseInput(), teacher);
    await deleteQuestion(q.id, teacher);
    expect(await getQuestion(q.id)).toBeNull();
  });
});
