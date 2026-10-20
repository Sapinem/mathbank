import { describe, it, expect } from "vitest";
import { buildEntry, redact, scrubString } from "./logger";

/**
 * **ACT-02 (P0)** — scrubber pola pada nilai *bebas* (pesan error, stack, URL).
 *
 * Redaksi berbasis nama field saja tidak cukup: kredensial paling sering bocor
 * lewat `throw new Error(\`gagal: ${url}\`)` atau pesan driver PostgreSQL yang
 * memuat string koneksi. Berkas ini mengunci perilaku itu agar tak regresi.
 */

/** Pastikan tak ada byte rahasia yang tersisa di objek/entri apa pun. */
function jsonOf(value: unknown): string {
  return JSON.stringify(value);
}

describe("scrubString (ACT-02)", () => {
  it("menyamarkan password pada URL koneksi postgres", () => {
    const raw = "connect gagal: postgres://mathbank:S3cr3tP4ss@localhost:5433/mathbank";
    const out = scrubString(raw);
    expect(out).not.toContain("S3cr3tP4ss");
    expect(out).toContain("postgres://mathbank:[REDACTED]@localhost:5433/mathbank");
  });

  it("menyamarkan token pada query string", () => {
    const out = scrubString("GET https://api.contoh.id/v1/x?token=abc123def&page=2");
    expect(out).not.toContain("abc123def");
    expect(out).toContain("page=2"); // parameter tak sensitif tetap utuh
  });

  it("menyamarkan header Authorization (Bearer/Basic)", () => {
    expect(scrubString("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig")).not.toContain(
      "eyJhbGciOiJIUzI1NiJ9",
    );
    const basic = scrubString("header Basic dXNlcjpwYXNzd29yZA==");
    expect(basic).not.toContain("dXNlcjpwYXNzd29yZA==");
    expect(basic).toContain("[REDACTED]");
  });

  it("menyamarkan JWT & kunci penyedia (sk-live-…)", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    expect(scrubString(`token=${jwt}`)).not.toContain(jwt);
    const key = "sk-live-abcdef1234567890";
    expect(scrubString(`key ${key} dipakai`)).not.toContain("abcdef1234567890");
  });

  it("teks biasa tidak diubah", () => {
    const plain = "Soal nomor 3 gagal divalidasi: opsi B kosong.";
    expect(scrubString(plain)).toBe(plain);
  });
});

describe("redact — Error & ZodError (ACT-02)", () => {
  it("Error.message di-scrub, bukan hanya nama field", () => {
    const err = new Error(
      "query gagal di postgres://u:SuperRahasia@db:5432/mathbank?password=SuperRahasia",
    );
    const out = jsonOf(redact({ err }));
    expect(out).not.toContain("SuperRahasia");
    expect(out).toContain("[REDACTED]");
  });

  it("ZodError: issues dipangkas (path+code+message), input mentah dibuang", () => {
    // Tiruan ZodError tanpa mengimpor zod (logger mendeteksi lewat `.issues`).
    const zodLike = Object.assign(new Error("validasi gagal"), {
      name: "ZodError",
      issues: [
        {
          path: ["password"],
          code: "too_small",
          message: "password terlalu pendek: hunter2",
          input: "hunter2",
          received: "hunter2",
        },
      ],
    });

    const out = redact(zodLike) as {
      name: string;
      issues: Array<Record<string, unknown>>;
    };

    expect(out.name).toBe("ZodError");
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0]).toEqual({
      path: ["password"],
      code: "too_small",
      message: "password terlalu pendek: hunter2",
    });
    // `input`/`received` (payload pengguna) tidak boleh ikut tercatat.
    expect(out.issues[0]).not.toHaveProperty("input");
    expect(out.issues[0]).not.toHaveProperty("received");
  });

  it("buildEntry: entri log utuh bebas kredensial", () => {
    const entry = buildEntry("error", {
      msg: "gagal memanggil upstream",
      route: "/api/v1/ingest/commit",
      err: new Error("401 dari https://x.id/hook?api_key=kuncirahasia123"),
      authorization: "Bearer tok Rahasia",
    });
    const line = jsonOf(entry);
    expect(line).not.toContain("kuncirahasia123");
    expect(line).not.toContain("Rahasia");
    expect(entry.level).toBe("error");
    expect(entry.route).toBe("/api/v1/ingest/commit");
  });
});
