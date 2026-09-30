import { wrapRoute } from "@/lib/api/route-wrapper";
import { cleanUnusedTags } from "@/lib/services/taxonomy-service";

/**
 * POST /api/tags/clean-unused — hapus semua label tak terpakai ('usage_count = 0').
 *
 * **T-M5-3:** endpoint ini diklaim ada di dokumen audit M5 tapi sebelumnya **tidak
 * ada** (405). Kini diimplementasikan. Izin `taxonomy:manage` (admin/guru).
 */
export const POST = wrapRoute({
  rateLimit: { capacity: 5, refillPerSec: 0.1 },
  permission: "taxonomy:manage",
  handler: async ({ actor }) => {
    const removed = await cleanUnusedTags(actor);
    return { removed };
  },
});
