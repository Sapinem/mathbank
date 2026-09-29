import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateTag, deleteTag } from "@/lib/services/taxonomy-service";

const patchSchema = z.object({ name: z.string().trim().min(1).max(100) });

/** PATCH /api/tags/[id] — ubah label. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  body: patchSchema,
  handler: async ({ body, actor, params }) =>
    updateTag((await params).id, body, actor),
});

/** DELETE /api/tags/[id] — hapus label (RESTRICT bila dipakai soal). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  handler: async ({ actor, params }) => {
    await deleteTag((await params).id, actor);
    return { ok: true };
  },
});
