import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { questions } from "./question";
import { sources } from "./source";
import { events } from "./event";

/**
 * collections — arsip soal publik (ADR-0016).
 *
 * BEDA HAKIKAT dengan `bundles`:
 *
 * | | collections (Koleksi)   | bundles (Naskah)          |
 * |---|---|---|
 * | Hakikat  | Arsip bahan dari sumber | Rakitan kerja guru   |
 * | Pembeda  | source / provenance     | owner (pemilik)      |
 * | Sifat    | Statis (historis)       | Dinamis (living doc) |
 * | Milik    | Institusional (publik)  | Personal (pembuat)   |
 *
 * Karena **publik**, tabel ini **tak punya `created_by_id`** — siapa pun yang
 * punya izin boleh melihat. Bila perlu audit, pakai `audit_logs`.
 *
 * Juga **tak punya** `duration_minutes`/`instructions`/`status` — itu milik
 * naskah yang siap dicetak, bukan arsip.
 */
export const collections = pgTable(
  "collections",
  {
    id: uuidPk(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    /** Penyelenggara/penerbit (mis. "mathcyber", "Erlangga"). */
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    /** Konteks ujian asli (mis. UTBK/OSN/SIMAK) — bila arsip ini peristiwa. */
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    /** Tahun naskah/ajaran. */
    year: smallint("year"),
    /** Jenjang/kelas. */
    grade: varchar("grade", { length: 20 }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("uq_collections_slug").on(t.slug),
    index("idx_collections_source_id").on(t.sourceId),
    index("idx_collections_event_id").on(t.eventId),
  ],
);

/**
 * collection_items — isi koleksi (M:N ke soal).
 *
 * `order_index` hanya untuk **tampilan**, bukan nomor ujian kaku — arsip
 * tidak punya urutan resmi seperti naskah.
 */
export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuidPk(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    // RESTRICT: soal yang masih diarsipkan tak boleh dihapus diam-diam.
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("uq_collection_items_pair").on(t.collectionId, t.questionId),
    index("idx_collection_items_collection").on(t.collectionId),
    index("idx_collection_items_question").on(t.questionId),
  ],
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  source: one(sources, {
    fields: [collections.sourceId],
    references: [sources.id],
  }),
  event: one(events, {
    fields: [collections.eventId],
    references: [events.id],
  }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(
  collectionItems,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionItems.collectionId],
      references: [collections.id],
    }),
    question: one(questions, {
      fields: [collectionItems.questionId],
      references: [questions.id],
    }),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionItem = typeof collectionItems.$inferSelect;
export type NewCollectionItem = typeof collectionItems.$inferInsert;
