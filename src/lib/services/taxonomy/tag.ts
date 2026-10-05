/**
 * Tag/Label — CRUD, bersih-bersih, & gabung sinonim (L5).
 * Pecahan `taxonomy-service.ts`.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tags, questionTags } from "@/lib/db/schema/taxonomy";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "../audit";
import type { Actor } from "@/lib/auth/actor";
import { slugify, type TagRow } from "./shared";

/** Kolom tag yang diproyeksikan. */
const tagColumns = {
  id: tags.id,
  name: tags.name,
  slug: tags.slug,
  usageCount: tags.usageCount,
} as const;

/**
 * Daftar label + jumlah pemakaian.
 *
 * **PERF-04:** memakai kolom denormalisasi `tags.usage_count` (dijaga trigger DB
 * `trg_question_tags_usage`) — satu pemindaian tabel, bukan subquery berkorelasi
 * per-baris (O(N) → O(1) per baris). Cermin pola `cleanUnusedTags` di bawah.
 */
export async function listTags(): Promise<TagRow[]> {
  return db.select(tagColumns).from(tags).orderBy(asc(tags.name));
}

export async function createTag(
  input: { name: string },
  actor: Actor,
): Promise<TagRow> {
  assertCan(actor, "taxonomy:manage");
  const [row] = await withUniqueGuard(
    () =>
      db
        .insert(tags)
        .values({ name: input.name, slug: slugify(input.name, 100) })
        .returning(tagColumns),
    "Nama label sudah dipakai.",
  );
  await recordAudit({
    entityType: "tag",
    entityId: row.id,
    action: "create",
    actor,
    changeSummary: `Label dibuat: ${row.name}`,
  });
  return row;
}

export async function updateTag(
  id: string,
  input: { name: string },
  actor: Actor,
): Promise<TagRow> {
  assertCan(actor, "taxonomy:manage");
  const [row] = await withUniqueGuard(
    () =>
      db
        .update(tags)
        .set({ name: input.name, slug: slugify(input.name, 100), updatedAt: new Date() })
        .where(eq(tags.id, id))
        .returning(tagColumns),
    "Nama label sudah dipakai.",
  );
  if (!row) throw new NotFoundError("Label tidak ditemukan.");
  await recordAudit({
    entityType: "tag",
    entityId: row.id,
    action: "update",
    actor,
    changeSummary: `Label diperbarui: ${row.name}`,
  });
  return row;
}

export async function deleteTag(id: string, actor: Actor): Promise<void> {
  assertCan(actor, "taxonomy:manage");
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`question_tags`)
    .where(sql`tag_id = ${id}`);
  if (count > 0) {
    throw new ConflictError(`Label dipakai oleh ${count} soal. Lepas keterkaitannya dulu.`);
  }
  const res = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
  if (res.length === 0) throw new NotFoundError("Label tidak ditemukan.");
  await recordAudit({
    entityType: "tag",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Label dihapus",
  });
}

/**
 * **T-M5-3:** Hapus SEMUA label tak terpakai (`usage_count = 0`) sekaligus.
 * Aman: hanya menyentuh tag tanpa relasi soal (usage_count dijaga trigger DB).
 * Mengembalikan jumlah yang dihapus + mendaftarkan satu entri audit ringkas.
 */
export async function cleanUnusedTags(actor: Actor): Promise<number> {
  assertCan(actor, "taxonomy:manage");
  const removed = await db
    .delete(tags)
    .where(eq(tags.usageCount, 0))
    .returning({ id: tags.id });
  if (removed.length > 0) {
    await recordAudit({
      entityType: "tag",
      entityId: "bulk",
      action: "delete",
      actor,
      changeSummary: `Bersihkan ${removed.length} label tak terpakai`,
    });
  }
  return removed.length;
}

/**
 * Gabungkan label sinonim (G3.3) — **atomik** dalam satu transaksi.
 *
 * Semua soal yang memakai `sourceId` dipindah ke `targetId`; relasi yang sudah
 * ada di target dilewati (`ON CONFLICT DO NOTHING` — PK gabungan
 * `(question_id, tag_id)`), lalu label sumber dihapus. `usage_count` dijaga
 * trigger DB (soal sudah dihitung ulang saat baris `question_tags` berubah).
 *
 * Mengembalikan jumlah soal yang benar-benar dipindahkan.
 */
export async function mergeTags(
  sourceId: string,
  targetId: string,
  actor: Actor,
): Promise<number> {
  assertCan(actor, "taxonomy:manage");
  if (sourceId === targetId) {
    throw new ConflictError("Label sumber dan tujuan tidak boleh sama.");
  }

  return db.transaction(async (tx) => {
    const [src] = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.id, sourceId));
    const [dst] = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(eq(tags.id, targetId));
    if (!src) throw new NotFoundError("Label sumber tidak ditemukan.");
    if (!dst) throw new NotFoundError("Label tujuan tidak ditemukan.");

    // Pindahkan relasi soal dari sumber → tujuan (lewati yang sudah ada).
    // Raw SQL: lebih jelas & aman dari pencocokan kolom `insert...select` drizzle.
    const movedRows = await tx.execute(sql`
      INSERT INTO question_tags (question_id, tag_id, created_at)
      SELECT question_id, ${targetId}::uuid, now()
      FROM question_tags
      WHERE tag_id = ${sourceId}::uuid
        AND question_id NOT IN (
          SELECT question_id FROM question_tags WHERE tag_id = ${targetId}::uuid
        )
      RETURNING question_id
    `);

    // Hapus sisa relasi sumber (yang sudah ada di target pun dibuang), lalu tag.
    await tx.delete(questionTags).where(eq(questionTags.tagId, sourceId));
    await tx.delete(tags).where(eq(tags.id, sourceId));

    const movedCount = movedRows.length;

    await recordAudit({
      entityType: "tag",
      entityId: targetId,
      action: "update",
      actor,
      changeSummary: `Gabungkan label "${src.name}" → "${dst.name}" (${movedCount} soal dipindah)`,
    });

    return movedCount;
  });
}
