import { wrapRoute } from "@/lib/api/route-wrapper";
import { createCollectionSchema } from "@/lib/contracts/collection";
import { listCollections, createCollection } from "@/lib/services/collection-service";

/**
 * GET /api/collections — daftar koleksi (arsip publik).
 *
 * ADR-0016: izin `collection:view` = `yes` untuk semua peran, jadi **boleh**
 * dipasang di gerbang route (CONSTRAINTS #35 hanya mengikat izin ber-`own`).
 */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "collection:view",
  handler: async () => listCollections(),
});

/** POST /api/collections — buat koleksi. */
export const POST = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  permission: "collection:manage",
  body: createCollectionSchema,
  status: 201,
  handler: async ({ body, actor }) => createCollection(body, actor),
});
