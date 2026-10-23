import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { exportBundleToGitsync } from "@/lib/services/moodle-export-service";
import { recordViewAudit } from "@/lib/services/audit";

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

class ExportBlockedError extends Error {
  httpStatus = 422;
  code: string;
  details: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ExportBlockedError";
    this.code = code;
    this.details = details;
  }
}

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({}).optional();

export const POST = wrapRoute({
  rateLimit: { capacity: 10, refillPerSec: 0.2 },
  params: paramsSchema,
  body: bodySchema,
  handler: async ({ params, actor }) => {
    const { summary, result, write } = await exportBundleToGitsync(params.id, actor);

    // D4: ada soal tanpa kunci → tolak (jangan tulis berkas cacat).
    // API-01: CONSTRAINT #17 — error TIDAK boleh menyertakan `data`.
    // Ringkasan dipindah ke `error.details`.
    if (!result.ok) {
      throw new ExportBlockedError(
        "EXPORT_BLOCKED",
        "Ekspor dibatalkan: ada soal tanpa kunci jawaban.",
        summary,
      );
    }

    if (result.exported === 0) {
      throw new ExportBlockedError(
        "NOTHING_EXPORTED",
        "Tak ada soal yang bisa diekspor (tipe tak didukung).",
        summary,
      );
    }

    // M13 S7: catat EKSPOR (akses baca massal + kunci jawaban) sebagai audit.
    await recordViewAudit({
      entityType: "bundle",
      entityId: params.id,
      action: "export",
      actor,
      changeSummary: `Ekspor GitSync: ${result.exported} soal (${write?.directory ?? "-"})`,
    });

    return {
      ...summary,
      directory: write?.directory ?? null,
      written: write?.written ?? 0,
      committed: write?.committed ?? false,
      commitHash: write?.commitHash ?? null,
      note: write?.note ?? "",
    };
  },
});
