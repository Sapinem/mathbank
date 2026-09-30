import type { NextRequest } from "next/server";
import { resolveActor } from "@/lib/auth/resolve";
import { exportBundleToGitsync } from "@/lib/services/moodle-export-service";
import { ForbiddenError, NotFoundError } from "@/lib/auth/guards";

/**
 * `POST /api/bundles/[id]/export/moodle` — ekspor paket ke folder **GitSync** di disk (M12).
 *
 * Bukan unduhan: MathBank **menulis** `<MATHBANK_EXPORT_DIR>/<slug>/top/...` lalu
 * menjalankan **git init/add/commit** (D7/D8). Kembalian = **ringkasan JSON**
 * berisi folder tujuan + hash commit, supaya UI bisa menampilkan lokasinya.
 *
 * GitSync (`qbank_gitsync`) membaca **isi folder** — tak ada ZIP/tar.
 *
 * **D4**: bila ada soal tanpa kunci ⇒ **ekspor ditolak** → 422 + daftar soal.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  args: { params: Promise<{ id: string }> },
): Promise<Response> {
  let actor;
  try {
    actor = await resolveActor(req.headers);
  } catch {
    return json(401, { error: { code: "UNAUTHORIZED", message: "Autentikasi diperlukan." } });
  }
  if (!actor) {
    return json(401, { error: { code: "UNAUTHORIZED", message: "Autentikasi diperlukan." } });
  }

  const { id } = await args.params;

  try {
    const { summary, result, write } = await exportBundleToGitsync(id, actor);

    // D4: ada soal tanpa kunci → tolak (jangan tulis berkas cacat).
    if (!result.ok) {
      return json(422, {
        error: {
          code: "EXPORT_BLOCKED",
          message: "Ekspor dibatalkan: ada soal tanpa kunci jawaban.",
        },
        data: summary,
      });
    }

    if (result.exported === 0) {
      return json(422, {
        error: {
          code: "NOTHING_EXPORTED",
          message: "Tak ada soal yang bisa diekspor (tipe tak didukung).",
        },
        data: summary,
      });
    }

    return json(200, {
      data: {
        ...summary,
        directory: write?.directory ?? null,
        written: write?.written ?? 0,
        committed: write?.committed ?? false,
        commitHash: write?.commitHash ?? null,
        note: write?.note ?? "",
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError)
      return json(403, { error: { code: err.code, message: err.message } });
    if (err instanceof NotFoundError)
      return json(404, { error: { code: err.code, message: err.message } });
    console.error("[moodle-export] error:", (err as Error).message);
    return json(500, { error: { code: "INTERNAL", message: "Gagal menyusun ekspor." } });
  }
}
