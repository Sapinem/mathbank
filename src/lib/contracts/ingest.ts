import { z } from "zod";

/**
 * Kontrak endpoint ingest (M9-3) — wajah mesin `/api/ingest/*` (alias `/api/v1/ingest/*` deprecated, ADR-0028).
 * Dipakai route + (nanti) MCP.
 */

/** Status antrean yang boleh difilter. */
export const ingestStatusSchema = z.enum(["pending", "processing", "completed", "failed", "skipped"]);

/** POST /api/ingest/upload — kirim satu artikel ke antrean. */
export const ingestUploadSchema = z.object({
  title: z.string().trim().min(1).max(255),
  source: z.string().trim().min(1).max(50),
  url: z.string().url().max(2000).nullish(),
  /** Isi mentah (HTML atau JSON-string). */
  rawContent: z.string().min(1),
  /** Format isi mentah. */
  format: z.enum(["html", "json", "text"]).default("html"),
  targetGrade: z.string().trim().max(20).nullish(),
  targetTopicId: z.string().uuid().nullish(),
});

/** GET /api/ingest/queue — lihat antrean. */
export const ingestQueueQuerySchema = z.object({
  status: ingestStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** POST /api/ingest/commit — proses antrean pending → soal draft. */
export const ingestCommitSchema = z.object({
  /** Id spesifik; bila kosong → semua pending. */
  ids: z.array(z.string().uuid()).max(200).optional(),
  /** Grade default untuk soal yang tidak menyebut grade. */
  grade: z.string().trim().max(20).nullish(),
  /** Batas jumlah artikel diproses sekali panggil (jaga waktu respons). */
  limit: z.number().int().min(1).max(50).default(10),
  /** Jeda antar-unduhan gambar (ms). */
  mediaDelayMs: z.number().int().min(0).max(5000).default(0),
});

export type IngestUploadInput = z.infer<typeof ingestUploadSchema>;
export type IngestCommitInput = z.infer<typeof ingestCommitSchema>;
export type IngestQueueQuery = z.infer<typeof ingestQueueQuerySchema>;
