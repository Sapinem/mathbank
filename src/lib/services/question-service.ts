import { and, eq, isNull, sql, desc, asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  questions,
  questionOptions,
  type Question,
  type QuestionOption,
} from "@/lib/db/schema/question";
import { questionTopics, questionTags } from "@/lib/db/schema/taxonomy";
import { bundleItems } from "@/lib/db/schema/bundle";
import { buildQuestionFilter } from "@/lib/question/filters";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { transition, assertReady, type QuestionStatus } from "@/lib/fsm/question-fsm";
import { recordAudit } from "./audit";
import {
  questionColumns,
  optionColumns,
  canSeeAnswerKey,
} from "@/lib/db/projections/question";
import type {
  CreateQuestionInput,
  UpdateQuestionInput,
  ListQuestionsQuery,
  AnswerKey,
} from "@/lib/contracts/question";

/**
 * Bentuk soal untuk RESPONS API.
 *
 * `answerKey` hanya ada bila viewer berwenang (lihat `canSeeAnswerKey`);
 * field internal (`embedding*`, `aiTagged*`) **selalu** dibuang (S3).
 */
export type PublicQuestion = Omit<
  Question,
  | "embedding"
  | "embeddingContentHash"
  | "embeddingModelName"
  | "aiTagged"
  | "aiTaggedAt"
  | "answerKey"
> & { options: QuestionOption[]; answerKey?: AnswerKey };

/** Soal internal (untuk logika service: FSM, izin) — punya `answerKey`. */
export interface QuestionInternal extends Question {
  options: QuestionOption[];
}

// ── Baca ──────────────────────────────────────────────────────

/**
 * Ambil satu soal + opsi untuk RESPONS API (proyeksi aman, S3).
 * `answerKey` hanya disertakan bila `viewer` berwenang.
 */
export async function getQuestion(
  id: string,
  opts: { includeDeleted?: boolean; viewer?: Actor } = {},
): Promise<PublicQuestion | null> {
  const withAnswerKey = opts.viewer ? canSeeAnswerKey(opts.viewer) : false;

  const [row] = await db
    .select(questionColumns({ withAnswerKey }))
    .from(questions)
    .where(
      opts.includeDeleted
        ? eq(questions.id, id)
        : and(eq(questions.id, id), isNull(questions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;

  const options = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.orderIndex));

  return { ...row, options } as PublicQuestion;
}

/**
 * Baca soal LENGKAP (internal) — untuk logika service yang butuh `answerKey`
 * (mis. `assertReady`) & field internal. **JANGAN** kirim hasil ini ke klien.
 */
export async function getQuestionInternal(
  id: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<QuestionInternal | null> {
  const [row] = await db
    .select()
    .from(questions)
    .where(
      opts.includeDeleted
        ? eq(questions.id, id)
        : and(eq(questions.id, id), isNull(questions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;

  const options = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.orderIndex));

  return { ...row, options };
}

/** Daftar soal dengan filter & paginasi (proyeksi aman, S3). */
export async function listQuestions(
  query: ListQuestionsQuery,
  viewer?: Actor,
): Promise<{ items: PublicQuestion[]; total: number }> {
  const { where: finalWhere, byRelevance } = await buildQuestionFilter(query);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
    .where(finalWhere);

  // Urutkan: relevansi trigram bila ada pencarian, selain itu terbaru dulu.
  const orderBy = byRelevance && query.q
    ? [desc(sql`similarity(${questions.contentMarkdown}, ${query.q.trim()})`), desc(questions.createdAt)]
    : [desc(questions.createdAt)];

  const rows = await db
    .select(questionColumns({ withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false }))
    .from(questions)
    .where(finalWhere)
    .orderBy(...orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const items = await attachOptions(rows, viewer ? canSeeAnswerKey(viewer) : false);
  return { items, total: count };
}

/** Lampirkan opsi ke banyak soal (hindari N+1). Proyeksi aman (S3). */
async function attachOptions(
  rows: Omit<PublicQuestion, "options">[],
  withAnswerKey: boolean,
): Promise<PublicQuestion[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const opts = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, ids))
    .orderBy(asc(questionOptions.orderIndex));
  const byQuestion = new Map<string, QuestionOption[]>();
  for (const o of opts) {
    const arr = byQuestion.get(o.questionId) ?? [];
    arr.push(o as QuestionOption);
    byQuestion.set(o.questionId, arr);
  }
  return rows.map((r) => ({ ...r, options: byQuestion.get(r.id) ?? [] }));
}

// ── Tulis ─────────────────────────────────────────────────────

/** Buat soal (+ opsi + topik + label) dalam satu transaksi. */
export async function createQuestion(
  input: CreateQuestionInput,
  actor: Actor,
): Promise<PublicQuestion> {
  assertCan(actor, "question:create");

  // Stimulus tidak boleh punya parent (parent hanya untuk anak stimulus)
  if (input.questionType === "stimulus" && input.parentId) {
    throw new ConflictError("Soal bertipe stimulus tidak boleh punya parentId.");
  }
  // Anak stimulus wajib punya parent yang benar
  if (input.parentId) {
    const parent = await getQuestionInternal(input.parentId);
    if (!parent) throw new NotFoundError("Stimulus induk tidak ditemukan.");
    if (parent.questionType !== "stimulus") {
      throw new ConflictError("parentId harus menunjuk ke soal bertipe stimulus.");
    }
  }

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(questions)
      .values({
        parentId: input.parentId ?? null,
        childOrder: input.childOrder,
        questionType: input.questionType,
        difficulty: input.difficulty,
        cognitiveLevel: input.cognitiveLevel,
        grade: input.grade,
        contentMarkdown: input.contentMarkdown,
        dataPayload: input.dataPayload,
        answerKey: input.answerKey,
        status: input.status,
        sourceId: input.sourceId ?? null,
        eventId: input.eventId ?? null,
        eventYear: input.eventYear ?? null,
        eventSubtest: input.eventSubtest ?? null,
        eventItemNumber: input.eventItemNumber ?? null,
        eventNotes: input.eventNotes ?? null,
        authorId: actor.id,
      })
      .returning({ id: questions.id });

    if (input.options.length) {
      await tx.insert(questionOptions).values(
        input.options.map((o) => ({
          questionId: row.id,
          label: o.label,
          contentMarkdown: o.contentMarkdown,
          isCorrect: o.isCorrect,
          distractorRationale: o.distractorRationale ?? null,
          orderIndex: o.orderIndex,
        })),
      );
    }
    if (input.topicIds.length) {
      await tx
        .insert(questionTopics)
        .values(input.topicIds.map((topicId) => ({ questionId: row.id, topicId })));
    }
    if (input.tagIds.length) {
      await tx
        .insert(questionTags)
        .values(input.tagIds.map((tagId) => ({ questionId: row.id, tagId })));
    }
    return row.id;
  });

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "create",
    actor,
    changeSummary: `Soal ${input.questionType} dibuat`,
  });

  const created = await getQuestion(id, { viewer: actor });
  if (!created) throw new NotFoundError();
  return created;
}

/** Perbarui soal (field parsial; ganti opsi/topik/label bila dikirim). */
export async function updateQuestion(
  id: string,
  input: UpdateQuestionInput,
  actor: Actor,
): Promise<PublicQuestion> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  // Izin: reviewer/admin boleh semua; teacher hanya miliknya sendiri
  assertCan(actor, "question:edit", { ownerId: existing.authorId });

  const { options, topicIds, tagIds, parentId, ...fields } = input;

  await db.transaction(async (tx) => {
    const patch: Partial<typeof questions.$inferInsert> = {};
    if (fields.questionType !== undefined) patch.questionType = fields.questionType;
    if (fields.difficulty !== undefined) patch.difficulty = fields.difficulty;
    if (fields.cognitiveLevel !== undefined) patch.cognitiveLevel = fields.cognitiveLevel;
    if (fields.grade !== undefined) patch.grade = fields.grade;
    if (fields.contentMarkdown !== undefined) patch.contentMarkdown = fields.contentMarkdown;
    if (fields.dataPayload !== undefined) patch.dataPayload = fields.dataPayload;
    if (fields.answerKey !== undefined) patch.answerKey = fields.answerKey;
    if (fields.sourceId !== undefined) patch.sourceId = fields.sourceId;
    if (fields.eventId !== undefined) patch.eventId = fields.eventId;
    if (fields.eventYear !== undefined) patch.eventYear = fields.eventYear;
    if (fields.eventSubtest !== undefined) patch.eventSubtest = fields.eventSubtest;
    if (fields.eventItemNumber !== undefined) patch.eventItemNumber = fields.eventItemNumber;
    if (fields.eventNotes !== undefined) patch.eventNotes = fields.eventNotes;
    if (parentId !== undefined) patch.parentId = parentId;
    if (fields.childOrder !== undefined) patch.childOrder = fields.childOrder;

    if (Object.keys(patch).length) {
      await tx.update(questions).set(patch).where(eq(questions.id, id));
    }
    if (options) {
      await tx.delete(questionOptions).where(eq(questionOptions.questionId, id));
      if (options.length) {
        await tx.insert(questionOptions).values(
          options.map((o) => ({
            questionId: id,
            label: o.label,
            contentMarkdown: o.contentMarkdown,
            isCorrect: o.isCorrect,
            distractorRationale: o.distractorRationale ?? null,
            orderIndex: o.orderIndex,
          })),
        );
      }
    }
    if (topicIds) {
      await tx.delete(questionTopics).where(eq(questionTopics.questionId, id));
      if (topicIds.length) {
        await tx.insert(questionTopics).values(topicIds.map((topicId) => ({ questionId: id, topicId })));
      }
    }
    if (tagIds) {
      await tx.delete(questionTags).where(eq(questionTags.questionId, id));
      if (tagIds.length) {
        await tx.insert(questionTags).values(tagIds.map((tagId) => ({ questionId: id, tagId })));
      }
    }
  });

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "update",
    actor,
    changeSummary: "Soal diperbarui",
  });

  const updated = await getQuestion(id, { viewer: actor });
  if (!updated) throw new NotFoundError();
  return updated;
}

/** Ubah status lewat FSM (L6) + izin status (L1). */
export async function changeQuestionStatus(
  id: string,
  to: QuestionStatus,
  actor: Actor,
): Promise<PublicQuestion> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  const from = existing.status as QuestionStatus;
  // Transisi tak berubah → tak perlu tulis/audit.
  if (from === to) return existing;

  // Validasi transisi (FSM) SEBELUM izin → error transisi lebih jelas
  transition(from, to);

  // Izin per tujuan transisi (L1)
  if (to === "ready") {
    assertCan(actor, "question:setReady");
    // Batasan: soal boleh ada tanpa answer_key, TAPI tak boleh jadi `ready`
    // sebelum jawabannya diisi (kecuali stimulus). Lihat question-fsm.ts.
    assertReady({
      questionType: existing.questionType,
      answerKey: existing.answerKey,
    });
  } else if (to === "archived") {
    assertCan(actor, "question:archive");
  } else {
    assertCan(actor, "question:edit", { ownerId: existing.authorId });
  }

  await db
    .update(questions)
    .set({
      status: to,
      lastReviewedAt: to === "ready" ? new Date() : existing.lastReviewedAt,
    })
    .where(eq(questions.id, id));

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "status_change",
    actor,
    changeSummary: `Status ${from} → ${to}`,
  });

  const updated = await getQuestion(id, { viewer: actor });
  if (!updated) throw new NotFoundError();
  return updated;
}

/** Tandai/lepas tanda masalah kualitas. */
export async function setQuestionFlag(
  id: string,
  flagged: boolean,
  notes: string | null,
  actor: Actor,
): Promise<PublicQuestion> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");
  assertCan(actor, "question:flag");

  await db
    .update(questions)
    .set({ isFlagged: flagged, flagNotes: flagged ? notes : null })
    .where(eq(questions.id, id));

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "update",
    actor,
    changeSummary: flagged ? "Soal ditandai" : "Tanda dilepas",
  });

  const updated = await getQuestion(id, { viewer: actor });
  if (!updated) throw new NotFoundError();
  return updated;
}

/** Hapus lunak (soft delete). */
export async function deleteQuestion(id: string, actor: Actor): Promise<void> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  assertCan(actor, "question:delete", { ownerId: existing.authorId });

  // RESTRICT: soal yang dipakai paket (M7) tak boleh dihapus.
  const [dipakai] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(eq(bundleItems.questionId, id))
    .limit(1);
  if (dipakai) {
    throw new ConflictError(
      "Soal ini dipakai di paket soal — keluarkan dari paket dulu.",
    );
  }

  await db
    .update(questions)
    .set({ deletedAt: new Date() })
    .where(eq(questions.id, id));

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Soal dihapus (lunak)",
  });
}
