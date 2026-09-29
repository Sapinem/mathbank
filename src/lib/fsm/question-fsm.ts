/**
 * FSM status soal (L6) — SATU tempat untuk transisi status.
 *
 * QBank punya `question-fsm.ts` (263 baris) tapi TIDAK DIPAKAI (dead code) —
 * transisi dilakukan manual di service. MathBank memakai FSM betulan:
 * semua perubahan status WAJIB lewat `transition()`.
 *
 * Diagram:
 *   draft ──submit──► review ──approve──► ready ──archive──► archived
 *     ▲                 │                   │                    │
 *     └────reject───────┘                   │                    │
 *     └─────────────────────────────────────┴────restore─────────┘
 */

export const QUESTION_STATUSES = ["draft", "review", "ready", "archived"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Transisi yang diizinkan: dari → ke. */
const TRANSITIONS: Record<QuestionStatus, QuestionStatus[]> = {
  draft: ["review", "archived"],
  review: ["ready", "draft", "archived"],
  ready: ["archived", "review"],
  archived: ["draft"],
};

/** Kesalahan transisi tak sah. */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: QuestionStatus,
    public readonly to: QuestionStatus,
  ) {
    super(`Transisi status tak sah: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Apakah transisi dari `from` ke `to` diizinkan? */
export function canTransition(from: QuestionStatus, to: QuestionStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Daftar status yang bisa dituju dari `from`. */
export function nextStatuses(from: QuestionStatus): QuestionStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}

/** Kesalahan ketika soal belum siap ditandai `ready` (HTTP 422/409). */
export class NotReadyError extends Error {
  readonly code = "NOT_READY";
  constructor(message: string) {
    super(message);
    this.name = "NotReadyError";
  }
}

/** Bentuk minimal data yang dibutuhkan untuk menilai kesiapan. */
export interface ReadinessInput {
  questionType: string;
  answerKey: Record<string, unknown> | null;
}

/** Apakah `answerKey` dianggap kosong (belum diisi)? */
export function isAnswerKeyEmpty(
  answerKey: Record<string, unknown> | null,
): boolean {
  return (
    answerKey == null ||
    Object.keys(answerKey).length === 0 ||
    (answerKey as { __empty?: boolean }).__empty === true
  );
}

/**
 * Apakah soal boleh ditandai `ready`?
 *
 * Aturan (keputusan pemilik produk):
 * - Soal BOLEH dibuat tanpa `answer_key` — boleh `draft`/`review` seperti biasa.
 * - Namun untuk jadi `ready`, `answer_key` WAJIB terisi — kecuali `stimulus`
 *   (wacana/bacaan tak punya jawaban sendiri; jawabannya di soal anak).
 *
 * Konsekuensi hilir: soal tanpa `answer_key` juga TIDAK bisa diekspor ke Moodle
 * (lihat guard M12) — inilah "batasan" yang dimaksud.
 */
export function canBeReady(input: ReadinessInput): boolean {
  if (input.questionType === "stimulus") return true;
  return !isAnswerKeyEmpty(input.answerKey);
}

/**
 * Jaminan kesiapan. Melempar `NotReadyError` bila `answer_key` belum diisi.
 */
export function assertReady(input: ReadinessInput): void {
  if (!canBeReady(input)) {
    throw new NotReadyError(
      "Soal belum bisa ditandai 'Siap': jawaban (answer_key) belum diisi.",
    );
  }
}

/**
 * Jaminan transisi. Melempar `InvalidTransitionError` bila tak sah.
 * Idempoten: from === to diizinkan (tak mengubah apa pun).
 */
export function transition(
  from: QuestionStatus,
  to: QuestionStatus,
): QuestionStatus {
  if (from === to) return to;
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return to;
}
