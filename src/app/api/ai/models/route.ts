import { wrapRoute } from "@/lib/api/route-wrapper";
import { getAiConfig } from "@/lib/ai/config";
import { listModels } from "@/lib/ai/client";

/**
 * GET /api/ai/models — daftar model dari provider (fftur "pilih model yang tersedia").
 * Hanya `settings:manage` (admin) — dipakai di halaman Pengaturan → bagian AI.
 * Bila base_url kosong, kembalikan daftar kosong (bukan error).
 */
export const GET = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 0.5 },
  permission: "settings:manage",
  handler: async () => {
    const cfg = await getAiConfig();
    if (!cfg.baseUrl) return { models: [], error: "ai.base_url belum diatur." };
    const r = await listModels(cfg);
    return { models: r.models, error: r.ok ? undefined : r.error };
  },
});
