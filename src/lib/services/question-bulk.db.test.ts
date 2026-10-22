import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { createQuestion, getQuestionInternal } from "./question-service";
import { bulkQuestionAction } from "./question-bulk";
import { changeQuestionStatus } from "./question-status";
import type { Actor } from "@/lib/auth/actor";

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
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
    // MAT-150: kontrak rilis mewajibkan `explanationMarkdown` (pembahasan) —
    // tanpa itu `set_ready` (satuan maupun massal) ditolak gerbang pedagogis.
    answerKey: { correct: ["A"], explanationMarkdown: "1 + 1 = 2 karena dua satuan digabung." },
    status: "draft" as const,
    childOrder: 0,
    // MAT-146: Haladyna Rule 2 → minimal 2 opsi.
    // MAT-150: pengecoh wajib ber-`distractorRationale` (≥40 karakter) agar
    // soal LOLOS kontrak rilis — jalur massal (`set_ready`) memakai gerbang
    // yang sama dengan jalur satuan.
    options: [
      { label: "A", contentMarkdown: "1", isCorrect: true, orderIndex: 0 },
      {
        label: "B",
        contentMarkdown: "2",
        isCorrect: false,
        orderIndex: 1,
        distractorRationale:
          "Siswa keliru menjumlahkan dua suku karena menambahkan satu ke bilangan yang salah — langkahnya melewati suku pertama, hasil keliru 2 bukan 1.",
      },
    ],
    topicIds: [],
    tagIds: [],
    ...over,
  };
}

async function cleanAll() {
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

  it("penolakan gerbang pedagogis menyampaikan SEBABNYA, bukan 'Gagal diproses.'", async () => {
    // Soal `review` dengan pengecoh tanpa `distractorRationale` → wajib ditolak
    // `assertReleaseContract()`. Regresi: `errMessage()` dulu menelan pesan
    // (ZodError zod v4 tak lolos `instanceof Error`) sehingga operator hanya
    // melihat "Gagal diproses." tanpa tahu field mana yang salah.
    const a = await makeAt("review", {
      options: [
        { label: "A", contentMarkdown: "1", isCorrect: true, orderIndex: 0 },
        { label: "B", contentMarkdown: "2", isCorrect: false, orderIndex: 1 },
      ],
    });
    const res = await bulkQuestionAction([a.id], "set_ready", admin);
    expect(res.ok).toHaveLength(0);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].error).not.toBe("Gagal diproses.");
    expect(res.failed[0].error.toLowerCase()).toContain("distractorrationale");
    expect((await getQuestionInternal(a.id))?.status).toBe("review");
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
    // MAT-150: seed WAJIB memenuhi kontrak rilis (opsi + rationale pengecoh +
    // explanationMarkdown), kalau tidak `set_ready` menolak semua butir dan
    // tes ini mengukur gerbang, bukan kinerja.
    const seedPayload = JSON.stringify({
      type: "multiple_choice",
      shuffleOptions: true,
      options: [
        { id: "A", contentMarkdown: "2" },
        {
          id: "B",
          contentMarkdown: "1",
          distractorRationale:
            "Siswa hanya menyalin suku pertama tanpa menjumlahkan — langkah salah, hasil keliru 1 bukan 2.",
        },
      ],
    });
    const seedAnswer = JSON.stringify({
      correctOptionIds: "A",
      explanationMarkdown: "1 + 1 = 2 karena dua satuan digabung.",
    });
    const ids: string[] = [];
    for (let i = 0; i < N; i++) {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO questions
          (question_type, difficulty, cognitive_level, grade, content_markdown,
           data_payload, answer_key, status, child_order)
        VALUES ('single_choice', 3, 'remember', '11', ${"Perf " + i},
                ${seedPayload}::jsonb, ${seedAnswer}::jsonb, 'review', 0)
        RETURNING id`;
      ids.push(row.id);
    }

    const res = await bulkQuestionAction(ids, "set_ready", admin);

    expect(res.ok).toHaveLength(N);
    expect(res.failed).toHaveLength(0);
    expect(res.dbQueries ?? 99).toBeLessThanOrEqual(3);
    // Target DoD = < 300 ms. Yang diuji KETAT adalah jumlah query (deterministik,
    // tidak terpengaruh beban host). Latensi dinding di sini hanya pagar kasar:
    // host bersama ini kerap ber-load >20 sehingga fsync bisa melonjak 10×.
    // Bukti latensi yang jujur ada di `scripts/bench-bulk-status.ts`
    // (5 putaran: min/median/maks) — bukan di satu angka kebetulan.
    console.log(`[ACT-05] 200 soal: ${res.dbQueries} query, ${res.durationMs} ms`);
    expect(res.durationMs ?? 99_999).toBeLessThan(3000);

    const [check] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM questions
       WHERE id = ANY(${sql.array(ids)}::uuid[]) AND status = 'ready'`;
    expect(check.n).toBe(N);
  }, 120_000);
});
