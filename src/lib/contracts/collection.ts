import { z } from "zod";

/**
 * Kontrak koleksi (ADR-0016) — arsip soal **publik**.
 *
 * Beda dari `bundles`: `collections` tak punya `status`, `durationMinutes`,
 * `instructions`, atau `createdById` — ia arsip statis, bukan naskah siap cetak.
 */

/** Field yang boleh diisi saat buat/ubah koleksi. */
const baseFields = {
  title: z.string().trim().min(1).max(255),
  sourceId: z.string().uuid().nullish(),
  eventId: z.string().uuid().nullish(),
  year: z.coerce.number().int().min(1900).max(2100).nullish(),
  grade: z.string().trim().max(20).nullish(),
  description: z.string().max(5000).nullish(),
};

export const createCollectionSchema = z.object(baseFields);

export const updateCollectionSchema = z.object({
  title: baseFields.title.optional(),
  sourceId: baseFields.sourceId,
  eventId: baseFields.eventId,
  year: baseFields.year,
  grade: baseFields.grade,
  description: baseFields.description,
});

/** POST /api/collections/[id]/items — masukkan soal (idempoten). */
export const addItemSchema = z.object({
  questionId: z.string().uuid(),
});

/** PUT /api/collections/[id]/items — susun ulang urutan (tampilan). */
export const reorderItemsSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(1000),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;
