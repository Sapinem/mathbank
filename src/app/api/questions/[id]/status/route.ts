import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { changeStatusSchema } from "@/lib/contracts/question";
import { changeQuestionStatus } from "@/lib/services/question-service";

const paramsSchema = z.object({ id: z.string().uuid() });

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
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/question-status.ts:changeQuestionStatus",
  },
  params: paramsSchema,
  body: changeStatusSchema,
  ifMatch: true,
  handler: async ({ params, body, actor, expectedVersion }) =>
    changeQuestionStatus(params.id, body.status, actor, body.notes, { expectedVersion }),
});
