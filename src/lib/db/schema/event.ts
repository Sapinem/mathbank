import { uuidPk, versionColumn } from "./_columns";
import {
  pgTable,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * events — peristiwa ujian nyata (UTBK / OSN / SBMPTN).
 * UTS/PAS BUKAN event → itu Bundle.
 */
export const events = pgTable(
  "events",
  {
    id: uuidPk(),
    name: varchar("name", { length: 150 }).notNull(),
    shortname: varchar("shortname", { length: 50 }).notNull(),
    fullname: varchar("fullname", { length: 255 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(), // 'utbk' | 'osn' | 'sbmptn'
    subtests: jsonb("subtests").$type<string[]>().default([]).notNull(),
    aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
    colorToken: varchar("color_token", { length: 50 })
      .default("event-default")
      .notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    version: versionColumn(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("uq_events_code").on(t.code),
    index("idx_events_category").on(t.category),
    index("idx_events_is_active").on(t.isActive),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;