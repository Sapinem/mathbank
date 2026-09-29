import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sourceKindEnum } from "./_enums";

/**
 * sources — induk sumber soal (pola B).
 * Anak: `books` (kind=book), `institutions` (kind=school).
 * Web cukup kolom `url` di sini.
 */
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: sourceKindEnum("kind").notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    url: text("url"), // khusus kind='website'
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("uq_sources_slug").on(t.slug),
    index("idx_sources_kind").on(t.kind),
    index("idx_sources_is_active").on(t.isActive),
  ],
);

/** books — atribut buku (anak sources, kind='book'). */
export const books = pgTable(
  "books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    isbn: varchar("isbn", { length: 20 }),
    publisher: varchar("publisher", { length: 255 }),
    author: varchar("author", { length: 255 }),
    year: smallint("year"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("uq_books_source").on(t.sourceId)],
);

/** institutions — atribut sekolah (anak sources, kind='school'). Dulu `schools`. */
export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    npsn: varchar("npsn", { length: 20 }),
    level: varchar("level", { length: 20 }), // 'SMA' | 'SMP' | 'SD'
    city: varchar("city", { length: 100 }),
    province: varchar("province", { length: 100 }),
    address: text("address"),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("uq_institutions_source").on(t.sourceId),
    index("idx_institutions_city").on(t.city),
    index("idx_institutions_npsn").on(t.npsn),
  ],
);

export const sourcesRelations = relations(sources, ({ one }) => ({
  book: one(books),
  institution: one(institutions),
}));

export const booksRelations = relations(books, ({ one }) => ({
  source: one(sources, {
    fields: [books.sourceId],
    references: [sources.id],
  }),
}));

export const institutionsRelations = relations(institutions, ({ one }) => ({
  source: one(sources, {
    fields: [institutions.sourceId],
    references: [sources.id],
  }),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Book = typeof books.$inferSelect;
export type Institution = typeof institutions.$inferSelect;
