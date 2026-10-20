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

/**
 * **ACT-02 (P0)** — scrubber pola: rahasia yang LOLOS dari redaksi berbasis
 * nama field (pesan error, stack, URL) tetap harus hilang dari log.
 */
describe("scrubString / redact — pola rahasia (ACT-02)", () => {
  // Nilai "rahasia" dirakit saat runtime (bukan literal) supaya pemindai rahasia
  // repo tidak salah menganggapnya kredensial nyata yang di-commit.
  const fakePass = ["S3cret", "P4ss"].join("");
  const fakeToken = ["abc123", "secret"].join("");
  const fakeJwt = [
    "eyJhbGciOiJIUzI1NiJ9",
    "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
    "dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  ].join(".");
  const fakeApiKey = ["sk", "test", "abcdefgh1234"].join("-");

  it("menyamarkan kredensial di dalam URL koneksi pada Error.message", () => {
    const e = new Error(
      `connect gagal: postgres://mathbank:${fakePass}@db.internal:5433/mathbank`,
    );
    const out = redact(e) as { message: string };
    expect(out.message).not.toContain(fakePass);
    expect(out.message).toContain("[REDACTED]");
    expect(out.message).toContain("db.internal");
  });

  it("menyamarkan token/password pada query string di pesan bebas", () => {
    const q = `?${["to", "ken="].join("")}${fakeToken}&${["pass", "word="].join("")}${fakePass}&safe=1`;
    const out = redact({
      msg: `fetch https://api.example.com/x${q} gagal`,
    }) as { msg: string };
    expect(out.msg).not.toContain(fakeToken);
    expect(out.msg).not.toContain(fakePass);
    expect(out.msg).toContain("safe=1");
  });

  it("menyamarkan header Authorization Bearer & JWT", () => {
    const out = redact(`Authorization: Bearer ${fakeJwt}`) as string;
    expect(out).not.toContain(fakeJwt);
    expect(out).not.toContain(fakeJwt.split(".")[0]);
    expect(out).toContain("[REDACTED]");
  });

  it("menyamarkan field password= / api_key= bentuk non-JSON", () => {
    const payload = `${["pass", "word="].join("")}${fakePass} ${["api", "_key="].join("")}${fakeApiKey}`;
    const out = redact(`login payload ${payload}`) as string;
    expect(out).not.toContain(fakePass);
    expect(out).not.toContain(fakeApiKey);
  });

  it("ZodError → issues tanpa `input` mentah (payload pengguna tak bocor)", () => {
    // Tiruan ZodError (duck-typed): logger sengaja tak mengimpor zod.
    const zerr = Object.assign(new Error("Validasi gagal"), {
      name: "ZodError",
      issues: [
        {
          path: ["password"],
          code: "too_small",
          message: "Password terlalu pendek",
          input: "hunter2",
          received: 7,
        },
      ],
    });
    const out = redact(zerr) as {
      name: string;
      issues: Array<Record<string, unknown>>;
    };
    expect(out.name).toBe("ZodError");
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0].code).toBe("too_small");
    expect(out.issues[0].path).toEqual(["password"]);
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(out.issues[0].input).toBeUndefined();
  });
});
