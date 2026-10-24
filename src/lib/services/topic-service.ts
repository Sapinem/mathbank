/**
 * Service taksonomi — TOPIK (L5). Pohon 3-level (Kategori › Topik › SubTopik).
 *
 * Aturan penting:
 * - `level` diturunkan dari induk (induk ada → level+1; tanpa induk → 1).
 * - **Anti-siklus:** induk tak boleh diri sendiri / keturunannya (dicek di sini
 *   karena FK RESTRICT hanya melarang hapus, bukan siklus).
 * - Hapus: RESTRICT FK DB menolak bila masih ada anak / dipakai soal → pesan jelas.
 * - **MAT-131A (Tahap A):** `slug` tidak lagi ditulis. Identitas kanonik = `id`
 *   (UUIDv7); seluruh pencarian/navigasi murni `id` + `parentId`. Baris baru
 *   menyimpan `slug = NULL`; data legacy tetap utuh (nullable, bukan di-drop).
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics } from "@/lib/db/schema/taxonomy";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "./audit";
import type { Actor } from "@/lib/auth/actor";
import { buildTree, type TopicNode, type TopicTree, resolveLevel, isSelfOrDescendant, descendantIds, subtreeMaxDepth, type TreeEdgeWithLevel, TopicParentNotFoundError, TopicMaxDepthError } from "@/lib/taxonomy/tree";

export type { TopicNode, TopicTree };
export { buildTree };

export interface TopicInput {
  name: string;
  parentId?: string | null;
  description?: string | null;
  sortOrder?: number;
}

const COLS = {
  id: topics.id,
  name: topics.name,
  parentId: topics.parentId,
  level: topics.level,
  description: topics.description,
  sortOrder: topics.sortOrder,
  usageCount: topics.usageCount,
  isActive: topics.isActive,
};

/** Daftar datar (untuk filter & pemilih induk). */
export async function listTopics(): Promise<TopicNode[]> {
  return db
    .select(COLS)
    .from(topics)
    .orderBy(asc(topics.level), asc(topics.sortOrder), asc(topics.name));
}

/** Ambil satu topik. */
export async function getTopic(id: string): Promise<TopicNode | null> {
  const [row] = await db.select(COLS).from(topics).where(eq(topics.id, id)).limit(1);
  return row ?? null;
}

/** Snapshot ringkas seluruh topik (id/parent/level) untuk perhitungan in-memory. */
async function topicSnapshot(): Promise<TreeEdgeWithLevel[]> {
  return db
    .select({ id: topics.id, parentId: topics.parentId, level: topics.level })
    .from(topics);
}

/** Buat topik baru. */
export async function createTopic(
  input: TopicInput,
  actor: Actor,
): Promise<TopicNode> {
  assertCan(actor, "taxonomy:manage");
  let level: number;
  try {
    level = resolveLevel(await topicSnapshot(), input.parentId);
  } catch (e) {
    if (e instanceof TopicParentNotFoundError) throw new NotFoundError(e.message);
    if (e instanceof TopicMaxDepthError) throw new ConflictError(e.message);
    throw e;
  }
  const [row] = await withUniqueGuard(
    () =>
      db
        .insert(topics)
        .values({
          name: input.name,
          parentId: input.parentId ?? null,
          level,
          description: input.description ?? null,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning(COLS),
    "Topik dengan nama itu sudah ada.",
  );
  await recordAudit({
    entityType: "topic",
    entityId: row.id,
    action: "create",
    actor,
    changeSummary: `Topik dibuat: ${row.name}`,
  });
  return row;
}

/** Perbarui topik (nama/induk/deskripsi/urutan). */
export async function updateTopic(
  id: string,
  input: Partial<TopicInput>,
  actor: Actor,
): Promise<TopicNode> {
  assertCan(actor, "taxonomy:manage");
  const snapshot = await topicSnapshot();
  const existingRow = snapshot.find((r) => r.id === id);
  if (!existingRow) throw new NotFoundError("Topik tidak ditemukan.");

  const patch: Partial<typeof topics.$inferInsert> = {};
  if (input.name !== undefined) {
    patch.name = input.name;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  if (input.parentId !== undefined) {
    const nextParent = input.parentId ?? null;
    if (nextParent && isSelfOrDescendant(snapshot, id, nextParent)) {
      throw new ConflictError(
        "Tak bisa memindahkan topik ke bawah dirinya sendiri atau keturunannya (siklus).",
      );
    }
    patch.parentId = nextParent;
    let nextLevel: number;
    try {
      nextLevel = resolveLevel(snapshot, nextParent);
    } catch (e) {
      if (e instanceof TopicParentNotFoundError) throw new NotFoundError(e.message);
      if (e instanceof TopicMaxDepthError) throw new ConflictError(e.message);
      throw e;
    }
    patch.level = nextLevel;
    // Kedalaman maksimum SUBTREE yang dipindah harus tetap ≤ 3 setelah bergeser.
    const delta = nextLevel - existingRow.level;
    if (delta !== 0) {
      const maxDepth = subtreeMaxDepth(snapshot, id);
      if (existingRow.level + maxDepth + delta > 3) {
        throw new ConflictError(
          "Pemindahan membuat keturunan melebihi kedalaman 3 level.",
        );
      }
    }
  }

  // **T-M5-2:** bila node dipindah, SELURUH subtree harus ikut bergeser levelnya.
  // Hitung delta & kumpulkan id keturunan dari snapshot (in-memory), lalu tulis
  // atomik: node sendiri + keturunan dalam SATU transaksi.
  const delta =
    patch.level !== undefined ? patch.level - existingRow.level : 0;
  const descendantIdsResolved =
    delta !== 0 ? descendantIds(snapshot, id) : [];

  const [row] = await withUniqueGuard(
    () =>
      db.transaction(async (tx) => {
        const updated = await tx
          .update(topics)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(topics.id, id))
          .returning(COLS);
        if (descendantIdsResolved.length > 0) {
          // level + delta untuk SEMUA keturunan (tetap konsisten dgn induk baru).
          await tx
            .update(topics)
            .set({
              level: sql`${topics.level} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(inArray(topics.id, descendantIdsResolved));
        }
        return updated;
      }),
    "Topik dengan nama itu sudah ada.",
  );
  await recordAudit({
    entityType: "topic",
    entityId: row.id,
    action: "update", // T-M5-1: dulu salah "create"
    actor,
    changeSummary: `Topik diperbarui: ${row.name}${
      delta !== 0 ? ` (subtree ${descendantIdsResolved.length} ikut bergeser ${delta})` : ""
    }`,
  });
  return row;
}

/**
 * Hapus topik. Ditolak bila punya anak atau dipakai soal (RESTRICT) — pesan jelas.
 */
export async function deleteTopic(id: string, actor: Actor): Promise<void> {
  assertCan(actor, "taxonomy:manage");
  const existing = await getTopic(id);
  if (!existing) throw new NotFoundError("Topik tidak ditemukan.");

  const [child] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(eq(topics.parentId, id))
    .limit(1);
  if (child) {
    throw new ConflictError(
      "Topik masih punya sub-topik. Hapus/pindahkan anaknya lebih dulu.",
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`question_topics`)
    .where(sql`topic_id = ${id}`);
  if (count > 0) {
    throw new ConflictError(
      `Topik dipakai oleh ${count} soal. Lepas keterkaitannya lebih dulu.`,
    );
  }

  await db.delete(topics).where(eq(topics.id, id));
  await recordAudit({
    entityType: "topic",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Topik dihapus",
  });
}

/** Cari topik aktif berlevel tertentu (mis. untuk pemilih). */
export async function listTopicsByLevel(level: number): Promise<TopicNode[]> {
  return db
    .select(COLS)
    .from(topics)
    .where(and(eq(topics.level, level), eq(topics.isActive, true)))
    .orderBy(asc(topics.sortOrder), asc(topics.name));
}

/** Topik akar (tanpa induk). */
export async function listRootTopics(): Promise<TopicNode[]> {
  return db
    .select(COLS)
    .from(topics)
    .where(isNull(topics.parentId))
    .orderBy(asc(topics.sortOrder), asc(topics.name));
}
