import { wrapRoute } from "@/lib/api/route-wrapper";
import { ingestQueueQuerySchema } from "@/lib/contracts/ingest";
import { listQueue, countByStatus } from "@/lib/ingest/queue";

/**
 * GET /api/ingest/queue — wajah MESIN + UI (M9-3).
 * Lihat antrean ingest (terbaru dulu) + ringkasan per status.
 */
export const GET = wrapRoute({
  authz: { kind: "route", permission: "ingest:queue:read" },
  rateLimit: true,
  query: ingestQueueQuerySchema,
  handler: async ({ query }) => {
    const [items, counts] = await Promise.all([
      listQueue(query.status ? { status: query.status, limit: query.limit } : { limit: query.limit }),
      countByStatus(),
    ]);
    return { items, counts };
  },
});
