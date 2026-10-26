import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Regresi otorisasi jalur INGEST (CONSTRAINT #35/#37) — lewat ROUTE, bukan service.
 *
 * Dua cacat hidup yang ditutup Fase A:
 *  1. `machine` ditolak 403 pada antreannya SENDIRI — `GET /api/ingest/queue`
 *     memakai `question:view`, sedangkan `PERMISSIONS["question:view"].machine`
 *     bernilai `no`. Perbaikan: izin khusus `ingest:queue:read`.
 *  2. Melonggarkan `question:view` untuk machine akan membuka SELURUH bank soal
 *     ke mesin — tes terakhir di bawah menjaga agar itu tidak terjadi.
 *
 * Kenapa lewat route: cacat kelas ini hanya muncul di jalur nyata
 * (`wrapRoute` → handler), bukan saat memanggil service langsung.
 */

const url = process.env.TEST_DATABASE_URL; // wajib eksplisit: jangan fallback ke DATABASE_URL
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

const machine: Actor = {
  id: "ingest-authz-machine",
  name: "Mesin Ingest",
  roles: ["machine"],
  via: "apikey",
};
let mockActor: Actor = machine;
vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => mockActor }));

const { GET: queueGET } = await import("@/app/api/ingest/queue/route");
const { POST: uploadPOST } = await import("@/app/api/ingest/upload/route");
const { GET: questionsGET } = await import("@/app/api/questions/route");

const TITLE_PREFIX = "Uji ingest-authz ";

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Isi unik per panggilan — dedup `enqueue` memakai hash `rawContent`. */
function uniqueArticle(): { title: string; rawContent: string } {
  const token = Math.random().toString(36).slice(2, 10);
  return {
    title: `${TITLE_PREFIX}${token}`,
    rawContent: `<article><h2>Uji ${token}</h2><p>Isi uji otorisasi ingest.</p></article>`,
  };
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(() => {
  mockActor = machine;
});
afterAll(async () => {
  await sql`DELETE FROM ingest_queue WHERE title LIKE ${TITLE_PREFIX + "%"}`;
  await sql.end();
});

describe("Otorisasi jalur ingest — peran `machine`", () => {
  it("machine GET /api/ingest/queue → 200 (antreannya sendiri)", async () => {
    const res = await queueGET(req("GET", "/api/ingest/queue?limit=5"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.counts).toBeTypeOf("object");
  });

  it("machine POST /api/ingest/upload → 201 (menghasilkan draft)", async () => {
    const article = uniqueArticle();
    const res = await uploadPOST(
      req("POST", "/api/ingest/upload", {
        title: article.title,
        source: "uji",
        rawContent: article.rawContent,
        format: "html",
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBeTypeOf("string");
    expect(json.data.status).toBe("pending");
  });

  it("machine GET /api/questions → 403 (question:view TETAP tertutup untuk mesin)", async () => {
    const res = await questionsGET(req("GET", "/api/questions?limit=1"));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBeTypeOf("string");
    expect(json.data).toBeUndefined(); // CONSTRAINT #17: error tak boleh membawa data
  });
});
