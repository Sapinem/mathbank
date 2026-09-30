import { and, eq, isNull, sql, desc, asc, inArray, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  questions,
  questionOptions,
  type Question,
  type QuestionOption,
} from "@/lib/db/schema/question";
import { embedText } from "@/lib/embedding/bge-m3";
import type { Actor } from "@/lib/auth/actor";
import {
  questionColumns,
  optionColumns,
  canSeeAnswerKey,
} from "@/lib/db/projections/question";
import type { ListQuestionsQuery, AnswerKey } from "@/lib/contracts/question";

/**
 * Baca soal (M14 — pecahan `question-service.ts`).
 *
 * Fungsi baca murni + proyeksi aman (S3): `answerKey` hanya bila viewer berwenang,
 * `embedding*`/`aiTagged*` selalu dibuang pada jalur publik.
 */

/**
 * Bentuk soal untuk RESPONS API.
 *
 * `answerKey` hanya ada bila viewer berwenang (lihat `canSeeAnswerKey`);
 * field internal (`embedding*`, `aiTagged*`) **selalu** dibuang (S3).
 */
export type PublicQuestion = Omit<
  Question,
  | "embedding"
  | "embeddingContentHash"
  | "embeddingModelName"
  | "aiTagged"
  | "aiTaggedAt"
  | "answerKey"
> & { options: QuestionOption[]; answerKey?: AnswerKey };

/** Soal internal (untuk logika service: FSM, izin) — punya `answerKey`. */
export interface QuestionInternal extends Question {
  options: QuestionOption[];
}

/**
 * Ambil satu soal + opsi untuk RESPONS API (proyeksi aman, S3).
 * `answerKey` hanya disertakan bila `viewer` berwenang.
 */
export async function getQuestion(
  id: string,
  opts: { includeDeleted?: boolean; viewer?: Actor } = {},
): Promise<PublicQuestion | null> {
  const withAnswerKey = opts.viewer ? canSeeAnswerKey(opts.viewer) : false;

  const [row] = await db
    .select(questionColumns({ withAnswerKey }))
    .from(questions)
    .where(
      opts.includeDeleted
        ? eq(questions.id, id)
        : and(eq(questions.id, id), isNull(questions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;

  const options = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.orderIndex));

  return { ...row, options } as PublicQuestion;
}

/**
 * Baca soal LENGKAP (internal) — untuk logika service yang butuh `answerKey`
 * (mis. `assertReady`) & field internal. **JANGAN** kirim hasil ini ke klien.
 */
export async function getQuestionInternal(
  id: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<QuestionInternal | null> {
  const [row] = await db
    .select()
    .from(questions)
    .where(
      opts.includeDeleted
        ? eq(questions.id, id)
        : and(eq(questions.id, id), isNull(questions.deletedAt)),
    )
    .limit(1);
  if (!row) return null;

  const options = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.orderIndex));

  return { ...row, options };
}

/** Daftar soal dengan filter & paginasi (proyeksi aman, S3). */
export async function listQuestions(
  query: ListQuestionsQuery,
  viewer?: Actor,
): Promise<{ items: PublicQuestion[]; total: number }> {
  // Impor dinamis menghindari lingkaran modul: buildQuestionFilter memakai
  // tipe/utilitas yang sama tanpa saling mengimpor modul ini.
  const { buildQuestionFilter } = await import("@/lib/question/filters");
  const { where: finalWhere, byRelevance } = await buildQuestionFilter(query);

  // Mode semantik: urutkan berdasar jarak embedding (HNSW) bila query dapat
  // di-embed. Bila service embedding mati / tak ada hasil, JATUH ke trigram.
  let orderBy: SQL[] | undefined;
  let semanticWhere: SQL | undefined;
  if (query.mode === "semantic" && query.q) {
    const emb = await embedText(query.q.trim());
    if (emb.ok && emb.vector) {
      const literal = `[${emb.vector.join(",")}]`;
      // Hanya soal yang sudah punya embedding.
      semanticWhere = sql`${questions.embedding} IS NOT NULL`;
      orderBy = [asc(sql`${questions.embedding} <=> ${literal}::vector`)];
    }
  }

  const combined = semanticWhere
    ? finalWhere
      ? and(finalWhere, semanticWhere)
      : semanticWhere
    : finalWhere;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questions)
    .where(combined);

  // Urutkan: semantik (bila aktif) > relevansi trigram > terbaru dulu.
  const finalOrder: SQL[] =
    orderBy ??
    (byRelevance && query.q
      ? [
          desc(sql`similarity(${questions.contentMarkdown}, ${query.q.trim()})`),
          desc(questions.createdAt),
        ]
      : [desc(questions.createdAt)]);

  const rows = await db
    .select(questionColumns({ withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false }))
    .from(questions)
    .where(combined)
    .orderBy(...finalOrder)
    .limit(query.limit)
    .offset(query.offset);

  const items = await attachOptions(rows, viewer ? canSeeAnswerKey(viewer) : false);
  return { items, total: count };
}

/** Lampirkan opsi ke banyak soal (hindari N+1). Proyeksi aman (S3). */
async function attachOptions(
  rows: Omit<PublicQuestion, "options">[],
  withAnswerKey: boolean,
): Promise<PublicQuestion[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const opts = await db
    .select(optionColumns({ withAnswerKey }))
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, ids))
    .orderBy(asc(questionOptions.orderIndex));
  const byQuestion = new Map<string, QuestionOption[]>();
  for (const o of opts) {
    const arr = byQuestion.get(o.questionId) ?? [];
    arr.push(o as QuestionOption);
    byQuestion.set(o.questionId, arr);
  }
  return rows.map((r) => ({ ...r, options: byQuestion.get(r.id) ?? [] }));
}
