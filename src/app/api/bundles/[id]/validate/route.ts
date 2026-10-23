import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { validateBundle } from "@/lib/services/bundle-service";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();

/** GET /api/bundles/[id]/validate — validasi paket (peringatan kunci, dsb). */
export const GET = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "question:view",
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params }) => validateBundle(params.id),
});
