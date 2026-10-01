import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { mergeTags, createTag, listTags } from "./taxonomy-service";
import { createQuestion } from "./question-service";
import type { Actor } from "@/lib/auth/actor";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

// `taxonomy:manage` dipegang peran admin/guru di produksi; di DB uji gunakan admin.
const admin: Actor = { id: "test-admin", name: "Admin Uji", roles: ["admin"], via: "session" };

async function cleanAll() {
  await sql`DELETE FROM question_options`;
  await sql`DELETE FROM question_topics`;
  await sql`DELETE FROM question_tags`;
  await sql`UPDATE questions SET parent_id = NULL`;
  await sql`DELETE FROM questions`;
  await sql`DELETE FROM tags`;
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_immutable`;
  await sql`DELETE FROM audit_logs`;
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_immutable`;
}

function base(tagIds: string[], over: Record<string, unknown> = {}) {
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
    tagIds,
    ...over,
  };
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(cleanAll);
afterAll(async () => {
  await cleanAll();
  await sql.end();
});

describe("mergeTags (G3.3)", () => {
  it("memindahkan relasi soal dari sumber ke tujuan lalu menghapus sumber", async () => {
    const src = await createTag({ name: "HOTS" + Math.random() }, admin);
    const dst = await createTag({ name: "Higher Order" + Math.random() }, admin);
    const q = await createQuestion(base([src.id]), admin);

    const moved = await mergeTags(src.id, dst.id, admin);
    expect(moved).toBe(1);

    // Soal kini bertag dst, bukan src.
    const rel = await sql<{ tag_id: string }[]>`
      SELECT tag_id FROM question_tags WHERE question_id = ${q.id}`;
    expect(rel.map((r) => r.tag_id)).toEqual([dst.id]);

    // Label sumber hilang.
    const ids = (await listTags()).map((t) => t.id);
    expect(ids).not.toContain(src.id);
    expect(ids).toContain(dst.id);
  });

  it("tak menduplikasi relasi yang sudah ada di tujuan (PK gabungan)", async () => {
    const src = await createTag({ name: "A" + Math.random() }, admin);
    const dst = await createTag({ name: "B" + Math.random() }, admin);
    const q = await createQuestion(base([src.id, dst.id]), admin);

    const moved = await mergeTags(src.id, dst.id, admin);
    expect(moved).toBe(0); // soal sudah punya dst → tak ada yang "baru" dipindah
    const rel = await sql<{ tag_id: string }[]>`
      SELECT tag_id FROM question_tags WHERE question_id = ${q.id}`;
    expect(rel).toHaveLength(1);
    expect(rel[0].tag_id).toBe(dst.id);
  });

  it("menolak sumber = tujuan", async () => {
    const t = await createTag({ name: "X" + Math.random() }, admin);
    await expect(mergeTags(t.id, t.id, admin)).rejects.toThrow();
  });

  it("menolak bila label tak ditemukan & tak mengubah apa pun", async () => {
    const t = await createTag({ name: "Y" + Math.random() }, admin);
    await expect(mergeTags(crypto.randomUUID(), t.id, admin)).rejects.toThrow();
    expect((await listTags()).map((x) => x.id)).toContain(t.id);
  });
});
