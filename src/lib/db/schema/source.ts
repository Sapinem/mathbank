import { uuidPk } from "./_columns";
import {
  pgTable,
  varchar,
  text,
  smallint,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sourceKindEnum } from "./_enums";

/**
 * sources — master sumber soal (ADR-0015).
 *
 * Satu tabel untuk semua jenis sumber; kolom spesifik-jenis dibiarkan **NULL**
 * untuk jenis lain. Pola ini sudah dipakai sejak awal (`url` hanya untuk
 * `website`) — ADR-0015 sekadar memperluasnya, menggantikan tabel anak
 * `books`/`institutions` yang relasinya 1-ke-1 (jadi tak memberi manfaat).
 *
 * Pengisian per jenis:
 *   book    → label, publisher, author, book_year
 *   school  → label, city
 *   website → label, url
 */
export const sources = pgTable(
  "sources",
  {
    id: uuidPk(),
    kind: sourceKindEnum("kind").notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    url: text("url"), // khusus kind='website'
    // ── Khusus kind='book' (dulu tabel `books`) ──
    publisher: varchar("publisher", { length: 255 }),
    author: varchar("author", { length: 255 }),
    bookYear: smallint("book_year"),
    // ── Khusus kind='school' (dulu tabel `institutions`) ──
    city: varchar("city", { length: 100 }),
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
    index("idx_sources_city").on(t.city),
  ],
);

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
