import { z } from "zod";
import {
  cognitiveLevelSchema,
  questionTypeSchema,
} from "@/lib/contracts/question";
import {
  answerKeySchema,
  questionDataPayloadSchema,
} from "@/lib/validations/question-payload";

/**
 * Kontrak Gateway Ingest Kanonik (M9 Refactor / Ingest Decoupling).
 *
 * Menerima array soal JSON yang sudah terstruktur kanonik, membebaskan
 * core MathBank dari parser/scraping HTML blog spesifik sumber.
 */

/** Satu butir soal kanonik siap validasi mutu dan simpan ke database. */
export const canonicalQuestionItemSchema = z.object({
  type: questionTypeSchema,
  stem: z.string().trim().min(1, "Stem tidak boleh kosong"),
  dataPayload: questionDataPayloadSchema,
  answerKey: answerKeySchema,
  difficulty: z.number().int().min(1).max(5).default(3).optional(),
  cognitiveLevel: cognitiveLevelSchema.optional(),
  explanation: z.string().optional(),
  warnings: z.array(z.string()).default([]).optional(),
  ref: z
    .object({
      index: z.number().int(),
      heading: z.string().optional(),
    })
    .optional(),
  parentRefIndex: z.number().int().optional(),
  childOrder: z.number().int().optional(),
});

export type CanonicalQuestionItem = z.infer<typeof canonicalQuestionItemSchema>;

/** Metadata sumber asal. */
export const canonicalSourceSchema = z.object({
  name: z.string().trim().min(1).max(50),
  url: z.string().url().max(2000).nullish(),
});

export type CanonicalSourceInput = z.infer<typeof canonicalSourceSchema>;

/** Metadata bundel soal (naskah / artikel kumpulan soal). */
export const canonicalBundleSchema = z.object({
  title: z.string().trim().min(1).max(255),
  url: z.string().url().max(2000).nullish(),
  grade: z.string().trim().max(20).nullish(),
  subject: z.string().trim().max(50).nullish(),
  eventId: z.string().uuid().nullish(),
});

export type CanonicalBundleInput = z.infer<typeof canonicalBundleSchema>;

/**
 * Payload batch ingest kanonik (POST /api/ingest/questions).
 * Batas batch: 1 s.d. 50 butir per permintaan untuk menjaga responsivitas server.
 */
export const canonicalIngestBatchSchema = z.object({
  source: canonicalSourceSchema,
  bundle: canonicalBundleSchema,
  items: z
    .array(canonicalQuestionItemSchema)
    .min(1, "Batch minimal berisi 1 soal")
    .max(50, "Batch maksimal 50 soal"),
});

export type CanonicalIngestBatchInput = z.infer<
  typeof canonicalIngestBatchSchema
>;

/** Rincian butir yang ditolak gerbang mutu. */
export const canonicalCommitFailureSchema = z.object({
  index: z.number().int(),
  stemPreview: z.string(),
  reason: z.string(),
});

export type CanonicalCommitFailure = z.infer<
  typeof canonicalCommitFailureSchema
>;

/** Laporan hasil proses batch ingest kanonik. */
export const canonicalIngestReportSchema = z.object({
  bundleId: z.string().uuid(),
  totalReceived: z.number().int().nonnegative(),
  created: z.number().int().nonnegative(),
  linked: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  failures: z.array(canonicalCommitFailureSchema),
  questionIds: z.array(z.string().uuid()),
});

export type CanonicalIngestReport = z.infer<typeof canonicalIngestReportSchema>;
