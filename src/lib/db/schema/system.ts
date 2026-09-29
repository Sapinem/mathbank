import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { auditActionEnum, auditEntityEnum, authorTypeEnum, ingestStatusEnum } from "./_enums";

/** app_settings — key-value konfigurasi (termasuk AI: base_url, api_key, model). */
export const appSettings = pgTable(
  "app_settings",
  {
    id: uuidPk(),
    key: varchar("key", { length: 255 }).notNull(),
    value: jsonb("value").notNull(),
    description: varchar("description", { length: 500 }),
    isSecret: boolean("is_secret").default(false).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_app_settings_key").on(t.key)],
);

/** audit_logs — SATU tabel audit generik (T8, ganti 2 tabel QBank). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuidPk(),
    entityType: auditEntityEnum("entity_type").notNull(),
    entityId: varchar("entity_id", { length: 64 }).notNull(),
    action: auditActionEnum("action").notNull(),
    actorType: authorTypeEnum("actor_type").notNull(),
    actorId: varchar("actor_id", { length: 100 }),
    changeSummary: text("change_summary"),
    diffPayload: jsonb("diff_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_logs_entity").on(t.entityType, t.entityId),
    index("idx_audit_logs_created_at").on(t.createdAt),
  ],
);

/** ingest_queue — antrean ingest (dipakai M9). */
export const ingestQueue = pgTable(
  "ingest_queue",
  {
    id: uuidPk(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }),
    sourceOrigin: varchar("source_origin", { length: 50 }).notNull(),
    sourceUrl: text("source_url"),
    rawContent: text("raw_content").notNull(),
    rawFormat: varchar("raw_format", { length: 20 }).default("text").notNull(),
    mediaManifest: jsonb("media_manifest").$type<
      Array<{ sourcePath: string; originalName: string; destFileName?: string }>
    >()
      .default([])
      .notNull(),
    targetType: varchar("target_type", { length: 20 }).default("question"), // 'question' | 'bundle'
    targetGrade: varchar("target_grade", { length: 20 }),
    targetTopicId: uuid("target_topic_id"),
    status: ingestStatusEnum("status").default("pending").notNull(),
    errorMessage: text("error_message"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_ingest_queue_status").on(t.status)],
);

export type AppSetting = typeof appSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type IngestQueueItem = typeof ingestQueue.$inferSelect;