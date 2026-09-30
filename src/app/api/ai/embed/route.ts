import { wrapRoute } from "@/lib/api/route-wrapper";
import { aiEmbedSchema } from "@/lib/contracts/ai";
import { embedQuestions } from "@/lib/services/enrichment-service";

/**
 * POST /api/ai/embed — hitung + simpan embedding soal (BGE-M3).
 * Body: `{ questionIds[] }`. Lewati yang tak berubah.
 *
 * Gerbang: `question:view`; izin tulis (`question:edit` + `own`) diperiksa
 * per-soal di service.
 */
export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.2 },
  permission: "question:view",
  body: aiEmbedSchema,
  handler: async ({ body, actor }) => {
    const r = await embedQuestions(body.questionIds, actor);
    return { ok: r.ok, results: r.results };
  },
});
