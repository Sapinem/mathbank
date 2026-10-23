import { NextResponse } from "next/server";
import { checkDbInvariants } from "@/lib/db/invariants";
import { toInvariantsDto } from "@/lib/db/schema-expectations";
import { PUBLIC_DB_DOWN_MESSAGE } from "@/lib/api/public-messages";
import { log } from "@/lib/telemetry/logger";

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
          invariants: toInvariantsDto(report),
        },
      },
      { status: report.ok ? 200 : 503 },
    );
  } catch (err) {
    // ACT-02: detail HANYA ke log server; publik dapat pesan generik.
    log.error({
      msg: "readiness check gagal — basis data tak terjangkau",
      route: "/api/ready",
      method: "GET",
      code: "READY_DB_DOWN",
      status: 503,
      durationMs: Date.now() - startedAt,
      err,
    });
    return NextResponse.json(
      {
        data: {
          status: "down",
          db: "down",
          latencyMs: Date.now() - startedAt,
          message: PUBLIC_DB_DOWN_MESSAGE,
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
