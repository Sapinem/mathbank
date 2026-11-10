import { wrapRoute } from "@/lib/api/route-wrapper";
import { canonicalIngestBatchSchema } from "@/lib/contracts/ingest-canonical";
import { ingestCanonicalBatch } from "@/lib/services/ingest-gateway-service";

/**
 * POST /api/ingest/questions — Gateway Ingest Kanonik (M9 Refactor / Ingest Decoupling).
 *
 * Menerima batch soal JSON berformat kanonik MathBank (maks 50 butir),
 * memvalidasi standar mutu (KaTeX, Zod), dan menyimpan soal draft ke database
 * dengan deduplikasi hash & pencatatan provenance.
 */
export const POST = wrapRoute({
  authz: { kind: "route", permission: "question:create" },
  rateLimit: { capacity: 30, refillPerSec: 1 },
  body: canonicalIngestBatchSchema,
  status: 200,
  idempotent: true,
  handler: async ({ body, actor }) => {
    return ingestCanonicalBatch(body, actor);
  },
});
