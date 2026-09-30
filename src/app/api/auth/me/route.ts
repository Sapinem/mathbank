import { wrapRoute } from "@/lib/api/route-wrapper";

/**
 * GET /api/auth/me — identitas aktor saat ini (L3: endpoint identitas yang BENAR;
 * QBank salah memanggil /api/auth/change-password).
 */
export const GET = wrapRoute({
  rateLimit: true,
  // Izinkan meski wajib ganti password — UI perlu membaca status ini
  // untuk mengarahkan ke /change-password.
  allowPasswordChangePending: true,
  handler: async ({ actor }) => ({
    id: actor.id,
    name: actor.name,
    roles: actor.roles,
    via: actor.via,
    mustChangePassword: actor.mustChangePassword === true,
  }),
});
