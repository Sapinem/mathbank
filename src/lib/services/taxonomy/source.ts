/**
 * Sumber (book/website/school) — CRUD + check RESTRICT (L5).
 * Pecahan `taxonomy-service.ts`.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { bundles } from "@/lib/db/schema/bundle";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "../audit";
import type { Actor } from "@/lib/auth/actor";
import { slugify, type SourceKind, type SourceRow } from "./shared";

/** Kolom sumber yang diproyeksikan (hindari duplikasi `.returning`). */
const sourceColumns = {
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
} as const;

export async function listSources(): Promise<SourceRow[]> {
  const rows = await db
    .select({
      ...sourceColumns,
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
        .returning(sourceColumns),
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
        .returning(sourceColumns),
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
