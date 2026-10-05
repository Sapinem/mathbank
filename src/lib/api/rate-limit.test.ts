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
 * Waktu diinjeksi agar deterministik (tanpa `sleep`).
 */

const P: RateLimitPolicy = { capacity: 3, refillPerSec: 1 };

describe("rate-limit — token bucket", () => {
  beforeEach(() => {
    setStore(new MemoryStore());
  });

  it("mengizinkan sampai kapasitas, lalu menolak", () => {
    const t = 1_000_000;
    expect(checkRateLimit("k", P, t).allowed).toBe(true); // 3→2
    expect(checkRateLimit("k", P, t).allowed).toBe(true); // 2→1
    expect(checkRateLimit("k", P, t).allowed).toBe(true); // 1→0
    const denied = checkRateLimit("k", P, t); // 0 → tolak
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("mengisi ulang token seiring waktu", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("k", P, t);
    expect(checkRateLimit("k", P, t).allowed).toBe(false);
    // +1 detik → 1 token terisi
    expect(checkRateLimit("k", P, t + 1000).allowed).toBe(true);
  });

  it("tak pernah melebihi kapasitas (burst terbatas)", () => {
    const t = 1_000_000;
    // Diamkan lama → penuh, tapi tak lebih dari kapasitas.
    const r = checkRateLimit("k", P, t + 999_999);
    expect(r.remaining).toBe(P.capacity - 1);
  });

  it("key berbeda punya bucket terpisah", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("a", P, t);
    expect(checkRateLimit("a", P, t).allowed).toBe(false);
    expect(checkRateLimit("b", P, t).allowed).toBe(true);
  });

  it("retryAfterMs sebanding dengan laju isi ulang", () => {
    const slow: RateLimitPolicy = { capacity: 1, refillPerSec: 0.5 };
    const t = 1_000_000;
    checkRateLimit("k", slow, t); // habis
    const r = checkRateLimit("k", slow, t);
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
  it("prune membuang bucket lama", () => {
    const s = new MemoryStore();
    s.take("x", { capacity: 1, refillPerSec: 1, now: 1_000_000 });
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
  it("burst = 300 agar paket 40–50 soal tak memicu 429", () => {
    expect(IMAGE_POLICY.capacity).toBe(300);
    // Beban satu paket (50 gambar) harus lolos tanpa penolakan.
    const t = 1_000_000;
    for (let i = 0; i < 50; i++) {
      expect(checkRateLimit("media:serve:ip", IMAGE_POLICY, t).allowed).toBe(true);
    }
  });
});
