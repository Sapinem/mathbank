import { wrapRoute } from "@/lib/api/route-wrapper";
import { changeStatusSchema } from "@/lib/contracts/question";
import { changeQuestionStatus } from "@/lib/services/question-service";

/**
 * PATCH /api/questions/[id]/status — ubah status lewat FSM (L6).
 *
 * **T-M4-3:** TIDAK ada `permission` di gerbang route — izin **berbeda per tujuan
 * transisi** (`ready`→`setReady`, `archived`→`archive`, lainnya→`edit`+owner) dan
 * **sudah ditegakkan di `changeQuestionStatus`**. Gerbang `question:edit` di sini
 * dulu memakai `own` **tanpa ownerId** → memblokir penelaah (yang izinnya `own`)
 * dari menyetujui soal orang lain → **alur telaah mati**. Route cukup butuh aktor
 * terautentikasi; service yang menentukan.
 */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  body: changeStatusSchema,
  handler: async ({ params, body, actor }) =>
    changeQuestionStatus(params.id, body.status, actor, body.notes),
});
