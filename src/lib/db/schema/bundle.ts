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
import { relations, sql } from "drizzle-orm";
import { bundleTypeEnum, bundleOriginEnum, bundleItemRoleEnum, questionStatusEnum } from "./_enums";
import { questions } from "./question";
import { sources } from "./source";
import { events } from "./event";

/** bundles — paket/naskah soal. UTS/PAS = bundle_type 'exam' tanpa event. */
export const bundles = pgTable(
  "bundles",
  {
    id: uuidPk(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    bundleType: bundleTypeEnum("bundle_type").notNull(),
    /** Asal-usul paket (MAT-39): `ingest` = pipeline naskah; `manual` = guru/admin. */
    origin: bundleOriginEnum("origin").default("manual").notNull(),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    /** URL artikel/naskah spesifik (ADR-0014) — `sources.url` = situsnya. */
    url: text("url"),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    year: smallint("year"),
    grade: varchar("grade", { length: 20 }),
    durationMinutes: integer("duration_minutes").default(90),
    instructions: text("instructions"),
    status: questionStatusEnum("status").default("draft").notNull(),
    createdById: text("created_by_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // T9: slug unik antar yang AKTIF saja (boleh dipakai ulang setelah soft-delete)
    uniqueIndex("uq_bundles_slug_active")
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_bundles_type").on(t.bundleType),
    index("idx_bundles_origin").on(t.origin),
    index("idx_bundles_source_id").on(t.sourceId),
    index("idx_bundles_event_id").on(t.eventId),
    index("idx_bundles_status").on(t.status),
  ],
);

/** bundle_items — isi paket. */
export const bundleItems = pgTable(
  "bundle_items",
  {
    id: uuidPk(),
    bundleId: uuid("bundle_id").notNull().references(() => bundles.id, { onDelete: "cascade" }),
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "restrict" }),
    role: bundleItemRoleEnum("role").default("question").notNull(),
    orderIndex: integer("order_index").default(1).notNull(),
    sectionName: varchar("section_name", { length: 100 }),
    itemNumber: varchar("item_number", { length: 50 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_bundle_items").on(t.bundleId, t.questionId),
    index("idx_bundle_items_order").on(t.bundleId, t.orderIndex),
    index("idx_bundle_items_question").on(t.questionId),
  ],
);

export const bundlesRelations = relations(bundles, ({ one, many }) => ({
  source: one(sources, { fields: [bundles.sourceId], references: [sources.id] }),
  event: one(events, { fields: [bundles.eventId], references: [events.id] }),
  items: many(bundleItems),
}));

export const bundleItemsRelations = relations(bundleItems, ({ one }) => ({
  bundle: one(bundles, { fields: [bundleItems.bundleId], references: [bundles.id] }),
  question: one(questions, { fields: [bundleItems.questionId], references: [questions.id] }),
}));

export type Bundle = typeof bundles.$inferSelect;
export type NewBundle = typeof bundles.$inferInsert;
export type BundleItem = typeof bundleItems.$inferSelect;