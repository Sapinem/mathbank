import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateSource, deleteSource } from "@/lib/services/taxonomy-service";

const sourceKind = z.enum(["book", "website", "school", "competition"]);

const patchSchema = z.object({
  kind: sourceKind.optional(),
  label: z.string().trim().min(1).max(255).optional(),
  url: z.string().url().max(2000).nullish(),
});

/** PATCH /api/sources/[id] — ubah sumber. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  body: patchSchema,
  handler: async ({ body, actor, params }) =>
    updateSource((await params).id, body, actor),
});

/** DELETE /api/sources/[id] — hapus sumber (RESTRICT bila dipakai soal). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  handler: async ({ actor, params }) => {
    await deleteSource((await params).id, actor);
    return { ok: true };
  },
});
