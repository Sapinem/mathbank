import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  getTopic,
  updateTopic,
  deleteTopic,
} from "@/lib/services/topic-service";
import { NotFoundError } from "@/lib/auth/guards";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** GET /api/topics/[id] — satu topik. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async ({ params }) => {
    const t = await getTopic(params.id);
    if (!t) throw new NotFoundError("Topik tidak ditemukan.");
    return t;
  },
});

/** PATCH /api/topics/[id] — perbarui (anti-siklus & level). */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "taxonomy:manage",
  body: patchSchema,
  handler: async ({ params, body, actor }) => updateTopic(params.id, body, actor),
});

/** DELETE /api/topics/[id] — hapus (tolak bila ada anak / dipakai). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  permission: "taxonomy:manage",
  handler: async ({ params, actor }) => {
    await deleteTopic(params.id, actor);
    return { ok: true };
  },
});
