#!/usr/bin/env tsx
/**
 * Pemantau advisory keamanan (M13 — S8). Node + `pnpm` yang sudah ada; tanpa
 * dependency baru.
 *
 * Menjalankan `pnpm audit` + menampilkan versi paket kritis (auth, crypto, http),
 * sebagai pengingat rutin. Dijadwalkan manual (mis. bulanan) — lihat
 * docs/KEAMANAN.md §S8.
 *
 * Keluar 0 selalu (informatif), kecuali `--strict` → keluar 1 bila ada advisory.
 */

import { spawnSync } from "node:child_process";

const STRICT = process.argv.includes("--strict");

/** Paket yang advisornya kita anggap prioritas. */
const CRITICAL = [
  "better-auth",
  "drizzle-orm",
  "next",
  "react",
  "zod",
  "postgres",
  "@modelcontextprotocol/sdk",
];

function run(cmd: string, args: string[]): { code: number | null; out: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

console.log("🔎 Pemeriksaan advisory keamanan (M13 S8)\n");

const audit = run("pnpm", ["audit", "--json"]);
let advisoryCount = 0;
try {
  const start = audit.out.indexOf("{");
  const json = JSON.parse(audit.out.slice(start)) as {
    metadata?: { vulnerabilities?: Record<string, number> };
  };
  const v = json.metadata?.vulnerabilities ?? {};
  advisoryCount =
    (v.critical ?? 0) + (v.high ?? 0) + (v.moderate ?? 0) + (v.low ?? 0);
  if (advisoryCount === 0) {
    console.log("✅ pnpm audit: tidak ada kerentanan dilaporkan.");
  } else {
    console.log("⚠️  pnpm audit menemukan kerentanan:");
    for (const [sev, n] of Object.entries(v)) {
      if (n) console.log(`   - ${sev}: ${n}`);
    }
  }
} catch {
  console.log("ℹ️  pnpm audit tak dapat diuraikan (offline/registry?).");
}

console.log("\n📦 Paket kritis — versi saat ini:");
// `pnpm list` menangani resolusi pnpm dgn benar (tanpa sufiks peer).
const listed = run("pnpm", ["list", "--depth", "0", "--json"]);
try {
  const start = listed.out.indexOf("[");
  const arr = JSON.parse(listed.out.slice(start)) as Array<{
    dependencies?: Record<string, { version: string }>;
    devDependencies?: Record<string, { version: string }>;
  }>;
  const deps = { ...(arr[0]?.dependencies ?? {}), ...(arr[0]?.devDependencies ?? {}) };
  for (const pkg of CRITICAL) {
    console.log(`   ${pkg.padEnd(30)} ${deps[pkg]?.version ?? "(tak terpasang)"}`);
  }
} catch {
  console.log("   (gagal membaca daftar paket)");
}

console.log(
  "\n💡 Rutin: cek catatan rilis paket kritis & jalankan `pnpm up` terjadwal.\n" +
    "   Dokumentasikan hasil di docs/RISET-BETTER-AUTH.md bila menyangkut auth.",
);

if (STRICT && advisoryCount > 0) process.exit(1);
