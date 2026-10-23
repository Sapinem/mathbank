import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { removeItem } from "@/lib/services/bundle-service";

const paramsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});
const emptyQuerySchema = z.object({}).optional();

/** DELETE /api/bundles/[id]/items/[itemId] — hapus item dari paket. */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  permission: "question:view", // #35: aturan sebenarnya di service (assertBundleWrite)
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params, actor }) => {
    await removeItem(params.id, params.itemId, actor);
    return { ok: true };
  },
});
