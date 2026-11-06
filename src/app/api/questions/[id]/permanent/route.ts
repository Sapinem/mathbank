import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { hardDeleteQuestion } from "@/lib/services/question-service";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();

/**
 * DELETE /api/questions/[id]/permanent — hapus PERMANEN (hard delete).
 *
 * **T-M4-4:** memakai izin `question:hardDelete` (dulu mati). Hanya boleh untuk
 * soal yang sudah soft-deleted; RESTRICT bila dipakai paket.
 *
 * **T-M4-3 (pelajaran):** JANGAN pasang izin ber-`own` di gerbang route tanpa
 * `ownerId` — `assertCan` tanpa ownerId menolak peran `own` (guru/penelaah).
 * Izin ditegakkan di **service** `hardDeleteQuestion` **dengan** `ownerId`.
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 5, refillPerSec: 0.1 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/question-write.ts:hardDeleteQuestion",
  },
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  handler: async ({ params, actor, expectedVersion }) => {
    await hardDeleteQuestion(params.id, actor, expectedVersion);
    return { ok: true };
  },
});
