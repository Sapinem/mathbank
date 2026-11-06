/**
 * Agregasi statistik & hitung total daftar soal (L5).
 * Pecahan `question-read.ts` untuk menjaga batas ukuran file ~300 baris (CONSTRAINTS #16).
 */
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { questions, questionEmbeddings } from "@/lib/db/schema/question";
import { buildFilterFrom } from "@/lib/question/filters-builder";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

export interface QuestionListStats {
  total: number;
  ready: number;
  review: number;
  draft: number;
  flagged: number;
}

const statsProjection = {
  count: sql<number>`count(*)::int`,
  ready: sql<number>`count(*) filter (where ${questions.status} = 'ready')::int`,
  review: sql<number>`count(*) filter (where ${questions.status} = 'review')::int`,
  draft: sql<number>`count(*) filter (where ${questions.status} = 'draft')::int`,
  flagged: sql<number>`count(*) filter (where ${questions.isFlagged} = true)::int`,
};

function buildStatsQuery(hasSemantic: boolean) {
  const base = db.select(statsProjection).from(questions);
  return hasSemantic
    ? base.leftJoin(questionEmbeddings, eq(questions.id, questionEmbeddings.questionId))
    : base;
}

function buildSimpleCountQuery(hasSemantic: boolean) {
  const base = db.select({ count: sql<number>`count(*)::int` }).from(questions);
  return hasSemantic
    ? base.leftJoin(questionEmbeddings, eq(questions.id, questionEmbeddings.questionId))
    : base;
}

/**
 * Hitung jumlah total terfilter dan statistik global (ready/review/draft/flagged).
 * Menggunakan kueri tunggal bila tidak ada filter status/flag, atau kueri ganda
 * independen bila ada filter status/flag untuk menjaga akurasi kartu metrik.
 */
export async function fetchQuestionStatsAndTotal(params: {
  query: ListQuestionsQuery;
  combinedWhere: SQL | undefined;
  semanticWhere: SQL | undefined;
  resolvedTopicIds?: string[];
}): Promise<{ total: number; stats: QuestionListStats }> {
  const { query, combinedWhere, semanticWhere, resolvedTopicIds } = params;
  const hasSemantic = semanticWhere !== undefined;
  const hasStatusOrFlagFilter = query.status !== undefined || query.flagged !== undefined;

  let statsWhere = combinedWhere;
  if (hasStatusOrFlagFilter) {
    const { where: baseFilter } = buildFilterFrom(
      { ...query, status: undefined, flagged: undefined },
      { resolvedTopicIds },
    );
    statsWhere = hasSemantic
      ? baseFilter
        ? and(baseFilter, semanticWhere)
        : semanticWhere
      : baseFilter;
  }

  const [filteredCountRes, statsCountRes] = await Promise.all([
    hasStatusOrFlagFilter
      ? buildSimpleCountQuery(hasSemantic).where(combinedWhere)
      : buildStatsQuery(hasSemantic).where(combinedWhere),
    hasStatusOrFlagFilter
      ? buildStatsQuery(hasSemantic).where(statsWhere)
      : Promise.resolve(null),
  ]);

  const count = Number(filteredCountRes?.[0]?.count ?? 0);
  const statsSource = (statsCountRes?.[0] ?? filteredCountRes?.[0]) as
    | { count?: number; ready?: number; review?: number; draft?: number; flagged?: number }
    | undefined;

  const stats: QuestionListStats = {
    total: Number(statsSource?.count ?? 0),
    ready: Number(statsSource?.ready ?? 0),
    review: Number(statsSource?.review ?? 0),
    draft: Number(statsSource?.draft ?? 0),
    flagged: Number(statsSource?.flagged ?? 0),
  };

  return { total: count, stats };
}
