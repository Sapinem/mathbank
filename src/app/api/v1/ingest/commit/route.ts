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
  // Berat (unduh gambar) — dibatasi agar server tak kelelahan, tapi cukup
  // longgar untuk ingest massal: burst 30, isi ulang 1 token/detik.
  // (Sebelumnya 10 / 0.2 → 1 commit tiap 5 dtk, terlalu lambat untuk korpus besar.)
  rateLimit: { capacity: 30, refillPerSec: 1 },
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
      linked: results.reduce((a, r) => a + r.linked, 0),
      skipped: results.reduce((a, r) => a + r.skipped, 0),
      // Soal yang gagal dibuat (mis. ditolak DB) + artikel yang gagal total.
      failed: results.reduce((a, r) => a + r.failed, 0) + results.filter((r) => r.status === "failed").length,
      storedCount: results.reduce((a, r) => a + r.storedCount, 0),
      failedCount: results.reduce((a, r) => a + r.failedCount, 0),
      failures: results.flatMap((r) => r.failures),
      remaining: Math.max(0, items.length - batch.length),
    };

    // EVENT: isi otomatis dari judul paket — HANYA bila event sudah ada di
    // katalog `events`. Event baru (belum dikenal) TIDAK dibuat otomatis;
    // dilaporkan lewat `unknownEvents` agar pemilik bisa memutuskan dulu.
    const bundleIds = results.map((r) => r.bundleId).filter((x): x is string => Boolean(x));
    let eventsTagged = 0;
    let unknownEvents: string[] = [];
    if (bundleIds.length > 0) {
      const db = (await import("@/lib/db")).db;
      const { resolveEventsForBundles, findUnknownEvents } = await import("@/lib/ingest/event-resolve");
      const ev = await resolveEventsForBundles(db, bundleIds);
      eventsTagged = ev.bundlesTagged;
      unknownEvents = await findUnknownEvents(db, bundleIds);
    }

    return { summary, results, eventsTagged, unknownEvents };
  },
});
