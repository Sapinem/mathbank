import { NextResponse } from "next/server";
import { checkDbInvariants } from "@/lib/db/invariants";

/**
 * GET /api/health — kesehatan aplikasi (liveness + readiness, kontrak lama).
 *
 * Melaporkan:
 *  - koneksi DB hidup + invarian skema utuh (trigger/CHECK/HNSW/uuidv7),
 *  - `uptimeSec` (liveness).
 *
 * 200 = sehat; 503 = ada masalah (DB tak terjangkau / invarian hilang).
 * Sengaja PUBLIK & ringan (tanpa auth) — dipakai probe uptime/monitoring.
 * Tidak membocorkan detail sensitif: hanya nama objek skema, bukan data.
 *
 * **M16:** untuk probe yang **tak boleh menyentuh DB** (liveness murni, hindari
 * restart-loop saat DB down), pakai `?probe=liveness` → 200 cepat tanpa DB.
 * Endpoint `/api/ready` juga tersedia sebagai readiness eksplisit.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const startedAt = Date.now();

  // Liveness murni — tak menyentuh DB (untuk probe liveness/uptime).
  const probe = new URL(req.url).searchParams.get("probe");
  if (probe === "liveness") {
    return NextResponse.json({
      data: { status: "ok", uptimeSec: Math.round(process.uptime()) },
    });
  }

  try {
    const report = await checkDbInvariants();
    const body = {
      data: {
        status: report.ok ? "ok" : "degraded",
        db: "up",
        uptimeSec: Math.round(process.uptime()),
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
