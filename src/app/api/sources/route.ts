import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { createSource, listSources } from "@/lib/services/taxonomy-service";

const sourceKind = z.enum(["book", "website", "school", "competition"]);

const createSchema = z.object({
  kind: sourceKind,
  label: z.string().trim().min(1).max(255),
  url: z.string().url().max(2000).nullish(),
});

/** GET /api/sources — daftar sumber (dengan usageCount). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async () => listSources(),
});

/** POST /api/sources — buat sumber (butuh taxonomy:manage). */
export const POST = wrapRoute({
  rateLimit: true,
  permission: "reference:manage",
  body: createSchema,
  handler: async ({ body, actor }) => createSource(body, actor),
});
