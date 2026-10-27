import { describe, it, expect, beforeEach } from "vitest";
import {
  MemoryStore,
  checkRateLimit,
  rateLimitKey,
  setStore,
  RateLimitError,
  IMAGE_POLICY,
  type RateLimitPolicy,
} from "./rate-limit";

/**
 * Uji rate limiter (L1) — token bucket.
 * Waktu diinjeksi agar deterministik (tanpa `sleep`). Sejak ADR-0029 store
 * bersifat async (implementasi PG), jadi setiap pemanggilan di-`await`.
 */

const P: RateLimitPolicy = { capacity: 3, refillPerSec: 1 };

describe("rate-limit — token bucket", () => {
  beforeEach(() => {
    setStore(new MemoryStore());
  });

  it("mengizinkan sampai kapasitas, lalu menolak", async () => {
    const t = 1_000_000;
    expect((await checkRateLimit("k", P, t)).allowed).toBe(true); // 3→2
    expect((await checkRateLimit("k", P, t)).allowed).toBe(true); // 2→1
    expect((await checkRateLimit("k", P, t)).allowed).toBe(true); // 1→0
    const denied = await checkRateLimit("k", P, t); // 0 → tolak
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("mengisi ulang token seiring waktu", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) await checkRateLimit("k", P, t);
    expect((await checkRateLimit("k", P, t)).allowed).toBe(false);
    // +1 detik → 1 token terisi
    expect((await checkRateLimit("k", P, t + 1000)).allowed).toBe(true);
  });

  it("tak pernah melebihi kapasitas (burst terbatas)", async () => {
    const t = 1_000_000;
    // Diamkan lama → penuh, tapi tak lebih dari kapasitas.
    const r = await checkRateLimit("k", P, t + 999_999);
    expect(r.remaining).toBe(P.capacity - 1);
  });

  it("key berbeda punya bucket terpisah", async () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) await checkRateLimit("a", P, t);
    expect((await checkRateLimit("a", P, t)).allowed).toBe(false);
    expect((await checkRateLimit("b", P, t)).allowed).toBe(true);
  });

  it("retryAfterMs sebanding dengan laju isi ulang", async () => {
    const slow: RateLimitPolicy = { capacity: 1, refillPerSec: 0.5 };
    const t = 1_000_000;
    await checkRateLimit("k", slow, t); // habis
    const r = await checkRateLimit("k", slow, t);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(2000); // 1 token / 0.5 per detik = 2 dtk
  });
});

describe("rateLimitKey", () => {
  it("pakai id aktor bila ada", () => {
    expect(rateLimitKey("u1", "1.2.3.4", "question:create")).toBe(
      "question:create:u1",
    );
  });
  it("fallback ke IP bila tak ada aktor", () => {
    expect(rateLimitKey(null, "1.2.3.4", "s")).toBe("s:1.2.3.4");
  });
  it("anon bila tak ada keduanya", () => {
    expect(rateLimitKey(null, null, "s")).toBe("s:anon");
  });
});

describe("MemoryStore", () => {
  it("prune membuang bucket lama", async () => {
    const s = new MemoryStore();
    await s.take("x", { capacity: 1, refillPerSec: 1, now: 1_000_000 });
    expect(s.size()).toBe(1);
    s.prune(1_000_000 + 3_600_001); // > 1 jam
    expect(s.size()).toBe(0);
  });
});

describe("RateLimitError", () => {
  it("kode & retryAfterMs terbaca", () => {
    const e = new RateLimitError(1500);
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.retryAfterMs).toBe(1500);
  });
});

describe("IMAGE_POLICY (PERF-03)", () => {
  it("burst = 300 agar paket 40–50 soal tak memicu 429", async () => {
    expect(IMAGE_POLICY.capacity).toBe(300);
    // Beban satu paket (50 gambar) harus lolos tanpa penolakan.
    const t = 1_000_000;
    for (let i = 0; i < 50; i++) {
      expect((await checkRateLimit("media:serve:ip", IMAGE_POLICY, t)).allowed).toBe(true);
    }
  });
});
