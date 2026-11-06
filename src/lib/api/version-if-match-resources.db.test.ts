import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import type { Actor } from "@/lib/auth/actor";

/**
 * ADR-0030 — kontrak `If-Match` pada SELURUH resource berversi.
 *
 * `version-if-match.db.test.ts` membuktikan perilakunya untuk `questions` dan
 * `bundle-api.db.test.ts` untuk `bundles`. Enam resource lain ber-`ifMatch`
 * belum punya bukti sendiri, sehingga regresi di salah satunya (mis. lupa
 * `ifMatch: true` saat menambah route) tidak akan ketahuan.
 *
 * Setiap resource diuji tiga kali, dan ketiganya lewat jalur HTTP nyata:
 *   1. tanpa `If-Match`  → 428, baris tidak berubah;
 *   2. `If-Match` basi    → 412 yang membawa `currentVersion`;
 *   3. `If-Match` benar   → 200 dan versi di DB naik.
 *
 * KENAPA lewat route, bukan service: jaminan 428 hidup di `wrapRoute` dan 412
 * hidup di `WHERE version = ?`. Hanya jalur nyata yang memakai keduanya.
 */

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const admin: Actor = { id: "ver-res-admin", name: "Admin", roles: ["admin"], via: "session" };
let mockActor: Actor = admin;
vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => mockActor }));

const topics = await import("@/app/api/topics/[id]/route");
const tags = await import("@/app/api/tags/[id]/route");
const sources = await import("@/app/api/sources/[id]/route");
const events = await import("@/app/api/events/[id]/route");
const media = await import("@/app/api/media/[shortId]/route");
const agentKeys = await import("@/app/api/system/agent-keys/[id]/route");

const PREFIX = `occ-${randomUUID().slice(0, 8)}`;

function req(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const base: Record<string, string> = {};
  if (body !== undefined) base["content-type"] = "application/json";
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { ...base, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

/** Satu kasus uji = satu resource: seed, path, body PATCH, dan pembaca versi. */
interface ResourceCase {
  name: string;
  seed: () => Promise<string>;
  patch: (
    id: string,
    body: unknown,
    headers: Record<string, string>,
  ) => Promise<Response>;
  body: unknown;
  dbVersion: (id: string) => Promise<number>;
  cleanup: () => Promise<void>;
}

const cases: ResourceCase[] = [
  {
    name: "topics",
    seed: async () => {
      const [row] = await sql`
        INSERT INTO topics (name, level) VALUES (${PREFIX + " topik"}, 1)
        RETURNING id`;
      return row.id as string;
    },
    patch: (id, body, headers) =>
      topics.PATCH(req("PATCH", `/api/topics/${id}`, body, headers), ctx({ id })),
    body: { name: PREFIX + " topik baru" },
    dbVersion: async (id) => {
      const [row] = await sql`SELECT version FROM topics WHERE id = ${id}`;
      return Number(row.version);
    },
    cleanup: async () => {
      await sql`DELETE FROM topics WHERE name LIKE ${PREFIX + "%"}`;
    },
  },
  {
    name: "tags",
    seed: async () => {
      const [row] = await sql`
        INSERT INTO tags (name) VALUES (${`${PREFIX}-tag-${randomUUID().slice(0, 8)}`})
        RETURNING id`;
      return row.id as string;
    },
    patch: (id, body, headers) =>
      tags.PATCH(req("PATCH", `/api/tags/${id}`, body, headers), ctx({ id })),
    body: { name: PREFIX + " tag baru" },
    dbVersion: async (id) => {
      const [row] = await sql`SELECT version FROM tags WHERE id = ${id}`;
      return Number(row.version);
    },
    cleanup: async () => {
      await sql`DELETE FROM tags WHERE name LIKE ${PREFIX + "%"}`;
    },
  },
  {
    name: "sources",
    seed: async () => {
      const [row] = await sql`
        INSERT INTO sources (kind, label) VALUES ('book', ${PREFIX + " sumber"})
        RETURNING id`;
      return row.id as string;
    },
    patch: (id, body, headers) =>
      sources.PATCH(req("PATCH", `/api/sources/${id}`, body, headers), ctx({ id })),
    body: { label: PREFIX + " sumber baru" },
    dbVersion: async (id) => {
      const [row] = await sql`SELECT version FROM sources WHERE id = ${id}`;
      return Number(row.version);
    },
    cleanup: async () => {
      await sql`DELETE FROM sources WHERE label LIKE ${PREFIX + "%"}`;
    },
  },
  {
    name: "events",
    seed: async () => {
      // `code` unik per baris; tiap `it` melakukan seed sendiri.
      const code = `OCC${randomUUID().replace(/-/g, "").slice(0, 10)}`;
      const [row] = await sql`
        INSERT INTO events (name, shortname, fullname, code, category)
        VALUES (${PREFIX + " event"}, ${code}, ${PREFIX + " lengkap"}, ${code}, 'ujian')
        RETURNING id`;
      return row.id as string;
    },
    patch: (id, body, headers) =>
      events.PATCH(req("PATCH", `/api/events/${id}`, body, headers), ctx({ id })),
    body: { name: PREFIX + " event baru" },
    dbVersion: async (id) => {
      const [row] = await sql`SELECT version FROM events WHERE id = ${id}`;
      return Number(row.version);
    },
    cleanup: async () => {
      await sql`DELETE FROM events WHERE name LIKE ${PREFIX + "%"}`;
    },
  },
  {
    name: "media",
    seed: async () => {
      // short_id wajib 8 karakter alfanumerik (CHECK di DB).
      const shortId = `Occ${randomUUID().replace(/-/g, "").slice(0, 5)}`;
      const [row] = await sql`
        INSERT INTO media_assets (title, short_id)
        VALUES (${PREFIX + " media"}, ${shortId})
        RETURNING short_id`;
      return row.short_id as string;
    },
    patch: (id, body, headers) =>
      media.PATCH(req("PATCH", `/api/media/${id}`, body, headers), ctx({ shortId: id })),
    body: { title: PREFIX + " media baru" },
    dbVersion: async (id) => {
      const [row] = await sql`SELECT version FROM media_assets WHERE short_id = ${id}`;
      return Number(row.version);
    },
    cleanup: async () => {
      await sql`DELETE FROM media_assets WHERE title LIKE ${PREFIX + "%"}`;
    },
  },
];

beforeAll(async () => {
  await sql`SELECT 1`;
});

beforeEach(() => {
  mockActor = admin;
});

afterAll(async () => {
  for (const c of cases) await c.cleanup();
  if (createdKeyIds.length > 0) {
    await sql`DELETE FROM apikey WHERE id = ANY(${createdKeyIds}::text[])`;
  }
  await sql.end();
});

describe.each(cases)("If-Match — $name", (c) => {
  it("tanpa If-Match → 428 dan baris TIDAK berubah", async () => {
    const id = await c.seed();
    const res = await c.patch(id, c.body, {});
    expect(res.status).toBe(428);
    expect((await res.json()).error.code).toBe("PRECONDITION_REQUIRED");
    expect(await c.dbVersion(id)).toBe(1);
  });

  it("If-Match basi → 412 yang membawa currentVersion", async () => {
    const id = await c.seed();
    const res = await c.patch(id, c.body, { "if-match": '"9999"' });
    expect(res.status).toBe(412);
    const err = (await res.json()).error;
    expect(err.code).toBe("PRECONDITION_FAILED");
    expect(err.details.currentVersion).toBe(1);
    expect(await c.dbVersion(id)).toBe(1);
  });

  it("If-Match benar → 200 dan versi naik", async () => {
    const id = await c.seed();
    const res = await c.patch(id, c.body, { "if-match": '"1"' });
    expect(res.status).toBe(200);
    expect(await c.dbVersion(id)).toBe(2);
  });
});

/** Key yang dibuat tes ini — dibersihkan selektif agar tak menyentuh key milik tes lain. */
const createdKeyIds: string[] = [];

describe("If-Match — apikey (DELETE saja)", () => {
  /**
   * `revokeAgentKey` hanya mencabut key milik akun agen (`agent@mathbank.local`),
   * jadi seed WAJIB memakai pemilik itu — bukan user sembarang, yang akan
   * menghasilkan 404 dan menyamarkan perilaku 412/428 yang sedang diuji.
   */
  async function seedKey(): Promise<string> {
    const [owner] = await sql`SELECT id FROM "user" WHERE email = 'agent@mathbank.local'`;
    let ownerId = owner?.id as string | undefined;
    if (!ownerId) {
      ownerId = randomUUID();
      await sql`
        INSERT INTO "user" (id, name, email)
        VALUES (${ownerId}, 'Agent', 'agent@mathbank.local')`;
    }
    const id = randomUUID();
    await sql`
      INSERT INTO apikey (id, reference_id, key) VALUES (${id}, ${ownerId}, ${randomUUID()})`;
    createdKeyIds.push(id);
    return id;
  }

  it("tanpa If-Match → 428 dan key tetap ada", async () => {
    const id = await seedKey();
    const res = await agentKeys.DELETE(req("DELETE", `/api/system/agent-keys/${id}`), ctx({ id }));
    expect(res.status).toBe(428);
    expect((await res.json()).error.code).toBe("PRECONDITION_REQUIRED");
    const [row] = await sql`SELECT count(*)::int AS n FROM apikey WHERE id = ${id}`;
    expect(row.n).toBe(1);
  });

  it("If-Match basi → 412 dan key tetap ada", async () => {
    const id = await seedKey();
    const res = await agentKeys.DELETE(
      req("DELETE", `/api/system/agent-keys/${id}`, undefined, { "if-match": '"9999"' }),
      ctx({ id }),
    );
    expect(res.status).toBe(412);
    expect((await res.json()).error.code).toBe("PRECONDITION_FAILED");
    const [row] = await sql`SELECT count(*)::int AS n FROM apikey WHERE id = ${id}`;
    expect(row.n).toBe(1);
  });

  it("If-Match benar → 200 dan key tercabut", async () => {
    const id = await seedKey();
    const res = await agentKeys.DELETE(
      req("DELETE", `/api/system/agent-keys/${id}`, undefined, { "if-match": '"1"' }),
      ctx({ id }),
    );
    expect(res.status).toBe(200);
    const [row] = await sql`SELECT count(*)::int AS n FROM apikey WHERE id = ${id}`;
    expect(row.n).toBe(0);
  });
});
