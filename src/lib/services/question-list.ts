import { and, eq, inArray, sql, desc, asc, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, questionEmbeddings } from "@/lib/db/schema/question";
import { questionTopics, topics } from "@/lib/db/schema/taxonomy";
import { embedText } from "@/lib/embedding/bge-m3";
import type { Actor } from "@/lib/auth/actor";
import {
  questionColumns,
  projectOptions,
  projectAnswerKey,
  projectDataPayload,
  canSeeAnswerKey,
} from "@/lib/db/projections/question";
import type {
  ListQuestionsQuery,
  AnswerKey,
  QuestionListStats,
} from "@/lib/contracts/question";
import { fetchQuestionStatsAndTotal } from "./question-stats";
import type { PublicQuestion, QuestionTopicView } from "./question-read";

/**
 * Daftar soal dengan filter & paginasi (proyeksi aman, S3).
 * Pecahan dari question-read.ts (CONSTRAINT #16: maks ~300 baris/file).
 */
export async function listQuestions(
  query: ListQuestionsQuery,
  viewer?: Actor,
): Promise<{ items: PublicQuestion[]; total: number; stats?: QuestionListStats }> {
  // Impor dinamis menghindari lingkaran modul: buildQuestionFilter memakai
  // tipe/utilitas yang sama tanpa saling mengimpor modul ini.
  const { buildQuestionFilter } = await import("@/lib/question/filters");
  const { where: finalWhere, byRelevance, resolvedTopicIds } =
    await buildQuestionFilter(query);

  // Mode semantik: urutkan berdasar jarak embedding (HNSW) bila query dapat
  // di-embed. Bila service embedding mati / tak ada hasil, JATUH ke trigram.
  let orderBy: SQL[] | undefined;
  let semanticWhere: SQL | undefined;
  if (query.mode === "semantic" && query.q) {
    const emb = await embedText(query.q.trim(), { timeoutMs: 3000 });
    if (emb.ok && emb.vector) {
      const literal = `[${emb.vector.join(",")}]`;
      // ADR-0019: vektor pindah ke tabel `question_embeddings` (Pilar 1 v2.0).
      // Hanya soal yang sudah punya embedding.
      semanticWhere = sql`${questionEmbeddings.embedding} IS NOT NULL`;
      orderBy = [asc(sql`${questionEmbeddings.embedding} <=> ${literal}::vector`)];
    }
  }

  const combined = semanticWhere
    ? finalWhere
      ? and(finalWhere, semanticWhere)
      : semanticWhere
    : finalWhere;

  // ADR-0019: mode semantik memerlukan LEFT JOIN ke `question_embeddings`.
  // Join ditambahkan HANYA bila semanticWhere aktif agar query non-semantik
  // tetap ringan (zero join ke tabel vektor).
  const baseQuery = semanticWhere
    ? db
        .select(
          questionColumns({
            withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false,
          }),
        )
        .from(questions)
        .leftJoin(
          questionEmbeddings,
          eq(questions.id, questionEmbeddings.questionId),
        )
    : db
        .select(
          questionColumns({
            withAnswerKey: viewer ? canSeeAnswerKey(viewer) : false,
          }),
        )
        .from(questions);

  const { total: count, stats } = await fetchQuestionStatsAndTotal({
    query,
    combinedWhere: combined,
    semanticWhere,
    resolvedTopicIds,
  });

  // Urutkan: semantik (bila aktif) > relevansi trigram > terbaru dulu.
  const finalOrder: SQL[] =
    orderBy ??
    (byRelevance && query.q
      ? [
          desc(sql`similarity(${questions.contentMarkdown}, ${query.q.trim()})`),
          desc(questions.createdAt),
        ]
      : [desc(questions.createdAt)]);

  const rows = await baseQuery
    .where(combined)
    .orderBy(...finalOrder)
    .limit(query.limit)
    .offset(query.offset);

  const items = await attachOptions(
    rows,
    viewer ? canSeeAnswerKey(viewer) : false,
  );
  return { items, total: count, stats };
}

/**
 * Lampirkan opsi ke banyak soal (MAT-146 — zero join: opsi sudah ikut di baris
 * `data_payload`, jadi tidak ada query opsi sama sekali).
 */
async function attachOptions(
  rows: Omit<PublicQuestion, "options">[],
  withAnswerKey: boolean,
): Promise<PublicQuestion[]> {
  if (rows.length === 0) return [];

  // Lampirkan wacana stimulus induk (hindari N+1): 1 query untuk semua parentId.
  const parentIds = [
    ...new Set(rows.map((r) => r.parentId).filter((v): v is string => !!v)),
  ];
  const questionIds = rows.map((r) => r.id);

  const [parents, qTopics] = await Promise.all([
    parentIds.length > 0
      ? db
          .select({
            id: questions.id,
            contentMarkdown: questions.contentMarkdown,
          })
          .from(questions)
          .where(inArray(questions.id, parentIds))
      : Promise.resolve([]),
    questionIds.length > 0
      ? db
          .select({
            questionId: questionTopics.questionId,
            id: topics.id,
            name: topics.name,
            level: topics.level,
            isPrimary: questionTopics.isPrimary,
          })
          .from(questionTopics)
          .innerJoin(topics, eq(questionTopics.topicId, topics.id))
          .where(inArray(questionTopics.questionId, questionIds))
      : Promise.resolve([]),
  ]);

  const parentMap = new Map<string, { id: string; contentMarkdown: string }>();
  for (const p of parents) parentMap.set(p.id, p);

  const topicMap = new Map<string, QuestionTopicView[]>();
  for (const qt of qTopics) {
    const list = topicMap.get(qt.questionId) ?? [];
    list.push({
      id: qt.id,
      name: qt.name,
      level: Number(qt.level),
      isPrimary: qt.isPrimary,
    });
    topicMap.set(qt.questionId, list);
  }

  return rows.map((r) => {
    const answerKey =
      "answerKey" in r ? (r as { answerKey?: unknown }).answerKey : undefined;
    return {
      ...r,
      dataPayload: projectDataPayload(r.dataPayload, { withAnswerKey }),
      ...(answerKey !== undefined
        ? { answerKey: projectAnswerKey(answerKey) as AnswerKey }
        : {}),
      options: projectOptions(
        { id: r.id, dataPayload: r.dataPayload, answerKey },
        { withAnswerKey, createdAt: r.createdAt, updatedAt: r.updatedAt },
      ),
      parent: r.parentId ? parentMap.get(r.parentId) ?? null : null,
      topics: topicMap.get(r.id) ?? [],
    } as PublicQuestion;
  });
}
