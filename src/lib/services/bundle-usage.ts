import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions } from "@/lib/db/schema/question";
import type { BundleValidation } from "./bundle-shared";
export type { BundleValidation } from "./bundle-shared";

/**
 * Validasi naskah dan relasi pemakaian soal dalam paket (M7 / M14).
 * Pecahan dari bundle-query.ts (CONSTRAINT #16: maks ~300 baris/file).
 */

/**
 * Validasi paket: kelengkapan soal & kunci. Peringatan ≠ error.
 */
export async function validateBundle(id: string): Promise<BundleValidation> {
  const items = await db
    .select({
      questionId: bundleItems.questionId,
      itemNumber: bundleItems.itemNumber,
      deletedAt: questions.deletedAt,
      answerKey: questions.answerKey,
    })
    .from(bundleItems)
    .innerJoin(questions, eq(questions.id, bundleItems.questionId))
    .where(eq(bundleItems.bundleId, id));

  const withoutAnswerKey: BundleValidation["withoutAnswerKey"] = [];
  const missingQuestions: string[] = [];
  for (const it of items) {
    if (it.deletedAt) {
      missingQuestions.push(it.questionId);
      continue;
    }
    // `answer_key` kosong = tak punya kunci (`{}` bukan null).
    const key = it.answerKey as Record<string, unknown> | null | undefined;
    const takPunyaKunci =
      key === null ||
      key === undefined ||
      (typeof key === "object" && Object.keys(key).length === 0);
    if (takPunyaKunci) {
      withoutAnswerKey.push({
        questionId: it.questionId,
        itemNumber: it.itemNumber,
      });
    }
  }
  return {
    itemCount: items.length,
    withoutAnswerKey,
    missingQuestions,
    valid: missingQuestions.length === 0,
  };
}

/** Apakah sebuah soal dipakai di paket AKTIF mana pun? (untuk RESTRICT hapus soal) */
export async function isQuestionUsedInBundles(
  questionId: string,
): Promise<boolean> {
  // T-M7-3, ADR-0025: hanya paket AKTIF yang memblokir — paket terarsip tak boleh
  // menyandera soal (jika tidak, soal mustahil dihapus setelah paket diarsip).
  const [row] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(
      and(
        eq(bundleItems.questionId, questionId),
        isNull(bundles.deletedAt),
        ne(bundles.status, "archived"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** ID paket AKTIF yang memakai sekumpulan soal. */
export async function bundlesUsingQuestions(
  questionIds: string[],
): Promise<string[]> {
  if (questionIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ bundleId: bundleItems.bundleId })
    .from(bundleItems)
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(
      and(
        inArray(bundleItems.questionId, questionIds),
        isNull(bundles.deletedAt),
        ne(bundles.status, "archived"),
      ),
    );
  return rows.map((r) => r.bundleId);
}
