import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { listBundles, createBundle } from "@/lib/services/bundle-service";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  bundleType: z.enum(["source", "exam", "exercise"]),
  sourceId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  grade: z.string().max(20).nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  instructions: z.string().max(5000).nullable().optional(),
});

/** GET /api/bundles — daftar paket aktif. */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "question:view",
  handler: async ({ actor }) => listBundles(actor),
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
