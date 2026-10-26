import { POST as canonicalHandler } from "@/app/api/ingest/commit/route";
import { ingestV1Alias } from "@/lib/api/deprecation";

/**
 * POST /api/v1/ingest/commit — **ALIAS DEPRECATED** (ADR-0028).
 *
 * Jalur kanonik: /api/ingest/commit. Alias ini hanya meneruskan ke handler
 * kanonik dan menambahkan header Deprecation/Sunset (berakhir 2027-01-25).
 * Jangan tambahkan logika di sini.
 */
export const POST = ingestV1Alias(canonicalHandler);
