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
  authz: { kind: "route", permission: "question:view" },
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
 * Izin `bundle:manage` ber-`own` (latihan = milik pembuat), jadi gerbang route
 * tanpa `ownerId` akan menolak semua guru (CONSTRAINTS #35). Otorisasi
 * per-paket ditegakkan `assertBundleWrite` di service.
 */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/bundle-shared.ts:assertBundleWrite",
  },
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
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/bundle-shared.ts:assertBundleWrite",
  },
  params: paramsSchema,
  query: emptyQuerySchema,
  handler: async ({ params, actor }) => {
    await archiveBundle(params.id, actor);
    return { ok: true };
  },
});
