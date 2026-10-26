import { uuidPk, versionColumn } from "./_columns";
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
import { relations, sql, desc } from "drizzle-orm";
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
    grade: varchar("grade", { length: 20 }),
    grades: varchar("grades", { length: 20 })
      .array()
      .default(sql`ARRAY[]::varchar[]`),

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

    // ADR-0019: Vektor pindah ke tabel `question_embeddings` (Pilar 1 v2.0).
    // Kolom `embedding`, `embeddingContentHash`, `embeddingModelName` DIHAPUS.
    aiTagged: boolean("ai_tagged").default(false).notNull(),
    aiTaggedAt: timestamp("ai_tagged_at", { withTimezone: true }),

    authorId: text("author_id"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    version: versionColumn(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_questions_parent_id").on(t.parentId),
    index("idx_questions_question_type").on(t.questionType),
    index("idx_questions_grade").on(t.grade),
    index("idx_questions_grades_gin").using("gin", t.grades),
    index("idx_questions_difficulty").on(t.difficulty),
    // PERF-08: filter taksonomi Bloom (C1–C6) sering dipakai di daftar soal.
    index("idx_questions_cognitive_level").on(t.cognitiveLevel),
    index("idx_questions_event_id").on(t.eventId),
    index("idx_questions_author_id").on(t.authorId),
    index("idx_questions_deleted_at").on(t.deletedAt),
    // Anti-duplikat: hash konten unik di antara soal yang belum dihapus (ADR-0012).
    uniqueIndex("uq_questions_content_hash")
      .on(t.contentHash)
      .where(sql`${t.deletedAt} IS NULL AND ${t.contentHash} IS NOT NULL`),
    // ACT-06 (MAT-123): bentuk query daftar soal adalah
    //   WHERE deleted_at IS NULL AND status = $1 ORDER BY created_at DESC LIMIT n
    // Indeks (status, created_at DESC) parsial melayani ketiga bagian sekaligus
    // (filter, urutan, dan predikat hidup) sehingga SORT hilang dari rencana.
    // Terukur: 512,996 ms → 0,219 ms pada 100k baris untuk status `ready`.
    // Menggantikan idx_questions_status + idx_questions_grade_diff_status yang
    // tak melayani bentuk query ini (status bukan kolom depan pada yang kedua).
    // ⚠️ Konsekuensi: `status` ada di indeks ⇒ UPDATE status tidak bisa HOT.
    // Trade-off ini disengaja; angka pembanding ada di
    // drizzle/manual/10-questions-listing-index.sql.
    index("idx_questions_listing")
      .on(t.status, desc(t.createdAt))
      .where(sql`${t.deletedAt} IS NULL`),
    index("idx_questions_content_trgm").using(
      "gin",
      sql`${t.contentMarkdown} gin_trgm_ops`,
    ),
    // Invarian #1 — difficulty 1..5 (lihat drizzle/0003_*.sql)
    check("chk_questions_difficulty", sql`${t.difficulty} BETWEEN 1 AND 5`),
  ],
);

/**
 * MAT-146 — `question_options` DIHAPUS.
 *
 * Opsi jawaban kini tinggal di `questions.data_payload.options` (JSONB) dan
 * kuncinya di `questions.answer_key.correctOptionIds` (lihat
 * `src/lib/validations/question-payload.ts` + `enforceQuestionWriteGate`).
 * Konsekuensi: baca soal = **zero join**.
 */

/**
 * question_embeddings — vektor terisolasi 1:1 (ADR-0019, Pilar 1 v2.0).
 *
 * PK = question_id (bukan id terpisah) → hemat 1 kolom + 1 index.
 * CASCADE: hapus soal → hapus vektor otomatis.
 *
 * Dampak: ukuran baris `questions` turun ~4.5 KB → ~280 bytes (hemat 93% RAM
 * buffer pool PostgreSQL). Query daftar/filter/pagination tak lagi memuat
 * vektor 1024-float yang tidak dipakai.
 */
export const questionEmbeddings = pgTable(
  "question_embeddings",
  {
    questionId: uuid("question_id")
      .primaryKey()
      .references(() => questions.id, { onDelete: "cascade" }),
    embedding: vector1024("embedding").notNull(),
    embeddingContentHash: varchar("embedding_content_hash", { length: 64 }),
    embeddingModelName: varchar("embedding_model_name", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // HNSW index pada tabel kecil ini (hanya baris ber-vektor).
    // Semua baris di sini PASTI punya embedding (notNull), jadi tidak perlu
    // partial — tabel itu sendiri sudah "partisi" dari questions.
    index("idx_question_embeddings_hnsw").using(
      "hnsw",
      sql`${t.embedding} vector_cosine_ops`,
    ),
  ],
);

export const questionEmbeddingsRelations = relations(
  questionEmbeddings,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionEmbeddings.questionId],
      references: [questions.id],
    }),
  }),
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
  // ADR-0019: vektor terisolasi 1:1.
  questionEmbedding: one(questionEmbeddings, {
    fields: [questions.id],
    references: [questionEmbeddings.questionId],
  }),
}));

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

/**
 * @deprecated MAT-146 — `question_options` dihapus; opsi kini JSONB di
 * `data_payload.options`. Alias ini dipertahankan agar konsumen lama tetap
 * typecheck; sumber kebenarannya `QuestionOptionView` di
 * `@/lib/db/projections/question`.
 */
export type QuestionOption = import("@/lib/db/projections/question").QuestionOptionView;
