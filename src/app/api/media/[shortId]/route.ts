import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { ConflictError, NotFoundError } from "@/lib/auth/guards";
import { deleteAsset, getMediaDetail, updateMediaMeta } from "@/lib/services/media-service";
import { updateMediaSchema } from "@/lib/contracts/media";
import { isValidShortId } from "@/lib/media/short-id";

const paramsSchema = z.object({ shortId: z.string().min(1) });
const emptyQuerySchema = z.object({}).optional();

/** GET /api/media/[shortId] — detail aset + daftar soal yang memakainya. */
export const GET = wrapRoute({
  authz: { kind: "route", permission: "question:view" },
  rateLimit: true,
  params: paramsSchema,
  query: emptyQuerySchema,
  etagFrom: (d: { asset: { version: number } }) => d.asset.version,
  handler: async ({ params }) => {
    const shortId = params.shortId ?? "";
    if (!isValidShortId(shortId)) throw new NotFoundError("Media tidak ditemukan.");
    const detail = await getMediaDetail(shortId);
    if (!detail) throw new NotFoundError("Media tidak ditemukan.");
    return detail;
  },
});

/** PATCH /api/media/[shortId] — ubah metadata aset (judul/alt/caption/deskripsi). */
export const PATCH = wrapRoute({
  authz: { kind: "route", permission: "media:manage" },
  rateLimit: true,
  params: paramsSchema,
  body: updateMediaSchema,
  ifMatch: true,
  handler: async ({ params, body, expectedVersion }) => {
    const shortId = params.shortId ?? "";
    if (!isValidShortId(shortId)) throw new NotFoundError("Media tidak ditemukan.");
    const updated = await updateMediaMeta(shortId, body, expectedVersion);
    if (!updated) throw new NotFoundError("Media tidak ditemukan.");
    return updated;
  },
});

/**
 * DELETE /api/media/[shortId] — hapus aset + berkas fisiknya (G4.6 hygiene).
 *
 * **Menolak 409 bila aset masih dipakai soal.** FK `question_media` memakai
 * ON DELETE RESTRICT; tanpa pemeriksaan ini, penghapusan akan melempar galat DB
 * mentah (500) alih-alih pesan yang bisa ditindaklanjuti guru.
 */
export const DELETE = wrapRoute({
  authz: { kind: "route", permission: "media:manage" },
  rateLimit: true,
  params: paramsSchema,
  query: emptyQuerySchema,
  ifMatch: true,
  handler: async ({ params, expectedVersion }) => {
    const shortId = params.shortId ?? "";
    if (!isValidShortId(shortId)) throw new NotFoundError("Media tidak ditemukan.");

    const result = await deleteAsset(shortId, expectedVersion);
    if (!result) throw new NotFoundError("Media tidak ditemukan.");
    if ("inUse" in result) {
      throw new ConflictError(
        "Aset masih dipakai oleh soal. Lepas dari soal dulu sebelum menghapus.",
      );
    }
    return result;
  },
});
