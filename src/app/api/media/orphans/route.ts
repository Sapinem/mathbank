import { z } from "zod";
import { wrapRoute } from "@/lib/api/route-wrapper";
import { findOrphanAssets } from "@/lib/services/media-service";

const emptyQuerySchema = z.object({}).optional();

/**
 * GET /api/media/orphans — aset yang tak dipakai soal mana pun (G4.6 hygiene).
 *
 * **Hanya melaporkan**, tidak menghapus. Guru memutuskan sendiri mana yang dibuang;
 * penghapusan dilakukan lewat DELETE /api/media/{shortId} satu per satu.
 */
export const GET = wrapRoute({
  authz: { kind: "route", permission: "media:manage" },
  rateLimit: true,
  query: emptyQuerySchema,
  handler: async () => findOrphanAssets(),
});
