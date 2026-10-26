import { describe, it, expect, vi } from "vitest";
import { MANUAL_ROUTES, scanRoutes } from "./route-inventory";

/**
 * Uji Verifikasi Pilar 3 — API Hardening.
 *
 * Angka route TIDAK ditulis di sini: daftar method diturunkan dari filesystem
 * lewat `scanRoutes()` (src/lib/api/route-inventory.ts), sehingga menambah route
 * tidak menuntut menyunting tes. Sebelumnya tes ini memakai angka 48/60 dan
 * regex `wrapRoute({([\s\S]*?)\n});` yang berhenti di `});` pertama.
 *
 * Menjamin:
 * 1. Setiap method memakai `wrapRoute` atau terdaftar di `MANUAL_ROUTES` beralasan.
 * 2. Seluruh method `wrapRoute` memiliki `query`/`body`/`params` schema.
 * 3. Parameter rute dinamis (UUID) yang tidak sah menghasilkan HTTP 400 { error: { code: "VALIDATION_ERROR" } }.
 */

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/services/audit", () => ({
  recordViewAudit: vi.fn(async () => {}),
  recordAudit: vi.fn(async () => {}),
}));

// Mock resolveActor agar handler dapat diuji tanpa autentikasi nyata
vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: async () => ({
    id: "018f0000-0000-7000-8000-000000000001",
    name: "Admin Tester",
    roles: ["admin"],
    via: "session",
  }),
  actorFromApiKey: async () => null,
  actorFromSession: async () => null,
}));

vi.mock("@/lib/services/question-service", () => ({
  getQuestion: vi.fn(async () => null),
  updateQuestion: vi.fn(async () => ({ ok: true })),
  deleteQuestion: vi.fn(async () => ({ ok: true })),
  hardDeleteQuestion: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/services/bundle-service", () => ({
  getBundle: vi.fn(async () => null),
  listBundleItems: vi.fn(async () => []),
  archiveBundle: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/services/topic-service", () => ({
  getTopic: vi.fn(async () => null),
  updateTopic: vi.fn(async () => ({ ok: true })),
  deleteTopic: vi.fn(async () => ({ ok: true })),
}));

describe("Pilar 3: Audit Skema Zod Route", () => {
  it("setiap method memakai wrapRoute atau pengecualian beralasan, dan punya skema", () => {
    const routes = scanRoutes();
    expect(routes.length).toBeGreaterThan(0);

    const methods = routes.flatMap((r) => r.methods);
    const wrapped = methods.filter((m) => m.shape === "wrap");
    expect(wrapped.length).toBeGreaterThan(0);

    // Relasional, bukan angka: seluruh method non-wrap WAJIB punya alasan
    // tertulis; sisanya WAJIB lewat wrapRoute.
    const unexplained = methods
      .filter((m) => m.shape !== "wrap")
      .filter((m) => !(`${m.method} ${m.path}` in MANUAL_ROUTES))
      .map((m) => `${m.method} ${m.path}`);
    expect(unexplained).toEqual([]);

    // Setiap method wrapRoute WAJIB punya skema Zod di boundary (CONSTRAINT #22).
    const missingZod = wrapped
      .filter((m) => !m.hasSchema)
      .map((m) => `${m.method} ${m.path}`);
    expect(missingZod).toEqual([]);
  });

  it("GET /api/questions/[id] menolak UUID cacat dengan 400 VALIDATION_ERROR", async () => {
    const { GET } = await import("@/app/api/questions/[id]/route");
    const req = new Request("http://localhost/api/questions/bukan-uuid");
    const res = await GET(req, { params: Promise.resolve({ id: "bukan-uuid" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("DELETE /api/questions/[id] menolak UUID cacat dengan 400 VALIDATION_ERROR", async () => {
    const { DELETE } = await import("@/app/api/questions/[id]/route");
    const req = new Request("http://localhost/api/questions/bukan-uuid", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "bukan-uuid" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/bundles/[id] menolak UUID cacat dengan 400 VALIDATION_ERROR", async () => {
    const { GET } = await import("@/app/api/bundles/[id]/route");
    const req = new Request("http://localhost/api/bundles/bukan-uuid");
    const res = await GET(req, { params: Promise.resolve({ id: "bukan-uuid" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /api/topics/[id] menolak UUID cacat dengan 400 VALIDATION_ERROR", async () => {
    const { GET } = await import("@/app/api/topics/[id]/route");
    const req = new Request("http://localhost/api/topics/bukan-uuid");
    const res = await GET(req, { params: Promise.resolve({ id: "bukan-uuid" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/bundles/[id]/export/moodle menolak UUID cacat dengan 400 VALIDATION_ERROR", async () => {
    const { POST } = await import("@/app/api/bundles/[id]/export/moodle/route");
    const req = new Request("http://localhost/api/bundles/bukan-uuid/export/moodle", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "bukan-uuid" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
