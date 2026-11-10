import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { revokeAgentKey } from "@/lib/services/agent-key-service";

const paramsSchema = z.object({ id: z.string().uuid() });
const emptyQuerySchema = z.object({}).optional();

/**
 * DELETE /api/system/agent-keys/[id] — cabut (hapus) API key agen (M11-e).
 * Izin: `user:manage` (admin).
 */
export const DELETE = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  authz: { kind: "route", permission: "user:manage" },
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  handler: async ({ actor, params, expectedVersion }) => {
    await revokeAgentKey(actor, params.id, expectedVersion);
    return { ok: true };
  },
});
