import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { transition, assertReady, type QuestionStatus } from "@/lib/fsm/question-fsm";
import { recordAudit } from "./audit";
import { getQuestion, getQuestionInternal, type PublicQuestion } from "./question-read";

/**
 * Transisi status soal (M14 — pecahan `question-service.ts`).
 *
 * Terpisah karena punya aturan khusus: FSM (L6) + izin per-tujuan (L1) +
 * penjagaan balapan optimistik (CONSTRAINT #36).
 */

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

  // **T-M4-5:** penjagaan balapan (optimistic). Update HANYA bila status masih
  // `from` — dua PATCH bersamaan tak bisa dua-duanya lolos FSM dari `from` yang
  // sama. Bila 0 baris → status sudah berubah di antara baca & tulis → 409.
  const updated_rows = await db
    .update(questions)
    .set({
      status: to,
      lastReviewedAt: to === "ready" ? new Date() : existing.lastReviewedAt,
    })
    .where(and(eq(questions.id, id), eq(questions.status, from)))
    .returning({ id: questions.id });
  if (updated_rows.length === 0) {
    throw new ConflictError(
      "Status soal sudah berubah oleh permintaan lain. Muat ulang lalu coba lagi.",
    );
  }

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
