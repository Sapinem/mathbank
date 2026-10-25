import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

/**
 * Tes gerbang `pnpm db:push` (Fase 5) — lewat JALUR NYATA (menjalankan skrip),
 * mengikuti pola secret-scan.test.ts.
 *
 * Yang diuji hanya keputusan gerbang (boleh/tidak di lingkungan ini),
 * bukan rantai push itu sendiri (yang butuh DATABASE_URL dan drizzle-kit).
 * Vitest sendiri menjalankan proses dengan NODE_ENV=test, jadi kasus
 * "diizinkan" harus menyetel NODE_ENV/APP_ENV secara eksplisit.
 */

const SCRIPT = "scripts/db-push-gate.mjs";

function gate(env: Record<string, string>): { code: number; out: string } {
  try {
    const out = execFileSync("node", [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe("db-push-gate", () => {
  it("mengizinkan push di dev", () => {
    const r = gate({ NODE_ENV: "development", APP_ENV: "" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("BUKAN migrasi");
  });

  it("memblokir push saat NODE_ENV=production", () => {
    const r = gate({ NODE_ENV: "production", APP_ENV: "" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("DIBLOKIR");
    expect(r.out).toContain("db:migrate");
  });

  it("memblokir push saat APP_ENV=staging walau NODE_ENV=test", () => {
    const r = gate({ NODE_ENV: "test", APP_ENV: "staging" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("DIBLOKIR");
  });

  it("memblokir push saat APP_ENV=production", () => {
    const r = gate({ NODE_ENV: "development", APP_ENV: "production" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("DIBLOKIR");
  });
});
