import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Regresi matriks izin pada jalur ROUTE (CONSTRAINT #35/#37) — Fase A.
 *
 * Sebelum perbaikan, `taxonomy:manage` & `reference:manage` bernilai `own`
 * padahal tabel `topics`/`tags`/`sources`/`events` TIDAK punya kolom pemilik.
 * `assertCan(actor, perm)` di gerbang route dipanggil tanpa `ownerId`, sehingga
 * `own` selalu ditolak: 14 endpoint mengembalikan 403 ke guru/penelaah/agen.
 * Perbaikan: kedua izin menjadi `yes` (tabelnya memang bukan milik siapa pun).
 *
 * Tes ini menjaga DUA arah:
 *  - guru/agen sekarang BOLEH (bug tertutup), dan
 *  - `machine` TETAP ditolak untuk `reference:manage` (jangan ikut dilonggarkan).
 */

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const teacher: Actor = { id: "ref-authz-teacher", name: "Guru", roles: ["teacher"], via: "session" };
const agent: Actor = { id: "ref-authz-agent", name: "Agen", roles: ["agent"], via: "apikey" };
const machine: Actor = { id: "ref-authz-machine", name: "Mesin", roles: ["machine"], via: "apikey" };
let mockActor: Actor = teacher;
vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => mockActor }));

const { POST: createTopicRoute } = await import("@/app/api/topics/route");
const { PATCH: patchTopicRoute, DELETE: deleteTopicRoute } = await import(
  "@/app/api/topics/[id]/route",
);
const { POST: createSourceRoute } = await import("@/app/api/sources/route");

const PREFIX = "Uji ref-authz ";

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const token = () => Math.random().toString(36).slice(2, 10);

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(() => {
  mockActor = teacher;
});
afterAll(async () => {
  await sql`DELETE FROM topics WHERE name LIKE ${PREFIX + "%"}`;
  await sql`DELETE FROM sources WHERE label LIKE ${PREFIX + "%"}`;
  await sql.end();
});

describe("Taksonomi & referensi — `own` palsu sudah hilang (#35)", () => {
  it("guru POST /api/topics → 200 (dulu 403)", async () => {
    mockActor = teacher;
    const res = await createTopicRoute(
      req("POST", "/api/topics", { name: `${PREFIX}topik ${token()}` }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBeTypeOf("string");
  });

  it("guru PATCH /api/topics/[id] → 200 (dulu 403)", async () => {
    mockActor = teacher;
    const created = await createTopicRoute(
      req("POST", "/api/topics", { name: `${PREFIX}awal ${token()}` }),
    );
    const { data } = await created.json();

    const res = await patchTopicRoute(
      req("PATCH", `/api/topics/${data.id}`, { name: `${PREFIX}ubah ${token()}` }),
      ctx(data.id),
    );
    expect(res.status).toBe(200);
  });

  it("guru DELETE /api/topics/[id] → 200 (dulu 403)", async () => {
    mockActor = teacher;
    const created = await createTopicRoute(
      req("POST", "/api/topics", { name: `${PREFIX}hapus ${token()}` }),
    );
    const { data } = await created.json();

    const res = await deleteTopicRoute(req("DELETE", `/api/topics/${data.id}`), ctx(data.id));
    expect(res.status).toBe(200);
  });

  it("agen POST /api/sources → 200 (dulu 403)", async () => {
    mockActor = agent;
    const res = await createSourceRoute(
      req("POST", "/api/sources", {
        kind: "website",
        label: `${PREFIX}sumber ${token()}` ,
        url: "https://example.com/uji",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBeTypeOf("string");
  });

  it("machine POST /api/sources → 403 (reference:manage TETAP tertutup)", async () => {
    mockActor = machine;
    const res = await createSourceRoute(
      req("POST", "/api/sources", { kind: "website", label: `${PREFIX}mesin ${token()}` }),
    );
    expect(res.status).toBe(403);
  });
});
