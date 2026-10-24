import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes otorisasi ROUTE soal (CONSTRAINT #37 + regresi #35).
 *
 * Kenapa berkas terpisah: bug kelas #35 (gerbang `permission` ber-`own` tanpa
 * `ownerId` → guru selalu 403) HANYA muncul saat memanggil **route handler**
 * lewat `wrapRoute`, bukan lewat service. Berkas ini mengunci perilaku itu agar
 * tak kambuh (dulu sempat kambuh: T-M4-3).
 *
 * Matriks yang diuji (via jalur NYATA: route + wrapRoute + DB uji):
 *   - guru PATCH/DELETE soal MILIKNYA         → 200 (dulu 403 — BUG)
 *   - guru PATCH/DELETE soal ORANG LAIN       → 403/404 (ditolak service, #35)
 *   - agen DELETE soal                        → 4xx (agent: delete = "no")
 *   - admin PATCH/DELETE soal siapa pun       → 200
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: JANGAN fallback ke DATABASE_URL (cegah tes menulis ke DB dev/prod)
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

let mockActor: Actor = { id: "authz-teacher", name: "Guru", roles: ["teacher"], via: "session" };
vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => mockActor }));

const { PATCH, DELETE, GET } = await import("@/app/api/questions/[id]/route");
const { PATCH: PATCH_FLAG } = await import("@/app/api/questions/[id]/flag/route");

const TEACHER = "authz-teacher";
const OTHER = "authz-teacher-lain";
const admin: Actor = { id: "authz-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = { id: TEACHER, name: "Guru", roles: ["teacher"], via: "session" };
const agent: Actor = { id: "authz-agent", name: "Agen", roles: ["agent"], via: "session" };

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Sisipkan soal langsung (hindari kompleksitas payload POST) → id. */
async function seedQuestion(authorId: string): Promise<string> {
  const [row] = await sql`
    INSERT INTO questions (author_id, question_type, difficulty, cognitive_level, grade, content_markdown, status)
    VALUES (${authorId}, 'single_choice', 2, 'understand', 'Kelas 10', 'soal uji', 'draft')
    RETURNING id`;
  return row.id as string;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  await sql`DELETE FROM questions WHERE author_id LIKE 'authz-%'`;
});
afterAll(async () => {
  await sql`DELETE FROM questions WHERE author_id LIKE 'authz-%'`;
  await sql.end();
});

describe("Otorisasi route soal (#35/#37)", () => {
  it("guru PATCH soal MILIKNYA → 200 (regresi bug #35)", async () => {
    const id = await seedQuestion(TEACHER);
    mockActor = teacher;
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "diubah guru" }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const [row] = await sql`SELECT content_markdown FROM questions WHERE id = ${id}`;
    expect(row.content_markdown).toBe("diubah guru");
  });

  it("guru DELETE soal MILIKNYA → 200 (regresi bug #35)", async () => {
    const id = await seedQuestion(TEACHER);
    mockActor = teacher;
    const res = await DELETE(req("DELETE", `/api/questions/${id}`), ctx(id));
    expect(res.status).toBe(200);
    const [row] = await sql`SELECT deleted_at FROM questions WHERE id = ${id}`;
    expect(row.deleted_at).not.toBeNull();
  });

  it("guru PATCH soal ORANG LAIN → ditolak (bukan 200)", async () => {
    const id = await seedQuestion(OTHER);
    mockActor = teacher;
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "coba ubah" }),
      ctx(id),
    );
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  it("guru DELETE soal ORANG LAIN → ditolak (bukan 200)", async () => {
    const id = await seedQuestion(OTHER);
    mockActor = teacher;
    const res = await DELETE(req("DELETE", `/api/questions/${id}`), ctx(id));
    expect(res.status).not.toBe(200);
    expect([403, 404]).toContain(res.status);
  });

  it("agen DELETE soal → 4xx (agent: question:delete = 'no')", async () => {
    const id = await seedQuestion(TEACHER);
    mockActor = agent;
    const res = await DELETE(req("DELETE", `/api/questions/${id}`), ctx(id));
    expect([403, 404]).toContain(res.status);
  });

  it("admin PATCH soal milik guru lain → 200", async () => {
    const id = await seedQuestion(OTHER);
    mockActor = admin;
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "admin ubah" }),
      ctx(id),
    );
    expect(res.status).toBe(200);
  });

  it("GET tetap hidup untuk guru (200/404, bukan 403) di soal miliknya", async () => {
    const id = await seedQuestion(TEACHER);
    mockActor = teacher;
    const res = await GET(req("GET", `/api/questions/${id}`), ctx(id));
    expect([200, 404]).toContain(res.status);
  });

  it("guru PATCH flag soal MILIKNYA → 200 (Constraint #35)", async () => {
    const id = await seedQuestion(TEACHER);
    mockActor = teacher;
    const res = await PATCH_FLAG(
      req("PATCH", `/api/questions/${id}/flag`, { flagged: true, notes: "perlu revisi" }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const [row] = await sql`SELECT is_flagged, flag_notes FROM questions WHERE id = ${id}`;
    expect(row.is_flagged).toBe(true);
    expect(row.flag_notes).toBe("perlu revisi");
  });

  it("guru PATCH flag soal ORANG LAIN → 403", async () => {
    const id = await seedQuestion(OTHER);
    mockActor = teacher;
    const res = await PATCH_FLAG(
      req("PATCH", `/api/questions/${id}/flag`, { flagged: true, notes: "coba flag" }),
      ctx(id),
    );
    expect(res.status).toBe(403);
  });
});
