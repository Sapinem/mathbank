import { wrapRoute } from "@/lib/api/route-wrapper";
import { ingestCommitSchema } from "@/lib/contracts/ingest";
import { listPending } from "@/lib/ingest/queue";
import { commitIngestBatch } from "@/lib/ingest/commit-batch";
import { ConflictError } from "@/lib/auth/guards";

/**
 * POST /api/ingest/commit — wajah MESIN (M9-3).
 * Proses antrean `pending` → soal **draft** (segmentasi + media + commit).
 *
 * Batas `limit` menjaga waktu respons; panggil berulang untuk melanjutkan.
 *
 * Orkestrasi (loop artikel, agregat ringkasan, penandaan event) ada di
 * `commitIngestBatch` — route hanya memvalidasi body dan memeriksa status
 * antrean (ADR-0022). Sebelumnya route meng-`import()` db + event-resolve
 * sendiri, sehingga alur domain itu mustahil diuji tanpa HTTP.
 */
export const POST = wrapRoute({
  authz: { kind: "route", permission: "question:create" },
  // Berat (unduh gambar) — dibatasi agar server tak kelelahan, tapi cukup
  // longgar untuk ingest massal: burst 30, isi ulang 1 token/detik.
  // (Sebelumnya 10 / 0.2 → 1 commit tiap 5 dtk, terlalu lambat untuk korpus besar.)
  rateLimit: { capacity: 30, refillPerSec: 1 },
  body: ingestCommitSchema,
  idempotent: true,
  handler: async ({ body, actor }) => {
    const { items, nonPending, totalPending } = await listPending(
      body.ids,
      body.ids && body.ids.length ? undefined : body.limit,
    );
    if (body.ids && body.ids.length && nonPending.length) {
      throw new ConflictError(
        `Sebagian id bukan 'pending': ${nonPending.slice(0, 5).join(", ")}${nonPending.length > 5 ? "…" : ""}`,
      );
    }

    return commitIngestBatch(items, {
      actor,
      limit: body.limit,
      mediaDelayMs: body.mediaDelayMs,
      grade: body.grade ?? null,
      totalRemaining: totalPending,
    });
  },
});
