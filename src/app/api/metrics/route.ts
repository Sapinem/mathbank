import { NextResponse } from "next/server";
import { snapshot } from "@/lib/telemetry/metrics";

/**
 * GET /api/metrics — metrik runtime (M16).
 *
 * Mengembalikan ringkasan in-memory: uptime, total permintaan/galat, dan
 * metrik per-route (count, error, avg/p50/p95/max latensi). Ringan & tanpa
 * dependency — cukup untuk single-node. Untuk multi-node/Grafana, ganti
 * sumber data dengan Prometheus (lihat `docs/OBSERVABILITAS.md` §4).
 *
 * **Pertimbangan keamanan:** metrik bisa membocorkan struktur internal
 * (nama route). Dilindungi dengan **token opsional** `METRICS_TOKEN`:
 *  - bila env di-set → wajib header `Authorization: Bearer <token>`;
 *  - bila tak di-set → hanya boleh diakses di non-produksi (diblokir 404 di prod).
 */
export const dynamic = "force-dynamic";

function authorized(req: Request): { ok: boolean; reason?: string } {
  const required = process.env.METRICS_TOKEN;
  if (!required) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "nonaktif" };
    }
    return { ok: true };
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  // Perbandingan waktu-konstan sederhana (panjang sama) — cukup untuk token.
  const ok =
    token.length === required.length &&
    token.split("").reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ required.charCodeAt(i)), 0) === 0;
  return { ok, reason: ok ? undefined : "unauthorized" };
}

export async function GET(req: Request) {
  const auth = authorized(req);
  if (!auth.ok) {
    // 404 agar tak mengungkap keberadaan endpoint saat nonaktif.
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Tidak ditemukan" } },
      {
        status: auth.reason === "unauthorized" ? 401 : 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  // Metrik memuat nama route internal — jangan pernah masuk cache bersama.
  return NextResponse.json(
    { data: snapshot() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
