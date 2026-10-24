/**
 * Sumber (book/website/school) — CRUD + check RESTRICT (L5).
 * Pecahan `taxonomy-service.ts`.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { and, asc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema/source";
import { bundles, bundleItems } from "@/lib/db/schema/bundle";
import { questions } from "@/lib/db/schema/question";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "../audit";
import type { Actor } from "@/lib/auth/actor";
import { type SourceKind, type SourceRow } from "./shared";

/** Kolom sumber yang diproyeksikan (hindari duplikasi `.returning`). */
const sourceColumns = {
  id: sources.id,
  kind: sources.kind,
  label: sources.label,
  url: sources.url,
  publisher: sources.publisher,
  author: sources.author,
  bookYear: sources.bookYear,
  city: sources.city,
  isActive: sources.isActive,
} as const;

export async function listSources(): Promise<SourceRow[]> {
  // Set-based aggregation subquery menggantikan correlated subquery per-baris (PERF)
  const countsSubquery = db
    .select({
      sourceId: bundles.sourceId,
      count: sql<number>`count(DISTINCT ${bundleItems.questionId})::int`.as("count"),
    })
    .from(bundles)
    .innerJoin(bundleItems, eq(bundleItems.bundleId, bundles.id))
    .innerJoin(questions, and(eq(questions.id, bundleItems.questionId), isNull(questions.deletedAt)))
    .where(and(isNotNull(bundles.sourceId), isNull(bundles.deletedAt)))
    .groupBy(bundles.sourceId)
    .as("counts");

  const rows = await db
    .select({
      ...sourceColumns,
      questionCount: sql<number>`COALESCE(${countsSubquery.count}, 0)::int`,
    })
    .from(sources)
    .leftJoin(countsSubquery, eq(countsSubquery.sourceId, sources.id))
    .orderBy(asc(sources.kind), asc(sources.label));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as SourceKind,
    label: r.label,
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
