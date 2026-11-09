import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { isQuestionUsedInBundles } from "./bundle-service";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { versionPredicate } from "@/lib/db/optimistic";
import { assertVersionMatches } from "@/lib/api/version";
import { throwVersionedWriteMiss } from "./versioned";
import type { Actor } from "@/lib/auth/actor";
import { recordAudit } from "./audit";
import { getQuestionInternal } from "./question-read";

/**
 * Hapus lunak (soft delete) soal.
 * Pecahan dari question-write.ts (CONSTRAINT #16: maks ~300 baris/file).
 */
export async function deleteQuestion(
  id: string,
  actor: Actor,
  /** Versi yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<void> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  assertCan(actor, "question:delete", { ownerId: existing.authorId });
  if (expectedVersion !== undefined) {
    assertVersionMatches(existing.version, expectedVersion);
  }

  // RESTRICT: soal yang dipakai paket AKTIF (M7) tak boleh dihapus.
  // T-M7-3: paket TERARSIP tidak memblokir — jika tidak, soal mustahil dihapus
  // setelah paket yang memakainya diarsipkan (dead-end).
  // MAT-39: koleksi dihapus — `bundles` kini satu-satunya wadah (origin/bundle_type).
  if (await isQuestionUsedInBundles(id)) {
    throw new ConflictError(
      "Soal ini dipakai di paket soal — keluarkan dari paket dulu.",
    );
  }

  const deleted = await db
    .update(questions)
    .set({ deletedAt: new Date() })
    .where(versionPredicate(questions, id, expectedVersion ?? "*"))
    .returning({ id: questions.id });
  if (deleted.length === 0) {
    return throwVersionedWriteMiss(
      questions,
      id,
      expectedVersion,
      "Soal tidak ditemukan.",
    );
  }

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Soal dihapus (lunak)",
  });
}

/**
 * Hapus PERMANEN (hard delete) — buang baris dari DB.
 *
 * **T-M4-4:** izin `question:hardDelete` (matriks: admin `yes`, guru/penelaah `own`)
 * kini benar-benar dipakai. Aturan:
 * - **Hanya** soal yang sudah **soft-deleted** (`deletedAt` terisi) boleh dihapus
 *   permanen — cegah penghapusan tak sengaja atas soal aktif.
 * - RESTRICT: soal yang dipakai paket atau koleksi tetap dilarang (FK `restrict` juga menjaga).
 * - Anak (opsi/solusi/topik/label/media) di-CASCADE otomatis oleh DB.
 */
export async function hardDeleteQuestion(
  id: string,
  actor: Actor,
  /** Versi yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<void> {
  // includeDeleted: soal yang ingin dihapus permanen PASTI ber-deletedAt (sudah soft-delete).
  const existing = await getQuestionInternal(id, { includeDeleted: true });
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  assertCan(actor, "question:hardDelete", { ownerId: existing.authorId });
  if (expectedVersion !== undefined) {
    assertVersionMatches(existing.version, expectedVersion);
  }

  if (!existing.deletedAt) {
    throw new ConflictError(
      "Hapus permanen hanya untuk soal yang sudah dihapus (soft-delete).",
    );
  }

  // T-M7-3: cegah pelanggaran FK restrict pada relasi anak & paket soal.
  const [child] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.parentId, id))
    .limit(1);
  if (child) {
    throw new ConflictError(
      "Soal ini memiliki butir turunan (stimulus beranak) — hapus soal turunan lebih dulu.",
    );
  }

  // RESTRICT: soal yang dipakai paket AKTIF tak boleh dihapus (Constraint #46).
  if (await isQuestionUsedInBundles(id)) {
    throw new ConflictError(
      "Soal ini dipakai di paket soal aktif — keluarkan dari paket dulu.",
    );
  }

  // Atomik: bersihkan referensi item dari paket yang sudah terarsip agar foreign key RESTRICT tidak gagal,
  // lalu hapus soal secara permanen.
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: questions.id, version: questions.version })
      .from(questions)
      .where(versionPredicate(questions, id, expectedVersion ?? "*"))
      .for("update");
    if (!locked) {
      return throwVersionedWriteMiss(
        questions,
        id,
        expectedVersion,
        "Soal tidak ditemukan.",
        { dbOrTx: tx },
      );
    }

    // Validasi ulang di dalam transaksi agar tidak balapan dengan penambahan paket aktif baru
    const [activeUsage] = await tx
      .select({ id: bundleItems.id })
      .from(bundleItems)
      .innerJoin(bundles, eq(bundleItems.bundleId, bundles.id))
      .where(
        and(
          eq(bundleItems.questionId, id),
          isNull(bundles.deletedAt),
          ne(bundles.status, "archived"),
        ),
      )
      .limit(1);
    if (activeUsage) {
      throw new ConflictError(
        "Soal ini dipakai di paket soal aktif — keluarkan dari paket dulu.",
      );
    }

    // Bersihkan hanya item dari paket yang sudah terarsip/terhapus lunak
    await tx.delete(bundleItems).where(
      and(
        eq(bundleItems.questionId, id),
        inArray(
          bundleItems.bundleId,
          tx
            .select({ id: bundles.id })
            .from(bundles)
            .where(
              or(isNotNull(bundles.deletedAt), eq(bundles.status, "archived")),
            ),
        ),
      ),
    );
    await tx.delete(questions).where(eq(questions.id, id));
  });

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Soal dihapus PERMANEN",
  });
}
