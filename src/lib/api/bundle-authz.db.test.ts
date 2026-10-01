import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes otorisasi ROUTE bundle — regresi cacat "guru bisa menyentuh bundle guru lain".
 *
 * Kenapa berkas terpisah & lewat ROUTE (CONSTRAINTS #37): cacat kelas ini hanya
 * muncul di jalur nyata (`wrapRoute` → service), bukan saat memanggil service
 * langsung. Gerbang `permission: "bundle:manage"` bernilai "yes" untuk guru —
 * jadi ia TIDAK menolak lintas-pemilik; penolakan harus datang dari service
 * (`assertBundleWrite`, #35).
 *
 * Matriks yang diuji:
 *   - guru PATCH/DELETE bundle LATIHAN miliknya        → 200
 *   - guru PATCH/DELETE bundle LATIHAN orang lain      → 403  ← inti regresi
 *   - guru PATCH bundle KOLEKSI (type='source')        → 200  (arsip umum)
 *   - admin PATCH bundle latihan siapa pun             → 200
 *   - guru GET bundle latihan orang lain               → 200  (boleh MELIHAT)
 */

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 4 });

let mockActor: Actor = { id: "bauthz-teacher", name: "Guru", roles: ["teacher"], via: "session" };
vi.mock("@/lib/auth/resolve", () => ({ resolveActor: async () => mockActor }));

const { PATCH, DELETE, GET } = await import("@/app/api/bundles/[id]/route");

const TEACHER = "bauthz-teacher";
const OTHER = "bauthz-teacher-lain";
const admin: Actor = { id: "bauthz-admin", name: "Admin", roles: ["admin"], via: "session" };
const teacher: Actor = { id: TEACHER, name: "Guru", roles: ["teacher"], via: "session" };

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

/** Sisipkan bundle langsung → id. */
async function seedBundle(
  ownerId: string | null,
  bundleType: "source" | "exam" | "exercise",
): Promise<string> {
  const slug = `bauthz-${Math.random().toString(36).slice(2, 10)}`;
  const [row] = await sql`
    INSERT INTO bundles (title, slug, bundle_type, created_by_id)
    VALUES (${`Uji ${slug}`}, ${slug}, ${bundleType}, ${ownerId})
    RETURNING id`;
  return row.id as string;
}

beforeAll(async () => {
  await sql`SELECT 1`;
});
beforeEach(async () => {
  await sql`DELETE FROM bundles WHERE slug LIKE 'bauthz-%'`;
});
afterAll(async () => {
  await sql`DELETE FROM bundles WHERE slug LIKE 'bauthz-%'`;
  await sql.end();
});

describe("Otorisasi bundle — latihan 'own', koleksi umum (#35/#37)", () => {
  it("guru PATCH latihan MILIKNYA → 200", async () => {
    const id = await seedBundle(TEACHER, "exercise");
    mockActor = teacher;
    const res = await PATCH(req("PATCH", `/api/bundles/${id}`, { title: "Diubah guru" }), ctx(id));
    expect(res.status).toBe(200);
  });

  it("guru PATCH latihan ORANG LAIN → 403 (regresi)", async () => {
    const id = await seedBundle(OTHER, "exercise");
    mockActor = teacher;
    const res = await PATCH(req("PATCH", `/api/bundles/${id}`, { title: "Coba ubah" }), ctx(id));
    expect(res.status).toBe(403);
  });

  it("guru DELETE latihan ORANG LAIN → 403 (regresi)", async () => {
    const id = await seedBundle(OTHER, "exam");
    mockActor = teacher;
    const res = await DELETE(req("DELETE", `/api/bundles/${id}`), ctx(id));
    expect(res.status).toBe(403);
  });

  it("guru PATCH KOLEKSI (type='source') orang lain → 200 (arsip umum)", async () => {
    const id = await seedBundle(OTHER, "source");
    mockActor = teacher;
    const res = await PATCH(req("PATCH", `/api/bundles/${id}`, { title: "Koleksi diubah" }), ctx(id));
    expect(res.status).toBe(200);
  });

  it("admin PATCH latihan guru lain → 200", async () => {
    const id = await seedBundle(OTHER, "exercise");
    mockActor = admin;
    const res = await PATCH(req("PATCH", `/api/bundles/${id}`, { title: "Admin ubah" }), ctx(id));
    expect(res.status).toBe(200);
  });

  it("guru GET latihan orang lain → 200 (boleh MELIHAT, tak boleh ubah)", async () => {
    const id = await seedBundle(OTHER, "exercise");
    mockActor = teacher;
    const res = await GET(req("GET", `/api/bundles/${id}`), ctx(id));
    expect(res.status).toBe(200);
  });

  it("bundle TANPA pemilik: guru biasa → 403 (hanya admin)", async () => {
    const id = await seedBundle(null, "exercise");
    mockActor = teacher;
    const res = await PATCH(req("PATCH", `/api/bundles/${id}`, { title: "Coba" }), ctx(id));
    expect(res.status).toBe(403);
  });
});
