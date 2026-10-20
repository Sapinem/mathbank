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

/** Opsi tambahan untuk pemanggil massal. */
export interface ChangeStatusOptions {
  /**
   * **ACT-05:** `false` → lewati pembacaan ulang proyeksi publik setelah UPDATE.
   *
   * Jalur satuan mengembalikan soal lengkap (butuh opsi, pembahasan, bundle,
   * topik = beberapa query). Jalur massal tidak memerlukannya: ia hanya perlu
   * tahu id mana yang berhasil. Melewati pembacaan ini menghapus N×(query baca)
   * dari aksi 200 soal.
   */
  returnUpdated?: boolean;
}

/** Ubah status lewat FSM (L6) + izin status (L1) — tanpa proyeksi balik. */
export function changeQuestionStatus(
  id: string,
  to: QuestionStatus,
  actor: Actor,
  notes: string | null | undefined,
  opts: ChangeStatusOptions & { returnUpdated: false },
): Promise<null>;
/** Ubah status lewat FSM (L6) + izin status (L1) — mengembalikan soal terbaru. */
export function changeQuestionStatus(
  id: string,
  to: QuestionStatus,
  actor: Actor,
  notes?: string | null,
  opts?: ChangeStatusOptions & { returnUpdated?: true },
): Promise<PublicQuestion>;
export async function changeQuestionStatus(
  id: string,
  to: QuestionStatus,
  actor: Actor,
  notes?: string | null,
  opts: ChangeStatusOptions = {},
): Promise<PublicQuestion | null> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  const from = existing.status as QuestionStatus;
  // Transisi tak berubah → tak perlu tulis/audit.
  if (from === to) {
    if (opts.returnUpdated === false) return null;
    return (await getQuestion(id, { viewer: actor })) ?? existing;
  }

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
      ...(notes !== undefined ? { flagNotes: notes } : {}),
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
    changeSummary: notes
      ? `Status ${from} → ${to}: ${notes}`
      : `Status ${from} → ${to}`,
  });

  // ACT-05: jalur massal tak butuh proyeksi publik (hemat N query baca).
  if (opts.returnUpdated === false) return null;

  const updated = await getQuestion(id, { viewer: actor });
  if (!updated) throw new NotFoundError();
  return updated;
}
