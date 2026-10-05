/**
 * Pembacaan paket soal (L5) — pecahan `bundle-service.ts` (SRP).
 *
 * Tanggung jawab tunggal: BACA paket & item (+ hitung jumlah).
 * Mutasi ada di `bundle-write.ts`; pengelolaan item ada di `bundle-items.ts`.
 *
 * Invarian penting (dipegang bersama modul saudara):
 *  - Soal yang dipakai paket **tak bisa dihapus** (RESTRICT).
 *  - `answerKey`/`isCorrect`/`distractorRationale` hanya muncul bila aktor
 *    berwenang (`canSeeAnswerKey`) — proyeksi aman (S3).
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions, questionOptions } from "@/lib/db/schema/question";
import {
  questionColumns,
  optionColumns,
  canSeeAnswerKey,
} from "@/lib/db/projections/question";
import { assertBundleRead, bundleColumns } from "./bundle-shared";
import type {
  BundleRow,
  BundleCore,
  BundleItemWithQuestion,
  BundleValidation,
  BundleItemRow,
} from "./bundle-shared";
import type { Actor } from "@/lib/auth/actor";
import type { PublicQuestion } from "./question-service";
import type { AnswerKey } from "@/lib/contracts/question";

/**
 * Lampirkan itemCount ke baris paket.
 *
 * CATATAN: sengaja TIDAK memakai subquery `sql` di dalam `.select()` — Drizzle
 * men-correlate alias tabel luar dengan cara yang (di driver ini) menghasilkan 0.
 * Grup-hit terpisah: andal & jelas.
 */
async function attachCounts(rows: BundleCore[]): Promise<BundleRow[]> {
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      bundleId: bundleItems.bundleId,
      c: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(bundleItems)
    .where(
      inArray(
        bundleItems.bundleId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(bundleItems.bundleId);
  const map = new Map(counts.map((c) => [c.bundleId, Number(c.c)]));
  return rows.map((r) => ({ ...r, itemCount: map.get(r.id) ?? 0 }));
}

/**
 * Daftar paket aktif (belum diarsip) + jumlah soal.
 *
 * ⚠️ Sengaja TIDAK menyaring per-pemilik: guru **boleh melihat** latihan guru
 * lain (keputusan pemilik produk). Yang dibatasi adalah **mutasi**, ditegakkan
 * `assertBundleWrite` per-paket.
 */
export async function listBundles(actor: Actor): Promise<BundleRow[]> {
  assertBundleRead(actor);
  const rows = await db
    .select(bundleColumns())
    .from(bundles)
    .where(isNull(bundles.deletedAt))
    .orderBy(desc(bundles.updatedAt));
  return attachCounts(rows);
}

/** Ambil satu paket (tanpa item) atau null. */
export async function getBundle(id: string): Promise<BundleRow | null> {
  const [row] = await db
    .select(bundleColumns())
    .from(bundles)
    .where(and(eq(bundles.id, id), isNull(bundles.deletedAt)))
    .limit(1);
  if (!row) return null;
  const [withCount] = await attachCounts([row]);
  return withCount!;
}

/**
 * Daftar item paket (berurutan), dengan soal ter-proyeksi.
 *
 * **NEW4:** `actor` diteruskan agar `answerKey` hanya muncul bila viewer berwenang
 * (`canSeeAnswerKey`) — konsisten dengan aturan S3 di `question-service`.
 */
export async function listBundleItems(
  id: string,
  actor?: Actor,
): Promise<BundleItemWithQuestion[]> {
  const withAnswerKey = actor ? canSeeAnswerKey(actor) : false;
  // Proyeksi bersyarat (kunci hanya bila berwenang) membuat Drizzle menyimpulkan
  // tipe GABUNGAN yang tak bisa disatukan TS. Kita normalkan sekali di batas baca.
  const rows = (await db
    .select({
      item: {
        id: bundleItems.id,
        bundleId: bundleItems.bundleId,
        questionId: bundleItems.questionId,
        role: bundleItems.role,
        orderIndex: bundleItems.orderIndex,
        sectionName: bundleItems.sectionName,
        itemNumber: bundleItems.itemNumber,
        notes: bundleItems.notes,
      },
      question: questionColumns({ withAnswerKey }),
    })
    .from(bundleItems)
    .innerJoin(questions, eq(questions.id, bundleItems.questionId))
    .where(eq(bundleItems.bundleId, id))
    .orderBy(asc(bundleItems.orderIndex))) as unknown as Array<{
    item: BundleItemRow;
    question: Omit<PublicQuestion, "options" | "answerKey"> & {
      answerKey?: AnswerKey;
    };
  }>;

  // Lampirkan opsi (M8: naskah cetak butuh pilihan jawaban). Batch agar tak N+1.
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.question.id);
  const opts = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, ids))
    .orderBy(asc(questionOptions.orderIndex));
  const byQuestion = new Map<string, typeof opts>();
  for (const o of opts) {
    const arr = byQuestion.get(o.questionId) ?? [];
    arr.push(o);
    byQuestion.set(o.questionId, arr);
  }
  return rows.map((r) => ({
    ...r,
    question: { ...r.question, options: byQuestion.get(r.question.id) ?? [] },
  }));
}

/**
 * Validasi paket: kelengkapan soal & kunci. Peringatan ≠ error.
 */
export async function validateBundle(
  id: string,
): Promise<BundleValidation> {
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
  // T-M7-3: hanya paket AKTIF yang memblokir — paket terarsip tak boleh
  // menyandera soal (jika tidak, soal mustahil dihapus setelah paket diarsip).
  const [row] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .innerJoin(bundles, eq(bundles.id, bundleItems.bundleId))
    .where(
      and(eq(bundleItems.questionId, questionId), isNull(bundles.deletedAt)),
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
      ),
    );
  return rows.map((r) => r.bundleId);
}
