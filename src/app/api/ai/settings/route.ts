import { wrapRoute } from "@/lib/api/route-wrapper";
import { aiSettingsSchema } from "@/lib/contracts/ai";
import { getAiSettings, saveAiSettings } from "@/lib/services/ai-settings-service";

/**
 * GET /api/ai/settings — pengaturan AI (secret dimask).
 * POST /api/ai/settings — simpan pengaturan AI (key terenkripsi).
 * Hanya `settings:manage` (admin).
 */
export const GET = wrapRoute({
  rateLimit: true,
  permission: "settings:manage",
  handler: async () => {
    const items = await getAiSettings();
    return { items };
  },
});

export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  permission: "settings:manage",
  body: aiSettingsSchema,
  handler: async ({ body }) => {
    const items = await saveAiSettings(body);
    return { items };
  },
});
