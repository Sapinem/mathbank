import { GET as canonicalHandler } from "@/app/api/ingest/queue/route";
import { ingestV1Alias } from "@/lib/api/deprecation";

/**
 * GET /api/v1/ingest/queue — **ALIAS DEPRECATED** (ADR-0028).
 *
 * Jalur kanonik: /api/ingest/queue. Alias ini hanya meneruskan ke handler
 * kanonik dan menambahkan header Deprecation/Sunset (berakhir 2027-01-25).
 * Jangan tambahkan logika di sini.
 */
export const GET = ingestV1Alias(canonicalHandler);
