import { wrapRoute } from "@/lib/api/route-wrapper";
import { validateBundle } from "@/lib/services/bundle-service";

/** GET /api/bundles/[id]/validate — validasi paket (peringatan kunci, dsb). */
export const GET = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "question:view",
  handler: async ({ params }) => validateBundle(params.id),
});
