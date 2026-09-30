import { NextResponse } from "next/server";
import { checkDbInvariants } from "@/lib/db/invariants";

/**
 * GET /api/ready — **readiness** probe (M16).
 *
 * Menjawab "siap melayani trafik?" — memeriksa koneksi DB + keutuhan invarian
 * skema (trigger/CHECK/HNSW/uuidv7). Gunakan ini untuk probe readiness
 * load-balancer/Kubernetes (bukan liveness, yang tak boleh menyentuh DB).
 *
 * 200 = siap; 503 = belum siap (DB mati/invarian hilang).
 * Publik & ringan; tidak membocorkan data (hanya nama objek skema).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const report = await checkDbInvariants();
    return NextResponse.json(
      {
        data: {
          status: report.ok ? "ready" : "degraded",
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
      },
      { status: report.ok ? 200 : 503 },
    );
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
