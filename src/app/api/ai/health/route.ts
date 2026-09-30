import { wrapRoute } from "@/lib/api/route-wrapper";
import { getAiConfig } from "@/lib/ai/config";
import { health } from "@/lib/ai/client";
import { embeddingHealth } from "@/lib/embedding/bge-m3";

/**
 * GET /api/ai/health — cek LLM (9router) + service embedding (Ollama BGE-M3).
 * Hanya `settings:manage` (admin).
 */
export const GET = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 0.5 },
  permission: "settings:manage",
  handler: async () => {
    const cfg = await getAiConfig();
    const [llm, embed] = await Promise.all([health(cfg), embeddingHealth()]);
    return {
      llm: { enabled: cfg.enabled, model: cfg.model || null, ok: llm.ok, error: llm.error ?? null },
      embedding: { ok: embed.ok, error: embed.error ?? null },
    };
  },
});
