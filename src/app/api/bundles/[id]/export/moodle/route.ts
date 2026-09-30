import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/auth/resolve";
import { exportBundleToGitsync } from "@/lib/services/moodle-export-service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/guards";

/**
 * `GET /api/bundles/[id]/export/moodle` — unduh paket sebagai ZIP **skema GitSync** (M12).
 *
 * Menghasilkan `application/zip` (bukan JSON), jadi **tidak** memakai `wrapRoute`
 * (pola sama seperti `/api/mcp`). Auth manual: sesi/API key → izin `bundle:manage`
 * dicek di service (`assertCan`).
 *
 * Tanggapan non-ZIP (JSON error) tetap konsisten `{ error: { code, message } }`.
 *
 * **D4**: bila ada soal tanpa kunci ⇒ **ekspor ditolak** → 422 + daftar soal.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, code: string, message: string, extra?: object): Response {
  return new Response(JSON.stringify({ error: { code, message }, ...extra }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Bersihkan judul paket untuk nama berkas unduhan. */
function safeFileName(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "paket"}-gitsync.zip`;
}

export async function GET(
  req: NextRequest,
  args: { params: Promise<{ id: string }> },
): Promise<Response> {
  let actor;
  try {
    actor = await resolveActor(req.headers);
  } catch {
    return json(401, "UNAUTHORIZED", "Autentikasi diperlukan.");
  }
  if (!actor) return json(401, "UNAUTHORIZED", "Autentikasi diperlukan.");

  const { id } = await args.params;

  try {
    const { summary, result } = await exportBundleToGitsync(id, actor);

    // D4: ada soal tanpa kunci → tolak (jangan unduh berkas cacat).
    if (!result.ok) {
      return json(
        422,
        "EXPORT_BLOCKED",
        "Ekspor dibatalkan: ada soal tanpa kunci jawaban.",
        { data: summary },
      );
    }

    if (result.skipped.length > 0) {
      // Soal bertipe tak didukung: tetap ekspor sisanya, sertakan ringkasan
      // di header (agar UI bisa memberi tahu). Bila SEMUA dilewati → 422.
      if (result.exported === 0) {
        return json(
          422,
          "NOTHING_EXPORTED",
          "Tak ada soal yang bisa diekspor (tipe tak didukung).",
          { data: summary },
        );
      }
    }

    const zip = result.zip!;
    const body = new Uint8Array(zip);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${safeFileName(summary.bundleTitle)}"`,
        "content-length": String(zip.length),
        // Ringkasan ringkas untuk UI (jumlah + dilewati).
        "x-export-exported": String(summary.exported),
        "x-export-skipped": String(summary.skipped.length),
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return json(403, err.code, err.message);
    if (err instanceof NotFoundError) return json(404, err.code, err.message);
    console.error("[moodle-export] error:", (err as Error).message);
    return json(500, "INTERNAL", "Gagal menyusun ekspor.");
  }
}
