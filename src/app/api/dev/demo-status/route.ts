import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { demoLoginAllowed } from "@/lib/auth/demo-login";

/**
 * GET /api/dev/demo-status — apakah login demo tersedia di lingkungan ini.
 *
 * Dipakai halaman `/login` untuk menampilkan/menyembunyikan pil akun demo,
 * agar di produksi (tanpa `DEMO_LOGIN=enabled`) form login tampil bersih.
 */
const querySchema = z.object({}).optional();

export const GET = wrapRoute({
  authz: {
    kind: "public",
    reason: "Status login demo dibaca halaman /login sebelum ada sesi.",
  },
  rateLimit: true,
  rateLimitScope: "dev:demo-status",
  query: querySchema,
  handler: async () => {
    // Satu-satunya sumber kebenaran pagar demo (Fase 2) — sama dengan
    // quick-login, supaya tombol demo di halaman login tidak pernah
    // tampil di lingkungan tempat quick-login mati.
    return { demo: demoLoginAllowed() };
  },
});
