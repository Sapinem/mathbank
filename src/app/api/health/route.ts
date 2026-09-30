import { NextResponse } from "next/server";
import { checkDbInvariants } from "@/lib/db/invariants";

/**
 * GET /api/health — health & readiness check.
 *
 * Melaporkan:
 *  - koneksi DB hidup,
 *  - invarian skema utuh (trigger/CHECK/HNSW/uuidv7) — mencegah aplikasi
 *    berjalan "tanpa jaring pengaman" bila migrasi safety terlewat.
 *
 * 200 = sehat; 503 = ada masalah (DB tak terjangkau / invarian hilang).
 * Sengaja PUBLIK & ringan (tanpa auth) — dipakai probe uptime/monitoring.
 * Tidak membocorkan detail sensitif: hanya nama objek skema, bukan data.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const report = await checkDbInvariants();
    const body = {
      data: {
        status: report.ok ? "ok" : "degraded",
        db: "up",
        latencyMs: Date.now() - startedAt,
        invariants: {
          ok: report.ok,
          counts: report.counts,
          missingTriggers: report.missingTriggers,
          missingChecks: report.missingChecks,
          pkUsesUuidv7: report.pkUsesUuidv7,
          problems: report.problems,
        },
      },
    };
    return NextResponse.json(body, { status: report.ok ? 200 : 503 });
  } catch (err) {
    return NextResponse.json(
      {
        data: {
          status: "down",
          db: "down",
          latencyMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : "unknown",
        },
      },
      { status: 503 },
    );
  }
}
