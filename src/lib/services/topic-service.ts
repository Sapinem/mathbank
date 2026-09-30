/**
 * Service taksonomi — TOPIK (L5). Pohon 3-level (Kategori › Topik › SubTopik).
 *
 * Aturan penting:
 * - `level` diturunkan dari induk (induk ada → level+1; tanpa induk → 1).
 * - **Anti-siklus:** induk tak boleh diri sendiri / keturunannya (dicek di sini
 *   karena FK RESTRICT hanya melarang hapus, bukan siklus).
 * - Hapus: RESTRICT FK DB menolak bila masih ada anak / dipakai soal → pesan jelas.
 */
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { topics } from "@/lib/db/schema/taxonomy";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "./audit";
import type { Actor } from "@/lib/auth/actor";
import { buildTree, slugify, type TopicNode, type TopicTree } from "@/lib/taxonomy/tree";

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
  slug: topics.slug,
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

/**
 * Level yang benar untuk sebuah induk: tak ada induk → 1; ada → induk.level+1
 * (maks 3). Melempar bila melebihi kedalaman 3.
 *
 * `rows` = snapshot seluruh topik (agar tak query berulang).
 */
function resolveLevelFrom(
  rows: { id: string; parentId: string | null; level: number }[],
  parentId: string | null | undefined,
): number {
  if (!parentId) return 1;
  const parent = rows.find((r) => r.id === parentId);
  if (!parent) throw new NotFoundError("Induk topik tidak ditemukan.");
  const level = parent.level + 1;
  if (level > 3) {
    throw new ConflictError(
      "Kedalaman taksonomi maksimum 3 level (Kategori › Topik › SubTopik).",
    );
  }
  return level;
}

/**
 * Apakah `candidateId` = `nodeId` atau keturunannya? (anti-siklus)
 * Dihitung dari snapshot di memori — tanpa query berulang.
 */
function isSelfOrDescendantFrom(
  rows: { id: string; parentId: string | null }[],
  nodeId: string,
  candidateId: string,
): boolean {
  if (nodeId === candidateId) return true;
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
  let cursor: string | null = candidateId;
  const guard = new Set<string>();
  while (cursor) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    if (cursor === nodeId) return true;
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

/** Kumpulkan id SELURUH keturunan `id` (tak termasuk dirinya) dari snapshot. */
function descendantIdsFrom(
  rows: { id: string; parentId: string | null }[],
  id: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parentId) {
      const arr = childrenOf.get(r.parentId) ?? [];
      arr.push(r.id);
      childrenOf.set(r.parentId, arr);
    }
  }
  const out: string[] = [];
  const stack = [...(childrenOf.get(id) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    stack.push(...(childrenOf.get(cur) ?? []));
  }
  return out;
}

/** Kedalaman maksimum subtree di bawah `id` dari snapshot (0 = tanpa anak). */
function subtreeMaxDepthFrom(
  rows: { id: string; parentId: string | null }[],
  id: string,
): number {
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    if (r.parentId) {
      const arr = childrenOf.get(r.parentId) ?? [];
      arr.push(r.id);
      childrenOf.set(r.parentId, arr);
    }
  }
  const walk = (nodeId: string): number => {
    const kids = childrenOf.get(nodeId) ?? [];
    if (kids.length === 0) return 0;
    return 1 + Math.max(...kids.map(walk));
  };
  return walk(id);
}

/** Snapshot ringan seluruh topik (id/parent/level) untuk perhitungan in-memory. */
async function topicSnapshot(): Promise<
  { id: string; parentId: string | null; level: number }[]
> {
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
  const level = resolveLevelFrom(await topicSnapshot(), input.parentId);
  const [row] = await withUniqueGuard(
    () =>
      db
        .insert(topics)
        .values({
          name: input.name,
          slug: slugify(input.name),
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
    patch.slug = slugify(input.name);
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  if (input.parentId !== undefined) {
    const nextParent = input.parentId ?? null;
    if (nextParent && isSelfOrDescendantFrom(snapshot, id, nextParent)) {
      throw new ConflictError(
        "Tak bisa memindahkan topik ke bawah dirinya sendiri atau keturunannya (siklus).",
      );
    }
    patch.parentId = nextParent;
    const nextLevel = resolveLevelFrom(snapshot, nextParent);
    patch.level = nextLevel;
    // Kedalaman maksimum SUBTREE yang dipindah harus tetap ≤ 3 setelah bergeser.
    const delta = nextLevel - existingRow.level;
    if (delta !== 0) {
      const maxDepth = subtreeMaxDepthFrom(snapshot, id);
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
  const descendantIds =
    delta !== 0 ? descendantIdsFrom(snapshot, id) : [];

  const [row] = await withUniqueGuard(
    () =>
      db.transaction(async (tx) => {
        const updated = await tx
          .update(topics)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(topics.id, id))
          .returning(COLS);
        if (descendantIds.length > 0) {
          // level + delta untuk SEMUA keturunan (tetap konsisten dgn induk baru).
          await tx
            .update(topics)
            .set({
              level: sql`${topics.level} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(inArray(topics.id, descendantIds));
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
      delta !== 0 ? ` (subtree ${descendantIds.length} ikut bergeser ${delta})` : ""
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
