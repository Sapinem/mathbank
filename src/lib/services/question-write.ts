import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, questionOptions } from "@/lib/db/schema/question";
import { solutions } from "@/lib/db/schema/solution";
import { questionTopics, questionTags } from "@/lib/db/schema/taxonomy";
import { isQuestionUsedInBundles } from "./bundle-service";
import { contentHash } from "@/lib/ingest/hash";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { recordAudit } from "./audit";
import { getQuestion, getQuestionInternal, type PublicQuestion } from "./question-read";
import type {
  CreateQuestionInput,
  UpdateQuestionInput,
} from "@/lib/contracts/question";

/**
 * Tulis soal (M14 — pecahan `question-service.ts`).
 *
 * Operasi mutasi yang tidak mengubah status lewat FSM: buat, perbarui, tandai,
 * hapus lunak, hapus permanen. Transisi status ada di `question-status.ts`.
 */

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
        // Hash konten (ADR-0012) — dedup lintas-sumber.
        contentHash: contentHash(
          input.contentMarkdown,
          input.options.map((o) => o.contentMarkdown),
        ),
        dataPayload: input.dataPayload,
        answerKey: input.answerKey,
        status: input.status,
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
    if (input.solutions?.length) {
      await tx.insert(solutions).values(
        input.solutions.map((s, idx) => ({
          questionId: row.id,
          solutionType: s.solutionType,
          title: s.title || `Pembahasan ${idx + 1}`,
          contentMarkdown: s.contentMarkdown,
          isPrimary: s.isPrimary ?? (idx === 0),
          authorType: "teacher" as const,
          authorId: actor.id,
        })),
      );
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

  const { options, solutions: solutionInputs, topicIds, tagIds, parentId, ...fields } = input;

  await db.transaction(async (tx) => {
    const patch: Partial<typeof questions.$inferInsert> = {};
    if (fields.questionType !== undefined) patch.questionType = fields.questionType;
    if (fields.difficulty !== undefined) patch.difficulty = fields.difficulty;
    if (fields.cognitiveLevel !== undefined) patch.cognitiveLevel = fields.cognitiveLevel;
    if (fields.grade !== undefined) patch.grade = fields.grade;
    if (fields.contentMarkdown !== undefined) patch.contentMarkdown = fields.contentMarkdown;
    if (fields.dataPayload !== undefined) patch.dataPayload = fields.dataPayload;
    if (fields.answerKey !== undefined) patch.answerKey = fields.answerKey;
    if (fields.eventId !== undefined) patch.eventId = fields.eventId;
    if (fields.eventYear !== undefined) patch.eventYear = fields.eventYear;
    if (fields.eventSubtest !== undefined) patch.eventSubtest = fields.eventSubtest;
    if (fields.eventItemNumber !== undefined) patch.eventItemNumber = fields.eventItemNumber;
    if (fields.eventNotes !== undefined) patch.eventNotes = fields.eventNotes;
    if (parentId !== undefined) patch.parentId = parentId;
    if (fields.childOrder !== undefined) patch.childOrder = fields.childOrder;

    if (solutionInputs !== undefined) {
      await tx.delete(solutions).where(eq(solutions.questionId, id));
      if (solutionInputs.length) {
        await tx.insert(solutions).values(
          solutionInputs.map((s, idx) => ({
            questionId: id,
            solutionType: s.solutionType,
            title: s.title || `Pembahasan ${idx + 1}`,
            contentMarkdown: s.contentMarkdown,
            isPrimary: s.isPrimary ?? (idx === 0),
            authorType: "teacher" as const,
            authorId: actor.id,
          })),
        );
      }
      const prim = solutionInputs.find((s) => s.isPrimary) ?? solutionInputs[0];
      if (prim?.contentMarkdown) {
        patch.answerKey = {
          ...(existing.answerKey ?? {}),
          ...(patch.answerKey ?? {}),
          explanation: prim.contentMarkdown,
        };
      }
    }

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

  // RESTRICT: soal yang dipakai paket AKTIF (M7) tak boleh dihapus.
  // T-M7-3: paket TERARSIP tidak memblokir — jika tidak, soal mustahil dihapus
  // setelah paket yang memakainya diarsipkan (dead-end).
  if (await isQuestionUsedInBundles(id)) {
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

/**
 * Hapus PERMANEN (hard delete) — buang baris dari DB.
 *
 * **T-M4-4:** izin `question:hardDelete` (matriks: admin `yes`, guru/penelaah `own`)
 * kini benar-benar dipakai. Aturan:
 * - **Hanya** soal yang sudah **soft-deleted** (`deletedAt` terisi) boleh dihapus
 *   permanen — cegah penghapusan tak sengaja atas soal aktif.
 * - RESTRICT: soal yang dipakai paket tetap dilarang (FK `restrict` juga menjaga).
 * - Anak (opsi/solusi/topik/label/media) di-CASCADE otomatis oleh DB.
 */
export async function hardDeleteQuestion(id: string, actor: Actor): Promise<void> {
  // includeDeleted: soal yang ingin dihapus permanen PASTI ber-deletedAt (sudah soft-delete).
  const existing = await getQuestionInternal(id, { includeDeleted: true });
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  assertCan(actor, "question:hardDelete", { ownerId: existing.authorId });

  if (!existing.deletedAt) {
    throw new ConflictError(
      "Hapus permanen hanya untuk soal yang sudah dihapus (soft-delete).",
    );
  }

  // T-M7-3: hanya paket AKTIF yang memblokir hapus permanen.
  if (await isQuestionUsedInBundles(id)) {
    throw new ConflictError(
      "Soal ini dipakai di paket soal — keluarkan dari paket dulu.",
    );
  }

  await db.delete(questions).where(eq(questions.id, id));

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Soal dihapus PERMANEN",
  });
}
