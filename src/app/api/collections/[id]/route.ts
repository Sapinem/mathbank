import { wrapRoute } from "@/lib/api/route-wrapper";
import { updateCollectionSchema } from "@/lib/contracts/collection";
import {
  getCollection,
  updateCollection,
  deleteCollection,
} from "@/lib/services/collection-service";
import { NotFoundError } from "@/lib/auth/guards";

/** GET /api/collections/[id] — satu koleksi + id soalnya. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "collection:view",
  handler: async ({ params }) => {
    const row = await getCollection((await params).id);
    if (!row) throw new NotFoundError("Koleksi tidak ditemukan.");
    return row;
  },
});

/** PATCH /api/collections/[id] — ubah metadata koleksi. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "collection:manage",
  body: updateCollectionSchema,
  handler: async ({ body, actor, params }) =>
    updateCollection((await params).id, body, actor),
});

/** DELETE /api/collections/[id] — hapus koleksi (soalnya TIDAK terhapus). */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 0.5 },
  permission: "collection:manage",
  handler: async ({ actor, params }) => {
    await deleteCollection((await params).id, actor);
    return { ok: true };
  },
});
