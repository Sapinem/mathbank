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
  explanationPlacement: z.enum(["none", "inline", "end"]).optional(),
  answerSpaceCm: z.number().min(0).max(20).optional(),
  backgroundGrid: z.boolean().optional(),
  backgroundWatermark: z.boolean().optional(),
  columnBreaks: z.array(z.string()).optional(),
  institutionLogoUrl: z.string().regex(/^(?:https?:\/\/|\/(?!\/))[^\s]*$/).or(z.literal("")).optional(),
  brandColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, {
    message: "Warna harus berupa kode heksadesimal valid (misal: #0158ca)",
  }).optional(),
  themeId: z.string().trim().min(1).max(64).optional(),
  themeOptions: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
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
  durationMinutes: z.number().int().min(1).max(600).nullish(),
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
  status: z.enum(["active", "draft", "review", "ready", "archived"]).optional(),
  q: z.string().trim().max(120).optional(),
  /** API-05: paginasi — `limit` default 20 (max 100), `offset` default 0. */
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateBundleContract = z.infer<typeof createBundleSchema>;
export type UpdateBundleContract = z.infer<typeof updateBundleSchema>;
export type ListBundlesQuery = z.infer<typeof listBundlesQuerySchema>;

/** Skema pembaruan metadata slot item dalam paket. */
export const updateBundleItemSlotSchema = z
  .object({
    role: z.enum(["question", "stimulus"]).optional(),
    itemNumber: z.string().trim().max(50).nullable().optional(),
    sectionName: z.string().trim().max(100).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Setidaknya satu field harus diisi untuk memperbarui slot item.",
  });

export type UpdateBundleItemSlotContract = z.infer<typeof updateBundleItemSlotSchema>;

