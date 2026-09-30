import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  addItem,
  reorderItems,
  listBundleItems,
} from "@/lib/services/bundle-service";

const postSchema = z.object({
  questionId: z.string().uuid(),
  role: z.enum(["question", "stimulus"]).optional(),
  sectionName: z.string().max(100).nullable().optional(),
});

const putSchema = z.object({
  /** Urutan item baru (daftar id item, sesuai urutan yang diinginkan). */
  itemIds: z.array(z.string().uuid()).min(1),
});

/** GET /api/bundles/[id]/items — daftar item paket. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async ({ params, actor }) => listBundleItems(params.id, actor),
});

/** POST /api/bundles/[id]/items — tambah soal ke paket. */
export const POST = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  permission: "bundle:manage",
  body: postSchema,
  handler: async ({ params, body, actor }) =>
    addItem(params.id, body.questionId, actor, {
      role: body.role,
      sectionName: body.sectionName,
    }),
});

/** PUT /api/bundles/[id]/items — susun ulang urutan item. */
export const PUT = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  permission: "bundle:manage",
  body: putSchema,
  handler: async ({ params, body, actor }) => {
    await reorderItems(params.id, body.itemIds, actor);
    return { ok: true };
  },
});
