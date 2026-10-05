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
  BadRequestError,
  UnsupportedMediaTypeError,
  PayloadTooLargeError,
} from "@/lib/auth/guards";
import { InvalidTransitionError, NotReadyError } from "@/lib/fsm/question-fsm";
import { MemoryStore, setStore } from "./rate-limit";
import {
  MemoryStore as IdemMemoryStore,
  setIdempotencyStore,
} from "./idempotency";

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
  setStore(new MemoryStore()); // reset rate limiter antar-tes
  setIdempotencyStore(new IdemMemoryStore()); // reset idempotensi antar-tes
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
    ["400 BadRequest (API-04)", new BadRequestError("muatan salah"), 400],
    ["413 PayloadTooLarge (API-04)", new PayloadTooLargeError("terlalu besar"), 413],
    ["415 UnsupportedMediaType (API-04)", new UnsupportedMediaTypeError("tipe salah"), 415],
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

  it("400 INVALID_JSON saat body bukan JSON (bukan diam-diam {}) [D9]", async () => {
    const handler = wrapRoute({
      body: z.object({ name: z.string() }),
      handler: async () => ({ ok: true }),
    });
    const res = await handler(
      req("http://localhost/api/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ bukan json",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("INVALID_JSON");
  });

  it("body kosong → {}(tanpa error) lalu Zod yang menilai", async () => {
    const handler = wrapRoute({
      body: z.object({ name: z.string().optional() }),
      handler: async ({ body }) => body,
    });
    const res = await handler(req("http://localhost/api/x", { method: "POST" }));
    expect(res.status).toBe(200);
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

  it("mustChangePassword → 403 PASSWORD_CHANGE_REQUIRED", async () => {
    resolveActorMock.mockResolvedValue({
      ...adminActor(),
      mustChangePassword: true,
    });
    const handler = wrapRoute({ handler: async () => ({}) });
    const res = await handler(req());
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("allowPasswordChangePending → tetap boleh (mis. /api/auth/me)", async () => {
    resolveActorMock.mockResolvedValue({
      ...adminActor(),
      mustChangePassword: true,
    });
    const handler = wrapRoute({
      allowPasswordChangePending: true,
      handler: async ({ actor }) => ({
        mustChangePassword: actor.mustChangePassword,
      }),
    });
    const res = await handler(req());
    expect(res.status).toBe(200);
    expect((await res.json()).data.mustChangePassword).toBe(true);
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

describe("wrapRoute — rate limiting", () => {
  it("menolak dengan 429 setelah kapasitas habis (+ header Retry-After)", async () => {
    resolveActorMock.mockResolvedValue(adminActor());
    const handler = wrapRoute({
      rateLimit: { capacity: 2, refillPerSec: 1 },
      handler: async () => ({ ok: true }),
    });
    expect((await handler(req())).status).toBe(200);
    expect((await handler(req())).status).toBe(200);
    const limited = await handler(req());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    const json = await limited.json();
    expect(json.error.code).toBe("RATE_LIMITED");
  });

  it("tanpa opsi rateLimit → tak dibatasi", async () => {
    const handler = wrapRoute({ handler: async () => ({ ok: true }) });
    for (let i = 0; i < 100; i++) {
      expect((await handler(req())).status).toBe(200);
    }
  });

  it("bucket terpisah per aktor (satu kena limit, lain tidak)", async () => {
    const handler = wrapRoute({
      rateLimit: { capacity: 1, refillPerSec: 1 },
      handler: async () => ({ ok: true }),
    });
    resolveActorMock.mockResolvedValue(adminActor()); // id u1
    expect((await handler(req())).status).toBe(200);
    expect((await handler(req())).status).toBe(429);
    resolveActorMock.mockResolvedValue({ ...adminActor(), id: "u2" });
    expect((await handler(req())).status).toBe(200); // bucket u2 masih penuh
  });
});

describe("ok() — respons sukses manual", () => {
  it("membungkus {data} dengan status", async () => {
    const res = ok({ a: 1 }, 202);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ data: { a: 1 } });
  });
});

describe("#6 — X-Request-ID (traceability)", () => {
  it("menyertakan X-Request-ID pada respons sukses", async () => {
    const handler = wrapRoute({ handler: async () => ({ ok: true }) });
    const res = await handler(req());
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("meneruskan X-Request-ID dari header masuk", async () => {
    const handler = wrapRoute({ handler: async () => ({ ok: true }) });
    const res = await handler(
      req("http://localhost/api/x", { headers: { "x-request-id": "trace-abc-123" } }),
    );
    expect(res.headers.get("x-request-id")).toBe("trace-abc-123");
  });

  it("menyertakan X-Request-ID pada respons error (401)", async () => {
    resolveActorMock.mockResolvedValue(null);
    const handler = wrapRoute({ handler: async () => ({}) });
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});

describe("#4 — Idempotency-Key (anti double-submit)", () => {
  it("permintaan kedua dgn key sama → replay (handler TAK jalan 2×)", async () => {
    let calls = 0;
    const handler = wrapRoute({
      idempotent: true,
      handler: async () => ({ n: ++calls }),
    });
    const h = { "idempotency-key": "k-1" };
    const r1 = await handler(req("http://localhost/api/x", { headers: h }));
    const r2 = await handler(req("http://localhost/api/x", { headers: h }));
    expect(calls).toBe(1); // handler hanya sekali
    expect(r2.headers.get("idempotent-replay")).toBe("true");
    expect(await r1.json()).toEqual(await r2.json());
  });

  it("key berbeda → handler jalan lagi", async () => {
    let calls = 0;
    const handler = wrapRoute({
      idempotent: true,
      handler: async () => ({ n: ++calls }),
    });
    await handler(req("http://localhost/api/x", { headers: { "idempotency-key": "a" } }));
    await handler(req("http://localhost/api/x", { headers: { "idempotency-key": "b" } }));
    expect(calls).toBe(2);
  });

  it("tanpa header key → tak ada efek samping idempotensi", async () => {
    let calls = 0;
    const handler = wrapRoute({
      idempotent: true,
      handler: async () => ({ n: ++calls }),
    });
    await handler(req());
    await handler(req());
    expect(calls).toBe(2);
  });
});
