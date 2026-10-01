import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
  customType,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  questionTypeEnum,
  questionStatusEnum,
  cognitiveLevelEnum,
} from "./_enums";
import { events } from "./event";

/** Kolom vektor pgvector (dimensi 1024, model BGE-M3). */
const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value) as number[];
  },
});

/**
 * questions — soal (termasuk stimulus via `parent_id`).
 * Stimulus = soal `question_type='stimulus'` dengan `parent_id` NULL.
 */
export const questions = pgTable(
  "questions",
  {
    id: uuidPk(),
    parentId: uuid("parent_id").references((): AnyPgColumn => questions.id, {
      onDelete: "restrict", // ⚠️ T1: BUKAN cascade — cegah hapus stimulus beranak
    }),
    childOrder: smallint("child_order").default(0).notNull(),
    questionType: questionTypeEnum("question_type").notNull(),
    difficulty: smallint("difficulty").notNull(), // 1–5
    cognitiveLevel: cognitiveLevelEnum("cognitive_level").notNull(),
    grade: varchar("grade", { length: 20 }).notNull(),

    contentMarkdown: text("content_markdown").notNull(),
    // Hash konten (stem+opsi, ADR-0012) — dasar anti-duplikat lintas-sumber.
    contentHash: varchar("content_hash", { length: 64 }),
    dataPayload: jsonb("data_payload")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    answerKey: jsonb("answer_key")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),

    status: questionStatusEnum("status").default("draft").notNull(),
    isFlagged: boolean("is_flagged").default(false).notNull(),
    flagNotes: text("flag_notes"),

    // Asal (provenance): peristiwa nyata saja.
    // ADR-0014: sumber menempel pada BUNDLE, bukan soal — `source_id` dibuang.
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    eventYear: smallint("event_year"),
    eventSubtest: varchar("event_subtest", { length: 100 }),
    eventItemNumber: varchar("event_item_number", { length: 50 }),
    eventNotes: text("event_notes"),

    // Embedding inline (satu tempat)
    embedding: vector1024("embedding"),
    embeddingContentHash: varchar("embedding_content_hash", { length: 64 }),
    embeddingModelName: varchar("embedding_model_name", { length: 100 }),
    aiTagged: boolean("ai_tagged").default(false).notNull(),
    aiTaggedAt: timestamp("ai_tagged_at", { withTimezone: true }),

    authorId: text("author_id"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_questions_parent_id").on(t.parentId),
    index("idx_questions_status").on(t.status),
    index("idx_questions_grade").on(t.grade),
    index("idx_questions_difficulty").on(t.difficulty),
    index("idx_questions_event_id").on(t.eventId),
    index("idx_questions_author_id").on(t.authorId),
    index("idx_questions_deleted_at").on(t.deletedAt),
    // Anti-duplikat: hash konten unik di antara soal yang belum dihapus (ADR-0012).
    uniqueIndex("uq_questions_content_hash")
      .on(t.contentHash)
      .where(sql`${t.deletedAt} IS NULL AND ${t.contentHash} IS NOT NULL`),
    index("idx_questions_grade_diff_status").on(
      t.grade,
      t.difficulty,
      t.status,
    ),
    index("idx_questions_content_trgm").using(
      "gin",
      sql`${t.contentMarkdown} gin_trgm_ops`,
    ),
    // Invarian #1 — difficulty 1..5 (lihat drizzle/0003_*.sql)
    check("chk_questions_difficulty", sql`${t.difficulty} BETWEEN 1 AND 5`),
  ],
);

/** question_options — opsi jawaban (anak murni soal). */
export const questionOptions = pgTable(
  "question_options",
  {
    id: uuidPk(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 10 }).notNull(), // 'A'..'E'
    contentMarkdown: text("content_markdown").notNull(),
    isCorrect: boolean("is_correct").default(false).notNull(),
    distractorRationale: text("distractor_rationale"),
    orderIndex: smallint("order_index").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_question_options_question").on(t.questionId)],
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  parent: one(questions, {
    fields: [questions.parentId],
    references: [questions.id],
    relationName: "questionChildren",
  }),
  children: many(questions, { relationName: "questionChildren" }),
  // ADR-0014: relasi `source` & `sources` (per-butir) dihapus — sumber via bundle.
  event: one(events, { fields: [questions.eventId], references: [events.id] }),
  options: many(questionOptions),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type QuestionOption = typeof questionOptions.$inferSelect;