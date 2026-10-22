import { questions } from "@/lib/db/schema/question";
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

// ── Proyeksi opsi dari JSONB (MAT-146 — zero join) ───────────────────────────
//
// Sejak `question_options` dihapus, opsi hidup di `questions.data_payload.options`
// dan kuncinya di `questions.answer_key.correctOptionIds`. Proyeksi di bawah
// mengembalikan bentuk yang SAMA dengan tabel lama (`QuestionOptionView`) supaya
// konsumen (API, UI, ekspor Moodle) tidak perlu berubah.

/** Satu opsi seperti yang dikirim ke klien (bentuk kompatibel `question_options`). */
export interface QuestionOptionView {
  /** Id stabil opsi — sama dengan label ("A".."E") pada kontrak JSONB. */
  id: string;
  questionId: string;
  label: string;
  contentMarkdown: string;
  isCorrect: boolean;
  distractorRationale: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

/** @deprecated MAT-146 — nama lama; pakai `QuestionOptionView`. */
export type QuestionOption = QuestionOptionView;

/** Item opsi mentah di `data_payload.options` (kontrak MAT-145). */
interface RawOptionItem {
  id?: unknown;
  label?: unknown;
  contentMarkdown?: unknown;
  distractorRationale?: unknown;
}

/** Ambil array opsi mentah dari `data_payload` (kosong bila tak ada). */
export function rawOptionsOf(dataPayload: unknown): RawOptionItem[] {
  if (!dataPayload || typeof dataPayload !== "object") return [];
  const opts = (dataPayload as { options?: unknown }).options;
  return Array.isArray(opts) ? (opts as RawOptionItem[]) : [];
}

/** Label opsi benar dari `answer_key` (kanonik `correctOptionIds` → mirror `correct`). */
export function correctLabelsOf(answerKey: unknown): string[] {
  if (!answerKey || typeof answerKey !== "object") return [];
  const key = answerKey as { correctOptionIds?: unknown; correct?: unknown };
  const raw = key.correctOptionIds ?? key.correct;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return list
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Proyeksikan opsi soal dari JSONB.
 *
 * `isCorrect` & `distractorRationale` adalah bagian KUNCI → hanya bila
 * `withAnswerKey` (peran penyusun/penelaah), sesuai kebijakan S3.
 */
export function projectOptions(
  row: { id: string; dataPayload: unknown; answerKey?: unknown },
  opts: { withAnswerKey?: boolean; createdAt?: Date; updatedAt?: Date } = {},
): QuestionOptionView[] {
  const raw = rawOptionsOf(row.dataPayload);
  if (raw.length === 0) return [];

  const correct = opts.withAnswerKey ? correctLabelsOf(row.answerKey) : [];
  const createdAt = opts.createdAt ?? new Date(0);
  const updatedAt = opts.updatedAt ?? createdAt;

  return raw.map((item, index) => {
    const label = String(item.id ?? item.label ?? "").trim().toUpperCase();
    const safeLabel = label || String(index + 1);
    const view: QuestionOptionView = {
      id: safeLabel,
      questionId: row.id,
      label: safeLabel,
      contentMarkdown: String(item.contentMarkdown ?? ""),
      isCorrect: correct.includes(label),
      distractorRationale: null,
      orderIndex: index,
      createdAt,
      updatedAt,
    };
    if (opts.withAnswerKey) {
      const rationale = item.distractorRationale;
      view.distractorRationale =
        typeof rationale === "string" && rationale.trim() ? rationale : null;
    }
    return view;
  });
}

/**
 * Tambahkan alias legacy ke `answer_key` untuk konsumen lama (UI, ekspor).
 *
 * Penyimpanan memakai bentuk kanonik (`correctOptionIds`, `explanationMarkdown`);
 * mirror `correct` / `explanation` / `text` dipertahankan di sini agar kontrak
 * respons API tidak berubah. Bila kunci kosong, kembalikan `{}` apa adanya.
 */
export function projectAnswerKey(answerKey: unknown): Record<string, unknown> {
  if (!answerKey || typeof answerKey !== "object") return {};
  const src = answerKey as Record<string, unknown>;
  if (Object.keys(src).length === 0) return {};

  const out: Record<string, unknown> = { ...src };

  const correct = correctLabelsOf(src);
  if (correct.length) {
    if (out.correctOptionIds === undefined) out.correctOptionIds = correct;
    if (out.correct === undefined) out.correct = correct;
  }
  const explanation = src.explanationMarkdown ?? src.explanation;
  if (typeof explanation === "string") {
    if (out.explanationMarkdown === undefined) out.explanationMarkdown = explanation;
    if (out.explanation === undefined) out.explanation = explanation;
  }
  const accepted = src.acceptedAnswers;
  if (
    out.text === undefined &&
    Array.isArray(accepted) &&
    typeof accepted[0] === "string"
  ) {
    out.text = accepted[0];
  }
  return out;
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
