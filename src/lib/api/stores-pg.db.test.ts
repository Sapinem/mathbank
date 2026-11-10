import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { PgRateLimitStore } from "./rate-limit-store-pg";
import { PgIdempotencyStore } from "./idempotency-store-pg";

/**
 * Store bersama (ADR-0029) — diuji terhadap PostgreSQL NYATA.
 *
 * Yang dibuktikan di sini tak bisa dibuktikan `MemoryStore`:
 *  1. token bucket dihitung ATOMIK di SQL (20 permintaan paralel, kapasitas 5
 *     → tepat 5 lolos);
 *  2. klaim idempotensi atomik (dua klaim paralel → satu `fresh`);
 *  3. rate limit **fail-open** saat DB tak terjangkau.
 */

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL wajib untuk tes integrasi (DB uji).");
const sql = postgres(url, { max: 8 });
const db = drizzle(sql, { schema, casing: "snake_case" });

const rateLimit = new PgRateLimitStore(db);
const idempotency = new PgIdempotencyStore(db);

beforeEach(async () => {
  await sql`DELETE FROM rate_limit_buckets`;
  await sql`DELETE FROM idempotency_keys`;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

describe("PgRateLimitStore", () => {
  it("mengizinkan sampai kapasitas lalu menolak", async () => {
    const now = 1_700_000_000_000;
    const opts = { capacity: 3, refillPerSec: 1, now };
    expect((await rateLimit.take("k", opts)).allowed).toBe(true);
    expect((await rateLimit.take("k", opts)).allowed).toBe(true);
    expect((await rateLimit.take("k", opts)).allowed).toBe(true);
    const denied = await rateLimit.take("k", opts);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("mengisi ulang token seiring waktu", async () => {
    const now = 1_700_000_000_000;
    const opts = { capacity: 1, refillPerSec: 1, now };
    expect((await rateLimit.take("k", opts)).allowed).toBe(true);
    expect((await rateLimit.take("k", opts)).allowed).toBe(false);
    expect((await rateLimit.take("k", { ...opts, now: now + 1000 })).allowed).toBe(true);
  });

  it("tidak pernah melebihi kapasitas walau lama menganggur", async () => {
    const now = 1_700_000_000_000;
    const r = await rateLimit.take("k", { capacity: 5, refillPerSec: 10, now });
    expect(r.remaining).toBe(4);
  });

  it("ATOMIK: 20 permintaan paralel, kapasitas 5 → tepat 5 lolos", async () => {
    const now = 1_700_000_000_000;
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        rateLimit.take("race", { capacity: 5, refillPerSec: 0.001, now }),
      ),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("fail-OPEN saat DB tak terjangkau", async () => {
    const broken = new PgRateLimitStore({
      execute: async () => {
        throw new Error("koneksi putus");
      },
    } as never);
    const r = await broken.take("k", { capacity: 1, refillPerSec: 1, now: Date.now() });
    expect(r.allowed).toBe(true);
  });

  it("prune membuang bucket menganggur > 1 jam", async () => {
    const now = 1_700_000_000_000;
    await rateLimit.take("lama", { capacity: 1, refillPerSec: 1, now });
    await rateLimit.prune(now + 3_600_001);
    const rows = await sql`SELECT count(*)::int AS n FROM rate_limit_buckets`;
    expect(rows[0].n).toBe(0);
  });
});

describe("PgIdempotencyStore", () => {
  const TTL = 60_000;

  it("klaim pertama fresh, klaim kedua in-flight", async () => {
    expect(await idempotency.claim("k", "fp", TTL)).toEqual({ kind: "fresh" });
    expect(await idempotency.claim("k", "fp", TTL)).toEqual({ kind: "in-flight" });
  });

  it("setelah remember → replay dengan status & body sama", async () => {
    await idempotency.claim("k", "fp", TTL);
    await idempotency.remember("k", 201, { data: { id: "abc" } }, "fp", TTL);
    expect(await idempotency.claim("k", "fp", TTL)).toEqual({
      kind: "replay",
      status: 201,
      body: { data: { id: "abc" } },
    });
  });

  it("sidik jari berbeda → mismatch (bukan replay)", async () => {
    await idempotency.claim("k", "fp-a", TTL);
    await idempotency.remember("k", 201, { data: 1 }, "fp-a", TTL);
    expect(await idempotency.claim("k", "fp-b", TTL)).toEqual({ kind: "mismatch" });
  });

  it("ATOMIK: dua klaim paralel → tepat satu fresh", async () => {
    const results = await Promise.all([
      idempotency.claim("race", "fp", TTL),
      idempotency.claim("race", "fp", TTL),
    ]);
    expect(results.filter((r) => r.kind === "fresh")).toHaveLength(1);
  });

  it("entri kedaluwarsa boleh diambil alih", async () => {
    await idempotency.claim("k", "fp", 1); // TTL 1 ms
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await idempotency.claim("k", "fp-baru", TTL)).toEqual({ kind: "fresh" });
  });

  it("forget menghapus klaim", async () => {
    await idempotency.claim("k", "fp", TTL);
    await idempotency.forget("k");
    expect(await idempotency.claim("k", "fp", TTL)).toEqual({ kind: "fresh" });
  });

  it("fail-CLOSED: error DB dilempar ke pemanggil", async () => {
    const broken = new PgIdempotencyStore({
      execute: async () => {
        throw new Error("koneksi putus");
      },
    } as never);
    await expect(broken.claim("k", "fp", TTL)).rejects.toThrow("koneksi putus");
  });
});
