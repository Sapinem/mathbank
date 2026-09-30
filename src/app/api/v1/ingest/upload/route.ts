import { wrapRoute } from "@/lib/api/route-wrapper";
import { ingestUploadSchema } from "@/lib/contracts/ingest";
import { enqueue } from "@/lib/ingest/queue";

/**
 * POST /api/v1/ingest/upload — wajah MESIN (M9-3).
 * Kirim satu artikel (HTML/JSON) → masuk antrean (`pending`).
 * Idempoten: artikel dengan isi sama tidak dibuat ulang.
 */
export const POST = wrapRoute({
  permission: "question:create", // peran `machine`: ingest → draft
  rateLimit: { capacity: 60, refillPerSec: 1 },
  body: ingestUploadSchema,
  status: 201,
  idempotent: true,
  handler: async ({ body }) => {
    const res = await enqueue({
      title: body.title,
      sourceOrigin: body.source,
      sourceUrl: body.url ?? null,
      rawContent: body.rawContent,
      rawFormat: body.format,
      slug: body.slug ?? null,
      targetGrade: body.targetGrade ?? null,
      targetTopicId: body.targetTopicId ?? null,
    });
    return res;
  },
});
