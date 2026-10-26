import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { duplicateBundle } from "@/lib/services/bundle-service";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z
  .object({ title: z.string().min(1).max(255).optional() })
  .optional();

/** POST /api/bundles/[id]/duplicate — duplikasi paket + seluruh item. */
export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/bundle-shared.ts:assertBundleCreate",
    routeGate: "question:view",
  },
  params: paramsSchema,
  body: bodySchema,
  handler: async ({ params, body, actor }) =>
    duplicateBundle(params.id, actor, body?.title),
});
