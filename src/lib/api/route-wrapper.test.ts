import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { Actor } from "@/lib/auth/actor";

/**
 * Tes route-wrapper (L4) — pemetaan error & alur boilerplate.
 *
 * `resolveActor` di-mock agar tes tak menyentuh DB/HTTP. Yang diuji:
 * - alur sukses (parse query/body, params async, format {data})
 * - pemetaan SETIAP error ke kode HTTP yang benar
 * - format respons error seragam: { error: { code, message } }
 */

// Mock resolusi aktor (satu-satunya ketergantungan eksternal wrapper).
const resolveActorMock = vi.fn<() => Promise<Actor | null>>();
vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: () => resolveActorMock(),
}));

import { wrapRoute, ok } from "./route-wrapper";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/lib/auth/guards";
import { InvalidTransitionError, NotReadyError } from "@/lib/fsm/question-fsm";

/** Aktor admin (punya semua izin). */
function adminActor(): Actor {
  return { id: "u1", name: "Admin", roles: ["admin"], via: "session" };
}

/** Bangun Request GET dengan query opsional. */
function req(url = "http://localhost/api/x", init?: RequestInit): Request {
  return new Request(url, init);
}

beforeEach(() => {
  resolveActorMock.mockReset();
  resolveActorMock.mockResolvedValue(adminActor());
});

describe("wrapRoute — alur sukses", () => {
  it("mengembalikan {data} dengan status default 200", async () => {
    const handler = wrapRoute({
      handler: async () => ({ hello: "dunia" }),
    });
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: "dunia" } });
  });

  it("menghormati opts.status (mis. 201)", async () => {
    const handler = wrapRoute({ status: 201, handler: async () => ({ id: "x" }) });
    const res = await handler(req());
    expect(res.status).toBe(201);
  });

  it("mem-parse query string ke objek bertipe", async () => {
    const handler = wrapRoute({
      query: z.object({ page: z.coerce.number() }),
      handler: async ({ query }) => query,
    });
    const res = await handler(req("http://localhost/api/x?page=3"));
    expect((await res.json()).data).toEqual({ page: 3 });
  });

  it("mem-parse body JSON", async () => {
    const handler = wrapRoute({
      body: z.object({ name: z.string() }),
      handler: async ({ body }) => body,
    });
    const res = await handler(
      req("http://localhost/api/x", {
        method: "POST",
        body: JSON.stringify({ name: "Soal" }),
      }),
    );
    expect((await res.json()).data).toEqual({ name: "Soal" });
  });

  it("body kosong/invalid JSON → {} (tak melempar)", async () => {
    const handler = wrapRoute({
      body: z.object({ a: z.number().optional() }),
      handler: async ({ body }) => body,
    });
    const res = await handler(req("http://localhost/api/x", { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("menyelesaikan params rute dinamis (async, Next 15+)", async () => {
    const handler = wrapRoute({
      handler: async ({ params }) => params,
    });
    const res = await handler(req(), { params: Promise.resolve({ id: "42" }) });
    expect((await res.json()).data).toEqual({ id: "42" });
  });

  it("params tak diberikan → objek kosong", async () => {
    const handler = wrapRoute({ handler: async ({ params }) => params });
    const res = await handler(req());
    expect((await res.json()).data).toEqual({});
  });

  it("meneruskan actor ke handler", async () => {
    const handler = wrapRoute({ handler: async ({ actor }) => actor.id });
    const res = await handler(req());
    expect((await res.json()).data).toBe("u1");
  });
});

describe("wrapRoute — pemetaan error ke HTTP", () => {
  const cases: Array<[string, Error, number]> = [
    ["401 Unauthorized", new UnauthorizedError(), 401],
    ["403 Forbidden", new ForbiddenError("tak boleh"), 403],
    ["404 NotFound", new NotFoundError("hilang"), 404],
    ["409 Conflict", new ConflictError("bentrok"), 409],
    ["409 InvalidTransition", new InvalidTransitionError("draft", "ready"), 409],
    ["422 NotReady", new NotReadyError("belum siap"), 422],
  ];

  for (const [label, err, status] of cases) {
    it(`${label} → ${status} & format {error:{code,message}}`, async () => {
      const handler = wrapRoute({
        handler: async () => {
          throw err;
        },
      });
      const res = await handler(req());
      expect(res.status).toBe(status);
      const json = await res.json();
      expect(json.error).toHaveProperty("code");
      expect(json.error).toHaveProperty("message");
    });
  }

  it("400 VALIDATION_ERROR saat query tak valid (dengan details)", async () => {
    const handler = wrapRoute({
      query: z.object({ page: z.coerce.number().min(1) }),
      handler: async () => ({}),
    });
    const res = await handler(req("http://localhost/api/x?page=0"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(json.error.details)).toBe(true);
  });

  it("400 saat body tak valid", async () => {
    const handler = wrapRoute({
      body: z.object({ name: z.string() }),
      handler: async () => ({}),
    });
    const res = await handler(
      req("http://localhost/api/x", {
        method: "POST",
        body: JSON.stringify({ name: 123 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("500 INTERNAL_ERROR untuk error tak terduga", async () => {
    const handler = wrapRoute({
      handler: async () => {
        throw new Error("boom");
      },
    });
    const res = await handler(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR");
  });
});

describe("wrapRoute — autentikasi & izin", () => {
  it("resolveActor null → 401", async () => {
    resolveActorMock.mockResolvedValue(null);
    const handler = wrapRoute({ handler: async () => ({}) });
    expect((await handler(req())).status).toBe(401);
  });

  it("mustChangePassword → 403", async () => {
    resolveActorMock.mockResolvedValue({
      ...adminActor(),
      mustChangePassword: true,
    });
    const handler = wrapRoute({ handler: async () => ({}) });
    expect((await handler(req())).status).toBe(403);
  });

  it("izin kurang → 403 (assertCan)", async () => {
    resolveActorMock.mockResolvedValue({
      id: "a1",
      name: "Agen",
      roles: ["agent"],
      via: "apikey",
    });
    const handler = wrapRoute({
      permission: "question:setReady",
      handler: async () => ({ ok: true }),
    });
    expect((await handler(req())).status).toBe(403);
  });

  it("izin cukup → sukses", async () => {
    const handler = wrapRoute({
      permission: "question:view",
      handler: async () => ({ ok: true }),
    });
    expect((await handler(req())).status).toBe(200);
  });
});

describe("ok() — respons sukses manual", () => {
  it("membungkus {data} dengan status", async () => {
    const res = ok({ a: 1 }, 202);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ data: { a: 1 } });
  });
});
