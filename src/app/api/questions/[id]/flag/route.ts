import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { setQuestionFlag } from "@/lib/services/question-service";

const paramsSchema = z.object({ id: z.string().uuid() });

const flagSchema = z.object({
  flagged: z.boolean(),
  notes: z.string().nullable().optional(),
});

/** PATCH /api/questions/[id]/flag — tandai/lepas tanda masalah. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/question-write.ts:setQuestionFlag",
  },
  params: paramsSchema,
  body: flagSchema,
  ifMatch: true,
  handler: async ({ params, body, actor, expectedVersion }) =>
    setQuestionFlag(params.id, body.flagged, body.notes ?? null, actor, expectedVersion),
});
