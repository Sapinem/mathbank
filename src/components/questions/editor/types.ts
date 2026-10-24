import type { PublicQuestion } from "@/lib/services/question-service";

export interface OptionDraft {
  label: string;
  contentMarkdown: string;
  isCorrect: boolean;
  distractorRationale: string;
}

export const LETTERS = ["A", "B", "C", "D", "E"];

export function emptyOptions(): OptionDraft[] {
  return LETTERS.map((label) => ({
    label,
    contentMarkdown: "",
    isCorrect: false,
    distractorRationale: "",
  }));
}

/** Label kunci dari `answer_key` (kanonik `correctOptionIds` → mirror `correct`). */
export function correctLabelsOf(answerKey: unknown): string[] {
  const key = (answerKey ?? {}) as Record<string, unknown>;
  const raw = key.correctOptionIds ?? key.correct;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return list
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

/** Item opsi mentah di `data_payload.options` (bentuk kanonik MAT-145). */
export interface CanonicalOptionItem {
  id?: unknown;
  label?: unknown;
  contentMarkdown?: unknown;
  distractorRationale?: unknown;
}

/**
 * Susun state opsi editor dari soal yang ada.
 */
export function readOptionDrafts(q?: PublicQuestion): OptionDraft[] {
  const dp = (q?.dataPayload ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(dp.options)
    ? (dp.options as CanonicalOptionItem[])
    : [];
  const correct = new Set(correctLabelsOf(q?.answerKey));

  if (raw.length) {
    return raw.map((item, i) => {
      const label =
        String(item?.id ?? item?.label ?? LETTERS[i] ?? "")
          .trim()
          .toUpperCase() || String(i + 1);
      return {
        label,
        contentMarkdown: String(item?.contentMarkdown ?? ""),
        isCorrect: correct.has(label),
        distractorRationale:
          typeof item?.distractorRationale === "string"
            ? item.distractorRationale
            : "",
      };
    });
  }

  if (q?.options?.length) {
    return q.options.map((o) => ({
      label: o.label,
      contentMarkdown: o.contentMarkdown,
      isCorrect: Boolean(o.isCorrect),
      distractorRationale: o.distractorRationale ?? "",
    }));
  }

  return emptyOptions();
}

export interface SolutionDraft {
  id?: string;
  title: string;
  solutionType: "conceptual" | "quick_tip" | "alternative" | "video";
  contentMarkdown: string;
  isPrimary: boolean;
}
