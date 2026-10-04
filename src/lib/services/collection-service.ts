/**
 * Service koleksi (L5) — ADR-0016.
 *
 * `collections` = **arsip soal publik** (statis, institusional). Beda hakikat
 * dari `bundles` (naskah kerja guru: dinamis, personal).
 *
 * Invarian penting:
 *  - **Tak ada izin `own`** — arsip bersifat publik. Semua peran bergantung
 *    pada permission `collection:view` / `collection:manage`, yang **bisa**
 *    dipasang di gerbang route (CONSTRAINTS #35 hanya mengikat izin `own`).
 *  - Soal yang ada di koleksi **tak bisa dihapus** (RESTRICT di
 *    `collection_items.question_id`).
 *  - Idempoten: menambah soal yang sudah ada → tak menggandakan
 *    (UNIQUE `collection_id` + `question_id`).
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, collectionItems } from "@/lib/db/schema/collection";
import { questions } from "@/lib/db/schema/question";
import { sources } from "@/lib/db/schema/source";
import { events } from "@/lib/db/schema/event";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import type { Actor } from "@/lib/auth/actor";
import { slugify } from "@/lib/taxonomy/tree";
import { recordAudit } from "./audit";

export interface CollectionRow {
  id: string;
  title: string;
  slug: string;
  sourceId: string | null;
  sourceLabel: string | null;
  eventId: string | null;
  eventName: string | null;
  year: number | null;
  grade: string | null;
  description: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionItemRow {
  id: string;
  collectionId: string;
  questionId: string;
  orderIndex: number;
  createdAt: Date;
}

export interface CollectionInput {
  title: string;
  sourceId?: string | null;
  eventId?: string | null;
  year?: number | null;
  grade?: string | null;
  description?: string | null;
}

const COUNT_COL = sql<number>`(
  SELECT count(*)::int FROM collection_items ci WHERE ci.collection_id = "collections"."id"
)`;

/** Daftar koleksi (publik) — dengan jumlah soal & label sumber/event. */
export async function listCollections(): Promise<CollectionRow[]> {
  const rows = await db
    .select({
      id: collections.id,
      title: collections.title,
      slug: collections.slug,
      sourceId: collections.sourceId,
      sourceLabel: sources.label,
      eventId: collections.eventId,
      eventName: events.name,
      year: collections.year,
      grade: collections.grade,
      description: collections.description,
      itemCount: COUNT_COL,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collections)
    .leftJoin(sources, eq(sources.id, collections.sourceId))
    .leftJoin(events, eq(events.id, collections.eventId))
    .orderBy(desc(collections.updatedAt));

  return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) }));
}

/** Satu koleksi + id soalnya (untuk editor). */
export async function getCollection(
  id: string,
): Promise<(CollectionRow & { questionIds: string[] }) | null> {
  const [row] = await db
    .select({
      id: collections.id,
      title: collections.title,
      slug: collections.slug,
      sourceId: collections.sourceId,
      sourceLabel: sources.label,
      eventId: collections.eventId,
      eventName: events.name,
      year: collections.year,
      grade: collections.grade,
      description: collections.description,
      itemCount: COUNT_COL,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collections)
    .leftJoin(sources, eq(sources.id, collections.sourceId))
    .leftJoin(events, eq(events.id, collections.eventId))
    .where(eq(collections.id, id))
    .limit(1);

  if (!row) return null;

  const items = await db
    .select({ questionId: collectionItems.questionId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, id))
    .orderBy(asc(collectionItems.orderIndex));

  return {
    ...row,
    itemCount: Number(row.itemCount),
    questionIds: items.map((i) => i.questionId),
  };
}

/** Buat koleksi. `collection:manage` = publik, jadi tak ada cek owner. */
export async function createCollection(
  input: CollectionInput,
  actor: Actor,
): Promise<CollectionRow> {
  assertCan(actor, "collection:manage");

  const [row] = await db
    .insert(collections)
    .values({
      title: input.title.trim().slice(0, 255),
      slug: slugify(input.title, 255),
      sourceId: input.sourceId ?? null,
      eventId: input.eventId ?? null,
      year: input.year ?? null,
      grade: input.grade ?? null,
      description: input.description ?? null,
    })
    .returning({ id: collections.id });

  await recordAudit({
    entityType: "collection",
    entityId: row!.id,
    action: "create",
    actor,
    changeSummary: `Koleksi dibuat: ${input.title}`,
  });

  const created = await getCollection(row!.id);
  return created!;
}

/** Ubah metadata koleksi. */
export async function updateCollection(
  id: string,
  input: Partial<CollectionInput>,
  actor: Actor,
): Promise<CollectionRow> {
  assertCan(actor, "collection:manage");

  const patch: Partial<typeof collections.$inferInsert> = {};
  if (input.title !== undefined) {
    patch.title = input.title.trim().slice(0, 255);
    patch.slug = slugify(input.title, 255);
  }
  if (input.sourceId !== undefined) patch.sourceId = input.sourceId;
  if (input.eventId !== undefined) patch.eventId = input.eventId;
  if (input.year !== undefined) patch.year = input.year;
  if (input.grade !== undefined) patch.grade = input.grade;
  if (input.description !== undefined) patch.description = input.description;

  const res = await db
    .update(collections)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(collections.id, id))
    .returning({ id: collections.id });
  if (res.length === 0) throw new NotFoundError("Koleksi tidak ditemukan.");

  await recordAudit({
    entityType: "collection",
    entityId: id,
    action: "update",
    actor,
    changeSummary: "Koleksi diperbarui",
  });

  const updated = await getCollection(id);
  return updated!;
}

/** Hapus koleksi (isinya CASCADE; soalnya TIDAK terhapus). */
export async function deleteCollection(id: string, actor: Actor): Promise<void> {
  assertCan(actor, "collection:manage");

  const res = await db
    .delete(collections)
    .where(eq(collections.id, id))
    .returning({ id: collections.id });
  if (res.length === 0) throw new NotFoundError("Koleksi tidak ditemukan.");

  await recordAudit({
    entityType: "collection",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Koleksi dihapus",
  });
}

/** Masukkan soal ke koleksi (idempoten). */
export async function addCollectionItem(
  collectionId: string,
  questionId: string,
  actor: Actor,
): Promise<CollectionItemRow> {
  assertCan(actor, "collection:manage");

  const [exists] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  if (!exists) throw new NotFoundError("Koleksi tidak ditemukan.");

  const [q] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!q) throw new NotFoundError("Soal tidak ditemukan.");

  // Idempoten: sudah ada → kembalikan baris yang ada (tak menggandakan).
  const [already] = await db
    .select()
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.questionId, questionId),
      ),
    )
    .limit(1);
  if (already) return already;

  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${collectionItems.orderIndex}), 0)` })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));

  const [row] = await db
    .insert(collectionItems)
    .values({ collectionId, questionId, orderIndex: Number(max) + 1 })
    .returning();

  return row!;
}

/** Keluarkan soal dari koleksi. */
export async function removeCollectionItem(
  collectionId: string,
  questionId: string,
  actor: Actor,
): Promise<void> {
  assertCan(actor, "collection:manage");
  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.questionId, questionId),
      ),
    );
}

/** Susun ulang urutan (tampilan saja). */
export async function reorderCollectionItems(
  collectionId: string,
  questionIds: string[],
  actor: Actor,
): Promise<void> {
  assertCan(actor, "collection:manage");

  const existing = await db
    .select({ questionId: collectionItems.questionId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));
  const allowed = new Set(existing.map((e) => e.questionId));
  const target = questionIds.filter((q) => allowed.has(q));
  if (target.length !== existing.length) {
    throw new ConflictError(
      `Daftar urutan tak cocok dengan isi koleksi (${target.length} vs ${existing.length}).`,
    );
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < target.length; i++) {
      await tx
        .update(collectionItems)
        .set({ orderIndex: i + 1 })
        .where(
          and(
            eq(collectionItems.collectionId, collectionId),
            eq(collectionItems.questionId, target[i]!),
          ),
        );
    }
  });
}

/** Koleksi yang memuat soal tertentu (kebalikan pencarian). */
export async function listCollectionsOfQuestion(
  questionId: string,
): Promise<CollectionRow[]> {
  const rows = await db
    .select({
      id: collections.id,
      title: collections.title,
      slug: collections.slug,
      sourceId: collections.sourceId,
      sourceLabel: sources.label,
      eventId: collections.eventId,
      eventName: events.name,
      year: collections.year,
      grade: collections.grade,
      description: collections.description,
      itemCount: COUNT_COL,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
    })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .leftJoin(sources, eq(sources.id, collections.sourceId))
    .leftJoin(events, eq(events.id, collections.eventId))
    .where(eq(collectionItems.questionId, questionId))
    .orderBy(asc(collections.title));

  return rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) }));
}

/** Koleksi yang memuat sekumpulan soal (untuk filter daftar soal). */
export async function listQuestionIdsInCollection(collectionId: string): Promise<string[]> {
  const rows = await db
    .select({ questionId: collectionItems.questionId })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(asc(collectionItems.orderIndex));
  return rows.map((r) => r.questionId);
}

/** Dipakai bila kelak perlu memasukkan banyak soal sekaligus. */
export async function addCollectionItems(
  collectionId: string,
  questionIds: string[],
  actor: Actor,
): Promise<number> {
  assertCan(actor, "collection:manage");
  let added = 0;
  for (const qid of inArraySafe(questionIds)) {
    await addCollectionItem(collectionId, qid, actor);
    added++;
  }
  return added;
}

/** Buang duplikat + nilai kosong. */
function inArraySafe(ids: string[]): string[] {
  return [...new Set(ids.filter((x) => typeof x === "string" && x.length > 0))];
}

/** Apakah sebuah soal dipakai di dalam koleksi publik (ADR-0016 / RESTRICT)? */
export async function isQuestionUsedInCollections(
  questionId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: collectionItems.id })
    .from(collectionItems)
    .where(eq(collectionItems.questionId, questionId))
    .limit(1);
  return Boolean(row);
}


