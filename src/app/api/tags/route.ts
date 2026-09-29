import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { createTag, listTags } from "@/lib/services/taxonomy-service";

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

/** GET /api/tags — daftar label (dengan usageCount). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async () => listTags(),
});

/** POST /api/tags — buat label. */
export const POST = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  body: createSchema,
  handler: async ({ body, actor }) => createTag(body, actor),
});
