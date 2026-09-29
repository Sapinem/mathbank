/**
 * Pembangun filter soal (M6) — mengubah param query menjadi kondisi SQL.
 *
 * Menggantikan filter in-line di `question-service.listQuestions`.
 * **Proyeksi tetap aman (S3)**: modul ini hanya membangun WHERE, bukan SELECT.
 */
import { and, eq, isNull, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema/question";
import { questionTopics, questionTags, topics } from "@/lib/db/schema/taxonomy";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

/** Kumpulkan id topik + seluruh keturunannya (rekursif, BFS). */
export async function collectTopicDescendants(rootId: string): Promise<string[]> {
  const all = await db
    .select({ id: topics.id, parentId: topics.parentId })
    .from(topics);
  const childrenOf = new Map<string, string[]>();
  for (const t of all) {
    if (t.parentId) {
      const arr = childrenOf.get(t.parentId) ?? [];
      arr.push(t.id);
      childrenOf.set(t.parentId, arr);
    }
  }
  const ids: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    ids.push(cur);
    for (const c of childrenOf.get(cur) ?? []) queue.push(c);
  }
  return ids;
}

/** Ambil id soal yang terkait sekumpulan topik (M:N). */
async function questionIdsForTopics(topicIds: string[]): Promise<string[]> {
  if (topicIds.length === 0) return [];
  const rows = await db
    .select({ id: questionTopics.questionId })
    .from(questionTopics)
    .where(inArray(questionTopics.topicId, topicIds));
  return [...new Set(rows.map((r) => r.id))];
}

async function questionIdsForTag(tagId: string): Promise<string[]> {
  const rows = await db
    .select({ id: questionTags.questionId })
    .from(questionTags)
    .where(eq(questionTags.tagId, tagId));
  return [...new Set(rows.map((r) => r.id))];
}

/** Hasil: kondisi SQL + opsi pengurutan (relevansi bila ada pencarian). */
export interface BuiltFilter {
  where: SQL | undefined;
  /** Bila true, urutkan berdasar relevansi teks (bukan createdAt). */
  byRelevance: boolean;
}

/**
 * Bangun kondisi WHERE dari param. `byRelevance` true bila ada `q` (pencarian
 * teks) — pemanggil memakai similarity trigram untuk pengurutan.
 */
export async function buildQuestionFilter(
  query: ListQuestionsQuery,
): Promise<BuiltFilter> {
  const conds: SQL[] = [];
  if (!query.includeDeleted) conds.push(isNull(questions.deletedAt));
  if (query.status) conds.push(eq(questions.status, query.status));
  if (query.questionType) conds.push(eq(questions.questionType, query.questionType));
  if (query.grade) conds.push(eq(questions.grade, query.grade));
  if (query.difficulty) conds.push(eq(questions.difficulty, query.difficulty));
  if (query.cognitiveLevel)
    conds.push(eq(questions.cognitiveLevel, query.cognitiveLevel));
  if (query.sourceId) conds.push(eq(questions.sourceId, query.sourceId));
  if (query.eventId) conds.push(eq(questions.eventId, query.eventId));
  if (query.flagged !== undefined) conds.push(eq(questions.isFlagged, query.flagged));

  // Pencarian teks: trigram typo-tolerant (pg_trgm). `word_similarity` agar
  // kata sebagian tetap cocok; ambang 0.3 cukup longgar untuk typo ringan.
  if (query.q) {
    const term = query.q.trim();
    conds.push(
      sql`(${questions.contentMarkdown} % ${term} OR ${questions.contentMarkdown} ILIKE ${"%" + term + "%"})`,
    );
  }

  // Filter topik — TERMASUK anak (rekursif).
  if (query.topicId) {
    const topicIds = await collectTopicDescendants(query.topicId);
    const ids = await questionIdsForTopics(topicIds);
    if (ids.length === 0) return { where: sql`false`, byRelevance: !!query.q };
    conds.push(inArray(questions.id, ids));
  }
  if (query.tagId) {
    const ids = await questionIdsForTag(query.tagId);
    if (ids.length === 0) return { where: sql`false`, byRelevance: !!query.q };
    conds.push(inArray(questions.id, ids));
  }

  return {
    where: conds.length ? and(...conds) : undefined,
    byRelevance: !!query.q,
  };
}
