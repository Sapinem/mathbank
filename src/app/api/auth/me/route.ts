import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";

const emptyQuerySchema = z.object({}).optional();

/**
 * GET /api/auth/me — identitas aktor saat ini (L3: endpoint identitas yang BENAR;
 * QBank salah memanggil /api/auth/change-password).
 */
export const GET = wrapRoute({
  authz: { kind: "authenticated" },
  rateLimit: true,
  // Izinkan meski wajib ganti password — UI perlu membaca status ini
  // untuk mengarahkan ke /change-password.
  allowPasswordChangePending: true,
  query: emptyQuerySchema,
  handler: async ({ actor }) => ({
    id: actor.id,
    name: actor.name,
    roles: actor.roles,
    via: actor.via,
    mustChangePassword: actor.mustChangePassword === true,
  }),
});
