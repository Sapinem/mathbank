import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  getTopic,
  updateTopic,
  deleteTopic,
} from "@/lib/services/topic-service";
import { NotFoundError } from "@/lib/auth/guards";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** GET /api/topics/[id] — satu topik. */
export const GET = wrapRoute({
  rateLimit: true,
  authz: { kind: "route", permission: "question:view" },
  params: paramsSchema,
  query: emptyQuerySchema,
  etagFrom: (t: { version: number }) => t.version,
  handler: async ({ params }) => {
    const t = await getTopic(params.id);
    if (!t) throw new NotFoundError("Topik tidak ditemukan.");
    return t;
  },
});

/** PATCH /api/topics/[id] — perbarui (anti-siklus & level). */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: { kind: "route", permission: "taxonomy:manage" },
  params: paramsSchema,
  body: patchSchema,
  ifMatch: true,
  handler: async ({ params, body, actor, expectedVersion }) =>
    updateTopic(params.id, body, actor, expectedVersion),
});

/** DELETE /api/topics/[id] — hapus (tolak bila ada anak / dipakai). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  authz: { kind: "route", permission: "taxonomy:manage" },
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  handler: async ({ params, actor, expectedVersion }) => {
    await deleteTopic(params.id, actor, expectedVersion);
    return { ok: true };
  },
});
