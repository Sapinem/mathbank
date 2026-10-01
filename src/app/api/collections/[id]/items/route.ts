import { wrapRoute } from "@/lib/api/route-wrapper";
import { addItemSchema, reorderItemsSchema } from "@/lib/contracts/collection";
import {
  addCollectionItem,
  removeCollectionItem,
  reorderCollectionItems,
  listQuestionIdsInCollection,
} from "@/lib/services/collection-service";

/** GET /api/collections/[id]/items — id soal dalam koleksi (urut tampilan). */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "collection:view",
  handler: async ({ params }) => listQuestionIdsInCollection((await params).id),
});

/** POST /api/collections/[id]/items — masukkan soal (idempoten). */
export const POST = wrapRoute({
  rateLimit: { capacity: 120, refillPerSec: 4 },
  permission: "collection:manage",
  body: addItemSchema,
  status: 201,
  handler: async ({ body, actor, params }) =>
    addCollectionItem((await params).id, body.questionId, actor),
});

/** PUT /api/collections/[id]/items — susun ulang urutan. */
export const PUT = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  permission: "collection:manage",
  body: reorderItemsSchema,
  handler: async ({ body, actor, params }) => {
    await reorderCollectionItems((await params).id, body.questionIds, actor);
    return { ok: true };
  },
});

/**
 * DELETE /api/collections/[id]/items?questionId=… — keluarkan soal.
 *
 * Pakai query (bukan segmen path) supaya konsisten dengan pola
 * `bundles/[id]/items/[itemId]` yang memakai id item; di sini identitas
 * alaminya adalah pasangan (koleksi, soal).
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 120, refillPerSec: 4 },
  permission: "collection:manage",
  query: addItemSchema,
  handler: async ({ query, actor, params }) => {
    await removeCollectionItem((await params).id, query.questionId, actor);
    return { ok: true };
  },
});
