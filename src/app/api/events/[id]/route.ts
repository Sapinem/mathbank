import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateEvent, deleteEvent } from "@/lib/services/taxonomy-service";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  shortname: z.string().trim().min(1).max(50).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  subtests: z.array(z.string().max(100)).max(50).optional(),
  aliases: z.array(z.string().max(100)).max(50).optional(),
});

/** PATCH /api/events/[id] — ubah event. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "reference:manage",
  body: patchSchema,
  handler: async ({ body, actor, params }) =>
    updateEvent((await params).id, body, actor),
});

/** DELETE /api/events/[id] — hapus event (RESTRICT bila dipakai soal). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "reference:manage",
  handler: async ({ actor, params }) => {
    await deleteEvent((await params).id, actor);
    return { ok: true };
  },
});
