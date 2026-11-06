import { uuidPk, versionColumn } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { questions } from "./question";

/** topics — taksonomi 3-level (Kategori › Topik › SubTopik). Dulu `categories`. */
export const topics = pgTable(
  "topics",
  {
    id: uuidPk(),
    name: varchar("name", { length: 255 }).notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => topics.id, {
      onDelete: "restrict", // cegah hapus kalau masih ada anak
    }),
    level: smallint("level").notNull(), // 1=Kategori, 2=Topik, 3=SubTopik
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    usageCount: integer("usage_count").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    version: versionColumn(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_topics_parent_id").on(t.parentId),
    index("idx_topics_level").on(t.level),
    index("idx_topics_name_trgm").using("gin", t.name.op("gin_trgm_ops")),
    // Invarian — level topik 1..3 (lihat drizzle/0002_db_safety.sql)
    check("chk_topics_level", sql`${t.level} BETWEEN 1 AND 3`),
  ],
);

/** grades — jenjang/kelas (seed dari curriculum.yaml). */
export const grades = pgTable("grades", {
  id: varchar("id", { length: 20 }).primaryKey(),
  label: varchar("label", { length: 100 }).notNull(),
  levelGroup: varchar("level_group", { length: 20 }), // 'sd' | 'smp' | 'sma'
  curriculumPhase: varchar("curriculum_phase", { length: 20 }),
  orderIndex: integer("order_index").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** difficulty_levels — tingkat kesulitan 1–5. */
export const difficultyLevels = pgTable("difficulty_levels", {
  value: smallint("value").primaryKey(),
  label: varchar("label", { length: 50 }).notNull(),
  colorToken: varchar("color_token", { length: 50 }),
  timeGuideline: varchar("time_guideline", { length: 50 }),
  targetSuccessRate: varchar("target_success_rate", { length: 50 }),
  description: text("description"),
  orderIndex: integer("order_index").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** cognitive_levels — taksonomi Bloom C1–C6. */
export const cognitiveLevels = pgTable("cognitive_levels", {
  id: varchar("id", { length: 20 }).primaryKey(), // 'remember'..'create'
  code: varchar("code", { length: 10 }).notNull(), // 'C1'..'C6'
  label: varchar("label", { length: 100 }).notNull(),
  shortLabel: varchar("short_label", { length: 20 }),
  bloomEquivalent: varchar("bloom_equivalent", { length: 10 }),
  colorToken: varchar("color_token", { length: 50 }),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** tags — label sekunder (opsional). */
export const tags = pgTable(
  "tags",
  {
    id: uuidPk(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    usageCount: integer("usage_count").default(0).notNull(),
    version: versionColumn(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_tags_name").on(t.name),
    index("idx_tags_name_trgm").using("gin", t.name.op("gin_trgm_ops")),
  ],
);

/** question_topics — M:N soal↔topik, dengan 1 primary. */
export const questionTopics = pgTable(
  "question_topics",
  {
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.topicId] }),
    index("idx_question_topics_topic").on(t.topicId),
  ],
);

/** question_tags — M:N soal↔tag. */
export const questionTags = pgTable(
  "question_tags",
  {
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.tagId] }),
    index("idx_question_tags_tag").on(t.tagId),
  ],
);

export const topicsRelations = relations(topics, ({ one, many }) => ({
  parent: one(topics, { fields: [topics.parentId], references: [topics.id], relationName: "topicHierarchy" }),
  children: many(topics, { relationName: "topicHierarchy" }),
}));

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Grade = typeof grades.$inferSelect;
export type DifficultyLevel = typeof difficultyLevels.$inferSelect;
export type CognitiveLevel = typeof cognitiveLevels.$inferSelect;
export type Tag = typeof tags.$inferSelect;