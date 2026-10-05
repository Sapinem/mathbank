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

// ── Rubrik penilaian esai/isian (MAT-41) ─────────────────────
// Skema rubrik analitik bertingkat: kriteria langkah matematis + poin.
// Disimpan di dalam `answer_key.rubric` (tanpa kolom DB baru).

export const rubricCriterionSchema = z.object({
  /** Id stabil opsional (untuk referensi UI/audit). */
  id: z.string().max(50).optional(),
  /** Deskripsi langkah/kriteria yang dinilai (mis. "Menuliskan model persamaan"). */
  description: z.string().min(10).max(500),
  /** Poin kriteria (bilangan positif). */
  points: z.number().positive().max(100),
});

export const rubricSchema = z.object({
  /** Total poin (harus sama dengan jumlah poin kriteria). */
  totalPoints: z.number().positive().max(1000).optional(),
  criteria: z.array(rubricCriterionSchema).min(1).max(20),
});

export type Rubric = z.infer<typeof rubricSchema>;
export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

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
  /** Rubrik penilaian (wajib untuk esai/isian — ditegakkan gate pedagogi). */
  rubric: rubricSchema.nullable().optional(),
});

// ── Metadata pedagogi (MAT-41) ────────────────────────────────
// Taksonomi kognitif (Bloom C1–C6 / Webb's DOK) & status kepatuhan Haladyna.
// Bagian dari kontrak enrichment (bukan kolom DB) — dipakai gate mutu + audit.

export const dokLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const pedagogyMetaSchema = z.object({
  /** Webb's Depth of Knowledge (1–4). */
  dokLevel: dokLevelSchema.optional(),
  /** Bloom C1–C6 (turunan dari `cognitiveLevel`). */
  bloomLevel: z.enum(["C1", "C2", "C3", "C4", "C5", "C6"]).optional(),
  /** Seluruh kaidah Haladyna terpenuhi (hasil evaluator pedagogi). */
  haladynaCompliant: z.boolean().optional(),
  /** Cakupan rationale pengecoh: 0–1 (rasio opsi salah ber-rationale). */
  rationaleCoverage: z.number().min(0).max(1).optional(),
});

export type PedagogyMeta = z.infer<typeof pedagogyMetaSchema>;

export const dataPayloadSchema = z.record(z.string(), z.unknown()).default({});

// ── Opsi jawaban ──────────────────────────────────────────────
export const optionInputSchema = z.object({
  label: z.string().min(1).max(10),
  contentMarkdown: z.string().min(1),
  isCorrect: z.boolean().default(false),
  distractorRationale: z.string().nullable().optional(),
  orderIndex: z.number().int().min(0).default(0),
});

// ── Pembahasan (Multi-Solution) ──────────────────────────────
export const solutionTypeSchema = z.enum([
  "conceptual",
  "quick_tip",
  "video",
  "alternative",
]);

export const solutionInputSchema = z.object({
  id: z.string().uuid().optional(),
  solutionType: solutionTypeSchema.default("conceptual"),
  title: z.string().min(1).max(150).default("Pembahasan Utuh"),
  contentMarkdown: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export type SolutionInput = z.infer<typeof solutionInputSchema>;

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

  // ADR-0014: `sourceId` TIDAK lagi di kontrak soal — sumber via bundle.
  eventId: z.string().uuid().nullable().optional(),
  eventYear: z.number().int().nullable().optional(),
  eventSubtest: z.string().max(100).nullable().optional(),
  eventItemNumber: z.string().max(50).nullable().optional(),
  eventNotes: z.string().nullable().optional(),

  /**
   * Tandai perlu telaah saat pembuatan (dipakai jalur ingest).
   *
   * `docs/STRATEGI-INGEST.md` §3.2: kunci tak terdeteksi / opsi kurang →
   * `isFlagged` + catatan, **tetap draft**. Sebelumnya jalur ingest membuang
   * peringatan parser, jadi soal bermasalah masuk tanpa tanda apa pun.
   */
  isFlagged: z.boolean().optional(),
  flagNotes: z.string().max(2000).nullable().optional(),

  options: z.array(optionInputSchema).default([]),
  solutions: z.array(solutionInputSchema).optional().default([]),
  topicIds: z.array(z.string().uuid()).default([]),
  tagIds: z.array(z.string().uuid()).default([]),

  /**
   * Metadata pedagogi (MAT-41): DOK/Bloom/Haladyna + cakupan rationale.
   * Diturunkan oleh pipeline enrichment (bukan diisi manual); opsional &
   * tidak dipersistensi langsung (dipakai gate mutu + laporan).
   */
  pedagogyMeta: pedagogyMetaSchema.optional(),
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
  /**
   * ADR-0014: filter sumber **tetap ada** — maknanya berubah jadi "soal yang
   * ada di bundle bersumber X" (diterapkan sebagai EXISTS di `filters.ts`).
   * Yang dihapus adalah `questions.source_id` (kolomnya), bukan filternya.
   */
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
  notes: z.string().max(1000).nullable().optional(),
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
export type CreateQuestionInput = Omit<z.infer<typeof createQuestionSchema>, "solutions"> & {
  solutions?: z.infer<typeof solutionInputSchema>[];
};
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
export type OptionInput = z.infer<typeof optionInputSchema>;
export type AnswerKey = z.infer<typeof answerKeySchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
