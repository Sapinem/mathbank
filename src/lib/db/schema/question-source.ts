import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sourceKindEnum } from "./_enums";
import { questions } from "./question";
import { sources } from "./source";

/**
 * question_sources — provenance per-butir (ADR-0012).
 *
 * Many-to-many: satu soal boleh punya BANYAK sumber (mis. soal sama dari web + buku),
 * dan `UNIQUE (question_id, source_id)` mencegah baris sumber ganda untuk soal yang sama.
 * Menyimpan jejak asal-usul butir: judul artikel web, URL, waktu akses, detail publikasi.
 *
 * Alur ingest: soal dengan konten sama (stem+opsi) TIDAK dibuat ulang — cukup
 * tambahkan baris di sini (lihat `findQuestionByContentHash` + upsert di ingest/commit.ts).
 */
export const questionSources = pgTable(
  "question_sources",
  {
    id: uuidPk(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    // Master sumber (opsional — boleh ada provenance tanpa entri `sources`).
    sourceId: uuid("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    // Jenis sumber — pakai enum yang sudah ada (book|website|school).
    sourceType: sourceKindEnum("source_type").notNull().default("website"),
    // Judul artikel/halaman web (mis. "Pembahasan Limit Fungsi Kelas 12").
    title: varchar("title", { length: 255 }),
    url: text("url"),
    // Waktu akses/pengambilan saat ingest.
    accessedAt: timestamp("accessed_at", { withTimezone: true }),
    publisher: varchar("publisher", { length: 255 }),
    author: varchar("author", { length: 255 }),
    year: smallint("year"),
    grade: varchar("grade", { length: 20 }),
    itemNumber: varchar("item_number", { length: 50 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_question_sources_question").on(t.questionId),
    index("idx_question_sources_source").on(t.sourceId),
    index("idx_question_sources_type").on(t.sourceType),
    // Cegah baris sumber ganda untuk soal yang sama (bila source_id terisi).
    uniqueIndex("uq_question_sources_question_source").on(
      t.questionId,
      t.sourceId,
    ),
  ],
);

export const questionSourcesRelations = relations(questionSources, ({ one }) => ({
  question: one(questions, {
    fields: [questionSources.questionId],
    references: [questions.id],
  }),
  source: one(sources, {
    fields: [questionSources.sourceId],
    references: [sources.id],
  }),
}));

export type QuestionSource = typeof questionSources.$inferSelect;
export type NewQuestionSource = typeof questionSources.$inferInsert;
