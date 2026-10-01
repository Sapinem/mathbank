import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tes kalibrasi pemindai rahasia (M16, M13/S6).
 *
 * Memastikan pemindai **tetap menangkap rahasia NYATA** sekaligus
 * **tidak rewel** terhadap placeholder (nilai CI/dummy/template). Regresi di
 * sini = alarm palsu (menghambat commit) atau lubang (rahasia lolos) — keduanya
 * bahaya, jadi diuji lewat JALUR NYATA (menjalankan skrip).
 */

const SCRIPT = "scripts/secret-scan.mjs";

/** Jalankan pemindai pada isi berkas sementara → { code, out }. */
function scan(content: string): { code: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), "ss-"));
  const file = join(dir, "sample.txt");
  writeFileSync(file, content, "utf8");
  try {
    execFileSync("node", [SCRIPT, file], { encoding: "utf8" });
    return { code: 0, out: "" };
  } catch (e) {
    const err = e as { status?: number; stderr?: string; stdout?: string };
    return { code: err.status ?? 1, out: (err.stderr ?? "") + (err.stdout ?? "") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("pemindai rahasia — kalibrasi", () => {
  it("MENANGKAP password DB acak yang menyerupai rahasia nyata", () => {
    const r = scan("X=postgresql://admin:Xk9mP2vQ8nL4wR7t@db.host:5432/prod\n");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/URI DB/);
  });

  it("MENANGKAP kunci API 9router/OpenAI nyata", () => {
    const r = scan("API_KEY=sk-or-v1-9f8e7d6c5b4a39281706f5e4d3c2b1a0\n");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/key|9router/i);
  });

  it("MENANGKAP penugasan rahasia acak", () => {
    const r = scan("BETTER_AUTH_SECRET=aB3xK9mP2vQ8nL4wR7tY6uI5oJ4kH3gF2dS1a\n");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Penugasan rahasia/);
  });

  it("MENGABAIKAN placeholder CI/dummy/template (bukan rahasia)", () => {
    const r = scan(
      [
        "DATABASE_URL=postgresql://mathbank:mathbank_ci@localhost:5432/mathbank_test",
        "BETTER_AUTH_SECRET=build-placeholder-injected-at-runtime-not-a-secret",
        "SETTINGS_ENC_KEY=0000000000000000000000000000000000000000000000000000000000000000",
        "POSTGRES_PASSWORD=changeme-strong-password",
        "TOKEN=${RUNTIME_TOKEN}",
      ].join("\n") + "\n",
    );
    expect(r.code).toBe(0);
  });
});
