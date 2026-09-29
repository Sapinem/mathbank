import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { solutionTypeEnum, authorTypeEnum } from "./_enums";
import { questions } from "./question";

/** solutions — pembahasan soal (1 soal → banyak pembahasan). */
export const solutions = pgTable(
  "solutions",
  {
    id: uuidPk(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    solutionType: solutionTypeEnum("solution_type")
      .default("conceptual")
      .notNull(),
    title: varchar("title", { length: 150 }).default("Pembahasan Utuh").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    authorType: authorTypeEnum("author_type").default("teacher").notNull(),
    authorId: text("author_id"),
    aiModelName: varchar("ai_model_name", { length: 100 }),
    verifiedById: text("verified_by_id"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_solutions_question").on(t.questionId),
    index("idx_solutions_primary").on(t.questionId, t.isPrimary),
  ],
);

export const solutionsRelations = relations(solutions, ({ one }) => ({
  question: one(questions, {
    fields: [solutions.questionId],
    references: [questions.id],
  }),
}));

export type Solution = typeof solutions.$inferSelect;
export type NewSolution = typeof solutions.$inferInsert;