import { z } from "zod";

/**
 * Kontrak paket soal (MAT-39) — gabungan wadah naskah (bundles).
 *
 * `bundle_type` ('source' | 'exam') membedakan arsip/bahan vs naskah ujian.
 * `origin` ('ingest' | 'manual') membedakan jalur pembuatan.
 */

/** Skema validasi konfigurasi cetak naskah soal (Pilar 4 · Publishing Engine V2). */
export const bundlePrintConfigSchema = z.object({
  institutionName: z.string().max(255).optional(),
  tagline: z.string().max(500).optional(),
  instructions: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  twoColumnLayout: z.boolean().optional(),
  includeAnswerKey: z.boolean().optional(),
  showQuestionNumber: z.boolean().optional(),
  pageSize: z.enum(["A4", "Letter"]).optional(),
});

/** Field yang boleh diisi saat buat paket. */
const baseFields = {
  title: z.string().trim().min(1).max(255),
  bundleType: z.enum(["source", "exam"]),
  origin: z.enum(["ingest", "manual"]).default("manual"),
  sourceId: z.string().uuid().nullish(),
  eventId: z.string().uuid().nullish(),
  year: z.coerce.number().int().min(1900).max(2100).nullish(),
  grade: z.string().trim().max(20).nullish(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  instructions: z.string().max(5000).nullish(),
  printConfig: bundlePrintConfigSchema.optional(),
};

export const createBundleSchema = z.object(baseFields);

export const updateBundleSchema = z.object({
  title: baseFields.title.optional(),
  bundleType: baseFields.bundleType.optional(),
  origin: z.enum(["ingest", "manual"]).optional(),
  sourceId: baseFields.sourceId,
  eventId: baseFields.eventId,
  year: baseFields.year,
  grade: baseFields.grade,
  durationMinutes: baseFields.durationMinutes,
  instructions: baseFields.instructions,
  printConfig: bundlePrintConfigSchema.optional(),
  status: z.enum(["draft", "review", "ready", "archived"]).optional(),
});

/** Filter untuk GET /api/bundles. */
export const listBundlesQuerySchema = z.object({
  bundleType: z.enum(["source", "exam"]).optional(),
  origin: z.enum(["ingest", "manual"]).optional(),
  /** API-05: paginasi — `limit` default 20 (max 100), `offset` default 0. */
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateBundleContract = z.infer<typeof createBundleSchema>;
export type UpdateBundleContract = z.infer<typeof updateBundleSchema>;
export type ListBundlesQuery = z.infer<typeof listBundlesQuerySchema>;
