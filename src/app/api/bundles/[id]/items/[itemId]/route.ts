import { wrapRoute } from "@/lib/api/route-wrapper";
import { removeItem } from "@/lib/services/bundle-service";

/** DELETE /api/bundles/[id]/items/[itemId] — hapus item dari paket. */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  permission: "question:view", // #35: aturan sebenarnya di service (assertBundleWrite)
  handler: async ({ params, actor }) => {
    await removeItem(params.id, params.itemId, actor);
    return { ok: true };
  },
});
