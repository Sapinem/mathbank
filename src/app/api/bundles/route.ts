import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { listBundles, createBundle } from "@/lib/services/bundle-service";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  bundleType: z.enum(["source", "exam"]),
  origin: z.enum(["ingest", "manual"]).optional(),
  sourceId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  grade: z.string().max(20).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  instructions: z.string().max(5000).nullable().optional(),
});

/**
 * Filter + paginasi daftar paket (MAT-39 + **PERF-05** + **ACT-04**).
 * `limit` default 20; `coerce` karena query string selalu teks.
 *
 * ACT-04: `status` & `q` diproses **server-side** agar klien cukup satu
 * request untuk satu halaman (tanpa menarik seluruh paket lalu memfilter).
 */
const listQuerySchema = z.object({
  bundleType: z.enum(["source", "exam"]).optional(),
  origin: z.enum(["ingest", "manual"]).optional(),
  status: z.enum(["active", "draft", "review", "ready", "archived"]).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * GET /api/bundles — daftar paket aktif.
 * MAT-39: dukung filter `bundleType` & `origin` via query string.
 * PERF-05: dukung `limit` (default 20) & `offset`.
 * ACT-04: dukung `status` & `q` + amplop berisi `stats` (satu request/halaman).
 */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  query: listQuerySchema,
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
  body: createSchema,
  idempotent: true, // #4: anti double-submit pembuatan paket
  handler: async ({ body, actor }) => createBundle(body, actor),
});
