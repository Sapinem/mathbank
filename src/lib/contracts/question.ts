import { z } from "zod";
import { QUESTION_STATUSES } from "@/lib/fsm/question-fsm";
import {
  questionDataPayloadSchema,
  releasedQuestionGuardSchema,
} from "@/lib/validations/question-payload";

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
  /**
   * MAT-146 — kunci kanonik (menggantikan `correct`).
   * `string` untuk satu jawaban, `string[]` untuk banyak jawaban.
   */
  correctOptionIds: z
    .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
    .optional(),
  /** MAT-146 — pembahasan kanonik (menggantikan `explanation`). */
  explanationMarkdown: z.string().optional(),
  /** Pemetaan premis → respons (tipe `matching`). */
  matchingPairs: z.record(z.string(), z.string()).optional(),
  /** Pemetaan pernyataan → kolom (tipe `matrix`). */
  matrixAnswers: z.record(z.string(), z.string()).optional(),
  /** Jawaban yang diterima (tipe `short_answer`). */
  acceptedAnswers: z.array(z.string().min(1)).optional(),
  /** Rubrik penilaian teks (wajib untuk esai siap rilis). */
  scoringRubric: z.string().optional(),

  // ── Mirror legacy (deprecated, dipertahankan agar konsumen lama utuh) ──
  /** @deprecated MAT-146 — pakai `correctOptionIds`. */
  correct: z.array(z.string()).optional(),
  /** Jawaban teks (short_answer/essay). */
  text: z.string().optional(),
  /** @deprecated MAT-146 — pakai `explanationMarkdown`. */
  explanation: z.string().optional(),
  /** Rubrik penilaian (wajib untuk esai/isian — ditegakkan gate pedagogi). */
  rubric: rubricSchema.nullable().optional(),
});

// ── Gerbang Tulis Wajib (MAT-146) ────────────────────────────
//
// Setiap jalur tulis soal (`createQuestion`, `updateQuestion`, `enrichQuestion`)
// WAJIB melewati `enforceQuestionWriteGate()`. Tidak ada jalur tulis yang boleh
// menulis `data_payload` / `answer_key` tanpa Zod parse.
//
// Gerbang bertingkat (3 lapis), karena korpus lama & jalur ingest masih memakai
// bentuk pra-MAT-145:
//   1. **Envelope** (selalu)  — tipe & bentuk dasar `data_payload` / `answer_key`.
//   2. **Struktur kanonik** (bila `data_payload.type` ada) — `questionDataPayloadSchema`
//      dari `src/lib/validations/question-payload.ts` (MAT-145): min 2 opsi,
//      Haladyna Rule 5, premis/kolom tidak kosong, rubrik teks.
//   3. **Kontrak rilis** (bila status → `ready`) — `releasedQuestionGuardSchema`:
//      distractor rationale wajib untuk semua pengecoh, rubrik esai wajib,
//      matching/matrix harus lengkap.
//
// Normalisasi juga mengisi kolom kanonik (`answerKey.correctOptionIds`,
// `explanationMarkdown`) dari mirror legacy (`correct`, `explanation`) dan dari
// array `options` bentuk lama — sehingga `question_options` tak lagi dibutuhkan.

/** Label tipe payload kanonik (MAT-145) per `questionType` DB. */
export const PAYLOAD_TYPE_BY_QUESTION_TYPE = {
  stimulus: null,
  single_choice: "multiple_choice",
  assertion_reason: "multiple_choice",
  combination_1234: "multiple_choice",
  quantitative_pq: "multiple_choice",
  data_sufficiency: "multiple_choice",
  multiple_choice_checkbox: "complex_multiple_choice",
  matrix_grid: "matrix",
  matching: "matching",
  short_answer: "short_answer",
  essay: "essay",
} as const;

/** Tipe payload yang opsinya disimpan di `data_payload.options`. */
const OPTION_PAYLOAD_TYPES = new Set(["multiple_choice", "complex_multiple_choice"]);

/** Galat gerbang tulis soal — HTTP 422, kode `VALIDATION_ERROR`. */
export class QuestionPayloadValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 422;
  constructor(
    message: string,
    readonly issues: z.ZodIssue[] = [],
  ) {
    super(message);
    this.name = "QuestionPayloadValidationError";
  }
}

/** Bentuk minimal opsi yang diterima gerbang (bentuk relasional lama). */
export interface GateOptionInput {
  label: string;
  contentMarkdown: string;
  isCorrect?: boolean;
  distractorRationale?: string | null;
  orderIndex?: number;
}

export interface QuestionWriteGateInput {
  questionType: z.infer<typeof questionTypeSchema>;
  dataPayload?: Record<string, unknown> | null;
  answerKey?: Record<string, unknown> | null;
  /** Opsi bentuk lama (`question_options`); dinormalkan ke `data_payload.options`. */
  options?: GateOptionInput[] | null;
  /** Status tujuan — `ready` memicu kontrak pedagogis rilis. */
  status?: z.infer<typeof questionStatusSchema>;
}

export interface NormalizedQuestionWrite {
  dataPayload: Record<string, unknown>;
  answerKey: Record<string, unknown>;
}

/** Normalisasi `string | string[] | undefined` → `string[] | undefined`. */
function toLabelArray(value: unknown): string[] | undefined {
  if (typeof value === "string") return value.trim() ? [value.trim()] : undefined;
  if (Array.isArray(value)) {
    const arr = value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    return arr.length ? arr : undefined;
  }
  return undefined;
}

/**
 * Normalkan input tulis ke bentuk kanonik JSONB (tanpa validasi).
 *
 * - `options[]` (bentuk relasional) → `data_payload.options[{id,contentMarkdown,distractorRationale?}]`
 * - `answerKey.correct` ⇄ `answerKey.correctOptionIds`
 * - `answerKey.explanation` ⇄ `answerKey.explanationMarkdown`
 * - `answerKey.text` ⇄ `answerKey.acceptedAnswers`
 */
export function normalizeQuestionWritePayload(
  input: QuestionWriteGateInput,
): NormalizedQuestionWrite {
  const dataPayload: Record<string, unknown> = { ...(input.dataPayload ?? {}) };
  const answerKey: Record<string, unknown> = { ...(input.answerKey ?? {}) };

  // 1) Opsi bentuk lama → `data_payload.options` kanonik.
  const incoming = input.options ?? [];
  if (incoming.length) {
    const ordered = [...incoming].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
    );
    const canonicalOptions = ordered.map((o) => {
      const id = String(o.label ?? "").trim().toUpperCase();
      const item: Record<string, unknown> = {
        id,
        contentMarkdown: o.contentMarkdown,
      };
      const rationale = o.distractorRationale?.trim();
      if (rationale) item.distractorRationale = o.distractorRationale;
      return item;
    });
    dataPayload.options = canonicalOptions;

    const mapped = PAYLOAD_TYPE_BY_QUESTION_TYPE[input.questionType];
    dataPayload.type ??=
      mapped && OPTION_PAYLOAD_TYPES.has(mapped) ? mapped : "multiple_choice";
    if (dataPayload.shuffleOptions === undefined) dataPayload.shuffleOptions = true;

    // Kunci dari flag `isCorrect` opsi — sumber kebenaran bentuk lama.
    const correctFromFlags = ordered
      .filter((o) => o.isCorrect)
      .map((o) => String(o.label ?? "").trim().toUpperCase())
      .filter(Boolean);
    if (correctFromFlags.length && answerKey.correctOptionIds === undefined) {
      answerKey.correctOptionIds = correctFromFlags;
    }
  }

  // 2) Sinkronkan kunci jawaban kanonik ⇄ mirror legacy.
  if (answerKey.correctOptionIds === undefined) {
    const fromLegacy = toLabelArray(answerKey.correct);
    if (fromLegacy) answerKey.correctOptionIds = fromLegacy;
  }
  // `correct` legacy boleh berupa string tunggal ("A") — normalkan ke array.
  if (answerKey.correct !== undefined) {
    const legacy = toLabelArray(answerKey.correct);
    if (legacy) answerKey.correct = legacy;
    else delete answerKey.correct;
  }
  if (answerKey.correct === undefined) {
    const canonical = toLabelArray(answerKey.correctOptionIds);
    if (canonical) answerKey.correct = canonical;
  }
  if (
    answerKey.explanationMarkdown === undefined &&
    typeof answerKey.explanation === "string"
  ) {
    answerKey.explanationMarkdown = answerKey.explanation;
  }
  if (
    answerKey.explanation === undefined &&
    typeof answerKey.explanationMarkdown === "string"
  ) {
    answerKey.explanation = answerKey.explanationMarkdown;
  }
  if (answerKey.acceptedAnswers === undefined && typeof answerKey.text === "string") {
    const text = answerKey.text.trim();
    if (text) answerKey.acceptedAnswers = [text];
  }
  if (answerKey.text === undefined && Array.isArray(answerKey.acceptedAnswers)) {
    const first = answerKey.acceptedAnswers[0];
    if (typeof first === "string") answerKey.text = first;
  }

  return { dataPayload, answerKey };
}

/** Envelope minimum yang SELALU divalidasi (lapis 1). */
const writeEnvelopeSchema = z.object({
  dataPayload: z.record(z.string(), z.unknown()),
  answerKey: answerKeySchema.passthrough(),
});

/**
 * Gerbang tulis soal — normalkan lalu validasi. **Wajib** dipanggil semua
 * jalur tulis. Melempar `QuestionPayloadValidationError` (HTTP 422) bila
 * payload tidak sesuai kontrak.
 */
export function enforceQuestionWriteGate(
  input: QuestionWriteGateInput,
): NormalizedQuestionWrite {
  const normalized = normalizeQuestionWritePayload(input);
  const { dataPayload, answerKey } = normalized;

  // Lapis 1 — envelope.
  const envelope = writeEnvelopeSchema.safeParse({ dataPayload, answerKey });
  if (!envelope.success) {
    throw new QuestionPayloadValidationError(
      "Payload soal tidak valid: bentuk data_payload/answer_key salah.",
      envelope.error.issues,
    );
  }

  // Lapis 2 — struktur kanonik (hanya bila payload mendeklarasikan `type`).
  if (typeof dataPayload.type === "string") {
    const structured = questionDataPayloadSchema.safeParse(dataPayload);
    if (!structured.success) {
      throw new QuestionPayloadValidationError(
        `Struktur data_payload tidak valid untuk tipe "${dataPayload.type}": ` +
          structured.error.issues.map((i) => i.message).join("; "),
        structured.error.issues,
      );
    }
  }

  // Lapis 3 — kontrak pedagogis rilis.
  if (input.status === "ready") {
    const release = releasedQuestionGuardSchema.safeParse({
      dataPayload,
      answerKey,
    });
    if (!release.success) {
      throw new QuestionPayloadValidationError(
        "Soal belum memenuhi kontrak pedagogis untuk dirilis: " +
          release.error.issues.map((i) => i.message).join("; "),
        release.error.issues,
      );
    }
  }

  return normalized;
}

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
