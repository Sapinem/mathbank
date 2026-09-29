import { wrapRoute } from "@/lib/api/route-wrapper";

/**
 * GET /api/auth/me — identitas aktor saat ini (L3: endpoint identitas yang BENAR;
 * QBank salah memanggil /api/auth/change-password).
 */
export const GET = wrapRoute({
  handler: async ({ actor }) => ({
    id: actor.id,
    name: actor.name,
    roles: actor.roles,
    via: actor.via,
  }),
});
