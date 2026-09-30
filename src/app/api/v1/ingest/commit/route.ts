import { wrapRoute } from "@/lib/api/route-wrapper";
import { ingestCommitSchema } from "@/lib/contracts/ingest";
import { listPending } from "@/lib/ingest/queue";
import { processQueueItem, type ProcessResult } from "@/lib/ingest/service";
import { mediaStorageRoot } from "@/lib/ingest/config";
import { ConflictError } from "@/lib/auth/guards";

/**
 * POST /api/v1/ingest/commit — wajah MESIN (M9-3).
 * Proses antrean `pending` → soal **draft** (segmentasi + media + commit).
 *
 * Batas `limit` menjaga waktu respons; panggil berulang untuk melanjutkan.
 */
export const POST = wrapRoute({
  permission: "question:create",
  rateLimit: { capacity: 10, refillPerSec: 0.2 }, // berat (unduh gambar)
  body: ingestCommitSchema,
  idempotent: true,
  handler: async ({ body, actor }) => {
    const { items, nonPending } = await listPending(body.ids);
    if (body.ids && body.ids.length && nonPending.length) {
      throw new ConflictError(
        `Sebagian id bukan 'pending': ${nonPending.slice(0, 5).join(", ")}${nonPending.length > 5 ? "…" : ""}`,
      );
    }

    const batch = items.slice(0, body.limit);
    const root = mediaStorageRoot();
    const results: ProcessResult[] = [];
    for (const item of batch) {
      results.push(
        await processQueueItem(item, {
          actor,
          mediaRoot: root,
          mediaDelayMs: body.mediaDelayMs,
          grade: body.grade ?? null,
        }),
      );
    }

    const summary = {
      processed: results.length,
      created: results.reduce((a, r) => a + r.created, 0),
      skipped: results.reduce((a, r) => a + r.skipped, 0),
      failed: results.filter((r) => r.status === "failed").length,
      remaining: Math.max(0, items.length - batch.length),
    };
    return { summary, results };
  },
});
