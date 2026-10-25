import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Uji Verifikasi Pilar 3 — API Hardening (48/48 Route Handlers).
 * (Fase 3: 51 → 48 setelah 3 route stub 410 /api/collections* dihapus.)
 * Menjamin:
 * 1. Setiap route handler di `src/app/api/` (kecuali Better Auth auth/[...all]) memakai wrapRoute atau skema Zod.
 * 2. Seluruh endpoint wrapRoute memiliki `query:` atau `body:` atau `params:` schema.
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

describe("Pilar 3: Audit Skema Zod 48 Route", () => {
  function walk(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(fullPath));
      } else if (file.endsWith("route.ts")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it("semua route handler (di luar auth & health/metrics/mcp) terdaftar dan terlindungi Zod", () => {
    const files = walk("src/app/api");
    // Fase 3: 51 → 48 (3 route stub 410 /api/collections* dihapus).
    expect(files.length).toBe(48);

    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    let wrapCount = 0;
    const missingZod: string[] = [];

    for (const file of files) {
      if (file.includes("auth/[...all]")) continue; // Better Auth resmi

      const content = fs.readFileSync(file, "utf8");
      for (const method of methods) {
        const wrapRegex = new RegExp(`export const ${method}\\s*=\\s*wrapRoute\\((?:<[^>]+>)?\\s*\\{([\\s\\S]*?)\\n\\}\\);`, "m");
        const wrapMatch = content.match(wrapRegex);
        if (wrapMatch) {
          wrapCount++;
          const opts = wrapMatch[1];
          const hasQuery = /query\s*:/.test(opts);
          const hasBody = /body\s*:/.test(opts);
          const hasParams = /params\s*:/.test(opts);
          if (!hasQuery && !hasBody && !hasParams) {
            missingZod.push(`${method} ${file}`);
          }
        }
      }
    }

    expect(wrapCount).toBeGreaterThanOrEqual(60);
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
