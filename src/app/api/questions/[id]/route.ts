import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateQuestionSchema } from "@/lib/contracts/question";
import {
  getQuestion,
  updateQuestion,
  deleteQuestion,
} from "@/lib/services/question-service";
import { NotFoundError } from "@/lib/auth/guards";

/** GET /api/questions/[id] — detail soal + opsi. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async ({ params, actor }) => {
    const q = await getQuestion(params.id, { viewer: actor });
    if (!q) throw new NotFoundError("Soal tidak ditemukan.");
    return q;
  },
});

/** PATCH /api/questions/[id] — perbarui soal. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "question:edit",
  body: updateQuestionSchema,
  handler: async ({ params, body, actor }) => updateQuestion(params.id, body, actor),
});

/** DELETE /api/questions/[id] — hapus lunak. */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 10, refillPerSec: 0.2 },
  permission: "question:delete",
  handler: async ({ params, actor }) => {
    await deleteQuestion(params.id, actor);
    return { ok: true };
  },
});
