import { NextResponse } from "next/server";
import { checkDbInvariants } from "@/lib/db/invariants";
import { toInvariantsDto } from "@/lib/db/schema-expectations";
import { PUBLIC_DB_DOWN_MESSAGE } from "@/lib/api/public-messages";
import { log } from "@/lib/telemetry/logger";

/**
 * GET /api/health — kesehatan aplikasi (liveness + readiness, kontrak lama).
 *
 * Melaporkan:
 *  - koneksi DB hidup + invarian skema utuh (trigger/CHECK/HNSW/uuidv7),
 *  - `uptimeSec` (liveness).
 *
 * 200 = sehat; 503 = ada masalah (DB tak terjangkau / invarian hilang).
 * Sengaja PUBLIK & ringan (tanpa auth) — dipakai probe uptime/monitoring.
 *
 * **ACT-02 (P0) — jangan bocorkan detail internal ke publik.** Saat DB mati,
 * respons HANYA berisi pesan generik. `err.message` PostgreSQL memuat nama
 * host/port/user/database (kadang string koneksi) — informasi yang berguna
 * bagi penyerang, bukan bagi probe. Detail lengkap tetap masuk log server
 * terstruktur (sudah di-scrub oleh logger), jadi operator tak kehilangan apa pun.
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
    const report = await Promise.race([
      checkDbInvariants(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Health check DB timeout (3000ms)")), 3000),
      ),
    ]);
    const body = {
      data: {
        status: report.ok ? "ok" : "degraded",
        db: "up",
        uptimeSec: Math.round(process.uptime()),
        latencyMs: Date.now() - startedAt,
        invariants: toInvariantsDto(report),
      },
    };
    return NextResponse.json(body, { status: report.ok ? 200 : 503 });
  } catch (err) {
    // Detail HANYA ke log server (di-scrub logger); publik dapat pesan generik.
    log.error({
      msg: "health check gagal — basis data tak terjangkau",
      route: "/api/health",
      method: "GET",
      code: "HEALTH_DB_DOWN",
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
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
