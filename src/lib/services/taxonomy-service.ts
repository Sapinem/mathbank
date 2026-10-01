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
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { events } from "@/lib/db/schema/event";
import { bundles } from "@/lib/db/schema/bundle";
import { tags, grades, questionTags } from "@/lib/db/schema/taxonomy";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "./audit";
import type { Actor } from "@/lib/auth/actor";
import { slugify } from "@/lib/taxonomy/tree";

export type SourceKind = "book" | "website" | "school";

export interface SourceRow {
  id: string;
  kind: SourceKind;
  label: string;
  slug: string;
  url: string | null;
  /** Khusus `kind='book'`. */
  publisher: string | null;
  author: string | null;
  bookYear: number | null;
  /** Khusus `kind='school'`. */
  city: string | null;
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

export interface GradeRow {
  id: string;
  label: string;
  levelGroup: string | null;
  curriculumPhase: string | null;
  orderIndex: number;
}

// ── Grade (jenjang/kelas) ─────────────────────────────────────

/**
 * Daftar jenjang/kelas aktif (referensi baca-saja) — sumber tunggal untuk
 * editor & filter. Format selaras QBank (`curriculum.yaml`): `id` = nomor kelas
 * / kode ("1".."12", "11w", "utbk", "umum"), `label` = "Kelas N SD/SMP/SMA".
 */
export async function listGrades(): Promise<GradeRow[]> {
  const rows = await db
    .select({
      id: grades.id,
      label: grades.label,
      levelGroup: grades.levelGroup,
      curriculumPhase: grades.curriculumPhase,
      orderIndex: grades.orderIndex,
    })
    .from(grades)
    .where(eq(grades.isActive, true))
    .orderBy(asc(grades.orderIndex), asc(grades.id));
  return rows;
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
      publisher: sources.publisher,
      author: sources.author,
      bookYear: sources.bookYear,
      city: sources.city,
      isActive: sources.isActive,
      // ADR-0014: soal tak punya source_id — dihitung lewat bundle.
      // Kualifikasi `"sources"."id"` WAJIB: subquery punya alias b/bi/q yang
      // juga berkolom `id`, jadi `${sources.id}` (yang jadi `"id"`) ambigu.
      questionCount: sql<number>`(
        SELECT count(DISTINCT bi.question_id)::int
        FROM bundles b
        JOIN bundle_items bi ON bi.bundle_id = b.id
        JOIN questions q ON q.id = bi.question_id
        WHERE b.source_id = "sources"."id" AND q.deleted_at IS NULL
          AND b.deleted_at IS NULL
      )`,
    })
    .from(sources)
    .orderBy(asc(sources.kind), asc(sources.label));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as SourceKind,
    label: r.label,
    slug: r.slug,
    url: r.url,
    publisher: r.publisher,
    author: r.author,
    bookYear: r.bookYear,
    city: r.city,
    isActive: r.isActive,
    usageCount: r.questionCount,
  }));
}

export async function createSource(
  input: {
    kind: SourceKind;
    label: string;
    url?: string | null;
    publisher?: string | null;
    author?: string | null;
    bookYear?: number | null;
    city?: string | null;
  },
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
          publisher: input.publisher ?? null,
          author: input.author ?? null,
          bookYear: input.bookYear ?? null,
          city: input.city ?? null,
        })
        .returning({
          id: sources.id,
          kind: sources.kind,
          label: sources.label,
          slug: sources.slug,
          url: sources.url,
          publisher: sources.publisher,
          author: sources.author,
          bookYear: sources.bookYear,
          city: sources.city,
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
  input: {
    kind?: SourceKind;
    label?: string;
    url?: string | null;
    publisher?: string | null;
    author?: string | null;
    bookYear?: number | null;
    city?: string | null;
  },
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
  if (input.publisher !== undefined) patch.publisher = input.publisher;
  if (input.author !== undefined) patch.author = input.author;
  if (input.bookYear !== undefined) patch.bookYear = input.bookYear;
  if (input.city !== undefined) patch.city = input.city;
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
          publisher: sources.publisher,
          author: sources.author,
          bookYear: sources.bookYear,
          city: sources.city,
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
  // ADR-0014: keberadaan sumber dicek lewat bundle (soal tak punya source_id).
  // Bila sumber dipakai, FK `bundles.source_id` hanya `set null` — jadi tanpa
  // penjagaan ini, menghapus sumber akan melepas naskah dari asalnya.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bundles)
    .where(and(eq(bundles.sourceId, id), isNull(bundles.deletedAt)));
  if (count > 0) {
    throw new ConflictError(`Sumber dipakai oleh ${count} naskah. Lepas keterkaitannya dulu.`);
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
