/**
 * Mutasi paket soal (L5) — pecahan `bundle-service.ts` (SRP).
 *
 * Tanggung jawab tunggal: BUAT, PERBARUI metadata, ARSIP, & DUPLIKASI paket.
 * Pembacaan ada di `bundle-query.ts`; pengelolaan item ada di `bundle-items.ts`.
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { recordAudit } from "./audit";
import type { Actor } from "@/lib/auth/actor";
import {
  NotFoundError,
  ConflictError,
} from "@/lib/auth/guards";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  assertBundleCreate,
  assertBundleRead,
  assertBundleWrite,
  type BundleRow,
  type CreateBundleInput,
  type UpdateBundleInput,
} from "./bundle-shared";
import { getBundle } from "./bundle-query";

/**
 * Buat paket baru (status draft).
 *
 * ⚠️ Pengecekan izin **bukan** `assertCan("bundle:manage")`: izin itu ber-`own`
 * untuk guru, dan di sini `ownerId` **belum ada** (barisnya belum dibuat) →
 * `assertCan` tanpa `ownerId` akan **selalu menolak** guru (#35). Kita periksa
 * kemampuan *membuat* secara eksplisit: guru/penelaah boleh, agent/mesin tidak.
 */
export async function createBundle(
  input: CreateBundleInput,
  actor: Actor,
): Promise<BundleRow> {
  assertBundleCreate(actor);
  const [row] = await db
    .insert(bundles)
    .values({
      title: input.title,
      bundleType: input.bundleType,
      origin: input.origin ?? "manual",
      sourceId: input.sourceId ?? null,
      eventId: input.eventId ?? null,
      year: input.year ?? null,
      grade: input.grade ?? null,
      durationMinutes: input.durationMinutes ?? 90,
      instructions: input.instructions ?? null,
      ...(input.printConfig ? { printConfig: input.printConfig } : {}),
      createdById: actor.id,
    })
    .returning({ id: bundles.id });
  await recordAudit({
    entityType: "bundle",
    entityId: row!.id,
    action: "create",
    actor,
    changeSummary: `Paket dibuat: ${input.title}`,
  });
  return (await getBundle(row!.id))!;
}

/**
 * Perbarui metadata paket.
 *
 * ⚠️ Izinkan bila aktor boleh UBAH paket ini (`assertBundleWrite`) — latihan
 * milik guru lain DITOLAK meski `bundle:manage` = "yes" (#35).
 */
export async function updateBundle(
  id: string,
  patch: UpdateBundleInput,
  actor: Actor,
): Promise<BundleRow> {
  const existing = await getBundle(id);
  if (!existing) throw new NotFoundError("Paket tidak ditemukan.");
  assertBundleWrite(existing, actor);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) {
    set.title = patch.title;
  }
  if (patch.bundleType !== undefined) set.bundleType = patch.bundleType;
  if (patch.origin !== undefined) set.origin = patch.origin;
  if (patch.sourceId !== undefined) set.sourceId = patch.sourceId;
  if (patch.eventId !== undefined) set.eventId = patch.eventId;
  if (patch.year !== undefined) set.year = patch.year;
  if (patch.grade !== undefined) set.grade = patch.grade;
  if (patch.durationMinutes !== undefined)
    set.durationMinutes = patch.durationMinutes;
  if (patch.instructions !== undefined) set.instructions = patch.instructions;
  // PATCH = tambal-sebagian, bukan ganti-total: field yang tidak dikirim
  // mempertahankan nilai tersimpan. Tanpa merge, `{ pageSize }` menghapus
  // institutionName/twoColumnLayout/includeAnswerKey/showQuestionNumber.
  // Digabung DI DALAM SQL (#36) — bukan `{ ...existing.printConfig }` — agar
  // dua PATCH bersamaan tidak saling menimpa (baca-lalu-tulis tanpa penjagaan).
  if (patch.printConfig !== undefined)
    set.printConfig = sql`COALESCE(${bundles.printConfig}, '{}'::jsonb) || ${JSON.stringify(patch.printConfig)}::jsonb`;
  if (patch.status !== undefined) set.status = patch.status;

  await db.update(bundles).set(set).where(eq(bundles.id, id));
  await recordAudit({
    entityType: "bundle",
    entityId: id,
    action: "update",
    actor,
    changeSummary: "Paket diperbarui",
  });
  return (await getBundle(id))!;
}

/** Arsip paket (soft-delete). Hanya pembuat / admin (`assertBundleWrite`). */
export async function archiveBundle(
  id: string,
  actor: Actor,
): Promise<void> {
  const existing = await getBundle(id);
  if (!existing) throw new NotFoundError("Paket tidak ditemukan.");
  assertBundleWrite(existing, actor);
  await db
    .update(bundles)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(bundles.id, id));
  await recordAudit({
    entityType: "bundle",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Paket diarsipkan (soft-delete)",
  });
}

/**
 * Duplikasi paket (metadata + item) dengan judul baru.
 *
 * ⚠️ Sumbernya boleh milik siapa pun yang boleh **melihat** (menyalin latihan
 * guru lain = "fork" sah). Salinannya menjadi milik aktor (`createdById`).
 * Karena itu cukup izin **baca** — bukan `assertCan("bundle:manage")` yang
 * ber-`own` dan akan selalu menolak tanpa `ownerId` (#35).
 */
export async function duplicateBundle(
  id: string,
  actor: Actor,
  newTitle?: string,
): Promise<BundleRow> {
  assertBundleRead(actor);
  assertBundleCreate(actor);
  const src = await getBundle(id);
  if (!src) throw new NotFoundError("Paket tidak ditemukan.");
  const title = newTitle ?? `${src.title} (salinan)`;

  let newId: string;
  try {
    newId = await db.transaction(async (tx) => {
      const [copyRow] = await tx
        .insert(bundles)
        .values({
          title,
          bundleType: src.bundleType,
          origin: src.origin,
          sourceId: src.sourceId,
          eventId: src.eventId,
          year: src.year,
          grade: src.grade,
          durationMinutes: src.durationMinutes ?? 90,
          instructions: src.instructions,
          ...(src.printConfig ? { printConfig: src.printConfig } : {}),
          createdById: actor.id,
        })
        .returning({ id: bundles.id });

      const items = await tx
        .select({
          questionId: bundleItems.questionId,
          role: bundleItems.role,
          orderIndex: bundleItems.orderIndex,
          sectionName: bundleItems.sectionName,
          itemNumber: bundleItems.itemNumber,
          notes: bundleItems.notes,
        })
        .from(bundleItems)
        .where(eq(bundleItems.bundleId, id))
        .orderBy(asc(bundleItems.orderIndex));

      if (items.length > 0) {
        await tx.insert(bundleItems).values(
          items.map((it) => ({
            bundleId: copyRow!.id,
            questionId: it.questionId,
            role: it.role,
            orderIndex: it.orderIndex,
            sectionName: it.sectionName,
            itemNumber: it.itemNumber,
            notes: it.notes,
          })),
        );
      }
      return copyRow!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError(
        `Gagal menduplikasi paket "${title}": terjadi konflik keunikan.`,
      );
    }
    throw err;
  }

  await recordAudit({
    entityType: "bundle",
    entityId: newId,
    action: "create",
    actor,
    changeSummary: `Paket disalin dari ${src.title}: ${title}`,
  });
  return (await getBundle(newId))!;
}
