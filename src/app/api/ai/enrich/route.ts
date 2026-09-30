import { wrapRoute } from "@/lib/api/route-wrapper";
import { aiEnrichBodySchema, type AiEnrichBody } from "@/lib/contracts/ai";
import { enrichQuestion, enrichQuestions } from "@/lib/services/enrichment-service";
import type { EnrichField } from "@/lib/ai/enrich";

/**
 * POST /api/ai/enrich — enrichment soal oleh AI (manual/batch).
 *
 * Body: `{ questionId, fields? }` ATAU `{ questionIds[], fields? }`.
 * Hasil = **usulan** diterapkan + status → `review` (jawaban tak disentuh).
 *
 * Gerbang: `question:view` (semua peran manusia). Izin tulis sebenarnya
 * (`question:edit`, termasuk aturan `own`) diperiksa **per-soal di service** —
 * sesuai pola repo (`own` tak boleh di gerbang route).
 */
export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.2 },
  permission: "question:view",
  body: aiEnrichBodySchema,
  handler: async ({ body, actor }: { body: AiEnrichBody; actor: import("@/lib/auth/actor").Actor }) => {
    if ("questionIds" in body) {
      const r = await enrichQuestions(body.questionIds, actor, body.fields as EnrichField[] | undefined);
      return { mode: "batch", ok: r.ok, failed: r.failed, results: r.results };
    }
    const r = await enrichQuestion(body.questionId, actor, body.fields as EnrichField[] | undefined);
    return { mode: "single", result: r };
  },
});
