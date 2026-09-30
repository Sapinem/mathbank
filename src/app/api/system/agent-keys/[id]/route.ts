import { wrapRoute } from "@/lib/api/route-wrapper";
import { revokeAgentKey } from "@/lib/services/agent-key-service";

/**
 * DELETE /api/system/agent-keys/[id] — cabut (hapus) API key agen (M11-e).
 * Izin: `user:manage` (admin).
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  permission: "user:manage",
  handler: async ({ actor, params }) => {
    await revokeAgentKey(actor, (await params).id);
    return { ok: true };
  },
});
