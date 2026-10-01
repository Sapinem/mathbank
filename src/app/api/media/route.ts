import { wrapRoute } from "@/lib/api/route-wrapper";
import { listMediaQuerySchema } from "@/lib/contracts/media";
import { listMedia } from "@/lib/services/media-service";

/**
 * GET /api/media — daftar aset galeri (paginasi + cari + filter asal).
 * Dipakai AssetPicker (editor soal) & halaman /assets.
 */
export const GET = wrapRoute({
  permission: "question:view",
  rateLimit: true,
  query: listMediaQuerySchema,
  handler: async ({ query }) =>
    listMedia({
      q: query.q,
      origin: query.origin,
      limit: query.limit,
      offset: query.offset,
    }),
});
