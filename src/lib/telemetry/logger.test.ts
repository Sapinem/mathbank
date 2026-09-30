import { describe, it, expect } from "vitest";
import { redact, buildEntry } from "./logger";

/**
 * Tes logger terstruktur (M16) — fokus: **redaksi rahasia** (jangan pernah
 * log password/token/answer_key) + bentuk entri konsisten.
 */

describe("redact", () => {
  it("menyamarkan field sensitif (beragam penulisan)", () => {
    const out = redact({
      password: "rahasia",
      apiKey: "sk-xxx",
      API_KEY: "sk-yyy",
      answer_key: { correct: "A" },
      authorization: "Bearer z",
      cookie: "sid=1",
      safe: "boleh",
    }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.API_KEY).toBe("[REDACTED]");
    expect(out.answer_key).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.cookie).toBe("[REDACTED]");
    expect(out.safe).toBe("boleh");
  });

  it("redaksi bersarang (nested) & dalam array", () => {
    const out = redact({
      user: { name: "Budi", token: "abc" },
      items: [{ secret: "x" }, { ok: 1 }],
    }) as {
      user: { name: string; token: string };
      items: Array<Record<string, unknown>>;
    };
    expect(out.user.name).toBe("Budi");
    expect(out.user.token).toBe("[REDACTED]");
    expect(out.items[0].secret).toBe("[REDACTED]");
    expect(out.items[1].ok).toBe(1);
  });

  it("Error → {name,message} tanpa stack di produksi", () => {
    const e = new Error("boom");
    const out = redact(e) as { name: string; message: string; stack?: string };
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
  });

  it("nilai primitif lewat apa adanya", () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact("teks")).toBe("teks");
  });
});

describe("buildEntry", () => {
  it("bentuk entri: level/time/msg + konteks teredaksi", () => {
    const e = buildEntry("error", {
      msg: "gagal",
      route: "/api/x",
      requestId: "rid-1",
      password: "BOBOL",
    });
    expect(e.level).toBe("error");
    expect(typeof e.time).toBe("string");
    expect(e.msg).toBe("gagal");
    expect(e.route).toBe("/api/x");
    expect(e.requestId).toBe("rid-1");
    expect(e.password).toBe("[REDACTED]");
  });
});
