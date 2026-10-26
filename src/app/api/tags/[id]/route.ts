import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateTag, deleteTag } from "@/lib/services/taxonomy-service";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();
const patchSchema = z.object({ name: z.string().trim().min(1).max(100) });

/** PATCH /api/tags/[id] — ubah label. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: { kind: "route", permission: "taxonomy:manage" },
  params: paramsSchema,
  body: patchSchema,
  ifMatch: true,
  handler: async ({ body, actor, params, expectedVersion }) =>
    updateTag(params.id, body, actor, expectedVersion),
});

/** DELETE /api/tags/[id] — hapus label (RESTRICT bila dipakai soal). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: { kind: "route", permission: "taxonomy:manage" },
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  handler: async ({ actor, params, expectedVersion }) => {
    await deleteTag(params.id, actor, expectedVersion);
    return { ok: true };
  },
});
