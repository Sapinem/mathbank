import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { setQuestionFlag } from "@/lib/services/question-service";

const flagSchema = z.object({
  flagged: z.boolean(),
  notes: z.string().nullable().optional(),
});

/** PATCH /api/questions/[id]/flag — tandai/lepas tanda masalah. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "question:flag",
  body: flagSchema,
  handler: async ({ params, body, actor }) =>
    setQuestionFlag(params.id, body.flagged, body.notes ?? null, actor),
});
