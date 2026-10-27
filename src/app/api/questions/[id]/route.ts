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
  authz: { kind: "route", permission: "question:view" },
  params: paramsSchema,
  query: emptyQuerySchema,
  etagFrom: (q: { version: number }) => q.version,
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
 * Izin `question:edit` ber-`own` (guru/penelaah/agen hanya boleh miliknya),
 * jadi gerbang route tanpa `ownerId` akan menolak semua peran ber-`own`
 * (CONSTRAINTS #35). Otorisasi kepemilikan ditegakkan di `updateQuestion`
 * (service) yang punya `existing.authorId`.
 */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/question-write.ts:updateQuestion",
  },
  params: paramsSchema,
  body: updateQuestionSchema,
  ifMatch: true,
  handler: async ({ params, body, actor, expectedVersion }) =>
    updateQuestion(params.id, body, actor, expectedVersion),
});

/**
 * DELETE /api/questions/[id] — hapus lunak.
 *
 * Alasan sama seperti PATCH: `question:delete` ber-`own`, ditegakkan di
 * `deleteQuestion` (service), bukan di gate route (#35).
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 10, refillPerSec: 0.2 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/question-write.ts:deleteQuestion",
  },
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  handler: async ({ params, actor, expectedVersion }) => {
    await deleteQuestion(params.id, actor, expectedVersion);
    return { ok: true };
  },
});
