import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import {
  assertCan,
  hasRole,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { transition, assertReady, type QuestionStatus } from "@/lib/fsm/question-fsm";
import { recordAudit } from "./audit";
import { getQuestion, getQuestionInternal, type PublicQuestion } from "./question-read";
import { assertReleaseContract } from "./question-release";
import { versionPredicate } from "@/lib/db/optimistic";
import { assertVersionMatches } from "@/lib/api/version";

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
  /**
   * Versi yang diharapkan (ADR-0030), dari header `If-Match`.
   * `undefined` = tanpa prakondisi (pemanggil internal & jalur massal).
   */
  expectedVersion?: number | "*";
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

  // ADR-0030: salinan klien yang basi ditolak sebelum aturan bisnis apa pun,
  // supaya 412 tidak tersamarkan oleh 409/422 yang membingungkan.
  if (opts.expectedVersion !== undefined) {
    assertVersionMatches(existing.version, opts.expectedVersion);
  }

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
    // Fase 1 — larangan self-approve: penelaah tidak boleh menyetujui
    // soal buatannya sendiri. Pengecualian hanya `admin` (peran, lewat
    // hasRole — bukan tebakan string di luar matriks peran). Aktor
    // `teacher + reviewer` mendapat `setReady: yes` dari peran reviewer,
    // jadi tanpa cek ini ia lolos persetujuan atas soalnya sendiri.
    if (
      !hasRole(actor, "admin") &&
      existing.authorId &&
      existing.authorId === actor.id
    ) {
      throw new ForbiddenError(
        "Penelaah tidak dapat menyetujui soal buatannya sendiri; minta penelaah lain.",
      );
    }
    // Batasan: soal boleh ada tanpa answer_key, TAPI tak boleh jadi `ready`
    // sebelum jawabannya diisi (kecuali stimulus). Lihat question-fsm.ts.
    assertReady({
      questionType: existing.questionType,
      answerKey: existing.answerKey,
    });
    // **MAT-150** — kontrak rilis pedagogis (3 lapis Zod, sama dengan gerbang
    // tulis MAT-146). Urutan wajib: FSM → izin → gerbang → UPDATE CAS.
    // Tanpa ini, `draft → ready` melewati kewajiban distractor rationale,
    // rubrik esai, dan `explanationMarkdown`. Galat → 422, bukan 500.
    assertReleaseContract({
      questionType: existing.questionType,
      dataPayload: existing.dataPayload,
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
  //
  // ADR-0030: predikat versi ditambahkan saat `If-Match` dipakai, sehingga
  // perubahan isi (bukan hanya status) juga membatalkan transisi.
  const versionClause =
    opts.expectedVersion !== undefined
      ? versionPredicate(questions, id, opts.expectedVersion)
      : eq(questions.id, id);
  const updated_rows = await db
    .update(questions)
    .set({
      status: to,
      lastReviewedAt: to === "ready" ? new Date() : existing.lastReviewedAt,
      ...(notes !== undefined ? { flagNotes: notes } : {}),
    })
    .where(and(versionClause, eq(questions.status, from)))
    .returning({ id: questions.id });
  if (updated_rows.length === 0) {
    // Tetap 409 (CONSTRAINT #36): versi sudah diperiksa di awal, jadi 0 baris
    // di sini berarti STATUS yang bergeser — kelas galat yang berbeda.
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
