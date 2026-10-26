import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { listAgentKeys, createAgentKey } from "@/lib/services/agent-key-service";

/**
 * /api/system/agent-keys — manajemen API key agen MCP (M11-e).
 *
 * Izin: `user:manage` (admin). Agen mengakses MathBank lewat `/api/mcp`
 * memakai kunci ini; halaman Pengaturan memakainya untuk buat/cabut.
 */

const createSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  expiresInDays: z.coerce.number().int().min(0).max(365).optional(),
});

const emptyQuerySchema = z.object({}).optional();

/** GET /api/system/agent-keys — daftar kunci agen (tanpa nilai rahasia). */
export const GET = wrapRoute({
  rateLimit: true,
  authz: { kind: "route", permission: "user:manage" },
  query: emptyQuerySchema,
  handler: async ({ actor }) => ({ items: await listAgentKeys(actor) }),
});

/** POST /api/system/agent-keys — buat kunci baru (nilai penuh hanya sekali). */
export const POST = wrapRoute({
  rateLimit: { capacity: 20, refillPerSec: 0.5 },
  authz: { kind: "route", permission: "user:manage" },
  body: createSchema,
  handler: async ({ body, actor }) => createAgentKey(actor, body),
});
