import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  doublePrecision,
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
    /** Jumlah soal yang berhasil dibuat dari artikel ini (catatan hasil). */
    importedQuestionsCount: integer("imported_questions_count").default(0).notNull(),
    /** Catatan hasil AI/human (mis. "Artikel teori tanpa soal"). */
    aiNotes: text("ai_notes"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_ingest_queue_status").on(t.status),
    index("idx_ingest_queue_target_topic").on(t.targetTopicId),
  ],
);

/**
 * rate_limit_buckets — token bucket BERSAMA lintas instance (ADR-0029).
 *
 * KENAPA di DB: store in-memory membuat batas per-proses — dua replika berarti
 * dua kali kuota, dan restart mengosongkan bucket. Di sini state bertahan dan
 * dihitung atomik lewat satu `INSERT … ON CONFLICT DO UPDATE`.
 *
 * `updated_at` sengaja **tanpa trigger** `set_updated_at`: tabel ini ditulis
 * UPSERT yang sudah menetapkan waktunya sendiri, dan trigger per baris hanya
 * menambah biaya di jalur panas (lihat catatan di `db_safety.sql`).
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    /** `scope:aktor|ip` — lihat `rateLimitKey()`. */
    key: varchar("key", { length: 255 }).primaryKey(),
    /** Token tersisa (pecahan, bukan bilangan bulat). */
    tokens: doublePrecision("tokens").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_rate_limit_buckets_updated_at").on(t.updatedAt)],
);

/**
 * idempotency_keys — klaim & replay `Idempotency-Key` lintas instance (ADR-0029).
 *
 * Satu baris per (aktor, key). `in_flight` mencegah dua permintaan paralel
 * dengan key sama menjalankan handler dua kali: klaim dilakukan lewat
 * `INSERT … ON CONFLICT DO NOTHING`, jadi hanya satu yang menang.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: varchar("key", { length: 255 }).primaryKey(),
    /** SHA-256(method + path + body) — key sama + sidik beda = salah pakai. */
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    /** Status respons tersimpan (`null` selama masih diproses). */
    status: integer("status"),
    /** Body respons tersimpan (envelope `{ data }`). */
    body: jsonb("body"),
    inFlight: boolean("in_flight").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_idempotency_keys_expires_at").on(t.expiresAt)],
);

export type AppSetting = typeof appSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type IngestQueueItem = typeof ingestQueue.$inferSelect;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;