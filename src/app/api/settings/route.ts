import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import {
  getSettings,
  setSettings,
  GENERAL_KEYS,
  type SettingValue,
} from "@/lib/services/settings-service";

const valueSchema: z.ZodType<SettingValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

const patchSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1).max(255),
      value: valueSchema,
    }),
  ),
});

const emptyQuerySchema = z.object({}).optional();

/**
 * GET /api/settings — pengaturan umum (secret dimask).
 * Hanya `settings:manage` (admin).
 */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "settings:manage",
  query: emptyQuerySchema,
  handler: async () => {
    const items = await getSettings([...GENERAL_KEYS]);
    return { items };
  },
});

/**
 * PATCH /api/settings — perbarui pengaturan umum.
 * Hanya kunci yang dikenal (GENERAL_KEYS) boleh ditulis dari endpoint ini;
 * kunci AI/secret ditangani khusus di M10.
 */
export const PATCH = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  permission: "settings:manage",
  body: patchSchema,
  handler: async ({ body }) => {
    await setSettings(body.settings, { allowedKeys: GENERAL_KEYS });
    const items = await getSettings([...GENERAL_KEYS]);
    return { items };
  },
});
