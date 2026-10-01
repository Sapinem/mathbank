import { changeQuestionStatus } from "./question-status";
import { setQuestionFlag } from "./question-write";
import type { Actor } from "@/lib/auth/actor";
import type { QuestionStatus } from "@/lib/fsm/question-fsm";

/**
 * Aksi massal (kurasi) — G3.1.
 *
 * **Prinsip (hindari tambal-sulam):** bulk **memakai ulang** jalur nyata
 * per-butir (`changeQuestionStatus` / `setQuestionFlag`) sehingga **izin
 * per-tujuan (L1), FSM (L6), dan penjagaan balapan (CONSTRAINT #36) tetap
 * ditegakkan** — tidak ada jalur pintas yang melewati aturan.
 *
 * Karena itu pula hasilnya **per-butir**: item yang tak lolos izin/FSM/balapan
 * dicatat sebagai `failed` (bukan menggagalkan seluruh batch). Ini pola
 * "partial success" yang jujur & aman untuk kurasi massal.
 */

export type BulkAction =
  | "set_ready"
  | "archive"
  | "reject_to_draft"
  | "flag"
  | "unflag";

export const BULK_ACTIONS: readonly BulkAction[] = [
  "set_ready",
  "archive",
  "reject_to_draft",
  "flag",
  "unflag",
] as const;

/** Peta aksi → status tujuan FSM (untuk aksi status). */
const STATUS_TARGET: Partial<Record<BulkAction, QuestionStatus>> = {
  set_ready: "ready",
  archive: "archived",
  reject_to_draft: "draft",
};

export interface BulkResult {
  ok: string[];
  failed: { id: string; error: string }[];
}

/** Batas aman jumlah id per permintaan (cegah penyalahgunaan). */
export const BULK_MAX_IDS = 200;

export async function bulkQuestionAction(
  ids: string[],
  action: BulkAction,
  actor: Actor,
  notes?: string | null,
): Promise<BulkResult> {
  const result: BulkResult = { ok: [], failed: [] };

  for (const id of ids) {
    try {
      const target = STATUS_TARGET[action];
      if (target) {
        await changeQuestionStatus(id, target, actor);
      } else if (action === "flag") {
        await setQuestionFlag(id, true, notes ?? null, actor);
      } else if (action === "unflag") {
        await setQuestionFlag(id, false, null, actor);
      }
      result.ok.push(id);
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : "Gagal diproses.",
      });
    }
  }

  return result;
}
