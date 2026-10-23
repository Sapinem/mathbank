import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateQuestionSchema } from "@/lib/contracts/question";
import {
  getQuestion,
  updateQuestion,
  deleteQuestion,
} from "@/lib/services/question-service";
import { recordViewAudit } from "@/lib/services/audit";
import { NotFoundError } from "@/lib/auth/guards";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();

/** GET /api/questions/[id] — detail soal + opsi. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params, actor }) => {
    const q = await getQuestion(params.id, { viewer: actor });
    if (!q) throw new NotFoundError("Soal tidak ditemukan.");
    // M13 S7: catat akses KUNCI JAWABAN (data sensitif) — hanya bila key terkirim.
    if (q.answerKey) {
      await recordViewAudit({
        entityType: "question",
        entityId: params.id,
        action: "view",
        actor,
        changeSummary: "Melihat kunci jawaban soal",
      });
    }
    return q;
  },
});

/**
 * PATCH /api/questions/[id] — perbarui soal.
 *
 * SENGAJA **tanpa** `permission` di gate route (CONSTRAINTS #35): izin
 * `question:edit` bersifat ber-`own` (guru/penelaah/agen hanya boleh miliknya),
 * sedang `wrapRoute` memanggil `assertCan(actor, perm)` **tanpa `ownerId`** →
 * akan menolak 403 semua peran ber-`own`. Otorisasi kepemilikan ditegakkan di
 * `updateQuestion` (service) yang punya `existing.authorId`.
 */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  params: paramsSchema,
  body: updateQuestionSchema,
  handler: async ({ params, body, actor }) => updateQuestion(params.id, body, actor),
});

/**
 * DELETE /api/questions/[id] — hapus lunak.
 *
 * Alasan sama seperti PATCH: `question:delete` ber-`own`, ditegakkan di
 * `deleteQuestion` (service), bukan di gate route (#35).
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 10, refillPerSec: 0.2 },
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params, actor }) => {
    await deleteQuestion(params.id, actor);
    return { ok: true };
  },
});
