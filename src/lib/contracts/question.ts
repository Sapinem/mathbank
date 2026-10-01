import { z } from "zod";
import { QUESTION_STATUSES } from "@/lib/fsm/question-fsm";

/**
 * Kontrak data soal (L9 API + L7 skema) — SATU sumber kebenaran validasi.
 * Dipakai service, API route, dan MCP.
 */

// ── Enum ──────────────────────────────────────────────────────
export const questionTypeSchema = z.enum([
  "stimulus",
  "single_choice",
  "assertion_reason",
  "combination_1234",
  "quantitative_pq",
  "data_sufficiency",
  "multiple_choice_checkbox",
  "matrix_grid",
  "matching",
  "short_answer",
  "essay",
]);

export const questionStatusSchema = z.enum(QUESTION_STATUSES);

export const cognitiveLevelSchema = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);

/** Tipe soal yang memakai opsi jawaban (A–E). */
export const OPTION_BASED_TYPES = [
  "single_choice",
  "assertion_reason",
  "combination_1234",
  "quantitative_pq",
  "data_sufficiency",
  "multiple_choice_checkbox",
  "matrix_grid",
  "matching",
] as const;

export function isOptionBased(type: z.infer<typeof questionTypeSchema>): boolean {
  return (OPTION_BASED_TYPES as readonly string[]).includes(type);
}

// ── answer_key per tipe (L7) ──────────────────────────────────
// Sebagian besar tipe = pilihan ganda biasa (content_markdown + options).
// `data_payload` hanya untuk matrix_grid & matching (UI interaktif).

export const answerKeySchema = z.object({
  /** Label opsi benar, mis. ["A"] atau ["A","C"] (checkbox). */
  correct: z.array(z.string()).optional(),
  /** Jawaban teks (short_answer/essay). */
  text: z.string().optional(),
  /** Pembahasan singkat jawaban. */
  explanation: z.string().optional(),
});

export const dataPayloadSchema = z.record(z.string(), z.unknown()).default({});

// ── Opsi jawaban ──────────────────────────────────────────────
export const optionInputSchema = z.object({
  label: z.string().min(1).max(10),
  contentMarkdown: z.string().min(1),
  isCorrect: z.boolean().default(false),
  distractorRationale: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0).default(0),
});

// ── Buat soal ─────────────────────────────────────────────────
export const createQuestionSchema = z.object({
  questionType: questionTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  cognitiveLevel: cognitiveLevelSchema,
  grade: z.string().min(1).max(20),
  contentMarkdown: z.string().min(1),
  dataPayload: dataPayloadSchema,
  answerKey: answerKeySchema.default({}),
  status: questionStatusSchema.default("draft"),
  parentId: z.string().uuid().nullable().optional(),
  childOrder: z.number().int().min(0).default(0),

  sourceId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  eventYear: z.number().int().nullable().optional(),
  eventSubtest: z.string().max(100).nullable().optional(),
  eventItemNumber: z.string().max(50).nullable().optional(),
  eventNotes: z.string().nullable().optional(),

  options: z.array(optionInputSchema).default([]),
  topicIds: z.array(z.string().uuid()).default([]),
  tagIds: z.array(z.string().uuid()).default([]),
});

// ── Perbarui soal ─────────────────────────────────────────────
export const updateQuestionSchema = createQuestionSchema.partial();

// ── Filter daftar ─────────────────────────────────────────────

/**
 * Menerima nilai tunggal ATAU daftar (multi-select) → selalu array.
 * Mendukung `?difficulty=3` maupun `?difficulty=2&difficulty=3` (atau CSV).
 */
function asArray<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      if (Array.isArray(v)) {
        const arr = v.filter((x) => x !== "");
        return arr.length ? arr : undefined;
      }
      if (typeof v === "string" && v.includes(",")) {
        const arr = v.split(",").filter(Boolean);
        return arr.length ? arr : undefined;
      }
      return [v];
    },
    z.array(item).optional(),
  );
}

export const listQuestionsQuerySchema = z.object({
  q: z.string().optional(),
  status: questionStatusSchema.optional(),
  questionType: asArray(questionTypeSchema),
  grade: asArray(z.string()),
  difficulty: asArray(z.coerce.number().int().min(1).max(5)),
  cognitiveLevel: cognitiveLevelSchema.optional(),
  topicId: asArray(z.string().uuid()),
  tagId: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  flagged: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  /** Mode pencarian: `text` (trigram, default) atau `semantic` (embedding HNSW). */
  mode: z.enum(["text", "semantic"]).default("text"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── Transisi status ───────────────────────────────────────────
export const changeStatusSchema = z.object({
  status: questionStatusSchema,
});

// ── Aksi massal (G3.1) ────────────────────────────────────────
export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum([
    "set_ready",
    "archive",
    "reject_to_draft",
    "flag",
    "unflag",
  ]),
  notes: z.string().max(1000).nullable().optional(),
});

// ── Tipe terinferensi ─────────────────────────────────────────
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
export type OptionInput = z.infer<typeof optionInputSchema>;
export type AnswerKey = z.infer<typeof answerKeySchema>;
