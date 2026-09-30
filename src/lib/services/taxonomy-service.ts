/**
 * Service taksonomi — SUMBER, EVENT, TAG (L5).
 *
 * Tiga entitas referensi sederhana (tanpa hierarki pohon). Pola sama:
 * list / create / update / delete, dengan check RESTRICT (tak bisa hapus
 * entitas yang dipakai soal) & pesan jelas.
 *
 * ⚠️ Logika murni (slugify) di `@/lib/taxonomy/tree` — JANGAN impor file ini
 * dari komponen klien (menarik `@/lib/db`).
 */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources, institutions } from "@/lib/db/schema/source";
import { events } from "@/lib/db/schema/event";
import { tags } from "@/lib/db/schema/taxonomy";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "./audit";
import type { Actor } from "@/lib/auth/actor";
import { slugify } from "@/lib/taxonomy/tree";

export type SourceKind = "book" | "website" | "school" | "competition";

export interface SourceRow {
  id: string;
  kind: SourceKind;
  label: string;
  slug: string;
  url: string | null;
  isActive: boolean;
  usageCount: number;
}

export interface EventRow {
  id: string;
  name: string;
  shortname: string;
  category: string;
  subtests: string[];
  aliases: string[];
  isActive: boolean;
}

export interface TagRow {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
}

// ── Sumber ────────────────────────────────────────────────────

export async function listSources(): Promise<SourceRow[]> {
  const rows = await db
    .select({
      id: sources.id,
      kind: sources.kind,
      label: sources.label,
      slug: sources.slug,
      url: sources.url,
      isActive: sources.isActive,
      institutionUsage: institutions.usageCount,
      questionCount: sql<number>`(
        SELECT count(*)::int FROM questions q
        WHERE q.source_id = ${sources.id} AND q.deleted_at IS NULL
      )`,
    })
    .from(sources)
    .leftJoin(institutions, eq(institutions.sourceId, sources.id))
    .orderBy(asc(sources.kind), asc(sources.label));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as SourceKind,
    label: r.label,
    slug: r.slug,
    url: r.url,
    isActive: r.isActive,
    usageCount: Math.max(r.institutionUsage ?? 0, r.questionCount),
  }));
}

export async function createSource(
  input: { kind: SourceKind; label: string; url?: string | null },
  actor: Actor,
): Promise<SourceRow> {
  assertCan(actor, "reference:manage");
  const [row] = await withUniqueGuard(
    () =>
      db
        .insert(sources)
        .values({
          kind: input.kind,
          label: input.label,
          slug: slugify(input.label),
          url: input.url ?? null,
        })
        .returning({
          id: sources.id,
          kind: sources.kind,
          label: sources.label,
          slug: sources.slug,
          url: sources.url,
          isActive: sources.isActive,
        }),
    "Sumber dengan nama itu sudah ada.",
  );
  await recordAudit({
    entityType: "source",
    entityId: row.id,
    action: "create",
    actor,
    changeSummary: `Sumber dibuat: ${row.label}`,
  });
  return { ...row, kind: row.kind as SourceKind, usageCount: 0 };
}

export async function updateSource(
  id: string,
  input: { kind?: SourceKind; label?: string; url?: string | null },
  actor: Actor,
): Promise<SourceRow> {
  assertCan(actor, "reference:manage");
  const patch: Partial<typeof sources.$inferInsert> = {};
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.label !== undefined) {
    patch.label = input.label;
    patch.slug = slugify(input.label);
  }
  if (input.url !== undefined) patch.url = input.url;
  const [row] = await withUniqueGuard(
    () =>
      db
        .update(sources)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(sources.id, id))
        .returning({
          id: sources.id,
          kind: sources.kind,
          label: sources.label,
          slug: sources.slug,
          url: sources.url,
          isActive: sources.isActive,
        }),
    "Sumber dengan nama itu sudah ada.",
  );
  if (!row) throw new NotFoundError("Sumber tidak ditemukan.");
  await recordAudit({
    entityType: "source",
    entityId: row.id,
    action: "update",
    actor,
    changeSummary: `Sumber diperbarui: ${row.label}`,
  });
  return { ...row, kind: row.kind as SourceKind, usageCount: 0 };
}

export async function deleteSource(id: string, actor: Actor): Promise<void> {
  assertCan(actor, "reference:manage");
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`questions`)
    .where(sql`source_id = ${id} AND deleted_at IS NULL`);
  if (count > 0) {
    throw new ConflictError(`Sumber dipakai oleh ${count} soal. Lepas keterkaitannya dulu.`);
  }
  const res = await db.delete(sources).where(eq(sources.id, id)).returning({ id: sources.id });
  if (res.length === 0) throw new NotFoundError("Sumber tidak ditemukan.");
  await recordAudit({
    entityType: "source",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Sumber dihapus",
  });
}

// ── Event ─────────────────────────────────────────────────────

export async function listEvents(): Promise<EventRow[]> {
  return db
    .select({
      id: events.id,
      name: events.name,
      shortname: events.shortname,
      category: events.category,
      subtests: events.subtests,
      aliases: events.aliases,
      isActive: events.isActive,
    })
    .from(events)
    .orderBy(asc(events.category), asc(events.name));
}

export interface EventInput {
  name: string;
  shortname: string;
  category: string;
  subtests?: string[];
  aliases?: string[];
}

export async function createEvent(
  input: EventInput,
  actor: Actor,
): Promise<EventRow> {
  assertCan(actor, "reference:manage");
  const code = slugify(`${input.category}-${input.shortname}`, 50);
  const [row] = await withUniqueGuard(
    () =>
      db
        .insert(events)
        .values({
          name: input.name,
          shortname: input.shortname,
          fullname: input.name,
          code,
          category: input.category,
          subtests: input.subtests ?? [],
          aliases: input.aliases ?? [],
        })
        .returning({
          id: events.id,
          name: events.name,
          shortname: events.shortname,
          category: events.category,
          subtests: events.subtests,
          aliases: events.aliases,
          isActive: events.isActive,
        }),
    "Event dengan singkatan/kategori itu sudah ada.",
  );
  await recordAudit({
    entityType: "event",
    entityId: row.id,
    action: "create",
    actor,
    changeSummary: `Event dibuat: ${row.name}`,
  });
  return row;
}

export async function updateEvent(
  id: string,
  input: Partial<EventInput>,
  actor: Actor,
): Promise<EventRow> {
  assertCan(actor, "reference:manage");
  const patch: Partial<typeof events.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.shortname !== undefined) patch.shortname = input.shortname;
  if (input.category !== undefined) patch.category = input.category;
  if (input.subtests !== undefined) patch.subtests = input.subtests;
  if (input.aliases !== undefined) patch.aliases = input.aliases;
  const [row] = await db
    .update(events)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning({
      id: events.id,
      name: events.name,
      shortname: events.shortname,
      category: events.category,
      subtests: events.subtests,
      aliases: events.aliases,
      isActive: events.isActive,
    });
  if (!row) throw new NotFoundError("Event tidak ditemukan.");
  await recordAudit({
    entityType: "event",
    entityId: row.id,
    action: "update",
    actor,
    changeSummary: `Event diperbarui: ${row.name}`,
  });
  return row;
}

export async function deleteEvent(id: string, actor: Actor): Promise<void> {
  assertCan(actor, "reference:manage");
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sql`questions`)
    .where(sql`event_id = ${id} AND deleted_at IS NULL`);
  if (count > 0) {
    throw new ConflictError(`Event dipakai oleh ${count} soal. Lepas keterkaitannya dulu.`);
  }
  const res = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
  if (res.length === 0) throw new NotFoundError("Event tidak ditemukan.");
  await recordAudit({
    entityType: "event",
    entityId: id,
    action: "delete",
    actor,
    changeSummary: "Event dihapus",
  });
}

// ── Tag / Label ───────────────────────────────────────────────

export async function listTags(): Promise<TagRow[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      usageCount: sql<number>`(
        SELECT count(*)::int FROM question_tags qt
        JOIN questions q ON q.id = qt.question_id
        WHERE qt.tag_id = ${tags.id} AND q.deleted_at IS NULL
      )`,
    })
    .from(tags)
    .orderBy(asc(tags.name));
  return rows.map((r) => ({ ...r, usageCount: r.usageCount ?? 0 }));
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
        .returning({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          usageCount: tags.usageCount,
        }),
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
        .returning({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
          usageCount: tags.usageCount,
        }),
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
