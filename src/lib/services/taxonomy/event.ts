/**
 * Event (peristiwa ujian) — CRUD + check RESTRICT (L5).
 * Pecahan `taxonomy-service.ts`.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema/event";
import { assertCan, NotFoundError, ConflictError } from "@/lib/auth/guards";
import { withUniqueGuard } from "@/lib/db/errors";
import { recordAudit } from "../audit";
import type { Actor } from "@/lib/auth/actor";
import { slugify, type EventInput, type EventRow } from "./shared";

/** Kolom event yang diproyeksikan. */
const eventColumns = {
  id: events.id,
  name: events.name,
  shortname: events.shortname,
  category: events.category,
  subtests: events.subtests,
  aliases: events.aliases,
  isActive: events.isActive,
} as const;

export async function listEvents(): Promise<EventRow[]> {
  return db
    .select(eventColumns)
    .from(events)
    .orderBy(asc(events.category), asc(events.name));
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
        .returning(eventColumns),
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
    .returning(eventColumns);
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
