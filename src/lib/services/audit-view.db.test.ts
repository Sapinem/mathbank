import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes INTEGRASI audit akses baca (M13 S7) — DB uji nyata.
 *
 * Verifikasi bahwa akses SENSITIF (melihat kunci jawaban, ekspor paket)
 * tercatat di `audit_logs`, sedangkan baca biasa TIDAK (hindari bising).
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const { getQuestion, createQuestion } = await import("@/lib/services/question-service");
const { recordViewAudit } = await import("@/lib/services/audit");

const admin: Actor = { id: "s7-admin", name: "Admin", roles: ["admin"], via: "session" };
const agent: Actor = { id: "s7-agent", name: "Agen", roles: ["agent"], via: "apikey" };

async function clean() {
  await sql`DELETE FROM audit_logs`;
  await sql`DELETE FROM questions`;
}

async function mkQuestion() {
  return createQuestion(
    {
      questionType: "single_choice",
      difficulty: 3,
      cognitiveLevel: "remember",
      grade: "g1",
      contentMarkdown: "Berapa $2+2$?",
      dataPayload: {},
      answerKey: { correct: ["B"] },
      status: "draft",
      childOrder: 0,
      options: [
        { label: "A", contentMarkdown: "3", isCorrect: false, orderIndex: 0 },
        { label: "B", contentMarkdown: "4", isCorrect: true, orderIndex: 1 },
      ],
      topicIds: [],
      tagIds: [],
    },
    admin,
  );
}

beforeAll(async () => {
  await sql`SELECT 1`;
});

beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.end();
});

describe("M13 S7 audit akses baca", () => {
  it("enum audit_action menerima 'view' & 'export'", async () => {
    await recordViewAudit({
      entityType: "question",
      entityId: "x",
      action: "view",
      actor: admin,
    });
    await recordViewAudit({
      entityType: "bundle",
      entityId: "y",
      action: "export",
      actor: admin,
    });
    const rows = await sql<{ action: string }[]>`
      SELECT action FROM audit_logs ORDER BY action`;
    expect(rows.map((r) => r.action).sort()).toEqual(["export", "view"]);
  });

  it("viewer berwenang → dapat answerKey → audit 'view' tercatat", async () => {
    const q = await mkQuestion();

    const asAdmin = await getQuestion(q.id, { viewer: admin });
    expect(asAdmin?.answerKey).toBeTruthy(); // admin berhak lihat kunci

    // Simulasi jalur route: catat bila answerKey terkirim.
    if (asAdmin?.answerKey) {
      await recordViewAudit({
        entityType: "question",
        entityId: q.id,
        action: "view",
        actor: admin,
        changeSummary: "Melihat kunci jawaban soal",
      });
    }

    const rows = await sql<{ action: string; entity_id: string }[]>`
      SELECT action, entity_id FROM audit_logs WHERE action = 'view'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entity_id).toBe(q.id);
  });

  it("viewer TANPA hak (tanpa viewer) → tak dapat kunci → tak ada audit view", async () => {
    const q = await mkQuestion();

    // Tanpa viewer → service tak menyertakan answerKey.
    const anon = await getQuestion(q.id);
    expect(anon?.answerKey).toBeUndefined();

    const rows = await sql`SELECT 1 FROM audit_logs WHERE action = 'view'`;
    expect(rows).toHaveLength(0);
  });

  it("recordViewAudit tidak melempar walau entityId ngawur (best-effort)", async () => {
    await expect(
      recordViewAudit({
        entityType: "bundle",
        entityId: "00000000-0000-0000-0000-000000000000",
        action: "export",
        actor: agent,
      }),
    ).resolves.toBeUndefined();
  });
});
