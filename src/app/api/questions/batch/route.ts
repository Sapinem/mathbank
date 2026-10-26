import { wrapRoute } from "@/lib/api/route-wrapper";
import { bulkActionSchema } from "@/lib/contracts/question";
import { bulkQuestionAction } from "@/lib/services/question-bulk";

/**
 * POST /api/questions/batch — aksi massal (G3.1).
 *
 * **Tanpa** `permission` di gerbang route — izin **berbeda per aksi** (ready→setReady,
 * archive→archive, reject→edit+owner, flag→flag) dan **sudah ditegakkan per-butir**
 * di `bulkQuestionAction` (memakai ulang `changeQuestionStatus`/`setQuestionFlag`).
 * Pola sama dengan `[id]/status` (lihat CONSTRAINT #35).
 */
export const POST = wrapRoute({
  rateLimit: { capacity: 10, refillPerSec: 0.2 }, // berat: ~10 burst, 12/menit
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/question-bulk.ts:bulkQuestionAction",
  },
  body: bulkActionSchema,
  handler: async ({ body, actor }) =>
    bulkQuestionAction(body.ids, body.action, actor, body.notes ?? null),
});
