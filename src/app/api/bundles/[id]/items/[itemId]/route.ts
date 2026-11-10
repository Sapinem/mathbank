import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { removeItem, updateBundleItemSlot } from "@/lib/services/bundle-service";
import { updateBundleItemSlotSchema } from "@/lib/contracts/bundle";

const paramsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});
const emptyQuerySchema = z.object({}).optional();

/** PATCH /api/bundles/[id]/items/[itemId] — perbarui metadata slot item dalam paket. */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/bundle-shared.ts:assertBundleWrite",
    routeGate: "question:view",
  },
  params: paramsSchema,
  query: emptyQuerySchema,
  body: updateBundleItemSlotSchema,
  ifMatch: true,
  etagFrom: (res: { bundleVersion?: number }) => res.bundleVersion,
  handler: async ({ params, body, actor, expectedVersion }) => {
    const updated = await updateBundleItemSlot(
      params.id,
      params.itemId,
      body,
      actor,
      expectedVersion,
    );
    return updated;
  },
});

/** DELETE /api/bundles/[id]/items/[itemId] — hapus item dari paket. */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 60, refillPerSec: 2 },
  authz: {
    kind: "service",
    enforcedIn: "src/lib/services/bundle-shared.ts:assertBundleWrite",
    routeGate: "question:view",
  },
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  etagFrom: (res: { bundleVersion?: number }) => res.bundleVersion,
  handler: async ({ params, actor, expectedVersion }) => {
    const res = await removeItem(params.id, params.itemId, actor, expectedVersion);
    return { ok: true, bundleVersion: res.bundleVersion };
  },
});
