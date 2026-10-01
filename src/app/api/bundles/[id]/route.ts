import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  getBundle,
  updateBundle,
  archiveBundle,
  listBundleItems,
} from "@/lib/services/bundle-service";
import { NotFoundError } from "@/lib/auth/guards";

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  bundleType: z.enum(["source", "exam", "exercise"]).optional(),
  sourceId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  grade: z.string().max(20).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  instructions: z.string().max(5000).nullable().optional(),
  status: z.enum(["draft", "review", "ready", "archived"]).optional(),
});

/** GET /api/bundles/[id] — detail paket + item berurutan. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async ({ params, actor }) => {
    const b = await getBundle(params.id);
    if (!b) throw new NotFoundError("Paket tidak ditemukan.");
    const items = await listBundleItems(params.id, actor);
    return { ...b, items };
  },
});

/**
 * PATCH /api/bundles/[id] — perbarui metadata paket.
 *
 * SENGAJA **tanpa** `permission` di gerbang route (CONSTRAINTS #35): izin
 * `bundle:manage` kini ber-`own` (latihan = milik pembuat), sedang `wrapRoute`
 * memanggil `assertCan(actor, perm)` **tanpa `ownerId`** → akan 403 semua guru.
 * Otorisasi per-paket ditegakkan di `updateBundle` → `assertBundleWrite`.
 */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  body: patchSchema,
  handler: async ({ params, body, actor }) => updateBundle(params.id, body, actor),
});

/**
 * DELETE /api/bundles/[id] — arsipkan paket (soft-delete).
 *
 * Alasan sama seperti PATCH: ditegakkan di `archiveBundle` → `assertBundleWrite`.
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  handler: async ({ params, actor }) => {
    await archiveBundle(params.id, actor);
    return { ok: true };
  },
});
