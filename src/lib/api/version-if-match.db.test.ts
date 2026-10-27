import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * ADR-0030 — konkurensi optimistik lewat `ETag` / `If-Match`.
 *
 * Yang dibuktikan di sini adalah PERILAKU HTTP-nya, bukan sekadar fungsi murni:
 *   - GET memancarkan ETag yang cocok dengan `version` di body;
 *   - mutasi tanpa If-Match → 428 (bukan diam-diam last-write-wins);
 *   - If-Match basi → 412 yang MEMBAWA versi terkini;
 *   - If-Match benar → 200 dan versi naik;
 *   - dua penulis bersamaan dengan versi sama → tepat satu yang lolos.
 *
 * KENAPA diuji lewat route, bukan service: jaminan 428 hidup di `wrapRoute`,
 * dan jaminan 412 hidup di `WHERE version = ?` di dalam transaksi. Hanya jalur
 * nyata yang memakai keduanya sekaligus.
 */

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

let mockActor: Actor = { id: "ver-teacher", name: "Guru", roles: ["teacher"], via: "session" };
vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => mockActor }));

const { GET, PATCH, DELETE } = await import("@/app/api/questions/[id]/route");

const TEACHER = "ver-teacher";
const teacher: Actor = { id: TEACHER, name: "Guru", roles: ["teacher"], via: "session" };

function req(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const base: Record<string, string> = {};
  if (body) base["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { ...base, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function seedQuestion(): Promise<string> {
  const [row] = await sql`
    INSERT INTO questions (author_id, question_type, difficulty, cognitive_level, grade, content_markdown, status)
    VALUES (${TEACHER}, 'single_choice', 2, 'understand', 'Kelas 10', 'soal versi', 'draft')
    RETURNING id`;
  return row.id as string;
}

/** Versi baris saat ini, dibaca langsung dari DB (sumber kebenaran). */
async function dbVersion(id: string): Promise<number> {
  const [row] = await sql`SELECT version FROM questions WHERE id = ${id}`;
  return Number(row.version);
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  await sql`DELETE FROM questions WHERE author_id = ${TEACHER}`;
  mockActor = teacher;
});
afterAll(async () => {
  await sql`DELETE FROM questions WHERE author_id = ${TEACHER}`;
  await sql.end();
});

describe("ETag pada GET", () => {
  it("memancarkan ETag yang cocok dengan version di body", async () => {
    const id = await seedQuestion();
    const res = await GET(req("GET", `/api/questions/${id}`), ctx(id));
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.version).toBe(1);
    expect(res.headers.get("etag")).toBe('"1"');
  });
});

describe("If-Match wajib (428)", () => {
  it("PATCH tanpa If-Match → 428 dan baris TIDAK berubah", async () => {
    const id = await seedQuestion();
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "tanpa if-match" }),
      ctx(id),
    );
    expect(res.status).toBe(428);
    expect((await res.json()).error.code).toBe("PRECONDITION_REQUIRED");

    const [row] = await sql`SELECT content_markdown, version FROM questions WHERE id = ${id}`;
    expect(row.content_markdown).toBe("soal versi");
    expect(Number(row.version)).toBe(1);
  });

  it("DELETE tanpa If-Match → 428 dan baris tetap ada", async () => {
    const id = await seedQuestion();
    const res = await DELETE(req("DELETE", `/api/questions/${id}`), ctx(id));
    expect(res.status).toBe(428);
    const [row] = await sql`SELECT deleted_at FROM questions WHERE id = ${id}`;
    expect(row.deleted_at).toBeNull();
  });
});

describe("If-Match basi (412)", () => {
  it("versi lama → 412 yang membawa currentVersion", async () => {
    const id = await seedQuestion();
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "basi" }, { "if-match": '"99"' }),
      ctx(id),
    );
    expect(res.status).toBe(412);
    const err = (await res.json()).error;
    expect(err.code).toBe("PRECONDITION_FAILED");
    expect(err.details.currentVersion).toBe(1);

    const [row] = await sql`SELECT content_markdown FROM questions WHERE id = ${id}`;
    expect(row.content_markdown).toBe("soal versi");
  });

  it("versi benar → 200, lalu versi LAMA ditolak 412 (bukti version naik)", async () => {
    const id = await seedQuestion();
    const first = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "ubah pertama" }, { "if-match": '"1"' }),
      ctx(id),
    );
    expect(first.status).toBe(200);
    expect((await first.json()).data.version).toBe(2);
    expect(await dbVersion(id)).toBe(2);

    const second = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "ubah kedua" }, { "if-match": '"1"' }),
      ctx(id),
    );
    expect(second.status).toBe(412);
  });
});

describe("bentuk header If-Match", () => {
  it("wildcard * diterima", async () => {
    const id = await seedQuestion();
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "wildcard" }, { "if-match": "*" }),
      ctx(id),
    );
    expect(res.status).toBe(200);
  });

  it("weak validator W/ ditolak 400 — If-Match memakai perbandingan kuat", async () => {
    const id = await seedQuestion();
    const res = await PATCH(
      req("PATCH", `/api/questions/${id}`, { contentMarkdown: "lemah" }, { "if-match": 'W/"1"' }),
      ctx(id),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_IF_MATCH");
  });
});

describe("dua penulis bersamaan", () => {
  it("dengan versi sama, tepat SATU yang lolos (yang lain 412)", async () => {
    const id = await seedQuestion();
    const [a, b] = await Promise.all([
      PATCH(
        req("PATCH", `/api/questions/${id}`, { contentMarkdown: "penulis A" }, { "if-match": '"1"' }),
        ctx(id),
      ),
      PATCH(
        req("PATCH", `/api/questions/${id}`, { contentMarkdown: "penulis B" }, { "if-match": '"1"' }),
        ctx(id),
      ),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 412]);
    expect(await dbVersion(id)).toBe(2);
  });
});
