import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { createQuestion, getQuestionInternal } from "./question-service";
import { bulkQuestionAction } from "./question-bulk";
import { changeQuestionStatus } from "./question-status";
import type { Actor } from "@/lib/auth/actor";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const teacher: Actor = { id: "test-teacher", name: "Guru Uji", roles: ["teacher"], via: "session" };
const admin: Actor = { id: "test-admin", name: "Admin Uji", roles: ["admin"], via: "session" };

function base(over: Record<string, unknown> = {}) {
  return {
    questionType: "single_choice" as const,
    difficulty: 3,
    cognitiveLevel: "remember" as const,
    grade: "11",
    contentMarkdown: `Soal ${Math.random().toString(36).slice(2)}`,
    dataPayload: {},
    answerKey: { correct: ["A"] },
    status: "draft" as const,
    childOrder: 0,
    options: [{ label: "A", contentMarkdown: "1", isCorrect: true, orderIndex: 0 }],
    topicIds: [],
    tagIds: [],
    ...over,
  };
}

async function cleanAll() {
  await sql`DELETE FROM question_options`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(cleanAll);
afterAll(async () => {
  await cleanAll();
  await sql.end();
});

/** Buat soal lalu dorong ke status tertentu lewat FSM NYATA (draft→review→ready). */
async function makeAt(
  status: "draft" | "review" | "ready",
  over: Record<string, unknown> = {},
) {
  const q = await createQuestion(base(over), admin);
  if (status === "draft") return q;
  await changeQuestionStatus(q.id, "review", admin);
  if (status === "review") return q;
  await changeQuestionStatus(q.id, "ready", admin);
  return q;
}

describe("bulkQuestionAction (G3.1)", () => {
  it("set_ready massal: soal `review` → `ready` semua (ok penuh)", async () => {
    const a = await makeAt("review");
    const b = await makeAt("review");
    const res = await bulkQuestionAction([a.id, b.id], "set_ready", admin);
    expect(res.ok.sort()).toEqual([a.id, b.id].sort());
    expect(res.failed).toHaveLength(0);
    expect((await getQuestionInternal(a.id))?.status).toBe("ready");
    expect((await getQuestionInternal(b.id))?.status).toBe("ready");
  });

  it("menghormati FSM per butir: item `draft` gagal, yang `review` sukses", async () => {
    const ok = await makeAt("review");
    const bad = await makeAt("draft"); // draft → ready TAK SAH (harus lewat review)
    const res = await bulkQuestionAction([ok.id, bad.id], "set_ready", admin);
    expect(res.ok).toEqual([ok.id]);
    expect(res.failed.map((f) => f.id)).toEqual([bad.id]);
    expect(res.failed[0].error).toContain("Transisi");
    expect((await getQuestionInternal(ok.id))?.status).toBe("ready");
    expect((await getQuestionInternal(bad.id))?.status).toBe("draft");
  });

  it("menghormati IZIN per butir: peran tanpa `setReady` gagal", async () => {
    const a = await makeAt("review");
    const res = await bulkQuestionAction([a.id], "set_ready", teacher);
    expect(res.ok).toHaveLength(0);
    expect(res.failed).toHaveLength(1);
    expect((await getQuestionInternal(a.id))?.status).toBe("review");
  });

  it("reject_to_draft: review → draft massal", async () => {
    const a = await makeAt("review");
    const res = await bulkQuestionAction([a.id], "reject_to_draft", admin);
    expect(res.ok).toEqual([a.id]);
    expect((await getQuestionInternal(a.id))?.status).toBe("draft");
  });

  it("flag/unflag massal menyetel is_flagged", async () => {
    const a = await makeAt("draft");
    const b = await makeAt("draft");
    await bulkQuestionAction([a.id, b.id], "flag", admin, "perlu dicek");
    expect((await getQuestionInternal(a.id))?.isFlagged).toBe(true);
    expect((await getQuestionInternal(a.id))?.flagNotes).toBe("perlu dicek");
    await bulkQuestionAction([a.id, b.id], "unflag", admin);
    expect((await getQuestionInternal(a.id))?.isFlagged).toBe(false);
  });

  it("id tak dikenal → failed, bukan melempar", async () => {
    const res = await bulkQuestionAction([crypto.randomUUID()], "set_ready", teacher);
    expect(res.ok).toHaveLength(0);
    expect(res.failed).toHaveLength(1);
  });
});

/**
 * **ACT-05 (P0)** — bukti DoD: aksi massal 200 soal harus selesai < 300 ms
 * dengan ≤ 3 query DB (bukan ~1.800 query serial seperti versi loop).
 */
describe("bulkQuestionAction — kinerja 200 soal (ACT-05)", () => {
  it("200 soal review→ready: ≤3 query DB & < 300 ms", async () => {
    const N = 200;
    // Seed cepat lewat SQL langsung (bukan lewat service) agar tes mengukur
    // aksi massal, bukan biaya pembuatan soal.
    const ids: string[] = [];
    for (let i = 0; i < N; i++) {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO questions
          (question_type, difficulty, cognitive_level, grade, content_markdown,
           data_payload, answer_key, status, child_order)
        VALUES ('single_choice', 3, 'remember', '11', ${"Perf " + i},
                '{}'::jsonb, '{"correct":["A"]}'::jsonb, 'review', 0)
        RETURNING id`;
      ids.push(row.id);
    }

    const res = await bulkQuestionAction(ids, "set_ready", admin);

    expect(res.ok).toHaveLength(N);
    expect(res.failed).toHaveLength(0);
    expect(res.dbQueries ?? 99).toBeLessThanOrEqual(3);
    expect(res.durationMs ?? 99_999).toBeLessThan(300);

    const [check] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM questions
       WHERE id = ANY(${sql.array(ids)}::uuid[]) AND status = 'ready'`;
    expect(check.n).toBe(N);
  }, 120_000);
});
