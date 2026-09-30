import type { z } from "zod";
import type { questionTypeSchema } from "@/lib/contracts/question";

export type QuestionType = z.infer<typeof questionTypeSchema>;

/** Tipe Moodle XML yang didukung ekspor M12. */
export type MoodleType = "multichoice" | "shortanswer" | "essay";

/**
 * Keputusan pemetaan tipe (M12, D2).
 *
 * `null` = **tidak didukung** → dilewati + dilaporkan (bukan ditebak).
 *
 * TODO(M12+): `matrix_grid` & `matching` belum dipetakan (butuh tipe Moodle
 * khusus / `cloze`). Saat ini **dilewati** agar tak menghasilkan XML menyesatkan.
 */
export const MOODLE_TYPE_MAP: Record<QuestionType, MoodleType | null> = {
  // Pilihan ganda tunggal
  single_choice: "multichoice",
  assertion_reason: "multichoice",
  combination_1234: "multichoice",
  quantitative_pq: "multichoice",
  data_sufficiency: "multichoice",
  // Pilihan ganda banyak-jawaban
  multiple_choice_checkbox: "multichoice",
  // Jawaban teks
  short_answer: "shortanswer",
  essay: "essay",
  // Belum dipetakan (D2 = lewati + laporkan)
  matrix_grid: null,
  matching: null,
  // `stimulus` bukan soal mandiri — ditangani terpisah (inline ke anak).
  stimulus: null,
};

/** Apakah tipe ini dipetakan ke Moodle? */
export function moodleTypeOf(type: QuestionType): MoodleType | null {
  return MOODLE_TYPE_MAP[type] ?? null;
}

/** Apakah multichoice ini jawaban-tunggal? (checkbox = multi) */
export function isSingleAnswer(type: QuestionType): boolean {
  return type !== "multiple_choice_checkbox";
}
