import { wrapRoute } from "@/lib/api/route-wrapper";
import { createBundleSchema, listBundlesQuerySchema } from "@/lib/contracts/bundle";
import { listBundles, createBundle } from "@/lib/services/bundle-service";

/**
 * GET /api/bundles — daftar paket aktif.
 * MAT-39: dukung filter `bundleType` & `origin` via query string.
 * PERF-05: dukung `limit` (default 20) & `offset`.
 * ACT-04: dukung `status` & `q` + amplop berisi `stats` (satu request/halaman).
 */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  query: listBundlesQuerySchema,
  handler: async ({ actor, query }) =>
    listBundles(actor, {
      bundleType: query?.bundleType,
      origin: query?.origin,
      status: query?.status,
      q: query?.q || undefined,
      limit: query?.limit,
      offset: query?.offset,
    }),
});

/**
 * POST /api/bundles — buat paket baru.
 *
 * Gerbang route memakai izin **dasar** `question:view` (semua guru punya);
 * aturan sebenarnya (agent tak boleh) ditegakkan `assertCan(actor,
 * "bundle:manage")` di `createBundle` — di sana `ownerId` tak relevan karena
 * barisnya belum ada.
 */
export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  permission: "question:view",
  body: createBundleSchema,
  idempotent: true, // #4: anti double-submit pembuatan paket
  handler: async ({ body, actor }) => createBundle(body, actor),
});
