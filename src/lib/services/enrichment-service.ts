/**
 * Service Enrichment (M10-d) — **barrel** untuk kompatibilitas impor.
 *
 * Semula 416 baris; dipecah per-tanggung-jawab (SRP, CONSTRAINTS #16):
 *  - `enrichment/shared.ts`      → tipe (`EnrichOutcome`) + `slugify` (CORR-02).
 *  - `enrichment/taxonomy-tx.ts` → find-or-create topik/tag (CORR-03).
 *  - `enrichment/enrich.ts`      → enrich satu/banyak soal (AI + kontrak MAT-41).
 *  - `enrichment/embed.ts`       → embedding BGE-M3 + near-dedup.
 *
 * Impor lama (`@/lib/services/enrichment-service`) tetap bekerja — tak ada
 * perubahan di call-site.
 *
 * **Prinsip (terkunci):** AI hanya mengusulkan; `answer_key` tak disentuh;
 * semua panggilan lewat `ai/client.ts`; gagal AI → soal utuh.
 */

// Tipe publik (re-export).
export type { EnrichOutcome } from "./enrichment/shared";
export { slugify } from "./enrichment/shared";

// Operasi taksonomi dalam transaksi (dipakai internal & tes).
export { findOrCreateTopicTx, findOrCreateTagTx } from "./enrichment/taxonomy-tx";

// Enrichment.
export { enrichQuestion, enrichQuestions } from "./enrichment/enrich";

// Embedding.
export { embedQuestions } from "./enrichment/embed";
