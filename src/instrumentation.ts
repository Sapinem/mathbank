/**
 * Next.js instrumentation — dijalankan SEKALI saat server menyala.
 *
 * Tugas: guard invarian DB (P2). Bila trigger/CHECK/HNSW/uuidv7 hilang
 * (mis. seseorang menjalankan `drizzle-kit push` tanpa `pnpm db:migrate`),
 * log ERROR agar terlihat di observabilitas.
 *
 * Perilaku:
 *  - default: **peringatan** (tidak mematikan server) — aman untuk produksi.
 *  - `STRICT_INVARIANTS=true`: **gagalkan startup** (dipakai CI/staging sensitif).
 *  - di-skip saat build (`NEXT_PHASE=phase-production-build`) & tanpa DATABASE_URL.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // **ACT-03 C:** pemeliharaan state in-memory (rate limit + idempotensi).
  // Tak butuh DB → dijalankan sebelum guard DATABASE_URL agar dev tanpa DB
  // pun tetap bebas kebocoran memori.
  const { startTelemetryMaintenance } = await import(
    "@/lib/telemetry/instrumentation"
  );
  startTelemetryMaintenance();

  if (!process.env.DATABASE_URL) return;

  const { checkDbInvariants } = await import("@/lib/db/invariants");

  try {
    const report = await checkDbInvariants();
    const strict = process.env.STRICT_INVARIANTS === "true";

    if (report.ok) {
      console.log(
        `[invarian] OK — ${report.counts.triggers} trigger, ` +
          `${report.counts.checkConstraints} CHECK, ` +
          `${report.counts.hnswIndexes} HNSW, uuidv7 ✓`,
      );
      return;
    }

    const msg =
      `[invarian] PERINGATAN — skema tidak utuh: ${report.problems.join("; ")}. ` +
      `Jalankan \`pnpm db:migrate\` (termasuk db_safety) untuk memasang invarian.`;

    if (strict) {
      throw new Error(msg);
    }
    console.error(msg);
  } catch (err) {
    if (process.env.STRICT_INVARIANTS === "true") throw err;
    console.error(
      "[invarian] tak dapat memverifikasi skema (DB mungkin belum siap):",
      err instanceof Error ? err.message : err,
    );
  }
}
