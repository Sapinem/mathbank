import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateBundleSchema } from "@/lib/contracts/bundle";
import {
  getBundle,
  updateBundle,
  archiveBundle,
  listBundleItems,
} from "@/lib/services/bundle-service";
import { NotFoundError } from "@/lib/auth/guards";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();

/** GET /api/bundles/[id] — detail paket + item berurutan. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params, actor }) => {
    const [b, items] = await Promise.all([
      getBundle(params.id),
      listBundleItems(params.id, actor),
    ]);
    if (!b) throw new NotFoundError("Paket tidak ditemukan.");
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
  params: paramsSchema,
  body: updateBundleSchema,
  handler: async ({ params, body, actor }) => updateBundle(params.id, body, actor),
});

/**
 * DELETE /api/bundles/[id] — arsipkan paket (soft-delete).
 *
 * Alasan sama seperti PATCH: ditegakkan di `archiveBundle` → `assertBundleWrite`.
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params, actor }) => {
    await archiveBundle(params.id, actor);
    return { ok: true };
  },
});
