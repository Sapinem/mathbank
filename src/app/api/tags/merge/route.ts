import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { mergeTags } from "@/lib/services/taxonomy-service";

const mergeSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});

/**
 * POST /api/tags/merge — gabungkan label sinonim (G3.3).
 *
 * Atomik: pindahkan relasi soal dari `sourceId` → `targetId`, lalu hapus sumber.
 * Izin `taxonomy:manage` (admin/guru). Mengembalikan jumlah soal dipindah.
 */
export const POST = wrapRoute({
  rateLimit: { capacity: 10, refillPerSec: 0.2 },
  authz: { kind: "route", permission: "taxonomy:manage" },
  body: mergeSchema,
  handler: async ({ body, actor }) => {
    const moved = await mergeTags(body.sourceId, body.targetId, actor);
    return { moved };
  },
});
