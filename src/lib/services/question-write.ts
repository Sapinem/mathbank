import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { solutions } from "@/lib/db/schema/solution";
import { bundleItems } from "@/lib/db/schema/bundle";
import { questionTopics, questionTags } from "@/lib/db/schema/taxonomy";
import { isQuestionUsedInBundles } from "./bundle-service";
import { contentHash } from "@/lib/ingest/hash";
import { findQuestionByContentHash } from "@/lib/ingest/dedup";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { isUniqueViolation } from "@/lib/db/errors";
import type { Actor } from "@/lib/auth/actor";
import { recordAudit } from "./audit";
import { getQuestion, getQuestionInternal, type PublicQuestion } from "./question-read";
import { syncQuestionShortcodeMediaTx } from "./media/shortcode-link";
import { enforceQuestionWriteGate } from "@/lib/contracts/question";
import type {
  CreateQuestionInput,
  UpdateQuestionInput,
} from "@/lib/contracts/question";

/**
 * Tulis soal (M14 — pecahan `question-service.ts`).
 *
 * Operasi mutasi yang tidak mengubah status lewat FSM: buat, perbarui, tandai,
 * hapus lunak, hapus permanen. Transisi status ada di `question-status.ts`.
 *
 * **MAT-146** — `question_options` dihapus. Semua jalur tulis di modul ini
 * melewati `enforceQuestionWriteGate()` (Zod, 3 lapis) lalu menyimpan opsi ke
 * `data_payload.options` + kunci ke `answer_key.correctOptionIds`. Tidak ada
 * lagi INSERT/DELETE ke tabel opsi.
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

  // Pembahasan utama (multi-solution) → `answer_key.explanationMarkdown`.
  let baseKey = (input.answerKey ?? {}) as Record<string, unknown>;
  const primarySolution =
    input.solutions?.find((s) => s.isPrimary) ?? input.solutions?.[0];
  if (primarySolution?.contentMarkdown && !baseKey.explanationMarkdown) {
    baseKey = { ...baseKey, explanationMarkdown: primarySolution.contentMarkdown };
  }

  // ⛔ GERBANG TULIS WAJIB (MAT-146). Melempar 422 bila payload melanggar kontrak.
  const gated = enforceQuestionWriteGate({
    questionType: input.questionType,
    dataPayload: input.dataPayload,
    answerKey: baseKey,
    options: input.options,
    status: input.status,
  });
  // Opsi kanonik (dari data_payload) — dipakai untuk hash konten anti-duplikat.
  const gatedOptions = Array.isArray(gated.dataPayload.options)
    ? (gated.dataPayload.options as { contentMarkdown?: unknown }[])
    : [];

  const calculatedHash = contentHash(
    input.contentMarkdown,
    gatedOptions.map((o) => String(o.contentMarkdown ?? "")),
  );

  const existingDup = await findQuestionByContentHash(calculatedHash);
  if (existingDup) {
    throw new ConflictError("Soal dengan naskah dan opsi yang sama persis sudah terdaftar.");
  }

  let id: string;
  try {
    id = await db.transaction(async (tx) => {
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
          contentHash: calculatedHash,
          dataPayload: gated.dataPayload,
          answerKey: gated.answerKey,
          status: input.status,
          eventId: input.eventId ?? null,
          eventYear: input.eventYear ?? null,
          eventSubtest: input.eventSubtest ?? null,
          eventItemNumber: input.eventItemNumber ?? null,
          eventNotes: input.eventNotes ?? null,
          // Tanda perlu telaah (jalur ingest membawa peringatan parser ke sini).
          isFlagged: input.isFlagged ?? false,
          flagNotes: input.flagNotes ?? null,
          authorId: actor.id,
        })
        .returning({ id: questions.id });

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

      // Sinkronkan media shortcode {{img:shortId}} ke tabel question_media
      await syncQuestionShortcodeMediaTx(tx, row.id);

      return row.id;
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new ConflictError("Soal dengan naskah dan opsi yang sama persis sudah terdaftar.");
    }
    throw err;
  }

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

  // ⛔ GERBANG TULIS WAJIB (MAT-146). Dijalankan SEBELUM transaksi, dengan
  // payload hasil merge (partial update tidak boleh menghapus opsi yang ada).
  const touchesPayload =
    options !== undefined ||
    solutionInputs !== undefined ||
    fields.dataPayload !== undefined ||
    fields.answerKey !== undefined;

  let gated: { dataPayload: Record<string, unknown>; answerKey: Record<string, unknown> } | undefined;
  if (touchesPayload) {
    const basePayload = (fields.dataPayload ??
      (existing.dataPayload as Record<string, unknown>)) as Record<string, unknown>;
    let baseKey = (fields.answerKey ??
      (existing.answerKey as Record<string, unknown>)) as Record<string, unknown>;

    // Pembahasan utama (multi-solution) → `answer_key.explanationMarkdown`.
    const primarySolution =
      solutionInputs?.find((s) => s.isPrimary) ?? solutionInputs?.[0];
    if (primarySolution?.contentMarkdown) {
      baseKey = { ...baseKey, explanationMarkdown: primarySolution.contentMarkdown };
    }

    gated = enforceQuestionWriteGate({
      questionType: fields.questionType ?? existing.questionType,
      dataPayload: basePayload,
      answerKey: baseKey,
      options,
      status: fields.status ?? existing.status,
    });
  }

  // Hitung ulang contentHash bila naskah stem atau opsi disentuh (ADR-0012).
  const stemTouched = fields.contentMarkdown !== undefined;
  const optionsTouched = options !== undefined || fields.dataPayload !== undefined;

  let newContentHash: string | undefined;
  if (stemTouched || optionsTouched) {
    const finalStem = fields.contentMarkdown ?? existing.contentMarkdown;
    const rawOpts = gated
      ? (Array.isArray(gated.dataPayload.options) ? gated.dataPayload.options : [])
      : (Array.isArray((existing.dataPayload as Record<string, unknown>)?.options)
          ? ((existing.dataPayload as Record<string, unknown>).options as Array<{ contentMarkdown?: unknown }>)
          : []);
    const finalOptionTexts = rawOpts.map((o) => String(o.contentMarkdown ?? ""));
    const calculated = contentHash(finalStem, finalOptionTexts);

    if (calculated !== existing.contentHash) {
      const dup = await findQuestionByContentHash(calculated, id);
      if (dup) {
        throw new ConflictError(
          "Perubahan naskah menghasilkan soal yang identik dengan soal lain yang sudah ada.",
        );
      }
      newContentHash = calculated;
    }
  }

  try {
    await db.transaction(async (tx) => {
      const patch: Partial<typeof questions.$inferInsert> = {};
      if (fields.questionType !== undefined) patch.questionType = fields.questionType;
      if (fields.difficulty !== undefined) patch.difficulty = fields.difficulty;
      if (fields.cognitiveLevel !== undefined) patch.cognitiveLevel = fields.cognitiveLevel;
      if (fields.grade !== undefined) patch.grade = fields.grade;
      if (fields.contentMarkdown !== undefined) patch.contentMarkdown = fields.contentMarkdown;
      if (gated) {
        patch.dataPayload = gated.dataPayload;
        patch.answerKey = gated.answerKey;
      }
      if (newContentHash !== undefined) {
        patch.contentHash = newContentHash;
      }
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
        // Pembahasan utama sudah masuk `answer_key.explanationMarkdown` lewat gerbang.
      }

      if (Object.keys(patch).length) {
        await tx.update(questions).set(patch).where(eq(questions.id, id));
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

      // Sinkronkan media shortcode {{img:shortId}} ke tabel question_media
      await syncQuestionShortcodeMediaTx(tx, id);
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new ConflictError(
        "Perubahan naskah menghasilkan soal yang identik dengan soal lain yang sudah ada.",
      );
    }
    throw err;
  }

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
  assertCan(actor, "question:flag", { ownerId: existing.authorId });

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
  // MAT-39: koleksi dihapus — `bundles` kini satu-satunya wadah (origin/bundle_type).
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
 * - RESTRICT: soal yang dipakai paket atau koleksi tetap dilarang (FK `restrict` juga menjaga).
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

  // T-M7-3: cegah pelanggaran FK restrict pada relasi anak & paket soal.
  const [child] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.parentId, id))
    .limit(1);
  if (child) {
    throw new ConflictError(
      "Soal ini memiliki butir turunan (stimulus beranak) — hapus soal turunan lebih dulu.",
    );
  }

  // RESTRICT: soal yang dipakai paket AKTIF tak boleh dihapus (Constraint #46).
  if (await isQuestionUsedInBundles(id)) {
    throw new ConflictError(
      "Soal ini dipakai di paket soal aktif — keluarkan dari paket dulu.",
    );
  }

  // Atomik: bersihkan referensi item dari paket yang sudah terarsip agar foreign key RESTRICT tidak gagal,
  // lalu hapus soal secara permanen.
  await db.transaction(async (tx) => {
    await tx.delete(bundleItems).where(eq(bundleItems.questionId, id));
    await tx.delete(questions).where(eq(questions.id, id));
  });

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Soal dihapus PERMANEN",
  });
}
