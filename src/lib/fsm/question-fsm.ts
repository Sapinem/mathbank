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
