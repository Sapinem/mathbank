/**
 * Pengelolaan item paket soal (L5) — pecahan `bundle-service.ts` (SRP).
 *
 * Tanggung jawab tunggal: TAMBAH, HAPUS, & SUSUN-ULANG item dalam paket.
 * Pembacaan paket ada di `bundle-query.ts`; mutasi metadata ada di `bundle-write.ts`.
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions } from "@/lib/db/schema/question";
import {
  NotFoundError,
  ConflictError,
} from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import {
  assertBundleWrite,
  type BundleItemRow,
  type BundleItemRole,
} from "./bundle-shared";
import { getBundle } from "./bundle-query";
import { versionPredicate } from "@/lib/db/optimistic";
import { assertVersionMatches, PreconditionFailedError } from "@/lib/api/version";

/** Tambah soal ke paket (di akhir). Tolak duplikat. */
export async function addItem(
  bundleId: string,
  questionId: string,
  actor: Actor,
  opts: { role?: BundleItemRole; sectionName?: string | null } = {},
  /** Versi paket yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<BundleItemRow> {
  const bundle = await getBundle(bundleId);
  if (!bundle) throw new NotFoundError("Paket tidak ditemukan.");
  assertBundleWrite(bundle, actor);
  if (expectedVersion !== undefined) assertVersionMatches(bundle.version, expectedVersion);

  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
    .limit(1);
  if (!q) throw new NotFoundError("Soal tidak ditemukan.");

  // Tolak duplikat (invarian UNIQUE(bundle_id, question_id)).
  const [dup] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(
      and(
        eq(bundleItems.bundleId, bundleId),
        eq(bundleItems.questionId, questionId),
      ),
    )
    .limit(1);
  if (dup) throw new ConflictError("Soal sudah ada di paket ini.");

  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(order_index), 0)` })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, bundleId));

  // ADR-0030: sentuh paket LEBIH DULU di dalam transaksi, lalu sisipkan item.
  // Urutan ini penting — bila versi sudah basi, tak ada item yatim yang
  // terlanjur masuk sebelum 412 dikembalikan.
  const [row] = await db.transaction(async (tx) => {
    const touched = await tx
      .update(bundles)
      .set({ updatedAt: new Date() })
      .where(versionPredicate(bundles, bundleId, expectedVersion ?? "*"))
      .returning({ id: bundles.id });
    if (touched.length === 0) throw new PreconditionFailedError();
    return tx
      .insert(bundleItems)
      .values({
        bundleId,
        questionId,
        role: opts.role ?? "question",
        orderIndex: Number(max) + 1,
        sectionName: opts.sectionName ?? null,
      })
      .returning();
  });
  return row!;
}

/** Hapus item dari paket. */
export async function removeItem(
  bundleId: string,
  itemId: string,
  actor: Actor,
  /** Versi paket yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<void> {
  const bundle = await getBundle(bundleId);
  if (!bundle) throw new NotFoundError("Paket tidak ditemukan.");
  assertBundleWrite(bundle, actor);
  if (expectedVersion !== undefined) assertVersionMatches(bundle.version, expectedVersion);
  const [row] = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(and(eq(bundleItems.id, itemId), eq(bundleItems.bundleId, bundleId)))
    .limit(1);
  if (!row) throw new NotFoundError("Item paket tidak ditemukan.");
  await db.transaction(async (tx) => {
    const touched = await tx
      .update(bundles)
      .set({ updatedAt: new Date() })
      .where(versionPredicate(bundles, bundleId, expectedVersion ?? "*"))
      .returning({ id: bundles.id });
    if (touched.length === 0) throw new PreconditionFailedError();
    await tx.delete(bundleItems).where(eq(bundleItems.id, itemId));
  });
}

/** Susun ulang item sesuai daftar id (urutan baru). */
export async function reorderItems(
  bundleId: string,
  itemIds: string[],
  actor: Actor,
  /** Versi paket yang diharapkan (ADR-0030); `undefined` = tanpa prakondisi. */
  expectedVersion?: number | "*",
): Promise<void> {
  const bundle = await getBundle(bundleId);
  if (!bundle) throw new NotFoundError("Paket tidak ditemukan.");
  assertBundleWrite(bundle, actor);
  if (expectedVersion !== undefined) assertVersionMatches(bundle.version, expectedVersion);
  const existing = await db
    .select({ id: bundleItems.id })
    .from(bundleItems)
    .where(eq(bundleItems.bundleId, bundleId));
  const ids = new Set(existing.map((r) => r.id));
  if (itemIds.some((id) => !ids.has(id))) {
    throw new NotFoundError("Ada item yang bukan milik paket ini.");
  }
  // T-M7-2: WAJIB daftar LENGKAP — tolak subset/duplikat agar `order_index`
  // tidak bentrok (mis. [1,1,2,2]) & urutan tetap deterministik.
  const unique = new Set(itemIds);
  if (unique.size !== itemIds.length) {
    throw new ConflictError("Daftar urutan memuat id duplikat.");
  }
  if (itemIds.length !== existing.length) {
    throw new ConflictError(
      "Daftar urutan harus memuat SELURUH item paket (tidak boleh sebagian).",
    );
  }
  if (itemIds.length === 0) return;
  // Transaksi: perbarui seluruh urutan secara atomik (gagal parsial → rollback).
  // **PERF-06:** satu pernyataan SQL `CASE` untuk seluruh item (batch), bukan
  // N `UPDATE` berurutan → menghilangkan latensi pulang-pergi per item.
  await db.transaction(async (tx) => {
    const cases = itemIds.map(
      (id, i) => sql`WHEN ${bundleItems.id} = ${id}::uuid THEN ${i + 1}::int`,
    );
    const inList = itemIds.map((id) => sql`${id}::uuid`);
    await tx.execute(sql`
      UPDATE ${bundleItems}
         SET order_index = CASE ${sql.join(cases, sql` `)} END
       WHERE ${bundleItems.bundleId} = ${bundleId}::uuid
         AND ${bundleItems.id} IN (${sql.join(inList, sql`, `)})
    `);
    const touched = await tx
      .update(bundles)
      .set({ updatedAt: new Date() })
      .where(versionPredicate(bundles, bundleId, expectedVersion ?? "*"))
      .returning({ id: bundles.id });
    if (touched.length === 0) throw new PreconditionFailedError();
  });
}
