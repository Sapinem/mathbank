import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { Actor } from "@/lib/auth/actor";

/**
 * Idempotensi — perilaku store memori + **fail-closed** di jalur nyata.
 *
 * ADR-0029: store bersama (PostgreSQL) bisa tak terjangkau. Saat itu terjadi,
 * permintaan dengan `Idempotency-Key` harus DITOLAK (503), bukan dijalankan
 * buta-buta — sebab kita tak bisa membuktikan ini bukan duplikat.
 */

const resolveActorMock = vi.fn<() => Promise<Actor | null>>();
vi.mock("@/lib/auth/resolve", () => ({
  resolveActor: () => resolveActorMock(),
}));

import { wrapRoute } from "./route-wrapper";
import {
  MemoryStore,
  setIdempotencyStore,
  type IdempotencyCheck,
  type IdempotencyStore,
} from "./idempotency";

const admin: Actor = { id: "u1", name: "Admin", roles: ["admin"], via: "session" };

beforeEach(() => {
  resolveActorMock.mockResolvedValue(admin);
  setIdempotencyStore(new MemoryStore());
});

describe("MemoryStore — klaim idempotensi", () => {
  it("fresh → in-flight → replay setelah diingat", async () => {
    const s = new MemoryStore();
    expect(await s.claim("k", "fp", 60_000)).toEqual({ kind: "fresh" });
    expect(await s.claim("k", "fp", 60_000)).toEqual({ kind: "in-flight" });
    await s.remember("k", 201, { data: { id: 1 } }, "fp", 60_000);
    expect(await s.claim("k", "fp", 60_000)).toEqual({
      kind: "replay",
      status: 201,
      body: { data: { id: 1 } },
    });
  });

  it("sidik jari berbeda → mismatch", async () => {
    const s = new MemoryStore();
    await s.claim("k", "fp-a", 60_000);
    await s.remember("k", 200, { data: 1 }, "fp-a", 60_000);
    expect(await s.claim("k", "fp-b", 60_000)).toEqual({ kind: "mismatch" });
  });

  it("entri kedaluwarsa boleh diklaim ulang", async () => {
    const s = new MemoryStore();
    await s.claim("k", "fp", 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await s.claim("k", "fp", 60_000)).toEqual({ kind: "fresh" });
  });

  it("forget membebaskan klaim", async () => {
    const s = new MemoryStore();
    await s.claim("k", "fp", 60_000);
    await s.forget("k");
    expect(await s.claim("k", "fp", 60_000)).toEqual({ kind: "fresh" });
  });
});

describe("wrapRoute — fail-closed saat store idempotensi mati", () => {
  /** Store yang selalu gagal, meniru DB tak terjangkau. */
  const broken: IdempotencyStore = {
    claim: async (): Promise<IdempotencyCheck> => {
      throw new Error("koneksi putus");
    },
    remember: async () => {},
    forget: async () => {},
  };

  const handler = wrapRoute(
    {
      authz: { kind: "authenticated" },
      rateLimit: false,
      idempotent: true,
      body: z.object({ x: z.number() }),
      handler: async () => ({ ok: true }),
    },
  );

  it("mengembalikan 503 IDEMPOTENCY_UNAVAILABLE dan tidak menjalankan handler", async () => {
    setIdempotencyStore(broken);
    let ran = false;
    const guarded = wrapRoute({
      authz: { kind: "authenticated" },
      rateLimit: false,
      idempotent: true,
      handler: async () => {
        ran = true;
        return { ok: true };
      },
    });

    const res = await guarded(
      new Request("http://localhost/api/x", {
        method: "POST",
        headers: { "idempotency-key": "k1", "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe("IDEMPOTENCY_UNAVAILABLE");
    expect(ran).toBe(false);
  });

  it("tanpa header Idempotency-Key store tak disentuh", async () => {
    setIdempotencyStore(broken);
    const res = await handler(
      new Request("http://localhost/api/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ x: 1 }),
      }),
    );
    expect(res.status).toBe(200);
  });
});
