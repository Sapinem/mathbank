import { questions } from "@/lib/db/schema/question";
import { questionOptions } from "@/lib/db/schema/question";
import type { Actor } from "@/lib/auth/actor";

/**
 * Proyeksi kolom (S3 — cegah kebocoran).
 *
 * ⚠️ **JANGAN** pakai `.select()` tanpa kolom di jalur BACA yang menghasilkan
 * respons API — itu = `SELECT *`, yang membocorkan:
 *   - `answerKey`   → kunci jawaban (rahasia)
 *   - `embedding*`  → vektor internal 1024-float (bengkak + rahasia)
 *   - `aiTagged*`   → metadata internal
 *
 * Gunakan helper di bawah. Jalur internal (FSM, audit) yang butuh seluruh row
 * boleh tetap `selectAll()` (dokumentasikan alasannya).
 */

/** Kolom `questions` yang aman dikirim ke klien. Field internal DIKELUARKAN. */
export function questionColumns(opts: { withAnswerKey?: boolean } = {}) {
  const cols = {
    id: questions.id,
    parentId: questions.parentId,
    childOrder: questions.childOrder,
    questionType: questions.questionType,
    difficulty: questions.difficulty,
    cognitiveLevel: questions.cognitiveLevel,
    grade: questions.grade,
    contentMarkdown: questions.contentMarkdown,
    dataPayload: questions.dataPayload,
    status: questions.status,
    isFlagged: questions.isFlagged,
    flagNotes: questions.flagNotes,
    // ADR-0014: `sourceId` dibuang — sumber menempel pada BUNDLE.
    eventId: questions.eventId,
    eventYear: questions.eventYear,
    eventSubtest: questions.eventSubtest,
    eventItemNumber: questions.eventItemNumber,
    eventNotes: questions.eventNotes,
    authorId: questions.authorId,
    lastReviewedAt: questions.lastReviewedAt,
    deletedAt: questions.deletedAt,
    createdAt: questions.createdAt,
    updatedAt: questions.updatedAt,
  };
  return opts.withAnswerKey ? { ...cols, answerKey: questions.answerKey } : cols;
}

/**
 * Kolom `question_options` aman. `isCorrect` & `distractorRationale` adalah
 * bagian kunci → hanya bila `withAnswerKey`.
 */
export function optionColumns(opts: { withAnswerKey?: boolean } = {}) {
  const cols = {
    id: questionOptions.id,
    questionId: questionOptions.questionId,
    label: questionOptions.label,
    contentMarkdown: questionOptions.contentMarkdown,
    orderIndex: questionOptions.orderIndex,
    createdAt: questionOptions.createdAt,
    updatedAt: questionOptions.updatedAt,
  };
  return opts.withAnswerKey
    ? { ...cols, isCorrect: questionOptions.isCorrect, distractorRationale: questionOptions.distractorRationale }
    : cols;
}

/**
 * Apakah aktor boleh melihat kunci (`answer_key` + `options.isCorrect`)?
 *
 * Aturan: peran **penyusun/penelaah** (admin/teacher/reviewer) — mereka memang
 * bekerja dengan kunci. `agent` (otomasi) & `machine` (ingest) **tidak**.
 * Aktor multi-peran: boleh bila SALAH SATU perannya berwenang.
 */
export function canSeeAnswerKey(actor: Actor): boolean {
  return actor.roles.some(
    (r) => r === "admin" || r === "teacher" || r === "reviewer",
  );
}
