import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";

/**
 * GET /api/dev/demo-status — apakah login demo tersedia di lingkungan ini.
 *
 * Dipakai halaman `/login` untuk menampilkan/menyembunyikan pil akun demo,
 * agar di produksi (tanpa `DEMO_LOGIN=enabled`) form login tampil bersih.
 */
const querySchema = z.object({}).optional();

export const GET = wrapRoute({
  auth: false,
  query: querySchema,
  handler: async () => {
    const demo =
      process.env.DEMO_LOGIN === "enabled" ||
      process.env.NODE_ENV !== "production";
    return { demo };
  },
});
